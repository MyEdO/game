#!/usr/bin/env node
// LES PORTES DES PRESETS TOUCHÉS (#4814) : avant de republier un outil commun ou un lot d'éléments 3D, chaque preset de
// personnage (`src/data/presets-de-personnage.json`) qui monte un élément changé joue sa porte (`godot:evaluer --porte`)
// sous la portée de ses éléments changés (`--portee`), contre le témoin de sa tenue publiée sur `main`, et seuls les écarts
// neufs sortent. Un élément changé est, sur la branche, un manifeste d'élément sur base du dossier des modèles dont
// l'empreinte `glb.sha256` diffère de celle de la base du diff (`baseDuDiff`, `merge-base origin/main HEAD`), ou un GLB
// local nommé par `--local <id>=<glb>` (`lireLocales`), tel que l'écrit une reconstruction (`element/construire.py
// --sortie`, `personnage-3d:tests`). Les presets touchés sont ceux dont la tenue (`porteeDuPreset`, `idsDeLaTenue`) monte un
// élément changé ; pour chacun, une porte à la fois, la porte de la tenue publiée, ses éléments changés du manifeste lus
// à leur GLB de `main` (le cache des modèles, ou leur Release), écrit le témoin (`--json`), puis la porte de la tenue de
// la branche, ses GLB locaux montés (`--local`), le lit (`--temoin`). Un preset qui monte un élément absent de `main` n'a
// pas de témoin : tous les écarts de sa portée sortent. Code 1 s'il y a un écart neuf, 2 sur une entrée refusée.
//
//   npm run personnage-3d:portes -- [--local <id>=<glb>]...
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chargerAssets } from '../../hotes/godot/asset/charger.mjs'
import { idsDeLaTenue, lireLocales, manifesteVoisin, porteeDuPreset } from '../../hotes/godot/asset/posesDesRanges.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { baseDuDiff } from '../gates/classerPush.mjs'
import { depotDe, lireEnLot } from '../guards/lib/gitPorte.mjs'
import { cheminsChanges } from './changements.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
/** Le dossier des modèles publiés, relatif au dépôt (`DOSSIER_DES_MODELES`). */
const MODELES = 'hotes/godot/projet/modeles'

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

/** Les manifestes d'élément de `chemins` (relatifs au dépôt) lus à la base `base` et à l'arbre de travail : `{ avant,
 *  apres }`, id → manifeste, `null` absent. */
function manifestesChanges(depot, base, chemins) {
  const rels = chemins.filter((c) => c.startsWith(`${MODELES}/`) && c.endsWith('.manifeste.json') && !c.slice(MODELES.length + 1).includes('/'))
  const lus = lireEnLot(depot, base, rels)
  const id = (rel) => rel.slice(MODELES.length + 1, -'.manifeste.json'.length)
  const lire = (texte) => (texte === null ? null : JSON.parse(texte))
  return {
    avant: Object.fromEntries(rels.map((rel) => [id(rel), lire(lus.get(rel) ?? null)])),
    apres: Object.fromEntries(rels.map((rel) => [id(rel), existsSync(join(RACINE, rel)) ? lire(readFileSync(join(RACINE, rel), 'utf8')) : null])),
  }
}

if (import.meta.main) {
  let locaux
  try {
    locaux = lireLocales(parseArgs({ options: { local: { type: 'string', multiple: true } } }).values.local)
  } catch (erreur) {
    console.error(erreur.message)
    console.error('usage : npm run personnage-3d:portes -- [--local <id>=<glb>]...')
    process.exit(2)
  }
  const socle = baseDuDiff({ sha: 'HEAD', cwd: RACINE })
  if (socle.base === null) {
    console.error(`base du diff introuvable : ${socle.motif}`)
    process.exit(2)
  }
  const depot = depotDe(RACINE)
  const { avant, apres } = manifestesChanges(depot, socle.base, cheminsChanges(socle.base))
  const duManifeste = elementsChanges(avant, apres)
  const publie = (id) => (existsSync(join(RACINE, MODELES, `${id}.manifeste.json`)) ? JSON.parse(readFileSync(join(RACINE, MODELES, `${id}.manifeste.json`), 'utf8')) : null)
  const changes = [...duManifeste, ...Object.entries(locaux).filter(([id]) => !duManifeste.some((c) => c.id === id)).map(([id, glb]) => ({
    id, base: JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8')).base, avant: publie(id)?.glb?.sha256 ?? null,
  }))]
  console.log(`éléments changés depuis ${socle.base.slice(0, 12)} : ${changes.map((c) => `${c.id}${c.avant === null ? ' (absent de main)' : ''}`).join(', ') || 'aucun'}`)
  if (!changes.length) process.exit(0)
  const a = await chargerAssets([
    "export { cataloguesDeComposition } from '/src/noyau/index.ts';",
    "export { fichiersDuModele } from '/hotes/godot/asset/modeles.ts';",
    "export { CACHE_DES_MODELES, tirerDeLaRelease } from '/hotes/godot/asset/release.ts';",
  ])
  const bases = [...new Set(changes.map((c) => c.base))]
  const fichiersDeBase = tableTotale(bases, (b) => ({ glb: join(MODELES, a.fichiersDuModele(b).glb), manifeste: join(MODELES, a.fichiersDuModele(b).manifeste) }))
  const tenues = []
  for (const { id: preset } of a.cataloguesDeComposition().presets) {
    const portee = await porteeDuPreset(preset)
    for (const base of bases) tenues.push({ preset, base, ids: await idsDeLaTenue({ manifeste: join(RACINE, fichiersDeBase[base].manifeste), portee, locales: locaux }) })
  }
  const touches = presetsTouches(tenues, changes)
  console.log(`presets touchés : ${touches.map((t) => `${t.preset} (${t.ids.join(', ')})`).join(' ; ') || 'aucun'}`)
  const sortie = mkdtempSync(join(tmpdir(), 'personnage-3d-portes-'))
  const temoins = {}
  for (const { id, avant: sha } of duManifeste.filter((c) => c.avant && touches.some((t) => t.ids.includes(c.id)))) {
    const enCache = join(a.CACHE_DES_MODELES, `${sha}.glb`)
    const fichier = a.fichiersDuModele(id).glb
    await a.enCacheOuTire(enCache, sha, fichier, () => a.tirerDeLaRelease({ fichier, empreinte: sha }, 'glb', fetch, console.log))
    temoins[id] = join(sortie, fichier)
    copyFileSync(enCache, temoins[id])
    writeFileSync(join(sortie, a.fichiersDuModele(id).manifeste), `${JSON.stringify(avant[id], null, 2)}\n`)
  }
  let neufs = false
  for (const touche of touches) {
    const { temoin, mesure } = portesDuPreset(touche, { base: fichiersDeBase[touche.base], changes, temoins, locaux, sortie })
    console.log(`PRESET ${touche.preset} : portée ${touche.ids.join(', ')}${temoin ? '' : ' ; sans témoin (élément absent de main)'}`)
    if (temoin) {
      const journal = join(sortie, `${touche.preset}.temoin.log`)
      const vu = spawnSync(process.execPath, temoin, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 28 })
      writeFileSync(journal, `${vu.stdout}${vu.stderr}`)
      console.log(`  témoin : code ${vu.status}, journal ${journal}`)
    }
    const vu = spawnSync(process.execPath, mesure, { cwd: RACINE, stdio: ['ignore', 'inherit', 'inherit'] })
    if (vu.status !== 0) neufs = true
  }
  if (neufs) console.log(`dossier des témoins gardé : ${sortie}`)
  else rmSync(sortie, { recursive: true, force: true })
  process.exit(neufs ? 1 : 0)
}
