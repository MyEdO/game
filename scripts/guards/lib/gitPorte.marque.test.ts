// MARQUE du DÉPÔT (#1806) : un `{ cwd }` écrit à la main n'est pas un `Depot` (`gitPorte.d.mts`,
// `MARQUE_DEPOT`). Vérifié par `tsc --noEmit` (tsconfig.json, `include: scripts`) : une directive
// `@ts-expect-error` qui ne couvre plus d'erreur rougit le typecheck. Vitest ne le joue pas
// (vite.config.ts, `test.include`) ; la levée à l'exécution se teste dans `gitPorte.test.mjs`.
import { depotDe, racineDe } from './gitPorte.mjs';

racineDe(depotDe('/x'));
// @ts-expect-error — un littéral `{ cwd }` n'a pas la marque `MARQUE_DEPOT` : seul `depotDe` construit un dépôt.
racineDe({ cwd: '/x' });
