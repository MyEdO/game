// Reporter Vitest des DURÉES par fichier (#2400) : environnement, préparation, collecte, setup et exécution de
// chaque module (`TestModule.diagnostic()`), et les workers SERVIS du lancement (#2497) : le `maxWorkers` résolu de
// la config (node_modules/vitest/dist/chunks/index.DpLw24bj.js:14431, lu par `resolveMaxWorkers` l.11849-11851),
// `null` sans lui, et les modules en ÉCHEC (`TestModule.state()`, index.DpLw24bj.js:19026). En JSON
// `{ workers, durees: { [chemin absolu]: ms }, echecs: [chemin absolu] }` sous `--outputFile.durees`. Lu par
// `scripts/test/perimetre.mjs`.
import { writeFileSync } from 'node:fs'

/** La durée d'un module de test : la somme des phases de son `diagnostic()`. PURE. */
export const dureeDuModule = ({ environmentSetupDuration, prepareDuration, collectDuration, setupDuration, duration }) =>
  environmentSetupDuration + prepareDuration + collectDuration + setupDuration + duration

/** Les durées `{ [chemin absolu]: ms }` des modules d'un run (`dureeDuModule`). PURE. */
export const dureesDesModules = (modules) => Object.fromEntries(modules.map((m) => [m.moduleId, dureeDuModule(m.diagnostic())]))

/** Les chemins absolus des modules d'un run à l'état `failed`. PURE. */
export const echecsDesModules = (modules) => modules.filter((m) => m.state() === 'failed').map((m) => m.moduleId)

export default class DureesVitest {
  onInit(vitest) {
    this.sortie = vitest.config.outputFile?.durees
    this.workers = vitest.config.maxWorkers ?? null
  }

  onTestRunEnd(modules) {
    if (this.sortie) writeFileSync(this.sortie, JSON.stringify({ workers: this.workers, durees: dureesDesModules(modules), echecs: echecsDesModules(modules) }))
  }
}
