// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : demande utilisateur 2026-07-14
// (verbatim) — « J'en ai marre
// que tu donne un ticket a un agent, commit et consigne les résultats dans le ticket tout en le
// fermant, et oubliant que potentiellement il n'a pas bien fait son boulot ou qu'il a detecter un
// problème qu'il a consiédéré comme hors périmetre et que tu n'as pas mis dans un nouveau ticket ».
// La FERMETURE d'un ticket au commit devient mécaniquement impossible sans un SOLDE écrit
// (`.claude/soldes/<N>.md`) : preuve de vérification orchestrateur + disposition de chaque reste.
// Le solde est exigé dans l'INDEX du commit de fermeture (pas seulement sur le disque) et n'est plus
// jamais supprimé après coup : les messages de commit le citent par chemin, git est son archive.
//
// Extension même jour (verbatim) — « De la même maniere, apres un certain nombre de ticket fermé,
// il faudrait lancer une review adversarial. Ou a chaque ticket ... c'est peut etre la même régle
// finalement. A toi de voir » : arbitrage orchestrateur — LES DEUX niveaux dans le MÊME hook.
// (1) chaque solde porte sa propre réfutation adversariale (verdict CONFIRMÉ/PARTIEL/RÉFUTÉ) ;
// (2) tous les `PALIER` tickets fermés, une revue adversariale de PALIER (cumul) est exigée avant
// toute nouvelle fermeture.
//
// Extension 2026-07-14 (constat utilisateur, verbatim) — « je pensais que tu avais un hook qui te
// forceait a faire une review reversal, elle ne doit clairement pas marcher » puis « Ou alors
// seulement sur les tickets ? » : un commit « ref #N » (rattaché SANS fermer) échappait à tout
// regard adversarial ET n'entrait pas dans le palier. Deux volets : (1) le palier se MESURE sur
// l'histoire (`scripts/guards/lib/revuePalier.mjs` : commits touchant `src`/`scripts` depuis la tête
// de fenêtre de la dernière revue archivée), donc TOUT commit de substance y entre, fermeture ou pas ;
// (2) anti-esquive — un commit `ref #N` qui touche `src/**` (≥10 lignes de diff staged) exige lui
// aussi sa réfutation (ligne `REFUTATION:` dans le message, ou fichier `.claude/soldes/ref-<N>.md`).
// Le déclencheur du mécanisme REFUTATION est le TICKET explicitement rattaché (fermeture ou `ref #N`),
// et c'est la PORTE DU TICKET qui le précède : un commit de substance cite un ticket, donc tout commit
// de substance arrive ici avec le sien.
//
// Porte du ticket (option retenue par l'utilisateur le 2026-09-11, verbatim) — « Tout commit de
// substance cite un ticket — un commit qui touche src/ ou scripts/ sans `refs #N`/`corrige #N` est
// refusé par le pre-commit ; le ticket est l'unité de travail, même pour un fix d'une ligne. »
//
// Ce que le garde exige AUJOURD'HUI, par volet (chacun a son évaluateur PUR et ses tests) :
//   `evaluate`                    solde conforme pour chaque ticket fermé — dont, dans « ## Restes »,
//                                 UN SEUL reste routé (skill orchestrer § Fermeture), une preuve au
//                                 site (`fichier:ligne`) pour « corrigé dans ce commit », un état
//                                 lisible pour « inventaire #<épic> », et une « ## Recette visuelle »
//                                 à capture vérifiée quand un ÉCRAN est touché ;
//   `evaluatePorteDuTicket`       commit de substance (`src`/`scripts`) dont le message ne cite
//                                 AUCUN ticket ;
//   `evaluateAntiEsquive`         réfutation d'un commit « ref #N » de substance ;
//   `evaluateJuge`                preuve de juge adversarial (+ JUGE-VISION sur un écran) ;
//   `evaluateAmendInvisible`      amend dont le message échappe au contrôle ;
//   `evaluateRegistresPorteurs`   ticket encore porté par un registre de `registres-porteurs.json` ;
//   `evaluateFermetureHorsCommit` `gh issue close` & co — la fermeture passe par le commit ;
//   `evaluateTombale`             (scripts/hooks/solde-tombale.mjs) commentaire de dette citant le
//                                 ticket fermé ;
//   `evaluateArbrePrincipal`      `ask` sur un commit hors worktree ;
//   `evaluateHunksEmportes`       `git commit -- <paths>` qui prendrait l'arbre au lieu de l'index ;
//   `evaluateStocksQuiGrandissent` stock nominatif qui naît ou grandit sans `CLIQUET:` au message.
//
// COÛT, et pourquoi le `timeout: 10` de `.claude/settings.json` (et son miroir `.codex/hooks.json`)
// reste à 10 s (mesuré 2026-09-04, worst case fabriqué : 49 fichiers / 23 520 insertions dont 12
// PORTEURS de stock) : `git commit -a` 1,8 s, `git commit -- .` 2,2 s, le rejeu de `429b9a1a2`
// (23 734 insertions, 5 porteurs) 1,1 s ; `git show <sha> -U0` sur ce commit 0,15 s ; le chargement
// du compilateur `typescript` (portée de module, à la demande) 0,20 s et le parse de ses 5 porteurs
// 0,06 s. La marge est d'un facteur 4 sur le pire cas mesuré — un hook expiré ne bloque pas, donc
// ce chiffre se re-mesure quand la porte s'alourdit, il ne se gonfle pas par précaution.
import { Buffer } from 'node:buffer'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { croissancesNonCouvertes, estPorteurDeStock, raisonDeRefus } from '../guards/lib/stocksNominatifs.mjs'
import {
  PORTEUR_DU_PLAFOND, estCheminDuBudget, importsDe, mesurerBudget, plafondDeLaSource, refusDeBudget,
} from '../guards/budget-contexte.mjs'
import { GitIndisponible, estDansHead, estRepertoire, lireGit, sortieOuNull } from '../guards/lib/gitPorte.mjs'
import { hunksDe } from '../guards/lib/hunks.mjs'
import { ancetreExistant, canoniser } from '../docs/lib/chemin-mesure.mjs'
import { motifRattachement, numerosDeLaChaine, numerosFermes } from '../guards/lib/fermetures.mjs'
import {
  DOSSIERS_DE_SUBSTANCE, estCheminDeSubstance, fenetreDeRevue, memeSha, mesureDuPalier,
  nomDArchiveDeRevue, problemesDeRevue, revuesNeuves,
} from '../guards/lib/revuePalier.mjs'

// Message passé par FICHIER (`git commit -F <path>` / `--file <path>` / `--file=<path>`) : le
// driver stdin ne voit que `tool_input.command` — un message packé dans un fichier externe y est
// INVISIBLE, ce qui (a) bloque à tort une fermeture légitime (aucun "corrige #N" vu dans la commande)
// et (b) pire, laisse le closer de publication (qui LIT le vrai message du commit poussé) fermer un
// ticket SANS être passé par ce contrôle de solde. Fix découvert en production 2026-07-14.
const FILE_FLAG_RE = /(?:^|\s)(?:-F|--file)(=|\s+)("[^"]*"|'[^']*'|\S+)/

/** Chemin du fichier de message porté par `-F <path>` / `--file <path>` / `--file=<path>` DANS le
 *  segment qui exécute `git commit` — jamais ailleurs dans la ligne. `null` si aucun de ces flags
 *  n'y est présent.
 *  Sémantique git : `-m` et `-F` sont MUTUELLEMENT EXCLUSIFS (git refuse la combinaison) — le
 *  PREMIER des deux rencontré tranche, et un `-m` signifie donc qu'aucun fichier de message n'existe
 *  (faux positif vécu : un message -m citant « via -F et, » a fait chercher le fichier « et, »).
 *  Le SEGMENT est la seconde borne, mesurée le 2026-09-04 : `gh api -X PATCH … -F corps=@fichier`
 *  (où `-F` est un CHAMP de formulaire, pas un fichier de message) et une ligne de todo qui cite ce
 *  drapeau étaient refusés « message de commit en fichier illisible » — même classe de défaut que le
 *  `2>&1` pris pour un pathspec : un drapeau ne vaut que dans le segment de la commande qui le lit. */
function fileFlagPath(command) {
  if (!command) return null
  for (const segment of segmentsProfonds(command)) {
    const subIdx = gitCommitSubcommandIndex(segment)
    if (subIdx === -1) continue
    for (let k = subIdx + 1; k < segment.length; k += 1) {
      const t = segment[k]
      if (OPERATEUR_SHELL_RE.test(t)) break
      if (t === '--message' || /^--message=/.test(t)) return null
      if (t === '--file') return segment[k + 1] ?? null
      const longEq = /^--file=(.*)$/.exec(t)
      if (longEq) return longEq[1]
      const court = t.startsWith('-') && !t.startsWith('--') ? SHORT_VALUE_FLAG_RE.exec(t) : null
      if (court) {
        if (court[2] === 'm') return null
        return court[3] !== '' ? court[3] : segment[k + 1] ?? null
      }
    }
  }
  return null
}

/** Texte COMPLET à analyser pour la fermeture/réfutation : la commande elle-même + le contenu du
 *  fichier `-F`/`--file` s'il y en a un (lu via `readFile`, résolu relatif à `cwd`). Le gate « est-ce
 *  un git commit » continue de s'appliquer sur la commande seule (le fichier ne la contient jamais).
 *  `fileError` = chemin illisible (fail-closed : ne JAMAIS retomber en silence sur un -F cassé). */
export function extractMessageSources(command, { readFile = readFileSync, cwd = process.cwd() } = {}) {
  if (!command) return { text: '', fileError: null }
  const path = fileFlagPath(command)
  if (!path) return { text: command, fileError: null }
  try {
    const fileContent = readFile(resolve(cwd, path), 'utf8')
    return { text: `${command}\n${fileContent}`, fileError: null }
  } catch {
    return { text: command, fileError: path }
  }
}

// ── Parsing STRUCTUREL de la ligne de commande (#591 défaut 3) ───────────────────────────────────
// « est-ce un `git commit` ? » ne se décide plus par un grep de sous-chaîne sur la ligne entière
// (un `gh issue create --body "... git commit ..."` la faisait mordre à tort) : on TOKENISE la
// commande (quotes simples/doubles + here-strings PowerShell `@'…'@`/`@"…"@`), on la découpe en
// segments aux enchaînements top-level (`&&`, `;`, `||`, `|`), puis on identifie dans CHAQUE segment
// l'exécutable de tête et sa sous-commande (`git [-C <path>|-c <k=v>|...] commit`).
// Ouverture d'un HEREDOC (`<<EOF`, `<<-'EOF'`, `<<"EOF"`) : ce qui suit, à partir de la LIGNE
// suivante et jusqu'à la ligne qui répète le mot, est une DONNÉE écrite par la commande, pas des
// commandes. Sans cette borne, le corps se tokenisait : ses `;`/`&&` ouvraient des segments et une
// ligne de PROSE citant « git commit » devenait un commit (`cat > f.md <<'EOF' … EOF` d'un
// commentaire de ticket, demande de confirmation sur une écriture de fichier, #1729 sonde 6).
// Le mot de fin ne peut pas être quoté ici : les quotes de l'ouverture n'appartiennent pas au mot.
const HEREDOC_OUVERTURE_RE = /^<<(-?)\s*(['"]?)([A-Za-z_][\w.-]*)\2/

/** La ligne de fin est le mot SEUL, sans indentation — sauf après `<<-`, où le shell ne retire que
 *  les TABULATIONS de tête. Tolérer une indentation quelconque ferait terminer un corps sur une
 *  ligne de PROSE qui cite le mot, et la suite du texte redeviendrait des commandes. PUR. */
const ferme = (ligne, { mot, tabs }) => (tabs ? ligne.replace(/^\t+/, '') : ligne).replace(/\r$/, '') === mot

/** Index de la fin du CORPS des heredocs ouverts (`{ mot, tabs }`), `pos` étant le début de la
 *  première ligne de corps. Un mot jamais refermé consomme le reste de la commande, comme le shell. */
function finDesCorpsHeredoc(command, pos, ouverts) {
  let i = pos
  for (const ouvert of ouverts) {
    for (;;) {
      if (i >= command.length) return command.length
      const finLigne = command.indexOf('\n', i)
      const ligne = command.slice(i, finLigne === -1 ? command.length : finLigne)
      i = finLigne === -1 ? command.length : finLigne + 1
      if (ferme(ligne, ouvert)) break
    }
  }
  return i
}

function tokenizeCommand(command) {
  const tokens = []
  let i = 0
  const n = command.length
  // Mots de fin des heredocs ouverts sur la ligne EN COURS : leurs corps commencent au prochain
  // saut de ligne, dans l'ordre d'ouverture.
  let heredocs = []
  while (i < n) {
    while (i < n && /\s/.test(command[i])) {
      // Un SAUT DE LIGNE hors quote termine la commande comme un `;` : sans lui, la ligne qui SUIT
      // le corps d'un heredoc se recollait au `cat` (segment unique) et son `git commit` devenait
      // invisible. Les sauts de ligne d'un message vivent DANS un token quoté, jamais ici.
      if (command[i] === '\n') {
        i = heredocs.length > 0 ? finDesCorpsHeredoc(command, i + 1, heredocs) : i + 1
        heredocs = []
        tokens.push({ text: ';', op: ';' })
        continue
      }
      i++
    }
    if (i >= n) break
    const ouverture = HEREDOC_OUVERTURE_RE.exec(command.slice(i))
    if (ouverture) {
      // Le marqueur reste un token (`OPERATEUR_SHELL_RE` le lit comme une redirection : rien après
      // lui n'est un pathspec) ; son corps, lui, ne sera jamais tokenisé.
      heredocs.push({ mot: ouverture[3], tabs: ouverture[1] === '-' })
      tokens.push({ text: `<<${ouverture[3]}`, op: null })
      i += ouverture[0].length
      continue
    }
    if (command[i] === '@' && (command[i + 1] === "'" || command[i + 1] === '"')) {
      const quote = command[i + 1]
      const closer = `${quote}@`
      const end = command.indexOf(closer, i + 2)
      if (end !== -1) {
        tokens.push({ text: command.slice(i + 2, end), op: null })
        i = end + closer.length
        continue
      }
    }
    if (command.startsWith('&&', i)) { tokens.push({ text: '&&', op: '&&' }); i += 2; continue }
    if (command.startsWith('||', i)) { tokens.push({ text: '||', op: '||' }); i += 2; continue }
    if (command[i] === ';') { tokens.push({ text: ';', op: ';' }); i += 1; continue }
    if (command[i] === '|') { tokens.push({ text: '|', op: '|' }); i += 1; continue }
    // MOT (bareword ± span(s) quoté(s) EMBARQUÉS) : le comportement shell réel colle une quote
    // rencontrée en PLEIN MILIEU d'un token à ce MÊME token (`-m"a b c"` → un seul token `-ma b c`,
    // `--message="a b c"` → `--message=a b c`) — jamais une coupure qui laisserait les mots du
    // message fuir en tokens séparés (les mots d'un message multi-mots devenaient alors autant de
    // pathspecs parasites, #591 suite : le filtrage src/ui retombait à néant, JUGE silencieux).
    let buf = ''
    let quoteVue = false
    let j = i
    while (j < n) {
      const c = command[j]
      // CONTINUATION DE LIGNE (`\` POSIX, backtick PowerShell suivi du saut de ligne) : la commande
      // se POURSUIT — les deux caractères disparaissent, et le saut n'est pas la fin d'une commande.
      // Sans cela, `git commit --amend \` + saut + `-F msg.txt` perdait son `-F` (message jamais lu,
      // refus FAUX « SUBSTANCE sans ticket ») et le backtick devenait un pathspec.
      if ((c === '\\' || c === '`') && command[j + 1] === '\n') { j += 2; continue }
      if (/\s/.test(c) || c === ';' || c === '|' || (c === '&' && command[j + 1] === '&')) break
      // ANSI-C quoting `$'…'` (bash) : span QUOTÉ au même titre que `'…'`. Sans lui le `$` restait
      // collé au mot suivant (`bash -c $'gh issue create …'` rendait un token `$gh`) et l'exécutable
      // de tête devenait méconnaissable. Un `\x` y rend son caractère littéral : la reconnaissance
      // porte sur des noms d'exécutable, jamais sur des octets de contrôle.
      if (c === '$' && command[j + 1] === "'") {
        j += 2
        while (j < n && command[j] !== "'") {
          if (command[j] === '\\' && j + 1 < n) { buf += command[j + 1]; j += 2; continue }
          buf += command[j]; j++
        }
        j++ // saute la quote fermante (si absente — quote non refermée — j a déjà atteint n)
        continue
      }
      if (c === '"' || c === "'") {
        const quote = c
        quoteVue = true
        j++
        while (j < n && command[j] !== quote) {
          // Échappement réel `\"`/`\\` seulement — un backslash de chemin Windows (`C:\Program…`)
          // n'est PAS un échappement shell et reste LITTÉRAL (sinon les chemins perdent leurs
          // séparateurs, cassant la reconnaissance de `git.exe` au bout d'un chemin absolu, #591 suite).
          if (quote === '"' && command[j] === '\\' && j + 1 < n && (command[j + 1] === '"' || command[j + 1] === '\\')) {
            buf += command[j + 1]; j += 2; continue
          }
          buf += command[j]; j++
        }
        j++ // saute la quote fermante (si absente — quote non refermée — j a déjà atteint n)
        continue
      }
      buf += c
      j++
    }
    // Un mot fait UNIQUEMENT de continuations n'est pas un token vide : il n'existe pas. Un vrai
    // argument vide (`''`) en reste un — c'est la quote qui le prouve.
    if (buf !== '' || quoteVue) tokens.push({ text: buf, op: null })
    i = j
  }
  return tokens
}

/** Segments exécutables AVEC l'opérateur qui les enchaîne (`&&`/`;`/`||`/`|`, `null` pour le
 *  dernier). Source unique du découpage : `splitCommandSegments` et `pipelinesProfonds` en dérivent,
 *  le tube n'étant un séparateur QUE pour qui a besoin de le distinguer. */
function segmentsAvecOperateur(command) {
  const segments = []
  let current = []
  for (const tok of tokenizeCommand(command)) {
    if (tok.op) {
      segments.push({ tokens: current, op: tok.op })
      current = []
    } else {
      current.push(tok.text)
    }
  }
  segments.push({ tokens: current, op: null })
  return segments
}

/** Découpe la commande en segments exécutables (aux enchaînements `&&`/`;`/`||`/`|` de premier
 *  niveau — les mêmes marqueurs À L'INTÉRIEUR d'une quote/here-string ont déjà été consommés comme
 *  contenu de token par `tokenizeCommand`, jamais comme séparateur). */
export function splitCommandSegments(command) {
  return segmentsAvecOperateur(command).map((s) => s.tokens).filter((s) => s.length > 0)
}

// ── Enrobeurs : voir DERRIÈRE les sous-shells et les préfixes de tête ───────────────────────────
// Une commande réelle voyage souvent enveloppée : soit passée en ARGUMENT-CHAÎNE à un interpréteur
// (`sh -c "…"`, `powershell -Command "…"`, `eval "…"`), soit précédée d'un PRÉFIXE qui ne fait que
// l'exécuter (`env FOO=1 …`, `timeout 30 …`, `xargs -I{} …`). `segmentsProfonds` rend la liste PLATE
// des segments RÉELLEMENT exécutés, et c'est là que toutes les gardes de commande itèrent. La
// reconnaissance reste STRUCTURELLE de bout en bout : l'argument-chaîne est RE-TOKENISÉ par
// `tokenizeCommand`, jamais grepé (invariant du parseur ci-dessus, #591 défaut 3).
//
// `npm run <x>` est VU : son corps vit dans `package.json`, un fichier LISIBLE que le socle lit
// (même classe que le message `-F <fichier>` d'un commit, lu depuis toujours) — le script est
// re-tokenisé et récursé, si bien qu'un `npm run <x>` porteur d'un `gh issue create` est vu comme
// la création qu'il exécute.
//
// HORS PORTÉE, dit : `node script.mjs` (la commande vit dans un fichier que rien ne désigne comme
// du shell), `$VAR issue create` (l'exécutable vient de l'environnement), `pwsh -File x.ps1`
// (fichier), `bash -c "$(cat …)"` (l'argument est une substitution, inconnue avant exécution), et
// toute imbrication au-delà de `PROFONDEUR_MAX_ENROBEURS` niveaux.

/** Nom d'exécutable d'un token : basename, sans extension `.exe`/`.cmd`, en minuscules. */
export function basenameExecutable(token) {
  return String(token ?? '').replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd)$/i, '').toLowerCase()
}

/** Index d'un paramètre PowerShell nommé dans `args`, cherché par PRÉFIXE NON AMBIGU et insensible à
 *  la casse : `-Command` s'écrit aussi bien `-com`, `-Comm`… — PowerShell accepte tout préfixe
 *  qu'aucun AUTRE paramètre de la commande ne partage. `noms` = tous ses paramètres. `-1` si absent. */
function indexParametre(args, nom, noms = [nom]) {
  const cible = nom.toLowerCase()
  const autres = noms.map((n) => n.toLowerCase()).filter((n) => n !== cible)
  return args.findIndex((a) => {
    if (a[0] !== '-') return false
    const p = a.slice(1).toLowerCase()
    return p !== '' && cible.startsWith(p) && !autres.some((n) => n.startsWith(p))
  })
}

/** Valeur d'un paramètre PowerShell nommé (`''` si absent) — voir `indexParametre`. */
export function valeurParametre(args, nom, noms = [nom]) {
  const i = indexParametre(args, nom, noms)
  return i !== -1 ? (args[i + 1] ?? '') : ''
}

// Paramètres de l'hôte `powershell.exe`/`pwsh` : base d'ambiguïté des préfixes. `-c` y est traité à
// part (`porteurCourt`) — l'hôte le résout en `-Command` bien qu'il préfixe aussi
// `-ConfigurationName`.
const PARAMS_HOTE_POWERSHELL = [
  'Command', 'File', 'EncodedCommand', 'ExecutionPolicy', 'ConfigurationName', 'InputFormat',
  'OutputFormat', 'NoProfile', 'NoLogo', 'NoExit', 'NonInteractive', 'Sta', 'Mta', 'Version',
  'WindowStyle', 'WorkingDirectory',
]

// `-o` (isolé ou en fin de groupe court : `-euo pipefail`) et `--rcfile`/`--init-file` prennent le
// token SUIVANT pour valeur : sans ce saut, `pipefail` passait pour la commande à exécuter.
const FAMILLE_SH = {
  porteurs: ['-c', '-lc'],
  estFlag: (t) => t.startsWith('-'),
  aValeur: (t) => /^-[a-zA-Z]*o$/.test(t) || t === '--rcfile' || t === '--init-file',
}
const FAMILLE_CMD = {
  porteurs: ['/c', '/k'],
  porteurInsensible: true,
  estFlag: (t) => t.startsWith('/'),
  aValeur: () => false,
}
const FAMILLE_POWERSHELL = {
  parametre: 'Command', parametreEncode: 'EncodedCommand', params: PARAMS_HOTE_POWERSHELL, porteurCourt: '-c',
}
const FAMILLE_EVAL = { premierNonFlag: true }
// `npx` est à la fois un enrobeur de TÊTE (`npx gh issue create`) et, avec `-c`/`--call`, un
// interpréteur à argument-chaîne : `epluchageTete` interroge la table A à chaque cran, la forme
// `-c` part donc en récursion au lieu d'être AVALÉE comme la valeur d'un flag (contournement mesuré).
const FAMILLE_NPX = {
  porteurs: ['-c', '--call'],
  estFlag: (t) => t.startsWith('-'),
  aValeur: (t) => t === '-p' || t === '--package',
}

/** Commande portée par un `-EncodedCommand` PowerShell : base64 d'UTF-16LE (contrat de l'hôte).
 *  `null` si absente ou indécodable — un hook ne lève jamais. */
function decodeCommandeEncodee(valeur) {
  if (!valeur) return null
  try { return Buffer.from(valeur, 'base64').toString('utf16le') || null } catch { return null }
}

/** Enrobeurs à ARGUMENT-CHAÎNE : l'exécutable reçoit la commande réelle comme UNE chaîne. Ajouter un
 *  interpréteur = une ligne de plus ici, jamais un chemin de reconnaissance parallèle. */
const ENROBEURS_ARGUMENT = new Map([
  ['sh', FAMILLE_SH], ['bash', FAMILLE_SH], ['dash', FAMILLE_SH], ['zsh', FAMILLE_SH],
  ['powershell', FAMILLE_POWERSHELL], ['pwsh', FAMILLE_POWERSHELL],
  ['cmd', FAMILLE_CMD],
  ['eval', FAMILLE_EVAL], ['invoke-expression', FAMILLE_EVAL],
  ['npx', FAMILLE_NPX],
])

/** Argument-chaîne porté par ce segment (la commande à ré-analyser), ou `null`. Le flag porteur est
 *  cherché PARMI LES FLAGS DE TÊTE, jamais à une position fixe : `bash -euo pipefail -c "…"`,
 *  `sh -ex -c "…"`, `powershell -NoProfile -Command "…"` sont des formes courantes. */
function argumentChaine(segment) {
  const famille = ENROBEURS_ARGUMENT.get(basenameExecutable(segment[0]))
  if (!famille) return null
  const args = segment.slice(1)
  if (famille.premierNonFlag) return args.find((a) => !a.startsWith('-')) ?? null
  if (famille.parametre) {
    const court = args.findIndex((a) => a.toLowerCase() === famille.porteurCourt)
    const i = court !== -1 ? court : indexParametre(args, famille.parametre, famille.params)
    if (i !== -1) return args[i + 1] ?? null
    const encode = indexParametre(args, famille.parametreEncode, famille.params)
    return encode !== -1 ? decodeCommandeEncodee(args[encode + 1]) : null
  }
  const memeFlag = famille.porteurInsensible
    ? (a, b) => a.toLowerCase() === b.toLowerCase()
    : (a, b) => a === b
  for (let k = 0; k < args.length && famille.estFlag(args[k]); k++) {
    if (famille.porteurs.some((f) => memeFlag(f, args[k]))) return args[k + 1] ?? null
    if (famille.aValeur(args[k])) k += 1
  }
  return null
}

/** Enrobeurs de TÊTE : préfixes qui ne font qu'exécuter la suite de la ligne. `flags` = les flags à
 *  VALEUR SÉPARÉE de cet enrobeur (les autres flags sont sautés seuls ; sans clef `flags`, aucun flag
 *  n'est sauté — `command -v git` n'exécute rien) ; `affectations` = `VAR=val` admis parmi eux ;
 *  `positionnels` = arguments propres avant la commande (la durée de `timeout`). */
const ENROBEURS_TETE = new Map([
  ['env', { flags: ['-u', '--unset'], affectations: true }],
  ['nohup', {}],
  ['command', {}],
  ['winpty', {}],
  ['time', {}],
  ['npx', { flags: ['-p', '--package'] }],
  ['sudo', { flags: ['-u', '--user', '-g', '--group', '-p', '--prompt'] }],
  ['setsid', { flags: [] }],
  ['timeout', { flags: ['-k', '--kill-after', '-s', '--signal'], positionnels: 1 }],
  ['xargs', { flags: ['-I', '-i', '-n', '-P', '-d', '-E', '-e', '-s', '-a', '-L'] }],
  ['stdbuf', { flags: ['-i', '-o', '-e', '--input', '--output', '--error'] }],
  ['nice', { flags: ['-n', '--adjustment'] }],
])

/** Tokens de tête sans exécutable propre : call-operator PowerShell et accolades de bloc `& { … }`. */
const TOKENS_TETE_NUS = new Set(['&', '{', '}'])
const AFFECTATION_RE = /^[A-Za-z_][A-Za-z0-9_]*=/

/** Segment débarrassé de ses enrobeurs de TÊTE, épluchés jusqu'à stabilité (`nohup env FOO=1 git …`).
 *  `[]` si le segment n'est fait que d'enrobeurs. */
function epluchageTete(segment) {
  let i = 0
  for (;;) {
    const t = segment[i]
    if (t === undefined) return []
    if (TOKENS_TETE_NUS.has(t) || AFFECTATION_RE.test(t)) { i += 1; continue }
    // Un enrobeur qui porte ICI un argument-chaîne rend la main : la récursion le déploiera.
    if (argumentChaine(segment.slice(i)) !== null) return segment.slice(i)
    const enrobeur = ENROBEURS_TETE.get(basenameExecutable(t))
    if (!enrobeur) return segment.slice(i)
    i += 1
    if (enrobeur.flags) {
      while (i < segment.length && (segment[i].startsWith('-') || (enrobeur.affectations && AFFECTATION_RE.test(segment[i])))) {
        i += enrobeur.flags.includes(segment[i]) ? 2 : 1
      }
    }
    i += enrobeur.positionnels ?? 0
  }
}

// Une commande réelle dépasse rarement deux niveaux ; au-delà de quatre, l'analyse s'arrête et la
// commande PASSE (borne dite, préférée à une récursion non bornée dans un hook).
const PROFONDEUR_MAX_ENROBEURS = 4

// ── `npm run <x>` : le corps du script est LU dans package.json ─────────────────────────────────
// Sous-commandes de `npm` qui lancent un script : `run`/`run-script` nomment leur script, les
// quatre raccourcis portent leur nom pour nom (`npm test` lance `scripts.test`).
const SOUS_COMMANDES_RUN = ['run', 'run-script']
const RACCOURCIS_NPM = ['test', 'start', 'stop', 'restart']

// Dépôt où `npm run <x>` se résout quand l'appelant ne le dit pas. Un driver de hook l'ANCRE sur le
// répertoire où la commande s'exécute réellement (`extractTargetDir`) : sans cet ancrage, un
// `cd <autre dépôt> && npm run x` serait lu dans le dépôt du HOOK. À défaut, le dépôt du hook.
let racineScriptsNpm = null

/** Ancre le dépôt de résolution des scripts npm pour ce processus (drivers de hook). */
export function ancrerScriptsNpm(dir) {
  racineScriptsNpm = dir || null
}

/** Table `scripts` du `package.json` de `dir` (`{}` s'il est absent ou illisible — un hook ne lève
 *  jamais). Lue une fois par répertoire : un hook décide en quelques millisecondes. */
const CACHE_SCRIPTS = new Map()
export function scriptsNpm(dir = racineScriptsNpm ?? repoRoot()) {
  const clef = resolve(dir)
  if (!CACHE_SCRIPTS.has(clef)) {
    let table = {}
    try {
      const pkg = JSON.parse(readFileSync(join(clef, 'package.json'), 'utf8'))
      table = Object.fromEntries(Object.entries(pkg?.scripts ?? {}).filter(([, v]) => typeof v === 'string'))
    } catch { /* pas de package.json lisible → aucun script résolu */ }
    CACHE_SCRIPTS.set(clef, table)
  }
  return CACHE_SCRIPTS.get(clef)
}

/** Commande RÉELLE d'un segment `npm run <x>` (script résolu dans `scripts`, arguments de la ligne
 *  recollés derrière lui comme npm le fait), ou `null` si le segment ne lance aucun script connu. */
export function commandeScriptNpm(segment, scripts) {
  const start = segment[0] === '&' ? 1 : 0
  if (basenameExecutable(segment[start] ?? '') !== 'npm') return null
  // Les flags PROPRES à npm (`--silent`, `-s`…) précèdent aussi bien la sous-commande que le nom du
  // script : ils se sautent aux deux crans. `--` n'en est pas un — il OUVRE les arguments du script.
  const apresFlags = (i) => {
    while (segment[i] !== undefined && segment[i].startsWith('-') && segment[i] !== '--') i += 1
    return i
  }
  const iSub = apresFlags(start + 1)
  const sub = segment[iSub]
  const iNom = SOUS_COMMANDES_RUN.includes(sub) ? apresFlags(iSub + 1) : iSub
  const nom = SOUS_COMMANDES_RUN.includes(sub) ? segment[iNom] : (RACCOURCIS_NPM.includes(sub) ? sub : undefined)
  const corps = nom === undefined ? undefined : scripts?.[nom]
  if (typeof corps !== 'string') return null
  // npm colle les arguments de la ligne derrière le script, `--` retiré (il n'est qu'un séparateur).
  const suite = segment.slice(iNom + 1).filter((t) => t !== '--')
  return suite.length > 0 ? `${corps} ${suite.join(' ')}` : corps
}

/** Liste ordonnée des PIPELINES réellement exécutés : un pipeline = les segments qu'un `|` relie,
 *  donc ceux dont les sorties/entrées se CHAÎNENT (les enchaînements `&&`/`;`/`||` en ouvrent un
 *  nouveau). Les enrobeurs de tête sont épluchés, et l'ARGUMENT-CHAÎNE d'un interpréteur est
 *  re-tokenisé : les pipelines qu'il porte sont rendus À PART (ceux d'un `sh -c "a | b"` ne se
 *  mêlent pas au pipeline hôte), avant le pipeline enrobant. `segmentsProfonds` en est l'APLATI :
 *  une garde qui n'a pas besoin du tube ignore ce groupement. */
export function pipelinesProfonds(command, profondeur = 0, { scripts = scriptsNpm() } = {}) {
  const pipelines = []
  if (!command || profondeur > PROFONDEUR_MAX_ENROBEURS) return pipelines
  let courant = []
  for (const { tokens, op } of segmentsAvecOperateur(command)) {
    const segment = epluchageTete(tokens)
    if (segment.length > 0) {
      const inner = argumentChaine(segment) ?? commandeScriptNpm(segment, scripts)
      if (inner !== null) pipelines.push(...pipelinesProfonds(inner, profondeur + 1, { scripts }))
      courant.push(segment)
    }
    if (op !== '|' && courant.length > 0) {
      pipelines.push(courant)
      courant = []
    }
  }
  if (courant.length > 0) pipelines.push(courant)
  return pipelines
}

/** Liste PLATE des segments RÉELLEMENT exécutés par la commande — l'aplati de `pipelinesProfonds`,
 *  dans le même ordre (un segment enrobé précède son enrobeur : `cmd /c mklink …` n'a pas
 *  d'argument-chaîne unique, l'invocation vit sur ses arguments recollés — `commande-piege-guard`).
 *  `profondeur` = niveau d'imbrication de départ, borné par `PROFONDEUR_MAX_ENROBEURS`. */
export function segmentsProfonds(command, profondeur = 0, options) {
  return pipelinesProfonds(command, profondeur, options).flat()
}

const GLOBAL_VALUE_FLAGS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'])

/** Index de la SOUS-COMMANDE git dans un segment (`[&] git [flags globales] <sub>`), `-1` si le
 *  segment n'exécute pas `git`. Un token `&` de tête (call-operator PowerShell :
 *  `& "C:\Program Files\Git\git.exe" commit …`) est sauté — le contrôle d'exécutable porte alors
 *  sur le BASENAME (sans extension `.exe`/`.cmd`, insensible à la casse). Invariant PARTAGÉ avec
 *  `commande-piege-guard` : « quel git, quelle sous-commande » ne se réécrit pas par garde. */
export function gitSubcommandIndex(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return -1
  if (basenameExecutable(segment[start]) !== 'git') return -1
  let idx = start + 1
  while (idx < segment.length) {
    const t = segment[idx]
    if (t.startsWith('-')) {
      if (GLOBAL_VALUE_FLAGS.has(t)) { idx += 2; continue }
      idx += 1
      continue
    }
    break
  }
  return idx < segment.length ? idx : -1
}

/** Sous-commande git d'un segment et ses arguments : `{ sub, args }`, ou `null` si le segment
 *  n'exécute pas `git`. */
export function gitSubcommand(segment) {
  const idx = gitSubcommandIndex(segment)
  if (idx === -1) return null
  return { sub: segment[idx], args: segment.slice(idx + 1) }
}

/** Index du token `commit` (spécialisation de `gitSubcommandIndex`), `-1` si la sous-commande
 *  exécutée n'est pas `commit`. */
function gitCommitSubcommandIndex(segment) {
  const idx = gitSubcommandIndex(segment)
  return idx !== -1 && segment[idx] === 'commit' ? idx : -1
}

/** `true` si la commande exécute STRUCTURELLEMENT un `git commit` (un segment PROFOND quelconque :
 *  enchaînements, enrobeurs de tête, sous-shells) — jamais un grep de sous-chaîne sur la ligne
 *  entière (#591 défaut 3). */
export function isGitCommitCommand(command) {
  if (!command) return false
  return segmentsProfonds(command).some((segment) => gitCommitSubcommandIndex(segment) !== -1)
}

// Longs à valeur SÉPARÉE (`--message truc`, `-c truc`) : le token suivant est la valeur, jamais un
// pathspec. `-c` reste un flag SIMPLE (config `clé=valeur`) — hors du regroupement court m/F ci-dessous.
const COMMIT_VALUE_FLAGS = new Set([
  '-c', '--author', '--date', '--template', '--fixup', '--squash', '--trailer',
  '--reuse-message', '--reedit-message', '--message', '--file',
])
// Longs à valeur COLLÉE par `=` (`--message=texte`, `--file=chemin`) : la valeur est DÉJÀ dans le
// token, rien à consommer ensuite — et elle n'est jamais elle-même un pathspec.
const LONG_VALUE_FLAG_EQ_RE = /^--(message|file|author|date|template|fixup|squash|trailer|reuse-message|reedit-message)=/
// Shorts POSIX groupés (`-am`, `-cam`, `-sm`…) : `git` accepte l'empilement d'options courtes
// booléennes suivies d'UNE option à valeur — `m` (message) et `F` (file) sont les deux lettres
// courtes à valeur de `git commit`. Capture (flags avant, lettre m/F, RÉSIDU) : résidu vide → la
// valeur est le token SUIVANT (`-am "msg"`) ; résidu non vide → la valeur est GLUÉE au token lui-même
// (`-m"a b c"` tokenisé en un seul token `-ma b c` par `tokenizeCommand` — rien à consommer ensuite).
// Sans cette reconnaissance, le MESSAGE (ou ses mots, avant la fusion de tokenisation) se prenait
// pour un pathspec — le filtrage src/ui retombait à néant, JUGE/anti-esquive restaient muets (#591).
// Le groupe des flags booléens EXCLUT `m` et `F` : c'est le PREMIER des deux qui décide, comme dans
// git. Sur `-mF`, un groupe gourmand lisait `-m` comme booléen et `F` comme drapeau FICHIER, donc
// consommait le token suivant en pathspec — là où git lit un message valant « F » et ne consomme rien.
const SHORT_VALUE_FLAG_RE = /^-([a-ln-zA-EG-Z]*)([mF])(.*)$/

/** Token de REDIRECTION ou d'OPÉRATEUR de shell (`2>&1`, `>`, `>>`, `2>/dev/null`, `<`, `|`, `&&`,
 *  `;`) : à partir de lui, le segment ne parle plus à `git`, et rien de ce qui suit n'est un
 *  pathspec. Sans cette borne, `git commit -F msg.txt 2>&1 | tail -3` faisait de `2>&1` un pathspec :
 *  `analyzeStagedDiff` filtrait sur un chemin inexistant et déclarait ABSENT du diff tout fichier
 *  cité par le solde (mesuré 2026-09-04 sur un vrai commit de fermeture depuis un worktree). */
const OPERATEUR_SHELL_RE = /^(?:\d*(?:>>?|>&)|&(?![&>])|&>>?|<<?|\|\|?|&&|;)/

/** Glob non résolu (`*`, `?`, `[`) : la garde ne réimplémente pas le matching de pathspec de git —
 *  un pathspec-glob présent invalide le SCOPING ENTIER de la commande (retombe sur l'index complet,
 *  jamais un silence par filtrage résolu à tort en « aucun fichier »). */
const PATHSPEC_GLOB_RE = /[*?[]/

/**
 * Jetons d'un `git commit`, séparés en OPTIONS (valeurs de flags exclues) et CHEMINS positionnels —
 * `null` si la commande n'exécute pas de `git commit`. UN SEUL parcours pour les deux lectures : les
 * pathspecs et la présence de `-a` se décident sur la MÊME grammaire. Séparées, un `-m"ajoute…"`
 * (valeur GLUÉE au flag court) passait pour un `-a` — la valeur d'un `-m` n'est pas une liste
 * d'options courtes, et la forme du commit en basculait de `index` à `tout` (mesuré 2026-09-04).
 */
function jetonsDuCommit(command) {
  for (const segment of segmentsProfonds(command)) {
    const subIdx = gitCommitSubcommandIndex(segment)
    if (subIdx === -1) continue
    const options = []
    const chemins = []
    for (let k = subIdx + 1; k < segment.length; k++) {
      const t = segment[k]
      if (OPERATEUR_SHELL_RE.test(t)) break
      if (t === '--') continue
      if (t.startsWith('--')) {
        options.push(t.split('=')[0])
        if (LONG_VALUE_FLAG_EQ_RE.test(t)) continue // valeur collée par `=` : rien à consommer
        if (COMMIT_VALUE_FLAGS.has(t)) k += 1 // valeur séparée (token suivant)
        continue
      }
      if (t.startsWith('-')) {
        if (COMMIT_VALUE_FLAGS.has(t)) { options.push(t); k += 1; continue } // `-c` : valeur séparée
        const m = SHORT_VALUE_FLAG_RE.exec(t)
        if (m) {
          // Les lettres AVANT `m`/`F` sont les options ; le RÉSIDU est la valeur, jamais une option.
          options.push(`-${m[1]}${m[2]}`)
          if (m[3] === '') k += 1 // résidu vide : valeur SÉPARÉE (token suivant)
          continue
        }
        options.push(t)
        continue
      }
      chemins.push(t)
    }
    return { options, chemins }
  }
  return null
}

/**
 * Pathspecs portés par un `git commit`, extraits de sa STRUCTURE : tout token qui n'est ni un flag
 * connu ni la valeur d'un flag qui en attend une est un chemin — qu'il précède ou suive le
 * séparateur `--`. `nonResolus` distingue les DEUX silences que la seule liste vide confondait :
 * « la commande ne nomme aucun chemin » et « elle en nomme, mais avec un joker que cette garde ne
 * résout pas » (`*`, `?`, `[`, magie `:(glob)`). L'appelant DOIT les traiter différemment : un
 * pathspec non résolu commite quand même l'ARBRE DE TRAVAIL, et le prendre pour « aucun chemin »
 * faisait lire l'index — vide — pendant que git emportait la croissance (mesuré 2026-09-04).
 * @returns {{ chemins: string[], nonResolus: boolean }}
 */
export function pathspecsDuCommit(command) {
  const jetons = command ? jetonsDuCommit(command) : null
  if (!jetons) return { chemins: [], nonResolus: false }
  const nonResolus = jetons.chemins.some((p) => PATHSPEC_GLOB_RE.test(p))
  return { chemins: nonResolus ? [] : jetons.chemins, nonResolus }
}

/** Les seuls pathspecs RÉSOLUS (`[]` quand il n'y en a pas, ou qu'un joker les rend inutilisables). */
export function extractCommitPathspecs(command) {
  return pathspecsDuCommit(command).chemins
}

// La grammaire de fermeture est celle de `scripts/guards/lib/fermetures.mjs` ; ce qui est propre à la
// porte est le TEXTE où elle se lit : la commande ENTIÈRE (couvre les here-strings/heredocs
// `git commit -m "$(cat <<EOF ... EOF)"` où le message est packé dans la commande shell elle-même,
// ET le texte étendu par `extractMessageSources` quand le message est passé par `-F`).

/** Texte où chercher les mots-clefs : la commande TELLE QU'ÉCRITE, plus ses segments profonds
 *  recomposés — un message qui n'apparaît qu'après déroulage (`-EncodedCommand` en base64) resterait
 *  sinon invisible alors que le `git commit` qu'il porte est, lui, reconnu. */
function texteProfond(command) {
  return [command, ...segmentsProfonds(command).map((s) => s.join(' '))].join('\n')
}

/** Numéros de ticket que la commande FERME, dédupliqués/triés. `[]` si la commande n'est pas un
 *  `git commit`, ou si aucun mot-clef de fermeture n'apparaît. */
export function extractClosedIssues(command) {
  if (!command || !isGitCommitCommand(command)) return []
  return numerosFermes(texteProfond(command)).map(Number).sort((a, b) => a - b)
}

const VERIFIE_RE = /VERIFIE\s*:\s*(.+)/i
const MIN_VERIFIE_LEN = 40
// Une section d'un solde court de son titre de niveau 2 jusqu'au PROCHAIN titre de niveau 2, ou la
// fin du fichier : une ligne VIDE n'y termine rien, et les sous-titres `###` en font partie. Borne
// unique des trois sections (« Restes », « Recette visuelle », « Réfutation ») — la borne à la
// première ligne blanche rendait 1 reste vu pour 5 réels dès qu'une liste était aérée, et cachait la
// grammaire de tout ce qui suivait le blanc (sonde D1 : 4 dispositions invalides sur 5 acceptées).
const TITRE_RESTES = 'Restes'
const TITRE_RECETTE_VISUELLE = 'Recette visuelle'
const TITRE_REFUTATION = 'R[ée]futation'

/** Corps de la section `## <titre>` d'un solde (`null` si elle est absente). `titre` est un motif
 *  d'expression régulière : le titre s'écrit avec ou sans accents selon la section. */
export function sectionDe(content, titre) {
  // Sans le drapeau `m`, `$` est la fin du TEXTE : avec lui, il vaudrait fin de chaque ligne et la
  // section s'arrêterait à la première. Le titre se reconnaît donc en tête de ligne par `(?:^|\n)`.
  const m = new RegExp(`(?:^|\\n)##\\s*${titre}\\s*\\n([\\s\\S]*?)(?=\\n##[^#]|$)`, 'i').exec(String(content ?? ''))
  return m ? m[1] : null
}

/** Nombre de fois que le titre `## <titre>` apparaît dans le document. Une section DUPLIQUÉE n'est pas
 *  une section plus longue : `sectionDe` rend la PREMIÈRE, et tout ce que porte la seconde échappe au
 *  plafond comme à la grammaire — elle se refuse, elle ne se devine pas. */
export function compteSections(content, titre) {
  return String(content ?? '').match(new RegExp(`(?:^|\\n)##\\s*${titre}\\s*\\n`, 'gi'))?.length ?? 0
}
// Cinq dispositions, et cinq seulement.
//   `#N`                                   le reste ÉMET un ticket (plafonné, voir ci-dessous) ;
//   `corrigé dans ce commit <f>:<l>`       la correction part AVEC le solde ;
//   `corrigé par <sha> <f>:<l>`            la correction est DÉJÀ dans l'histoire (un solde écrit
//                                          après coup ne peut pas dire « ce commit » sans mentir) ;
//   `RAS : <justification>`                rien à router ;
//   `inventaire #<épic> : <état>`          écart PORTÉ à un programme (aucun ticket neuf émis).
const DISPOSITION_RE = /^-\s*.+->\s*(#\d+|corrigé dans ce commit\b.*|corrigé par\s+[0-9a-f]{7,40}\s+\S+:\d+|RAS\s*:\s*\S.*|inventaire\s+#\d+\s*:\s*\S.*)\s*$/iu
// Le plafond compte les tickets ÉMIS : un item qui route vers `#N` en compte un, que la ligne soit
// bien formée ou non (une queue de prose derrière le numéro est refusée à part, par la grammaire).
const ROUTANT_RE = /->\s*#\d+/
const CORRIGE_RE = /->\s*corrigé dans ce commit\b(.*)$/iu
const CORRIGE_PAR_RE = /->\s*corrigé par\s+([0-9a-f]{7,40})\s+(\S+):(\d+)\s*$/iu
const INVENTAIRE_RE = /->\s*inventaire\s+#(\d+)\s*:\s*(\S.*)$/iu
// `fichier.ext:ligne` — le point d'extension distingue un chemin d'une prose à deux-points.
const REF_SITE_RE = /([A-Za-z0-9_@./\\-]+\.[A-Za-z0-9]+):(\d+)/g
// Skill orchestrer § Fermeture (audit 2026-08-30) : « une fermeture qui émettrait PLUS D'UN ticket
// de reste n'est PAS fermable : soit le lot GROSSIT pour absorber le reste, soit le ticket RESTE
// OUVERT avec la formule historique des soldes #829/#900 ».
const MAX_RESTES_ROUTANTS = 1
const MIN_ETAT_INVENTAIRE = 20
// Recette visuelle : la capture vit sous `public/qc/` (convention de `scripts/qc/capture-jeu.mjs`).
const CAPTURE_RE = /capture\s*:\s*(\S+)/i
const DOSSIER_CAPTURES = 'public/qc/'
const ENTETE_PNG = [0x89, 0x50, 0x4e, 0x47]
const ENTETE_JPEG = [0xff, 0xd8, 0xff]
// Une capture d'écran de jeu pèse des dizaines de Kio ; 1 Kio est le plancher sous lequel il n'y a
// pas d'image, et 200 px la plus petite dimension dont on puisse JUGER quoi que ce soit.
const TAILLE_MIN_CAPTURE = 1024
const COTE_MIN_CAPTURE = 200
const VERDICT_RE = /verdict\s*:\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i
const MIN_REFUTATION_LEN = 40
const PALIER = 10
const MIN_REVUE_PALIER_LEN = 80

/** `CONFIRMÉ`/`confirme`/`CONFIRME` → `CONFIRME` (compare sans accent, insensible à la casse). */
function normalizeVerdict(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/** Longueur de texte hors la ligne `verdict: …` elle-même (mesure la SYNTHÈSE, pas le mot-clef). */
function lenWithoutVerdictLine(text) {
  return text.replace(VERDICT_RE, '').trim().length
}

/** Section `## Réfutation` d'un solde : présence, verdict reconnu, longueur de synthèse.
 *  `refuted: true` si le verdict est RÉFUTÉ — porte alors sa propre entrée dans `problems`
 *  (« un ticket réfuté ne se ferme pas »), le solde est TOUJOURS non conforme dans ce cas. */
function checkRefutationSection(content) {
  const problems = []
  const body = sectionDe(content, TITRE_REFUTATION)
  if (body === null) {
    problems.push('section "## Réfutation" absente (verdict adversarial obligatoire)')
    return { problems, refuted: false }
  }
  const vMatch = VERDICT_RE.exec(body)
  if (!vMatch) {
    problems.push('ligne "verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ" absente dans "## Réfutation"')
    return { problems, refuted: false }
  }
  const verdict = normalizeVerdict(vMatch[1])
  if (!['CONFIRME', 'PARTIEL', 'REFUTE'].includes(verdict)) {
    problems.push(`verdict "${vMatch[1]}" non reconnu dans "## Réfutation" (attendu CONFIRMÉ/PARTIEL/RÉFUTÉ)`)
    return { problems, refuted: false }
  }
  const descLen = lenWithoutVerdictLine(body)
  if (descLen < MIN_REFUTATION_LEN) {
    problems.push(`"## Réfutation" trop maigre (${descLen} car. hors verdict, ${MIN_REFUTATION_LEN} requis — qui a attaqué quoi, sur le diff/DoD du ticket)`)
  }
  const refuted = verdict === 'REFUTE'
  if (refuted) problems.push('verdict RÉFUTÉ : un ticket réfuté ne se ferme pas')
  return { problems, refuted }
}

/** Items de la section « ## Restes » d'un solde, un par ligne (`[]` si la section est absente ou
 *  vaut « RAS » pour le tout). Point d'entrée UNIQUE des mesures de stock et du garde. */
export function restesItems(content) {
  const body = sectionDe(content, TITRE_RESTES)
  if (body === null) return []
  const lignes = lignesUtiles(body)
  return estRAS(lignes) ? [] : lignes
}

/** Lignes PORTEUSES d'une section : un sous-titre la STRUCTURE (il n'en est pas un item) et une ligne
 *  vide ne fait que séparer. */
function lignesUtiles(section) {
  return section.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
}

/** « RAS » pour le TOUT : le seul contenu de la section est ce mot. */
function estRAS(lignes) {
  return lignes.length === 1 && lignes[0] === 'RAS'
}

/** Items ROUTANTS (`-> #N`) : ceux qui émettent un ticket de reste. */
export function restesRoutants(content) {
  return restesItems(content).filter((l) => ROUTANT_RE.test(l))
}

/** Lignes RECEVABLES comme site d'une correction dans un diff unifié à zéro contexte
 *  (`git diff --cached -U0 -- <fichier>`) : les lignes du côté DESTINATION (`+a,b`, du code ajouté
 *  ou modifié) ET celles du côté SOURCE (`-a,b`). Le côté source compte parce qu'une correction est
 *  souvent une SUPPRESSION (le geste « chemin mort retiré » n'ajoute rien) : sans lui, prouver la
 *  correction à son site était impossible pour toute une classe de gestes. */
export function lignesDeHunks(diffU0) {
  const lignes = new Set()
  for (const { a, b, c, d } of hunksDe(diffU0)) {
    for (const [debut, n] of [[a, b], [c, d]]) for (let k = 0; k < n; k++) lignes.add(debut + k)
  }
  return [...lignes].sort((a, b) => a - b)
}

/**
 * Contrôle d'une capture de recette visuelle : sous `public/qc/`, présente, d'un poids d'image, PNG
 * ou JPEG à ses octets de tête, aux dimensions lisibles (PNG : l'en-tête IHDR porte largeur et
 * hauteur), non IGNORÉE par git, et pas plus ANCIENNE que le dernier fichier d'écran stagé
 * (`mtimeMin`, millisecondes). `racine` = arbre où le chemin se résout.
 *
 * CE QUE CETTE PORTE PROUVE : qu'une image d'écran plausible existe et vient d'être produite —
 * garde-fou d'ÉTOURDERIE (chemin périmé, fichier vide, capture d'avant le geste), PAS de
 * CONTREFAÇON. Rien ici ne dit que l'image montre l'écran modifié : c'est la recette qui le juge.
 */
export function verifierCapture(chemin, { racine = process.cwd(), mtimeMin = 0 } = {}) {
  const problemes = []
  const norm = String(chemin ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!norm.startsWith(DOSSIER_CAPTURES)) {
    problemes.push(`capture "${chemin}" hors de ${DOSSIER_CAPTURES} (les captures de recette y vivent, cf. scripts/qc/capture-jeu.mjs)`)
    return { ok: false, problemes }
  }
  // Une capture qu'un `.gitignore` retient ne part PAS avec le commit : le palier suivant lit un
  // solde qui cite une preuve inouvrable. Le refus vient AVANT la lecture du disque — exister sur la
  // machine du geste ne la rend pas opposable. Hors dépôt, la porte ne juge que le disque : le banc
  // de `verifierCapture` travaille hors git.
  const ignore = lireGit(['check-ignore', '-q', '--no-index', norm], { cwd: racine })
  if (ignore.disponible && !ignore.absent && ignore.valeur.status === 0) {
    problemes.push(`capture "${norm}" IGNORÉE par git (.gitignore) — un solde ne cite qu'une preuve versionnée : la poser sous public/qc/soldes/`)
    return { ok: false, problemes }
  }
  let info
  let octets
  try {
    const abs = join(racine, norm)
    info = statSync(abs)
    octets = readFileSync(abs)
  } catch {
    problemes.push(`capture "${norm}" introuvable sur le disque`)
    return { ok: false, problemes }
  }
  const estPng = ENTETE_PNG.every((b, i) => octets[i] === b)
  const estJpeg = ENTETE_JPEG.every((b, i) => octets[i] === b)
  if (!estPng && !estJpeg) {
    problemes.push(`capture "${norm}" n'est ni un PNG ni un JPEG à ses octets de tête`)
    return { ok: false, problemes }
  }
  if (info.size < TAILLE_MIN_CAPTURE) {
    problemes.push(`capture "${norm}" trop légère (${info.size} octets, ${TAILLE_MIN_CAPTURE} minimum) — un en-tête d'image n'est pas une capture`)
  }
  if (estPng) {
    // En-tête IHDR : largeur à l'octet 16, hauteur à l'octet 20. Un fichier plus court que ça n'a pas
    // d'en-tête du tout — dimensions nulles, refus (un hook ne lève jamais).
    const largeur = octets.length >= 24 ? octets.readUInt32BE(16) : 0
    const hauteur = octets.length >= 24 ? octets.readUInt32BE(20) : 0
    if (largeur < COTE_MIN_CAPTURE || hauteur < COTE_MIN_CAPTURE) {
      problemes.push(`capture "${norm}" trop petite (${largeur}×${hauteur} px, ${COTE_MIN_CAPTURE} minimum par côté) — rien n'y est jugeable`)
    }
  }
  if (mtimeMin && info.mtimeMs < mtimeMin) {
    problemes.push(`capture "${norm}" plus ANCIENNE que le dernier fichier d'écran stagé — recapturer APRÈS le geste`)
  }
  return { ok: problemes.length === 0, problemes }
}

/** Section « ## Restes » : grammaire des dispositions, plafond de restes routants, preuve au site
 *  des corrections, garde de l'inventaire. Voir `validateSolde` pour le contexte injecté. */
function checkRestesSection(content, ctx) {
  const problems = []
  const section = sectionDe(content, TITRE_RESTES)
  if (section === null) {
    problems.push('section "## Restes" absente')
    return problems
  }
  const occurrences = compteSections(content, TITRE_RESTES)
  if (occurrences > 1) {
    problems.push(`section "## Restes" DUPLIQUÉE (${occurrences} fois) : seule la PREMIÈRE est lue — les items des suivantes échappent au plafond et à la grammaire. Fusionner en une seule section.`)
    return problems
  }

  if (estRAS(lignesUtiles(section))) return problems

  const lines = restesItems(content)
  if (lines.length === 0) {
    problems.push('section "## Restes" vide (attendu "RAS" ou des items "- <reste> -> <disposition>")')
    return problems
  }

  const routants = lines.filter((l) => ROUTANT_RE.test(l))
  if (routants.length > MAX_RESTES_ROUTANTS) {
    problems.push(
      `${routants.length} restes ROUTÉS vers un ticket neuf (plafond ${MAX_RESTES_ROUTANTS}) : le ticket reste ouvert ` +
      `sur ce reste — soit le lot GROSSIT pour absorber les restes, soit la fermeture attend (skill orchestrer ` +
      `§ Fermeture ; formule historique des soldes #829/#900)`,
    )
  }

  for (const [i, line] of lines.entries()) {
    if (!DISPOSITION_RE.test(line)) {
      problems.push(`item sans disposition valide dans "## Restes" (ligne ${i + 1} du bloc) : "${line}" — attendu "-> #N" / "-> corrigé dans ce commit (<fichier>:<ligne>)" / "-> corrigé par <sha> <fichier>:<ligne>" / "-> RAS : <justification>" / "-> inventaire #<épic> : <état>"`)
      continue
    }
    const corrige = CORRIGE_RE.exec(line)
    if (corrige) problems.push(...problemesCorrige(corrige[1], i + 1, ctx))
    const corrigePar = CORRIGE_PAR_RE.exec(line)
    if (corrigePar) problems.push(...problemesCorrigePar(corrigePar, i + 1, ctx))
    const inventaire = INVENTAIRE_RE.exec(line)
    if (inventaire) problems.push(...problemesInventaire(inventaire, i + 1, ctx))
  }
  return problems
}

/** « -> corrigé dans ce commit » : la correction se PROUVE à son site (`fichier:ligne`), le fichier
 *  doit être dans le diff STAGÉ et la ligne dans un de ses hunks. Les contrôles dont le contexte
 *  n'est pas fourni (appel PUR) ne se jouent pas — la grammaire, elle, est toujours exigée. */
function problemesCorrige(queue, rang, { fichiersEmportes, lignesEmportees }) {
  const problems = []
  const refs = [...String(queue).matchAll(REF_SITE_RE)]
    .map((m) => ({ fichier: m[1].replace(/\\/g, '/'), ligne: Number(m[2]) }))
  if (refs.length === 0) {
    problems.push(`item "corrigé dans ce commit" sans référence <fichier>:<ligne> (ligne ${rang} du bloc) — une correction annoncée se prouve à son site`)
    return problems
  }
  for (const ref of refs) {
    if (fichiersEmportes && !fichiersEmportes.some((f) => f.replace(/\\/g, '/') === ref.fichier)) {
      problems.push(`"corrigé dans ce commit" (ligne ${rang} du bloc) cite ${ref.fichier}, ABSENT de ce que ce commit emporte`)
      continue
    }
    if (!lignesEmportees) continue
    const lignes = lignesEmportees(ref.fichier)
    if (lignes && !lignes.includes(ref.ligne)) {
      problems.push(`"corrigé dans ce commit" (ligne ${rang} du bloc) cite ${ref.fichier}:${ref.ligne}, hors des lignes que ce commit modifie`)
    }
  }
  return problems
}

/** « -> corrigé par <sha> <fichier>:<ligne> » : la correction est DÉJÀ dans l'histoire. Trois faits se
 *  vérifient contre git, jamais sur parole : le commit cité est un ANCÊTRE de HEAD (il est bien dans
 *  cette histoire), il TOUCHE le fichier cité, et la LIGNE citée est dans un de ses hunks — la même
 *  preuve au site que « corrigé dans ce commit » exige, sans quoi « :999999 » passait. Cas fondateur :
 *  `.claude/soldes/584.md:7` — le fix vit dans 4d6e1ff78, le solde dans 8a2807134, aucune des autres
 *  dispositions ne le dit sans mentir. Un commit dont le diff de ce fichier est VIDE (fusion sans
 *  changement propre) ne tranche rien : la ligne n'y est pas jugée. Contrôles non fournis (appel PUR)
 *  = non joués ; la grammaire, elle, est toujours exigée. */
function problemesCorrigePar([, sha, fichier, ligne], rang, { commitEstAncetre, fichiersDuCommit, lignesDuCommit }) {
  const problems = []
  const cite = fichier.replace(/\\/g, '/')
  if (commitEstAncetre && commitEstAncetre(sha) !== true) {
    problems.push(`"corrigé par ${sha}" (ligne ${rang} du bloc) cite un commit qui n'est pas un ANCÊTRE de HEAD — la correction annoncée n'est pas dans cette histoire`)
    return problems
  }
  if (fichiersDuCommit) {
    const touches = fichiersDuCommit(sha)
    if (touches && !touches.some((f) => f.replace(/\\/g, '/') === cite)) {
      problems.push(`"corrigé par ${sha}" (ligne ${rang} du bloc) cite ${cite}:${ligne}, que ce commit ne touche PAS`)
      return problems
    }
  }
  if (lignesDuCommit) {
    const lignes = lignesDuCommit(sha, cite)
    if (lignes && lignes.length > 0 && !lignes.includes(Number(ligne))) {
      problems.push(`"corrigé par ${sha}" (ligne ${rang} du bloc) cite ${cite}:${ligne}, hors des lignes que ce commit y modifie`)
    }
  }
  return problems
}

/** « -> inventaire #<épic> : <état> » : un écart PORTÉ, pas un reste routé. Le porter à un épic que
 *  LE MÊME commit ferme laisserait l'écart sans destinataire — il se convertit alors en ticket. */
function problemesInventaire([, epic, etat], rang, { issuesFermees }) {
  const problems = []
  const texte = etat.trim()
  if (texte.length < MIN_ETAT_INVENTAIRE) {
    problems.push(`"inventaire #${epic}" (ligne ${rang} du bloc) sans état lisible (${texte.length} car., ${MIN_ETAT_INVENTAIRE} requis)`)
  }
  if (issuesFermees.includes(Number(epic)) && /écart/i.test(texte)) {
    problems.push(`"inventaire #${epic}" (ligne ${rang} du bloc) porte un écart à un épic que CE COMMIT ferme : convertir en ticket par CLASSE avant la clôture`)
  }
  return problems
}

/** Section « ## Recette visuelle » : exigée dès que le diff stagé touche un fichier d'écran
 *  (`src/ui/**` / `src/gameIso/**`, hors tests) — décision E1, un écran ne se solde pas sur parole. */
function checkRecetteVisuelle(content, { touchesUi, verifierCaptureDe }) {
  if (!touchesUi) return []
  const section = sectionDe(content, TITRE_RECETTE_VISUELLE)
  if (section === null) {
    return ['section "## Recette visuelle" absente alors que le commit touche un écran (src/ui/** ou src/gameIso/**) — y porter "capture: public/qc/<fichier>.png"']
  }
  const capture = CAPTURE_RE.exec(section)
  if (!capture) {
    return ['"## Recette visuelle" sans ligne "capture: <chemin sous public/qc/>"']
  }
  return verifierCaptureDe(capture[1]).problemes
}

/**
 * Valide le CONTENU d'un solde. `today` = date du jour en `YYYY-MM-DD`.
 * Contexte INJECTÉ (le driver le remplit depuis git/le disque, un appel nu ne joue que la grammaire) :
 * `fichiersEmportes` = chemins que le commit emporte ; `lignesEmportees(fichier)` = lignes que le commit y
 * modifie ; `issuesFermees` = tickets fermés par CE commit ; `touchesUi` = le diff touche un écran ;
 * `verifierCaptureDe(chemin)` = contrôle de la capture de recette (voir `verifierCapture`) ;
 * `commitEstAncetre(sha)` / `fichiersDuCommit(sha)` / `lignesDuCommit(sha, fichier)` = l'histoire
 * git, pour « corrigé par <sha> ».
 */
export function validateSolde(content, today, {
  fichiersEmportes = null,
  lignesEmportees = null,
  issuesFermees = [],
  touchesUi = false,
  verifierCaptureDe = () => ({ ok: true, problemes: [] }),
  commitEstAncetre = null,
  fichiersDuCommit = null,
  lignesDuCommit = null,
} = {}) {
  if (!content) return { ok: false, problems: ['fichier absent'], refuted: false }

  const problems = []

  const vMatch = VERIFIE_RE.exec(content)
  if (!vMatch) {
    problems.push('ligne "VERIFIE:" absente')
  } else if (vMatch[1].trim().length < MIN_VERIFIE_LEN) {
    problems.push(`"VERIFIE:" trop court (${vMatch[1].trim().length} car., ${MIN_VERIFIE_LEN} requis — décrire concrètement la vérification faite)`)
  }

  problems.push(...checkRestesSection(content, { fichiersEmportes, lignesEmportees, issuesFermees, commitEstAncetre, fichiersDuCommit, lignesDuCommit }))
  problems.push(...checkRecetteVisuelle(content, { touchesUi, verifierCaptureDe }))

  const { problems: refutationProblems, refuted } = checkRefutationSection(content)
  problems.push(...refutationProblems)

  if (!content.includes(today)) {
    problems.push(`date du jour (${today}) absente du fichier — solde réchauffé refusé`)
  }

  return { ok: problems.length === 0, problems, refuted }
}

/**
 * Valide le CONTENU d'une revue adversariale de PALIER (cumul de fermetures). La revue doit être
 * NOMMABLE : sa date et la base de sa fenêtre forment le nom du fichier
 * (`.claude/soldes/revue-palier-<date>-<base>.md`), et `verdictDeNom` vérifie qu'ils se répondent.
 */
export function validateRevuePalier(content, today) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const problems = [...problemesDeRevue(content)]
  if (!VERDICT_RE.test(content)) {
    problems.push('ligne "verdict: …" absente')
  }
  const descLen = lenWithoutVerdictLine(content)
  if (descLen < MIN_REVUE_PALIER_LEN) {
    problems.push(`synthèse trop maigre (${descLen} car. hors verdict, ${MIN_REVUE_PALIER_LEN} requis — revue du CUMUL des fermetures)`)
  }
  if (!content.includes(today)) {
    problems.push(`date du jour (${today}) absente du fichier`)
  }
  return { ok: problems.length === 0, problems }
}

/**
 * Revues neuves STAGÉES croisées avec ce que le commit EMPORTE. PUR.
 * Une revue peut être dans l'index sans partir avec le commit : `git commit -- <chemins>` n'emporte
 * QUE ces chemins-là (forme recommandée en arbre PARTAGÉ : le WIP d'une session voisine ne part pas),
 * et `--amend` a le même angle mort. C'est exactement la règle du solde, qui se lit déjà par
 * `commit.contenu` : la preuve doit PARTIR avec le commit, pas rester dans l'index.
 * @returns {{ emportees: object[], omises: string[] }}
 */
export function revuesDuCommit(stagees, fichiersEmportes) {
  const emportes = new Set((fichiersEmportes ?? []).map((f) => String(f).replace(/\\/g, '/')))
  return {
    emportees: (stagees ?? []).filter((r) => emportes.has(r.chemin)),
    omises: (stagees ?? []).filter((r) => !emportes.has(r.chemin)).map((r) => r.chemin),
  }
}

/**
 * Verdict sur UNE revue neuve stagée : contenu, NOM, continuité de fenêtre, et tête dans l'histoire.
 * PUR — `dansHead(sha)` est injecté (c'est la seule lecture git de ce contrôle).
 * @returns {string[]} problèmes, vide = conforme
 */
export function problemesDeRevueNeuve({ nom, contenu }, { today, palier, dansHead }) {
  const problemes = [...validateRevuePalier(contenu, today).problems]
  const attendu = nomDArchiveDeRevue(contenu)
  if (attendu && nom !== attendu) {
    problemes.push(`la revue s'appelle ${nom}, son contenu la nomme ${attendu} — le nom PORTE la fenêtre jugée`)
  }
  const { base, tete } = fenetreDeRevue(contenu)
  // Les fenêtres s'ENCHAÎNENT : une revue part où la précédente s'est arrêtée. C'est cet invariant
  // qui rend la suite des revues continue et vérifiable, quel que soit le nom d'un fichier.
  if (base && palier.tete && !memeSha(base, palier.tete)) {
    problemes.push(
      `sa fenêtre part de ${base}, or la dernière revue de HEAD (${palier.chemin}) s'arrête à `
      + `${palier.tete} — les fenêtres s'ENCHAÎNENT, base attendue : ${palier.tete}`,
    )
  }
  // Aucun lecteur d'ascendance = le contrôle ne se JOUE PAS, et il le DIT. Un défaut `() => true`
  // rendait « oui » sans avoir rien lu, ce qui est le contraire d'une porte.
  if (tete && typeof dansHead !== 'function') {
    problemes.push(`sa tête de fenêtre ${tete} n'a pas pu être vérifiée : aucun lecteur d'ascendance n'a été fourni`)
  } else if (tete && !dansHead(tete)) {
    problemes.push(`sa tête de fenêtre ${tete} n'est pas dans l'histoire de HEAD — elle juge une histoire absente d'ici`)
  }
  return problemes
}

/**
 * Décision du hook (PURE, testable). `readSolde(n)` renvoie le contenu STAGÉ (index git du commit
 * en cours) de `.claude/soldes/<n>.md`, ou `null`/`''` s'il n'y est pas. `soldeOnDisk(n)` renvoie le
 * contenu du même fichier sur le DISQUE : il ne sert qu'à distinguer « jamais écrit » de « écrit mais
 * non stagé » dans le message. `palier` = la MESURE de `mesureDuPalier` (scripts/guards/lib/revuePalier.mjs) :
 * `compte` de commits de substance depuis `tete` (la tête de fenêtre de la dernière revue archivée
 * dans HEAD, lue dans `chemin`), ou `erreur` quand le palier est INMESURABLE. `neuves()` rend les
 * revues de palier AJOUTÉES par ce commit et EMPORTÉES par sa forme (`revuesDuCommit`) : ce sont
 * elles qui franchissent le palier, et une revue neuve non conforme refuse le commit même hors palier
 * — une revue fausse dans l'histoire fausse toutes les mesures suivantes. `omises()` rend les revues
 * stagées que la forme du commit laisse en rade : le refus les NOMME. `contexteSolde` = le contexte injecté de
 * `validateSolde` (diff stagé, hunks, écran touché, contrôle de capture) — `issuesFermees` y est posé
 * ICI, c'est cette décision qui connaît les tickets fermés.
 * @returns {{ decision: 'deny', reason: string } | null} — non-null = refus, null = silence.
 */
export function evaluate({
  command, today, readSolde, soldeOnDisk = () => null,
  palier = { compte: 0, tete: null, chemin: null }, neuves = () => [], omises = () => [],
  dansHead,
  contexteSolde = {},
}) {
  const revues = neuves()
  for (const revue of revues) {
    const problemes = problemesDeRevueNeuve(revue, { today, palier, dansHead })
    if (problemes.length) {
      return {
        decision: 'deny',
        reason:
          `⚠ Revue de palier NON CONFORME : ${revue.chemin} — ${problemes.join(' ; ')}. Une revue entre `
          + "dans l'histoire sous le nom de ce qu'elle juge (`revue-palier-<date>-<base>.md`), avec sa "
          + `ligne "verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ", ≥${MIN_REVUE_PALIER_LEN} caractères de synthèse sur `
          + 'le CUMUL, sa date du jour en 1re ligne et sa fenêtre `<base>..<tête>`.',
      }
    }
  }

  const issues = extractClosedIssues(command)
  if (issues.length === 0) return null

  if (palier.erreur) {
    return {
      decision: 'deny',
      reason:
        `⚠ Palier INMESURABLE, donc aucune fermeture : ${palier.erreur}. Le palier se mesure sur `
        + "l'HISTOIRE (`git rev-list --count <tête de la dernière revue de HEAD>..HEAD -- src scripts`).",
    }
  }

  if (palier.compte >= PALIER && revues.length === 0) {
    const enRade = omises()
    return {
      decision: 'deny',
      reason:
        `⚠ Palier atteint : ${palier.compte} commits de substance depuis ${palier.tete} `
        + `(${palier.chemin}) — revue adversariale de PALIER exigée avant toute nouvelle fermeture. `
        + (enRade.length
          ? `${enRade.join(', ')} est écrite et stagée mais NON EMPORTÉE par ce commit : une commande `
            + `par pathspec n'emporte QUE les chemins nommés — y AJOUTER ${enRade.join(', ')}. `
          : '')
        + `Sinon, l'écrire et la STAGER sous .claude/soldes/revue-palier-${today}-${palier.tete}.md `
        + `(ligne "verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ", ≥${MIN_REVUE_PALIER_LEN} caractères de synthèse sur `
        + `le CUMUL, date du jour en 1re ligne, fenêtre \`${palier.tete}..<tête>\` — la date et la base `
        + 'NOMMENT le fichier).',
    }
  }

  const failures = []
  for (const n of issues) {
    const emporte = readSolde(n)
    if (!emporte && soldeOnDisk(n)) {
      failures.push({
        n,
        problems: [
          `écrit sur le disque mais NON EMPORTÉ par ce commit — \`git add .claude/soldes/${n}.md\` ; et si `
          + `la commande nomme des chemins (\`git commit … -- <chemins>\`), y AJOUTER `
          + `\`.claude/soldes/${n}.md\` : un commit par pathspec n'emporte QUE ces chemins-là, la preuve `
          + 'reste sur le disque et le commit part sans elle',
        ],
      })
      continue
    }
    const { ok, problems } = validateSolde(emporte, today, { ...contexteSolde, issuesFermees: issues })
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null

  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
    decision: 'deny',
    reason:
      `⚠ Fermeture de ticket au commit sans SOLDE conforme : ${detail}. Écrire (ou compléter) le fichier ` +
      `avec une ligne "VERIFIE: <ce que l'orchestrateur a concrètement vérifié, ≥${MIN_VERIFIE_LEN} caractères>", ` +
      `une section "## Restes" ("RAS" seul, ou des items "- <reste signalé par l'agent> -> <#N nouveau ticket ` +
      `(un SEUL par fermeture) | corrigé dans ce commit (<fichier>:<ligne>) | corrigé par <sha> ` +
      `<fichier>:<ligne> | RAS : justification | inventaire #<épic> : <état>>"), une section ` +
      `"## Réfutation" (ligne "verdict: ` +
      `CONFIRMÉ|PARTIEL|RÉFUTÉ", ≥${MIN_REFUTATION_LEN} caractères — qui a attaqué quoi sur le diff/DoD), et ` +
      `la date du jour (demande 2026-07-14), puis le STAGER (\`git add .claude/soldes/<N>.md\`) : la preuve ` +
      `citée par le message de commit vit dans git. L'index est lu AVANT l'exécution : un \`git add\` ` +
      `placé dans la MÊME commande n'est jamais vu — stager d'abord, committer ensuite.`,
  }
}

/** Racine du dépôt, ancrée sur l'EMPLACEMENT de ce script (jamais `process.cwd()` — un hook lancé
 *  avec un cwd différent de la racine doit quand même trouver `.claude/soldes/`). */
export function repoRoot(scriptUrl = import.meta.url) {
  return join(dirname(fileURLToPath(scriptUrl)), '..', '..')
}

/** Lecture du solde d'un ticket sur le DISQUE de `dir` — le répertoire où le commit s'exécute, comme
 *  tout ce que ce garde lit. `null` si absent/illisible. */
export function readSoldeFile(n, dir = process.cwd()) {
  try { return readFileSync(join(dir, '.claude/soldes', `${n}.md`), 'utf8') } catch { return null }
}

// ── Porte du TICKET (option retenue par l'utilisateur le 2026-09-11) ──────────────────────────────
// Le ticket est l'unité de travail : un commit qui touche `src` ou `scripts` cite au moins un ticket.
// Le critère de SUBSTANCE est celui du palier (`estCheminDeSubstance`, scripts/guards/lib/revuePalier.mjs) —
// une seule définition, sinon un commit franchit l'une des deux portes sans franchir l'autre. La
// grammaire des références est celle des deux extracteurs déjà en place (`extractClosedIssues` pour
// `corrige`/`fixes`/`closes`/`ferme`, `extractRefIssues` pour `ref`/`refs`), jamais une regex de plus.
// Ce que le commit EMPORTE décide (`diffDuCommit`), pas l'index : un `git commit -- <chemins>` ou un
// `-a` sans `git add` emporte l'arbre de travail, et c'est ce lot-là que la porte doit voir.
const MAX_FICHIERS_NOMMES = 3

/**
 * Décision de la porte du ticket (PURE, testable). `fichiersEmportes` = les chemins que le commit
 * va produire (`analyzeDiffDuCommit(...).fichiers`), injectés par le driver.
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluatePorteDuTicket({ command, fichiersEmportes = [] }) {
  if (!command || !isGitCommitCommand(command)) return null
  const substance = fichiersEmportes.filter(estCheminDeSubstance)
  if (substance.length === 0) return null
  if (extractClosedIssues(command).length > 0 || extractRefIssues(command).length > 0) return null

  const nommes = substance.slice(0, MAX_FICHIERS_NOMMES).join(', ')
  const reste = substance.length > MAX_FICHIERS_NOMMES ? ` (+${substance.length - MAX_FICHIERS_NOMMES})` : ''
  // Message NON LISIBLE ICI : `--amend` sans `-m`/`-F` hérite du message de HEAD, et un `git commit`
  // nu (ou `-v`/`-e`) l'ouvre dans l'ÉDITEUR — dans les deux cas le ticket peut y être, la commande
  // ne le porte pas. Le refus le DIT, au lieu d'ordonner de citer un ticket déjà écrit.
  const messageInvisible = !MESSAGE_FLAG_RE.test(command) && !FILE_FLAG_RE.test(command)
  return {
    reason:
      `⚠ Commit de SUBSTANCE sans ticket : ${nommes}${reste}. Ajouter \`refs #N\` au message (ou `
      + '`corrige #N` à la fermeture, avec son solde). '
      + (messageInvisible
        ? 'Le message de ce commit part à l’ÉDITEUR (ou est hérité par `--amend`) : ce contrôle ne le '
          + 'lit pas — re-committer avec `-m` ou `-F <fichier>`. '
        : '')
      + 'Option retenue par l’utilisateur le 2026-09-11 (verbatim) — « Tout commit de substance cite un '
      + 'ticket — un commit qui touche src/ ou scripts/ sans `refs #N`/`corrige #N` est refusé par le '
      + 'pre-commit ; le ticket est l’unité de travail, même pour un fix d’une ligne. »',
  }
}

// ── Anti-esquive (extension 2026-07-14) ────────────────────────────────────────────────
// Un commit `ref #N`/`refs #N` (rattaché SANS fermer), qui touche `src/**` pour un diff STAGED de
// substance, doit lui aussi porter sa réfutation — sinon la fermeture reste le SEUL chemin regardé
// et « ref #N » devient l'esquive mécanique. Le mécanisme REFUTATION porte sur le ticket
// EXPLICITEMENT rattaché ; le commit de substance qui n'en cite AUCUN est refusé en amont par
// `evaluatePorteDuTicket`.
const REFUTATION_LINE_RE = /REFUTATION\s*:\s*(.+)/i
const MIN_REFUTATION_LINE_LEN = 40
const SUBSTANTIVE_MIN_LINES = 10

/** Numéros de ticket que la commande RATTACHE sans fermer (`ref #N`/`refs #N`), dédupliqués/triés. */
export function extractRefIssues(command) {
  if (!command || !isGitCommitCommand(command)) return []
  const nums = new Set()
  // Une correspondance porte la CHAÎNE ENTIÈRE (`refs #A #B #C`) : on en extrait TOUS les numéros.
  for (const m of texteProfond(command).matchAll(motifRattachement()))
    for (const n of numerosDeLaChaine(m[0])) nums.add(Number(n))
  return [...nums].sort((a, b) => a - b)
}

/** `true` si le message porte une ligne "REFUTATION: <...>" d'au moins `MIN_REFUTATION_LINE_LEN`
 *  caractères après le mot-clef. */
function hasInlineRefutation(command) {
  const m = REFUTATION_LINE_RE.exec(command)
  return !!m && m[1].trim().length >= MIN_REFUTATION_LINE_LEN
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` : seule la section "## Réfutation" (même gabarit
 *  que les soldes de fermeture) est exigée — pas de VERIFIE/Restes, ce n'est pas une fermeture. */
export function validateRefFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkRefutationSection(content)
  return { ok: problems.length === 0, problems }
}

/**
 * Décision anti-esquive (PURE, testable). `stagedTouchesSrc`/`stagedTotalLines` = état du diff
 * STAGED (`git diff --cached`), injectés par le driver. `readRefFile(n)` lit
 * `.claude/soldes/ref-<n>.md` (ou `null`).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateAntiEsquive({ command, stagedTouchesSrc, stagedTotalLines, readRefFile = () => null }) {
  if (!command || !isGitCommitCommand(command)) return null
  if (!stagedTouchesSrc) return null
  if (typeof stagedTotalLines === 'number' && stagedTotalLines < SUBSTANTIVE_MIN_LINES) return null

  // Une fermeture est déjà couverte par `evaluate()` (solde complet, réfutation comprise) — pas de
  // double exigence ici.
  if (extractClosedIssues(command).length > 0) return null

  if (hasInlineRefutation(command)) return null

  const refIssues = extractRefIssues(command)
  // Aucun ticket rattaché (ni fermeture, ni `ref #N`) : hors du déclencheur — l'absence de ticket se
  // juge sur la SUBSTANCE, et c'est `evaluatePorteDuTicket` qui la juge.
  if (refIssues.length === 0) return null

  const failures = []
  for (const n of refIssues) {
    const { ok, problems } = validateRefFile(readRefFile(n))
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null
  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/ref-${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
    reason:
      `⚠ Commit "ref #N" (src/** touché, ≥${SUBSTANTIVE_MIN_LINES} lignes de diff staged) sans réfutation : ${detail}. ` +
      `Ajouter une ligne "REFUTATION: <qui a attaqué quoi, ≥${MIN_REFUTATION_LINE_LEN} caractères>" dans le ` +
      `message de commit, ou écrire .claude/soldes/ref-<N>.md avec une section "## Réfutation" conforme ` +
      `(verdict + synthèse — extension anti-esquive 2026-07-14).`,
  }
}

// ── JUGE adversarial (extension du mécanisme REFUTATION, générale à tout domaine) ──────────────────
// EXACTEMENT le même déclencheur qu'`evaluateAntiEsquive` (un `ref #N` rattaché sans fermer,
// jamais un commit sans ticket du tout, jamais une fermeture — déjà couverte par sa propre section
// "## Réfutation" à verdict) : un `ref #N` qui touche `src/**` en substance doit en plus porter la
// preuve qu'un agent juge adversarial est passé sur le diff. Si le diff touche `src/ui/**`, une
// preuve DISTINCTE de jugement sur captures (JUGE-VISION) est exigée en plus.
const JUGE_LINE_RE = /\bJUGE\s*:\s*(.+)/i
const MIN_JUGE_LINE_LEN = 40
const JUGE_VISION_LINE_RE = /\bJUGE-VISION\s*:\s*(.+)/i
const MIN_JUGE_VISION_LINE_LEN = 40
const JUGE_SECTION_RE = /##\s*Juge\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i
const JUGE_VISION_SECTION_RE = /##\s*Juge-Vision\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i

/** `true` si le message porte une ligne "JUGE: <...>" d'au moins `MIN_JUGE_LINE_LEN` caractères
 *  après le mot-clef (n'accroche jamais "JUGE-VISION:", le tiret casse le motif `JUGE\s*:`). */
function hasInlineJuge(command) {
  const m = JUGE_LINE_RE.exec(command)
  return !!m && m[1].trim().length >= MIN_JUGE_LINE_LEN
}

/** `true` si le message porte une ligne "JUGE-VISION: <...>" d'au moins `MIN_JUGE_VISION_LINE_LEN`
 *  caractères après le mot-clef. */
function hasInlineJugeVision(command) {
  const m = JUGE_VISION_LINE_RE.exec(command)
  return !!m && m[1].trim().length >= MIN_JUGE_VISION_LINE_LEN
}

/** Section nommée générique (`## <label>`) : présence + longueur minimale du corps. */
function checkNamedSection(content, sectionRe, minLen, label) {
  const problems = []
  const m = sectionRe.exec(content ?? '')
  if (!m) {
    problems.push(`section "## ${label}" absente`)
    return { problems }
  }
  const body = m[1].trim()
  if (body.length < minLen) {
    problems.push(`"## ${label}" trop maigre (${body.length} car., ${minLen} requis)`)
  }
  return { problems }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge" (symétrie exacte de
 *  `validateRefFile`, mécanisme distinct — n'exige pas de "## Réfutation"). */
export function validateJugeFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, JUGE_SECTION_RE, MIN_JUGE_LINE_LEN, 'Juge')
  return { ok: problems.length === 0, problems }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge-Vision". */
export function validateJugeVisionFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, JUGE_VISION_SECTION_RE, MIN_JUGE_VISION_LINE_LEN, 'Juge-Vision')
  return { ok: problems.length === 0, problems }
}

/**
 * Décision JUGE (PURE, testable). Même périmètre de déclenchement qu'`evaluateAntiEsquive` (silence
 * sur les fermetures, déjà couvertes par leur propre solde ; silence aussi sur un commit sans AUCUN
 * ticket rattaché — #591). `stagedTouchesUi` = le diff staged touche `src/ui/**` (tests compris).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateJuge({ command, stagedTouchesSrc, stagedTotalLines, stagedTouchesUi, readRefFile = () => null }) {
  if (!command || !isGitCommitCommand(command)) return null
  if (!stagedTouchesSrc) return null
  if (typeof stagedTotalLines === 'number' && stagedTotalLines < SUBSTANTIVE_MIN_LINES) return null
  if (extractClosedIssues(command).length > 0) return null

  const refIssues = extractRefIssues(command)
  // Aucun ticket rattaché (ni fermeture, ni `ref #N`) : hors du déclencheur — l'absence de ticket se
  // juge sur la SUBSTANCE, et c'est `evaluatePorteDuTicket` qui la juge.
  if (refIssues.length === 0) return null

  const needsVision = !!stagedTouchesUi

  const jugeSatisfied =
    hasInlineJuge(command) ||
    (refIssues.length > 0 && refIssues.every((n) => validateJugeFile(readRefFile(n)).ok))
  const visionSatisfied =
    !needsVision ||
    hasInlineJugeVision(command) ||
    (refIssues.length > 0 && refIssues.every((n) => validateJugeVisionFile(readRefFile(n)).ok))

  if (jugeSatisfied && visionSatisfied) return null

  const missing = []
  if (!jugeSatisfied) {
    missing.push(
      `ligne "JUGE: <qui a jugé quoi, verdict — ≥${MIN_JUGE_LINE_LEN} caractères>" (ou section ` +
      `"## Juge" dans .claude/soldes/ref-<N>.md)`,
    )
  }
  if (!visionSatisfied) {
    missing.push(
      `ligne "JUGE-VISION: <captures jugées — ≥${MIN_JUGE_VISION_LINE_LEN} caractères>" (ou section ` +
      `"## Juge-Vision" dans .claude/soldes/ref-<N>.md) — un ÉCRAN est touché (src/ui/** ou src/gameIso/**)`,
    )
  }

  return {
    reason:
      `⚠ Commit touchant src/** (≥${SUBSTANTIVE_MIN_LINES} lignes de diff staged) sans juge ` +
      `adversarial : ajouter ${missing.join(' et ')} dans le message de commit (extension juge du ` +
      `garde de solde).`,
  }
}

// ── --amend sans message explicite (message hérité invisible au contrôle) ──────────────────────────
const AMEND_RE = /--amend\b/
const MESSAGE_FLAG_RE = /(?:^|\s)(?:-m\b|--message\b)/

/**
 * `git commit --amend` sans `-m`/`-F` hérite du message du commit précédent — invisible à ce hook
 * (et au closer de publication) puisque ni la commande ni un fichier lisible ne le portent. Deny
 * PRUDENT si le diff staged touche `src/**` ; silence sinon (les règles maison découragent déjà
 * l'amend, mais un amend sans substance src ne mérite pas un blocage).
 * @returns {{ reason: string } | null}
 */
export function evaluateAmendInvisible({ command, stagedTouchesSrc }) {
  if (!command || !isGitCommitCommand(command)) return null
  if (!AMEND_RE.test(command)) return null
  if (MESSAGE_FLAG_RE.test(command) || FILE_FLAG_RE.test(command)) return null
  if (!stagedTouchesSrc) return null
  return {
    reason:
      `⚠ Commit --amend sans message explicite (-m/-F) : le message hérité est invisible au ` +
      `contrôle de solde (src/** touché) — re-committer avec -m (ou -F sur un fichier lisible) ` +
      `pour que la fermeture/réfutation reste contrôlable.`,
  }
}

/** Lecture d'un fichier de réfutation `ref-<n>` sur le DISQUE de `dir` — le répertoire où le commit
 *  s'exécute. `null` si absent/illisible. */
export function readRefFile(n, dir = process.cwd()) {
  try { return readFileSync(join(dir, '.claude/soldes', `ref-${n}.md`), 'utf8') } catch { return null }
}

// ── Répertoire CIBLE du commit (fix #587) ──────────────────────────────────────────────────────────
// Le hook tourne dans le cwd du process (le dépôt de la SESSION) ; une commande qui `cd` dans un
// AUTRE dépôt (worktree) avant `git commit` doit faire lire ses états git (manifest stagé, diff
// staged) DANS CE RÉPERTOIRE, pas celui de la session — sinon un manifest propre dans le worktree
// est jugé contre l'arbre principal encore sale (démontré empiriquement, #587). Le solde est une
// lecture d'état GIT — le solde doit être STAGÉ : il se lit dans l'index de `targetDir`. Sa lecture
// DISQUE (côté session, là où les soldes s'écrivent) sert à nommer le défaut « écrit mais non
// stagé ».
// La cible se lit sur les segments PROFONDS : un `cd` ou un `git -C` posé dans un sous-shell
// (`sh -c "cd wt && git commit …"`) désigne le même répertoire réel qu'en surface.

// Chemin POSIX de disque Windows (`/c/Users/…`, graphie Git Bash / MSYS) : sur win32 `resolve()` le
// prend pour un relatif du disque courant (`C:\c\Users\…`) et le garde lisait l'index du MAUVAIS
// dépôt. Hors win32, `/c/...` est un vrai chemin absolu — aucune conversion.
const DISQUE_POSIX_RE = /^\/([A-Za-z])\/(.*)$/

/** Chemin de commande rendu natif pour la plateforme (`/c/Users/x` → `C:/Users/x` sur win32). */
export function versCheminNatif(chemin, platform = process.platform) {
  if (platform !== 'win32') return chemin
  const m = DISQUE_POSIX_RE.exec(chemin)
  return m ? `${m[1].toUpperCase()}:/${m[2]}` : chemin
}

/** Valeur du flag global `git -C <path>` d'un segment, ou `null` (segment non-git, ou sans `-C`). */
function valeurGitDashC(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (basenameExecutable(segment[start]) !== 'git') return null
  for (let k = start + 1; k < segment.length; k++) {
    const t = segment[k]
    if (!t.startsWith('-')) return null
    if (t === '-C') return segment[k + 1] ?? null
    if (GLOBAL_VALUE_FLAGS.has(t)) k += 1
  }
  return null
}

/** Commandes qui CHANGENT le répertoire courant, dans les deux shells où ce hook est câblé : POSIX
 *  (`cd`) et PowerShell (`Set-Location` et ses alias `sl`/`chdir`, `pushd`). Ne lire que `cd` faisait
 *  juger un commit de worktree contre l'ARBRE PRINCIPAL dès que la session parlait PowerShell
 *  (#1729 sonde 5). `popd` n'est pas lu : il dépend d'une pile que la commande ne dit pas. */
const CHANGEMENTS_DE_REPERTOIRE = new Set(['cd', 'chdir', 'pushd', 'set-location', 'sl'])

/** Chemin de commande NON EXPANSÉ (`$M`, `${M}`, `%M%`) : la variable vit dans le shell, pas dans le
 *  hook — le texte ne désigne aucun répertoire. */
const VARIABLE_NON_EXPANSEE_RE = /[$%]/

/** Chemin que la COMMANDE nomme, TEL QU'ÉCRIT (`brut`) et résolu contre `cwd` (`resolu`) : `git -C
 *  <path>` en priorité, sinon le dernier `cd`/`Set-Location` du pipeline. `null` si aucun. */
function cheminNommeParLaCommande(command, cwd, platform) {
  const segments = segmentsProfonds(command)
  for (const segment of segments) {
    const dashC = valeurGitDashC(segment)
    if (dashC) return { brut: dashC, resolu: resolve(cwd, versCheminNatif(dashC, platform)) }
  }
  // Les `cd` se PLIENT dans l'ordre : `cd <wt> && cd .. && git …` s'exécute dans le PARENT du
  // worktree, pas dedans. Retenir le premier faisait dire « worktree » à un geste qui n'y est plus
  // (mesuré 2026-09-04) — chaque `cd` se résout contre le répertoire où le précédent a mené.
  let nomme = null
  for (const segment of segments) {
    if (CHANGEMENTS_DE_REPERTOIRE.has(basenameExecutable(segment[0])) && segment[1]) {
      nomme = { brut: segment[1], resolu: resolve(nomme?.resolu ?? cwd, versCheminNatif(segment[1], platform)) }
    }
  }
  return nomme
}

/**
 * Répertoire CIBLE prouvé par la commande, et ce qu'elle nomme sans qu'il puisse servir de cwd.
 * `dir` n'est retenu que s'il désigne un répertoire RÉEL : un chemin porteur d'une variable non
 * expansée (`git -C "$M"`) et un chemin ABSENT du disque donnent au spawn de git un ENOENT
 * impossible à distinguer d'un git absent — la porte refusait alors « ascendance indisponible » un
 * geste que git exécutait très bien (#1729 sondes 1-2). La cible d'un `git worktree add <cible>`
 * n'est JAMAIS un cwd : ce n'est pas un `-C`, et c'est git qui la crée.
 * `ignore` (`null` ou `{ chemin, raison }`) est DIT dans le message quand la porte refuse : sinon le
 * refus juge un autre répertoire que celui que l'utilisateur lit.
 * @returns {{ dir: string|null, ignore: { chemin: string, raison: string }|null }}
 */
export function cibleDeLaCommande(command, cwd = process.cwd(), platform = process.platform, { existe = estRepertoire } = {}) {
  if (!command) return { dir: null, ignore: null }
  const nomme = cheminNommeParLaCommande(command, cwd, platform)
  if (!nomme) return { dir: null, ignore: null }
  if (VARIABLE_NON_EXPANSEE_RE.test(nomme.brut)) {
    return { dir: null, ignore: { chemin: nomme.brut, raison: 'variable de shell non expansée' } }
  }
  if (!existe(nomme.resolu)) {
    return { dir: null, ignore: { chemin: nomme.resolu, raison: 'répertoire inexistant au moment du contrôle' } }
  }
  return { dir: nomme.resolu, ignore: null }
}

/** Répertoire dans lequel le `git commit` de la commande s'exécute réellement — un cwd de SPAWN,
 *  donc la cible PROUVÉE (`cibleDeLaCommande`) ; sinon `cwd` inchangé. */
export function extractTargetDir(command, cwd = process.cwd(), platform = process.platform, opts) {
  return cibleDeLaCommande(command, cwd, platform, opts).dir ?? cwd
}

/** Le refus, augmenté de ce que la commande nommait sans que ce soit un répertoire réel : sans cette
 *  phrase, l'utilisateur lit un verdict porté sur un AUTRE répertoire que celui qu'il a écrit. PURE. */
export function avecCibleIgnoree(decision, ignore) {
  if (!decision || !ignore) return decision
  return {
    ...decision,
    reason:
      `${decision.reason} (jugé depuis le répertoire de la session : « ${ignore.chemin} » nommé par la `
      + `commande n'a pas servi de répertoire cible — ${ignore.raison}.)`,
  }
}

// ── Registres PORTEURS de ticket (prévention #434/#487, généralisée #1825) ────────────────────────
// Certains registres du dépôt portent, entrée par entrée, la DETTE que doit un ticket : le manifeste
// éditorial porte la dette d'IMPLÉMENTATION d'un topic (`ticket: "#N"` / `bloque: "…#N…"`), le
// registre des domaines de l'Atlas porte la dette d'EXTRACTION d'une aire. Fermer #N en le laissant
// dans l'un d'eux laisse une marque « dette : #N » dans ce que ces registres alimentent, et l'issue
// fermée à tort : la marque se retire dans le MÊME commit que la fermeture.
//
// La LISTE de ces registres est de la DONNÉE (`scripts/hooks/registres-porteurs.json`) : ce hook n'en
// NOMME aucun, il boucle et cherche `#N` dans le contenu EMPORTÉ de chacun. Un registre porteur de
// plus = une ligne de donnée, zéro ligne ici. Chaque entrée porte son `chemin` et, quand le registre
// alimente un artefact généré, la commande `apres` qui le régénère.
// Pourquoi un SCANNER D'OCTETS et pas les lecteurs typés de chaque registre : ce qui se juge est le
// contenu que le commit EMPORTE (`commit.contenu`, index ou HEAD selon la forme du commit), pas le
// disque de travail que ces lecteurs lisent — deux sources différentes, deux verdicts différents.
// La LISTE se lit par CETTE MÊME couture, et AU MOMENT de l'évaluation — jamais à l'import : un
// hook ne lève jamais (une lecture à l'import rendrait le garde ENTIER muet sur une liste cassée), et
// la liste jugée est celle du COMMIT, comme les registres qu'elle nomme — pas celle d'un autre arbre.
// Liste illisible ou absente : seule l'évaluation de FERMETURE refuse, en nommant la cause (on ne
// peut pas prouver qu'aucun registre ne porte le ticket) ; toutes les autres portes restent intactes.
const LISTE_DES_PORTEURS = 'scripts/hooks/registres-porteurs.json'
const TICKET_RE = /#(\d+)/g

/** La liste des registres porteurs telle que le commit l'EMPORTE. LÈVE en nommant la cause —
 *  `evaluateRegistresPorteurs` la rattrape et la transforme en refus de FERMETURE. */
export function registresPorteursDuCommit(lireRegistreEmporte) {
  const brut = lireRegistreEmporte(LISTE_DES_PORTEURS)
  if (typeof brut !== 'string' || !brut.trim()) throw new Error('absente du contenu emporté par le commit')
  let liste
  try {
    liste = JSON.parse(brut)
  } catch (e) {
    throw new Error(`JSON illisible — ${String(e.message ?? e)}`, { cause: e })
  }
  if (!Array.isArray(liste)) throw new Error('la liste n’est pas un tableau')
  const fautives = liste.filter((r) => !r || typeof r.chemin !== 'string' || !r.chemin)
  if (fautives.length) throw new Error(`${fautives.length} entrée(s) sans \`chemin\``)
  return liste
}

/** Tickets `#N` référencés par le CONTENU d'un registre porteur. `null`/vide → ensemble vide. */
export function ticketsDuRegistre(contenu) {
  const nums = new Set()
  if (!contenu) return nums
  for (const m of contenu.matchAll(TICKET_RE)) nums.add(Number(m[1]))
  return nums
}

/**
 * Décision « fermeture d'un ticket encore porté par un registre » (PURE, testable).
 * `lireRegistreEmporte(chemin)` renvoie la version que le commit EMPORTE (ou `null`) — la LISTE des
 * registres porteurs se lit par cette même couture, ici, jamais à l'import.
 * Le refus NOMME le fichier qui porte encore `#N` — sans quoi il faudrait deviner lequel.
 * @param {{ command: string, lireRegistreEmporte?: (chemin: string) => string|null }} entree
 * @returns {{ reason: string } | null}
 */
export function evaluateRegistresPorteurs({ command, lireRegistreEmporte = () => null }) {
  const issues = extractClosedIssues(command)
  if (issues.length === 0) return null
  let registres
  try {
    registres = registresPorteursDuCommit(lireRegistreEmporte)
  } catch (e) {
    // On ne peut pas PROUVER qu'aucun registre ne porte ces tickets : la fermeture se refuse, en
    // nommant la cause. Le reste du garde ne dépend pas de cette liste et reste intact.
    return {
      reason:
        `⚠ Fermeture de ${issues.map((n) => `#${n}`).join(', ')} impossible à juger : la liste des `
        + `registres PORTEURS de ticket (\`${LISTE_DES_PORTEURS}\`) est inexploitable — ${String(e.message ?? e)}. `
        + `Sans elle, rien ne prouve qu'aucun registre ne porte encore ce(s) ticket(s) : rétablir la `
        + `liste dans le commit, puis re-committer.`,
    }
  }
  const retenus = []
  for (const registre of registres) {
    const tickets = ticketsDuRegistre(lireRegistreEmporte(registre.chemin))
    const stuck = issues.filter((n) => tickets.has(n))
    if (stuck.length) retenus.push({ registre, stuck })
  }
  if (!retenus.length) return null
  const detail = retenus
    .map(({ registre, stuck }) =>
      `${stuck.map((n) => `#${n}`).join(', ')} dans ${registre.chemin}`
      + (registre.apres ? ` (puis \`${registre.apres}\`)` : ''))
    .join(' ; ')
  return {
    reason:
      `⚠ Fermeture de ${[...new Set(retenus.flatMap((r) => r.stuck))].sort((a, b) => a - b).map((n) => `#${n}`).join(', ')} `
      + `alors que ce(s) ticket(s) figure(nt) encore dans un registre PORTEUR (contenu emporté par le `
      + `commit) : ${detail}. La marque se retire dans le MÊME commit que la fermeture — retirer `
      + `l'entrée, rejouer la régénération quand il y en a une, puis re-committer.`,
  }
}

/** `true` si `path` est COUVERT par le pathspec `ps` (chemin identique, ou `path` sous le dossier
 *  `ps`) — normalise les antislashs Windows et les `./` de tête. */
function pathMatchesPathspec(path, ps) {
  const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
  const np = norm(path)
  const nps = norm(ps)
  if (!nps) return false
  return np === nps || np.startsWith(`${nps}/`)
}

/** Fichier d'ÉCRAN : ce que l'utilisateur VOIT — un composant `.tsx` de `src/ui/**`/`src/gameIso/**`
 *  ou une feuille de `src/ui/styles/**`, hors tests. Concept unique, partagé par la preuve
 *  JUGE-VISION (`evaluateJuge`) et la section « ## Recette visuelle » du solde.
 *  BORNÉ au rendu, à dessein : `src/ui/breakdown.ts` (calcul pur) et `src/gameIso/builders/**.ts`
 *  (géométrie pure) vivent sous ces racines sans rien AFFICHER — exiger d'eux une capture ferait de
 *  la recette visuelle une formalité qu'on remplit sans regarder. Un diff qui ne touche que des
 *  tests d'écran n'a pas davantage de capture à montrer. */
export function estFichierEcran(path) {
  const p = String(path ?? '').replace(/\\/g, '/')
  if (/\.(test|spec)\./.test(p)) return false
  if (/^src\/ui\/styles\/.+\.css$/.test(p)) return true
  return /^src\/(ui|gameIso)\/.+\.tsx$/.test(p)
}

/** Analyse du `--numstat` du diff que le commit va produire (`diffDuCommit(...).numstat()`) :
 *  touche-t-il `src/**` ? un ÉCRAN
 *  (`estFichierEcran`, rendu par `touchesUi`) ?
 *  combien de lignes (insertions+suppressions) au total ? Fichiers binaires (`-\t-\t<path>`)
 *  comptés 0 ligne mais peuvent toucher `src/**`. `''`/erreur git → aucune touche, 0 ligne
 *  (silence, jamais un deny par accident hors dépôt).
 *
 * AUCUN filtrage de pathspec ici (#591 défaut 1, arbre PARTAGÉ) : la restriction au lot de CETTE
 * commande est déjà faite par git, qui a produit ce `--numstat` en le bornant aux pathspecs
 * (`diffDuCommit`). La refaire ici avec un matcheur de chemins MAISON aveuglait la garde sur la
 * forme la plus courante — `git commit -- .` : `.` n'égale aucun chemin et ne préfixe aucun, donc
 * tout le lot était jeté (mesuré 2026-09-04). Un seul matcheur de pathspec dans ce fichier, et
 * c'est celui de git.
 *
 * `chemins` (facultatif) REMPLACE les chemins du `--numstat` pour `fichiers`/`touchesSrc`/`touchesUi` :
 * un renommage s'y replie en `src/ui/{Ancien.tsx => Nouveau.tsx}`, qui ne nomme aucun fichier — il
 * n'égale aucun site cité par un solde et ne se lit comme aucun ÉCRAN (mesuré).
 * `totalLines` reste celui du `--numstat` REPLIÉ dans les deux cas : c'est le VOLUME écrit, et un
 * renommage n'écrit rien. */
export function analyzeDiffDuCommit(raw, chemins = null) {
  let totalLines = 0
  const duNumstat = []
  for (const line of String(raw ?? '').split('\n')) {
    if (!line.trim()) continue
    const [ins, del, ...pathParts] = line.split('\t')
    duNumstat.push(pathParts.join('\t'))
    totalLines += (Number.parseInt(ins, 10) || 0) + (Number.parseInt(del, 10) || 0)
  }
  const fichiers = chemins ?? duNumstat
  return {
    touchesSrc: fichiers.some((f) => /^src\//.test(f)),
    touchesUi: fichiers.some(estFichierEcran),
    totalLines,
    fichiers,
  }
}

// ── Le diff que le commit va RÉELLEMENT produire ──────────────────────────────────────────────────
// `git commit` a trois FORMES, et chacune emporte un contenu différent : avec des pathspecs
// (`git commit -- <paths>` ou chemins positionnels) c'est l'ARBRE DE TRAVAIL de ces chemins, avec
// `-a` c'est tout le modifié SUIVI, sinon c'est l'INDEX. Lire l'index dans les deux premiers cas
// rendait un diff VIDE quand rien n'était stagé, et toute évaluation qui en dépend se taisait —
// c'est par là que la croissance de stock de `429b9a1a2` est passée (revue de palier n°2, cause
// prouvée par sonde le 2026-09-03). La forme se décide ICI, une fois, pour toutes les évaluations.
//
// `--amend` ne change pas la règle et n'ajoute PAS le diff de HEAD : un amend n'introduit aucun
// contenu que HEAD ne portait déjà (donc rien de neuf à juger), et le contenu final est de toute
// façon relu par la porte de PLAGE au pre-push (`scripts/guards/lib/plageStock.mjs`).

/** Forme d'un `git commit` : `pathspec` (arbre des chemins nommés), `tout` (-a), `index`.
 *  Un pathspec NON RÉSOLU (joker) rend `tout` — git commitera l'arbre de travail, et un diff
 *  SUR-INCLUSIF (non borné) le voit toujours ; le prendre pour `index` rendait la garde MUETTE. */
export function formeDuCommit(command) {
  const { chemins, nonResolus } = pathspecsDuCommit(command)
  if (nonResolus) return { forme: 'tout', pathspecs: [] }
  if (chemins.length > 0) return { forme: 'pathspec', pathspecs: chemins }
  if (aFlagTout(command)) return { forme: 'tout', pathspecs: [] }
  return { forme: 'index', pathspecs: [] }
}

/**
 * Lectures du contenu que `command` va committer dans `dir` : `numstat()` (le stat d'ensemble),
 * `cheminsSansRenommage()` (les chemins du lot, un RENOMMAGE déplié en ses DEUX bouts),
 * `fichier(f)` (le `-U0` d'un fichier), `contenu(f)`/`avant(f)` (le fichier APRÈS et AVANT le
 * commit). Toute erreur git rend `''`/`null` — le garde se tait, il ne refuse pas hors dépôt.
 *
 * `cheminsSansRenommage()` rend les DEUX bouts d'un renommage, parce que `--numstat` le replie en UN
 * chemin de la forme `scripts/guards/lib/{aStock.mjs => bStock.mjs}` (mesuré) qui ne nomme aucun
 * fichier et n'égale aucun pathspec : c'est par ces deux bouts que la porte des stocks voit le
 * porteur source ET le porteur cible, qu'un solde prouve sa correction au NOUVEAU chemin, et qu'un
 * `.tsx` renommé reste un ÉCRAN (#1720). `numstat()` garde la lecture repliée : c'est elle qui donne
 * le VOLUME du lot aux portes de preuve, et un renommage n'y ajoute pas de lignes écrites.
 * Le `HEAD` n'est interrogé que si la forme l'exige (un dépôt sans premier commit n'a que l'index).
 *
 * `contenu(f)` suit la forme JUSQU'AU FICHIER, et c'est là que se règle la porte de FERMETURE : sous
 * `git commit -m "… corrige #N" -- src/x.ts`, un solde stagé mais HORS pathspec n'est PAS emporté —
 * git garde pour lui le contenu de HEAD. Lire l'index validait une preuve que le commit ne portait
 * pas (mesuré 2026-09-04). Donc : forme `index` → l'index ; forme `pathspec` → l'arbre de travail
 * pour un chemin DANS le pathspec, HEAD pour tous les autres ; forme `tout` → l'arbre de travail.
 */
export function diffDuCommit(command, dir = process.cwd()) {
  const { forme, pathspecs } = formeDuCommit(command)
  const lire = (args) => {
    try {
      return execFileSync('git', args, {
        encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28,
      })
    } catch { return null }
  }
  const fichierDeTravail = (f) => {
    try { return readFileSync(join(dir, f), 'utf8') } catch { return null }
  }
  let head = null
  const aHead = () => (head ??= lire(['rev-parse', '--verify', '--quiet', 'HEAD']) !== null)
  const contreIndex = () => forme === 'index' || !aHead()
  const rev = () => (contreIndex() ? ['--cached'] : ['HEAD'])
  const borne = pathspecs.length ? ['--', ...pathspecs] : []
  const contenu = (f) => {
    if (contreIndex()) return lire(['show', `:${f}`])
    if (forme === 'pathspec' && !pathspecs.some((ps) => pathMatchesPathspec(f, ps))) {
      return lire(['show', `HEAD:${f}`])
    }
    return fichierDeTravail(f)
  }
  return {
    forme,
    pathspecs,
    numstat: () => lire(['diff', ...rev(), '--numstat', ...borne]) ?? '',
    cheminsSansRenommage: () =>
      (lire(['diff', ...rev(), '--numstat', '--no-renames', ...borne]) ?? '')
        .split('\n').map((l) => l.split('\t').slice(2).join('\t').trim()).filter(Boolean),
    fichier: (f) => lire(['diff', ...rev(), '-U0', '--', f]) ?? '',
    contenu,
    avant: (f) => (aHead() ? lire(['show', `HEAD:${f}`]) : null),
  }
}

/** Chemins rendus par `git diff --name-only [--cached]` dans `dir`. */
export function readChangedNames(dir = process.cwd(), { cached = false } = {}) {
  try {
    const args = ['diff', '--name-only']
    if (cached) args.push('--cached')
    return execFileSync('git', args, { encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean)
  } catch { return [] }
}

/** Fichiers de l'INDEX qui citent un des `numeros` (pré-filtre `git grep --cached`) : le scan de
 *  commentaires ne s'applique qu'à eux, jamais à l'arbre entier. */
export function fichiersCitantTickets(numeros, dir = process.cwd()) {
  if (numeros.length === 0) return []
  const motif = `#(${numeros.join('|')})([^0-9]|$)`
  try {
    return execFileSync('git', ['grep', '--cached', '-l', '-E', motif, '--', ...DOSSIERS_DE_SUBSTANCE], {
      encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').map((l) => l.trim()).filter(Boolean)
  } catch { return [] } // aucun match : `git grep` sort en 1
}

/**
 * Le verdict PUR, ou le refus qui NOMME ce que git n'a pas pu lire. Une ascendance indisponible n'est
 * pas un « non » : la conclure ferait refuser un solde juste (ou passer un solde faux) sur rien.
 * La CAUSE se nomme telle qu'elle est — un répertoire qui existe mais n'est gouverné par aucun
 * dépôt (`horsDepot`) n'est ni un git absent ni un cwd manquant, et le renvoyer vers « un arbre où
 * git répond » désignait la mauvaise correction (#1729).
 * @param {() => ({ decision: string, reason: string } | null)} juger
 * @param {{ cwd?: string|null, horsDepot?: boolean }} [ou] répertoire où la lecture a été tentée
 */
export function jugerOuNommerLIndisponible(juger, { cwd = null, horsDepot = false } = {}) {
  try {
    return juger()
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    const cause = horsDepot ? `hors dépôt : ${cwd}` : e.raison
    const geste = horsDepot
      ? 'Geste : rejouer depuis un arbre git (ce répertoire n’est gouverné par aucun dépôt).'
      : 'Geste : rejouer le commit depuis un arbre où git répond.'
    return {
      decision: 'deny',
      reason: `⛔ ascendance indisponible : ${cause} — la porte ne peut rien juger de ce que git n'a pas lu. ${geste}`,
    }
  }
}

/** Chemins touchés par le commit `sha` dans `dir`, `[]` si le sha est inconnu du dépôt.
 *  `--no-renames` : sans lui, un renommage rend UNE ligne `{ancien => nouveau}` qu'aucun chemin cité
 *  ne peut égaler — un solde juste est refusé (mesuré sur un renommage dans `.claude/soldes/`, 26be12347). */
export function fichiersDuCommitGit(sha, dir = process.cwd()) {
  try {
    return execFileSync('git', ['show', '--numstat', '--no-renames', '--pretty=format:', sha], {
      encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => l.split('\t').slice(2).join('\t'))
      .filter(Boolean)
  } catch { return [] }
}

/** Diff à ZERO contexte d'un fichier DANS le commit `sha` (`git show <sha> -U0 -- <fichier>`),
 *  `''` si le commit ou le fichier est inconnu — le diff d'UN SHA DÉJÀ POSÉ, à ne pas confondre avec
 *  `diffDuCommit`, qui lit ce que la commande EN COURS va emporter. Le commit se place AVANT le
 *  séparateur : après, git le lirait comme un pathspec (`env-git-show-ordre-commit-avant-paths`). */
export function diffDunSha(sha, fichier, dir = process.cwd()) {
  try {
    return execFileSync('git', ['show', '-U0', '--format=', '--no-renames', sha, '--', fichier], {
      encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch { return '' }
}

/** Date de dernière écriture la plus RÉCENTE parmi `fichiers` (ms, `0` si aucune lisible). */
export function mtimeMaxDe(fichiers, racine = process.cwd()) {
  let max = 0
  for (const f of fichiers) {
    try { max = Math.max(max, statSync(join(racine, f)).mtimeMs) } catch { /* fichier supprimé */ }
  }
  return max
}

// ── Fermeture hors commit (l'angle mort mesuré du garde) ──────────────────────────────────────────
// Le mécanisme entier s'accroche à `git commit` : `gh issue close` fermait le MÊME ticket sans que
// rien ne demande son solde (sonde `scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs`,
// revue de palier `revue-palier-2205fde51.md:17`). La fermeture passe par le commit, un point.

/** `true` si les arguments portent un état `closed` (`--state closed`, `--state=closed`,
 *  `-f state=closed`, `--field state=closed`, `--raw-field state=closed`). */
function porteEtatFerme(args) {
  return args.some((a, i) => {
    if (/^(-f|-F|--field|--raw-field|--state)$/.test(a)) return /^(state=)?closed$/i.test(args[i + 1] ?? '')
    return /^--state=closed$/i.test(a) || /^state=closed$/i.test(a)
  })
}

/** Forme de fermeture `gh` portée par un segment (argv, exécutable en tête), ou `null`.
  *  EXPORTÉE : c'est le RECONNAISSEUR canonique du geste de fermeture, et le recensement statique des
  *  sites de fermeture du dépôt (`scripts/guards/lib/sitesDeFermeture.mjs`) le consomme tel quel —
  *  une seconde table de graphies dirait « ferme » d'une commande que cette porte laisse passer. */
export function fermetureGh(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (basenameExecutable(segment[start]) !== 'gh') return null
  const args = segment.slice(start + 1)
  if (args[0] === 'issue' && args[1] === 'close') return 'gh issue close'
  if (args[0] === 'issue' && args[1] === 'edit' && porteEtatFerme(args)) return 'gh issue edit --state closed'
  if (args[0] === 'api' && porteEtatFerme(args)) return 'gh api … state=closed'
  return null
}

// Endpoint d'UN ticket : `repos/<o>/<r>/issues/<N>` (avec ou sans barre de tête). SEUL cet appel peut
// FERMER — la collection `/issues` CRÉE, `graphql` ne porte pas d'état sur cette route, et un GET ne
// modifie rien.
const ENDPOINT_UN_TICKET_RE = /(^|\/)issues\/\d+(\/|$)/

/** Méthode HTTP demandée (`-X`/`--method`), `GET` par défaut comme `gh api`. */
function methodeGh(args) {
  const i = args.findIndex((a) => a === '-X' || a === '--method' || a.startsWith('--method='))
  if (i === -1) return 'GET'
  const brut = args[i].startsWith('--method=') ? args[i].slice('--method='.length) : (args[i + 1] ?? '')
  return brut.toUpperCase() || 'GET'
}

/** Corps de requête d'un `gh api --input <fichier>` VISANT UN TICKET : le chemin est SUR LA LIGNE, le
 *  fichier se LIT (même classe que le `-F <fichier>` d'un message de commit, lu depuis toujours).
 *  `{ chemin, etat }` si le corps est lisible, `{ chemin, illisible: true }` sinon, `null` sinon.
 *
 *  PÉRIMÈTRE, dit — le corps n'est LU que là où une fermeture est possible : endpoint d'UN ticket
 *  (`…/issues/<N>`) et méthode qui ÉCRIT. La création (`…/issues`), `graphql` et les GET passent en
 *  SILENCE, corps absent ou non : au PreToolUse leur fichier est souvent écrit par la commande
 *  elle-même, et un refus y mordrait un geste ROUTINIER. `--input -` (stdin) rend `null` : le corps
 *  n'existe nulle part avant l'exécution. */
function corpsInputGh(segment, lire) {
  const start = segment[0] === '&' ? 1 : 0
  if (basenameExecutable(segment[start]) !== 'gh') return null
  const args = segment.slice(start + 1)
  if (args[0] !== 'api') return null
  // L'endpoint se cherche parmi TOUS les arguments nus : à position fixe, la valeur d'un flag de tête
  // (`gh api -X PATCH /repos/…`) passerait pour lui.
  const viseUnTicket = args.some((a) => !a.startsWith('-') && ENDPOINT_UN_TICKET_RE.test(a))
  if (!viseUnTicket || methodeGh(args) === 'GET') return null
  const i = args.findIndex((a) => a === '--input' || a.startsWith('--input='))
  if (i === -1) return null
  const chemin = args[i].startsWith('--input=') ? args[i].slice('--input='.length) : (args[i + 1] ?? '')
  if (!chemin || chemin === '-') return null
  try {
    return { chemin, etat: JSON.parse(lire(chemin))?.state }
  } catch {
    return { chemin, illisible: true }
  }
}

/**
 * Décision « fermeture d'un ticket HORS commit ». Toute fermeture doit naître d'un `git commit`
 * porteur de `corrige #N` — c'est le seul chemin où le solde est exigé. Le corps d'un
 * `gh api --input <fichier>` est LU (`lire`, injecté par le driver depuis le répertoire d'exécution).
 *
 * HORS PORTÉE, dit : `gh api --input -`, dont le corps arrive par l'entrée standard. Un fichier
 * annoncé mais ILLISIBLE est refusé, jamais silencé (fail-closed sur sa propre annonce, comme le
 * `-F` d'un message de commit). Lire aussi la sortie de
 * `scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs`, qui joue ces cas.
 * @returns {{ decision: 'deny', reason: string } | null}
 */
export function evaluateFermetureHorsCommit(command, { lire = (p) => readFileSync(p, 'utf8') } = {}) {
  if (!command) return null
  const parCommit =
    `la fermeture passe par un commit \`corrige #N\` porteur de son solde (.claude/soldes/<N>.md) — ` +
    `le job \`fermetures\` de ci.yml (\`scripts/ops/fermer-depuis-main.mjs\`) ferme l'issue ET y poste ` +
    `le solde, après un \`build\` vert sur main. Fermer à la main court-circuite le contrôle entier.`
  for (const segment of segmentsProfonds(command)) {
    const forme = fermetureGh(segment)
    if (forme) {
      return { decision: 'deny', reason: `⛔ Fermeture de ticket HORS commit (${forme}) : ${parCommit}` }
    }
    const corps = corpsInputGh(segment, lire)
    if (!corps) continue
    if (corps.illisible) {
      return {
        decision: 'deny',
        reason:
          `⛔ Corps de requête \`gh api --input ${corps.chemin}\` illisible ou non-JSON pour le contrôle de ` +
          `fermeture — écrire un corps JSON lisible à ce chemin (fail-closed : pas de \`state: closed\` ` +
          `invisible).`,
      }
    }
    if (corps.etat === 'closed') {
      return {
        decision: 'deny',
        reason: `⛔ Fermeture de ticket HORS commit (gh api --input ${corps.chemin}, "state": "closed") : ${parCommit}`,
      }
    }
  }
  return null
}

/** `true` si la commande porte un geste `gh` que la porte de fermeture JUGE : fermeture directe, ou
 *  `gh api --input <fichier>` visant UN ticket (dont le corps sera lu). PUR : aucune lecture de
 *  fichier ici — le lecteur injecté JETTE, et un `--input` présent suffit à dire « geste jugé ». */
export function porteUnGesteGh(command) {
  if (!command) return false
  const sansLecture = () => { throw new Error('corps non lu : on ne décide ici que de JUGER') }
  return segmentsProfonds(command).some((s) => fermetureGh(s) !== null || corpsInputGh(s, sansLecture) !== null)
}

/**
 * Le geste que ce garde JUGE, ou `null`. DEUX gestes, et deux seulement : un `git commit` (tous les
 * évaluateurs de solde, de ticket, d'esquive, de juge, d'amend, de manifeste, d'arbre principal, de
 * hunks et de stocks s'ouvrent sur `isGitCommitCommand`) et une fermeture `gh` hors commit
 * (`evaluateFermetureHorsCommit`, le seul évaluateur qui ne demande pas de commit).
 *
 * Tout le reste ne se lit pas : une commande de LECTURE (`ls`, `wc`…) lançait `mesureDuPalier` et
 * `readChangedNames` dans son cwd, et un cwd hors dépôt faisait refuser « ascendance indisponible »
 * une commande qui n'avait rien à voir avec un commit (#1729 sonde 3).
 * @returns {'commit'|'fermeture'|null}
 */
export function gesteJuge(command) {
  if (!command) return null
  if (isGitCommitCommand(command)) return 'commit'
  return porteUnGesteGh(command) ? 'fermeture' : null
}

// ── Arbre PRINCIPAL vs worktree ───────────────────────────────────────────────────────────────────
// Régime 2026-09-01 : l'arbre principal est d'INTÉGRATION, les trains vivent en worktree
// `.wt-<ticket>-L<n>`. Un worktree lié porte un `.git` FICHIER (`gitdir: …`), l'arbre principal un
// `.git` DOSSIER : le fait se lit, il ne se déclare pas.

/** Nature du premier `.git` trouvé en remontant depuis `dir` : `'dossier'` (arbre principal),
 *  `'fichier'` (worktree lié), ou `null` — aucun dépôt, ou répertoire illisible. Les trois cas se
 *  DISTINGUENT : un prédicat booléen confondait « worktree lié » et « pas de dépôt du tout », et une
 *  permission accordée sur la réponse NÉGATIVE se donnait à un chemin inexistant. */
export function natureDeLArbre(dir = process.cwd()) {
  const racine = racineDeLArbre(dir)
  if (racine === null) return null
  try {
    return statSync(join(racine, '.git')).isDirectory() ? 'dossier' : 'fichier'
  } catch { return null }
}

/** Racine de l'arbre git qui contient `dir` — le premier dossier porté par un `.git` en remontant —,
 *  ou `null` s'il n'y en a aucun. */
function racineDeLArbre(dir = process.cwd()) {
  let courant = resolve(dir)
  for (;;) {
    if (existsSync(join(courant, '.git'))) return courant
    const parent = dirname(courant)
    if (parent === courant) return null
    courant = parent
  }
}

/** `true` si `dir` (ou un de ses ancêtres) est un arbre git dont le `.git` est un DOSSIER. */
export function estArbrePrincipal(dir = process.cwd()) {
  return natureDeLArbre(dir) === 'dossier'
}

/**
 * Le chemin d'un `tool_input` d'écriture (`file_path`, sinon `path`), résolu UNE fois à l'entrée d'un
 * hook : toute la suite (périmètre, lecture disque, message) travaille sur lui, jamais sur le brut
 * (#1973). Graphie MSYS `/x/…` rendue native (`versCheminNatif`), relatif résolu contre `base`, puis :
 * `reel` = `canoniser` (jonctions et liens suivis, fichier à créer compris) ; `racine` = l'arbre git
 * qui le contient, ou `null` ; `relatif` = POSIX sous `racine`, ou `reel` entier sans arbre.
 * `horsContenu` : le fichier n'est pas du contenu VERSIONNÉ du dépôt, et les hooks d'écriture s'y
 * taisent (#1973). Deux preuves POSITIVES, tirées de ce MÊME calcul :
 *   - hors dépôt : `racine` est `null` et l'ancêtre EXISTANT le plus proche n'est pas une racine de
 *     volume (lecteur absent, rien d'existant sous la racine : `false`, le hook garde) ;
 *   - ignoré : `git check-ignore -q` sur `reel`, depuis `racine` — un fichier SUIVI qu'un motif
 *     couvre n'est pas ignoré (`--no-index` absent à dessein).
 * Évalué au premier accès, une fois : le spawn git ne se paie que dans un dépôt, et seulement quand
 * le hook a quelque chose à dire. `null` quand le `tool_input` ne porte aucun chemin.
 * @returns {{ reel: string, racine: string|null, relatif: string, readonly horsContenu: boolean } | null}
 */
export function cheminDEcriture(toolInput, { base = process.cwd(), platform = process.platform } = {}) {
  const brut = toolInput?.file_path ?? toolInput?.path
  if (typeof brut !== 'string' || brut === '') return null
  const absolu = resolve(base, versCheminNatif(brut, platform))
  const ancetre = ancetreExistant(absolu)
  const reel = canoniser(absolu)
  const racine = racineDeLArbre(dirname(reel))
  const posix = (p) => p.split(sep).join('/')
  let horsContenu
  return {
    reel,
    racine,
    relatif: racine === null ? posix(reel) : posix(relative(racine, reel)),
    get horsContenu() {
      horsContenu ??= racine === null
        ? ancetre !== null && dirname(ancetre) !== ancetre
        : ignoreParGit(reel, racine)
      return horsContenu
    },
  }
}

/** `true` si git PROUVE que `reel` est ignoré dans l'arbre `racine`. Git indisponible, ou dépôt que
 *  git ne reconnaît pas : aucune preuve, `false` — le hook garde (`gitPorte.mjs`, `sortieOuNull`). */
function ignoreParGit(reel, racine) {
  const vu = lireGit(['check-ignore', '-q', '--', reel], { cwd: racine })
  if (!vu.disponible || vu.absent) return false
  return sortieOuNull(vu) !== null
}

/**
 * Décision « commit dans l'ARBRE PRINCIPAL ». `ask` (jamais `deny`) : les cas légitimes existent, et
 * une porte bloquante sur un geste ROUTINIER arrêterait le programme en l'absence de l'utilisateur.
 * @returns {{ decision: 'ask', reason: string } | null}
 */
export function evaluateArbrePrincipal({ command, principal = false, fichiersEmportes = [] }) {
  if (!command || !isGitCommitCommand(command) || !principal) return null
  const liste = fichiersEmportes.length
    ? `${fichiersEmportes.length} chemin(s) emporté(s) : ${fichiersEmportes.slice(0, 8).join(', ')}${fichiersEmportes.length > 8 ? ' …' : ''}`
    : 'aucun chemin emporté vu par le garde'
  return {
    decision: 'ask',
    reason:
      `⚠ Commit dans l'ARBRE PRINCIPAL (son .git est un DOSSIER) — ${liste}. Les commits se font en ` +
      `worktree \`.wt-<ticket>-L<n>\`, l'arbre principal est d'INTÉGRATION (régime 2026-09-01). ` +
      `Cas légitimes : conflit d'intégration, commit rectificatif, WIP orphelin.`,
  }
}

// ── Hunks stagés emportés par `git commit -- <paths>` ─────────────────────────────────────────────
// `git commit -- <paths>` prend le contenu de l'ARBRE DE TRAVAIL de ces chemins, PAS l'index : un
// stage par HUNK y est silencieusement annulé, et le WIP non stagé part dans le commit (incidents
// acf2a447, bb824bafb). Le geste réel est une SÉQUENCE de deux appels — la porte se pose donc sur
// le commit, jamais sur « les deux dans une commande ».

/** `true` si un segment `git commit` de la commande porte `-a`/`--all` (isolé ou groupé : `-am`).
 *  Les OPTIONS seules sont inspectées (`jetonsDuCommit`) : la valeur d'un `-m` n'en est pas une. */
function aFlagTout(command) {
  const jetons = command ? jetonsDuCommit(command) : null
  if (!jetons) return false
  return jetons.options.some((o) => o === '--all' || (!o.startsWith('--') && /^-[a-zA-Z]*a/.test(o)))
}

/**
 * Décision « le commit prendra l'ARBRE, pas l'index ». `fichiersModifies` = `git diff --name-only`
 * (non stagé), `fichiersStages` = `git diff --cached --name-only`. C'est le SEUL évaluateur dont le
 * sujet EST l'index : il compare ce que l'index porte à ce que la commande va prendre.
 * @returns {{ decision: 'deny', reason: string } | { contexte: string } | null}
 */
export function evaluateHunksEmportes({ command, fichiersModifies = [], fichiersStages = [] }) {
  if (!command || !isGitCommitCommand(command)) return null
  // `git commit -a` stage TOUT le modifié suivi avant de committer : même effet qu'un pathspec sur
  // l'arbre entier, même surprise (le WIP non stagé part), donc même mot.
  if (aFlagTout(command)) {
    const emportes = fichiersModifies.filter((f) => !fichiersStages.includes(f))
    if (emportes.length === 0) return null
    return {
      contexte:
        `Note : \`git commit -a\` emporte TOUT le modifié suivi, y compris ce que l'index ne porte ` +
        `pas : ${emportes.join(', ')}.`,
    }
  }
  const pathspecs = extractCommitPathspecs(command)
  if (pathspecs.length === 0) return null
  const nommes = fichiersModifies.filter((f) => pathspecs.some((ps) => pathMatchesPathspec(f, ps)))
  if (nommes.length === 0) return null
  const aussiStages = nommes.filter((f) => fichiersStages.includes(f))
  if (aussiStages.length > 0) {
    return {
      decision: 'deny',
      reason:
        `⛔ \`git commit -- <paths>\` prend le contenu de l'ARBRE et ignore l'index : ` +
        `${aussiStages.join(', ')} porte(nt) À LA FOIS des modifications stagées et non stagées — le ` +
        `stage par hunk serait annulé et le reste emporté. Committer sans pathspec (l'index fait foi), ` +
        `ou stager tout le fichier avant.`,
    }
  }
  return {
    contexte:
      `Note : ${nommes.join(', ')} porte(nt) des modifications NON stagées ; \`git commit -- <paths>\` ` +
      `les emportera (il prend l'arbre, pas l'index).`,
  }
}

// ── Stock nominatif qui naît ou grandit ───────────────────────────────────────────────────
// Un stock nominatif est une DETTE vers zéro (`scripts/guards/lib/stock.mjs`) ; l'append y est
// toujours le chemin le plus court vers une CI verte. La porte le rend VISIBLE au commit : la
// croissance passe si, et seulement si, le message la DIT.

/**
 * Décision « un stock nominatif a grossi sans que le message le dise ». `command` = texte du
 * message (comme les autres évaluateurs), `diff` = diff unifié de ce que le commit emporte
 * (les fichiers porteurs suffisent), `images` = les lecteurs de pré/post-image qui décident la
 * PORTÉE DE MODULE d'une entrée. Ne se prononce que sur un `git commit`.
 * @returns {{ decision: 'deny', reason: string } | null}
 */
export function evaluateStocksQuiGrandissent({ command, diff, images }) {
  if (!command || !isGitCommitCommand(command) || !diff) return null
  const restantes = croissancesNonCouvertes({ diff: diff, message: command ?? '' }, images)
  return restantes.length ? { decision: 'deny', reason: raisonDeRefus(restantes) } : null
}

/**
 * Le refus d'un commit qui fait GRANDIR le contexte permanent au-delà du plafond de sa pré-image sans
 * le DIRE (`CLIQUET:`). La mesure vient de ce que le commit EMPORTE, la référence et le plafond de sa
 * pré-image : c'est la même discipline de lecture que `evaluateStocksQuiGrandissent`.
 * @returns {{ decision: 'deny', reason: string } | null}
 */
export function evaluateBudgetContexte({ command, mesure, reference, plafond }) {
  if (!command || !isGitCommitCommand(command)) return null
  return refusDeBudget({ mesure, reference, plafond, message: command })
}

/**
 * Les entrées DIRECTES d'un dossier telles qu'une IMAGE git les porte — noms simples, triés,
 * dédupliqués, le contrat de `readdirSync` qu'attend `mesurerBudget`. Le LISTAGE est par image comme
 * la lecture : `['ls-files', '--cached']` dit ce que le commit emporte, `['ls-tree', '--name-only',
 * 'HEAD']` ce que sa pré-image portait. Un listage de DISQUE commun aux deux rendait une skill
 * SUPPRIMÉE par le commit absente de la référence elle-même — la porte concluait alors « aucun poste
 * ne grossit ». `ls-files` rend les FEUILLES et `ls-tree` les enfants directs : le premier segment
 * sous `<dossier>/` est la même notion pour les deux. Git muet (dépôt sans HEAD, hors dépôt) → `[]`,
 * comme le listeur de disque devant un dossier absent.
 * @param {string[]} args @param {string} dir @returns {(dossier: string) => string[]}
 */
export function listeurDImage(args, dir) {
  return (dossier) => {
    const prefixe = `${dossier}/`
    const sortie = sortieOuNull(lireGit([...args, prefixe], { cwd: dir }))
    if (sortie === null) return []
    const noms = new Set()
    for (const ligne of sortie.split(/\r?\n/)) {
      const rel = ligne.trim().replace(/\\/g, '/')
      if (!rel.startsWith(prefixe)) continue
      const nom = rel.slice(prefixe.length).split('/')[0]
      if (nom) noms.add(nom)
    }
    return [...noms].sort()
  }
}

/** Décision d'ensemble d'un cumul de refus (patron de driver partagé avec `commande-piege-guard` :
 *  la décision est PORTÉE par l'évaluateur, `deny` à défaut). `null` si aucun refus, sinon la PLUS
 *  STRICTE — un seul `deny` fait basculer tout le cumul — et les raisons jointes. */
export function decisionCumulee(decisions) {
  const refus = decisions.filter(Boolean)
  if (refus.length === 0) return null
  return {
    decision: refus.some((d) => (d.decision ?? 'deny') === 'deny') ? 'deny' : 'ask',
    reason: refus.map((d) => d.reason).join(' || '),
  }
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let command = ''
  // Canal MCP `ctx_shell` : son `tool_input` porte, en plus de `command` (même nom que
  // Bash/PowerShell), un `cwd` PERSISTANT propre au canal — le process hook, lui, démarre à
  // la racine de la session. Sans lui, un commit lancé depuis un worktree via ctx_shell
  // ferait lire l'index de l'arbre principal. Il sert de base à `extractTargetDir` (un
  // `cd`/`git -C` dans la commande garde la priorité).
  let baseCwd = process.cwd()
  try {
    const toolInput = JSON.parse(raw)?.tool_input
    command = String(toolInput?.command ?? '')
    if (typeof toolInput?.cwd === 'string' && toolInput.cwd) baseCwd = resolve(process.cwd(), toolInput.cwd)
  } catch { /* stdin illisible → silence */ }
  // Date LOCALE (pas UTC) : un solde écrit après minuit heure locale porte la date locale.
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // Le répertoire cible n'est retenu que s'il EXISTE : sinon git y rendrait un ENOENT de spawn, et
  // la porte refuserait « ascendance indisponible » un geste que git exécute (#1729). Ce qui a été
  // écarté est DIT dans le refus, jamais avalé.
  const cible = cibleDeLaCommande(command, baseCwd)
  const targetDir = cible.dir ?? baseCwd
  // `npm run <x>` se résout dans le package.json du dépôt où la commande s'exécute (un
  // `cd <autre dépôt> && npm run x` n'y lit pas les scripts de CE dépôt-ci) — même discipline
  // d'ancrage que `targetDir` pour l'index, le message `-F` et l'histoire git.
  ancrerScriptsNpm(targetDir)
  // HORS des deux gestes jugés (commit, fermeture `gh`), le garde ne lit RIEN : ni l'index, ni le
  // palier, ni l'arbre. Une commande de lecture dans un répertoire hors dépôt se faisait refuser par
  // l'ascendance d'un commit qu'elle ne portait pas (#1729 sonde 3).
  if (!gesteJuge(command)) process.exit(0)
  // HOTE UNIQUE de sortie : TOUT refus rendu par ce driver passe ici, donc porte la cible écartée
  // (un second `console.log` au site la perdait — le refus `-F illisible` jugeait le cwd de session
  // sans le dire).
  const rendre = (decision) => {
    const dit = avecCibleIgnoree(decision, cible.ignore)
    if (!dit) return false
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: dit.decision,
        permissionDecisionReason: dit.reason,
      },
    }))
    return true
  }
  // Le contenu jugé est celui que le commit va EMPORTER, pas l'index : la forme de la commande le
  // décide (`diffDuCommit`), et toutes les évaluations lisent par cette même porte.
  const commit = diffDuCommit(command, targetDir)
  // Un renommage se replie en `{ancien => nouveau}` dans le `--numstat` : ce chemin ne nomme aucun
  // fichier, n'égale aucun site cité par un solde et ne se lit comme aucun écran. La relecture
  // DÉPLIÉE ne se paie que là où elle change quelque chose.
  const numstat = commit.numstat()
  const { touchesSrc, touchesUi, totalLines, fichiers } =
    analyzeDiffDuCommit(numstat, numstat.includes(' => ') ? commit.cheminsSansRenommage() : null)

  // Message `-F <chemin>` : résolu dans le répertoire où le `git commit` s'exécute RÉELLEMENT
  // (targetDir), jamais dans celui d'où part la commande — un `cd wt && git commit -F m.txt`
  // désignait sinon un fichier homonyme de l'arbre de départ (fermeture invisible = fail-open).
  const { text, fileError } = extractMessageSources(command, { cwd: targetDir })
  if (fileError) {
    rendre({
      decision: 'deny',
      reason:
        `⚠ Message de commit en fichier illisible pour le contrôle de solde (-F/--file "${fileError}") ` +
        `— utiliser -m ou un chemin lisible (fail-closed : pas de fermeture ni de réfutation invisibles).`,
    })
    process.exit(0)
  }

  // Le mtime plancher de la capture de recette est celui du DERNIER fichier d'écran stagé : une
  // capture antérieure au geste montre l'écran d'avant.
  const mtimeEcrans = mtimeMaxDe(fichiers.filter(estFichierEcran), targetDir)
  // Lecture PARESSEUSE et unique : elle a lieu DANS le juge, donc une indisponibilité de git y est
  // rattrapée et NOMMÉE au lieu d'emporter le hook.
  let revuesVues = null
  const revuesDuGeste = () => (revuesVues ??= revuesDuCommit(revuesNeuves(targetDir), fichiers))
  const decision = jugerOuNommerLIndisponible(() => evaluate({
    command: text,
    today,
    // Le solde LU est celui que le commit EMPORTE (`commit.contenu`) : sous un commit par pathspec,
    // un solde stagé hors pathspec reste à la version de HEAD et la preuve ne part pas.
    readSolde: (n) => commit.contenu(`.claude/soldes/${n}.md`),
    soldeOnDisk: (n) => readSoldeFile(n, targetDir),
    palier: mesureDuPalier(targetDir),
    // La revue qui franchit le palier est celle que ce commit AJOUTE **et** EMPORTE : elle naît sous
    // son nom d'archive. Une revue posée sur le disque sans être stagée, ou stagée hors des pathspecs
    // de la commande, ne part pas avec le commit — donc ne franchit rien. Même règle que le solde.
    neuves: () => revuesDuGeste().emportees.map((r) => ({ ...r, contenu: commit.contenu(r.chemin) ?? r.contenu })),
    omises: () => revuesDuGeste().omises,
    dansHead: (sha) => estDansHead(sha, { cwd: targetDir }),
    contexteSolde: {
      fichiersEmportes: fichiers,
      lignesEmportees: (f) => lignesDeHunks(commit.fichier(f)),
      touchesUi,
      verifierCaptureDe: (chemin) => verifierCapture(chemin, { racine: targetDir, mtimeMin: mtimeEcrans }),
      commitEstAncetre: (sha) => estDansHead(sha, { cwd: targetDir }),
      fichiersDuCommit: (sha) => fichiersDuCommitGit(sha, targetDir),
      lignesDuCommit: (sha, fichier) => lignesDeHunks(diffDunSha(sha, fichier, targetDir)),
    },
  }), { cwd: targetDir, horsDepot: natureDeLArbre(targetDir) === null })
  // La porte du ticket juge le lot que le commit EMPORTE (`fichiers`), pas l'index : c'est la même
  // lecture que toutes les autres évaluations de ce driver.
  const porteDuTicket = evaluatePorteDuTicket({ command: text, fichiersEmportes: fichiers })
  // TOUT ce que le garde lit sur DISQUE se lit dans le répertoire où le commit s'exécute — comme le
  // solde stagé, la mesure du palier, le message `-F` et la revue de palier. Lu depuis le dépôt du HOOK, un
  // fichier de réfutation écrit dans le worktree était invisible, et la porte refusait à tort.
  const antiEsquive = evaluateAntiEsquive({
    command: text,
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    readRefFile: (n) => readRefFile(n, targetDir),
  })
  const juge = evaluateJuge({
    command: text,
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    stagedTouchesUi: touchesUi,
    readRefFile: (n) => readRefFile(n, targetDir),
  })
  const amendInvisible = evaluateAmendInvisible({ command, stagedTouchesSrc: touchesSrc })
  const registresPorteurs = evaluateRegistresPorteurs({ command: text, lireRegistreEmporte: (chemin) => commit.contenu(chemin) })
  // Corps `--input <chemin>` : résolu là où la commande s'exécute RÉELLEMENT, comme le `-F` du commit.
  const horsCommit = evaluateFermetureHorsCommit(command, {
    lire: (chemin) => readFileSync(resolve(targetDir, chemin), 'utf8'),
  })
  // Volet anti-tombale : `commentPoison` tire le vocabulaire RAW derrière lui — chargé SEULEMENT
  // quand la commande ferme un ticket.
  const fermes = extractClosedIssues(text)
  let tombale = null
  if (fermes.length > 0) {
    const { evaluateTombale } = await import('./solde-tombale.mjs')
    tombale = evaluateTombale({
      issuesFermees: fermes,
      fichiers: fichiersCitantTickets(fermes, targetDir),
      lire: (p) => commit.contenu(p),
    })
  }
  const arbrePrincipal = evaluateArbrePrincipal({
    command,
    principal: estArbrePrincipal(targetDir),
    fichiersEmportes: fichiers,
  })
  const hunks = evaluateHunksEmportes({
    command,
    fichiersModifies: readChangedNames(targetDir),
    fichiersStages: readChangedNames(targetDir, { cached: true }),
  })
  // Diff des seuls fichiers PORTEURS de stock : le `-U0` par fichier existe déjà (même lecture que
  // les preuves au site), et le lot entier ne se relit pas pour une poignée de fichiers. Hors
  // `git commit`, aucun `git diff` n'est payé — ni le compilateur chargé par les images.
  const porteursDeStock = isGitCommitCommand(text) ? fichiers.filter(estPorteurDeStock) : []
  const stocks = evaluateStocksQuiGrandissent({
    command: text,
    diff: porteursDeStock.map((f) => commit.fichier(f)).join('\n'),
    images: { lirePostImage: commit.contenu, lirePreImage: commit.avant },
  })
  // BUDGET DU CONTEXTE PERMANENT : mesuré seulement si le commit touche un chemin du périmètre —
  // sinon aucune lecture n'est payée au-delà de l'image de `CLAUDE.md`, qui dit les fichiers IMPORTÉS
  // (`@<chemin>`) et donc le périmètre lui-même : post-image si le commit l'emporte, pré-image sinon.
  // La mesure porte sur ce que le commit EMPORTE (`commit.contenu`), la référence et le plafond sur sa
  // PRÉ-IMAGE (`commit.avant`) : relever la ligne du plafond dans le même commit ne suffit donc pas à
  // faire passer une accrétion. Le LISTAGE des skills/agents se lit PAR IMAGE lui aussi — l'index pour
  // ce que le commit emporte, `HEAD` pour la référence — sans quoi un poste SUPPRIMÉ par le commit
  // disparaîtrait des DEUX côtés et le refus dirait « aucun poste ne grossit ».
  const importsDuContexte = importsDe(commit.contenu('CLAUDE.md') ?? commit.avant('CLAUDE.md'))
  const budget = fichiers.some((f) => estCheminDuBudget(f, importsDuContexte))
    ? evaluateBudgetContexte({
      command: text,
      mesure: mesurerBudget(targetDir, { lire: commit.contenu, lister: listeurDImage(['ls-files', '--cached'], targetDir) }),
      reference: mesurerBudget(targetDir, { lire: commit.avant, lister: listeurDImage(['ls-tree', '--name-only', 'HEAD'], targetDir) }),
      plafond: plafondDeLaSource(commit.avant(PORTEUR_DU_PLAFOND)),
    })
    : null
  const rendu = rendre(decisionCumulee([
    decision, porteDuTicket, antiEsquive, juge, amendInvisible, registresPorteurs,
    horsCommit, tombale, arbrePrincipal, hunks?.decision ? hunks : null, stocks, budget,
  ]))
  if (!rendu && hunks?.contexte) {
    console.log(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: hunks.contexte },
    }))
  }
  process.exit(0)
}
