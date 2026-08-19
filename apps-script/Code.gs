/**
 * Church Check-In — Apps Script bridge
 * ------------------------------------------------------------------
 * DATA MODEL
 *
 * This script targets a single "wide" attendance sheet — one row per
 * person, one column per service date, with a checkbox in each cell
 * marking that person present on that date. There is no separate
 * Attendance log tab: checking someone in ticks the checkbox for
 * today's date column, directly in this sheet. (This is a deliberate
 * design choice for a specific existing sheet layout — it does modify
 * the member-list sheet, unlike the "never touch the member list"
 * approach an earlier version of this script used.)
 *
 * Expected layout:
 *   - Row MEMBERS_HEADER_ROW contains column headers, including a
 *     full-name column and one column per service date (the date
 *     column headers must be real dates, or date-parseable strings).
 *   - Column MEMBERS_FULL_NAME_COL (1-indexed; B = 2) holds each
 *     person's full name, one row per person, starting the row after
 *     the header row.
 *   - Date columns for the current/upcoming period must already exist
 *     — this script finds today's column, it never creates one.
 *
 * Matching is by exact full name (case-insensitive, trimmed) — there's
 * no separate unique ID column in this layout. If two people share an
 * identical name, search will show both and either can be checked in
 * under the shared name; this hasn't been built out further since it
 * wasn't flagged as a real concern.
 *
 * DEPLOY INSTRUCTIONS
 *
 * 1. Open the Google Sheet this is for.
 * 2. Extensions → Apps Script.
 * 3. Delete anything in Code.gs and paste this whole file in.
 * 4. Set required Script Properties (Project Settings (gear icon) →
 *    Script Properties → Add script property):
 *      - SHARED_SECRET — a long random string (e.g. `openssl rand -hex 32`).
 *        This same value goes into the Next.js app's
 *        APPS_SCRIPT_SHARED_SECRET env var. Do NOT hardcode it here.
 *      - MEMBERS_SHEET_NAME — the tab name (e.g. "Guest"). Defaults to
 *        "Guest" if not set.
 *      - MEMBERS_HEADER_ROW — the row number (1-indexed) with your
 *        column headers. Defaults to 1; set this if your headers
 *        aren't on row 1 (e.g. 10).
 *      - MEMBERS_FULL_NAME_COL — the column number (1-indexed) with
 *        full names. Defaults to 2 (column B).
 *    All four can be changed later without editing or redeploying this
 *    file — property changes take effect immediately.
 * 5. Deploy → New deployment → select type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the "Web app URL" it gives you — that's APPS_SCRIPT_URL in
 *    the Next.js app's env vars.
 * 7. Every time you edit this file, you must create a NEW deployment
 *    (or use "Manage deployments" → edit → new version) for the
 *    changes to go live at the same URL. Script Property changes take
 *    effect immediately without a redeploy.
 *
 * CORS NOTE: Apps Script web apps cannot set arbitrary response
 * headers, so they can't send a real Access-Control-Allow-Origin
 * header and can't handle CORS preflight (OPTIONS) requests at all.
 * That's fine here — the Next.js app never calls this URL from the
 * browser. All calls are server-to-server from Next.js API routes,
 * which sidesteps CORS entirely. doGet/doPost below happily accept
 * simple cross-origin requests (GET, or POST with a text/plain body)
 * if you ever want to hit this URL directly for testing — those
 * request types don't trigger a preflight, so they work despite the
 * limitation above. A doOptions() is included as a harmless no-op in
 * case Apps Script ever routes a preflight to it.
 * ------------------------------------------------------------------
 */

var MEMBERS_SHEET = PropertiesService.getScriptProperties().getProperty('MEMBERS_SHEET_NAME') || 'Guest';
var MEMBERS_HEADER_ROW = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_HEADER_ROW')) || 1;
var MEMBERS_FULL_NAME_COL = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_FULL_NAME_COL')) || 2;
var MAX_SEARCH_RESULTS = 8;

var ACTIVE_MEMBERS_CACHE_KEY = 'active_members_v2';
var ACTIVE_MEMBERS_CACHE_TTL_SECONDS = 900; // 15 minutes

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// Best-effort no-op for preflight; see CORS note above.
function doOptions(e) {
  return ContentService.createTextOutput('');
}

function handleRequest(e) {
  var data = parseRequestData(e);

  try {
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!expectedSecret) {
      return jsonOutput({ success: false, error: 'Server is not configured: missing SHARED_SECRET script property.' });
    }
    if (!data.secret || data.secret !== expectedSecret) {
      return jsonOutput({ success: false, error: 'Unauthorized.' });
    }

    switch (data.action) {
      case 'search':
        return jsonOutput(searchMembers(data.query || ''));
      case 'checkin':
        return jsonOutput(checkinMember(data.memberId || ''));
      case 'stats':
        return jsonOutput(getStats());
      case 'export':
        return jsonOutput(exportAttendance());
      default:
        return jsonOutput({ success: false, error: 'Unknown action: ' + data.action });
    }
  } catch (err) {
    return jsonOutput({ success: false, error: 'Server error: ' + err.message });
  }
}

/**
 * Merges query-string params (e.parameter, present on GET and on
 * form-encoded POST) with a JSON POST body (e.postData.contents),
 * with JSON body values taking precedence.
 */
function parseRequestData(e) {
  var data = {};
  if (e && e.parameter) {
    for (var key in e.parameter) {
      data[key] = e.parameter[key];
    }
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var k in body) {
        data[k] = body[k];
      }
    } catch (err) {
      // Not JSON (e.g. form-encoded POST) — e.parameter already has it.
    }
  }
  return data;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function todayString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Formats cellValue (a Date object, or a date-parseable string) as a
 * 'yyyy-MM-dd' string in the spreadsheet's own timezone
 * (Session.getScriptTimeZone(), set via File → Settings in the Sheet),
 * or null if cellValue isn't date-like. Comparing formatted strings
 * like this — rather than raw Date getters — matters because plain JS
 * Date getters (getFullYear/getMonth/getDate) resolve in the Apps
 * Script server's own execution timezone (effectively UTC), not the
 * spreadsheet's timezone. Near midnight in timezones ahead of UTC
 * (e.g. WAT, UTC+1), that mismatch reads "today" as still being
 * yesterday.
 */
function dateCellToYmd(cellValue) {
  var d = null;
  if (Object.prototype.toString.call(cellValue) === '[object Date]') {
    d = cellValue;
  } else if (typeof cellValue === 'string' && cellValue.trim()) {
    var parsed = new Date(cellValue);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }
  if (!d) return null;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Returns the 0-indexed position of today's date column within
 * headerRowValues, or -1 if no matching column exists. "Today" is
 * evaluated in the spreadsheet's timezone — see dateCellToYmd. */
function findTodayColumnIndex(headerRowValues) {
  var today = todayString();
  for (var c = 0; c < headerRowValues.length; c++) {
    if (dateCellToYmd(headerRowValues[c]) === today) {
      return c;
    }
  }
  return -1;
}

/**
 * Reads just the full-name column (cached, since this is what backs
 * every search keystroke) rather than the whole sheet, which can be
 * wide given the accumulated per-Sunday checkbox columns.
 */
function getMemberNamesCached() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(ACTIVE_MEMBERS_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MEMBERS_SHEET);
  if (!sheet) {
    return null;
  }

  var firstDataRow = MEMBERS_HEADER_ROW + 1;
  var lastRow = sheet.getLastRow();
  var names = [];

  if (lastRow >= firstDataRow) {
    var nameValues = sheet.getRange(firstDataRow, MEMBERS_FULL_NAME_COL, lastRow - MEMBERS_HEADER_ROW, 1).getValues();
    for (var i = 0; i < nameValues.length; i++) {
      var fullName = nameValues[i][0];
      if (fullName && String(fullName).trim()) {
        names.push(String(fullName).trim());
      }
    }
  }

  // CacheService values are capped at 100KB; don't let a cache failure
  // (e.g. a very large member list) break search — just skip caching.
  try {
    cache.put(ACTIVE_MEMBERS_CACHE_KEY, JSON.stringify(names), ACTIVE_MEMBERS_CACHE_TTL_SECONDS);
  } catch (err) {
    // Skip caching.
  }

  return names;
}

/**
 * search — case-insensitive substring match against full name.
 * Only ever returns memberId + fullName (memberId is the full name
 * itself, since matching is name-based — see file header), max
 * MAX_SEARCH_RESULTS. Never returns any other column's data.
 */
function searchMembers(query) {
  var q = String(query).trim().toLowerCase();
  if (!q) {
    return { success: true, results: [] };
  }

  var names = getMemberNamesCached();
  if (names === null) {
    return { success: false, error: '"' + MEMBERS_SHEET + '" sheet not found.' };
  }

  var results = [];
  for (var i = 0; i < names.length; i++) {
    if (names[i].toLowerCase().indexOf(q) !== -1) {
      results.push({ memberId: names[i], fullName: names[i] });
      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
  }

  return { success: true, results: results };
}

/**
 * checkin — finds the row matching fullName and today's date column,
 * then ticks that checkbox. Guarded by LockService so two simultaneous
 * taps can't both slip past the "already checked in today" check.
 * Only reads/writes the header row, the full-name column, and the one
 * target cell — never the whole (wide) sheet.
 */
function checkinMember(fullName) {
  fullName = String(fullName || '').trim();
  if (!fullName) {
    return { success: false, error: 'Missing name.' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return { success: false, error: 'System is busy, please try again in a moment.' };
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MEMBERS_SHEET);
    if (!sheet) {
      return { success: false, error: '"' + MEMBERS_SHEET + '" sheet not found.' };
    }

    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    var firstDataRow = MEMBERS_HEADER_ROW + 1;

    var headerValues = sheet.getRange(MEMBERS_HEADER_ROW, 1, 1, lastCol).getValues()[0];
    var todayColIndex = findTodayColumnIndex(headerValues);
    if (todayColIndex === -1) {
      return {
        success: false,
        error: 'No column found for today\'s date (' + todayString() + ') in "' + MEMBERS_SHEET + '". Please add today\'s date column first.'
      };
    }
    var todayCol = todayColIndex + 1;

    if (lastRow < firstDataRow) {
      return { success: false, error: 'Member not found.' };
    }

    var nameValues = sheet.getRange(firstDataRow, MEMBERS_FULL_NAME_COL, lastRow - MEMBERS_HEADER_ROW, 1).getValues();
    var q = fullName.toLowerCase();
    var targetRow = -1;
    var matchedName = null;
    for (var i = 0; i < nameValues.length; i++) {
      var name = nameValues[i][0];
      if (name && String(name).trim().toLowerCase() === q) {
        targetRow = firstDataRow + i;
        matchedName = String(name).trim();
        break;
      }
    }
    if (targetRow === -1) {
      return { success: false, error: 'Member not found.' };
    }

    var cell = sheet.getRange(targetRow, todayCol);
    if (cell.getValue() === true) {
      return { success: true, alreadyCheckedIn: true, fullName: matchedName };
    }

    cell.setValue(true);
    return { success: true, alreadyCheckedIn: false, fullName: matchedName };
  } finally {
    lock.releaseLock();
  }
}

/**
 * stats — today's check-in count + list, and total member count, for
 * the admin view. There's no per-check-in timestamp in this checkbox
 * model, so todayCheckins comes back in sheet row order, not
 * chronological order.
 */
function getStats() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MEMBERS_SHEET);
  if (!sheet) {
    return { success: false, error: '"' + MEMBERS_SHEET + '" sheet not found.' };
  }

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var firstDataRow = MEMBERS_HEADER_ROW + 1;

  var totalMembers = 0;
  var todayCheckins = [];

  if (lastRow >= firstDataRow) {
    var headerValues = sheet.getRange(MEMBERS_HEADER_ROW, 1, 1, lastCol).getValues()[0];
    var todayColIndex = findTodayColumnIndex(headerValues);

    var numRows = lastRow - MEMBERS_HEADER_ROW;
    var nameValues = sheet.getRange(firstDataRow, MEMBERS_FULL_NAME_COL, numRows, 1).getValues();
    var todayValues = todayColIndex === -1 ? null : sheet.getRange(firstDataRow, todayColIndex + 1, numRows, 1).getValues();

    for (var i = 0; i < nameValues.length; i++) {
      var fullName = nameValues[i][0];
      if (!fullName || !String(fullName).trim()) continue;
      totalMembers++;
      if (todayValues && todayValues[i][0] === true) {
        todayCheckins.push({ fullName: String(fullName).trim(), timestamp: '' });
      }
    }
  }

  return {
    success: true,
    todayCount: todayCheckins.length,
    totalMembers: totalMembers,
    todayCheckins: todayCheckins
  };
}

/**
 * export — everyone checked in today, for CSV export from the admin
 * view. No timestamp column in this model (see getStats comment).
 */
function exportAttendance() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MEMBERS_SHEET);
  if (!sheet) {
    return { success: false, error: '"' + MEMBERS_SHEET + '" sheet not found.' };
  }

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var firstDataRow = MEMBERS_HEADER_ROW + 1;
  var today = todayString();
  var rows = [];

  if (lastRow >= firstDataRow) {
    var headerValues = sheet.getRange(MEMBERS_HEADER_ROW, 1, 1, lastCol).getValues()[0];
    var todayColIndex = findTodayColumnIndex(headerValues);

    if (todayColIndex !== -1) {
      var numRows = lastRow - MEMBERS_HEADER_ROW;
      var nameValues = sheet.getRange(firstDataRow, MEMBERS_FULL_NAME_COL, numRows, 1).getValues();
      var todayValues = sheet.getRange(firstDataRow, todayColIndex + 1, numRows, 1).getValues();

      for (var i = 0; i < nameValues.length; i++) {
        var fullName = nameValues[i][0];
        if (!fullName || !String(fullName).trim()) continue;
        if (todayValues[i][0] === true) {
          rows.push({
            timestamp: '',
            memberId: String(fullName).trim(),
            fullName: String(fullName).trim(),
            serviceDate: today
          });
        }
      }
    }
  }

  return { success: true, rows: rows };
}

/**
 * NEW-GUEST FORM SYNC (optional)
 * ------------------------------------------------------------------
 * Google Forms cannot write directly into an existing tab with its own
 * columns — it always lands responses in its own linked tab. So the form
 * still writes to its own tab (NEW_GUEST_FORM_RESPONSES_SHEET) exactly as
 * Google Forms puts it there; this trigger then copies each new guest's
 * details across into the Guest sheet's real columns the moment they
 * submit, so they're searchable/check-in-able immediately — no one
 * manually copying rows over.
 *
 * Column mapping below is positional, confirmed against a REAL test
 * submission on the live sheet (not just the blank form definition):
 *   "Form Responses 4" (the guest form's response tab):
 *     A Timestamp | B Email Address (auto-collected — the submitter's own
 *     Google account email, NOT a typed answer; see note below) |
 *     C Full name | D Phone Number | E Home Address |
 *     F How you hear about the church? | G Gender
 *   "Guest" sheet, row MEMBERS_HEADER_ROW header:
 *     Full Name → col MEMBERS_FULL_NAME_COL (B) | Gender → col
 *     MEMBERS_GENDER_COL (C) | Phone → col MEMBERS_PHONE_COL (G) |
 *     Email → col MEMBERS_EMAIL_COL (H) | Address → col
 *     MEMBERS_ADDRESS_COL (I) | How-heard → col MEMBERS_HOW_HEARD_COL (K).
 * If you ever edit the form's questions (add/remove/reorder), the
 * response tab's columns shift with them and this mapping must be
 * updated to match — it does NOT read questions by title, only by
 * position. (An earlier version of this comment assumed a second,
 * explicitly-asked "Email Address" question that turned out not to
 * exist on the real form — always confirm against an actual test
 * submission, not just the blank form, before trusting a mapping.)
 *
 * NOTE on email: this form doesn't ask for an email address directly —
 * column B is only populated if "Collect email addresses" is turned on
 * for the form, and it's whichever Google account the submitter is
 * signed into, not necessarily an address they typed. If guests submit
 * from a shared/unsigned-in device, this column may be blank or wrong;
 * treat it as best-effort, not a verified contact email.
 *
 * A spreadsheet-level trigger fires on a submission to ANY form linked
 * anywhere in this spreadsheet (e.g. the separate Leaders & Stewards
 * form) — not just this one. The first thing this function does is check
 * the submitted row actually landed in NEW_GUEST_FORM_RESPONSES_SHEET,
 * and bails out silently otherwise.
 *
 * The Guest sheet's S/N column is pre-numbered far past the real data
 * (rows reserved for future growth) — "the last row with anything in it"
 * is NOT where new names belong, it's ~1600 rows past the last real
 * entry. New guests go right after the last row that actually HAS a
 * name (firstEmptyGuestRow below) — sparse gap rows earlier in the sheet
 * (an occasional blank name amid real entries) are left alone rather
 * than silently reused.
 *
 * SETUP:
 * 1. Make sure the guest/first-timer form (full name, phone, home
 *    address, how you heard, gender — plus whatever email Google
 *    auto-collects) is linked to THIS spreadsheet: Form → Responses tab
 *    → the Sheets icon → this file.
 * 2. In this Apps Script project, open Triggers (the clock icon in the
 *    left sidebar) → + Add Trigger:
 *      - Function: onNewGuestFormSubmit
 *      - Deployment: Head
 *      - Event source: From spreadsheet
 *      - Event type: On form submit
 * 3. Save — Google will ask you to authorize the trigger once.
 * 4. Test it with one throwaway submission before trusting it on real
 *    guests — submit the form with an obviously fake name, confirm it
 *    lands in the right Guest row with the right fields, then delete
 *    that test row.
 */
var NEW_GUEST_FORM_RESPONSES_SHEET =
  PropertiesService.getScriptProperties().getProperty('NEW_GUEST_FORM_RESPONSES_SHEET') || 'Form Responses 4';
var MEMBERS_GENDER_COL = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_GENDER_COL')) || 3;
var MEMBERS_PHONE_COL = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_PHONE_COL')) || 7;
var MEMBERS_EMAIL_COL = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_EMAIL_COL')) || 8;
var MEMBERS_ADDRESS_COL = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_ADDRESS_COL')) || 9;
var MEMBERS_HOW_HEARD_COL = Number(PropertiesService.getScriptProperties().getProperty('MEMBERS_HOW_HEARD_COL')) || 11;

function onNewGuestFormSubmit(e) {
  if (!e || !e.range || !e.values) return;

  // Ignore submissions to any other form linked in this spreadsheet.
  if (e.range.getSheet().getName() !== NEW_GUEST_FORM_RESPONSES_SHEET) return;

  var row = e.values; // 0-indexed: row[0] = column A, row[1] = column B, ...
  var fullName = row[2] ? String(row[2]).trim() : '';
  if (!fullName) return;

  var email = row[1] ? String(row[1]).trim() : '';
  var phone = row[3] ? String(row[3]).trim() : '';
  var address = row[4] ? String(row[4]).trim() : '';
  var howHeard = row[5] ? String(row[5]).trim() : '';
  var gender = row[6] ? String(row[6]).trim() : '';

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MEMBERS_SHEET);
  if (!sheet) return;

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // A guest who already exists (re-submitted the form, or is actually
    // a returning member who used the wrong button) shouldn't get a
    // second, duplicate row — that would just split their attendance
    // across two rows in future search results.
    if (nameAlreadyExists(sheet, fullName)) return;

    var targetRow = firstEmptyGuestRow(sheet);
    sheet.getRange(targetRow, MEMBERS_FULL_NAME_COL).setValue(fullName);
    if (gender) sheet.getRange(targetRow, MEMBERS_GENDER_COL).setValue(gender);
    if (phone) sheet.getRange(targetRow, MEMBERS_PHONE_COL).setValue(phone);
    if (email) sheet.getRange(targetRow, MEMBERS_EMAIL_COL).setValue(email);
    if (address) sheet.getRange(targetRow, MEMBERS_ADDRESS_COL).setValue(address);
    if (howHeard) sheet.getRange(targetRow, MEMBERS_HOW_HEARD_COL).setValue(howHeard);

    // Let the very next search see them, instead of waiting out the
    // 15-minute search cache.
    CacheService.getScriptCache().remove(ACTIVE_MEMBERS_CACHE_KEY);
  } finally {
    lock.releaseLock();
  }
}

/**
 * See the S/N note in the doc comment above — this deliberately finds
 * the row after the LAST NAMED row, not sheet.getLastRow() (which would
 * land far past the real data) and not the first blank name from the
 * top (which would land in an earlier sparse gap row instead).
 */
function firstEmptyGuestRow(sheet) {
  var firstDataRow = MEMBERS_HEADER_ROW + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) return firstDataRow;

  var nameValues = sheet.getRange(firstDataRow, MEMBERS_FULL_NAME_COL, lastRow - MEMBERS_HEADER_ROW, 1).getValues();
  for (var i = nameValues.length - 1; i >= 0; i--) {
    if (nameValues[i][0] && String(nameValues[i][0]).trim()) {
      return firstDataRow + i + 1;
    }
  }
  return firstDataRow;
}

function nameAlreadyExists(sheet, fullName) {
  var firstDataRow = MEMBERS_HEADER_ROW + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) return false;

  var nameValues = sheet.getRange(firstDataRow, MEMBERS_FULL_NAME_COL, lastRow - MEMBERS_HEADER_ROW, 1).getValues();
  var target = fullName.trim().toLowerCase();
  for (var i = 0; i < nameValues.length; i++) {
    var value = nameValues[i][0];
    if (value && String(value).trim().toLowerCase() === target) return true;
  }
  return false;
}
