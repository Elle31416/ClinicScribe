# AssemblyAI integration — handoff from the AssemblyAI Agent

_Exported 2026-09-15. This folder contains a scoping conversation with AssemblyAI's onboarding agent and the starter code it produced._

## Instructions for the coding agent picking this up

1. Read the conversation below — it has the use case, the decisions already made, and working starter code (shipped as the files listed under **Files**).
2. Ground yourself in AssemblyAI's live docs before writing code — training data goes stale fast here:
   - Docs MCP server (streamable HTTP, no auth needed): `https://www.assemblyai.com/docs/mcp` — semantic docs search + full-page reads + OpenAPI queries.
   - Or install the official agent skill: `npx skills add AssemblyAI/assemblyai-skill`
3. Use the official SDKs (`pip install assemblyai==1.5.4` / `npm install assemblyai@4.41.1`). The API key comes from the `ASSEMBLYAI_API_KEY` environment variable (see `.env.example`). The auth header is the raw key — **no `Bearer` prefix** (except the Voice Agent API, which does use Bearer).
4. Continue from where the conversation leaves off.

## Files

- `setup.sh`
- `package.json`
- `env.example`
- `server.js`
- `pcm-processor.js`
- `index.html`
- `package-2.json`
- `server-2.js`
- `snippet-3.txt`
- `snippet-4.txt`
- `prepare.sh`
- `deploy-cloud-run.sh`
- `run-deployment.sh`
- `cloud-run-logs.sh`
- `install-auth.sh`
- `server-3.js`
- `snippet-3.html`
- `google-auth.js`
- `token-request.js`
- `configure-google-auth.sh`
- `redeploy.sh`
- `delete-cloud-run.sh`
- `delete-cloud-secret.sh`
- `index-2.html`
- `run-locally.sh`
- `server-4.js`
- `remove-google-login.sh`
- `env-2.example`
- `voice-token.js`
- `run.sh`
- `project-structure.txt`
- `package-3.json`
- `snippet-3-2.txt`
- `prepare-render.sh`
- `push-project.sh`
- `render-build-command.sh`
- `render-start-command.sh`
- `render.yaml`
- `install-rate-limit.sh`
- `server-5.js`
- `package-4.json`
- `test-rate-limit.sh`
- `verify-rate-limit.sh`
- `commit-rate-limit.sh`
- `project-structure-2.txt`
- `package-5.json`
- `snippet-3-3.txt`
- `env-3.example`
- `render-2.yaml`
- `prepare-and-commit.sh`
- `commit-and-push.sh`
- `install.sh`
- `server-6.js`
- `voice-token-2.js`
- `env-4.example`
- `package-6.json`
- `install-and-run.sh`
- `commit-dependencies.sh`
- `render-3.yaml`
- `commit-render-config.sh`
- `project-structure-3.txt`
- `env-5.example`
- `snippet-3-4.txt`
- `preflight.sh`
- `smoke-test.sh`
- `show-project.sh`

## The conversation

### You

Create a mvp with my voice agent importing agent_b0aca15004de4ab2b39bbfc1ce360956

### AssemblyAI Agent

Below is a browser MVP connected to your stored agent `agent_b0aca15004de4ab2b39bbfc1ce360956`. It includes:

- A Node server that keeps your API key private and creates single-use browser tokens.
- Microphone capture with echo cancellation.
- Streaming conversation with audio playback.
- Live user and agent transcripts.
- Clean shutdown with `session.end`, avoiding the billable 30-second resume window.

Install and configure it:

```bash title="setup.sh"
npm install assemblyai@4.41.1 express dotenv
```

```json title="package.json"
{
  "name": "voice-agent-mvp",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "assemblyai": "4.41.1",
    "dotenv": "16.4.7",
    "express": "4.21.2"
  }
}
```

```dotenv title=".env.example"
ASSEMBLYAI_API_KEY=your_api_key_here
PORT=3000
```

```javascript title="server.js"
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
```

```javascript title="public/pcm-processor.js"
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions;
    this.ratio = config.inputSampleRate / config.targetSampleRate;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    const length = Math.floor(input.length / this.ratio);
    const pcm16 = new Int16Array(length);

    for (let i = 0; i < length; i++) {
      const sample = input[Math.floor(i * this.ratio)] ?? 0;
      pcm16[i] = Math.max(
        -32768,
        Math.min(32767, Math.round(sample * 32767)),
      );
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
```

```html title="public/index.html"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Voice Agent MVP</title>
  <style>
    body { max-width: 760px; margin: 40px auto; padding: 0 20px;
      font: 16px system-ui; background: #111827; color: #f9fafb; }
    button { padding: 12px 18px; margin-right: 8px; cursor: pointer; }
    #log { min-height: 280px; padding: 16px; white-space: pre-wrap;
      background: #1f2937; border-radius: 8px; }
    #status { color: #93c5fd; }
  </style>
</head>
<body>
  <h1>Voice Agent</h1>
  <p id="status">Ready to connect</p>
  <button id="start">Start conversation</button>
  <button id="end" disabled>End conversation</button>
  <pre id="log"></pre>

  <script type="module">
    const AGENT_ID = "agent_b0aca15004de4ab2b39bbfc1ce360956";
    const startButton = document.querySelector("#start");
    const endButton = document.querySelector("#end");
    const status = document.querySelector("#status");
    const logElement = document.querySelector("#log");

    let ws, audioContext, microphoneStream, playbackTime = 0;
    let ready = false;

    const log = (line) => {
      logElement.textContent += `${line}\n`;
      logElement.scrollTop = logElement.scrollHeight;
    };

    const toBase64 = (buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return btoa(binary);
    };

    const playPcm16 = (base64) => {
      const raw = atob(base64);
      const samples = new Int16Array(raw.length / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] =
          raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
      }

      const buffer = audioContext.createBuffer(1, samples.length, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      playbackTime = Math.max(playbackTime, audioContext.currentTime);
      source.start(playbackTime);
      playbackTime += buffer.duration;
    };

    const cleanup = async () => {
      ready = false;
      ws?.close();
      microphoneStream?.getTracks().forEach((track) => track.stop());
      if (audioContext?.state !== "closed") await audioContext?.close();
      ws = audioContext = microphoneStream = null;
      startButton.disabled = false;
      endButton.disabled = true;
      status.textContent = "Call ended";
    };

    startButton.addEventListener("click", async () => {
      try {
        startButton.disabled = true;
        status.textContent = "Connecting…";

        const tokenResponse = await fetch("/api/voice-token");
        if (!tokenResponse.ok) throw new Error("Token request failed");
        const { token } = await tokenResponse.json();

        audioContext = new AudioContext();
        await audioContext.resume();
        await audioContext.audioWorklet.addModule("/pcm-processor.js");

        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: false },
        });

        const source = audioContext.createMediaStreamSource(microphoneStream);
        const worklet = new AudioWorkletNode(audioContext, "pcm-processor", {
          processorOptions: {
            inputSampleRate: audioContext.sampleRate,
            targetSampleRate: 24000,
          },
        });
        source.connect(worklet);

        const wsUrl = new URL("wss://agents.assemblyai.com/v1/ws");
        wsUrl.searchParams.set("token", token);
        ws = new WebSocket(wsUrl);

        worklet.port.onmessage = ({ data }) => {
          if (ready && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "input.audio",
              audio: toBase64(data),
            }));
          }
        };

        ws.addEventListener("open", () => {
          ws.send(JSON.stringify({
            type: "session.update",
            session: { agent_id: AGENT_ID },
          }));
        });

        ws.addEventListener("message", async ({ data }) => {
          const message = JSON.parse(data);

          if (message.type === "session.ready") {
            ready = true;
            endButton.disabled = false;
            status.textContent = "Connected — start speaking";
          } else if (message.type === "reply.audio") {
            playPcm16(message.data);
          } else if (message.type === "transcript.user") {
            log(`You: ${message.text}`);
          } else if (message.type === "transcript.agent") {
            log(`Agent: ${message.text}`);
          } else if (message.type === "reply.done" &&
                     message.status === "interrupted") {
            playbackTime = audioContext.currentTime;
          } else if (message.type === "session.ended") {
            await cleanup();
          } else if (message.type === "session.error" ||
                     message.type === "error") {
            log(`Error: ${message.message || "Unknown error"}`);
          }
        });

        ws.addEventListener("close", () => {
          if (ready) cleanup();
        });
      } catch (error) {
        console.error(error);
        log(`Error: ${error.message}`);
        await cleanup();
      }
    });

    endButton.addEventListener("click", () => {
      if (ws?.readyState === WebSocket.OPEN) {
        status.textContent = "Ending call…";
        ws.send(JSON.stringify({ type: "session.end" }));
      } else {
        cleanup();
      }
    });

    window.addEventListener("pagehide", () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "session.end" }));
      }
    });
  </script>
</body>
</html>
```

Run it:

1. Place the files in the structure shown by their filenames.
2. Copy `.env.example` to `.env` and insert your key.
3. Run `npm start`.
4. Open `http://localhost:3000` and allow microphone access.

The server uses our official Node SDK; the browser never receives your API key. The stored agent supplies its existing voice, greeting, prompt, and tools. To test that agent without running code:

### You

Show me how to deploy this

### AssemblyAI Agent

Deploy it as a small Node web service. A general container deployment is the safest option because it works with most managed container hosts.

One correction first: the previous dependency versions conflicted. Keep our SDK pinned at `4.41.1`, and use the package file below. You also don’t need to copy `.env` into the image—the deployment platform injects `ASSEMBLYAI_API_KEY`.

```json title="package.json"
{
  "name": "voice-agent-mvp",
  "private": true,
  "type": "module",
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "assemblyai": "4.41.1",
    "dotenv": "17.2.2",
    "express": "5.1.0"
  }
}
```

Make the server deployment-aware. It listens on the platform-provided port, includes a health check, and disables caching for temporary tokens.

```javascript title="server.js"
import "dotenv/config";
import express from "express";
import { AssemblyAI } from "assemblyai";

const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not configured");

const app = express();
const client = new AssemblyAI({ apiKey });

app.disable("x-powered-by");
app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/voice-token", async (_req, res) => {
  try {
    const token = await client.voiceAgent.createTemporaryToken({
      expiresInSeconds: 300,
      maxSessionDurationSeconds: 1800
    });

    res.set("Cache-Control", "no-store");
    res.json({ token });
  } catch (error) {
    console.error("Temporary-token error:", error);
    res.status(502).json({ error: "Unable to create voice token" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on port ${port}`);
});
```

Add the container and deployment exclusions:

```dockerfile title="Dockerfile"
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public

USER node
EXPOSE 3000

CMD ["npm", "start"]
```

```text title=".dockerignore"
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
```

Before deploying:

```bash title="prepare.sh"
npm install
npm start
```

This creates `package-lock.json`; commit that file alongside `server.js`, `package.json`, `Dockerfile`, and `public/`.

On your managed container platform:

- Create a web service from the repository.
- Let it build from `Dockerfile`.
- Set `ASSEMBLYAI_API_KEY` as a secret environment variable.
- Set the health-check path to `/health`.
- Expose the service publicly over HTTPS.
- Do not set `PORT` unless the platform requires it.
- Do not commit `.env`.

Important production behavior:

- Browser microphone access requires HTTPS, except on localhost.
- Your API key remains server-side; browsers receive only short-lived session tokens.
- Add authentication and per-user rate limiting before sharing the URL publicly. Otherwise, anyone can request tokens against your account.
- The current `pagehide` handler is best-effort. The **End conversation** button reliably sends `session.end`, which avoids retaining the session during the billable 30-second resume window.
- If the browser reports `session.error`, confirm the stored agent ID belongs to the same project as the API key used by the server.

Use **Export** to download all generated files as a zip, then place them in a repository and deploy that directory.

### You

Deploy this to Google Cloud Run

### AssemblyAI Agent

Cloud Run fits this MVP well: it serves the static browser app and creates temporary Voice Agent tokens, while your API key remains in Secret Manager.

Keep your existing `public/`, `server.js`, `package.json`, `package-lock.json`, `Dockerfile`, and `.dockerignore`. The server already listens on `0.0.0.0` and honors Cloud Run’s `PORT`.

Set these shell variables:

```bash title="deploy-cloud-run.sh"
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="YOUR_GCP_PROJECT_ID"
REGION="us-central1"
SERVICE_NAME="assemblyai-voice-agent"
SECRET_NAME="assemblyai-api-key"

gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

# Create the secret once. Input is hidden and is not saved in shell history.
if ! gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  read -rsp "AssemblyAI API key: " ASSEMBLYAI_KEY
  echo
  printf '%s' "$ASSEMBLYAI_KEY" |
    gcloud secrets create "$SECRET_NAME" \
      --replication-policy="automatic" \
      --data-file=-
  unset ASSEMBLYAI_KEY
fi

# Cloud Run's runtime identity needs permission to read the secret.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" \
  --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Build from the Dockerfile and deploy publicly.
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="ASSEMBLYAI_API_KEY=${SECRET_NAME}:latest" \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=40 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format='value(status.url)')"

printf '\nDeployed: %s\nHealth: %s/health\n' \
  "$SERVICE_URL" "$SERVICE_URL"
```

Run it from the project root:

```bash title="run-deployment.sh"
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

Then open the printed HTTPS service URL, click **Start conversation**, and allow microphone access. Cloud Run supplies HTTPS, so browser microphone capture works.

A few production notes:

- `--allow-unauthenticated` makes the webpage and `/api/voice-token` public. Anyone can currently mint a temporary token against your account. Add authentication and rate limiting before sharing the URL broadly.
- The AssemblyAI WebSocket runs directly between the browser and our Voice Agent API, so Cloud Run doesn’t proxy the live audio session.
- `--min-instances=0` reduces idle cost but allows cold starts when obtaining the token. Use `--min-instances=1` if startup latency matters.
- Deploy updates by running the script again. Cloud Run creates a new immutable revision and shifts traffic after it becomes healthy.
- View server errors with:

```bash title="cloud-run-logs.sh"
gcloud run services logs read assemblyai-voice-agent \
  --region us-central1 \
  --limit 100
```

If IAM propagation causes the first deployment to fail while reading the secret, wait briefly and rerun the deployment script.

### You

Add Google login before issuing tokens

### AssemblyAI Agent

Use Google Identity Services in the browser, then verify each Google ID token on Cloud Run before minting an AssemblyAI temporary token. The server—not the browser—decides whether the user is allowed.

Install the verifier:

```bash title="install-auth.sh"
npm install google-auth-library
```

Replace `server.js` with this version:

```javascript title="server.js"
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
```

Add the Google button to `public/index.html`, directly before your existing Start button:

```html
<div id="google-signin"></div>
<p id="account"></p>
<button id="signout" type="button" hidden>Sign out</button>

<button id="start" disabled>Start conversation</button>
<button id="end" disabled>End conversation</button>
```

Then replace the opening portion of the existing module script—from `const AGENT_ID` through the DOM variable declarations—with this. Keep the remaining audio/WebSocket functions and event handlers:

```javascript title="public/google-auth.js"
const AGENT_ID = "agent_b0aca15004de4ab2b39bbfc1ce360956";
const startButton = document.querySelector("#start");
const endButton = document.querySelector("#end");
const status = document.querySelector("#status");
const logElement = document.querySelector("#log");
const account = document.querySelector("#account");
const signoutButton = document.querySelector("#signout");

let googleCredential = null;
let ws, audioContext, microphoneStream, playbackTime = 0;
let ready = false;

const gisScript = document.createElement("script");
gisScript.src = "https://accounts.google.com/gsi/client";
gisScript.async = true;
gisScript.defer = true;
document.head.appendChild(gisScript);

const { googleClientId } = await fetch("/api/config").then((response) => {
  if (!response.ok) throw new Error("Unable to load authentication config");
  return response.json();
});

await new Promise((resolve, reject) => {
  gisScript.addEventListener("load", resolve, { once: true });
  gisScript.addEventListener("error", reject, { once: true });
});

google.accounts.id.initialize({
  client_id: googleClientId,
  callback: ({ credential }) => {
    googleCredential = credential;
    const payload = JSON.parse(
      atob(credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    account.textContent = `Signed in as ${payload.email}`;
    startButton.disabled = false;
    signoutButton.hidden = false;
    status.textContent = "Ready to connect";
  },
});

google.accounts.id.renderButton(
  document.querySelector("#google-signin"),
  { theme: "outline", size: "large", shape: "rectangular" },
);

signoutButton.addEventListener("click", async () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "session.end" }));
  }
  google.accounts.id.disableAutoSelect();
  googleCredential = null;
  account.textContent = "";
  signoutButton.hidden = true;
  startButton.disabled = true;
  status.textContent = "Sign in with Google";
});
```

Change the token request inside your existing Start handler:

```javascript title="public/token-request.js"
const tokenResponse = await fetch("/api/voice-token", {
  headers: { Authorization: `Bearer ${googleCredential}` },
});
if (!tokenResponse.ok) {
  const body = await tokenResponse.json().catch(() => ({}));
  if (tokenResponse.status === 401) {
    googleCredential = null;
    startButton.disabled = true;
  }
  throw new Error(body.error || "Token request failed");
}
const { token } = await tokenResponse.json();
```

For a directly runnable app, merge `google-auth.js` into the beginning of the existing inline module and replace its old token `fetch` with `token-request.js`. The external Google script is the one necessary exception to the self-hosted static files.

In Google Cloud:

- Create an OAuth 2.0 client ID with application type **Web application**.
- Add the exact Cloud Run service origin to its authorized JavaScript origins, such as `https://your-service-hostname`.
- No redirect URI is needed for this popup/button ID-token flow.
- Copy the client ID, not the client secret. This flow does not need a client secret.

Store the client ID and optionally restrict access. `ALLOWED_GOOGLE_EMAILS` is useful for a small MVP; `ALLOWED_GOOGLE_DOMAIN` requires a Workspace-hosted-domain claim and must not be trusted without server-side verification, which the code performs.

```bash title="configure-google-auth.sh"
SERVICE_NAME="assemblyai-voice-agent"
REGION="us-central1"

gcloud run services update "$SERVICE_NAME" \
  --region "$REGION" \
  --update-env-vars="GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com,ALLOWED_GOOGLE_EMAILS=you@example.com"
```

Then redeploy so `google-auth-library` is included in the image:

```bash title="redeploy.sh"
gcloud run deploy assemblyai-voice-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="ASSEMBLYAI_API_KEY=assemblyai-api-key:latest" \
  --update-env-vars="GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com,ALLOWED_GOOGLE_EMAILS=you@example.com"
```

The Cloud Run service stays publicly reachable so Google can load the page, but `/api/voice-token` now returns `401` without a valid Google ID token and `403` for users outside your allowlist.

This protects token issuance, but it does not yet stop an authenticated user from requesting many tokens. Add per-user rate limiting before opening access beyond a small allowlist.

### You

Delete google run, add a front-end

### AssemblyAI Agent

I’m reading “delete Google Cloud Run” as removing the deployed Cloud Run service and replacing Google login with a polished frontend. I can’t delete cloud resources from this chat, but you can run:

```bash title="delete-cloud-run.sh"
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="YOUR_GCP_PROJECT_ID"
REGION="us-central1"
SERVICE_NAME="assemblyai-voice-agent"

gcloud config set project "$PROJECT_ID"
gcloud run services delete "$SERVICE_NAME" \
  --region "$REGION" \
  --quiet

echo "Deleted Cloud Run service: $SERVICE_NAME"
```

This deletes the service and revisions, but not the Secret Manager secret or container images. If you also want to remove the AssemblyAI key secret:

```bash title="delete-cloud-secret.sh"
gcloud secrets delete assemblyai-api-key --quiet
```

Do not expose your AssemblyAI API key in a frontend-only app. The frontend still needs a small backend—running locally or on another host—to mint temporary Voice Agent tokens.

Here is a drop-in replacement for `public/index.html`. It retains your existing `/api/voice-token` endpoint, requires no Google login, and adds a responsive call interface, status, timer, live transcript, mute, and hang-up controls.

```html title="public/index.html"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Voice Assistant</title>
  <style>
    :root { color-scheme: dark; font-family: Inter,ui-sans-serif,system-ui,sans-serif }
    * { box-sizing:border-box }
    body { margin:0; min-height:100vh; display:grid; place-items:center; color:#eef2ff;
      background:radial-gradient(circle at top,#312e81 0,#111827 40%,#030712 100%) }
    .app { width:min(94vw,760px); padding:28px; border:1px solid #ffffff20;
      border-radius:28px; background:#111827cc; backdrop-filter:blur(18px);
      box-shadow:0 30px 90px #0008 }
    header { display:flex; align-items:center; justify-content:space-between; gap:16px }
    .brand { display:flex; align-items:center; gap:14px }
    .avatar { width:52px; height:52px; display:grid; place-items:center; border-radius:50%;
      background:linear-gradient(135deg,#8b5cf6,#22d3ee); font-size:24px }
    h1 { margin:0; font-size:20px }
    p { margin:4px 0 0; color:#a5b4fc }
    .badge { padding:8px 12px; border-radius:999px; background:#ffffff10; color:#c7d2fe }
    .stage { min-height:260px; display:grid; place-items:center; text-align:center }
    .orb { width:132px; height:132px; border-radius:50%;
      background:radial-gradient(circle at 35% 25%,#fff,#67e8f9 8%,#8b5cf6 45%,#312e81);
      box-shadow:0 0 60px #8b5cf699; transition:.25s }
    .orb.live { animation:pulse 1.5s infinite }
    .orb.muted { filter:grayscale(1); opacity:.55 }
    @keyframes pulse { 50% { transform:scale(1.07); box-shadow:0 0 95px #22d3eebb } }
    #timer { margin-top:20px; font-variant-numeric:tabular-nums; color:#c7d2fe }
    .transcript { height:230px; overflow:auto; padding:18px; border-radius:18px;
      background:#03071288; border:1px solid #ffffff12 }
    .line { margin:0 0 14px; line-height:1.45 }
    .line b { color:#67e8f9 }
    .line.agent b { color:#c4b5fd }
    .controls { display:flex; justify-content:center; gap:12px; margin-top:22px }
    button { border:0; padding:13px 18px; border-radius:999px; color:white;
      background:#374151; font:inherit; font-weight:650; cursor:pointer }
    button:disabled { opacity:.4; cursor:not-allowed }
    #start { background:linear-gradient(135deg,#7c3aed,#0891b2) }
    #end { background:#dc2626 }
    #error { min-height:20px; margin-top:12px; text-align:center; color:#fca5a5 }
    @media(max-width:540px) {
      .app { min-height:100vh; width:100%; border-radius:0; padding:20px }
      .badge { display:none }
      .stage { min-height:220px }
    }
  </style>
</head>
<body>
<main class="app">
  <header>
    <div class="brand">
      <div class="avatar">◉</div>
      <div><h1>Voice Assistant</h1><p id="status">Ready to talk</p></div>
    </div>
    <div class="badge">Agent online</div>
  </header>

  <section class="stage">
    <div>
      <div id="orb" class="orb"></div>
      <div id="timer">00:00</div>
    </div>
  </section>

  <section id="transcript" class="transcript" aria-live="polite">
    <p class="line agent"><b>Agent:</b> Press Start to begin.</p>
  </section>

  <div class="controls">
    <button id="start">Start call</button>
    <button id="mute" disabled>Mute</button>
    <button id="end" disabled>End call</button>
  </div>
  <div id="error" role="alert"></div>
</main>

<script type="module">
const AGENT_ID = "agent_b0aca15004de4ab2b39bbfc1ce360956";
const $ = (selector) => document.querySelector(selector);
const [start, mute, end] = ["#start","#mute","#end"].map($);
const [status, orb, timer, transcript, errorBox] =
  ["#status","#orb","#timer","#transcript","#error"].map($);

let ws, context, stream, worklet, timerId, startedAt, playbackAt = 0;
let ready = false, muted = false;

const setState = (state) => {
  ready = state === "live";
  start.disabled = state !== "idle";
  mute.disabled = end.disabled = state !== "live";
  orb.classList.toggle("live", state === "live");
  status.textContent =
    ({ idle:"Ready to talk", connecting:"Connecting…", live:"Listening…",
       ending:"Ending…", ended:"Call ended" })[state];
};

const addLine = (who, text) => {
  if (!text) return;
  const p = document.createElement("p");
  p.className = `line ${who === "Agent" ? "agent" : ""}`;
  const label = document.createElement("b");
  label.textContent = `${who}: `;
  p.append(label, document.createTextNode(text));
  transcript.append(p);
  transcript.scrollTop = transcript.scrollHeight;
};

const base64 = (buffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};

const playAudio = (encoded) => {
  const raw = atob(encoded);
  const pcm = new Int16Array(raw.length / 2);
  for (let i = 0; i < pcm.length; i++)
    pcm[i] = raw.charCodeAt(i * 2) | raw.charCodeAt(i * 2 + 1) << 8;
  const buffer = context.createBuffer(1, pcm.length, 24000);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
  const source = context.createBufferSource();
  source.buffer = buffer; source.connect(context.destination);
  playbackAt = Math.max(playbackAt, context.currentTime);
  source.start(playbackAt); playbackAt += buffer.duration;
};

const cleanup = async () => {
  ready = false;
  clearInterval(timerId);
  stream?.getTracks().forEach((track) => track.stop());
  if (context && context.state !== "closed") await context.close();
  ws = context = stream = worklet = null;
  mute.textContent = "Mute"; muted = false;
  orb.classList.remove("muted");
  setState("ended");
  start.disabled = false;
};

start.onclick = async () => {
  try {
    errorBox.textContent = "";
    setState("connecting");

    const response = await fetch("/api/voice-token", { cache:"no-store" });
    if (!response.ok) throw new Error("Could not start a secure voice session");
    const { token } = await response.json();

    context = new AudioContext();
    await context.resume();
    await context.audioWorklet.addModule("/pcm-processor.js");
    stream = await navigator.mediaDevices.getUserMedia({
      audio:{ echoCancellation:true, noiseSuppression:true }
    });

    const source = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, "pcm-processor", {
      processorOptions:{ inputSampleRate:context.sampleRate, targetSampleRate:24000 }
    });
    source.connect(worklet);

    const url = new URL("wss://agents.assemblyai.com/v1/ws");
    url.searchParams.set("token", token);
    ws = new WebSocket(url);

    worklet.port.onmessage = ({ data }) => {
      if (ready && !muted && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type:"input.audio", audio:base64(data) }));
    };

    ws.onopen = () => ws.send(JSON.stringify({
      type:"session.update", session:{ agent_id:AGENT_ID }
    }));

    ws.onmessage = async ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === "session.ready") {
        setState("live"); startedAt = Date.now();
        timerId = setInterval(() => {
          const seconds = Math.floor((Date.now() - startedAt) / 1000);
          timer.textContent =
            `${String(seconds / 60 | 0).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
        }, 1000);
      } else if (message.type === "reply.audio") playAudio(message.data);
      else if (message.type === "transcript.user") addLine("You", message.text);
      else if (message.type === "transcript.agent") addLine("Agent", message.text);
      else if (message.type === "session.ended") await cleanup();
      else if (message.type === "error" || message.type === "session.error")
        errorBox.textContent = message.message || "Voice session error";
    };

    ws.onclose = () => { if (ready) cleanup(); };
  } catch (error) {
    errorBox.textContent = error.message;
    await cleanup();
  }
};

mute.onclick = () => {
  muted = !muted;
  stream?.getAudioTracks().forEach((track) => track.enabled = !muted);
  mute.textContent = muted ? "Unmute" : "Mute";
  orb.classList.toggle("muted", muted);
  status.textContent = muted ? "Microphone muted" : "Listening…";
};

end.onclick = () => {
  if (ws?.readyState === WebSocket.OPEN) {
    setState("ending");
    ws.send(JSON.stringify({ type:"session.end" }));
  } else cleanup();
};

window.addEventListener("pagehide", () => {
  if (ws?.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type:"session.end" }));
});

setState("idle");
</script>
</body>
</html>
```

Keep the previously created `public/pcm-processor.js`, `server.js`, and `.env`. Run locally:

```bash title="run-locally.sh"
npm install
npm start
```

Then open `http://localhost:3000`. If “Google Run” meant Google login rather than Cloud Run, remove `google-auth-library`, `GOOGLE_CLIENT_ID`, and the authentication middleware, while keeping the server-side token endpoint shown in the original MVP.

### You

Remove Google login completely

### AssemblyAI Agent

Remove Google authentication from the server and dependencies. The frontend from the previous response already makes an unauthenticated request to `/api/voice-token`, so no frontend auth code is needed.

Use this server:

```javascript title="server.js"
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
```

Remove `google-auth-library` and update the lockfile:

```bash title="remove-google-login.sh"
npm uninstall google-auth-library
npm install assemblyai@4.41.1
```

Your environment now needs only:

```dotenv title=".env.example"
ASSEMBLYAI_API_KEY=your_api_key_here
PORT=3000
```

Delete these items if they remain:

- `GOOGLE_CLIENT_ID`
- `ALLOWED_GOOGLE_DOMAIN`
- `ALLOWED_GOOGLE_EMAILS`
- `public/google-auth.js`
- The `google-signin`, `account`, and `signout` HTML elements
- Any browser code referencing `googleCredential` or `google.accounts`
- The `/api/config` route
- The `authenticateGoogle` middleware
- Any `Authorization: Bearer ${googleCredential}` header sent to `/api/voice-token`

The token request in `public/index.html` should now be:

```javascript title="public/voice-token.js"
const response = await fetch("/api/voice-token", {
  method: "GET",
  cache: "no-store",
});

if (!response.ok) {
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error || "Could not start a secure voice session");
}

const { token } = await response.json();
```

Run locally:

```bash title="run.sh"
npm start
```

Your AssemblyAI API key remains server-side and is never placed in browser code. However, `/api/voice-token` is now public: anyone who can reach the app can create sessions billed to your account. For anything beyond private testing, add non-Google authentication or server-side rate limiting.

### You

Add a deployment to render steps

### AssemblyAI Agent

Render can deploy this as one Node web service: Express serves the frontend and securely issues temporary Voice Agent tokens. Your AssemblyAI API key stays server-side.

Before deploying, confirm your repository contains:

```text title="project-structure.txt"
.
├── package.json
├── package-lock.json
├── server.js
├── .gitignore
└── public
    ├── index.html
    └── pcm-processor.js
```

Use this package definition. It keeps our Node SDK pinned at `4.41.1`:

```json title="package.json"
{
  "name": "assemblyai-voice-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "assemblyai": "4.41.1",
    "dotenv": "17.2.2",
    "express": "5.1.0"
  }
}
```

Prevent secrets and local files from entering Git:

```gitignore title=".gitignore"
node_modules/
.env
.env.*
!.env.example
npm-debug.log*
.DS_Store
```

Then regenerate and test the lockfile:

```bash title="prepare-render.sh"
npm install
npm start
```

Verify these locally:

- The frontend opens at `http://localhost:3000`.
- `http://localhost:3000/health` returns `{"status":"ok"}`.
- Starting a conversation connects to your stored agent.
- Ending sends `session.end`.

Commit and push the project to your Git repository:

```bash title="push-project.sh"
git init
git add .
git commit -m "Deploy voice agent MVP"
git branch -M main
git remote add origin YOUR_REPOSITORY_REMOTE
git push -u origin main
```

In Render:

1. Create a new **Web Service** and connect the repository.
2. Select the `main` branch.
3. Choose the **Node** runtime.
4. Set the build command to:

```bash title="render-build-command.sh"
npm ci
```

5. Set the start command to:

```bash title="render-start-command.sh"
npm start
```

6. Add an environment variable:
   - Key: `ASSEMBLYAI_API_KEY`
   - Value: your API key
7. Set the health-check path to `/health`.
8. Do not define `PORT`; Render supplies it, and `server.js` already reads it.
9. Create the service and wait for the first deployment.
10. Open the generated HTTPS address and allow microphone access.

Render’s HTTPS satisfies the browser’s secure-context requirement for microphone capture. The browser connects directly to our Voice Agent WebSocket after your server returns a short-lived token; Render does not relay the call audio.

For repeatable configuration, you can optionally add:

```yaml title="render.yaml"
services:
  - type: web
    name: assemblyai-voice-agent
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /health
    autoDeployTrigger: commit
    envVars:
      - key: NODE_VERSION
        value: 22
      - key: ASSEMBLYAI_API_KEY
        sync: false
```

Commit `render.yaml`, then create the service from the repository configuration. Render will prompt you for the secret because `sync: false` intentionally leaves its value out of Git.

Important: without Google login, `/api/voice-token` is publicly accessible. Before sharing the deployed address broadly, add rate limiting or another access-control mechanism so strangers cannot create sessions billed to your account.

### You

Add rate limiting before deployment

### AssemblyAI Agent

Add server-side rate limiting to `/api/voice-token`. This limits token creation—the billable entry point—without interfering with static frontend files or live WebSocket audio.

Install the dependency:

```bash title="install-rate-limit.sh"
npm install express-rate-limit
```

Replace `server.js` with:

```javascript title="server.js"
import "dotenv/config";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { AssemblyAI } from "assemblyai";

const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not configured");

const app = express();
const assemblyai = new AssemblyAI({ apiKey });

// Render terminates HTTPS and forwards the original client IP.
app.set("trust proxy", 1);
app.disable("x-powered-by");

const voiceTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Keep health checks and static assets unaffected.
  message: { error: "Too many call attempts. Try again in 15 minutes." },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/voice-token", voiceTokenLimiter, async (_req, res) => {
  try {
    const token = await assemblyai.voiceAgent.createTemporaryToken({
      expiresInSeconds: 300,
      maxSessionDurationSeconds: 1800,
    });

    res.set({
      "Cache-Control": "no-store, private",
      Pragma: "no-cache",
    });
    res.json({ token });
  } catch (error) {
    console.error("Temporary-token error:", error);
    res.status(502).json({ error: "Unable to start voice session" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Voice agent available on port ${port}`);
});
```

Ensure `package.json` includes the dependency while keeping our SDK pinned:

```json title="package.json"
{
  "name": "assemblyai-voice-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "assemblyai": "4.41.1",
    "dotenv": "17.2.2",
    "express": "5.1.0",
    "express-rate-limit": "8.1.0"
  }
}
```

Regenerate the lockfile and test:

```bash title="test-rate-limit.sh"
npm install
npm start
```

In another terminal, make six requests:

```bash title="verify-rate-limit.sh"
for i in 1 2 3 4 5 6; do
  curl -i http://localhost:3000/api/voice-token
done
```

Requests 1–5 should return tokens; request 6 should return HTTP `429`.

Then deploy to Render using the existing settings:

- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/health`
- Secret environment variable: `ASSEMBLYAI_API_KEY`
- Do not manually set `PORT`

Commit before deployment:

```bash title="commit-rate-limit.sh"
git add server.js package.json package-lock.json
git commit -m "Rate limit voice token creation"
git push
```

This limiter is stored in each Node process’s memory. It is appropriate for an MVP running one Render instance, but counters reset on restart and aren’t shared if Render scales to multiple instances. For stricter production limits, use a shared store and authenticated user IDs; IP-only limits can group users behind the same office or mobile network.

Rate limiting reduces abuse but does not make the public endpoint private. Keep the five-call limit conservative and monitor usage.

### You

Show the final Render checklist

### AssemblyAI Agent

Use this checklist for the final Render deployment.

- [ ] Your repository has these files:

```text title="project-structure.txt"
.
├── package.json
├── package-lock.json
├── server.js
├── render.yaml
├── .env.example
├── .gitignore
└── public
    ├── index.html
    └── pcm-processor.js
```

- [ ] `package.json` pins our SDK and includes rate limiting:

```json title="package.json"
{
  "name": "assemblyai-voice-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "assemblyai": "4.41.1",
    "dotenv": "17.2.2",
    "express": "5.1.0",
    "express-rate-limit": "8.1.0"
  }
}
```

- [ ] `server.js`:
  - Reads `ASSEMBLYAI_API_KEY` from the environment.
  - Listens on `process.env.PORT`.
  - Binds to `0.0.0.0`.
  - Sets `app.set("trust proxy", 1)` for Render.
  - Serves `public/`.
  - Exposes `GET /health`.
  - Limits `/api/voice-token` to five requests per 15 minutes.
  - Creates temporary Voice Agent tokens with our Node SDK.
  - Sends `Cache-Control: no-store` on token responses.

- [ ] `public/index.html`:
  - Uses stored agent ID `agent_b0aca15004de4ab2b39bbfc1ce360956`.
  - Fetches `/api/voice-token`.
  - Does not contain your AssemblyAI API key.
  - Connects to `wss://agents.assemblyai.com/v1/ws`.
  - Sends the stored agent inside the initial `session.update`.
  - Sends `session.end` when the user ends a call.
  - Handles HTTP `429` from the rate limiter.

- [ ] `public/pcm-processor.js` converts microphone audio to 24 kHz, 16-bit PCM.

- [ ] `.gitignore` keeps secrets out of Git:

```gitignore title=".gitignore"
node_modules/
.env
.env.*
!.env.example
npm-debug.log*
.DS_Store
```

- [ ] `.env.example` contains placeholders only:

```dotenv title=".env.example"
ASSEMBLYAI_API_KEY=replace_with_your_key
PORT=3000
```

- [ ] `render.yaml` defines the service without embedding the secret:

```yaml title="render.yaml"
services:
  - type: web
    name: assemblyai-voice-agent
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /health
    autoDeployTrigger: commit
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: ASSEMBLYAI_API_KEY
        sync: false
```

- [ ] Generate and commit the lockfile:

```bash title="prepare-and-commit.sh"
npm install
npm start
```

Test locally, stop the server, then:

```bash title="commit-and-push.sh"
git add .
git commit -m "Prepare voice agent for Render"
git push
```

- [ ] In Render:
  1. Create the web service from the repository.
  2. Confirm build command `npm ci`.
  3. Confirm start command `npm start`.
  4. Confirm health-check path `/health`.
  5. Enter `ASSEMBLYAI_API_KEY` as a secret.
  6. Do not manually set `PORT`.
  7. Deploy the latest commit.

- [ ] After deployment:
  1. Open the HTTPS service address.
  2. Check `/health` returns `{"status":"ok"}`.
  3. Allow microphone access.
  4. Start a call and confirm your agent greets you.
  5. Confirm user and agent transcript lines appear.
  6. Test mute and unmute.
  7. End the call and confirm the UI returns to idle.
  8. Review Render logs for token or WebSocket errors.

- [ ] Test abuse protection by requesting `/api/voice-token` six times from the same IP. The sixth request should return HTTP `429`.

- [ ] Confirm the API key is absent from:
  - Git history
  - Browser source
  - Browser network responses
  - `render.yaml`
  - Client-side logs

The current in-memory limiter is suitable for a single-instance MVP. Its counters reset on restart and are not shared across multiple instances. Also, this endpoint remains public; rate limiting reduces abuse but does not provide identity-based access control.

### You

Review my final server code

### AssemblyAI Agent

Paste your final `server.js` here as text, along with `package.json` if dependencies changed. I can review code pasted into chat, but I can’t receive files or inspect your repository.

I’ll check:

- AssemblyAI SDK usage and temporary Voice Agent token creation
- API-key isolation
- Render proxy and `PORT` configuration
- Rate-limit behavior
- Cache and security headers
- Error handling and shutdown behavior
- Compatibility with your frontend’s `/api/voice-token` request

Do not paste your actual `ASSEMBLYAI_API_KEY`; replace any secret with `REDACTED`.

### You

Give me a secure reference server

### AssemblyAI Agent

Here’s a hardened reference server for your Render deployment. It uses our official Node SDK for one-time Voice Agent tokens, keeps your API key server-side, limits token minting, validates request origins, adds security headers, avoids token caching, and shuts down cleanly.

Install exact dependencies:

```bash title="install.sh"
npm install assemblyai@4.41.1 express@5.1.0 express-rate-limit@8.1.0 helmet@8.1.0 dotenv@17.2.2
```

```javascript title="server.js"
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
```

Update the frontend request because the protected route now uses `POST`:

```javascript title="public/voice-token.js"
const response = await fetch("/api/voice-token", {
  method: "POST",
  headers: { Accept: "application/json" },
  cache: "no-store",
});

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  if (response.status === 429) {
    throw new Error("Too many calls started. Try again later.");
  }
  throw new Error(body.error || "Could not start the voice session");
}

const { token, maxSessionDurationSeconds } = body;
```

Set these Render environment variables:

```dotenv title=".env.example"
ASSEMBLYAI_API_KEY=replace_with_your_key
PUBLIC_ORIGIN=https://your-render-service-hostname
PORT=3000
```

On Render, do not manually define `PORT`; Render provides it. Set `PUBLIC_ORIGIN` to the exact generated HTTPS origin, without a trailing slash. Keep `ASSEMBLYAI_API_KEY` secret.

A few security boundaries matter:

- Origin checks reduce browser cross-site abuse but are not authentication; non-browser clients can forge `Origin`.
- The in-memory rate limit resets after deploys and is per instance. It’s adequate for a single-instance MVP, not distributed enforcement.
- Temporary tokens are one-time use. Fetch one immediately before each connection.
- Have the frontend send `session.end` at hang-up so the billable 30-second resume window does not remain open.
- Move inline JavaScript and CSS into static files later so you can remove `'unsafe-inline'` from the content-security policy.

### You

Give me the matching package.json

### AssemblyAI Agent

This matches the secure reference `server.js` and pins our SDK at `4.41.1`.

```json title="package.json"
{
  "name": "assemblyai-voice-agent",
  "version": "1.0.0",
  "private": true,
  "description": "Secure AssemblyAI Voice Agent frontend and token server",
  "type": "module",
  "engines": {
    "node": "22.x"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "assemblyai": "4.41.1",
    "dotenv": "17.2.2",
    "express": "5.1.0",
    "express-rate-limit": "8.1.0",
    "helmet": "8.1.0"
  }
}
```

Generate the lockfile and verify the server starts:

```bash title="install-and-run.sh"
npm install
npm start
```

Commit both dependency files so Render can use `npm ci`:

```bash title="commit-dependencies.sh"
git add package.json package-lock.json
git commit -m "Add pinned server dependencies"
git push
```

Your Render configuration should remain:

- Runtime: Node
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/health`
- Node version: `22`
- Secret: `ASSEMBLYAI_API_KEY`
- `PUBLIC_ORIGIN`: your exact Render HTTPS origin with no trailing slash
- Don’t manually set `PORT`

### You

Give me the final render.yaml

### AssemblyAI Agent

This matches the secure reference server and `package.json`. Render prompts for your AssemblyAI key because `sync: false` keeps it out of Git.

```yaml title="render.yaml"
services:
  - type: web
    name: assemblyai-voice-agent
    runtime: node
    plan: free
    region: oregon
    branch: main
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /health
    autoDeployTrigger: commit

    envVars:
      - key: NODE_VERSION
        value: "22"

      - key: NODE_ENV
        value: production

      - key: ASSEMBLYAI_API_KEY
        sync: false

      # Set this after the first deployment to the exact Render HTTPS
      # origin, without a trailing slash, then redeploy.
      - key: PUBLIC_ORIGIN
        sync: false
```

Deployment sequence:

1. Commit `render.yaml` to the repository root.
2. Create a Render Blueprint from the repository.
3. Enter `ASSEMBLYAI_API_KEY` when prompted.
4. For the first deployment, set `PUBLIC_ORIGIN` to the expected Render service origin if known. Otherwise, temporarily leave it empty.
5. After Render creates the service, copy its exact HTTPS origin.
6. Set `PUBLIC_ORIGIN` to that origin with no path or trailing slash.
7. Redeploy, then confirm `/health` returns `{"status":"ok"}`.
8. Start a call and verify the `POST /api/voice-token` request succeeds.

Do not add `PORT`; Render injects it automatically. Also, `plan: free` availability and sleep behavior depend on your current Render account. Change `plan` in the dashboard or YAML if that plan is unavailable.

Commit it:

```bash title="commit-render-config.sh"
git add render.yaml
git commit -m "Add Render deployment blueprint"
git push
```

If the frontend gets HTTP `403` after deployment, compare the browser’s `Origin` request header with `PUBLIC_ORIGIN`; they must match exactly, including `https` and excluding a trailing slash.

### You

Review my complete project structure

### AssemblyAI Agent

I can review the actual project if you paste the output of `tree` and the key files as text. Don’t paste `.env`, your API key, or `package-lock.json`.

Your completed project should look like this:

```text title="project-structure.txt"
assemblyai-voice-agent/
├── package.json
├── package-lock.json
├── server.js
├── render.yaml
├── .env.example
├── .gitignore
└── public/
    ├── index.html
    └── pcm-processor.js
```

Use this checklist:

- `package.json`
  - Has `"type": "module"`.
  - Pins `assemblyai` to `4.41.1`.
  - Includes `express`, `express-rate-limit`, `helmet`, and `dotenv`.
  - Uses `"start": "node server.js"`.
  - Requires Node 22.

- `server.js`
  - Reads `ASSEMBLYAI_API_KEY`, `PUBLIC_ORIGIN`, and `PORT`.
  - Never returns or logs the AssemblyAI API key.
  - Uses `app.set("trust proxy", 1)` for Render.
  - Applies Helmet before routes.
  - Serves `public/`.
  - Exposes `GET /health`.
  - Exposes `POST /api/voice-token`, not `GET`.
  - Applies origin validation and rate limiting before token creation.
  - Uses `client.voiceAgent.createTemporaryToken(...)`.
  - Sets `Cache-Control: no-store` on token responses.
  - Binds to `0.0.0.0`.
  - Handles `SIGTERM` for Render shutdown.

- `public/index.html`
  - Contains no API key and no Google login code.
  - Requests a token with `POST /api/voice-token`.
  - Connects to `wss://agents.assemblyai.com/v1/ws`.
  - Sends `session.update` with the stored `agent_id`.
  - Handles `401`, `403`, `429`, and server failures.
  - Sends `{"type":"session.end"}` on explicit hang-up.
  - Escapes transcript text with `textContent`, not `innerHTML`.
  - Loads `/pcm-processor.js`.

- `public/pcm-processor.js`
  - Registers the same processor name used by `index.html`.
  - Produces 24 kHz, signed 16-bit PCM.
  - Transfers `ArrayBuffer` objects to reduce copying.
  - Doesn’t contain credentials.

- `render.yaml`
  - Uses `npm ci` and `npm start`.
  - Uses `/health` for health checks.
  - Marks `ASSEMBLYAI_API_KEY` and `PUBLIC_ORIGIN` as `sync: false`.
  - Does not define `PORT`.
  - Matches an available Render plan and region.

- `.env.example`

```dotenv title=".env.example"
ASSEMBLYAI_API_KEY=replace_with_your_key
PUBLIC_ORIGIN=http://localhost:3000
PORT=3000
```

- `.gitignore`

```gitignore title=".gitignore"
node_modules/
.env
.env.*
!.env.example
npm-debug.log*
.DS_Store
```

Before pushing, run:

```bash title="preflight.sh"
#!/usr/bin/env bash
set -euo pipefail

npm ci
node --check server.js
test -f public/index.html
test -f public/pcm-processor.js
test -f render.yaml

if grep -RInE \
  --exclude-dir=node_modules \
  --exclude=package-lock.json \
  --exclude='.env.example' \
  'ASSEMBLYAI_API_KEY=.+|AIza[0-9A-Za-z_-]{20,}' .; then
  echo "Possible committed secret found."
  exit 1
fi

npm start
```

After the server starts, verify it in another terminal:

```bash title="smoke-test.sh"
curl -i http://localhost:3000/health

curl -i -X POST \
  -H "Origin: http://localhost:3000" \
  http://localhost:3000/api/voice-token
```

Expected results:

- `/health`: HTTP `200`
- Valid-origin token request: HTTP `200` with a temporary `token`
- Wrong-origin token request: HTTP `403`
- Sixth token request in 15 minutes: HTTP `429`
- Static frontend: HTTP `200`
- No API key in browser source or network responses

One issue in the current security design: with `PUBLIC_ORIGIN` unset, the origin middleware does not enforce an allowlist. Set it to the exact Render HTTPS origin immediately after the first deployment. This check and an in-memory rate limiter reduce casual abuse, but they are not user authentication.

To show your structure without exposing secrets:

```bash title="show-project.sh"
find . -maxdepth 3 \
  -not -path './node_modules*' \
  -not -name '.env' \
  -not -name 'package-lock.json' \
  -print
```

Paste that output plus `server.js`, `package.json`, `render.yaml`, `public/index.html`, and `public/pcm-processor.js` for a line-by-line review.

### You

Review my frontend files

### AssemblyAI Agent

Paste `public/index.html` and `public/pcm-processor.js` here as text. I can’t receive file uploads or inspect your repository directly, but I can review pasted code line by line.

Before pasting, remove any secrets. The frontend should contain only the stored `agent_id`; it must not contain `ASSEMBLYAI_API_KEY`, temporary tokens, or other credentials.

I’ll verify:

- `POST /api/voice-token` matches your secure server
- Voice Agent WebSocket connection and `session.update`
- Current event names and audio message shape
- Microphone capture and 24 kHz signed 16-bit PCM conversion
- Playback scheduling and interruption behavior
- Cumulative transcript-delta handling
- `session.end` on hang-up to stop billing promptly
- Cleanup after errors, socket closure, and page exit
- Safe rendering with `textContent`
- HTTP `403` and `429` UX
- Compatibility with your Helmet content-security policy
- Mobile browser and microphone behavior

Use this format:

```html
<!-- public/index.html -->
...code...
```

```javascript
// public/pcm-processor.js
...code...
```

If they’re long, paste one file per message, starting with `public/index.html`.
