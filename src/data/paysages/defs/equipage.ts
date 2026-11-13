import type { FamilleDeCouches } from '../types';
import { auCadreDeLEau, ROUTE } from '../formes';

const S = 'fill="var(--bg)"';
const T = 'fill="none" stroke="var(--bg)" stroke-linecap="round"';

/** Un cheval de profil tourné vers la droite, ses sabots au sol en `(x, ROUTE)`, à l'échelle `k`, au pas `phase`. */
function cheval(x: number, k: number, phase: 0 | 1, teinte = S): string {
  const pattes = phase
    ? [[-36, -40, -46, -18, -40, 0], [-22, -38, -18, -18, -26, 0], [28, -40, 40, -22, 34, 0], [40, -42, 30, -20, 44, -4]]
    : [[-36, -40, -30, -18, -38, 0], [-22, -38, -30, -20, -20, 0], [28, -40, 24, -20, 34, 0], [40, -42, 50, -24, 42, 0]];
  return `<g transform="translate(${x} ${ROUTE}) scale(${k})" ${teinte}>
    <path d="M-46 -58C-40 -70 -20 -72 0 -70C16 -69 28 -72 36 -82C40 -94 46 -104 56 -110L60 -118L64 -109C72 -104 80 -94 84 -86L80 -80L70 -84C64 -80 60 -74 58 -64C56 -52 50 -44 40 -40C24 -34 0 -34 -20 -36C-34 -38 -44 -44 -46 -58Z"/>
    <path d="M-44 -60C-56 -58 -62 -44 -60 -26C-56 -34 -52 -44 -44 -50Z"/>
    ${pattes.map(([a, b, c, d, e, f]) => `<path d="M${a - 5} ${b}L${c - 3.5} ${d}L${e - 3} ${f}L${e + 3.5} ${f}L${c + 3.5} ${d}L${a + 6} ${b}Z"/>`).join('')}</g>`;
}

/** Un cavalier en selle sur le cheval posé en `x` à l'échelle 0.86, sa lance à l'épaule quand `lance`. */
const cavalier = (x: number, lance: boolean) => `${cheval(x, 0.86, 1)}
    <path d="M${x - 16} ${ROUTE - 62}q-6 -30 6 -44q-4 -14 8 -16q12 0 10 14q10 10 8 30l10 16l-6 4l-12 -12l2 24l-8 26h-8l4 -26z" ${S}/>
    <path d="M${x - 16} ${ROUTE - 121}h30l-6 -5q-2 -9 -9 -9q-7 0 -9 9z" ${S}/>
    ${lance ? `<path d="M${x + 9} ${ROUTE - 112}L${x + 32} ${ROUTE - 170}" ${T} stroke-width="2.2"/>` : ''}`;

/** La coiffe d'un marcheur, sur sa tête en `(0, y)`. */
const COIFFES = {
  chapeau: (y: number) => `<path d="M-15 ${y - 4}h30l-6 -4q-2 -9 -9 -9q-7 0 -9 9z" ${S}/>`,
  capuche: (y: number) => `<path d="M-9 ${y + 8}q-2 -16 6 -20l8 -6q-1 8 4 12q3 6 1 14z" ${S}/>`,
  casque: (y: number) => `<path d="M-11 ${y - 2}q0 -12 11 -12q11 0 11 12z" ${S}/><path d="M-13 ${y - 2}h26" ${T} stroke-width="2.4"/>`,
  bonnet: (y: number) => `<path d="M-8 ${y - 3}l14 -22l3 22z" ${S}/>`,
};

/** Ce qu'un marcheur porte : un bâton devant lui, une arme d'hast à l'épaule, un sac au dos. */
const PORTS = {
  baton: (h: number) => `<path d="M13 ${-h * 0.7}L17 0" ${T} stroke-width="2.6"/><path d="M13 ${-h * 0.7}L12 ${-h - 10}" ${T} stroke-width="2.6"/>`,
  hast: (h: number) => `<path d="M-14 ${-h * 0.28}L22 ${-h - 34}" ${T} stroke-width="2.6"/><path d="M22 ${-h - 34}l2 -14l5 10z" ${S}/>`,
  sac: (h: number) => `<path d="M-10 ${-h + 22}q-14 2 -14 20q0 14 8 18l8 -2z" ${S}/>`,
};

/** Un marcheur en cape tourné vers la droite, ses pieds au sol en `(x, ROUTE)`, haut de `h`, sa coiffe et ce qu'il porte. */
const marcheur = (x: number, h: number, coiffe: keyof typeof COIFFES, port: keyof typeof PORTS, pas: number) => `<g transform="translate(${x} ${ROUTE})">
    <circle cx="2" cy="${-h + 9}" r="8" ${S}/>${COIFFES[coiffe](-h + 9)}
    <path d="M-9 ${-h + 18}L11 ${-h + 18}L17 ${-h * 0.3}L-15 ${-h * 0.3}Z" ${S}/>
    <path d="M-4 ${-h * 0.32}L${-4 - pas} 0M6 ${-h * 0.32}L${6 + pas} 0" ${T} stroke-width="5"/>
    ${PORTS[port](h)}</g>`;

/** L'abscisse de la diligence, grandie de 1.1 autour de `(X, ROUTE)`. */
const X = 680;

/** Une roue à rayons de rayon `r`, son moyeu en `cx`. */
const roue = (cx: number, r: number) => `<circle cx="${cx}" cy="${ROUTE - r}" r="${r}" ${T} stroke-width="6"/><circle cx="${cx}" cy="${ROUTE - r}" r="${r * 0.2}" ${S}/>
    <path d="${Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5 + 0.2; return `M${cx} ${ROUTE - r}L${(cx + Math.cos(a) * r).toFixed(1)} ${(ROUTE - r + Math.sin(a) * r).toFixed(1)}`; }).join('')}" ${T} stroke-width="2.4"/>`;

/* L'équipage du voyage sur son relief : marcheurs, cavaliers et diligence sur la route de `relief-route`, la barge sur
   `relief-fleuve`, le navire sur `relief-mer`. Sa lanterne est la couche `lanterne-…` du même nom. */
export const couches: FamilleDeCouches = [
  {
    id: 'equipage-pied',
    label: 'Marcheurs',
    svg: `${marcheur(712, 96, 'capuche', 'sac', 7)}${marcheur(776, 84, 'bonnet', 'baton', -5)}${marcheur(842, 104, 'casque', 'hast', 6)}${marcheur(906, 98, 'chapeau', 'baton', -4)}` },
  {
    id: 'equipage-monture',
    label: 'Cavaliers',
    svg: `${cavalier(660, true)}${cavalier(820, false)}${cavalier(980, true)}` },
  {
    id: 'equipage-attelage',
    label: 'Diligence',
    svg: `<g transform="translate(${X} ${ROUTE}) scale(1.1) translate(${-X} ${-ROUTE})">
    ${cheval(X + 322, 0.84, 1, 'fill="var(--lisiere)"')}${cheval(X + 300, 0.9, 0)}
    <path d="M${X + 178} ${ROUTE - 44}L${X + 350} ${ROUTE - 52}" ${T} stroke-width="3"/>
    <path d="M${X + 196} ${ROUTE - 112}L${X + 352} ${ROUTE - 84}" ${T} stroke-width="1.3"/>
    <path d="M${X + 8} ${ROUTE - 118}q0 -10 10 -10h126q10 0 12 10l8 58q2 16 -14 18h-136q-14 -2 -12 -18z" ${S}/>
    <path d="M${X + 2} ${ROUTE - 130}h156l-6 -9h-144z" ${S}/>
    <path d="M${X + 22} ${ROUTE - 139}v-13q0 -4 4 -4h30q4 0 4 4v13zM${X + 66} ${ROUTE - 139}v-9h34v9zM${X + 106} ${ROUTE - 139}v-17q0 -3 3 -3h20q3 0 3 3v17z" ${S}/>
    <path d="M${X + 160} ${ROUTE - 96}h34q6 0 6 6v40h-36z" ${S}/>
    <path d="M${X + 170} ${ROUTE - 96}q-4 -22 6 -32q-3 -12 7 -14q11 0 10 12q8 8 8 22l14 10l-3 5l-18 -8v5z" ${S}/>
    <path d="M${X + 168} ${ROUTE - 140}h34l-5 -5h-6q-2 -10 -8 -10q-6 0 -8 10h-3z" ${S}/>
    <rect x="${X + 28}" y="${ROUTE - 112}" width="34" height="28" rx="3" fill="var(--gold2)" opacity="0.82"/>
    <rect x="${X + 72}" y="${ROUTE - 112}" width="26" height="28" rx="3" fill="var(--gold2)" opacity="0.7"/>
    <path d="M${X + 36} ${ROUTE - 84}q0 -18 9 -18q9 0 9 18z" ${S}/>
    ${roue(X + 42, 36)}${roue(X + 150, 29)}
    ${cavalier(X - 150, true)}
    <path d="M${X + 196} ${ROUTE - 132}L${X + 206} ${ROUTE - 134}" ${T} stroke-width="2"/></g>` },
  {
    id: 'equipage-barge',
    label: 'Barge',
    svg: auCadreDeLEau(`<g transform="translate(0 -40)">
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
    </g></g>`) },
  {
    id: 'equipage-navire',
    label: 'Navire',
    svg: auCadreDeLEau(`<g transform="translate(0 -40)">
    <g transform="translate(320 150)">
      <path d="M0 78 L200 78 L184 104 L22 104 Z" ${S}/>
      <path d="M176 78 L214 66 L200 78 Z" ${S}/>
      <path d="M0 78 L-6 60 L26 78 Z" ${S}/>
      <path d="M64 78 L64 -30 M132 78 L132 -14" ${T} stroke-width="3.4"/>
      <path d="M36 -12 Q64 -4 94 -14 L90 34 Q64 44 40 34 Z" fill="var(--parchment)" opacity="0.5"/>
      <path d="M110 2 Q132 9 156 0 L152 40 Q132 48 114 40 Z" fill="var(--parchment)" opacity="0.44"/>
      <path d="M64 -30 l18 5 l-18 5 Z" fill="var(--accent)"/>
      <path d="M-14 106 q28 -6 56 0 t56 0 t56 0 t56 0" fill="none" stroke="var(--parchment)" stroke-width="1.4" stroke-linecap="round" opacity="0.18"/>
    </g></g>`) },
];
