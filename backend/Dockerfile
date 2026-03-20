FROM node:18-alpine

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
