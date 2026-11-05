import type { PropViz } from '../../types';
import { P } from '../../decorPalette';
import { woodBalustradeSvg } from '../woodwork';

// Balustrade de loge (à la CASE) : main courante dorée, balustres en pommeau doré, et tenture de velours rouge
// festonnée à clous dorés tendue sur le devant — la version d'apparat du garde-corps de bois.
export const prop: PropViz = {
  id: 'balustrade-loge',
  render: () =>
    woodBalustradeSvg({
      railColor: P.boisMoyen21,
      knobColor: P.orMoyen9,
      knobHi: P.orTresClair14,
      tenture: { cloth: P.sangFonce5, stud: P.orMoyen9 },
    }),
};
