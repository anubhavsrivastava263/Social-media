/**
 * POST /api/analyze — multipart field name: "file"
 */
const express = require("express");
const { upload } = require("../middleware/upload");
const { extractText, AppError } = require("../services/extract");
const { analyzeText } = require("../services/analyze");

const router = express.Router();

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please choose a PDF, PNG, JPG, or WEBP file to upload.",
        code: "NO_FILE",
      });
    }

    const extracted = await extractText(req.file);
    const analysis = analyzeText(extracted.text);

    return res.json({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      source: extracted.source,
      text: extracted.text,
      stats: analysis.stats,
      suggestions: analysis.suggestions,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }

    console.error("Analyze route error:", err);
    return res.status(500).json({
      error: "Could not analyze this file. The server is still running — try another file.",
      code: "ANALYZE_FAILED",
    });
  }
});

module.exports = router;
