import { describe, expect, it } from 'vitest';
import { ecrituresDuNarratif, garderLaRacine } from './ecrituresJouees.testkit';
import { auChemin } from './lib/objet.mjs';
import { cheminsCreditesJoues } from '../scripts/guards/lib/editabiliteDesChamps.mjs';

/**
 * GARDE #841, racine NARRATIF (#4234) : tout champ du document `NarratifBlock` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDuNarratif`). La garde et sa règle :
 * `scripts/guards/lib/editabiliteDesChamps.mjs` ; ses preuves virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
describe('#4234 — chaque champ du narratif a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  // 360 = mesure du 2026-11-15 (#4234 : un champ requis à un seul littéral qui ne discrimine aucune union sort par son
  // type, `Parmi.pick`, `JokerDeDotation.wildcard`, `ApparenceDObjet.onHitEffects.on.pick`).
  const { ecritures } = garderLaRacine('narratif', ecrituresDuNarratif, { plancher: 360, delai: 190_000 });

  it('prouve le changement du repère sur la même valeur par un renommage offert', { timeout: 190_000 }, () => {
    const renommes = ecritures().filter((e) => e.renommage && e.chemin[e.chemin.length - 3] === 'reperes');
    const preuves = renommes.flatMap((e) => cheminsCreditesJoues([e]).filter(({ apres, chemin, temoin }) =>
      chemin[chemin.length - 1] === 'repere' && temoin &&
      auChemin(temoin.avant, temoin.chemin) === e.renommage?.avant &&
      auChemin(apres, chemin) === e.renommage?.apres));
    expect(preuves.length).toBeGreaterThan(0);
  });
});
