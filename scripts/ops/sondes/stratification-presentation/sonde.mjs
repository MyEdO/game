#!/usr/bin/env node
// SONDE de la stratification de la présentation (#2792) : range chaque fichier `.ts`/`.tsx`/`.css` de
// `src/state`, `src/ui`, `src/gameIso` (arbre de `HEAD`) dans une catégorie de `regles.mjs`, puis mesure
// par catégorie les lignes (code, tests) et le churn (`git log --numstat`) sur une fenêtre de jours
// AVANT la date de commit de `HEAD`. LECTURE SEULE sur l'arbre : tout ce qu'elle écrit va dans le
// dossier de données passé en `argv[2]`. Mode d'emploi : `README.md` du même dossier.
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RACINE } from '../audit-2026-09-01/_socle.mjs'
import { CATEGORIES, REGLES } from './regles.mjs'
import { MARQUEUR_COMMIT, cleDe, compterLignes, importsRelatifs, lireNumstat, ranger, resoudreImport, tirerEchantillon } from './stratifier.mjs'

const ZONES = ['src/state', 'src/ui', 'src/gameIso']
const EXTENSIONS = /\.(ts|tsx|css)$/
const estTest = (chemin) => chemin.includes('.test.')
const zoneDe = (chemin) => ZONES.find((z) => chemin.startsWith(`${z}/`))

const USAGE = `Usage : node scripts/ops/sondes/stratification-presentation/sonde.mjs <dossier-de-données> [--jours 90] [--echantillon <n> --graine <g>]
  <dossier-de-données> : dossier EXISTANT, HORS dépôt ; reçoit stratification.json, tableau.md, douteux.md,
                         ecarts-tests.json, echantillon.json.
  --jours <j>          : fenêtre de churn, en jours avant la date de commit de HEAD (défaut 90).
  --echantillon <n>    : n fichiers tirés dans chaque catégorie et chaque famille douteuse (avec --graine).
`

/** Les arguments de la ligne de commande, ou ARRÊT en code 2 avec le mode d'emploi. */
function lireArguments(argv) {
  const arreter = (raison) => {
    if (raison) process.stderr.write(`${raison}\n`)
    process.stderr.write(USAGE)
    process.exit(2)
  }
  const [dossier, ...reste] = argv
  if (!dossier || dossier.startsWith('--')) arreter('dossier de données manquant')
  if (!existsSync(dossier)) arreter(`dossier de données introuvable : ${dossier}`)
  const options = { dossier, jours: 90, echantillon: null, graine: null }
  for (let i = 0; i < reste.length; i += 2) {
    const [nom, valeur] = [reste[i], reste[i + 1]]
    if (valeur === undefined) arreter(`valeur manquante pour ${nom}`)
    if (nom === '--jours' || nom === '--echantillon') {
      const n = Number(valeur)
      if (!Number.isInteger(n) || n <= 0) arreter(`${nom} attend un entier positif : ${valeur}`)
      options[nom.slice(2)] = n
    } else if (nom === '--graine') options.graine = valeur
    else arreter(`option inconnue : ${nom}`)
  }
  if ((options.echantillon === null) !== (options.graine === null)) arreter('--echantillon et --graine vont ensemble')
  return options
}

const git = (args, input) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 30, input })
const lignesDe = (texte) => texte.split('\n').filter(Boolean)

/** Le contenu de chaque `chemin` à la révision `rev`, par un seul `git cat-file --batch`. */
function contenus(rev, chemins) {
  const sortie = execFileSync('git', ['cat-file', '--batch'], {
    cwd: RACINE, maxBuffer: 1 << 30, input: chemins.map((c) => `${rev}:${c}\n`).join(''),
  })
  /** @type {Map<string, string>} */
  const textes = new Map()
  let pos = 0
  for (const chemin of chemins) {
    const finTete = sortie.indexOf(10, pos)
    const tete = sortie.subarray(pos, finTete).toString('utf8').split(' ')
    if (tete[1] !== 'blob') throw new Error(`git cat-file ne rend pas de blob pour ${rev}:${chemin} (${tete.join(' ')})`)
    const taille = Number(tete[2])
    textes.set(chemin, sortie.subarray(finTete + 1, finTete + 1 + taille).toString('utf8'))
    pos = finTete + 1 + taille + 1
  }
  return textes
}

const nouvelleMesure = () => ({ fichiers: 0, lignesCode: 0, lignesTests: 0, commits: new Set(), ajouts: 0, suppressions: 0 })
const sortieMesure = (m) => ({
  fichiers: m.fichiers, lignesCode: m.lignesCode, lignesTests: m.lignesTests,
  commits: m.commits.size, ajouts: m.ajouts, suppressions: m.suppressions, lignesModifiees: m.ajouts + m.suppressions,
})
const pourcent = (part, tout) => (tout ? `${((100 * part) / tout).toFixed(1)} %` : '0,0 %').replace('.', ',')

function principal() {
  const options = lireArguments(process.argv.slice(2))
  const sha = git(['rev-parse', 'HEAD']).trim()
  const dateCommit = git(['show', '-s', '--format=%cI', sha]).trim()
  const borneMs = Date.parse(dateCommit) - options.jours * 86_400_000
  const borne = new Date(borneMs).toISOString()

  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    const plusVieux = Math.min(...lignesDe(git(['log', '--format=%ct', sha])).map(Number)) * 1000
    if (plusVieux >= borneMs) {
      process.stderr.write(
        `Histoire superficielle : le plus vieux commit accessible (${new Date(plusVieux).toISOString()}) n'est pas antérieur à la borne du churn (${borne}) ; le churn serait sous-compté.\n` +
        `Approfondir : git fetch --shallow-since=${borne.slice(0, 10)} origin main\n`,
      )
      process.exit(1)
    }
  }

  const fichiers = lignesDe(git(['ls-tree', '-r', '--name-only', sha, '--', ...ZONES])).filter((c) => EXTENSIONS.test(c))
  /** @type {Map<string, ReturnType<typeof ranger>>} */
  const rangs = new Map()
  const rangDe = (chemin) => {
    if (!rangs.has(chemin)) rangs.set(chemin, ranger(chemin, REGLES))
    return rangs.get(chemin)
  }
  const nonRanges = fichiers.filter((c) => rangDe(c) === null)
  if (nonRanges.length) {
    process.stderr.write(`${nonRanges.length} fichier(s) de HEAD non rangé(s) par regles.mjs :\n${nonRanges.map((c) => `  ${c}\n`).join('')}`)
    process.exit(1)
  }

  const textes = contenus(sha, fichiers)
  const presents = new Set(fichiers)
  const toutSrc = new Set(lignesDe(git(['ls-tree', '-r', '--name-only', sha, '--', 'src'])))

  /** @type {Map<string, ReturnType<typeof nouvelleMesure>>} */
  const parCle = new Map()
  const mesureDe = (cle) => {
    if (!parCle.has(cle)) parCle.set(cle, nouvelleMesure())
    return parCle.get(cle)
  }
  const parZone = new Map(ZONES.map((z) => [z, new Map()]))
  const mesureZone = (zone, cle) => {
    const m = parZone.get(zone)
    if (!m.has(cle)) m.set(cle, nouvelleMesure())
    return m.get(cle)
  }
  const total = nouvelleMesure()
  /** @type {Record<string, { categorie: string, famille?: string, indice: number, test: boolean, lignes: number, commits: number, ajouts: number, suppressions: number }>} */
  const parFichier = {}
  for (const chemin of fichiers) {
    const rang = rangDe(chemin)
    const lignes = compterLignes(textes.get(chemin))
    const test = estTest(chemin)
    parFichier[chemin] = { ...rang, test, lignes, commits: 0, ajouts: 0, suppressions: 0 }
    for (const m of [mesureDe(cleDe(rang)), mesureZone(zoneDe(chemin), cleDe(rang)), total]) {
      m.fichiers++
      if (test) m.lignesTests += lignes
      else m.lignesCode += lignes
    }
  }

  const argsLog = ['log', sha, '--no-merges', `--since=${borne}`, '-M', '--numstat', `--format=${MARQUEUR_COMMIT}%H`, '--', ...ZONES]
  const journal = lireNumstat(git(argsLog))
  const historiques = new Set()
  const horsRegles = new Set()
  let binaires = 0
  for (const commit of journal) {
    binaires += commit.binaires.filter((c) => EXTENSIONS.test(c)).length
    for (const { chemin, ajouts, suppressions } of commit.fichiers) {
      if (!EXTENSIONS.test(chemin) || !zoneDe(chemin)) continue
      const rang = rangDe(chemin)
      if (rang === null) { horsRegles.add(chemin); continue }
      if (!presents.has(chemin)) historiques.add(chemin)
      else {
        const f = parFichier[chemin]
        f.commits++
        f.ajouts += ajouts
        f.suppressions += suppressions
      }
      for (const m of [mesureDe(cleDe(rang)), mesureZone(zoneDe(chemin), cleDe(rang)), total]) {
        m.commits.add(commit.sha)
        m.ajouts += ajouts
        m.suppressions += suppressions
      }
    }
  }
  if (horsRegles.size) {
    process.stderr.write(`${horsRegles.size} chemin(s) du journal non rangé(s) par regles.mjs :\n${[...horsRegles].sort().map((c) => `  ${c}\n`).join('')}`)
    process.exit(1)
  }

  const testsMesures = fichiers.filter(estTest).map((test) => {
    const importes = importsRelatifs(textes.get(test))
      .map((s) => resoudreImport(test, s, (c) => toutSrc.has(c)))
      .filter((c) => c !== null && zoneDe(c) && rangDe(c) !== null)
    return { test, cle: cleDe(rangDe(test)), categoriesImportees: [...new Set(importes.map((c) => cleDe(rangDe(c))))].sort() }
  })
  const ecarts = testsMesures.filter((t) => t.categoriesImportees.length && !t.categoriesImportees.includes(t.cle))
  /** @type {Record<string, number>} */
  const ecartsParCle = {}
  for (const e of ecarts) ecartsParCle[e.cle] = (ecartsParCle[e.cle] ?? 0) + 1

  const famillesDouteuses = [...new Set(REGLES.filter((r) => r.categorie === 'douteux').map((r) => r.famille))]
  const clesDouteuses = famillesDouteuses.map((f) => `douteux:${f}`)
  const douteux = nouvelleMesure()
  for (const cle of clesDouteuses) {
    const m = mesureDe(cle)
    douteux.fichiers += m.fichiers
    douteux.lignesCode += m.lignesCode
    douteux.lignesTests += m.lignesTests
    for (const s of m.commits) douteux.commits.add(s)
    douteux.ajouts += m.ajouts
    douteux.suppressions += m.suppressions
  }

  const commande = `node scripts/ops/sondes/stratification-presentation/sonde.mjs <dossier-de-données> --jours ${options.jours}` +
    (options.echantillon ? ` --echantillon ${options.echantillon} --graine ${options.graine}` : '')
  const ligneTableau = (libelle, remplace, m) => {
    const s = sortieMesure(m)
    return `| ${libelle} | ${remplace} | ${s.fichiers} | ${s.lignesCode} | ${s.lignesTests} | ${s.commits} | ${s.lignesModifiees} | ${pourcent(s.lignesCode, total.lignesCode)} |`
  }
  const tableau = [
    `Stratification de src/state, src/ui, src/gameIso à \`${sha}\` (commit du ${dateCommit}).`,
    `Churn : commits sans fusion depuis le ${borne} (${options.jours} j avant le commit), \`git ${argsLog.join(' ')}\`.`,
    `Commande : \`${commande}\`. Part = part des lignes de code (hors tests) des trois zones.`,
    '',
    `| Catégorie | Un moteur tiers la remplace ? | Fichiers | Lignes code | Lignes tests | Commits ${options.jours} j | Lignes modifiées ${options.jours} j | Part |`,
    '|---|---|---|---|---|---|---|---|',
    ...CATEGORIES.map((c) => ligneTableau(c.libelle, c.remplace, mesureDe(c.id))),
    ligneTableau('Douteux (toutes familles, `douteux.md`)', '—', douteux),
    ligneTableau('Total', '—', total),
    '',
    `Chemins du journal absents de HEAD (renommés, supprimés), rangés par les mêmes règles : ${historiques.size}. Lignes binaires ignorées : ${binaires}.`,
    '',
  ].join('\n')

  const listeDouteux = fichiers.filter((c) => rangDe(c).categorie === 'douteux')
  const douteuxMd = [
    `Fichiers à rangement douteux à \`${sha}\`, mesurés à part par famille (règles \`categorie: 'douteux'\` de \`regles.mjs\`).`,
    '',
    `| Famille | Fichiers | Lignes code | Lignes tests | Commits ${options.jours} j | Lignes modifiées ${options.jours} j |`,
    '|---|---|---|---|---|---|',
    ...famillesDouteuses.map((f) => {
      const s = sortieMesure(mesureDe(`douteux:${f}`))
      return `| ${f} | ${s.fichiers} | ${s.lignesCode} | ${s.lignesTests} | ${s.commits} | ${s.lignesModifiees} |`
    }),
    '',
    '| Fichier | Famille | Raison |',
    '|---|---|---|',
    ...listeDouteux.map((c) => {
      const r = rangDe(c)
      return `| \`${c}\` | ${r.famille} | ${REGLES[r.indice].raison} |`
    }),
    '',
  ].join('\n')

  const recoupement = ZONES.map((z) => {
    let code = 0
    let tests = 0
    for (const m of parZone.get(z).values()) { code += m.lignesCode; tests += m.lignesTests }
    return { zone: z, lignesCode: code, lignesTests: tests }
  })

  /** @type {Record<string, { chemin: string, indice: number, raison: string }[]> | null} */
  let echantillon = null
  if (options.echantillon) {
    echantillon = {}
    for (const cle of [...CATEGORIES.map((c) => c.id), ...clesDouteuses]) {
      const membres = fichiers.filter((c) => cleDe(rangDe(c)) === cle)
      echantillon[cle] = tirerEchantillon(membres, options.echantillon, options.graine).map((chemin) => {
        const { indice } = rangDe(chemin)
        return { chemin, indice, raison: REGLES[indice].raison }
      })
    }
  }

  const objet = (m) => Object.fromEntries([...m].map(([k, v]) => [k, sortieMesure(v)]))
  const stratification = {
    sha, dateCommit, jours: options.jours, borne, commande, commandeChurn: `git ${argsLog.join(' ')}`,
    categories: CATEGORIES, regles: REGLES.map((r) => ({ ...r, motif: r.motif.source })),
    totaux: sortieMesure(total), parCategorie: objet(parCle), douteux: sortieMesure(douteux),
    parZone: Object.fromEntries([...parZone].map(([z, m]) => [z, objet(m)])), recoupement,
    cheminsHistoriques: [...historiques].sort(), lignesBinaires: binaires,
    ecartsTests: { total: ecarts.length, parCategorie: ecartsParCle }, parFichier,
  }
  const d = options.dossier
  writeFileSync(join(d, 'stratification.json'), `${JSON.stringify(stratification, null, 2)}\n`)
  writeFileSync(join(d, 'tableau.md'), tableau)
  writeFileSync(join(d, 'douteux.md'), douteuxMd)
  writeFileSync(join(d, 'ecarts-tests.json'), `${JSON.stringify({ sha, total: ecarts.length, parCategorie: ecartsParCle, ecarts }, null, 2)}\n`)
  if (echantillon) writeFileSync(join(d, 'echantillon.json'), `${JSON.stringify({ sha, n: options.echantillon, graine: options.graine, echantillon }, null, 2)}\n`)

  process.stdout.write(tableau)
  process.stdout.write('\nRecoupement par zone (wc -l, HEAD) :\n')
  for (const r of recoupement) process.stdout.write(`${r.zone} ${r.lignesCode} ${r.lignesTests}\n`)
  process.stdout.write(`\nTests dont la catégorie n'est pas parmi celles qu'ils importent : ${ecarts.length} sur ${testsMesures.length}\n`)
  for (const [cle, n] of Object.entries(ecartsParCle).sort()) process.stdout.write(`  ${cle} ${n}\n`)
}

principal()
