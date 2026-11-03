#!/usr/bin/env bash
# Chrome 웹 스토어 제출용 zip 을 만든다. 사용: bash ops/naviweb-agent/pack-extension.sh  →  naviweb-agent-extension-<버전>.zip
set -euo pipefail
cd "$(dirname "$0")/extension"
v=$(node -p "require('./manifest.json').version")
out="../naviweb-agent-extension-$v.zip"
rm -f "$out"
zip -qr "$out" manifest.json *.js *.html icons
echo "만든 파일: $(cd .. && pwd)/$(basename "$out")"
unzip -l "$out" | tail -n +4 | head -n -2
