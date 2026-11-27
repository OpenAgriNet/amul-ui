# Staff portal (platform.amulai.in): static files served by nginx as a non-root user on :8080.
# Build context is this directory: docker build -t amul-platform platform/
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js style.css apps.json amul-logo.svg amul-ai-wordmark.svg /usr/share/nginx/html/
COPY fonts /usr/share/nginx/html/fonts
COPY thumbs /usr/share/nginx/html/thumbs
EXPOSE 8080
