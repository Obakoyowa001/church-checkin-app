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
 * True if cellValue (a Date object, or a date-parseable string) falls
 * on the same calendar day as targetDate. Used to locate today's
 * service-date column among the header row's cells.
 */
function isSameCalendarDate(cellValue, targetDate) {
  var cellDate = null;
  if (Object.prototype.toString.call(cellValue) === '[object Date]') {
    cellDate = cellValue;
  } else if (typeof cellValue === 'string' && cellValue.trim()) {
    var parsed = new Date(cellValue);
    if (!isNaN(parsed.getTime())) {
      cellDate = parsed;
    }
  }
  if (!cellDate) return false;
  return (
    cellDate.getFullYear() === targetDate.getFullYear() &&
    cellDate.getMonth() === targetDate.getMonth() &&
    cellDate.getDate() === targetDate.getDate()
  );
}

/** Returns the 0-indexed position of today's date column within
 * headerRowValues, or -1 if no matching column exists. */
function findTodayColumnIndex(headerRowValues) {
  var today = new Date();
  for (var c = 0; c < headerRowValues.length; c++) {
    if (isSameCalendarDate(headerRowValues[c], today)) {
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
