import type { TestScenario } from './_shared';
import { SCENARIOS } from './_registry.generated';

// Auto-découverte « dépose un fichier → intégré » via le registre généré (scripts/gen-registry.mjs).
// Ajouter un scénario = déposer un `<NN>-*.ts` exportant `scenario` ici, puis `npm run gen`
// (auto en dev via le plugin Vite). On passe par un index EXPLICITE généré plutôt que
// `import.meta.glob` (Vite-only, cassé sous tsx/Vitest) — même mécanique que les créatures.
export const testScenarios: TestScenario[] = [...SCENARIOS].sort((a, b) => a.order - b.order);
