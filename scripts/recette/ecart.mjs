// LA COMPARAISON D'IMAGES DES OUTILS WEB (#4903 L6) : `ecart`, exacte par défaut, pour les étalons des planches
// (`hotes/godot/etalons.mjs`), les maquettes (`scripts/maquettes/pixels.mjs`) et la recette d'images du roguelite.
import { decodePng } from '../qc/lib/pngDecode.mjs'

/** Les pixels qui diffèrent entre les PNG `a` et `b` de plus de `seuil` sur l'un de leurs canaux, et la boîte qui les
 *  contient ; tous, d'une taille à l'autre (`b`, l'étalon ou la référence). PURE. */
export function ecart(a, b, { seuil = 0 } = {}) {
  const A = decodePng(a)
  const B = decodePng(b)
  if (A.w !== B.w || A.h !== B.h) return { pixels: A.w * A.h, boite: `étalon ${B.w}×${B.h}, rendu ${A.w}×${A.h}` }
  let pixels = 0
  let [x0, y0, x1, y1] = [A.w, A.h, -1, -1]
  for (let i = 0; i < A.data.length; i += 4) {
    if ([0, 1, 2].every((k) => Math.abs(A.data[i + k] - B.data[i + k]) <= seuil)) continue
    pixels++
    const x = (i / 4) % A.w
    const y = Math.floor(i / 4 / A.w)
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  return { pixels, boite: pixels ? `de (${x0}, ${y0}) à (${x1}, ${y1})` : '' }
}
