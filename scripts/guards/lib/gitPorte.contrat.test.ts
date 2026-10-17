// CONTRAT public de `gitPorte` (`gitPorte.d.mts`, #1806) : vérifié par `tsc --noEmit`
// (tsconfig.json, `include: scripts`) : une directive `@ts-expect-error` qui ne couvre plus
// d'erreur rougit le typecheck. Vitest ne le joue pas (vite.config.ts, `test.include`) ;
// la levée à l'exécution se teste dans `gitPorte.test.mjs`.
import { depotDe, fetchOrigin, pousser, racineDe } from './gitPorte.mjs';

racineDe(depotDe('/x'));
// @ts-expect-error — un littéral `{ cwd }` n'a pas la marque `MARQUE_DEPOT` : seul `depotDe` construit un dépôt.
racineDe({ cwd: '/x' });

pousser(depotDe('/x'), { vers: 'main' });
pousser(depotDe('/x'), { vers: 'main', bail: false });
pousser(depotDe('/x'), { vers: 'main', bail: '0123456789abcdef0123456789abcdef01234567' });
pousser(depotDe('/x'), { vers: 'main', bail: '' });
// @ts-expect-error — `true` ne désigne pas le SHA attendu par le bail.
pousser(depotDe('/x'), { vers: 'main', bail: true });

fetchOrigin(depotDe('/x'));
fetchOrigin(depotDe('/x'), { branche: 'main' });
fetchOrigin(depotDe('/x'), { objets: ['a'.repeat(40)] as readonly string[] });
// @ts-expect-error — les deux modes sont exclusifs.
fetchOrigin(depotDe('/x'), { branche: 'main', objets: ['a'.repeat(40)] });
// @ts-expect-error — un lot d'objets est un tableau.
fetchOrigin(depotDe('/x'), { objets: 'a'.repeat(40) });
