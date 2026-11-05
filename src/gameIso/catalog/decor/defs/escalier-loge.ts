import type { PropViz } from '../../types';
import { P } from '../../decorPalette';
import { woodStairSvg } from '../woodwork';

// Escalier de loge (1×1) : une volée de marches de bois montant vers la galerie, à rampe et pommeaux
// dorés — la version d'apparat de l'escalier de bois. Ancré aux pieds ; marches vers l'arrière (haut-gauche).
export const prop: PropViz = {
  id: 'escalier-loge',
  render: () => woodStairSvg({ railColor: P.boisMoyen21, knobColor: P.orMoyen9 }),
};
