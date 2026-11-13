/**
 * LA CRÉNELURE (#3476, lot C) : la couronne crénelée d'un mur fortifié (`StructureAppearanceDef.parapet`) et la crête
 * qui ceinture une zone crénelée (`Layer.crenellated`), en faces du pivot, que le builder des murs
 * et le volume du monde (`./volume`) dessinent.
 */
import type { WallPart } from '../../../data/structureAppearance.types';
import type { StructureAppearanceDef } from '../../../data';
import type { EntreeVivante } from '../../../data/datasets';
import { DIR4_ORDER, DIR8_DELTA } from '../../../geometry/dir8';
import { isoPxToM } from '../iso';
import { METRES_PER_LEVEL, gradeBetween } from '../relief';
import { crenellatedAt, edgeOf, heightAt, isCrenellated, isWalkable, structureAt, wallEnds, type SceneDuVolume, type WallSide } from '../scene';
import { structureAppearance } from './structures';
import type { Face, GP } from './types';

type GXY = { x: number; y: number };

/** COURONNE crénelée (parapet dressé + ferrure + arase + merlons) posée à partir de la hauteur `baseH`,
 *  le long de l'arête A→B. SOURCE UNIQUE : (a) le sommet d'une fortification (baseH = haut de la face pleine) ET
 *  (b) la crête de PÉRIMÈTRE d'une zone crénelée (baseH = surface de la zone). Merlons = 1 tronçon / `merlonStep`
 *  (fraction 0..1 de CETTE arête → motif périodique par case). */
export function crownFaces(app: EntreeVivante<StructureAppearanceDef>, A: GXY, B: GXY, baseH: number): Face[] {
  const par = app.parapet;
  if (!par) return [];
  const at = (t: number): GXY => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  const mat = (part: WallPart) => ({ domain: 'structure' as const, id: app.id, part });
  const span = (part: WallPart, t0: number, t1: number, hLo: number, hHi: number): Face => {
    const P0 = at(t0), P1 = at(t1);
    return { poly: [{ ...P0, h: hHi }, { ...P1, h: hHi }, { ...P1, h: hLo }, { ...P0, h: hLo }], material: mat(part), oriented: false };
  };
  const slab = (part: WallPart, hLo: number, hHi: number): Face => span(part, 0, 1, hLo, hHi);
  const P = par.heightLevelFrac * METRES_PER_LEVEL;
  const bandLo = baseH + P * par.parapetBandFrac;
  const crest: Face[] = [
    slab('parapet', baseH, baseH + P),
    slab('bande', bandLo, bandLo + isoPxToM(par.bandThickPx)),
    slab('arase', baseH + P - isoPxToM(par.arasePx), baseH + P),
  ];
  for (let i = 0; i < par.merlonCount; i += par.merlonStep)
    crest.push(span('merlon', i / par.merlonCount, (i + 1) / par.merlonCount, baseH + P, baseH + P + isoPxToM(par.merlonHeightPx)));
  return crest;
}

/** La crête d'une case crénelée sur une arête de son périmètre. */
export interface CreteDePerimetre {
  /** La case crénelée qu'elle ceinture. */
  case: { x: number; y: number; z: number };
  /** L'arête où elle se dresse (`edgeOf`), à la couche de la case. */
  arete: { x: number; y: number; side: WallSide; z: number };
  apparence: EntreeVivante<StructureAppearanceDef>;
  /** Ses extrémités, à la surface de la case (`wallEnds`, `heightAt`). */
  ends: [GP, GP];
  faces: Face[];
}

/** Les crêtes crénelées de `scene` : pour chaque arête de PÉRIMÈTRE d'une case crénelée (voisine de même couche NON
 *  crénelée), sa couronne (`crownFaces`) assise à la surface de la case. Merlons CEINTURANT la zone, jamais à
 *  l'intérieur. Une crête n'est PAS un `WallSeg` de scène : elle ne coupe NI le passage NI la LdV plongeante (les
 *  défenseurs tirent par-dessus). La MAÇONNERIE, elle, vient du bloc plein du sol. */
export function cretesDePerimetre(scene: SceneDuVolume): CreteDePerimetre[] {
  const { w, h } = scene.dimensions;
  const out: CreteDePerimetre[] = [];
  for (const { z, crenellated } of scene.layers) {
    if (!crenellated) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const appId = crenellatedAt(scene, x, y, z);
        if (!appId) continue;
        const surfaceH = heightAt(scene, x, y, z);
        const apparence = structureAppearance(appId);
        for (const cap of DIR4_ORDER) {
          const nx = x + DIR8_DELTA[cap].gx, ny = y + DIR8_DELTA[cap].gy;
          if (isCrenellated(scene, nx, ny, z)) continue;
          // ACCÈS : une rampe ou un escalier qui atteint le chemin de ronde laisse l'entrée OUVERTE.
          if (scene.layers.some((l) => isWalkable(scene, nx, ny, l.z) && gradeBetween(surfaceH, heightAt(scene, nx, ny, l.z)) !== 'cliff')) continue;
          const e = edgeOf(x, y, nx, ny);
          if (!e) continue;
          // Une STRUCTURE (porte, herse) sous l'arête porte déjà sa couronne (corps de garde).
          if (scene.layers.some((l) => l.z < z && structureAt(scene, e.x, e.y, e.side, l.z))) continue;
          const [A, B] = wallEnds({ x: e.x, y: e.y, side: e.side });
          out.push({
            case: { x, y, z },
            arete: { x: e.x, y: e.y, side: e.side, z },
            apparence,
            ends: [{ ...A, h: surfaceH }, { ...B, h: surfaceH }],
            faces: crownFaces(apparence, A, B, surfaceH),
          });
        }
      }
  }
  return out;
}
