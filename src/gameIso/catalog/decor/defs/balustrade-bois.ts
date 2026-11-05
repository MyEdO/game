import type { PropViz } from '../../types';
import { P } from '../../decorPalette';
import { woodBalustradeSvg } from '../woodwork';

// Balustrade en bois (3×1) : garde-corps de galerie sobre — main courante et balustres à pommeau EN BOIS,
// sans tenture ni dorure. Même tracé que la balustrade de loge, dépouillé de son velours et de son or.
export const prop: PropViz = {
  id: 'balustrade-bois',
  // Générique tenu par ses montants d'about + lisse basse : lit « garde-corps de galerie », pas « peigne ».
  // Fuseaux plus longs (jusqu'à y=122) et ton oak sobre (boisMoyen2) harmonisé à la main courante — plus de
  // jaune vif isolé, contraste adouci ; aucun or ni velours (utilitaire).
  render: () =>
    woodBalustradeSvg({
      railColor: P.boisMoyen21,
      knobColor: P.boisFonce12,
      balusterColor: P.boisMoyen2,
      balusterBottom: 122,
      endPosts: true,
    }),
};
