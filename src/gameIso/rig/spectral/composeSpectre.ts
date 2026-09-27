/**
 * Gabarit SPECTRAL (spectre / fantôme / banshee) — mort-vivant immatériel : buste flottant
 * TRANSLUCIDE qui se dissout en volutes vaporeuses (pas de jambes), bras flottants, tête à
 * regard luisant (capuche / visage hurlant / crâne). Anim propre au plan : flottement/ondulation
 * des volutes au repos, ruée spectrale à l'attaque, dissipation à la « mort ». Réutilise la
 * machinerie (FK générique, palette tokenisée, rendu) ; translucidité bakée dans l'art.
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SPECTRE_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type SpectreBoneId = 'corps' | 'tete' | 'brasG' | 'brasD';
type SBone = FKBone & { z: number };
export interface SpectreProps {
  sl: number;
  hood: boolean; // capuche dressée (spectre) vs tête nue translucide (fantôme/banshee)
  face: 'crane' | 'cri' | 'morne' | 'hurle' | 'crane-cri'; // crâne / bouche hurlante / visage éteint / hurlement féminin mâchoire décrochée (banshee) / crâne décharné HURLANT — orbites creuses + gouffre denté (fantôme)
  /** Chevelure longue flottante encadrant le visage (tokens @cheveux/@cheveuxO) — banshee. */
  cheveux?: boolean;
  /** Mains squelettiques aux longs doigts-griffes émergeant des manches (@cuir) — remplace la pointe fondue. */
  griffes?: boolean;
  /** Bas du linceul en volutes de BRUME (boucles arrondies + nappes flottantes détachées, LDB 82 p.330
   *  fantôme) — remplace la frange en langues pointues rigides. Opt-in : défaut = art existant. */
  brume?: boolean;
  /** Arme brandie — `epee` : bras D levé (banshee) ; `faux` : faux de faucheuse tenue à deux
   *  mains en diagonale devant le corps (spectre), hampe @cuir + lame pâle corrodée. */
  arme?: 'epee' | 'faux';
  palette: PaletteDeclaree;
}

function buildSkeleton(): Record<SpectreBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 66 }, angle: 0, z: 3 }, // buste + volutes
    tete: { parent: 'corps', pivot: { x: 0, y: -20 }, angle: 0, z: 5 },
    brasG: { parent: 'corps', pivot: { x: -12, y: -12 }, angle: 0, z: 4 },
    brasD: { parent: 'corps', pivot: { x: 12, y: -12 }, angle: 0, z: 2 },
  };
}

// --- art (translucide, repère LOCAL) --------------------------------------
// Yeux SANS pupille : orbes luisants + halo — le couple « iris+pupille » lisait peluche
// mignonne (verdict des juges aveugles, lot 4). Le regard vide et lumineux fait le spectre.
const glowEyes = (x1: number, x2: number | null, y = 0): string =>
  [x1, x2].filter((x): x is number => x !== null)
    .map((x) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="2.2" fill="#bfe6ff" opacity="0.3"/><ellipse cx="${x}" cy="${y}" rx="1.3" ry="1.7" fill="#eaf7ff"/>`)
    .join('');
function body(view: View, brume = false): string {
  if (view === 'profile') {
    // drapé de PROFIL : bord d'attaque net vers l'avant (+x), traîne de volutes derrière (-x)
    const bas = brume
      // brume : ourlet en boucles arrondies qui s'enroulent + nappes flottantes détachées
      ? `<path opacity="0.5" d="M-13 12 L14 12 Q12.5 20 13.5 27 Q17.5 30 13 33.5 Q9 31 7.5 36.5 Q4 31.5 2 40 Q-1 32.5 -5 37 Q-8 31.5 -11.5 34 Q-14.5 29 -12 25.5 Q-13 19 -13 12 Z" fill="@corps"/>` +
        `<path opacity="0.3" d="M12 31.5 Q18 34.5 14.5 38.5 Q11.5 40 11 37 M2 38 Q4 44 -1 45.5 Q-4 44.5 -2 41.5 M-10.5 33 Q-16 36 -12.5 40" stroke="@corps" stroke-width="2" fill="none" stroke-linecap="round"/>` +
        `<ellipse cx="-11" cy="41" rx="6" ry="2.3" fill="@corps" opacity="0.16"/><ellipse cx="8" cy="43" rx="6.5" ry="2.5" fill="@corps" opacity="0.13"/>`
      : `<path opacity="0.5" d="M-13 12 L14 12 Q13 22 11 32 Q7 26 4 38 Q1 28 -2 40 Q-5 28 -9 34 Q-12 24 -13 12 Z" fill="@corps"/>` +
        `<path opacity="0.25" d="M11 32 Q10 38 8 42 M4 38 Q3 43 2 46 M-2 40 Q-3 44 -3 47 M-9 34 Q-11 39 -12 42" stroke="@corps" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    return `<g>` +
      `<path opacity="0.85" d="M-9 -16 Q3 -22 13 -14 Q16 -2 14 12 L-13 12 Q-15 -4 -9 -16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      bas +
      `<path d="M9 -12 Q12 0 11 14" stroke="@corpsH" stroke-width="0.9" opacity="0.4" fill="none"/>` +
      `</g>`;
  }
  // buste (presque opaque) → jupe de volutes (semi) → langues vaporeuses (faibles) : le
  // FONDU vers la transparence vend l'immatériel — l'aplat uniforme lisait « drap opaque ».
  const bas = brume
    ? `<path opacity="0.5" d="M-16 12 L16 12 Q14 20 15.5 27 Q19.5 30 15 34 Q10.5 31 9 37 Q5 32 2.5 41 Q-0.5 33 -5 38 Q-8.5 32 -12.5 35 Q-16.5 30 -13.5 26 Q-15 20 -16 12 Z" fill="@corps"/>` +
      `<path opacity="0.3" d="M14 32 Q20 35 16.5 39 Q13.5 40.5 13 37.5 M2.5 39 Q4.5 45 -0.5 46.5 Q-3.5 45.5 -1.5 42.5 M-11.5 34 Q-17.5 37 -14 41 Q-11 42 -11 39" stroke="@corps" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="-14" cy="42" rx="6.5" ry="2.4" fill="@corps" opacity="0.16"/><ellipse cx="11" cy="44" rx="7" ry="2.6" fill="@corps" opacity="0.14"/><ellipse cx="-2" cy="48" rx="10" ry="3" fill="@corps" opacity="0.1"/>`
    : `<path opacity="0.5" d="M-16 12 L16 12 Q13 22 15 34 Q10 28 8 40 Q5 30 2.5 44 Q0 32 -2.5 44 Q-5 30 -8 40 Q-10 28 -15 34 Q-13 22 -16 12 Z" fill="@corps"/>` +
      `<path opacity="0.25" d="M15 34 Q14 39 12 43 M8 40 Q7 44 6 47 M2.5 44 Q2 47 1.5 50 M-2.5 44 Q-3 47 -3.5 50 M-8 40 Q-9 44 -10 47 M-15 34 Q-16 39 -14 43" stroke="@corps" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  return `<g>` +
    `<path opacity="0.85" d="M-13 -16 Q0 -21 13 -16 L16 12 L-16 12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    bas +
    `<path d="M0 -18 Q3 6 1 36" stroke="@corpsH" stroke-width="1" opacity="0.4" fill="none"/>` +
    `<path d="M-9 -10 Q-11 8 -10 26 M9 -10 Q11 8 10 26" stroke="@corpsH" stroke-width="0.7" opacity="0.3" fill="none"/>` +
    `</g>`;
}
function head(p: SpectreProps, view: View): string {
  const prof = view === 'profile';
  const eyes = prof ? glowEyes(3.5, null) : glowEyes(-3, 3);
  if (p.hood) { // capuche : voile sombre cerclé d'un liseré rivé (@cuir) + cavité noire ; avec
    // face:'crane', un crâne osseux (@cuir) émerge de l'ombre — sinon seul le regard luisant.
    if (prof) { // de profil : bec de capuche LARGEMENT ouvert vers l'avant (+x) — le crâne s'y
      // lit ENTIER en 3/4 (deux orbites, mâchoire dentée), pas en tranche (LDB 82 p.331)
      const inner = p.face === 'crane'
        ? `<path d="M-1.6 1.6 Q-2.8 -6.4 2.8 -7 Q8.2 -6.2 7.6 1.6 Q6.7 4.2 4.8 4.7 L4.8 6.6 Q3.2 8 1.7 6.6 L1.7 4.7 Q-0.7 4.3 -1.6 1.6 Z" fill="@cuir" stroke="#0a0e14" stroke-width="0.4"/>` +
          `<ellipse cx="0.8" cy="-1.4" rx="1.3" ry="1.8" fill="#0a0e14"/><ellipse cx="5" cy="-1.4" rx="1.7" ry="2" fill="#0a0e14"/>` +
          `<circle cx="1" cy="-1.8" r="0.4" fill="#d9f5c8"/><circle cx="5.2" cy="-1.8" r="0.45" fill="#d9f5c8"/>` +
          `<path d="M3.2 1.4 Q3.9 0.4 4.6 1.4 L3.9 2.6 Z" fill="#0a0e14"/>` +
          `<path d="M1.7 4.7 L4.8 4.7 M2.5 4.3 L2.5 6.5 M3.9 4.3 L3.9 6.5" stroke="#0a0e14" stroke-width="0.45"/>` +
          `<path d="M-1.3 0.9 Q-0.3 2.2 1 2.6 M7.3 0.9 Q6.3 2.2 5.2 2.6" stroke="#0a0e14" stroke-width="0.5" opacity="0.5" fill="none"/>`
        : eyes;
      return `<g opacity="0.92"><path d="M-8 7 Q-12 -12 -1 -15 Q9 -14 10 -4 Q10.5 2 8 7 Q0 10 -8 7 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>` +
        `<path d="M8.6 -7 Q10.4 0 8 6.6 Q2.5 8.6 -1.8 6.2 Q-3.4 -1.5 -0.6 -8.2 Q5 -10.2 8.6 -7 Z" fill="#0a0e14"/>${inner}` +
        `<path d="M-7.4 6 Q-11 -11 -1 -14 Q8.4 -13 9.4 -4" stroke="@cuir" stroke-width="1.1" fill="none" opacity="0.5"/>` +
        `<circle cx="-9.4" cy="-3" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="-7.4" cy="-9.4" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="-2" cy="-13.4" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="4.6" cy="-12.4" r="0.45" fill="@cuir" opacity="0.7"/></g>`;
    }
    const inner = p.face === 'crane'
      ? `<path d="M-4.8 2.2 Q-5.8 -6.8 0 -7.4 Q5.8 -6.8 4.8 2.2 Q3.8 4.8 1.6 5.3 L1.6 7.4 Q0 8.8 -1.6 7.4 L-1.6 5.3 Q-3.8 4.8 -4.8 2.2 Z" fill="@cuir" stroke="#0a0e14" stroke-width="0.4"/>` +
        `<ellipse cx="-2.2" cy="-1.2" rx="1.7" ry="2" fill="#0a0e14"/><ellipse cx="2.2" cy="-1.2" rx="1.7" ry="2" fill="#0a0e14"/>` +
        `<circle cx="-2" cy="-1.6" r="0.45" fill="#d9f5c8"/><circle cx="2.4" cy="-1.6" r="0.45" fill="#d9f5c8"/>` +
        `<path d="M-0.7 1.8 Q0 0.7 0.7 1.8 L0 3 Z" fill="#0a0e14"/>` +
        `<path d="M-1.6 5.3 L1.6 5.3 M-0.8 4.9 L-0.8 7.2 M0.8 4.9 L0.8 7.2" stroke="#0a0e14" stroke-width="0.45"/>` +
        `<path d="M-4.4 1.4 Q-3.2 2.8 -1.8 3.2 M4.4 1.4 Q3.2 2.8 1.8 3.2" stroke="#0a0e14" stroke-width="0.5" opacity="0.5" fill="none"/>`
      : eyes;
    return `<g opacity="0.92"><path d="M-9 6 Q-12 -13 0 -15 Q12 -13 9 6 Q4 9 0 9 Q-4 9 -9 6 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>` +
      `<ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#0a0e14"/>${inner}` +
      `<path d="M-8.8 5.4 Q-11 -11.5 0 -13.6 Q11 -11.5 8.8 5.4" stroke="@cuir" stroke-width="1.2" fill="none" opacity="0.5"/>` +
      `<circle cx="-9.6" cy="-1" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="-7.2" cy="-8.4" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="-2.8" cy="-12.4" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="2.8" cy="-12.4" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="7.2" cy="-8.4" r="0.45" fill="@cuir" opacity="0.7"/><circle cx="9.6" cy="-1" r="0.45" fill="@cuir" opacity="0.7"/></g>`;
  }
  if (p.face === 'crane') { // crâne translucide
    if (prof)
      return `<g opacity="0.85"><path d="M-7 2 Q-9 -11 1 -12 Q9 -10 9 -2 Q9 3 5 4 L6 8 Q3 11 1 8 L0 5 Q-4 6 -7 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `<ellipse cx="4" cy="-1" rx="2.4" ry="2.8" fill="#0a0e14"/>${eyes}` +
        `<path d="M1 8 L6 8 M3 5 L3.6 10" stroke="@corpsO" stroke-width="0.5"/></g>`;
    return `<g opacity="0.85"><path d="M-7 4 Q-9 -11 0 -12 Q9 -11 7 4 Q5 8 2 8 L2 11 Q0 13 -2 11 L-2 8 Q-5 8 -7 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<ellipse cx="-3.2" cy="0" rx="2.4" ry="2.8" fill="#0a0e14"/><ellipse cx="3.2" cy="0" rx="2.4" ry="2.8" fill="#0a0e14"/>${eyes}` +
      `<path d="M-2 8 L2 8 M-1 7 L-1 11 M1 7 L1 11" stroke="@corpsO" stroke-width="0.5"/></g>`;
  }
  if (p.face === 'crane-cri') { // crâne décharné hurlant (fantôme) : dôme osseux, joues creuses, orbites noires, gouffre denté étiré vers le bas
    if (prof)
      return `<g opacity="0.85"><path d="M-6.5 0 Q-8.5 -12 1 -13 Q9 -11 8.8 -3.5 Q8.7 0.5 6.8 2 L8.6 8.6 Q7 12 3.8 10 L2.6 5.4 Q-4 6 -6.5 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `<path d="M-3.6 -2.2 Q-1.4 1.2 1.8 2.2 Q-0.6 3.6 -3 2 Q-4.6 0.2 -3.6 -2.2 Z" fill="@corpsO" opacity="0.55"/>` +
        `<path d="M1.6 -5.2 Q5.8 -7 7.8 -3.8 Q7 -0.4 3.6 -0.9 Q1.4 -2.4 1.6 -5.2 Z" fill="#0a0e14"/>${glowEyes(4.8, null, -3.2)}` +
        `<path d="M1.2 -6.2 Q4.8 -7.8 7.8 -5.6" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.8"/>` +
        `<path d="M7 -0.2 L8.7 1.7 L6.4 2 Z" fill="#0a0e14"/>` +
        `<path d="M3 3.2 Q7.8 2.8 8.8 6.6 Q8 10.6 4.6 10.8 Q2.4 7.4 3 3.2 Z" fill="#0a0e14"/>` +
        `<path d="M4.2 3.5 L4.2 5.1 M5.7 3.3 L5.7 5 M7.2 3.4 L7.2 4.9 M5 10.4 L5.2 9 M6.6 10.2 L6.7 8.8" stroke="@corps" stroke-width="0.6" opacity="0.9"/></g>`;
    return `<g opacity="0.85"><path d="M-7 0 Q-8.5 -12 0 -13 Q8.5 -12 7 0 Q6.2 3.6 4.4 5 L4 11 Q2 14 0 14 Q-2 14 -4 11 L-4.4 5 Q-6.2 3.6 -7 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-6.2 0 Q-4.6 2.8 -2.8 3.4 Q-4.8 4.4 -6 2.6 Q-6.6 1.4 -6.2 0 Z" fill="@corpsO" opacity="0.55"/><path d="M6.2 0 Q4.6 2.8 2.8 3.4 Q4.8 4.4 6 2.6 Q6.6 1.4 6.2 0 Z" fill="@corpsO" opacity="0.55"/>` +
      `<path d="M-5.9 -4 Q-3 -6 -0.8 -3.4 Q-1.8 -0.2 -5 -0.8 Q-6.4 -2.2 -5.9 -4 Z" fill="#0a0e14"/><path d="M5.9 -4 Q3 -6 0.8 -3.4 Q1.8 -0.2 5 -0.8 Q6.4 -2.2 5.9 -4 Z" fill="#0a0e14"/>${glowEyes(-3.4, 3.4, -2.8)}` +
      `<path d="M-6.2 -5.2 Q-3.2 -6.8 -0.6 -5.2 M0.6 -5.2 Q3.2 -6.8 6.2 -5.2" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.8"/>` +
      `<path d="M-1 0.8 Q0 -0.8 1 0.8 L0 2.4 Z" fill="#0a0e14"/>` +
      `<path d="M-3 3 Q0 2 3 3 Q3.8 8.8 0 12.6 Q-3.8 8.8 -3 3 Z" fill="#0a0e14"/>` +
      `<path d="M-1.9 3.3 L-1.9 4.9 M0 3 L0 4.7 M1.9 3.3 L1.9 4.9 M-1.2 11.2 L-1.1 9.6 M1.2 11.2 L1.1 9.6" stroke="@corps" stroke-width="0.6" opacity="0.9"/></g>`;
  }
  if (p.face === 'hurle') { // visage féminin hurlant (banshee, art LDB p.329) : sourcils lourds plongeants, FENTES furieuses (orbites creuses + éclat en lame, jamais d'orbe rond), pommette et joue creusées, gouffre denté vertical sur mâchoire DÉCROCHÉE (menton tiré bas), plis d'étirement
    if (prof)
      return `<g opacity="0.88"><path d="M-7 2 Q-9 -12 1 -13 Q9 -11 8.8 -3 Q8.7 0.6 7.4 2 L9.6 11.4 Q7.4 14.4 4 12 L3 5.8 Q-4.5 6.5 -7 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `<path d="M-1 -2 Q1 2 3.2 3.2 Q0.6 4.2 -1.6 2.4 Q-2.6 0 -1 -2 Z" fill="@corpsO" opacity="0.45"/>` +
        `<path d="M1 -6.6 Q4.6 -8 7.6 -5.2" stroke="@corpsO" stroke-width="1.4" fill="none"/>` +
        `<path d="M1.8 -5.2 Q5.4 -6.6 7.4 -4.2 Q6.4 -1.6 3 -2.4 Q1.4 -3.8 1.8 -5.2 Z" fill="#0a0e14"/>` +
        `<path d="M2.8 -4 L6.6 -4.6" stroke="#eaf7ff" stroke-width="0.8" stroke-linecap="round"/>` +
        `<path d="M7.8 -2.4 Q9 -0.4 8.8 1 L6.9 1.4 Z" fill="#0a0e14" opacity="0.9"/>` +
        `<path d="M3.4 2.6 Q7 1.8 9 3.6 Q9.4 8.6 5.4 11.2 Q3.4 7.4 3.4 2.6 Z" fill="#0a0e14"/>` +
        `<path d="M4.4 2.9 L4.5 4.7 M5.8 2.6 L5.9 4.5 M7.2 2.8 L7.3 4.4 M8.4 3.4 L8.4 4.8" stroke="#dfe9ef" stroke-width="0.6" opacity="0.95"/>` +
        `<path d="M5.6 10.4 L5.7 9 M7 9.7 L7 8.4" stroke="#dfe9ef" stroke-width="0.55" opacity="0.8"/>` +
        `<path d="M3.2 3 Q0.8 3.6 -0.6 5 M4.2 11 Q2.2 10.4 1 8.8" stroke="@corpsO" stroke-width="0.6" opacity="0.7" fill="none"/></g>`;
    return `<g opacity="0.88"><path d="M-8 1 Q-9 -12 0 -13 Q9 -12 8 1 Q7 6 4.6 8.2 L4.2 13.4 Q2.2 16 0 16 Q-2.2 16 -4.2 13.4 L-4.6 8.2 Q-7 6 -8 1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-7 0.6 Q-5.2 3 -3.4 3.6 Q-5.6 4.6 -6.6 2.8 Z" fill="@corpsO" opacity="0.45"/><path d="M7 0.6 Q5.2 3 3.4 3.6 Q5.6 4.6 6.6 2.8 Z" fill="@corpsO" opacity="0.45"/>` +
      `<path d="M-6 -5.6 Q-3.6 -5.6 -1 -3.4 M6 -5.6 Q3.6 -5.6 1 -3.4" stroke="@corpsO" stroke-width="1.4" fill="none"/>` +
      `<path d="M-5.6 -4.4 Q-3 -4.8 -1.2 -2.8 Q-2.2 -0.8 -4.8 -1.6 Q-6 -3 -5.6 -4.4 Z" fill="#0a0e14"/><path d="M5.6 -4.4 Q3 -4.8 1.2 -2.8 Q2.2 -0.8 4.8 -1.6 Q6 -3 5.6 -4.4 Z" fill="#0a0e14"/>` +
      `<path d="M-4.8 -3 L-1.9 -2.6 M4.8 -3 L1.9 -2.6" stroke="#eaf7ff" stroke-width="0.7" stroke-linecap="round"/>` +
      `<path d="M-1.1 1.2 Q0 -0.4 1.1 1.2 L0.6 2.2 L-0.6 2.2 Z" fill="#0a0e14" opacity="0.9"/>` +
      `<path d="M-3.6 3.6 Q0 2.4 3.6 3.6 Q4.4 10.6 0 14.6 Q-4.4 10.6 -3.6 3.6 Z" fill="#0a0e14"/>` +
      `<path d="M-2.5 3.9 L-2.5 5.6 M-0.85 3.5 L-0.85 5.4 M0.85 3.5 L0.85 5.4 M2.5 3.9 L2.5 5.6" stroke="#dfe9ef" stroke-width="0.6" opacity="0.95"/>` +
      `<path d="M-1.1 13 L-1 11.5 M1.1 13 L1 11.5" stroke="#dfe9ef" stroke-width="0.55" opacity="0.8"/>` +
      `<path d="M-1.8 2.6 Q-3.4 2.9 -4.2 4.4 M1.8 2.6 Q3.4 2.9 4.2 4.4" stroke="@corpsO" stroke-width="0.55" opacity="0.7" fill="none"/>` +
      `<path d="M-5 5.6 Q-5.8 8.2 -4.6 10.6 M5 5.6 Q5.8 8.2 4.6 10.6" stroke="@corpsO" stroke-width="0.6" opacity="0.7" fill="none"/></g>`;
  }
  // visage nu (fantôme) : crâne mou translucide, bouche hurlante (cri) ou éteinte (morne)
  if (prof) {
    const mouthP = p.face === 'cri'
      ? `<path d="M5 4 Q9 5.5 8.5 8.5 Q5.5 10 4 8 Z" fill="#0a0e14"/>` // gueule béante ouverte vers l'avant
      : `<path d="M4 7 Q6.5 8 8 6.6" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
    return `<g opacity="0.82"><path d="M-7 2 Q-9 -12 1 -13 Q9 -11 8.5 0 Q8 8 1 10 Q-6 9 -7 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>${eyes}${mouthP}</g>`;
  }
  const mouth = p.face === 'cri'
    ? `<path d="M-2.8 3.5 Q0 2.5 2.8 3.5 Q3.4 8 0 10.5 Q-3.4 8 -2.8 3.5 Z" fill="#0a0e14"/>` // hurlement déchiré (plus le petit « o » surpris)
    : `<path d="M-3 7 Q0 9 3 7" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
  return `<g opacity="0.82"><path d="M-8 2 Q-9 -12 0 -13 Q9 -12 8 2 Q7 9 0 11 Q-7 9 -8 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>${eyes}${mouth}</g>`;
}
function arm(sx: number, griffes = false): string {
  // manche flottante — pointe FONDUE (op. dégradée), ou main squelettique griffue (p.griffes)
  const sleeve = `<path d="M0 -2 Q${sx * 11} 2 ${sx * 13} 14 Q${sx * 14} 22 ${sx * 10} 26 Q${sx * 12} 20 ${sx * 8} 16 Q${sx * 9} 24 ${sx * 5} 24 Q${sx * 7} 16 ${sx * 4} 8 Q${sx * 3} 2 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
  const tip = griffes
    // main décharnée : paume osseuse + 4 longs doigts-griffes incurvés vers le bas (@cuir)
    ? `<g opacity="0.92"><ellipse cx="${sx * 8.6}" cy="26" rx="2.2" ry="2.6" fill="@cuir" stroke="@corpsO" stroke-width="0.4"/>` +
      `<path d="M${sx * 6.8} 27.4 Q${sx * 6} 32 ${sx * 7} 36 M${sx * 8.4} 28.4 Q${sx * 8} 34 ${sx * 9.2} 38.4 M${sx * 10} 28 Q${sx * 10.4} 33.4 ${sx * 11.6} 37 M${sx * 10.8} 26.2 Q${sx * 12.4} 29.6 ${sx * 13.6} 32.4" stroke="@cuir" stroke-width="1" fill="none" stroke-linecap="round"/></g>`
    : `<path opacity="0.4" d="M${sx * 10} 26 Q${sx * 11} 30 ${sx * 9} 33 M${sx * 5} 24 Q${sx * 5.5} 28 ${sx * 4.5} 31" stroke="@corps" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  return `<g opacity="0.7">${sleeve}${tip}</g>`;
}
// --- chevelure flottante (p.cheveux) : masse ARRIÈRE (sous le visage) + frange (dessus) -----
function hairBehind(view: View): string {
  if (view === 'profile') // crinière emportée vers l'arrière (-x), traîne longue en mèches ondulées
    return `<g opacity="0.92"><path d="M7 -13 Q-4 -17 -10 -11 Q-14 -6 -12 1 Q-17 4 -14 10 Q-19 13 -15 19 Q-20 24 -14 27 Q-12 22 -12.5 18 Q-9.5 19 -9 14 Q-12 10 -10.5 5 Q-8 8 -7 4 Q-10 -1 -8.5 -5 Q-5 -9 1 -10 Q4 -12 7 -13 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>` +
      `<path d="M-8 -7 Q-12 0 -10 8 M-4.5 -5 Q-7 1 -6 6 M-11 8 Q-13 14 -11.5 19" stroke="@cheveuxO" stroke-width="0.6" opacity="0.55" fill="none"/></g>`;
  return `<g opacity="0.92"><path d="M0 -15 Q-10 -16 -12 -6 Q-14 2 -12 10 Q-14 17 -11 23 Q-9 17 -8.5 11 Q-6 14 -5 10 L5 10 Q6 14 8.5 11 Q9 17 11 23 Q14 17 12 10 Q14 2 12 -6 Q10 -16 0 -15 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>` +
    `<path d="M-9 -4 Q-11 4 -9.5 12 M9 -4 Q11 4 9.5 12" stroke="@cheveuxO" stroke-width="0.7" opacity="0.55" fill="none"/></g>`;
}
function hairFringe(view: View): string {
  if (view === 'profile')
    return `<path d="M6.5 -13 Q9.5 -10.5 9 -6.5 Q6.5 -10 2 -10 Q4 -12.5 6.5 -13 Z" fill="@cheveux" opacity="0.92"/>`;
  return `<path d="M-8.2 -7 Q-5 -13.6 0 -13.8 Q5 -13.6 8.2 -7 Q4 -10.8 0 -10.4 Q-4 -10.8 -8.2 -7 Z" fill="@cheveux" opacity="0.92"/>`;
}
// bras D levé brandissant l'épée (p.arme='epee') : manche tendue vers le haut-avant, lame
// d'acier au-dessus de la main — remplace la manche-volute pendante
function armEpee(): string {
  return `<g opacity="0.85">` +
    `<path d="M-1 2 Q1 -6 5 -11 Q8 -14 10 -16 L12 -13 Q9 -10 7 -6 Q5 -1 4 4 Q1 6 -1 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path opacity="0.4" d="M4 4 Q3 9 0 12" stroke="@corps" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="10.6" cy="-14.6" rx="2.1" ry="1.9" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M9.4 -16.6 L18.6 -30.6 L20 -33.2 L20.6 -30.2 L11.8 -15 Z" fill="#cfd9e2" stroke="#7e8ea0" stroke-width="0.5"/>` +
    `<path d="M10.8 -16 L19.6 -30.6" stroke="#96a7b6" stroke-width="0.5" opacity="0.8"/>` +
    `<path d="M7.6 -18.4 L13.6 -13.6" stroke="#4e5a68" stroke-width="1.7" stroke-linecap="round"/>` +
    `<path d="M10 -14.8 L7 -10.6" stroke="@cuir" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="6.4" cy="-9.8" r="1.3" fill="#4e5a68"/>` +
    `</g>`;
}

// faux de faucheuse (p.arme='faux') — portée par le bras AVANT (brasG, z devant le corps) :
// hampe FRANCHEMENT diagonale (~36°) traversant la silhouette (lame en haut-gauche au-dessus de
// la capuche, talon dépassant les volutes à droite), tenue à DEUX mains squelettiques (@cuir) —
// la manche lointaine rejoint la prise basse. Repère LOCAL de brasG (pivot = épaule G).
function armFaux(): string {
  return `<g opacity="0.9">` +
    `<path d="M-8 -22 L30 31" stroke="@cuir" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M-7.2 -21.6 L30.8 31.4" stroke="#141a15" stroke-width="0.6" opacity="0.5"/>` +
    `<circle cx="30" cy="31" r="1" fill="#141a15"/>` +
    `<path d="M-7.6 -21 Q-18 -32 -30 -28.4 Q-20.4 -26.6 -14.6 -23 Q-11 -20.6 -7.6 -18.6 Z" fill="#c9cdb6" stroke="#5d6350" stroke-width="0.5"/>` +
    `<path d="M-9 -22.6 Q-18 -31 -27.6 -28.6" stroke="#eef0e0" stroke-width="0.5" opacity="0.7" fill="none"/>` +
    `<path d="M-9.4 -23.4 L-5.6 -20.2" stroke="#141a15" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M-2 -2 Q2 -3 6 -1 Q9.6 0.4 10.6 2.8 Q8.6 5 5.6 4.2 Q1.6 3 -0.6 3.4 Q-2.6 1 -2 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5" opacity="0.85"/>` +
    `<path d="M23.5 -2 Q20.5 4 19.6 11.5 Q19 15.4 21.6 15.2 Q22.4 9.6 24.4 4.4 Q25.8 0.8 23.5 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5" opacity="0.85"/>` +
    `<ellipse cx="10" cy="3" rx="1.9" ry="2.2" fill="@cuir" stroke="#0a0e14" stroke-width="0.35"/>` +
    `<path d="M8.7 1.8 L11.5 2.8 M8.6 3.2 L11.3 4 M8.9 4.6 L11.1 5.2" stroke="#0a0e14" stroke-width="0.4"/>` +
    `<ellipse cx="19.4" cy="16" rx="1.9" ry="2.2" fill="@cuir" stroke="#0a0e14" stroke-width="0.35"/>` +
    `<path d="M18.1 14.8 L20.9 15.8 M18 16.2 L20.7 17 M18.3 17.6 L20.5 18.2" stroke="#0a0e14" stroke-width="0.4"/>` +
    `</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const SPECTRE_REST: Record<string, number> = {};
/** Flottement : le corps ondule doucement, les bras dérivent en opposition. phase ∈ [0,1). */
export function spectreFloat(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { corps: s * 3, brasG: s * 7, brasD: -s * 7, tete: -s * 2 };
}
/** Ruée spectrale : le buste et les bras se projettent en avant. phase ∈ [0,1]. */
export function spectreLunge(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 16, brasG: k * 26, brasD: k * 26 };
}
/** Dissipation : le spectre s'affaisse et se replie. */
export const SPECTRE_DEATH: Record<string, number> = { corps: 18, brasG: 40, brasD: 40, tete: 24 };

export function resolveSpectreFromProps(
  p: SpectreProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SpectreBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const back = view === 'back';
  const prof = view === 'profile';
  const backHead = `<g opacity="0.82"><path d="M-8 2 Q-9 -12 0 -13 Q9 -12 8 2 Q7 9 0 11 Q-7 9 -8 2 Z" fill="@corpsO"/></g>`;
  const hairy = p.cheveux && !p.hood; // la capuche couvrirait la chevelure
  const art: Record<SpectreBoneId, string> = {
    corps: body(view, p.brume),
    tete: back
      ? (hairy ? backHead + hairBehind('front') : backHead) // de dos la masse couvre tout l'occiput
      : (hairy ? hairBehind(view) + head(p, view) + hairFringe(view) : head(p, view)),
    // PROFIL : le bras proche (D) tendu en avant, le lointain (G) en traîne estompée derrière.
    // FAUX : les deux mains vivent dans armFaux (brasG, devant le corps) — brasD s'efface.
    brasG: p.arme === 'faux' ? armFaux() : prof ? `<g opacity="0.45">${arm(-1, p.griffes)}</g>` : arm(-1, p.griffes),
    brasD: p.arme === 'epee' ? armEpee()
      : p.arme === 'faux' ? `<g opacity="0"/>`
      : prof ? `<g transform="rotate(-24)">${arm(1, p.griffes)}</g>` : arm(1, p.griffes),
  };
  return sortByZ((Object.keys(sk) as SpectreBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const SPECTRE_DEFAULT: SpectreProps = {
  sl: 0.95, hood: false, face: 'morne',
  palette: { corps: '#9fb8c8', corpsO: '#5a7282', corpsH: '#d8e8f0', cheveux: '#3a4a54', cheveuxO: '#222e34', cuir: '#7a90a0' },
};

export function resolveSpectre(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveSpectreFromProps(SPECTRE_SPECIES[species] ?? SPECTRE_DEFAULT, view, pose, colors);
}

export const spectralPlan: BodyPlan = {
  id: 'spectral',
  resolve: (sp, view, pose, opts) => resolveSpectre(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SPECTRE_SPECIES),
  restPose: () => SPECTRE_REST,
  idlePose: spectreFloat, // flottement en continu
  walkPose: spectreFloat, // glisse = flottement
  attackPose: spectreLunge,
  deathPose: () => SPECTRE_DEATH,
  hasView: () => true,
};

export function spectreSvg(
  p: SpectreProps,
  view: View,
  opts: { dead?: boolean; floatPhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SPECTRE_DEATH : opts.floatPhase != null ? spectreFloat(opts.floatPhase) : {};
  return bonesToSvg(resolveSpectreFromProps(p, view, pose, opts.colors));
}
