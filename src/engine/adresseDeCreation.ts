/**
 * Adresse d'un EMPLACEMENT de création — la clé des choix portés par un emplacement (`specChoices`,
 * `speciesTalentChoices`, `randomSpecPicks`, `talentRerolls`, `trappingChoices` de `ChoixDeCreation`). Deux emplacements qui désignent la
 * même entité restent deux adresses.
 *
 * MARQUE PUREMENT TYPOLOGIQUE, sur le modèle de `PlayerText` (`src/i18n/playerText.ts`) : `string`
 * n'est pas assignable vers `AdresseDeCreation`, donc un libellé ne peut ni indexer ni écrire un de ces
 * Records. Deux minteurs : les fabriques de `adresseDeCreation`, et `adresseLue` à la couture de
 * chargement d'un JSON persisté (`state/roster.ts`).
 */

declare const ADRESSE_DE_CREATION: unique symbol;

/** Clé d'un choix de création, sortie de `adresseDeCreation` ou de `adresseLue`. */
export type AdresseDeCreation = string & { readonly [ADRESSE_DE_CREATION]: true };

const marquer = (cle: string): AdresseDeCreation =>
  // eslint-disable-next-line murs/marques -- #1988 : l'unique cast de ce module — forger la marque EST le corps de métier de ses deux minteurs (cf. JSDoc), comme `dataLabel` pour `PlayerText`.
  cle as AdresseDeCreation;

/** Les fabriques d'adresse, une par famille d'emplacement de création. */
export const adresseDeCreation = {
  especeTalent: (i: number): AdresseDeCreation => marquer(`espece:talents:${i}`),
  /** Tirage `j` d'une entrée `{random: n}` de l'entrée d'espèce `i`, y compris comme option d'un choix. */
  especeTirage: (i: number, j: number): AdresseDeCreation => marquer(`espece:talents:${i}:tirage:${j}`),
  carriereCompetence: (i: number): AdresseDeCreation => marquer(`carriere:competences:${i}`),
  ajout: (skillId: string): AdresseDeCreation => marquer(`ajout:${skillId}`),
  signe: (k: number): AdresseDeCreation => marquer(`signe:${k}`),
  /** `chemin` : la position dans `dotationRefsForHero`, puis l'index de branche de chaque `{choice}`
   *  traversé (`emplacementsDeDotation`, `engine/trappingChoices.ts`). */
  dotation: (chemin: readonly number[]): AdresseDeCreation => marquer(`dotation:${chemin.join('.')}`),
};

const FORME = /^(espece:talents:\d+(:tirage:\d+)?|carriere:competences:\d+|ajout:[^:]+|signe:\d+|dotation:\d+(\.\d+)*)$/;

/** Une clé lue d'un JSON persisté, si elle a la forme d'une adresse de `adresseDeCreation`. */
export function adresseLue(cle: string): AdresseDeCreation | undefined {
  return FORME.test(cle) ? marquer(cle) : undefined;
}
