/**
 * FORMES de NUÉE — la silhouette d'UN constituant de l'amas + sa palette par défaut, DÉRIVÉES des
 * seuls fichiers `defs/<id>.ts` (cf. `formDef.ts`). `composeSwarm` lit `SWARM_FORMS[appearance.species]`
 * et tapisse l'amas de CE critter. Ajouter une nuée = déposer un fichier defs/. Repli `swarmFormOf`
 * par le `plan` de la def de créature. `appearance.colors` surcharge la palette (buildTokenMap).
 */
import type { View } from '../facing';
import type { PaletteDeclaree } from '../palette';
import { defById } from '../creatures';
import { SWARM_FORM_DEFS } from './_registry.generated';

export interface SwarmForm {
  /** Dessine UN constituant centré en (cx,cy), à l'échelle s, miroité si flip ; +x = avant/tête. */
  critter(cx: number, cy: number, s: number, flip: boolean, view: View): string;
  /** Palette par défaut de la forme (gammes : base, ombre, lumière) — surchargeable par `appearance.colors`. */
  palette: PaletteDeclaree;
  /** Forme VOLANTE (oiseaux) : tapissée en flock dispersé en hauteur, sans amas au sol. */
  aerial?: boolean;
}

const fnum = (flip: boolean) => (flip ? -1 : 1);
/** Enveloppe commune : translate+scale (miroir horizontal si flip) autour du dessin local. */
function wrap(cx: number, cy: number, s: number, flip: boolean, inner: string): string {
  return `<g transform="translate(${cx},${cy}) scale(${(s * fnum(flip)).toFixed(3)},${s.toFixed(3)})">${inner}</g>`;
}
/** Œil sombre + reflet ambré, au museau (avant +x) — réutilisé par le repli générique. */
const eye = (x = 4.2, y = -1.1): string =>
  `<circle cx="${x}" cy="${y}" r="1" fill="#160c06"/><circle cx="${x + 0.3}" cy="${y - 0.3}" r="0.35" fill="#e8c84a"/>`;

// Générique (DEFAULT) : l'amas brun ovoïde d'origine — repli GÉNÉRIQUE pour toute nuée non typée
// (art procédural, pas un def d'entité).
const generiqueDraw =
  '<path d="M-2.6 4 l-1.6 3.4 M0 4.4 l0 3.4 M2.6 4 l1.6 3.4" stroke="@corpsO" stroke-width="0.7"/>' +
  '<ellipse cx="0" cy="0" rx="5.6" ry="3.7" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>' +
  '<ellipse cx="0" cy="1.3" rx="4" ry="1.7" fill="@corpsO" opacity="0.45"/>' +
  '<path d="M-5.4 -0.6 q-3.2 -0.8 -5 -2.8" stroke="@corpsO" stroke-width="0.8" fill="none"/>' +
  eye();
export const DEFAULT_FORM: SwarmForm = {
  critter: (cx, cy, s, flip) => wrap(cx, cy, s, flip, generiqueDraw),
  palette: { corps: '#6a5a44', corpsO: '#3e3424', corpsH: '#8a7a5e' },
};

/** Table des FORMES de nuée — DÉRIVÉE des fichiers `defs/` (keyée par id de forme). */
export const SWARM_FORMS: Record<string, SwarmForm> = Object.fromEntries(
  SWARM_FORM_DEFS.map((d) => [d.id, {
    critter: (cx: number, cy: number, s: number, flip: boolean) => wrap(cx, cy, s, flip, d.draw),
    palette: d.palette,
    aerial: d.aerial,
  }]),
);

/** Repli : une nuée dont `appearance.species` est une VRAIE espèce (pas un id de forme) est routée
 *  par le `plan` de sa def de créature. N'importe QUE `defById` (pas resolveRender/bodyPlan → cycle). */
const PLAN_TO_FORM: Record<string, string> = {
  arachnid: 'araignees',
  avian: 'noctecorbes',
  squig: 'squigs',
  quadruped: 'rats',
  winged: 'noctecorbes',
  biped: 'zombies',
};
export function swarmFormOf(species: string): SwarmForm | undefined {
  const plan = defById(species)?.plan;
  return plan ? SWARM_FORMS[PLAN_TO_FORM[plan]] : undefined;
}
