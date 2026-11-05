import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Lanterne de poupe : grande lanterne de navire vitrée à cage de fer, suspendue à une potence
// de bois par un bras de fer forgé en volute — halo chaud (groupe « warm »).
export const prop: PropViz = {
  id: 'lanterne-de-poupe',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="18" ry="6" fill="${P.ombre}" opacity="0.25"/>` +
    // Potence de bois : montant vertical, sabot au pied, deux cerclages de fer
    `<path d="M44 148 L46 44 L54 44 L56 148 Z" fill="${P.boisFonce12}"/>` +
    `<path d="M46 60 L54 60 M45 120 L55 120" stroke="${P.boisTresSombre2}" stroke-width="3"/>` +
    `<path d="M40 148 h20 v-6 h-20 Z" fill="${P.boisSombre16}"/>` +
    // Jambe de force et bras de fer forgé terminé en volute
    `<path d="M54 84 L74 52" stroke="${P.pierreSombre7}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M46 46 Q60 34 82 40 Q92 43 90 50 Q88 55 84 52 Q82 49 86 47" stroke="${P.pierreSombre7}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    // Anneau et crochet de suspension
    `<circle cx="80" cy="46" r="3.5" fill="none" stroke="${P.pierreSombre6}" stroke-width="2.5"/>` +
    `<path d="M80 49 L80 55" stroke="${P.pierreSombre6}" stroke-width="2.5"/>` +
    // Chapeau bombé + fleuron
    `<circle cx="80" cy="53" r="2.6" fill="${P.orFonce2}"/>` +
    `<path d="M64 66 Q80 52 96 66 L94 70 L66 70 Z" fill="${P.pierreSombre6}"/>` +
    `<ellipse cx="80" cy="69" rx="15" ry="3.4" fill="${P.pierreSombre7}"/>` +
    // Corps vitré (halo chaud + flamme) sous cage de fer
    `<g class="warm"><path d="M66 70 L94 70 L91 104 L69 104 Z" fill="${P.orClair3}"/>` +
    `<path d="M80 100 Q72 86 80 76 Q84 88 88 84 Q90 96 80 100 Z" fill="${P.boisTresClair6}"/></g>` +
    // Cage : montants, traverse, socle et goutte de fer
    `<path d="M71 70 L70 104 M80 70 L80 104 M89 70 L90 104" stroke="${P.pierreSombre7}" stroke-width="2.2"/>` +
    `<path d="M67.5 87 h25" stroke="${P.pierreSombre7}" stroke-width="2"/>` +
    `<ellipse cx="80" cy="105" rx="13" ry="3.6" fill="${P.pierreSombre6}"/>` +
    `<circle cx="80" cy="111" r="2.6" fill="${P.pierreSombre7}"/>` +
    `</g>`,
};
