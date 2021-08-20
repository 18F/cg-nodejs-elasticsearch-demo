FROM node:14.16.1

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]
