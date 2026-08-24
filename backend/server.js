/**
 * Social Media Content Analyzer — HTTP entry point.
 * Serves the static frontend and the /api/analyze upload endpoint.
 */
const path = require("path");
const express = require("express");
const analyzeRouter = require("./routes/analyze");
const { analyzeText } = require("./services/analyze");

const PORT = Number(process.env.PORT) || 3000;
const FALLBACK_PORTS = [PORT, 3001, 3002, 3003, 3004];
const app = express();

function startServer(portIndex = 0) {
  const port = FALLBACK_PORTS[portIndex];

  const server = app.listen(port, () => {
    console.log(`Social Media Content Analyzer running at http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      const nextPort = FALLBACK_PORTS[portIndex + 1];
      if (nextPort) {
        console.warn(`Port ${port} is busy; retrying on ${nextPort}...`);
        startServer(portIndex + 1);
        return;
      }

      console.error("No available ports left. Please free a localhost port and retry.");
      process.exit(1);
    }

    console.error("Server start failed:", err);
    process.exit(1);
  });
}

app.disable("x-powered-by");

// Allow the VS Code preview / Live Server origin to call this API.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "200kb" }));

// Static UI (no frontend build step)
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "social-media-content-analyzer" });
});

app.use("/api/analyze", analyzeRouter);

app.post("/api/analyze-text", (req, res) => {
  const text = String((req.body && req.body.text) || "").trim();
  if (!text) {
    return res.status(400).json({
      error: "Paste some post copy to analyze.",
      code: "NO_TEXT",
    });
  }

  const analysis = analyzeText(text);
  return res.json({
    source: "paste",
    text,
    stats: analysis.stats,
    suggestions: analysis.suggestions,
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// Central error handler so multer / unexpected errors never crash the process.
app.use((err, _req, res, _next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File is too large. Maximum size is 15 MB.",
      code: "FILE_TOO_LARGE",
    });
  }

  if (err && err.code === "INVALID_TYPE") {
    return res.status(400).json({
      error: err.message,
      code: "INVALID_TYPE",
    });
  }

  console.error("Unhandled request error:", err);
  return res.status(500).json({
    error: "Something went wrong while processing your file. Please try again.",
    code: "INTERNAL_ERROR",
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (process kept alive):", reason);
});

startServer();
