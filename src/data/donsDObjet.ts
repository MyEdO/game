/**
 * DONS D'OBJET en FK (#1988 B4a) : à toute profondeur d'un document, un Effet ou une op `giveTrapping` et
 * une Condition `hasItem` ne désignent plus un objet que par son id.
 *  - `giveTrapping.qualities` : une chaîne devient `{ id }` (`qualityRefSchema`), résolue par `qualite`
 *    (id, ou libellé d'authoring) ; une qualité que rien ne résout LÈVE.
 *  - `giveTrapping.custom` : le libellé libre devient `trappingId`, À SA POSITION, résolu par `objets` ;
 *    aucun objet, ou plusieurs homonymes, LÈVE. `custom` ET `trappingId` à la fois LÈVE.
 *  - `hasItem.trappingId` : une valeur que `objetConnu` ne résout pas était le LIBELLÉ d'un objet libre ;
 *    elle se résout par `objets`, ou LÈVE.
 * Le reste du document traverse intact ; un document déjà à la forme d'après ressort à l'identique.
 *
 * Primitive PARTAGÉE, chargée par Node nu (aucun import) : les résolveurs sont INJECTÉS —
 * `PROJECT_MIGRATIONS[17]` (`src/data/migrationsDeProjet.ts`) lui passe la couture label→id de
 * `src/data/index.ts`, la migration de dépôt `scripts/migrations/2026-10-05-1988-projet-dons-d-objet-en-fk.mjs`
 * les ids des catalogues qu'elle lit.
 */

/** Ce que la primitive demande au monde : les résolutions d'une qualité et d'un objet. */
export interface ResolveursDeDon {
  /** Id de la qualité que nomme `brut` (id ou libellé), `undefined` si aucune. */
  readonly qualite: (brut: string) => string | undefined;
  /** Ids des objets que nomme un libellé (vide : aucun ; plusieurs : des homonymes). */
  readonly objets: (libelle: string) => readonly string[];
  /** L'id est-il celui d'un objet (du projet ou du catalogue) ? */
  readonly objetConnu: (id: string) => boolean;
}

const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** L'id unique que nomme le libellé `libelle`, ou la levée qui dit pourquoi il n'y en a pas. */
function idDuLibelle(libelle: string, r: ResolveursDeDon, site: string): string {
  const ids = r.objets(libelle);
  if (ids.length === 1) return ids[0];
  throw new Error(ids.length
    ? `${site} : « ${libelle} » nomme plusieurs objets (${ids.join(', ')}) — désigner l'objet par son id.`
    : `${site} : « ${libelle} » ne nomme aucun objet du projet (narratif.objets) ni du catalogue des objets — créer l'objet au projet, puis le désigner par son id.`);
}

/** Le nœud `giveTrapping` à la forme d'après. */
function donEnFK(don: Record<string, unknown>, r: ResolveursDeDon): Record<string, unknown> {
  if ('custom' in don && 'trappingId' in don)
    throw new Error(`giveTrapping : porte À LA FOIS \`custom\` (« ${String(don.custom)} ») et \`trappingId\` (« ${String(don.trappingId)} ») — aucun des deux ne se choisit à l'aveugle.`);
  return Object.fromEntries(Object.entries(don).map(([k, v]) => {
    if (k === 'custom') return ['trappingId', idDuLibelle(String(v), r, 'giveTrapping.custom')];
    if (k === 'qualities' && Array.isArray(v))
      return [k, v.map((q) => {
        if (typeof q !== 'string') return q;
        const id = r.qualite(q);
        if (id === undefined) throw new Error(`giveTrapping.qualities : « ${q} » n'est aucune qualité du catalogue des qualités (qualities.json).`);
        return { id };
      })];
    return [k, v];
  }));
}

/** Réécrit tout don d'objet et toute Condition `hasItem` de `node` à la forme d'après ; rend un arbre NEUF. */
export function donsDObjetEnFKDeep(node: unknown, r: ResolveursDeDon): unknown {
  if (Array.isArray(node)) return node.map((x) => donsDObjetEnFKDeep(x, r));
  if (!estObjet(node)) return node;
  const descendu = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, donsDObjetEnFKDeep(v, r)]));
  if (descendu.type === 'giveTrapping' || descendu.op === 'giveTrapping') return donEnFK(descendu, r);
  if (descendu.kind === 'hasItem' && typeof descendu.trappingId === 'string' && !r.objetConnu(descendu.trappingId))
    return { ...descendu, trappingId: idDuLibelle(descendu.trappingId, r, 'hasItem.trappingId') };
  return descendu;
}
