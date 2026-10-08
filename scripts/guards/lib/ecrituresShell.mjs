import { dirname, isAbsolute, join, resolve } from 'node:path'
import { affectationPowerShell, basenameExecutable, CHANGEMENTS_DE_REPERTOIRE, cibleDeLaCommande, ciblesDeRedirectionAvecProvenance, pipelinesDeJetons, sansRedirections, texteDuSegment, versCheminNatif } from './commandeShell.mjs'
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

export function ciblesDEcritureDeCommande(commande, { base = process.cwd(), platform = process.platform, exclureArguments = () => false, segments = pipelinesDeJetons(commande).flat() } = {}) {
  const etats = new Map(), sorties = []
  const etatDe = (shell) => {
    if (!etats.has(shell)) {
      const parent = shell?.parent ? etatDe(shell.parent) : { base, variables: new Map() }
      etats.set(shell, { base: parent.base, variables: new Map(parent.variables) })
    }
    return etats.get(shell)
  }
  const developper = (texte, variables, jeton = {}) => {
    if (jeton.quote === 'simple') return texte
    if (jeton.quote === undefined && /['"]/.test(jeton.raw ?? '') && /[$%]/.test(texte ?? '')) return null
    if (typeof texte !== 'string' || /\$\(|`/.test(texte)) return null
    const variable = /\$\{(\w+)\}|\$(\w+)|%(\w+)%/g
    if (/[$%]/.test(texte.replace(variable, ''))) return null
    let inconnue = false
    const rendu = texte.replace(variable, (_m, a, b, c) => {
      const valeur = variables.get(a ?? b ?? c)
      if (valeur === undefined || valeur === null) { inconnue = true; return '' }
      return valeur
    })
    return inconnue ? null : rendu
  }
  for (const segment of segments) {
    const etat = etatDe(segment.shell)
    const jetons = sansRedirections(segment.jetons), textes = jetons.map(j => j.text)
    const nom = basenameExecutable(textes[0])
    const developpes = jetons.map((j, k) => developper(j.text, etat.variables, j) ?? `\0inconnue:${k}\0`)
    const ajouter = (chemin, operation) => {
      if (typeof chemin === 'string' && chemin.includes('\0')) chemin = null
      const natif = chemin === null ? null : versCheminNatif(chemin, platform)
      const resolu = natif === null || (!etat.base && !isAbsolute(natif)) ? null : resolve(etat.base ?? base, natif)
      sorties.push({ chemin: resolu, inconnue: resolu === null, operation, segment })
    }
    for (const cible of ciblesDeRedirectionAvecProvenance(segment.jetons)) ajouter(developper(cible.text, etat.variables, cible), 'redirection')
    if (!exclureArguments(segment)) {
      for (const cible of ciblesDuWriter(developpes)) ajouter(cible, nom)
      if (nom === 'node') {
        let argument
        for (let k = 1; k < jetons.length; k++) {
          const jeton = jetons[k], texte = jeton.text
          if (texte === '--' || !texte.startsWith('-')) break
          if (['-e', '--eval', '-p', '--print'].includes(texte)) { argument = jetons[k + 1]; break }
          const prefixe = ['--eval='].find(p => texte.startsWith(p) && texte.length > p.length)
          if (prefixe) {
            const valeur = texte.slice(prefixe.length)
            if (jeton.quote === 'simple' || jeton.quote === 'double') argument = { ...jeton, text: valeur }
            else {
              const raw = jeton.raw?.slice(prefixe.length)
              const lus = typeof raw === 'string' ? pipelinesDeJetons(raw).flat() : []
              argument = lus.length === 1 && lus[0].jetons.length === 1 && lus[0].jetons[0].text === valeur ? lus[0].jetons[0] : { text: null }
            }
            break
          }
          if (['-r', '--require', '--import', '--input-type'].includes(texte)) k++
        }
        if (argument) {
          const code = developper(argument.text, etat.variables, argument)
          if (code === null) ajouter(null, 'node-inline')
          else for (const cible of ciblesDEcritureJS(code)) ajouter(cible.chemin, cible.operation)
        }
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
  return sorties
}
