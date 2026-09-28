import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Canon de pont (#342, chantier A2 — meubles marins) : pièce navale COURTE en fer noirci sur affût-truck
// (caisse basse en bois à 4 petites roues pleines) retenue par sa brague (grosse corde de chanvre).
// Prop ORIENTÉ : face = la GUEULE (bouche ronde vers la caméra), profil = le TUBE (vers la DROITE ;
// le gauche = miroir par la machinerie), dos = la CULASSE (bouton de brague). Boîte 120×150, pieds ~y=147.

/** Ombre au sol commune, dans la boîte 120×150. */
const shadow = `<ellipse cx="60" cy="147" rx="40" ry="8" fill="${P.ombre}" opacity="0.22"/>`;

/** Petite roue pleine d'affût-truck (disque bois cerclé), centrée (cx, cy). */
const wheel = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.boisSombre7}"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="${P.boisFonce12}"/>` +
  `<circle cx="${cx}" cy="${cy}" r="3" fill="${P.boisSombre16}"/>`;

/** PROFIL (gueule vers la DROITE) : tube fuselé à renforts, cascabel à gauche, affût à 2 roues visibles,
 *  brague qui retombe derrière la culasse. */
const profile = () =>
  `<g>${shadow}` +
  // brague (corde de chanvre) : de la culasse vers le pont, derrière l'affût
  `<path d="M20 96 Q8 118 14 142" stroke="${P.boisClair11}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
  `<path d="M20 96 Q8 118 14 142" stroke="${P.boisMoyen10}" stroke-width="2" fill="none" stroke-dasharray="3 3"/>` +
  // affût-truck : flasque de bois en escalier (haut à la culasse, bas à la gueule)
  `<path d="M28 106 L64 106 L74 118 L96 118 L96 138 L28 138 Z" fill="${P.boisFonce12}"/>` +
  `<path d="M28 106 L64 106 L74 118 L96 118 L96 123 L28 123 Z" fill="${P.boisFonce4}" opacity="0.55"/>` +
  `<path d="M46 106 L46 138 M78 118 L78 138" stroke="${P.boisSombre5}" stroke-width="2.5"/>` +
  // tube : fuselé vers la droite, légèrement pointé vers le haut
  `<circle cx="20" cy="97" r="6" fill="${P.pierreSombre7}"/>` + // cascabel
  `<path d="M26 88 L102 91 L102 101 L26 108 Z" fill="${P.pierreSombre7}"/>` +
  `<path d="M26 90 L102 92.5 L102 95 L26 96 Z" fill="${P.pierreFonce}" opacity="0.8"/>` + // reflet du fût
  // renforts (astragales de bronze) + bourrelet de bouche
  `<rect x="42" y="87" width="5" height="21" rx="2" fill="${P.orFonce2}"/>` +
  `<rect x="68" y="88.5" width="5" height="17" rx="2" fill="${P.orFonce2}"/>` +
  `<rect x="99" y="88" width="7" height="16" rx="3" fill="${P.pierreFonce2}"/>` +
  `<ellipse cx="106" cy="96" rx="3.5" ry="8" fill="${P.pierreSombre2}"/>` + // bouche
  // roues (avant proche de la gueule, arrière à la culasse) + essieux
  `${wheel(40, 139, 9)}${wheel(86, 139, 9)}</g>`;

/** FACE (la GUEULE vers la caméra) : grosse bouche ronde noire centrée, affût et roues entrevus derrière. */
const front = () =>
  `<g>${shadow}` +
  // affût vu de face : caisse basse, roues gauche/droite qui dépassent
  `<rect x="34" y="112" width="52" height="28" rx="3" fill="${P.boisFonce12}"/>` +
  `<rect x="34" y="112" width="52" height="6" fill="${P.boisFonce4}" opacity="0.55"/>` +
  `${wheel(30, 139, 9)}${wheel(90, 139, 9)}` +
  // tube en raccourci : la bouche = gros anneau, l'âme noire au centre
  `<circle cx="60" cy="96" r="19" fill="${P.pierreSombre7}"/>` +
  `<circle cx="60" cy="96" r="19" fill="none" stroke="${P.pierreFonce}" stroke-width="2.5"/>` +
  `<circle cx="60" cy="96" r="14" fill="none" stroke="${P.orFonce2}" stroke-width="3"/>` + // astragale de bouche
  `<circle cx="60" cy="96" r="10" fill="${P.ombre2}"/>` + // l'âme
  `<path d="M50 88 A13 13 0 0 1 60 84" stroke="${P.pierreTresClair}" stroke-width="2" fill="none" opacity="0.5"/></g>`;

/** DOS (la CULASSE vers la caméra) : plat de culasse rond, bouton de cascabel, brague qui traverse,
 *  la volée cachée derrière. */
const back = () =>
  `<g>${shadow}` +
  // affût vu de dos : caisse + roues arrière
  `<rect x="32" y="110" width="56" height="30" rx="3" fill="${P.boisFonce12}"/>` +
  `<path d="M32 118 h56 M32 128 h56" stroke="${P.boisSombre5}" stroke-width="2"/>` +
  `${wheel(28, 139, 9)}${wheel(92, 139, 9)}` +
  // plat de culasse : disque de fer bordé, plus petit que la bouche (le tube fuit vers l'arrière-plan)
  `<circle cx="60" cy="98" r="16" fill="${P.pierreSombre7}"/>` +
  `<circle cx="60" cy="98" r="16" fill="none" stroke="${P.pierreFonce}" stroke-width="2.5"/>` +
  `<circle cx="60" cy="98" r="5.5" fill="${P.pierreFonce2}"/>` + // bouton de cascabel
  `<circle cx="60" cy="98" r="5.5" fill="none" stroke="${P.pierreSombre2}" stroke-width="1.5"/>` +
  // brague passée sur le bouton, retombant des deux bords vers le pont
  `<path d="M22 132 Q40 100 60 98 Q80 100 98 132" stroke="${P.boisClair11}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
  `<path d="M22 132 Q40 100 60 98 Q80 100 98 132" stroke="${P.boisMoyen10}" stroke-width="2" fill="none" stroke-dasharray="3 3"/></g>`;

export const prop: PropViz = {
  id: 'canon-de-pont',
  label: 'Canon de pont',
  searchable: false,
  views: {
    front: () => front(),
    profile: () => profile(),
    back: () => back(),
  },
};
