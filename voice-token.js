const response = await fetch("/api/voice-token", {
  method: "GET",
  cache: "no-store",
});

if (!response.ok) {
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error || "Could not start a secure voice session");
}

const { token } = await response.json();