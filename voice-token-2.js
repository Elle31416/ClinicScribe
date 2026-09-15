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