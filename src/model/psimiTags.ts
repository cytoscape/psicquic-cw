// Human-readable names for the PSI-MI accessions the registry uses as
// service tags — the desktop client resolves these through its bundled
// psimi_terms.txt (~50 KB, thousands of MOD/MI terms); the registry only
// ever uses this handful, so just those are embedded. Unknown accessions
// fall back to the raw accession string.
const PSIMI_TAG_NAMES: Record<string, string> = {
  'MI:0959': 'imex curation',
  'MI:0960': 'mimix curation',
  'MI:0961': 'rapid curation',
  'MI:1047': 'protein-protein',
  'MI:1048': 'smallmolecule-protein',
  'MI:1049': 'nucleicacid-protein',
  'MI:1051': 'evidence',
  'MI:1052': 'clustered',
  'MI:1054': 'experimentally-observed',
  'MI:1055': 'internally-curated',
  'MI:1056': 'text-mining',
  'MI:1057': 'predicted',
  'MI:1058': 'imported',
  'MI:1060': 'spoke expansion',
  'MI:1062': 'bipartite expansion',
}

export const tagDisplayNames = (tags: string[]): string[] =>
  tags.map((tag) => PSIMI_TAG_NAMES[tag] ?? tag)
