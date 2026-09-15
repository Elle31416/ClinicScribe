import "dotenv/config";
import express from "express";
import { AssemblyAI } from "assemblyai";

const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) {
  throw new Error("ASSEMBLYAI_API_KEY is not configured");
}

const app = express();
const assemblyai = new AssemblyAI({ apiKey });

app.disable("x-powered-by");
app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/voice-token", async (_req, res) => {
  try {
    const token = await assemblyai.voiceAgent.createTemporaryToken({
      expiresInSeconds: 300,
      maxSessionDurationSeconds: 1800,
    });

    res.set({
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
    });
    res.json({ token });
  } catch (error) {
    console.error("Temporary-token error:", error);
    res.status(502).json({ error: "Unable to start voice session" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Voice agent available on http://localhost:${port}`);
});