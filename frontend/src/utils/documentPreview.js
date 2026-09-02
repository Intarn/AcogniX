export function getFileNameFromContentDisposition(contentDisposition, fallback = 'file') {
  const value = String(contentDisposition || '');

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, '')) || fallback;
    } catch {}
  }

  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim() || fallback;

  const plainMatch = value.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim().replace(/^"|"$/g, '') || fallback;

  return fallback;
}

export function getFileNameFromResourceUrl(resourceUrl, fallback = 'file') {
  const raw = String(resourceUrl || '').trim();
  if (!raw) return fallback;

  try {
    const clean = decodeURIComponent(raw.split('?')[0]);
    const storedName = clean.split('/').pop() || '';
    const withoutTimestamp = storedName.replace(/^\d+_/, '').trim();
    return withoutTimestamp || storedName || fallback;
  } catch {
    const storedName = raw.split('?')[0].split('/').pop() || '';
    return storedName.replace(/^\d+_/, '').trim() || storedName || fallback;
  }
}

export function isPdfDocument(contentType, fileName = '') {
  const type = String(contentType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  return type.includes('application/pdf') || name.endsWith('.pdf');
}

export function isDocxDocument(contentType, fileName = '') {
  const type = String(contentType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  return (
    type.includes('wordprocessingml') ||
    type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    name.endsWith('.docx')
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function uint16(view, offset) {
  return view.getUint16(offset, true);
}

function uint32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support DOCX preview. Please use Download instead.');
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipEntry(arrayBuffer, targetName) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const decoder = new TextDecoder('utf-8');

  const minimumEocdSize = 22;
  const maxCommentSize = 0xffff;
  const searchStart = Math.max(0, bytes.length - minimumEocdSize - maxCommentSize);
  let eocdOffset = -1;

  for (let i = bytes.length - minimumEocdSize; i >= searchStart; i -= 1) {
    if (uint32(view, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error('Invalid DOCX file.');

  const entryCount = uint16(view, eocdOffset + 10);
  const centralDirectoryOffset = uint32(view, eocdOffset + 16);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (uint32(view, offset) !== 0x02014b50) throw new Error('Invalid DOCX directory.');

    const compressionMethod = uint16(view, offset + 10);
    const compressedSize = uint32(view, offset + 20);
    const fileNameLength = uint16(view, offset + 28);
    const extraLength = uint16(view, offset + 30);
    const commentLength = uint16(view, offset + 32);
    const localHeaderOffset = uint32(view, offset + 42);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const fileName = decoder.decode(nameBytes);

    if (fileName === targetName) {
      if (uint32(view, localHeaderOffset) !== 0x04034b50) throw new Error('Invalid DOCX entry.');
      const localNameLength = uint16(view, localHeaderOffset + 26);
      const localExtraLength = uint16(view, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRaw(compressed);
      throw new Error('Unsupported DOCX compression method.');
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error('The DOCX document content could not be found.');
}

function getNodeText(node) {
  let text = '';
  const walk = (current) => {
    if (current.nodeType === Node.TEXT_NODE) return;
    const local = current.localName;
    if (local === 't') text += current.textContent || '';
    else if (local === 'tab') text += '\t';
    else if (local === 'br' || local === 'cr') text += '\n';
    else Array.from(current.childNodes || []).forEach(walk);
  };
  walk(node);
  return text;
}

function paragraphToHtml(paragraph) {
  const text = getNodeText(paragraph);
  const styleNode = Array.from(paragraph.getElementsByTagNameNS('*', 'pStyle'))[0];
  const styleValue = styleNode?.getAttributeNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'val'
  ) || styleNode?.getAttribute('w:val') || styleNode?.getAttribute('val') || '';

  const normalizedStyle = String(styleValue).toLowerCase();
  const content = escapeHtml(text).replace(/\n/g, '<br/>').replace(/\t/g, '&emsp;') || '&nbsp;';

  if (normalizedStyle.includes('heading1') || normalizedStyle === 'title') {
    return `<h1 style="font-size:1.5rem;font-weight:800;margin:1.2rem 0 .65rem;line-height:1.3">${content}</h1>`;
  }
  if (normalizedStyle.includes('heading2')) {
    return `<h2 style="font-size:1.25rem;font-weight:800;margin:1rem 0 .55rem;line-height:1.35">${content}</h2>`;
  }
  if (normalizedStyle.includes('heading3')) {
    return `<h3 style="font-size:1.05rem;font-weight:750;margin:.9rem 0 .45rem;line-height:1.4">${content}</h3>`;
  }

  return `<p style="font-size:.95rem;line-height:1.75;margin:.45rem 0;white-space:normal">${content}</p>`;
}

function tableToHtml(table) {
  const rows = Array.from(table.children || []).filter((node) => node.localName === 'tr');
  const rowHtml = rows.map((row) => {
    const cells = Array.from(row.children || []).filter((node) => node.localName === 'tc');
    return `<tr>${cells.map((cell) => {
      const paragraphs = Array.from(cell.children || []).filter((node) => node.localName === 'p');
      const text = paragraphs.map(getNodeText).filter(Boolean).join('\n');
      return `<td style="border:1px solid #d1d5db;padding:.55rem .7rem;vertical-align:top;white-space:pre-wrap">${escapeHtml(text)}</td>`;
    }).join('')}</tr>`;
  }).join('');

  return `<div style="overflow-x:auto;margin:.9rem 0"><table style="width:100%;border-collapse:collapse;font-size:.9rem">${rowHtml}</table></div>`;
}

export async function docxBlobToHtml(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const xmlBytes = await extractZipEntry(arrayBuffer, 'word/document.xml');
  const xmlText = new TextDecoder('utf-8').decode(xmlBytes);
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');

  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Unable to parse DOCX content.');
  }

  const body = Array.from(xml.getElementsByTagNameNS('*', 'body'))[0];
  if (!body) throw new Error('DOCX body is missing.');

  const blocks = [];
  Array.from(body.children || []).forEach((node) => {
    if (node.localName === 'p') blocks.push(paragraphToHtml(node));
    if (node.localName === 'tbl') blocks.push(tableToHtml(node));
  });

  return blocks.join('') || '<p style="color:#6b7280">This DOCX document contains no readable text.</p>';
}
