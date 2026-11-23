// Les portes des presets touchés (#4814) : éléments changés, presets touchés et commandes de leur porte, PURS ; `portes.mjs`
// les lit au dépôt et les joue.
import { join } from 'node:path'

/** Les éléments sur base changés, triés par id : chaque manifeste d'élément (son champ `base` posé) de `apres` (id →
 *  manifeste à la branche, `null` retiré) dont l'empreinte `glb.sha256` diffère de celle de `avant` (id → manifeste à la
 *  base du diff, `null` absent), avec sa base et l'empreinte d'avant (`null` pour un élément absent de la base). Un
 *  élément retiré n'est monté par aucune tenue : il n'en est pas. PURE. */
export function elementsChanges(avant, apres) {
  return Object.keys(apres).sort().flatMap((id) => {
    const [a, b] = [avant[id] ?? null, apres[id]]
    if (!b || typeof b.base !== 'string' || a?.glb?.sha256 === b.glb?.sha256) return []
    return [{ id, base: b.base, avant: a?.glb?.sha256 ?? null }]
  })
}

/** Les presets touchés : par tenue de `tenues` (`{ preset, base, ids }`, les ids que la tenue monte), les ids changés
 *  de `changes` (`elementsChanges`, plus les locaux) qu'elle monte, chacun une fois, dans son ordre ; une tenue qui n'en
 *  monte aucun n'en est pas. PURE. */
export function presetsTouches(tenues, changes) {
  const parId = new Map(changes.map((c) => [c.id, c]))
  return tenues.flatMap(({ preset, base, ids }) => {
    const touches = [...new Set(ids.filter((id) => parId.get(id)?.base === base))]
    return touches.length ? [{ preset, base, ids: touches }] : []
  })
}

/** Les deux commandes de la porte du preset touché `touche` (`presetsTouches`), relatives au dépôt : le témoin (`null` si
 *  le preset monte un élément absent de `main`, `avant: null`) écrit sous `sortie`, chaque élément de `temoins`
 *  (id → GLB de `main`) monté à son GLB ; puis la mesure, chaque élément de `locaux` (id → GLB local) monté à son GLB,
 *  contre ce témoin. `base` : le GLB et le manifeste de la base. PURE. */
export function portesDuPreset(touche, { base, changes, temoins, locaux, sortie }) {
  const commune = ['hotes/godot/asset/evaluer.mjs', '--tenue', touche.preset, '--base', base.glb, '--manifeste', base.manifeste, '--porte', '--portee', touche.ids.join(',')]
  const montes = (glbs) => touche.ids.flatMap((id) => (glbs[id] ? ['--local', `${id}=${glbs[id]}`] : []))
  const sansTemoin = touche.ids.some((id) => changes.find((c) => c.id === id)?.avant === null)
  const temoin = join(sortie, `${touche.preset}.temoin.json`)
  return {
    temoin: sansTemoin ? null : [...commune, ...montes(temoins), '--json', temoin],
    mesure: [...commune, ...montes(locaux), ...(sansTemoin ? [] : ['--temoin', temoin])],
  }
}
