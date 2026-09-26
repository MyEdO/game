import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Canapé capitonné de velours et dorures : le siège d'honneur de la LOGE ROYALE (30) et du Salon des
// Seigneurs (39) du théâtre. Prop DIRECTIONNEL (1×1) : il déclare ses trois vues ; la machinerie
// (`propSvg`) choisit la vue + le miroir via `project(dir, camRot)` (cf. `PropViz.views`). Le profil est
// dessiné tourné vers la DROITE — le profil gauche = miroir. Cf. plan officiel NADJ 08 folio 39 (image).
const front = (cx: number) =>
  `<g><rect x="${cx - 38}" y="84" width="76" height="56" rx="12" fill="${P.sangFonce2}"/>` + // dossier
  `<rect x="${cx - 34}" y="90" width="68" height="20" rx="8" fill="${P.sangFonce12}"/>` + // capiton haut
  `<rect x="${cx - 34}" y="90" width="68" height="8" rx="4" fill="${P.boisMoyen21}"/>` + // rail doré
  `<path d="M${cx - 38} 112 Q${cx} 126 ${cx + 38} 112 L${cx + 38} 138 Q${cx} 150 ${cx - 38} 138 Z" fill="${P.sangFonce14}"/>` + // assise
  `<path d="M${cx - 18} 96 L${cx - 18} 120 M${cx + 18} 96 L${cx + 18} 120" stroke="${P.sangFonce}" stroke-width="2" opacity="0.6"/>` + // capitons
  `<rect x="${cx - 42}" y="104" width="10" height="40" rx="4" fill="${P.sangFonce5}"/><rect x="${cx + 32}" y="104" width="10" height="40" rx="4" fill="${P.sangFonce5}"/>` + // accoudoirs
  `<circle cx="${cx - 37}" cy="108" r="4" fill="${P.orMoyen9}"/><circle cx="${cx + 37}" cy="108" r="4" fill="${P.orMoyen9}"/></g>`;

const back = (cx: number) =>
  `<g><rect x="${cx - 38}" y="78" width="76" height="64" rx="14" fill="${P.sangSombre6}"/>` +
  `<rect x="${cx - 32}" y="83" width="64" height="54" rx="11" fill="${P.sangFonce5}"/>` +
  `<rect x="${cx - 32}" y="83" width="64" height="10" rx="5" fill="${P.boisMoyen21}"/>` +
  `<line x1="${cx - 12}" y1="96" x2="${cx - 12}" y2="134" stroke="${P.sangSombre4}" stroke-width="2" opacity="0.6"/>` +
  `<line x1="${cx + 12}" y1="96" x2="${cx + 12}" y2="134" stroke="${P.sangSombre4}" stroke-width="2" opacity="0.6"/></g>`;

/** Canapé vu de PROFIL (regarde à droite) : dossier à gauche, longue assise, accoudoir bombé à droite. */
const profile = (cx: number) =>
  `<g><rect x="${cx - 34}" y="82" width="22" height="58" rx="10" fill="${P.sangFonce2}"/>` + // dossier de côté
  `<rect x="${cx - 30}" y="88" width="14" height="26" rx="7" fill="${P.sangFonce12}"/>` + // capiton
  `<rect x="${cx - 30}" y="88" width="14" height="8" rx="4" fill="${P.boisMoyen21}"/>` + // rail doré
  `<path d="M${cx - 14} 112 Q${cx} 122 ${cx + 34} 114 L${cx + 34} 138 Q${cx} 148 ${cx - 14} 140 Z" fill="${P.sangFonce14}"/>` + // assise longue
  `<rect x="${cx + 26}" y="100" width="12" height="42" rx="6" fill="${P.sangFonce5}"/>` + // accoudoir avant
  `<circle cx="${cx + 32}" cy="106" r="4" fill="${P.orMoyen9}"/></g>`;

/** Ombre au sol + dessin d'une vue, dans la boîte 120×150. */
const body = (view: (cx: number) => string) =>
  `<g><ellipse cx="60" cy="147" rx="42" ry="8" fill="${P.ombre}" opacity="0.22"/>${view(60)}</g>`;

export const prop: PropViz = {
  id: 'canape',
  label: 'Canapé',
  views: {
    front: () => body(front),
    profile: () => body(profile),
    back: () => body(back),
  },
};
