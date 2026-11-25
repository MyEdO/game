// GARDE du dépôt : aucun fichier de code ni JSON de configuration — suivi ou non encore indexé — ne
// construit ni ne code en dur un chemin de PDF de livre hors de la couture `pdfDe`
// (`scripts/raw/_lib.mjs`, #1739, 2026-09-19, bloquant 3) ou de sa CLI `scripts/raw/pdf-de.mjs`.
// Banc et balayage : `pdfHorsCouture.test.mjs`, joué par `test:hooks`, qui exige que la déclaration
// `lit` de cette gate (`scripts/gates/toutes.mjs`) couvre `racinesBalayees`.
// LIMITE : garde LEXICALE, sans analyse de valeur — une extension portée par une variable ou épelée par morceaux lui échappe (#1739).
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXTENSIONS_DE_SCRIPT } from './dialecte.mjs'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'
import { porteDeTousLesProjets } from './porteDesProjets.mjs'
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
const EXTENSIONS_DE_CODE = [...EXTENSIONS_DE_SCRIPT, '.py', '.sh', '.ps1']
const CONFIG_JSON = /^(?:[^/]+|\.(?:claude|codex|agents|github)\/.+)\.json$/
/** `f` (relatif POSIX) est-il balayé par la garde ? PURE. */
export const estBalaye = (f) => EXTENSIONS_DE_CODE.some((ext) => f.endsWith(ext)) || CONFIG_JSON.test(f)
export const estShell = (f) => /\.(sh|ps1)$/.test(f)

// #2175 #2235
const RAISON_1699 = "migration DATÉE #1699, rejouée telle qu’écrite (`migrations:replay`) : "
const RAISON_PDF_FACTICE = "banc de la migration datée 1699 : PDF FACTICES d’un `Source/` jetable, qu’elle renomme par extension"
const RAISON_EXTRACTION_INJECTEE = "chemin FACTICE passé à un extracteur INJECTÉ (`pagesPerdues`, `verifierExtraction`) — jamais ouvert"
const RAISON_RESTITUTION = "chaîne ATTENDUE du formateur pur `commandeRestitution`"
const RAISON_SOUS_DOSSIER = "nom de SOUS-DOSSIER de sortie Marker factice, pas une extension"
const RAISON_AUCUN_SUIVI = "commentaire citant la mesure « aucun PDF suivi »"
export const EXEMPTIONS = [
  {
    fichier: "scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs",
    ancre: "*  3. PDF gitignorés homonymes d'un dossier (`Source/<dossier>.\u0070df`) — pas INDÉPENDANT du plan git :",
    raison: RAISON_1699 + "commentaire de son plan, la forme des PDF qu’elle renomme",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs",
    ancre: "*    (`ROOT / \"Source\" / \"<Livre>.\u0070df\"` en Python) — `scripts/art-ref/ldb_extract.py:40` et",
    raison: RAISON_1699 + "commentaire citant la construction Python de son époque",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs",
    ancre: "'.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.\u0070df', '.zip', '.gz', '.woff', '.woff2',",
    raison: RAISON_1699 + "liste d’extensions BINAIRES qu’elle ne réécrit pas, aucun livre",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs",
    ancre: ".filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.\u0070df') && !estAscii(e.name))",
    raison: RAISON_1699 + "FILTRE d’extension des PDF de `Source/` qu’elle renomme, n’en nomme aucun",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/_lib.mjs",
    ancre: "return markerDe(`${id}.\u0070df`, options)",
    raison: "LA construction de la couture : copie de travail `_marker/<id>.<ext>` (`copieMarkerDe`)",
    date: "2026-09-23",
  },
  {
    fichier: "src/data/schemas/defs/books.ts",
    ancre: "\u0070df: z.string().endsWith('.\u0070df').nullable().optional(),",
    raison: "schéma du champ `pdf` du registre : la FORME exigée à la donnée, aucun chemin",
    date: "2026-09-23",
  },
  {
    fichier: "src/data/field-consumers.test.ts",
    ancre: "BookData: ['dir', 'language', 'niveauDeSection', '\u0070df', 'teneur'],",
    raison: "stock des zéros du registre des livres : le NOM du champ `pdf`, aucun chemin",
    date: "2026-11-13",
  },
  {
    fichier: "src/data/field-consumers.test.ts",
    ancre: "'BookData.\u0070df': 'lu sous la vue `EntreeDeLivre` par `scripts/raw/_lib.mjs#pdfDe`',",
    raison: "raison du zéro du champ `pdf` du registre : son nom et sa couture, aucun chemin",
    date: "2026-11-13",
  },
  {
    fichier: "scripts/docs/build-reprise.mjs",
    ancre: "quoi: `PDFs de \\`Source/*.\u0070df\\` (\\`${motif('*.\u0070df')}\\`)`,",
    raison: "motif `.gitignore` de TOUS les PDF, cité par le doc de reprise — aucun livre",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/docs/build-reprise.mjs",
    ancre: "Compress-Archive -Path \"Source\\\\*.\u0070df\",\"art-ref\" -DestinationPath \"<stockage-externe>\\\\game-sources-$(Get-Date -Format yyyy-MM-dd).zip\"",
    raison: "commande de SAUVEGARDE de tous les PDF de `Source/` imprimée au doc de reprise — aucun livre",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/gates/toutes.mjs",
    ancre: "'`.\u0070df`, écartés par extension : sans les extractions quatre migrations sortent 1 faute de livres) sous ' +",
    raison: "prose de la raison de gate : l’extension écartée par la copie du corpus",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/check-folio-continuity.mjs",
    ancre: "// (`git ls-files \"*.\u0070df\"` = 0), donc `pdfChars` est une mesure TRANSPORTÉE, faite une fois au PDF par",
    raison: RAISON_AUCUN_SUIVI,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/empty-folios-stock.mjs",
    ancre: "// Le PDF n'est lu QU'ICI, et AUCUN PDF n'est suivi par le dépôt (`git ls-files \"*.\u0070df\"` = 0) :",
    raison: RAISON_AUCUN_SUIVI,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/lib/joue.mjs",
    ancre: "filter: (src) => path.extname(src).toLowerCase() !== '.\u0070df',",
    raison: "FILTRE d’extension de la copie du corpus : écarte TOUS les PDF, n’en nomme aucun",
    date: "2026-10-28",
  },
  {
    fichier: "scripts/migrations/lib/1699-source-chemins-ascii.test.mjs",
    ancre: "writeFileSync(join(racine, `${LIVRE}.\u0070df`), '\u0070df-factice')",
    raison: RAISON_PDF_FACTICE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/lib/1699-source-chemins-ascii.test.mjs",
    ancre: "assert.ok(existsSync(join(racine, `${livreAscii}.\u0070df`)), 'le PDF ignoré homonyme n’a pas suivi')",
    raison: RAISON_PDF_FACTICE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/lib/1699-source-chemins-ascii.test.mjs",
    ancre: "assert.ok(!existsSync(join(racine, `${LIVRE}.\u0070df`)))",
    raison: RAISON_PDF_FACTICE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/lib/1699-source-chemins-ascii.test.mjs",
    ancre: "writeFileSync(join(racine, 'Source/Livre é.\u0070df'), '\u0070df-factice')",
    raison: RAISON_PDF_FACTICE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/migrations/lib/1699-source-chemins-ascii.test.mjs",
    ancre: "assert.ok(existsSync(join(racine, 'Source/Livre e.\u0070df')))",
    raison: RAISON_PDF_FACTICE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/hooks/stocks-nominatifs.test.mjs",
    ancre: "'Source/Warhammer v4 - Livre de base version corrigee/08 - Statut.\u0070df',",
    raison: "fixture : un chemin qui ne nomme AUCUN fichier de stock (ni `.md`), jamais ouvert",
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.equal(\u0070df, 'x.\u0070df')",
    raison: RAISON_EXTRACTION_INJECTEE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.deepEqual(pagesPerdues(pages, 'x.\u0070df', { extraire }),",
    raison: RAISON_EXTRACTION_INJECTEE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.deepEqual(pagesPerdues(new Map([[1, 'Du texte\\n']]), 'x.\u0070df', { extraire }), [])",
    raison: RAISON_EXTRACTION_INJECTEE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.deepEqual(verifierExtraction(pages, { pdfPath: 'x.\u0070df', extraire }).perdues, [{ page: 2, pypdf: 1461 }])",
    raison: RAISON_EXTRACTION_INJECTEE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "const v = verifierExtraction(pages, { pdfPath: 'x.\u0070df', extraire, restitutions: new Map([[2, 'Planche\\n']]) })",
    raison: RAISON_EXTRACTION_INJECTEE,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.equal(commandeRestitution('Source/_marker/core-rulebook-5e.\u0070df', 'Source/_marker/full/core-rulebook-5e/slices', 17),",
    raison: RAISON_RESTITUTION,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "'marker_single \"Source/_marker/core-rulebook-5e.\u0070df\" --output_format markdown --config_json scripts/raw/marker-paginate.json'",
    raison: RAISON_RESTITUTION,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.deepEqual(mdsDeMarker(base), [join(base, '0-39', '\u0070df', '\u0070df.md')])",
    raison: RAISON_SOUS_DOSSIER,
    date: "2026-09-23",
  },
  {
    fichier: "scripts/raw/lib/marker-pages.test.mjs",
    ancre: "assert.deepEqual(mdsDeMarker(base), [join(base, '\u0070df', '\u0070df.md')])",
    raison: RAISON_SOUS_DOSSIER,
    date: "2026-09-23",
  },
]

/** Fichiers balayés, relatifs POSIX, triés : suivis ET non encore indexés (`-co --exclude-standard`)
 *  — une faute dans un fichier neuf se voit avant son `git add` —, hors suivis effacés de l'arbre.
 *  LÈVE si git ne répond pas. */
export function fichiersBalayes(racine = RACINE) {
  return [...new Set(listerImage(depotDe(racine, { porte: porteDeTousLesProjets }), TRAVAIL).filter((f) => estBalaye(f) && existsSync(join(racine, f))))].sort()
}

/** Les RACINES que le balayage lit (`dossier/` de premier niveau ou fichier de la racine), triées :
 *  ce que la déclaration `lit` de la gate qui joue la garde doit couvrir. */
export const racinesBalayees = (racine = RACINE) =>
  [...new Set(fichiersBalayes(racine).map((f) => (f.includes('/') ? `${f.split('/')[0]}/` : f)))].sort()
