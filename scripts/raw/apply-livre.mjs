// Applique les résultats du workflow d'intégration d'UN livre aux fiches de l'Atlas.
// Idempotent : un sentinel HTML `<!-- <ABRÉV>-INTEGRATION -->` marque le contenu ajouté ; relancer
// ne duplique pas.
// Usage : node scripts/raw/apply-livre.mjs <ABRÉV> <workflow-output.json>
// Le livre n'est pas nommé ici (#1825) : son sigle ENTRE en argument, son libellé se lit au
// registre `src/data/books.json`.
import { readFileSync, writeFileSync } from 'node:fs'
import { BOOKS, livreDuSigle, marqueurIntegration, readText, REGISTRE_LIVRES } from './_lib.mjs'

const USAGE = 'usage: node scripts/raw/apply-livre.mjs <ABRÉV> <workflow-output.json>'
const [, , ABBR, OUTFILE] = process.argv
if (!ABBR || !OUTFILE) { console.error(USAGE); process.exit(1) }

// Même prédicat d'extraction que le périmètre du workflow (`livreDuSigle` → `estLivreExtrait`) : un
// livre sans `dir` n'a aucun chapitre à citer, donc rien à intégrer — l'intégrer poserait des réfs
// invalidables.
const livre = livreDuSigle(ABBR)
if (!livre) {
  // Registre BRUT, hors `livreDuSigle` qui ne rend que les extraits : seule façon de distinguer
  // « sigle inconnu » de « livre connu mais non extrait » dans le message.
  const connu = REGISTRE_LIVRES.some((b) => b.abbr === ABBR)
  console.error(connu
    ? `apply-livre: le livre « ${ABBR} » n'a pas de \`dir\` dans src/data/books.json — aucune extraction sous Source/, donc aucune intégration à appliquer`
    : `apply-livre: sigle « ${ABBR} » absent de src/data/books.json — sigles des livres extraits : ${BOOKS.map(([ab]) => ab).join(', ')}`)
  process.exit(1)
}

// Marqueur : SOURCE UNIQUE `_lib.mjs`.
const SENT = marqueurIntegration(ABBR)
const PUCE = `**${livre.label ?? ABBR} (${ABBR})**`
const data = JSON.parse(readFileSync(OUTFILE, 'utf8')).result

// insère les puces de Sommaire avant le `---` qui clôt la section ## Sommaire
function insertSommaire(text, bullets) {
  if (!bullets || !bullets.trim()) return text
  const si = text.indexOf('## Sommaire')
  if (si < 0) return text
  const rel = text.slice(si).search(/\n---\s*$/m)
  if (rel < 0) return text
  const end = si + rel
  return text.slice(0, end) + `\n- ${PUCE} ${SENT}\n${bullets.trim()}\n` + text.slice(end)
}
// ajoute les topics avant un éventuel "## Bilan", sinon en fin de fiche
function appendTopics(text, topics) {
  const block = `\n\n---\n\n${SENT}\n\n${topics.trim()}\n`
  const bi = text.search(/\n## Bilan/)
  return bi >= 0 ? text.slice(0, bi) + block + text.slice(bi) : text.replace(/\s*$/, '') + block + '\n'
}

for (const r of data) {
  let f = readText(r.fiche)
  if (f.includes(SENT)) { console.log('skip (déjà appliqué) :', r.fiche) }
  else {
    f = insertSommaire(f, r.sommaire)
    f = appendTopics(f, r.ficheTopics)
    writeFileSync(r.fiche, f)
    console.log(`fiche  + ${r.domain.padEnd(11)} → ${r.fiche}  (+${r.ficheTopics.length} c.)`)
  }
}
console.log(`\nIntégration ${ABBR} appliquée.`)
