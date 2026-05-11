/**
 * imageCompressor.js — Image compression utility
 * Ensures all generated receipt images stay under 1 MB
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MAX_SIZE_BYTES = 1_000_000; // 1 MB limit

/**
 * Compress an image file to ensure it's under 1 MB
 * Uses progressive quality reduction and resizing if needed
 *
 * @param {string} inputPath - Path to the source image
 * @param {string} [outputPath] - Path to save compressed image (defaults to overwriting input)
 * @returns {Promise<string>} - Path to the compressed image
 */
async function compressImage(inputPath, outputPath) {
  const targetPath = outputPath || inputPath;

  // Check if already under limit
  const stats = fs.statSync(inputPath);
  if (stats.size <= MAX_SIZE_BYTES) {
    console.log(`[COMPRESS] Image already under 1 MB (${(stats.size / 1024).toFixed(1)} KB)`);
    if (outputPath && outputPath !== inputPath) {
      fs.copyFileSync(inputPath, outputPath);
    }
    return targetPath;
  }

  console.log(`[COMPRESS] Original size: ${(stats.size / 1024).toFixed(1)} KB — compressing...`);

  // Try progressive quality reduction
  let quality = 85;
  let buffer;

  while (quality >= 10) {
    buffer = await sharp(inputPath)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (buffer.length <= MAX_SIZE_BYTES) {
      fs.writeFileSync(targetPath, buffer);
      console.log(
        `[COMPRESS] Compressed to ${(buffer.length / 1024).toFixed(1)} KB (quality: ${quality})`
      );
      return targetPath;
    }

    quality -= 10;
  }

  // If still too large, resize down
  const metadata = await sharp(inputPath).metadata();
  let width = metadata.width || 800;

  while (width >= 200) {
    width = Math.floor(width * 0.75);
    buffer = await sharp(inputPath)
      .resize({ width })
      .jpeg({ quality: 50, mozjpeg: true })
      .toBuffer();

    if (buffer.length <= MAX_SIZE_BYTES) {
      fs.writeFileSync(targetPath, buffer);
      console.log(
        `[COMPRESS] Resized to ${width}px width, ${(buffer.length / 1024).toFixed(1)} KB`
      );
      return targetPath;
    }
  }

  // Last resort — just save the smallest we got
  fs.writeFileSync(targetPath, buffer);
  console.log(`[COMPRESS] Final size: ${(buffer.length / 1024).toFixed(1)} KB`);
  return targetPath;
}

/**
 * Compress a PNG buffer to JPEG and ensure it's under 1 MB
 * @param {Buffer} pngBuffer - PNG image buffer
 * @param {string} outputPath - Path to save the compressed image
 * @returns {Promise<string>} - Path to the compressed image
 */
async function compressBuffer(pngBuffer, outputPath) {
  // First try direct JPEG conversion at high quality
  let quality = 90;
  let buffer;

  while (quality >= 10) {
    buffer = await sharp(pngBuffer)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (buffer.length <= MAX_SIZE_BYTES) {
      fs.writeFileSync(outputPath, buffer);
      console.log(
        `[COMPRESS] Buffer compressed to ${(buffer.length / 1024).toFixed(1)} KB (quality: ${quality})`
      );
      return outputPath;
    }

    quality -= 10;
  }

  // Resize if needed
  let width = 800;
  while (width >= 200) {
    buffer = await sharp(pngBuffer)
      .resize({ width })
      .jpeg({ quality: 50, mozjpeg: true })
      .toBuffer();

    if (buffer.length <= MAX_SIZE_BYTES) {
      fs.writeFileSync(outputPath, buffer);
      console.log(
        `[COMPRESS] Buffer resized to ${width}px, ${(buffer.length / 1024).toFixed(1)} KB`
      );
      return outputPath;
    }

    width = Math.floor(width * 0.75);
  }

  // Save whatever we have
  fs.writeFileSync(outputPath, buffer);
  console.log(`[COMPRESS] Final buffer size: ${(buffer.length / 1024).toFixed(1)} KB`);
  return outputPath;
}

module.exports = { compressImage, compressBuffer, MAX_SIZE_BYTES };
