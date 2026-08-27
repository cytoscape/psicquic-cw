/**
 * The PSICQUIC app for Cytoscape Web — a port of the desktop
 * webservice-psicquic-client's network search feature (the
 * AbstractNetworkSearchTaskFactory registered by PSICQUICSearchFactory).
 *
 * It registers exactly one resource: a network search provider in the
 * 'search-bar' slot. Metadata (name, description, website, icon) mirrors
 * the desktop factory's constants. The desktop client's other registration
 * (PSICQUICWebServiceClient as an AbstractWebServiceGUIClient /
 * NetworkImportWebServiceClient) has no Cytoscape Web equivalent and is
 * not ported.
 *
 * Identity (id, display name, version, description) arrives from
 * `virtual:cyweb-app-meta`, which the build fills in from the `cyweb`
 * block and standard fields in package.json.
 */

import { lazy } from 'react'

import { AppContext, CyAppWithLifecycle } from 'cyweb/ApiTypes'
import { description, displayName, id, version } from 'virtual:cyweb-app-meta'

import { clearAppContext, setAppContext } from './appContext'
import { mountDialogHost, unmountDialogHost } from './dialogHost'
import { runPsicquicSearch } from './search/runPsicquicSearch'
import psicquicLogo from './assets/psicquic-logo.svg'


export const PsicquicApp: CyAppWithLifecycle = {
  id, // the Module Federation container name, from `cyweb.id` in package.json
  name: displayName,
  description,
  version,
  apiVersion: '1.0',

  resources: [
    {
      slot: 'search-bar',
      // PSICQUICSearchFactory: ID/NAME/DESCRIPTION/WEBSITE_URL/icon.
      id: 'psicquic-search',
      name: 'PSICQUIC',
      description: 'Search PSICQUIC-compliant databases.',
      website: 'http://psicquic.github.io/',
      icon: psicquicLogo,
      placeholder: 'Enter gene/protein IDs (e.g. brca2)...',
      optionsComponent: lazy(() => import('./components/SearchOptionsPanel')),
      // onSubmit reaches the App API through the module-level context set
      // in mount() — declarative resources carry no injected apis, and
      // mount() always runs before the user can submit. A rejection here is
      // surfaced by the host as an error snackbar.
      onSubmit: ({ query }) => runPsicquicSearch(query),
    },
  ],

  mount(context: AppContext): void {
    setAppContext(context)
    // The Select Databases modal needs a render surface that outlives the
    // options popover — a small app-owned React root on document.body.
    mountDialogHost()
  },

  unmount(): void {
    // Resources are auto-cleaned by the host on deactivation; the dialog
    // root and the parked context are ours to drop.
    unmountDialogHost()
    clearAppContext()
  },
}
