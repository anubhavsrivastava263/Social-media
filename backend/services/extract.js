/**
 * Text extraction from PDFs (pdf-parse) and images (Tesseract OCR).
 * Every risky call is isolated so a corrupt file returns an AppError,
 * never an unhandled rejection that could take down the process.
 */
// Require the library entry, not the package root (avoids pdf-parse's debug test on load).
const path = require("path");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const { createWorker } = require("tesseract.js");

const TESS_CACHE = path.join(__dirname, "..", "..", ".tesseract-cache");

class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeExtractedText(raw) {
  return String(raw || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractFromPdf(buffer) {
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    console.error("PDF parse failed:", err.message);
    throw new AppError(
      "This PDF could not be read. It may be corrupted, password-protected, or image-only.",
      422,
      "PDF_PARSE_FAILED"
    );
  }

  const text = normalizeExtractedText(data && data.text);
  if (!text) {
    throw new AppError(
      "No readable text was found in this PDF. If it is a scan, save it as a PNG or JPG and try OCR instead.",
      422,
      "EMPTY_EXTRACTION"
    );
  }

  return { text, source: "pdf", pageCount: data.numpages || null };
}

async function extractFromImage(buffer) {
  let worker;
  try {
    worker = await createWorker("eng", 1, { cachePath: TESS_CACHE });
    const result = await worker.recognize(buffer);
    const text = normalizeExtractedText(result && result.data && result.data.text);

    if (!text) {
      throw new AppError(
        "OCR did not find any text in this image. Try a clearer screenshot with higher contrast.",
        422,
        "EMPTY_EXTRACTION"
      );
    }

    return { text, source: "ocr", confidence: result.data.confidence };
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("OCR failed:", err.message);
    throw new AppError(
      "OCR failed on this image. The file may be corrupted or unreadable.",
      422,
      "OCR_FAILED"
    );
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (termErr) {
        console.error("Tesseract worker terminate failed:", termErr.message);
      }
    }
  }
}

function isPdf(mimetype, originalname) {
  const mime = (mimetype || "").toLowerCase();
  const name = (originalname || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

async function extractText(file) {
  if (!file || !file.buffer || !file.buffer.length) {
    throw new AppError("No file data was received.", 400, "NO_FILE");
  }

  if (isPdf(file.mimetype, file.originalname)) {
    return extractFromPdf(file.buffer);
  }

  return extractFromImage(file.buffer);
}

module.exports = { extractText, AppError, normalizeExtractedText };
