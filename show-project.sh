find . -maxdepth 3 \
  -not -path './node_modules*' \
  -not -name '.env' \
  -not -name 'package-lock.json' \
  -print