/**
 * The "Select Databases" modal.
 * Opens after the count phase; the user picks which
 * sources to import (nothing is imported automatically). Differences from
 * the desktop version: sources with zero records are not listed, there is
 * no Status column (only searched — hence active — sources can appear),
 * and "Automatic Network Merge" is not ported.
 *
 * Rendered in the app's own React root (see ../dialogHost.tsx), since the
 * search-bar slot gives the app no persistent mount point. Open/closed
 * state is the store's `pendingImport`.
 */
import { useSyncExternalStore } from 'react'

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  // The root specifier, NOT '@mui/material/TableCell': subpath imports
  // bypass the Module Federation share of '@mui/material' and bundle a
  // second copy, which fails the SDK's no-shared-payload build gate.
  tableCellClasses,
  TableRow,
  Typography,
} from '@mui/material'

import { tagDisplayNames } from '../model/psimiTags'
import { importSelectedSources } from '../search/runPsicquicSearch'
import {
  getSnapshot,
  setAllImportSelected,
  subscribe,
  takePendingImport,
  toggleImportSelection,
} from '../store/searchStore'

export const SelectDatabasesDialog = (): JSX.Element | null => {
  const { pendingImport } = useSyncExternalStore(subscribe, getSnapshot)
  if (pendingImport === undefined) {
    return null
  }
  const { candidates, selected } = pendingImport

  return (
    <Dialog
      open
      maxWidth="md"
      fullWidth
      // Escape cancels (same as the Cancel button); backdrop clicks stay
      // inert so a stray click doesn't discard the search results.
      onClose={(_event, reason) => {
        if (reason === 'escapeKeyDown') {
          takePendingImport()
        }
      }}
      data-testid="psicquic-select-databases-dialog"
    >
      <DialogTitle>Select Databases</DialogTitle>
      <DialogContent>
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table
            size="small"
            stickyHeader
            sx={{
              [`& .${tableCellClasses.root}`]: {
                border: 'none',
              },
            }}
          >
            {/* Token string, not theme.palette.background.default: with a
                CSS-variables theme the palette object holds the light-scheme
                literals, while token strings resolve through theme.vars and
                so follow the host's dark-mode toggle. */}
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.default' }}>
                <TableCell padding="checkbox" sx={{ backgroundColor: 'inherit' }}>
                  Import
                </TableCell>
                <TableCell sx={{ backgroundColor: 'inherit' }}>
                  Database Name
                </TableCell>
                <TableCell align="right" sx={{ backgroundColor: 'inherit' }}>
                  Records Found
                </TableCell>
                <TableCell sx={{ backgroundColor: 'inherit' }}>
                  Database Type (Tags)
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                [`& .${tableCellClasses.root}`]: {
                  borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                },
              }}
            >
              {candidates.map(({ service, count }) => (
                <TableRow
                  key={service.name}
                  hover
                  onClick={() => toggleImportSelection(service.name)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(service.name)}
                      inputProps={{ 'aria-label': `Import ${service.name}` }}
                    />
                  </TableCell>
                  <TableCell>{service.name}</TableCell>
                  <TableCell align="right">{count.toLocaleString()}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" fontSize="small">
                      {tagDisplayNames(service.tags).join(', ')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
          <Button size="small" onClick={() => setAllImportSelected(true)}>
            Select All
          </Button>
          <Button size="small" onClick={() => setAllImportSelected(false)}>
            Select None
          </Button>
        </Stack>
        <Button variant="outlined" onClick={() => takePendingImport()}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={selected.size === 0}
          onClick={() => {
            void importSelectedSources()
          }}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  )
}
