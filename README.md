# Dorothy Host

A small static website hosting panel.

## Run
1. Install Node.js 18+.
2. Run `npm install`.
3. Set `HOST_PASSWORD` in your environment (change the default).
4. Run `npm start`.
5. Open http://localhost:3000

## Publish
Create a ZIP containing `index.html` and all CSS/JS/images. Upload it in the panel. The site appears at `/sites/<name>/`.

## Deploy
This can be deployed to a Node.js host such as Render, Railway, Fly.io, or a VPS. Note that some free/container hosts have ephemeral disks; for permanent storage, use a host with persistent storage or adapt the storage layer to object storage.
