/**
 * A standalone React root for the Select Databases dialog. The app's only
 * host-rendered surface is the search-bar options popover, which unmounts
 * whenever it closes — a modal that opens on search completion needs a
 * mount point of its own, so mount() attaches one to document.body.
 *
 * Uses the legacy ReactDOM.render on purpose: the Module Federation share
 * map covers the 'react-dom' ROOT specifier only, so importing
 * 'react-dom/client' for createRoot would bundle a second copy of
 * react-dom and fail the SDK's no-shared-payload gate. React 18 logs a
 * one-time deprecation warning for this; the legacy-mode semantics are
 * fine for a single dialog.
 */
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material'
import ReactDOM from 'react-dom'

import { SelectDatabasesDialog } from './components/SelectDatabasesDialog'
import { psicquicTheme } from './theme'

let container: HTMLDivElement | null = null

export const mountDialogHost = (): void => {
  if (container !== null) {
    return
  }
  container = document.createElement('div')
  container.dataset.app = 'psicquic'
  document.body.appendChild(container)
  // This root sits outside the host's CssVarsProvider (context does not
  // cross React roots), so it brings its own copy of the host theme —
  // see theme.ts for why the copy tracks the host's dark mode for free.
  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(
    <CssVarsProvider theme={psicquicTheme} defaultMode="system">
      <SelectDatabasesDialog />
    </CssVarsProvider>,
    container,
  )
}

export const unmountDialogHost = (): void => {
  if (container === null) {
    return
  }
  // eslint-disable-next-line react/no-deprecated
  ReactDOM.unmountComponentAtNode(container)
  container.remove()
  container = null
}
