#!/usr/bin/env node
// LA CONSTRUCTION DU PONT DE GODOT (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md` B5, B-c) : `vite build` en
// bibliothèque, format iife, depuis l'entrée d'hôte unique (`entreeDHote`, `scripts/entree-d-hote.mjs` : le gel du
// catalogue, puis `hotes/godot/pont/entree.ts`, avec le greffon `proseSource()`). Le bundle tient seul dans une page :
// il expose `globalThis.wfrpPont` (`hotes/godot/pont/CONTRAT.md`). `--pont-seul` le bâtit sans Godot, dit sa taille,
// puis l'EXÉCUTE dans un `node:vm` qui ne porte que les API de navigateur déclarées (`API_DU_NAVIGATEUR`) : `demarrer`
// et `vue` répondent `ok: true`, un second `demarrer` `ok: false`, sinon le code de sortie est 1 ; `--sortie <dossier>`
// l'y écrit, sans quoi rien ne s'écrit. La CI le joue (`npm run pont:godot`), pour qu'un changement du moteur qui casse
// le bundle de navigateur, à sa construction comme à son évaluation, ne passe pas vert.
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createContext, runInContext } from 'node:vm'
import { build } from 'vite'
import { entreeDHote } from '../../scripts/entree-d-hote.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const PONT = 'wfrp-pont.js'
const USAGE = `Usage : node hotes/godot/construire.mjs --pont-seul [--sortie <dossier>]
  --pont-seul         le bundle ${PONT}, sans Godot, bâti puis exécuté
  --sortie <dossier>  le dossier où l'écrire (sans lui, rien ne s'écrit)`

/** Les options de la ligne de commande, ou l'erreur qui les refuse. */
function lireOptions(argv) {
  const options = { pontSeul: false, sortie: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--pont-seul') options.pontSeul = true
    else if (a === '--sortie' && argv[i + 1]) options.sortie = resolve(argv[++i])
    else return { erreur: `option inconnue ou incomplète : ${a}` }
  }
  if (!options.pontSeul) return { erreur: '--pont-seul attendu' }
  return { options }
}

/** Le bundle du pont : son code, écrit dans `sortie` si elle est donnée. */
async function empaqueter(sortie) {
  const entree = entreeDHote('wfrp-pont', ["import '/hotes/godot/pont/entree.ts';"])
  const resultat = await build({
    root: RACINE,
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    mode: 'production',
    plugins: entree.greffons,
    build: {
      // `lib.entry` se résout en chemin sous la racine ; le module virtuel entre par `input`, tel quel.
      lib: { entry: entree.entree, formats: ['iife'], name: 'wfrpPont', fileName: () => PONT },
      rolldownOptions: { input: entree.entree },
      write: sortie !== null,
      ...(sortie ? { outDir: sortie } : {}),
      emptyOutDir: false,
      copyPublicDir: false,
      reportCompressedSize: false,
    },
  })
  const [sortieDeRollup] = Array.isArray(resultat) ? resultat : [resultat]
  const morceau = sortieDeRollup.output.find((o) => o.type === 'chunk' && o.fileName === PONT)
  if (!morceau) throw new Error(`[pont] ${PONT} absent de la sortie de vite build`)
  return morceau.code
}

/** Les API de navigateur que le bundle lit, et que la page de Godot porte : chacune prise au global de Node, rien de plus. */
const API_DU_NAVIGATEUR = ['structuredClone', 'console', 'performance', 'URL', 'atob', 'setTimeout', 'clearTimeout', 'queueMicrotask']

/** Le scénario que l'exécution démarre : le combat des tests du pont (`hotes/godot/pont/tour.hors-store.test.ts`). */
const SCENARIO = 'dome'

/** Exécute le bundle comme la page de Godot : évalué dans un contexte qui ne porte que `API_DU_NAVIGATEUR`, son pont
 *  appelé. Rend la liste des écarts au contrat (`hotes/godot/pont/CONTRAT.md`), vide quand il tient. */
function executer(code) {
  const page = createContext(tableTotale(API_DU_NAVIGATEUR, (nom) => globalThis[nom]))
  try {
    runInContext(code, page, { filename: PONT })
  } catch (erreur) {
    return [`l’évaluation lève : ${erreur}`]
  }
  const pont = page.wfrpPont
  if (typeof pont?.appeler !== 'function') return ['`globalThis.wfrpPont.appeler` absent']
  const appel = (methode, entree) => {
    const brut = pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree))
    return typeof brut === 'string' ? JSON.parse(brut) : { ok: null, brut }
  }
  const attendus = [
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === true && r.vue?.projection != null],
    ['vue', undefined, (r) => r.ok === true && r.vue?.projection != null],
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === false && r.erreur?.categorie === 'validation'],
    ['erreursGlobales', undefined, (r) => r.ok === true && Array.isArray(r.erreurs) && r.erreurs.length === 0],
  ]
  return attendus.flatMap(([methode, entree, tient]) => {
    const r = appel(methode, entree)
    return tient(r) ? [] : [`${methode} ${JSON.stringify(entree ?? null)} : ${JSON.stringify(r).slice(0, 400)}`]
  })
}

const octets = (n) => `${n.toLocaleString('fr-FR')} o`

async function principal() {
  const { options, erreur } = lireOptions(process.argv.slice(2))
  if (erreur) {
    console.error(`${erreur}\n${USAGE}`)
    return 2
  }
  const debut = performance.now()
  const code = await empaqueter(options.sortie)
  const brut = Buffer.byteLength(code)
  console.log(`[pont] ${PONT} : ${octets(brut)} brut, ${octets(gzipSync(code).length)} gzip, bâti en ${Math.round(performance.now() - debut)} ms${options.sortie ? `, écrit dans ${options.sortie}` : ''}`)
  const ecarts = executer(code)
  if (ecarts.length) {
    console.error(`[pont] le bundle exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) ne tient pas son contrat :\n  ${ecarts.join('\n  ')}`)
    return 1
  }
  console.log(`[pont] exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) : demarrer ${SCENARIO} et vue ok, second demarrer refusé, erreursGlobales vide`)
  return 0
}

process.exitCode = await principal()
