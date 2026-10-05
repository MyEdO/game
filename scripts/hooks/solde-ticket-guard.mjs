// Hook PreToolUse(`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : demande utilisateur 2026-07-14
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
// finalement. A toi de voir » : chaque solde porte sa propre réfutation adversariale (verdict
// CONFIRMÉ/PARTIEL/RÉFUTÉ). La revue PAR TICKET est la seule : décision utilisateur du 2026-10-05
// (#2365, verbatim) — « Pour moi la revue de palier de 10 tickets n'a plus aucun sens. Autant une
// review sur le ticket sur son ensemble OK, mais pas un mélange de commit entre ticket de chantier
// séparé ».
//
// Extension 2026-07-14 (constat utilisateur, verbatim) — « je pensais que tu avais un hook qui te
// forceait a faire une review reversal, elle ne doit clairement pas marcher » puis « Ou alors
// seulement sur les tickets ? » : un commit « ref #N » (rattaché SANS fermer) échappait à tout
// regard adversarial. Anti-esquive — un commit `ref #N` qui touche `src/**` (≥10 lignes de diff
// staged) exige lui aussi sa réfutation (ligne `REFUTATION:` dans le message, ou fichier
// `.claude/soldes/ref-<N>.md`).
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
//   `evaluateAmendInvisible`      amend, ou message hérité (`-C`/`-c`/`--fixup`/`--squash`), qui
//                                 échappe au contrôle ;
//   `evaluateRegistresPorteurs`   ticket encore porté par un registre de `registres-porteurs.json` ;
//   `evaluateFermetureHorsCommit` `gh issue close` & co — la fermeture passe par le commit ;
//   `evaluateTombale`             (scripts/hooks/solde-tombale.mjs) commentaire de dette citant le
//                                 ticket fermé ;
//   `evaluateHunksEmportes`       `git commit [-i] [--] <paths>` qui prendrait l'arbre au lieu de
//                                 l'index ;
//   `evaluateStocksQuiGrandissent` stock nominatif qui naît ou grandit sans `CLIQUET:` au message ;
//   `evaluateReclassementsCss`    module qui FRANCHIT la frontière CSS (`reclassementCss.mjs`) sans
//                                 `RECLASSEMENT:` au message, ou ligne sans franchissement.
//
// FUSION EN COURS (`MERGE_HEAD`, #2328, Attendu) — « Sauver une fusion résolue est un geste de
// CONSERVATION, pas une livraison. Il se commite et se pousse sans les trailers de livraison. » :
// `evaluateAntiEsquive` et `evaluateJuge` se TAISENT ; toutes les évaluations qui lisent le DIFF du
// commit jugent son APPORT PROPRE (de sa fusion automatique à l'image qu'elle commite, `diffDuCommit`),
// jamais ce que ses parents fusionnés apportent. Une fusion PROPRE n'apporte rien ; la commande ferme
// toujours ses tickets par leur solde. Le pre-commit lit le même apport (`scripts/git-hooks/pre-commit.mjs`).
// Sa RÉSOLUTION se juge à la PUBLICATION (`fusionsNonJugees`, scripts/guards/lib/livraison.mjs) : au moins
// `SUBSTANTIVE_MIN_LINES` lignes changées sous src/ exigent, d'un commit postérieur de la plage, `JUGE:` et
// `REFUTATION:` (plus `JUGE-VISION:` sur un écran) qui nomment son sha.
//
// COÛT, et pourquoi le `timeout: 10` de `.claude/settings.json` (et son miroir `.codex/hooks.json`)
// reste à 10 s. Un hook tué au `timeout` n'émet RIEN, et le geste passe. D'où DEUX ÉTAGES : le premier
// prend toutes les décisions que rien d'autre ne rejuge et sort au premier refus ; le second juge les
// stocks et les reclassements, que le pre-push (`scripts/git-hooks/pre-push.mjs`,
// `croissancesDeLaPlage`) rejuge. Mesuré le 2026-09-24, `.wt-1806`, 4 cœurs, charge 6 à 15 à
// `/proc/loadavg`, dépôts jetables : hook entier 0,11-0,13 s hors commit, 1,2-1,5 s sur un index vide.
// Lot `-a` de 3 686 modules de `src/` : l'étage 1 rend son refus en 1,4-3,1 s ; l'étage 2 y lit les
// stocks en 8,2-9,5 s (1 716 porteurs, dont un `git diff` de 0,96 s ; le reste est l'évaluation), plus
// les reclassements (1,8-3,9 s), donc il expire. Lot réel de 10 fichiers (07d9f850d) : stocks 46-48 ms.
// Les captures citées (`verifierCaptures`) et les shas cités par « corrigé par »
// (`histoireDesCitations`, sur le graphe de HEAD lu une fois, `histoireDeHead`) de TOUS les soldes
// se lisent chacun en UN lot, compté au PROCESSUS (`lancesDeGit`, `scripts/test/gitDeBanc.mjs`). Hook
// entier, processus neuf préchargé d'un compteur de lancements, dépôt jetable, mesuré le 2026-10-05
// sous win32 (16 cœurs) : 37 processus git pour 1 comme pour 8 tickets fermés, chacun avec son solde
// à citation et sa capture, et ses fichiers stagés (src, écran, scripts, porteur de stock). La lecture du graphe croît avec l'HISTOIRE : 133 à 387 ms, 455 Ko et
// +9,7 Mo de tas à 5 480 commits.
// VERSION DE GIT : une citation se lit sur le graphe, qui exige git 2.33 (`rev-list
// --no-commit-header`) ; une FUSION citée exige git 2.40 (`merge-tree --write-tree --stdin`,
// `exigerMergeTree`). Sous un git plus ancien, le refus NOMME la version requise (`versionManquante`,
// `gitPorte.mjs`).
// Ce qu'une expiration de l'étage 2 PERD :
//   - le refus des stocks et des reclassements au commit. Restent, pour les STOCKS, le pre-push puis
//     la CI, qui rejuge la plage poussée a posteriori (`scripts/hooks/stocks-nominatifs.test.mjs`,
//     « CLIQUET stocks », joué par `npm run test:hooks`) ; pour les RECLASSEMENTS, le pre-push seul.
//     Le filet des stocks est plus lâche : un commit n'y est refusé que si la croissance CUMULÉE de
//     la plage reste positive (`refusDeLaPlage`, `plageStock.mjs`) ;
//   - la note `additionalContext` des modifications non stagées qu'emporte le commit (fin de `evaluerSolde`,
//     `evaluateHunksEmportes`), rendue seulement quand l'étage 2 ne refuse rien.
// `--no-verify` n'est refusé nulle part : un
// `git push --no-verify` saute le pre-push, donc le seul filet des reclassements, pas la CI. Ce chiffre
// se re-mesure quand une décision change d'étage ou que l'étage 1 s'alourdit.
// Re-mesuré le 2026-09-27 pour la LECTURE de la commande (`commitsDe`, linéaire en jetons) :
// `x` + `git`×N + `; git commit -a -m y` — détection et forme en 38 ms (N = 20 000, 80 Ko), 67 ms
// (N = 50 000, 200 Ko), 214 ms (N = 200 000, 800 Ko) ; le vrai hook, N = 50 000 sur un `src/`
// modifié, refuse en 1,8 s. Pire cas mesuré par le juge du lot H (6e passe), même date :
// `sh -c 'true' ; `×50 000 + `git commit -a -m y` (750 Ko), vrai hook 7,7 s (9,0 s avant le lot) —
// chaque évaluation relisait la commande. Lectures mémoïsées par commande (`memoParCommande`) :
// 6,1 s → 4,3 s sur une copie jetable du dépôt à un fichier `src/` modifié (7,7 s → 5,3 s sur l'arbre
// du lot), le reste étant git et la mesure des stocks.
//
// LECTURE DE LA COMMANDE (`segmentsProfonds`, `commitsDe`) — ce qu'elle reconnaît, et rien d'autre :
//   - découpage : quotes, here-strings, heredocs (leur corps n'est pas une commande), enchaînements
//     `;` `&&` `||` `|`, sous-shells `( … )` ;
//   - tête d'un segment, épluchée jusqu'à stabilité : jetons nus et mots réservés (`TOKENS_TETE_NUS`),
//     affectations `VAR=val` (relevées par nom, `affectationsDEnvironnement`), enrobeurs de tête (`ENROBEURS_TETE`) ;
//   - porteurs de chaîne (`ENROBEURS_ARGUMENT`), relus comme une commande : l'argument de `sh`/`bash`/
//     `dash`/`zsh -c`/`-lc`, `npx -c`/`--call`, `Invoke-Expression`, `powershell`/`pwsh
//     -EncodedCommand` ; tout le reste de la ligne, joint par des espaces, après `cmd /c`/`/k` (ou
//     `//c`/`//k`, graphie Git Bash), `powershell`/`pwsh -Command`/`-c` et `eval` ; la chaîne de
//     `env -S`/`--split-string` suivie des arguments restants ; et `npm run <x>` (`npm test`/`start`/`stop`/`restart`), dont le script est
//     lu dans le `package.json` du dépôt de la portée (`racineNpmCourante`) ;
//   - blocs PowerShell (`TETES_DE_BLOC` : `%`, `ForEach-Object`, `foreach`, `for`, `try`, `catch`,
//     `finally`…) : le corps de chaque `{ … }` relu comme une commande (`lectureDesBlocs`) ;
//   - substitutions `$(…)`, `` `…` ``, `@(…)`, et de processus `<(…)`, `>(…)`, nues ou sous quote double
//     (`$(…)` seule dans une here-string `@"…"@`) : leur contenu relu comme une commande exécutée, où
//     qu'elles se trouvent dans le segment ;
//   - commit DIRECT : `git [options globales] commit` en tête d'un segment ainsi lu ;
//   - commit EMBARQUÉ : sous une tête qui n'est pas CITEUSE, un `git … commit` en argv, ou un argument
//     à espace — la valeur d'un jeton `<clé>=<valeur>` comprise — relu comme une commande. CITEUSE :
//     une tête de `CITEURS`, ou `git` sous une sous-commande hors `SOUS_COMMANDES_GIT_EXECUTANTES`
//     (`rebase`, `bisect`, `submodule` : `rebase -x '…'`, `bisect run …`, `submodule foreach '…'`,
//     `git -c sequence.editor='…' rebase -i` sont lus), ou une affectation PowerShell `$nom = ` dont la
//     valeur est citée (`affectationPowerShell`) ;
//   - aide : un commit, direct ou embarqué, qui porte `-h`/`--help` n'en est pas un (git rend l'aide) ;
//   - profondeur : `PROFONDEUR_MAX_ENROBEURS` niveaux de porteurs et `SEGMENTS_MAX` segments relus ;
//     au-delà, les gardes consommatrices refusent la commande (`REFUS_SATURE`), la garde de commit
//     présume un commit embarqué.
// Tout autre chemin par lequel un commit s'exécute n'est pas vu (#2071, qui le juge dans le hook git
// `commit-msg`, où le vrai commit est visible). Témoins, figés par les bancs « #2071 NON COUVERT » du
// fichier de tests : `GIT_SEQUENCE_EDITOR="sh -c '…'" git rebase -i`,
// `GIT_PAGER=… git log`, `GIT_EDITOR=… git tag -a v9` (variable de tête consommée par git) ;
// `git -c core.editor='git commit -a' tag -a v9`, `git -c alias.ci='!git commit -a' ci` (sous-commande
// citeuse qui exécute) ; `gh alias set --shell ci 'git commit -a' && gh ci` (tête citeuse qui
// exécute) ; `git merge --no-ff -m x autre`, `git cherry-pick <sha>` (porcelaine) ; `git ci -a` (alias
// du `.gitconfig`) ; `echo 'git commit -a' | sh`, `bash <<'EOF'` (corps sur stdin) ;
// `printf 'commit -a' | xargs git` ; `G=git; $G commit -a` ; `bash ./x.sh`, `make release`,
// `node --run c`, `yarn c`, `npm --prefix ../autre run c` (script hors du dépôt ancré) ;
// `python3 -c "os.system('git commit -a')"` (interpréteur non shell).
import { Buffer } from 'node:buffer'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { estPorteurDeStock, nonCouvertesDuBilan, raisonDeRefus } from '../guards/lib/stocksNominatifs.mjs'
import { bilanDuCommit, entreeDeFusion, lecturesDeFusion } from '../guards/lib/plageStock.mjs'
import {
  deplaceLaFrontiere, lignesDeReclassement, raisonDeRefusDeReclassement, reclassementsNonDeclares,
} from '../guards/lib/reclassementCss.mjs'
import { coteCss, sourceGit, sourceMelee } from '../guards/lib/cssImages.mjs'
import {
  PORTEUR_DU_PLAFOND, estCheminDuBudget, importsDe, mesurerBudget, plafondDeLaSource, refusDeBudget,
} from '../guards/budget-contexte.mjs'
import {
  GitIndisponible, INDEX, SUIVI, apportDeLaFusionEnCours, ceQueFontLesCommits, ceQuiChange, cheminsIgnores, depotDe, enfantsDirects, estIgnore,
  estRepertoire, etatDeLArbre, fichiersDuGrep, fusionnesEnCours, histoireDeHead, imageDeHead, listerImage, shaDe, refusDeGit,
} from '../guards/lib/gitPorte.mjs'
import { hunksDe } from '../guards/lib/hunks.mjs'
import { ancetreExistant, canoniser } from '../docs/lib/chemin-mesure.mjs'
import { SUBSTANTIVE_MIN_LINES, TRAILERS, corpsDuTrailer, estFichierEcran, sectionDe } from '../guards/lib/livraison.mjs'
import { motifRattachement, numerosCites, numerosDeLaChaine, numerosFermes, numerosNusEnumeres } from '../guards/lib/fermetures.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { LECTEURS } from '../guards/lib/appelsRunners.mjs'
import { OUTILS_SHELL, cheminVise, commandeDe, decisionCumulee, verdictDe } from '../guards/lib/contratGarde.mjs'
import { racineNpmCourante } from '../guards/lib/racineNpm.mjs'

// Message passé par FICHIER (`git commit -F <path>` / `--file <path>` / `--file=<path>`) : le
// la garde ne voit que `tool_input.command` — un message packé dans un fichier externe y est
// INVISIBLE, ce qui (a) bloque à tort une fermeture légitime (aucun "corrige #N" vu dans la commande)
// et (b) pire, laisse le closer de publication (qui LIT le vrai message du commit poussé) fermer un
// ticket SANS être passé par ce contrôle de solde. Fix découvert en production 2026-07-14.

/** Message de CHAQUE commit de la commande (`commitsDe`), dans l'ordre : `{ texte, fichier, direct,
 *  tete, herite }`. `texte` = ses `-m`/`--message`, ou le contenu de son `-F <path>` / `--file <path>`
 *  / `--file=<path>` (lu via `readFile`, résolu relatif à `cwd`) ; pour un `--amend` qui n'en porte
 *  pas et ne nomme pas son message ailleurs (`-C`/`-c`), le texte du commit DIRECT qui le précède
 *  dans la commande (`herite`) ; `null` sinon (éditeur, message d'un autre commit, commit présumé). `fichier` = lu dans un `-F` ; `tete` = `git` pour un
 *  commit direct, la tête qui porte un commit embarqué, `null` pour le présumé de saturation. Chaque commit se lit DANS ses propres jetons, jamais ailleurs dans la ligne, sur la
 *  grammaire de `lireCommit` (lettres groupées, abréviations). Sémantique git : `-m` et `-F` sont
 *  MUTUELLEMENT EXCLUSIFS (git refuse la combinaison) — le PREMIER des deux rencontré tranche, et un
 *  `-m` signifie donc qu'aucun fichier de message n'existe (faux positif vécu : un message -m citant
 *  « via -F et, » a fait chercher le fichier « et, »). Le SEGMENT est la seconde borne, mesurée le
 *  2026-09-04 : `gh api -X PATCH … -F corps=@fichier` (où `-F` est un CHAMP de formulaire, pas un
 *  fichier de message) et une ligne de todo qui cite ce drapeau étaient refusés « message de commit
 *  en fichier illisible » — un drapeau ne vaut que dans le segment de la commande qui le lit.
 *  `fileError` = le PREMIER chemin illisible ; la lecture s'y arrête. */
export function messagesDesCommits(command, { readFile = readFileSync, cwd = process.cwd() } = {}) {
  const messages = []
  let precedent = null
  for (const commit of command ? commitsDe(command) : []) {
    const { options } = lireCommit(commit)
    const premier = options.find((o) => o.nom === 'message' || o.nom === 'file')
    let texte = null
    if (premier?.nom === 'file' && premier.valeur) {
      try {
        texte = readFile(resolve(cwd, premier.valeur), 'utf8')
      } catch {
        return { messages, fileError: premier.valeur }
      }
    } else if (premier?.nom === 'message') {
      texte = options.filter((o) => o.nom === 'message' && o.valeur !== null).map((o) => o.valeur).join('\n\n')
    }
    const herite = texte === null && !commit.embarque && precedent !== null && porteOption(options, 'amend')
      && !porteOption(options, 'reuse-message') && !porteOption(options, 'reedit-message')
    if (herite) texte = precedent
    const tete = commit.embarque ? (commit.origine?.tete ?? null) : 'git'
    messages.push({ texte, fichier: premier?.nom === 'file', direct: !commit.embarque, tete, herite })
    if (!commit.embarque) precedent = texte
  }
  return { messages, fileError: null }
}

/** Texte COMPLET à analyser pour la fermeture/réfutation : la commande elle-même + le contenu des
 *  fichiers `-F`/`--file` de TOUS ses commits (`messagesDesCommits`), dans l'ordre des commits. Le
 *  gate « est-ce un git commit » continue de s'appliquer sur la commande seule (un fichier ne la
 *  contient jamais). `messages` = le message de chaque commit ; `fileError` = le premier chemin
 *  illisible (fail-closed : ne JAMAIS retomber en silence sur un -F cassé). */
export function extractMessageSources(command, options = {}) {
  if (!command) return { text: '', fileError: null, messages: [] }
  const { messages, fileError } = messagesDesCommits(command, options)
  if (fileError) return { text: command, fileError, messages }
  const fichiers = messages.filter((m) => m.fichier).map((m) => m.texte)
  return { text: [command, ...fichiers].join('\n'), fileError: null, messages }
}

// ── Parsing STRUCTUREL de la ligne de commande (#591 défaut 3) ───────────────────────────────────
// « est-ce un `git commit` ? » ne se décide plus par un grep de sous-chaîne sur la ligne entière
// (un `gh issue create --body "... git commit ..."` la faisait mordre à tort) : on TOKENISE la
// commande (quotes simples/doubles + here-strings PowerShell `@'…'@`/`@"…"@`), on la découpe en
// segments aux enchaînements top-level (`&&`, `;`, `||`, `|`), puis on identifie dans CHAQUE segment
// l'exécutable de tête et sa sous-commande (`git [-C <path>|-c <k=v>|...] commit`).
// Un `git commit` porté en ARGUMENTS n'est une citation que sous une tête CITEUSE (`CITEURS`, table
// fermée) : sous toute autre tête il est présumé exécuté, donc EMBARQUÉ (`commitsDe`), et la forme
// du commit retombe sur le sur-ensemble dès qu'il n'est pas le seul commit, direct (`jetonsDuCommit`).
// Ouverture d'un HEREDOC (`<<EOF`, `<<-'EOF'`, `<<"EOF"`) : ce qui suit, à partir de la LIGNE
// suivante et jusqu'à la ligne qui répète le mot, est une DONNÉE écrite par la commande, pas des
// commandes — sauf pour un shell qui lit son stdin (`bash <<'EOF'`, NON COUVERT, #2071). Sans cette
// borne, le corps se tokenisait : ses `;`/`&&` ouvraient des segments et une ligne de PROSE citant
// « git commit » devenait un commit (`cat > f.md <<'EOF' … EOF` d'un commentaire de ticket, demande
// de confirmation sur une écriture de fichier, #1729 sonde 6).
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

/** Jetons de la commande : `{ text, op, quote }`. `op` nomme un enchaînement (`&&`, `||`, `;`,
 *  `|`) ; `quote` est la PROVENANCE du mot — `'simple'` s'il est ENTIÈREMENT sous quote simple
 *  (`'…'`, `$'…'`, here-string `@'…'@`), `'double'` s'il l'est sous quote double (`"…"`,
 *  `@"…"@`), absente sinon (mot nu, ou mêlant nu et quoté, ou deux sortes de quote). */
function tokenizeCommand(command) {
  const tokens = []
  let i = 0
  const n = command.length
  // Mots de fin des heredocs ouverts sur la ligne EN COURS : leurs corps commencent au prochain
  // saut de ligne, dans l'ordre d'ouverture.
  let heredocs = []
  // `(` en TÊTE de commande (début de segment, après `!`, `{`, `(`, un mot réservé ou `time`) ouvre
  // un sous-shell, que ferme le `)` hors quote correspondant ; `$(` ouvre une SUBSTITUTION, qui reste
  // dans le mot jusqu'à sa parenthèse fermante (`substitutions` du jeton).
  let sousShells = 0
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
    const hereString = finDeHereString(command, i)
    if (hereString !== -1) {
      const corps = command.slice(i + 2, hereString - 2)
      const double = command[i + 1] === '"'
      tokens.push({ text: corps, op: null, quote: double ? 'double' : 'simple', substitutions: double ? substitutionsDeHereString(corps) : [] })
      i = hereString
      continue
    }
    const precedent = tokens.at(-1)
    if (command[i] === '(' && (!precedent || precedent.op || (precedent.quote === undefined && AVANT_SOUS_SHELL.has(precedent.text)))) {
      tokens.push({ text: '(', op: null })
      sousShells += 1
      i += 1
      continue
    }
    if (command[i] === ')' && sousShells > 0) {
      tokens.push({ text: ')', op: ')' })
      sousShells -= 1
      i += 1
      continue
    }
    if (command.startsWith('&&', i)) { tokens.push({ text: '&&', op: '&&' }); i += 2; continue }
    if (command.startsWith('||', i)) { tokens.push({ text: '||', op: '||' }); i += 2; continue }
    if (command[i] === ';') { tokens.push({ text: ';', op: ';' }); i += 1; continue }
    if (command[i] === '|') { tokens.push({ text: '|', op: '|' }); i += 1; continue }
    const redirection = command.startsWith('>(', i) ? null : /^(?:\d*|&)>[>|]?(?:&\d+)?/.exec(command.slice(i))
    if (redirection) { tokens.push({ text: redirection[0], raw: redirection[0], op: null }); i += redirection[0].length; continue }
    // MOT (bareword ± span(s) quoté(s) EMBARQUÉS) : le comportement shell réel colle une quote
    // rencontrée en PLEIN MILIEU d'un token à ce MÊME token (`-m"a b c"` → un seul token `-ma b c`,
    // `--message="a b c"` → `--message=a b c`) — jamais une coupure qui laisserait les mots du
    // message fuir en tokens séparés (les mots d'un message multi-mots devenaient alors autant de
    // pathspecs parasites, #591 suite : le filtrage src/ui retombait à néant, JUGE silencieux).
    let buf = ''
    const quotes = new Set()
    let nu = false
    const substitutions = []
    /** Retient la substitution `texte` (son ouvreur compris) au bout du mot, `interne` = la commande qu'elle exécute. */
    const substitue = (texte, interne, expression = false) => {
      substitutions.push({ debut: buf.length, fin: buf.length + texte.length, interne, expression })
      buf += texte
    }
    let j = i
    while (j < n) {
      const c = command[j]
      // CONTINUATION DE LIGNE (`\` POSIX, backtick PowerShell suivi du saut de ligne) : la commande
      // se POURSUIT — les deux caractères disparaissent, et le saut n'est pas la fin d'une commande.
      // Sans cela, `git commit --amend \` + saut + `-F msg.txt` perdait son `-F` (message jamais lu,
      // refus FAUX « SUBSTANCE sans ticket ») et le backtick devenait un pathspec.
      if ((c === '\\' || c === '`') && command[j + 1] === '\n') { j += 2; continue }
      // Substitution de commande `$(…)`, sous-expression `@(…)`, substitution de processus `<(…)`, `>(…)`.
      if ('$@<>'.includes(c) && command[j + 1] === '(') {
        const fermante = parentheseFermante(command, j + 1)
        substitue(command.slice(j, fermante + 1), command.slice(j + 2, fermante), c === '@')
        nu = true
        j = fermante + 1
        continue
      }
      if (/\s/.test(c) || c === ';' || c === '|' || c === '>' || (c === '&' && (command[j + 1] === '&' || command[j + 1] === '>'))) break
      // ANSI-C quoting `$'…'` (bash) : span QUOTÉ au même titre que `'…'`. Sans lui le `$` restait
      // collé au mot suivant (`bash -c $'gh issue create …'` rendait un token `$gh`) et l'exécutable
      // de tête devenait méconnaissable. Un `\x` y rend son caractère littéral : la reconnaissance
      // porte sur des noms d'exécutable, jamais sur des octets de contrôle.
      if (c === '$' && command[j + 1] === "'") {
        quotes.add('simple')
        j += 2
        while (j < n && command[j] !== "'") {
          if (command[j] === '\\' && j + 1 < n) { buf += command[j + 1]; j += 2; continue }
          buf += command[j]; j++
        }
        j++ // saute la quote fermante (si absente — quote non refermée — j a déjà atteint n)
        continue
      }
      const hereString = finDeHereString(command, j)
      if (hereString !== -1) {
        const corps = command.slice(j + 2, hereString - 2)
        quotes.add(command[j + 1] === "'" ? 'simple' : 'double')
        if (command[j + 1] === '"') substitutions.push(...substitutionsDeHereString(corps, buf.length))
        buf += corps
        j = hereString
        continue
      }
      if (c === '"' || c === "'") {
        const quote = c
        quotes.add(quote === "'" ? 'simple' : 'double')
        j++
        // Sous quote double, `$(` s'ouvre et se ferme au solde de ses parenthèses, sans quitter la quote.
        let ouverte = -1
        let ouverteBuf = 0
        let solde = 0
        while (j < n && command[j] !== quote) {
          // Échappement réel `\"`, `\\`, `` \` `` et `\$` seulement (XCU 2.2.3) — un backslash de chemin
          // Windows (`C:\Program…`) n'est PAS un échappement shell et reste LITTÉRAL (sinon les chemins
          // perdent leurs séparateurs, cassant la reconnaissance de `git.exe` au bout d'un chemin absolu, #591 suite).
          if (quote === '"' && command[j] === '\\' && j + 1 < n && '"\\`$'.includes(command[j + 1])) {
            buf += command[j + 1]; j += 2; continue
          }
          if (quote === '"' && ouverte === -1 && command.startsWith('$(', j)) { ouverte = j; ouverteBuf = buf.length; solde = 0 }
          if (ouverte !== -1 && command[j] === '(') solde += 1
          else if (ouverte !== -1 && command[j] === ')' && --solde === 0) {
            buf = buf.slice(0, ouverteBuf)
            substitue(command.slice(ouverte, j + 1), command.slice(ouverte + 2, j))
            ouverte = -1
            j++
            continue
          }
          const fermant = quote === '"' && ouverte === -1 && command[j] === '`' ? command.indexOf('`', j + 1) : -1
          const finDeQuote = fermant === -1 ? -1 : command.indexOf('"', j + 1)
          if (fermant !== -1 && (finDeQuote === -1 || fermant < finDeQuote)) {
            substitue(command.slice(j, fermant + 1), command.slice(j + 1, fermant))
            j = fermant + 1
            continue
          }
          buf += command[j]; j++
        }
        if (ouverte !== -1) {
          buf = buf.slice(0, ouverteBuf)
          substitue(command.slice(ouverte, j), command.slice(ouverte + 2, j))
        }
        j++ // saute la quote fermante (si absente — quote non refermée — j a déjà atteint n)
        continue
      }
      if (c === ')' && sousShells > 0) break
      const fermant = c === '`' ? command.indexOf('`', j + 1) : -1
      if (fermant !== -1) {
        substitue(command.slice(j, fermant + 1), command.slice(j + 1, fermant))
        nu = true
        j = fermant + 1
        continue
      }
      buf += c
      nu = true
      j++
    }
    // Un mot fait UNIQUEMENT de continuations n'est pas un token vide : il n'existe pas. Un vrai
    // argument vide (`''`) en reste un — c'est la quote qui le prouve.
    if (buf !== '' || quotes.size > 0) {
      tokens.push({ text: buf, raw: command.slice(i, j), substitutions, op: null, quote: !nu && quotes.size === 1 ? [...quotes][0] : undefined })
    }
    i = j
  }
  return tokens
}

/** Index qui suit la here-string ouverte en `texte[k]` (`@'`/`@"` en fin de ligne, fermée par la marque
 *  qui ouvre sa ligne, about_Quoting_Rules), ou `-1` si `texte[k]` n'en ouvre pas une refermée. */
function finDeHereString(texte, k) {
  const quote = texte[k + 1]
  if (texte[k] !== '@' || (quote !== "'" && quote !== '"') || !/^\r?\n/.test(texte.slice(k + 2, k + 4))) return -1
  const fin = texte.indexOf(`\n${quote}@`, k + 2)
  return fin === -1 ? -1 : fin + 3
}

/** Les substitutions `$(…)` du corps d'une here-string `@"…"@` (about_Quoting_Rules), `decalage` = la position
 *  du corps dans le mot ; un `$(` précédé du backtick d'échappement n'en ouvre pas. */
function substitutionsDeHereString(corps, decalage = 0) {
  const substitutions = []
  for (let k = corps.indexOf('$('); k !== -1; k = corps.indexOf('$(', k + 1)) {
    if (corps[k - 1] === '`') continue
    const fermante = parentheseFermante(corps, k + 1)
    substitutions.push({ debut: decalage + k, fin: decalage + Math.min(fermante + 1, corps.length), interne: corps.slice(k + 2, fermante), expression: false })
    k = fermante
  }
  return substitutions
}

/** Index de la parenthèse qui ferme celle de `texte[k]`, hors quotes, ou `texte.length` si elle reste
 *  ouverte. Seule lecture de la fin d'une substitution nue. */
function parentheseFermante(texte, k) {
  let solde = 0
  for (let i = k; i < texte.length; i++) {
    const c = texte[i]
    if (c === "'" || c === '"') {
      const fin = texte.indexOf(c, i + 1)
      if (fin === -1) return texte.length
      i = fin
    } else if (c === '(') solde += 1
    else if (c === ')' && --solde === 0) return i
  }
  return texte.length
}

/** Segments exécutables — leurs JETONS (`tokenizeCommand`, provenance quotée comprise) — AVEC
 *  l'opérateur qui les enchaîne (`&&`/`;`/`||`/`|`, `)` de fin de sous-shell, `null` pour le dernier). Source unique du
 *  découpage : `splitCommandSegments` et `pipelinesProfonds` en dérivent, le tube n'étant un
 *  séparateur QUE pour qui a besoin de le distinguer. `flux` = les jetons d'une commande, opérateurs compris
 *  (`tokenizeCommand`, ou le corps d'un bloc). */
function segmentsAvecOperateur(flux) {
  const segments = []
  let current = []
  for (const tok of flux) {
    if (tok.op) {
      segments.push({ jetons: current, op: tok.op })
      current = []
    } else {
      current.push(tok)
    }
  }
  segments.push({ jetons: current, op: null })
  return segments
}

/** Découpe la commande en segments exécutables (aux enchaînements `&&`/`;`/`||`/`|` de premier
 *  niveau — les mêmes marqueurs À L'INTÉRIEUR d'une quote/here-string ont déjà été consommés comme
 *  contenu de token par `tokenizeCommand`, jamais comme séparateur). */
export function splitCommandSegments(command) {
  return segmentsAvecOperateur(tokenizeCommand(command)).map((s) => s.jetons.map((j) => j.text)).filter((s) => s.length > 0)
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
// HORS PORTÉE : tout ce que ne reconnaît pas le paragraphe LECTURE DE LA COMMANDE de l'en-tête.

/** Nom d'exécutable d'un token : basename, sans extension d'`EXTENSIONS_EXECUTABLES`, en minuscules. */
export function basenameExecutable(token) {
  const texte = typeof token === 'string' ? token : String(token ?? '')
  const connu = NOMS_EXECUTABLES.get(texte)
  if (connu !== undefined) return connu
  const base = texte.slice(Math.max(texte.lastIndexOf('/'), texte.lastIndexOf('\\')) + 1).toLowerCase()
  const nom = base.length >= 4 && base[base.length - 4] === '.' && EXTENSIONS_EXECUTABLES.has(base.slice(-3)) ? base.slice(0, -4) : base
  if (NOMS_EXECUTABLES.size >= 4096) NOMS_EXECUTABLES.clear()
  NOMS_EXECUTABLES.set(texte, nom)
  return nom
}
const EXTENSIONS_EXECUTABLES = new Set(['exe', 'cmd', 'bat'])
const NOMS_EXECUTABLES = new Map() // mémo-pur : jeton → son nom d'exécutable

/** Index d'un paramètre PowerShell nommé dans `args`, cherché par PRÉFIXE NON AMBIGU, OU par le nom
 *  EXACT, insensible à la casse : `-Command` s'écrit aussi bien `-com`, `-Comm`… — PowerShell accepte
 *  tout préfixe qu'aucun AUTRE paramètre de la commande ne partage, et lie le nom exact en priorité
 *  (`-Query` à côté de `QueryDialect`). `noms` = tous ses paramètres. `-1` si absent. */
function indexParametre(args, nom, noms = [nom]) {
  const cible = nom.toLowerCase()
  const autres = noms.map((n) => n.toLowerCase()).filter((n) => n !== cible)
  return args.findIndex((a) => {
    if (a[0] !== '-') return false
    const p = a.slice(1).toLowerCase()
    return p !== '' && cible.startsWith(p) && (p === cible || !autres.some((n) => n.startsWith(p)))
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
// `suite` = ce que l'hôte lit APRÈS l'argument porteur : `reste` = toute la ligne, jointe par des
// espaces (`cmd /c`, `powershell -Command`, `eval`) ; `jetons` = les arguments restants passés tels
// quels à la commande découpée (`env -S`), ajoutés comme JETONS, provenance comprise ; absente = rien
// (`sh -c 'cmd' arg0` : ses positionnels).
// `//c` et `//k` : graphie Git Bash (MSYS) de `/c` et `/k`, l'argument à double barre que MSYS rend à
// une seule (#2173). Hors Git Bash, `cmd //c x` n'exécute rien : la lecture sur-approxime, et aucun
// consommateur d'`argumentChaine` n'accorde de droit sur ce qu'elle déplie.
const FAMILLE_CMD = {
  porteurs: ['/c', '/k', '//c', '//k'],
  porteurInsensible: true,
  estFlag: (t) => t.startsWith('/'),
  aValeur: () => false,
  suite: 'reste',
}
const FAMILLE_POWERSHELL = {
  parametre: 'Command', parametreEncode: 'EncodedCommand', params: PARAMS_HOTE_POWERSHELL, porteurCourt: '-c',
  suite: 'reste',
}
const FAMILLE_EVAL = { premierNonFlag: true, suite: 'reste', memeShell: true }
const FAMILLE_INVOKE_EXPRESSION = { premierNonFlag: true, memeShell: true }
// `npx` est à la fois un enrobeur de TÊTE (`npx gh issue create`) et, avec `-c`/`--call`, un
// interpréteur à argument-chaîne : `epluchageTete` interroge la table A à chaque cran, la forme
// `-c` part donc en récursion au lieu d'être AVALÉE comme la valeur d'un flag (contournement mesuré).
const FAMILLE_NPX = {
  porteurs: ['-c', '--call'],
  estFlag: (t) => t.startsWith('-'),
  aValeur: (t) => t === '-p' || t === '--package',
}

// `env -S <chaîne>` / `--split-string=<chaîne>` (coreutils) : la chaîne est découpée en commande.
// Lettres courtes à la getopt (`env --help`) : `-S` groupé (`-iS '…'`) ou collé (`-S'…'`) ; `-u`
// et `-C` prennent eux aussi une valeur.
const FAMILLE_ENV = {
  porteurs: ['--split-string'],
  groupeCourt: { porteur: 'S', aValeur: 'uC' },
  estFlag: (t) => t.startsWith('-'),
  aValeur: (t) => t === '--unset' || t === '--chdir',
  suite: 'jetons',
}

/** Lecture getopt d'un groupe de lettres courtes (`-iS…`) : `porteur` = la chaîne portée (résidu
 *  du jeton, sinon `suivant`), `null` si le groupe ne porte pas la lettre ; `valeurSuivante` = la
 *  lettre porteuse ou à valeur prend le jeton suivant. */
function groupeCourt(t, suivant, { porteur, aValeur }) {
  for (let l = 1; l < t.length; l++) {
    if (t[l] === porteur) {
      const residu = t.slice(l + 1)
      return residu ? { porteur: residu, valeurSuivante: false } : { porteur: suivant ?? null, valeurSuivante: true }
    }
    if (aValeur.includes(t[l])) return { porteur: null, valeurSuivante: l === t.length - 1 }
  }
  return { porteur: null, valeurSuivante: false }
}

/** Lecture portée : `chaine`, et ce que l'hôte lit après elle (`suite` de la famille) à partir de
 *  `args[debut]` — joint au texte pour `reste`, index de segment des jetons ajoutés pour `jetons`.
 *  `memeShell` : la famille exécute la chaîne dans le shell de l'hôte (`eval`, `Invoke-Expression`), pas dans un
 *  processus neuf. `null` sans chaîne. */
function portee(famille, chaine, args, debut) {
  if (chaine === null) return null
  const memeShell = famille.memeShell === true
  if (famille.suite === 'reste') return { commande: [chaine, ...args.slice(debut)].join(' '), suite: null, memeShell }
  return { commande: chaine, suite: famille.suite === 'jetons' ? debut + 1 : null, memeShell }
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
  ['eval', FAMILLE_EVAL], ['invoke-expression', FAMILLE_INVOKE_EXPRESSION],
  ['npx', FAMILLE_NPX],
  ['env', FAMILLE_ENV],
])

/** Texte que ce segment porte (à ré-analyser), ou `null` : l'argument-chaîne, séparé du flag porteur
 *  ou collé par `=` (`--split-string=…`), suivi du reste de la ligne pour une famille `reste`. Les
 *  arguments qui suivent la chaîne d'une famille `jetons` (`env -S`) n'y sont pas : ce sont des
 *  jetons, que `pipelinesDeJetons` lui ajoute (`lecturePorteur`). Lecture PARTAGÉE avec
 *  `commande-piege-guard` (`cmd /c mklink`). */
export function argumentChaine(segment) {
  return lecturePorteur(segment)?.commande ?? null
}

/** Lecture d'un segment porteur : `{ commande, suite }`, `commande` = le texte d'`argumentChaine`,
 *  `suite` = index, dans le segment, du premier jeton qui suit la chaîne d'une famille `jetons`
 *  (sinon `null`) ; `null` si le segment ne porte rien. Le flag porteur est cherché PARMI LES FLAGS
 *  DE TÊTE, jamais à une position fixe : `bash -euo pipefail -c "…"`, `sh -ex -c "…"`,
 *  `powershell -NoProfile -Command "…"` sont des formes courantes. */
function lecturePorteur(segment) {
  const famille = ENROBEURS_ARGUMENT.get(basenameExecutable(segment[0]))
  if (!famille) return null
  const args = segment.slice(1)
  if (famille.premierNonFlag) {
    let k = 0
    while (k < args.length && args[k].startsWith('-') && args[k] !== '--') k += 1
    if (args[k] === '--') k += 1
    return portee(famille, args[k] ?? null, args, k + 1)
  }
  if (famille.parametre) {
    const court = args.findIndex((a) => a.toLowerCase() === famille.porteurCourt)
    const i = court !== -1 ? court : indexParametre(args, famille.parametre, famille.params)
    if (i !== -1) return portee(famille, args[i + 1] ?? null, args, i + 2)
    const encode = indexParametre(args, famille.parametreEncode, famille.params)
    const decodee = encode !== -1 ? decodeCommandeEncodee(args[encode + 1]) : null
    return decodee === null ? null : { commande: decodee, suite: null }
  }
  const memeFlag = famille.porteurInsensible
    ? (a, b) => a.toLowerCase() === b.toLowerCase()
    : (a, b) => a === b
  for (let k = 0; k < args.length && famille.estFlag(args[k]); k++) {
    if (famille.groupeCourt && /^-[^-]/.test(args[k])) {
      const groupe = groupeCourt(args[k], args[k + 1], famille.groupeCourt)
      if (groupe.porteur !== null) return portee(famille, groupe.porteur, args, k + (groupe.valeurSuivante ? 2 : 1))
      if (groupe.valeurSuivante) k += 1
      continue
    }
    if (famille.porteurs.some((f) => memeFlag(f, args[k]))) return portee(famille, args[k + 1] ?? null, args, k + 2)
    const colle = famille.porteurs.find((f) => args[k].startsWith(`${f}=`))
    if (colle) return portee(famille, args[k].slice(colle.length + 1), args, k + 1)
    if (famille.aValeur(args[k])) k += 1
  }
  return null
}

/** Enrobeurs de TÊTE : préfixes qui ne font qu'exécuter la suite de la ligne. `flags` = les flags à
 *  VALEUR SÉPARÉE de cet enrobeur (les autres flags sont sautés seuls ; sans clef `flags`, aucun flag
 *  n'est sauté — `command -v git` n'exécute rien) ; `affectations` = `VAR=val` admis parmi eux ;
 *  `positionnels` = arguments propres avant la commande (la durée de `timeout`) ;
 *  `ajouteArguments` = l'enrobeur ajoute à la commande des arguments ABSENTS de son texte ;
 *  `citeSous` = les flags sous lesquels il n'exécute rien et reste la tête (`command -v`). */
const ENROBEURS_TETE = new Map([
  ['env', { flags: ['-u', '--unset'], affectations: true }],
  ['nohup', {}],
  ['command', { citeSous: ['-v', '-V'] }],
  ['builtin', {}],
  ['winpty', {}],
  ['time', {}],
  ['npx', { flags: ['-p', '--package', '--prefix'] }],
  ['sudo', { flags: ['-u', '--user', '-g', '--group', '-p', '--prompt'] }],
  ['setsid', { flags: [] }],
  ['timeout', { flags: ['-k', '--kill-after', '-s', '--signal'], positionnels: 1 }],
  ['xargs', { flags: ['-I', '-i', '-n', '-P', '-d', '-E', '-e', '-s', '-a', '-L'], ajouteArguments: true }],
  ['stdbuf', { flags: ['-i', '-o', '-e', '--input', '--output', '--error'] }],
  ['nice', { flags: ['-n', '--adjustment'] }],
])

/** Tokens de tête sans exécutable propre : call-operator PowerShell, accolades de bloc `& { … }`,
 *  parenthèse ouvrante de sous-shell `( … )`, et les mots réservés POSIX qui précèdent une commande
 *  (`!`, `if`, `then`, `elif`, `else`, `while`, `until`, `do` ; XCU 2.4). */
const TOKENS_TETE_NUS = new Set(['&', '{', '}', '(', '!', 'if', 'then', 'elif', 'else', 'while', 'until', 'do'])
/** Jetons après lesquels `(` ouvre un sous-shell : ceux de `TOKENS_TETE_NUS` et le mot réservé `time`. */
const AVANT_SOUS_SHELL = new Set([...TOKENS_TETE_NUS, 'time'])
const AFFECTATION_RE = /^[A-Za-z_][A-Za-z0-9_]*[+]?=/

// ── Blocs PowerShell : le contenu d'un `{ … }` s'exécute (#2173) ───────────────────────────────
/** Têtes dont les blocs `{ … }` EXÉCUTENT leur contenu (about_ForEach-Object, about_Foreach, about_For,
 *  about_Try_Catch_Finally, about_If, about_While, about_Switch, about_Trap, Where-Object). Sans parenthèse
 *  collée, `if`, `else` et `while` sont des `TOKENS_TETE_NUS` : leur `{` s'épluche déjà en tête, comme celui de
 *  `& { }`. */
const TETES_DE_BLOC = new Set([
  '%', 'foreach-object', 'foreach', 'for', 'try', 'catch', 'finally', 'if', 'else', 'while', 'switch', 'trap',
  'where-object', 'where', '?',
])
/** Mots qui, juste après le `}` d'un bloc, en ouvrent un autre dans le même segment (`} else {`,
 *  `} elseif (…) {`, `} catch [type] {`, `} finally {`). */
const SUITES_DE_BLOC = new Set(['else', 'elseif', 'catch', 'finally'])
const MOT_A_ENTETE_RE = /^(foreach|for|if|while|switch|elseif)(\(.*)$/i

/** Un jeton NU : ni quoté, ni mêlé de quotes. */
export const jetonNu = (j) => j.quote === undefined

/** Morceaux `{ text, substitutions }` d'un texte nu à partir de `depart` : chaque `{` et `}` détaché,
 *  `${nom}` et les `substitutions` du jeton (`tokenizeCommand`) gardés entiers. */
function eclateAccolades(texte, substitutions, depart = 0) {
  const morceaux = []
  let buf = ''
  let portees = []
  const coupe = () => {
    if (buf) morceaux.push({ text: buf, substitutions: portees })
    buf = ''
    portees = []
  }
  for (let i = depart; i < texte.length; i++) {
    const c = texte[i]
    const substitution = substitutions.find((s) => s.debut === i)
    if (substitution) {
      portees.push({ ...substitution, debut: buf.length, fin: buf.length + substitution.fin - substitution.debut })
      buf += texte.slice(i, substitution.fin)
      i = substitution.fin - 1
    } else if (c === '$' && texte[i + 1] === '{') {
      const fin = texte.indexOf('}', i)
      const j = fin === -1 ? texte.length : fin + 1
      buf += texte.slice(i, j)
      i = j - 1
    } else if (c === '{' || c === '}') {
      coupe()
      morceaux.push({ text: c, substitutions: [] })
    } else {
      buf += c
    }
  }
  coupe()
  return morceaux
}

/** Relecture des jetons d'un bloc : les accolades et la parenthèse d'en-tête collées à un jeton NU
 *  (`%{kill`, `$_.Id}`, `foreach($p`, `bash){Stop-Process`) en sont détachées, `${nom}` et les substitutions
 *  restent entiers. Un jeton quoté, ou qui porte une quote, reste tel quel. Rendue en `relus` par
 *  `pipelinesDeJetons`. */
function jetonsDeBloc(jetons) {
  return jetons.flatMap((j) => {
    if (!jetonNu(j) || !/[{}(]/.test(j.text) || /['"]/.test(j.raw ?? '')) return [j]
    const substitutions = j.substitutions ?? []
    const entete = MOT_A_ENTETE_RE.exec(j.text)
    const morceaux = entete
      ? [{ text: entete[1], substitutions: [] }, ...eclateAccolades(j.text, substitutions, entete[1].length)]
      : eclateAccolades(j.text, substitutions)
    return morceaux.length === 1 && morceaux[0].text === j.text ? [j] : morceaux.map((m) => ({ ...m, raw: m.text, op: null }))
  })
}

/** `1` pour une accolade ouvrante NUE, `-1` pour une fermante, `0` sinon : seule lecture d'une accolade. */
const accolade = (j) => (!jetonNu(j) ? 0 : j.text === '{' ? 1 : j.text === '}' ? -1 : 0)

/** Index du `}` qui ferme le `{` de `jetons[k]` (jetons relus, `jetonsDeBloc`), ou `jetons.length` si le
 *  bloc reste ouvert. Seule recherche de la fin d'un bloc. */
export function finDuBloc(jetons, k) {
  let profondeur = 0
  for (let i = k + 1; i < jetons.length; i++) {
    profondeur += accolade(jetons[i])
    if (profondeur < 0) return i
  }
  return jetons.length
}

/** Les blocs qu'exécute ce segment (jetons relus) : `corps` = les jetons de chacun, `dehors` = ceux du
 *  segment hors de ses blocs (accolades comprises) ; `suspens` = un bloc,
 *  ou l'en-tête d'une tête de bloc, reste ouvert à la fin du segment (le tokeniseur le coupe au `;`, au `|`).
 *  Une tête de `TETES_DE_BLOC` ouvre chaque `{` hors des parenthèses de son en-tête ; ailleurs, un `{`
 *  s'ouvre après un `}` suivi d'un mot de `SUITES_DE_BLOC`. Les clauses d'un `switch` sont ses blocs. */
function lectureDesBlocs(jetons, { toutes = false } = {}) {
  const tete = basenameExecutable(jetons[0]?.text)
  const ouvreTout = toutes || TETES_DE_BLOC.has(tete)
  const corps = []
  const dehors = toutes ? [] : jetons.slice(0, 1)
  let porte = ouvreTout
  let parens = 0
  let suspens = false
  for (let k = toutes ? 0 : 1; k < jetons.length; k++) {
    const j = jetons[k]
    dehors.push(j)
    if (!jetonNu(j)) continue
    if (jetons[k - 1]?.text === '}' && SUITES_DE_BLOC.has(j.text.toLowerCase())) { porte = true; continue }
    if (/[()]/.test(j.text)) parens += soldeParentheses(j.text)
    if (j.text !== '{' || !porte || parens > 0) continue
    const fin = finDuBloc(jetons, k)
    suspens ||= fin === jetons.length
    corps.push(jetons.slice(k + 1, fin))
    porte = ouvreTout
    k = fin
  }
  const executes = tete === 'switch' ? corps.flatMap((c) => lectureDesBlocs(c, { toutes: true }).corps) : corps
  return { corps: executes, dehors, suspens: suspens || (ouvreTout && !toutes && parens > 0) }
}

/** L'affectation `NOM=valeur` (`NOM+=valeur`) d'un jeton : `{ nom, valeur, jeton }`, la valeur DÉCITÉE
 *  (le texte du jeton, ses quotes retirées), `jeton` celui qui porte ses substitutions. */
function valeurDAffectation(jeton) {
  const egal = jeton.text.indexOf('=')
  return { nom: jeton.text.slice(0, egal).replace(/[+]$/, ''), valeur: jeton.text.slice(egal + 1), jeton }
}

/** Ouverture de substitution `$(` non refermée dans un texte : son solde de parenthèses. */
export const soldeParentheses = (texte) => (texte.match(/\(/g)?.length ?? 0) - (texte.match(/\)/g)?.length ?? 0)

/** Enrobeurs de TÊTE d'un segment (ses jetons), épluchés jusqu'à stabilité (`nohup env FOO=1 git …`) :
 *  `debut` = index du premier jeton exécuté (`jetons.length` si le segment n'est fait que d'enrobeurs),
 *  `enrobeurs` = les noms des enrobeurs épluchés devant lui, dans l'ordre, `affectations` = les noms des
 *  `VAR=val` épluchés, ceux d'un `env` compris, et `valeurs` = leurs `valeurDAffectation`. Un jeton QUOTÉ
 *  n'est pas une affectation (`"PATH=x"`). */
function epluchageTete(jetons) {
  const segment = jetons.map((j) => j.text)
  const enrobeurs = []
  const affectations = []
  const valeurs = []
  const estAffectation = (i) => jetonNu(jetons[i]) && AFFECTATION_RE.test(segment[i])
  /** Épluche l'affectation en `i` et rend l'index qui la suit. */
  const affecte = (i) => {
    const valeur = valeurDAffectation(jetons[i])
    affectations.push(valeur.nom)
    valeurs.push(valeur)
    return i + 1
  }
  let i = 0
  for (;;) {
    const t = segment[i]
    if (t === undefined) return { debut: segment.length, enrobeurs, affectations, valeurs }
    if (estAffectation(i)) { i = affecte(i); continue }
    if (TOKENS_TETE_NUS.has(t)) { i += 1; continue }
    // Un enrobeur qui porte ICI un argument-chaîne rend la main : la récursion le déploiera.
    if (argumentChaine(segment.slice(i)) !== null) return { debut: i, enrobeurs, affectations, valeurs }
    const nom = basenameExecutable(t)
    const enrobeur = ENROBEURS_TETE.get(nom)
    if (!enrobeur || enrobeur.citeSous?.includes(segment[i + 1])) return { debut: i, enrobeurs, affectations, valeurs }
    enrobeurs.push(nom)
    i += 1
    if (enrobeur.flags) {
      while (i < segment.length && (segment[i].startsWith('-') || (enrobeur.affectations && estAffectation(i)))) {
        if (enrobeur.affectations && estAffectation(i)) i = affecte(i)
        else i += enrobeur.flags.includes(segment[i]) ? 2 : 1
      }
    }
    i += enrobeur.positionnels ?? 0
  }
}

// Une commande réelle dépasse rarement deux niveaux ; au-delà de quatre, l'analyse s'arrête (borne
// dite, préférée à une récursion non bornée dans un hook) : les gardes consommatrices ne voient pas
// la suite, et la garde de commit y présume un commit EMBARQUÉ (`commitsDe`, forme `tout`).
const PROFONDEUR_MAX_ENROBEURS = 4

// ── `npm run <x>` : le corps du script est LU dans package.json ─────────────────────────────────
// Sous-commandes de `npm` qui lancent un script : `run`/`run-script` nomment leur script, les
// quatre raccourcis portent leur nom pour nom (`npm test` lance `scripts.test`).
const SOUS_COMMANDES_RUN = ['run', 'run-script']
const RACCOURCIS_NPM = ['test', 'start', 'stop', 'restart']

// Dépôt où `npm run <x>` se résout quand l'appelant ne le dit pas : celui de la portée de la garde
// (`racineNpmCourante`, la racine npm du contexte du répartiteur, `racineNpmDe`) — sans lui, un
// `cd <autre dépôt> && npm run x` serait lu dans le dépôt du HOOK. À défaut, le dépôt du hook.

/** Table `scripts` du `package.json` de `dir` (`{}` s'il est absent ou illisible — un hook ne lève
 *  jamais). Lue une fois par répertoire : un hook décide en quelques millisecondes. */
const CACHE_SCRIPTS = new Map() // mémo-pur : répertoire résolu → sa table `scripts`
export function scriptsNpm(dir = racineNpmCourante() ?? repoRoot()) {
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
 *  mêlent pas au pipeline hôte), avant le pipeline enrobant ; le corps d'un bloc PowerShell
 *  (`lectureDesBlocs`) l'est de même, avant le pipeline qui l'ouvre. Un segment que l'épluchage vide
 *  (`VAR=val`, `}`) n'y figure pas. `segmentsProfonds` en est l'APLATI : une garde qui n'a pas besoin
 *  du tube ignore ce groupement. */
export function pipelinesProfonds(command, profondeur = 0, options) {
  return pipelinesDeJetons(command, profondeur, options)
    .map((p) => p.filter((s) => s.jetons.length > 0).map((s) => s.jetons.map((j) => j.text)))
    .filter((p) => p.length > 0)
}

/** Les pipelines de `pipelinesProfonds`, segment par segment en `{ jetons, relus, enrobeurs, deploye, ouvreDesBlocs,
 *  valeurs, deplies, bloc, tube, shell, enTete }` : les JETONS exécutés (`tokenizeCommand`, provenance quotée comprise),
 *  `enTete` = les jetons que l'épluchage a retirés devant eux (enrobeurs, leurs flags, affectations), leur
 *  relecture de bloc (`jetonsDeBloc`), `ouvreDesBlocs` quand une tête de bloc n'exécute que ses corps, les ENROBEURS de
 *  tête épluchés devant eux, les `valeurs` (`valeurDAffectation`) que le segment pose pour la suite (ses
 *  affectations de tête quand l'épluchage le VIDE, ses arguments `NOM=val` sous une tête d'`AFFECTEURS`),
 *  `deploye` quand la commande qu'il porte (argument-chaîne, script npm, corps de bloc) est rendue à part,
 *  `deplies` = pour chaque jeton à substitution, les pipelines qu'elle exécute (rendus à part eux aussi),
 *  `bloc` = le segment dont un bloc le contient, `tube` = son pipeline, `shell` = le shell qui l'exécute : un
 *  `{ parent }` par commande relue dans un processus neuf (argument-chaîne hors `eval`/`Invoke-Expression`, qui gardent
 *  celui de l'hôte, script npm, substitution), par sous-shell
 *  `( … )` et par membre d'un tube, `parent` étant celui de son hôte, partagé par les corps de bloc de cette commande.
 *  Un segment que l'épluchage VIDE y
 *  figure, `jetons` vide. Un bloc ouvert absorbe les segments qui le suivent, séparateurs compris, jusqu'à
 *  sa fermeture : un bloc est UNE commande. Dans un bloc, ou une sous-expression `@(…)`, un énoncé dont le
 *  premier jeton est quoté est une chaîne, pas une commande : il n'est pas rendu. Qui lit
 *  un jeton comme un chemin a besoin des jetons et des enrobeurs : la quote dit si le shell le change,
 *  l'enrobeur s'il ajoute des arguments hors du texte. Au-delà de `PROFONDEUR_MAX_ENROBEURS` porteurs,
 *  l'analyse s'arrête et `budget.sature` (`nouveauBudget`, partagé par toute la récursion) le dit ; tous
 *  les segments en deçà sont rendus. `suite` = jetons ajoutés au DERNIER segment de `command` : les
 *  arguments qui suivent la chaîne d'`env -S` (`lecturePorteur`), avec leur provenance d'origine.
 *  `affectations` reçoit les noms de variables d'environnement que chaque segment lu pose
 *  (`affectationsDuSegment`). Lecture PARTAGÉE avec `commande-piege-guard`. */
export function pipelinesDeJetons(command, profondeur = 0, options = {}) {
  const budget = options.budget ?? nouveauBudget()
  if (!command) return []
  if (profondeur > PROFONDEUR_MAX_ENROBEURS) { budget.sature = true; return [] }
  return pipelinesDuFlux(tokenizeCommand(command), profondeur, { ...options, budget, shell: options.shell ?? { parent: options.hote ?? null } })
}

/** Le séparateur qu'un bloc absorbe (`;`, `|`, `&&`, `||`, `)`), jeton de son segment. */
const separateur = (op) => ({ text: op, raw: op, op: null, separateur: op })
/** Le corps d'un bloc rendu au flux : ses séparateurs redeviennent des opérateurs. */
const versFlux = (j) => (j.separateur ? { text: j.separateur, op: j.separateur } : j)
/** Les `{ nom, valeur, jeton }` qu'un segment épluché déclare sous une tête d'`AFFECTEURS`
 *  (`export p=…`, `local p=…`). */
function declarationsDuSegment(jetons) {
  const affecte = AFFECTEURS.get(basenameExecutable(jetons[0]?.text))
  const args = jetons.slice(1)
  if (!affecte || !affecte(args.map((j) => j.text))) return []
  return args.filter((j) => jetonNu(j) && AFFECTATION_RE.test(j.text)).map(valeurDAffectation)
}

/** `pipelinesDeJetons` sur un FLUX de jetons : la commande tokenisée, ou le corps d'un bloc, lu sans être
 *  re-tokenisé ni relu (`relu` : ses jetons sortent déjà de `jetonsDeBloc`). `expression` : le flux d'une
 *  sous-expression `@(…)`, où un énoncé quoté est une chaîne, comme dans un bloc. */
function pipelinesDuFlux(flux, profondeur, { scripts = scriptsNpm(), budget, suite = [], affectations = [], bloc, shell, relu = false, expression = false }) {
  const pipelines = []
  const lus = segmentsAvecOperateur(flux)
  const avecSuite = (k) => (lus[k].op === null ? [...lus[k].jetons, ...suite] : lus[k].jetons)
  let courant = []
  const shells = [shell]
  let precedent = null
  for (let s = 0; s < lus.length; s++) {
    const jetons = avecSuite(s)
    let { op } = lus[s]
    const { debut, enrobeurs, affectations: deTete, valeurs } = epluchageTete(jetons)
    for (let k = 0; k < debut; k++) if (jetonNu(jetons[k]) && jetons[k].text === '(') shells.push({ parent: shells.at(-1) })
    const segment = jetons.slice(debut)
    const relus = relu ? [...segment] : jetonsDeBloc(segment)
    let lecture = lectureDesBlocs(relus)
    while (op !== null && lecture.suspens) {
      let solde = relus.reduce((d, j) => d + accolade(j), 0)
      do {
        const ajout = relu ? avecSuite(s + 1) : jetonsDeBloc(avecSuite(s + 1))
        segment.push(separateur(op), ...avecSuite(s + 1))
        relus.push(separateur(op), ...ajout)
        solde = ajout.reduce((d, j) => d + accolade(j), solde)
        s += 1
        op = lus[s].op
      } while (op !== null && solde > 0)
      lecture = lectureDesBlocs(relus)
    }
    const ouvreDesBlocs = lecture.corps.length > 0 && TETES_DE_BLOC.has(basenameExecutable(relus[0]?.text))
    const ici = op === '|' || precedent === '|' ? { parent: shells.at(-1) } : shells.at(-1)
    // Les substitutions s'exécutent avant le segment, la chaîne citée comprise ; celles d'un corps de bloc se
    // déplient dans ce corps.
    const deplies = new Map()
    const deplie = (j) => {
      if (!j.substitutions?.length) return
      const rendus = j.substitutions.flatMap(({ interne, expression: sousExpression }) =>
        pipelinesDeJetons(interne, profondeur + 1, { scripts, budget, affectations, bloc, hote: ici, expression: sousExpression }))
      for (const p of rendus) pipelines.push(p)
      deplies.set(j, rendus)
    }
    for (let k = 0; k < debut; k++) deplie(jetons[k])
    for (const j of lecture.dehors) deplie(j)
    const chaine = (relu || expression) && courant.length === 0 && jetons.length > 0 && (!jetonNu(jetons[0]) || /^['"]/.test(jetons[0].raw ?? ''))
    if (!chaine) {
      // Une tête de bloc n'affecte rien et ne porte aucune chaîne : elle n'exécute que ses corps.
      const textes = ouvreDesBlocs ? [] : segment.map((j) => j.text)
      affectations.push(...deTete, ...affectationsDuSegment(textes))
      const posees = segment.length === 0 ? valeurs : declarationsDuSegment(segment)
      const lu = { jetons: segment, relus, enrobeurs, deploye: false, ouvreDesBlocs, valeurs: posees, deplies, bloc, tube: courant, shell: ici, enTete: jetons.slice(0, debut) }
      if (segment.length > 0) {
        const porteur = ouvreDesBlocs ? null : lecturePorteur(textes)
        const inner = ouvreDesBlocs ? null : (porteur?.commande ?? commandeScriptNpm(textes, scripts))
        if (inner !== null) {
          const debutSuite = porteur?.suite ?? null
          const suiteInterne = debutSuite === null ? [] : segment.slice(debutSuite)
          const rattache = porteur?.memeShell ? { shell: ici } : { hote: ici }
          for (const p of pipelinesDeJetons(inner, profondeur + 1, { scripts, budget, suite: suiteInterne, affectations, bloc, ...rattache })) pipelines.push(p)
        }
        const { corps } = lecture
        for (const c of corps) {
          for (const p of pipelinesDuFlux(c.map(versFlux), profondeur, { scripts, budget, affectations, bloc: lu, shell: ici, relu: true })) pipelines.push(p)
        }
        lu.deploye = inner !== null || corps.length > 0
      }
      courant.push(lu)
    }
    if (op === ')' && shells.length > 1) shells.pop()
    precedent = op
    if (op !== '|' && op !== ')' && courant.length > 0) {
      pipelines.push(courant)
      courant = []
    }
  }
  if (courant.length > 0) pipelines.push(courant)
  return pipelines
}

/** Têtes POSIX qui affectent leurs arguments `NOM[=val]` : `export` (sauf `-n`), `readonly` (sauf `-f`), et
 *  `declare`/`typeset`/`local` avec ou sans `-x` — une variable déjà exportée le reste (`man bash`, ENVIRONMENT). */
const AFFECTEURS = new Map([
  ['export', (args) => !args.includes('-n')], ['readonly', (args) => !args.includes('-f')],
  ...['declare', 'typeset', 'local'].map((t) => [t, () => true]),
])
const NOM_EXPORTE_RE = /^([A-Za-z_][A-Za-z0-9_]*)(?:[+]?=|$)/
/** PowerShell : `$env:NOM = …`, `$env:NOM += …`, `${env:NOM} = …` ; `Set-Item`/`New-Item` (alias `si`,
 *  `ni`), `Set-Content`/`Add-Content` sur le lecteur `env:` ; `[Environment]::SetEnvironmentVariable`
 *  (`about_Environment_Variables`). */
const ENV_POWERSHELL_RE = /^\$\{?env:([A-Za-z_][A-Za-z0-9_]*)\}?([+]?=.*)?$/i
const ECRIVAINS_ENV_POWERSHELL = new Set(['set-item', 'si', 'new-item', 'ni', 'set-content', 'add-content'])
const SET_ENVIRONMENT_VARIABLE_RE = /SetEnvironmentVariable[(]([^,)]*)/i
const NOM_LITTERAL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Ce qu'`affectationsDuSegment` rend pour une écriture d'environnement dont le NOM n'est pas littéral
 *  (`export "$X=…"`, `SetEnvironmentVariable($n, …)`, `Set-Item ('env:'+$n)`) : nul ne sait ce qu'elle pose. */
export const NOM_NON_LITTERAL = '<nom non littéral>'
const LECTEUR_ENV_RE = /^env:[\\/]?([A-Za-z_][A-Za-z0-9_]*)$/i

/** Les noms de variables d'environnement qu'un segment épluché POSE pour les segments suivants :
 *  `export`, `declare`/`typeset`/`local` (`AFFECTEURS`), `$env:NOM = …`, `Set-Item env:NOM`,
 *  `SetEnvironmentVariable(NOM, …)` ; `NOM_NON_LITTERAL` quand la syntaxe écrit un nom calculé. */
function affectationsDuSegment(textes) {
  if (textes.length === 0) return []
  const tete = basenameExecutable(textes[0])
  const args = textes.slice(1)
  const affecte = AFFECTEURS.get(tete)
  if (affecte) {
    if (!affecte(args)) return []
    return args.filter((a) => !a.startsWith('-')).map((a) => NOM_EXPORTE_RE.exec(a)?.[1] ?? NOM_NON_LITTERAL)
  }
  const ps = ENV_POWERSHELL_RE.exec(textes[0])
  if (ps && (ps[2] !== undefined || args[0] === '=' || args[0] === '+=')) return [ps[1]]
  if (ECRIVAINS_ENV_POWERSHELL.has(tete)) {
    return args.filter((a) => /env:/i.test(a)).map((a) => LECTEUR_ENV_RE.exec(a)?.[1] ?? NOM_NON_LITTERAL)
  }
  const appel = SET_ENVIRONMENT_VARIABLE_RE.exec(textes.join(' '))
  if (appel) return [NOM_LITTERAL_RE.test(appel[1].trim()) ? appel[1].trim() : NOM_NON_LITTERAL]
  return []
}

/** Les noms de variables d'environnement que la commande pose, dans l'ordre, porteurs de chaîne et
 *  scripts npm dépliés (`pipelinesDeJetons`) : affectation de TÊTE (`VAR=val cmd`, `env VAR=val`),
 *  affectation seule (`VAR=val;`, qu'un `set -a` ou un export antérieur rend visible aux suivants), et
 *  export (`affectationsDuSegment`). */
export function affectationsDEnvironnement(command, options) {
  const affectations = []
  pipelinesDeJetons(command, 0, { ...options, affectations })
  return affectations
}

const IDENTIFIANT_RE = /[A-Za-z_][A-Za-z0-9_]*/g

/** Sous-commande git d'un segment, `notes` suivie de la sienne (`notes add`). */
const sousCommandeGitDe = (segment) => {
  const git = gitSubcommand(segment)
  return git?.sub === 'notes' ? `notes ${git.args[0] ?? ''}` : git?.sub
}
const estGh = (segment) => basenameExecutable(segment[0] ?? '') === 'gh'
const estGhApi = (segment) => estGh(segment) && segment[1] === 'api'
const REDIRECTION_RE = /^(?:\d*|&)>/
const redirige = (segment) => segment.slice(1).some((t) => REDIRECTION_RE.test(t))

/** Porteurs dont des jetons sont du TEXTE, pas une commande : `drapeaux` (forme `-m x`, `-mx`,
 *  `--message=x`), `motif` (celui d'une recherche, `motifDe`) ou `tout` (chaque argument hors
 *  redirection), et le `canal` qui porte ce texte dans un fichier (`git help commit`/`tag`/`notes`,
 *  -F ; `gh … --help`, --body-file ; `gh api --help`, -F « @<path> » ; `grep --help`, -f). */
const MESSAGES = Object.freeze([
  { porteur: (s) => sousCommandeGitDe(s) === 'commit', drapeaux: ['-m', '--message'], canal: 'le message dans un fichier : `git commit -F <fichier>`' },
  { porteur: (s) => sousCommandeGitDe(s) === 'tag', drapeaux: ['-m', '--message'], canal: 'le message dans un fichier : `git tag -F <fichier>`' },
  { porteur: (s) => /^notes (add|append)$/.test(sousCommandeGitDe(s) ?? ''), drapeaux: ['-m', '--message'], canal: 'le message dans un fichier : `git notes add -F <fichier>`' },
  { porteur: (s) => estGh(s) && !estGhApi(s), drapeaux: ['--body', '-b'], canal: 'le corps dans un fichier : `gh … --body-file <fichier>`' },
  { porteur: (s) => estGh(s) && !estGhApi(s), drapeaux: ['--title', '-t'], canal: 'le titre dans un fichier : `gh api … -F title=@<fichier>` (`--title` n’a pas de forme fichier)' },
  { porteur: (s) => estGh(s) && !estGhApi(s), drapeaux: ['--search', '-S'], canal: 'la recherche dans un fichier : `gh api -X GET search/issues -F q=@<fichier>`' },
  { porteur: estGhApi, drapeaux: ['-f', '--raw-field', '-F', '--field'], canal: 'le champ dans un fichier : `gh api … -F <champ>=@<fichier>`' },
  { porteur: (s) => /^(?:grep|egrep|fgrep|rg)$/.test(basenameExecutable(s[0] ?? '')), motif: true, canal: 'le motif dans un fichier : `grep -f <fichier>` (`rg -f <fichier>`)' },
  { porteur: (s) => /^(?:echo|printf)$/.test(basenameExecutable(s[0] ?? '')) && redirige(s), tout: true, canal: 'le fichier écrit par l’outil d’écriture de fichier (Write)' },
])

/** Options de `grep`/`rg` qui prennent la valeur suivante (`grep --help`, `rg --help`). */
const OPTIONS_A_VALEUR_DE_RECHERCHE = new Set(['-A', '-B', '-C', '-m', '-d', '-D', '-g', '-t', '-T', '-j', '-M', '--glob', '--type', '--max-count', '--context', '--after-context', '--before-context'])

/** Le MOTIF d'un `grep`/`rg`, `{ k, valeur }` : la valeur de `-e`/`--regexp`, sinon son premier
 *  opérande ; `null` sans motif. */
function motifDe(segment) {
  for (let k = 1; k < segment.length; k++) {
    const t = segment[k]
    if ((t === '-e' || t === '--regexp') && k + 1 < segment.length) return { k: k + 1, valeur: segment[k + 1] }
    const accole = /^(?:-e|--regexp=)(.+)$/.exec(t)
    if (accole) return { k, valeur: accole[1] }
    if (OPTIONS_A_VALEUR_DE_RECHERCHE.has(t)) { k += 1; continue }
    if (!t.startsWith('-')) return { k, valeur: t }
  }
  return null
}

/** Le segment partagé en jetons de COMMANDE (`hors`) et valeurs de TEXTE (`messages`, chacune avec le
 *  canal de son porteur, `MESSAGES`), drapeau accolé retiré (`-mx` → `x`). Un texte qui porte une
 *  substitution (`$(…)`, `` `…` ``) l'exécute : il reste dans `hors`. */
function partageDuSegment(jetons) {
  const segment = jetons.map((j) => j.text)
  const porteurs = MESSAGES.filter((m) => m.porteur(segment))
  const tout = porteurs.find((m) => m.tout)
  const recherche = porteurs.find((m) => m.motif)
  const motif = recherche ? motifDe(segment) : null
  const hors = []
  const messages = []
  const substitue = (k, t) => (jetons[k].substitutions ? jetons[k].substitutions.length > 0 : jetons[k].quote !== 'simple' && /\$\(|`/.test(t))
  const range = (t, canal, k) => (substitue(k, t) ? hors.push(t) : messages.push({ jeton: t, canal }))
  for (let k = 0; k < segment.length; k++) {
    const t = segment[k]
    if (tout && k > 0 && !REDIRECTION_RE.test(t) && !REDIRECTION_RE.test(segment[k - 1])) { range(t, tout.canal, k); continue }
    if (k === motif?.k) { range(motif.valeur, recherche.canal, k); continue }
    const separe = porteurs.find((m) => m.drapeaux?.includes(t))
    if (separe && k + 1 < segment.length) { hors.push(t); range(segment[k + 1], separe.canal, k + 1); k += 1; continue }
    const accole = porteurs.flatMap((m) => (m.drapeaux ?? []).map((d) => ({ m, prefixe: d.startsWith('--') ? `${d}=` : d })))
      .find(({ prefixe }) => t !== prefixe && t.startsWith(prefixe))
    if (accole) { range(t.slice(accole.prefixe.length), accole.m.canal, k); continue }
    hors.push(t)
  }
  return { hors, messages }
}

/** Les identifiants que portent les jetons de la commande, quelle que soit la syntaxe qui les écrit :
 *  ceux des segments réellement exécutés et de leurs porteurs de chaîne (`segmentsProfonds`), et les
 *  noms affectés en tête (`affectationsDEnvironnement`), que l'épluchage retire des segments.
 *  `horsMessages` : sans les valeurs de texte (`partageDuSegment`). */
export function nomsDeLaCommande(command, { horsMessages = false } = {}) {
  const noms = new Set(affectationsDEnvironnement(command))
  for (const { jetons } of pipelinesDeJetons(command).flat()) {
    const { hors, messages } = partageDuSegment(jetons)
    for (const jeton of horsMessages ? hors : [...hors, ...messages.map((m) => m.jeton)]) for (const nom of jeton.match(IDENTIFIANT_RE) ?? []) noms.add(nom)
  }
  return [...noms]
}

/** Pour chaque identifiant écrit dans une valeur de TEXTE de la commande (`partageDuSegment`), les
 *  canaux qui portent ce texte dans un fichier. */
export function canauxDesMessages(command) {
  const canaux = new Map()
  for (const { jetons } of pipelinesDeJetons(command).flat()) {
    for (const { jeton, canal } of partageDuSegment(jetons).messages) {
      for (const nom of jeton.match(IDENTIFIANT_RE) ?? []) canaux.set(nom, new Set([...(canaux.get(nom) ?? []), canal]))
    }
  }
  return canaux
}

/** Liste PLATE des segments RÉELLEMENT exécutés par la commande — l'aplati de `pipelinesProfonds`,
 *  dans le même ordre (un segment enrobé précède son enrobeur : `cmd /c mklink …` rend `mklink …`
 *  puis `cmd /c …`).
 *  `profondeur` = niveau d'imbrication de départ, borné par `PROFONDEUR_MAX_ENROBEURS`. */
export function segmentsProfonds(command, profondeur = 0, options) {
  return pipelinesProfonds(command, profondeur, options).flat()
}

const GLOBAL_VALUE_FLAGS = new Set(['-C', '-c', '--config-env', '--git-dir', '--work-tree', '--namespace', '--attr-source'])

/** Index de la SOUS-COMMANDE git dans un segment (`[&] git [flags globales] <sub>`), `-1` si le
 *  segment n'exécute pas `git`. Un token `&` de tête (call-operator PowerShell :
 *  `& "C:\Program Files\Git\git.exe" commit …`) est sauté — le contrôle d'exécutable porte alors
 *  sur le BASENAME (sans extension `.exe`/`.cmd`, insensible à la casse ; `estGit`). `depart` = index
 *  où le segment commence, sans tranche à recopier. Invariant PARTAGÉ avec `commande-piege-guard` :
 *  « quel git, quelle sous-commande » ne se réécrit pas par garde. */
export function gitSubcommandIndex(segment, depart = 0) {
  const start = segment[depart] === '&' ? depart + 1 : depart
  if (segment.length <= start) return -1
  if (!estGit(segment[start])) return -1
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

/** Les options globales que portent, avant leur sous-commande, les segments git réellement exécutés
 *  (`segmentsProfonds`), telles qu'écrites (`--git-dir=x` comme `--git-dir`, sa valeur à part). */
export function optionsGitGlobales(command) {
  return segmentsProfonds(command).flatMap((segment) => {
    const start = segment[0] === '&' ? 1 : 0
    if (segment.length <= start || !estGit(segment[start])) return []
    const fin = gitSubcommandIndex(segment)
    return segment.slice(start + 1, fin === -1 ? segment.length : fin).filter((t) => t.startsWith('-'))
  })
}

/** Les `{ cle, valeur }` (clé en minuscules) que posent les flags globaux `-c <clé>=<val>` et `--config-env <clé>=<var>`
 *  (ou `--config-env=<clé>=<var>`) des segments git réellement exécutés (`git help git`, `-c`,
 *  `--config-env`) ; les formes collées `-c<clé>` et `--config-env<clé>` sont refusées par git
 *  (« unknown option », mesuré git 2.51, #2224). */
export function configsGitDeLaCommande(command) {
  return pipelinesDeJetons(command).flat().flatMap(({ jetons }) => {
    const segment = jetons.map((j) => j.text)
    const appel = { segment, jetons }
    const start = segment[0] === '&' ? 1 : 0
    if (segment.length <= start || !estGit(segment[start])) return []
    const fin = gitSubcommandIndex(segment)
    const globaux = segment.slice(start + 1, fin === -1 ? segment.length : fin)
    const cles = []
    for (let k = 0; k < globaux.length; k++) {
      const t = globaux[k]
      const debut = start + 1 + k
      const valeur = t === '-c' || t === '--config-env' ? globaux[++k] : t.startsWith('--config-env=') ? t.slice('--config-env='.length) : undefined
      if (valeur) {
        const [cle, ...reste] = valeur.split('=')
        cles.push({ cle: cle.toLowerCase(), valeur: reste.join('='), variable: t !== '-c', appel, debut, fin: start + 2 + k })
      }
    }
    return cles
  })
}

/** `true` si le jeton nomme l'exécutable `git` (`basenameExecutable`), lu tel quel (`C:\Git\git.exe`)
 *  ou après le retrait des antislashs d'échappement d'un mot nu POSIX (`g\it`). */
function estGit(jeton) {
  return basenameExecutable(jeton) === 'git' || basenameExecutable(jeton.replace(/\\(.)/g, '$1')) === 'git'
}

/** Sous-commande git d'un segment et ses arguments : `{ sub, args }`, ou `null` si le segment
 *  n'exécute pas `git`. */
export function gitSubcommand(segment) {
  const idx = gitSubcommandIndex(segment)
  if (idx === -1) return null
  return { sub: segment[idx], args: segment.slice(idx + 1) }
}

/** Index du token `commit` (spécialisation de `gitSubcommandIndex`, même `depart`), `-1` si la
 *  sous-commande exécutée n'est pas `commit`. */
function gitCommitSubcommandIndex(segment, depart = 0) {
  const idx = gitSubcommandIndex(segment, depart)
  return idx !== -1 && segment[idx] === 'commit' ? idx : -1
}

/** CITEURS : têtes qui n'exécutent JAMAIS leurs arguments — un `git commit` qu'elles portent est une
 *  CITATION (#591). Table FERMÉE, mesurée sur les commandes Bash réelles des agents de ce dépôt :
 *  toute autre tête est présumée exécuter ses arguments (`collecterCommits`). `command` n'y arrive
 *  que sous `-v`/`-V` (`ENROBEURS_TETE`). */
const CITEURS = new Set([
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'man', 'info', 'tldr', 'which', 'type', 'whereis',
  'command', 'ls', 'cat', 'head', 'tail', 'wc', 'gh', 'export', 'declare', 'local', 'readonly', 'typeset',
])
/** Sous-commandes git présumées exécuter une commande écrite dans leurs arguments (`git rebase
 *  --exec`, `git bisect run`, `git submodule foreach`). Toute autre sous-commande est lue comme
 *  CITEUSE (`git log --grep`) — table FERMÉE d'exécutants, donc à l'envers de la règle des autres
 *  têtes : les alias `!`, `filter-branch` et les `-c core.pager=…` y échappent (NON COUVERT, #2071). */
const SOUS_COMMANDES_GIT_EXECUTANTES = new Set(['rebase', 'bisect', 'submodule'])

/** Affectation PowerShell `$nom = …` en tête d'un segment (ses jetons) : `{ nom, valeur }`, `valeur` = les
 *  jetons qui suivent le `=`, ou `null`. */
export function affectationPowerShell(jetons) {
  const nom = /^\$(\w+)$/.exec(jetons[0]?.text ?? '')?.[1]
  return nom && jetonNu(jetons[0]) && jetons[1]?.text === '=' ? { nom, valeur: jetons.slice(2) } : null
}

/** `true` si la tête du segment CITE ses arguments (`CITEURS`, ou `git` hors
 *  `SOUS_COMMANDES_GIT_EXECUTANTES`). */
function estCiteur(segment) {
  const tete = basenameExecutable(segment[0])
  if (tete !== 'git') return CITEURS.has(tete)
  const idx = gitSubcommandIndex(segment)
  return idx !== -1 && !SOUS_COMMANDES_GIT_EXECUTANTES.has(segment[idx])
}

const SOUS_COMMANDES_GIT_DE_LECTURE = new Set(['grep', 'log', 'show', 'diff', 'blame'])

/** Options de `uniq` qui prennent la valeur suivante (`uniq --help`). */
const OPTIONS_A_VALEUR_D_UNIQ = new Set(['-f', '-s', '-w', '--skip-fields', '--skip-chars', '--check-chars'])

const SUBSTITUTION_SED_RE = /(?:^|[;\n{}\d$/])\s*s([^\n\\])(?:\\.|(?!\1)[^\\])*\1(?:\\.|(?!\1)[^\\])*\1([gpiIme0-9]*w\s+\S)/

/** Un segment qui ÉCRIT malgré une tête de lecture, hors redirection (`redirigeVersUnFichier`) : sortie
 *  `-o`/`--output[=]` (`sort -of` compris), `uniq <entrée> <sortie>`, `tail -f`/`-F`/`--follow` (qui
 *  ne rend pas la main), `sed -i`/`--in-place` et commande `w` de sed (`info sed`, « w filename »),
 *  `print >` d'awk (`info gawk`, « Redirecting Output of print and printf »). */
function ecritMalgreLaTete(segment) {
  const tete = basenameExecutable(segment[0])
  const args = segment.slice(1)
  if (args.some((t) => t === '-o' || /^--output(=|$)/.test(t))) return true
  if (tete === 'sort') return args.some((t) => /^-[a-zA-Z]*o/.test(t))
  if (tete === 'uniq') return args.filter((t, k) => !t.startsWith('-') && !OPTIONS_A_VALEUR_D_UNIQ.has(args[k - 1])).length >= 2
  if (tete === 'tail') return args.some((t) => t === '-f' || t === '-F' || t === '--follow')
  if (tete === 'sed') return args.some((t) => /^-[a-zA-Z]*i/.test(t) || t.startsWith('--in-place') || (!t.startsWith('-') && (SUBSTITUTION_SED_RE.test(t) || /(?:^|[;\n{}/\d$])\s*[wW]\s+\S/.test(t))))
  if (tete === 'awk' || tete === 'gawk') return args.some((t) => /\bprintf?\b[^;}]*>/.test(t))
  return false
}

/** Puits qui n'écrivent rien : `/dev/null`, `$null` (PowerShell), `nul` (cmd). */
const PUITS_RE = /^(?:\/dev\/null|\$null|nul)$/i

/** `true` si la commande redirige vers un fichier hors guillemets — `>`, `>>`, `1>`, `2>`, `&>`,
 *  collée (`x>f`) ou non ; `N>&M` (duplication) et les puits (`PUITS_RE`) exceptés. */
function redirigeVersUnFichier(command) {
  const nu = command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (m) => ' '.repeat(m.length))
  return [...nu.matchAll(/>>?(?!&)\s*([^\s;&|)]*)/g)].some((m) => !PUITS_RE.test(m[1]))
}

/** `true` si chaque segment exécuté de la commande ne fait que LIRE : tête de `LECTEURS`
 *  (`appelsRunners.mjs`) ou sous-commande de `SOUS_COMMANDES_GIT_DE_LECTURE`, sans écriture
 *  (`ecritMalgreLaTete`, `redirigeVersUnFichier`). */
export function commandeDeLecture(command) {
  if (redirigeVersUnFichier(command)) return false
  const segments = segmentsLus(command)
  return segments.length > 0 && segments.every((segment) => {
    const git = gitSubcommand(segment)
    const lit = git ? SOUS_COMMANDES_GIT_DE_LECTURE.has(git.sub) : LECTEURS.test(basenameExecutable(segment[0]))
    return lit && !ecritMalgreLaTete(segment)
  })
}

/** Bornes PARTAGÉES par toute la récursion d'une analyse : `reste` = segments que la RÉ-ANALYSE des
 *  arguments (`collecterCommits`) peut encore lire, au plus `SEGMENTS_MAX` ; `sature` dit qu'une
 *  borne (ces segments, ou la profondeur de `pipelinesDeJetons`) a coupé l'analyse. */
const SEGMENTS_MAX = 2000
export const nouveauBudget = () => ({ reste: SEGMENTS_MAX, sature: false })

/** Le refus d'une garde de commande dont la lecture a levé `budget.sature` : elle ne voit pas ce qui s'exécute
 *  au-delà de ses bornes. */
export const REFUS_SATURE = Object.freeze({
  decision: 'deny',
  reason:
    `⛔ commande trop imbriquée pour être jugée : au-delà de ${PROFONDEUR_MAX_ENROBEURS} niveaux de porteurs, de ` +
    `scripts npm ou de substitutions, la lecture s'arrête et ne voit pas ce que la commande exécute. Aplatir la ` +
    `commande (variable intermédiaire, ou script dans un fichier).`,
})

/** Lecture MÉMOÏSÉE par commande : la garde interroge la même commande pour chaque évaluation. Clé =
 *  racine de résolution npm (`racineNpmCourante`) + chaîne ; chaque lecture garde ses `MEMO_MAX` dernières
 *  clés (la plus ancienne sort). La valeur rendue est PARTAGÉE : l'appelant ne la modifie pas. */
function memoParCommande(calcul) {
  const memo = new Map()
  return (command) => {
    const clef = `${racineNpmCourante() ?? ''}\0${command}`
    if (memo.has(clef)) return memo.get(clef)
    const valeur = calcul(command)
    if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value)
    memo.set(clef, valeur)
    return valeur
  }
}
const MEMO_MAX = 16

/** `segmentsProfonds` au premier niveau, mémoïsé (`memoParCommande`). */
const segmentsLus = memoParCommande((command) => segmentsProfonds(command))

/** Commits qu'exécute la commande, dans l'ordre : `{ jetons, enrobeurs, sub, embarque, origine }`,
 *  `sub` = index du jeton `commit`, `origine` = pour un embarqué, la tête qui le porte et l'extrait
 *  qui cite `git commit` (`motifDuCommitPresume`). DIRECT : `git … commit` en tête d'un segment
 *  profond (enrobeurs, mots réservés, sous-shells épluchés ; argument-chaîne d'un interpréteur
 *  déployé). EMBARQUÉ : porté en arguments par une tête qui n'est pas un CITEUR — en argv
 *  (`find … -exec env git commit`), ou dans un argument qui contient une espace, ré-analysé comme
 *  une chaîne de commande (`watch '…'`, `find … -exec sh -c '…'`), la VALEUR d'un jeton
 *  `<clé>=<valeur>` comprise (`su --command='…'`, `-c core.editor='…'`). Une analyse coupée par une
 *  borne (`nouveauBudget`) rend un commit EMBARQUÉ présumé (`sub` = -1, aucun jeton). Mémoïsé
 *  (`memoParCommande`). */
const commitsDe = memoParCommande((command) => {
  const budget = nouveauBudget()
  const commits = []
  collecterCommits(command, 0, null, budget, commits)
  if (budget.sature) commits.push({ jetons: [], enrobeurs: [], sub: -1, embarque: true, origine: { sature: true } })
  return commits
})

/** Ajoute `commit` à `commits`, sauf s'il demande l'aide (`-h`/`--help`) : git la rend sans committer. */
function ajouterCommit(commits, commit) {
  if (!porteOption(lireCommit(commit).options, 'help')) commits.push(commit)
}

/** Ajoute à `commits` ceux que `command` exécute (`commitsDe`). `origine` = `null` au premier niveau ;
 *  dans une ré-analyse, la tête et l'extrait qui la portent, et ses commits sont EMBARQUÉS. La
 *  profondeur et le budget sont ceux de l'analyse entière ; seuls les segments ré-analysés consomment
 *  `budget.reste`. */
function collecterCommits(command, profondeur, origine, budget, commits) {
  for (const pipeline of pipelinesDeJetons(command, profondeur, { budget })) {
    for (const { jetons, enrobeurs, deploye } of pipeline) {
      if (origine) {
        if (budget.reste <= 0) { budget.sature = true; return }
        budget.reste -= 1
      }
      const textes = jetons.map((j) => j.text)
      const sub = gitCommitSubcommandIndex(textes)
      if (sub !== -1) { ajouterCommit(commits, { jetons, enrobeurs, sub, embarque: origine !== null, origine }); continue }
      const affectee = affectationPowerShell(jetons)?.valeur[0]
      if (deploye || estCiteur(textes) || (affectee && !jetonNu(affectee))) continue
      for (let k = 1; k < textes.length; k++) {
        const t = textes[k]
        const idx = estGit(t) ? gitCommitSubcommandIndex(textes, k) : -1
        if (idx !== -1) {
          const cite = origine ?? { tete: textes[0], extrait: textes.slice(k, idx + 1).join(' ') }
          ajouterCommit(commits, { jetons: jetons.slice(k), enrobeurs, sub: idx - k, embarque: true, origine: cite })
          continue
        }
        const valeur = /^[^\s=]+=/.test(t) ? t.slice(t.indexOf('=') + 1) : t
        if (/\s/.test(valeur)) collecterCommits(valeur, profondeur + 1, origine ?? { tete: textes[0], extrait: t }, budget, commits)
      }
    }
  }
}

/** Motif d'un commit PRÉSUMÉ, ou `null` : dès que `commitsDe` rend un commit embarqué (ou le présumé
 *  de saturation), avec ou sans commit direct, tout refus de la garde le porte en tête — la tête et
 *  l'extrait du premier embarqué, et la sortie. */
export function motifDuCommitPresume(command) {
  const embarque = (command ? commitsDe(command) : []).find((c) => c.embarque)
  if (!embarque) return null
  const { origine } = embarque
  const extrait = (texte) => coupeAuMot(texte, 80)
  const cause = origine?.sature
    ? `l'analyse de la commande dépasse ses bornes (\`SEGMENTS_MAX\` segments ré-analysés ou \`PROFONDEUR_MAX_ENROBEURS\` niveaux) : un commit y est présumé`
    : `\`${origine?.tete ?? '?'}\` porte \`git commit\` en argument (\`${extrait(origine?.extrait ?? '')}\`) ; une tête hors CITEURS est présumée l'exécuter`
  return `⚠ Commit PRÉSUMÉ : ${cause}. Si c'est une citation, écrire le texte dans un fichier ou passer `
    + 'par une tête citeuse (`printf`, `grep`) ; les refus qui suivent comptent ce commit présumé.'
}

/** `true` si la commande exécute STRUCTURELLEMENT un `git commit`, direct ou embarqué
 *  (`commitsDe`) — jamais un grep de sous-chaîne sur la ligne entière (#591 défaut 3). */
export function isGitCommitCommand(command) {
  if (!command) return false
  return commitsDe(command).length > 0
}

// Options de `git commit` — source : `git commit --help-all` de git 2.43.0 (options cachées comprises),
// plus `-h`/`--help`, internes à parse-options (l'aide, sortie 129, aucun commit), par nom LONG
// canonique. `requise` = valeur obligatoire (collée par `=` ou token suivant ; pour la
// lettre courte, collée ou token suivant) ; `optionnelle` = valeur COLLÉE seulement (`--gpg-sign=<id>`,
// `-S<id>`, `-u<mode>`) ; `booleen` = aucune valeur. La valeur d'une option n'est jamais un pathspec.
const OPTIONS_DU_COMMIT = {
  requise: [
    'file', 'author', 'date', 'message', 'reedit-message', 'reuse-message', 'fixup', 'squash',
    'trailer', 'template', 'cleanup', 'pathspec-from-file',
  ],
  optionnelle: ['gpg-sign', 'untracked-files'],
  booleen: [
    'quiet', 'verbose', 'reset-author', 'signoff', 'edit', 'status', 'all', 'include', 'interactive',
    'patch', 'only', 'no-verify', 'verify', 'dry-run', 'short', 'branch', 'ahead-behind', 'porcelain',
    'long', 'null', 'amend', 'no-post-rewrite', 'post-rewrite', 'pathspec-file-nul', 'allow-empty',
    'allow-empty-message', 'help',
  ],
}
/** Options sans graphie `--no-<nom>` (`git commit --help-all` : `--trailer`, et les paires
 *  `verify`/`post-rewrite` écrites des deux côtés ; `help`, interne à parse-options). */
const SANS_NEGATION = new Set(['trailer', 'verify', 'no-verify', 'post-rewrite', 'no-post-rewrite', 'help'])
/** Lettres courtes de `git commit` → nom long canonique. */
const LETTRES_DU_COMMIT = new Map([
  ['F', 'file'], ['m', 'message'], ['c', 'reedit-message'], ['C', 'reuse-message'], ['t', 'template'],
  ['S', 'gpg-sign'], ['u', 'untracked-files'], ['q', 'quiet'], ['v', 'verbose'], ['s', 'signoff'],
  ['e', 'edit'], ['a', 'all'], ['i', 'include'], ['p', 'patch'], ['o', 'only'], ['n', 'no-verify'],
  ['z', 'null'], ['h', 'help'],
])
/** Graphies longues ENTIÈRES → `{ nom, valeur }` ; une négation `--no-<nom>` ne prend pas de valeur. */
const GRAPHIES_LONGUES = new Map(
  Object.entries(OPTIONS_DU_COMMIT).flatMap(([valeur, noms]) => noms.flatMap((nom) => [
    [nom, { nom, valeur }],
    ...(SANS_NEGATION.has(nom) ? [] : [[`no-${nom}`, { nom: `no-${nom}`, valeur: 'booleen' }]]),
  ])),
)

/** Option longue de `git commit` désignée par `graphie` (sans `--` ni valeur) : la graphie EXACTE,
 *  sinon celle dont elle est le préfixe UNIQUE — parse-options accepte l'abréviation non ambiguë
 *  (`--incl`, `--pathspec-fr=l`). `null` si inconnue ou ambiguë (`--al`) : git refuse la commande. */
function optionLongueDuCommit(graphie) {
  const exacte = GRAPHIES_LONGUES.get(graphie)
  if (exacte) return exacte
  const candidates = [...GRAPHIES_LONGUES.keys()].filter((g) => g.startsWith(graphie))
  return candidates.length === 1 ? GRAPHIES_LONGUES.get(candidates[0]) : null
}

/** Token de REDIRECTION ou d'OPÉRATEUR de shell (`2>&1`, `>`, `>>`, `2>/dev/null`, `<`, `|`, `&&`,
 *  `;`) : à partir de lui, le segment ne parle plus à `git`, et rien de ce qui suit n'est un
 *  pathspec. Sans cette borne, `git commit -F msg.txt 2>&1 | tail -3` faisait de `2>&1` un pathspec :
 *  `analyzeStagedDiff` filtrait sur un chemin inexistant et déclarait ABSENT du diff tout fichier
 *  cité par le solde (mesuré 2026-09-04 sur un vrai commit de fermeture depuis un worktree). */
const OPERATEUR_SHELL_RE = /^(?:\d*(?:>>?|>&)|&(?![&>])|&>>?|<<?|\|\|?|&&|;)/

/** Index du premier jeton de `segment` (textes), à partir de `depart`, qui est une redirection ou un
 *  opérateur de shell (`OPERATEUR_SHELL_RE`) ; `segment.length` sinon. `segment.slice(0, fin)` est ce
 *  que la commande du segment reçoit en arguments. */
export function finAvantOperateur(segment, depart = 0) {
  const k = segment.findIndex((t, i) => i >= depart && OPERATEUR_SHELL_RE.test(t))
  return k === -1 ? segment.length : k
}

/** Opérateur de redirection en tête d'un jeton (`>`, `>>`, `>|`, `2>`, `&>`, `<`, `2>&1`, `>&-`), hors substitution de
 *  processus `<(…)`. */
const REDIRECTION_EN_TETE_RE = /^(?:\d*(?:>[>|]?|<(?!\())|&>>?)(&(?:\d+|-))?/

/** Les jetons d'un segment à partir de `depart`, sans ses redirections : chaque opérateur nu de redirection est retiré
 *  avec sa cible, collée (`>f`, `<in`, `<<MOT`) ou séparée (`> f`) ; une duplication (`2>&1`) n'en a pas. Les arguments
 *  qui suivent restent : la commande les reçoit (XCU 2.7). */
export function sansRedirections(jetons, depart = 1) {
  const gardes = jetons.slice(0, depart)
  for (let i = depart; i < jetons.length; i++) {
    const m = jetonNu(jetons[i]) ? REDIRECTION_EN_TETE_RE.exec(jetons[i].text) : null
    if (!m) { gardes.push(jetons[i]); continue }
    if (m[0] === jetons[i].text && !m[1]) i += 1
  }
  return gardes
}

/** Jeton de pathspec NON RÉSOLU, par PROVENANCE quotée (`tokenizeCommand`) : sa valeur n'est connue
 *  qu'après le shell ou git, et la garde ne réimplémente ni l'un ni l'autre.
 *  - GIT, quelle que soit la quote : joker de pathspec (`*`, `?`, `[`) et magie en tête (`:(glob)`,
 *    `:/`, `:!`) — git les reçoit tels quels et les interprète ;
 *  - SHELL, jeton nu : substitution de commande `$(…)`, `` `…` ``, expansion de variable `$NOM`,
 *    `${NOM}`, d'accolades `{a,b}`, tilde en tête `~`, antislash d'échappement (`a\ b.ts`).
 *    le critère mord sur N'IMPORTE QUEL de ces caractères — `$`, backtick, antislash, parenthèse ou
 *    accolade, ouvrante ou orpheline ;
 *  - SHELL, sous quote double : `$` et le backtick seuls ;
 *  - SHELL, sous quote simple : rien, le jeton est littéral. */
const JOKER_GIT = String.raw`[*?[]|^:`
const PATHSPEC_NON_RESOLU_RE = {
  nu: new RegExp(`${JOKER_GIT}|[$\`(){}\\\\]|^~`),
  double: new RegExp(`${JOKER_GIT}|[$\`]`),
  simple: new RegExp(JOKER_GIT),
}

/** `true` si le jeton (`tokenizeCommand`), lu comme pathspec, n'est pas résolu (`PATHSPEC_NON_RESOLU_RE`). */
function jetonNonResolu(jeton) {
  return PATHSPEC_NON_RESOLU_RE[jeton.quote ?? 'nu'].test(jeton.text)
}

/** Options de `git commit` qui lui fournissent des chemins HORS du texte de la commande. */
const OPTIONS_PATHSPEC_HORS_TEXTE = new Set(['pathspec-from-file', 'pathspec-file-nul'])

/**
 * Jetons d'UN commit de `commitsDe`, séparés en OPTIONS et CHEMINS positionnels. UN SEUL parcours,
 * sur la grammaire de git : les options longues
 * (exactes ou abrégées, `optionLongueDuCommit`) et les lettres courtes GROUPÉES (`-qi`, `-am`) où la
 * première lettre à valeur prend le RÉSIDU du jeton, ou le jeton suivant (`-m"ajoute…"`, `-cam` =
 * `-c am`). Chaque option est `{ nom, valeur }`, `nom` canonique (`no-<nom>` pour sa négation).
 * Après le premier `--`, tout jeton est un chemin, comme pour git (`-- src/a.ts -am` nomme `-am`).
 * `nonResolus` est vrai quand git reçoit des chemins que la garde ne connaît pas : un chemin
 * positionnel non résolu (`jetonNonResolu`), une option qui les lit hors du texte
 * (`OPTIONS_PATHSPEC_HORS_TEXTE`), une option inconnue ou ambiguë, un enrobeur de tête qui ajoute
 * des arguments (`xargs`), ou un commit EMBARQUÉ.
 * @returns {{ options: { nom: string, valeur: string | null }[], chemins: string[], nonResolus: boolean }}
 */
function lireCommit({ jetons, enrobeurs, sub, embarque }) {
  const segment = jetons.map((j) => j.text)
  const options = []
  const chemins = []
  let nonResolus = embarque || enrobeurs.some((e) => ENROBEURS_TETE.get(e).ajouteArguments === true)
  const lire = (option, valeur = null) => {
    if (!option) { nonResolus = true; return }
    options.push({ nom: option.nom, valeur })
    if (OPTIONS_PATHSPEC_HORS_TEXTE.has(option.nom)) nonResolus = true
  }
  let separe = false
  const fin = finAvantOperateur(segment, sub + 1)
  for (let k = sub + 1; k < fin; k++) {
    const t = segment[k]
    if (separe) {
      chemins.push(t)
      if (jetonNonResolu(jetons[k])) nonResolus = true
      continue
    }
    if (t === '--') { separe = true; continue }
    if (t.startsWith('--')) {
      const egal = t.indexOf('=')
      const option = optionLongueDuCommit(egal === -1 ? t.slice(2) : t.slice(2, egal))
      if (egal !== -1) lire(option, t.slice(egal + 1))
      else if (option?.valeur === 'requise') { lire(option, segment[k + 1] ?? null); k += 1 }
      else lire(option)
      continue
    }
    if (t.startsWith('-') && t.length > 1) {
      for (let l = 1; l < t.length; l++) {
        const option = GRAPHIES_LONGUES.get(LETTRES_DU_COMMIT.get(t[l]))
        if (!option) { lire(null); break }
        if (option.valeur === 'booleen') { lire(option); continue }
        const residu = t.slice(l + 1)
        if (residu !== '' || option.valeur === 'optionnelle') lire(option, residu || null)
        else { lire(option, segment[k + 1] ?? null); k += 1 }
        break
      }
      continue
    }
    chemins.push(t)
    if (jetonNonResolu(jetons[k])) nonResolus = true
  }
  return { options, chemins, nonResolus }
}

/**
 * Le commit dont la commande LIT options et chemins (`lireCommit`) — le premier DIRECT de `commitsDe`,
 * à défaut le premier embarqué — ou `null` si elle n'exécute pas de `git commit`. `nonResolus` est vrai aussi quand la commande porte PLUSIEURS commits : la forme d'un
 * seul ne couvre pas ce que les autres emportent. Les messages, eux, se lisent sur TOUS les commits
 * (`extractMessageSources`).
 * @returns {{ options: { nom: string, valeur: string | null }[], chemins: string[], nonResolus: boolean } | null}
 */
function jetonsDuCommit(command) {
  const commits = commitsDe(command)
  const lu = commits.find((c) => !c.embarque) ?? commits[0]
  if (!lu) return null
  const lecture = lireCommit(lu)
  return { ...lecture, nonResolus: lecture.nonResolus || commits.length > 1 }
}

/**
 * Pathspecs portés par un `git commit`, extraits de sa STRUCTURE : tout token qui n'est ni un flag
 * connu ni la valeur d'un flag qui en attend une est un chemin — qu'il précède ou suive le
 * séparateur `--`. `nonResolus` distingue les DEUX silences que la seule liste vide confondrait :
 * « la commande ne nomme aucun chemin » et « git reçoit des chemins que la garde ne connaît pas »
 * (causes : `nonResolus` de `jetonsDuCommit`). Alors la liste entière est invalide (`[]`) : les
 * fragments d'une substitution ou le fichier-liste ne sont pas les chemins commités, et un filtrage
 * sur eux rend un diff vide. L'appelant retombe sur l'ARBRE DE TRAVAIL (`formeDuCommit` → `tout`), le
 * seul diff qui les voit.
 * @returns {{ chemins: string[], nonResolus: boolean }}
 */
export function pathspecsDuCommit(command) {
  const jetons = command ? jetonsDuCommit(command) : null
  if (!jetons) return { chemins: [], nonResolus: false }
  return { chemins: jetons.nonResolus ? [] : jetons.chemins, nonResolus: jetons.nonResolus }
}

/** Les seuls pathspecs RÉSOLUS (`[]` quand il n'y en a pas, ou qu'un jeton non résolu les rend inutilisables). */
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
const texteProfond = memoParCommande((command) => [command, ...segmentsLus(command).map((s) => s.join(' '))].join('\n'))

/** Numéros de ticket que la commande FERME, dédupliqués/triés. `[]` si la commande n'est pas un
 *  `git commit`, ou si aucun mot-clef de fermeture n'apparaît. */
export function extractClosedIssues(command) {
  if (!command || !isGitCommitCommand(command)) return []
  return numerosFermes(texteProfond(command)).map(Number).sort((a, b) => a - b)
}

/** Numéros qu'une clause de fermeture de la commande ÉNUMÈRE sans leur verbe (`numerosNusEnumeres`),
 *  dédupliqués/triés. `[]` hors `git commit`. */
export function extractFermeturesNues(command) {
  if (!command || !isGitCommitCommand(command)) return []
  return numerosNusEnumeres(texteProfond(command)).map(Number).sort((a, b) => a - b)
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
const TITRE_REFUTATION = TRAILERS.REFUTATION.section


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
 * `verifierCaptures` d'une seule capture.
 */
export const verifierCapture = (chemin, options) => verifierCaptures([chemin], options).get(chemin)

/** Le chemin d'une capture tel que la porte le lit : séparateurs POSIX, sans `./` de tête. PUR. */
const cheminDeCapture = (chemin) => String(chemin ?? '').replace(/\\/g, '/').replace(/^\.\//, '')

/**
 * Le contrôle de chacune des `chemins` (`verifierCapture`) : chemin ↦ `{ ok, problemes }`. Le sort
 * de TOUTES au commit se lit en UN lot (`cheminsIgnores`) dans `depot` (celui de `racine` par
 * défaut, ses pannes dans `pannes`), quel que soit leur nombre.
 * @param {readonly string[]} chemins
 * @param {{ racine?: string, mtimeMin?: number, pannes?: string[], depot?: import('../guards/lib/gitPorte.mjs').Depot }} [options]
 * @returns {Map<string, { ok: boolean, problemes: string[] }>}
 */
export function verifierCaptures(chemins, { racine = process.cwd(), mtimeMin = 0, pannes = [], depot = depotDuHook(racine, pannes) } = {}) {
  const sousLeDossier = chemins.map(cheminDeCapture).filter((norm) => norm.startsWith(DOSSIER_CAPTURES))
  const ignorees = cheminsIgnores(depot, [...new Set(sousLeDossier)], { suivisCompris: true })
  return new Map(chemins.map((chemin) => [chemin, jugerCapture(chemin, { racine, mtimeMin, ignorees })]))
}

/** Le contrôle d'UNE capture (`verifierCapture`), son sort au commit lu dans `ignorees`. */
function jugerCapture(chemin, { racine, mtimeMin, ignorees }) {
  const problemes = []
  const norm = cheminDeCapture(chemin)
  if (!norm.startsWith(DOSSIER_CAPTURES)) {
    problemes.push(`capture "${chemin}" hors de ${DOSSIER_CAPTURES} (les captures de recette y vivent, cf. scripts/qc/capture-jeu.mjs)`)
    return { ok: false, problemes }
  }
  // Une capture qu'un `.gitignore` retient ne part PAS avec le commit : quiconque relit le solde
  // y trouve une preuve inouvrable. Le refus vient AVANT la lecture du disque — exister sur la
  // machine du geste ne la rend pas opposable. Hors dépôt, la porte ne juge que le disque : le banc
  // de `verifierCapture` travaille hors git.
  if (ignorees.has(norm)) {
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
 *  dispositions ne le dit sans mentir. Fichier et ligne se lisent sur CE QUE FAIT le commit
 *  (`ceQueFaitLeCommit`) : une fusion ne prouve que son apport propre, jamais le travail qu'elle
 *  amène d'une autre branche. Un fichier touché sans hunk (binaire, mode seul) ne tranche pas la
 *  ligne. Contrôles non fournis (appel PUR) = non joués ; la grammaire, elle, est toujours exigée. */
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
  const capture = captureDuSolde(content)
  if (!capture) {
    return ['"## Recette visuelle" sans ligne "capture: <chemin sous public/qc/>"']
  }
  return verifierCaptureDe(capture).problemes
}

/** La capture que cite la section « ## Recette visuelle » d'un solde, `null` sans section ni ligne
 *  `capture:`. PUR. @param {string | null} content @returns {string | null} */
function captureDuSolde(content) {
  const section = content ? sectionDe(content, TITRE_RECETTE_VISUELLE) : null
  return section === null ? null : CAPTURE_RE.exec(section)?.[1] ?? null
}

/**
 * Valide le CONTENU d'un solde. `today` = date du jour en `YYYY-MM-DD`.
 * Contexte INJECTÉ (`evaluerSolde` le remplit depuis git/le disque, un appel nu ne joue que la grammaire) :
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
 * Décision du hook (PURE, testable). `readSoldes(ns)` rend, dans l'ordre de `ns` et en UNE lecture
 * pour tous les tickets fermés, le contenu que le commit EMPORTE de chaque `.claude/soldes/<n>.md`, ou
 * `null`/`''` s'il n'y est pas. `soldeOnDisk(n)` renvoie le
 * contenu du même fichier sur le DISQUE : il ne sert qu'à distinguer « jamais écrit » de « écrit mais
 * non stagé » dans le message. `contexteSolde` = le contexte injecté de
 * `validateSolde` (diff stagé, hunks, écran touché), où `verifierCapturesDe(chemins)` contrôle d'un
 * coup les captures de TOUS les soldes (`verifierCaptures`) et `histoireDe(shas)` lit d'un coup les
 * shas que TOUS les soldes citent par « corrigé par » (`histoireDesCitations`) — `issuesFermees` y est
 * posé ICI, c'est cette décision qui connaît les tickets fermés.
 * @returns {{ reason: string } | null} — non-null = refus, null = silence.
 */
export function evaluate({ command, today, readSoldes, soldeOnDisk = () => null, contexteSolde = {} }) {
  const nus = extractFermeturesNues(command)
  if (nus.length > 0) {
    const cites = nus.map((n) => `#${n}`).join(', ')
    return {
      reason:
        `⛔ ${cites} suit une clause de fermeture sans son propre mot-clef : seul le premier \`#N\` d'une `
        + 'clause se ferme (`numerosFermes`, scripts/guards/lib/fermetures.mjs). '
        + `Geste : écrire \`corrige ${nus.map((n) => `#${n}`).join('`, `corrige ')}\` `
        + `pour chacun, ou \`refs ${nus.map((n) => `#${n}`).join(' ')}\` s'il n'est pas fermé.`,
    }
  }

  const issues = extractClosedIssues(command)
  if (issues.length === 0) return null

  const lus = readSoldes(issues)
  const emportes = new Map(issues.map((n, i) => [n, lus[i]]))
  const { verifierCapturesDe, histoireDe, ...contexte } = contexteSolde
  let captures = null
  const verifierCaptureDe = verifierCapturesDe && ((chemin) => {
    captures ??= verifierCapturesDe([...new Set([...emportes.values()].map(captureDuSolde).filter(Boolean))])
    return captures.get(chemin)
  })
  let histoire = null
  const lue = () => (histoire ??= histoireDe([...new Set([...emportes.values()].flatMap(shasCitesDuSolde))]))
  const citations = histoireDe ? {
    commitEstAncetre: (sha) => lue().commitEstAncetre(sha),
    fichiersDuCommit: (sha) => lue().fichiersDuCommit(sha),
    lignesDuCommit: (sha, fichier) => lue().lignesDuCommit(sha, fichier),
  } : {}
  const failures = []
  for (const n of issues) {
    const emporte = emportes.get(n)
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
    const { ok, problems } = validateSolde(emporte, today, { ...contexte, ...citations, verifierCaptureDe, issuesFermees: issues })
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null

  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
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
  try { return readFileSync(join(dir, cheminDuSolde(n)), 'utf8') } catch { return null }
}

/** Le chemin du solde du ticket `n`, relatif à la racine du dépôt. */
const cheminDuSolde = (n) => `.claude/soldes/${n}.md`

/** Le solde de chacun des tickets `ns` que `commit` (`diffDuCommit`) EMPORTE, dans leur ordre, `null`
 *  s'il n'y est pas : UNE lecture pour tous (`contenus`). @param {number[]} ns @returns {(string | null)[]} */
export function soldesEmportes(commit, ns) {
  const lus = commit.contenus(ns.map(cheminDuSolde))
  return ns.map((n) => lus.get(cheminDuSolde(n)) ?? null)
}

// ── Porte du TICKET (option retenue par l'utilisateur le 2026-09-11) ──────────────────────────────
// Le ticket est l'unité de travail : un commit qui touche `src` ou `scripts` cite au moins un ticket.
// Le critère de SUBSTANCE (`estCheminDeSubstance`) est le même pour la porte et pour le pré-filtre des
// commentaires de dette (`fichiersCitantTickets`) : une seule définition. La grammaire des références est celle des deux extracteurs déjà en place (`extractClosedIssues` pour
// `corrige`/`fixes`/`closes`/`ferme`, `extractRefIssues` pour `ref`/`refs`), jamais une regex de plus.
// Ce que le commit EMPORTE décide (`diffDuCommit`), pas l'index : un `git commit -- <chemins>` ou un
// `-a` sans `git add` emporte l'arbre de travail, et c'est ce lot-là que la porte doit voir.
const MAX_FICHIERS_NOMMES = 3

/** Les dossiers qui font la SUBSTANCE d'un commit : le moteur et l'outillage. */
const DOSSIERS_DE_SUBSTANCE = ['src', 'scripts']

/** Ce chemin est-il de SUBSTANCE ? PUR — le pendant par-chemin de `DOSSIERS_DE_SUBSTANCE`, pour qui
 *  tient déjà la liste des fichiers (le contenu qu'un commit EMPORTE) plutôt qu'un pathspec git. */
function estCheminDeSubstance(chemin) {
  const p = String(chemin ?? '').replace(/\\/g, '/')
  return DOSSIERS_DE_SUBSTANCE.some((d) => p === d || p.startsWith(`${d}/`))
}

/**
 * Décision de la porte du ticket (PURE, testable). `fichiersEmportes` = les chemins que le commit
 * va produire (`analyzeDiffDuCommit(...).fichiers`), injectés par `evaluerSolde` ; quand la commande porte
 * PLUSIEURS commits, c'est le lot de tous (`formeDuCommit` → `tout`). `messages` = le message de
 * chaque commit (`messagesDesCommits`, calculé sans lire de fichier quand l'appelant ne le fournit
 * pas). UNE règle, par commit : un message LISIBLE cite un ticket (`numerosCites`), direct ou
 * embarqué ; un message INVISIBLE (éditeur, message d'un autre commit) retombe, pour un commit
 * direct, sur les tickets que le texte de la commande cite HORS des messages lisibles de ses commits
 * (`extractClosedIssues`/`extractRefIssues`) — le ticket d'un autre commit n'est pas le sien —, et
 * compte comme sans ticket pour un commit embarqué (son motif : `motifDuCommitPresume`). Le refus nomme le rang et la
 * tête du premier commit sans ticket quand la commande en porte plusieurs.
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluatePorteDuTicket({
  command,
  fichiersEmportes = [],
  messages = messagesDesCommits(command, { readFile: () => null }).messages,
}) {
  if (!command || !isGitCommitCommand(command)) return null
  const substance = fichiersEmportes.filter(estCheminDeSubstance)
  if (substance.length === 0) return null
  let horsMessages = null
  const sansTicket = (m) => {
    if (m.texte !== null) return numerosCites(m.texte).length === 0
    if (!m.direct) return true
    if (horsMessages === null) {
      const lus = new Set(messages.flatMap((l) => (l.texte !== null ? numerosCites(l.texte) : [])))
      horsMessages = [...extractClosedIssues(command), ...extractRefIssues(command)].filter((n) => !lus.has(String(n)))
    }
    return horsMessages.length === 0
  }
  const rang = messages.findIndex(sansTicket)
  if (rang === -1) return null
  const fautif = messages[rang]
  const lequel = messages.length > 1 ? ` (commit n°${rang + 1} de la commande, \`${fautif.tete ?? 'présumé'}\`)` : ''
  const messageInvisible = fautif.direct && fautif.texte === null

  const nommes = substance.slice(0, MAX_FICHIERS_NOMMES).join(', ')
  const reste = substance.length > MAX_FICHIERS_NOMMES ? ` (+${substance.length - MAX_FICHIERS_NOMMES})` : ''
  // Message NON LISIBLE ICI : `--amend` sans `-m`/`-F` hérite du message de HEAD, et un `git commit`
  // nu (ou `-v`/`-e`) l'ouvre dans l'ÉDITEUR — dans les deux cas le ticket peut y être, la commande
  // ne le porte pas. Le refus le DIT, au lieu d'ordonner de citer un ticket déjà écrit.
  return {
    reason:
      `⚠ Commit de SUBSTANCE sans ticket${lequel} : ${nommes}${reste}. Ajouter \`refs #N\` au message (ou `
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
const REFUTATION_LINE_RE = TRAILERS.REFUTATION.ligne
const MIN_REFUTATION_LINE_LEN = TRAILERS.REFUTATION.min

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
 * STAGED (`git diff --cached`), injectés par `evaluerSolde`. `readRefFile(n)` lit
 * `.claude/soldes/ref-<n>.md` (ou `null`). `fusionEnCours` (`MERGE_HEAD`, `diffDuCommit(…).enFusion()`) :
 * silence — sauver une fusion n'est pas une livraison (#2328 A1).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateAntiEsquive({ command, fusionEnCours = false, stagedTouchesSrc, stagedTotalLines, readRefFile = () => null }) {
  if (!command || !isGitCommitCommand(command) || fusionEnCours) return null
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
const JUGE_LINE_RE = TRAILERS.JUGE.ligne
const MIN_JUGE_LINE_LEN = TRAILERS.JUGE.min
const JUGE_VISION_LINE_RE = TRAILERS['JUGE-VISION'].ligne
const MIN_JUGE_VISION_LINE_LEN = TRAILERS['JUGE-VISION'].min

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

/** La section du trailer `nom` d'un solde (`corpsDuTrailer`, la grammaire de la publication) : présence
 *  + longueur minimale du corps. */
function checkNamedSection(content, nom) {
  const { section: label, min } = TRAILERS[nom]
  const body = corpsDuTrailer(content, nom)
  if (body === null) return { problems: [`section "## ${label}" absente`] }
  return { problems: body.length < min ? [`"## ${label}" trop maigre (${body.length} car., ${min} requis)`] : [] }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge" (symétrie exacte de
 *  `validateRefFile`, mécanisme distinct — n'exige pas de "## Réfutation"). */
export function validateJugeFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, 'JUGE')
  return { ok: problems.length === 0, problems }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge-Vision". */
export function validateJugeVisionFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, 'JUGE-VISION')
  return { ok: problems.length === 0, problems }
}

/**
 * Décision JUGE (PURE, testable). Même périmètre de déclenchement qu'`evaluateAntiEsquive` (silence
 * sur les fermetures, déjà couvertes par leur propre solde ; silence aussi sur un commit sans AUCUN
 * ticket rattaché — #591). `stagedTouchesUi` = le diff staged touche `src/ui/**` (tests compris).
 * `fusionEnCours` : silence, comme `evaluateAntiEsquive` (#2328 A1).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateJuge({ command, fusionEnCours = false, stagedTouchesSrc, stagedTotalLines, stagedTouchesUi, readRefFile = () => null }) {
  if (!command || !isGitCommitCommand(command) || fusionEnCours) return null
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

// ── Message HÉRITÉ (invisible au contrôle) ─────────────────────────────────────────────────────

/** Options de `git commit` qui reprennent le message d'un AUTRE commit, par PORTÉE de l'héritage
 *  (sonde git 2.43) :
 *  - `sauf-message` : `--amend` (HEAD), `-C`/`--reuse-message`, `-c`/`--reedit-message` (le commit
 *    nommé) — un `-m`/`-F` remplace le message entier ;
 *  - `toujours` : `--fixup`, `--squash` — le sujet `fixup!`/`squash!`/`amend!` du commit nommé reste
 *    en tête même sous `-m` (git refuse `-m` avec `--fixup=amend:`/`reword:`). */
const MESSAGE_HERITE = new Map([
  ['amend', 'sauf-message'], ['reuse-message', 'sauf-message'], ['reedit-message', 'sauf-message'],
  ['fixup', 'toujours'], ['squash', 'toujours'],
])

/**
 * Un `git commit` dont le message est HÉRITÉ en tout ou partie (`MESSAGE_HERITE`) porte un texte
 * invisible à ce hook (et au closer de publication) : ni la commande ni un fichier lisible ne le
 * portent. Deny PRUDENT si le diff staged touche `src/**` ; silence sinon (un message hérité sans
 * substance src ne mérite pas un blocage).
 * @returns {{ reason: string } | null}
 */
export function evaluateAmendInvisible({ command, stagedTouchesSrc }) {
  const jetons = command ? jetonsDuCommit(command) : null
  if (!jetons || !stagedTouchesSrc) return null
  const explicite = porteMessage(jetons.options)
  const herite = [...MESSAGE_HERITE].some(
    ([nom, portee]) => porteOption(jetons.options, nom) && (portee === 'toujours' || !explicite),
  )
  if (!herite) return null
  return {
    reason:
      `⚠ Commit au message HÉRITÉ (--amend, -C/-c <commit> sans -m/-F ; --fixup/--squash <commit> ` +
      `toujours) : ce message est invisible au contrôle de solde (src/** touché) — re-committer avec -m ` +
      `(ou -F sur un fichier lisible), sans option qui hérite d'un sujet, pour que la ` +
      `fermeture/réfutation reste contrôlable.`,
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

/** Les valeurs des flags globaux `git -C <path>` d'un segment, dans l'ordre ; `[]` hors git. Git les
 *  compose (`git help git`, `-C` : « each subsequent non-absolute -C <path> is interpreted relative to
 *  the preceding -C <path> ») et laisse le répertoire inchangé sous `-C ""` ; la forme collée `-Cx`
 *  est refusée par git (« unknown option », mesuré git 2.51, #2224). */
function valeursGitDashC(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start || !estGit(segment[start])) return []
  const valeurs = []
  for (let k = start + 1; k < segment.length && segment[k].startsWith('-'); k++) {
    if (segment[k] === '-C' && segment[k + 1]) valeurs.push(segment[k + 1])
    if (GLOBAL_VALUE_FLAGS.has(segment[k])) k += 1
  }
  return valeurs
}

/** Commandes qui NOMMENT le répertoire où elles mènent, dans les deux shells où ce hook est câblé : POSIX (`cd`,
 *  `pushd`) et PowerShell (`Set-Location` et ses alias `sl`/`chdir`, `Push-Location`). Ne lire que `cd` faisait juger un
 *  commit de worktree contre l'ARBRE PRINCIPAL dès que la session parlait PowerShell (#1729 sonde 5). */
const VERS_UN_CHEMIN = ['cd', 'chdir', 'pushd', 'set-location', 'sl', 'push-location']
/** Commandes qui CHANGENT le répertoire courant : celles de `VERS_UN_CHEMIN`, et `popd`/`Pop-Location`, qui dépilent
 *  un lieu que la commande ne dit pas. */
export const CHANGEMENTS_DE_REPERTOIRE = new Set([...VERS_UN_CHEMIN, 'popd', 'pop-location'])

/** Chemin de commande NON EXPANSÉ (`$M`, `${M}`, `%M%`) : la variable vit dans le shell, pas dans le
 *  hook — le texte ne désigne aucun répertoire. */
const VARIABLE_NON_EXPANSEE_RE = /[$%]/

/** Chemin que la COMMANDE nomme, TEL QU'ÉCRIT (`brut` ; un relatif hérite de la variable non expansée
 *  du lieu qu'il prolonge) et résolu (`resolu`) : le lieu du premier `git -C <path>` en priorité, ses `-C` composés
 *  depuis le répertoire où tourne SON segment, sinon le dernier `cd`/`Set-Location`. `null` si aucun.
 *  Les `cd` se PLIENT dans l'ordre : chacun se résout contre le répertoire où le précédent a mené. */
function cheminNommeParLaCommande(command, cwd, platform) {
  const pas = (depuis, brut) => {
    const natif = versCheminNatif(brut, platform)
    const herite = !isAbsolute(natif) && VARIABLE_NON_EXPANSEE_RE.test(depuis?.brut ?? '')
    return { brut: herite ? depuis.brut : brut, resolu: resolve(depuis?.resolu ?? cwd, natif) }
  }
  let lieu = null
  for (const segment of segmentsLus(command)) {
    const dashC = valeursGitDashC(segment)
    if (dashC.length) return dashC.reduce(pas, lieu)
    if (VERS_UN_CHEMIN.includes(basenameExecutable(segment[0])) && segment[1]) lieu = pas(lieu, segment[1])
  }
  return lieu
}

/**
 * Répertoire CIBLE prouvé par la commande, et ce qu'elle nomme sans qu'il puisse servir de cwd.
 * `dir` n'est retenu que s'il désigne un répertoire RÉEL : un chemin porteur d'une variable non
 * expansée (`git -C "$M"`) et un chemin ABSENT du disque donnent au spawn de git un ENOENT
 * impossible à distinguer d'un git absent : la porte refuserait pour une lecture git indisponible un
 * geste que git exécute très bien (#1729 sondes 1-2). La cible d'un `git worktree add <cible>`
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


/** Analyse du `--numstat` du diff que le commit va produire (`diffDuCommit(...).numstat()`, entrées de
 *  `ceQuiChange`) : touche-t-il `src/**` ? un ÉCRAN (`estFichierEcran`, rendu par `touchesUi`) ?
 *  combien de lignes (insertions+suppressions) au total ? Fichiers binaires (`plus`/`moins` nuls)
 *  comptés 0 ligne mais peuvent toucher `src/**`. Aucune entrée → aucune touche, 0 ligne ; une
 *  PANNE de lecture n'est pas « aucune entrée » : `refusDesPannes` la refuse au rendu.
 *
 * AUCUN filtrage de pathspec ici (#591 défaut 1, arbre PARTAGÉ) : la restriction au lot de CETTE
 * commande est déjà faite par git, qui a produit ce `--numstat` en le bornant aux pathspecs
 * (`diffDuCommit`). La refaire ici avec un matcheur de chemins MAISON aveuglait la garde sur la
 * forme la plus courante — `git commit -- .` : `.` n'égale aucun chemin et ne préfixe aucun, donc
 * tout le lot était jeté (mesuré 2026-09-04). Un seul matcheur de pathspec dans ce fichier, et
 * c'est celui de git.
 *
 * `fichiers` porte les DEUX bouts d'un renommage (`chemins` de l'entrée) : c'est par eux que la porte
 * des stocks voit le porteur source ET le porteur cible, qu'un solde prouve sa correction au NOUVEAU chemin, et qu'un `.tsx` renommé reste un ÉCRAN (#1720).
 * `totalLines` compte le renommage replié : c'est le VOLUME écrit, et un renommage n'écrit rien.
 * `ecranParInsertion` (l'apport d'une fusion en cours, #2328 A5) : un écran ne compte que s'il y gagne
 * des lignes (`plus > 0`).
 * @param {readonly { plus: number | null, moins: number | null, chemins: string[] }[]} [entrees]
 * @param {{ ecranParInsertion?: boolean }} [options] */
export function analyzeDiffDuCommit(entrees = [], { ecranParInsertion = false } = {}) {
  const totalLines = entrees.reduce((n, e) => n + (e.plus ?? 0) + (e.moins ?? 0), 0)
  const fichiers = entrees.flatMap((e) => e.chemins)
  return {
    touchesSrc: fichiers.some((f) => /^src\//.test(f)),
    touchesUi: entrees.some((e) => (!ecranParInsertion || e.plus > 0) && e.chemins.some(estFichierEcran)),
    totalLines,
    fichiers,
  }
}

// ── Le diff que le commit va RÉELLEMENT produire ──────────────────────────────────────────────────
// `git commit` a quatre FORMES, et chacune emporte un contenu différent : avec des pathspecs
// (`git commit -- <paths>` ou chemins positionnels) c'est l'ARBRE DE TRAVAIL de ces chemins, HEAD pour
// les autres ; sous `-i`/`--include` (`git commit -h`), l'arbre de ces chemins et l'INDEX pour les
// autres ; avec `-a` c'est tout le modifié SUIVI, sinon c'est l'INDEX. Lire l'index dans les deux premiers cas
// rendait un diff VIDE quand rien n'était stagé, et toute évaluation qui en dépend se taisait —
// c'est par là que la croissance de stock de `429b9a1a2` est passée (cause prouvée par sonde le
// 2026-09-03). La forme se décide ICI, une fois, pour toutes les évaluations.
//
// `--amend` ne change pas la règle et n'ajoute PAS le diff de HEAD : un amend n'introduit aucun
// contenu que HEAD ne portait déjà (donc rien de neuf à juger), et le contenu final est de toute
// façon relu par la porte de PLAGE au pre-push (`scripts/guards/lib/plageStock.mjs`).

/** Forme d'un `git commit` : `pathspec` (arbre des chemins nommés), `inclus` (`-i`/`--include`,
 *  groupé compris : les mêmes, plus l'INDEX des autres chemins — #1801 H-3, #1806 A6), `tout` (-a),
 *  `index`. Rendent `tout`, le seul diff non borné, des chemins que la garde ne connaît pas
 *  (`jetonsDuCommit` → `nonResolus`) : git commite leur arbre de travail, et `index` ou `pathspec` sur
 *  des fragments le rend vide — dont un commit EMBARQUÉ, ou plusieurs commits, dont un seul ne borne
 *  pas ce que les autres emportent. */
export function formeDuCommit(command) {
  const jetons = command ? jetonsDuCommit(command) : null
  if (!jetons) return { forme: 'index', pathspecs: [] }
  if (jetons.nonResolus) return { forme: 'tout', pathspecs: [] }
  if (jetons.chemins.length > 0) return { forme: porteOption(jetons.options, 'include') ? 'inclus' : 'pathspec', pathspecs: jetons.chemins }
  if (porteOption(jetons.options, 'all')) return { forme: 'tout', pathspecs: [] }
  return { forme: 'index', pathspecs: [] }
}

/** Le dépôt des portes du hook dans `dir` (`depotDe`) : une lecture rend `null` pour un objet absent
 *  ou un code de sortie non nul ; une PANNE de git rend `null` elle aussi, et `pannes` (celles du
 *  contexte de l'appel, `contexte.pannes`) la garde : un refus NOMMÉ au rendu (`refusDesPannes`),
 *  jamais « rien n'est emporté ». */
const depotDuHook = (dir, pannes) => depotDe(dir, { enPanne: (_raison, vu) => pannes.push(refusDeGit(vu)) })

/**
 * Le refus UNIQUE de ce que git n'a pas lu : les `pannes` de lecture de l'appel, chacune nommée une
 * fois, en UN refus — `null` s'il n'y en a aucune. La CAUSE se nomme telle qu'elle est : un répertoire
 * qui existe mais n'est gouverné par aucun dépôt (`horsDepot`) n'est ni un git absent ni un cwd
 * manquant, et le renvoyer vers « un arbre où git répond » désignait la mauvaise correction (#1729).
 * @param {readonly string[]} pannes @param {{ cwd?: string|null, horsDepot?: boolean }} [ou] répertoire où la lecture a été tentée
 * @returns {{ reason: string } | null}
 */
export function refusDesPannes(pannes, { cwd = null, horsDepot = false } = {}) {
  if (!pannes.length) return null
  const cause = [horsDepot ? `hors dépôt : ${cwd}` : null, ...new Set(pannes)].filter(Boolean).join(' ; ')
  const geste = horsDepot
    ? 'Geste : rejouer depuis un arbre git (ce répertoire n’est gouverné par aucun dépôt).'
    : 'Geste : rejouer le commit depuis un arbre où git répond.'
  return { reason: `⛔ lecture git indisponible : ${cause} — la porte ne juge pas ce que git n'a pas lu. ${geste}` }
}

/**
 * Lectures du contenu que `command` va committer dans `dir` : `numstat()` (les champs du `--numstat`,
 * `analyzeDiffDuCommit`), `diff(chemins)` (le `-U0` de ces chemins, de tout le commit sans argument,
 * en un `git diff` par côté de la forme), `contenu(f)`/`lirePreImage(f)` (le fichier APRÈS le commit, et dans sa BASE
 * — `sourceDeLaBase`), `contenus(rels)`/`preImages(rels)` puis `images(chemins)` (les mêmes, lus par lot : `lireEnLot`). Diffs, chemins et renommages lus par `ceQuiChange` (plomberie), contre `base()` : l'image de HEAD
 * (`imageDeHead`), l'arbre vide dans un dépôt sans premier commit, qui n'a que l'index ; sous une
 * fusion EN COURS (`enFusion()`), sa fusion automatique : le commit se lit par son APPORT PROPRE
 * (`apport()`, `apportDeLaFusionEnCours`, une lecture), jamais par ce que ses parents fusionnés
 * apportent (#2328 A2). Une fusion que git ne rejoue pas LÈVE `GitIndisponible` à la lecture de `base()`.
 *
 * `contenu(f)` est la lecture de `sourceDuCommit`, qui suit la forme JUSQU'AU FICHIER, et c'est là que
 * se règle la porte de FERMETURE : sous `git commit -m "… corrige #N" -- src/x.ts`, un solde stagé
 * mais HORS pathspec n'est PAS emporté — git garde pour lui le contenu de HEAD. Lire l'index validait
 * une preuve que le commit ne portait pas (mesuré 2026-09-04). Donc : forme `index` → l'index ; forme
 * `pathspec` → l'arbre de travail pour un chemin DANS le pathspec, HEAD pour tous les autres
 * (`sourceMelee`) ; forme `inclus` → le même arbre, l'INDEX pour les autres ; forme `tout` → l'arbre
 * de travail des chemins suivis (`SUIVI`). `depot` : celui de `dir` par défaut, ses pannes dans `pannes`.
 */
export function diffDuCommit(command, dir = process.cwd(), { pannes = [], depot = depotDuHook(dir, pannes) } = {}) {
  const { forme, pathspecs } = formeDuCommit(command)
  let head
  /** Le sha de HEAD, lu une fois ; `null` sans premier commit (ou en panne, confiée à `pannes`). */
  const shaDeHead = () => (head === undefined ? (head = shaDe(depot, 'HEAD')) : head)
  const aHead = () => shaDeHead() !== null
  const contreIndex = () => forme === 'index' || !aHead()
  // Sous `MERGE_HEAD`, le commit à venir est une FUSION de HEAD et de `fusionnesEnCours`.
  // `pathspec` : git le refuse (`builtin/commit.c`, « cannot do a partial commit during a merge »).
  let fusionnes
  const enFusion = () => (fusionnes ??= aHead() && forme !== 'pathspec' ? fusionnesEnCours(depot) : []).length > 0
  let apportLu
  const apport = () => (apportLu ??= enFusion() ? apportDeLaFusionEnCours(depot, image(), fusionnes) : null)
  let imageDeBase
  const base = () => (imageDeBase ??= enFusion() ? apport().change.base : imageDeHead(depot))
  const vers = (apres, avant = base()) => ceQuiChange(depot, avant, apres)
  const image = () => (contreIndex() ? INDEX : SUIVI)
  const dans = (f) => pathspecs.some((ps) => pathMatchesPathspec(f, ps))
  // Sous `inclus`, le commit emporte l'arbre des pathspecs ET l'index des autres chemins : chaque
  // lecture de diff est l'union des deux, un chemin du pathspec lu dans l'arbre. Une entrée de l'index
  // qui TRAVERSE le pathspec (`git mv a b` puis `git commit -i -- b`, #1806 A6) se relit côté arbre avec
  // son bout extérieur, que git emporte aussi : la paire reste une paire. `-M` fixe la détection des
  // lectures `numstat` et `diff` : sans lui, `diff.renames=copies` de l'utilisateur fait d'une copie
  // une paire, et son bout extérieur se relit dans l'arbre au lieu de l'index (#1806 A6).
  const inclus = () => forme === 'inclus' && !contreIndex()
  const unir = (lecture, chemins, avant = base()) => {
    if (!inclus()) return lecture(vers(image(), avant), pathspecs)
    const index = lecture(vers(INDEX, avant), [])
    const traverse = (e) => chemins(e).some(dans) && !chemins(e).every(dans)
    const bouts = [...new Set(index.filter(traverse).flatMap(chemins).filter((f) => !dans(f)))]
    const cote = (f) => dans(f) || bouts.includes(f)
    return [...lecture(vers(SUIVI, avant), [...pathspecs, ...bouts]), ...index.filter((e) => !chemins(e).some(cote))]
  }
  const lireDepuis = (avant) => {
    if (!inclus()) return vers(image(), avant)
    const chemins = (filtre = '', specs = []) => unir((change, ps) => change.chemins(filtre, ps), (f) => [f], avant)
      .filter((f) => !specs.length || specs.some((ps) => ps.startsWith(':(literal)') ? f === ps.slice(10) : pathMatchesPathspec(f, ps)))
    const lire = (lecture, specs = []) => {
      const tous = chemins('', specs)
      return [true, false].map((dedans) => {
        const ps = tous.filter((f) => dans(f) === dedans).map((f) => `:(literal)${f}`)
        return ps.length ? lecture(vers(dedans ? SUIVI : INDEX, avant), ps) : null
      }).filter((x) => x !== null)
    }
    return {
      base: avant,
      chemins,
      numstat: (ps) => lire((change, specs) => change.numstat(specs), ps).flat(),
      diff: (ps, options) => lire((change, specs) => change.diff(specs, options), ps).join('\n'),
      lirePreImage: (f) => vers(INDEX, avant).lirePreImage(f),
      renommages: (ps) => new Map(lire((change, specs) => [...change.renommages(specs)], ps).flat()),
    }
  }
  const sourceDeLaBase = () => sourceGit({ cwd: dir, arbre: base(), depot })
  // La fusion en cours se lit aussi comme la plage lit une fusion (`lecturesDeFusion`), son image étant
  // ce que le commit emporte.
  let enCours
  const fusion = () => {
    if (enCours !== undefined) return enCours
    if (!enFusion()) return (enCours = null)
    try {
      const { parents, change } = apport()
      const lus = lecturesDeFusion(depot, { apres: image(), parents, fait: inclus() ? lireDepuis(base()) : change, lireDepuis })
      return (enCours = { ...lus, entree: entreeDeFusion(depot, lus.fusion, (f) => sourceDuCommit().lire(f)) })
    } catch (e) {
      if (!(e instanceof GitIndisponible)) throw e
      pannes.push(refusDeGit(e))
      return (enCours = null)
    }
  }
  const sourceA = (arbre) => sourceGit({ cwd: dir, arbre, depot })
  let source = null
  /** Les textes de `rels` que le commit EMPORTE, en un lot. */
  const contenus = (rels) => sourceDuCommit().lireTout(rels)
  /** Les textes de `rels` dans sa BASE, en un lot ; aucun sans premier commit. */
  const preImages = (rels) => (aHead() ? sourceDeLaBase().lireTout(rels) : new Map())
  const sourceDuCommit = () => (source ??= (() => {
    if (contreIndex()) return sourceGit({ cwd: dir, arbre: INDEX, depot })
    const suivi = sourceGit({ cwd: dir, arbre: SUIVI, depot })
    if (forme === 'tout') return suivi
    return sourceMelee({ dans, dedans: suivi, dehors: forme === 'inclus' ? sourceGit({ cwd: dir, arbre: INDEX, depot }) : sourceDeLaBase() })
  })())
  return {
    forme,
    pathspecs,
    base,
    numstat: () => unir((change, ps) => change.numstat(ps), (e) => e.chemins),
    diff: (chemins) => {
      const lecture = (apres, ps) => vers(apres).diff(ps, { renommages: true })
      if (!inclus()) return chemins?.length === 0 ? '' : lecture(image(), chemins ?? pathspecs)
      const dedans = chemins ? chemins.filter(dans) : pathspecs
      const dehors = chemins ? chemins.filter((c) => !dans(c)) : pathspecs.map((ps) => `:(exclude)${ps}`)
      return [dedans.length ? lecture(SUIVI, dedans) : '', dehors.length ? lecture(INDEX, dehors) : ''].filter(Boolean).join('\n')
    },
    contenu: (f) => sourceDuCommit().lire(f),
    lirePreImage: (f) => (aHead() ? sourceDeLaBase().lire(f) : null),
    contenus,
    preImages,
    images: (chemins) => {
      const post = contenus(chemins)
      const pre = preImages(chemins)
      return {
        lirePostImage: (f) => (post.has(f) ? post.get(f) : sourceDuCommit().lire(f)),
        lirePreImage: (f) => (pre.has(f) ? pre.get(f) : aHead() ? sourceDeLaBase().lire(f) : null),
      }
    },
    renommages: () => new Map(unir((change, ps) => [...change.renommages(ps)], (e) => e)),
    /** Les chemins que l'INDEX change contre `base()` : le lot stagé, l'apport stagé sous une fusion. */
    stages: () => vers(INDEX).chemins(),
    enFusion,
    apport,
    fusion,
    deplaceLaFrontiereCss: (chemins) => {
      const f = fusion()
      return deplaceLaFrontiere(f
        ? { chemins: f.fait.chemins(), nesOuMorts: () => f.fait.chemins('AD'), base: sourceA(f.fusion.commune), commit: sourceDuCommit(), racine: dir }
        : { chemins, nesOuMorts: () => unir((change, ps) => change.chemins('AD', ps), (e) => [e]), base: sourceDeLaBase(), commit: sourceDuCommit(), racine: dir })
    },
    cotesCss: () => {
      const f = fusion()
      const cote = (s) => coteCss(s, { racine: dir })
      return f
        ? { base: cote(sourceA(f.fusion.commune)), commit: cote(sourceDuCommit()), parents: f.fusion.parents.map((p) => cote(sourceA(p))) }
        : { base: cote(sourceDeLaBase()), commit: cote(sourceDuCommit()) }
    },
  }
}

/** Chemins que l'arbre de travail change contre l'index (`etatDeLArbre`, colonne Y) dans `dir` ; ce
 *  que l'index change, lui, se lit contre la base du commit (`diffDuCommit(…).stages()`). */
export function readChangedNames(dir = process.cwd(), { pannes = [] } = {}) {
  return etatDeLArbre(depotDuHook(dir, pannes)).filter((e) => e.etat !== '??' && e.etat[1] !== ' ').map((e) => e.chemins[0])
}

/** Fichiers de l'INDEX qui citent un des `numeros` (pré-filtre `git grep --cached -l`) : le scan de
 *  commentaires ne s'applique qu'à eux, jamais à l'arbre entier. */
export function fichiersCitantTickets(numeros, dir = process.cwd(), { pannes = [] } = {}) {
  if (numeros.length === 0) return []
  const motif = `#(${numeros.join('|')})([^0-9]|$)`
  return fichiersDuGrep(depotDuHook(dir, pannes), ['--cached'], motif, DOSSIERS_DE_SUBSTANCE)
}

/**
 * Le verdict PUR, ou `null` quand git n'a pas pu lire : sa raison (`GitIndisponible`) va à `pannes`,
 * que `refusDesPannes` refuse au rendu, en UN refus avec les autres pannes de l'appel. Une lecture
 * indisponible n'est pas un « non » : la conclure ferait refuser un solde juste (ou passer un solde
 * faux) sur rien. Toute autre erreur remonte.
 * @param {() => ({ reason: string } | null)} juger @param {string[]} pannes
 */
export function jugerOuConfier(juger, pannes) {
  try {
    return juger()
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    pannes.push(refusDeGit(e))
    return null
  }
}

/**
 * L'HISTOIRE que lit « corrigé par <sha> <fichier>:<ligne> » (`problemesCorrigePar`) pour les `shas`
 * cités, tous annoncés d'avance (`shasCitesDuSolde`) : le commit est-il dans HEAD (`histoire`,
 * `histoireDeHead`), quels chemins touche-t-il, quelles lignes de `fichier` — lus sur CE QUE FAIT le
 * commit (`ceQueFontLesCommits`), dans `depot`. Chaque lecture porte sur TOUS les shas cités à la
 * fois, au plus une fois : un sha cité de plus ne lance aucun processus. Une histoire vit le temps
 * d'UNE évaluation : aucun cache ne survit d'un appel du hook au suivant. Le diff est celui d'UN SHA
 * DÉJÀ POSÉ, à ne pas confondre avec `diffDuCommit`, qui lit ce que la commande EN COURS va emporter.
 * Un sha hors de HEAD n'a ni chemins ni lignes (`null`) ; sous `depotDuHook`, une panne de git rend
 * `[]`, et `refusDesPannes` la refuse au rendu.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {readonly string[]} shas
 * @param {{ histoire?: ReturnType<typeof histoireDeHead> }} [options] l'histoire de HEAD de l'évaluation
 * @throws {Error} une question sur un sha que `shas` n'annonce pas.
 */
export function histoireDesCitations(depot, shas, { histoire = histoireDeHead(depot) } = {}) {
  const annonces = [...new Set(shas)]
  let lus = null
  const lire = () => {
    if (lus) return lus
    const commits = histoire.commits(annonces)
    lus = { parSha: new Map(annonces.map((sha, i) => [sha, commits[i]])), fait: ceQueFontLesCommits(depot, commits.filter(Boolean)) }
    return lus
  }
  /** Le commit du graphe de HEAD que nomme `sha`, `null` hors de HEAD. */
  const commitDe = (sha) => {
    const { parSha } = lire()
    if (!parSha.has(sha)) throw new Error(`histoireDesCitations : « ${sha} » n'est aucun des shas annoncés (${annonces.join(', ')})`)
    return parSha.get(sha)
  }
  return {
    commitEstAncetre: (sha) => commitDe(sha) !== null,
    fichiersDuCommit: (sha) => {
      const commit = commitDe(sha)
      return commit && lire().fait.chemins().get(commit.sha)
    },
    lignesDuCommit: (sha, fichier) => {
      const commit = commitDe(sha)
      return commit && lignesDeHunks(lire().fait.patchs().get(commit.sha).get(fichier) ?? '')
    },
  }
}

/** Les shas que cite un solde par « corrigé par <sha> <fichier>:<ligne> » (`CORRIGE_PAR_RE`, la lecture
 *  de `checkRestesSection`). PUR. @param {string | null} content @returns {string[]} */
export function shasCitesDuSolde(content) {
  return content ? restesItems(content).map((l) => CORRIGE_PAR_RE.exec(l)?.[1]).filter(Boolean) : []
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
// archive `.claude/soldes/revue-palier-2205fde51.md:17`). La fermeture passe par le commit, un point.

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
 * `gh api --input <fichier>` est LU (`lire`, injecté par `evaluerSolde` depuis le répertoire d'exécution).
 *
 * HORS PORTÉE, dit : `gh api --input -`, dont le corps arrive par l'entrée standard. Un fichier
 * annoncé mais ILLISIBLE est refusé, jamais silencé (fail-closed sur sa propre annonce, comme le
 * `-F` d'un message de commit). Lire aussi la sortie de
 * `scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs`, qui joue ces cas.
 * @returns {{ reason: string } | null}
 */
export function evaluateFermetureHorsCommit(command, { lire = (p) => readFileSync(p, 'utf8') } = {}) {
  if (!command) return null
  const parCommit =
    `la fermeture passe par un commit \`corrige #N\` porteur de son solde (.claude/soldes/<N>.md) — ` +
    `le job \`fermetures\` de fermetures.yml (\`scripts/ops/fermer-depuis-main.mjs\`) ferme l'issue ET y poste ` +
    `le solde, checks requis du sha publié sur main verts. Fermer à la main court-circuite le contrôle entier.`
  for (const segment of segmentsLus(command)) {
    const forme = fermetureGh(segment)
    if (forme) {
      return { reason: `⛔ Fermeture de ticket HORS commit (${forme}) : ${parCommit}` }
    }
    const corps = corpsInputGh(segment, lire)
    if (!corps) continue
    if (corps.illisible) {
      return {
        reason:
          `⛔ Corps de requête \`gh api --input ${corps.chemin}\` illisible ou non-JSON pour le contrôle de ` +
          `fermeture — écrire un corps JSON lisible à ce chemin (fail-closed : pas de \`state: closed\` ` +
          `invisible).`,
      }
    }
    if (corps.etat === 'closed') {
      return {
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
  return segmentsLus(command).some((s) => fermetureGh(s) !== null || corpsInputGh(s, sansLecture) !== null)
}

/**
 * Le geste que ce garde JUGE, ou `null`. DEUX gestes, et deux seulement : un `git commit` (tous les
 * évaluateurs de solde, de ticket, d'esquive, de juge, d'amend, de manifeste, de hunks et de stocks
 * s'ouvrent sur `isGitCommitCommand`) et une fermeture `gh` hors commit
 * (`evaluateFermetureHorsCommit`, le seul évaluateur qui ne demande pas de commit).
 *
 * Tout le reste ne se lit pas : une commande de LECTURE (`ls`, `wc`…) n'a rien d'un commit, et lire
 * `readChangedNames` dans son cwd hors dépôt la refuserait pour une lecture git indisponible (#1729
 * sonde 3).
 * @returns {'commit'|'fermeture'|null}
 */
export function gesteJuge(command) {
  if (!command) return null
  if (isGitCommitCommand(command)) return 'commit'
  return porteUnGesteGh(command) ? 'fermeture' : null
}

// ── Nature de l'arbre ─────────────────────────────────────────────────────────────────────────────
// Un worktree lié porte un `.git` FICHIER (`gitdir: …`), l'arbre principal un `.git` DOSSIER : le fait
// se lit, il ne se déclare pas.

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
 *  ou `null` s'il n'y en a aucun. Lue sur le disque, pas par `racineDe` (`gitPorte.mjs`) : elle répond
 *  sans git, et pour une cible qui n'existe pas encore. */
function racineDeLArbre(dir = process.cwd()) {
  let courant = resolve(dir)
  for (;;) {
    if (existsSync(join(courant, '.git'))) return courant
    const parent = dirname(courant)
    if (parent === courant) return null
    courant = parent
  }
}

/**
 * Le chemin d'un `tool_input` d'écriture (`file_path`, sinon `path`), résolu UNE fois à l'entrée d'un
 * hook : toute la suite (périmètre, lecture disque, message) travaille sur lui, jamais sur le brut
 * (#1973). Graphie MSYS `/x/…` rendue native (`versCheminNatif`), relatif résolu contre `base` (le `dir`
 * du contexte, `construireContexte`, `scripts/hooks/repartiteur.mjs`), puis :
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
export function cheminDEcriture(toolInput, { base, platform = process.platform }) {
  const brut = cheminVise(toolInput)
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
 *  git ne reconnaît pas : aucune preuve, `false` — le hook garde (`gitPorte.mjs`, `estIgnore`). */
const ignoreParGit = (reel, racine) => estIgnore(depotDuHook(racine, []), reel)

// ── Hunks stagés emportés par `git commit -- <paths>` ─────────────────────────────────────────────
// `git commit -- <paths>` prend le contenu de l'ARBRE DE TRAVAIL de ces chemins, PAS l'index : un
// stage par HUNK y est silencieusement annulé, et le WIP non stagé part dans le commit (incidents
// acf2a447, bb824bafb). Le geste réel est une SÉQUENCE de deux appels — la porte se pose donc sur
// le commit, jamais sur « les deux dans une commande ».

/** `true` si les OPTIONS d'un `git commit` (`jetonsDuCommit`) activent l'option longue `nom` — lettre
 *  courte, groupée ou abrégée comprise : sa dernière occurrence n'est pas suivie de sa négation
 *  `no-<nom>`, comme dans git. */
function porteOption(options, nom) {
  const noms = options.map((o) => o.nom)
  return noms.lastIndexOf(nom) > noms.lastIndexOf(`no-${nom}`)
}

/** `true` si les OPTIONS d'un `git commit` portent son message (`-m`/`--message`, `-F`/`--file`). */
function porteMessage(options) {
  return options.some((o) => o.nom === 'message' || o.nom === 'file')
}

/** `true` si un segment `git commit` de la commande porte `-a`/`--all`. */
function aFlagTout(command) {
  const jetons = command ? jetonsDuCommit(command) : null
  return jetons !== null && porteOption(jetons.options, 'all')
}

/**
 * Décision « le commit prendra l'ARBRE, pas l'index ». `fichiersModifies` = `git diff --name-only`
 * (non stagé), `fichiersStages` = `git diff --cached --name-only`. C'est le SEUL évaluateur dont le
 * sujet EST l'index : il compare ce que l'index porte à ce que la commande va prendre.
 * @returns {{ reason: string } | { contexte: string } | null}
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
  // `-i`/`--include` stage l'ARBRE des chemins nommés PAR-DESSUS l'index, puis commite l'index ENTIER.
  const inclut = porteOption(jetonsDuCommit(command).options, 'include')
  const geste = inclut ? '`git commit -i <paths>`' : '`git commit -- <paths>`'
  if (aussiStages.length > 0) {
    return {
      reason:
        `⛔ ${geste} ` +
        (inclut
          ? `stage le contenu de l'ARBRE de ces chemins par-dessus l'index, puis commite l'index ENTIER : `
          : `prend le contenu de l'ARBRE et ignore l'index : `) +
        `${aussiStages.join(', ')} porte(nt) À LA FOIS des modifications stagées et non stagées — le ` +
        `stage par hunk serait annulé et le reste emporté. Committer sans pathspec (l'index fait foi), ` +
        `ou stager tout le fichier avant.`,
    }
  }
  return {
    contexte:
      `Note : ${nommes.join(', ')} porte(nt) des modifications NON stagées ; ${geste} les emportera ` +
      (inclut
        ? `(il stage l'arbre de ces chemins, puis commite l'index entier).`
        : `(il prend l'arbre, pas l'index).`),
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
 * PORTÉE DE MODULE d'une entrée ; sous une fusion en cours, `fusion` (`entreeDeFusion`) remplace les
 * deux : son APPORT est jugé (`bilanDuCommit`). Ne se prononce que sur un `git commit`.
 * @returns {{ reason: string } | null}
 */
export function evaluateStocksQuiGrandissent({ command, diff, images, fusion = null }) {
  if (!command || !isGitCommitCommand(command) || (!fusion && !diff)) return null
  const restantes = nonCouvertesDuBilan(bilanDuCommit({ diff, images, fusion }), command)
  return restantes.length ? { reason: raisonDeRefus(restantes) } : null
}

/**
 * Décision « un module FRANCHIT la frontière CSS sans que le message le dise, ou le message déclare un
 * franchissement qui n'a pas lieu » (`RECLASSEMENT:`, #1806 D2″). `cotes()` rend les côtés base et
 * commit (`coteCss`) ; ne se prononce que sur un `git commit` dont le message porte une ligne ou qui
 * peut déplacer la frontière (`deplace()`, `deplaceLaFrontiere`). Une lecture qui lève est un refus
 * NOMMÉ, jamais un passage muet.
 * @param {{ command: string, deplace: () => boolean, cotes: () => { base: object, commit: object } }} p
 * @returns {{ reason: string } | null}
 */
export function evaluateReclassementsCss({ command, deplace, cotes }) {
  if (!command || !isGitCommitCommand(command)) return null
  let ecarts
  try {
    if (!lignesDeReclassement(command).length && !deplace()) return null
    ecarts = reclassementsNonDeclares({ message: command }, cotes())
  } catch (e) {
    return { reason: `⛔ RECLASSEMENT CSS injugeable : ${e.message}` }
  }
  return ecarts.length ? { reason: raisonDeRefusDeReclassement([{ ecarts }]) } : null
}

/**
 * Le refus d'un commit qui fait GRANDIR le contexte permanent au-delà du plafond de sa pré-image sans
 * le DIRE (`CLIQUET:`). La mesure vient de ce que le commit EMPORTE, la référence et le plafond de sa
 * pré-image : c'est la même discipline de lecture que `evaluateStocksQuiGrandissent`.
 * @returns {{ reason: string } | null}
 */
export function evaluateBudgetContexte({ command, mesure, reference, plafond }) {
  if (!command || !isGitCommitCommand(command)) return null
  return refusDeBudget({ mesure, reference, plafond, message: command })
}

/**
 * Le listeur d'entrées DIRECTES d'une IMAGE git (`listerImage` puis `enfantsDirects`, `gitPorte.mjs`)
 * qu'attend `mesurerBudget` : `INDEX` pour ce que le commit emporte, sa BASE (`diffDuCommit(…).base()`,
 * `imageDeHead`) pour sa pré-image.
 * @param {string} arbre @param {string} dir @returns {(dossier: string) => string[]}
 */
export function listeurDuBudget(arbre, dir, { pannes = [] } = {}) {
  const depot = depotDuHook(dir, pannes)
  return (dossier) => enfantsDirects(listerImage(depot, arbre, dossier), dossier)
}

// ── Garde (#2125) : la porte de fermeture et de commit, sur la commande d'un canal shell ─────────
/**
 * Le verdict de la porte sur la commande de `entree`. `contexte` (répartiteur, `construireContexte`) :
 * `dir` = le répertoire où la commande s'exécute RÉELLEMENT, `null` s'il n'est pas jugeable — tout ce que la porte lit sur disque ou
 * dans git s'y lit (index, message `-F`, histoire) ; `cibleIgnoree` = ce que la
 * commande nommait sans que ce soit un répertoire réel, DIT dans tout refus ; `today` = date locale ;
 * `pannes` = les pannes de lecture git de l'appel, refusées au rendu (`refusDesPannes`).
 */
async function evaluerSolde(entree, contexte) {
  try {
    return await jugerLeSolde(entree, contexte)
  } catch (e) {
    // Une lecture que git ne rend pas, levée hors d'un juge (la base du commit, `imageDeHead`) : le
    // refus NOMMÉ des pannes, jamais une garde « en panne » qui laisse passer le commit.
    if (!(e instanceof GitIndisponible)) throw e
    const presume = motifDuCommitPresume(commandeDe(entree))
    const refus = refusDesPannes([...contexte.pannes, refusDeGit(e)], ouDeLaLecture(contexte.dir))
    return verdictDe(avecCibleIgnoree({ reason: presume ? `${presume} || ${refus.reason}` : refus.reason }, contexte.cibleIgnoree))
  }
}

/** Le répertoire où la lecture a été tentée, pour `refusDesPannes` : hors dépôt, la cause est là. */
const ouDeLaLecture = (dir) => ({ cwd: dir, horsDepot: natureDeLArbre(dir) === null })

/** Le jugement de `evaluerSolde`, dont une `GitIndisponible` levée remonte au refus nommé. */
async function jugerLeSolde(entree, { dir: targetDir, cibleIgnoree, today, pannes }) {
  const command = commandeDe(entree)
  // HORS des deux gestes jugés (commit, fermeture `gh`), la garde ne lit RIEN (#1729 sonde 3) ; un
  // lieu d'exécution non jugeable (`dir` nul) est refusé par la garde `canal-outil` du répartiteur.
  if (!gesteJuge(command) || targetDir === null) return null
  // HOTE UNIQUE de sortie : tout refus porte la cible écartée.
  const dire = (decision) => verdictDe(avecCibleIgnoree(decision, cibleIgnoree))
  const ou = ouDeLaLecture(targetDir)
  // Tout refus d'une commande qui porte un commit PRÉSUMÉ commence par son motif.
  const presume = motifDuCommitPresume(command)
  const prefixe = (motif) => (presume ? `${presume} || ${motif}` : motif)
  // Le contenu jugé est celui que le commit va EMPORTER, pas l'index (`diffDuCommit`) ; sous une fusion
  // en cours, son APPORT PROPRE (`commit.base()`, #2328 A2 et A5). Une fusion que git ne rejoue pas LÈVE
  // `GitIndisponible` : le refus nommé d'`evaluerSolde`, jamais une retombée sur le diff contre HEAD (#2328 D2).
  const commit = diffDuCommit(command, targetDir, { pannes })
  const { touchesSrc, touchesUi, totalLines, fichiers } = analyzeDiffDuCommit(commit.numstat(), { ecranParInsertion: commit.enFusion() })
  // Message `-F <chemin>` : résolu dans le répertoire où le `git commit` s'exécute RÉELLEMENT.
  const { text, fileError, messages } = extractMessageSources(command, { cwd: targetDir })
  if (fileError) {
    return dire({
      reason: prefixe(
        `⚠ Message de commit en fichier illisible pour le contrôle de solde (-F/--file "${fileError}") ` +
        `— utiliser -m ou un chemin lisible (fail-closed : pas de fermeture ni de réfutation invisibles).`),
    })
  }
  // Le mtime plancher de la capture de recette est celui du DERNIER fichier d'écran stagé : une
  // capture antérieure au geste montre l'écran d'avant.
  const mtimeEcrans = mtimeMaxDe(fichiers.filter(estFichierEcran), targetDir)
  // UNE histoire de HEAD pour l'évaluation, que les citations « corrigé par » de tous les soldes
  // partagent ; lue PARESSEUSEMENT, DANS le juge : une indisponibilité de git y est rattrapée et NOMMÉE.
  const histoire = histoireDeHead(depotDe(targetDir))
  const decision = jugerOuConfier(() => evaluate({
    command: text,
    today,
    // Le solde LU est celui que le commit EMPORTE (`commit.contenus`, un lot pour tous les soldes) :
    // sous un commit par pathspec, un solde stagé hors pathspec reste à la version de HEAD et la
    // preuve ne part pas.
    readSoldes: (ns) => soldesEmportes(commit, ns),
    soldeOnDisk: (n) => readSoldeFile(n, targetDir),
    contexteSolde: {
      fichiersEmportes: fichiers,
      lignesEmportees: (f) => lignesDeHunks(commit.diff([f])),
      touchesUi,
      verifierCapturesDe: (chemins) => verifierCaptures(chemins, { racine: targetDir, mtimeMin: mtimeEcrans, pannes }),
      histoireDe: (shas) => histoireDesCitations(depotDuHook(targetDir, pannes), shas, { histoire }),
    },
  }), pannes)
  // La porte du ticket juge le lot que le commit EMPORTE (`fichiers`), pas l'index : c'est la même
  // lecture que toutes les autres évaluations de cette garde.
  const porteDuTicket = evaluatePorteDuTicket({ command: text, fichiersEmportes: fichiers, messages })
  // TOUT ce que la garde lit sur DISQUE se lit dans le répertoire où le commit s'exécute — comme le
  // solde stagé et le message `-F`. Lu depuis le dépôt de la
  // garde, un fichier de réfutation écrit dans le worktree était invisible, et la porte refusait à tort.
  const antiEsquive = evaluateAntiEsquive({
    command: text,
    fusionEnCours: commit.enFusion(),
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    readRefFile: (n) => readRefFile(n, targetDir),
  })
  const juge = evaluateJuge({
    command: text,
    fusionEnCours: commit.enFusion(),
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
      fichiers: fichiersCitantTickets(fermes, targetDir, { pannes }),
      lire: (p) => commit.contenu(p),
    })
  }
  const hunks = evaluateHunksEmportes({
    command,
    fichiersModifies: readChangedNames(targetDir, { pannes }),
    fichiersStages: commit.stages(),
  })
  // BUDGET DU CONTEXTE PERMANENT : mesuré seulement si le commit touche un chemin du périmètre —
  // sinon aucune lecture n'est payée au-delà de l'image de `CLAUDE.md`, qui dit les fichiers IMPORTÉS
  // (`@<chemin>`) et donc le périmètre lui-même : ce que le commit emporte s'il l'emporte, son texte de base sinon.
  // La mesure porte sur ce que le commit EMPORTE (`commit.contenus`), la référence et le plafond sur son
  // texte de BASE (`commit.preImages`, `commit.lirePreImage`), chaque image lue par lot : relever la ligne du plafond dans le même commit ne suffit donc pas à
  // faire passer une accrétion. Le LISTAGE des skills/agents se lit PAR IMAGE lui aussi — l'index pour
  // ce que le commit emporte, sa BASE (`commit.base()`) pour la référence — sans quoi un poste SUPPRIMÉ par le commit
  // disparaîtrait des DEUX côtés et le refus dirait « aucun poste ne grossit ».
  const importsDuContexte = importsDe(commit.contenu('CLAUDE.md') ?? commit.lirePreImage('CLAUDE.md'))
  const budget = fichiers.some((f) => estCheminDuBudget(f, importsDuContexte))
    ? evaluateBudgetContexte({
      command: text,
      mesure: mesurerBudget(targetDir, { lireTout: commit.contenus, lister: listeurDuBudget(INDEX, targetDir, { pannes }) }),
      reference: mesurerBudget(targetDir, { lireTout: commit.preImages, lister: listeurDuBudget(commit.base(), targetDir, { pannes }) }),
      plafond: plafondDeLaSource(commit.lirePreImage(PORTEUR_DU_PLAFOND)),
    })
    : null
  // Voir COÛT (en-tête) : un refus qu'aucun autre étage ne rejuge sort ICI, avant les deux décisions
  // que `scripts/git-hooks/pre-push.mjs` rejuge (`croissancesDeLaPlage`). Tout refus d'un étage porte
  // le motif du commit présumé en tête (`prefixe`).
  const cumuler = (decisions) => {
    const cumul = decisionCumulee(decisions)
    return cumul ? dire({ ...cumul, reason: prefixe(cumul.reason) }) : null
  }
  const premier = cumuler([
    decision, porteDuTicket, antiEsquive, juge, amendInvisible, registresPorteurs,
    horsCommit, tombale, hunks?.reason ? hunks : null, budget, refusDesPannes(pannes, ou),
  ])
  if (premier) return premier
  // UN `git diff -U0` de ce que le commit emporte (`croissanceDesStocks` n'en lit que les porteurs), et
  // les images des porteurs par lot (`lireEnLot`). Sans porteur, ou hors `git commit`, rien n'est lu.
  // Sous une fusion en cours, les porteurs sont ceux de son APPORT (`commit.fusion`).
  const fusion = isGitCommitCommand(text) ? commit.fusion() : null
  const porteursDeStock = isGitCommitCommand(text) ? (fusion ? fusion.entree.fichiers : fichiers).filter(estPorteurDeStock) : []
  const stocks = porteursDeStock.length ? evaluateStocksQuiGrandissent({
    command: text,
    ...(fusion
      ? { fusion: fusion.entree }
      : { diff: commit.diff(), images: { ...commit.images(porteursDeStock), renommages: commit.renommages() } }),
  }) : null
  const reclassements = evaluateReclassementsCss({
    command: text,
    deplace: () => commit.deplaceLaFrontiereCss(fichiers),
    cotes: commit.cotesCss,
  })
  const second = cumuler([stocks, reclassements, refusDesPannes(pannes, ou)])
  if (second) return second
  return hunks?.contexte ? { contexte: hunks.contexte } : null
}

/** La garde de la porte (contrat : `scripts/guards/lib/contratGarde.mjs`) ; son point d'entrée propre :
 *  `scripts/hooks/solde-ticket-hook.mjs`. */
export const garde = { nom: 'solde-ticket', outils: OUTILS_SHELL, evaluer: evaluerSolde }
