// The search provider is declared in PsicquicApp.resources, so its onSubmit
// is a plain module-level callback with no injected context. mount() runs
// before the user can submit a query, so it parks the AppContext here for
// the search pipeline (and the options panel) to pick up.

import type { AppContext } from 'cyweb/ApiTypes'

let context: AppContext | null = null

export const setAppContext = (next: AppContext): void => {
  context = next
}

export const clearAppContext = (): void => {
  context = null
}

export const getAppContext = (): AppContext => {
  if (context === null) {
    throw new Error('The PSICQUIC app is not mounted')
  }
  return context
}
