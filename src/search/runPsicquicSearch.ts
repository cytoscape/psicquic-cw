// The two-phase search, mirroring the desktop client's
// PSICQUICSearchFactory: onSubmit runs only the COUNT phase
// (SearchRecordsTask) and then opens the "Select Databases" dialog
// (allFinished() → SourceStatusPanel); nothing is imported until the user
// picks sources there and clicks Import (SourceStatusPanel.doImport() →
// ImportNetworkFromPSICQUICTask, one network per source). Differences from
// the desktop dialog: sources with zero records are not listed, and
// "Automatic Network Merge" is not ported (its InteractionCluster
// clustering has no Cytoscape Web equivalent).

import { getAppContext } from '../appContext'
import { buildCx2 } from '../model/cx2'
import { parseMitab } from '../model/mitab'
import { fetchInteractionCount, fetchMitab } from '../model/restClient'
import {
  ensureRegistry,
  finishSearch,
  getSearchTargets,
  getSnapshot,
  ImportCandidate,
  openImportDialog,
  reportOutcome,
  startSearch,
  takePendingImport,
} from '../store/searchStore'

// ImportNetworkFromPSICQUICTask.DEF_VIEW_THRESHOLD: the desktop client only
// created a view for networks under 3000 elements. Every CW network gets a
// view, so the threshold gates the (expensive) layout instead.
const LAYOUT_THRESHOLD = 3000

const timestamp = (): string => new Date().toLocaleString()

/**
 * Phase 1 — the onSubmit handler: count hits per selected active service
 * and open the Select Databases dialog. Resolves once the dialog is up
 * (or rejects, which the host surfaces as an error snackbar).
 */
export const runPsicquicSearch = async (query: string): Promise<void> => {
  const services = await ensureRegistry().catch((error: unknown) => {
    throw new Error(`Could not read the PSICQUIC registry: ${String(error)}`)
  })
  const targets = getSearchTargets(services)
  if (targets.length === 0) {
    throw new Error(
      'No active PSICQUIC services selected — open the search options to pick sources.',
    )
  }

  startSearch(query, targets)
  const candidates: ImportCandidate[] = []
  let failures = 0

  await Promise.all(
    targets.map(async (service) => {
      try {
        const count = await fetchInteractionCount(service.restUrl, query)
        if (count > 0) {
          candidates.push({ service, count })
          reportOutcome({ serviceName: service.name, status: 'found', count })
        } else {
          reportOutcome({ serviceName: service.name, status: 'empty', count })
        }
      } catch (error) {
        failures += 1
        reportOutcome({
          serviceName: service.name,
          status: 'error',
          message: String(error),
        })
      }
    }),
  )
  finishSearch()

  if (candidates.length === 0) {
    throw new Error(
      failures > 0
        ? `PSICQUIC search failed for ${failures} of ${targets.length} source(s) and found no interactions elsewhere (query "${query}"). See the search options panel for details.`
        : `No interactions found for "${query}" in ${targets.length} PSICQUIC source(s).`,
    )
  }
  // Payload first, then open: the dialog content reads pendingImport from
  // the store the moment the host mounts it.
  openImportDialog(query, candidates)
  const opened =
    getAppContext().apis.resource.openModal('select-databases')
  if (!opened.success) {
    // The registration is declarative and processed before mount(), so
    // this should be unreachable; surface it to the host's snackbar
    // rather than silently dropping the results.
    takePendingImport()
    throw new Error(
      `Could not open the Select Databases dialog: ${opened.error.message}`,
    )
  }
}

/**
 * Phase 2 — the dialog's Import button: close the dialog and import one
 * network per selected source. Runs detached from the host's submit
 * pipeline (the dialog closes immediately, like the desktop's), so
 * failures land in the options panel's outcome list and the console
 * rather than a snackbar. No "Import Finished" dialog is shown.
 */
export const importSelectedSources = async (): Promise<void> => {
  const pending = takePendingImport()
  if (pending === undefined) {
    return
  }
  const { apis } = getAppContext()
  const { query, candidates, selected } = pending
  const chosen = candidates.filter((c) => selected.has(c.service.name))
  const maxResults = getSnapshot().maxInteractionsPerSource
  let importedNetworks = 0

  // Fetch/parse per source in parallel (the desktop client used a thread
  // pool); store mutation — network creation and layout — is serialized
  // through this chain so imports land one at a time.
  let importChain: Promise<void> = Promise.resolve()

  await Promise.all(
    chosen.map(async ({ service, count }) => {
      reportOutcome({ serviceName: service.name, status: 'importing', count })
      try {
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
      } catch (error) {
        console.error(
          `[psicquic] import from ${service.name} failed:`,
          error,
        )
        reportOutcome({
          serviceName: service.name,
          status: 'error',
          count,
          message: String(error),
        })
      }
    }),
  )
}
