/**
 * Church Check-In — Apps Script bridge
 * ------------------------------------------------------------------
 * DEPLOY INSTRUCTIONS
 *
 * 1. Open your Google Sheet (must contain a member-list tab and an
 *    "Attendance" tab — see README.md for exact column headers). The
 *    member-list tab is named "Guest" by default (see MEMBERS_SHEET_NAME
 *    below if you need to call it something else).
 * 2. Extensions → Apps Script.
 * 3. Delete anything in Code.gs and paste this whole file in.
 * 4. Set the shared secret (do NOT hardcode it):
 *      Project Settings (gear icon) → Script Properties → Add script
 *      property → name it SHARED_SECRET → paste in a long random
 *      string (e.g. generate one with `openssl rand -hex 32`).
 *    This same value goes into the Next.js app's APPS_SCRIPT_SHARED_SECRET
 *    env var.
 * 4b. (Optional) If your member-list or attendance tab is named
 *      something other than the defaults below, add Script Properties
 *      MEMBERS_SHEET_NAME and/or ATTENDANCE_SHEET_NAME with the exact
 *      tab name you're using. This lets you rename tabs later without
 *      editing or redeploying this file — just update the property.
 * 5. Deploy → New deployment → select type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the "Web app URL" it gives you — that's APPS_SCRIPT_URL in
 *    the Next.js app's env vars.
 * 7. Every time you edit this file, you must create a NEW deployment
 *    (or use "Manage deployments" → edit → new version) for the
 *    changes to go live at the same URL. Script Property changes
 *    (SHARED_SECRET, MEMBERS_SHEET_NAME, ATTENDANCE_SHEET_NAME) take
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

// Tab names default to "Guest" and "Attendance" but can be overridden
// per-deployment via Script Properties (see step 4b above) without
// touching this file.
var MEMBERS_SHEET = PropertiesService.getScriptProperties().getProperty('MEMBERS_SHEET_NAME') || 'Guest';
var ATTENDANCE_SHEET = PropertiesService.getScriptProperties().getProperty('ATTENDANCE_SHEET_NAME') || 'Attendance';
var MAX_SEARCH_RESULTS = 8;

// Member-list columns
var COL_MEMBER_ID = 0;
var COL_FULL_NAME = 1;
var COL_PHONE = 2;
var COL_EMAIL = 3;
var COL_DATE_ADDED = 4;
var COL_ACTIVE = 5;

// Attendance columns
var COL_ATT_TIMESTAMP = 0;
var COL_ATT_MEMBER_ID = 1;
var COL_ATT_FULL_NAME = 2;
var COL_ATT_SERVICE_DATE = 3;

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

function isActiveValue(v) {
  var s = String(v).trim().toLowerCase();
  return s !== 'false' && s !== 'no' && s !== 'inactive' && s !== '0';
}

var ACTIVE_MEMBERS_CACHE_KEY = 'active_members_v1';
var ACTIVE_MEMBERS_CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Returns [{memberId, fullName}, ...] for active members, backed by
 * CacheService so repeated searches within ACTIVE_MEMBERS_CACHE_TTL_SECONDS
 * don't each re-read and re-scan the whole sheet — this is the main lever
 * on search latency, since the Apps Script network round-trip itself is
 * a fixed cost we can't avoid. Returns null if the sheet doesn't exist.
 * A newly-added member can take up to the TTL to show up in search.
 */
function getActiveMembersCached() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(ACTIVE_MEMBERS_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MEMBERS_SHEET);
  if (!sheet) {
    return null;
  }

  var values = sheet.getDataRange().getValues();
  var members = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var memberId = row[COL_MEMBER_ID];
    var fullName = row[COL_FULL_NAME];
    if (!memberId || !fullName) continue;
    if (!isActiveValue(row[COL_ACTIVE])) continue;
    members.push({ memberId: String(memberId), fullName: String(fullName) });
  }

  // CacheService values are capped at 100KB; for very large member lists
  // this put() could throw, so don't let a cache failure break search.
  try {
    cache.put(ACTIVE_MEMBERS_CACHE_KEY, JSON.stringify(members), ACTIVE_MEMBERS_CACHE_TTL_SECONDS);
  } catch (err) {
    // Fine to skip caching — search still works, just uncached.
  }

  return members;
}

/**
 * search — case-insensitive substring match against fullName.
 * Only ever returns memberId + fullName, max MAX_SEARCH_RESULTS,
 * and only for active members. Never returns phone, email, or the
 * full member list.
 */
function searchMembers(query) {
  var q = String(query).trim().toLowerCase();
  if (!q) {
    return { success: true, results: [] };
  }

  var members = getActiveMembersCached();
  if (members === null) {
    return { success: false, error: '"' + MEMBERS_SHEET + '" sheet not found.' };
  }

  var results = [];
  for (var i = 0; i < members.length; i++) {
    if (members[i].fullName.toLowerCase().indexOf(q) !== -1) {
      results.push(members[i]);
      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
  }

  return { success: true, results: results };
}

/**
 * checkin — appends one Attendance row for memberId, guarded by
 * LockService so two simultaneous taps can't both slip past the
 * "already checked in today" check. Never touches the member-list sheet.
 */
function checkinMember(memberId) {
  memberId = String(memberId || '').trim();
  if (!memberId) {
    return { success: false, error: 'Missing memberId.' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return { success: false, error: 'System is busy, please try again in a moment.' };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var membersSheet = ss.getSheetByName(MEMBERS_SHEET);
    var attendanceSheet = ss.getSheetByName(ATTENDANCE_SHEET);
    if (!membersSheet || !attendanceSheet) {
      return { success: false, error: '"' + MEMBERS_SHEET + '" or "' + ATTENDANCE_SHEET + '" sheet not found.' };
    }

    // Look up the authoritative name server-side rather than trusting the client.
    var memberValues = membersSheet.getDataRange().getValues();
    var fullName = null;
    for (var i = 1; i < memberValues.length; i++) {
      if (String(memberValues[i][COL_MEMBER_ID]) === memberId && isActiveValue(memberValues[i][COL_ACTIVE])) {
        fullName = String(memberValues[i][COL_FULL_NAME]);
        break;
      }
    }
    if (!fullName) {
      return { success: false, error: 'Member not found.' };
    }

    var today = todayString();
    var attendanceValues = attendanceSheet.getDataRange().getValues();
    for (var j = 1; j < attendanceValues.length; j++) {
      var row = attendanceValues[j];
      if (String(row[COL_ATT_MEMBER_ID]) === memberId && row[COL_ATT_SERVICE_DATE] === today) {
        return { success: true, alreadyCheckedIn: true, fullName: fullName };
      }
    }

    attendanceSheet.appendRow([new Date(), memberId, fullName, today]);
    return { success: true, alreadyCheckedIn: false, fullName: fullName };
  } finally {
    lock.releaseLock();
  }
}

/**
 * stats — today's check-in count + list, and total active member
 * count, for the admin view.
 */
function getStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET);
  var attendanceSheet = ss.getSheetByName(ATTENDANCE_SHEET);
  if (!membersSheet || !attendanceSheet) {
    return { success: false, error: '"' + MEMBERS_SHEET + '" or "' + ATTENDANCE_SHEET + '" sheet not found.' };
  }

  var totalMembers = 0;
  var memberValues = membersSheet.getDataRange().getValues();
  for (var i = 1; i < memberValues.length; i++) {
    if (memberValues[i][COL_MEMBER_ID] && isActiveValue(memberValues[i][COL_ACTIVE])) {
      totalMembers++;
    }
  }

  var today = todayString();
  var attendanceValues = attendanceSheet.getDataRange().getValues();
  var todayCheckins = [];
  for (var j = 1; j < attendanceValues.length; j++) {
    var row = attendanceValues[j];
    if (row[COL_ATT_SERVICE_DATE] === today) {
      todayCheckins.push({
        fullName: String(row[COL_ATT_FULL_NAME]),
        timestamp: new Date(row[COL_ATT_TIMESTAMP]).toISOString()
      });
    }
  }
  // Most recent first.
  todayCheckins.sort(function (a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return {
    success: true,
    todayCount: todayCheckins.length,
    totalMembers: totalMembers,
    todayCheckins: todayCheckins
  };
}

/**
 * export — full Attendance sheet contents, for CSV export from the
 * admin view.
 */
function exportAttendance() {
  var attendanceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATTENDANCE_SHEET);
  if (!attendanceSheet) {
    return { success: false, error: '"' + ATTENDANCE_SHEET + '" sheet not found.' };
  }

  var values = attendanceSheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[COL_ATT_MEMBER_ID]) continue;
    rows.push({
      timestamp: new Date(row[COL_ATT_TIMESTAMP]).toISOString(),
      memberId: String(row[COL_ATT_MEMBER_ID]),
      fullName: String(row[COL_ATT_FULL_NAME]),
      serviceDate: String(row[COL_ATT_SERVICE_DATE])
    });
  }

  return { success: true, rows: rows };
}
