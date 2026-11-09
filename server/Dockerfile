FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
# Private uploads (diet plans) live in /app/storage, which docker-compose.yml mounts as a volume.
RUN mkdir -p /app/storage && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "src/server.js"]
