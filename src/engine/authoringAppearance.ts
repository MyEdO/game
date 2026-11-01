/**
 * Types d'APPARENCE — couche NEUTRE partagée : l'éditeur/scène (`state`) AUTHORE `EntityAppearance`, le
 * Combattant (`engine`) PORTE l'override brut (`Combatant.appearanceOverride`) et l'apparence résolue
 * (`Combatant.appearance`). Vivent ici (moteur) pour qu'aucun consommateur n'inverse les couches
 * (#187, #2884). Structurels purs (aucune valeur de rendu).
 */

import type { Sexe } from '../data/schemas/grammaire/valeurs';

/** Vocabulaire (marque NOMINALE, #406) : id d'espèce jouable, de créature ou de race d'apparence
 *  (`especeDApparenceSchema`) — jamais un `SpeciesData.label` (« Humains (Reiklander) »). UNE seule
 *  monnaie : un littéral `string` (dont un `.label`) n'est plus assignable à `Appearance.species`
 *  (échec STRUCTUREL). Producteur sanctionné : `especeDApparence` (pont règles→apparence,
 *  `src/data/index.ts`). */
export type EspeceDApparence = string & { readonly __especeDApparence: unique symbol };

/** Surcharge d'apparence. */
export interface EntityAppearance {
  sex?: Sexe;
  build?: number;
  /** Espèce/race CHOISIE — découple l'apparence du nom (label/ref) : id d'APPARENCE (ex.
   *  `nain`, `halflings`), jamais un libellé. Absente = l’espèce du record (`spawnEnemy`, `noyau/monde/spawn.ts`). */
  species?: string;
  /** Tenue CHOISIE — id STABLE, jamais un libellé (`tenueFermeeSchema`, `data/schemas/grammaire/valeurs.ts`,
   *  #3116) ; `spawnEnemy` la porte sur `Combatant.career`. */
  tenue?: string;
  /** Armure de statblock (PA par localisation, sans inventaire) VISIBLE/portée — OPT-IN d'authoring
   *  (#774, #775) : le statblock de PA ne pilote pas l'apparence. Absent = les PA restent mécaniques
   *  PURS, aucun art d'armure synthétisé (`synthArmour`). */
  armurePortee?: boolean;
  /** Apparence des objets sans instance : id de trapping → référence au catalogue des apparences. */
  apparencesObjets?: Record<string, { id: string }>;
}

/** Descripteur d'apparence COSMÉTIQUE RÉSOLU (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: EspeceDApparence;
  sex: Sexe;
  build: number;                                   // 0..1
}
