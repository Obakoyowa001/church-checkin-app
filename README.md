# Church Check-In

A mobile-first check-in app for returning members, backed by a Google Sheet.
Someone scans a QR code at the welcome desk, finds their name, taps it, and
they're marked present — no typing, no duplicate member records. Checking in
ticks a checkbox in the person's row, under a column for today's date, in
your existing wide attendance sheet (one row per person, one column per
service date) — it doesn't append to a separate log.

The home page (`/`) is a simple chooser: "I've been here before" leads into
the in-app search-and-check-in flow (`/checkin`); "This is my first time"
links straight out to your existing Google Form. By default, first-time
guests never touch the member-list/Attendance data at all — their form
response lands wherever Google Forms puts it. If you want new guests to
show up in in-app search right away instead, there's an optional sync
trigger for that — see [Optional: sync new-guest form responses](#optional-sync-new-guest-form-responses-into-the-guest-sheet)
below.

## How it fits together

```
Phone browser → Next.js API routes (hold the secret) → Apps Script web app → Google Sheet
```

The browser never talks to Apps Script directly and never sees the shared
secret or the Apps Script URL — those live in server-side env vars only.

---

## 1. Set up the Google Sheet

This app is built around a **single existing "wide" attendance sheet** —
not a fresh two-tab setup. Your sheet needs:

- **One tab** holding your member/attendee list. Default expected name is
  `Guest`; override with a `MEMBERS_SHEET_NAME` Script Property (see step 2)
  if yours is named something else.
- **A header row** somewhere in that tab (doesn't have to be row 1) with, at
  minimum, a column for each person's full name. Set `MEMBERS_HEADER_ROW`
  (Script Property, defaults to `1`) to the actual row number your headers
  are on, and `MEMBERS_FULL_NAME_COL` (defaults to `2`, i.e. column B) to
  whichever column holds full names.
- **One column per service date**, to the right of the other columns, with
  the date itself as the column header (a real Date value or a
  date-parseable string like `08/19/2026`) and a checkbox per person below
  it. **These date columns must already exist for today and any upcoming
  dates you plan to check people in on** — the script finds today's column
  by matching the header row against today's date, but it never creates a
  new column itself.

There's no separate `Attendance` tab and no `memberId`/`active` columns in
this model — matching is done by **exact full name** (case-insensitive).
If two people share an identical name, search will show both, and checking
in matches whichever row it finds first with that name.

Nothing else about your sheet's other columns (gender, phone, email,
"how you heard about us," etc.) matters to this script — it only ever reads
the full-name column and writes to the matched today's-date checkbox.

## 2. Paste and deploy the Apps Script

1. In the Spreadsheet, go to **Extensions → Apps Script**.
2. Delete the default contents of `Code.gs` and paste in the full contents
   of [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
3. Set the shared secret as a Script Property (not hardcoded in the file):
   - Click the gear icon (**Project Settings**) in the left sidebar.
   - Scroll to **Script Properties → Add script property**.
   - Property: `SHARED_SECRET`
   - Value: a long random string, e.g. generate one with:
     ```
     openssl rand -hex 32
     ```
   - Save.
   - Add the sheet-layout properties from step 1, the same way, for any
     that don't match the defaults: `MEMBERS_SHEET_NAME` (default `Guest`),
     `MEMBERS_HEADER_ROW` (default `1`), `MEMBERS_FULL_NAME_COL` (default
     `2`). Skip any that already match your sheet.
4. Deploy it as a web app:
   - **Deploy → New deployment**.
   - Click the gear next to "Select type" and choose **Web app**.
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
   - Click **Deploy**, authorize the requested permissions, and copy the
     **Web app URL** it gives you (looks like
     `https://script.google.com/macros/s/.../exec`).
5. Keep that URL and the `SHARED_SECRET` value handy — they go into the
   Next.js app's env vars next.

Whenever you edit `Code.gs` later, you need to create a new deployment
version (**Deploy → Manage deployments → edit (pencil) → New version**) for
the changes to take effect — the URL stays the same.

## 3. Set the env vars

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `APPS_SCRIPT_URL` | The web app URL from step 2.4 above |
| `APPS_SCRIPT_SHARED_SECRET` | The same value you set as `SHARED_SECRET` in Script Properties |
| `ADMIN_PASSWORD` | A password for `/admin`, shared verbally with whoever needs it |
| `ADMIN_SESSION_SECRET` | Another random string (`openssl rand -hex 32`), used to sign the admin session cookie |
| `NEW_MEMBER_FORM_URL` | The public URL of your existing first-time-guest Google Form |

None of these are exposed to the browser except `NEW_MEMBER_FORM_URL`, which
is just a public link — it's read server-side and rendered into the "I've
been here before" / "This is my first time" chooser on the home page. If you
leave it unset, the "first time" button falls back to a "please see someone
at the welcome desk" message instead of a dead link.

## 4. Run locally

```bash
npm install
npm run dev
```

- Home (new vs. returning chooser): http://localhost:3000
- Returning-member check-in: http://localhost:3000/checkin
- Admin: http://localhost:3000/admin (prompts for `ADMIN_PASSWORD`)

### Seeding test data

To try search before importing your real member list:

```bash
npm run seed
```

This writes `scripts/output/members-seed.csv` with ~20 fake full names (no
Google credentials required). Since this app's sheet layout is
name-column-only (no `memberId`/`phone`/`email`/`active` columns), only the
`fullName` values from that file are relevant here — paste those names into
your member-list tab's full-name column, in the rows below your header row.

## 5. Deploy to Vercel

1. Push this repo to GitHub (or your git host of choice).
2. In Vercel, **Add New → Project**, import the repo.
3. Under **Environment Variables**, add the same variables from step 3
   (`APPS_SCRIPT_URL`, `APPS_SCRIPT_SHARED_SECRET`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`, `NEW_MEMBER_FORM_URL`).
4. Deploy. Point the welcome-desk QR code at the deployed URL (the root
   `/`).

---

## Optional: sync new-guest form responses into the Guest sheet

By default, "This is my first time" just sends guests to your Google Form
and stops there — their response lands in whatever tab Google Forms is
linked to, separate from the Guest sheet the check-in app searches. That
means a first-time guest won't show up in search next Sunday until someone
manually copies their name into the Guest sheet.

If you'd rather that happen automatically:

1. **Link the form to this spreadsheet**, if you haven't already: open the
   form → **Responses** tab → click the green Sheets icon (or **⋮ → Select
   response destination**) → choose this spreadsheet (the same one the
   Guest sheet lives in). Every submission now appends a row to a "Form
   Responses" tab here.
2. **Add the sync trigger**: in the same Apps Script project from step 2
   above (`Code.gs` already includes the `onNewGuestFormSubmit` function),
   open **Triggers** (clock icon, left sidebar) → **+ Add Trigger**:
   - Function: `onNewGuestFormSubmit`
   - Deployment: `Head`
   - Event source: `From spreadsheet`
   - Event type: `On form submit`
   - Save, and authorize it when Google asks.

From then on, every form submission copies the guest's name straight into
the Guest sheet's name column — they're searchable/check-in-able
immediately, no manual copying, no waiting out the search cache.

This assumes your form has one question with "name" somewhere in its title
(e.g. "Full Name") holding the guest's whole name. If your form splits
first/last into separate questions instead, adjust `extractFullName()` in
`Code.gs` to match. It also won't create a duplicate row for someone who's
already in the Guest sheet (e.g. a returning member who tapped the wrong
button).

---

## Notes

- **Checkin writes into the member-list sheet.** This is a deliberate
  change from an earlier version of this app, which kept a strictly
  separate append-only log. `checkin` now ticks one checkbox cell — the
  matched person's row, under today's date column — and never touches any
  other person's row or any other column. If a name can't be found, people
  are told to see someone at the welcome desk rather than being able to
  create a record themselves.
- **No per-check-in timestamp.** Because attendance is a checkbox per
  date rather than an appended log row, there's no way to know what time
  of day someone checked in — just that they did, for that date. The admin
  view's "checked in today" list is shown in sheet row order, not
  chronological order.
- **Duplicate-safe.** `checkin` checks whether today's checkbox is already
  ticked before writing, wrapped in `LockService` so two simultaneous taps
  can't both slip through.
- **Search stays narrow.** The `search` action only ever returns full
  names, capped at 8 results — never any other column's data.
- **Search is cached for 15 minutes.** Apps Script caches the full-name
  list (`CacheService`) so repeated searches don't re-read the sheet every
  keystroke — this is the main lever on search latency, since the network
  round-trip to Apps Script itself has some inherent, unavoidable delay.
  The cache is shared across every device hitting the script, not
  per-user. One consequence: a newly added name can take up to 15 minutes
  to start showing up in search — adjust `ACTIVE_MEMBERS_CACHE_TTL_SECONDS`
  in `Code.gs` if you need it fresher.
- **Admin auth** is a single shared password (no user accounts). The
  session cookie is an HMAC of the password, so rotating `ADMIN_PASSWORD`
  or `ADMIN_SESSION_SECRET` immediately invalidates existing sessions.
