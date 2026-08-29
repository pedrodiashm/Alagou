FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY tsconfig.json ./

RUN npm install

COPY src ./src

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
