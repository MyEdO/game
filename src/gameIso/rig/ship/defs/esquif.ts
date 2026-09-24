/**
 * ESQUIF (MDG 113, ~15 m, gréement mixte) — la plus grande des embarcations ouvertes : coque à clins
 * sur quille presque droite, étrave et étambot RAKÉS, safran d'étambot à barre franche, petit mât au
 * tiers avant à voile carrée modeste, deux avirons en renfort (réf planche MDG 12 p.098, le Knarr).
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    // Safran d'étambot (pendu à l'arrière) + avirons.
    + rudder(-24.5, -9)
    + oarBank(-14, -4, 2, -5.2, 5)
    // Gréement mixte : petit mât au tiers avant, voile carrée modeste, étai/pataras.
    + spar(4, -5, 4, -46, 2)
    + squareSail(4, -42, 22, 10, { seams: 1 })
    + stay(4, -46, 24, -10) + stay(4, -46, -22, -8.5)
    + pennant(4, -46, 7)
    // Coque OUVERTE construite : quille presque droite (léger rocker), étrave élancée qui monte
    // de l'avant de la quille, étambot raké à l'arrière — pas un croissant.
    + '<path d="M-24.5 -9.8 L-22 -0.8 Q0 1.4 20.5 -0.8 L25.5 -10.8 Q11 -6.2 0 -6 Q-12 -6 -24.5 -9.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    // Étrave / étambot appuyés + semelle de quille.
    + '<path d="M25.5 -10.8 L20.5 -0.8 M-24.5 -9.8 L-22 -0.8" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M-22 -0.8 Q0 1.4 20.5 -0.8" fill="none" stroke="@coqueO" stroke-width="1.5"/>'
    // Plat-bord (tonture) + deux virures de bordé à clins.
    + '<path d="M-24.5 -9.8 Q-12 -6 0 -6 Q11 -6.2 25.5 -10.8" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-23.5 -6.8 Q0 -3 24 -7.4 M-22.5 -3.8 Q0 -0.8 21.5 -4.2" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Barre franche rentrant à bord + tolets des avirons.
    + spar(-23.5, -9.2, -18, -7.4, 1.2)
    + '<path d="M-10 -5.6 l0 -1.8 M12 -5.8 l0 -1.8" stroke="@matO" stroke-width="1.3"/>'
    + '</g>';
}

/** Voile carrée vue de FACE (le ventre vers le spectateur) — mât DERRIÈRE la toile. */
function sailFace(): string {
  return spar(0, -6, 0, -46, 2)
    + stay(0, -46, -6.8, -7.5) + stay(0, -46, 6.8, -7.5)
    + '<path d="M-13 -42 L13 -42" stroke="@mat" stroke-width="1.8" stroke-linecap="round"/>'
    + '<path d="M-12 -41 Q0 -38.5 12 -41 Q13.5 -32 11 -23 Q0 -18.5 -11 -23 Q-13.5 -32 -12 -41 Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>'
    + '<path d="M0 -38.8 L0 -19.2" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4"/>'
    // Écoutes des points d'écoute vers le plat-bord.
    + stay(-11, -23, -5.5, -7) + stay(11, -23, 5.5, -7)
    + pennant(0, -46, 7);
}

/** Avirons sortis en ciseaux de part et d'autre (vues d'axe). */
const oarsAxial = (): string =>
  '<g stroke="@mat" stroke-width="1.3" stroke-linecap="round">'
  + '<line x1="-6" y1="-5.5" x2="-11.5" y2="0.8"/><line x1="6" y1="-5.5" x2="11.5" y2="0.8"/></g>';

function front(): string {
  return '<g>'
    + oarsAxial()
    + sailFace()
    // Coque vue de PROUE : étrave axiale montant au brion, sections évasées, clins emboîtés.
    + '<path d="M0 -11.5 Q-5.4 -9.6 -6.6 -6.2 Q-7 -2 0 0.6 Q7 -2 6.6 -6.2 Q5.4 -9.6 0 -11.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M0 -11.5 L0 0.2" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M0 -11.5 Q-5.4 -9.6 -6.6 -6.2 M0 -11.5 Q5.4 -9.6 6.6 -6.2" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-5.8 -4.6 Q0 -7.4 5.8 -4.6 M-4.4 -1.8 Q0 -4.2 4.4 -1.8" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    + oarsAxial()
    + sailFace()
    // Mât repassé DEVANT la toile (vu de poupe, il est côté spectateur).
    + spar(0, -6, 0, -46, 2)
    // Coque vue de POUPE : sections un peu plus pleines, plat-bord, clins.
    + '<path d="M0 -10.5 Q-6 -9 -7 -5.8 Q-7.2 -1.8 0 0.6 Q7.2 -1.8 7 -5.8 Q6 -9 0 -10.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M0 -10.5 Q-6 -9 -7 -5.8 M0 -10.5 Q6 -9 7 -5.8" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-6.2 -4.2 Q0 -7 6.2 -4.2 M-4.8 -1.6 Q0 -3.8 4.8 -1.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // SAFRAN axial pendu à l'étambot + barre franche vers bâbord.
    + '<path d="M-1.1 -9.5 L1.1 -9.5 L1.5 1.8 L-1.5 1.8 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + spar(0, -9.5, -6, -12.2, 1.4)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'esquif', profile, front, back };
