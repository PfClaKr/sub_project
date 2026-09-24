# Dev image: the source is bind-mounted, node_modules stay in the image
# (see the anonymous volume in Docker-compose.yaml).
FROM node:20-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
