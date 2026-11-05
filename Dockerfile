# MCP server over stdio. Tools need ROBLOX_API_KEY at call time; listing tools works without it.
FROM node:22-alpine
WORKDIR /app
COPY mcp/package.json mcp/package-lock.json mcp/
RUN cd mcp && npm ci --omit=dev
COPY mcp/server.mjs mcp/
COPY skills skills
CMD ["node", "mcp/server.mjs"]
