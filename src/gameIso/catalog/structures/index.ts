import type { StructureAppearanceDef, WallPart } from './types';
import type { WallSeg } from '../../../state/scene';
import { APPARENCE_MUR_NU, apparenceDeclaree } from '../../../state/formeArete';
import { structureAppearances } from '../../../data';
import { shade } from '../../shade';
import { catalogEntry, MISSING_ID, MISSING_TONE, MISSING_TONE_DARK } from '../missing';
export type { StructureAppearanceDef, WallPart } from './types';
export { WALL_PARTS } from './types';

const MAP: Record<string, StructureAppearanceDef> = Object.fromEntries(structureAppearances.map((s) => [s.id, s]));

/** Entrée de REPLI VISIBLE (#877) : un mur au ton d'alarme, jamais l'apparence d'une autre structure. */
const MISSING: StructureAppearanceDef = {
  id: MISSING_ID,
  type: 'structureAppearance',
  label: 'Apparence absente du catalogue',
  face: MISSING_TONE,
  post: MISSING_TONE_DARK,
};

/** Apparence d'une structure par id. `id` absent = INTENTIONNEL (aucune structure posée) → mur nu.
 *  Un `id` PRÉSENT mais SANS entrée dans `structureAppearance.json` est une donnée à corriger (#832) :
 *  repli VISIBLE + avertissement DEV, jamais l'identité d'une autre apparence. */
export function structureAppearance(id?: string): StructureAppearanceDef {
  if (!id) return MAP[APPARENCE_MUR_NU];
  return catalogEntry((cle) => MAP[cle], id, 'structure', MISSING);
}

/** Apparence d'un mur d'arête — SOURCE UNIQUE iso + POV : override visuel, puis structure, sinon mur
 *  nu. L'apparence est une DONNÉE de la carte ; la hauteur n'y entre pas (#1180). */
export function wallApp(seg: WallSeg): StructureAppearanceDef {
  return structureAppearance(apparenceDeclaree(seg));
}

/** Couleur ÉMISSIVE d'une fenêtre allumée (nuit) — celle du bloc `window` de la def. Source unique iso + POV. */
export function windowLit(app: StructureAppearanceDef): string {
  return app.window?.lit ?? app.face;
}

/** Couleur de BASE d'une partie de mur du pivot — SOURCE UNIQUE des deux backends (écran-affine + POV),
 *  qui y appliquent ensuite chacun LEUR lumière (ombre d'orientation iso / tint + brume POV). Tout vient
 *  des CHAMPS de la def (replis `?? face` pour une def incomplète), jamais d'un littéral. */
export function wallPartColor(app: StructureAppearanceDef, part: WallPart): string {
  switch (part) {
    case 'face': case 'parapet': case 'linteau': return app.face;
    case 'panneau': return app.wood?.inset ?? app.face;
    case 'moulure': case 'chambranle': return app.wood?.frame ?? app.face;
    case 'plinthe': return app.wood?.skirt ?? app.face;
    case 'couronnement': return app.wood?.cap ?? app.cap ?? app.face;
    case 'arase': case 'merlon': return app.cap ?? app.face;
    case 'bande': case 'barreau': return app.band ?? app.face;
    case 'jambage': return app.door?.jamb ?? app.face;
    case 'vantail': return app.door?.leaf ?? app.wood?.inset ?? shade(app.face, 0.78);
    case 'vantail-planche': return app.door?.plank ?? app.wood?.skirt ?? app.post;
    case 'poignee': return app.door?.handle ?? app.cap ?? app.wood?.cap ?? app.face;
    case 'vitre': return app.window?.glass ?? app.face;
    case 'meneau': return app.window?.mullion ?? app.wood?.frame ?? app.post;
    case 'poteau': return app.post;
    case 'traverse': return app.claireVoie?.traverseColor ?? app.band ?? app.face;
    case 'gravats': case 'seuil': return app.rubble ?? app.wood?.rubble ?? app.face;
    case 'gravats-tas': return app.rubbleHi ?? app.wood?.rubbleHi ?? app.face;
  }
}

/** FAMILLE de relief d'une partie de mur — ce qu'il y a DERRIÈRE elle décide de son volume :
 *  - `matiere` : la partie EST la matière pleine du mur (courtine, couronnements, montants) ;
 *  - `saillie` : la partie est POSÉE devant de la matière pleine (`jutM` = saillie par côté) ;
 *  - `traversant` : la partie BOUCHE une ouverture, il n'y a RIEN derrière elle (`thickM` = épaisseur
 *    totale) — un vantail de porte, un carreau, les barreaux d'une claire-voie, un tas de gravats.
 *  CALIBRAGE des saillies (#1176 P1-E) : le décalage de la carte d'ombre le long de la normale
 *  (`sunRig().normalBias`, `sceneMeshes.ts`) suit le rayon englobant des CASTEURS — géométrie ET quads
 *  de billboard (`worldShadowBox`) —, donc la TAILLE de la scène. Mesuré (m) sur les six scènes-témoins
 *  du volumique, au pire des trois conventions de taille de billboard :
 *    opera 0,2118 · arene 0,1883 · siege-enceinte 0,1623 · diligence 0,1471 · vitrine-batiments 0,1142 ·
 *    pont-vitrine 0,0677.
 *  Un relief plus mince que ce décalage se noie dans sa propre ombre. Les saillies partent donc de
 *  0,26 m par côté — 22,7 % au-dessus du pire (5,9 px d'écran affine à 2 m/tuile, `pxPerM(2)` =
 *  22,63 px/m), sur un mur de 0,168 m d'épaisseur : relief FRANC, style épuré assumé. Une scène plus
 *  large que l'opéra rougit la garde par scène de `sceneMeshes.test.ts` au lieu de noyer le relief en
 *  silence. Chaque valeur reste éditable par apparence (`StructureAppearanceDef.relief`). */
export type WallPartRelief =
  | { famille: 'matiere' }
  | { famille: 'saillie'; jutM: number }
  | { famille: 'traversant'; thickM: number };

export function wallPartRelief(part: WallPart): WallPartRelief {
  switch (part) {
    case 'face': case 'parapet': case 'arase': case 'merlon': case 'couronnement':
    case 'poteau': case 'jambage':
      return { famille: 'matiere' };
    case 'panneau': case 'plinthe': case 'bande':
      return { famille: 'saillie', jutM: 0.26 };
    case 'moulure': case 'chambranle':
      return { famille: 'saillie', jutM: 0.28 };
    case 'vantail': case 'linteau': case 'seuil':
      return { famille: 'traversant', thickM: 0.17 };
    // Porte FERMÉE, trois épaisseurs CROISSANTES : le vantail affleure l'ouverture qu'il bouche, ses
    // joints de planches sont cloués DESSUS (il en dépasse de part et d'autre), et le bouton traverse
    // le tout pour saillir des DEUX côtés — c'est ce geste que verrouille `relief.test.ts`.
    case 'vantail-planche': return { famille: 'traversant', thickM: 0.21 };
    case 'poignee': return { famille: 'traversant', thickM: 0.28 };
    case 'meneau': return { famille: 'traversant', thickM: 0.12 };
    case 'barreau': return { famille: 'traversant', thickM: 0.1 };
    case 'traverse': return { famille: 'traversant', thickM: 0.13 };
    case 'gravats': return { famille: 'traversant', thickM: 0.6 };
    case 'gravats-tas': return { famille: 'traversant', thickM: 0.8 };
    case 'vitre': return { famille: 'traversant', thickM: 0 };
  }
  // Une `part` hors de l'union vient du CODE (un builder qui émettrait une partie non catalogée), jamais
  // d'une donnée : elle LÈVE en se nommant, là où un id de donnée absent d'un catalogue prend le repli
  // VISIBLE (`catalogEntry`, #877).
  throw new Error(`partie de mur inconnue : ${part}`);
}

/** ÉPAISSEUR MONDE (m) de la MATIÈRE PLEINE d'un mur — AUTHORÉE EN MÈTRES, comme toute autre épaisseur
 *  du catalogue, et surchargeable par apparence (`StructureAppearanceDef.relief.wallM`). Elle valait
 *  jusqu'à C6 une largeur de TRAIT du peintre SVG d'authoring (3,8 px) ramenée au monde par l'échelle
 *  d'écran — un mur y était donc d'autant plus épais que la carte comptait de mètres par tuile. La
 *  valeur ci-dessous est l'équivalent de ce trait à 2 m/tuile, l'échelle de toutes les scènes de jeu :
 *  le geste déplace la SOURCE, pas le goût. */
export const WALL_MATTER_M = 0.168;

/** Épaisseur de la matière pleine pour une apparence donnée. */
export function wallMatterM(app?: StructureAppearanceDef): number {
  return app?.relief?.wallM ?? WALL_MATTER_M;
}

/** LARGEURS MONDE (m) des MONTANTS — poteau et jambage d'un mur (`builders/walls`), pilier de surplomb
 *  d'un tablier (`builders/floors`). Mêmes provenance et conversion que `WALL_MATTER_M` (3,8 / 3,6 /
 *  5 px de trait à 2 m/tuile), désormais authorées en mètres. */
export const UPRIGHT_WIDTH_M: Record<string, number> = { poteau: 0.168, jambage: 0.159, pilier: 0.221 };

/** SAILLIE (m) d'un montant hors des joues du mur qu'il encadre. Sans elle, la croix d'un montant a
 *  EXACTEMENT l'épaisseur de la boîte de mur et s'y inscrit à ras — mesuré sur `arene` : 340 montants
 *  sur 364 entièrement dans la matière, part noyée moyenne 99,2 %. */
export const UPRIGHT_OVERHANG_M = 0.044;

/** LARGEUR MONDE de la croix d'un montant : sa largeur propre, jamais moins que l'épaisseur du mur
 *  qu'il encadre, plus une saillie de chaque côté. */
export function uprightCrossM(part: string | undefined, wallM: number): number {
  const w = (part ? UPRIGHT_WIDTH_M[part] : undefined) ?? UPRIGHT_WIDTH_M.poteau;
  return Math.max(w, wallM) + 2 * UPRIGHT_OVERHANG_M;
}

/** ÉPAISSEUR MONDE (m) du volume d'une partie de mur — SOURCE UNIQUE du backend volumique, résolue par
 *  (apparence × partie) comme l'est sa couleur (`wallPartColor`). `wallM` = épaisseur de la matière
 *  pleine du mur (`wallMatterM`). 0 = la partie reste un PLAN unique, au plan médian du mur (le carreau
 *  d'une croisée). */
export function wallPartDepthM(app: StructureAppearanceDef, part: WallPart, wallM: number): number {
  const relief = wallPartRelief(part);
  if (relief.famille === 'matiere') return wallM;
  if (relief.famille === 'saillie') return wallM + 2 * (app.relief?.jut?.[part] ?? relief.jutM);
  return app.relief?.thick?.[part] ?? relief.thickM;
}
