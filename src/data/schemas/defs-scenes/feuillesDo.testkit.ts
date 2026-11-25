/** Toutes les feuilles `{ kind:'effet', effet }` des Flows authorés des documents. */
export function feuillesDo(documents: readonly unknown[]): unknown[] {
  const out: unknown[] = [];
  const marche = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(marche);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.kind === 'effet' && o.effet) out.push(o.effet);
    Object.values(o).forEach(marche);
  };
  documents.forEach(marche);
  return out;
}
