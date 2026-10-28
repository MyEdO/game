#!/usr/bin/env node
// LANCEUR DE L'HÔTE TEXTE (#2898 lot D) : un serveur MCP sur stdio, `npm run -s hote-texte`, déclaré aux sessions du dépôt
// par `.mcp.json`. Le module runner de Vite charge, dans UN graphe de modules, l'entrée d'hôte (`entreeDHote`,
// `scripts/entree-d-hote.mjs` : le gel du catalogue puis l'hôte, `src/hoteTexte/serveur.ts`, avec le greffon
// `proseSource()`), et `import.meta.env.DEV` vrai. Les outils, leur description et leur schéma viennent de
// `src/hoteTexte/outils.ts` ; les scénarios et les cadences, du graphe chargé. Le lanceur prête le disque à l'hôte et
// garde stdout au protocole : toute écriture de console part sur stderr. Une partie est un fichier de `.hote-texte/`, tenu par
// un seul serveur à la fois. Doc : `npm run docs:hote-texte`.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { runnerImport } from 'vite'
import { entreeDHote } from './entree-d-hote.mjs'
import { estPidVivantDepuis } from './guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from './test/identiteMesuree.mjs'
import { DOSSIER_DES_PARTIES, INSTRUCTIONS, outils } from '../src/hoteTexte/outils.ts'
import { z } from 'zod'

for (const niveau of ['log', 'info', 'debug']) console[niveau] = console.error

const RACINE = fileURLToPath(new URL('..', import.meta.url))
// Le corpus `Source/` se lit depuis la racine du dépôt, d'où que le serveur soit lancé.
process.chdir(RACINE)
const entree = entreeDHote('hote-texte', [
  "export { creerHote } from '/src/hoteTexte/serveur.ts';",
  "export { testScenarios } from '/src/scenes/test-scenarios/index.ts';",
  "export { preferenceDef } from '/src/noyau/index.ts';",
])

const { module } = await runnerImport(entree.id, {
  root: RACINE,
  configFile: false,
  logLevel: 'silent',
  plugins: entree.greffons,
  server: { fs: { strict: false } },
})

// `HOTE_TEXTE_PARTIES` déplace le dossier des parties (le test du serveur l'envoie hors du dépôt).
const DOSSIER = process.env.HOTE_TEXTE_PARTIES ?? join(RACINE, DOSSIER_DES_PARTIES)
mkdirSync(DOSSIER, { recursive: true })
const fichier = (nom) => join(DOSSIER, `${nom}.jsonl`)
const verrou = (nom) => join(DOSSIER, `${nom}.verrou`)
/** Les parties que ce processus tient : un verrou `<nom>.verrou`, créé exclusif (`wx`), porte son pid et sa naissance. */
const tenues = new Set()
/** Prend la partie `nom` : `null`, ou qui la tient. Le verrou d'un processus mort, ou d'un pid réutilisé depuis
 *  (`estPidVivantDepuis`), se reprend. */
function prendre(nom) {
  for (let essai = 0; essai < 2; essai++) {
    try {
      writeFileSync(verrou(nom), JSON.stringify({ pid: process.pid, date: new Date().toISOString() }), { flag: 'wx' })
      tenues.add(nom)
      return null
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const lu = JSON.parse(readFileSync(verrou(nom), 'utf8'))
      if (lu.pid === process.pid) return null
      if (estPidVivantDepuis(lu.pid, Date.parse(lu.date), IDENTITE_MESUREE)) return `le processus ${lu.pid}, un autre serveur de l’hôte`
      rmSync(verrou(nom), { force: true })
    }
  }
  return 'un autre serveur de l’hôte'
}
function rendre(nom) {
  if (tenues.delete(nom)) rmSync(verrou(nom), { force: true })
}
process.on('exit', () => [...tenues].forEach(rendre))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0))

const hote = module.creerHote({
  lire: (nom) => (existsSync(fichier(nom)) ? readFileSync(fichier(nom), 'utf8') : null),
  ecrire: (nom, texte) => writeFileSync(fichier(nom), texte),
  ajouter: (nom, texte) => appendFileSync(fichier(nom), texte),
  prendre,
  rendre,
})

const serveur = new McpServer({ name: 'hote-texte', version: '1.0.0' }, { instructions: INSTRUCTIONS })
const definitions = outils({ scenarios: module.testScenarios.map((sc) => sc.id), cadences: [...module.preferenceDef('combat-cadence').options] })
for (const [nom, { description, schema }] of Object.entries(definitions)) {
  serveur.registerTool(nom, { description, inputSchema: z.strictObject(schema) }, (entrees) => {
    const { texte, erreur } = hote[nom](entrees)
    return { content: [{ type: 'text', text: texte }], isError: erreur !== null }
  })
}
serveur.server.onclose = () => {
  hote.fermer()
  process.exit(0)
}
await serveur.connect(new StdioServerTransport())
