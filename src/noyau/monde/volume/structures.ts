import type { WallPart } from '../../../data/structureAppearance.types';
import type { StructureAppearanceDef } from '../../../data';
import type { EntreeVivante } from '../../../data/datasets';
import type { WallSeg } from '../scene';
import { structureAppearances } from '../../../data';
import { shade } from '../../../lib/ombrage';
import { apparenceDuSegment, facadeAppearance, facadeRegit, type FacadeEdge } from '../facades';
import { catalogEntry, MISSING_ID, MISSING_TONE, MISSING_TONE_DARK } from './missing';
import { RELIEF_PART_KEYS } from '../../../data/schemas/defs/structureAppearance';

const MAP: Record<string, EntreeVivante<StructureAppearanceDef>> = Object.fromEntries(structureAppearances.map((s) => [s.id, s]));

/** Entrée de REPLI VISIBLE (#877) : un mur au ton d'alarme, jamais l'apparence d'une autre structure. */
const MISSING: EntreeVivante<StructureAppearanceDef> = {
  id: MISSING_ID,
  type: 'structureAppearance',
  label: 'Apparence absente du catalogue',
  face: MISSING_TONE,
  post: MISSING_TONE_DARK,
  kit: 'colombage',
};

/** Apparence d'une structure par id. `id` absent = INTENTIONNEL (aucune structure posée) → mur nu.
 *  Un `id` PRÉSENT mais SANS entrée dans `structureAppearance.json` est une donnée à corriger (#832) :
 *  repli VISIBLE + avertissement DEV, jamais l'identité d'une autre apparence. */
export function structureAppearance(id?: string): EntreeVivante<StructureAppearanceDef> {
  if (!id) return MAP['plain'];
  return catalogEntry((cle) => MAP[cle], id, 'structure', MISSING);
}

/** Apparence d'un mur d'arête — SOURCE UNIQUE iso + POV : override visuel, puis structure, sinon mur
 *  nu. L'apparence est une DONNÉE de la carte ; la hauteur n'y entre pas (#1180). */
export function wallApp(seg: WallSeg): EntreeVivante<StructureAppearanceDef> {
  return structureAppearance(apparenceDuSegment(seg));
}

/** Apparence de la façade authorée `id` (`noyau/monde/facades`) : celle de son mur, sous l'id de la façade ; une
 *  apparence de structure si `id` n'est pas une façade. */
export function facadeStructureAppearance(id?: string): EntreeVivante<StructureAppearanceDef> {
  const definition = facadeAppearance(id);
  if (!definition) return structureAppearance(id);
  return { ...structureAppearance(definition.wallAppearance), id: definition.id };
}

/** Croisée de repli (def SANS bloc `window`) = celle de `plain` (DONNÉE JSON : verre froid + ambre allumé) —
 *  jamais un littéral de couleur (garde-fou renderer). C'est un repli de PART absente sur une def
 *  RÉELLE, pas le repli d'un id inconnu : celui-là est le ton d'alarme de `noyau/monde/volume/missing.ts` (#877). */
const defaultWindow = () => structureAppearance('plain').window;
/** Couleur ÉMISSIVE d'une fenêtre allumée (nuit) — la def sinon le repli `plain`. Source unique iso + POV. */
export function windowLit(app: EntreeVivante<StructureAppearanceDef>): string {
  return app.window?.lit ?? defaultWindow()?.lit ?? app.face;
}

/** Couleur de BASE d'une partie de mur du pivot — SOURCE UNIQUE des deux backends (écran-affine + POV),
 *  qui y appliquent ensuite chacun LEUR lumière (ombre d'orientation iso / tint + brume POV). Tout vient
 *  des CHAMPS de la def (replis `?? face` pour une def incomplète), jamais d'un littéral. */
export function wallPartColor(app: EntreeVivante<StructureAppearanceDef>, part: WallPart): string {
  switch (part) {
    case 'face': case 'parapet': case 'linteau': return app.face;
    case 'panneau': return app.wood?.inset ?? app.face;
    case 'moulure': case 'chambranle': return app.wood?.frame ?? app.face;
    case 'plinthe': return app.wood?.skirt ?? app.face;
    case 'couronnement': return app.wood?.cap ?? app.cap ?? app.face;
    case 'arase': case 'merlon': return app.cap ?? app.face;
    case 'bande': case 'herse-barreau': return app.band ?? app.face;
    case 'jambage': return app.door?.jamb ?? app.face;
    case 'vantail': return app.door?.leaf ?? app.wood?.inset ?? shade(app.face, 0.78);
    case 'vantail-planche': return app.door?.plank ?? app.wood?.skirt ?? app.post;
    case 'poignee': return app.door?.handle ?? app.cap ?? app.wood?.cap ?? app.face;
    case 'vitre': return app.window?.glass ?? defaultWindow()?.glass ?? app.face;
    case 'meneau': return app.window?.mullion ?? app.wood?.frame ?? app.post;
    case 'poteau': return app.post;
    case 'herse-traverse': return app.door?.herse?.traverseColor ?? app.band ?? app.face;
    case 'gravats': case 'seuil': return app.rubble ?? app.wood?.rubble ?? app.face;
    case 'gravats-tas': return app.rubbleHi ?? app.wood?.rubbleHi ?? app.face;
  }
}

/** FAMILLE de relief d'une partie de mur — ce qu'il y a DERRIÈRE elle décide de son volume :
 *  - `matiere` : la partie EST la matière pleine du mur (courtine, couronnements, montants) ;
 *  - `saillie` : la partie est POSÉE devant de la matière pleine (`jutM` = saillie par côté) ;
 *  - `traversant` : la partie BOUCHE une ouverture, il n'y a RIEN derrière elle (`thickM` = épaisseur
 *    totale) — un vantail de porte, un carreau, les barreaux d'une herse, un tas de gravats.
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
    case 'herse-barreau': return { famille: 'traversant', thickM: 0.1 };
    case 'herse-traverse': return { famille: 'traversant', thickM: 0.13 };
    case 'gravats': return { famille: 'traversant', thickM: 0.6 };
    case 'gravats-tas': return { famille: 'traversant', thickM: 0.8 };
    case 'vitre': return { famille: 'traversant', thickM: 0 };
  }
  // Une `part` hors de l'union vient du CODE (un builder qui émettrait une partie non catalogée), jamais
  // d'une donnée : elle LÈVE en se nommant, là où un id de donnée absent d'un catalogue prend le repli
  // VISIBLE (`catalogEntry`, #877).
  throw new Error(`partie de mur inconnue : ${part}`);
}

/** La partie admet-elle une surcharge de relief (`RELIEF_PART_KEYS`, le schéma de `structureAppearance.json`) ? */
const estSurchargeable = (part: WallPart): part is (typeof RELIEF_PART_KEYS)[number] => (RELIEF_PART_KEYS as readonly WallPart[]).includes(part);

/** ÉPAISSEUR MONDE (m) du volume d'une partie de mur — SOURCE UNIQUE du backend volumique, résolue par
 *  (apparence × partie) comme l'est sa couleur (`wallPartColor`). `wallM` = épaisseur de la matière
 *  pleine du mur (`wallMatterM`). 0 = la partie reste un PLAN unique, au plan médian du mur (le carreau
 *  d'une croisée). */
export function wallPartDepthM(app: EntreeVivante<StructureAppearanceDef>, part: WallPart, wallM: number): number {
  const relief = wallPartRelief(part);
  if (relief.famille === 'matiere') return wallM;
  const surchargeable = estSurchargeable(part);
  if (relief.famille === 'saillie') return wallM + 2 * ((surchargeable ? app.relief?.jut?.[part] : undefined) ?? relief.jutM);
  return (surchargeable ? app.relief?.thick?.[part] : undefined) ?? relief.thickM;
}

/** Apparence d'une ARÊTE de mur du rendu web (`wallGeometry` de `walls.ts`), résolue en sa def : la façade authorée sur
 *  l'arête l'emporte tant que le segment ne pose ni structure ni override (`facadeRegit`), sinon `wallApp` (#1180). */
export function edgeAppearance(facade: FacadeEdge | undefined, seg: WallSeg): EntreeVivante<StructureAppearanceDef> {
  return facadeRegit(facade, seg) ? facadeStructureAppearance(facade.appearance) : wallApp(seg);
}
