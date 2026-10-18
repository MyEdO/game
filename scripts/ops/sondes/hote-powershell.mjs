#!/usr/bin/env node
// SONDE de l'hôte PowerShell (#2292) : rejoue sur l'hôte RÉEL (`pwsh`, `powershell` 5.1) ce que lit
// `argumentChaine` (`scripts/guards/lib/commandeShell.mjs`), et signale tout écart.
//   node scripts/ops/sondes/hote-powershell.mjs <dossier-de-sortie> [--liste]   (`--liste` : sans la grille des préfixes)
// Se rejoue à la main, à chaque changement de version d'un hôte ; la suite ne la lance jamais (elle lance l'hôte).
//
// Trois jeux de cas :
//   - la LISTE `CAS_HOTE_POWERSHELL` (`scripts/hooks/hote-powershell-cas.mjs`), que lisent aussi les tests : la
//     classe déclarée de chaque cas doit être celle de l'hôte ;
//   - la grille des BLANCS (`CANDIDATS_BLANCS`) : `-c` précédé, puis suivi, de chaque blanc de .NET ou du `trim()` de JS ;
//   - la GRILLE de chaque grammaire (`GRAMMAIRES_HOTE_POWERSHELL`) : chaque préfixe de chaque paramètre (pour
//     `pwsh`, les bornes que fixe le source : `min - 1`, `min`, le nom entier ; pour `powershell` 5.1, sans
//     source, TOUS les préfixes, des noms de pwsh et de `about_PowerShell_exe`), suivi de cinq formes. Un cas que
//     l'hôte exécute et que la lecture ne rend pas est une SOUS-approximation : un écart.
//
// Charge INOFFENSIVE : `Write-Output ('SENTI'+'NELLE_<n>')`, sans le littéral, que 5.1 recopie dans ses erreurs
// d'analyse. L'hôte EXÉCUTE la charge si, et seulement si, une ligne de sa sortie standard vaut EXACTEMENT
// `SENTINELLE_<n>`. Chaque cas se lance par `superviserProcessus`, avec une entrée standard fermée (vide, ou la charge
// pour un cas `entree`) et un délai `DELAI_MS` ; un hôte qui attend (`-NoExit`, `-NamedPipeServerMode`…) est arrêté au
// délai, ou au signal de la file (`enFileBornee`), son ARBRE compris : le `bash.exe` d'un cas `gitbash` et l'hôte qu'il
// lance. Un cas dont la supervision échoue, ou dont l'arbre n'est pas certifié mort, est un RATÉ : rendu avec sa cause
// (`rate`), jamais jugé ni compté en écart, sans arrêter la file. L'interruption de la sonde (`SIGINT`, `SIGTERM`,
// `SIGHUP`) abandonne la file, qui rejette de sa raison sans écrire de rapport.
// Sortie : `<dossier>/hote-powershell.json` (hôtes, versions, chaque cas avec son code de sortie et les 200
// premiers caractères de sa sortie, ou son raté) ; code 1 si un écart ou un raté existe.
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { GRAMMAIRES_HOTE_POWERSHELL, argumentChaine } from '../../guards/lib/commandeShell.mjs'
import { enFileBornee } from '../../guards/lib/fileBornee.mjs'
import { superviserProcessus } from '../../guards/lib/superviserProcessus.mjs'
import { CAS_HOTE_POWERSHELL, HOTES_MESURES, argumentsDuCas } from '../../hooks/hote-powershell-cas.mjs'

const DELAI_MS = 20_000
const PARALLELE = 4
/** Paramètres documentés de `powershell` 5.1 (`about_PowerShell_exe`) absents de la table de pwsh. */
const NOMS_51_DOCUMENTES = ['psconsolefile', 'version']
/** Valeur valide d'un paramètre à valeur, pour que la forme `[jeton, valeur, charge]` atteigne la charge. */
const VALEURS = {
  executionpolicy: 'Bypass', ep: 'Bypass', inputformat: 'Text', if: 'Text', outputformat: 'Text', of: 'Text',
  windowstyle: 'Normal', workingdirectory: '.', wd: '.', utctimestamp: '2026-01-01T00:00:00Z', version: '5.1',
}

const sortie = process.argv[2]
if (!sortie || !existsSync(sortie)) {
  process.stderr.write('Usage : node scripts/ops/sondes/hote-powershell.mjs <dossier-de-sortie existant, HORS du dépôt>\n')
  process.exit(2)
}
const DOSSIER = resolve(sortie)
/** Git Bash : `bash.exe` de l'installation de git qui tourne (`<git>/mingw64/libexec/git-core` → `<git>/usr/bin`). */
const GIT_BASH = join(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '..', '..', '..', 'usr', 'bin', 'bash.exe')

/** Exécutable d'un hôte : son emplacement d'installation Windows s'il existe, sinon son nom (cherché au PATH). */
const installe = (chemin, nom) => (existsSync(chemin) ? chemin.replace(/\\/g, '/') : nom)
const EXECUTABLES = {
  pwsh: installe(join(process.env.ProgramFiles ?? '', 'PowerShell', '7', 'pwsh.exe'), 'pwsh'),
  powershell: installe(join(process.env.SystemRoot ?? '', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), 'powershell'),
}

let numero = 0
/** Une charge neuve : `{ commande, sentinelle }`. */
function charge() {
  numero += 1
  return { commande: `Write-Output ('SENTI'+'NELLE_${numero}')`, sentinelle: `SENTINELLE_${numero}` }
}

/**
 * Lance `exe args` (ou la ligne `bash -c`) par `superviserProcessus`, son arbre arrêté au délai ou à `signal` ; rend
 * `{ code, delai, executee, sortie }`, `delai` vrai si l'arrêt vient de `DELAI_MS`, ou `{ rate }` (sa cause) si la
 * supervision échoue ou si l'arbre n'est pas certifié mort.
 */
async function lancer({ exe, args, via, entree }, sentinelle, signal) {
  const quote = (a) => `'${a.replaceAll("'", "'\\''")}'`
  const [commande, argv] = via === 'gitbash'
    ? [GIT_BASH, ['-c', [EXECUTABLES[exe], ...args].map(quote).join(' ')]]
    : [EXECUTABLES[exe], args]
  const r = await superviserProcessus({ commande, args: argv, cwd: DOSSIER, entree: entree ?? '', timeout: DELAI_MS, signal })
  const delai = r.error?.code === 'ETIMEDOUT'
  if ((r.error && !delai) || r.arret?.etat !== 'mort') return { rate: r.error ? `${r.error.code} : ${r.error.message}` : `arbre ${r.arret?.etat}` }
  const executee = r.stdout.split(/\r?\n/).some((l) => l.trim() === sentinelle)
  return { code: r.status, delai, executee, sortie: (r.stdout + r.stderr).replace(/\s+/g, ' ').trim().slice(0, 200) }
}

/** La lecture de la garde sur ce segment rend-elle la charge ? */
const lue = (exe, args, commande) => argumentChaine([exe, ...args])?.includes(commande) ?? false

/** Le cas `identite` lancé par `lancement`, puis jugé par `juger(hote)` ; un raté n'est pas jugé. */
async function mesurer(identite, lancement, sentinelle, signal, juger) {
  const hote = await lancer(lancement, sentinelle, signal)
  return { ...identite, ...(hote.rate ? {} : juger(hote)), ...hote }
}

function casDeLaListe() {
  return CAS_HOTE_POWERSHELL.map((cas) => async (signal) => {
    const { commande, sentinelle } = charge()
    const args = argumentsDuCas(cas, commande)
    const lancement = { exe: cas.exe, args, via: cas.via, entree: cas.entree ? `${commande}\n` : '' }
    return mesurer({ jeu: 'liste', exe: cas.exe, via: cas.via, args, classe: cas.classe }, lancement, sentinelle, signal, (hote) => {
      const classeHote = hote.executee ? (cas.entree ? 'stdin' : 'execute') : 'rien'
      const lecture = lue(cas.exe, args, commande)
      const ecart = classeHote !== cas.classe ? `l'hôte rend ${classeHote}, la liste déclare ${cas.classe}`
        : hote.executee && !cas.entree && !lecture ? 'sous-approximation' : null
      return { classeHote, lecture, ecart }
    })
  })
}

/** Jugement d'un cas des grilles : un cas exécuté que la lecture ne rend pas est une sous-approximation. */
const jugerGrille = (exe, args, commande) => (hote) => {
  const lecture = lue(exe, args, commande)
  return { lecture, ecart: hote.executee && !lecture ? 'sous-approximation' : null, surApproximation: !hote.executee && lecture }
}

/** Jetons de la grille d'un exécutable : `[jeton, nom]`. */
function jetonsDeLaGrille(exe) {
  const alias = (g) => g.parametres.flatMap((p) => p.alias).filter(([nom]) => nom !== '')
  if (exe === 'pwsh') {
    return alias(GRAMMAIRES_HOTE_POWERSHELL.pwsh).flatMap(([nom, min]) =>
      [...new Set([min.length - 1, min.length, nom.length])].filter((n) => n > 0).map((n) => [nom.slice(0, n), nom]))
  }
  const noms = [...new Set([...alias(GRAMMAIRES_HOTE_POWERSHELL.pwsh), ...alias(GRAMMAIRES_HOTE_POWERSHELL.powershell)]
    .map(([nom]) => nom).concat(NOMS_51_DOCUMENTES))]
  const prefixes = new Set(noms.flatMap((nom) => Array.from({ length: nom.length }, (_, n) => nom.slice(0, n + 1))))
  return [...prefixes].map((p) => [p, noms.find((nom) => nom.startsWith(p) && VALEURS[nom]) ?? noms.find((nom) => nom.startsWith(p))])
}

/** Caractères candidats aux bords d'un paramètre : les blancs de .NET (`Char.IsWhiteSpace`) et ceux du `trim()` de JS
 *  (U+FEFF), plus U+200B, blanc d'aucun des deux. */
const CANDIDATS_BLANCS = [
  ...Array.from({ length: 5 }, (_, i) => 0x09 + i), 0x20, 0x85, 0xa0, 0x1680, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i),
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff, 0x200b,
].map((p) => String.fromCodePoint(p))

/** Grille des blancs : `-c` précédé, puis suivi, de chaque candidat. */
function casDesBlancs() {
  return ['pwsh', 'powershell'].flatMap((exe) => CANDIDATS_BLANCS.flatMap((b) => [`${b}-c`, `-c${b}`].map((jeton) => async (signal) => {
    const c = charge()
    const args = ['-NoProfile', jeton, c.commande]
    const blanc = `U+${b.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
    return mesurer({ jeu: 'blancs', exe, blanc, args }, { exe, args }, c.sentinelle, signal, jugerGrille(exe, args, c.commande))
  })))
}

function casDeLaGrille() {
  const taches = []
  for (const exe of ['pwsh', 'powershell']) {
    for (const [prefixe, nom] of jetonsDeLaGrille(exe)) {
      const jeton = `-${prefixe}`
      const formes = [
        (c) => [jeton, c.commande],
        (c) => [jeton, VALEURS[nom] ?? 'x', c.commande],
        (c) => [jeton, Buffer.from(c.commande, 'utf16le').toString('base64')],
        (c) => [jeton, ';', ...c.commande.split(' ')],
        (c) => [jeton, '-NoProfile', c.commande],
      ]
      for (const forme of formes) {
        taches.push(async (signal) => {
          const c = charge()
          const args = ['-NoProfile', ...forme(c)]
          return mesurer({ jeu: 'grille', exe, nom, args }, { exe, args }, c.sentinelle, signal, jugerGrille(exe, args, c.commande))
        })
      }
    }
  }
  return taches
}

function versions() {
  const pwsh = execFileSync(EXECUTABLES.pwsh, ['--version'], { encoding: 'utf8', input: '', windowsHide: true }).trim().replace(/^PowerShell /, '')
  const powershell = execFileSync(EXECUTABLES.powershell, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
    encoding: 'utf8', input: '', windowsHide: true,
  }).trim()
  return { pwsh, powershell }
}

/** Interruption de la sonde : la file s'arrête, au lieu de verser en ratés les cas que la supervision interrompt. */
const interruption = new AbortController()
for (const nom of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(nom, () => interruption.abort(Object.assign(new Error(`sonde interrompue : ${nom}`), { code: 'EINTR' })))
}
const hotes = versions()
const taches = [...casDeLaListe(), ...casDesBlancs(), ...(process.argv.includes('--liste') ? [] : casDeLaGrille())]
const resultats = await enFileBornee(taches, { deFront: PARALLELE, signal: interruption.signal })
const ecarts = resultats.filter((r) => r.ecart)
const rates = resultats.filter((r) => r.rate)
const versionsEcart = Object.entries(HOTES_MESURES).filter(([exe, v]) => hotes[exe] !== v)
  .map(([exe, v]) => `${exe} ${hotes[exe]} : la liste a été mesurée sur ${v}`)
const rapport = {
  date: new Date().toISOString(), hotes, executables: EXECUTABLES, gitBash: GIT_BASH, delaiMs: DELAI_MS, versionsEcart,
  compte: {
    cas: resultats.length, ecarts: ecarts.length, rates: rates.length, delais: resultats.filter((r) => r.delai).length,
    surApproximationsGrille: resultats.filter((r) => r.surApproximation).length,
  },
  ecarts, rates, resultats,
}
writeFileSync(join(DOSSIER, 'hote-powershell.json'), `${JSON.stringify(rapport, null, 1)}\n`)
console.log(`hôtes ${JSON.stringify(hotes)} — ${JSON.stringify(rapport.compte)}`)
for (const v of versionsEcart) console.log(`VERSION : ${v}`)
for (const e of ecarts) console.log(`ÉCART ${e.jeu} ${e.exe} ${JSON.stringify(e.args)} : ${e.ecart} :: ${e.sortie}`)
for (const r of rates) console.log(`RATÉ ${r.jeu} ${r.exe} ${JSON.stringify(r.args)} : ${r.rate}`)
process.exit(ecarts.length || rates.length || versionsEcart.length ? 1 : 0)
