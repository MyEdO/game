import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { auditSceneFieldEditability, orphanFields, programmeDuPerimetre, RACINES } from '../scripts/guards/lib/sceneFieldEditability.mjs';
import { detenteur } from './lib/detenteur.testkit';
import { ecrituresDuNarratif } from './ecrituresJouees.testkit';

/**
 * GARDE #841, racine NARRATIF (#4234) : tout champ du document `NarratifBlock` s'écrit par l'éditeur Godot, méthode
 * `editer` du pont, ou par l'aller-retour qui la joue (`ecrituresDuNarratif`). La garde, sa règle et ses preuves
 * virtuelles : `src/scene-field-editability-guard.test.ts`.
 */
const ROOT = path.resolve(__dirname, '..');

describe('#4234 — chaque champ du narratif a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  const perimetre = detenteur(() => programmeDuPerimetre(ROOT, Object.values(RACINES)), (session) => session.dispose());
  const ecritures = detenteur(() => ecrituresDuNarratif());
  const audit = detenteur(() => auditSceneFieldEditability(ROOT, perimetre(), { racine: RACINES.narratif, ecrituresJouees: ecritures() }));

  it('aucun champ du narratif n’est orphelin', { timeout: 190_000 }, () => {
    const orphelins = orphanFields(audit());
    const detail = orphelins.map((r) => `${r.id} (${r.at}) — écrivains : ${r.pipeline.join(', ') || 'AUCUN'}`).join('\n');
    expect(orphelins.map((r) => r.id), detail).toEqual([]);
  });

  it('le périmètre du narratif ne s’effondre pas', { timeout: 190_000 }, () => {
    // 360 = mesure du 2026-11-15 (#4234 : un champ requis à un seul littéral qui ne discrimine aucune union sort par son
    // type, `Parmi.pick`, `JokerDeDotation.wildcard`, `ApparenceDObjet.onHitEffects.on.pick`).
    expect(audit().length, 'périmètre effondré').toBeGreaterThanOrEqual(360);
  });
});
