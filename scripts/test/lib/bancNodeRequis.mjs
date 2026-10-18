import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks } from '../../agents/compat-core.mjs'
import { listerDossier } from '../../guards/lib/lister.mjs'

/** Les `.mjs` qu'un hook shell lance à côté de lui, `"$(dirname "$0")/<nom>.mjs"`. */
const modulesDuHook = (texte) => [...texte.matchAll(/"\$\(dirname "\$0"\)\/([\w-]+\.mjs)"/g)].map((m) => m[1])

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

const { scripts: SCRIPTS } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'))

/** Le dossier de hooks que `postinstall` déclare à git (`core.hooksPath`). */
const DOSSIER_HOOKS = join(RACINE, /core\.hooksPath (\S+)/.exec(SCRIPTS.postinstall)[1])

/** Les hooks shell : chaque fichier du dossier de hooks sans extension. */
const HOOKS_SHELL = listerDossier(DOSSIER_HOOKS).filter((f) => !f.includes('.'))

/** Les modules Node lancés sans hook shell : `npm run gates` et chaque pilote `merge.<nom>.driver` de
 *  `postinstall`. */
const PILOTES = [...new Set([...SCRIPTS.postinstall.matchAll(/merge\.[\w-]+\.driver "node (\S+)/g)].map((m) => m[1]))]

/** Les hooks d'agent : chaque commande des deux configurations, aplatie par le lecteur de la parité. */
const HOOKS_AGENT = [SURFACE_CLAUDE, SURFACE_CODEX].flatMap((surface) =>
  aplatirHooks(JSON.parse(readFileSync(join(RACINE, surface), 'utf8')), surface),
)

const MODULES_HOOKS_AGENT = [...new Set(HOOKS_AGENT.filter((h) => h.script).map((h) => `scripts/hooks/${h.script}`))]

/** Hook shell → les `.mjs` qu'il lance, relatifs à `RACINE`. */
const MODULES_PAR_HOOK = new Map(HOOKS_SHELL.map((hook) => [
  hook,
  modulesDuHook(readFileSync(join(DOSSIER_HOOKS, hook), 'utf8')).map((m) => relative(RACINE, join(DOSSIER_HOOKS, m)).replaceAll('\\', '/')),
]))

const MODULES_DES_HOOKS_SHELL = [...new Set([...MODULES_PAR_HOOK.values()].flat())]

const MODULES_LANCES = [/^node (\S+)/.exec(SCRIPTS.gates)[1], ...MODULES_DES_HOOKS_SHELL, ...PILOTES, ...MODULES_HOOKS_AGENT]

export { RACINE, SCRIPTS, DOSSIER_HOOKS, HOOKS_SHELL, PILOTES, HOOKS_AGENT, MODULES_HOOKS_AGENT, MODULES_PAR_HOOK, MODULES_LANCES }
