/**
 * GALION BRETONNIEN (MDG, ~60 m, voile) — vaisseau d'apparat CONSTRUIT en galion (réf planche
 * MDG 13 p.114 : caraque/galion, châteaux en GRADINS pris dans la muraille — pas un croissant à
 * boîtes) : quille presque droite, étambot raqué portant un TABLEAU arrière haut à fanal et
 * galerie de poupe, étrave à GUIBRE sculptée sous le beaupré, préceintes dorées continues,
 * sabords, quatre mâts, emblème trèfle-de-lys. Trois vues (contrat `ViewArt`) : profil (proue
 * à droite), face = étrave/guibre de bout, dos = tableau arrière orné.
 */
import type { ShipArtDef } from '../artkit';
import { flag, gunports, hune, lateenSail, pennant, spar, squareSail, stay } from '../artkit';

/** Emblème bretonnien stylisé (trèfle-de-lys @pavillon) posé sur toile ou boiserie. */
const lys = (x: number, y: number): string =>
  `<g fill="@pavillon" opacity="0.85"><circle cx="${x}" cy="${y - 3}" r="2.2"/><circle cx="${x - 2.6}" cy="${y}" r="2"/><circle cx="${x + 2.6}" cy="${y}" r="2"/><path d="M${x - 1.4} ${y + 1} h2.8 l0.8 5 h-4.4 Z"/></g>`;

/** Voile carrée vue d'AXE (ventre vers le spectateur), vergue @mat, chute bombée des deux bords. */
const faceSail = (cx: number, yTop: number, hw: number, h: number): string =>
  `<path d="M${cx - hw - 2} ${yTop} L${cx + hw + 2} ${yTop}" stroke="@mat" stroke-width="1.8" stroke-linecap="round"/>`
  + `<path d="M${cx - hw} ${yTop + 1} Q${cx} ${yTop + 3} ${cx + hw} ${yTop + 1} Q${cx + hw + 1.5} ${yTop + h * 0.55} ${cx + hw - 2} ${yTop + h}`
  + ` Q${cx} ${yTop + h + 3.5} ${cx - hw + 2} ${yTop + h} Q${cx - hw - 1.5} ${yTop + h * 0.55} ${cx - hw} ${yTop + 1} Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>`;

function profile(): string {
  return '<g>'
    // Safran d'étambot pendu au tableau.
    + '<path d="M-47 -12 L-51.5 -11 L-50 1.5 L-46 0.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Quatre mâts : contre-artimon et artimon latins posés sur LEURS ponts arrière, grand mât
    // (2 étages + emblème) au pont de batterie, misaine sur le gaillard ; beaupré à civadière.
    + spar(-46, -35, -46, -64, 2)
    + lateenSail([-38, -60], [-56, -40], [-41, -34], [2, 4])
    + spar(-26, -25, -26, -86, 2.2)
    + lateenSail([-16, -82], [-42, -46], [-20, -27], [3, 5])
    + spar(2, -14, 2, -112, 2.8)
    + squareSail(2, -70, 40, 18, { seams: 2 }) + lys(6, -52) + squareSail(2, -102, 28, 12, { seams: 1 }) + hune(2, -76)
    + spar(34, -21.5, 34, -88, 2.2)
    + squareSail(34, -62, 26, 12, { seams: 1 }) + squareSail(34, -86, 18, 8) + hune(34, -66)
    + spar(40, -18, 60, -31, 2)
    + squareSail(53, -30, 10, 5)
    + stay(2, -112, 34, -25) + stay(2, -112, -26, -29) + stay(34, -88, 59, -30) + stay(-26, -86, -45, -37) + stay(-46, -64, -55, -38)
    + pennant(2, -112, 12) + pennant(34, -88, 9)
    // COQUE CONSTRUITE (un seul volume) : tableau raqué (gauche), quille presque droite, étrave
    // raquée (droite), puis la muraille MONTE EN GRADINS — gaillard d'avant, taille basse,
    // demi-pont, dunette — les châteaux SONT la coque, pas des boîtes posées.
    + '<path d="M-55 -40 L-47 0.5 Q0 3.8 40 1.6 L51 -15 L48 -22 L31 -22 L30 -14.8 Q10 -13.4 -12 -15 L-13 -24 L-39 -27 L-40 -35 L-54 -38 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    // Arête du tableau appuyée + plat-bords éclairés de chaque gradin.
    + '<path d="M-55 -40 L-47 0.5" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M-54 -38 L-40 -35 M-39 -27 L-13 -24 M-12 -15 Q10 -13.4 30 -14.8 M31 -22 L48 -22" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Deux préceintes DORÉES continues (elles suivent la tonture et grimpent sous les gradins) + bordage.
    + '<path d="M-53 -28 Q-20 -14 8 -12 Q30 -12.5 49 -17.5 M-49 -17 Q0 -6 44 -10" fill="none" stroke="@coqueH" stroke-width="1.1" opacity="0.9"/>'
    + '<path d="M-48 -9 Q0 -1.5 41 -5" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + gunports(-36, 26, 7, -8.8, 2.8)
    // GUIBRE : éperon d'étrave charpenté sous le beaupré, herpès + figure de proue en volute dorée.
    + '<path d="M51 -15 L60 -11.5 L45 -8.5 Q48 -12 51 -15 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M53.5 -13.7 L53 -9.7 M56.5 -12.6 L56 -10.2" stroke="@coqueO" stroke-width="0.7" opacity="0.8"/>'
    + '<path d="M60 -11.5 q3.2 -1.6 2.6 -5" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    // Galerie de poupe : bouteille de quart, fenêtres chaudes, moulures dorées, volutes, fanal.
    + '<path d="M-52.5 -22 q-3.5 -5.5 -1 -11 l5.5 0.8 q-1.8 5 0 9.4 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M-49 -31 l3 0 m3.5 0 l3 0 M-35 -21.5 l3 0 m3.5 0 l3 0" stroke="@toileDeVoileH" stroke-width="1.7"/>'
    + '<path d="M-52 -34 L-41 -31.8 M-37 -23.5 L-16 -21" stroke="@coqueH" stroke-width="0.9" opacity="0.85"/>'
    + '<path d="M-55 -36 q-3.6 2.4 -2.4 6.4" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + spar(-55, -40, -57, -43, 1)
    + '<circle cx="-57.5" cy="-44.5" r="2" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + flag(-46, -36.5, 9, 5.5)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Grand mât (le plus haut) derrière : son hunier dépasse au-dessus de la misaine.
    + spar(0, -18, 0, -112, 2.6)
    + pennant(0, -112, 10)
    + faceSail(0, -98, 13, 20)
    // Misaine de face : grand-voile du gaillard avec l'emblème, haubans vers les bordés.
    + faceSail(0, -72, 19, 30) + lys(0, -56)
    + hune(0, -77)
    + stay(0, -74, -10, -17) + stay(0, -74, 10, -17)
    // Coque de bout : sections ÉVASÉES montant au gaillard, étrave axiale pleine.
    + '<path d="M0 -19 Q-8.5 -17 -10.6 -11.5 Q-11.6 -3.5 -7.5 0.8 Q0 2.6 7.5 0.8 Q11.6 -3.5 10.6 -11.5 Q8.5 -17 0 -19 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M0 -19 L0 -6.8" stroke="@coqueO" stroke-width="1.7"/>'
    // Lisse du gaillard éclairée + préceintes dorées vues de face.
    + '<path d="M-8.5 -15.6 Q0 -18.6 8.5 -15.6" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-10 -9.5 Q0 -12.5 10 -9.5 M-9 -4 Q0 -6.6 9 -4" fill="none" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>'
    // GUIBRE pointant vers le spectateur (coin sous l'étrave) + figure de proue dorée.
    + '<path d="M-2.6 -13.5 L2.6 -13.5 L0 -6.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<circle cx="0" cy="-14.6" r="1.8" fill="@coqueH" stroke="@coqueO" stroke-width="0.7"/>'
    // Beaupré en raccourci (il monte VERS le spectateur) + civadière.
    + spar(0, -17, 0, -30, 2.2)
    + faceSail(0, -26.5, 5.5, 8)
    + '</g>';
}

function back(): string {
  return '<g>'
    // Safran axial sous la voûte (dessiné d'abord, la coque le recouvre en tête).
    + '<path d="M-1.4 -4 L1.4 -4 L1.9 1.6 L-1.9 1.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Hunier du grand mât en arrière-plan, artimon latin au-dessus de la dunette.
    + faceSail(0, -104, 12, 16)
    + spar(0, -38, 0, -86, 2.2)
    + pennant(0, -86, 8)
    + spar(-14, -56, 15, -80, 1.6)
    + '<path d="M15 -80 L-14 -56 L10 -52 Q14 -66 15 -80 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    // VOÛTE de poupe (rentrée à l'eau) puis TABLEAU haut — la construction galion vue de dos.
    + '<path d="M-6.5 -2.5 Q0 -0.6 6.5 -2.5 L11.2 -22 L-11.2 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-11.2 -22 L-11.8 -38 L11.8 -38 L11.2 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    // Ombre de poupe (face à l'opposé du soleil de proue).
    + '<path d="M-6.5 -2.5 Q0 -0.6 6.5 -2.5 L11.8 -38 L-11.8 -38 Z" fill="@coqueO" opacity="0.16"/>'
    // Bouteilles de quart en saillie des deux bords.
    + '<path d="M-11.3 -21 q-3.4 -5 -1.7 -10.5 l3.4 0.5 q-1.4 5 0 10 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M11.3 -21 q3.4 -5 1.7 -10.5 l-3.4 0.5 q1.4 5 0 10 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>'
    // Galerie : deux rangs de fenêtres chaudes entre moulures dorées, volutes, couronnement.
    + '<path d="M-7.5 -33 l3.2 0 m2.8 0 l3.2 0 m2.8 0 l3.2 0 M-6.8 -26.5 l3 0 m2.6 0 l3 0 m2.6 0 l3 0" stroke="@toileDeVoileH" stroke-width="2"/>'
    + '<path d="M-11.4 -30 L11.4 -30 M-11 -23.5 L11 -23.5" stroke="@coqueH" stroke-width="0.8" opacity="0.85"/>'
    + '<path d="M-11.5 -36 q-2.8 2 -1.8 5.4 M11.5 -36 q2.8 2 1.8 5.4" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-11.8 -38 L11.8 -38" stroke="@coqueH" stroke-width="1.2"/>'
    // Grand trèfle-de-lys peint sur la voûte + fanaux d'angle + pavillon de poupe.
    + lys(0, -13)
    + spar(-9.5, -38, -9.5, -42, 1) + '<circle cx="-9.5" cy="-43.5" r="1.9" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + spar(9.5, -38, 9.5, -42, 1) + '<circle cx="9.5" cy="-43.5" r="1.9" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + flag(0, -38, 8, 5)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'galion-bretonnien', profile, front, back };
