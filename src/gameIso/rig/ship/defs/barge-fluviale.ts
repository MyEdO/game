/**
 * BARGE FLUVIALE (MSLRC 33, ~15 m) — péniche du Reik à FOND PLAT : muraille DROITE d'un bout à
 * l'autre (aucune tonture), proue-RAMPE remontant en plan incliné (« swim-head »), tableau arrière
 * quasi vertical, ROUF d'habitation pris dans la coque (hiloire commune, hublots, poêle), petit
 * mât à LIVARDE (voile aurique établie vers l'arrière sur son espar diagonal), timon de godille.
 */
import type { ShipArtDef } from '../artkit';
import { pennant, spar, timon } from '../artkit';

function profile(): string {
  return '<g>'
    // Gréement à LIVARDE : mât court à l'avant du rouf, voile aurique établie vers l'arrière,
    // espar diagonal du talon du mât au pic.
    + spar(13, -8, 13, -42, 2.2)
    + '<path d="M13 -38 L0 -41 Q-3 -29.5 0.5 -18.5 L13 -16 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M8.4 -37.6 Q6.6 -27.5 8.4 -17" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4" fill="none"/>'
    + spar(13, -13, 0, -41, 1.6)
    + pennant(13, -42, 6)
    // Coque à FOND PLAT : lisse rectiligne, tableau arrière quasi vertical, proue-rampe inclinée.
    + '<path d="M-26 -9.5 L27 -9.5 L17.5 -1 L-23.5 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-26 -9.5 L27 -9.5" stroke="@coqueH" stroke-width="1.3"/>'
    // Préceinte + virure basses, DROITES (fond plat, pas de tonture).
    + '<path d="M-25.3 -6.8 L24.2 -6.8" stroke="@coqueO" stroke-width="1.1" opacity="0.7"/>'
    + '<path d="M-24.6 -4 L21 -4" stroke="@coqueO" stroke-width="0.7" opacity="0.45"/>'
    // Bordage du plan incliné de proue.
    + '<path d="M18.8 -1.8 L26.2 -8.4" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // Bittes d'amarrage jumelles de proue.
    + '<path d="M22 -9.5 l0 -2.6 M24.6 -9.5 l0 -2.6" stroke="@matO" stroke-width="1.4" stroke-linecap="round"/>'
    // ROUF d'habitation intégré : hiloire commune avec la coque, toit débordant, hublots, poêle.
    + '<rect x="-20" y="-17" width="21" height="7.5" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-21 -9.7 L2 -9.7" stroke="@coqueO" stroke-width="1.6"/>'
    + '<path d="M-21.5 -17 Q-9.5 -18.8 2.5 -17" stroke="@matO" stroke-width="1.9" stroke-linecap="round" fill="none"/>'
    + '<circle cx="-16" cy="-13.2" r="1.2" fill="@toileDeVoileH"/><circle cx="-10.5" cy="-13.2" r="1.2" fill="@toileDeVoileH"/><circle cx="-5" cy="-13.2" r="1.2" fill="@toileDeVoileH"/>'
    + '<rect x="-2.4" y="-15.4" width="3.1" height="5.7" fill="@matO" stroke="@coqueO" stroke-width="0.7"/>'
    + spar(-17, -18, -17, -21.5, 1.4)
    // Fret en pontée sur le pont avant.
    + '<rect x="5.2" y="-13.8" width="4.6" height="4.3" rx="1.9" fill="@mat" stroke="@coqueO" stroke-width="0.8"/>'
    + '<path d="M5.2 -11.6 l4.6 0" stroke="@coqueO" stroke-width="0.7" opacity="0.6"/>'
    // Timon de godille à l'arrière.
    + timon(-25.5, -11.5)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Rouf (face avant, porte) émergeant au-dessus du pavois, loin derrière la proue.
    + '<rect x="-7" y="-16.5" width="14" height="7.2" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-8 -16.5 Q0 -18.3 8 -16.5" stroke="@matO" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
    + '<rect x="-1.8" y="-14.6" width="3.6" height="5.3" fill="@matO" stroke="@coqueO" stroke-width="0.7"/>'
    // Mât au centre, voile à livarde vue de CHANT (mince fuseau fuyant vers l'arrière).
    + spar(0, -10, 0, -42, 2.2)
    + '<path d="M1.1 -40 L2.9 -38.4 L3.5 -19 L1.1 -17.5 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.8"/>'
    + pennant(0, -42, 6)
    // PROUE-RAMPE frontale : muraille trapézoïdale, fond plat étroit, virures horizontales.
    + '<path d="M-9.5 -9.5 L9.5 -9.5 L7 -1 L-7 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-9.5 -9.5 L9.5 -9.5" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-8.8 -7 L8.8 -7 M-8 -4.5 L8 -4.5" stroke="@coqueO" stroke-width="0.8" opacity="0.55"/>'
    // Bittes d'amarrage jumelles.
    + '<path d="M-6.4 -9.5 l0 -2.4 M6.4 -9.5 l0 -2.4" stroke="@matO" stroke-width="1.5" stroke-linecap="round"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Mât au-dessus du rouf, voile de chant côté opposé, flamme.
    + spar(0, -16, 0, -42, 2)
    + '<path d="M-1 -40 L-2.8 -38.4 L-3.4 -19.5 L-1 -18 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="0.8"/>'
    + pennant(0, -42, 6)
    // Rouf, face ARRIÈRE : toit débordant, deux hublots, cheminée du poêle.
    + '<rect x="-7.5" y="-17" width="15" height="7.5" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-8.6 -17 Q0 -18.8 8.6 -17" stroke="@matO" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
    + '<circle cx="-3.4" cy="-13.4" r="1.3" fill="@toileDeVoileH"/><circle cx="3.4" cy="-13.4" r="1.3" fill="@toileDeVoileH"/>'
    + spar(-5.6, -18.6, -5.6, -22, 1.4)
    // TABLEAU arrière plat : planche trapézoïdale à virures horizontales, fond plat étroit.
    + '<path d="M-9.5 -9.5 L9.5 -9.5 L7.5 -1 L-7.5 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-9.5 -9.5 L9.5 -9.5" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-9 -6.6 L9 -6.6 M-8.4 -3.8 L8.4 -3.8" stroke="@coqueO" stroke-width="0.8" opacity="0.55"/>'
    // Timon de godille par-dessus le tableau : fourche centrale, barre en biais, pelle à l'eau.
    + '<path d="M0 -9.5 l0 -2.2" stroke="@matO" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M0 -11.7 L10 -3.5" stroke="@mat" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M10 -3.5 L14 0.8 L9.4 1.2 Z" fill="@mat"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'barge-fluviale', front, profile, back };
