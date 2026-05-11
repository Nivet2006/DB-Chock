/**
 * randomData.js — Random data generation utility
 * Generates realistic Indian names, emails, phone numbers, etc.
 */

const fs = require('fs');
const path = require('path');

// ── Load name and college lists ──────────────────────────────────────────────

const NAMES_FILE = path.join(__dirname, '..', 'NAMES.TXT');
const COLLEGES_FILE = path.join(__dirname, '..', 'COLLEGES.TXT');

/**
 * Read a TXT file and return non-empty trimmed lines
 * @param {string} filePath
 * @returns {string[]}
 */
function loadLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const names = loadLines(NAMES_FILE);
const colleges = loadLines(COLLEGES_FILE);

// ── Configuration arrays ─────────────────────────────────────────────────────

const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'protonmail.com',
  'icloud.com',
];

const BRANCHES = [
  'CSE',
  'AIML',
  'ISE',
  'ECE',
  'EEE',
  'ME',
  'CIVIL',
  'AIDS',
  'CSBS',
  'IT',
  'CCE',
  'BT',
  'CSD',
];

const SEMESTERS = [
  '1st Sem',
  '2nd Sem',
  '3rd Sem',
  '4th Sem',
  '5th Sem',
  '6th Sem',
  '7th Sem',
  '8th Sem',
];

const UPI_SUFFIXES = [
  '@paytm',
  '@ybl',
  '@ibl',
  '@okaxis',
  '@oksbi',
  '@okhdfcbank',
  '@axl',
  '@upi',
  '@apl',
  '@freecharge',
];

// ── Tracking sets for uniqueness ─────────────────────────────────────────────

const usedEmails = new Set();
const usedPhones = new Set();
const usedUtrs = new Set();

// ── Helper functions ─────────────────────────────────────────────────────────

/**
 * Pick a random element from an array
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random numeric string of given length
 * @param {number} length
 * @returns {string}
 */
function randomDigits(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

// ── Public generators ────────────────────────────────────────────────────────

/**
 * Get a random full name from NAMES.TXT
 * Appends a random last-name initial to make it more realistic
 * @returns {string}
 */
function getRandomName() {
  const firstName = pickRandom(names);
  const lastNames = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar',
    'Patel', 'Reddy', 'Nair', 'Joshi', 'Rao',
    'Mehta', 'Shah', 'Iyer', 'Menon', 'Pillai',
    'Hegde', 'Naik', 'Shetty', 'Gowda', 'Bhat',
  ];
  return `${firstName} ${pickRandom(lastNames)}`;
}

/**
 * Generate a unique email from a given name
 * @param {string} fullName
 * @returns {string}
 */
function getUniqueEmail(fullName) {
  const firstName = fullName.split(' ')[0].toLowerCase();
  let email;
  let attempts = 0;

  do {
    const domain = pickRandom(EMAIL_DOMAINS);
    const suffix = attempts > 0 ? randomInt(1, 9999) : '';
    email = `${firstName}${suffix}@${domain}`;
    attempts++;
  } while (usedEmails.has(email) && attempts < 100);

  usedEmails.add(email);
  return email;
}

/**
 * Generate a unique valid Indian 10-digit phone number
 * Indian mobile numbers start with 6, 7, 8, or 9
 * @returns {string}
 */
function getUniquePhone() {
  let phone;
  let attempts = 0;

  do {
    const startDigit = pickRandom(['6', '7', '8', '9']);
    phone = startDigit + randomDigits(9);
    attempts++;
  } while (usedPhones.has(phone) && attempts < 100);

  usedPhones.add(phone);
  return phone;
}

/**
 * Get a random college name from COLLEGES.TXT
 * @returns {string}
 */
function getRandomCollege() {
  return pickRandom(colleges);
}

/**
 * Get a random engineering branch
 * @returns {string}
 */
function getRandomBranch() {
  return pickRandom(BRANCHES);
}

/**
 * Get a random semester
 * @returns {string}
 */
function getRandomSemester() {
  return pickRandom(SEMESTERS);
}

/**
 * Generate a unique 12-digit UTR number
 * Format: 4-digit bank code + 8 random digits
 * @returns {string}
 */
function getUniqueUtr() {
  const bankCodes = ['SBIN', 'HDFC', 'ICIC', 'UTIB', 'KKBK', 'IOBA', 'BARB', 'PUNB'];
  let utr;
  let attempts = 0;

  do {
    // Generate a 12-digit numeric UTR
    utr = randomDigits(12);
    attempts++;
  } while (usedUtrs.has(utr) && attempts < 100);

  usedUtrs.add(utr);
  return utr;
}

/**
 * Generate a random sender UPI ID
 * @param {string} phone - Phone number to use as base
 * @returns {string}
 */
function getSenderUpi(phone) {
  return phone + pickRandom(UPI_SUFFIXES);
}

/**
 * Generate a random transaction ID
 * @returns {string}
 */
function getTransactionId() {
  return 'T' + Date.now().toString().slice(-10) + randomDigits(6);
}

/**
 * Generate a complete registration dataset
 * @returns {object}
 */
function generateRegistrationData() {
  const fullName = getRandomName();
  const email = getUniqueEmail(fullName);
  const phone = getUniquePhone();
  const college = getRandomCollege();
  const branch = getRandomBranch();
  const semester = getRandomSemester();
  const utr = getUniqueUtr();
  const senderUpi = getSenderUpi(phone);
  const transactionId = getTransactionId();
  const payeeUpi = 'fcbizgopalaneng@freecharge';

  return {
    fullName,
    email,
    phone,
    college,
    branch,
    semester,
    utr,
    senderUpi,
    transactionId,
    payeeUpi,
  };
}

/**
 * Add a human-like random delay
 * @param {import('playwright').Page} page
 * @param {number} [minMs=300]
 * @param {number} [maxMs=1200]
 */
async function humanDelay(page, minMs = 300, maxMs = 1200) {
  const delay = randomInt(minMs, maxMs);
  await page.waitForTimeout(delay);
}

/**
 * Type text with human-like speed (char by char with random delays)
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 */
async function humanType(page, selector, text) {
  await page.click(selector);
  await page.waitForTimeout(randomInt(100, 300));
  for (const char of text) {
    await page.type(selector, char, { delay: randomInt(30, 120) });
  }
}

module.exports = {
  getRandomName,
  getUniqueEmail,
  getUniquePhone,
  getRandomCollege,
  getRandomBranch,
  getRandomSemester,
  getUniqueUtr,
  getSenderUpi,
  getTransactionId,
  generateRegistrationData,
  humanDelay,
  humanType,
  pickRandom,
  randomInt,
  randomDigits,
};
