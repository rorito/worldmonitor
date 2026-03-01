FROM node:18-alpine
WORKDIR /app
COPY scripts/ais-relay.cjs ./
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts
EXPOSE 8080
CMD ["node", "ais-relay.cjs"]