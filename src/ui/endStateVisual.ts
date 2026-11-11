import type { EndState } from '../engine/conditions';
import type { IconId } from '../data/icons';

/** Langage visuel d'un état de fin (#237) : icône du registre (jamais un émoji), classe de teinte
 *  (portrait-tile.css `.end-mark.es-*`, gameIso/anim.css `.token-endmark.es-*`), libellé FR pour
 *  title/aria. */
export interface EndStateVisual {
  icon: IconId;
  className: string;
  label: string;
}

/** Langage visuel PAR état de fin, défini UNE fois (#237) — consommé par le jeton de carte (`TokenChromeMarks`)
 *  ET le portrait/frise (PortraitTile). Quatre états → quatre rendus DISTINCTS (icône + classe). */
export const END_STATE_VISUAL: Record<EndState, EndStateVisual> = {
  'mort': { icon: 'journal/mort', className: 'es-mort', label: 'Mort' },
  'inconscient': { icon: 'etat/inconscient', className: 'es-koan', label: 'Inconscient' },
  'rendu': { icon: 'journal/reddition', className: 'es-rendu', label: 'Reddition — pavillon amené' },
  'hors-combat': { icon: 'journal/fuite', className: 'es-hors', label: 'Hors de combat' },
};
