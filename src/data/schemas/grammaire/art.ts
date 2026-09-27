/**
 * Ids d'ART écrits par l'auteur, jugés par le schéma contre la projection GÉNÉRÉE des registres de
 * rendu (`_art.generated.ts`, option `projection` de `scripts/gen-registry.mjs`) : les `defs/` du rig
 * possèdent la déclaration, la donnée en reçoit la projection sans importer le rendu. Le rendu importe
 * ces prédicats (sens permis) : UNE computation du domaine, pour le schéma comme pour `resolveRender`.
 */
import { idDe } from './ref';
import { ESPECES_DE_CREATURE, FORMES_DE_NUEE, SEXE_DE_COIFFURE } from '../_art.generated';

/** Espèces DESSINÉES : celles dont le code déclare le corps — defs de créature et formes de nuée. */
const ESPECES_DESSINEES: ReadonlySet<string> = new Set([...ESPECES_DE_CREATURE, ...FORMES_DE_NUEE]);
const FORMES: ReadonlySet<string> = new Set(FORMES_DE_NUEE);
/** Porte des espèces JOUABLES (`species.json`), lue vivante (entité créée au Compendium comprise). */
const especeJouable = idDe('species');

/** L'espèce `id` est-elle DESSINÉE (defs de créature ou forme de nuée) ? */
export function estEspeceDessinee(id: string): boolean {
  return ESPECES_DESSINEES.has(id);
}

/** Faute d'une espèce d'auteur hors du domaine de saisie — espèce jouable ∪ espèce dessinée. Dite par le
 *  schéma (`entityAppearanceSchema.species`, `grammaire/valeurs.ts`) et par `fauteDEspece`. */
export function messageDEspeceInconnue(id: string): string {
  return `espèce « ${id} » inconnue : ni espèce jouable, ni espèce dessinée — le personnage s'affiche en silhouette d'erreur.`;
}

/** Faute de l'espèce `id` écrite par l'auteur (`appearance.species`), hors du domaine de saisie, `null`
 *  sinon. Appelée par le rendu (`resolveRender`), hors de tout parse. */
export function fauteDEspece(id: string): string | null {
  if (estEspeceDessinee(id) || especeJouable.safeParse(id).success) return null;
  return messageDEspeceInconnue(id);
}

/** L'espèce est une FORME DE NUÉE (`swarm/defs`) : elle ne se rend que par le trait Nuée. */
export function estFormeDeNuee(id: string): boolean {
  return FORMES.has(id);
}

/** Sexe d'une coiffure dessinée (`hairstyles/defs`), `undefined` pour un id inconnu. */
export function sexeDeCoiffure(id: string): (typeof SEXE_DE_COIFFURE)[string] | undefined {
  return Object.prototype.hasOwnProperty.call(SEXE_DE_COIFFURE, id) ? SEXE_DE_COIFFURE[id] : undefined;
}
