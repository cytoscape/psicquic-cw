/**
 * The PSICQUIC app for Cytoscape Web — a port of the desktop
 * webservice-psicquic-client's network search feature (the
 * AbstractNetworkSearchTaskFactory registered by PSICQUICSearchFactory).
 *
 * It registers two resources: a network search provider in the
 * 'search-bar' slot, and the "Select Databases" modal in the
 * 'modal-launcher' slot — opened imperatively from the search pipeline
 * once the count phase finishes, and rendered by the host inside its own
 * React tree (host theme, dialog shell, error isolation). Metadata (name,
 * description, website, icon) mirrors the desktop factory's constants.
 * The desktop client's other registration (PSICQUICWebServiceClient as an
 * AbstractWebServiceGUIClient / NetworkImportWebServiceClient) has no
 * Cytoscape Web equivalent and is not ported.
 *
 * Identity (id, display name, version, description) arrives from
 * `virtual:cyweb-app-meta`, which the build fills in from the `cyweb`
 * block and standard fields in package.json.
 */

import { lazy } from 'react'

import { AppContext, CyAppWithLifecycle } from 'cyweb/ApiTypes'
import { description, displayName, id, version } from 'virtual:cyweb-app-meta'

import { clearAppContext, setAppContext } from './appContext'
import { runPsicquicSearch } from './search/runPsicquicSearch'
import { PSICQUIC_LOGO_DATA_URI } from './assets/psicquicLogo'


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
      icon: PSICQUIC_LOGO_DATA_URI,
      placeholder: 'Enter gene/protein IDs (e.g. brca2)',
      optionsComponent: lazy(() => import('./components/SearchOptionsPanel')),
      // onSubmit reaches the App API through the module-level context set
      // in mount() — declarative resources carry no injected apis, and
      // mount() always runs before the user can submit. A rejection here is
      // surfaced by the host as an error snackbar.
      onSubmit: ({ query }) => runPsicquicSearch(query),
    },
    {
      slot: 'modal-launcher',
      id: 'select-databases',
      maxWidth: 'md',
      fullWidth: true,
      // The host renders this inside its own dialog shell when the search
      // pipeline calls openModal('select-databases') after the count phase.
      component: lazy(() =>
        import('./components/SelectDatabasesDialog').then((m) => ({
          default: m.SelectDatabasesDialog,
        })),
      ),
    },
  ],

  mount(context: AppContext): void {
    setAppContext(context)
  },

  unmount(): void {
    // Resources are auto-cleaned by the host on deactivation (open modals
    // included); the parked context is ours to drop.
    clearAppContext()
  },
}
