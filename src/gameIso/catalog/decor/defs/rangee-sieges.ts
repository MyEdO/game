import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Rangée de fauteuils d'opéra (3×1) : velours rouge + dorures, quatre sièges alignés — remplit le
// parterre. Prop ORIENTÉ : il déclare ses trois vues ; la machinerie (`propSvg`) choisit la vue +
// le miroir via `project(dir, camRot)` (cf. `PropViz.views` / `rig/facing.ts`). Le profil (rangée vue
// de bout, un siège dans la profondeur) est dessiné tourné vers la DROITE — le profil gauche = miroir.

/** Un fauteuil vu de FACE (assise + dossier vers la caméra). */
const front = (cx: number) =>
  `<g><rect x="${cx - 13}" y="94" width="26" height="36" rx="9" fill="${P.sangFonce5}"/>` +
  `<rect x="${cx - 9}" y="98" width="18" height="28" rx="6" fill="${P.sangFonce14}"/>` +
  `<rect x="${cx - 9}" y="98" width="18" height="7" rx="3" fill="${P.boisMoyen21}"/>` +
  `<path d="M${cx - 13} 122 Q${cx} 131 ${cx + 13} 122 L${cx + 13} 134 Q${cx} 141 ${cx - 13} 134 Z" fill="${P.sangFonce11}"/>` +
  `<rect x="${cx - 15.5}" y="112" width="5" height="26" rx="2" fill="${P.boisMoyen23}"/>` +
  `<rect x="${cx + 10.5}" y="112" width="5" height="26" rx="2" fill="${P.boisMoyen23}"/>` +
  `<circle cx="${cx - 13}" cy="112" r="3.3" fill="${P.orMoyen9}"/><circle cx="${cx + 13}" cy="112" r="3.3" fill="${P.orMoyen9}"/></g>`;

/** Un fauteuil vu DE DOS (le public regarde la scène) : dossier bombé vers la caméra, rail haut doré,
 *  couture centrale ; l'assise est cachée derrière. */
const back = (cx: number) =>
  `<g><rect x="${cx - 13}" y="90" width="26" height="46" rx="10" fill="${P.sangFonce}"/>` + // dos sombre
  `<rect x="${cx - 10}" y="93" width="20" height="41" rx="8" fill="${P.sangFonce10}"/>` + // bombé clair
  `<rect x="${cx - 10}" y="93" width="20" height="6" rx="3" fill="${P.boisMoyen21}"/>` + // rail haut doré
  `<line x1="${cx}" y1="101" x2="${cx}" y2="131" stroke="${P.sangSombre5}" stroke-width="1.5" opacity="0.6"/>` + // couture
  `<rect x="${cx - 13}" y="131" width="4.5" height="8" fill="${P.boisSombre11}"/><rect x="${cx + 8.5}" y="131" width="4.5" height="8" fill="${P.boisSombre11}"/></g>`; // pieds entrevus

/** Un fauteuil vu de PROFIL (regarde à droite) : dossier étroit à gauche, assise qui saille à droite. */
const profileSeat = (cx: number) =>
  `<g><rect x="${cx - 12}" y="94" width="9" height="42" rx="4" fill="${P.sangFonce5}"/>` + // dossier de côté
  `<rect x="${cx - 11}" y="98" width="6" height="30" rx="3" fill="${P.sangFonce14}"/>` +
  `<rect x="${cx - 11}" y="98" width="6" height="6" rx="3" fill="${P.boisMoyen21}"/>` + // rail doré
  `<path d="M${cx - 3} 120 Q${cx + 3} 117 ${cx + 14} 121 L${cx + 14} 132 Q${cx + 3} 137 ${cx - 3} 133 Z" fill="${P.sangFonce11}"/>` + // assise de côté
  `<rect x="${cx - 5}" y="112" width="4" height="26" rx="2" fill="${P.boisMoyen23}"/>` +
  `<rect x="${cx + 10}" y="122" width="4" height="16" rx="2" fill="${P.boisMoyen23}"/>` +
  `<circle cx="${cx - 1}" cy="112" r="2.8" fill="${P.orMoyen9}"/></g>`;

export const prop: PropViz = {
  id: 'rangee-sieges',
  label: 'Rangée de fauteuils',
  views: {
    // Face/dos : quatre sièges alignés sur la largeur, posés sur le socle de bois.
    front: () => row([20, 48, 76, 104].map(front).join('')),
    back: () => row([20, 48, 76, 104].map(back).join('')),
    // Profil : la rangée vue de bout — un siège net + un fantôme reculé (velours plus sombre) pour
    // signaler la file dans la profondeur, sur le socle vu de tranche.
    profile: () =>
      row(
        `<g opacity="0.55" transform="translate(-16,-6)">${profileSeat(60)}</g>` + profileSeat(66),
      ),
  },
};

/** Socle de bois + ombre au sol de la rangée, dans la boîte 120×150. */
const row = (seats: string) =>
  `<g><ellipse cx="60" cy="147" rx="55" ry="9" fill="${P.ombre}" opacity="0.22"/>` +
  `<path d="M6 136 L114 136 L114 150 L6 150 Z" fill="${P.boisSombre11}"/>` +
  `<path d="M6 136 L114 136" stroke="${P.boisTresSombre3}" stroke-width="2"/>` +
  seats +
  `</g>`;
