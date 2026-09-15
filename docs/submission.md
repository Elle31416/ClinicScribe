# 📋 Hackathon submission — copy-paste fields

Ready-to-paste content for the lablab.ai submission form of the
**[AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon)**
(deadline **Sep 30, 2026, 11:00 AM EDT**).

---

## Basic information

**Project title**

```text
ClinicScribe
```

**Short description** *(135 characters)*

```text
ClinicScribe: a production-hardened voice agent for clinical intake. Patients talk; AssemblyAI listens, converses, and captures structured-ready notes.
```

**Long description**

```text
Clinicians spend roughly two hours on documentation for every hour of direct patient care, and
front-desk teams repeat the same intake questions all day. ClinicScribe turns pre-visit intake
into a natural phone-grade conversation in the browser: a patient taps "Start call" and simply
talks — reason for visit, symptoms, medications, allergies, scheduling preferences — while an
AssemblyAI Voice Agent conducts an interruptible, human-feeling dialogue and streams both
transcripts live.

How it's built (Voice Agent API path): a Node 22 / Express 5 service on Render mints single-use,
60-second Voice Agent tokens via the official AssemblyAI Node SDK (API key never leaves the
server). The browser connects straight to wss://agents.assemblyai.com/v1/ws, binds the stored
agent with session.update, and streams 24 kHz PCM16 microphone audio from an AudioWorklet while
playing back agent audio on a gapless Web Audio timeline. Interruptions (reply.done: interrupted)
instantly drop queued agent audio.

Why it stands out: it's engineered like a product, not a sandbox — origin allowlisting,
IP rate limiting, strict CSP, 30-minute cost caps, session.end billing hygiene, unit-tested PCM
resampling, a one-click Render Blueprint (render.yaml), and a full ops walkthrough in the README.
Any team can fork it and have a safe public voice-agent deployment in minutes.

Business value: fewer front-desk phone hours, structured pre-visit data ready for EHR import,
and earlier triage. Roadmap: LLM Gateway entity extraction to FHIR JSON, auth + BAA/HIPAA
controls, SMART on FHIR write-back, and phone-line/multilingual intake. (Prototype — not
HIPAA-compliant yet; no real PHI in the demo.)
```

**Technology & category tags**

```text
AssemblyAI, Voice Agent API, Speech-to-Text, Voice AI, Node.js, Express, WebSocket,
Web Audio API, AudioWorklet, Render, Healthcare, Clinical Intake, JavaScript
```

---

## Media assets

- **Cover image:** [`docs/cover.png`](cover.png) (already sized for a 16:9 hero).
- **Application URL:** `https://<your-service>.onrender.com` (fill after
  [Render deployment](../README.md#-deploying-to-render--the-full-walkthrough)).
- **Public GitHub repository:** this repo.
- **Demo platform:** Render (free instance; first load may cold-start ~50 s — mention this in
  the video intro so judges don't mistake it for a bug).

### 🎬 Video presentation outline (~2 minutes)

1. **0:00–0:15** — Hook: clinicians spend 2 h documenting per 1 h of care. Show the landing page.
2. **0:15–0:45** — Live call: agent greeting, natural intake answers, a mid-sentence interruption,
   mute/unmute, live dual transcripts.
3. **0:45–1:15** — Under the hood: architecture diagram — browser ⇄ AssemblyAI media plane,
   Render as token minter; single-use 60 s tokens; PCM16 24 kHz worklet.
4. **1:15–1:40** — Trust engineering: rate-limit (show a 429), origin check (403), strict CSP,
   cost caps, billing hygiene with session.end.
5. **1:40–2:00** — Business: intake hour savings, structured notes roadmap, compliance path,
   closing slide with repo + live URL.

### 🖥️ Slide deck outline (6–8 slides)

1. Title + cover image + hackathon badge.
2. Problem (documentation burden, intake repetition) — one stat, one quote.
3. Demo screenshots: idle orb → live call → transcript.
4. Architecture diagram (from README).
5. AssemblyAI integration table (token flow → session lifecycle).
6. Security & cost controls (the "shipped like a product" slide).
7. Business value + roadmap (M1–M4 from README).
8. Links: repo, live URL, team; "Built on AssemblyAI" credit.

### ✅ Submission checklist (from the event page)

- [x] Project title, short description, long description, tags
- [x] Cover image — `docs/cover.png`
- [ ] Video presentation — record with outline above
- [ ] Slide presentation — build with outline above
- [ ] Public GitHub repository — this repo
- [ ] Demo application platform + Application URL — after Render deploy
