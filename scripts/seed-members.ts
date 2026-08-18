/**
 * Generates a CSV of ~20 fake members you can paste into your
 * member-list sheet (named "Guest" by default) to test search before
 * importing your real list.
 *
 * Usage:
 *   npm run seed
 *
 * This does NOT touch your Google Sheet directly (no Google API
 * credentials needed). It writes scripts/output/members-seed.csv —
 * open it, copy the rows (without the header, unless your sheet is
 * empty), and paste them into your member-list tab starting at row 2.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Barbara', 'Grace', 'Samuel', 'Ruth', 'Daniel', 'Esther', 'Joseph',
  'Naomi', 'Andrew', 'Faith', 'Peter',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Martinez', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Clark',
  'Lewis', 'Young', 'Walker', 'Hall', 'Allen',
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function randomPhone(): string {
  const exchange = 200 + Math.floor(Math.random() * 700);
  const line = Math.floor(1000 + Math.random() * 9000);
  return `(555) ${exchange}-${line}`;
}

function randomPastDate(): string {
  const daysAgo = Math.floor(Math.random() * 700); // up to ~2 years back
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function main() {
  const count = FIRST_NAMES.length; // 20
  const rows: string[][] = [];

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i];
    const last = LAST_NAMES[i];
    const fullName = `${first} ${last}`;
    const memberId = `M${pad(i + 1, 4)}`;
    const phone = randomPhone();
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
    const dateAdded = randomPastDate();
    const active = 'TRUE';
    rows.push([memberId, fullName, phone, email, dateAdded, active]);
  }

  const header = ['memberId', 'fullName', 'phone', 'email', 'dateAdded', 'active'];
  const lines = [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'members-seed.csv');
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

  console.log(`Wrote ${rows.length} fake members to ${outPath}`);
  console.log('Open it, copy the data rows, and paste them into your member-list sheet starting at row 2.');
}

main();
