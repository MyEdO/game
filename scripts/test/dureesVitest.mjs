// Reporter Vitest des DURÉES par fichier (#2400) : environnement, préparation, collecte, setup et exécution de
// chaque module (`TestModule.diagnostic()`), en JSON `{ [chemin absolu]: ms }` sous `--outputFile.durees`. Lu
// par `scripts/test/perimetre.mjs`.
import { writeFileSync } from 'node:fs'

/** La durée d'un module de test : la somme des phases de son `diagnostic()`. PURE. */
export const dureeDuModule = ({ environmentSetupDuration, prepareDuration, collectDuration, setupDuration, duration }) =>
  environmentSetupDuration + prepareDuration + collectDuration + setupDuration + duration

/** Les durées `{ [chemin absolu]: ms }` des modules d'un run (`dureeDuModule`). PURE. */
export const dureesDesModules = (modules) => Object.fromEntries(modules.map((m) => [m.moduleId, dureeDuModule(m.diagnostic())]))

export default class DureesVitest {
  onInit(vitest) {
    this.sortie = vitest.config.outputFile?.durees
  }

  onTestRunEnd(modules) {
    if (this.sortie) writeFileSync(this.sortie, JSON.stringify(dureesDesModules(modules)))
  }
}
