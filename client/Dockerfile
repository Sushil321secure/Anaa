# Stage 1: build the static site. Stage 2: nginx serves it and proxies /api and /socket.io to the API container.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Empty = same origin (nginx proxies the WebSocket). Set only if the API lives on another domain.
ARG VITE_SOCKET_URL=
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

FROM nginx:1.27-alpine
# Only ${DOMAIN} is substituted when the official image renders the nginx templates.
ENV NGINX_ENVSUBST_FILTER=DOMAIN
COPY deploy/app.conf /etc/nginx/snippets/app.conf
COPY deploy/http.conf.template deploy/https.conf.template /etc/nginx/available/
COPY deploy/10-choose-config.sh /docker-entrypoint.d/10-choose-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/10-choose-config.sh && chmod +x /docker-entrypoint.d/10-choose-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
