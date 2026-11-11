FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node public ./public
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
