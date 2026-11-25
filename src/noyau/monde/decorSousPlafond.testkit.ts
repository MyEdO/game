/**
 * AUCUN DÉCOR VOLUMIQUE NE TRAVERSE UNE DALLE NI UN TOIT (#1343). Le corps d'un décor posé au niveau
 * `z` monte depuis le sol de sa case (`heightAt`) jusqu'au
 * `haut` de sa primitive la plus haute (`empriseLocaleM`). Son PLAFOND, case par case de son empreinte :
 * - le sol du premier niveau supérieur dont la case n'est pas `vide` — un volume à double hauteur
 *   (étage `vide` au-dessus) prend le plafond du niveau d'après ;
 * - sinon le point le plus BAS du toit au-dessus de la case : parmi les nappes qui la coiffent à ce
 *   niveau (`resolveNappes`, `massCovers`), le minimum de `fieldHeightAt` sur ses quatre coins ;
 * - sinon rien : une case à ciel ouvert n'a pas de plafond.
 */
import { findPropById } from '../../data';
import { empriseLocaleM } from '../../data/props.types';
import { heightAt, tileAt, sceneMetresPerTile, type Scene, type SceneEntity } from './scene';
import { propFootTiles } from './footprint';
import { fieldHeightAt, massCovers, resolveNappes } from './volume/toits';

function plafondM(scene: Scene, x: number, y: number, z: number): number | undefined {
  const dessus = scene.layers.map((l) => l.z).filter((zz) => zz > z).sort((a, b) => a - b);
  for (const zz of dessus) if (tileAt(scene, x, y, zz) !== 'vide') return heightAt(scene, x, y, zz);
  let toit: number | undefined;
  for (const nappe of resolveNappes(scene).values()) {
    if (!massCovers(nappe.mass, nappe.cells, x, y, z)) continue;
    const coins = [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }];
    toit = Math.min(toit ?? Infinity, ...coins.map((v) => fieldHeightAt(nappe.field, v)));
  }
  return toit;
}

/** Les décors volumiques d'une scène qui dépassent le plafond d'une case de leur empreinte. */
export function decorsQuiTraversent(scene: Scene): string[] {
  const mpt = sceneMetresPerTile(scene);
  const out: string[] = [];
  for (const e of scene.entities as SceneEntity[]) {
    const prop = e.kind === 'prop' ? findPropById(e.decor?.id) : undefined;
    if (!prop?.volume) continue;
    const z = e.z ?? 0;
    const hautM = Math.max(...prop.volume.primitives.map((p) => empriseLocaleM(p).haut));
    const sommet = heightAt(scene, e.pos.x, e.pos.y, z) + hautM;
    for (const t of propFootTiles(e.decor?.id, e.pos, e.facing, mpt)) {
      const plafond = plafondM(scene, t.x, t.y, z);
      if (plafond !== undefined && sommet > plafond + 1e-6) {
        out.push(`${scene.id} ${e.id} (${e.decor?.id}) z${z} : sommet ${sommet.toFixed(2)} m > plafond ${plafond.toFixed(2)} m en (${t.x},${t.y})`);
        break;
      }
    }
  }
  return out;
}
