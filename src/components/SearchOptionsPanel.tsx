/**
 * The 'search-bar' optionsComponent, rendered by the host inside the
 * "More Options" popover. It stands in for the desktop client's
 * SourceStatusPanel ("Select Databases" dialog): pick which registry
 * sources a search hits and cap the per-source result size — but BEFORE
 * the search, since the host pipeline has no post-count dialog step. It
 * also shows the per-source outcome of the last search.
 *
 * All state lives in ../store/searchStore — the host unmounts this
 * component every time the popover closes.
 */
import { useEffect, useSyncExternalStore } from 'react'

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import type { NetworkSearchOptionsHostProps } from 'cyweb/ApiTypes'

import {
  ensureRegistry,
  getSnapshot,
  setAllSourcesExcluded,
  setMaxInteractionsPerSource,
  setSourceExcluded,
  subscribe,
  SourceSearchOutcome,
} from '../store/searchStore'

const outcomeLabel = (outcome: SourceSearchOutcome): string => {
  switch (outcome.status) {
    case 'pending':
      return 'searching…'
    case 'imported':
      return `${outcome.count} found, ${outcome.importedEdges} imported`
    case 'empty':
      return 'no interactions'
    case 'error':
      return outcome.message ?? 'failed'
  }
}

export const SearchOptionsPanel = (
  _props: NetworkSearchOptionsHostProps,
): JSX.Element => {
  const state = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    // Lazy one-shot; rejection is captured in the store's registryStatus.
    ensureRegistry().catch(() => undefined)
  }, [])

  const activeServices = state.services.filter((service) => service.active)
  const inactiveCount = state.services.length - activeServices.length
  const selectedCount = activeServices.filter(
    (service) => !state.excludedSources.has(service.name),
  ).length

  return (
    <Box sx={{ width: 420, maxWidth: '100%' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle2">
          Databases ({selectedCount}/{activeServices.length} selected)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => setAllSourcesExcluded(false)}>
            All
          </Button>
          <Button size="small" onClick={() => setAllSourcesExcluded(true)}>
            None
          </Button>
          <Button
            size="small"
            onClick={() => ensureRegistry(true).catch(() => undefined)}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {state.registryStatus === 'loading' && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', py: 1 }}
        >
          <CircularProgress size={16} />
          <Typography variant="body2">
            Loading the PSICQUIC registry…
          </Typography>
        </Stack>
      )}
      {state.registryStatus === 'error' && (
        <Typography variant="body2" color="error" sx={{ py: 1 }}>
          Could not load the PSICQUIC registry: {state.registryError}
        </Typography>
      )}

      {state.registryStatus === 'ready' && (
        <Box sx={{ maxHeight: 220, overflowY: 'auto', pr: 1 }}>
          {activeServices.map((service) => (
            <Box key={service.name} sx={{ display: 'block' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={!state.excludedSources.has(service.name)}
                    onChange={(event) =>
                      setSourceExcluded(service.name, !event.target.checked)
                    }
                  />
                }
                label={
                  <Typography variant="body2">
                    {service.name}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      {' '}
                      — {service.count.toLocaleString()} records
                    </Typography>
                  </Typography>
                }
              />
            </Box>
          ))}
          {inactiveCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {inactiveCount} inactive service(s) hidden
            </Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 1 }} />

      <Tooltip title="Cap the number of interactions fetched from each database. 0 fetches everything (the desktop client's behavior).">
        <TextField
          size="small"
          type="number"
          label="Max interactions per source (0 = unlimited)"
          fullWidth
          value={state.maxInteractionsPerSource}
          onChange={(event) =>
            setMaxInteractionsPerSource(Number(event.target.value))
          }
          inputProps={{ min: 0, step: 100 }}
        />
      </Tooltip>

      {state.lastSearch !== undefined && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2">
            Last search: “{state.lastSearch.query}”
            {state.lastSearch.running && ' (running…)'}
          </Typography>
          <Box sx={{ maxHeight: 160, overflowY: 'auto' }}>
            {state.lastSearch.outcomes.map((outcome) => (
              <Typography key={outcome.serviceName} variant="body2" noWrap>
                {outcome.serviceName}:{' '}
                <Typography
                  component="span"
                  variant="body2"
                  color={
                    outcome.status === 'error' ? 'error' : 'text.secondary'
                  }
                >
                  {outcomeLabel(outcome)}
                </Typography>
              </Typography>
            ))}
          </Box>
        </>
      )}

      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary">
        Queries run against{' '}
        <Link
          href="http://psicquic.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          PSICQUIC
        </Link>{' '}
        services as gene/protein ID searches; one network is imported per
        database with hits.
      </Typography>
    </Box>
  )
}

export default SearchOptionsPanel
