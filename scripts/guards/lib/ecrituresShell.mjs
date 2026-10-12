import { dirname, isAbsolute, join, resolve } from 'node:path'
import { affectationPowerShell, basenameExecutable, CHANGEMENTS_DE_REPERTOIRE, cibleDeLaCommande, ciblesDeRedirectionAvecProvenance, gitSubcommand, jetonNu, pipelinesDeJetons, sansRedirections, texteDuSegment, versCheminNatif } from './commandeShell.mjs'
import { ciblesDEcritureJS } from './ecrituresFichiers.mjs'

const ROLES = [
  { noms: ['cp', 'ln'], role: 'destination', valeurs: ['-S', '--suffix'], destination: ['-t', '--target-directory'] },
  { noms: ['install'], role: 'destination', valeurs: ['-m', '--mode', '-o', '--owner', '-g', '--group', '-S', '--suffix'], destination: ['-t', '--target-directory'] },
  { noms: ['mv'], role: 'deplacement', valeurs: ['-S', '--suffix'], destination: ['-t', '--target-directory'] },
  { noms: ['tee', 'rm', 'rmdir'], role: 'chemins' },
  { noms: ['touch'], role: 'chemins', valeurs: ['-d', '--date', '-r', '--reference', '-t'] },
  { noms: ['mkdir'], role: 'chemins', valeurs: ['-m', '--mode'] },
  { noms: ['truncate'], role: 'chemins', valeurs: ['-s', '--size', '-r', '--reference'] },
  { noms: ['uniq'], role: 'second', valeurs: ['-f', '-s', '-w', '--skip-fields', '--skip-chars', '--check-chars'] },
  { noms: ['copy-item', 'cpi', 'copy'], role: 'destination', powerShell: true },
  { noms: ['move-item', 'mi', 'move'], role: 'deplacement', powerShell: true },
  { noms: ['rename-item', 'rni'], role: 'renommage', powerShell: true },
  { noms: ['tee-object', 'remove-item', 'ri', 'del', 'erase'], role: 'chemins', powerShell: true },
  { noms: ['set-content', 'sc', 'add-content', 'ac', 'out-file'], role: 'premier', powerShell: true },
  { noms: ['new-item', 'ni'], role: 'creation', powerShell: true },
]
const ROLES_PAR_NOM = new Map(ROLES.flatMap((r) => r.noms.map((nom) => [nom, r])))
const OPTIONS_CHEMIN = new Set(['-path', '-literalpath', '-filepath', '-destination', '-newname'])
const OPTIONS_VALEUR_POWERSHELL = new Set(['-value', '-encoding', '-filter', '-include', '-exclude', '-itemtype', '-name', '-width', '-inputobject', '-stream', '-credential', '-erroraction'])

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

function ciblesDuWriter(textes) {
  const nom = basenameExecutable(textes[0]), args = textes.slice(1)
  const contrat = ROLES_PAR_NOM.get(nom), role = contrat?.role
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
    if (role === 'renommage') {
      const source = sources[0] ?? positions[0], neuf = destination ?? positions[sources.length ? 0 : 1]
      return source ? [source, ...(neuf ? [join(dirname(source), neuf)] : [])] : []
    }
    if (role === 'creation') {
      const k = args.findIndex(a => a.toLowerCase() === '-name'), nomNeuf = k < 0 ? null : args[k + 1]
      const parents = sources.length ? sources : positions.length ? positions.slice(0, 1) : ['.']
      return parents.map(p => nomNeuf ? join(p, nomNeuf) : p)
    }
    const sansValeurPositionnelle = role === 'premier' ? sources.length || nommes.has('-filepath') ? [] : positions.slice(0, 1) : positions
    return [...sources, nommes.get('-filepath'), ...sansValeurPositionnelle].filter(Boolean)
  }
  if (nom === 'dd') return args.filter(a => a.startsWith('of=')).map(a => a.slice(3))
  if (nom === 'sort') {
    const resultats = []
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-o' || args[k] === '--output') resultats.push(args[++k])
      else if (args[k].startsWith('--output=')) resultats.push(args[k].slice(9))
      else if (/^-o.+/.test(args[k])) resultats.push(args[k].slice(2))
    }
    return resultats.filter(Boolean)
  }
  if (nom === 'sed') {
    const inplace = args.some(a => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))
    const scripts = [], fichiers = []
    let scriptPos = false
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-e' || args[k] === '--expression') { scripts.push(args[++k]); scriptPos = true }
      else if (args[k] === '-f' || args[k] === '--file') { k++; scriptPos = true }
      else if (!args[k].startsWith('-')) {
        if (!scriptPos) { scripts.push(args[k]); scriptPos = true } else fichiers.push(args[k])
      }
    }
    return [...(inplace ? fichiers : []), ...scripts.flatMap(s => [...s.matchAll(/(?:^|[;\n])\s*w\s+([^;\n]+)/g)].map(m => m[1].trim()))]
  }
  if (nom === 'awk' || nom === 'gawk') return args.flatMap(a => [...a.matchAll(/\bprintf?\b[^;}]*?>{1,2}\s*["']([^"']+)["']/g)].map(m => m[1]))
  return []
}

/** Les PUITS : une écriture qui n'atteint aucun fichier — `/dev/null`, `/dev/stdout`, `/dev/stderr`, `/dev/stdin`,
 *  `NUL` sous win32, `$null` de PowerShell. */
const estPuits = (texte, platform) => /^\/dev\/(?:null|stdout|stderr|stdin)$/.test(texte) || (platform === 'win32' && /^nul$/i.test(texte))
const PUITS_POWERSHELL = /^\$null$/i

/** Les variables d'environnement que le hook connaît du shell qu'il juge : le répertoire temporaire. */
const VARIABLES_AMORCEES = ['TEMP', 'TMP', 'TMPDIR']

/** Les sous-commandes git qui ne font que LIRE (`git help -a` : « Interrogators », et les porcelaines de
 *  lecture) ; toute autre sous-commande est une écriture inconnue, sauf les formes de lecture de
 *  `LECTURES_GIT_SOUS_CONDITION`. */
const LECTURES_GIT = new Set(`
  annotate blame cat-file check-attr check-ignore check-mailmap check-ref-format cherry column count-objects describe diff
  diff-files diff-index diff-pairs diff-tree for-each-ref get-tar-commit-id grep help log ls-files ls-remote ls-tree merge-base
  name-rev patch-id range-diff rev-list rev-parse shortlog show show-branch show-index show-ref status stripspace var
  verify-commit verify-pack verify-tag version whatchanged archive`.trim().split(/\s+/))
/** Les sous-commandes git qui lisent sous une forme seulement : le prédicat reçoit leurs arguments. */
const LECTURES_GIT_SOUS_CONDITION = {
  branch: (a) => a.every((x) => x.startsWith('-') && !/^-(?:[dDmMcCfu]|-delete|-move|-copy|-force|-set-upstream|-unset-upstream|-edit-description|-track)/.test(x)),
  tag: (a) => a.length === 0 || a.some((x) => ['-l', '--list', '-v', '--verify'].includes(x)),
  config: (a) => a.some((x) => /^(?:--get|--get-all|--get-regexp|--get-urlmatch|-l|--list|get|list)$/.test(x)),
  stash: (a) => ['list', 'show'].includes(a[0]),
  worktree: (a) => a[0] === 'list',
  remote: (a) => a.length === 0 || ['-v', '--verbose', 'show', 'get-url'].includes(a[0]),
  notes: (a) => a.length === 0 || ['list', 'show'].includes(a[0]),
  reflog: (a) => !['expire', 'delete', 'drop', 'write'].includes(a[0]),
  'symbolic-ref': (a) => a.filter((x) => !x.startsWith('-')).length <= 1,
  'sparse-checkout': (a) => a[0] === 'list',
  submodule: (a) => ['status', 'summary'].includes(a[0]),
  bundle: (a) => ['verify', 'list-heads'].includes(a[0]),
}

/** Les lancements d'un INTERPRÉTEUR : `{ scripts, langage, enLigne, nonLu, argv }` — les fichiers qu'il lance,
 *  le langage de son code, le code en ligne JS (`-e`, `-p`), `nonLu` = un code qu'il exécute sans que la
 *  commande le nomme (stdin, code en ligne non JS, module), `argv` = le `process.argv` d'un script JS seul
 *  (un argument non développé vaut `null`) ; `null` hors interpréteur. Les options se lisent sur
 *  `bruts` (le texte des jetons) quand leur développement échoue. */
function lancementDInterpreteur(textes, segment, bruts = textes) {
  let nom = basenameExecutable(textes[0])
  let k = 1
  if (nom === 'npx') {
    while (k < textes.length && textes[k].startsWith('-')) k++
    if (basenameExecutable(textes[k]) !== 'tsx') return null
    nom = 'tsx'
    k++
  }
  const stdin = segment.jetons.some((j) => jetonNu(j) && /^</.test(j.text)) || (segment.tube?.indexOf(segment) ?? 0) > 0
  const rendu = { scripts: [], langage: nom, enLigne: undefined, nonLu: false }
  if (nom === 'node' || nom === 'tsx') {
    rendu.langage = 'js'
    const test = textes.includes('--test')
    for (; k < textes.length; k++) {
      const texte = textes[k].includes('\0') ? bruts[k] : textes[k]
      if (/^-[a-zA-Z]*[ep]$|^--(?:eval|print)$/.test(texte)) { rendu.enLigne = k + 1; return rendu }
      if (/^--eval=/.test(texte)) { rendu.enLigne = k; return rendu }
      if (texte === '--') { rendu.scripts.push(...(test ? textes.slice(k + 1) : textes.slice(k + 1, k + 2))); return rendu }
      if (['-r', '--require', '--import', '--input-type', '--loader', '--experimental-loader', '--test-reporter', '--test-reporter-destination', '--test-name-pattern', '--test-concurrency'].includes(texte)) { k++; continue }
      if (texte.startsWith('-')) continue
      rendu.scripts.push(texte)
      if (!test) {
        rendu.argv = [textes[0], texte, ...textes.slice(k + 1)].map((a) => (a.includes('\0') ? null : a))
        return rendu
      }
    }
    if (!rendu.scripts.length && !test && stdin) rendu.nonLu = true
    return rendu
  }
  if (['python', 'python3', 'py', 'perl', 'sh', 'bash', 'zsh', 'dash'].includes(nom)) {
    for (; k < textes.length; k++) {
      const texte = textes[k]
      if (['-c', '-e', '-E', '-m', '-i', '-n', '-p', '-'].includes(texte) || /^-[a-zA-Z]*[eEipn]$/.test(texte) && nom === 'perl') {
        if (texte === '-c' && ['sh', 'bash', 'zsh', 'dash'].includes(nom)) return null
        rendu.nonLu = true
        return rendu
      }
      if (texte.startsWith('-')) continue
      rendu.scripts.push(texte)
      return rendu
    }
    if (stdin) rendu.nonLu = true
    return rendu.nonLu ? rendu : null
  }
  if (nom === 'pwsh' || nom === 'powershell') {
    rendu.langage = 'powershell'
    const f = textes.findIndex((t) => /^-f(?:ile)?$/i.test(t))
    if (f > 0 && textes[f + 1]) { rendu.scripts.push(textes[f + 1]); return rendu }
    const ps1 = textes.slice(1).find((t) => /\.ps1$/i.test(t) && !t.startsWith('-'))
    if (ps1) { rendu.scripts.push(ps1); return rendu }
    return null
  }
  return null
}

/** Les écritures que déclarent les commandes d'archivage, de recherche et de transfert : `{ chemins, inconnue }`. */
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
    const inconnue = args.some((a) => /^-[a-zA-Z]*O$|^--remote-name(?:-all)?$|^-J$/.test(a))
    return { chemins: valeurDe(['-o', '-D', '-c'], ['--output', '--dump-header', '--cookie-jar']), inconnue }
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
    return { chemins: [...(args.includes('-delete') ? lieux : []), ...valeurDe(['-fprint', '-fprint0', '-fprintf', '-fls'], [])], inconnue: false }
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

/** `npm`/`npx` qui écrivent : `npm` hors `test`/`t` et des commandes d'interrogation, `npx <outil>` avec
 *  `--write`/`-w`/`-u`/`--update`. `juge.md:17-18` prescrit `npm test -- <chemins>` et `npx vitest run`. */
const LECTURES_NPM = new Set(['test', 't', 'tst', 'ls', 'list', 'view', 'v', 'info', 'show', 'outdated', 'help', 'explain', 'why', 'query', 'search', 'doctor', 'prefix', 'root', 'bin', 'whoami', 'ping', '--version', '-v', 'version'])
function ecritureDeNpm(nom, args) {
  if (nom === 'npm') {
    const sous = args.find((a) => !a.startsWith('-')) ?? args[0]
    if (sous === undefined) return false
    if (sous === 'version') return args.length > 1
    if (sous === 'config' || sous === 'c') return !['get', 'list', 'ls'].includes(args[args.indexOf(sous) + 1])
    return !LECTURES_NPM.has(sous)
  }
  if (nom === 'npx') return args.some((a) => /^(?:--write|-w|-u|--update|--updateSnapshot|--fix)$/.test(a))
  return false
}


/**
 * Les cibles d'écriture qu'une commande DÉCLARE, `{ chemin, inconnue, operation, segment, base, puits, contenu, langage }` :
 * `base` = le répertoire courant du segment (`null` inconnu) ; `puits` = une écriture qui n'atteint aucun
 * fichier (`estPuits`) ; `contenu` = le texte écrit, connu pour une redirection de `cat` qu'alimente un heredoc
 * littéral, et pour `Set-Content`/`Out-File` alimentés par une chaîne littérale, `undefined` sinon. Une
 * sous-commande git hors de `LECTURES_GIT`, un `npm`/`npx` qui écrit : cible inconnue ; une commande que `xargs`
 * alimente reçoit un argument inconnu. Une `for <v> in <mots>` littérale se déroule. `env` amorce `VARIABLES_AMORCEES`
 * (`$TEMP`, `$env:TEMP`). Avec `scripts`, s'y ajoutent les LANCEMENTS d'interpréteur
 * (`lancementDInterpreteur`) : `{ operation: 'script', langage }` par fichier lancé, une cible inconnue pour un
 * code qu'il exécute sans que la commande le nomme.
 */
export function ciblesDEcritureDeCommande(commande, { base = process.cwd(), platform = process.platform, env = {}, exclureArguments = () => false, segments = pipelinesDeJetons(commande).flat(), scripts = false } = {}) {
  const etats = new Map(), sorties = []
  const amorce = new Map(VARIABLES_AMORCEES.filter((nom) => typeof env[nom] === 'string').flatMap((nom) => [[nom, env[nom]], [`env:${nom}`, env[nom]]]))
  const etatDe = (shell) => {
    if (!etats.has(shell)) {
      const parent = shell?.parent ? etatDe(shell.parent) : { base, variables: amorce }
      etats.set(shell, { base: parent.base, variables: new Map(parent.variables) })
    }
    return etats.get(shell)
  }
  const developper = (texte, variables, jeton = {}) => {
    if (jeton.quote === 'simple') return texte
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
  const sousCommande = (texte, etat) => {
    for (const cible of ciblesDEcritureDeCommande(texte, { base: etat.base ?? base, platform, env, scripts })) sorties.push(cible)
  }
  const traiter = (segment) => {
    const etat = etatDe(segment.shell)
    const jetons = sansRedirections(segment.jetons), textes = jetons.map(j => j.text)
    const nom = basenameExecutable(textes[0])
    const developpes = jetons.map((j, k) => developper(j.text, etat.variables, j) ?? `\0inconnue:${k}\0`)
    const ajouter = (chemin, operation, puits = false) => {
      if (typeof chemin === 'string' && chemin.includes('\0')) chemin = null
      const natif = chemin === null ? null : versCheminNatif(chemin, platform)
      const resolu = natif === null || (!etat.base && !isAbsolute(natif)) || /^[A-Za-z]:[\\/].*[A-Za-z]:[\\/]|^\(/.test(natif) ? null : resolve(etat.base ?? base, natif)
      sorties.push({ chemin: resolu, inconnue: !puits && resolu === null, operation, segment, base: etat.base, puits: puits || (typeof chemin === 'string' && estPuits(chemin, platform)) })
      return sorties.at(-1)
    }
    const corps = nom === 'cat' && textes.length === 1 ? segment.jetons.find((j) => typeof j.corps === 'string')?.corps : undefined
    for (const cible of ciblesDeRedirectionAvecProvenance(segment.jetons)) {
      if (cible.quote === undefined && PUITS_POWERSHELL.test(cible.text ?? '')) ajouter(null, 'redirection', true)
      else ajouter(developper(cible.text, etat.variables, cible), 'redirection').contenu = corps
    }
    if (!exclureArguments(segment)) {
      const contrat = ROLES_PAR_NOM.get(nom)
      const enTete = (segment.enTete ?? []).map((j) => basenameExecutable(j.text))
      const ecrits = ciblesDuWriter(enTete.includes('xargs') ? [...developpes, '\0xargs\0'] : developpes).map((cible) => ajouter(cible, nom))
      if (contrat?.role === 'premier' && ecrits.length) {
        const k = developpes.findIndex((t) => t.toLowerCase() === '-value')
        const amont = segment.tube?.[segment.tube.indexOf(segment) - 1]?.jetons
        const valeur = k > 0 ? developpes[k + 1] : amont?.length === 1 && amont[0].quote ? developper(amont[0].text, etat.variables, amont[0]) : undefined
        if (typeof valeur === 'string' && !valeur.includes('\0')) for (const e of ecrits) e.contenu = valeur.replace(/^\r?\n|\r?\n$/g, '')
      }
      const outils = ecrituresDOutils(nom, developpes.slice(1))
      for (const chemin of outils.chemins) ajouter(chemin ?? null, nom)
      if (outils.inconnue) ajouter(null, nom)
      if (nom === 'find') for (const c of commandesDeFind(developpes.slice(1), outils.racines ?? ['.'])) sousCommande(c, etat)
      if (nom === 'git') {
        const git = gitSubcommand(developpes)
        if (git !== null) {
          const sorte = developpes.flatMap((a, k) => (a === '--output' ? [developpes[k + 1]] : a.startsWith('--output=') ? [a.slice(9)] : git.sub === 'archive' && a === '-o' ? [developpes[k + 1]] : []))
          for (const chemin of sorte) ajouter(chemin ?? null, `git ${git.sub}`)
          const lit = LECTURES_GIT.has(git.sub) || LECTURES_GIT_SOUS_CONDITION[git.sub]?.(git.args)
          if (!lit) ajouter(null, `git ${git.sub}`)
        }
      }
      if (ecritureDeNpm(enTete.includes('npx') ? 'npx' : nom, developpes.slice(1))) ajouter(null, `${nom} ${developpes.slice(1).join(' ')}`.trim())
      const lancement = lancementDInterpreteur(developpes, segment, textes)
      if (lancement?.enLigne !== undefined) {
        const jeton = jetons[lancement.enLigne]
        const developpe = jeton === undefined ? null : developper(jeton.text, etat.variables, jeton)
        const code = developpe?.startsWith('--eval=') ? developpe.slice(7) : developpe
        if (code === null) ajouter(null, `${nom}-inline`)
        else for (const cible of ciblesDEcritureJS(code)) {
          if (cible.commande !== undefined) sousCommande(cible.commande, etat)
          else ajouter(cible.chemin, cible.operation)
        }
      }
      if (scripts && lancement) {
        for (const script of lancement.scripts) Object.assign(ajouter(script, 'script'), { langage: lancement.langage, argv: lancement.argv })
        if (lancement.nonLu) ajouter(null, `${lancement.langage} (code non lu)`)
      }
    }
    for (const valeur of segment.valeurs ?? []) etat.variables.set(valeur.nom, developper(valeur.valeur, etat.variables, valeur.jeton))
    const affectation = affectationPowerShell(segment.jetons)
    if (affectation) etat.variables.set(affectation.nom, affectation.valeur.length === 1 ? developper(affectation.valeur[0].text, etat.variables, affectation.valeur[0]) : null)
    if (CHANGEMENTS_DE_REPERTOIRE.has(nom)) {
      let inconnue = false
      const remplace = { ...segment, jetons: jetons.map(j => {
        const texte = developper(j.text, etat.variables, j)
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
