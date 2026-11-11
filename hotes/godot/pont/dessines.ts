/**
 * LES GESTES DESSINÉS (#3534, `CONTRAT.md`) : ce que l'écran dessine de la fenêtre qui tient la main, lu sur la vue du
 * pont par ses tables de test et ses recettes, en TypeScript comme en module de Node (`recette.mjs`).
 */
import type { Bouton, Choix, Formulaire } from '../../../src/hote/elements';
import type { VueDuPont } from './pont';

/** Les gestes de la fenêtre que l'écran dessine : ses réglages, ses gestes, puis ceux que portent les cartes du groupe
 *  (`groupe.heros`), chacun un bouton qui joue un verbe. */
export const gestesDessines = (vue: VueDuPont): (Bouton | Choix | Formulaire)[] => [
  ...vue.zones['fenetre.reglages'],
  ...vue.zones['fenetre.gestes'],
  ...vue.zones['groupe.heros'].flatMap((h) => h.elements).filter((e): e is Bouton => e.type === 'bouton' && 'type' in e.jeu),
];

/** Le geste que l'Entrée joue parmi les gestes dessinés (`gestesDessines`), `undefined` sans lui. */
export const enFocus = (vue: VueDuPont): Bouton | undefined => gestesDessines(vue).find((g): g is Bouton => g.type === 'bouton' && g.focus);
