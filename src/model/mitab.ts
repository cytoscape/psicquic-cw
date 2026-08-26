// Port of the MITAB → network mapping in the desktop client's
// org.cytoscape.webservice.psicquic.mapper.CyNetworkBuilder (+ the
// `db:value(description)` cell grammar from InteractionClusterMapper).
// Attribute/column names are kept identical to the desktop app's so imported
// networks look familiar. Simplifications vs. the desktop client:
//   - the per-namespace alt-id/alias list columns are not created;
//   - `Human Readable Label` falls back to the node name instead of the
//     desktop's regex-based guessHumanReadableName() heuristics;
//   - only the MITAB 2.7 columns the PSIMI 2.5 visual style actually used
//     (interactor type) are mapped, not the full 2.7 extra set.

export type AttributeValue = string | number | boolean | string[]

export interface MitabNode {
  /** Identity: the prioritized unique ID (also the `name` attribute). */
  id: string
  attributes: Record<string, AttributeValue>
}

export interface MitabEdge {
  sourceId: string
  targetId: string
  attributes: Record<string, AttributeValue>
}

export interface ParsedMitab {
  nodes: MitabNode[]
  edges: MitabEdge[]
}

// CyNetworkBuilder.MINIMUM_COLUMN_COUNT
const MINIMUM_COLUMN_COUNT = 15

interface MitabField {
  namespace: string
  value: string
  description?: string
}

/**
 * Parses one `db:value(description)` entry: split on the FIRST ':' (values
 * like `psi-mi:"MI:0407"(direct interaction)` keep their inner colons),
 * take the parenthesized tail as the description, strip quotes.
 */
const parseField = (raw: string): MitabField | undefined => {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-') {
    return undefined
  }
  const colon = trimmed.indexOf(':')
  const namespace = colon === -1 ? '' : trimmed.slice(0, colon)
  let rest = colon === -1 ? trimmed : trimmed.slice(colon + 1)

  let description: string | undefined
  const open = rest.indexOf('(')
  if (open !== -1 && rest.endsWith(')')) {
    description = rest.slice(open + 1, -1).replaceAll('"', '')
    rest = rest.slice(0, open)
  }
  const value = rest.replaceAll('"', '')
  if (value === '') {
    return undefined
  }
  return { namespace: namespace.replaceAll('"', ''), value, description }
}

/** Parses one multi-value MITAB cell ('|'-separated entries). */
const parseCell = (cell: string | undefined): MitabField[] => {
  if (cell === undefined || cell === '' || cell === '-') {
    return []
  }
  return cell
    .split('|')
    .map(parseField)
    .filter((field): field is MitabField => field !== undefined)
}

// CyNetworkBuilder.getID: namespace priority and the column each one maps to.
const ID_COLUMN_BY_NAMESPACE: Record<string, string> = {
  uniprotkb: 'uniprotkb_accession',
  'entrez gene/locuslink': 'ncbi_gene_id',
  chebi: 'chebi_id',
}
const ID_NAMESPACE_PRIORITY = ['uniprotkb', 'entrez gene/locuslink', 'chebi']

const pickIdentity = (
  fields: MitabField[],
): { idColumn: string; value: string } | undefined => {
  for (const namespace of ID_NAMESPACE_PRIORITY) {
    const match = fields.find((field) => field.namespace === namespace)
    if (match !== undefined) {
      return { idColumn: ID_COLUMN_BY_NAMESPACE[namespace], value: match.value }
    }
  }
  const first = fields[0]
  if (first === undefined) {
    return undefined
  }
  return {
    idColumn: first.namespace === '' ? 'id' : `${first.namespace}_id`,
    value: first.value,
  }
}

const findGeneName = (aliasCells: MitabField[][]): string | undefined => {
  for (const fields of aliasCells) {
    const geneName = fields.find((field) => field.description === 'gene name')
    if (geneName !== undefined) {
      return geneName.value
    }
  }
  return undefined
}

const buildNode = (
  idCell: string,
  altIdCell: string | undefined,
  aliasCell: string | undefined,
  taxidCell: string | undefined,
  interactorTypeCell: string | undefined,
): MitabNode | undefined => {
  const identity = pickIdentity(parseCell(idCell))
  if (identity === undefined) {
    return undefined
  }
  const attributes: Record<string, AttributeValue> = {
    name: identity.value,
    [identity.idColumn]: identity.value,
  }

  const geneName = findGeneName([parseCell(altIdCell), parseCell(aliasCell)])
  attributes['Human Readable Label'] = geneName ?? identity.value

  const taxid = parseCell(taxidCell)[0]
  if (taxid !== undefined) {
    attributes['Taxonomy ID'] = taxid.value
    if (taxid.description !== undefined) {
      attributes['Taxonomy Name'] = taxid.description
    }
  }

  const interactorType = parseCell(interactorTypeCell)[0]
  if (interactorType !== undefined) {
    attributes['Interactor Type ID'] = interactorType.value
    if (interactorType.description !== undefined) {
      attributes['Interactor Type'] = interactorType.description
    }
  }

  return { id: identity.value, attributes }
}

const listOf = (
  fields: MitabField[],
  pick: (field: MitabField) => string | undefined,
): string[] =>
  fields
    .map(pick)
    .filter((value): value is string => value !== undefined && value !== '')

const buildEdgeAttributes = (
  columns: string[],
  sourceId: string,
  targetId: string,
): Record<string, AttributeValue> => {
  const attributes: Record<string, AttributeValue> = {}

  const detection = parseCell(columns[6])
  if (detection.length > 0) {
    attributes['Detection Method ID'] = listOf(detection, (f) => f.value)
    attributes['Detection Method'] = listOf(detection, (f) => f.description)
  }

  const authors = listOf(parseCell(columns[7]), (f) =>
    `${f.namespace === '' ? '' : `${f.namespace}:`}${f.value}`.trim(),
  )
  if (authors.length > 0) {
    attributes['Author'] = authors
  }

  const publications = parseCell(columns[8])
  if (publications.length > 0) {
    attributes['Publication DB'] = listOf(publications, (f) => f.namespace)
    attributes['Publication ID'] = listOf(publications, (f) => f.value)
  }

  const interactionTypes = parseCell(columns[11])
  const typeNames = listOf(
    interactionTypes,
    (f) => f.description ?? f.value,
  )
  if (typeNames.length > 0) {
    attributes['Interaction Type'] = typeNames
    attributes['Primary Interaction Type'] = typeNames[0]
  }

  const sourceDb = parseCell(columns[12])[0]
  if (sourceDb !== undefined) {
    attributes['Source Database'] =
      sourceDb.namespace === '' ? sourceDb.value : sourceDb.namespace
  }

  // Column 13: interaction identifier — its first value is the CyEdge
  // interaction, which also names the edge.
  const interaction = parseCell(columns[13])[0]?.value ?? '-'
  attributes['interaction'] = interaction
  attributes['name'] = `${sourceId} (${interaction}) ${targetId}`

  // Column 14: one Double column per confidence-score type; unparseable
  // values silently skipped (as in the desktop client).
  for (const score of parseCell(columns[14])) {
    const value = Number.parseFloat(score.value)
    if (!Number.isNaN(value) && score.namespace !== '') {
      attributes[`Confidence-Score-${score.namespace}`] = value
    }
  }

  return attributes
}

/**
 * Parses a full MITAB (2.5 or 2.7) document into deduplicated nodes and one
 * edge per data line.
 */
export const parseMitab = (mitab: string): ParsedMitab => {
  const nodesById = new Map<string, MitabNode>()
  const edges: MitabEdge[] = []

  for (const line of mitab.split('\n')) {
    // The desktop parser has no explicit header guard; MITAB header lines
    // start with '#' and would otherwise become a bogus interaction.
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }
    const columns = line.split('\t')
    if (columns.length < MINIMUM_COLUMN_COUNT) {
      continue
    }

    // Self-interactions: one side's ID column is '-'.
    let idA = columns[0]
    let idB = columns[1]
    if (idB.trim() === '-') {
      idB = idA
    } else if (idA.trim() === '-') {
      idA = idB
    }

    const source = buildNode(idA, columns[2], columns[4], columns[9], columns[20])
    const target = buildNode(idB, columns[3], columns[5], columns[10], columns[21])
    if (source === undefined || target === undefined) {
      continue
    }
    if (!nodesById.has(source.id)) {
      nodesById.set(source.id, source)
    }
    if (!nodesById.has(target.id)) {
      nodesById.set(target.id, target)
    }

    edges.push({
      sourceId: source.id,
      targetId: target.id,
      attributes: buildEdgeAttributes(columns, source.id, target.id),
    })
  }

  return { nodes: Array.from(nodesById.values()), edges }
}
