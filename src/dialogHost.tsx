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
import ReactDOM from 'react-dom'

import { SelectDatabasesDialog } from './components/SelectDatabasesDialog'

let container: HTMLDivElement | null = null

export const mountDialogHost = (): void => {
  if (container !== null) {
    return
  }
  container = document.createElement('div')
  container.dataset.app = 'psicquic'
  document.body.appendChild(container)
  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(<SelectDatabasesDialog />, container)
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
