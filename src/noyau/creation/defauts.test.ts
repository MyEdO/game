import { describe, it, expect, afterEach } from 'vitest';
import { fillDraftDefaults } from './defauts';
import { newDraft, validateStep, stepIds } from './brouillon';
import { setRule, resetRule } from '../../engine/policy';

describe('fillDraftDefaults (#518 — recette DEV)', () => {
  afterEach(() => resetRule('creation-signes-astraux'));

  it('produit un brouillon VALIDE à chaque étape ≤ upto, pour chaque étape de stepIds()', () => {
    for (const upto of stepIds()) {
      const d = fillDraftDefaults(newDraft(4242), upto);
      for (const s of stepIds()) {
        if (stepIds().indexOf(s) > stepIds().indexOf(upto)) continue;
        expect(validateStep(d, s), `étape « ${s} » (upto « ${upto} »)`).toBeNull();
      }
    }
  });

  it('avec la règle optionnelle "creation-signes-astraux" active — même invariant, étape star comprise', () => {
    setRule('creation-signes-astraux', true);
    expect(stepIds()).toContain('star');
    for (const upto of stepIds()) {
      const d = fillDraftDefaults(newDraft(777), upto);
      for (const s of stepIds()) {
        if (stepIds().indexOf(s) > stepIds().indexOf(upto)) continue;
        expect(validateStep(d, s), `étape « ${s} » (upto « ${upto} »)`).toBeNull();
      }
    }
  });

  it('est IDEMPOTENT : ré-appliquer sur un brouillon déjà rempli ne casse pas la validité', () => {
    const once = fillDraftDefaults(newDraft(99), 'presentation');
    const twice = fillDraftDefaults(once, 'presentation');
    for (const s of stepIds()) expect(validateStep(twice, s)).toBeNull();
  });

  it('ne pré-tire rien au-delà de `upto` (étape "career" laisse chars non tiré)', () => {
    const d = fillDraftDefaults(newDraft(55), 'career');
    expect(d.charsRolled).toBeFalsy();
  });
});
