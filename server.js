const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function resolveStaticFile(urlPath) {
  const cleaned = decodeURIComponent(urlPath).split("?")[0];
  const requested = cleaned === "/" ? "/index.html" : cleaned;
  const normalized = path.normalize(requested).replace(/^([.][.][/\\])+/, "");
  const absolutePath = path.join(ROOT_DIR, normalized);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return absolutePath;
}

function serveStatic(req, res, absolutePath) {
  fs.stat(absolutePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(absolutePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Failed to read file" });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const base = `http://${req.headers.host || "localhost"}`;
  const url = new URL(req.url || "/", base);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/upload-test") {
    let receivedBytes = 0;

    req.on("data", (chunk) => {
      receivedBytes += chunk.length;
    });

    req.on("end", () => {
      sendJson(res, 200, {
        ok: true,
        receivedBytes,
      });
    });

    req.on("error", () => {
      sendJson(res, 500, { error: "Upload stream failed" });
    });

    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const absolutePath = resolveStaticFile(url.pathname);
    if (!absolutePath) {
      sendJson(res, 400, { error: "Invalid path" });
      return;
    }

    serveStatic(req, res, absolutePath);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Speed test server running at http://localhost:${PORT}`);
});
