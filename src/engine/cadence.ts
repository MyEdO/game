/**
 * « Cadence de combat » — PRÉFÉRENCE de confort (rythme de résolution des jets), pas une règle de
 * WFRP : elle ne vit PAS au registre des règles optionnelles (`src/data/reglesOptionnelles.json`, lu
 * par `policy.ts` — chaque entrée y porte sa réf chapitre + ligne) mais ici, en valeur pure. Le
 * partage est le MÊME que `policy` ⇄ `noyau/reglesMaison` :
 * ce module FEUILLE porte la valeur (moteur pur, zéro dépendance), `noyau/preferences.ts` porte la
 * table, `hote/preferences.ts` la persistance, `state/preferences.ts` l'effet déclaré par le web.
 *
 * SEULE source de vérité pour le mode d'automatisation : le reste du moteur/store lit `cadence()`,
 * `cadenceAuto()` ou `cadenceAutoCombat()`.
 */
export const CADENCE_MODES = ['manuel', 'rapide', 'auto'] as const;
export type Cadence = (typeof CADENCE_MODES)[number];
export const CADENCE_DEFAULT: Cadence = 'manuel';

let current: Cadence = CADENCE_DEFAULT;

/** Mode courant (défaut `'manuel'`). */
export const cadence = (): Cadence => current;

/** Écrit le mode — table des préférences : `noyau/preferences.ts`. */
export function setCadence(mode: Cadence): void {
  current = mode;
}

/** Revient au mode par défaut. */
export function resetCadence(): void {
  current = CADENCE_DEFAULT;
}

/** Rapide OU auto : les jets des héros se lancent + s'appliquent seuls (sans dépense de ressource). */
export const cadenceAuto = (): boolean => cadence() !== 'manuel';

/** Auto-combat seulement : l'IA joue aussi les héros (cible/action/surincantation/défense) et dépense le Destin. */
export const cadenceAutoCombat = (): boolean => cadence() === 'auto';
