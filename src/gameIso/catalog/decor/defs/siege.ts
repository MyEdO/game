import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Un SEUL fauteuil d'opéra (1×1) : velours rouge + dorures. Contrairement à `rangee-sieges` (bloc 3×1
// figé), un siège occupe UNE case → trois sièges alignés se RÉORIENTENT correctement quand on tourne la
// caméra. Prop ORIENTÉ : il déclare ses trois vues ; la machinerie (`propSvg`) choisit la vue + le
// miroir via `project(dir, camRot)` (cf. `PropViz.views` / `rig/facing.ts`). Le profil est dessiné
// tourné vers la DROITE (le profil gauche = miroir, appliqué par la machinerie).

/** Un fauteuil vu de FACE (assise + dossier vers la caméra), centré sur cx, pieds ~y=147. */
const front = (cx: number) =>
  `<g><rect x="${cx - 24}" y="74" width="48" height="58" rx="15" fill="${P.sangFonce5}"/>` +
  `<rect x="${cx - 17}" y="80" width="34" height="46" rx="11" fill="${P.sangFonce14}"/>` +
  `<rect x="${cx - 17}" y="80" width="34" height="12" rx="5" fill="${P.boisMoyen21}"/>` +
  `<path d="M${cx - 24} 119 Q${cx} 133 ${cx + 24} 119 L${cx + 24} 138 Q${cx} 150 ${cx - 24} 138 Z" fill="${P.sangFonce11}"/>` +
  `<rect x="${cx - 28}" y="103" width="9" height="44" rx="3" fill="${P.boisMoyen23}"/>` +
  `<rect x="${cx + 19}" y="103" width="9" height="44" rx="3" fill="${P.boisMoyen23}"/>` +
  `<circle cx="${cx - 24}" cy="103" r="5.5" fill="${P.orMoyen9}"/><circle cx="${cx + 24}" cy="103" r="5.5" fill="${P.orMoyen9}"/></g>`;

/** Un fauteuil vu DE DOS (le public regarde la scène) : dossier bombé vers la caméra, rail haut doré,
 *  couture centrale ; l'assise est cachée derrière. Centré sur cx, pieds ~y=147. */
const back = (cx: number) =>
  `<g><rect x="${cx - 24}" y="66" width="48" height="74" rx="17" fill="${P.sangFonce}"/>` + // dos sombre
  `<rect x="${cx - 18}" y="71" width="36" height="66" rx="13" fill="${P.sangFonce10}"/>` + // bombé clair
  `<rect x="${cx - 18}" y="71" width="36" height="10" rx="5" fill="${P.boisMoyen21}"/>` + // rail haut doré
  `<line x1="${cx}" y1="84" x2="${cx}" y2="133" stroke="${P.sangSombre5}" stroke-width="2.5" opacity="0.6"/>` + // couture
  `<rect x="${cx - 24}" y="133" width="8" height="14" fill="${P.boisSombre11}"/><rect x="${cx + 16}" y="133" width="8" height="14" fill="${P.boisSombre11}"/></g>`; // pieds entrevus

/** Un fauteuil vu de PROFIL (regarde à droite) : dossier étroit à gauche, assise qui saille vers la
 *  droite, un accoudoir doré ; deux pieds décalés en profondeur. Centré sur cx, pieds ~y=147. */
const profile = (cx: number) =>
  `<g><rect x="${cx - 22}" y="74" width="16" height="66" rx="6" fill="${P.sangFonce5}"/>` + // dossier de côté
  `<rect x="${cx - 20}" y="80" width="11" height="52" rx="4" fill="${P.sangFonce14}"/>` + // capiton
  `<rect x="${cx - 20}" y="80" width="11" height="10" rx="4" fill="${P.boisMoyen21}"/>` + // rail haut doré
  `<path d="M${cx - 6} 114 Q${cx + 6} 110 ${cx + 26} 116 L${cx + 26} 132 Q${cx + 6} 139 ${cx - 6} 134 Z" fill="${P.sangFonce11}"/>` + // assise de côté
  `<rect x="${cx - 8}" y="103" width="8" height="44" rx="3" fill="${P.boisMoyen23}"/>` + // pied arrière
  `<rect x="${cx + 19}" y="120" width="8" height="27" rx="3" fill="${P.boisMoyen23}"/>` + // pied avant
  `<circle cx="${cx - 3}" cy="112" r="5.5" fill="${P.orMoyen9}"/></g>`; // dorure d'accoudoir

/** Ombre au sol + dessin d'une vue, dans la boîte 120×150. */
const body = (view: (cx: number) => string) =>
  `<g><ellipse cx="60" cy="147" rx="28" ry="7" fill="${P.ombre}" opacity="0.22"/>${view(60)}</g>`;

export const prop: PropViz = {
  id: 'siege',
  label: 'Siège',
  searchable: false,
  views: {
    front: () => body(front),
    profile: () => body(profile),
    back: () => body(back),
  },
};
