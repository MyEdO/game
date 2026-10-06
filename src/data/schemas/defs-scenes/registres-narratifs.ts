/**
 * Les REGISTRES du bloc narratif (`NarratifBlock`, `src/state/campaignNarratif.ts`) — déclarés UNE fois.
 * Chaque liste d'entrées à `id` du narratif y a sa ligne ; la lisent le schéma (`raffineNarratif`,
 * `./narratif.ts` : unicité inter-registres et anti-collision globale), le résolveur de campagne
 * (`src/state/campaignData.ts`), le narratif vide (`emptyNarratif`), l'éditeur (`porteurDeLId`,
 * `src/ui/editor/NarratifEditor.tsx`) et le compteur de la barre d'outils (`src/ui/editor/Editor.tsx`).
 * Un registre de plus = une ligne ici.
 *
 * Les clés qui DÉSIGNENT une entrée d'un registre (`REFERENCES_NARRATIVES`) sont déclarées ici aussi :
 * la lisent le parcours des Effects (`./refs-narratives.ts`) et le lexique des structures
 * (`CLES_REFERENCE_SCOPEE`, `scripts/docs/lib/structures-lexique.mts`).
 *
 * FEUILLE sans dépendance de valeur (le seul import est un TYPE) : le schéma, l'état et l'UI la lisent
 * sans tirer le parseur.
 */
import type { NarratifBlock } from '../../../state/campaignNarratif';

/** Clés de `NarratifBlock` dont la valeur est une liste d'entrées à `id` (`ecartes` se clé par `entree`). */
type ClesDeListeAId<T> = { [K in keyof T]-?: NonNullable<T[K]> extends readonly { id: string }[] ? K : never }[keyof T];
export type CleDeRegistreNarratif = ClesDeListeAId<NarratifBlock>;

/** Une ligne de registre : sa clé dans `NarratifBlock`, le complément de nom de ses messages de faute
 *  (« l'id d'affaire »), le nom d'une de ses entrées pour l'auteur (« l'affaire »), le sujet d'une
 *  référence qui ne résout pas (« affaire inconnue »), celui d'une référence encore vide (« aucune
 *  affaire choisie »), et
 *  `idAuSchema` — l'`id` vide est-il déjà refusé par le schéma de l'élément (`false` : l'élément est
 *  un `z.custom`, le raffinage dit l'absence). */
export interface RegistreNarratif {
  readonly cle: CleDeRegistreNarratif;
  readonly de: string;
  readonly nom: string;
  readonly inconnu: string;
  readonly aucun: string;
  readonly idAuSchema: boolean;
}

/** La table, keyée par registre : son type EXIGE chaque liste de `NarratifBlock` (une liste sans ligne
 *  ne compile pas), et l'ordre de ses clés est celui des registres partout où ils s'énumèrent. */
const TABLE: { readonly [K in CleDeRegistreNarratif]: Omit<RegistreNarratif, 'cle'> } = {
  affaires: { de: 'd\'affaire', nom: 'l\'affaire', inconnu: 'affaire inconnue', aucun: 'aucune affaire choisie', idAuSchema: true },
  indices: { de: 'd\'indice', nom: 'l\'indice', inconnu: 'indice inconnu', aucun: 'aucun indice choisi', idAuSchema: true },
  presetsPnj: { de: 'de preset PNJ', nom: 'le PNJ', inconnu: 'preset de PNJ inconnu', aucun: 'aucun preset de PNJ choisi', idAuSchema: true },
  objets: { de: 'd\'objet', nom: 'l\'objet', inconnu: 'objet inconnu', aucun: 'aucun objet choisi', idAuSchema: false },
  documents: { de: 'de document', nom: 'le document', inconnu: 'document inconnu', aucun: 'aucun document choisi', idAuSchema: true },
};

export const REGISTRES_NARRATIFS: readonly RegistreNarratif[] = (Object.keys(TABLE) as CleDeRegistreNarratif[]).map((cle) => ({ cle, ...TABLE[cle] }));

/**
 * RÉFÉRENCES NARRATIVES : clé → registre dont elle désigne une entrée par son `id`, dans le narratif du
 * MÊME document (espace CLOS). Le visiteur unique `./refs-narratives.ts` les énumère ; la porte du
 * projet et `raffineNarratif` en gardent la résolution, l'éditeur les propage.
 */
export const REFERENCES_NARRATIVES = {
  affaireId: 'affaires',
  indiceId: 'indices',
  presetId: 'presetsPnj',
  documentId: 'documents',
} as const satisfies Readonly<Record<string, CleDeRegistreNarratif>>;

/** Registre désigné par une référence narrative. */
export type RegistreReference = (typeof REFERENCES_NARRATIVES)[keyof typeof REFERENCES_NARRATIVES];

/** Le sujet d'une faute de référence qui ne résout pas dans `registre` (« document inconnu »). */
export const inconnuDe = (registre: CleDeRegistreNarratif): string => TABLE[registre].inconnu;

/** Le sujet d'une référence encore VIDE vers `registre` (« aucun document choisi »). */
export const aucunDe = (registre: CleDeRegistreNarratif): string => TABLE[registre].aucun;
