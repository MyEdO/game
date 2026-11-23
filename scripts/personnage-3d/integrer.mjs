#!/usr/bin/env node
// L'INTÉGRATION D'UN LOT D'ÉLÉMENTS 3D (#4338) : chaque élément nommé, après ceux du lot qu'il contourne (`ordreDuLot`),
// se construit par le constructeur de sa base (`CONSTRUCTEURS`) dans un dossier temporaire, borné à 270 s, puis chaque
// dossier de production qu'il écrit s'importe par `hotes/godot/importer.mjs --sans-publier` (`commandeDImport`) et son GLB
// entre au cache des modèles sous son empreinte (`enCacheOuTire`), où le constructeur du suivant le lit. Une ligne par id
// importé : id, empreinte, octets, triangles. Au premier échec, la fin de son journal, le dossier temporaire gardé, et le
// code 1.
// `--transfert <nom>` fabrique ensuite, sans toucher l'index ni l'arbre de travail, le commit fils de HEAD qui ajoute les
// manifestes et provenances importés du lot et, de force, ses GLB (`fabriquerTransfert`, `hotes/godot/asset/transfert.ts`),
// et imprime la commande qui le pousse en `transfert/<nom>` (`.github/workflows/transfert.yml`) sans la lancer.
//
//   npm run personnage-3d:integrer -- <base>/<élément>... [--transfert <nom>]
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chargerAssets } from '../../hotes/godot/asset/charger.mjs'
import { diagnosticArret, spawnBorne } from '../guards/lib/processusBorne.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const ENVIRONNEMENT = 'scripts/personnage-3d/environnement.mjs'
/** La borne de chaque lancement, celle d'une construction (`references/procedure.md` du skill `creer-un-personnage-3d`,
 *  section 3). */
const BORNE_MS = 270_000

/** Le constructeur de chaque base : son script, et l'argument qui lui nomme l'élément `<base>/<nom>`. Le `donnees.py` de
 *  l'élément est `<dossier du script>/<argument>/donnees.py`. */
export const CONSTRUCTEURS = {
  humanoide: { script: 'scripts/personnage-3d/element/construire.py', argument: (nom) => `humanoide/${nom}` },
  vehicule: { script: 'scripts/personnage-3d/construire.py', argument: (nom) => `vehicule/${nom}` },
  decor: { script: 'scripts/personnage-3d/construire.py', argument: (nom) => `decor/${nom}` },
  arete: { script: 'scripts/personnage-3d/construire.py', argument: (nom) => `arete/${nom}` },
  escalier: { script: 'scripts/personnage-3d/construire.py', argument: (nom) => `escalier/${nom}` },
  toit: { script: 'scripts/personnage-3d/construire.py', argument: (nom) => `toit/${nom}` },
}

/** La construction de l'élément `<base>/<nom>` : la commande qui l'écrit sous `sortie`, et son `donnees.py`, relatifs au
 *  dépôt ; `null` pour une base sans constructeur. PURE. */
export function construction(element, sortie) {
  const [base, nom, ...reste] = element.split('/')
  const constructeur = Object.hasOwn(CONSTRUCTEURS, base) ? CONSTRUCTEURS[base] : null
  if (!constructeur || !nom || reste.length) return null
  const argument = constructeur.argument(nom)
  return { commande: [ENVIRONNEMENT, constructeur.script, argument, '--sortie', sortie], donnees: `${dirname(constructeur.script)}/${argument}/donnees.py` }
}

/** Les éléments `<base>/<nom>` du lot dans l'ordre de leur construction : chacun après ceux du lot dont il lit l'id publié
 *  `<base>--<nom>` (`lus[element]`, les ids que rend `ids_lus` d'`entrees.py`), l'ordre donné gardé sinon. Lève sur un
 *  cycle. PURE. */
export function ordreDuLot(elements, lus) {
  const parId = new Map(elements.map((e) => [e.replace('/', '--'), e]))
  const ordre = []
  const enCours = new Set()
  const visiter = (e) => {
    if (ordre.includes(e)) return
    if (enCours.has(e)) throw new Error(`cycle de contournement dans le lot : ${[...enCours, e].join(' → ')}`)
    enCours.add(e)
    for (const id of lus[e]) if (parId.has(id)) visiter(parId.get(id))
    enCours.delete(e)
    ordre.push(e)
  }
  for (const e of elements) visiter(e)
  return ordre
}

/** La commande qui importe le dossier de production `dossier` sous `id`, `--remplacer` si `id` est déjà importé. PURE. */
export const commandeDImport = (dossier, id, dejaImporte) =>
  ['hotes/godot/importer.mjs', dossier, id, '--sans-publier', ...(dejaImporte ? ['--remplacer'] : [])]

/** Les triangles de chaque GLB construit, par empreinte, lus aux lignes `GLB <nom> <octets> <sha256> TRIANGLES <n>` du
 *  journal `journal` d'un constructeur. PURE. */
export const trianglesParEmpreinte = (journal) =>
  new Map([...journal.matchAll(/^GLB \S+ \d+ ([0-9a-f]{64}) TRIANGLES (\d+)/gm)].map((m) => [m[1], Number(m[2])]))

/** Lance `node <commande>` depuis la racine, borné à `limiteMs` arbre compris (`spawnBorne`), son journal écrit sous
 *  `journal` ; rend la sortie standard. Au premier échec, lève l'erreur qui nomme `geste`, la borne dépassée ou le code,
 *  et la fin du journal, le diagnostic d'arrêt en `diagnostic`. */
export async function lancer(commande, journal, geste, limiteMs = BORNE_MS) {
  const vu = await spawnBorne({ argv: commande, fichier: journal, limiteMs, cwd: RACINE, fluxDistincts: true, maxBuffer: 1 << 28 })
  if (vu.code === 0) return vu.stdout
  const diagnostic = []
  diagnosticArret(vu, (ligne) => diagnostic.push(ligne), '[integrer] ')
  throw Object.assign(new Error(`${geste} (${vu.expiree ? `au-delà de ${limiteMs} ms` : `code ${vu.code}`}) ; journal ${journal} :\n${vu.sortie.trimEnd().split('\n').slice(-20).join('\n')}`), { diagnostic })
}

if (import.meta.main) {
  let values, positionals
  try {
    ;({ values, positionals } = parseArgs({ allowPositionals: true, options: { transfert: { type: 'string' } } }))
  } catch (erreur) {
    console.error(erreur.message)
    process.exit(2)
  }
  const inconnus = positionals.filter((e) => !construction(e, '') || !existsSync(join(RACINE, construction(e, '').donnees)))
  const transfert = values.transfert === undefined ? null
    : await chargerAssets(["export { fabriquerTransfert, commandeDEnvoi, refusDuNom } from '/hotes/godot/asset/transfert.ts';"])
  const refusDuTransfert = transfert?.refusDuNom(values.transfert)
  if (!positionals.length || inconnus.length || refusDuTransfert) {
    if (inconnus.length) console.error(`éléments sans constructeur ni donnees.py : ${inconnus.join(', ')} (bases : ${Object.keys(CONSTRUCTEURS).join(', ')})`)
    if (refusDuTransfert) console.error(`--transfert : ${refusDuTransfert}`)
    console.error('usage : npm run personnage-3d:integrer -- <base>/<élément>... [--transfert <nom>]')
    process.exit(2)
  }
  const temporaire = mkdtempSync(join(tmpdir(), 'personnage-3d-integrer-'))
  const importes = []
  try {
    const parElement = new Map(positionals.map((e) => [e, construction(e, join(temporaire, e.replace('/', '--')))]))
    const lus = JSON.parse(await lancer([ENVIRONNEMENT, 'scripts/personnage-3d/entrees.py', ...positionals.map((e) => parElement.get(e).donnees)],
      join(temporaire, 'ids-lus.log'), 'lecture des ids lus'))
    const ordre = ordreDuLot(positionals, tableTotale(positionals, (_, i) => lus[i]))
    const { enCacheOuTire, DOSSIER_DES_MODELES, CACHE_DES_MODELES } = await chargerAssets(["export { CACHE_DES_MODELES } from '/hotes/godot/asset/release.ts';"])
    for (const element of ordre) {
      const { commande } = parElement.get(element)
      const sortie = commande.at(-1)
      const triangles = trianglesParEmpreinte(await lancer(commande, `${sortie}.log`, `construire ${element}`))
      for (const id of readdirSync(sortie).filter((d) => existsSync(join(sortie, d, 'manifest.json'))).sort()) {
        const dossier = join(sortie, id)
        await lancer(commandeDImport(dossier, id, existsSync(join(DOSSIER_DES_MODELES, `${id}.manifeste.json`))), `${dossier}.import.log`, `importer ${id}`)
        const { model, model_sha256: sha256 } = JSON.parse(readFileSync(join(dossier, 'manifest.json'), 'utf8'))
        const glb = join(dossier, model)
        await enCacheOuTire(join(CACHE_DES_MODELES, `${sha256}.glb`), sha256, id, async () => readFileSync(glb))
        console.log(`${id} ${sha256} ${statSync(glb).size} octets ${triangles.get(sha256) ?? '—'} triangles`)
        importes.push(relative(RACINE, join(DOSSIER_DES_MODELES, `${id}.glb`)).split('\\').join('/'))
      }
    }
  } catch (erreur) {
    console.error(`ÉCHEC ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    for (const ligne of erreur.diagnostic ?? []) console.error(ligne)
    process.exit(1)
  }
  rmSync(temporaire, { recursive: true, force: true })
  if (transfert) {
    try {
      console.log(transfert.commandeDEnvoi(transfert.fabriquerTransfert({ fichiers: importes, nom: values.transfert }), values.transfert))
    } catch (erreur) {
      console.error(`ÉCHEC transfert : ${erreur.message}`)
      process.exit(1)
    }
  }
}
