import { describe, it, expect } from 'vitest';
import { resolveRender, resolveById, resolveSpecies, planById } from './bodyPlan';
import { bonesToSvg } from './renderBones';
import { MISSING_ART } from './viewArt';
import { defById } from './creatures';
import { isSwarm } from '../../engine/traits/dispatch';
import { creatures } from '../../data';

/**
 * `resolveRender` est 100% DATA-DRIVEN : l'espèce (un id slug) vient de l'argument explicite, sinon du
 * RECORD (`appearance.species`), sinon bipède Humain. Lookup EXACT `defById`, plus aucun match flou.
 */
describe('resolveRender — résolution de rendu 100% data-driven (par id d’espèce)', () => {
  it('espèce EXPLICITE → plan de la def (defById) ; Nuée → swarm ; sinon rig bipède', () => {
    for (const c of creatures) {
      const sp = c.appearance?.species;
      if (!sp) continue;
      const r = resolveRender(sp, c.traits, c.id);
      const d = defById(sp);
      const expected = isSwarm(c.traits) ? 'plan' : d && d.plan !== 'biped' ? 'plan' : 'rig';
      expect(r.kind, c.label).toBe(expected);
      if (r.kind === 'rig') expect(r.plan, c.label).toBe('biped');
    }
  });

  it('le REPLI par ID (sans espèce passée) lit le RECORD — identique à passer l’espèce du record', () => {
    for (const c of creatures) {
      const sp = c.appearance?.species;
      if (!sp) continue; // les Nuée sans espèce sont couvertes par le trait (cas suivant)
      expect(resolveById(c.id), c.label).toEqual(resolveRender(sp, c.traits, c.id));
    }
  });

  it('un ID d’espèce EXPLICITE (resolveSpecies) résout sans record (lookup EXACT defById, pas de fuzzy)', () => {
    // « varghulf » : def ailé SANS record creatures.json → résolu par l’id d’espèce explicite.
    expect(resolveSpecies('varghulf').plan).toBe(defById('varghulf')?.plan);
    expect(resolveSpecies('varghulf').plan).toBe('winged');
    // « liche » : def bipède sans record → espèce = l’id explicite (exact).
    expect(resolveSpecies('liche')).toMatchObject({ kind: 'rig', plan: 'biped', species: 'liche' });
  });

  it('une espèce HORS DOMAINE (libellé, rôle sans def) → corps d’erreur `manquant`, l’espèce conservée pour le diagnostic', () => {
    for (const n of ['Cultiste', 'Soldat', 'Rôle totalement inconnu xyz'])
      expect(resolveSpecies(n), n).toMatchObject({ kind: 'plan', plan: 'manquant', species: n });
    // Même porte pour l'espèce du RECORD et pour une entité à trait Nuée.
    expect(resolveRender('zzz', [{ id: 'nuee' }], undefined)).toMatchObject({ kind: 'plan', plan: 'manquant' });
  });

  it('une espèce JOUABLE (`species.json`) sans def rend en bipède', () => {
    expect(resolveSpecies('humains-reiklander')).toMatchObject({ kind: 'rig', plan: 'biped', species: 'humains-reiklander' });
  });

  it('une FORME DE NUÉE sans le trait Nuée → corps d’erreur ; avec le trait → swarm', () => {
    expect(resolveSpecies('rats')).toMatchObject({ kind: 'plan', plan: 'manquant', species: 'rats' });
    expect(resolveRender('rats', [{ id: 'nuee' }], undefined)).toMatchObject({ kind: 'plan', plan: 'swarm', species: 'rats' });
  });

  it('le gabarit `manquant` dessine la silhouette de repli visible (#223), dans toutes les vues', () => {
    for (const vue of ['front', 'profile', 'back'] as const)
      expect(bonesToSvg(planById('manquant').resolve('zzz', vue, {})), vue).toContain('M-22 -52 L22 -4');
    expect(MISSING_ART.profile!()).toContain('M-22 -52 L22 -4');
  });
});
