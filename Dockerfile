# ---------- build: compile TypeScript ----------
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @expense-claims/api
COPY apps/api apps/api
RUN npx tsc -p apps/api

# ---------- proddeps: production dependencies only ----------
FROM node:22-slim AS proddeps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @expense-claims/api

# ---------- runtime: slim, non-root, healthchecked ----------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=proddeps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
# type:module lives here so node runs dist/ as ESM
COPY apps/api/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
