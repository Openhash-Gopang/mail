#!/usr/bin/env bash
# Chrome 웹 스토어 제출용 zip 을 만든다. 사용: bash ops/naviweb-agent/pack-extension.sh  →  naviweb-agent-extension-<버전>.zip
set -euo pipefail
cd "$(dirname "$0")/extension"
v=$(node -p "require('./manifest.json').version")
out="../naviweb-agent-extension-$v.zip"
rm -f "$out"
# 스토어가 ID 를 직접 부여하므로 제출본에서는 개발용 고정 키("key")를 뺀다(폴더 로드용 manifest 는 그대로 둔다).
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
cp -R manifest.json *.js *.html icons "$tmp"/
node -e "const fs=require('fs'),p=process.argv[1]+'/manifest.json',m=JSON.parse(fs.readFileSync(p,'utf8'));delete m.key;fs.writeFileSync(p,JSON.stringify(m,null,2))" "$tmp"
(cd "$tmp" && zip -qr "$OLDPWD/$out" manifest.json *.js *.html icons)
echo "만든 파일: $(cd .. && pwd)/$(basename "$out")"
unzip -l "$out" | tail -n +4 | head -n -2
