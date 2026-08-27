# psicquic-cw

A [Cytoscape Web](https://github.com/cytoscape/cytoscape-web) app that ports
the network-search feature of the Cytoscape Desktop
[`webservice-psicquic-client`](https://github.com/cytoscape/webservice-psicquic-client).

## What it does

- Registers a **PSICQUIC** provider in the host's network search bar
  (name, description, website and 32px icon).
- The **More Options** popover lists the services from the EBI PSICQUIC
  registry, lets you exclude sources from the search and cap the per-source
  result size, and shows the per-source outcome of the last search.
- On submit, the query is run as the desktop factory always ran it —
  `SearchMode.INTERACTOR` (gene/protein ID list) against every selected
  active service — in the desktop client's two phases:
  1. **Count**: `{restUrl}interactor/{query}?format=count` per service, then
     the **Select Databases** modal opens (the port of the dialog
     `PSICQUICSearchFactory.allFinished()` builds around
     `SourceStatusPanel`), listing only sources with hits. Nothing is
     imported until the user checks one or more sources; Import stays
     disabled while nothing is selected.
  2. **Import** (per selected source):
     `{restUrl}interactor/{query}?format=tab27` (falling back to the
     server-default MITAB 2.5, like the desktop client); the MITAB is
     parsed with a port of `CyNetworkBuilder` / `InteractionClusterMapper`
     (same attribute names: `Human Readable Label`, `Taxonomy ID`,
     `Detection Method`, `Confidence-Score-*`, …); **one network per
     source** is imported via `apis.network.createNetworkFromCx2`, then
     laid out via `apis.layout.applyLayout` (skipped over 3000 elements,
     mirroring the desktop `viewThreshold` for view creation). No "Import
     Finished" dialog is shown afterwards.

The Select Databases modal renders in a small app-owned React root attached
to `document.body` (see `src/dialogHost.tsx`) — the search-bar slot gives an
app no persistent surface, and the options popover unmounts whenever it
closes. "Automatic Network Merge" is not ported (its `InteractionCluster`
clustering has no Cytoscape Web equivalent).

## Prerequisites

- Node 24 (`nvm use 24`)
- A sibling checkout of `cytoscape-web` on the `feature/network-search-bar`
  branch at `../cytoscape-web` — `@cytoscape-web/api-types` is a `file:` link
  to it because the search-bar types are newer than the published beta.
  Build it once before installing here:

  ```bash
  cd ../cytoscape-web && npm run build:api-types
  ```

## Run

```bash
npm install
npm run dev
```

The dev server prints an `?installApp=` deep link into the host
(`http://localhost:5500` by default) — open it, confirm the install dialog,
and the search bar appears at the top of the Workspace tab with the PSICQUIC
provider. Try a query like `brca2`.

`npm run typecheck` type-checks the app and the build config;
`npm run verify` runs the SDK's bundle checks after `npm run build`.

## CORS proxy (dev-server only)

Neither the EBI PSICQUIC registry nor the individual service endpoints send
CORS headers (the registry is plain http — its https URL 301-redirects back
to http), so the browser cannot call them directly. All requests are routed
through this app's own Vite dev server (`/psicquic-proxy/<encoded-url>`,
see `vite.config.ts` and `src/model/corsProxy.ts`). A production deployment
of this app would need an equivalent proxy.
