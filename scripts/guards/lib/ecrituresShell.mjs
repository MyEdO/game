import { affectationPowerShell, basenameExecutable, CHANGEMENTS_DE_REPERTOIRE, cheminsDe, cibleDeLaCommande, ciblesDeRedirectionAvecProvenance, gitSubcommand, jetonNu, pipelinesDeJetons, sansRedirections, texteDuSegment, versCheminNatif } from './commandeShell.mjs'
import { readFileSync } from 'node:fs'
import { VARIABLES_AMORCEES, ciblesDEcritureJS, repertoireTemporaire } from './ecrituresFichiers.mjs'

/** Un mot développé NON CONSTANT (variable inconnue, `MOT_INCONNU` d'un lancement JS, argument qu'alimente `xargs`) :
 *  il porte `\0`. En position de sous-commande de git, npm, npx ou gh, l'écrivain n'est pas prouvé, donc non jugé (#2537). */
const nonConstant = (mot) => typeof mot === 'string' && mot.includes('\0')

/**
 * La table FERMÉE des écrivains de fichiers (#2537), bornée par trois sources figées, données de son test
 * (`fixtures/ecrivains-sources.json`, concordance dans `ecrituresShell.test.mjs`) :
 * - POSIX : les utilitaires de XCU (POSIX.1-2024, Issue 8, `idx/utilities.html`) qui créent, modifient ou suppriment
 *   un fichier ; tout autre utilitaire de XCU y porte sa raison d'exclusion ;
 * - hors POSIX : les écrivains des commandes shell des agents (14 jours), chacun avec son compte d'attestations au
 *   corpus ;
 * - PowerShell : `Get-Command -Verb <verbes qui modifient> -Module Microsoft.PowerShell.*` et ses alias ; toute autre
 *   cmdlet y porte sa raison d'exclusion.
 * Les écrivains, par source (`ECRIVAINS`) :
 * POSIX : admin, ar, at, awk, batch, c17, chgrp, chmod, chown, compress, cp, crontab, csplit, ctags, cxref, dd, delta, ed, ex, find, gencat, get, iconv, lex, link, ln, localedef, make, mkdir, mkfifo, msgfmt, mv, patch, pax, rm, rmdel, rmdir, sccs, sed, sort, split, strip, tee, touch, uncompress, unget, uniq, unlink, uucp, uudecode, vi, xgettext, yacc
 * hors POSIX : bunzip2, bzip2, curl, gawk, gh, git, gunzip, gzip, install, md, mklink, mktemp, npm, npx, perl, rsync, ruby, shred, tar, truncate, unxz, unzip, wget, xz, zip, zstd
 * Une cmdlet lie ses positionnels aux emplacements (`positionnels`, `Position` de `Get-Command`) que ses paramètres
 * nommés laissent libres ; `cibles` = ceux qu'elle écrit ; `defaut` = sa cible quand elle n'en nomme aucune (`null` :
 * une cible qu'elle ne nomme pas, hors de la session).
 */
const cmdlet = (noms, positionnels, cibles = positionnels, extra = {}) => ({ noms, role: 'cmdlet', powerShell: true, positionnels, cibles, ...extra })
const ROLES = [
  { noms: ['cp', 'ln'], role: 'destination', valeurs: ['-S', '--suffix'], destination: ['-t', '--target-directory'] },
  { noms: ['install'], role: 'destination', valeurs: ['-m', '--mode', '-o', '--owner', '-g', '--group', '-S', '--suffix'], destination: ['-t', '--target-directory'] },
  { noms: ['rsync'], role: 'destination', valeurs: ['-e', '--rsh', '-f', '--filter', '-T', '--temp-dir', '-B', '--block-size', '-M', '--remote-option'] },
  { noms: ['uucp'], role: 'destination', valeurs: ['-g', '-n', '-x'] },
  { noms: ['mv'], role: 'deplacement', valeurs: ['-S', '--suffix'], destination: ['-t', '--target-directory'] },
  { noms: ['tee', 'rm', 'rmdir', 'unlink', 'strip', 'ed', 'ex', 'vi', 'admin', 'delta', 'rmdel', 'unget'], role: 'chemins' },
  { noms: ['shred'], role: 'chemins', valeurs: ['-n', '--iterations', '-s', '--size'] },
  { noms: ['touch'], role: 'chemins', valeurs: ['-d', '--date', '-r', '--reference', '-t'] },
  { noms: ['mkdir', 'mkfifo', 'md'], role: 'chemins', valeurs: ['-m', '--mode'] },
  { noms: ['truncate'], role: 'chemins', valeurs: ['-s', '--size', '-r', '--reference'] },
  { noms: ['chmod', 'chown', 'chgrp'], role: 'apresPremier' },
  { noms: ['uniq', 'link'], role: 'second', valeurs: ['-f', '-s', '-w', '--skip-fields', '--skip-chars', '--check-chars'] },
  { noms: ['gencat'], role: 'premier' },
  { noms: ['split'], role: 'prefixe', defaut: 'x', valeurs: ['-l', '-b', '-a', '-n', '-C', '-t', '--lines', '--bytes', '--suffix-length', '--number', '--line-bytes', '--separator', '--additional-suffix'] },
  { noms: ['gzip', 'gunzip', 'bzip2', 'bunzip2', 'xz', 'unxz', 'zstd', 'compress', 'uncompress'], role: 'compression', valeurs: ['-S', '--suffix', '-T', '--threads', '-b'] },
  { noms: ['zip'], role: 'premier', valeurs: ['-b', '-n', '-t', '-tt', '-x', '-i'] },
  cmdlet(['copy-item', 'cpi', 'copy', 'copy-itemproperty', 'cpp'], ['-path', '-destination'], ['-destination']),
  cmdlet(['move-item', 'mi', 'move', 'move-itemproperty', 'mp'], ['-path', '-destination']),
  cmdlet(['compress-archive', 'compress-psresource', 'cmres'], ['-path', '-destinationpath'], ['-destinationpath']),
  cmdlet(['expand-archive'], ['-path', '-destinationpath'], ['-destinationpath'], { defaut: '.' }),
  cmdlet(['remove-item', 'ri', 'del', 'erase', 'rd', 'clear-content', 'clc', 'clear-item', 'cli', 'clear-itemproperty', 'clp',
    'remove-itemproperty', 'rp', 'rename-itemproperty', 'rnp', 'new-itemproperty', 'set-item', 'si', 'set-itemproperty', 'sp',
    'set-acl', 'unblock-file', 'export-csv', 'epcsv', 'export-clixml', 'export-alias', 'epal', 'export-formatdata',
    'new-modulemanifest', 'new-psrolecapabilityfile', 'new-psscriptfileinfo', 'new-pssessionconfigurationfile', 'update-psmodulemanifest',
    'update-psscriptfileinfo'], ['-path']),
  cmdlet(['set-content', 'add-content', 'ac'], ['-path'], ['-path'], { contenu: true }),
  cmdlet(['out-file'], ['-filepath'], ['-filepath'], { contenu: true }),
  cmdlet(['tee-object', 'set-authenticodesignature'], ['-filepath']),
  cmdlet(['set-tracesource'], [], ['-filepath']),
  cmdlet(['start-transcript'], ['-path'], ['-path', '-outputdirectory'], { defaut: null }),
  cmdlet(['save-help'], ['-destinationpath']),
  cmdlet(['save-psresource'], [], ['-path'], { defaut: '.' }),
  cmdlet(['publish-psresource', 'pbres'], [], ['-destinationpath'], { defaut: null }),
  cmdlet(['install-psresource', 'isres', 'uninstall-psresource', 'update-psresource', 'udres', 'register-psresourcerepository',
    'unregister-psresourcerepository', 'set-psresourcerepository', 'update-help', 'clear-recyclebin'], [], [], { defaut: null }),
  cmdlet(['export-pssession', 'export-odataendpointproxy'], ['-outputmodule']),
  cmdlet(['add-type'], [], ['-outputassembly']),
  cmdlet(['start-process', 'saps', 'start'], [], ['-redirectstandardoutput', '-redirectstandarderror']),
  cmdlet(['new-filecatalog'], ['-catalogfilepath']),
  { noms: ['rename-item', 'rni', 'ren'], role: 'renommage', powerShell: true },
  { noms: ['new-item', 'ni'], role: 'creation', powerShell: true },
]
const ROLES_PAR_NOM = new Map(ROLES.flatMap((r) => r.noms.map((nom) => [nom, r])))
const OPTIONS_CHEMIN = new Set(['-path', '-literalpath', '-filepath', '-destination', '-newname'])
/** Les alias du paramètre `LiteralPath` (`Get-Command`) : il lie le premier emplacement de la cmdlet. */
const LITTERAUX_POWERSHELL = new Set(['-literalpath', '-lp', '-pspath'])
const OPTIONS_VALEUR_POWERSHELL = new Set(['-session', '-value', '-encoding', '-filter', '-include', '-exclude', '-itemtype', '-name', '-width', '-inputobject', '-stream', '-credential', '-erroraction', '-delimiter', '-compressionlevel', '-variable'])

function argumentsDeChemins(args, contrat) {
  const positions = [], nommes = new Map()
  for (let k = 0; k < args.length; k++) {
    const a = args[k], cle = contrat.powerShell ? a.toLowerCase() : a
    if (a === '--') { positions.push(...args.slice(k + 1)); break }
    if (contrat.powerShell && OPTIONS_CHEMIN.has(cle)) { nommes.set(cle, args[++k]); continue }
    if (contrat.destination?.includes(cle)) { nommes.set('-destination', args[++k]); continue }
    const cibleCollee = contrat.destination?.find(option => a.startsWith(option + '='))
    if (cibleCollee) { nommes.set('-destination', a.slice(cibleCollee.length + 1)); continue }
    if (contrat.valeurs?.includes(cle) || (contrat.powerShell && OPTIONS_VALEUR_POWERSHELL.has(cle))) { k++; continue }
    if (a.startsWith('-')) continue
    positions.push(a)
  }
  return { positions, nommes }
}

/** Les cibles d'une cmdlet de la table : ses paramètres nommés (`-Path x`, `-Path:x`), puis ses positionnels liés, dans
 *  l'ordre, aux emplacements restés libres ; `defaut` si elle n'en nomme aucune. */
function ciblesDeCmdlet(args, contrat) {
  const lies = new Map(), positions = []
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (a === '--') { positions.push(...args.slice(k + 1)); break }
    const deuxPoints = /^(-[\w-]+):(.+)$/s.exec(a)
    const cle = (deuxPoints?.[1] ?? a).toLowerCase(), nom = LITTERAUX_POWERSHELL.has(cle) ? contrat.positionnels[0] : cle
    if (contrat.positionnels.includes(nom) || contrat.cibles.includes(nom)) { lies.set(nom, deuxPoints ? deuxPoints[2] : args[++k] ?? null); continue }
    if (OPTIONS_VALEUR_POWERSHELL.has(cle) && !deuxPoints) { k++; continue }
    if (a.startsWith('-')) continue
    positions.push(a)
  }
  contrat.positionnels.filter((p) => !lies.has(p)).forEach((p, i) => { if (positions[i] !== undefined) lies.set(p, positions[i]) })
  const cibles = contrat.cibles.filter((c) => lies.has(c)).map((c) => lies.get(c))
  return cibles.length || !Object.hasOwn(contrat, 'defaut') ? cibles : [contrat.defaut]
}

/** La valeur des options `courtes` (collée ou suivante) et `longues` (`=` ou suivante) d'`args`. */
function valeursDOptions(args, courtes, longues = []) {
  const sorties = []
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (courtes.includes(a) || longues.includes(a)) sorties.push(args[++k] ?? null)
    else if (longues.some((l) => a.startsWith(`${l}=`))) sorties.push(a.slice(a.indexOf('=') + 1))
    else if (courtes.some((c) => c.length === 2 && a.startsWith(c) && a.length > 2)) sorties.push(a.slice(2))
  }
  return sorties
}

/** Les fichiers que `perl`/`ruby -i[ext]` réécrivent (`perlrun`, `ruby --help`) : les positionnels qui suivent le code
 *  (`-e`/`-E` en ligne, sinon le premier positionnel, le script) ; `[]` sans `-i`. `valeursSuivantes` = les lettres
 *  dont la valeur, absente du groupe, est le mot suivant. */
function ciblesEnPlace(args, valeursSuivantes) {
  let enPlace = false, code = false
  const positions = []
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (a === '--') { positions.push(...args.slice(k + 1)); break }
    if (!/^-[^-]/.test(a)) { positions.push(a); continue }
    for (let i = 1; i < a.length; i++) {
      if (a[i] === 'i') { enPlace = true; break }
      if ('eE'.includes(a[i])) { code = true; if (i === a.length - 1) k++; break }
      if (valeursSuivantes.includes(a[i])) { if (i === a.length - 1) k++; break }
    }
  }
  return enPlace ? (code ? positions : positions.slice(1)) : []
}

/** Les méthodes de `System.IO.File`/`System.IO.Directory` qui écrivent, et les rangs de leurs arguments écrits. */
const ECRITURES_DOTNET = {
  file: { copy: [1], move: [0, 1], replace: [0, 1, 2], createsymboliclink: [0], open: [0], openwrite: [0], create: [0], createtext: [0], delete: [0], encrypt: [0], decrypt: [0], setattributes: [0], setunixfilemode: [0], appendalllines: [0], appendalltext: [0], appendallbytes: [0], appendtext: [0], writeallbytes: [0], writealllines: [0], writealltext: [0], setcreationtime: [0], setcreationtimeutc: [0], setlastaccesstime: [0], setlastaccesstimeutc: [0], setlastwritetime: [0], setlastwritetimeutc: [0] },
  directory: { createdirectory: [0], delete: [0], move: [0, 1], createsymboliclink: [0], setcreationtime: [0], setcreationtimeutc: [0], setlastaccesstime: [0], setlastaccesstimeutc: [0], setlastwritetime: [0], setlastwritetimeutc: [0] },
}
/** Les arguments écrits des appels `[System.IO.File]::<méthode>(…)` des `jetons` d'un segment, un appel s'ouvrant dans un
 *  jeton de code (sans `quote`) : `{ texte, quote }` par argument, `texte: null` pour une expression autre qu'une chaîne
 *  ou une variable. Le `$(…)` d'une chaîne se juge en sous-commande. */
function ecrituresDotnet(jetons) {
  const sorties = [], code = []
  let source = ''
  for (const j of jetons) {
    const texte = j.raw ?? j.text
    if (j.quote === undefined) code.push([source.length, source.length + texte.length])
    source += `${texte} `
  }
  for (const { 1: classe, 2: methode, 3: liste, index } of source.matchAll(/\[(?:System\.)?IO\.(File|Directory)\]::(\w+)\s*\(([^)]*)\)/gi)) {
    if (!code.some(([debut, fin]) => index >= debut && index < fin)) continue
    const rangs = ECRITURES_DOTNET[classe.toLowerCase()][methode.toLowerCase()]
    if (!rangs) continue
    const args = [...liste.matchAll(/\s*('[^']*'|"[^"]*"|[^,]+)\s*(?:,|$)/g)].map((m) => m[1].trim())
    for (const r of rangs) {
      const a = args[r] ?? ''
      sorties.push(/^'.*'$/s.test(a) ? { texte: a.slice(1, -1), quote: 'simple' } : /^".*"$/s.test(a) ? { texte: a.slice(1, -1), quote: 'double' } : /^\$[\w:]+$/.test(a) ? { texte: a } : { texte: null })
    }
  }
  return sorties
}

/** Les options de `patch` qui prennent une valeur (POSIX XCU, `patch` ; GNU patch `--help`). */
const VALEURS_PATCH = new Set(['-p', '-i', '--input', '-d', '--directory', '-D', '-F', '-z', '-V', '-Y', '-B', '-o', '--output', '-r', '--reject-file'])

/** Les écrivains hors de `ROLES` : `nom` → les cibles de ses arguments `args` (`null` = une cible qu'il ne nomme pas),
 *  `temp` = le répertoire temporaire de la session (`repertoireTemporaire`). */
const SPECIAUX = {
  dd: (args) => args.filter((a) => a.startsWith('of=')).map((a) => a.slice(3)),
  sort: (args) => valeursDOptions(args, ['-o'], ['--output']),
  iconv: (args) => valeursDOptions(args, ['-o'], ['--output']),
  cxref: (args) => valeursDOptions(args, ['-o']),
  csplit: (args) => [valeursDOptions(args, ['-f'], ['--prefix']).at(-1) ?? 'xx'],
  uudecode: (args) => [valeursDOptions(args, ['-o']).at(-1) ?? null],
  c17: (args) => (args.includes('-c') ? args.filter((a) => /\.c$/.test(a)).map((a) => a.replace(/^.*[\\/]/, '').replace(/\.c$/, '.o')) : [valeursDOptions(args, ['-o']).at(-1) ?? 'a.out']),
  ctags: (args) => [valeursDOptions(args, ['-f']).at(-1) ?? 'tags'],
  lex: (args) => (args.includes('-t') ? [] : ['lex.yy.c']),
  yacc: (args) => [`${valeursDOptions(args, ['-b']).at(-1) ?? 'y'}.tab.c`],
  msgfmt: (args) => [valeursDOptions(args, ['-o'], ['--output-file']).at(-1) ?? 'messages.mo'].filter((c) => c !== '-'),
  xgettext: (args, { P }) => {
    const sortie = valeursDOptions(args, ['-o'], ['--output']).at(-1) ?? `${valeursDOptions(args, ['-d'], ['--default-domain']).at(-1) ?? 'messages'}.po`
    const dossier = valeursDOptions(args, ['-p'], ['--output-dir']).at(-1)
    return sortie === '-' ? [] : [dossier === undefined ? sortie : P.join(dossier, sortie)]
  },
  localedef: (args) => {
    const nom = args.filter((a, k) => !a.startsWith('-') && !['-f', '-i', '-u'].includes(args[k - 1])).at(-1)
    return [nom !== undefined && /[\\/]/.test(nom) ? nom : null]
  },
  get: (args) => (args.some((a) => /^-[pg]/.test(a)) ? [] : ['.']),
  sccs: () => [null],
  perl: (args) => ciblesEnPlace(args, 'IMmlx0C'),
  ruby: (args) => ciblesEnPlace(args, 'IrCx0'),
  patch: (args) => {
    if (args.includes('--dry-run')) return []
    const positions = []
    for (let k = 0; k < args.length; k++) { if (VALEURS_PATCH.has(args[k])) k++; else if (!args[k].startsWith('-')) positions.push(args[k]) }
    const sorties = valeursDOptions(args, ['-o', '-r'], ['--output', '--reject-file'])
    return sorties.length || positions.length ? [...sorties, ...positions.slice(0, 1)] : [null]
  },
  pax: (args) => (args.some((a) => /^-[a-zA-Z]*r/.test(a)) ? ['.'] : args.some((a) => /^-[a-zA-Z]*w/.test(a)) ? valeursDOptions(args, ['-f']) : []),
  ar: (args) => {
    const k = args.findIndex((a) => !a.startsWith('-') || /^-[a-zA-Z]+$/.test(a)), cle = args[k] ?? ''
    return /x/.test(cle) ? ['.'] : /[dmqrs]/.test(cle) ? [args[k + 1] ?? null] : []
  },
  crontab: (args) => (args.some((a) => /^-[a-zA-Z]*l/.test(a)) ? [] : [null]),
  at: (args) => (args.some((a) => /^-[a-zA-Z]*l/.test(a)) ? [] : [null]),
  batch: () => [null],
  sed: (args) => {
    const inplace = args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))
    const scripts = [], fichiers = []
    let scriptPos = false
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-e' || args[k] === '--expression') { scripts.push(args[++k]); scriptPos = true }
      else if (args[k] === '-f' || args[k] === '--file') { k++; scriptPos = true }
      else if (!args[k].startsWith('-')) {
        if (!scriptPos) { scripts.push(args[k]); scriptPos = true } else fichiers.push(args[k])
      }
    }
    return [...(inplace ? fichiers : []), ...scripts.flatMap((s) => [...s.matchAll(/(?:^|[;\n])\s*w\s+([^;\n]+)/g)].map((m) => m[1].trim()))]
  },
  awk: (args) => args.flatMap((a) => [...a.matchAll(/\bprintf?\b[^;}]*?>{1,2}\s*["']([^"']+)["']/g)].map((m) => m[1])),
  'new-temporaryfile': (_args, { temp }) => [temp],
  make: (args) => (args.some((a) => /^-[a-zA-Z]*[nq]|^--(?:dry-run|just-print|recon|question)$/.test(a)) ? [] : [null]),
  mklink: (args) => args.filter((a) => !/^\/\/?[dhj]$/i.test(a)).slice(0, 1),
  mktemp: (args, { P, temp }) => {
    if (args.some((a) => /^-[a-zA-Z]*u/.test(a) || a === '--dry-run')) return []
    const dossier = valeursDOptions(args, ['-p'], ['--tmpdir']).at(-1)
    const gabarit = args.find((a, k) => !a.startsWith('-') && args[k - 1] !== '-p')
    if (dossier !== undefined) return [dossier]
    return gabarit === undefined || args.some((a) => /^-[a-zA-Z]*t/.test(a)) ? [temp] : [P.dirname(gabarit)]
  },
}
SPECIAUX.gawk = SPECIAUX.awk
/** Les noms de la table des écrivains de fichiers nommés (`ROLES`, `SPECIAUX`, `ecrituresDOutils`) et des familles à
 *  sous-commandes (git, npm, npx, gh) : la table que le test confronte aux sources figées. */
export const ECRIVAINS = new Set([...ROLES.flatMap((r) => r.noms), ...Object.keys(SPECIAUX), 'curl', 'wget', 'tar', 'unzip', 'find', 'git', 'npm', 'npx', 'gh'])

/** Les cibles d'écriture de la commande `textes` selon la table des écrivains (`null` = cible que l'écrivain ne nomme
 *  pas), `P` = le `node:path` de la plateforme, `temp` = le répertoire temporaire de la session. */
function ciblesDuWriter(textes, P, temp) {
  const nom = basenameExecutable(textes[0]), args = textes.slice(1)
  const contrat = ROLES_PAR_NOM.get(nom), role = contrat?.role
  const sortie = args.flatMap((a, k) => (/^-outfile$/i.test(a) ? [args[k + 1] ?? null] : /^-outfile:/i.test(a) ? [a.slice(9)] : []))
  if (role === 'cmdlet') return [...ciblesDeCmdlet(args, contrat), ...sortie]
  if (contrat) {
    const { positions, nommes } = argumentsDeChemins(args, contrat)
    const sources = [nommes.get('-path'), nommes.get('-literalpath')].filter(Boolean)
    const destination = nommes.get('-destination') ?? nommes.get('-newname')
    if (role === 'destination') {
      if (nom === 'install' && args.includes('-d')) return positions
      return destination ? [destination] : positions.length + sources.length > 1 ? positions.slice(-1) : []
    }
    if (role === 'deplacement') return [...sources, ...positions, ...(destination ? [destination] : [])]
    if (role === 'second') return positions.slice(1, 2)
    if (role === 'apresPremier') return positions.slice(1)
    if (role === 'premier') return positions.slice(0, 1)
    if (role === 'prefixe') return [positions[1] ?? contrat.defaut]
    if (role === 'compression') return args.some((a) => /^-[a-zA-Z]*[clt]|^--(?:stdout|to-stdout|list|test)$/.test(a)) ? [] : positions
    if (role === 'renommage') {
      const source = sources[0] ?? positions[0], neuf = destination ?? positions[sources.length ? 0 : 1]
      return source ? [source, ...(neuf ? [P.join(P.dirname(source), neuf)] : [])] : []
    }
    if (role === 'creation') {
      const k = args.findIndex(a => a.toLowerCase() === '-name'), nomNeuf = k < 0 ? null : args[k + 1]
      const parents = sources.length ? sources : positions.length ? positions.slice(0, 1) : ['.']
      return parents.map(p => nomNeuf ? P.join(p, nomNeuf) : p)
    }
    return positions
  }
  if (sortie.length) return sortie
  return Object.hasOwn(SPECIAUX, nom) ? SPECIAUX[nom](args, { P, temp }) : []
}

/** Les PUITS : une écriture qui n'atteint aucun fichier — `/dev/null`, `/dev/stdout`, `/dev/stderr`, `/dev/stdin`,
 *  `NUL` sous win32, `$null` de PowerShell. */
const estPuits = (texte, platform) => /^\/dev\/(?:null|stdout|stderr|stdin)$/.test(texte) || (platform === 'win32' && /^nul$/i.test(texte))
const PUITS_POWERSHELL = /^\$null$/i

/** Les sous-commandes git qui ne font que LIRE (`git help -a` : « Interrogators », et les porcelaines de
 *  lecture) ; toute autre sous-commande est une écriture inconnue, sauf les formes de lecture de
 *  `LECTURES_GIT_SOUS_CONDITION`. */
const LECTURES_GIT = new Set([
  'annotate', 'blame', 'cat-file', 'check-attr', 'check-ignore', 'check-mailmap', 'check-ref-format', 'cherry', 'column',
  'count-objects', 'describe', 'diff', 'diff-files', 'diff-index', 'diff-pairs', 'diff-tree', 'for-each-ref',
  'get-tar-commit-id', 'grep', 'help', 'log', 'ls-files', 'ls-remote', 'ls-tree', 'merge-base', 'name-rev', 'patch-id',
  'range-diff', 'rev-list', 'rev-parse', 'shortlog', 'show', 'show-branch', 'show-index', 'show-ref', 'status', 'stripspace',
  'var', 'verify-commit', 'verify-pack', 'verify-tag', 'version', 'whatchanged', 'archive',
])
/** Les positionnels des arguments `a` d'une sous-commande git dont chaque option est ADMISE (`admises`, son
 *  nom avant `=`) ; une option de `valeurs` consomme l'argument qui la suit, s'il n'est pas une option.
 *  `null` dès qu'une option n'est pas admise : la table est fermée, une abréviation (`--del`) n'y entre pas. */
function positionnelsAdmis(a, admises, valeurs = []) {
  const positionnels = []
  for (let k = 0; k < a.length; k++) {
    const x = a[k]
    if (x === '--') return [...positionnels, ...a.slice(k + 1)]
    if (!x.startsWith('-') || x === '-') { positionnels.push(x); continue }
    if (!admises.test(x.replace(/=.*$/s, ''))) return null
    if (valeurs.includes(x) && a[k + 1] !== undefined && !a[k + 1].startsWith('-')) k++
  }
  return positionnels
}
const LISTE_IMPLIQUEE = ['--contains', '--no-contains', '--merged', '--no-merged', '--points-at']
/** Les sous-commandes git qui lisent sous une forme seulement : le prédicat reçoit leurs arguments ; une forme
 *  à options se lit sur une table d'options ADMISES (`positionnelsAdmis`), une forme à sous-commande sur son
 *  premier mot (`git help <sous-commande>`). `--list` est impliquée par `LISTE_IMPLIQUEE` (`git help branch`,
 *  `git help tag`). */
const LECTURES_GIT_SOUS_CONDITION = {
  branch: (a) => {
    const p = positionnelsAdmis(a, /^(?:-[arlvqi]+|--(?:all|remotes|list|verbose|quiet|ignore-case|show-current|no-color|color|column|no-column|abbrev|no-abbrev|sort|format|omit-empty|contains|no-contains|merged|no-merged|points-at))$/, [...LISTE_IMPLIQUEE, '--sort', '--format'])
    return p !== null && (p.length === 0 || a.some((x) => /^-[arvqi]*l[arlvqi]*$|^--list$/.test(x) || LISTE_IMPLIQUEE.includes(x.replace(/=.*$/s, ''))))
  },
  tag: (a) => {
    const p = positionnelsAdmis(a, /^(?:-[lvi]+|-n\d*|--(?:list|verify|ignore-case|sort|format|color|column|no-column|omit-empty|contains|no-contains|merged|no-merged|points-at))$/, [...LISTE_IMPLIQUEE, '--sort', '--format'])
    return p !== null && (p.length === 0 || a.some((x) => /^-[ilv]*[lv][ilv]*$|^-n\d*$|^--(?:list|verify)$/.test(x) || LISTE_IMPLIQUEE.includes(x.replace(/=.*$/s, ''))))
  },
  config: (a) => {
    const valeurs = ['-f', '--file', '--blob', '--type', '--default', '--value', '--url']
    const p = positionnelsAdmis(a, /^(?:-[lz]+|-f|--(?:global|system|local|worktree|file|blob|show-origin|show-scope|null|name-only|type|bool|int|bool-or-int|path|expiry-date|no-type|default|includes|no-includes|all|regexp|value|url|fixed-value|get|get-all|get-regexp|get-urlmatch|get-color|get-colorbool|list))$/, valeurs)
    if (p === null) return false
    if (p[0] === 'list' || p[0] === 'get') return p.length === (p[0] === 'list' ? 1 : 2)
    if (a.some((x) => /^-z*lz*$|^--list$/.test(x))) return p.length === 0
    if (a.some((x) => /^--get(?:-all|-regexp|-urlmatch|-color|-colorbool)?$/.test(x))) return p.length >= 1 && p.length <= 2
    return p.length === 1 && p[0].includes('.')
  },
  stash: (a) => ['list', 'show'].includes(a[0]),
  worktree: (a) => a[0] === 'list',
  remote: (a) => {
    const k = a.findIndex((x) => !x.startsWith('-'))
    return a.slice(0, k < 0 ? a.length : k).every((x) => x === '-v' || x === '--verbose') && (k < 0 || ['show', 'get-url'].includes(a[k]))
  },
  notes: (a) => a.length === 0 || ['list', 'show'].includes(a[0]),
  // `git reflog -h` (git 2.51), l.1-10 : un premier positionnel hors des sous-commandes est la `<ref>` de `show`.
  reflog: (a) => !['write', 'delete', 'drop', 'expire'].includes(a.find((x) => !x.startsWith('-'))),
  'symbolic-ref': (a) => positionnelsAdmis(a, /^(?:-q+|--(?:quiet|short|no-recurse|recurse))$/)?.length === 1,
  'hash-object': (a) => positionnelsAdmis(a, /^(?:-t.*|--(?:stdin|stdin-paths|path|no-filters|literally))$/, ['-t', '--path']) !== null,
  'sparse-checkout': (a) => a[0] === 'list',
  submodule: (a) => ['status', 'summary'].includes(a[0]),
  bundle: (a) => ['verify', 'list-heads'].includes(a[0]),
}

/** Les options de `vitest` qui prennent la valeur suivante (`vitest --help`), et ses sous-commandes. */
const VALEURS_VITEST = ['-t', '--testNamePattern', '--reporter', '--outputFile', '--project', '--environment', '--pool', '--testTimeout', '--mode', '--shard', '--exclude', '--retry', '--bail', '--maxWorkers', '--minWorkers']
const SOUS_COMMANDES_VITEST = ['run', 'watch', 'dev', 'bench', 'related', 'list']
/** Les options de `node` qui chargent un module avant le script (`node --help`). */
const PRECHARGEMENTS_NODE = ['-r', '--require', '--import', '--loader', '--experimental-loader']
/** Le fichier que désigne le spécificateur `valeur` d'un préchargement : chemin ou URL `file:` ; `null` pour un
 *  paquet (`tsx`, `@scope/x`), résolu dans `node_modules`. */
const cheminDeModule = (valeur) =>
  /^file:/i.test(valeur) ? decodeURIComponent(valeur.replace(/^file:\/\/(?:localhost)?/i, '')).replace(/^\/(?=[A-Za-z]:)/, '')
    : /^(?:\.{1,2}(?:[\\/]|$)|[\\/]|[A-Za-z]:)/.test(valeur) ? valeur : null

/** Les lancements d'un interpréteur JS : `{ scripts, configs, filtres, dossiers, ecritures, enLigne, argv }` — les
 *  fichiers qu'il lance (préchargements de `node` compris), les `--config` de `vitest` (`configs`, lancés aussi), les
 *  positionnels de `vitest` (`filtres`, qui trient les suites balayées), les dossiers qu'il balaie
 *  (`dossiers` : ses `--dir`, sinon ses `--root`, sinon le cwd, racine de `vitest` sans `--config` ; un `--config` relatif
 *  se résout contre le dernier `--root`, et `dossierFixeParLaLigne` dit qu'un `--dir` ou `--root` l'emporte sur le
 *  config), les fichiers qu'il DÉCLARE
 *  écrire (`ecritures` : `--outputFile`, `--coverage` → `coverage` du cwd, `--test-reporter-destination` hors
 *  `stdout`/`stderr`), le code en ligne (`-e`, `-p`), `argv` = le `process.argv` d'un script seul (un argument non
 *  développé vaut `null`) ; `null` hors `node`, `tsx` et `vitest`. `npm test -- <args>` et `npx vitest` lancent
 *  `vitest`. Les options se lisent sur `bruts` (le texte des jetons) quand leur développement échoue. */
function lancementDInterpreteur(textes, bruts = textes) {
  let nom = basenameExecutable(textes[0])
  let k = 1
  if (nom === 'npx') {
    while (k < textes.length && textes[k].startsWith('-')) k++
    nom = basenameExecutable(textes[k])
    if (nom !== 'tsx' && nom !== 'vitest') return null
    k++
  }
  if (nom === 'npm') {
    const tiret = textes.indexOf('--')
    if (!['test', 't', 'tst'].includes(textes.find((t, i) => i > 0 && !t.startsWith('-'))) || tiret < 0) return null
    nom = 'vitest'
    k = tiret + 1
  }
  const rendu = { scripts: [], configs: [], filtres: [], dossiers: [], ecritures: [], enLigne: undefined }
  if (nom === 'vitest') {
    // `config.dir || config.root` (vitest 5.0.3, `dist/chunks/index.DpLw24bj.js:12204`) : un `--dir` remplace la racine.
    const balayes = { racines: [], dirs: [] }
    for (let premier = true; k < textes.length; k++) {
      const texte = textes[k]
      if (texte === '-c' || texte === '--config') { rendu.configs.push(textes[++k] ?? null); continue }
      if (texte.startsWith('--config=')) { rendu.configs.push(texte.slice(9)); continue }
      const egal = texte.indexOf('=')
      const option = egal < 0 ? texte : texte.slice(0, egal)
      const valeur = () => (egal < 0 ? textes[++k] ?? null : texte.slice(egal + 1))
      if (['-r', '--root', '--dir'].includes(option)) { balayes[option === '--dir' ? 'dirs' : 'racines'].push(valeur()); continue }
      if (/^--outputFile(?:\.\w+)?$/.test(option) || option === '--coverage.reportsDirectory') { rendu.ecritures.push(valeur()); continue }
      if (/^--coverage(?:\.enabled)?$/.test(option) && !/^(?:false|0)$/.test(egal < 0 ? '' : texte.slice(egal + 1))) { rendu.ecritures.push('coverage'); continue }
      if (VALEURS_VITEST.includes(texte)) { k++; continue }
      if (texte.startsWith('-')) continue
      if (!(premier && SOUS_COMMANDES_VITEST.includes(texte))) rendu.filtres.push(texte)
      premier = false
    }
    rendu.dossiers.push(...(balayes.dirs.length > 0 ? balayes.dirs : balayes.racines))
    rendu.dossierFixeParLaLigne = rendu.dossiers.length > 0
    const racine = balayes.racines.at(-1)
    if (typeof racine === 'string') rendu.configs = rendu.configs.map((c) => (typeof c === 'string' && !/^(?:[\\/]|[A-Za-z]:)/.test(c) ? racine + '/' + c : c))
    if (rendu.dossiers.length === 0 && rendu.configs.length === 0) rendu.dossiers.push('.')
    return rendu
  }
  if (nom !== 'node' && nom !== 'tsx') return null
  const test = textes.includes('--test')
  const precharger = (valeur) => {
    if (typeof valeur !== 'string' || nonConstant(valeur)) rendu.scripts.push(null)
    else if (cheminDeModule(valeur) !== null) rendu.scripts.push(cheminDeModule(valeur))
  }
  for (; k < textes.length; k++) {
    const texte = nonConstant(textes[k]) ? bruts[k] : textes[k]
    if (/^-[a-zA-Z]*[ep]$|^--(?:eval|print)$/.test(texte)) { rendu.enLigne = k + 1; return rendu }
    if (/^--eval=/.test(texte)) { rendu.enLigne = k; return rendu }
    if (texte === '--') {
      rendu.scripts.push(...(test ? textes.slice(k + 1) : textes.slice(k + 1, k + 2)))
      break
    }
    if (PRECHARGEMENTS_NODE.includes(texte)) { precharger(textes[++k]); continue }
    const colle = PRECHARGEMENTS_NODE.find((option) => option.startsWith('--') && texte.startsWith(`${option}=`))
    if (colle) { precharger(textes[k].slice(colle.length + 1)); continue }
    const destination = texte === '--test-reporter-destination' ? textes[++k] ?? null : texte.startsWith('--test-reporter-destination=') ? texte.slice(28) : undefined
    if (destination !== undefined) { if (!['stdout', 'stderr'].includes(destination)) rendu.ecritures.push(destination); continue }
    if (['--input-type', '--test-reporter', '--test-name-pattern', '--test-concurrency'].includes(texte)) { k++; continue }
    if (texte.startsWith('-')) continue
    rendu.scripts.push(texte)
    if (!test) {
      rendu.argv = [textes[0], texte, ...textes.slice(k + 1)].map((a) => (nonConstant(a) ? null : a))
      return rendu
    }
  }
  return rendu
}

/** Les options courtes de `curl` qui prennent une valeur (`curl --help all`) : collée (`-ofichier`) ou suivante. */
const VALEURS_COURTES_CURL = 'AbcCdDeEFHKmoPQrtTuUwxXyYz'

/** Les écritures que déclarent les commandes d'archivage, de recherche et de transfert : `{ chemins, inconnue,
 *  racines }`, `racines` = les points de départ de `find`. */
function ecrituresDOutils(nom, args) {
  const valeurDe = (courtes, longues) => {
    const sorties = []
    for (let k = 0; k < args.length; k++) {
      const a = args[k]
      if (courtes.includes(a) || longues.includes(a)) sorties.push(args[++k])
      else {
        const longue = longues.find((l) => a.startsWith(`${l}=`))
        if (longue) sorties.push(a.slice(longue.length + 1))
      }
    }
    return sorties
  }
  if (nom === 'curl') {
    const longues = ['--output', '--dump-header', '--cookie-jar']
    const chemins = valeurDe([], longues)
    let distant = false
    for (let k = 0; k < args.length; k++) {
      const a = args[k]
      if (/^--(?:remote-name(?:-all)?|remote-header-name)$/.test(a)) distant = true
      if (longues.includes(a)) { k++; continue }
      if (!/^-[^-]/.test(a)) continue
      for (let i = 1; i < a.length; i++) {
        if (a[i] === 'O' || a[i] === 'J') { distant = true; continue }
        if (!VALEURS_COURTES_CURL.includes(a[i])) continue
        const valeur = i + 1 < a.length ? a.slice(i + 1) : args[++k]
        if ('oDc'.includes(a[i])) chemins.push(valeur)
        break
      }
    }
    if (distant) chemins.push(valeurDe([], ['--output-dir']).at(-1) ?? '.')
    return { chemins, inconnue: false }
  }
  if (nom === 'wget') {
    const colles = (lettres) => args.filter((a) => new RegExp(`^-[${lettres}].`, 's').test(a)).map((a) => a.slice(2))
    const journaux = [...valeurDe(['-o', '-a'], ['--output-file', '--append-output']), ...colles('oa')]
    if (args.includes('--spider')) return { chemins: journaux, inconnue: false }
    const documents = [...valeurDe(['-O'], ['--output-document']), ...colles('O')]
    const dossier = [...valeurDe(['-P'], ['--directory-prefix']), ...colles('P')].at(-1) ?? '.'
    return { chemins: [...(documents.length ? documents.filter((d) => d !== '-') : [dossier]), ...journaux], inconnue: false }
  }
  if (nom === 'tar') {
    const premier = args[0] ?? ''
    const drapeaux = premier.startsWith('-') && !premier.startsWith('--') ? premier.slice(1) : premier.startsWith('-') ? '' : premier
    const extraction = /x/.test(drapeaux) || args.some((a) => a === '-x' || a === '--extract' || a === '--get')
    const creation = /[cru]/.test(drapeaux) || args.some((a) => ['-c', '--create', '-r', '--append', '-u', '--update'].includes(a))
    const chemins = []
    if (extraction) chemins.push(...(valeurDe(['-C'], ['--directory']).length ? valeurDe(['-C'], ['--directory']) : ['.']))
    if (creation) {
      const f = valeurDe(['-f'], ['--file'])
      const colle = /f$/.test(drapeaux) && !premier.startsWith('-') ? [args[1]] : []
      chemins.push(...(f.length ? f : colle))
      if (!f.length && !colle.length) return { chemins, inconnue: true }
    }
    return { chemins, inconnue: false }
  }
  if (nom === 'unzip') {
    if (args.some((a) => /^-[a-zA-Z]*[lptZvz]/.test(a))) return { chemins: [], inconnue: false }
    const d = valeurDe(['-d'], [])
    return { chemins: d.length ? d : ['.'], inconnue: false }
  }
  if (nom === 'find') {
    const racines = []
    for (const a of args) { if (/^[-(!]/.test(a)) break; racines.push(a) }
    const lieux = racines.length ? racines : ['.']
    return { chemins: [...(args.includes('-delete') ? lieux : []), ...valeurDe(['-fprint', '-fprint0', '-fprintf', '-fls'], [])], inconnue: false, racines: lieux }
  }
  return { chemins: [], inconnue: false }
}

/** La commande que `find … -exec|-execdir|-ok|-okdir <cmd> {} ;|+` lance, `{}` rendu par `racine`. */
function commandesDeFind(args, racines) {
  const commandes = []
  for (let k = 0; k < args.length; k++) {
    if (!['-exec', '-execdir', '-ok', '-okdir'].includes(args[k])) continue
    const fin = args.findIndex((a, i) => i > k && (a === ';' || a === '\\;' || a === '+'))
    const corps = args.slice(k + 1, fin === -1 ? args.length : fin)
    for (const racine of racines) commandes.push(corps.map((a) => `'${(a === '{}' ? racine : a).split("'").join("'\\''")}'`).join(' '))
    k = fin === -1 ? args.length : fin
  }
  return commandes
}

/** Une demande d'aide (`--help`, `-h`) : une lecture dans toute la table, sauf `-h` des écrivains où il est une option
 *  (`H_OPTION` : POSIX XCU `chown`, `chgrp` ; GNU `touch`, `sort`, `tar`, `rsync` `--help` ; BSD `chmod`, `ln`). */
const H_OPTION = new Set(['chown', 'chgrp', 'chmod', 'touch', 'sort', 'tar', 'rsync', 'ln'])
const aide = (args, nom) => args.some((a) => a === '--help' || (a === '-h' && !H_OPTION.has(nom)))

/** `npm` qui écrit : hors des commandes d'interrogation, `npm test` avec `MISE_A_JOUR_VITEST`. `npm run <x>` (et
 *  `start`/`stop`/`restart`) se juge au corps de `scripts.<x>`, que `pipelinesDeJetons` déplie (`commandeScriptNpm`) ;
 *  un script absent n'est pas lancé. `juge.md:18-19` prescrit `npm test -- <chemins>` et `npx vitest run`. */
const MISE_A_JOUR_VITEST = /^(?:-u|--update(?:Snapshot)?)(?:=.*)?$/s
const LECTURES_NPM = new Set(['test', 't', 'tst', 'ls', 'list', 'view', 'v', 'info', 'show', 'outdated', 'help', 'explain', 'why', 'query', 'search', 'doctor', 'prefix', 'root', 'bin', 'whoami', 'ping', '--version', '-v', 'version',
  'run', 'run-script', 'rum', 'urn', 'start', 'stop', 'restart'])
function ecritureDeNpm(args) {
  const sous = args.find((a) => !a.startsWith('-')) ?? args[0]
  const tiret = args.indexOf('--')
  if (sous === undefined || nonConstant(sous) || aide(tiret < 0 ? args : args.slice(0, tiret))) return false
  if (sous === 'version') return args.length > 1
  if (sous === 'config' || sous === 'c') return !['get', 'list', 'ls'].includes(args[args.indexOf(sous) + 1])
  if (['test', 't', 'tst'].includes(sous)) return args.some((a) => MISE_A_JOUR_VITEST.test(a))
  return !LECTURES_NPM.has(sous)
}

/** Les outils de `node_modules/.bin` et leurs formes de lecture (`<outil> --help`), jugés par OUTIL quel que soit le
 *  lanceur (`npx`, `node_modules/.bin/<outil>`, nu, corps d'un script npm, `scripts/lancer-local.mjs`) ; sous `npx`, tout
 *  autre outil écrit. `lire(chemin)` = le texte d'un fichier relatif au cwd, `undefined` illisible. `tsc` n'écrit que
 *  PROUVÉ (`tsc --help`) : `-b`, `--incremental`, une sortie nommée, un fichier compilé, ou sans `--noEmit` un tsconfig
 *  lu sans `"noEmit": true` et sans `extends` ; sinon non jugé. `vite` lit sous `preview` (`vite --help`). */
const actif = (a, option) => a.some((x, k) => (x === option && !/^(?:false|0)$/.test(a[k + 1] ?? '')) || x === `${option}=true`)
const LECTURES_NPX = {
  vitest: (a) => !a.some((x) => MISE_A_JOUR_VITEST.test(x)),
  tsx: () => true,
  tsc: (a, { lire }) => {
    if (a.length > 0 && a.every((x) => /^(?:-v|--version|--all|--showConfig|--listFilesOnly)$/.test(x))) return true
    if (actif(a, '--incremental') || actif(a, '-i') || actif(a, '--composite') || actif(a, '--declaration') || actif(a, '-d')) return false
    if (a.some((x) => /^(?:-b|--build|--outDir|--outFile|--declarationDir|--tsBuildInfoFile|--generateTrace)(?:=|$)/.test(x))) return false
    if (actif(a, '--noEmit')) return true
    if (a.some((x) => /\.[cm]?tsx?$/.test(x) && !/\.d\.[cm]?ts$/.test(x) && !/^-/.test(x))) return false
    const projet = valeursDOptions(a, ['-p'], ['--project']).at(-1) ?? '.'
    const texte = /\.json$/i.test(projet) ? lire(projet) : lire(`${projet}/tsconfig.json`)
    if (texte === undefined || /"noEmit"\s*:\s*true/.test(texte)) return true
    return /"noEmit"\s*:\s*false/.test(texte) || !/"extends"\s*:/.test(texte) ? false : true
  },
  vite: (a) => a[0] === 'preview' || (a.length > 0 && a.every((x) => /^(?:-v|--version)$/.test(x))),
  eslint: (a) => !a.some((x) => /^(?:--fix|--cache|-o|--output-file|--init)(?:=|$)/.test(x)),
  oxlint: (a) => !a.some((x) => /^(?:--fix\S*|--init)$/.test(x)),
  prettier: (a) => !a.some((x) => /^(?:-w|--write|--cache)(?:=|$)/.test(x)),
  knip: (a) => !a.some((x) => /^(?:--fix|--fix-type|--allow-remove-files|--cache)(?:=|$)/.test(x)),
}

/** `gh` : ses sous-commandes de LECTURE (`gh <groupe> --help`) ; `api` lit en GET — méthode `GET` dite, ou ni
 *  méthode ni champ (`-f`, `-F`, `--input` passent la méthode à POST, `gh api --help`) ; `api graphql` lit quand
 *  sa requête (`-f query=`, `-F query=`) est une chaîne qui ne porte pas `mutation`. Toute autre forme écrit,
 *  dont `pr checkout`, `run download`, `release download` et `repo clone`. */
const LECTURES_GH = {
  issue: ['view', 'list', 'status'], pr: ['view', 'list', 'status', 'diff', 'checks'], run: ['view', 'list', 'watch'],
  workflow: ['view', 'list'], repo: ['view', 'list'], release: ['view', 'list'], label: ['list'], gist: ['view', 'list'],
  project: ['view', 'list', 'item-list', 'field-list'], cache: ['list'], variable: ['list', 'get'], secret: ['list'],
  ruleset: ['list', 'view', 'check'], auth: ['status'], org: ['list'], search: null, status: null, help: null, version: null,
}
function lectureGh(args) {
  const mots = []
  for (let k = 0; k < args.length && mots.length < 2; k++) {
    if (/^(?:-R|--repo|--hostname)$/.test(args[k])) { k++; continue }
    if (!args[k].startsWith('-')) mots.push(args[k])
  }
  const [groupe, sous] = mots
  if (aide(args)) return true
  if (groupe === undefined) return args.every((a) => a === '--version')
  if (nonConstant(groupe)) return true
  if (groupe === 'api' && sous === 'graphql') {
    const requetes = args.flatMap((a, k) => (/^(?:-[fF]|--field|--raw-field)$/.test(a) ? [args[k + 1] ?? ''] : /^-[fF]./s.test(a) ? [a.slice(2)] : /^--(?:raw-)?field=/.test(a) ? [a.slice(a.indexOf('=') + 1)] : []))
      .filter((c) => /^query=/.test(c)).map((c) => c.slice(6))
    return requetes.length > 0 && requetes.every((q) => nonConstant(q) || (!q.startsWith('@') && !/\bmutation\b/.test(q)))
  }
  if (groupe === 'api') {
    const methodes = args.flatMap((a, k) => (/^(?:-X|--method)$/.test(a) ? [args[k + 1]] : /^--method=/.test(a) ? [a.slice(9)] : /^-X./s.test(a) ? [a.slice(2)] : []))
    if (methodes.length) return methodes.every((m) => /^get$/i.test(m ?? ''))
    return !args.some((a) => /^(?:-[fF]|--field|--raw-field|--input)(?:=|$)|^-[fF]./s.test(a))
  }
  if (!Object.hasOwn(LECTURES_GH, groupe)) return false
  return LECTURES_GH[groupe] === null || nonConstant(sous) || LECTURES_GH[groupe].includes(sous)
}


/** Le corps d'un heredoc à mot nu, développé (`man bash`, Here Documents) : `\` échappe `\`, `$`, `` ` `` et le saut
 *  de ligne, `$NOM`/`${NOM}` prennent leur valeur dans `variables` ; `undefined` dès qu'un développement n'est pas
 *  connu (variable sans valeur, `$(`, `` ` ``, `$1`, `${NOM:-…}`). */
function developperHeredoc(corps, variables) {
  let inconnu = false
  const rendu = corps.replace(/\\([\\$`\n])|\$\{(\w+)\}|\$([A-Za-z_]\w*)|\$[({\d@*#?$!-]|`/g, (m, echappe, entre, nu) => {
    if (echappe !== undefined) return echappe === '\n' ? '' : echappe
    const valeur = entre ?? nu ? variables.get(entre ?? nu) : undefined
    if (typeof valeur !== 'string') inconnu = true
    return valeur ?? m
  })
  return inconnu ? undefined : rendu
}

/** Le texte du fichier `chemin`, `undefined` s'il ne se lit pas. */
function lireTexteSurDisque(chemin) {
  try {
    return readFileSync(chemin, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Les cibles d'écriture qu'une commande DÉCLARE, `{ chemin, inconnue, ecrivain, famille, operation, segment, base, puits, contenu }` :
 * `base` = le répertoire courant du segment (`null` inconnu) ; `puits` = une écriture qui n'atteint aucun
 * fichier (`estPuits`, lecteur PowerShell non fichier) ; `contenu` = le texte écrit, connu pour une redirection de `cat`
 * qu'alimente un heredoc littéral ou développé (`developperHeredoc`), et pour `Set-Content`/`Out-File` alimentés par une
 * chaîne littérale, `undefined` sinon. `ecrivain` = la cible vient d'une commande de la table FERMÉE des écrivains
 * (`ROLES`, outils d'archive et de transfert, sorties déclarées d'un interpréteur, `[IO.File]::`) ; une sous-commande git
 * hors de `LECTURES_GIT`, un `npm` qui écrit (`ecritureDeNpm`), un outil hors de sa forme de lecture (`LECTURES_NPX`, et
 * tout outil sous `npx`), un `gh` hors `LECTURES_GH` y sont une cible inconnue de `famille` git, npm, npx ou gh ; une
 * redirection, un code JS ou un script ne l'est jamais. Une commande que `xargs` alimente reçoit un argument inconnu. Une
 * `for <v> in <mots>` littérale se déroule. `env` amorce `VARIABLES_AMORCEES` (`$TEMP`, `$env:TEMP`, `$env:LOCALAPPDATA`, `$HOME`, `~`) ;
 * `powershell` : la commande est du dialecte PowerShell (`tokenizeCommand`), où `\` sépare les chemins sur toute
 * plateforme. Les chemins se résolvent par le `node:path` de `platform` (`cheminsDe`). Avec `scripts`, s'y ajoutent les
 * LANCEMENTS JS (`lancementDInterpreteur`) : `{ operation: 'script', env }` par fichier lancé, `env` = l'environnement qu'il reçoit (
 * amorce et affectations de la commande) (`config` pour un `--config` de
 * `vitest`, `enLigne` = le code d'un `-e`, `dossier` pour un dossier balayé, tous deux porteurs des `filtres` positionnels de `vitest`, `null` pour un
 * filtre non constant). `lireTexte` lit le tsconfig de `tsc` (`LECTURES_NPX`).
 */
export function ciblesDEcritureDeCommande(commande, { base = process.cwd(), platform = process.platform, env = {}, exclureArguments = () => false, powershell = false, segments = pipelinesDeJetons(commande, 0, { powershell }).flat(), scripts = false, lireTexte = lireTexteSurDisque } = {}) {
  const P = cheminsDe(platform)
  const etats = new Map(), sorties = []
  const accueil = powershell ? env.USERPROFILE ?? env.HOME : env.HOME ?? (platform === 'win32' ? env.USERPROFILE : undefined)
  const amorce = new Map([
    ...VARIABLES_AMORCEES.filter((nom) => typeof env[nom] === 'string').flatMap((nom) => [[nom, env[nom]], [`env:${nom}`, env[nom]]]),
    ...(typeof accueil === 'string' ? [['HOME', accueil]] : []),
  ])
  const etatDe = (shell) => {
    if (!etats.has(shell)) {
      const parent = shell?.parent ? etatDe(shell.parent) : { base, variables: amorce }
      etats.set(shell, { base: parent.base, variables: new Map(parent.variables) })
    }
    return etats.get(shell)
  }
  const developper = (texte, variables, jeton = {}) => {
    if (jeton.quote === 'simple') return texte
    if (powershell && jeton.quote == null && /^@[A-Za-z_]\w*$/.test(texte ?? '')) return null // about_Splatting
    if (powershell && jeton.quote == null && typeof texte === 'string' && texte.includes('`') && !/['"]/.test(jeton.raw ?? '')) {
      if (/`[$%]|`$/.test(texte)) return null
      texte = texte.replace(/`(.)/gs, '$1') // about_Special_Characters
    }
    if (jeton.quote == null && typeof texte === 'string' && /^~(?=[\\/]|$)/.test(texte) && !/^['"]/.test(jeton.raw ?? '')) {
      const maison = variables.get('HOME')
      if (typeof maison !== 'string') return null
      texte = maison + texte.slice(1)
    }
    if (jeton.quote == null && /['"]/.test(jeton.raw ?? '') && /[$%]/.test(texte ?? '')) {
      const morceaux = []
      for (const [, simple, double, nu] of jeton.raw.matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"|((?:[^'"\\]|\\.)+)/g)) {
        const rendu = simple !== undefined ? simple : developper(double ?? nu, variables)
        if (rendu === null) return null
        morceaux.push(rendu)
      }
      return morceaux.join('')
    }
    if (typeof texte !== 'string' || /\$\(|`/.test(texte)) return null
    const variable = /\$\{env:(\w+)\}|\$env:(\w+)|\$\{(\w+)\}|\$(\w+)|%(\w+)%/gi
    if (/[$%]/.test(texte.replace(variable, ''))) return null
    let inconnue = false
    const rendu = texte.replace(variable, (_m, e1, e2, a, b, c) => {
      const valeur = e1 ?? e2 ? variables.get(`env:${(e1 ?? e2).toUpperCase()}`) : variables.get(a ?? b ?? c)
      if (valeur === undefined || valeur === null) { inconnue = true; return '' }
      return valeur
    })
    return inconnue ? null : rendu
  }
  /** Les arguments PowerShell de `jetons`, ses tableaux regroupés (`a,b`, `a, b` : une virgule hors quote et hors
   *  expression, about_Arrays, about_Parsing) : `{ k, prefixe, elements }` par argument, `k` = l'index de son premier
   *  jeton, `prefixe` = son `-Param:` collé, `elements` développés (`\0inconnue\0` s'ils ne le sont pas), `null` hors
   *  tableau. */
  const argumentsPowerShell = (jetons, variables) => {
    const morceauxDe = (jeton) => {
      if (jeton.op || jeton.substitutions?.length) return null
      const brut = jeton.raw ?? jeton.text
      if (jeton.quote != null) return [brut]
      const morceaux = []
      let debut = 0, quote = null, profondeur = 0
      for (let i = 0; i < brut.length; i++) {
        const car = brut[i]
        if (car === '`') i++
        else if (quote) { if (car === quote) quote = null }
        else if (car === "'" || car === '"') quote = car
        else if ('({['.includes(car)) profondeur++
        else if (')}]'.includes(car)) profondeur--
        else if (car === ',' && profondeur === 0) { morceaux.push(brut.slice(debut, i)); debut = i + 1 }
      }
      return [...morceaux, brut.slice(debut)]
    }
    const groupes = []
    jetons.forEach((jeton, k) => {
      const morceaux = morceauxDe(jeton), precedent = groupes.at(-1)
      if (k > 1 && morceaux && precedent?.morceaux && (precedent.morceaux.at(-1) === '' || morceaux[0] === '')) precedent.morceaux.push(...morceaux)
      else groupes.push({ k, morceaux })
    })
    return groupes.map(({ k, morceaux }) => {
      if (k === 0 || !morceaux || morceaux.length < 2) return { k, prefixe: '', elements: null }
      const prefixe = /^-[\w-]+:/.exec(morceaux[0])?.[0] ?? ''
      const elements = [morceaux[0].slice(prefixe.length), ...morceaux.slice(1)].filter((m) => m !== '')
        .map((m) => developper(m.replace(/'([^']*)'|"((?:[^"\\]|\\.)*)"/g, (_m, s, d) => s ?? d), variables, { raw: m }) ?? '\0inconnue\0')
      return { k, prefixe, elements }
    })
  }
  /** `\` sépare les chemins en PowerShell sur toute plateforme ; `path.posix` ne le lit pas. */
  const separateurs = (chemin) => (powershell && platform !== 'win32' && typeof chemin === 'string' ? chemin.replaceAll('\\', '/') : chemin)
  const sousCommande = (texte, etat) => {
    for (const cible of ciblesDEcritureDeCommande(texte, { base: etat.base, platform, env, scripts, lireTexte })) sorties.push(cible)
  }
  /** `variables` après `nom` ← `valeur` (`null` : non constante) ; `ajout` (`+=`) la colle à la valeur connue, `null` sinon. */
  const poser = (variables, nom, valeur, ajout) => {
    const avant = variables.get(nom)
    variables.set(nom, !ajout ? valeur : valeur === null || typeof avant !== 'string' ? null : avant + valeur)
  }
  /** L'affectation POSIX `valeur` (`valeurDAffectation`) dans `variables`, sa valeur développée depuis son texte brut. */
  const affecter = (variables, { nom, valeur, jeton, ajout }) => {
    const brut = jeton.raw ?? jeton.text
    poser(variables, nom, developper(valeur, variables, { ...jeton, raw: brut.slice(brut.indexOf('=') + 1) }), ajout)
  }
  /** L'environnement du processus que `segment` lance : `env`, ses `VARIABLES_AMORCEES` telles que la commande les a
   *  posées avant lui (`etat`) et par ses affectations de tête (`valeursDeTete`) ; `null` pour une valeur non constante. */
  const environnementDe = (segment, etat) => {
    const variables = new Map(etat.variables)
    for (const valeur of segment.valeursDeTete ?? []) affecter(variables, valeur)
    return { ...env, ...Object.fromEntries(VARIABLES_AMORCEES.flatMap((nom) => {
      const cle = powershell ? `env:${nom}` : nom
      return variables.has(cle) ? [[nom, variables.get(cle)]] : []
    })) }
  }
  const traiter = (segment) => {
    const etat = etatDe(segment.shell)
    const environnement = environnementDe(segment, etat), temp = repertoireTemporaire(environnement, platform)
    const jetons = sansRedirections(segment.jetons), textes = jetons.map(j => j.text)
    const nom = basenameExecutable(textes[0])
    const developpes = jetons.map((j, k) => developper(j.text, etat.variables, j) ?? `\0inconnue:${k}\0`)
    const ajouter = (chemin, operation, { puits = false, ecrivain = false, famille } = {}) => {
      if (chemin === undefined || nonConstant(chemin)) chemin = null
      const natif = chemin === null ? null : versCheminNatif(separateurs(chemin), platform)
      const resolu = natif === null || (!etat.base && !P.isAbsolute(natif)) || /^[A-Za-z]:[\\/].*[A-Za-z]:[\\/]|^\(/.test(natif) ? null : P.resolve(etat.base ?? base, natif)
      const lecteurPowerShell = (powershell || ROLES_PAR_NOM.get(nom)?.powerShell) && typeof chemin === 'string' && /^(?!temp:)[A-Za-z][\w-]+::?(?![\\/]{2})/i.test(chemin)
      sorties.push({ chemin: resolu, inconnue: !puits && !lecteurPowerShell && resolu === null, ecrivain, famille, operation, segment, base: etat.base, puits: puits || lecteurPowerShell || (typeof chemin === 'string' && estPuits(chemin, platform)) })
      return sorties.at(-1)
    }
    const heredoc = nom === 'cat' && textes.length === 1 ? segment.jetons.find((j) => typeof j.corps === 'string' || typeof j.corpsADevelopper === 'string') : undefined
    const corps = heredoc?.corps ?? (heredoc ? developperHeredoc(heredoc.corpsADevelopper, etat.variables) : undefined)
    for (const cible of ciblesDeRedirectionAvecProvenance(segment.jetons)) {
      if (cible.quote === undefined && PUITS_POWERSHELL.test(cible.text ?? '')) ajouter(null, 'redirection', { puits: true })
      else ajouter(developper(cible.text, etat.variables, cible), 'redirection').contenu = corps
    }
    if (!exclureArguments(segment)) {
      const contrat = ROLES_PAR_NOM.get(nom)
      const enTete = (segment.enTete ?? []).map((j) => basenameExecutable(j.text))
      const demandeAide = aide(developpes.slice(1), nom)
      const parArgument = powershell ? argumentsPowerShell(jetons, etat.variables) : developpes.map((_d, k) => ({ k, elements: null }))
      const pourWriter = parArgument.map(({ k, prefixe, elements }, i) => (elements ? prefixe + '\0tableau:' + i + '\0' : developpes[k]))
      const ecrits = demandeAide ? [] : ciblesDuWriter(enTete.includes('xargs') ? [...pourWriter, '\0xargs\0'] : pourWriter, P, temp)
        .flatMap((cible) => { const i = /^\0tableau:(\d+)\0$/.exec(cible ?? '')?.[1]; return i === undefined ? [cible] : parArgument[i].elements })
        .map((cible) => ajouter(cible, nom, { ecrivain: true }))
      if (contrat?.contenu && ecrits.length) {
        const k = developpes.findIndex((t) => t.toLowerCase() === '-value')
        const amont = segment.tube?.[segment.tube.indexOf(segment) - 1]?.jetons
        const valeur = k > 0 ? developpes[k + 1] : amont?.length === 1 && amont[0].quote ? developper(amont[0].text, etat.variables, amont[0]) : undefined
        if (typeof valeur === 'string' && !nonConstant(valeur)) for (const e of ecrits) e.contenu = valeur.replace(/^\r?\n|\r?\n$/g, '')
      }
      for (const argument of ecrituresDotnet(segment.jetons)) {
        ajouter(argument.texte === null ? null : developper(argument.texte, etat.variables, { quote: argument.quote === 'simple' ? 'simple' : undefined }), 'dotnet', { ecrivain: true })
      }
      const outils = demandeAide ? { chemins: [], inconnue: false, racines: [] } : ecrituresDOutils(nom, developpes.slice(1))
      for (const chemin of outils.chemins) ajouter(chemin ?? null, nom, { ecrivain: true })
      if (outils.inconnue) ajouter(null, nom, { ecrivain: true })
      if (nom === 'find') for (const c of commandesDeFind(developpes.slice(1), outils.racines)) sousCommande(c, etat)
      if (nom === 'git') {
        const git = gitSubcommand(developpes)
        if (git !== null) {
          const sorte = developpes.flatMap((a, k) => (a === '--output' ? [developpes[k + 1]] : a.startsWith('--output=') ? [a.slice(9)] : git.sub === 'archive' && a === '-o' ? [developpes[k + 1]] : git.sub === 'archive' && /^-o./s.test(a) ? [a.slice(2)] : []))
          const operation = `git ${nonConstant(git.sub) ? '<sous-commande non constante>' : git.sub}`
          for (const chemin of sorte) ajouter(chemin ?? null, operation, { ecrivain: true })
          const lit = nonConstant(git.sub) || aide(git.args) || LECTURES_GIT.has(git.sub) || LECTURES_GIT_SOUS_CONDITION[git.sub]?.(git.args)
          if (!lit) ajouter(null, operation, { ecrivain: true, famille: 'git' })
        }
      }
      const args = developpes.slice(1)
      const sousNpx = enTete.includes('npx')
      const lire = (chemin) => (etat.base === null ? undefined : lireTexte(P.resolve(etat.base, versCheminNatif(chemin, platform))))
      const lectureDOutil = Object.hasOwn(LECTURES_NPX, nom) ? demandeAide || LECTURES_NPX[nom](args, { lire }) : !sousNpx || demandeAide
      if (!nonConstant(developpes[0]) && !lectureDOutil) ajouter(null, `${sousNpx ? 'npx ' : ''}${textes.join(' ')}`, { ecrivain: true, famille: 'npx' })
      if (nom === 'npm' && ecritureDeNpm(args)) ajouter(null, `npm ${textes.slice(1).join(' ')}`.trim(), { ecrivain: true, famille: 'npm' })
      if (nom === 'gh' && !lectureGh(args)) ajouter(null, `gh ${textes.slice(1).join(' ')}`.trim(), { ecrivain: true, famille: 'gh' })
      const lancement = lancementDInterpreteur(developpes, textes)
      if (lancement?.enLigne !== undefined) {
        const jeton = jetons[lancement.enLigne]
        const developpe = jeton === undefined ? null : developper(jeton.text, etat.variables, jeton)
        const code = developpe?.startsWith('--eval=') ? developpe.slice(7) : developpe
        if (code === null) ajouter(null, `${nom}-inline`)
        else if (scripts) sorties.push({ chemin: null, inconnue: false, operation: 'script', enLigne: code, env: environnement, segment, base: etat.base })
        else for (const cible of ciblesDEcritureJS([{ texte: code }], { env: environnement, platform })[0]) {
          if (cible.commande !== undefined) sousCommande(cible.commande, etat)
          else ajouter(cible.chemin, cible.operation)
        }
      }
      for (const sortie of lancement?.ecritures ?? []) ajouter(sortie, nom, { ecrivain: true })
      if (scripts && lancement) {
        for (const script of lancement.scripts) Object.assign(ajouter(script, 'script'), { argv: lancement.argv, env: environnement })
        const filtres = lancement.filtres.map((f) => (nonConstant(f) ? null : f))
        for (const config of lancement.configs) Object.assign(ajouter(config, 'script'), { config: true, filtres, env: environnement, dossierFixeParLaLigne: lancement.dossierFixeParLaLigne })
        for (const dossier of lancement.dossiers) Object.assign(ajouter(dossier, 'script'), { dossier: true, filtres, env: environnement })
      }
    }
    for (const valeur of segment.valeurs ?? []) affecter(etat.variables, valeur)
    const affectation = affectationPowerShell(segment.jetons)
    if (affectation) poser(etat.variables, affectation.nom, affectation.valeur.length === 1 ? developper(affectation.valeur[0].text, etat.variables, affectation.valeur[0]) : null, affectation.ajout)
    if (CHANGEMENTS_DE_REPERTOIRE.has(nom)) {
      let inconnue = false
      const remplace = { ...segment, jetons: jetons.map(j => {
        const texte = separateurs(developper(j.text, etat.variables, j))
        if (texte === null) { inconnue = true; return j }
        return texte === j.text ? j : { ...j, text: texte, raw: JSON.stringify(texte) }
      }) }
      etat.base = inconnue ? null : cibleDeLaCommande(texteDuSegment(remplace), etat.base, platform, { existe: () => true }).dir
    }
  }
  /** Les segments `[debut, fin)` ; une `for <v> in <mots>` se déroule mot par mot jusqu'à son `done`. */
  const traiterPlage = (liste) => {
    for (let i = 0; i < liste.length; i++) {
      const tete = liste[i].jetons
      if (!(tete[0]?.text === 'for' && jetonNu(tete[0]) && tete[2]?.text === 'in')) { traiter(liste[i]); continue }
      let profondeur = 0, fin = i + 1
      for (; fin < liste.length; fin++) {
        const premier = liste[fin].jetons[0]?.text
        if (['for', 'while', 'until', 'select'].includes(premier)) profondeur++
        if (premier === 'done') { if (profondeur === 0) break; profondeur-- }
      }
      const etat = etatDe(liste[i].shell)
      const mots = tete.slice(3).map((j) => developper(j.text, etat.variables, j))
      const corps = liste.slice(i + 1, fin)
      const nomDeBoucle = tete[1].text
      const tours = mots.some((m) => m === null || (/[*?[]/.test(m))) ? [null] : mots
      for (const mot of tours) {
        for (const s of [liste[i], ...corps]) etatDe(s.shell).variables.set(nomDeBoucle, mot)
        traiterPlage(corps)
      }
      i = fin
    }
  }
  traiterPlage(segments)
  return sorties
}
