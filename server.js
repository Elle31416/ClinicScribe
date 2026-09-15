import "dotenv/config";

import crypto from "node:crypto";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const {
  ASSEMBLYAI_API_KEY,
  PUBLIC_ORIGIN = "",
  PORT = "3000",
} = process.env;

if (!ASSEMBLYAI_API_KEY) {
  throw new Error("ASSEMBLYAI_API_KEY is required");
}

const app = express();
const allowedOrigin = PUBLIC_ORIGIN.replace(/\/$/, "");
const maxSessionDurationSeconds = 1800;
const voiceAgentTokenUrl = "https://agents.assemblyai.com/v1/token";

app.disable("x-powered-by");
// Render terminates TLS and forwards requests from one reverse proxy.
app.set("trust proxy", 1);

app.use(compression());

const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'none'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  connectSrc: ["'self'", "wss://agents.assemblyai.com"],
  workerSrc: ["'self'"],
  fontSrc: ["'self'"],
  imgSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'none'"],
  // This directive can interfere with plain-http localhost development.
  upgradeInsecureRequests:
    process.env.NODE_ENV === "production" ? [] : null,
};

app.use(
  helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    crossOriginEmbedderPolicy: false,
  }),
);

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many call attempts. Try again later." },
});

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");

  if (allowedOrigin && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Origin not permitted" });
  }

  if (req.get("sec-fetch-site") === "cross-site") {
    return res.status(403).json({ error: "Cross-site request rejected" });
  }

  return next();
}

app.use(
  express.static("public", {
    etag: true,
    index: "index.html",
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

app.post("/api/voice-token", requireSameOrigin, tokenLimiter, async (_req, res) => {
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(voiceAgentTokenUrl);
    url.searchParams.set("expires_in_seconds", "60");
    url.searchParams.set(
      "max_session_duration_seconds",
      String(maxSessionDurationSeconds),
    );

    const tokenResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${ASSEMBLYAI_API_KEY}` },
    });

    if (!tokenResponse.ok) {
      throw Object.assign(
        new Error(`Voice Agent token endpoint returned ${tokenResponse.status}`),
        { name: "VoiceAgentTokenError", status: tokenResponse.status },
      );
    }

    const { token } = await tokenResponse.json();

    res.set({
      "Cache-Control": "no-store, private",
      Pragma: "no-cache",
      "X-Request-ID": requestId,
    });

    res.json({
      token,
      maxSessionDurationSeconds,
    });
  } catch (error) {
    console.error("voice_token_failed", {
      requestId,
      name: error?.name,
      status: error?.status,
    });

    res.status(502).json({
      error: "Unable to start voice session",
      requestId,
    });
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
  console.error("unhandled_request_error", { name: error?.name });
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${PORT}`);
}

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Voice agent listening on port ${port}`);
});

// Stay slightly above common 60-second proxy idle timeouts.
server.keepAliveTimeout = 62_000;
server.headersTimeout = 65_000;

function shutdown(signal) {
  console.log(`${signal}: shutting down`);
  server.close((error) => {
    if (error) {
      console.error("shutdown_error", error);
      process.exitCode = 1;
    }
    process.exit();
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
