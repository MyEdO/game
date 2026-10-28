// Environnement Python épinglé de la chaîne de production 3D (#2948) : un venv CPython hors de l'arbre, à la
// version du marqueur `python_version` de `requirements.txt`, rempli par `pip --require-hashes` depuis `requirements.txt`, puis la primitive demandée lancée dedans.
//
//   node scripts/personnage-3d/environnement.mjs                       installe (ou vérifie) l'environnement
//   node scripts/personnage-3d/environnement.mjs <script.py> [args…]   installe puis lance le script dans le venv
//
// Le venv se garde sous `CACHE`, keyé par l'empreinte de `requirements.txt` : une exigence changée en crée un neuf.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const EXIGENCES = join(ICI, 'requirements.txt')
const TEXTE_EXIGENCES = readFileSync(EXIGENCES, 'utf8')
const EMPREINTE = createHash('sha256').update(TEXTE_EXIGENCES).digest('hex').slice(0, 16)
/** La version de CPython exigée : le marqueur `python_version` de `requirements.txt`, sa seule source. */
export const PYTHON = TEXTE_EXIGENCES.match(/python_version\s*==\s*"(\d+\.\d+)"/)?.[1]
if (!PYTHON) throw new Error(`${EXIGENCES} : aucun marqueur python_version == "X.Y"`)

/** Le venv, hors de l'arbre, sur le patron du `CACHE` de `hotes/godot/construire.mjs`. */
const CACHE = join(homedir(), '.cache', 'wfrp-personnage-3d', EMPREINTE)
const WINDOWS = process.platform === 'win32'
const PYTHON_DU_VENV = WINDOWS ? join(CACHE, 'Scripts', 'python.exe') : join(CACHE, 'bin', 'python')
/** Posé après un `pip install` réussi : un venv sans lui est un venv inachevé, recréé. */
const TEMOIN = join(CACHE, 'installe.ok')

/** Les interpréteurs essayés, dans l'ordre ; le premier qui se déclare `PYTHON` gagne. */
const CANDIDATS = WINDOWS
  ? [['py', [`-${PYTHON}`]], [`python${PYTHON}`, []], ['python', []]]
  : [[`python${PYTHON}`, []], ['python3', []], ['python', []]]

export class PythonIntrouvable extends Error {
  constructor(essais) {
    super(`PythonIntrouvable : les roues de ${EXIGENCES} exigent CPython ${PYTHON} 64 bits. Installe-le `
      + `(Windows : https://www.python.org/downloads/ ou « winget install Python.Python.${PYTHON} » ; `
      + `Linux : paquets python${PYTHON} et python${PYTHON}-venv). Essayés : ${essais.join(' ; ')}`)
    this.name = 'PythonIntrouvable'
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

/** Le premier interpréteur `PYTHON` des `CANDIDATS`, ou `PythonIntrouvable`. */
export function pythonExige(candidats = CANDIDATS) {
  const essais = []
  for (const [commande, prefixe] of candidats) {
    const vu = spawnSync(commande, [...prefixe, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' })
    const version = vu.status === 0 ? vu.stdout.trim() : null
    essais.push(`${[commande, ...prefixe].join(' ')} → ${version ?? 'absent'}`)
    if (version === PYTHON) return [commande, prefixe]
  }
  throw new PythonIntrouvable(essais)
}

function installer() {
  if (existsSync(TEMOIN)) return
  const [commande, prefixe] = pythonExige()
  mkdirSync(dirname(CACHE), { recursive: true })
  executer(commande, [...prefixe, '-m', 'venv', '--clear', CACHE])
  executer(PYTHON_DU_VENV, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--require-hashes',
    '--only-binary', ':all:', '-r', EXIGENCES])
  writeFileSync(TEMOIN, `${EMPREINTE}\n`)
}

if (import.meta.main) {
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
