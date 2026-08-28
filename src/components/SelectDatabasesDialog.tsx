/**
 * The "Select Databases" modal.
 * Opens after the count phase; the user picks which
 * sources to import (nothing is imported automatically). Differences from
 * the desktop version: sources with zero records are not listed, there is
 * no Status column (only searched — hence active — sources can appear),
 * and "Automatic Network Merge" is not ported.
 *
 * Registered in the host's 'modal-launcher' slot (see PsicquicApp.tsx):
 * the host owns the Dialog shell — sizing, backdrop/Escape inertness, and
 * a structural Close "X" wired to the same path as `requestClose` — and
 * this component renders only the dialog contents. The payload lives in
 * the store's `pendingImport`, set by the search pipeline just before it
 * calls openModal('select-databases').
 */
import { useEffect, useSyncExternalStore } from 'react'

import {
  Button,
  Checkbox,
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
import { ModalHostProps } from 'cyweb/ApiTypes'

import { tagDisplayNames } from '../model/psimiTags'
import { importSelectedSources } from '../search/runPsicquicSearch'
import {
  getSnapshot,
  setAllImportSelected,
  subscribe,
  takePendingImport,
  toggleImportSelection,
} from '../store/searchStore'

export const SelectDatabasesDialog = ({
  requestClose,
}: ModalHostProps): JSX.Element | null => {
  const { pendingImport } = useSyncExternalStore(subscribe, getSnapshot)

  // The host's Close "X" (and app deactivation) unmounts this component
  // without running any button handler — discard the pending payload then,
  // or the next search would show this one's rows. On the Cancel and
  // Import paths the payload is already taken, so this is a no-op.
  useEffect(() => () => {
    takePendingImport()
  }, [])

  if (pendingImport === undefined) {
    return null
  }
  const { candidates, selected } = pendingImport

  return (
    <div data-testid="psicquic-select-databases-dialog">
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
        <Button
          variant="outlined"
          onClick={() => {
            takePendingImport()
            requestClose()
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={selected.size === 0}
          onClick={() => {
            // importSelectedSources takes the pending payload synchronously
            // (before its first await), so it must run before requestClose
            // unmounts this component — the unmount cleanup then finds
            // nothing left to discard.
            void importSelectedSources()
            requestClose()
          }}
        >
          Import
        </Button>
      </DialogActions>
    </div>
  )
}
