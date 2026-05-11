/**
 * paymentGenerator.js — Fake UPI payment receipt generator (v2.0)
 * Generates unique, highly-realistic payment confirmation screenshots 
 * by randomly selecting between Google Pay, PhonePe, and Paytm designs.
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { compressBuffer } = require('./imageCompressor');

const RECEIPTS_DIR = path.join(__dirname, '..', 'generated_receipts');

if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

// Curated list of Indian Banks for realistic rendering
const BANKS = [
  'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 
  'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda', 
  'Canara Bank', 'Union Bank of India', 'Paytm Payments Bank'
];

/**
 * Format date to Indian locale
 */
function formatDate(date, format = 'short') {
  if (format === 'long') {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format time to 12-hour format
 */
function formatTime(date, includeSeconds = true) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  });
}

/**
 * Draw rounded rectangle on canvas
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw Google Pay Style Receipt
 */
function drawGooglePay(ctx, width, height, data, dateStr, timeStr) {
  const { amount, utr, senderUpi, transactionId, senderName, receiverName, bankName, bankAcc } = data;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Top header bar (Google Pay Blue)
  ctx.fillStyle = '#1A73E8';
  ctx.fillRect(0, 0, width, 56);

  // GPay Logo text simulation
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Google Pay', 24, 35);

  // Center logo circle (Initials)
  const centerX = width / 2;
  ctx.fillStyle = '#E8F0FE';
  ctx.beginPath();
  ctx.arc(centerX, 120, 36, 0, Math.PI * 2);
  ctx.fill();

  // Initial letter
  ctx.fillStyle = '#1A73E8';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(receiverName.charAt(0).toUpperCase(), centerX, 131);

  // Receiver Name
  ctx.fillStyle = '#202124';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(receiverName.length > 35 ? receiverName.slice(0, 32) + '...' : receiverName, centerX, 185);

  // UPI Id
  ctx.fillStyle = '#5F6368';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText(data.receiverUpi || 'fcbizgopalaneng@freecharge', centerX, 205);

  // Amount
  ctx.fillStyle = '#202124';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillText(amount, centerX, 265);

  // Success Checkmark Pill
  roundRect(ctx, centerX - 65, 290, 130, 28, 14);
  ctx.fillStyle = '#E6F4EA';
  ctx.fill();
  
  ctx.fillStyle = '#137333';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillText('✓ Completed', centerX, 308);

  // Date and Time
  ctx.fillStyle = '#5F6368';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText(`${dateStr}, ${timeStr}`, centerX, 345);

  // Divider line
  ctx.strokeStyle = '#DADCE0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 375);
  ctx.lineTo(width - 24, 375);
  ctx.stroke();

  // Transaction Info Rows
  ctx.textAlign = 'left';
  let y = 415;
  const leftX = 24;
  const rightX = width - 24;
  const rowHeight = 44;

  function drawGPayRow(label, value) {
    ctx.fillStyle = '#5F6368';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText(label, leftX, y);

    ctx.fillStyle = '#202124';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value, rightX, y);
    ctx.textAlign = 'left';
    y += rowHeight;
  }

  drawGPayRow('From: ' + senderName, senderUpi);
  drawGPayRow('Paid via', `${bankName} (${bankAcc})`);
  drawGPayRow('UPI Transaction ID', transactionId);
  drawGPayRow('Google Pay UTR', utr);

  // Footer UPI security badge
  ctx.textAlign = 'center';
  ctx.fillStyle = '#70757a';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('Secured by UPI • Google Safe Payments', centerX, height - 50);
}

/**
 * Draw PhonePe Style Receipt
 */
function drawPhonePe(ctx, width, height, data, dateStr, timeStr) {
  const { amount, utr, senderUpi, transactionId, senderName, receiverName, bankName, bankAcc } = data;

  // Background
  ctx.fillStyle = '#F5F6F9';
  ctx.fillRect(0, 0, width, height);

  // Top header bar (PhonePe Purple)
  ctx.fillStyle = '#5F259F';
  ctx.fillRect(0, 0, width, 140);

  // PhonePe title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PhonePe', 24, 45);

  // "Transaction Successful" header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText('Transaction Successful', 24, 90);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = '#D6C1EC';
  ctx.fillText(`${dateStr} at ${timeStr}`, 24, 112);

  // White Card Layout
  const cardX = 16;
  const cardWidth = width - 32;
  const cardY = 155;
  const cardHeight = height - 260;

  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inside Card - Paid To Section
  ctx.fillStyle = '#6B7280';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('Paid to', cardX + 20, cardY + 30);

  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 15px Arial, sans-serif';
  
  // Wrap receiver name
  const words = receiverName.split(' ');
  let line = '';
  let textY = cardY + 52;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > cardWidth - 40) {
      ctx.fillText(line, cardX + 20, textY);
      textY += 18;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, cardX + 20, textY);
    textY += 22;
  }

  // Receiver UPI ID
  ctx.fillStyle = '#4B5563';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText(`UPI ID: ${data.receiverUpi || 'fcbizgopalaneng@freecharge'}`, cardX + 20, textY);
  textY += 35;

  // Big Bold Amount
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillText(amount, cardX + 20, textY);
  textY += 35;

  // Divider line
  ctx.strokeStyle = '#E5E7EB';
  ctx.beginPath();
  ctx.moveTo(cardX + 20, textY);
  ctx.lineTo(cardX + cardWidth - 20, textY);
  ctx.stroke();
  textY += 35;

  // Sub details
  function drawPhonePeRow(label, val) {
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(label, cardX + 20, textY);

    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, cardX + cardWidth - 20, textY);
    ctx.textAlign = 'left';
    textY += 30;
  }

  drawPhonePeRow('Debited From', `${bankName} (${bankAcc})`);
  drawPhonePeRow('Transaction ID', transactionId);
  drawPhonePeRow('UTR Number', utr);

  // Footer branding
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('Powered by UPI • PhonePe Safe Checkout', width / 2, height - 40);
}

/**
 * Draw Paytm Style Receipt
 */
function drawPaytm(ctx, width, height, data, dateStr, timeStr) {
  const { amount, utr, senderUpi, transactionId, senderName, receiverName, bankName, bankAcc } = data;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Top header bar (Paytm Dark Blue / Cyan accents)
  ctx.fillStyle = '#002E7E';
  ctx.fillRect(0, 0, width, 64);

  // Logo text
  ctx.fillStyle = '#00BAF2';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('paytm', 24, 40);

  // Central Ticket Card Layout
  const ticketX = 20;
  const ticketW = width - 40;
  const ticketY = 85;
  const ticketH = 430;

  // Soft gray background card with dotted/dashed visual bottom
  roundRect(ctx, ticketX, ticketY, ticketW, ticketH, 16);
  ctx.fillStyle = '#F3F7FD';
  ctx.fill();
  ctx.strokeStyle = '#D6E2F5';
  ctx.stroke();

  // "UPI Money Transfer" label
  ctx.fillStyle = '#555555';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('UPI MONEY TRANSFER', ticketX + 20, ticketY + 30);

  // Receiver Info
  ctx.fillStyle = '#002E7E';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(receiverName.length > 35 ? receiverName.slice(0, 32) + '...' : receiverName, ticketX + 20, ticketY + 60);

  ctx.fillStyle = '#555555';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(`To UPI ID: ${data.receiverUpi || 'fcbizgopalaneng@freecharge'}`, ticketX + 20, ticketY + 80);

  // Big Amount
  ctx.fillStyle = '#0F0F0F';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.fillText(amount, ticketX + 20, ticketY + 140);

  // Green Success Badge Pill
  ctx.fillStyle = '#21C55D';
  ctx.beginPath();
  ctx.arc(ticketX + 30, ticketY + 180, 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillText('✓ Success', ticketX + 46, ticketY + 185);

  ctx.fillStyle = '#666666';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText(`${dateStr}, ${timeStr}`, ticketX + 20, ticketY + 215);

  // Inner Divider
  ctx.strokeStyle = '#DDE4EE';
  ctx.beginPath();
  ctx.moveTo(ticketX + 20, ticketY + 235);
  ctx.lineTo(ticketX + ticketW - 20, ticketY + 235);
  ctx.stroke();

  // Transaction details
  let y = ticketY + 270;
  function drawPaytmRow(label, val) {
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(label, ticketX + 20, y);

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, ticketX + ticketW - 20, y);
    ctx.textAlign = 'left';
    y += 35;
  }

  drawPaytmRow('From', senderName);
  drawPaytmRow('Sender UPI ID', senderUpi);
  drawPaytmRow('From Bank', `${bankName} (${bankAcc})`);
  drawPaytmRow('Wallet / Ref ID', transactionId);
  drawPaytmRow('UTR (Bank Ref)', utr);

  // Bottom Security Badges
  ctx.textAlign = 'center';
  ctx.fillStyle = '#777777';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('Paytm Verified Safe Transfer • UPI 2.0', width / 2, height - 50);
}

/**
 * Generate a realistic UPI payment receipt image using a random design
 *
 * @param {object} paymentData
 * @param {string} paymentData.amount - Payment amount (e.g., "₹299")
 * @param {string} paymentData.utr - UTR number (must match form entry)
 * @param {string} paymentData.senderUpi - Sender's UPI ID
 * @param {string} paymentData.transactionId - Transaction ID
 * @param {string} paymentData.senderName - Sender's name
 * @param {string} paymentData.phone - Sender's phone number
 * @param {string} [paymentData.receiverName] - Receiver name
 * @param {string} [paymentData.receiverUpi] - Receiver UPI ID
 * @returns {Promise<string>} - Path to the generated receipt image
 */
async function generatePaymentReceipt(paymentData) {
  const {
    amount = '₹299',
    utr,
    senderUpi,
    transactionId,
    senderName,
    phone,
    receiverName = 'GOPALAN COLLEGE OF ENGINEERING AND MANAGEMENT',
    receiverUpi = 'fcbizgopalaneng@freecharge',
  } = paymentData;

  const now = new Date();
  const dateStr = formatDate(now, 'short');
  const timeStr = formatTime(now, false);

  // Random bank name and last 4 digits
  const bankName = BANKS[Math.floor(Math.random() * BANKS.length)];
  const bankAcc = String(Math.floor(1000 + Math.random() * 9000));

  const inputData = {
    amount,
    utr,
    senderUpi,
    transactionId,
    senderName,
    phone,
    receiverName,
    receiverUpi,
    bankName,
    bankAcc
  };

  // Dimensions
  const WIDTH = 480;
  const HEIGHT = 840;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Randomly pick design template
  const designs = ['gpay', 'phonepe', 'paytm'];
  const chosenDesign = designs[Math.floor(Math.random() * designs.length)];

  console.log(`[RECEIPT] Rendering receipt using template: ${chosenDesign.toUpperCase()}`);

  if (chosenDesign === 'gpay') {
    drawGooglePay(ctx, WIDTH, HEIGHT, inputData, dateStr, timeStr);
  } else if (chosenDesign === 'phonepe') {
    drawPhonePe(ctx, WIDTH, HEIGHT, inputData, dateStr, timeStr);
  } else {
    drawPaytm(ctx, WIDTH, HEIGHT, inputData, dateStr, timeStr);
  }

  // Export buffer
  const pngBuffer = canvas.toBuffer('image/png');

  // File naming
  const filename = `receipt_${utr}_${Date.now()}.jpg`;
  const outputPath = path.join(RECEIPTS_DIR, filename);

  // Force image file compression to under 1MB
  await compressBuffer(pngBuffer, outputPath);

  console.log(`[RECEIPT] Saved compressed JPEG receipt to: ${filename}`);
  return outputPath;
}

module.exports = { generatePaymentReceipt };
