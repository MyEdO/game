// Hook PreToolUse — garde anti-réinvention à la création d'un fichier sous `src/`.
//
// Deux régimes (#1318 V5, 2026-08-16 ; périmètre étendu #1679 L1a) :
//   - `src/ui/**/*.tsx` ET `src/gameIso/**/*.tsx` NEUFS (hors `*.test.tsx`) : BLOQUANT. Un composant
//     d'UI ou de rendu est soit une PRIMITIVE partagée (déclarée dans
//     `src/data/primitives.manifest.json`, rendue par `docs/primitives.md`), soit un
//     ÉCRAN/panneau/surcouche inscrit au registre `scripts/hooks/ecrans-ui.json`. Ni l'un ni l'autre
//     → sortie non-zéro : la déclaration se fait AVANT le code. (`src/gameIso` porte 32 `.tsx` hors
//     tests, mesurés le 2026-09-02 ; `authoring/` et `builders/` n'en portent aucun — le périmètre
//     n'a pas d'exception à ménager.)
//   - tout autre fichier neuf sous `src/` : injection de contexte (rappel anti-réinvention).
//
// DEUX FORMES d'entrée au registre, une seule règle :
//   - chaîne `"src/ui/X.tsx"` = STOCK des écrans déjà en place le 2026-08-16 (207 mesurés) ; elle ne
//     déclare que ce qui EXISTE déjà dans l'arbre, et ce stock ne croît plus.
//   - objet `{ "fichier": "src/ui/X.tsx", "maquette": "<où la maquette a été validée>" }` pour tout
//     fichier NEUF : un écran neuf se dessine et se fait valider EN PRÉSENCE avant d'être codé (E1) —
//     l'entrée porte donc la trace de cette validation, sans quoi la déclaration est refusée.
//
// COUVERTURE RÉELLE (à énoncer, pas à supposer) — la garde ne voit que les outils listés au matcher
// `PreToolUse` des DEUX surfaces (`.claude/settings.json`, `.codex/hooks.json`) : `Write` et
// `mcp__lean-ctx__ctx_patch` (dont `op: "create"`, qui porte le chemin en `path` et non `file_path`).
// LIMITE RÉSIDUELLE assumée : tout chemin d'écriture qui ne passe pas par un outil matché échappe à
// la garde — redirection shell (`... > src/ui/X.tsx`, `tee`, `cp`), script Node lancé par un runner,
// éditeur externe. Le cliquet (xvii)/(x) de `src/ui/ui-ratchets.test.ts` et la revue restent la
// deuxième ligne ; ce hook est un rappel au geste, pas un mur étanche.
//
// Échappement documenté : `SKIP_NEW_SRC_GUARD=1` laisse passer et TRACE la dérogation (stderr +
// `.claude/logs/new-src-guard-skips.log`, gitignoré).
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const REGISTRE_DEFAUT = join(REPO, 'scripts', 'hooks', 'ecrans-ui.json')
export const MANIFESTE_PRIMITIVES = join(REPO, 'src', 'data', 'primitives.manifest.json')
export const JOURNAL = join(REPO, '.claude', 'logs', 'new-src-guard-skips.log')

/** Registre LU par la garde. Le chemin est INJECTABLE (`WFRP_REGISTRE_ECRANS`) pour une seule raison :
 *  son test doit pouvoir ajouter une entrée sans TOUCHER au fichier committé. Ce qu'il faisait — écrire
 *  dans l'arbre puis remettre dans un `finally` — a échoué le 2026-09-04 (`UNKNOWN: unknown error`,
 *  entrée fantôme laissée dans l'arbre, deux tests rouges en cascade et un arbre sale pour toutes les
 *  gates). Un test ne rend pas l'arbre de travail écrivable : il se donne son propre registre. */
export const cheminRegistre = (env = process.env) => env.WFRP_REGISTRE_ECRANS || REGISTRE_DEFAUT

/**
 * Chemin relatif à la RACINE DU DÉPÔT, séparateurs POSIX — `null` si le fichier vit hors du dépôt
 * (un `D:/autre-projet/src/ui/X.tsx` ne regarde pas cette garde ; l'ancrage sur `lastIndexOf('src/')`
 * le prenait pour un composant maison).
 */
export function relPath(fp, repo = REPO) {
  const abs = isAbsolute(String(fp)) ? String(fp) : resolve(repo, String(fp))
  const rel = relative(repo, abs).replace(/\\/g, '/')
  // `relative` rend la cible TELLE QUELLE quand les racines diffèrent (autre volume Windows) —
  // un reste absolu ou préfixé d'une lettre de lecteur est donc « hors dépôt », pas un relatif.
  if (!rel || rel.startsWith('../') || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null
  return rel
}

/** Un composant soumis au régime bloquant (un harnais `.test.tsx` n'en est pas un). */
export function estComposantUI(rel) {
  return (rel.startsWith('src/ui/') || rel.startsWith('src/gameIso/')) &&
    rel.endsWith('.tsx') && !rel.endsWith('.test.tsx')
}

/** Chemin porté par une entrée de registre (chaîne du stock, ou objet), en POSIX. Clef NORMALISÉE
 *  UNE fois : tri, doublon et appariement se font tous sur elle. */
export const cheminEntree = (e) => String((typeof e === 'string' ? e : e?.fichier) ?? '').replace(/\\/g, '/')

/** Marques de réservation : une trace qui ne désigne AUCUNE validation. */
const MAQUETTE_RESERVEE = /^(?:(?:todo|à faire|a faire|tbd|fixme)\b|[-–—?.…]+$)/i

/** Trace de validation de la maquette portée par une entrée (`''` pour le stock en chaîne, et pour
 *  une marque de RÉSERVATION — « TODO » ne dit rien de l'endroit où la maquette a été validée).
 *
 *  CE QUE CETTE PORTE PROUVE : qu'une trace de validation a été ÉCRITE — garde-fou d'ÉTOURDERIE
 *  (déclaration oubliée, réservation laissée en place), PAS de CONTREFAÇON (même statut que le
 *  contrôle de capture de `solde-ticket-guard`). Rien ici ne dit que la maquette a été vue : c'est la
 *  revue qui le juge. */
export const maquetteEntree = (e) => {
  if (typeof e === 'string') return ''
  const trace = String(e?.maquette ?? '').trim()
  return MAQUETTE_RESERVEE.test(trace) ? '' : trace
}

/**
 * Déclaré = cité par le manifeste des primitives (`manifeste` = son TEXTE), OU inscrit au registre des
 * écrans. Une entrée en CHAÎNE ne déclare que ce qui existe DÉJÀ (le stock du 2026-08-16) ; un fichier
 * neuf exige l'entrée OBJET portant sa `maquette` validée.
 */
export function estDeclare(rel, manifeste, registre, existe = false) {
  if (manifeste.includes(rel)) return true
  const entree = (registre.ecrans ?? []).find((e) => cheminEntree(e) === rel)
  if (entree === undefined) return false
  return typeof entree === 'string' ? existe : maquetteEntree(entree) !== ''
}

/** Corps du refus quand le registre est ILLISIBLE : le geste attendu est de le réparer. */
export function messageRegistreCasse(rel, cause) {
  return [
    `REFUS (fail-closed) — registre des composants d'UI ILLISIBLE : ${cause}`,
    '',
    `La déclaration de ${rel} ne peut pas être vérifiée : réparer d'abord`,
    '  scripts/hooks/ecrans-ui.json (JSON valide, clef "ecrans" = tableau de chemins)',
    "  ou src/data/primitives.manifest.json s'il est absent de l'arbre (checkout partiel ?),",
    'puis relancer — la garde reprendra son cours normal.',
    '',
    "Ne PAS contourner en écrivant le fichier : sans registre lisible, plus rien n'est gardé.",
    'Urgence tracée : SKIP_NEW_SRC_GUARD=1 (journalisée dans .claude/logs/new-src-guard-skips.log).',
  ].join('\n')
}

export function messageRefus(rel) {
  return [
    `REFUS — composant NON DÉCLARÉ : ${rel}`,
    '',
    "Un nouveau .tsx de src/ui ou src/gameIso se déclare AVANT d'être écrit (#1318 V5) :",
    '  • PRIMITIVE partagée (réutilisable par N écrans) → ajouter son entrée à',
    '    src/data/primitives.manifest.json (id, type, label, fichier, concept, perimetre,',
    '    verrou), relancer `npm run docs:primitives`, puis relancer.',
    '  • ÉCRAN / panneau / modale / surcouche → maquette validée EN PRÉSENCE (une spec fige le',
    '    mécanisme, pas le goût), puis inscription au tableau "ecrans" de',
    `    scripts/hooks/ecrans-ui.json sous la forme { "fichier": "${rel}", "maquette": "<où et`,
    '    quand la maquette a été validée>" } (ordre alphabétique), puis relancer.',
    '',
    "AVANT d'inscrire : vérifier qu'aucune primitive existante ne couvre le besoin",
    "(docs/primitives.md + 2-3 variantes du concept grepées dans src/ui) — la réutiliser ou",
    "l'ÉTENDRE coûte moins que la Nᵉ copie.",
    '',
    'Dérogation pressée et TRACÉE : relancer avec SKIP_NEW_SRC_GUARD=1 (la dérogation est',
    'journalisée dans .claude/logs/new-src-guard-skips.log).',
  ].join('\n')
}

export const RAPPEL_SRC = (rel) =>
  `⚠ Ce Write CRÉE un nouveau fichier sous src/ (${rel}). ` +
  `Réflexe anti-réinvention : as-tu vérifié docs/primitives.md (généré de src/data/primitives.manifest.json) et grep 2-3 variantes du concept dans l'existant ? ` +
  `Si un module/primitive existant couvre le besoin, RÉUTILISE-le ou ÉTENDS-le (général + paramétrable) au lieu de créer ce fichier. ` +
  `Sinon, énonce explicitement pourquoi aucun existant ne convient avant de poursuivre.`

function trace(rel) {
  const ligne = `${new Date().toISOString()} SKIP_NEW_SRC_GUARD=1 ${rel}\n`
  try {
    mkdirSync(dirname(JOURNAL), { recursive: true })
    appendFileSync(JOURNAL, ligne)
  } catch {
    /* journal indisponible → la trace stderr ci-dessous reste */
  }
  process.stderr.write(`[new-src-file-guard] dérogation prise : ${ligne}`)
}

async function main() {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk

  // `Write` porte le chemin en `tool_input.file_path`, `ctx_patch` (op `create`) en `tool_input.path`.
  let fp
  try {
    const input = JSON.parse(raw)?.tool_input ?? {}
    fp = String(input.file_path ?? input.path ?? '')
  } catch {
    return // stdin illisible → silence
  }
  if (!fp || existsSync(fp)) return
  const rel = relPath(fp)
  if (!rel || !rel.startsWith('src/')) return // hors du dépôt, ou hors de src/

  if (estComposantUI(rel)) {
    // Registre ou manifeste illisible → on REFUSE (fail-closed) : un crash rendrait un statut 1,
    // que Claude Code traite comme non bloquant — la garde passerait à vide.
    let déclaré = false
    let panne = null
    try {
      const manifeste = readFileSync(MANIFESTE_PRIMITIVES, 'utf8')
      const registre = JSON.parse(readFileSync(cheminRegistre(), 'utf8'))
      // Le fichier n'existe pas (contrôle ci-dessus) : le stock en chaîne ne le déclare donc pas.
      déclaré = estDeclare(rel, manifeste, registre, false)
    } catch (e) {
      panne = e.message
    }
    if (!déclaré) {
      if (process.env.SKIP_NEW_SRC_GUARD === '1') trace(rel)
      else {
        process.stderr.write((panne ? messageRegistreCasse(rel, panne) : messageRefus(rel)) + '\n')
        process.exit(2)
      }
    }
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: RAPPEL_SRC(rel) },
    }),
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
