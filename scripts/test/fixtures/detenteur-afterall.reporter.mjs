import { writeFileSync } from 'node:fs';

const erreurs = valeurs => valeurs.map(({ name, message }) => ({ name, message }));
const chemin = valeur => valeur.replaceAll('\\', '/');

/** node_modules/vitest/dist/chunks/plugin.d.BsjqSb4-.d.ts:2126 */
export default class DetenteurAfterAllReporter {
  hooks = [];

  onHookStart({ name, entity }) {
    if (name !== 'afterAll') return;
    this.hooks.push({
      name,
      type: entity.type,
      owner: entity.type === 'module' ? null : entity.name,
      module: chemin(entity.type === 'module' ? entity.moduleId : entity.module.moduleId),
    });
  }

  onTestRunEnd(modules, unhandledErrors, reason) {
    const destination = process.env.WFRP_DETENTEUR_AFTERALL_RAPPORT;
    if (!destination) throw new Error('Rapport du cycle afterAll absent de l’environnement');
    const rapport = {
      version: 1,
      reason,
      errors: erreurs(unhandledErrors),
      hooks: this.hooks,
      modules: modules.map(module => ({
        module: chemin(module.moduleId),
        state: module.state(),
        errors: erreurs(module.errors()),
        tests: [...module.children.allTests()].map(test => ({
          name: test.name,
          state: test.result().state,
          mode: test.options.mode,
          fails: Boolean(test.options.fails),
          errors: erreurs(test.result().errors ?? []),
        })),
        suites: [...module.children.allSuites()].map(suite => ({
          name: suite.name,
          state: suite.state(),
          errors: erreurs(suite.errors()),
        })),
      })),
    };
    writeFileSync(destination, JSON.stringify(rapport), 'utf8');
  }
}
