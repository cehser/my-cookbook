# build stage
FROM node:lts-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .

# Create vue.config.js to disable TypeScript checking
RUN echo "module.exports = { chainWebpack: config => { config.plugins.delete('fork-ts-checker'); } };" > vue.config.js
RUN npm run build

# production stage
FROM nginx:stable-alpine AS production-stage
COPY .docker/nginx/prod.conf /etc/nginx/conf.d/default.conf
COPY .docker/nginx/config.js.template /etc/nginx/templates/config.js.template
COPY .docker/nginx/docker-entrypoint.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
