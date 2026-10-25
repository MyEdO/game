/**
 * Clips d'AMBIANCE (brin I) — animations en boucle, hors combat, pilotables depuis
 * l'éditeur de scène (champ `anim` d'une entité). Servent à donner vie à une scène
 * (ex. arrivée sur une ambuscade : un mutant accroupi qui dévore un cadavre).
 *
 * Conventions d'angles (deg) : cuisse > 0 plie la jambe en avant, tibia < 0 plie le
 * genou (accroupi/agenouillé) ; torse/tete > 0 penche en avant/bas ; epaule < 0 lève
 * les bras, > 0 les descend vers l'avant/le sol.
 */
import type { Clip } from './clips';
import type { RoleAmbiant } from '../../../noyau/animation';

/**
 * Animation phare : créature qui DÉVORE une proie au sol. Le rig est un pantin 2D de
 * FACE (les rotations sont dans le plan de l'image, pas de bascule en profondeur) → on
 * NE peut PAS faire un vrai accroupi. On joue donc un mutant DEBOUT, jambes écartées,
 * bras qui plongent vers le sol devant lui et reviennent (déchiquète), tête qui bobe.
 * Le prop « cadavre » posé à côté complète la lecture.
 */
const feeding: Clip = {
  loop: true,
  steps: [
    // bras plongés bas-devant sur la proie, tête penchée, appui jambes écartées
    { pose: { tete: 12, epauleD: 46, avantBrasD: 40, epauleG: 40, avantBrasG: 36, cuisseG: 12, cuisseD: -12, torse: 5 }, ms: 480, easing: 'easeInOut' },
    // arrache un morceau : remonte bras et tête (déchiquète)
    { pose: { tete: -4, epauleD: 24, avantBrasD: 16, epauleG: 20, avantBrasG: 14, cuisseG: 12, cuisseD: -12, torse: 3 }, ms: 300, easing: 'easeOut' },
    // replonge sur la proie
    { pose: { tete: 10, epauleD: 44, avantBrasD: 38, epauleG: 38, avantBrasG: 34, cuisseG: 12, cuisseD: -12, torse: 5 }, ms: 420, easing: 'easeInOut' },
  ],
};

/** Recueilli en prière : DEBOUT, mains jointes levées devant le visage, léger balancement. */
const praying: Clip = {
  loop: true,
  steps: [
    { pose: { tete: 8, epauleG: -34, epauleD: -34, avantBrasG: -50, avantBrasD: -50, torse: 3 }, ms: 1700, easing: 'easeInOut' },
    { pose: { tete: 12, epauleG: -36, epauleD: -36, avantBrasG: -52, avantBrasD: -52, torse: 5 }, ms: 1700, easing: 'easeInOut' },
  ],
};

/** Recroquevillé de terreur : bras au-dessus de la tête, pieds écartés, tremblement. */
const cowering: Clip = {
  loop: true,
  steps: [
    { pose: { tete: 14, epauleG: -82, epauleD: -82, avantBrasG: -48, avantBrasD: -48, cuisseG: 8, cuisseD: -8, torse: 4 }, ms: 400, easing: 'easeInOut' },
    { pose: { tete: 16, epauleG: -84, epauleD: -78, avantBrasG: -50, avantBrasD: -46, cuisseG: 8, cuisseD: -8, torse: 6 }, ms: 400, easing: 'easeInOut' },
  ],
};

/** Hurle à la lune : tête rejetée en arrière (tete < 0), buste cambré, épaules ouvertes. */
const howling: Clip = {
  loop: true,
  steps: [
    { pose: { tete: -16, torse: -6, epauleG: 18, epauleD: 18, avantBrasG: 8, avantBrasD: 8 }, ms: 900, easing: 'easeInOut' },
    { pose: { tete: -24, torse: -9, epauleG: 24, epauleD: 24, avantBrasG: 10, avantBrasD: 10 }, ms: 700, easing: 'easeInOut' },
  ],
};

/** Respiration subtile debout (idem idle de combat). */
const standing: Clip = {
  loop: true,
  steps: [
    { pose: { torse: 1.5, tete: 1 }, ms: 1500, easing: 'easeInOut' },
    { pose: {}, ms: 1500, easing: 'easeInOut' },
  ],
};

export const AMBIENT_CLIPS: Readonly<Record<string, Clip>> = { feeding, praying, cowering, standing, howling } satisfies Record<RoleAmbiant, Clip>;

/** Alias : clés d'ambiance courtes authorées sur une entité de scène (`gameIso/sceneAnims`)
 *  → clip rig correspondant, pour qu'une `anim` authorée trouve un geste sur un corps de rig. */
const ALIASES: Readonly<Record<string, RoleAmbiant>> = {
  feed: 'feeding', howl: 'howling', breathe: 'standing', sway: 'standing', wrap: 'standing',
};

/** Liste pour l'éditeur (clé + libellé FR). */
export const AMBIENT_LIST: { key: RoleAmbiant; label: string }[] = [
  { key: 'standing', label: 'Debout (respire)' },
  { key: 'feeding', label: 'Dévore un cadavre' },
  { key: 'howling', label: 'Hurle (tête levée)' },
  { key: 'praying', label: 'En prière (incliné)' },
  { key: 'cowering', label: 'Terrorisé (recroquevillé)' },
];

export function ambientClip(key?: string | null): Clip | null {
  if (!key) return null;
  return AMBIENT_CLIPS[key] ?? AMBIENT_CLIPS[ALIASES[key]] ?? null;
}
