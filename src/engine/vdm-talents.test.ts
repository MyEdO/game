/**
 * Curation VDM des TALENTS (#734, chantier `chantier:VDM` #834) — preuves de CÂBLAGE, pas de témoins :
 * chaque assertion passe par le chemin réel du moteur (`effectiveEntry` → `talentTestSLBonus`), et
 * rougit si l'on débranche la variante, la règle qui la gate, ou la ligne « Tests » qu'elle republie.
 *
 * Périmètre PROUVÉ ici : la variante `magic-vdm-incantation` de *Concocter* (`VDM 12 l.411-421`).
 * Des 8 `Empreint de (Vent)` (`VDM 13 l.461-486`, ancre `NADJ 15 l.47-53` pour Ulgu), seule la ligne
 * « Tests » est câblée — par la règle universelle de +DR de Talent (`LDB 10 l.19`), dont
 * `talentTestSLBonus` est la source unique. L'aura de +DR à 8 mètres portée par un TALENT et la
 * substitution de Compétence (Focalisation du Vent) n'ont aucun canal (#874) ; `Assistant magique`
 * (`VDM 13 l.487-493`) n'a ni ligne « Tests » ni Soutien à +20 câblable.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { effectiveEntry, activeVariant } from './variants';
import { talentTestSLBonus } from './magic';
import { findTalentById } from '../data';
import type { Combatant } from './types';

const RULE = 'magic-vdm-incantation';
afterEach(() => resetRule(RULE));

function withTalents(ids: { talentId: string; times: number }[]): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: ids, movement: 4,
  } as unknown as Combatant;
}

describe('Concocter — variante « Règles d’incantation révisées » (VDM 12 l.411-421)', () => {
  const concocter = () => findTalentById('concocter')!;

  it('règle OFF : entrée LDB strictement inchangée (aucune variante active)', () => {
    const base = concocter() as unknown as { variants?: { when: { rule: string } }[] };
    expect(activeVariant(base.variants)).toBeUndefined();
    expect(effectiveEntry(concocter()).test?.raw).toBe('Savoir (Apothicaire)');
    expect(effectiveEntry(concocter()).source).toEqual({ book: 'livre-de-base', page: 135 });
  });

  it('règle ON : la ligne « Tests », la desc et l’ancre de source basculent sur la forme VDM', () => {
    setRule(RULE, true);
    const eff = effectiveEntry(concocter());
    expect(eff.test?.raw).toBe('Métier (Apothicaire) ou Métier (Alchimiste)');
    expect(eff.test?.matches).toEqual([
      { skill: { id: 'metier', spec: 'apothicaire' } },
      { skill: { id: 'metier', spec: 'alchimiste' } },
    ]);
    expect(eff.source).toEqual({ book: 'vents-de-la-magie', page: 161 });
    expect(eff.desc).toContain('Brasser une potion');
  });

  it('MORSURE — le +DR de Talent (LDB 10 l.19) change de Compétence avec la règle', () => {
    const c = withTalents([{ talentId: 'concocter', times: 1 }]);
    // OFF : le Talent bonifie Savoir (Apothicaire), pas Métier.
    expect(talentTestSLBonus(c, { skill: 'savoir', spec: 'apothicaire' })).toBe(1);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'apothicaire' })).toBe(0);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'alchimiste' })).toBe(0);
    setRule(RULE, true);
    // ON : il bonifie Métier (Apothicaire) ET Métier (Alchimiste), plus Savoir.
    expect(talentTestSLBonus(c, { skill: 'savoir', spec: 'apothicaire' })).toBe(0);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'apothicaire' })).toBe(1);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'alchimiste' })).toBe(1);
  });

  it('le +DR suit le nombre d’acquisitions sous la règle (×2 → +2 DR)', () => {
    const c = withTalents([{ talentId: 'concocter', times: 2 }]);
    setRule(RULE, true);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'alchimiste' })).toBe(2);
  });
});

describe('Empreint de (Vent) — 8 Talents, un par Vent (VDM 13 l.461-486)', () => {
  /**
   * Les 8 Vents, avec la ligne « Tests » VERBATIM de leur livre d'ancre et les `TestMatch` que la
   * curation en tire. Ce que le livre imprime, mot pour mot :
   *  - VDM 13 l.465 (les 7 neufs) : « **Tests :** Voir ci-dessous. »
   *  - NADJ 15 l.51 (`empreint-d-ulgu`, ancre du MÊME Talent) : « **Tests :** tout Test faisant
   *    appel à Discrétion » — pour un corps de texte identique à celui de VDM 13 l.485.
   * L'ancrage de la lecture des 7 renvois « Voir ci-dessous » tient à ces deux faits imprimés, plus
   * le contraste de la MÊME page 186 : *Assistant magique* (VDM 13 l.487-489) n'imprime AUCUNE ligne
   * « Tests » (assertion en fin de fichier), quand *Empreint de (Vent)* en imprime une.
   */
  const WINDS: { id: string; raw: string; matches: { skill: { id: string; spec?: string } }[] }[] = [
    { id: 'empreint-d-aqshy', raw: 'Voir ci-dessous.', matches: [] },
    { id: 'empreint-d-azyr', raw: 'Voir ci-dessous.', matches: [{ skill: { id: 'perception' } }] },
    { id: 'empreint-de-chamon', raw: 'Voir ci-dessous.', matches: [{ skill: { id: 'evaluation' } }] },
    { id: 'empreint-de-ghur', raw: 'Voir ci-dessous.', matches: [{ skill: { id: 'emprise-sur-les-animaux' } }, { skill: { id: 'savoir', spec: 'betes-sauvages' } }] },
    { id: 'empreint-de-ghyran', raw: 'Voir ci-dessous.', matches: [{ skill: { id: 'savoir', spec: 'herbes' } }, { skill: { id: 'savoir', spec: 'plantes' } }, { skill: { id: 'soin-aux-animaux' } }, { skill: { id: 'savoir', spec: 'animaux' } }] },
    { id: 'empreint-de-hysh', raw: 'Voir ci-dessous.', matches: [{ skill: { id: 'recherche' } }] },
    { id: 'empreint-de-shyish', raw: 'Voir ci-dessous.', matches: [{ skill: { id: 'intimidation' } }] },
    { id: 'empreint-d-ulgu', raw: 'Tout Test faisant appel à Discrétion', matches: [{ skill: { id: 'discretion' } }] },
  ];

  it('les 8 existent, Maxi 1, et les 7 neufs sont ancrés au folio 186 des Vents de Magie', () => {
    for (const { id } of WINDS) {
      const t = findTalentById(id);
      expect(t, id).toBeTruthy();
      expect(t!.max, id).toBe(1);
    }
    const vdm = WINDS.filter((w) => w.id !== 'empreint-d-ulgu');
    expect(vdm).toHaveLength(7);
    for (const { id } of vdm) {
      expect(findTalentById(id)!.source, id).toEqual({ book: 'vents-de-la-magie', page: 186 });
    }
  });

  it('Empreint d’Ulgu (NADJ 88) porte la republication VDM en emplacement SECONDAIRE, pas un doublon', () => {
    const ulgu = findTalentById('empreint-d-ulgu')! as unknown as { alsoIn?: { book: string; page: number }[] };
    expect(findTalentById('empreint-d-ulgu')!.source).toEqual({ book: 'nuits-agitees-et-dures-journees', page: 88 });
    expect(ulgu.alsoIn).toEqual([expect.objectContaining({ book: 'vents-de-la-magie', page: 186 })]);
  });

  it('ANCRAGE — la ligne « Tests » de chaque entrée est celle du livre, et les `matches` en dérivent', () => {
    for (const { id, raw, matches } of WINDS) {
      const t = findTalentById(id)!;
      expect(t.test?.raw, id).toBe(raw);
      expect(t.test?.matches, id).toEqual(matches);
    }
  });

  it('MORSURE — chaque Compétence désignée par la ligne « Tests » reçoit le +DR de Talent (LDB 10 l.19)', () => {
    for (const { id, matches } of WINDS) {
      const c = withTalents([{ talentId: id, times: 1 }]);
      for (const m of matches) expect(talentTestSLBonus(c, { skill: m.skill.id, spec: m.skill.spec }), `${id}/${m.skill.id}(${m.skill.spec ?? ''})`).toBe(1);
      expect(talentTestSLBonus(c, { skill: 'natation' }), id).toBe(0);
      // Une spec NON nommée par le livre ne reçoit rien (Ghur : Savoir (Bête), jamais tout Savoir).
      expect(talentTestSLBonus(c, { skill: 'savoir', spec: 'anatomie' }), id).toBe(0);
    }
  });
});

describe('Assistant magique — Talent de familier de pouvoir (VDM 13 l.487)', () => {
  it('existe, Maxi 1, ancré au folio 186, sans ligne « Tests »', () => {
    const t = findTalentById('assistant-magique')!;
    expect(t.max).toBe(1);
    expect(t.test).toBeNull();
    expect(t.source).toEqual({ book: 'vents-de-la-magie', page: 186 });
  });
});
