import { describe } from 'vitest';
import { ecrituresDeLaCarte, garderLaRacine } from './ecrituresJouees.testkit';

/**
 * GARDE #841, racine CARTE DU MONDE (#4234) : tout champ du document `WorldMap` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDeLaCarte`). La garde et sa règle :
 * `scripts/guards/lib/editabiliteDesChamps.mjs` ; ses preuves virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
describe('#4234 — chaque champ de la carte du monde a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  // #1615, mesure sur 2ab2f58ce et son correctif : 535 → 484. Le registre des Scènes de Round retire
  // les 51 clés de MassBattleSpec.sceneEncounters qui désignaient d’autres Activités.
  garderLaRacine('carte', ecrituresDeLaCarte, { plancher: 484, delai: 80_000 });
});
