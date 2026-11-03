# 한국 리전 VM(예: Oracle Cloud 서울/춘천)에서 실행한다. playwright-core 버전과 같은 공식 이미지를 쓴다.
FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /app/ops/naviweb-agent
COPY extension ./extension
COPY runner ./runner
WORKDIR /app/ops/naviweb-agent/runner
RUN npm ci --omit=dev || npm install --omit=dev
ENV CHROME_PATH="" PORT=8787 HOST=0.0.0.0
USER pwuser
EXPOSE 8787
CMD ["node", "server.js"]
