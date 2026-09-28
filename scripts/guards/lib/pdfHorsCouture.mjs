// GARDE du dépôt : aucun fichier de code ni JSON de configuration — suivi ou non encore indexé — ne
// construit ni ne code en dur un chemin de PDF de livre hors de la couture `pdfDe`
// (`scripts/raw/_lib.mjs`, #1739, 2026-09-19, bloquant 3) ou de sa CLI `scripts/raw/pdf-de.mjs`.
// Banc et balayage : `pdfHorsCouture.test.mjs`, joué par `test:hooks`, qui exige que la déclaration
// `lit` de cette gate (`scripts/gates/toutes.mjs`) couvre `racinesBalayees`.
// LIMITE : garde LEXICALE, sans analyse de valeur — une extension portée par une variable ou épelée par morceaux lui échappe (#1739).
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'
import { estLivreExtrait } from '../../raw/_lib.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

// L'extension est COMPOSÉE ici et nulle part écrite en clair : ce module est lui-même balayé.
export const EXT = String.fromCharCode(112, 100, 102)
export const nomPdf = (nom) => [nom, EXT].join('.')

// FORMES refusées, chacune avec un cas au banc : l'extension seule en littéral (concaténation,
// `concat`, `join`, `endsWith`, `with_suffix`, `path.format`, `os.extsep`), littéral qui FINIT par
// l'extension (glob, gabarit et f-string compris), gabarit ouvert avant l'extension, filtre
// d'expression régulière, glob à CLASSES de caractères ou à ALTERNATIVE (accolades, extglob),
// littéral COUPÉ par `+`. En shell, tout mot qui finit par l'extension.
const FORMES = {
  'extension-seule': new RegExp(`(['"])\\.?${EXT}\\1`, 'i'),
  'litteral-fini': new RegExp(`(['"\`])(?:(?!\\1)[^\\n])*\\.${EXT}\\1`, 'i'),
  'gabarit-ouvert': new RegExp(`\\}\\.${EXT}\\b`, 'i'),
  'filtre-regex': new RegExp(`\\\\\\.${EXT}\\b`, 'i'),
  'glob-classe': new RegExp(`\\.(?!${EXT})${[...EXT].map((c) => `(?:${c}|\\[[^\\]\\n]*${c}[^\\]\\n]*\\])`).join('')}`, 'i'),
  'glob-alternative': new RegExp(`\\.(?:\\{[^}\\n]*\\b${EXT}\\b[^}\\n]*\\}|[@!+*?]\\([^)\\n]*\\b${EXT}\\b[^)\\n]*\\))`, 'i'),
}
const MOT_SHELL = new RegExp(`\\S*\\.${EXT}\\b`, 'i')
const LITTERAL = /(['"])((?:(?!\1)[^\n\\]|\\.)*)\1/g
const COUPE = new RegExp(`(?:\\.${EXT}|^\\.?${EXT})$`, 'i')

/** Littéraux de chaîne CONCATÉNÉS par `+` sur une ligne dont la jonction finit par l'extension. PURE. */
function litteralCoupe(ligne) {
  const lits = [...ligne.matchAll(LITTERAL)]
  for (let i = 0; i < lits.length - 1; i += 1) {
    let joint = lits[i][2]
    for (let j = i + 1; j < lits.length; j += 1) {
      const entre = ligne.slice(lits[j - 1].index + lits[j - 1][0].length, lits[j].index)
      if (!/^\s*\+\s*$/.test(entre)) break
      joint += lits[j][2]
      if (COUPE.test(joint)) return true
    }
  }
  return false
}

/** Littéraux du REGISTRE : le `pdf` de chaque livre et `<dossier>.<ext>` de chaque livre extrait. PURE. */
export const litterauxDe = (registre) => [...new Set(registre.flatMap((b) => [
  b.pdf,
  estLivreExtrait(b) && nomPdf(basename(b.dir)),
]).filter(Boolean))]

/** Sites fautifs d'un texte : `[{ ligne, texte, forme }]`. `shell` : fichier `.sh`/`.ps1`. PURE. */
export function sitesFautifs(texte, litteraux, { shell = false } = {}) {
  const out = []
  texte.split('\n').forEach((l, i) => {
    const forme = Object.keys(FORMES).find((f) => FORMES[f].test(l))
      ?? (litteralCoupe(l) ? 'litteral-coupe' : null)
      ?? (shell && MOT_SHELL.test(l) ? 'mot-shell' : null)
      ?? (litteraux.some((lit) => l.includes(lit)) ? 'litteral-du-registre' : null)
    if (forme) out.push({ ligne: i + 1, texte: l.trim(), forme })
  })
  return out
}

// Fichiers de CODE, et JSON de configuration (racine, `.claude/`, `.codex/`, `.agents/`, `.github/`).
const CODE = /\.(mjs|js|cjs|ts|mts|tsx|py|sh|ps1)$/
const CONFIG_JSON = /^(?:[^/]+|\.(?:claude|codex|agents|github)\/.+)\.json$/
/** `f` (relatif POSIX) est-il balayé par la garde ? PURE. */
export const estBalaye = (f) => CODE.test(f) || CONFIG_JSON.test(f)
export const estShell = (f) => /\.(sh|ps1)$/.test(f)

// Exemptions AU SITE : `fichier` + `motif` de la ligne + `raison`. Chacune doit toucher un site.
const MIGRATION_1699 = 'scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs'
const RAISON_1699 = 'migration DATÉE #1699, rejouée telle qu’écrite (`migrations:replay`) : '
export const EXEMPTIONS = [
  { fichier: MIGRATION_1699, motif: /^\* {2}3\. PDF gitignorés homonymes d'un dossier/, raison: `${RAISON_1699}commentaire de son plan, la forme des PDF qu’elle renomme` },
  { fichier: MIGRATION_1699, motif: /^\* {4}\(`ROOT \/ "Source" \/ "<Livre>\./, raison: `${RAISON_1699}commentaire citant la construction Python de son époque` },
  { fichier: MIGRATION_1699, motif: /^'\.png', '\.jpg', /, raison: `${RAISON_1699}liste d’extensions BINAIRES qu’elle ne réécrit pas, aucun livre` },
  { fichier: MIGRATION_1699, motif: /^\.filter\(\(e\) => e\.isFile\(\) && e\.name\.toLowerCase\(\)\.endsWith\(/, raison: `${RAISON_1699}FILTRE d’extension des PDF de \`Source/\` qu’elle renomme, n’en nomme aucun` },
  { fichier: 'scripts/raw/_lib.mjs', motif: /^return markerDe\(`\$\{id\}\./, raison: 'LA construction de la couture : copie de travail `_marker/<id>.<ext>` (`copieMarkerDe`)' },
  { fichier: 'src/data/schemas/defs/books.ts', motif: /^pdf: z\.string\(\)\.endsWith\(/, raison: 'schéma du champ `pdf` du registre : la FORME exigée à la donnée, aucun chemin' },
  { fichier: 'scripts/docs/build-reprise.mjs', motif: /^quoi: `PDFs de/, raison: 'motif `.gitignore` de TOUS les PDF, cité par le doc de reprise — aucun livre' },
  { fichier: 'scripts/docs/build-reprise.mjs', motif: /^Compress-Archive -Path "Source/, raison: 'commande de SAUVEGARDE de tous les PDF de `Source/` imprimée au doc de reprise — aucun livre' },
  { fichier: 'scripts/gates/toutes.mjs', motif: /écartés par extension/, raison: 'prose de la raison de gate : l’extension écartée par la copie du corpus' },
  { fichier: 'scripts/raw/check-folio-continuity.mjs', motif: /git ls-files "\*\./, raison: 'commentaire citant la mesure « aucun PDF suivi »' },
  { fichier: 'scripts/raw/lib/empty-folios-stock.mjs', motif: /git ls-files "\*\./, raison: 'commentaire citant la mesure « aucun PDF suivi »' },
  { fichier: 'scripts/migrations/lib/idempotence-ordre-des-cles.test.mjs', motif: /ce sont les extractions `\.md`/, raison: 'commentaire : la copie du corpus écarte les PDF par extension' },
  { fichier: 'scripts/migrations/lib/idempotence-ordre-des-cles.test.mjs', motif: /^filter: \(src\) => path\.extname/, raison: 'FILTRE d’extension de la copie du corpus : écarte TOUS les PDF, n’en nomme aucun' },
  { fichier: 'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs', motif: /join\(racine, /, raison: 'banc de la migration datée 1699 : PDF FACTICES d’un `Source/` jetable, qu’elle renomme par extension' },
  { fichier: 'scripts/hooks/stocks-nominatifs.test.mjs', motif: /^'Source\/Warhammer v4 - Livre de base version corrigee\/08 - Statut\./, raison: 'fixture : un chemin qui ne nomme AUCUN fichier de stock (ni `.md`), jamais ouvert' },
  { fichier: 'scripts/raw/lib/marker-pages.test.mjs', motif: /'x\./, raison: 'chemin FACTICE passé à un extracteur INJECTÉ (`pagesPerdues`, `verifierExtraction`) — jamais ouvert' },
  { fichier: 'scripts/raw/lib/marker-pages.test.mjs', motif: /Source\/_marker\/core-rulebook-5e\./, raison: 'chaîne ATTENDUE du formateur pur `commandeRestitution`' },
  { fichier: 'scripts/raw/lib/marker-pages.test.mjs', motif: /mdsDeMarker\(base\), \[join\(base, /, raison: 'nom de SOUS-DOSSIER de sortie Marker factice, pas une extension' },
]

/** Fichiers balayés, relatifs POSIX, triés : suivis ET non encore indexés (`-co --exclude-standard`)
 *  — une faute dans un fichier neuf se voit avant son `git add` —, hors suivis effacés de l'arbre.
 *  LÈVE si git ne répond pas. */
export function fichiersBalayes(racine = RACINE) {
  return [...new Set(listerImage(depotDe(racine), TRAVAIL).filter((f) => estBalaye(f) && existsSync(join(racine, f))))].sort()
}

/** Les RACINES que le balayage lit (`dossier/` de premier niveau ou fichier de la racine), triées :
 *  ce que la déclaration `lit` de la gate qui joue la garde doit couvrir. */
export const racinesBalayees = (racine = RACINE) =>
  [...new Set(fichiersBalayes(racine).map((f) => (f.includes('/') ? `${f.split('/')[0]}/` : f)))].sort()
