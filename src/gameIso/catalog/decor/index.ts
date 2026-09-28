/**
 * Catalogue de décors (placeables NWN) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un décor = déposer `defs/<id>.ts` (`export const prop: PropViz = { id, label, render, … }`)
 * puis `npm run gen` (auto en dev via le plugin Vite). Plus de `Record` à maintenir à la main.
 * Chaque `render` renvoie un SVG en boîte locale 120×150, pieds en (60,150).
 */
import type { PropViz, RenderCtx } from '../types';
import type { View } from '../../rig/facing';
import { project } from '../../rig/facing';
import { nearestView, MISSING_ART } from '../../rig/viewArt';
import { warnMissing } from '../missing';
import type { Dir8 } from '../../../state/dir8';
import type { Rot } from '../../../geometry/iso';
import { PROP_DEFS } from './_registry.generated';

export const PROPS: Record<string, PropViz> = Object.fromEntries(PROP_DEFS.map((p) => [p.id, p]));

/** Ce que la diagnostique NOMME quand l'entité ne NOMME aucun type — libellé d'AVERTISSEMENT, jamais
 *  un id de repli : rien ne se résout sous ce nom. */
const SANS_TYPE = '(aucun type nommé)';

/** SVG d'un décor. `dir` (orientation MONDE d'auteur, Dir8) + `camRot` (cran caméra) → `ctx`. Un prop
 *  ORIENTÉ (`views`) : la MACHINERIE projette ici `project(dir, camRot) → {view, mirror}`, choisit
 *  la vue et applique le miroir (profil gauche/droit) — il PIVOTE avec la caméra. Un prop symétrique
 *  (`render`) ignore l'orientation. La sélection de vue vit ICI, JAMAIS dans une def (`defs/**`). */
export function propSvg(ref: string | undefined, dir?: Dir8, camRot: Rot = 0): string {
  const prop = ref === undefined ? undefined : PROPS[ref];
  if (!prop) return missingPropSvg(ref);
  const ctx: RenderCtx = { dims: { w: 0, h: 0, rot: camRot }, dir };
  if (prop.views) {
    const { view, mirror } = project(dir ?? 'S', camRot);
    // Sélection vue + repli PARTAGÉS (`nearestView`, contrat `ViewArt`) — une vue absente replie sur la plus
    // proche déclarée. Miroir de la boîte 120×150 (centre en x=60) : le profil « gauche » se déduit du droit.
    const body = nearestView(prop.views, view)({}, ctx);
    return mirror ? `<g transform="translate(120,0) scale(-1,1)">${body}</g>` : body;
  }
  // Une def sans `views` NI `render` ne dessine rien : c'est le même manque qu'un id absent du registre.
  if (!prop.render) return missingPropSvg(ref);
  return prop.render({}, ctx);
}

/** REPLI VISIBLE d'un `ref` de décor que le registre ne rend pas (#877) : la silhouette d'erreur
 *  PARTAGÉE (`MISSING_ART`, #223) posée aux pieds de la boîte 120×150 — jamais l'art d'un AUTRE décor.
 *  MÊME sort pour la ref HORS REGISTRE et pour la ref ABSENTE : une ref de décor se DIT ou se REFUSE. */
export function missingPropSvg(ref: string | undefined): string {
  warnMissing('décor', ref ?? SANS_TYPE);
  return `<g transform="translate(60,150)">${MISSING_ART.profile!()}</g>`;
}

/** Art BRUT d'une vue EXACTEMENT déclarée par un prop orienté (planche-contact QC), sinon null (case
 *  vide = couverture manquante). Sans projection, sans repli, sans miroir — pour relire face/profil/dos
 *  côte à côte comme les vues de rig/tenue et VOIR la couverture réelle de chaque prop. */
export function propViewSvg(ref: string, view: View): string | null {
  const draw = PROPS[ref]?.views?.[view];
  return draw ? draw({}, { dims: { w: 0, h: 0, rot: 0 } }) : null;
}
