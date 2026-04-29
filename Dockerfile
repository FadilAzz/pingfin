FROM node:20-alpine
RUN apk add --no-cache netcat-openbsd
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
EXPOSE 3000
CMD ["sh", "-c", "until nc -z $DB_HOST ${DB_PORT:-3306}; do echo 'waiting for db...'; sleep 2; done && node src/db/init.js || true && node src/server.js"]
