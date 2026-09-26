/**
 * GALÈRE DE GUERRE (MDG 113, ~35 m, mixte — réf planche MDG 6 p.048) : long vaisseau de rame à
 * bordé à CLINS, étrave rakée coiffée d'une FIGURE DE PROUE ailée (fauve de guerre), TOUR de poupe
 * crénelée sous pavillon, rangée de pavois sur le plat-bord, batterie d'avirons sur apostis,
 * ÉPERON de bronze à la flottaison (trait `belier`), grand mât unique à voile carrée (rig mixte).
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, oarBank, pennant, shieldRow, spar, squareSail, stay } from '../artkit';

/** Figure de proue AILÉE (fauve rugissant vers l'avant, aile balayée vers l'arrière) — profil. */
function figurehead(): string {
  return '<path d="M44 -22 Q40.5 -28 35.5 -29.8 Q39.5 -24.5 40.4 -20.8 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>' // aile
    + '<path d="M43.4 -22.6 Q48.5 -24.4 50.8 -21.2 Q52 -19 49.2 -18.2 L45.6 -18.4 Q43.8 -19.6 43.4 -22.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>' // tête
    + '<path d="M50.8 -21.2 L53 -19.6 L49.6 -19" fill="none" stroke="@coqueO" stroke-width="0.9"/>' // gueule ouverte
    + '<circle cx="47.6" cy="-21" r="0.7" fill="@coqueO"/>';
}

function profile(): string {
  return '<g>'
    + oarBank(-28, 26, 10, -6.8, 6.5)
    // Grand mât unique (rig mixte : la voile carrée seconde la rame).
    + spar(2, -8, 2, -72, 2.8)
    + squareSail(2, -64, 32, 14, { seams: 2 })
    + stay(2, -72, -29, -14.5) + stay(2, -72, 34, -15.5) + stay(2, -64, 38, -14)
    + pennant(2, -72, 10)
    // Coque CONSTRUITE : quille à faible rocker, tonture modérée, étrave rakée qui MONTE vers la
    // figure de proue, étambot porté par la tour — pas un croissant.
    + '<path d="M-38 -14 Q-17 -10.4 2 -10.2 Q21 -11 37 -15 L44 -22 L46.5 -20 L41 -1 Q0 2.6 -35 -0.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M37 -15 L44 -22" stroke="@coqueO" stroke-width="2"/>' // étrave rakée
    + '<path d="M-38 -14 L-35 -0.8" stroke="@coqueO" stroke-width="1.8"/>' // étambot
    + '<path d="M-35 -0.8 Q0 2.6 41 -1" fill="none" stroke="@coqueO" stroke-width="1.4"/>' // semelle de quille
    // Tonture (plat-bord) + deux virures de bordé à clins.
    + '<path d="M-38 -14 Q-17 -10.4 2 -10.2 Q21 -11 37 -15" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-36.5 -9.6 Q0 -5.4 39 -11.6 M-36 -5 Q0 -1.4 40 -6.4" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Apostis (caisson de nage des avirons) en surlonge.
    + '<path d="M-31 -8.2 L34 -8.8" stroke="@coqueH" stroke-width="1.6" opacity="0.9"/>'
    // Rangée de PAVOIS sur le plat-bord (la garde embarquée).
    + shieldRow(-24, 20, 8, -12.4, 2.3)
    // TOUR de poupe crénelée (plateforme de combat) sous pavillon.
    + castle(-45, -31, -33, -14, 3)
    + '<rect x="-41" y="-28" width="3.2" height="4.4" fill="@matO" opacity="0.9"/>'
    + '<path d="M-43.5 -14.5 l0 -3 M-32.5 -14.5 l0 -3" stroke="@coqueO" stroke-width="1.1"/>'
    + flag(-43, -33, 7, 4.5)
    // Figure de proue ailée + ÉPERON de bronze à la flottaison.
    + figurehead()
    + '<path d="M41.5 -5.5 L55 -1.8 L41 0.6 Z" fill="@matO" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M42.5 -4.2 L52 -2.2" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>'
    // Rame de gouverne latérale (barre de poupe).
    + spar(-35.5, -11, -44, 1.5, 1.8)
    + '<path d="M-44 1.5 l-3.6 -1.4 l1.2 3.6 Z" fill="@mat"/>'
    + '</g>';
}

/** Voile carrée vue d'AXE (ventre vers le spectateur) — le mât se redessine PAR-DESSUS côté poupe. */
function sailFace(): string {
  return spar(0, -8, 0, -62, 2.4)
    + stay(0, -62, -7.4, -9) + stay(0, -62, 7.4, -9)
    + '<path d="M-14 -57 L14 -57" stroke="@mat" stroke-width="1.8" stroke-linecap="round"/>'
    + '<path d="M-13 -56 Q0 -53 13 -56 Q14.8 -46 12 -35.5 Q0 -30.5 -12 -35.5 Q-14.8 -46 -13 -56 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M-4.3 -54.4 Q-4.3 -44 -4 -32.6 M4.3 -54.4 Q4.3 -44 4 -32.6" fill="none" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    + stay(-12, -35.5, -6, -9.5) + stay(12, -35.5, 6, -9.5)
    + pennant(0, -62, 8);
}

/** Batterie d'avirons vue d'AXE : éventail de nage de part et d'autre du bordé. */
const oarsAxial = (): string =>
  '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round">'
  + '<line x1="-6.8" y1="-7.6" x2="-15.5" y2="0.6"/><line x1="-7.2" y1="-6.8" x2="-13" y2="1.4"/><line x1="-7.4" y1="-6" x2="-10.5" y2="1.8"/>'
  + '<line x1="6.8" y1="-7.6" x2="15.5" y2="0.6"/><line x1="7.2" y1="-6.8" x2="13" y2="1.4"/><line x1="7.4" y1="-6" x2="10.5" y2="1.8"/></g>';

function front(): string {
  return '<g>'
    + oarsAxial()
    + sailFace()
    // Section de PROUE étroite (coque de rame) : étrave axiale, sections évasées, clins.
    + '<path d="M0 -14.5 Q-5 -13 -6.8 -9 Q-7.4 -3 0 0.8 Q7.4 -3 6.8 -9 Q5 -13 0 -14.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M0 -14.5 L0 0.4" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M0 -14.5 Q-5 -13 -6.8 -9 M0 -14.5 Q5 -13 6.8 -9" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-6 -6.6 Q0 -9.6 6 -6.6 M-4.6 -3.2 Q0 -5.8 4.6 -3.2" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Pavois de tête de rangée sur chaque plat-bord.
    + '<circle cx="-6.2" cy="-11.4" r="2.2" fill="@pavillon" stroke="@coqueO" stroke-width="0.8"/>'
    + '<circle cx="6.2" cy="-11.4" r="2.2" fill="@toileDeVoileO" stroke="@coqueO" stroke-width="0.8"/>'
    // Figure de proue de FACE : fauve entre ses deux ailes déployées.
    + '<path d="M-2.2 -19.6 Q-7.2 -22.4 -9.2 -26.6 Q-4.4 -24.6 -2.4 -21 Z M2.2 -19.6 Q7.2 -22.4 9.2 -26.6 Q4.4 -24.6 2.4 -21 Z" fill="@coque" stroke="@coqueO" stroke-width="0.8"/>'
    + '<path d="M0 -22.4 Q-2.4 -21.4 -2.4 -18.6 Q-2.4 -16 0 -15.2 Q2.4 -16 2.4 -18.6 Q2.4 -21.4 0 -22.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-1.7 -22 l-0.9 -2 M1.7 -22 l0.9 -2" stroke="@coqueO" stroke-width="0.9"/>' // oreilles
    + '<circle cx="-1" cy="-19.4" r="0.55" fill="@coqueO"/><circle cx="1" cy="-19.4" r="0.55" fill="@coqueO"/>'
    // ÉPERON de bronze vu de pointe, à la flottaison.
    + '<ellipse cx="0" cy="-1" rx="2.6" ry="1.7" fill="@matO" stroke="@coqueO" stroke-width="0.8"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    + oarsAxial()
    + sailFace()
    // Mât repassé DEVANT la toile (vu de poupe, il est côté spectateur).
    + spar(0, -8, 0, -62, 2.4)
    // Section de POUPE plus pleine, clins.
    + '<path d="M0 -13.5 Q-6.2 -12 -7.6 -8.4 Q-8 -2.6 0 0.8 Q8 -2.6 7.6 -8.4 Q6.2 -12 0 -13.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M0 -13.5 Q-6.2 -12 -7.6 -8.4 M0 -13.5 Q6.2 -12 7.6 -8.4" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-6.8 -5.8 Q0 -8.8 6.8 -5.8 M-5.2 -2.6 Q0 -5 5.2 -2.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // TOUR de poupe crénelée plein cadre : meurtrière, jambettes, pavillon en tête.
    + castle(-9, 9, -31, -13, 3)
    + '<rect x="-1.6" y="-26" width="3.2" height="4.6" fill="@matO" opacity="0.9"/>'
    + '<path d="M-7.4 -13.4 l0 -2.6 M7.4 -13.4 l0 -2.6" stroke="@coqueO" stroke-width="1.1"/>'
    + flag(-1, -31, 7, 4.5)
    // Deux rames de gouverne latérales aux hanches.
    + spar(-6.8, -8.6, -11.8, 1.5, 1.6) + '<path d="M-11.8 1.5 l-3 -1.2 l1 3 Z" fill="@mat"/>'
    + spar(6.8, -8.6, 11.8, 1.5, 1.6) + '<path d="M11.8 1.5 l3 -1.2 l-1 3 Z" fill="@mat"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'galere-de-guerre', profile, front, back };
