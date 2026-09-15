import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { AssemblyAI } from "assemblyai";

const {
  ASSEMBLYAI_API_KEY,
  PUBLIC_ORIGIN = "",
  PORT = "3000",
} = process.env;

if (!ASSEMBLYAI_API_KEY) {
  throw new Error("ASSEMBLYAI_API_KEY is required");
}

const app = express();
const client = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY });

app.disable("x-powered-by");
// Render supplies the client IP through one trusted reverse proxy.
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss://agents.assemblyai.com"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: "16kb" }));

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many call attempts. Try again later." },
});

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");

  // PUBLIC_ORIGIN should be the exact deployed HTTPS origin.
  if (PUBLIC_ORIGIN && origin !== PUBLIC_ORIGIN) {
    return res.status(403).json({ error: "Origin not permitted" });
  }

  // Browsers send Sec-Fetch-Site; reject explicit cross-site requests.
  if (req.get("sec-fetch-site") === "cross-site") {
    return res.status(403).json({ error: "Cross-site request rejected" });
  }

  next();
}

app.use(express.static("public", {
  etag: true,
  maxAge: "1h",
  setHeaders(res, filePath) {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

app.post(
  "/api/voice-token",
  requireSameOrigin,
  tokenLimiter,
  async (_req, res) => {
    const requestId = crypto.randomUUID();

    try {
      // Redemption window and call-duration cap are separate controls.
      const result = await client.voiceAgent.createTemporaryToken({
        expiresInSeconds: 60,
        maxSessionDurationSeconds: 1800,
      });

      res.set({
        "Cache-Control": "no-store, private",
        Pragma: "no-cache",
        "X-Request-ID": requestId,
      });
      res.json({
        token: typeof result === "string" ? result : result.token,
        maxSessionDurationSeconds: 1800,
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
  },
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
  console.error("unhandled_request_error", { name: error?.name });
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Listening on port ${PORT}`);
});

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