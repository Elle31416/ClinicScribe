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