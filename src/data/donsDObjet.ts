/**
 * OBJETS en FK (#1988 B4a) : à toute profondeur d'un document, un objet n'est plus désigné que par son id.
 *  - `giveTrapping.qualities` : une chaîne devient `{ id }` (`qualityRefSchema`), résolue par `qualite`
 *    (id, ou libellé d'authoring) ; une qualité que rien ne résout LÈVE.
 *  - `giveTrapping.custom` : le libellé libre devient `trappingId`, À SA POSITION, résolu par `objets` ;
 *    aucun objet, ou plusieurs homonymes, LÈVE. `custom` ET `trappingId` à la fois LÈVE.
 *  - `hasItem.trappingId` : une valeur que `objetConnu` ne résout pas était le LIBELLÉ d'un objet libre ;
 *    elle se résout par `objets`, ou LÈVE.
 *  - `grantWeapon.label` meurt : le libellé de l'arme invoquée se dérive de sa source (`itemLabel`).
 *  - une INSTANCE d'objet (`ItemInstance`, reconnue à ses champs requis `uid`, `kind`, `enc`, `equipped`,
 *    `qualities`) perd `label` et garde sa DÉSIGNATION (`DesignationDObjet`) : `trappingId`, ou
 *    `{ conjured: true, source }`. Sans l'une ni l'autre, son `label` se résout par `objets` en `trappingId` ;
 *    une pièce récoltée d'avant #1988 (`price` sans `trappingId`), une arme invoquée sans `source` et une
 *    instance que rien ne désigne LÈVENT.
 * Le reste du document traverse intact ; un document déjà à la forme d'après ressort à l'identique.
 *
 * Primitive PARTAGÉE, chargée par Node nu (aucun import) : les résolveurs sont INJECTÉS —
 * `PROJECT_MIGRATIONS[17]` (`src/data/migrationsDeProjet.ts`) et la montée du roster (`src/state/roster.ts`)
 * lui passent la couture label→id de `src/data/index.ts`, la migration de dépôt
 * `scripts/migrations/2026-10-05-1988-projet-dons-d-objet-en-fk.mjs` les ids des catalogues qu'elle lit.
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

/** Une instance d'objet persistée, reconnue à ses champs REQUIS (`ItemInstanceCommun`, `src/engine/types.ts`). */
const estUneInstance = (o: Record<string, unknown>): boolean =>
  typeof o.uid === 'string' && typeof o.kind === 'string' && typeof o.enc === 'number' && typeof o.equipped === 'boolean' && Array.isArray(o.qualities);

/** L'instance à la forme d'après : sa désignation, sans `label`. */
function instanceDesignee(it: Record<string, unknown>, r: ResolveursDeDon): Record<string, unknown> {
  const { label, ...sansLibelle } = it;
  const site = `instance « ${String(it.uid)} »${typeof label === 'string' ? ` (« ${label} »)` : ''}`;
  if (typeof it.trappingId === 'string') return sansLibelle;
  if (it.conjured === true) {
    if (estObjet(it.source)) return sansLibelle;
    throw new Error(`${site} : arme invoquée sans \`source\` — elle n'est désignée que par l'Effet qui l'a produite.`);
  }
  if (it.price !== undefined)
    throw new Error(`${site} : porte \`price\` sans \`trappingId\` — pièce récoltée d'avant #1988, que rien ne désigne ; la recréer par \`pieceDeCreature\`.`);
  if (typeof label !== 'string')
    throw new Error(`${site} : sans désignation — ni \`trappingId\` (catalogue), ni \`{ conjured: true, source }\` (Effet producteur), ni \`label\` à résoudre.`);
  return { ...sansLibelle, trappingId: idDuLibelle(label, r, site) };
}

/** Réécrit tout don d'objet, toute Condition `hasItem`, toute op `grantWeapon` et toute instance d'objet de
 *  `node` à la forme d'après ; rend un arbre NEUF. */
export function objetsEnFKDeep(node: unknown, r: ResolveursDeDon): unknown {
  if (Array.isArray(node)) return node.map((x) => objetsEnFKDeep(x, r));
  if (!estObjet(node)) return node;
  const descendu = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, objetsEnFKDeep(v, r)]));
  if (descendu.type === 'giveTrapping' || descendu.op === 'giveTrapping') return donEnFK(descendu, r);
  if (descendu.op === 'grantWeapon') {
    const { label: _libelleDerive, ...arme } = descendu;
    return arme;
  }
  if (descendu.kind === 'hasItem' && typeof descendu.trappingId === 'string' && !r.objetConnu(descendu.trappingId))
    return { ...descendu, trappingId: idDuLibelle(descendu.trappingId, r, 'hasItem.trappingId') };
  if (estUneInstance(descendu)) return instanceDesignee(descendu, r);
  return descendu;
}
