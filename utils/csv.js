/**
 * csv.js — CSV export utility
 * Handles appending registration data to output.csv
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '..', 'output.csv');

// CSV column headers
const HEADERS = [
  'Timestamp',
  'Event Name',
  'Full Name',
  'Email',
  'Phone',
  'College',
  'Branch',
  'Semester',
  'UTR',
  'Sender UPI',
  'Payee UPI',
  'Registration Reference Number',
  'Status',
];

/**
 * Escape a value for CSV (handles commas, quotes, newlines)
 * @param {string} val
 * @returns {string}
 */
function escapeCsv(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Ensure the CSV file exists and has headers
 */
function ensureCsvFile() {
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, HEADERS.map(escapeCsv).join(',') + '\n', 'utf-8');
    console.log('[CSV] Created output.csv with headers');
  }
}

/**
 * Append a registration record to the CSV
 * @param {object} data - Registration data object
 * @param {string} data.eventName
 * @param {string} data.fullName
 * @param {string} data.email
 * @param {string} data.phone
 * @param {string} data.college
 * @param {string} data.branch
 * @param {string} data.semester
 * @param {string} data.utr
 * @param {string} data.senderUpi
 * @param {string} data.payeeUpi
 * @param {string} data.referenceNumber
 * @param {string} data.status
 */
function appendRecord(data) {
  ensureCsvFile();

  const row = [
    new Date().toISOString(),
    data.eventName || '',
    data.fullName || '',
    data.email || '',
    data.phone || '',
    data.college || '',
    data.branch || '',
    data.semester || '',
    data.utr || '',
    data.senderUpi || '',
    data.payeeUpi || '',
    data.referenceNumber || '',
    data.status || 'UNKNOWN',
  ];

  const csvLine = row.map(escapeCsv).join(',') + '\n';
  fs.appendFileSync(CSV_FILE, csvLine, 'utf-8');
  console.log(`[CSV] Record appended for: ${data.fullName}`);
}

module.exports = { ensureCsvFile, appendRecord, HEADERS };
