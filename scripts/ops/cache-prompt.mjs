// MESURE DU CACHE DE PROMPT (#2596), jouée à la main par `npm run ops:cache -- <sous-commande>`.
//   extraire --depuis <ISO> --jusqua <ISO> --sortie <dossier> [--racine <dir>]
//   rapport [--heures N | --depuis <ISO> --jusqua <ISO>] [--exclure <session>…] [--donnees <dossier>]
//           [--racine <dir>] [--json <fichier>] [--comparer <fichier.json>]   → Markdown sur la sortie standard
// Lit les transcripts Claude Code sous la racine (défaut : `racineDuCwd`), en flux. `extraire` écrit dans `--sortie` :
// `requetes.jsonl`, `evenements.jsonl`, `fils.jsonl`, `inventaire.json` (enregistrements : `cachePromptDonnee.mjs`).
// `rapport` les analyse (`cachePromptAnalyses.mjs`), en mémoire ou depuis le dossier `--donnees` d'un `extraire`, et
// rend `cachePromptRapport.mjs` ; `--json` écrit les comptes clés, `--comparer` rend leur delta contre un `--json`.
// Un fichier est lu si sa date de modification est ≥ `--depuis` ; un enregistrement est rendu si son instant
// tombe dans `[--depuis, --jusqua)`. Lecture seule des transcripts ; aucune écriture hors `--sortie` et `--json`.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { contexteDExtraction, etatDuFil, identiteDuFichier, racineDuCwd, traiterLigne } from './cachePromptDonnee.mjs'
import { analyser, comptesCles, delta } from './cachePromptAnalyses.mjs'
import { rendreDelta, rendreRapport } from './cachePromptRapport.mjs'

/** Profondeur de marche : `<session>/subagents/workflows/<wf>/agent-*.jsonl`. */
const PROFONDEUR_MAX = 4

/** Les `.jsonl` sous `racine` modifiés depuis `depuis`, `tool-results` exclus, triés. */
function fichiersDeTranscripts(racine, depuis) {
  const trouves = []
  const marcher = (d, prof) => {
    let entrees
    try { entrees = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entrees) {
      const c = path.join(d, e.name)
      if (e.isDirectory()) { if (prof < PROFONDEUR_MAX && e.name !== 'tool-results') marcher(c, prof + 1) }
      else if (e.name.endsWith('.jsonl')) {
        const st = fs.statSync(c, { throwIfNoEntry: false })
        if (st && st.mtimeMs >= depuis) trouves.push({ chemin: c, octets: st.size })
      }
    }
  }
  marcher(racine, 0)
  return trouves.sort((a, b) => a.chemin.localeCompare(b.chemin))
}

function lireMeta(chemin) {
  try { return JSON.parse(fs.readFileSync(chemin.replace(/\.jsonl$/, '.meta.json'), 'utf8')) } catch { return null }
}

function argument(argv, nom) {
  const i = argv.indexOf(nom)
  return i >= 0 ? argv[i + 1] : undefined
}

/** Toutes les valeurs qui suivent chaque occurrence de `nom`, jusqu'au drapeau suivant. */
function valeurs(argv, nom) {
  const r = []
  argv.forEach((a, i) => { if (a === nom) for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) r.push(argv[j]) })
  return r
}

function echouer(message) {
  process.stderr.write(`[cache-prompt] ${message}\n`)
  process.exit(2)
}

function fenetre(argv) {
  const heures = argument(argv, '--heures')
  const jusqua = heures ? Date.now() : Date.parse(argument(argv, '--jusqua') ?? '')
  const depuis = heures ? jusqua - Number(heures) * 3600e3 : Date.parse(argument(argv, '--depuis') ?? '')
  if (Number.isNaN(depuis) || Number.isNaN(jusqua) || jusqua <= depuis) echouer('--heures N, ou --depuis et --jusqua : deux instants ISO croissants')
  return { depuis, jusqua }
}

function racineDe(argv) {
  const racine = argument(argv, '--racine') ?? racineDuCwd(process.cwd(), os.homedir())
  if (!fs.existsSync(racine)) echouer(`racine introuvable : ${racine}`)
  return racine
}

/** Lit les transcripts de `racine` et passe chaque lot d'enregistrements à `ecrire(nom, objets)`. */
async function lireTranscripts(racine, depuis, jusqua, ecrire) {
  const ctx = contexteDExtraction(depuis, jusqua)
  const fichiers = fichiersDeTranscripts(racine, depuis)
  for (const { chemin } of fichiers) {
    const relatif = path.relative(racine, chemin).split(path.sep)
    const etat = etatDuFil(identiteDuFichier(relatif, relatif.length > 1 ? lireMeta(chemin) : null), relatif.join('/'))
    const requetes = []
    const rl = readline.createInterface({ input: fs.createReadStream(chemin), crlfDelay: Infinity })
    for await (const ligne of rl) {
      if (!ligne) continue
      const r = traiterLigne(ctx, etat, ligne)
      requetes.push(...r.requetes)
      ecrire('evenements', r.evenements)
    }
    ecrire('requetes', requetes)
    ecrire('fils', [etat.fil])
  }
  return { ctx, fichiers }
}

async function extraire(argv) {
  const { depuis, jusqua } = fenetre(argv)
  const sortie = argument(argv, '--sortie')
  if (!sortie) echouer('--sortie <dossier> manquant')
  const racine = racineDe(argv)
  const debutMs = Date.now()
  fs.mkdirSync(sortie, { recursive: true })
  const flux = tableTotale(['requetes', 'evenements', 'fils'], (n) => fs.createWriteStream(path.join(sortie, `${n}.jsonl`)))
  const { ctx, fichiers } = await lireTranscripts(racine, depuis, jusqua, (n, objets) => { if (objets.length) flux[n].write(objets.map((o) => JSON.stringify(o)).join('\n') + '\n') })
  await Promise.all(Object.values(flux).map((f) => new Promise((ok) => f.end(ok))))
  const inventaire = {
    depuis: new Date(depuis).toISOString(), jusqua: new Date(jusqua).toISOString(), racine,
    dureeMs: Date.now() - debutMs, fichiersN: fichiers.length, octets: fichiers.reduce((a, f) => a + f.octets, 0),
    ...ctx.inventaire,
    fichiers: fichiers.map((f) => ({ fichier: path.relative(racine, f.chemin).split(path.sep).join('/'), octets: f.octets })),
  }
  fs.writeFileSync(path.join(sortie, 'inventaire.json'), JSON.stringify(inventaire, null, 2) + '\n')
  process.stdout.write(`[cache-prompt] ${fichiers.length} fichier(s), ${inventaire.lignes} ligne(s), ${inventaire.requetesFenetre} requête(s) et ${inventaire.evenements} événement(s) dans la fenêtre, ${Object.keys(inventaire.inconnus).length} type(s) inconnu(s), ${inventaire.dureeMs} ms → ${sortie}\n`)
}

async function lireJsonl(chemin, garder) {
  const out = []
  const rl = readline.createInterface({ input: fs.createReadStream(chemin), crlfDelay: Infinity })
  for await (const l of rl) if (l) { const o = JSON.parse(l); if (garder(o)) out.push(o) }
  return out
}

async function rapport(argv) {
  const { depuis, jusqua } = fenetre(argv)
  const exclues = valeurs(argv, '--exclure')
  const donnees = argument(argv, '--donnees')
  const garder = (o) => !exclues.includes(o.session)
  const dansFenetre = (o) => garder(o) && (o.t === null || (o.t >= depuis && o.t < jusqua))
  const d = { requetes: [], evenements: [], fils: [] }
  let fichiers
  if (donnees) {
    for (const n of ['requetes', 'evenements']) d[n] = await lireJsonl(path.join(donnees, `${n}.jsonl`), dansFenetre)
    d.fils = await lireJsonl(path.join(donnees, 'fils.jsonl'), garder)
    fichiers = JSON.parse(fs.readFileSync(path.join(donnees, 'inventaire.json'), 'utf8')).fichiersN
  } else {
    const lus = await lireTranscripts(racineDe(argv), depuis, jusqua, (n, objets) => { for (const o of objets) if (garder(o)) d[n].push(o) })
    fichiers = lus.fichiers.length
  }
  const a = analyser(d)
  const comptes = comptesCles(a)
  let md = rendreRapport({ depuis, jusqua, exclues, fichiers }, a, comptes)
  const comparer = argument(argv, '--comparer')
  if (comparer) md += '\n' + rendreDelta(delta(JSON.parse(fs.readFileSync(comparer, 'utf8')).comptes, comptes))
  const json = argument(argv, '--json')
  if (json) fs.writeFileSync(json, JSON.stringify({ depuis: new Date(depuis).toISOString(), jusqua: new Date(jusqua).toISOString(), exclues, comptes }, null, 2) + '\n')
  process.stdout.write(md + '\n')
}

async function main() {
  const [sousCommande, ...reste] = process.argv.slice(2)
  if (sousCommande === 'extraire') return extraire(reste)
  if (sousCommande === 'rapport') return rapport(reste)
  echouer('sous-commande attendue : extraire --depuis <ISO> --jusqua <ISO> --sortie <dossier> [--racine <dir>] | rapport [--heures N | --depuis <ISO> --jusqua <ISO>] [--exclure <session>…] [--donnees <dossier>] [--racine <dir>] [--json <fichier>] [--comparer <fichier.json>]')
}

if (import.meta.main) await main()
