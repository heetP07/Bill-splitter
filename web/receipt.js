export function parseReceiptText(text) {
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const normalized = line.trim().replace(/\s+/g, ' ');
    if (!normalized || /\b(subtotal|total|tax|hst|gst|pst|balance|payment|paid|change|cash|visa|mastercard|debit|credit|discount|savings|tender|refund)\b/i.test(normalized)) continue;
    const match = normalized.match(/^(.*?)\s+\$?(-?\d{1,5}(?:,\d{3})*\.\d{2})\s*[A-Za-z]?$/);
    if (!match) continue;
    const name = match[1].replace(/^\d{1,2}\s*[xX@]\s*/, '').trim();
    const price = Number(match[2].replaceAll(',', ''));
    if (!name || !Number.isFinite(price) || price <= 0 || price > 10000) continue;
    items.push({ name, price: price.toFixed(2) });
  }
  return items;
}

function pdfPageText(content) {
  const rows = [];
  const chunks = content.items.filter(item => item.str?.trim())
    .map(item => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
    .sort((left, right) => right.y - left.y || left.x - right.x);
  for (const chunk of chunks) {
    const row = rows.find(candidate => Math.abs(candidate.y - chunk.y) < 3);
    if (row) row.parts.push(chunk);
    else rows.push({ y: chunk.y, parts: [chunk] });
  }
  return rows.sort((left, right) => right.y - left.y)
    .map(row => row.parts.sort((left, right) => left.x - right.x).map(part => part.text).join(' ')).join('\n');
}

let ocrWorker;
async function getOcrWorker(onProgress) {
  if (!window.Tesseract) throw new Error('OCR could not load. Check your connection, then try again.');
  if (!ocrWorker) ocrWorker = await window.Tesseract.createWorker('eng', 1, {
    logger: message => {
      if (message.status === 'recognizing text') onProgress(`Reading image… ${Math.round(message.progress * 100)}%`);
    },
  });
  return ocrWorker;
}

async function recognizeImage(image, onProgress) {
  const worker = await getOcrWorker(onProgress);
  const result = await worker.recognize(image);
  return result.data.text;
}

async function readPdf(file, onProgress) {
  if (!window.pdfjsLib) throw new Error('PDF processing could not load. Check your connection, then try again.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdf.numPages > 10) throw new Error('This PDF has more than 10 pages. Please upload a shorter receipt.');
  const pages = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    onProgress(`Reading PDF page ${index} of ${pdf.numPages}…`);
    const page = await pdf.getPage(index);
    const text = pdfPageText(await page.getTextContent());
    if (parseReceiptText(text).length > 0 || text.trim().length >= 30) { pages.push(text); continue; }
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push(await recognizeImage(canvas, onProgress));
    canvas.width = 0;
    canvas.height = 0;
  }
  await pdf.destroy();
  return pages.join('\n');
}

export async function readReceipt(file, onProgress) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return readPdf(file, onProgress);
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo or PDF receipt.');
  onProgress(`Reading ${file.name}…`);
  return recognizeImage(file, onProgress);
}
