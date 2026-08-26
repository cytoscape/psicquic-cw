// The onSubmit pipeline: the port of PSICQUICSearchFactory.createTaskIterator
// + SearchRecordsTask + ImportNetworkFromPSICQUICTask. Where the desktop
// client showed a "Select Databases" dialog between the count step and the
// import, this app has no dialog surface — source selection happens up front
// in the options popover — so a submit goes straight through: count each
// selected active service, fetch MITAB from the ones with hits, and import
// one network per source (the desktop default; "Automatic Network Merge"
// used a clustering library and is not ported).

import { getAppContext } from '../appContext'
import { buildCx2 } from '../model/cx2'
import { parseMitab } from '../model/mitab'
import { PsicquicService } from '../model/registry'
import { fetchInteractionCount, fetchMitab } from '../model/restClient'
import {
  ensureRegistry,
  finishSearch,
  getSearchTargets,
  getSnapshot,
  reportOutcome,
  startSearch,
} from '../store/searchStore'

// ImportNetworkFromPSICQUICTask.DEF_VIEW_THRESHOLD: the desktop client only
// created a view for networks under 3000 elements. Every CW network gets a
// view, so the threshold gates the (expensive) layout instead.
const LAYOUT_THRESHOLD = 3000

const timestamp = (): string => new Date().toLocaleString()

export const runPsicquicSearch = async (query: string): Promise<void> => {
  const { apis } = getAppContext()

  const services = await ensureRegistry().catch((error: unknown) => {
    throw new Error(`Could not read the PSICQUIC registry: ${String(error)}`)
  })
  const targets = getSearchTargets(services)
  if (targets.length === 0) {
    throw new Error(
      'No active PSICQUIC services selected — open the search options to pick sources.',
    )
  }

  const maxResults = getSnapshot().maxInteractionsPerSource
  startSearch(query, targets)

  // Fetch/parse per source in parallel (the desktop client used a thread
  // pool); store mutation — network creation and layout — is serialized
  // through this chain so imports land one at a time.
  let importChain: Promise<void> = Promise.resolve()
  let importedNetworks = 0

  const searchOne = async (service: PsicquicService): Promise<void> => {
    const count = await fetchInteractionCount(service.restUrl, query)
    if (count === 0) {
      reportOutcome({ serviceName: service.name, status: 'empty', count })
      return
    }

    const mitab = await fetchMitab(service.restUrl, query, maxResults)
    const parsed = parseMitab(mitab)
    if (parsed.edges.length === 0) {
      reportOutcome({ serviceName: service.name, status: 'empty', count })
      return
    }

    const cxData = buildCx2(parsed, {
      // Desktop naming: "<service name> (<timestamp>)".
      name: `${service.name} (${timestamp()})`,
      description: `PSICQUIC search for "${query}" against ${service.name}`,
    })

    importChain = importChain.then(async () => {
      const created = apis.network.createNetworkFromCx2({
        cxData,
        addToWorkspace: true,
        // Show the first imported network; later ones just join the list.
        navigate: importedNetworks === 0,
      })
      if (!created.success) {
        throw new Error(created.error.message)
      }
      importedNetworks += 1
      if (parsed.nodes.length + parsed.edges.length < LAYOUT_THRESHOLD) {
        await apis.layout.applyLayout(created.data.networkId)
      }
    })
    await importChain

    reportOutcome({
      serviceName: service.name,
      status: 'imported',
      count,
      importedEdges: parsed.edges.length,
    })
  }

  const results = await Promise.allSettled(
    targets.map(async (service) => {
      try {
        await searchOne(service)
      } catch (error) {
        reportOutcome({
          serviceName: service.name,
          status: 'error',
          message: String(error),
        })
        throw error
      }
    }),
  )
  finishSearch()

  // Rejecting is the sanctioned way to surface an error snackbar in the
  // host, so fail loudly when nothing could be imported at all.
  if (importedNetworks === 0) {
    const failures = results.filter(
      (result) => result.status === 'rejected',
    ).length
    throw new Error(
      failures > 0
        ? `PSICQUIC search failed for ${failures} of ${targets.length} source(s) and found no interactions elsewhere (query "${query}"). See the search options panel for details.`
        : `No interactions found for "${query}" in ${targets.length} PSICQUIC source(s).`,
    )
  }
}
