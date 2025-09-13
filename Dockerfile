# Dockerfile for Winning Edge
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
# Note: This exposes port 3001, which is used for testing.
# For production, ensure your .env file sets PORT=3000 and your `docker run` command maps the host port to container port 3000.
CMD ["node", "server.js"]
