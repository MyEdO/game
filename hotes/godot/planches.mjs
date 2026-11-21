// LES PLANCHES ET LEURS ÉTALONS (#3935). Une planche est un état de partie figé par le pont (`Planche`,
// `figerLesPlanches`, `recettes/ecran.ts`), que le jeu montre à l'adresse `?planche=<nom>`
// (`projet/scripts/pont_de_planche.gd`) ; son étalon est la capture de son écran que le banc compare (`etalons.mjs`).
// Une planche est un dérivé de l'export, jamais commitée : `construire.mjs --export` la fige et la dépose sous
// `<export>/planches/<nom>.json`, les réponses que partagent les planches de son scénario sous
// `<export>/planches/communes/<scenario>.json` (`deposerLesPlanches`). Sous `etalons/` sont commités `<nom>.png`,
// l'étalon de la planche, et `valides.json`, par nom de planche la date et l'empreinte SHA-256 de l'étalon que l'utilisateur a validé. Un étalon ne vaut que pour le
// Chromium épinglé (`EPINGLE`) sous Linux x86-64 (`refusDuNavigateur`) : le canari le compare
// (mesure `godot-etalons` de `.github/workflows/canari.yml`), qui installe ce Chromium à la version de Playwright lue ici.
// La maquette validée d'une planche, `cibles/maquettes/<nom>.png`, se déclare dans `cibles/maquettes.json` (`MAQUETTES`) ; `coteACote`
// la pose au-dessus de la capture de la planche.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'
import { decodePng } from '../../scripts/qc/lib/pngDecode.mjs'

export const DOSSIER_DES_ETALONS = fileURLToPath(new URL('./etalons', import.meta.url))
export const VALIDES = join(DOSSIER_DES_ETALONS, 'valides.json')
/** Les maquettes des planches : par nom de planche, `chemin` du PNG depuis `cibles/`, `sha256`, `facteur` (sa taille sur celle de la
 *  capture) et `date` de sa validation. */
/** La vue de base du projet (`display/window/size/viewport_*` de `projet/project.godot`), `{ largeur, hauteur }` : à
 *  cette fenêtre, l'échelle de l'interface vaut 1, et ce que l'écran publie est en pixels de la fenêtre. */
export const VUE_DE_BASE = (() => {
  const projet = readFileSync(new URL('./projet/project.godot', import.meta.url), 'utf8')
  const lue = (cle) => Number(new RegExp(`^window/size/viewport_${cle}=(\\d+)$`, 'm').exec(projet)[1])
  return Object.freeze({ largeur: lue('width'), hauteur: lue('height') })
})()
export const MAQUETTES = fileURLToPath(new URL('./cibles/maquettes.json', import.meta.url))
/** Le build du navigateur des étalons : la version de Playwright qui l'installe (`devDependencies` de `package.json`),
 *  et celle de Chrome for Testing qu'il installe. Monter l'épingle, c'est reposer tous les étalons dans le même commit. */
export const EPINGLE = Object.freeze({
  playwright: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).devDependencies.playwright,
  chrome: '153.0.8010.12',
})
/** La plateforme où l'épingle a été mesurée (`process.platform`, `process.arch`). */
const PLATEFORME = Object.freeze({ plateforme: 'linux', architecture: 'x64' })

/** Les planches `planches` (`figerLesPlanches`) écrites sous `planches/` de `sortie`, celles d'avant retirées, et les
 *  réponses communes de chaque scénario sous `planches/communes/` ; deux planches d'un scénario aux réponses communes
 *  différentes : refusé. */
export function deposerLesPlanches(sortie, planches) {
  const dossier = join(sortie, 'planches')
  rmSync(dossier, { recursive: true, force: true })
  mkdirSync(join(dossier, 'communes'), { recursive: true })
  const parScenario = new Map()
  for (const { communes, ...planche } of planches) {
    const { scenario } = planche.parametres
    const json = JSON.stringify(communes)
    if (parScenario.has(scenario) && parScenario.get(scenario) !== json) throw new Error(`${planche.nom} : les réponses communes de ${scenario} ne sont pas celles de ses autres planches`)
    parScenario.set(scenario, json)
    writeFileSync(join(dossier, `${planche.nom}.json`), `${JSON.stringify(planche)}\n`)
  }
  for (const [scenario, json] of parScenario) writeFileSync(join(dossier, 'communes', `${scenario}.json`), `${json}\n`)
}

/** Le refus du banc pour le navigateur `navigateur` (le `product` de `Browser.getVersion`, `<nom>/<version>`) lancé
 *  sur `plateforme` et `architecture` (`process.platform`, `process.arch`) : ce qu'il a lu, ce qu'il attend et la
 *  commande qui installe le build épinglé ; `null` pour le seul `Chrome/<EPINGLE.chrome>` sous Linux x86-64. PURE. */
export function refusDuNavigateur(navigateur, { plateforme, architecture }) {
  const surLaPlateforme = plateforme === PLATEFORME.plateforme && architecture === PLATEFORME.architecture
  if (surLaPlateforme && navigateur === `Chrome/${EPINGLE.chrome}`) return null
  return `navigateur ${navigateur} sous ${plateforme}-${architecture}, le banc attend Chrome ${EPINGLE.chrome} sous ` +
    `${PLATEFORME.plateforme}-${PLATEFORME.architecture} ; sur une telle machine : ` +
    `PLAYWRIGHT_BROWSERS_PATH=<dossier> npx -y playwright@${EPINGLE.playwright} install chromium, puis le banc avec ce même PLAYWRIGHT_BROWSERS_PATH`
}

/** Les étalons de `fichiers` (le contenu du dossier des étalons) qu'aucune planche de `noms` ne porte. PURE. */
export const etalonsSansPlanche = (fichiers, noms) => fichiers.filter((f) => f.endsWith('.png') && !noms.includes(f.slice(0, -'.png'.length)))

/** Le PNG RGBA 8 bits de l'image `image` (`data` : ses pixels RGBA, rangée après rangée). */
export function encoderPng({ w, h, data }) {
  const rangees = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) rangees.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1)
  const bloc = (type, donnees) => {
    const tete = Buffer.alloc(8)
    tete.writeUInt32BE(donnees.length)
    tete.write(type, 4)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), donnees])))
    return Buffer.concat([tete, donnees, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(rangees)), bloc('IEND', Buffer.alloc(0))])
}

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
