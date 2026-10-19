/**
 * PORTE CLAVIER DE LA PILE (#1476) — Échap et sa relâche, en CAPTURE sur la fenêtre
 * (`ecouterClavier('couche')`), posés tant qu'au moins une couche est prise (`posePartagee`). Toute
 * autre touche passe. Échap se reconnaît à sa position (`e.code`) ou à sa touche nommée (`e.key`),
 * seule présente sur un clavier virtuel. `useDismissLayer` la prend à l'ouverture de chaque couche.
 */
import { useGame } from '../../../state/store';
import { CODE_ECHAP } from '../../../state/clavier/keybindings';
import { resoudreEchap, echapRelachee } from '../../../state/clavier/resoudreEchap';
import { posePartagee } from '../../../lib/posePartagee';
import { ecouterClavier } from '../interne/ecouterClavier';

const onKeyDown = (e: KeyboardEvent) => {
  if (e.code !== CODE_ECHAP && e.key !== CODE_ECHAP) return;
  const pris = resoudreEchap(useGame.getState, { repeat: e.repeat });
  if (pris === null) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
};
const onKeyUp = (e: KeyboardEvent) => {
  if (e.code === CODE_ECHAP || e.key === CODE_ECHAP) echapRelachee();
};

const PORTE = posePartagee(() => ecouterClavier('couche', { keydown: onKeyDown, keyup: onKeyUp }));

/** Prend la porte (posée au premier preneur) ; rend sa remise. */
export const prendrePorteEchap = (): (() => void) => PORTE.prendre();

/** Retire la porte et oublie tout preneur, relâche comprise — remise à zéro des bancs de test. */
export function viderPorteEchap(): void {
  PORTE.vider();
  echapRelachee();
}
