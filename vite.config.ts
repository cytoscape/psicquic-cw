import type { Plugin } from 'vite'

import { defineCyWebApp } from '@cytoscape-web/app-runtime/vite'

// Prefix under which src/model/corsProxy.ts asks this app's OWN dev server to
// forward PSICQUIC requests. Neither the EBI registry nor the individual
// PSICQUIC service endpoints send CORS headers (and the registry is plain
// http — https 301-redirects back to http), so the browser cannot call them
// directly from the Cytoscape Web host page. The desktop client had no such
// constraint. Dev-server only; a production deployment needs its own proxy.
const PROXY_PREFIX = '/psicquic-proxy/'

// GET /psicquic-proxy/<encodeURIComponent(absolute-url)> → fetches the URL
// from Node and replays status/content-type/body with a permissive CORS
// header (the host page runs on a different origin than this dev server).
// The target host comes from the registry response at runtime, so this is a
// dynamic forwarder — acceptable for a localhost-bound dev tool.
const psicquicCorsProxy = (): Plugin => ({
  name: 'psicquic-cors-proxy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === undefined || !req.url.startsWith(PROXY_PREFIX)) {
        next()
        return
      }
      void (async () => {
        res.setHeader('access-control-allow-origin', '*')
        try {
          const target = new URL(
            decodeURIComponent(req.url!.slice(PROXY_PREFIX.length)),
          )
          if (target.protocol !== 'http:' && target.protocol !== 'https:') {
            throw new Error(`Unsupported protocol: ${target.protocol}`)
          }
          const upstream = await fetch(target, {
            headers: { accept: req.headers.accept ?? '*/*' },
            redirect: 'follow',
          })
          res.statusCode = upstream.status
          const contentType = upstream.headers.get('content-type')
          if (contentType !== null) {
            res.setHeader('content-type', contentType)
          }
          res.end(Buffer.from(await upstream.arrayBuffer()))
        } catch (error) {
          res.statusCode = 502
          res.end(`psicquic-cors-proxy: ${String(error)}`)
        }
      })()
    })
  },
})

export default defineCyWebApp(import.meta.url, {
  vite: {
    plugins: [psicquicCorsProxy()],
    server: {
      cors: true,
    },
  },
})
