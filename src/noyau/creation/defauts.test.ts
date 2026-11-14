import { describe, it, expect, afterEach } from 'vitest';
import { fillDraftDefaults } from './defauts';
import { carrieresOffertes, newDraft, validateStep, stepIds, withCareer, withCoastalSwap, withSpecies } from './brouillon';
import { setRule, resetRule } from '../../engine/policy';
import { carrieresAleatoires, careers } from '../../data';
import { setDataset } from '../../data/overrides';
import { rangee } from '../../data/schemas/defs/carrieres-aleatoires';
import { t } from '../../i18n';

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

describe('la carrière du brouillon : celles qu’il offre, au remplacement près (MDG 09 l.9)', () => {
  const humain = (swap: boolean) => withCoastalSwap(withSpecies(newDraft(1), 'humains-reiklander'), swap);

  it('la validation refuse une carrière de la portion sans le remplacement, l’admet avec', () => {
    expect(validateStep(withCareer(humain(false), 'officier'), 'career')).toBe(t('crea.carriereHorsEspece'));
    expect(validateStep(withCareer(humain(true), 'officier'), 'career')).toBeNull();
  });

  it('le défaut de recette ne choisit jamais une carrière de la portion sans le remplacement', () => {
    // Colonne `humain` éditée au Codex : chaque rangée désigne une carrière rangée après les Côtiers dans `careers.json`.
    const imprimes = structuredClone([...carrieresAleatoires]);
    const tardive = careers.slice(careers.findIndex((c) => c.class.id === 'cotiers')).find((c) => c.class.id !== 'cotiers')!.id;
    try {
      setDataset('carrieresAleatoires', imprimes.map((d) => (d.id === 'humain' ? { ...d, entries: d.entries.map((r) => rangee.parse({ ...r, id: tardive })) } : d)));
      for (const swap of [false, true]) {
        const d = fillDraftDefaults(humain(swap), 'career');
        expect(carrieresOffertes(d).map((c) => c.id), `swap=${swap}`).toContain(d.careerId);
        expect(validateStep(d, 'career'), `swap=${swap}`).toBeNull();
      }
    } finally {
      setDataset('carrieresAleatoires', imprimes);
    }
  });
});
