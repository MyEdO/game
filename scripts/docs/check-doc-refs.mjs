// Garde « docs vivantes » — les références vivantes (docs/*.md, hors docs/plans/ & docs/raw/) ne
// doivent jamais mentir. Six vérifications déterministes, exit 1 avec la liste fichier:ligne sinon :
//   1. CHEMINS  — tout `src/…` / `scripts/…` cité existe sur le disque (fichier, dossier ou glob).
//   2. SYMBOLES — tout appel de fonction backtiqué (`nomCamel(` / `NomPascal(`) se retrouve dans src/.
//   3. PRIMITIVES — tout symbole de `src/data/primitives.manifest.json` est un EXPORT réel de src/.
//   4. CATALOGUE CSS — les deux sens entre `docs/charte-ui.md` et `src/ui/styles/*.css`.
//   5. SENS INVERSE — tout chemin `docs/….md` cité par src/ ou scripts/ existe sur le disque.
//   6. HOOKS — tout chemin `src/…` / `scripts/…` cité par un hook (git-hooks, hooks) existe.
// Un métavariable `<…>` qui suit un chemin le tronque au dossier (ex. `src/ui/jetProps/<hook>.tsx`
// → on valide `src/ui/jetProps/`). Re-run : node scripts/docs/check-doc-refs.mjs (npm run docs:check).
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parUnitesDeCode, listerArbre, listerDossier } from '../guards/lib/lister.mjs'

const DOCS_DIR = 'docs'
const SRC_DIR = 'src'
const EXTS_SRC = ['.ts', '.tsx', '.js', '.mjs', '.mts', '.json', '.css']

/** Fichiers de `dir` portant une des extensions, en ORDRE TOTAL (hors `node_modules`). */
function fichiersSources(dir, exts) {
  return listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => exts.some((x) => rel.endsWith(x)),
  }).map((rel) => join(dir, rel))
}

// --- index des identifiants présents dans src/ (= « grep dans src/ ») ---
const SRC_IDENTS = new Set()
for (const f of fichiersSources(SRC_DIR, EXTS_SRC)) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) SRC_IDENTS.add(m[0])
}

const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }

/** Un chemin cité existe-t-il ? (fichier, dossier, ou glob `*` dont le dossier parent existe & matche).
 *  Un glob RECURSIF (`src/**\/*.test.ts`) ne se vérifie qu'au dossier stable qui précède son premier
 *  jocker : énumérer l'arbre pour un motif de prose coûterait plus que ce qu'il prouve. */
function pathExists(tok) {
  if (tok.includes('*')) {
    const avantJocker = tok.slice(0, tok.indexOf('*'))
    const slash = avantJocker.lastIndexOf('/')
    const dir = slash < 0 ? '.' : avantJocker.slice(0, slash) || '.'
    if (!isDir(dir)) return false
    if (tok.includes('**')) return true
    const rx = new RegExp('^' + tok.slice(tok.lastIndexOf('/') + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$')
    return listerDossier(dir, { absent: 'vide' }).some((n) => rx.test(n))
  }
  return existsSync(tok)
}

/** Chemin cité dans un texte, tel que le sens 1 le résout : point final de phrase retiré, et
 *  métavariable `<…>` juste après → tronqué au dossier parent. */
function cheminCite(text, m) {
  const tok = m[0].replace(/\.+$/, '')
  if (text[m.index + m[0].length] !== '<') return tok
  return tok.includes('/') ? tok.slice(0, tok.lastIndexOf('/') + 1) : tok
}

const problems = [] // { file, line, kind, tok }
const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** Chemin de code cité dans un texte quelconque (prose d'un `.md`, commentaire ou chaîne d'un `.mjs`). */
const CHEMIN_RE = /\b(?:src|scripts)\/[A-Za-z0-9_./*-]+/g

// `listerDossier(DOCS_DIR)` est NON récursif : ne liste que les fichiers .md à plat dans docs/. Les
// sous-dossiers (docs/plans/, docs/raw/, docs/decisions/…) sont donc déjà hors périmètre par
// construction — docs/plans/ (snapshots datés) et docs/decisions/ (export d'issues GitHub, corps
// citant des chemins historiques ayant le droit d'être morts) n'ont pas besoin d'exclusion explicite.
for (const file of listerDossier(DOCS_DIR).filter((f) => f.endsWith('.md'))) {
  const rel = `${DOCS_DIR}/${file}`
  const text = readFileSync(join(DOCS_DIR, file), 'utf8')

  // 1. CHEMINS src/… ou scripts/…
  let m
  while ((m = CHEMIN_RE.exec(text))) {
    const tok = cheminCite(text, m)
    if (!pathExists(tok)) problems.push({ file: rel, line: lineAt(text, m.index), kind: 'chemin mort', tok })
  }

  // 2. SYMBOLES — appels de fonction backtiqués (`nomCamel(` / `NomPascal(`), mixte-casse only.
  const codeRe = /`([^`\n]+)`/g
  while ((m = codeRe.exec(text))) {
    const span = m[1]
    for (const c of span.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const id = c[1]
      if (!/[a-z]/.test(id) || !/[A-Z]/.test(id)) continue // exige camelCase/PascalCase (ex. `applyOps`, pas `t`/`MAX`)
      if (!SRC_IDENTS.has(id)) {
        const line = lineAt(text, m.index) + span.slice(0, c.index).split('\n').length - 1
        problems.push({ file: rel, line, kind: 'symbole absent', tok: `${id}()` })
      }
    }
  }
}

// 3. MANIFESTE DES PRIMITIVES (`src/data/primitives.manifest.json`, la SOURCE dont `docs/primitives.md`
// dérive) : chaque symbole du champ `label` doit résoudre à un EXPORT réel de src/ — cause-racine des
// fantômes historiques (ex. `inBattle` cité alors que le fichier n'exportait que `inBattleId`,
// `ParticipantRow` jamais exporté nulle part). Vérifié contre l'EXPORT global de src/ (pas juste le
// champ `fichier` de l'entrée : un `label` y nomme légitimement des symboles AUXILIAIRES qui vivent
// dans leur PROPRE fichier — `CharFrame`, `ResilienceButton`… ; une carte symbole→fichier-de-l'entrée
// stricte re-déclencherait ces faux positifs).
const MANIFESTE_PRIMITIVES = 'src/data/primitives.manifest.json'
if (existsSync(MANIFESTE_PRIMITIVES)) {
  const brut = readFileSync(MANIFESTE_PRIMITIVES, 'utf8')
  const EXPORTED_SYMS = new Set()
  for (const f of fichiersSources(SRC_DIR, ['.ts', '.tsx', '.mjs', '.mts'])) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) EXPORTED_SYMS.add(m[1])
    for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) EXPORTED_SYMS.add(m[1])
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
      for (const part of m[1].split(','))
        if (part.trim()) EXPORTED_SYMS.add((part.split(/\s+as\s+/).pop() ?? part).trim())
  }
  for (const entree of JSON.parse(brut)) {
    const label = String(entree.label ?? '')
    // La ligne du `label` dans le JSON : le rapport rend un `fichier:ligne` ouvrable.
    const idx = brut.indexOf(`"label": ${JSON.stringify(label)}`)
    const line = idx < 0 ? 1 : lineAt(brut, idx)
    for (const c of label.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      const id = c[1]
      if (!/[a-z]/.test(id) || !/[A-Z]/.test(id)) continue // camelCase/PascalCase only (cf. check 2)
      if (!EXPORTED_SYMS.has(id))
        problems.push({ file: MANIFESTE_PRIMITIVES, line, kind: 'primitive fantôme (aucun export src/)', tok: `${id}` })
    }
  }
}

// 4. Catalogue atomique CSS (docs/charte-ui.md, section « Couche atomique — catalogue »), les DEUX
// sens :
//   4a. chaque classe backtiquée `.foo` de la section doit exister comme sélecteur réel dans
//       la COUCHE PARTAGÉE — sinon la doc ment (classe fantôme). Cette couche est celle que garde le
//       cliquet (xiii) d'`src/ui/ui-ratchets.test.ts` (`SHARED_CSS_FILES`) : `src/ui/styles/*.css` ET
//       la feuille du chrome du monde `src/gameIso/anim.css`, dont le catalogue est la SEULE sortie.
//   4b. chaque classe CANONIQUE (sélecteur de PREMIER NIVEAU, ni pseudo/combinateur/parenthèse) de
//       la zone PARTAGÉE de `src/ui/styles/components.css` doit être citée dans la section — sinon
//       la doc devient incomplète en silence. Zone PARTAGÉE = tout le fichier AVANT le premier bloc
//       de domaine (repéré par le marqueur `DOMAIN_MARKER` ci-dessous, cf. le propre commentaire de
//       section du CSS) ; le fichier place systématiquement ses sections « 1 écran » en QUEUE. La
//       liste de classes est DÉRIVÉE du CSS (parsing des sélecteurs), jamais d'une liste en dur ici.
const CHARTE_MD = 'docs/charte-ui.md'
const COMPONENTS_CSS = 'src/ui/styles/components.css'
const DOMAIN_MARKER = 'ÉCRAN-HUB DE VOYAGE' // 1er bloc de CSS propre-à-un-écran dans components.css
if (existsSync(CHARTE_MD)) {
  const text = readFileSync(CHARTE_MD, 'utf8')
  const lines = text.split('\n')
  const startIdx = lines.findIndex((l) => l.trim() === '## Couche atomique — catalogue')
  if (startIdx >= 0) {
    let endIdx = lines.findIndex((l, i) => i > startIdx && /^## /.test(l))
    if (endIdx < 0) endIdx = lines.length
    const section = lines.slice(startIdx, endIdx).join('\n')

    const CSS_TEXT = [...fichiersSources('src/ui/styles', ['.css']), 'src/gameIso/anim.css']
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')

    // Faux positifs à écarter : extensions de fichier (`CLAUDE.md`…) et motifs jocker cités comme
    // ANTI-exemples exprès NON catalogués (`.voyage-*`, `.char-card*`…, cf. prose de la section).
    const FILE_EXTS = new Set(['md', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'mts', 'cjs', 'json', 'css'])
    const seen = new Set()
    const codeRe2 = /`([^`\n]+)`/g
    let mm
    while ((mm = codeRe2.exec(section))) {
      for (const c of mm[1].matchAll(/\.[A-Za-z][\w-]*/g)) {
        const cls = c[0]
        if (mm[1][c.index + cls.length] === '*') continue // motif jocker anti-exemple (`.voyage-*`)
        if (seen.has(cls) || FILE_EXTS.has(cls.slice(1))) continue
        seen.add(cls)
        const rx = new RegExp('\\' + cls + '(?![\\w-])')
        if (!rx.test(CSS_TEXT)) {
          const line = startIdx + lineAt(section, mm.index)
          problems.push({ file: CHARTE_MD, line, kind: 'classe cataloguée absente du CSS', tok: cls })
        }
      }
    }

    // 4b. sens inverse — classes canoniques de components.css (zone partagée) absentes du catalogue.
    if (existsSync(COMPONENTS_CSS)) {
      const cssFull = readFileSync(COMPONENTS_CSS, 'utf8')
      const domainAt = cssFull.indexOf(DOMAIN_MARKER)
      const sharedCss = (domainAt >= 0 ? cssFull.slice(0, domainAt) : cssFull).replace(/\/\*[\s\S]*?\*\//g, '')

      // Premier sélecteur simple d'une liste de sélecteurs (avant tout combinateur hors parenthèses)
      // — exclut les classes NESTED (`.tabs .tab-btn`, `.stat-chip > .sc-label`…) : celles-là sont
      // des sous-parties documentées EN PLUS de leur classe racine, pas des primitives autonomes.
      const firstCompound = (sel) => {
        let depth = 0
        for (let i = 0; i < sel.length; i++) {
          const c = sel[i]
          if (c === '(') depth++
          else if (c === ')') depth--
          else if (depth === 0 && /[\s>+~]/.test(c)) return sel.slice(0, i)
        }
        return sel
      }
      const canonicalClasses = new Set()
      let buf = ''
      for (const ch of sharedCss) {
        if (ch === '{') {
          const sel = buf.trim(); buf = ''
          if (sel && !sel.startsWith('@')) {
            for (const part of sel.split(',')) {
              const compound = firstCompound(part.trim()).replace(/\([^)]*\)/g, '')
              for (const c of compound.matchAll(/\.[A-Za-z][\w-]*/g)) canonicalClasses.add(c[0])
            }
          }
        } else if (ch === '}') buf = ''
        else buf += ch
      }
      for (const cls of canonicalClasses) {
        const rx = new RegExp('\\' + cls + '(?![\\w-])')
        if (!rx.test(section))
          problems.push({ file: CHARTE_MD, line: startIdx + 1, kind: 'classe canonique components.css absente du catalogue', tok: cls })
      }
    }
  }
}

// 5. SENS INVERSE — le code cite la doc. Tout chemin `docs/….md` écrit dans un commentaire ou une
// chaîne de `src/**` / `scripts/**` doit exister sur le disque : une doc supprimée laisse sinon des
// renvois pendants qu'AUCUNE garde ne voit (les sens 1-4 ne lisent que `docs/*.md` et CLAUDE.md).
// Exclusion STRUCTURELLE unique : `docs/plans/…` a sa propre garde dédiée
// (`scripts/docs/check-plans-anchors.mjs`, sens 2 & 3, avec ses exemptions de fixtures au SITE) —
// le doubler ici ne ferait que rejouer ses faux positifs.
const DOC_REF_RE = /\bdocs\/[A-Za-z0-9_./-]*\.md\b/g
// Exemptions AU SITE (fichier|jeton), jamais au fichier entier : un chemin écrit dans un dépôt
// JETABLE monté par un test n'a pas vocation à exister dans celui-ci.
const DOC_REF_SITES_EXEMPTS = new Set([
  'scripts/docs/check-plans-anchors.test.mjs|docs/note.md', // fixture du dépôt jetable de la garde des plans
])
// Ce fichier-ci est hors du sens 5 : il ÉNONCE les jetons exemptés ci-dessus (même patron que
// `FICHIERS_DE_LA_GARDE` dans check-plans-anchors.mjs), il ne les cite pas comme documentation.
const DOC_REF_SELF = 'scripts/docs/check-doc-refs.mjs'
for (const f of [...fichiersSources(SRC_DIR, EXTS_SRC), ...fichiersSources('scripts', EXTS_SRC)]) {
  const rel = f.replace(/\\/g, '/')
  if (rel === DOC_REF_SELF) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(DOC_REF_RE)) {
    const site = `${rel}|${m[0]}`
    if (m[0].startsWith('docs/plans/') || DOC_REF_SITES_EXEMPTS.has(site)) continue
    if (!existsSync(m[0]))
      problems.push({ file: rel, line: lineAt(text, m.index), kind: 'doc citée mais absente', tok: m[0] })
  }
}

// 6. LES HOOKS CITENT DU CODE — un hook nomme des fichiers de `src/`/`scripts/` en COMMENTAIRE (les
// tests-scanners qu'il joue ou exclut, la source d'une whitelist) ou en CHAÎNE ; aucune garde ne
// confrontait ces noms au disque, et un renommage les laissait mentir en silence. Même résolution
// que le sens 1 (fichier, dossier, glob, métavariable `<…>`).
// PÉRIMÈTRE dit : les hooks NON-test. Un `*.test.mjs` de hook monte des dépôts JETABLES et y cite
// des chemins qui n'ont pas vocation à exister ici (mesuré : 116 des 124 chemins morts du périmètre
// large sont des fixtures de test) — même raison que l'exclusion `docs/plans/` du sens 5.
const HOOKS_DIRS = ['scripts/git-hooks', 'scripts/hooks']
/** Nom de fichier dont le RADICAL fait un seul caractère (`src/ui/X.tsx`, `src/x.ts`, `scripts/x.mjs`) :
 *  la métavariable de prose du dépôt, jamais un fichier réel. */
const estMetavariable = (tok) => /(^|\/)[A-Za-z](\.[A-Za-z0-9]+)?$/.test(tok)
// Exemptions AU SITE (`fichier:ligne|jeton`), jamais au fichier : une occurrence de plus du même
// jeton AILLEURS dans le fichier reste jugée. Une exemption qui ne matche plus se voit — son site
// redevient rouge dès que la ligne bouge, et c'est le moment de la re-mesurer.
const HOOK_SITES_EXEMPTS = new Set([
  'scripts/git-hooks/pre-push.mjs:94|src/database', // contre-exemple de la comparaison par SEGMENT (`src/database` n’est pas `src/data`)
])
// Un hook nomme aussi ses tests-scanners par leur SEUL nom de fichier (`label-logic-guard.test.ts`,
// EXCLUDED de telle famille) : ce nom se confronte à l'index des tests de `src/`, sinon un renommage
// laisse la liste mentir. Un MOTIF (`*-guard.test.ts`, `-guard\.test\.ts` d'une regex) n'est pas un nom.
const TESTS_SRC = new Set(listerArbre(SRC_DIR, { filtre: (r) => /\.test\.tsx?$/.test(r) }).map((r) => r.split('/').pop()))
const NOM_DE_TEST_RE = /\b[A-Za-z0-9_.-]+\.test\.tsx?\b/g
for (const dir of HOOKS_DIRS) {
  for (const rel of listerArbre(dir, { filtre: (r) => r.endsWith('.mjs') && !r.endsWith('.test.mjs') })) {
    const f = `${dir}/${rel}`
    const text = readFileSync(f, 'utf8')
    let m
    while ((m = CHEMIN_RE.exec(text))) {
      const tok = cheminCite(text, m)
      const ligne = lineAt(text, m.index)
      if (estMetavariable(tok) || HOOK_SITES_EXEMPTS.has(`${f}:${ligne}|${tok}`)) continue
      if (!pathExists(tok)) problems.push({ file: f, line: ligne, kind: 'chemin cité par un hook, absent du disque', tok })
    }
    while ((m = NOM_DE_TEST_RE.exec(text))) {
      if (text.slice(Math.max(0, m.index - 2), m.index).includes('*')) continue // motif, pas un nom
      if (text[m.index - 1] === '/') continue // queue d'un CHEMIN, déjà jugé au sens 6
      if (TESTS_SRC.has(m[0])) continue
      problems.push({ file: f, line: lineAt(text, m.index), kind: 'test nommé par un hook, absent de src/', tok: m[0] })
    }
  }
}

if (problems.length) {
  console.error(`docs:check — ${problems.length} référence(s) morte(s) :`)
  for (const p of problems.sort((a, b) => parUnitesDeCode(a.file, b.file) || a.line - b.line))
    console.error(`  ${p.file}:${p.line}  [${p.kind}]  ${p.tok}`)
  process.exit(1)
}
console.log(`docs:check — OK (${listerDossier(DOCS_DIR).filter((f) => f.endsWith('.md')).length} docs vivantes, chemins & symboles vérifiés)`)
