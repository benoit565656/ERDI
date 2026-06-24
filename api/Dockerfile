FROM node:18-alpine

WORKDIR /usr/src/app

# Copy configuration and package files from root
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy prisma schema and generate Client
COPY prisma ./prisma
RUN npx prisma generate

# Copy Express API source code
COPY api ./api

# Expose the API port
EXPOSE 4000

# Run the API server
CMD ["npx", "ts-node", "api/server.ts"]
