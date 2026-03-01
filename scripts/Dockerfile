FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY ais-relay.cjs ./
EXPOSE 8080
CMD ["node", "ais-relay.cjs"]
