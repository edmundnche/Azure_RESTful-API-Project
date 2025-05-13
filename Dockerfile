# Use Node.js base image
FROM node:23-slim

# Set working directory in container
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all other source code including public folder
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]


