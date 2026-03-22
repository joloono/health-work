FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /app/data
# Build tools for better-sqlite3 native compilation (needed on ARM/Pi)
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev
# Clean up build tools after install
RUN apk del python3 make g++
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY server ./server
ENV NODE_ENV=production
EXPOSE ${PORT:-3001}
CMD ["node", "server/index.js"]
