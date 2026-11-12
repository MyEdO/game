import type { FamilleDeCouches } from '../types';

const S = 'fill="var(--bg)"';
const T = 'fill="none" stroke="var(--bg)" stroke-linecap="round"';

/** Un cheval de profil tourné vers la droite, ses sabots au sol en `y = 62`, son poitrail vers `x = 46`. */
const CHEVAL = `
    <ellipse cx="24" cy="38" rx="18" ry="9.5" ${S}/>
    <path d="M34 34 L46 16 L53 20 L44 42 Z" ${S}/>
    <path d="M45 15 L58 20 L56 26 L46 23 Z" ${S}/>
    <path d="M47 14 l2 -5 l3 5 Z" ${S}/>
    <path d="M8 34 C2 38 2 46 4 52" ${T} stroke-width="3"/>
    <path d="M12 44 L10 62 M19 46 L20 62 M31 46 L30 62 M37 43 L40 62" ${T} stroke-width="3.2"/>`;

/** Un cavalier en selle sur le cheval de `CHEVAL`. */
const CAVALIER = `
    <path d="M17 32 L20 10 L31 10 L34 32 Z" ${S}/>
    <circle cx="26" cy="5" r="5" ${S}/>
    <path d="M22 30 L20 46" ${T} stroke-width="3.4"/>`;

/** Un marcheur en cape, ses pieds au sol en `y = 62`, haut de `h`, un bâton à la main quand `baton`. */
const marcheur = (h: number, baton: boolean) => `
    <circle cx="0" cy="${62 - h + 4}" r="4.2" ${S}/>
    <path d="M-4 ${62 - h + 8} L4 ${62 - h + 8} L8 ${62 - h * 0.34} L-8 ${62 - h * 0.34} Z" ${S}/>
    <path d="M-3 ${62 - h * 0.36} L-5 62 M3 ${62 - h * 0.36} L5 62" ${T} stroke-width="3"/>
    ${baton ? `<path d="M10 ${62 - h + 6} L11 62" ${T} stroke-width="1.6"/>` : ''}`;

/** `dessin` posé ses pieds au sol en `(x, sol)`, à l'échelle `echelle`. */
const pose = (x: number, sol: number, echelle: number, dessin: string) => `<g transform="translate(${x} ${(sol - 62 * echelle).toFixed(1)}) scale(${echelle})">${dessin}</g>`;

/* L'équipage du voyage sur son relief : marcheurs, cavaliers et attelage sur la route de `relief-terre`, la barge sur
   `relief-fleuve`, le navire sur `relief-mer`. Sa lanterne est la couche `lanterne-…` du même nom. */
export const couches: FamilleDeCouches = [
  {
    id: 'equipage-pied',
    label: 'Marcheurs',
    svg: `<g transform="translate(0 -40)">
    ${pose(286, 313, 1.4, marcheur(30, false))}
    ${pose(322, 310, 1.4, marcheur(33, true))}
    ${pose(358, 307, 1.4, marcheur(29, false))}
    ${pose(396, 303, 1.4, marcheur(32, true))}
</g>` },
  {
    id: 'equipage-monture',
    label: 'Cavaliers',
    svg: `<g transform="translate(0 -40)">
    ${pose(236, 316, 1.2, CHEVAL + CAVALIER)}
    ${pose(318, 309, 1.2, CHEVAL + CAVALIER)}
    ${pose(400, 302, 1.2, CHEVAL + CAVALIER)}
</g>` },
  {
    id: 'equipage-attelage',
    label: 'Attelage',
    svg: `<g transform="translate(0 -40)">
    <g transform="translate(280 233.6) scale(1.2)">
      <rect x="6" y="6" width="92" height="9" rx="3" ${S}/>
      <path d="M22 6 q6 -8 16 0 M50 6 q8 -7 18 0" ${S}/>
      <rect x="10" y="13" width="84" height="38" rx="6" ${S}/>
      <rect x="22" y="21" width="24" height="15" rx="2" fill="var(--gold2)" opacity="0.82"/>
      <rect x="56" y="21" width="24" height="15" rx="2" fill="var(--gold2)" opacity="0.82"/>
      <circle cx="30" cy="52" r="12" ${T} stroke-width="4.2"/>
      <circle cx="76" cy="52" r="12" ${T} stroke-width="4.2"/>
      <circle cx="30" cy="52" r="2.4" ${S}/><circle cx="76" cy="52" r="2.4" ${S}/>
      <path d="M96 20 L104 18 L106 34 L96 36 Z" ${S}/>
      <circle cx="103" cy="12" r="4.4" ${S}/>
      <path d="M94 44 L128 46" ${T} stroke-width="2.4"/>
      <g transform="translate(118 -2)">${CHEVAL}</g>
    </g></g>` },
  {
    id: 'equipage-barge',
    label: 'Barge',
    svg: `<g transform="translate(0 -40)">
    <g transform="translate(290 240)">
      <path d="M0 40 L170 40 L158 56 L14 56 Z" ${S}/>
      <rect x="34" y="22" width="62" height="19" rx="2" ${S}/>
      <rect x="44" y="27" width="14" height="9" rx="1.5" fill="var(--gold2)" opacity="0.82"/>
      <rect x="70" y="27" width="14" height="9" rx="1.5" fill="var(--gold2)" opacity="0.82"/>
      <path d="M118 40 L118 -22" ${T} stroke-width="3"/>
      <path d="M96 -12 L140 -16" ${T} stroke-width="2.4"/>
      <path d="M98 -11 Q118 -2 138 -15 L138 -9 Q118 4 98 -5 Z" fill="var(--parchment)" opacity="0.5"/>
      <path d="M6 44 L-26 62" ${T} stroke-width="2.2"/>
      <path d="M-6 58 L182 58" fill="none" stroke="var(--parchment)" stroke-width="1.2" stroke-linecap="round" opacity="0.14"/>
    </g></g>` },
  {
    id: 'equipage-navire',
    label: 'Navire',
    svg: `<g transform="translate(0 -40)">
    <g transform="translate(320 150)">
      <path d="M0 78 L200 78 L184 104 L22 104 Z" ${S}/>
      <path d="M176 78 L214 66 L200 78 Z" ${S}/>
      <path d="M0 78 L-6 60 L26 78 Z" ${S}/>
      <path d="M64 78 L64 -30 M132 78 L132 -14" ${T} stroke-width="3.4"/>
      <path d="M36 -12 Q64 -4 94 -14 L90 34 Q64 44 40 34 Z" fill="var(--parchment)" opacity="0.5"/>
      <path d="M110 2 Q132 9 156 0 L152 40 Q132 48 114 40 Z" fill="var(--parchment)" opacity="0.44"/>
      <path d="M64 -30 l18 5 l-18 5 Z" fill="var(--accent)"/>
      <path d="M-14 106 q28 -6 56 0 t56 0 t56 0 t56 0" fill="none" stroke="var(--parchment)" stroke-width="1.4" stroke-linecap="round" opacity="0.18"/>
    </g></g>` },
];
