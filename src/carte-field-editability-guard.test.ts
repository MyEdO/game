import { describe, expect, it } from 'vitest';
import { ecrituresDeLaCarte, garderLaRacine } from './ecrituresJouees.testkit';
import { ALLER_RETOUR, cheminsCreditesJoues } from '../scripts/guards/lib/editabiliteDesChamps.mjs';

/**
 * GARDE #841, racine CARTE DU MONDE (#4234) : tout champ du document `WorldMap` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDeLaCarte`). La garde et sa règle :
 * `scripts/guards/lib/editabiliteDesChamps.mjs` ; ses preuves virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
describe('#4234 — chaque champ de la carte du monde a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  // #1615, mesure sur 2ab2f58ce et son correctif : 535 → 484. Le registre des Scènes de Round retire
  // les 51 clés de MassBattleSpec.sceneEncounters qui désignaient d’autres Activités.
  // #1468 : 1 293 champs après composition des trois algèbres et 135 opérations jouées par le pont.
  // Le rejeu des gestes et l’audit de la carte prennent ensemble 124 s sur War.
  const { audit, ecritures } = garderLaRacine('carte', ecrituresDeLaCarte, { plancher: 1_293, delai: 220_000 });

  it('prouve la saisie des entrées de vitesse, de couverture et de Scène de Round, et le seul ordre d’une montée', { timeout: 80_000 }, () => {
    for (const id of ['Omit.speed{}', 'MapPlace.couvre[]', 'MassBattleSpec.scenes[]']) {
      expect(audit().find((ligne) => ligne.id === id)?.authors, id).toContain(ALLER_RETOUR);
    }
    const montee = ecritures().find((e) => e.mouvement?.geste === 'monter' && e.chemin[e.chemin.length - 1] === 'modes')!;
    expect(montee, 'un mode est monté à son contrôle').toBeDefined();
    expect(cheminsCreditesJoues([montee]).map((e) => e.chemin)).toEqual([montee.chemin]);
  });

  it('joue le Test dans l’union du flux d’un effet programmé', { timeout: 80_000 }, () => {
    const dansLeFlux = ecritures().filter((e) => e.variante === 'kind' && e.valeur === 'test' &&
      e.chemin[e.chemin.length - 2] === 'flow' && e.chemin.includes('effects'));
    expect(cheminsCreditesJoues(dansLeFlux)).not.toEqual([]);
  });
});
