gcloud run deploy assemblyai-voice-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="ASSEMBLYAI_API_KEY=assemblyai-api-key:latest" \
  --update-env-vars="GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com,ALLOWED_GOOGLE_EMAILS=you@example.com"