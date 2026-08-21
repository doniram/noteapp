FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY package*.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/data ./src/data
ENV DB_PATH=/data/devnotes.db UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads \
    && chown -R node:node /app /data
USER node
EXPOSE 4000
CMD ["node", "server/index.js"]