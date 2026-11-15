import { describe } from 'vitest';
import { ecrituresDeLaCarte, garderLaRacine } from './ecrituresJouees.testkit';

/**
 * GARDE #841, racine CARTE DU MONDE (#4234) : tout champ du document `WorldMap` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDeLaCarte`). La garde et sa règle :
 * `scripts/guards/lib/editabiliteDesChamps.mjs` ; ses preuves virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
describe('#4234 — chaque champ de la carte du monde a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  // 500 = mesure du 2026-11-15 (#4234 : `CustomStatblock.type` sort par son type ; `PetitePriere.type` et
  // `RoutePeril.effects.type`, discriminants d'une union, y entrent).
  garderLaRacine('carte', ecrituresDeLaCarte, { plancher: 500, delai: 80_000 });
});
