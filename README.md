# psicquic-cw

A [Cytoscape Web](https://github.com/cytoscape/cytoscape-web) app that ports
the network-search feature of the Cytoscape Desktop
[`webservice-psicquic-client`](https://github.com/cytoscape/webservice-psicquic-client).

## What it does

- Registers a **PSICQUIC** provider in the host's network search bar
  (name, description, website and 32px icon).
- The **More Options** popover replaces the desktop client's
  "Select Databases" dialog (`SourceStatusPanel`): it lists the services from
  the EBI PSICQUIC registry, lets you exclude sources and cap the per-source
  result size, and shows the per-source outcome of the last search. Because
  the host pipeline has no post-count dialog step, source selection happens
  *before* the search instead of after it.
- On submit, the query is run as the desktop factory always ran it —
  `SearchMode.INTERACTOR` (gene/protein ID list) against every selected
  active service:
  1. `{restUrl}interactor/{query}?format=count` per service;
  2. for services with hits, `{restUrl}interactor/{query}?format=tab27`
     (falling back to the server-default MITAB 2.5, like the desktop client);
  3. the MITAB is parsed with a port of `CyNetworkBuilder` /
     `InteractionClusterMapper` (same attribute names: `Human Readable
     Label`, `Taxonomy ID`, `Detection Method`, `Confidence-Score-*`, …);
  4. **one network per source** is imported via
     `apis.network.createNetworkFromCx2`, then laid out via
     `apis.layout.applyLayout` (skipped over 3000 elements, mirroring the
     desktop `viewThreshold` for view creation).

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
