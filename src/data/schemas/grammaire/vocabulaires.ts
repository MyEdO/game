/**
 * VOCABULAIRES DU MOTEUR (#1463) — les tables FERMÉES `id → libellé` que le code déclare et qu'aucun
 * document de `src/data` ne porte, exposées comme ESPACES (`vocabulaire:<nom>`, `grammaire/cle-d-espace.ts`) :
 * une source de spécialisations (`grammaire/sourcesDeSpecs.ts`) y prend son univers ou ses libellés, un type
 * de `TYPES` (`grammaire/ref.ts`) son espace.
 * Le code les fige : la phase 2 de `npm run gen` (`scripts/gen-espaces.mts`) écrit à l'INDEX DES IDS ceux
 * qu'une source prend pour univers ou pool ou qu'un type prend pour espace, que le régime vivant suit
 * (`src/data/overrides.ts`), et refuse un vocabulaire de LIBELLÉS dont les ids ne sont pas exactement
 * ceux de l'univers de sa source (Tailles : `sizes.json#rangedMod`).
 *
 * Un REGISTRE TS D'ART en est un (#2968 P-art) : sa table est la projection de ses defs
 * (`VOCABULAIRES_D_ART`, option `vocabulaire` de `scripts/docs/lib/cibles-registres.mjs`).
 */
import { DIFFICULTY_NAMES } from '../../../engine/types';
import { SIZE_LABEL } from '../../../engine/size';
import { exposureLevelSchema } from './valeurs';
import { valeursDe } from './meta';
import { lireCleDEspace, vocabulaireDuFichier } from './cle-d-espace';
import { VOCABULAIRES_D_ART } from '../_vocabulaires-d-art.generated';

/** La table d'un enum nommé (`enumNomme`), qui doit en porter une. */
function tableDe(noeud: unknown, nom: string): Readonly<Record<string, string>> {
  const table = valeursDe(noeud);
  if (!table) throw new Error(`vocabulaire « ${nom} » : son nœud n'est pas un enum nommé.`);
  return table;
}

/** Chaque vocabulaire, par son nom d'espace. Difficultés : `LDB 12 l.143-151` ; Expositions :
 *  `LDB 19 l.33-56` ; Tailles : `LDB 85 l.348-354`. Colonnes du marchand : `merchantFamilies.json › columns`,
 *  rendues par `MERCHANT_COL_RENDERERS` (`src/noyau/colonnesDuMarchand.ts`). */
export const VOCABULAIRES = {
  difficultes: DIFFICULTY_NAMES,
  expositions: tableDe(exposureLevelSchema, 'expositions'),
  tailles: SIZE_LABEL,
  colonnesDuMarchand: {
    damage: 'Dégâts', reach: 'Allonge', range: 'Portée', protection: 'Protection', pa: 'PA', availability: 'Disponibilité', capacity: 'Capacité',
  },
  ...VOCABULAIRES_D_ART,
} as const satisfies Record<string, Readonly<Record<string, string>>>;

export type NomDeVocabulaire = keyof typeof VOCABULAIRES;

/** Id d'une colonne de stats du marchand. */
export type IdDeColonneDuMarchand = keyof typeof VOCABULAIRES.colonnesDuMarchand;

/** Lecture de l'espace `cle` quand c'est un vocabulaire : ses ids, ou ses libellés (sans doublon), dans
 *  l'ordre de la table ; `undefined` pour une clé de document. LÈVE sur un vocabulaire inconnu, une
 *  suite nichée, un filtre ou des champs de libellé : un vocabulaire n'a que ses ids et leurs libellés. */
export function lectureDuVocabulaire(cle: string): { readonly ids: readonly string[] } | undefined {
  const lue = lireCleDEspace(cle);
  const nom = vocabulaireDuFichier(lue.fichier);
  if (nom === undefined) return undefined;
  if (!Object.prototype.hasOwnProperty.call(VOCABULAIRES, nom)) throw new Error(`« ${cle} » : aucun vocabulaire « ${nom} » (\`VOCABULAIRES\`).`);
  if (lue.niche !== undefined || lue.filtre || lue.libelles?.length) throw new Error(`« ${cle} » : un vocabulaire n'a ni suite nichée, ni filtre, ni champs de libellé.`);
  const table: Readonly<Record<string, string>> = VOCABULAIRES[nom as NomDeVocabulaire];
  return { ids: lue.libelles ? [...new Set(Object.values(table))] : Object.keys(table) };
}
