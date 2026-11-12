import { describe, it, expect } from 'vitest';
import { axisScore, axesProfile, partyCoverage, dominantAxes, AXIS_QUALIFY_MIN } from './axes';
import { combattantDeTest } from './combattantDeTest.testkit';
import type { AxisData } from '../data';
import type { Combatant, SkillInstance } from './types';

/** Axes déclarés par la fixture : aucune lecture de `axes.json` ni de `pregens.json`. */
const axe = (id: string, champs: { skills?: { id: string; spec?: string }[]; talents?: { id: string }[] }): AxisData =>
  ({ id, label: id, ...champs }) as unknown as AxisData;
const MELEE = axe('melee', { skills: [{ id: 'corps-a-corps' }] });
const TIR = axe('tir', { skills: [{ id: 'projectiles' }] });
const NEGOCE = axe('negoce', { skills: [{ id: 'evaluation' }], talents: [{ id: 'negociateur' }] });

const competence = (id: string, advances: number): SkillInstance => ({ id, characteristic: 'capacite-de-combat', advances });
const porteur = (id: string, cc: number, skills: SkillInstance[] = [], talents: Combatant['talents'] = []): Combatant =>
  combattantDeTest({ id, characteristics: { 'capacite-de-combat': cc }, skills, talents });

describe('#3884 — axisScore : l\'INVESTISSEMENT qualifie, la Caractéristique pondère', () => {
  it('(a) haute Caractéristique SANS Augmentation sur l\'axe : score 0, non qualifié (Compétence de Base comprise)', () => {
    const nu = porteur('nu', 80);
    const sansAvance = porteur('sans-avance', 80, [competence('corps-a-corps', 0)]);
    for (const h of [nu, sansAvance]) {
      expect(axisScore(h, MELEE)).toBe(0);
      expect(dominantAxes(h, [MELEE], 1)).toEqual([]);
      expect(partyCoverage([h], [MELEE])[0].value).toBe(0);
    }
  });

  it('(b) Caractéristique moyenne avec Augmentations sur une Compétence de l\'axe : qualifié', () => {
    const forme = porteur('forme', 30, [competence('corps-a-corps', 5)]);
    expect(axisScore(forme, MELEE)).toBeGreaterThanOrEqual(AXIS_QUALIFY_MIN);
    expect(dominantAxes(forme, [MELEE], 1).map((a) => a.id)).toEqual(['melee']);
    expect(partyCoverage([forme], [MELEE])[0].porteurId).toBe('forme');
  });

  it('l\'investissement d\'une AUTRE Compétence ne qualifie pas l\'axe', () => {
    const archer = porteur('archer', 30, [competence('projectiles', 8)]);
    expect(axisScore(archer, MELEE)).toBe(0);
    expect(axisScore(archer, TIR)).toBeGreaterThanOrEqual(AXIS_QUALIFY_MIN);
  });

  it('la Caractéristique PONDÈRE : à investissement égal, plus haute ⇒ score plus haut ; jamais plus de 1', () => {
    const faible = axisScore(porteur('f', 20, [competence('corps-a-corps', 5)]), MELEE);
    const fort = axisScore(porteur('g', 70, [competence('corps-a-corps', 5)]), MELEE);
    expect(fort).toBeGreaterThan(faible);
    expect(axisScore(porteur('m', 95, [competence('corps-a-corps', 40)]), MELEE)).toBeLessThanOrEqual(1);
  });

  it('plus d\'Augmentations ⇒ score plus haut, à Caractéristique égale', () => {
    const peu = axisScore(porteur('p', 40, [competence('corps-a-corps', 3)]), MELEE);
    const beaucoup = axisScore(porteur('b', 40, [competence('corps-a-corps', 6)]), MELEE);
    expect(beaucoup).toBeGreaterThan(peu);
  });

  it('PROPRIÉTÉ du seuil : tout porteur sans Augmentation sur l\'axe est sous `AXIS_QUALIFY_MIN`, Talent de l\'axe compris', () => {
    const talentSeul = porteur('talent', 95, [], [{ talentId: 'negociateur', times: 4 }]);
    const score = axisScore(talentSeul, NEGOCE);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(AXIS_QUALIFY_MIN);
    expect(dominantAxes(talentSeul, [NEGOCE], 1)).toEqual([]);
  });

  it('un Talent de l\'axe BONIFIE l\'investissement sans jamais déborder 1', () => {
    const sans = porteur('s', 40, [competence('evaluation', 5)]);
    const avec = porteur('a', 40, [competence('evaluation', 40)], [{ talentId: 'negociateur', times: 5 }]);
    expect(axisScore(avec, NEGOCE)).toBeGreaterThan(axisScore(sans, NEGOCE));
    expect(axisScore(avec, NEGOCE)).toBeLessThanOrEqual(1);
  });
});

describe('#409 — axesProfile / partyCoverage / dominantAxes', () => {
  const soldat = porteur('soldat', 40, [competence('corps-a-corps', 8)]);
  const novice = porteur('novice', 60);

  it('axesProfile : un score par axe, dans l\'ordre de la liste fournie', () => {
    const profile = axesProfile(soldat, [MELEE, TIR, NEGOCE]);
    expect(profile.map((p) => p.id)).toEqual(['melee', 'tir', 'negoce']);
    expect(profile.every((p) => p.value >= 0 && p.value <= 1)).toBe(true);
  });

  it('partyCoverage : agrégat MAX par axe, porteur = le premier meilleur à égalité', () => {
    const jumeau = { ...soldat, id: 'jumeau' };
    const [melee] = partyCoverage([novice, soldat, jumeau], [MELEE]);
    expect(melee.value).toBe(axisScore(soldat, MELEE));
    expect(melee.porteurId).toBe('soldat');
  });

  it('partyCoverage : sans investissement dans le groupe, l\'axe reste « à pourvoir » (0, aucun porteur)', () => {
    const [melee] = partyCoverage([novice], [MELEE]);
    expect(melee).toEqual({ id: 'melee', label: 'melee', value: 0 });
  });

  it('dominantAxes : triés décroissant, jamais sous le seuil, tronqués à N', () => {
    const polyvalent = porteur('poly', 40, [competence('corps-a-corps', 8), competence('projectiles', 6), competence('evaluation', 5)]);
    const dom = dominantAxes(polyvalent, [MELEE, TIR, NEGOCE], 2);
    expect(dom).toHaveLength(2);
    for (const a of dom) expect(a.value).toBeGreaterThanOrEqual(AXIS_QUALIFY_MIN);
    expect(dom.map((a) => a.value)).toEqual([...dom.map((a) => a.value)].sort((x, y) => y - x));
  });

  it('FRONTIÈRE `AXIS_QUALIFY_MIN` : le pondérateur plancher (CC 15) qualifie à 5 Augmentations, pas à 4', () => {
    expect(axisScore(porteur('cinq', 15, [competence('corps-a-corps', 5)]), MELEE)).toBeGreaterThanOrEqual(AXIS_QUALIFY_MIN);
    const quatre = porteur('quatre', 15, [competence('corps-a-corps', 4)]);
    expect(axisScore(quatre, MELEE)).toBeLessThan(AXIS_QUALIFY_MIN);
    expect(dominantAxes(quatre, [MELEE], 1)).toEqual([]);
  });
});
