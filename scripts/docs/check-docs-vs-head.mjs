// Porte de COMMIT des docs GÉNÉRÉS : un `.md` dérivé ne doit décrire QUE l'arbre qui part au commit.
// Le défaut visé est vécu : un générateur lancé dans un arbre partagé mesure le WIP d'une session
// VOISINE (fichiers non stagés) et fige des `fichier:ligne` et des comptes d'inventaire qui n'existent
// nulle part dans l'histoire — un doc qui ment sans qu'aucun test ne rougisse.
//
// BASELINE = l'INDEX (`git show :<chemin>`), pas le working tree : c'est exactement le contenu du
// commit en cours de fabrication (HEAD + ce qui est stagé). Un doc régénéré sur du WIP non stagé
// diverge donc de la baseline, et se fait nommer.
//
// N'ENTRE PAS dans `npm run docs:check` : `docs:check` tourne sur un arbre EN VOL, où un doc dérivé
// décrit légitimement le working tree. Cette garde est une porte de COMMIT (`scripts/git-hooks/pre-commit.mjs`),
// armée UNIQUEMENT quand un doc généré est stagé — même patron diff-scopé que `docs:check` là-bas.
//
// CE QUI EST VÉRIFIÉ (périmètre déclaré, volontairement étroit et sans faux positif) :
//   1. `fichier:ligne` cité entre backticks — le fichier est-il dans le commit, la ligne existe-t-elle,
//      et l'un des identifiants backtiqués de la MÊME ligne du doc se lit-il autour du site cité ?
//   2. Comptes d'inventaire « N <modules|scripts|fichiers> sous `<dir>/` » et « `<dir>/` : N fichiers » —
//      seul le SUR-comptage est fautif (le doc a compté des fichiers qui ne partent pas au commit) ;
//      un sous-comptage est légitime (le générateur filtre souvent par extension) et n'est pas signalé.
// HORS périmètre (assumé) : les comptes exprimés autrement, la sémantique des phrases, les docs
// MANUSCRITS (seuls les `targets` de `GENERATORS` sont jugés).
//
//   node scripts/docs/check-docs-vs-head.mjs [chemins…]
import { execFileSync } from 'node:child_process'
import { GENERATORS } from './build-all.mjs'
import { estUnDocMarkdown } from './lib/empreinte-sources.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'

const OUTIL = 'docs-vs-commit'
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** Les DOCS de `GENERATORS` (`estUnDocMarkdown`) — un `target` peut porter un MOTIF (`motifDeGlob`,
 *  `scripts/guards/lib/lister.mjs`) ; une cible de code n'est pas un doc à confronter. */
const CIBLES = GENERATORS.flatMap((g) => g.targets.filter(estUnDocMarkdown))
const estGenere = (p) => CIBLES.some((motif) => correspondGlob(p, motif))

const cibles = (() => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const bruts = args.length
    ? args
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split('\n')
  return bruts.map((p) => p.trim().replace(/\\/g, '/')).filter((p) => p && estGenere(p))
})()

if (!cibles.length) process.exit(0)

/** Seul `git show :<chemin>` d'un chemin QUE L'INDEX NE PORTE PAS se conclut en `null` : git sort 128 en
 * le nommant. Toute autre panne (ENOBUFS sur un gros blob, dépôt illisible…) se relance — un verdict
 * « absent du commit » tiré d'une lecture ratée est un mensonge de la garde. */
const absentDeLIndex = (e) =>
  e?.status === 128 && /(exists on disk, but not in the index|does not exist)/.test(String(e.stderr ?? ''))

/** Contenu d'un chemin DANS LE COMMIT (index). `null` si le commit ne le porte pas. */
const auCommit = (() => {
  const cache = new Map()
  return (p) => {
    if (!cache.has(p)) {
      let texte
      try {
        texte = git(['show', `:${p}`])
      } catch (e) {
        if (!absentDeLIndex(e)) throw e
        texte = null
      }
      cache.set(p, texte)
    }
    return cache.get(p)
  }
})()

/** Fichiers SUIVIS directement sous `dir` dans le commit (non récursif), filtrés par extension. */
const fichiersDirects = (dir, ext) =>
  git(['ls-files', '--cached', '--', `${dir}/`])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !p.slice(dir.length + 1).includes('/'))
    .filter((p) => !ext || p.endsWith(ext))

const REF = /`((?:src|scripts|server|docs)\/[\w./@-]+):(\d+)`/g
const JETON = /`([^`]+)`/g
const IDENT = /^[A-Za-z_$][\w$]*$/

const fautes = []

for (const doc of cibles) {
  const texte = auCommit(doc)
  if (texte === null) {
    fautes.push(`${doc} — doc généré modifié mais ABSENT de l'index : \`git add\` le doc avec le code qu'il décrit.`)
    continue
  }
  const lignes = texte.split('\n')

  // 1. Références `fichier:ligne`.
  lignes.forEach((ligne, i) => {
    const refs = [...ligne.matchAll(REF)]
    if (!refs.length) return
    const candidats = [...ligne.matchAll(JETON)].map((m) => m[1]).filter((j) => IDENT.test(j))
    for (const [, cible, numTexte] of refs) {
      const num = Number(numTexte)
      const source = auCommit(cible)
      if (source === null) {
        fautes.push(`${doc}:${i + 1} — cite \`${cible}:${num}\`, absent du commit (fichier non suivi ou non stagé).`)
        continue
      }
      const src = source.split('\n')
      if (num < 1 || num > src.length) {
        fautes.push(`${doc}:${i + 1} — cite \`${cible}:${num}\`, hors des ${src.length} lignes du fichier AU COMMIT (doc généré sur un autre arbre ?).`)
        continue
      }
      if (!candidats.length) continue
      const fenetre = src.slice(Math.max(0, num - 3), num + 2).join('\n')
      if (!candidats.some((c) => fenetre.includes(c))) {
        fautes.push(
          `${doc}:${i + 1} — \`${cible}:${num}\` ne porte aucun de ${candidats.map((c) => `\`${c}\``).join(', ')} AU COMMIT (±2 lignes) : la ligne citée a bougé.`,
        )
      }
    }
  })

  // 2. Comptes d'inventaire.
  const plat = texte.replace(/\s+/g, ' ')
  const comptes = [
    ...[...plat.matchAll(/(\d+)\s+(?:modules?|scripts?|fichiers?)\s+(?:sous|dans|de)\s+`([^`]+)`/g)].map((m) => ({ n: Number(m[1]), cible: m[2] })),
    ...[...plat.matchAll(/`([^`]+)`\s*:\s*(\d+)\s+fichiers?/g)].map((m) => ({ n: Number(m[2]), cible: m[1] })),
  ]
  for (const { n, cible } of comptes) {
    const glob = cible.match(/^(.*?)\/\*(\.[\w.]+)$/)
    const dir = (glob ? glob[1] : cible).replace(/\/$/, '')
    const ext = glob ? glob[2] : null
    if (!dir || dir.includes('*')) continue
    const reels = fichiersDirects(dir, ext)
    if (!reels.length) continue // dossier absent du commit ou hors mesure — pas de faux positif ici
    if (n > reels.length) {
      fautes.push(
        `${doc} — annonce ${n} entrées sous \`${cible}\`, le commit n'en porte que ${reels.length} : le doc a été généré sur un arbre qui contient des fichiers NON stagés.`,
      )
    }
  }
}

if (fautes.length) {
  console.error(`${OUTIL} — ${fautes.length} écart(s) entre un doc GÉNÉRÉ stagé et le commit :`)
  for (const f of fautes) console.error(`  - ${f}`)
  console.error('  → régénérer le doc sur l’arbre qui part au commit (`npm run docs:build`), ou stager le code qu’il décrit.')
  process.exit(1)
}

console.log(`${OUTIL} — OK (${cibles.length} doc(s) généré(s) stagé(s) cohérent(s) avec le commit)`)
