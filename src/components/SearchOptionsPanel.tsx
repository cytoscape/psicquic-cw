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
} from '../store/searchStore'


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
          direction="column"
          spacing={1}
          sx={{ alignItems: 'center', pt: 5, pb: 7, justifyContent: 'center' }}
        >
          <CircularProgress size={32} />
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
      <>
        <Box
          sx={{
            maxHeight: 220,
            overflowY: 'auto',
            px: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
          }}
        >
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
                    sx={{ py: 0 }} 
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
        </Box>
        {inactiveCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', display: 'block' }}>
            {inactiveCount} inactive service(s) hidden
          </Typography>
        )}
        </>
      )}

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
          sx={{ my: 2}}
        />
      </Tooltip>

      <Typography variant="caption" color="text.secondary">
        Queries run against{' '}
        <Link
          href="http://psicquic.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          PSICQUIC
        </Link>{' '}
        services as gene/protein ID searches.
      </Typography>
    </Box>
  )
}

export default SearchOptionsPanel
