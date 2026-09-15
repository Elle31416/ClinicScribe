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