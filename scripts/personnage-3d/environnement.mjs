// Environnement Python épinglé de la chaîne de production 3D (#2948) : un venv Python 3.11 hors de l'arbre, rempli
// par `pip --require-hashes` depuis `requirements.txt`, puis la primitive demandée lancée dedans.
//
//   node scripts/personnage-3d/environnement.mjs                       installe (ou vérifie) l'environnement
//   node scripts/personnage-3d/environnement.mjs <script.py> [args…]   installe puis lance le script dans le venv
//
// Le venv se garde sous `CACHE`, keyé par l'empreinte de `requirements.txt` : une exigence changée en crée un neuf.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const EXIGENCES = join(ICI, 'requirements.txt')
const EMPREINTE = createHash('sha256').update(readFileSync(EXIGENCES)).digest('hex').slice(0, 16)

/** Le venv, hors de l'arbre, sur le patron du `CACHE` de `hotes/godot/construire.mjs`. */
const CACHE = join(homedir(), '.cache', 'wfrp-personnage-3d', EMPREINTE)
const WINDOWS = process.platform === 'win32'
const PYTHON_DU_VENV = WINDOWS ? join(CACHE, 'Scripts', 'python.exe') : join(CACHE, 'bin', 'python')
/** Posé après un `pip install` réussi : un venv sans lui est un venv inachevé, recréé. */
const TEMOIN = join(CACHE, 'installe.ok')

/** Les interpréteurs essayés, dans l'ordre ; le premier qui se déclare 3.11 gagne. */
const CANDIDATS = WINDOWS
  ? [['py', ['-3.11']], ['python3.11', []], ['python', []]]
  : [['python3.11', []], ['python3', []], ['python', []]]

export class Python311Introuvable extends Error {
  constructor(essais) {
    super(`Python311Introuvable : la roue bpy 4.5.14 n'existe que pour CPython 3.11 (cp311). Installe Python 3.11 64 bits `
      + `(Windows : https://www.python.org/downloads/release/python-3119/ ou « winget install Python.Python.3.11 » ; `
      + `Linux : paquet python3.11 et python3.11-venv). Essayés : ${essais.join(' ; ')}`)
    this.name = 'Python311Introuvable'
  }
}

/** Lance `commande` et sort avec son code s'il n'est pas nul. */
function executer(commande, args, options = {}) {
  const vu = spawnSync(commande, args, { stdio: 'inherit', ...options })
  if (vu.error) throw vu.error
  if (vu.status !== 0) {
    process.stderr.write(`[personnage-3d] ${commande} ${args.join(' ')} : code ${vu.status}\n`)
    process.exit(vu.status ?? 1)
  }
}

/** Le premier interpréteur 3.11 des `CANDIDATS`, ou `Python311Introuvable`. */
export function python311(candidats = CANDIDATS) {
  const essais = []
  for (const [commande, prefixe] of candidats) {
    const vu = spawnSync(commande, [...prefixe, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' })
    const version = vu.status === 0 ? vu.stdout.trim() : null
    essais.push(`${[commande, ...prefixe].join(' ')} → ${version ?? 'absent'}`)
    if (version === '3.11') return [commande, prefixe]
  }
  throw new Python311Introuvable(essais)
}

function installer() {
  if (existsSync(TEMOIN)) return
  const [commande, prefixe] = python311()
  mkdirSync(dirname(CACHE), { recursive: true })
  executer(commande, [...prefixe, '-m', 'venv', '--clear', CACHE])
  executer(PYTHON_DU_VENV, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--require-hashes',
    '--only-binary', ':all:', '-r', EXIGENCES])
  writeFileSync(TEMOIN, `${EMPREINTE}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  installer()
  const [script, ...args] = process.argv.slice(2)
  if (!script) {
    process.stdout.write(`[personnage-3d] environnement prêt : ${PYTHON_DU_VENV}\n`)
  } else {
    const vu = spawnSync(PYTHON_DU_VENV, ['-X', 'utf8', '-u', script, ...args], { stdio: 'inherit' })
    if (vu.error) throw vu.error
    process.exit(vu.status ?? 1)
  }
}
