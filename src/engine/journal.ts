import type { IconId } from '../data/schemas/icons';

/** Le TON d'une ligne (#349) : le trio de `NightEntry.tone` (noyau/restFlow.ts) et des tons d'un hôte (`Ton`,
 *  src/hote/elements.ts), jamais un second vocabulaire. */
export type RecapTone = 'reussite' | 'echec' | 'neutre';

/** Une entrée du journal du noyau : une donnée que chaque hôte rédige (#4574). `ligne` : texte déjà rédigé par le
 *  noyau, stock à résorber (#4574), avec le ton et l'icône AUTHORÉS de sa ligne. `deFixe` : écrite pendant qu'un jet
 *  saisi par le joueur s'applique (#939). `rattache` : l'entrée détaille celle qui la précède (#4574). */
export type EntreeDuJournal = { sorte: 'ligne'; texte: string; deFixe?: true; ton?: RecapTone; icone?: IconId; rattache?: true };

/** L'habit qu'une entrée reçoit à sa naissance : ton, icône, rattachement à l'entrée précédente. */
type HabitDeLEntree = { ton?: RecapTone; icone?: IconId; rattache?: true };

/** L'entrée `ligne` de `texte`, habillée de `habit`. */
export const ligneDeTexte = (texte: string, habit: HabitDeLEntree = {}): EntreeDuJournal => ({
  sorte: 'ligne',
  texte,
  ...(habit.ton ? { ton: habit.ton } : {}),
  ...(habit.icone ? { icone: habit.icone } : {}),
  ...(habit.rattache ? { rattache: true } : {}),
});
