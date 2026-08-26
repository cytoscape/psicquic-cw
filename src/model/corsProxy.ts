// Neither the EBI PSICQUIC registry nor the individual service endpoints
// send CORS headers (and the registry is plain http), so the browser cannot
// fetch them directly from the host page. All requests are routed through
// this app's own Vite dev server, which forwards them (see the `server.proxy`
// block in vite.config.ts). Dev-server only — a production deployment of
// this app would need an equivalent proxy at the same path.
const PROXY_PREFIX = '/psicquic-proxy/'

// Origin this app's modules are served from (the app dev server), NOT the
// host page origin — module federation loads us cross-origin.
const APP_ORIGIN = new URL(import.meta.url).origin

export const proxiedUrl = (url: string): string =>
  `${APP_ORIGIN}${PROXY_PREFIX}${encodeURIComponent(url)}`

export interface FetchTextOptions {
  timeoutMs: number
  accept?: string
}

/** Fetches a PSICQUIC URL through the dev-server proxy and returns the body text. */
export const fetchTextViaProxy = async (
  url: string,
  { timeoutMs, accept }: FetchTextOptions,
): Promise<string> => {
  const response = await fetch(proxiedUrl(url), {
    signal: AbortSignal.timeout(timeoutMs),
    headers: accept === undefined ? undefined : { accept },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`)
  }
  return await response.text()
}
