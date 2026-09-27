/**
 * L'arme d'une entité de scène (`scenes[].entities[].weapon`, sous-listes `melee`/`ranged` de
 * `idDe('trapping', …)`) passe du LIBELLÉ à l'id (#1897). Table GELÉE : les libellés que proposait le
 * sélecteur de l'éditeur (`EDITOR_WEAPONS`, de 7e00116bf à 8cc29d3e3) dont le catalogue `trappings.json` portait une arme au libellé EXACT, ce jour-là.
 * « Épée », « Hache », « Masse » n'en avaient aucune : ils traversent, et `parseProject` les refuse en
 * nommant leur chemin. Tout le reste du document traverse intact.
 *
 * Primitive PARTAGÉE, chargée par Node nu (aucun import) : migration de dépôt
 * `scripts/migrations/2026-09-27-1897-projet-armes-d-entite-ids.mjs` et `PROJECT_MIGRATIONS[17]`
 * (`src/state/worldMap.ts`).
 */
export const ARMES_D_ENTITE_LIBELLE_VERS_ID: Readonly<Record<string, string>> = Object.freeze({
  Dague: 'dague',
  Lance: 'lance',
  Hallebarde: 'hallebarde',
  'Bâton de combat': 'baton-de-combat',
  Arc: 'arc',
  Arbalète: 'arbalete',
  Pistolet: 'pistolet',
  Fronde: 'fronde',
  Fouet: 'fouet',
});

const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** L'entité, `weapon` réécrit À SA PLACE si c'est un libellé de la table ; sinon l'entité elle-même. */
function armeEnId(entite: unknown): unknown {
  if (!objet(entite) || typeof entite.weapon !== 'string' || !Object.prototype.hasOwnProperty.call(ARMES_D_ENTITE_LIBELLE_VERS_ID, entite.weapon)) return entite;
  return { ...entite, weapon: ARMES_D_ENTITE_LIBELLE_VERS_ID[entite.weapon] };
}

/** Le document, chaque `scenes[].entities[].weapon` de la table en id ; rend un arbre NEUF quand il réécrit. */
export function armesDEntiteEnIds<T>(doc: T): T {
  if (!objet(doc) || !Array.isArray(doc.scenes)) return doc;
  const scenes = doc.scenes.map((s) => (objet(s) && Array.isArray(s.entities) ? { ...s, entities: s.entities.map(armeEnId) } : s));
  return { ...doc, scenes } as T;
}
