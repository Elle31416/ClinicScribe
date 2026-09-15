const AGENT_ID = "agent_b0aca15004de4ab2b39bbfc1ce360956";
const APP_VERSION = "1.0.0";
const TARGET_SAMPLE_RATE = 24_000;
const MAX_TRANSCRIPT_LINES = 100;
const CONNECTION_TIMEOUT_MS = 10_000;
const END_TIMEOUT_MS = 3_000;
const DEFAULT_SESSION_DURATION_SECONDS = 1_800;

const $ = (selector) => document.querySelector(selector);
const startButton = $("#start");
const muteButton = $("#mute");
const endButton = $("#end");
const statusElement = $("#status");
const orbElement = $("#orb");
const timerElement = $("#timer");
const transcriptElement = $("#transcript");
const errorBox = $("#error");
const hintElement = $("#hint");

let ws = null;
let context = null;
let stream = null;
let sourceNode = null;
let worklet = null;
let timerId = null;
let durationLimitId = null;
let endTimeoutId = null;
let connectionTimeoutId = null;
let tokenController = null;
let startedAt = 0;
let playbackAt = 0;
let state = "idle";
let muted = false;
let cleaningUp = false;
let socketFailed = false;
let sessionDurationSeconds = DEFAULT_SESSION_DURATION_SECONDS;
const activeAudioSources = new Set();

const stateLabels = {
  idle: "Ready to talk",
  connecting: "Connecting…",
  live: "Listening…",
  ending: "Ending call…",
  ended: "Call ended",
};

function setState(nextState) {
  state = nextState;
  startButton.disabled = ["connecting", "live", "ending"].includes(nextState);
  muteButton.disabled = nextState !== "live";
  endButton.disabled = nextState !== "live";
  orbElement.classList.toggle("live", nextState === "live");
  orbElement.classList.toggle("ended", nextState === "ended");
  statusElement.textContent = stateLabels[nextState] ?? stateLabels.idle;
}

function addLine(speaker, text) {
  if (!text) return;

  hintElement?.remove();

  while (transcriptElement.children.length >= MAX_TRANSCRIPT_LINES) {
    transcriptElement.firstElementChild?.remove();
  }

  const line = document.createElement("p");
  line.className = `line ${speaker === "Agent" ? "agent" : "user"}`;

  const speakerLabel = document.createElement("b");
  speakerLabel.textContent = `${speaker}: `;
  line.append(speakerLabel, document.createTextNode(text));
  transcriptElement.append(line);

  requestAnimationFrame(() => {
    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }

  return btoa(binary);
}

function stopPlayback() {
  for (const source of activeAudioSources) {
    source.onended = null;
    try {
      source.stop();
      source.disconnect();
    } catch {
      // The source may already have finished.
    }
  }

  activeAudioSources.clear();

  if (context && context.state !== "closed") {
    playbackAt = context.currentTime + 0.02;
  } else {
    playbackAt = 0;
  }
}

function playPcm16(base64Audio) {
  if (!context || context.state === "closed" || state !== "live") return;

  const raw = atob(base64Audio);
  const pcm = new Int16Array(raw.length / 2);

  for (let i = 0; i < pcm.length; i += 1) {
    const offset = i * 2;
    pcm[i] = raw.charCodeAt(offset) | (raw.charCodeAt(offset + 1) << 8);
  }

  const audioBuffer = context.createBuffer(1, pcm.length, TARGET_SAMPLE_RATE);
  const channel = audioBuffer.getChannelData(0);

  for (let i = 0; i < pcm.length; i += 1) {
    channel[i] = pcm[i] / 32768;
  }

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(context.destination);
  source.onended = () => {
    activeAudioSources.delete(source);
    source.disconnect();
  };

  activeAudioSources.add(source);
  playbackAt = Math.max(playbackAt, context.currentTime + 0.02);
  source.start(playbackAt);
  playbackAt += audioBuffer.duration;
}

function updateTimer() {
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  timerElement.textContent = `${minutes}:${seconds}`;
}

function clearCallTimers() {
  clearInterval(timerId);
  clearTimeout(durationLimitId);
  clearTimeout(endTimeoutId);
  clearTimeout(connectionTimeoutId);
  timerId = durationLimitId = endTimeoutId = connectionTimeoutId = null;
}

async function cleanup(errorMessage = "") {
  if (cleaningUp) return;
  cleaningUp = true;

  state = "ended";
  clearCallTimers();
  tokenController?.abort();
  stopPlayback();

  if (worklet) {
    worklet.port.onmessage = null;
    worklet.disconnect();
  }
  sourceNode?.disconnect();
  stream?.getTracks().forEach((track) => track.stop());

  const socket = ws;
  ws = null;

  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;

    if (
      socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN
    ) {
      socket.close(1000, "Call ended");
    }
  }

  if (context && context.state !== "closed") {
    try {
      await context.close();
    } catch (error) {
      console.warn("AudioContext cleanup failed", error);
    }
  }

  context = null;
  stream = null;
  sourceNode = null;
  worklet = null;
  tokenController = null;
  muted = false;
  muteButton.textContent = "Mute";
  orbElement.classList.remove("muted");
  errorBox.textContent = errorMessage;
  setState("ended");
  startButton.disabled = false;
  cleaningUp = false;
}

async function prepareAudio() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access requires HTTPS and a current browser.");
  }

  // Ask the browser to run the audio graph at the agent's sample rate. This
  // uses its optimized resampler and avoids most manual sample-rate conversion.
  try {
    context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  } catch {
    context = new AudioContext();
  }

  await context.resume();

  try {
    const [, microphoneStream] = await Promise.all([
      context.audioWorklet.addModule(`/pcm-processor.js?v=${APP_VERSION}`),
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }),
    ]);

    stream = microphoneStream;
    sourceNode = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, "pcm-processor", {
      processorOptions: {
        inputSampleRate: context.sampleRate,
        targetSampleRate: TARGET_SAMPLE_RATE,
      },
    });

    sourceNode.connect(worklet);

    worklet.port.onmessage = ({ data }) => {
      if (
        state === "live" &&
        !muted &&
        ws?.readyState === WebSocket.OPEN
      ) {
        ws.send(JSON.stringify({
          type: "input.audio",
          audio: arrayBufferToBase64(data),
        }));
      }
    };
  } catch (error) {
    if (error.name === "NotAllowedError") {
      throw new Error("Microphone permission is required to start a call.");
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      throw new Error("No compatible microphone was found.");
    }
    throw error;
  }
}

async function requestVoiceToken() {
  tokenController = new AbortController();

  let response;
  try {
    response = await fetch("/api/voice-token", {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      signal: tokenController.signal,
    });
  } catch (error) {
    if (error.name !== "AbortError") {
      throw new Error("Could not reach the voice-session server.");
    }
    throw error;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(body.error || "Too many calls started. Please try later.");
    }
    if (response.status === 403) {
      throw new Error(body.error || "This page is not allowed to start a call.");
    }
    throw new Error(body.error || "Could not start the voice session.");
  }

  if (!body.token) {
    throw new Error("The server did not return a voice token.");
  }

  return body;
}

function startLiveSession() {
  setState("live");
  startedAt = Date.now();
  playbackAt = context ? context.currentTime + 0.05 : 0;
  timerElement.textContent = "00:00";
  updateTimer();

  clearInterval(timerId);
  clearTimeout(durationLimitId);
  timerId = setInterval(updateTimer, 1000);
  durationLimitId = setTimeout(() => {
    statusElement.textContent = "Session time limit reached; ending…";
    endCall();
  }, sessionDurationSeconds * 1000);
}

async function handleSocketMessage({ data }) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    console.warn("Received an invalid voice-agent message");
    return;
  }

  switch (message.type) {
    case "session.ready":
      clearTimeout(connectionTimeoutId);
      connectionTimeoutId = null;
      startLiveSession();
      break;
    case "reply.audio":
      playPcm16(message.data);
      break;
    case "reply.done":
      if (message.status === "interrupted") stopPlayback();
      break;
    case "transcript.user":
      addLine("You", message.text);
      break;
    case "transcript.agent":
      addLine("Agent", message.text);
      break;
    case "session.ended":
      await cleanup();
      break;
    case "session.error":
    case "error":
      errorBox.textContent = message.message || "Voice session error";
      break;
    default:
      break;
  }
}

async function handleSocketClose() {
  clearTimeout(connectionTimeoutId);
  connectionTimeoutId = null;
  clearTimeout(endTimeoutId);
  endTimeoutId = null;

  if (state === "connecting") {
    await cleanup(
      socketFailed
        ? "Could not connect to the voice service."
        : "The voice service closed the connection before the call started.",
    );
  } else if (state !== "ended") {
    await cleanup();
  }
}

async function startCall() {
  if (state !== "idle") return;

  socketFailed = false;
  errorBox.textContent = "";
  timerElement.textContent = "00:00";
  setState("connecting");

  try {
    // Prepare the microphone first. The short-lived token is then minted
    // immediately before the socket connection, avoiding token-expiry delays.
    await prepareAudio();
    const tokenResponse = await requestVoiceToken();
    sessionDurationSeconds =
      tokenResponse.maxSessionDurationSeconds ?? DEFAULT_SESSION_DURATION_SECONDS;

    const socketUrl = new URL("wss://agents.assemblyai.com/v1/ws");
    socketUrl.searchParams.set("token", tokenResponse.token);
    ws = new WebSocket(socketUrl);

    connectionTimeoutId = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        ws.close(4000, "Connection timed out");
      }
    }, CONNECTION_TIMEOUT_MS);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "session.update",
        session: { agent_id: AGENT_ID },
      }));
    };
    ws.onmessage = handleSocketMessage;
    ws.onclose = handleSocketClose;
    ws.onerror = () => {
      socketFailed = true;
    };
  } catch (error) {
    if (error.name !== "AbortError") {
      errorBox.textContent = error.message || "Could not start the voice session.";
      console.error(error);
    }
    await cleanup(errorBox.textContent);
  }
}

function endCall() {
  if (ws?.readyState === WebSocket.OPEN) {
    setState("ending");
    ws.send(JSON.stringify({ type: "session.end" }));
    endTimeoutId = setTimeout(() => cleanup(), END_TIMEOUT_MS);
  } else {
    cleanup();
  }
}

startButton.addEventListener("click", startCall);
endButton.addEventListener("click", () => endCall());

muteButton.addEventListener("click", () => {
  muted = !muted;
  for (const track of stream?.getAudioTracks() ?? []) {
    track.enabled = !muted;
  }
  muteButton.textContent = muted ? "Unmute" : "Mute";
  orbElement.classList.toggle("muted", muted);
  statusElement.textContent = muted ? "Microphone muted" : "Listening…";
});

window.addEventListener("pagehide", () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "session.end" }));
    ws.close(1000, "Page closed");
  }
});

setState("idle");
