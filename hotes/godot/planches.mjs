// LES PLANCHES ET LEURS ÉTALONS (#3935). Une planche est un état de partie figé par le pont (`Planche`,
// `figerLesPlanches`, `recettes/ecran.ts`), que le jeu montre à l'adresse `?planche=<nom>`
// (`projet/scripts/pont_de_planche.gd`) ; son étalon est la capture de son écran que le banc compare (`etalons.mjs`).
// Une planche est un dérivé de l'export, jamais commitée : `construire.mjs --export` la fige et la dépose sous
// `<export>/planches/<nom>.json`, chaque jeu de réponses communes sous
// `<export>/planches/communes/<empreinte>.json` (`deposerLesPlanches`). Sous `etalons/` sont commités `<nom>.png`,
// l'étalon de la planche, et `valides.json`, par nom de planche la date et l'empreinte SHA-256 de l'étalon que l'utilisateur a validé. Un étalon ne vaut que pour le
// Chromium épinglé (`EPINGLE`, `refusDuNavigateur`, scripts/recette/navigateur.mjs) : le canari le compare par `ecart`
// (scripts/recette/ecart.mjs ; mesure `godot-etalons` de `.github/workflows/canari.yml`), qui installe ce Chromium.
// La maquette validée d'une planche, `cibles/maquettes/<nom>.png`, se déclare dans `cibles/maquettes.json` (`MAQUETTES`) ; `coteACote`
// la pose au-dessus de la capture de la planche.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs'
import { encoderPng } from '../../scripts/qc/lib/pngEncode.mjs'

export const DOSSIER_DES_ETALONS = fileURLToPath(new URL('./etalons', import.meta.url))
export const VALIDES = join(DOSSIER_DES_ETALONS, 'valides.json')
/** La vue de base du projet (`display/window/size/viewport_*` de `projet/project.godot`), `{ largeur, hauteur }` : à
 *  cette fenêtre, l'échelle de l'interface vaut 1, et ce que l'écran publie est en pixels de la fenêtre. */
export const VUE_DE_BASE = (() => {
  const projet = readFileSync(new URL('./projet/project.godot', import.meta.url), 'utf8')
  const lue = (cle) => Number(new RegExp(`^window/size/viewport_${cle}=(\\d+)$`, 'm').exec(projet)[1])
  return Object.freeze({ largeur: lue('width'), hauteur: lue('height') })
})()
/** Les maquettes des planches : par nom de planche, `chemin` du PNG depuis `cibles/`, `sha256`, `facteur` (sa taille sur celle de la
 *  capture) et `date` de sa validation. */
export const MAQUETTES = fileURLToPath(new URL('./cibles/maquettes.json', import.meta.url))
/** Dépose chaque planche et déduplique les réponses communes identiques par leur empreinte. */
export function deposerLesPlanches(sortie, planches) {
  const dossier = join(sortie, 'planches')
  const dossierCommun = join(dossier, 'communes')
  rmSync(dossier, { recursive: true, force: true })
  mkdirSync(dossierCommun, { recursive: true })
  const empreintes = new Set()
  for (const { communes, ...planche } of planches) {
    const json = JSON.stringify(communes)
    const empreinte = createHash('sha256').update(json).digest('hex')
    if (!empreintes.has(empreinte)) {
      writeFileSync(join(dossierCommun, `${empreinte}.json`), `${json}\n`)
      empreintes.add(empreinte)
    }
    writeFileSync(join(dossier, `${planche.nom}.json`), `${JSON.stringify({ ...planche, communes: empreinte })}\n`)
  }
}

/** Les étalons de `fichiers` (le contenu du dossier des étalons) qu'aucune planche de `noms` ne porte. PURE. */
export const etalonsSansPlanche = (fichiers, noms) => fichiers.filter((f) => f.endsWith('.png') && !noms.includes(f.slice(0, -'.png'.length)))


/**
 * Le côte à côte de la planche `nom` : sa maquette déclarée dans `maquettes` (`MAQUETTES`) ramenée à la taille de la
 * capture `capture` (PNG), au-dessus de la capture, puis les deux fondues à 50 %, en un PNG de la largeur de la capture
 * et de trois fois sa hauteur (`{ image }`). Une maquette déclarée absente du poste, d'une autre empreinte, d'un autre
 * format que PNG ou d'une taille autre que celle de la capture fois son `facteur` rend l'avis qui le dit (`{ avis }`) ;
 * une planche sans maquette, `null`.
 * @param {string} nom
 * @param {Buffer} capture
 * @param {Record<string, { chemin: string, sha256: string, facteur: number, date: string }>} maquettes
 */
export function coteACote(nom, capture, maquettes) {
  const declaree = maquettes[nom]
  if (!declaree) return null
  const { chemin, sha256, facteur } = declaree
  const avis = (raison) => ({ avis: `${nom} : maquette ${chemin} ${raison}, pas de côte à côte` })
  if (!chemin.endsWith('.png')) return avis('au format non lu (PNG seulement)')
  const fichier = resolve(dirname(MAQUETTES), chemin)
  if (!existsSync(fichier)) return avis('absente de ce poste')
  const octets = readFileSync(fichier)
  const lue = createHash('sha256').update(octets).digest('hex')
  if (lue !== sha256) return avis(`d’empreinte ${lue}, ${sha256} validée`)
  const m = decodePng(octets)
  const c = decodePng(capture)
  if (m.w !== Math.round(c.w * facteur) || m.h !== Math.round(c.h * facteur)) return avis(`de ${m.w}×${m.h}, la capture ${c.w}×${c.h} fois ${facteur} attendue`)
  const plan = c.w * c.h * 4
  const data = Buffer.alloc(plan * 3)
  c.data.copy(data, plan)
  const echantillon = (x, y, k) => {
    const sx = Math.min(Math.max((x + 0.5) * facteur - 0.5, 0), m.w - 1)
    const sy = Math.min(Math.max((y + 0.5) * facteur - 0.5, 0), m.h - 1)
    const [x0, y0] = [Math.floor(sx), Math.floor(sy)]
    const [x1, y1] = [Math.min(x0 + 1, m.w - 1), Math.min(y0 + 1, m.h - 1)]
    const [fx, fy] = [sx - x0, sy - y0]
    const p = (px, py) => m.data[(py * m.w + px) * 4 + k]
    return (p(x0, y0) * (1 - fx) + p(x1, y0) * fx) * (1 - fy) + (p(x0, y1) * (1 - fx) + p(x1, y1) * fx) * fy
  }
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const i = (y * c.w + x) * 4
      for (let k = 0; k < 3; k++) {
        const v = echantillon(x, y, k)
        data[i + k] = Math.round(v)
        data[2 * plan + i + k] = Math.round((v + c.data[i + k]) / 2)
      }
      data[i + 3] = 255
      data[2 * plan + i + 3] = 255
    }
  }
  return { image: encoderPng({ w: c.w, h: c.h * 3, data }) }
}
