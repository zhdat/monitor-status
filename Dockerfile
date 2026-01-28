FROM node:18-alpine

WORKDIR /app

# Copie des dépendances
COPY package.json package-lock.json* ./
RUN npm install --production

# Copie du code source
COPY . .

# Création du volume pour la DB
VOLUME /app/data

EXPOSE 3001

CMD ["node", "server.js"]