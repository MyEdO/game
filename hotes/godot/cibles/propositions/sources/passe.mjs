// LA PASSE DES MAQUETTES (#4585) : chaque état de chaque écran `maquettes/<écran>.ts` rendu par `rendre.mjs` au
// format 16:9, sous un `RELEVE_CONTENUS` neuf, puis l'agrégat de `contenus.mjs` sur ce dossier. Sort en code 1 si un
// écran sort en erreur (code de `rendre.mjs` : erreur de page, relevé bloquant non vide, défilement de la page) ou si
// l'agrégat sort en 1 ; rend le bilan (écrans, états, écrans rouges) et laisse sous `<dossier>` les captures
// (`png/`), le journal de chaque écran (`log/`), le relevé (`contenus/`) et l'agrégat (`contenus.txt`) :
//   node passe.mjs [<dossier>]     `<dossier>` absent ou vide ; par défaut `dist/maquettes-passe`, vidé avant la passe
// Chaque `rendre.mjs` tourne sous les options de node de la passe (`process.execArgv`).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ICI = fileURLToPath(new URL('.', import.meta.url))
const MAQUETTES = join(ICI, 'maquettes')
const DEFAUT = fileURLToPath(new URL('../../../../../dist/maquettes-passe', import.meta.url))

const dossier = resolve(process.argv[2] ?? DEFAUT)
if (dossier === DEFAUT) rmSync(dossier, { recursive: true, force: true })
else if (existsSync(dossier) && readdirSync(dossier).length) throw new Error(`${dossier} : le dossier d'une passe est neuf`)
const contenus = join(dossier, 'contenus')
for (const d of ['png', 'log', 'contenus']) mkdirSync(join(dossier, d), { recursive: true })

/** Les écrans : chaque `maquettes/<écran>.ts` dont l'export par défaut porte des états, dans l'ordre des noms. */
const ecrans = []
for (const f of readdirSync(MAQUETTES).filter((f) => f.endsWith('.ts')).sort()) {
  const { default: ecran } = await import(pathToFileURL(join(MAQUETTES, f)).href)
  if (ecran?.etats) ecrans.push(f.slice(0, -3))
}

let etats = 0
const rouges = []
for (const ecran of ecrans) {
  const r = spawnSync(process.execPath, [...process.execArgv, join(ICI, 'rendre.mjs'), ecran, join(dossier, 'png', `${ecran}.png`), '--format', '16:9'],
    { env: { ...process.env, RELEVE_CONTENUS: contenus }, encoding: 'utf8', timeout: 200_000 })
  writeFileSync(join(dossier, 'log', `${ecran}.log`), `${r.stdout ?? ''}${r.stderr ?? ''}`)
  etats += (r.stdout ?? '').split('\n').filter((l) => l.startsWith('{')).length
  if (r.status !== 0) rouges.push(`${ecran} (code ${r.status ?? r.signal})`)
}
const agregat = spawnSync(process.execPath, [join(ICI, 'contenus.mjs'), contenus], { encoding: 'utf8' })
writeFileSync(join(dossier, 'contenus.txt'), `${agregat.stdout}${agregat.stderr}`)
console.log(`passe : ${ecrans.length} écrans, ${etats} états, ${rouges.length} écrans rouges${rouges.length ? ` : ${rouges.join(', ')}` : ''}`)
console.log(`agrégat des contenus : code ${agregat.status}, ${join(dossier, 'contenus.txt')}`)
process.exitCode = rouges.length || agregat.status !== 0 ? 1 : 0
