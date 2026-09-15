import "dotenv/config";
import express from "express";
import { AssemblyAI } from "assemblyai";

if (!process.env.ASSEMBLYAI_API_KEY) {
  throw new Error("ASSEMBLYAI_API_KEY is missing from .env");
}

const app = express();
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

app.use(express.static("public"));

app.get("/api/voice-token", async (_request, response) => {
  try {
    // Tokens are single-use and expire if not redeemed within 5 minutes.
    const token = await client.voiceAgent.createTemporaryToken({
      expiresInSeconds: 300,
      maxSessionDurationSeconds: 1800,
    });
    response.json({ token });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Unable to create voice token" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Voice agent running on http://localhost:${port}`);
});