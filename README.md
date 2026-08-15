# Church Check-In

A mobile-first check-in app for returning members, backed by a Google Sheet.
Someone scans a QR code at the welcome desk, finds their name, taps it, and
they're marked present — no typing, no duplicate member records. Checking in
only ever appends a row to the `Attendance` sheet; the `Members` sheet is
never modified by the app.

The home page (`/`) is a simple chooser: "I've been here before" leads into
the in-app search-and-check-in flow (`/checkin`); "This is my first time"
links straight out to your existing Google Form — first-time guests never
touch the Members/Attendance data at all.

## How it fits together

```
Phone browser → Next.js API routes (hold the secret) → Apps Script web app → Google Sheet
```

The browser never talks to Apps Script directly and never sees the shared
secret or the Apps Script URL — those live in server-side env vars only.

---

## 1. Set up the Google Sheet

Create one Google Spreadsheet with two tabs (exact names matter):

**`Members`** — columns, in this order, with a header row:

| memberId | fullName | phone | email | dateAdded | active |
|---|---|---|---|---|---|

- `memberId` — any unique string (e.g. `M0001`).
- `active` — `TRUE`/`FALSE`. Inactive members won't show up in search and
  can't be checked in.

**`Attendance`** — columns, in this order, with a header row:

| timestamp | memberId | fullName | serviceDate |
|---|---|---|---|

Leave `Attendance` empty apart from the header — the app appends to it.

You can populate `Members` with your real list now, or first test with fake
data — see [Seeding test data](#seeding-test-data) below.

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

This writes `scripts/output/members-seed.csv` with ~20 fake members (no
Google credentials required). Open the file, copy the data rows, and paste
them into the `Members` sheet starting at row 2.

## 5. Deploy to Vercel

1. Push this repo to GitHub (or your git host of choice).
2. In Vercel, **Add New → Project**, import the repo.
3. Under **Environment Variables**, add the same variables from step 3
   (`APPS_SCRIPT_URL`, `APPS_SCRIPT_SHARED_SECRET`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`, `NEW_MEMBER_FORM_URL`).
4. Deploy. Point the welcome-desk QR code at the deployed URL (the root
   `/`).

---

## Notes

- **Never modifies Members.** The `checkin` action only appends to
  `Attendance`; it never writes to `Members`. If a name can't be found,
  people are told to see someone at the welcome desk rather than being able
  to create a record themselves.
- **Duplicate-safe.** `checkin` checks for an existing Attendance row for
  that `memberId` + today's date before appending, wrapped in
  `LockService` so two simultaneous taps can't both slip through.
- **Search stays narrow.** The `search` action only ever returns
  `memberId` and `fullName`, capped at 8 results — never phone, email, or
  the full member list.
- **Admin auth** is a single shared password (no user accounts). The
  session cookie is an HMAC of the password, so rotating `ADMIN_PASSWORD`
  or `ADMIN_SESSION_SECRET` immediately invalidates existing sessions.
