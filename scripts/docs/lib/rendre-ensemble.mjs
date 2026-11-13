// scripts/docs/lib/rendre-ensemble.mjs — joue dans CE processus le `rendre()` de chaque générateur de `GENERATORS`
// nommé par `process.argv` (son `script`), sans rien écrire, et imprime leurs rendus (`[script, [cible, texte][]][]`,
// JSON) sur stdout : le rendu qu'un générateur lit d'un autre (`rendreCible`) s'y calcule une fois (`renduDe`,
// scripts/docs/build-all.mjs). Point d'entrée du rendu des générateurs `node`, sur l'hôte et sous win32, par
// `rendusEnProcessus` (scripts/corpus/docs/manual-docs-ratchet.test.mjs).
import { GENERATORS, renduDe } from '../build-all.mjs'

const rendus = []
for (const script of process.argv.slice(2)) {
  const g = GENERATORS.find((x) => x.script === script)
  if (!g) throw new Error(`rendre-ensemble : ${script} n'est pas un générateur de GENERATORS`)
  rendus.push([script, [...(await renduDe(g))]])
}
process.stdout.write(JSON.stringify(rendus))
