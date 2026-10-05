/**
 * Adresse d'un EMPLACEMENT de création — la clé des choix portés par un emplacement (`specChoices`,
 * `speciesTalentChoices`, `randomSpecPicks`, `talentRerolls`, `trappingChoices` de `ChoixDeCreation`). Deux emplacements qui désignent la
 * même entité restent deux adresses.
 *
 * MARQUE PUREMENT TYPOLOGIQUE, sur le modèle de `PlayerText` (`src/i18n/playerText.ts`). Ce qu'elle
 * garantit, par porte, dans un `Record<AdresseDeCreation, V>` :
 * - typecheck : une `string` (libellé ou texte à la forme d'une adresse) ne l'indexe ni en lecture ni en
 *   écriture, et n'est pas une clé d'un littéral d'objet écrit AU TYPE du Record (TS7053, TS2353) ;
 * - lint `murs/marques` (`eslint.config.js`, tests compris) : pas de cast vers la marque hors de
 *   `marquer`, pas d'adresse écrite en texte (littéral complet, gabarit ouvert sur une famille) hors des
 *   fabriques.
 * Ce qu'elle ne garantit PAS : tsc laisse entrer, sans vérifier ni la clé ni la valeur, tout objet à
 * signature d'index `string` (`Record<string, V>`, `Object.fromEntries`, un spread, une clé calculée
 * `[s]`) et tout objet intermédiaire à clés littérales ; un libellé y passe. Aucun typage simple ne le
 * refuse (un gabarit `` `dotation:${number}` `` non plus). Ces entrées ne sont sûres qu'aux minteurs.
 *
 * Trois minteurs : les fabriques de `adresseDeCreation` ; `adresseLue` à la couture de chargement d'un
 * JSON persisté (`brouillonRelu`, `state/roster.ts`) ; le cast de chargement des pré-tirés
 * (`pregens`, `data/index.ts`), qui ne lit pas ses clés. Celles-ci sont lues par `adresseLue` au PARSE
 * du schéma `parAdresse` (`data/schemas/grammaire/choixDeCreation.ts`), à chaque porte de
 * `validateDataset` (`data/schemas/validate.ts`) : les tests (`data/schema-contract.test.ts`,
 * `data/pregens.test.ts`), la sauvegarde du Compendium (`ui/compendium/CodexEdit.tsx`, `save`), le boot
 * DEV (`main.tsx` → `data/dev-validate.ts`) et le pré-commit (`scripts/git-hooks/pre-commit.mjs` →
 * `scripts/guards/validate-data.mts`).
 *
 * La GRAMMAIRE (familles, tirage sous un talent d'espèce) vit dans CE module : `deFamille` et
 * `tirageSous` répondent aux questions de famille, et le lint `murs/marques` refuse ailleurs un préfixe
 * de famille écrit en texte (littéral, gabarit sans expression). Il ne voit pas un préfixe tiré d'une
 * valeur (`` `${x}:` ``), ni un gabarit ouvert sur une famille nue (`` `espece:${i}` ``, des clés d'écran).
 */

declare const ADRESSE_DE_CREATION: unique symbol;

/** Clé d'un choix de création, sortie de `adresseDeCreation` ou de `adresseLue`. */
export type AdresseDeCreation = string & { readonly [ADRESSE_DE_CREATION]: true };

const marquer = (cle: string): AdresseDeCreation =>
  // eslint-disable-next-line murs/marques -- #1988 : l'unique cast de ce module — forger la marque EST le corps de métier de ses deux minteurs (cf. JSDoc), comme `dataLabel` pour `PlayerText`.
  cle as AdresseDeCreation;

/** Les fabriques d'adresse, une par famille d'emplacement de création. */
export const adresseDeCreation = {
  // eslint-disable-next-line murs/marques -- #1988 : fabrique, gabarit de la famille `espece:talents` — composer l'adresse EST son corps de métier (cf. JSDoc).
  especeTalent: (i: number): AdresseDeCreation => marquer(`espece:talents:${i}`),
  /** Tirage `j` d'une entrée `{random: n}` de l'entrée d'espèce `i`, y compris comme option d'un choix. */
  // eslint-disable-next-line murs/marques -- #1988 : fabrique, gabarit du tirage sous une entrée d'espèce — composer l'adresse EST son corps de métier (cf. JSDoc).
  especeTirage: (i: number, j: number): AdresseDeCreation => marquer(`espece:talents:${i}:tirage:${j}`),
  // eslint-disable-next-line murs/marques -- #1988 : fabrique, gabarit de la famille `carriere:competences` — composer l'adresse EST son corps de métier (cf. JSDoc).
  carriereCompetence: (i: number): AdresseDeCreation => marquer(`carriere:competences:${i}`),
  // eslint-disable-next-line murs/marques -- #1988 : fabrique, gabarit de la famille `ajout` — composer l'adresse EST son corps de métier (cf. JSDoc).
  ajout: (skillId: string): AdresseDeCreation => marquer(`ajout:${skillId}`),
  // eslint-disable-next-line murs/marques -- #1988 : fabrique, gabarit de la famille `signe` — composer l'adresse EST son corps de métier (cf. JSDoc).
  signe: (k: number): AdresseDeCreation => marquer(`signe:${k}`),
  /** `chemin` : la position dans `dotationRefsForHero`, puis l'index de branche de chaque `{choice}`
   *  traversé (`emplacementsDeDotation`, `engine/trappingChoices.ts`). */
  // eslint-disable-next-line murs/marques -- #1988 : fabrique, gabarit de la famille `dotation` — composer l'adresse EST son corps de métier (cf. JSDoc).
  dotation: (chemin: readonly number[]): AdresseDeCreation => marquer(`dotation:${chemin.join('.')}`),
};

/** Famille d'un emplacement : le premier segment d'une adresse de `adresseDeCreation`. */
export type FamilleDAdresse = 'espece' | 'carriere' | 'ajout' | 'signe' | 'dotation';

/** L'adresse `cle` est de l'une des `familles`. */
export const deFamille = (cle: string, ...familles: readonly FamilleDAdresse[]): boolean =>
  familles.some((f) => cle.startsWith(`${f}:`));

/** L'adresse `cle` est un tirage (`especeTirage`) de l'entrée d'espèce `talent` (`especeTalent`). */
export const tirageSous = (cle: string, talent: AdresseDeCreation): boolean => cle.startsWith(`${talent}:tirage:`);

const FORME = /^(espece:talents:\d+(:tirage:\d+)?|carriere:competences:\d+|ajout:[^:]+|signe:\d+|dotation:\d+(\.\d+)*)$/;

/** Une clé lue d'un JSON persisté, si elle a la forme d'une adresse de `adresseDeCreation`. */
export function adresseLue(cle: string): AdresseDeCreation | undefined {
  return FORME.test(cle) ? marquer(cle) : undefined;
}
