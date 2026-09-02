const AppError = require('../error/AppError');

function hasPrefix(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function assertFileSignature(file) {
  if (!file?.buffer) return;
  const name = String(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  const buffer = file.buffer;

  const claimsPdf = name.endsWith('.pdf') || mime.includes('pdf');
  const claimsDocx = name.endsWith('.docx') || mime.includes('wordprocessingml');
  const claimsPng = name.endsWith('.png') || mime === 'image/png';
  const claimsJpeg = /\.(jpe?g)$/i.test(name) || /image\/jpe?g/.test(mime);
  const claimsWebp = name.endsWith('.webp') || mime === 'image/webp';

  let valid = true;
  if (claimsPdf) valid = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  else if (claimsDocx) valid = hasPrefix(buffer, [0x50, 0x4b]);
  else if (claimsPng) valid = hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  else if (claimsJpeg) valid = hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  else if (claimsWebp) valid = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!valid) {
    throw new AppError(400, 'INVALID_FILE_CONTENT', 'The uploaded file content does not match its file type.');
  }
}

module.exports = { assertFileSignature };
