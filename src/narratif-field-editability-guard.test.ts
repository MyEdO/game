import { describe } from 'vitest';
import { ecrituresDuNarratif, garderLaRacine } from './ecrituresJouees.testkit';

/**
 * GARDE #841, racine NARRATIF (#4234) : tout champ du document `NarratifBlock` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDuNarratif`). La garde et sa règle :
 * `scripts/guards/lib/editabiliteDesChamps.mjs` ; ses preuves virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
describe('#4234 — chaque champ du narratif a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  // 360 = mesure du 2026-11-15 (#4234 : un champ requis à un seul littéral qui ne discrimine aucune union sort par son
  // type, `Parmi.pick`, `JokerDeDotation.wildcard`, `ApparenceDObjet.onHitEffects.on.pick`).
  garderLaRacine('narratif', ecrituresDuNarratif, { plancher: 360, delai: 190_000 });
});
