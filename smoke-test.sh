curl -i http://localhost:3000/health

curl -i -X POST \
  -H "Origin: http://localhost:3000" \
  http://localhost:3000/api/voice-token