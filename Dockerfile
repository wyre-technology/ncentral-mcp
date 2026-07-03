FROM node:22-alpine AS builder
WORKDIR /app

# GitHub Packages auth for @wyre-technology/node-ncentral
ARG NODE_AUTH_TOKEN
RUN echo "@wyre-technology:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" >> .npmrc

COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
# Prune dev dependencies in the builder stage — the production stage has no
# GitHub Packages auth, so pruning there would strip @wyre-technology/* deps.
RUN npm prune --omit=dev

FROM node:22-alpine AS production

# OCI label links the GHCR package to this repository,
# enabling GITHUB_TOKEN write access from Actions workflows.
LABEL org.opencontainers.image.source="https://github.com/wyre-technology/ncentral-mcp"
LABEL org.opencontainers.image.description="MCP server for N-able N-central"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.vendor="Wyre Technology"
LABEL io.modelcontextprotocol.server.name="io.github.wyre-technology/ncentral-mcp"

RUN addgroup -g 1001 -S mcp && adduser -u 1001 -S mcp -G mcp
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER mcp
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_PORT=8080 \
    MCP_HTTP_HOST=0.0.0.0 \
    AUTH_MODE=gateway \
    LOG_LEVEL=info

CMD ["node", "dist/http.js"]
