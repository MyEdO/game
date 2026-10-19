import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect } from 'vitest';
import { jetStepPresentable, witnessRowKey } from './CascadeModal';
import type { CascadeStep, CascadeTestStep } from '../noyau/pendings';
import type { Combatant } from '../engine/types';

/**
 * #P0-2 (recette d'écran 2026-07-10) : une étape-JET `worldOwner` (seam #275 Décision 3 — Test du
 * navire, `sea-salissures`) n'a AUCUN `actorId` par conception — le vieux garde
 * `if (!actor) return null` de `CascadeModal` rendait `null` pour TOUS les sièges, y compris l'owner
 * MJ (l'état disait « surfacé », l'écran ne montrait rien). `jetStepPresentable` est le prédicat
 * extrait qui remplace ce garde — testé ici en isolation (pas de harnais de rendu React dans ce repo).
 */
function baseStep(overrides: Partial<CascadeTestStep> = {}): CascadeStep {
  return { id: 's1', kind: 'sea-salissures', label: fixtureText('Salissures'), rollLabel: 'Endurance', target: 50, result: null, ...overrides };
}

describe('jetStepPresentable — présentabilité d’une étape-JET de cascade', () => {
  it('étape MONDIALE (`worldOwner`, aucun actorId) : PRÉSENTABLE malgré l’absence d’acteur', () => {
    const step = baseStep({ worldOwner: true, actorId: undefined });
    expect(jetStepPresentable(step, undefined)).toBe(true);
  });

  it('RÉGRESSION — étape À acteur (comportement historique) : présentable avec son acteur…', () => {
    const step = baseStep({ actorId: 'h1' });
    const actor = { id: 'h1', label: 'Aldo' } as Combatant;
    expect(jetStepPresentable(step, actor)).toBe(true);
  });

  it('…et NON présentable si son acteur est introuvable et l’étape n’est PAS mondiale (aucun repli silencieux)', () => {
    const step = baseStep({ actorId: 'orphan' });
    expect(jetStepPresentable(step, undefined)).toBe(false);
  });
});

/**
 * RÉGRESSION (re-recette maritime) : deux pas BATCH successifs aux MÊMES participants (Tests
 * d'Orientation PUIS d'Entretien, tenus par Capitaine/Timonier/Navigateur) — les rangées FIGÉES du
 * premier pas côtoient les rangées du second (courant ou bilan). Keyées par le seul id de participant,
 * elles collisionnaient (« two children with the same key mar-cap »). `witnessRowKey` scope la clé PAR
 * ÉTAPE : la duplication de clé (et l'artefact de rendu React qui en découlait) disparaît.
 */
describe('witnessRowKey — clés de rangée SCOPÉES par étape (anti-collision batch)', () => {
  const parts = ['mar-cap', 'mar-timo', 'mar-navi'];

  it('deux pas batch aux mêmes participants → clés TOUTES uniques', () => {
    const keys = [
      ...parts.map((p) => witnessRowKey('orientation', p)),
      ...parts.map((p) => witnessRowKey('entretien', p)),
    ];
    expect(new Set(keys).size).toBe(keys.length); // 6 clés distinctes, aucune collision
  });

  it('la clé porte l’étape ET le participant (pas d’ambiguïté entre pas)', () => {
    expect(witnessRowKey('orientation', 'mar-cap')).toBe('orientation:mar-cap');
    expect(witnessRowKey('entretien', 'mar-cap')).toBe('entretien:mar-cap');
    expect(witnessRowKey('orientation', 'mar-cap')).not.toBe(witnessRowKey('entretien', 'mar-cap'));
  });

  it('sans participant (pas MONO) : la clé est l’id d’étape nu (inchangé)', () => {
    expect(witnessRowKey('orientation')).toBe('orientation');
  });
});
