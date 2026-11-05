import type { PropViz } from '../../types';
import { P } from '../../decorPalette';
import { woodStairSvg } from '../woodwork';

// Escalier en bois (1×1) : la volée de marches utilitaire (auberge, galerie, entresol) — même tracé que
// l'escalier de loge, mais rampe et pommeaux EN BOIS, sans la moindre dorure. Ancré aux pieds.
export const prop: PropViz = {
  id: 'escalier-bois',
  render: () => woodStairSvg({ railColor: P.boisMoyen21, knobColor: P.boisFonce12 }),
};
