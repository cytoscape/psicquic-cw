// Port of the desktop client's RegistryManager
// (org.cytoscape.webservice.psicquic.RegistryManager): fetches the EBI
// PSICQUIC registry's STATUS document and extracts, per service, its name,
// REST endpoint, active flag, record count and PSI-MI tags.

import { fetchTextViaProxy } from './corsProxy'

export const REGISTRY_URL =
  'http://www.ebi.ac.uk/Tools/webservices/psicquic/registry/registry?action=STATUS&format=xml'

const REGISTRY_TIMEOUT_MS = 60_000 // desktop client: awaitTermination(60s)

export interface PsicquicService {
  name: string
  /** REST endpoint base; registry values end with a slash. */
  restUrl: string
  active: boolean
  /** Total records in the database (registry-reported, not query hits). */
  count: number
  /** PSI-MI accessions, e.g. 'MI:1047'. */
  tags: string[]
}

const textOf = (service: Element, tagName: string): string | undefined =>
  service.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim()

export const parseRegistryXml = (xml: string): PsicquicService[] => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('PSICQUIC registry returned malformed XML')
  }

  const services: PsicquicService[] = []
  const elements = doc.getElementsByTagNameNS('*', 'service')
  for (const element of Array.from(elements)) {
    const name = textOf(element, 'name')
    const restUrl = textOf(element, 'restUrl')
    if (name === undefined || name === '' || restUrl === undefined) {
      continue
    }
    services.push({
      name,
      // Downstream URL building assumes the trailing slash the registry
      // provides; normalize in case a service entry omits it.
      restUrl: restUrl.endsWith('/') ? restUrl : `${restUrl}/`,
      active: textOf(element, 'active') === 'true',
      count: Number(textOf(element, 'count') ?? '0') || 0,
      tags: Array.from(element.getElementsByTagNameNS('*', 'tag'))
        .map((tag) => tag.textContent?.trim() ?? '')
        .filter((tag) => tag !== ''),
    })
  }
  return services
}

export const fetchRegistry = async (): Promise<PsicquicService[]> => {
  const xml = await fetchTextViaProxy(REGISTRY_URL, {
    timeoutMs: REGISTRY_TIMEOUT_MS,
    accept: 'text/xml',
  })
  const services = parseRegistryXml(xml)
  if (services.length === 0) {
    throw new Error('PSICQUIC registry returned no services')
  }
  return services
}
