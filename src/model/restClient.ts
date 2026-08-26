// Port of the query-building/fetching parts of the desktop client's
// PSICQUICRestClient + PSICQUICSimpleClient. The search bar always uses the
// desktop factory's mode (SearchMode.INTERACTOR — "Search by gene/protein ID
// list"): the raw user text is URL-encoded onto the `/interactor/` path
// segment with no MIQL wrapping; servers interpret whitespace-separated
// tokens as an OR'd identifier query.

import { fetchTextViaProxy } from './corsProxy'

const COUNT_TIMEOUT_MS = 30_000
const IMPORT_TIMEOUT_MS = 180_000

// URLEncoder.encode(q, "UTF-8") + replaceAll("\\+", "%20") in Java ≈
// encodeURIComponent, which never emits '+' for spaces.
export const buildInteractorUrl = (restUrl: string, query: string): string =>
  `${restUrl}interactor/${encodeURIComponent(query)}`

/**
 * Number of interactions the service holds for this query
 * (`?format=count` returns a plain-integer body).
 */
export const fetchInteractionCount = async (
  restUrl: string,
  query: string,
): Promise<number> => {
  const body = await fetchTextViaProxy(
    `${buildInteractorUrl(restUrl, query)}?format=count`,
    { timeoutMs: COUNT_TIMEOUT_MS },
  )
  const count = Number.parseInt(body.trim(), 10)
  if (Number.isNaN(count)) {
    throw new Error(`Unparseable count response: "${body.slice(0, 80)}"`)
  }
  return count
}

/**
 * The MITAB result set for this query. Asks for MITAB 2.7 first and, like
 * the desktop client, retries without any format parameter (server default,
 * MITAB 2.5) when the service rejects tab27. `maxResults` caps the fetch —
 * the desktop client fetched unbounded, which a browser tab can't afford.
 */
export const fetchMitab = async (
  restUrl: string,
  query: string,
  maxResults?: number,
): Promise<string> => {
  const baseUrl = buildInteractorUrl(restUrl, query)
  const cap = maxResults !== undefined && maxResults > 0
  const capParams = cap ? `&firstResult=0&maxResults=${maxResults}` : ''
  try {
    return await fetchTextViaProxy(`${baseUrl}?format=tab27${capParams}`, {
      timeoutMs: IMPORT_TIMEOUT_MS,
    })
  } catch {
    // MITAB 2.7 not supported by this server — server-default format.
    return await fetchTextViaProxy(
      cap ? `${baseUrl}?firstResult=0&maxResults=${maxResults}` : baseUrl,
      { timeoutMs: IMPORT_TIMEOUT_MS },
    )
  }
}
