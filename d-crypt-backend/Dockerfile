# Use the official lightweight Node.js image
FROM node:18-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Cloud Run injects the PORT environment variable (default 8080)
EXPOSE 8080

# Start the application
CMD [ "node", "index.js" ]
