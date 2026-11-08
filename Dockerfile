FROM node:26-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8484

# No dependencies to install: copy the app only.
COPY package.json server.js ./
COPY scripts/env.js scripts/litanies.js scripts/
COPY public public
# The litanies folder is mounted by docker-compose.yml so edits show up without a rebuild.
# These copies are a fallback for running the image on its own.
COPY litanies litanies

RUN chown -R node:node /app
USER node

EXPOSE 8484
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:8484/api/litanies').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server.js"]
