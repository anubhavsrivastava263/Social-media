const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const form = document.getElementById("upload-form");
const input = document.getElementById("file-input");
const pasteInput = document.getElementById("paste-input");
const dropzone = document.getElementById("dropzone");
const fileNameEl = document.getElementById("file-name");
const fileChip = document.getElementById("file-chip");
const clientError = document.getElementById("client-error");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const emptyState = document.getElementById("empty-state");
const resultsBody = document.getElementById("results-body");
const statsEl = document.getElementById("stats");
const extractedEl = document.getElementById("extracted");
const suggestionsEl = document.getElementById("suggestions");
const sourcePill = document.getElementById("source-pill");
const copyBtn = document.getElementById("copy-btn");

let selectedFile = null;
let lastSuggestions = [];

function updateSubmitState() {
  const hasPastedText = pasteInput.value.trim().length > 0;
  submitBtn.disabled = !(selectedFile || hasPastedText);
}

function extensionOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function isAllowed(file) {
  const ext = extensionOf(file.name);
  const mime = (file.type || "").toLowerCase();
  return ALLOWED_EXT.includes(ext) || ALLOWED_MIME.includes(mime);
}

function showError(message) {
  clientError.hidden = !message;
  clientError.textContent = message || "";
}

function setFile(file) {
  selectedFile = null;
  fileChip.hidden = true;
  dropzone.classList.remove("has-file");

  if (!file) {
    showError("");
    updateSubmitState();
    return;
  }

  if (!isAllowed(file)) {
    showError("Unsupported file type. Please upload a PDF, PNG, JPG, or WEBP file.");
    input.value = "";
    updateSubmitState();
    return;
  }

  if (file.size > MAX_BYTES) {
    showError("File is too large. Maximum size is 15 MB.");
    input.value = "";
    updateSubmitState();
    return;
  }

  selectedFile = file;
  fileChip.hidden = false;
  dropzone.classList.add("has-file");
  fileNameEl.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
  showError("");
  updateSubmitState();
}

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) {
    input.files = e.dataTransfer.files;
    setFile(file);
  }
});

input.addEventListener("change", () => {
  setFile(input.files[0] || null);
});

pasteInput.addEventListener("input", () => {
  updateSubmitState();
  if (pasteInput.value.trim()) {
    showError("");
  }
});

function processingLabel(file) {
  const ext = extensionOf(file.name);
  if (ext === ".pdf" || file.type === "application/pdf") {
    return "Parsing PDF and analyzing copy…";
  }
  return "Running OCR on the image… this can take a few seconds.";
}

function statCard(label, value) {
  const div = document.createElement("div");
  div.className = "stat";
  const b = document.createElement("b");
  b.textContent = String(value);
  const span = document.createElement("span");
  span.textContent = label;
  div.append(b, span);
  return div;
}

function showResults(show) {
  emptyState.hidden = show;
  resultsBody.hidden = !show;
}

function render(data) {
  showResults(true);

  if (data.source === "ocr") {
    sourcePill.textContent = "Extracted with OCR";
  } else if (data.source === "paste") {
    sourcePill.textContent = "Pasted copy";
  } else {
    sourcePill.textContent = "Extracted from PDF";
  }

  const s = data.stats;
  statsEl.innerHTML = "";
  [
    ["Words", s.wordCount],
    ["Characters", s.characterCount],
    ["Sentences", s.sentenceCount],
    ["Hashtags", s.hashtagCount],
    ["Mentions", s.mentionCount],
    ["Emojis", s.emojiCount],
    ["Question", s.hasQuestion ? "Yes" : "No"],
    ["Call to action", s.hasCallToAction ? "Yes" : "No"],
  ].forEach(([label, value]) => statsEl.appendChild(statCard(label, value)));

  extractedEl.textContent = data.text;
  lastSuggestions = data.suggestions || [];
  suggestionsEl.innerHTML = "";
  lastSuggestions.forEach((item) => {
    const li = document.createElement("li");
    li.className = item.priority;
    const pri = document.createElement("span");
    pri.className = "priority";
    pri.textContent = item.priority;
    const strong = document.createElement("strong");
    strong.textContent = item.title;
    li.append(pri, strong, document.createTextNode(item.detail));
    suggestionsEl.appendChild(li);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const textToAnalyze = pasteInput.value.trim();

  if (!selectedFile && !textToAnalyze) {
    showError("Paste some post copy or upload a file to analyze.");
    return;
  }

  showError("");
  showResults(false);
  statusEl.hidden = false;
  submitBtn.disabled = true;
  submitBtn.textContent = "Analyzing…";

  try {
    let payload;
    async function tryPost(path, options) {
      // Prefer the actual app backend. The VS Code/Live Preview server often
      // responds with 404/405 to API calls, even though the app is actually
      // running on localhost:3000/3001. Retry the real backend ports when that
      // happens instead of stopping on the first static-server response.
      const origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        window.location.origin,
      ];
      let lastErr;
      let lastRes;
      for (const origin of origins) {
        if (!origin) continue;
        const url = origin.replace(/\/$/, "") + path;
        try {
          const res = await fetch(url, options);
          if (res.status !== 404 && res.status !== 405) {
            return res;
          }
          lastRes = res;
        } catch (err) {
          lastErr = err;
        }
      }
      if (lastRes) return lastRes;
      throw lastErr || new Error("All request attempts failed");
    }

    if (selectedFile) {
      statusText.textContent = processingLabel(selectedFile);
      const body = new FormData();
      body.append("file", selectedFile);

      const res = await tryPost("/api/analyze", { method: "POST", body });
      // Prefer JSON error details, but fall back to plain text when the server
      // returns an HTML or text error page (so the client shows something useful).
      try {
        payload = await res.json();
      } catch (jsonErr) {
        const text = await res.text().catch(() => "");
        payload = text ? { error: text } : {};
      }
      if (!res.ok) {
        const base = payload && payload.error ? payload.error : `Upload failed (${res.status})`;
        const code = payload && payload.code ? ` (code: ${payload.code})` : "";
        throw new Error(base + code);
      }
    } else {
      statusText.textContent = "Checking your pasted post copy…";
      const res = await tryPost("/api/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToAnalyze }),
      });

      try {
        payload = await res.json();
      } catch (jsonErr) {
        const text = await res.text().catch(() => "");
        payload = text ? { error: text } : {};
      }
      if (!res.ok) {
        const base = payload && payload.error ? payload.error : `Analysis failed (${res.status})`;
        const code = payload && payload.code ? ` (code: ${payload.code})` : "";
        throw new Error(base + code);
      }
    }

    render(payload);
  } catch (err) {
    showError(err.message || "Could not reach the server.");
  } finally {
    statusEl.hidden = true;
    submitBtn.textContent = "Analyze post";
    updateSubmitState();
  }
});

copyBtn.addEventListener("click", async () => {
  if (!lastSuggestions.length) return;
  const text = lastSuggestions
    .map((s, i) => `${i + 1}. [${s.priority}] ${s.title}\n   ${s.detail}`)
    .join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => {
      copyBtn.textContent = "Copy suggestions";
    }, 1600);
  } catch {
    copyBtn.textContent = "Copy failed";
  }
});

updateSubmitState();
