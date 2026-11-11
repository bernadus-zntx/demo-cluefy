FROM node:22-bookworm-slim AS dashboard
WORKDIR /build/sales
COPY sales/package.json sales/package-lock.json ./
RUN npm ci --ignore-scripts
COPY sales/ui ./ui
COPY sales/vite.config.mjs ./
COPY app /build/app
COPY lib /build/lib
COPY public /build/public
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY sales/package.json sales/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node sales/server.mjs sales/database.mjs sales/check-database.mjs ./
COPY --from=dashboard --chown=node:node /build/sales/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
