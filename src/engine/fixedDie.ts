/**
 * « Dés fixés » — PRÉFÉRENCE de confort (saisir soi-même la valeur du d100 d'un jet qu'on contrôle),
 * pas une règle de WFRP : elle ne vit PAS au registre des règles optionnelles
 * (`src/data/reglesOptionnelles.json`, lu par `policy.ts` — chaque entrée y porte sa réf chapitre +
 * ligne) mais ici, en valeur pure. MÊME partage que `cadence.ts` : ce module
 * FEUILLE porte la valeur (moteur pur, zéro dépendance), `noyau/preferences.ts` porte la table,
 * `hote/preferences.ts` la persistance, `noyau/netOwnership.canFixDie` porte le prédicat de CONTRÔLE (qui peut fixer quoi).
 *
 * SEULE source de vérité de l'activation : le reste du moteur/store lit `desFixes()`.
 */
export const DES_FIXES_DEFAULT = false;

let current: boolean = DES_FIXES_DEFAULT;

/** L'option est-elle active ? (défaut `false`). */
export const desFixes = (): boolean => current;

/** Écrit l'option — table des préférences : `noyau/preferences.ts`. */
export function setDesFixes(on: boolean): void {
  current = on;
}

/** Revient au défaut. */
export function resetDesFixes(): void {
  current = DES_FIXES_DEFAULT;
}

/** Faces d'un d100 (« 00 » = 100, cf. `isDoubleRoll`). Un dé FIXÉ couvre TOUT le dé : il n'a pas à
 *  rester une réussite, contrairement au dé choisi de la Résilience (`maxForcedRoll`). */
export const FIXED_ROLL_MAX = 100;

/** Ramène une saisie dans les faces du d100. */
export const clampFixedRoll = (n: number): number => Math.min(Math.max(1, Math.floor(n)), FIXED_ROLL_MAX);
