// Module-level state for the search provider, shared between onSubmit and
// the "More Options" popover. It cannot live inside the popover component:
// the host unmounts the popover on every close, so React state there would
// reset each time (same pattern as the host's E2E fixture app). The popover
// mirrors this store via useSyncExternalStore.
//
// This replaces two pieces of the desktop client: the registry/source
// bookkeeping of RegistryManager and the source table of SourceStatusPanel
// (whose "Select Databases" dialog has no host-side equivalent — source
// selection happens here, before the search, instead of after the count
// step).

import { fetchRegistry, PsicquicService } from '../model/registry'

export interface SourceSearchOutcome {
  serviceName: string
  /**
   * 'pending' → count query in flight; 'found' → has hits, awaiting the
   * user's Select Databases decision; 'importing'/'imported' → chosen in
   * the dialog; 'empty' → zero hits; 'error' → count or import failed.
   */
  status: 'pending' | 'found' | 'importing' | 'imported' | 'empty' | 'error'
  /** Interactions the service reported for the query (format=count). */
  count?: number
  /** Edges actually imported (may be lower when capped). */
  importedEdges?: number
  message?: string
}

/** One row of the "Select Databases" dialog: a source with hits. */
export interface ImportCandidate {
  service: PsicquicService
  count: number
}

export interface SearchState {
  registryStatus: 'idle' | 'loading' | 'ready' | 'error'
  registryError?: string
  services: PsicquicService[]
  /** Service names the user unchecked; everything active is in by default. */
  excludedSources: ReadonlySet<string>
  /** Cap per source; 0 = unlimited (the desktop client's behavior). */
  maxInteractionsPerSource: number
  lastSearch?: {
    query: string
    running: boolean
    outcomes: SourceSearchOutcome[]
  }
  /**
   * Set between the count phase and the user's import decision; non-undefined
   * means the "Select Databases" dialog is open. Mirrors the desktop client's
   * modal in PSICQUICSearchFactory.allFinished(), except sources with zero
   * records are not listed. Nothing is selected initially — the user must
   * pick sources, and Import stays disabled until they do.
   */
  pendingImport?: {
    query: string
    candidates: ImportCandidate[]
    /** Selected service names. */
    selected: ReadonlySet<string>
  }
}

let state: SearchState = {
  registryStatus: 'idle',
  services: [],
  excludedSources: new Set(),
  maxInteractionsPerSource: 2500,
}

const listeners = new Set<() => void>()

const setState = (partial: Partial<SearchState>): void => {
  state = { ...state, ...partial }
  listeners.forEach((listener) => listener())
}

// ── useSyncExternalStore contract ───────────────────────────────

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getSnapshot = (): SearchState => state

// ── Registry ────────────────────────────────────────────────────

let registryPromise: Promise<PsicquicService[]> | null = null

/**
 * Fetches the PSICQUIC registry once and caches it (the desktop
 * RegistryManager is also lazy one-shot with an explicit refresh).
 */
export const ensureRegistry = (force = false): Promise<PsicquicService[]> => {
  if (!force && registryPromise !== null) {
    return registryPromise
  }
  setState({ registryStatus: 'loading', registryError: undefined })
  registryPromise = fetchRegistry()
    .then((services) => {
      setState({ registryStatus: 'ready', services })
      return services
    })
    .catch((error: unknown) => {
      registryPromise = null
      setState({ registryStatus: 'error', registryError: String(error) })
      throw error
    })
  return registryPromise
}

// ── Source selection / options ──────────────────────────────────

export const setSourceExcluded = (name: string, excluded: boolean): void => {
  const next = new Set(state.excludedSources)
  if (excluded) {
    next.add(name)
  } else {
    next.delete(name)
  }
  setState({ excludedSources: next })
}

export const setAllSourcesExcluded = (excluded: boolean): void => {
  setState({
    excludedSources: excluded
      ? new Set(state.services.map((service) => service.name))
      : new Set(),
  })
}

export const setMaxInteractionsPerSource = (value: number): void => {
  setState({
    maxInteractionsPerSource:
      Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0,
  })
}

/** The services a search will hit: active and not excluded by the user. */
export const getSearchTargets = (
  services: PsicquicService[],
): PsicquicService[] =>
  services.filter(
    (service) => service.active && !state.excludedSources.has(service.name),
  )

// ── Search progress (rendered by the options popover) ───────────

export const startSearch = (query: string, targets: PsicquicService[]): void =>
  setState({
    lastSearch: {
      query,
      running: true,
      outcomes: targets.map((service) => ({
        serviceName: service.name,
        status: 'pending',
      })),
    },
  })

export const reportOutcome = (outcome: SourceSearchOutcome): void => {
  const lastSearch = state.lastSearch
  if (lastSearch === undefined) {
    return
  }
  setState({
    lastSearch: {
      ...lastSearch,
      outcomes: lastSearch.outcomes.map((existing) =>
        existing.serviceName === outcome.serviceName ? outcome : existing,
      ),
    },
  })
}

export const finishSearch = (): void => {
  const lastSearch = state.lastSearch
  if (lastSearch === undefined) {
    return
  }
  setState({ lastSearch: { ...lastSearch, running: false } })
}

// ── Select Databases dialog ─────────────────────────────────────

export const openImportDialog = (
  query: string,
  candidates: ImportCandidate[],
): void =>
  setState({
    pendingImport: {
      query,
      // The desktop dialog sorts by hit count (SourceStatusPanel.sort()).
      candidates: [...candidates].sort((a, b) => b.count - a.count),
      selected: new Set(),
    },
  })

export const toggleImportSelection = (serviceName: string): void => {
  const pending = state.pendingImport
  if (pending === undefined) {
    return
  }
  const selected = new Set(pending.selected)
  if (selected.has(serviceName)) {
    selected.delete(serviceName)
  } else {
    selected.add(serviceName)
  }
  setState({ pendingImport: { ...pending, selected } })
}

export const setAllImportSelected = (selectAll: boolean): void => {
  const pending = state.pendingImport
  if (pending === undefined) {
    return
  }
  setState({
    pendingImport: {
      ...pending,
      selected: selectAll
        ? new Set(pending.candidates.map((c) => c.service.name))
        : new Set(),
    },
  })
}

/** Closes the dialog and returns what was pending (Cancel and Import both
 * close it immediately, as the desktop dialog disposes before importing). */
export const takePendingImport = (): SearchState['pendingImport'] => {
  const pending = state.pendingImport
  setState({ pendingImport: undefined })
  return pending
}
