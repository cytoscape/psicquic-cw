// Builds a CX2 document (the shape NetworkApi.createNetworkFromCx2 validates
// with the host's validateCX2) from a parsed MITAB result set. Attribute
// declarations are inferred from the values the parser produced — each
// mapped column has a single, stable type (see mitab.ts).

import type { Cx2 } from 'cyweb/ApiTypes'

import type { AttributeValue, ParsedMitab } from './mitab'

const cx2TypeOf = (value: AttributeValue): string => {
  if (Array.isArray(value)) {
    return 'list_of_string'
  }
  switch (typeof value) {
    case 'number':
      return 'double'
    case 'boolean':
      return 'boolean'
    default:
      return 'string'
  }
}

const collectDeclarations = (
  elements: Array<{ attributes: Record<string, AttributeValue> }>,
): Record<string, { d: string }> => {
  const declarations: Record<string, { d: string }> = {}
  for (const element of elements) {
    for (const [name, value] of Object.entries(element.attributes)) {
      if (declarations[name] === undefined) {
        declarations[name] = { d: cx2TypeOf(value) }
      }
    }
  }
  return declarations
}

export interface BuildCx2Options {
  name: string
  description: string
}

export const buildCx2 = (
  parsed: ParsedMitab,
  { name, description }: BuildCx2Options,
): Cx2 => {
  const nodeIdByKey = new Map<string, number>()
  const nodes = parsed.nodes.map((node, index) => {
    nodeIdByKey.set(node.id, index)
    return { id: index, v: node.attributes }
  })

  const edges = parsed.edges.map((edge, index) => ({
    id: index,
    s: nodeIdByKey.get(edge.sourceId) as number,
    t: nodeIdByKey.get(edge.targetId) as number,
    v: edge.attributes,
  }))

  const attributeDeclarations = {
    network: {
      name: { d: 'string' },
      description: { d: 'string' },
      'created by': { d: 'string' },
    },
    nodes: collectDeclarations(parsed.nodes),
    edges: collectDeclarations(parsed.edges),
  }

  const aspects: Array<Record<string, object[]>> = [
    { attributeDeclarations: [attributeDeclarations] },
    {
      networkAttributes: [
        // 'created by' matches the desktop client's network-table stamp.
        { name, description, 'created by': 'PSICQUIC Web Service' },
      ],
    },
    { nodes },
    { edges },
  ]

  return [
    { CXVersion: '2.0', hasFragments: false },
    {
      metaData: aspects.map((aspect) => {
        const [aspectName, elements] = Object.entries(aspect)[0]
        return { name: aspectName, elementCount: elements.length }
      }),
    },
    ...aspects,
    { status: [{ error: '', success: true }] },
  ]
}
