# build stage
FROM node:26-alpine AS build-stage
WORKDIR /app
ARG COMMIT_HASH=dev
ENV COMMIT_HASH=$COMMIT_HASH
COPY package*.json ./
RUN npm ci
COPY . .

RUN npm run build

# production stage
FROM nginx:1.30-alpine AS production-stage
COPY .docker/nginx/prod.conf /etc/nginx/conf.d/default.conf
COPY .docker/nginx/config.js.template /etc/nginx/templates/config.js.template
COPY .docker/nginx/docker-entrypoint.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
