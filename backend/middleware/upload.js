/**
 * Multer configuration: in-memory upload, type + size checks.
 * Files never touch disk, so a failed parse cannot leave leftovers.
 */
const multer = require("multer");

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const ALLOWED_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

function extensionOf(name) {
  const i = String(name || "").lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const ext = extensionOf(file.originalname);
    // Accept by MIME or extension — some browsers send an empty type on Windows.
    if (ALLOWED_MIME.has(mime) || ALLOWED_EXT.has(ext)) {
      cb(null, true);
      return;
    }
    const err = new Error(
      "Unsupported file type. Please upload a PDF, PNG, JPG, or WEBP file."
    );
    err.code = "INVALID_TYPE";
    cb(err);
  },
});

module.exports = { upload, MAX_BYTES, ALLOWED_MIME, ALLOWED_EXT };
