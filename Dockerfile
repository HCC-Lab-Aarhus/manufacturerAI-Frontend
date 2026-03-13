# This dockerfile specifies the environment the production
# code will be run in, along with what files are needed
# for production

# Use 22 LTS version of Node.js and Debian as the base image and slim for ARM64 compatibility
FROM node:lts-bookworm-slim

# Use a non-interactive frontend for debconf
ENV DEBIAN_FRONTEND=noninteractive

# Set working directory
WORKDIR /app

# Create a user within the container
RUN useradd -m manufacturerai-frontend-user

# Copy .next, public, package.json and package-lock.json
COPY .next/ ./.next/
COPY public/ ./public/
COPY package*.json ./

# Make sure the directory belongs to the non-root user
RUN chown -R manufacturerai-frontend-user:manufacturerai-frontend-user /app

# Switch to user for subsequent commands
USER manufacturerai-frontend-user

# Clean install production dependencies
RUN npm ci --omit=dev

# Expose the port Next.js runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]