FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /app/data
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
ENV NODE_ENV=production
# Cloud Run sets PORT automatically; fallback to 3001 for local
EXPOSE ${PORT:-3001}
CMD ["node", "server/index.js"]
