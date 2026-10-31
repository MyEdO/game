/**
 * LE GABARIT D'UNE BASE (#2972, #3086) : la pose du gabarit (`poseDuGabarit`), les poids des shape keys de silhouette
 * (`poidsDeSilhouettes`) et la marche de la base (`marcheDeLaBase`), calculés une fois ici pour l'évaluateur
 * (`evaluateur/gabarit.ts`, qui les pose sur une scène three) et pour l'hôte (`hotes/godot/pont/CONTRAT.md`, « Gabarit
 * d'une base »). PUR : ni three ni le noyau à l'exécution (`chargerEvaluateur`, `charger.mjs`).
 */
import type { GabaritResolu, Sexe } from '../../../src/noyau/index.ts';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence.ts';
import type { ManifesteDeBase, TableDeGabarit } from './manifesteDeBase.ts';

export const FACTEURS_NEUTRES: GabaritResolu = Object.freeze({ sl: 1, legs: 1, arms: 1, head: 1, st: 1 });

export const CARRURE_MOINS = 'carrure_moins';
export const CARRURE_PLUS = 'carrure_plus';
export const FEMININ = 'feminin';
export const CORPULENCE = 'corpulence';

const borne = (x: number): number => Math.min(1, Math.max(0, x));

/** La pose du gabarit : l'échelle uniforme de l'os racine, par os listé de la table le facteur de la position +Y
 *  locale de chacun de ses os enfants (le produit des facteurs si l'os est listé sous plusieurs clés), et les os des
 *  pieds (`appuis.pieds`) que la translation de la racine ramène au sol (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base »). */
export interface PoseDuGabarit {
  readonly racine: { readonly os: string; readonly echelle: number };
  readonly enfantsDe: Readonly<Record<string, number>>;
  readonly pieds: readonly string[];
}

export function poseDuGabarit({ gabarit, appuis }: Pick<ManifesteDeBase, 'gabarit' | 'appuis'>, facteurs: GabaritResolu): PoseDuGabarit {
  const enfantsDe: Record<string, number> = {};
  for (const cle of ['legs', 'arms', 'head'] as const) {
    for (const nom of gabarit[cle]) enfantsDe[nom] = (enfantsDe[nom] ?? 1) * facteurs[cle];
  }
  return { racine: { os: gabarit.racine, echelle: facteurs.sl }, enfantsDe, pieds: appuis.pieds };
}

/** Les poids des shape keys de carrure pour `st` : `carrure_moins` sur [min ; 1], `carrure_plus` sur [1 ; max], jamais les deux. */
export const poidsDeCarrure = (st: number, bornes: TableDeGabarit['st']): Record<string, number> => ({
  [CARRURE_MOINS]: st < 1 ? borne((1 - st) / (1 - bornes.min)) : 0,
  [CARRURE_PLUS]: st > 1 ? borne((st - 1) / (bornes.max - 1)) : 0,
});

/** Les poids des shape keys de silhouette d'un corps : la carrure (`poidsDeCarrure`), `feminin` par le sexe,
 *  `corpulence` par `build` (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base »). */
export const poidsDeSilhouettes = ({ sex, build, st }: { sex: Sexe; build: number; st: number }, table: TableDeGabarit): Record<string, number> => ({
  ...poidsDeCarrure(st, table.st),
  [FEMININ]: sex === 'F' ? 1 : 0,
  [CORPULENCE]: borne((build - BUILD_NEUTRE) / (1 - BUILD_NEUTRE)),
});

/** La marche d'une base, ou son refus : `marche-ambigue` quand `appuis.vitessesAuSol` n'a pas exactement un clip. */
export type MarcheDeLaBase =
  | { readonly ok: true; readonly clip: string; readonly vitesse: number }
  | { readonly ok: false; readonly code: 'marche-ambigue'; readonly detail: string };

/** Le clip de marche de la base, l'unique clé de `appuis.vitessesAuSol`, et sa vitesse au sol, `vitessesAuSol[clip]` (#3104). */
export function marcheDeLaBase(manifeste: Pick<ManifesteDeBase, 'appuis'>): MarcheDeLaBase {
  const clips = Object.keys(manifeste.appuis.vitessesAuSol);
  if (clips.length !== 1) {
    return { ok: false, code: 'marche-ambigue', detail: `${clips.length} clip(s) dans appuis.vitessesAuSol (${clips.join(', ') || 'aucun'}), un seul attendu` };
  }
  const [clip] = clips;
  return { ok: true, clip, vitesse: manifeste.appuis.vitessesAuSol[clip] };
}
