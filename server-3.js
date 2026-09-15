import "dotenv/config";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { AssemblyAI } from "assemblyai";

const {
  ASSEMBLYAI_API_KEY,
  GOOGLE_CLIENT_ID,
  ALLOWED_GOOGLE_DOMAIN = "",
  ALLOWED_GOOGLE_EMAILS = "",
} = process.env;

if (!ASSEMBLYAI_API_KEY) {
  throw new Error("ASSEMBLYAI_API_KEY is not configured");
}
if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not configured");
}

const app = express();
const assemblyai = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY });
const google = new OAuth2Client(GOOGLE_CLIENT_ID);
const allowedEmails = new Set(
  ALLOWED_GOOGLE_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/config", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

async function authenticateGoogle(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Google sign-in required" });
    }

    const ticket = await google.verifyIdToken({
      idToken: authorization.slice(7),
      audience: GOOGLE_CLIENT_ID,
    });
    const user = ticket.getPayload();
    const email = user?.email?.toLowerCase();

    if (!user?.sub || !email || user.email_verified !== true) {
      return res.status(401).json({ error: "Invalid Google account" });
    }

    const domainAllowed =
      ALLOWED_GOOGLE_DOMAIN &&
      user.hd === ALLOWED_GOOGLE_DOMAIN &&
      email.endsWith(`@${ALLOWED_GOOGLE_DOMAIN}`);

    // If neither allowlist is configured, any verified Google user is allowed.
    const restricted = Boolean(ALLOWED_GOOGLE_DOMAIN || allowedEmails.size);
    if (restricted && !domainAllowed && !allowedEmails.has(email)) {
      return res.status(403).json({ error: "Account is not permitted" });
    }

    req.user = { id: user.sub, email };
    next();
  } catch (error) {
    console.warn("Google authentication failed:", error.message);
    res.status(401).json({ error: "Google session expired or invalid" });
  }
}

app.get("/api/voice-token", authenticateGoogle, async (req, res) => {
  try {
    const token = await assemblyai.voiceAgent.createTemporaryToken({
      expiresInSeconds: 300,
      maxSessionDurationSeconds: 1800,
    });

    res.set("Cache-Control", "no-store");
    res.json({ token });
  } catch (error) {
    console.error("Temporary-token error:", error);
    res.status(502).json({ error: "Unable to create voice token" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`Listening on ${port}`));