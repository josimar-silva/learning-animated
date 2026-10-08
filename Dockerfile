# One image per site: a node stage builds the site, an unprivileged nginx stage serves it.
# The final image carries only nginx and the built site, never node or the tools.
FROM node:24.18.0-trixie-slim@sha256:ae91dcc111a68c9d2d81ff2a17bda61be126426176fde6fe7d08ab13b7f50573 AS builder
ARG SITE
ENV ASTRO_TELEMETRY_DISABLED=1
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
RUN DIR=$([ "$SITE" = home ] && echo home || echo "tracks/$SITE") \
 && npm run build --workspace "$DIR" \
 && mkdir -p /out \
 && cp -r "$DIR/dist" /out/site \
 && cp "$DIR/nginx.generated.conf" /out/nginx.conf

FROM nginxinc/nginx-unprivileged:alpine@sha256:a8d5564c3354241473c1e152d5dd3281ab4224edb61b23c291e0bfd9854687a1 AS runner
USER root
RUN apk --no-cache upgrade
USER nginx
COPY --from=builder /out/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /out/site /usr/share/nginx/html
EXPOSE 3000
