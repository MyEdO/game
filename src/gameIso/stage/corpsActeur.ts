/**
 * CORPS d'acteur dans une scène three DESSINÉE (#2198) — l'unique lecture de « combien de corps de cet
 * acteur l'image montre-t-elle ». Le banc (`banc-volumique.ts:quads`), la sonde de recette
 * (`__wfrp.corps`, par `setImageRendue`) et les tests de rétention la lisent.
 */
import type * as THREE from 'three';
import { frameRectOf, idsDeLActeur } from '../backends/webgl/sceneMeshes';

/** Un quad de billboard : maillé, porteur d'un cadre d'atlas (`frameRectOf` écarte le disque d'ombre de
 *  contact et le jumeau de silhouette), jamais la géométrie empruntée au monde cuit. */
export function estCorps(o: THREE.Object3D): o is THREE.Mesh {
  const m = o as THREE.Mesh;
  return m.isMesh === true && !m.userData.emprunte && !!frameRectOf(m.material as THREE.Material);
}

/** Visible à l'image : lui et chacun de ses ancêtres. */
function visibleALImage(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/** Les corps VISIBLES de l'acteur `id` dans `racine` — seul, ou dans un couple monté (`idsDeLActeur`). */
export function corpsDeLActeur(racine: THREE.Object3D, id: string): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  racine.traverse((o) => {
    if (estCorps(o) && visibleALImage(o) && idsDeLActeur(o.name).includes(id)) out.push(o);
  });
  return out;
}
