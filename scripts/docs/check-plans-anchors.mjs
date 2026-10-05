// Garde « plans DATÉS ancrés » — un plan de `docs/plans/` ne doit jamais flotter, et personne ne
// doit citer un plan disparu. Trois SENS vérifiés, exit 1 avec la liste fichier:ligne, vert silencieux.
//
// QUESTION A→B→C — A : « ce plan daté est-il encore rattaché à un travail vivant, ou est-ce un
// fossile que la politique `docs/` du CLAUDE.md aurait dû supprimer ? » → B : la réponse ne peut PAS
// se lire dans la prose (mesuré : un scan de `#N` en prose rend 5/8 faux négatifs — la moitié des
// plans ne nomment leur ticket nulle part — et prend `#443626` (couleur CSS) pour une issue). → C :
// chaque plan porte donc une ANCRE DÉDIÉE dans ses 30 premières lignes, hors bloc de code :
//   `Ticket: #N` (une ou plusieurs issues, séparées par des virgules) — le plan meurt avec l'issue ;
//   `Instrument: <chemin>` — le plan est l'ENTRÉE d'un outil rejouable, donc il ne se supprime pas ;
//     validé STRUCTURELLEMENT : le chemin cité existe ET ce fichier cite le plan en retour
//     (back-référence bidirectionnelle) — un `Instrument:` déclaratif ne prouverait rien.
// SENS 2 : tout chemin `docs/plans/…` cité par un fichier SUIVI doit exister — un plan supprimé
// laisse derrière lui des commentaires et des docs qui pointent dans le vide.
// SENS 3 : personne ne cite un plan supprimé par son NOM NU (le basename seul, sans son dossier).
//   Le SENS 2 ne le voit pas, et le lecteur, lui, croit à un artefact consultable : c'est le mode de
//   survie MESURÉ des artefacts purgés — au lendemain de la purge #1592, 60 sites du dépôt nommaient
//   ainsi un plan mort, dont 31 hors corpus historique.
//   Le registre des noms morts est CALCULÉ à chaque run depuis l'historique
//   (`git log --diff-filter=D` sur le dossier des plans, 89 ms mesurés) : rien à tenir à la main, et
//   il DÉCROÎT tout seul — un nom repris par un fichier vivant en sort.
//
// PÉRIMÈTRE MESURÉ — l'énumération passe EXCLUSIVEMENT par `git ls-files` (fichiers SUIVIS) :
//   SENS 1 : `docs/plans/**` en `.md`, `.html` (`.dc.html` compris).
//   SENS 2 : tout fichier suivi d'extension `.md .mjs .mts .ts .tsx .js .json .yml .yaml .css .html`.
//   SENS 3 : les mêmes fichiers que le SENS 2, moins les CORPUS HISTORIQUES (`CORPUS_HISTORIQUES`).
// La citation se cherche dans le texte JOINT (lignes recollées, préfixes de commentaire retirés) :
// une réf coupée en fin de ligne (l'en-tête de src/engine/testOutcome.ts) est un chemin comme un autre. Le
// jeton tolère les ESPACES (`docs/plans/Spec HUD Combat.dc.html`) et se valide par PRÉFIXES coupés
// aux extensions connues — le recollage peut agglutiner la ligne suivante, jamais raccourcir un vrai chemin.
//
// ANGLES MORTS —
//   - une marche récursive du disque est PROSCRITE ici : les worktrees d'agents (`.claude/worktrees/agent-*`,
//     `.wt-*`) portent des copies complètes de `docs/plans/` avec des plans déjà purgés ailleurs ; les
//     énumérer ferait juger l'arbre d'une autre session. `git ls-files` est la seule vue du dépôt.
//   - Un plan NON SUIVI (jamais `git add`) échappe aux deux sens : il n'existe pas pour le dépôt.
//   - L'ancre est vérifiée dans sa FORME, pas dans sa VÉRITÉ : que l'issue `#N` soit encore OUVERTE
//     n'est pas mesurable hors ligne — c'est l'étape ONLINE de `.github/workflows/canari.yml` qui la
//     mesure (une issue fermée = plan exécuté, à supprimer).
//   - Le back-lien d'un `Instrument:` est mesuré par SIMPLE PRÉSENCE du chemin du plan dans le
//     fichier instrument ; il ne juge pas que l'outil le LIT vraiment.
//   - Les fichiers binaires et les extensions hors liste (`.txt`, `.svg`, `.sh`…) ne sont pas scannés.
//   - Le SENS 3 porte la doctrine du corps historique dans `CORPUS_HISTORIQUES` : un rapport DATÉ
//     ADRESSE ses constats par le document audité (`### <doc>:<ligne>`) — requalifier ces adresses
//     falsifierait le rapport, qui décrit l'arbre à SA date, pas l'arbre d'aujourd'hui.
//   - Le SENS 3 ne juge que des noms de FICHIERS de `docs/plans/` : un basename trop commun
//     (`BASENAMES_GENERIQUES`) désignerait n'importe quoi et n'est pas mesurable.
//   - AUTO-RÉFÉRENCE : les deux fichiers de la garde elle-même (`FICHIERS_DE_LA_GARDE`) sont hors
//     des SENS 2 et 3 — les fixtures du test citent des plans fictifs par construction ; le script
//     cite la fixture d'un autre garde. Exemption AU SITE, bornée à ces DEUX chemins (même patron
//     que `.claude/soldes/`) ; sans elle, la garde rougit dès qu'elle est suivie.
//   - Ne sont PAS des citations vivantes, donc non mesurées : la mention du DOSSIER `docs/plans/`
//     seul, un chemin MÉTAVARIABLE (`docs/plans/AAAA-MM-JJ-…`), et un chemin cité dans une commande
//     de RÉCUPÉRATION d'historique (`git log --diff-filter=D -- <plan supprimé>`), qui vise
//     précisément un fichier absent. Les fixtures de test sont exemptées AU SITE (`SITES_EXEMPTS`).
//
// INVARIANT — 100 % des plans SUIVIS portent leur ancre, et AUCUN fichier suivi ne cite un plan
// supprimé (par son chemin comme par son nom nu). Toute violation est une régression. Le compte du
// jour ne se fige PAS ici (une baseline chiffrée périme au commit suivant : celle du 2026-08-30
// disait « 8 plans » là où l'arbre en portait 11) — `node scripts/docs/check-plans-anchors.mjs
// --stats` l'imprime, mesuré à l'instant du run.
// Re-run : node scripts/docs/check-plans-anchors.mjs (chaîné par `npm run docs:check`) ; en ligne :
// `--online <issues-ouvertes.json>` (canari, cf. .github/workflows/canari.yml). Comportement couvert
// par scripts/docs/check-plans-anchors.test.mjs (`npm run test:docs`).
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').map((s) => s.trim()).filter(Boolean)

const PLAN_EXTS = ['.md', '.html']
const SCAN_EXTS = ['.md', '.mjs', '.mts', '.ts', '.tsx', '.js', '.json', '.yml', '.yaml', '.css', '.html']
const REF_EXTS = ['.md', '.html', '.htm', '.json', '.mjs', '.mts', '.ts', '.tsx', '.js', '.css', '.svg', '.png', '.txt']

const read = (rel) => { try { return readFileSync(`${ROOT}/${rel}`, 'utf8') } catch { return null } }
const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }

/** Existe sur le disque ? (fichier, dossier, ou glob `*` dont le dossier parent matche.) */
function pathExists(tok) {
  const abs = `${ROOT}/${tok}`
  if (tok.includes('*')) {
    const slash = abs.lastIndexOf('/')
    const dir = abs.slice(0, slash) || '.'
    if (!isDir(dir)) return false
    const rx = new RegExp('^' + abs.slice(slash + 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$')
    return listerDossier(dir, { absent: 'vide' }).some((n) => rx.test(n))
  }
  return existsSync(abs)
}

// `--online <fichier.json>` : liste des issues OUVERTES (sortie de `gh issue list --json number`,
// UN seul appel API) — alors chaque `Ticket: #N` doit pointer une issue encore ouverte. Hors ligne
// (mode par défaut), cette vérification est un angle mort assumé : elle vit dans le canari.
const onlineArg = process.argv.indexOf('--online')
const OPEN_ISSUES = onlineArg === -1 ? null
  : new Set(JSON.parse(readFileSync(process.argv[onlineArg + 1], 'utf8')).map((i) => Number(i.number)))

/** Un basename trop commun désignerait n'importe quoi (un `README.md` supprimé sous les plans ferait
 *  rougir tous les README du dépôt) : mesuré 1 faux positif de cette classe. */
const BASENAMES_GENERIQUES = new Set(['README.md', 'readme.md', 'index.md', 'notes.md', 'plan.md'])
/** CORPUS HISTORIQUES — un corps DATÉ a le droit de nommer ce qui vivait à sa date : les soldes de
 *  tickets, qui décrivent l'arbre à LEUR date. */
const CORPUS_HISTORIQUES = ['.claude/soldes/']

/** Basenames des plans SUPPRIMÉS, lus dans l'historique du dossier des plans. Un nom repris par un
 *  fichier SUIVI en sort (il redevient citable), d'où un registre décroissant sans entretien. */
function basenamesMorts() {
  const base = (p) => p.slice(p.lastIndexOf('/') + 1)
  let sortie
  try {
    sortie = execFileSync('git', ['log', '--diff-filter=D', '--name-only', '--format=', '--', 'docs/plans/'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return new Set() }
  const vivants = new Set(tracked.map(base))
  return new Set(
    sortie.split('\n').map((s) => s.trim()).filter((s) => s.startsWith('docs/plans/')).map(base)
      .filter((b) => b && !vivants.has(b) && !BASENAMES_GENERIQUES.has(b)),
  )
}

const MORTS = basenamesMorts()
// `--registre` : le registre SEUL, un nom par ligne, sans payer les deux scans (0,45 s contre 4,8 s
// pour le run complet, mesurés) — le pre-commit s'en sert pour décider s'il ARME la garde.
if (process.argv.includes('--registre')) {
  for (const nom of [...MORTS].sort()) console.log(nom)
  process.exit(0)
}

const STATS = process.argv.includes('--stats')
const problems = [] // { file, line, kind, detail }
const ancrages = { Ticket: 0, Instrument: 0 }

// ───────────────────────── SENS 1 — plan → ancre ─────────────────────────
const plans = tracked.filter((f) => f.startsWith('docs/plans/') && PLAN_EXTS.some((x) => f.endsWith(x)))

/** Ligne d'ancre dédiée : `Ticket: …` / `Instrument: …`, éventuellement en commentaire HTML,
 *  en citation Markdown (`>`), en puce (`-`/`*`) ou en gras (`**Ticket:** …`). */
const ANCHOR_RE = /^\s*(?:<!--\s*)?(?:[>\-*]\s*)?\**\s*(Ticket|Instrument)\s*:?\**\s*:?\s*(.+?)\s*(?:-->)?\s*$/

for (const plan of plans) {
  const text = read(plan)
  if (text === null) continue
  const head = text.split('\n').slice(0, 30)
  let inFence = false
  let anchor = null
  let anchorLine = 0
  for (let i = 0; i < head.length && !anchor; i++) {
    const raw = head[i]
    if (/^\s*```/.test(raw)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = ANCHOR_RE.exec(raw)
    if (m) { anchor = { kind: m[1], value: m[2].replace(/\*+$/, '').trim() }; anchorLine = i + 1 }
  }
  if (!anchor) {
    problems.push({ file: plan, line: 1, kind: 'plan sans ancre', detail: "ajouter `Ticket: #N` ou `Instrument: <chemin>` dans les 30 premières lignes (hors bloc de code) — ou SUPPRIMER le plan exécuté" })
    continue
  }
  ancrages[anchor.kind] += 1
  if (anchor.kind === 'Ticket') {
    const nums = anchor.value.match(/#\d+/g) ?? []
    const reste = anchor.value.replace(/#\d+/g, '').replace(/[\s,]/g, '')
    if (!nums.length || reste) {
      problems.push({ file: plan, line: anchorLine, kind: 'ancre Ticket illisible', detail: `attendu \`Ticket: #N[, #M]\`, lu « ${anchor.value} »` })
    } else if (OPEN_ISSUES) {
      const fermees = nums.filter((n) => !OPEN_ISSUES.has(Number(n.slice(1))))
      if (fermees.length === nums.length) {
        problems.push({ file: plan, line: anchorLine, kind: 'plan exécuté, à supprimer', detail: `${fermees.join(', ')} fermée(s) — la politique docs/ veut la SUPPRESSION du plan (git porte l'historique)` })
      }
    }
  } else {
    const cible = anchor.value.replace(/^[`'"]|[`'"]$/g, '')
    if (!pathExists(cible)) {
      problems.push({ file: plan, line: anchorLine, kind: 'instrument absent', detail: cible })
    } else {
      const back = read(cible)
      if (back === null || !back.includes(plan)) {
        problems.push({ file: plan, line: anchorLine, kind: 'back-référence absente', detail: `${cible} ne cite pas ${plan} en retour` })
      }
    }
  }
}

// ───────────────────────── SENS 2 — référent → plan ─────────────────────────
/** Recolle les lignes (préfixes de commentaire retirés) en gardant l'index → n° de ligne d'origine. */
function joinText(text) {
  const lines = text.split('\n')
  let joined = ''
  const lineOf = [] // lineOf[i] = n° de ligne (1-based) du caractère i de `joined`
  for (let i = 0; i < lines.length; i++) {
    const piece = i === 0 ? lines[i] : lines[i].replace(/^\s*(?:\*|\/\/|#|>|--)?\s*/, '')
    const body = i === 0 ? piece : piece
    for (let k = 0; k < body.length; k++) lineOf.push(i + 1)
    joined += body
  }
  return { joined, lineOf }
}

/** Candidats de chemin pour un jeton recollé : préfixes coupés à chaque extension connue, puis le tout. */
function candidates(tok) {
  const out = []
  for (const ext of REF_EXTS) {
    let at = -1
    while ((at = tok.indexOf(ext, at + 1)) !== -1) out.push(tok.slice(0, at + ext.length))
  }
  if (tok.endsWith('/')) out.push(tok)
  out.push(tok, tok.replace(/[/.]+$/, ''))
  return [...new Set(out)].filter(Boolean).sort((a, b) => a.length - b.length)
}

/** Le jeton tolère les espaces (noms de plans à espaces) ; il est borné par les délimiteurs de
 *  citation. `(?<![\w./-])` exige un délimiteur devant `docs/plans/` : un jeton collé par un mot, un
 *  point ou un tiret est une mention EN PROSE, pas une référence à vérifier. */
const REF_RE = /(?<![\w./-])docs\/plans\/[^\n"'`)\],;<>|]*/g
/** Métavariables (patron de nommage, élision) : un chemin non instancié ne se vérifie pas. */
const META = /[…<>{}]|AAAA|MM-JJ/
/** Une commande de RÉCUPÉRATION d'historique cite légitimement un chemin SUPPRIMÉ. */
const RECUP = /git\s+(?:log|show|diff)|diff-filter/
/** Exemptions AU SITE (fichier + jeton) — fixtures de test, jamais un fichier entier. */
const SITES_EXEMPTS = new Set([
  'scripts/hooks/solde-ticket-guard.test.mjs|docs/plans/truc.md', // fixture de la garde de solde
])
/** Les DEUX fichiers de cette garde, hors des SENS 2 et 3 : les fixtures du test citent des plans
 *  fictifs par construction ; le script cite la fixture d'un autre garde. */
const FICHIERS_DE_LA_GARDE = new Set([
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/docs/check-plans-anchors.test.mjs',
])

for (const file of tracked) {
  if (!SCAN_EXTS.some((x) => file.endsWith(x))) continue
  if (FICHIERS_DE_LA_GARDE.has(file)) continue
  const text = read(file)
  if (text === null) continue
  if (!text.includes('docs/plans/')) continue
  const { joined, lineOf } = joinText(text)
  let m
  REF_RE.lastIndex = 0
  while ((m = REF_RE.exec(joined))) {
    const tok = m[0].replace(/[\s.]+$/, '')
    const nospace = tok.split(/\s/)[0].replace(/[\s.,)]+$/, '')
    if (nospace === 'docs/plans' || nospace === 'docs/plans/') continue // mention du DOSSIER
    if (META.test(nospace)) continue
    if (RECUP.test(joined.slice(Math.max(0, m.index - 80), m.index))) continue
    const cands = [...new Set([...candidates(tok), ...candidates(nospace)])]
    if (SITES_EXEMPTS.has(`${file}|${nospace}`)) continue
    if (cands.some((c) => pathExists(c))) continue
    const dansNospace = cands.filter((c) => c.length <= nospace.length && /\.[a-z]{2,4}$/.test(c))
    const mort = dansNospace.at(-1) ?? nospace
    problems.push({ file, line: lineOf[m.index] ?? 1, kind: 'plan cité mais absent', detail: mort })
  }
}

// ───────────────────────── SENS 3 — nom NU d'un plan supprimé ─────────────────────────
for (const file of tracked) {
  if (!SCAN_EXTS.some((x) => file.endsWith(x))) continue
  if (CORPUS_HISTORIQUES.some((p) => file.startsWith(p))) continue
  if (FICHIERS_DE_LA_GARDE.has(file)) continue
  const text = read(file)
  if (text === null) continue
  const presents = [...MORTS].filter((m) => text.includes(m))
  if (!presents.length) continue
  const lignes = text.split('\n')
  for (let i = 0; i < lignes.length; i++) {
    for (const mort of presents) {
      let at = -1
      while ((at = lignes[i].indexOf(mort, at + 1)) !== -1) {
        const avant = lignes[i].slice(0, at)
        if (/[\w.-]$/.test(avant)) continue // sous-chaîne d'un nom plus long
        if (avant.endsWith('docs/plans/')) continue // chemin complet : le SENS 2 en juge
        if (RECUP.test(avant.slice(-80))) continue // commande de RÉCUPÉRATION d'historique
        problems.push({ file, line: i + 1, kind: 'plan supprimé cité par son nom', detail: `cite « ${mort} » (SUPPRIMÉ)` })
      }
    }
  }
}

if (STATS) {
  const ancres = ancrages.Ticket + ancrages.Instrument
  console.log(
    `docs:check-plans --stats — ${plans.length} plan(s) suivi(s), ${ancres} ancré(s) ` +
      `(${ancrages.Ticket} \`Ticket:\`, ${ancrages.Instrument} \`Instrument:\`) ; registre des plans ` +
      `SUPPRIMÉS : ${MORTS.size} nom(s) ; ${problems.length} violation(s).`,
  )
}

if (problems.length) {
  console.error(`docs:check-plans — ${problems.length} violation(s) :`)
  for (const p of problems) console.error(`  ${p.file}:${p.line}  [${p.kind}]  ${p.detail}`)
  console.error("Un plan exécuté se SUPPRIME (git porte l'historique) ; une citation de plan mort se RETIRE de la ligne.")
  process.exit(1)
}
