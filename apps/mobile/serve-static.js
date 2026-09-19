// Minimal static file server for the exported web SPA (apps/mobile/dist), with
// client-side-routing fallback to index.html. Written with zero dependencies —
// deliberately not `serve` — because Railway's production dependency install for
// this pnpm monorepo does not reliably carry devDependencies/optional bins into
// the runtime image, and this needs nothing more than Node's own http/fs modules.
const http = require('http')
const fs = require('fs')
const path = require('path')

const DIST_DIR = path.join(__dirname, 'dist')
const PORT = process.env.PORT || 3000

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

const server = http.createServer((req, res) => {
  const requestedPath = decodeURIComponent(req.url.split('?')[0])
  let filePath = path.join(DIST_DIR, requestedPath)

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback — client-side routing owns any path that isn't a real file.
      filePath = path.join(DIST_DIR, 'index.html')
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404)
        return res.end('Not found')
      }
      const ext = path.extname(filePath)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
      res.end(data)
    })
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${DIST_DIR} on port ${PORT}`)
})
