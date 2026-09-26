/**
 * GRAPHIE des ops de Talent (#1473, train 2a) : `{ op, talentId, spec? }` devient `{ op, talent: { id, spec? } }`
 * sur `grantTalent` et `grantCareerTalent`, à toute profondeur, la clé `talent` à la POSITION de `talentId`.
 * Une op qui porte déjà `talent` traverse intacte ; tout le reste du document aussi. Une op qui porte À LA
 * FOIS `talentId` et `talent` LÈVE : aucune des deux graphies ne se choisit à l'aveugle.
 *
 * Primitive PARTAGÉE, chargée par Node nu (aucun import) : migration de dépôt
 * `scripts/migrations/2026-09-24-1473-graphie-ops-de-talent.mjs` et `PROJECT_MIGRATIONS[14]`
 * (`src/state/worldMap.ts`).
 */
const OPS_DE_TALENT: ReadonlySet<string> = new Set(['grantTalent', 'grantCareerTalent']);

/** L'objet est-il une op de Talent à l'ANCIENNE graphie ? */
export function estOpDeTalentAncienne(node: unknown): node is { op: string; talentId: string; spec?: string } {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const n = node as { op?: unknown; talentId?: unknown };
  return typeof n.op === 'string' && OPS_DE_TALENT.has(n.op) && typeof n.talentId === 'string';
}

/** Réécrit toute op de Talent de `node` à la graphie `talent: { id, spec? }` ; rend un arbre NEUF. */
export function graphieOpsDeTalentDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(graphieOpsDeTalentDeep);
  if (!node || typeof node !== 'object') return node;
  if (estOpDeTalentAncienne(node)) {
    if ('talent' in node) throw new Error(`op « ${node.op} » : porte À LA FOIS \`talentId\` (« ${node.talentId} ») et \`talent\` — graphie ambiguë.`);
    const talent = { id: node.talentId, ...(node.spec !== undefined ? { spec: node.spec } : {}) };
    return Object.fromEntries(
      Object.entries(node).flatMap(([k, v]) => (k === 'talentId' ? [['talent', talent]] : k === 'spec' ? [] : [[k, graphieOpsDeTalentDeep(v)]])),
    );
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, graphieOpsDeTalentDeep(v)]));
}
