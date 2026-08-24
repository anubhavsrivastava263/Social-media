# Social Media Content Analyzer

Upload a PDF or a screenshot of a social media post. The app extracts the text (PDF parser or Tesseract OCR) and returns engagement stats plus deterministic, rule-based suggestions. No API keys are required.

## Setup

Requires **Node.js 18+**.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

`npm start` serves both the API and the static frontend.

## Project structure

```
├── backend/
│   ├── server.js                 # Express app, static files, error handler
│   ├── routes/analyze.js         # POST /api/analyze
│   ├── middleware/upload.js      # multer: type + 15 MB limit
│   └── services/
│       ├── extract.js            # PDF parse + OCR (isolated failures)
│       └── analyze.js            # stats + suggestion rules
├── frontend/                     # vanilla HTML/CSS/JS (no build)
├── package.json
├── README.md
└── APPROACH.md
```

## API

### `GET /api/health`

```json
{ "ok": true, "service": "social-media-content-analyzer" }
```

### `POST /api/analyze`

Multipart form field: **`file`**.

Accepted types: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`. Max size: **15 MB**.

**Success (200)**

```json
{
  "filename": "post.pdf",
  "mimeType": "application/pdf",
  "source": "pdf",
  "text": "extracted copy…",
  "stats": {
    "wordCount": 42,
    "characterCount": 240,
    "sentenceCount": 4,
    "hashtagCount": 0,
    "mentionCount": 0,
    "emojiCount": 0,
    "questionCount": 0,
    "hasQuestion": false,
    "hasCallToAction": false
  },
  "suggestions": [
    {
      "id": "hashtags",
      "priority": "high",
      "title": "Add 2–5 relevant hashtags",
      "detail": "…"
    }
  ]
}
```

`source` is `"pdf"` or `"ocr"`.

**Errors (400 / 422 / 500)**

| Code | Meaning |
| --- | --- |
| `NO_FILE` | Missing upload |
| `INVALID_TYPE` | Not PDF/PNG/JPG/WEBP |
| `FILE_TOO_LARGE` | Over 15 MB |
| `PDF_PARSE_FAILED` | Unreadable / corrupt PDF |
| `OCR_FAILED` | Tesseract could not process the image |
| `EMPTY_EXTRACTION` | No text found |
| `ANALYZE_FAILED` / `INTERNAL_ERROR` | Unexpected failure; process stays up |

The UI also validates type and size **before** upload.

## Notes

- First image upload may take longer while Tesseract downloads English language data.
- Image-only PDFs have no text layer; export a PNG/JPG and use OCR instead.
- Suggestions are rule-based (hashtags, CTA, length, emojis, questions, etc.), not an LLM.
