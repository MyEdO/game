import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { auditSceneFieldEditability, orphanFields, programmeDuPerimetre, RACINES } from '../scripts/guards/lib/sceneFieldEditability.mjs';
import { detenteur } from './lib/detenteur.testkit';
import { ecrituresDeLaCarte } from './ecrituresJouees.testkit';

/**
 * GARDE #841, racine CARTE DU MONDE (#4234) : tout champ du document `WorldMap` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDeLaCarte`). La garde, sa règle et ses preuves
 * virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
const ROOT = path.resolve(__dirname, '..');

describe('#4234 — chaque champ de la carte du monde a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  const perimetre = detenteur(() => programmeDuPerimetre(ROOT, Object.values(RACINES)), (session) => session.dispose());
  const ecritures = detenteur(() => ecrituresDeLaCarte());
  const audit = detenteur(() => auditSceneFieldEditability(ROOT, perimetre(), { racine: RACINES.carte, ecrituresJouees: ecritures() }));

  it('aucun champ de la carte n’est orphelin', { timeout: 80_000 }, () => {
    const orphelins = orphanFields(audit());
    const detail = orphelins.map((r) => `${r.id} (${r.at}) — écrivains : ${r.pipeline.join(', ') || 'AUCUN'}`).join('\n');
    expect(orphelins.map((r) => r.id), detail).toEqual([]);
  });

  it('le périmètre de la carte ne s’effondre pas', { timeout: 80_000 }, () => {
    // 500 = mesure du 2026-11-15 (#4234 : `CustomStatblock.type` sort par son type ; `PetitePriere.type` et
    // `RoutePeril.effects.type`, discriminants d'une union, y entrent).
    expect(audit().length, 'périmètre effondré').toBeGreaterThanOrEqual(500);
  });
});
