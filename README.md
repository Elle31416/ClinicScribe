# AssemblyAI Voice Agent

A small, production-minded Node/Express service that serves a browser voice client and mints short-lived AssemblyAI Voice Agent tokens. The browser streams audio directly to AssemblyAI; the AssemblyAI API key never leaves the server.

## Project structure

```text
.
├── server.js
├── package.json
├── package-lock.json
├── render.yaml
├── .env.example
├── public/
│   ├── index.html
│   ├── favicon.svg
│   ├── styles.css
│   ├── app.js
│   └── pcm-processor.js
├── scripts/
│   └── verify-pcm.mjs
└── docs/
    └── handoff.md
```

## Local development

Requirements:

- Node.js 22
- An AssemblyAI API key

```bash
npm ci
cp .env.example .env
# Edit .env and set ASSEMBLYAI_API_KEY.
npm start
```

Open <http://localhost:3000>. For local development, leave `PUBLIC_ORIGIN=http://localhost:3000`.

Check syntax and the PCM resampling fast paths without starting the server:

```bash
npm test
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | Yes | Server-side AssemblyAI API key. |
| `PUBLIC_ORIGIN` | Recommended | Exact browser origin allowed to request tokens, e.g. `https://your-service.onrender.com`. No trailing slash. |
| `PORT` | No | Port supplied by the host. Defaults to `3000` locally. |

## Deployment

The repository includes a Render blueprint in `render.yaml`:

1. Create a Render Web Service from this repository.
2. Set `ASSEMBLYAI_API_KEY` as a secret.
3. Set `PUBLIC_ORIGIN` to the final HTTPS origin.
4. Deploy and verify `/health` returns `200`.
5. Start a call, test mute/interruption, and end the call.

Render builds with `npm ci`, starts with `npm start`, and uses `/health` for health checks. Do not set `PORT` manually on Render.

## Performance and cost controls

- Static HTML, CSS, and JavaScript are separated, compressed, and cached by the browser.
- The audio graph requests a 24 kHz AudioContext when supported; the worklet includes a fallback linear resampler.
- The microphone and AudioWorklet are prepared before requesting a token so the 60-second single-use token is redeemed immediately.
- Temporary tokens expire after 60 seconds and calls are capped at 30 minutes.
- Token creation is limited to five requests per IP every 15 minutes.
- The client sends `session.end`, stops media tracks, disconnects Web Audio nodes, and closes the AudioContext on hang-up.
- Queued agent audio is stopped when the user interrupts.
- The transcript is capped to 100 rendered lines to limit long-call DOM growth.

## Security notes

The rate limiter and `Origin`/`Sec-Fetch-Site` checks reduce casual browser abuse, but they are not user authentication. For a public deployment, add authentication and consider a distributed rate-limit store if the service runs multiple instances.
