// LECTEUR de commande shell : les gardes de commande de `scripts/hooks/` et la porte de commit
// (`scripts/hooks/solde-ticket-guard.mjs`) le partagent.
//
// LECTURE DE LA COMMANDE (`segmentsProfonds`) — ce qu'elle reconnaît, et rien d'autre :
//   - découpage : quotes, here-strings, heredocs (leur corps n'est pas une commande), enchaînements
//     `;` `&&` `||` `|`, sous-shells `( … )` ;
//   - tête d'un segment, épluchée jusqu'à stabilité : jetons nus et mots réservés (`TOKENS_TETE_NUS`),
//     affectations `VAR=val` (relevées par nom, `affectationsDEnvironnement`), enrobeurs de tête (`ENROBEURS_TETE`) ;
//   - porteurs de chaîne (`ENROBEURS_ARGUMENT`), relus comme une commande : l'argument de `sh`/`bash`/
//     `dash`/`zsh -c`/`-lc`, `npx -c`/`--call`, `Invoke-Expression` ; tout le reste de la ligne, joint
//     par des espaces, après `cmd /c`/`/k` (ou `//c`/`//k`, graphie Git Bash) et `eval` ; le texte
//     qu'exécute l'hôte `powershell`/`pwsh`, lu selon SA grammaire (`GRAMMAIRES_HOTE_POWERSHELL`, #2292) ;
//     la chaîne de `env -S`/`--split-string` suivie des arguments restants ; et `npm run <x>` (`npm test`/`start`/`stop`/`restart`), dont le script est
//     lu dans le `package.json` du dépôt de la portée (`racineNpmCourante`) ;
//   - blocs PowerShell (`TETES_DE_BLOC` : `%`, `ForEach-Object`, `foreach`, `for`, `try`, `catch`,
//     `finally`…) : le corps de chaque `{ … }` relu comme une commande (`lectureDesBlocs`) ;
//   - substitutions `$(…)`, `` `…` ``, `@(…)`, et de processus `<(…)`, `>(…)`, nues ou sous quote double
//     (`$(…)` seule dans une here-string `@"…"@`) : leur contenu relu comme une commande exécutée, où
//     qu'elles se trouvent dans le segment ;
//   - profondeur : `PROFONDEUR_MAX_ENROBEURS` niveaux de porteurs et `SEGMENTS_MAX` segments relus ;
//     au-delà, les gardes consommatrices refusent la commande (`REFUS_SATURE`), la garde de commit
//     présume un commit embarqué.
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { estRepertoire } from './gitPorte.mjs'
import { LECTEURS } from './appelsRunners.mjs'
import { racineNpmCourante } from './racineNpm.mjs'

// ── Parsing STRUCTUREL de la ligne de commande (#591 défaut 3) ───────────────────────────────────
// « est-ce un `git commit` ? » ne se décide plus par un grep de sous-chaîne sur la ligne entière
// (un `gh issue create --body "... git commit ..."` la faisait mordre à tort) : on TOKENISE la
// commande (quotes simples/doubles + here-strings PowerShell `@'…'@`/`@"…"@`), on la découpe en
// segments aux enchaînements top-level (`&&`, `;`, `||`, `|`), puis on identifie dans CHAQUE segment
// l'exécutable de tête et sa sous-commande (`git [-C <path>|-c <k=v>|...] commit`).
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
 *  découpage : `pipelinesProfonds` en dérive, le tube n'étant un
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

/** `true` si `c` est un tiret de PowerShell : `-`, U+2013, U+2014 ou U+2015 (`IsDash`, `CharTraits.cs:255-261`,
 *  PowerShell v7.5.5). Le lieur de cmdlet (`valeurParametre`) et l'analyseur de l'hôte (`cleDeParametreHote`)
 *  le partagent. */
function estTiretPowerShell(c) {
  return c === '-' || c === '\u2013' || c === '\u2014' || c === '\u2015'
}

/** Valeur d'un paramètre nommé d'une CMDLET (`''` si absent), selon le LIEUR DE CMDLET : le paramètre
 *  s'ouvre par un tiret (`estTiretPowerShell`) et se nomme par son nom EXACT ou par un PRÉFIXE NON AMBIGU,
 *  insensible à la casse — `-Command` s'écrit aussi bien `-com`, `-Comm`… : tout préfixe qu'aucun AUTRE
 *  paramètre de la commande ne partage, le nom exact lié en priorité (`-Query` à côté de `QueryDialect`).
 *  `noms` = tous ses paramètres. L'HÔTE `pwsh`/`powershell` suit une autre grammaire (`lireHotePowerShell`). */
export function valeurParametre(args, nom, noms = [nom]) {
  const cible = nom.toLowerCase()
  const autres = noms.map((n) => n.toLowerCase()).filter((n) => n !== cible)
  const i = args.findIndex((a) => {
    if (!estTiretPowerShell(a[0])) return false
    const p = a.slice(1).toLowerCase()
    return p !== '' && cible.startsWith(p) && (p === cible || !autres.some((n) => n.startsWith(p)))
  })
  return i !== -1 ? (args[i + 1] ?? '') : ''
}

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

// ── Analyseur de l'HÔTE PowerShell (#2292) ───────────────────────────────────────────────────────
// `pwsh` et `powershell` ne lient pas leurs paramètres comme une cmdlet : ils les essaient dans l'ORDRE de
// leur table, et le PREMIER couple `[nom, préfixe minimal]` qui correspond l'emporte (`MatchSwitch`,
// `CLPP.cs:793-802` ; ordre de `ParseHelper`, `CLPP.cs:897-1257`). `CLPP.cs` =
// `Microsoft.PowerShell.ConsoleHost/host/msh/CommandLineParameterParser.cs` du dépôt PowerShell, v7.5.5. La table de
// `powershell` 5.1.26100.9444, sans source publique, est MESURÉE (`scripts/ops/sondes/hote-powershell.mjs`).
// `lecture` : `commande` = la valeur et tout le reste de la ligne (`-CommandWithArgs` compris : ses `$args`
// sont joints, car la commande peut les exécuter) ; `encodee` = la valeur, base64 d'UTF-16LE ; `valeur` = la
// valeur est sautée ; `drapeau` = rien n'est sauté ; `fichier` = un script `.ps1` (ou stdin pour `-`), hors
// portée ; `fin` = l'hôte n'exécute rien ; `commandeIncluse` = ce jeton et tout le reste de la ligne.
// `nonReconnu` = la lecture d'un jeton qu'aucune entrée ne reconnaît, positionnel compris.
const HOTE_PWSH = {
  parametres: [
    { alias: [['version', 'v']], lecture: 'fin' }, // CLPP.cs:897
    { alias: [['help', 'h'], ['?', '?']], lecture: 'fin' }, // :908
    { alias: [['login', 'l']], lecture: 'drapeau' }, // :915
    { alias: [['noexit', 'noe']], lecture: 'drapeau' }, // :921
    { alias: [['noprofile', 'nop']], lecture: 'drapeau' }, // :927
    { alias: [['nologo', 'nol']], lecture: 'drapeau' }, // :932
    { alias: [['noninteractive', 'noni']], lecture: 'drapeau' }, // :937
    { alias: [['socketservermode', 'so']], lecture: 'drapeau' }, // :942
    { alias: [['v2socketservermode', 'v2so']], lecture: 'drapeau' }, // :949
    { alias: [['servermode', 's']], lecture: 'drapeau' }, // :956
    { alias: [['namedpipeservermode', 'nam']], lecture: 'drapeau' }, // :962
    { alias: [['sshservermode', 'sshs']], lecture: 'drapeau' }, // :968
    { alias: [['noprofileloadtime', 'noprofileloadtime']], lecture: 'drapeau' }, // :974
    { alias: [['interactive', 'i']], lecture: 'drapeau' }, // :979
    { alias: [['configurationfile', 'configurationfile']], lecture: 'valeur' }, // :984
    { alias: [['configurationname', 'config']], lecture: 'valeur' }, // :997
    { alias: [['custompipename', 'cus']], lecture: 'valeur' }, // :1010
    { alias: [['commandwithargs', 'commandwithargs'], ['cwa', 'cwa']], lecture: 'commande' }, // :1037
    { alias: [['command', 'c']], lecture: 'commande' }, // :1050
    { alias: [['windowstyle', 'w']], lecture: 'valeur' }, // :1059
    { alias: [['file', 'f']], lecture: 'fichier' }, // :1088
    { alias: [['outputformat', 'o'], ['of', 'o']], lecture: 'valeur' }, // :1103
    { alias: [['inputformat', 'inp'], ['if', 'if']], lecture: 'valeur' }, // :1109
    { alias: [['executionpolicy', 'ex'], ['ep', 'ep']], lecture: 'valeur' }, // :1114
    { alias: [['encodedcommand', 'e'], ['ec', 'e']], lecture: 'encodee' }, // :1129
    { alias: [['encodedarguments', 'encodeda'], ['ea', 'ea']], lecture: 'valeur' }, // :1139
    { alias: [['settingsfile', 'settings']], lecture: 'valeur' }, // :1148
    { alias: [['sta', 'sta']], lecture: 'drapeau' }, // :1158
    { alias: [['mta', 'mta']], lecture: 'drapeau' }, // :1178
    { alias: [['workingdirectory', 'wo'], ['wd', 'wd']], lecture: 'valeur' }, // :1198
    { alias: [['removeworkingdirectorytrailingcharacter', 'removeworkingdirectorytrailingcharacter']], lecture: 'drapeau' }, // :1212
    { alias: [['token', 'to']], lecture: 'valeur' }, // :1216
    { alias: [['utctimestamp', 'utc']], lecture: 'valeur' }, // :1230
  ],
  nonReconnu: 'fichier', // :713-720, :1246-1253
}
// `powershell` 5.1 : la table de pwsh, à ses écarts MESURÉS (`hote-powershell.mjs`) près — paramètres absents (lus
// comme non reconnus), préfixes minimaux qui diffèrent, jeton blanc sauté ; ce que la table ne reconnaît pas OUVRE
// la commande, lui compris.
const ABSENTS_DE_51 = new Set([
  'version', 'login', 'sshservermode', 'noprofileloadtime', 'interactive', 'configurationfile', 'custompipename',
  'commandwithargs', 'settingsfile', 'removeworkingdirectorytrailingcharacter',
])
const MINIMUMS_51 = { inputformat: 'i', sta: 'st' }
const HOTE_POWERSHELL_51 = {
  parametres: [
    { alias: [['', '']], lecture: 'drapeau' },
    ...HOTE_PWSH.parametres
      .filter(({ alias: [[nom]] }) => !ABSENTS_DE_51.has(nom))
      .map(({ alias: [[nom, min], ...autres], lecture }) => ({ alias: [[nom, MINIMUMS_51[nom] ?? min], ...autres], lecture })),
  ],
  nonReconnu: 'commandeIncluse',
}
/** Grammaire de l'hôte PowerShell, par exécutable. */
export const GRAMMAIRES_HOTE_POWERSHELL = { pwsh: HOTE_PWSH, powershell: HOTE_POWERSHELL_51 }
const FAMILLE_PWSH = { hote: HOTE_PWSH, suite: 'reste' }
const FAMILLE_POWERSHELL_51 = { hote: HOTE_POWERSHELL_51, suite: 'reste' }

/** Blancs de .NET, ceux que retire `String.Trim()` : `Char.IsWhiteSpace` (documentation .NET, « Remarques ») =
 *  U+0009-000D, U+0020, U+0085, U+00A0, U+1680, U+2000-200A, U+2028, U+2029, U+202F, U+205F, U+3000. Le `trim()` de JS
 *  n'est pas cet ensemble : il garde U+0085 et retire U+FEFF. */
const BLANCS_DOTNET = '[\t-\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]'
const BLANCS_DOTNET_AUX_BORDS = new RegExp(`^${BLANCS_DOTNET}+|${BLANCS_DOTNET}+$`, 'g')

/** Nom de paramètre que l'hôte lit dans ce jeton, en minuscules (`GetSwitchKey`, `CLPP.cs:705-734`) : le jeton
 *  privé des blancs de .NET à ses bords (`Trim()`, `BLANCS_DOTNET`), ouvert par un tiret (`estTiretPowerShell`) ou
 *  `/`, le second tiret retiré s'il est IDENTIQUE au premier ; `//` est la graphie Git Bash de `/`, comme le `//c`
 *  de `FAMILLE_CMD` (#2173). `''` pour un jeton blanc, `null` pour un positionnel. */
function cleDeParametreHote(jeton) {
  const t = jeton.replace(BLANCS_DOTNET_AUX_BORDS, '').replace(/^\/\//, '/')
  if (t === '') return ''
  if (!estTiretPowerShell(t[0]) && t[0] !== '/') return null
  return (estTiretPowerShell(t[0]) && t[1] === t[0] ? t.slice(2) : t.slice(1)).toLowerCase()
}

/** Lecture de l'hôte qui tranche `jeton` : celle de la PREMIÈRE entrée dont un couple
 *  `[nom, min]` correspond (`MatchSwitch` : au moins `min.length` caractères, préfixe de `nom`), sinon
 *  `nonReconnu`. */
function lectureDuJetonHote(jeton, { parametres, nonReconnu }) {
  const cle = cleDeParametreHote(jeton)
  if (cle === null) return nonReconnu
  const entree = parametres.find(({ alias }) => alias.some(([nom, min]) => cle.length >= min.length && nom.startsWith(cle)))
  return entree?.lecture ?? nonReconnu
}

/** Texte qu'exécute l'hôte PowerShell `famille.hote` sur `args`, lus de gauche à droite comme `ParseHelper`
 *  (`CLPP.cs:877-1257`) — forme de `lecturePorteur` —, `null` quand il n'exécute aucun texte de la ligne. */
function lireHotePowerShell(famille, args) {
  for (let i = 0; i < args.length; i++) {
    const lecture = lectureDuJetonHote(args[i], famille.hote)
    if (lecture === 'valeur') i += 1
    else if (lecture === 'commande') return portee(famille, args[i + 1] ?? null, args, i + 2)
    else if (lecture === 'commandeIncluse') return portee(famille, args[i], args, i + 1)
    else if (lecture === 'encodee') {
      const decodee = decodeCommandeEncodee(args[i + 1])
      return decodee === null ? null : { commande: decodee, suite: null, memeShell: false }
    } else if (lecture !== 'drapeau') return null
  }
  return null
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
  ['powershell', FAMILLE_POWERSHELL_51], ['pwsh', FAMILLE_PWSH],
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
  if (famille.hote) return lireHotePowerShell(famille, args)
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
export const ENROBEURS_TETE = new Map([
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
const DEPOT_DU_LECTEUR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CACHE_SCRIPTS = new Map() // mémo-pur : répertoire résolu → sa table `scripts`
export function scriptsNpm(dir = racineNpmCourante() ?? DEPOT_DU_LECTEUR) {
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
export function estGit(jeton) {
  return basenameExecutable(jeton) === 'git' || basenameExecutable(jeton.replace(/\\(.)/g, '$1')) === 'git'
}

/** Sous-commande git d'un segment et ses arguments : `{ sub, args }`, ou `null` si le segment
 *  n'exécute pas `git`. */
export function gitSubcommand(segment) {
  const idx = gitSubcommandIndex(segment)
  if (idx === -1) return null
  return { sub: segment[idx], args: segment.slice(idx + 1) }
}

/** Affectation PowerShell `$nom = …` en tête d'un segment (ses jetons) : `{ nom, valeur }`, `valeur` = les
 *  jetons qui suivent le `=`, ou `null`. */
export function affectationPowerShell(jetons) {
  const nom = /^\$(\w+)$/.exec(jetons[0]?.text ?? '')?.[1]
  return nom && jetonNu(jetons[0]) && jetons[1]?.text === '=' ? { nom, valeur: jetons.slice(2) } : null
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
export function memoParCommande(calcul) {
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
export const segmentsLus = memoParCommande((command) => segmentsProfonds(command))

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

// ── Répertoire CIBLE de la commande (#587) ─────────────────────────────────────────────────────────
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
