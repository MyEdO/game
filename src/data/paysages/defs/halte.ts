import type { FamilleDeCouches } from '../types';
import { auCadreDeLaHalte } from '../formes';
import { lueur } from '../lueur';

const S = 'fill="var(--bg)"';
const T = 'fill="none" stroke="var(--bg)" stroke-linecap="round"';
const FUMEE = 'fill="none" stroke="var(--parchment)" stroke-width="3" stroke-linecap="round" opacity="0.12"';

/** Un dormeur assis près du feu, en `x`, le sol en `y = 298`. */
const assis = (x: number) => `<circle cx="${x}" cy="278" r="4.6" ${S}/><path d="M${x - 7} 298 L${x - 6} 287 Q${x} 280 ${x + 6} 287 L${x + 8} 298 Z" ${S}/>`;

/* Le toit de la nuit au bord de la route de `relief-route` : le feu d'un campement, ou les fenêtres d'un logis. */
export const couches: FamilleDeCouches = [
  {
    id: 'halte-feu',
    label: 'Campement et son feu',
    svg: auCadreDeLaHalte(`<g transform="translate(0 -40)">${lueur('halte-feu-lueur', 400, 288, 120, 0.6)}
    <path d="M286 298 L322 256 L358 298 Z" ${S}/>
    <path d="M322 256 L326 298" fill="none" stroke="var(--parchment)" stroke-width="1" opacity="0.14"/>
    <path d="M462 298 L486 268 L510 298 Z" ${S}/>
    ${assis(372)}${assis(430)}${assis(446)}
    <path d="M400 268 q-7 -14 2 -27 t-1 -26" ${FUMEE}/>
    <path d="M388 299 L412 294 M388 294 L412 299" ${T} stroke-width="3.4"/>
    <path d="M400 297 C390 288 397 281 400 269 C405 281 411 287 400 297 Z" fill="var(--gold2)"/>
    <path d="M400 296 C396 291 399 287 400 281 C402 287 405 291 400 296 Z" fill="var(--parchment)" opacity="0.85"/></g>`) },
  {
    id: 'halte-toit',
    label: 'Logis aux fenêtres éclairées',
    svg: auCadreDeLaHalte(`<g transform="translate(0 -40)">${lueur('halte-toit-lueur', 376, 276, 130, 0.42)}
    <path d="M402 214 q-8 -14 2 -28 t-2 -26" ${FUMEE}/>
    <rect x="394" y="198" width="13" height="24" ${S}/>
    <path d="M292 256 L326 212 L420 212 L454 256 Z" ${S}/>
    <rect x="304" y="252" width="138" height="46" ${S}/>
    <path d="M442 298 L442 270 L488 280 L488 298 Z" ${S}/>
    <rect x="318" y="264" width="16" height="15" rx="1.5" fill="var(--gold2)" opacity="0.86"/>
    <rect x="344" y="264" width="16" height="15" rx="1.5" fill="var(--gold2)" opacity="0.86"/>
    <rect x="412" y="264" width="16" height="15" rx="1.5" fill="var(--gold2)" opacity="0.86"/>
    <rect x="352" y="226" width="13" height="12" rx="1.5" fill="var(--gold2)" opacity="0.5"/>
    <rect x="376" y="268" width="19" height="30" rx="2" fill="var(--gold2)" opacity="0.55"/>
    <path d="M274 298 L274 254 L296 254" ${T} stroke-width="3"/>
    <rect x="278" y="258" width="15" height="12" rx="1" ${S}/></g>`) },
];
