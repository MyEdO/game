import { describe, it, expect, afterEach } from 'vitest';
import { parsePsychTraits, peurTerreurFromSize, resolvePeurTest, resolveTerreurTest, isFrenzyCapable, resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple, gainPhobieIfThreshold, animositeOrHaine, traumaOnImpossibleAmbition, effectivePsychTraits, calmeValue } from './psychology';
import { makeRNG } from './dice';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { deFixe } from './dice.testkit';

describe('Psychologie (pur)', () => {
  it('parsePsychTraits : « Peur N » / « Terreur N » / Immunité', () => {
    expect(parsePsychTraits([{ id: 'peur', value: 4 }, { id: 'arme', value: 7 }])).toEqual({ causesPeur: 4 });
    expect(parsePsychTraits([{ id: 'terreur', value: 3 }])).toEqual({ causesTerreur: 3 });
    expect(parsePsychTraits([{ id: 'immunite-psychologique' }])).toEqual({ psychImmune: true });
    expect(parsePsychTraits([{ id: 'arme', value: 7 }])).toEqual({});
  });
  it('parsePsychTraits : traits ciblés → psychTraits (Cible = id de Groupe reconnu, sinon inerte)', () => {
    const r = parsePsychTraits([{ id: 'animosite', arg: 'elfe' }, { id: 'haine', arg: 'skaven' }, { id: 'prejuge', arg: 'nain' }, { id: 'amour', arg: 'Famille' }, { id: 'camaraderie', arg: 'soldat' }, { id: 'phobie', arg: 'Araignées' }]);
    expect(r.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'elfe' },
      { type: 'haine', cible: 'skaven' },
      { type: 'prejuge', cible: 'nain' },
      { type: 'amour', cible: undefined }, // « Famille » n'est pas un id de Groupe (groups.json) → inerte
      { type: 'camaraderie', cible: 'soldat' },
      { type: 'phobie', cible: undefined, indice: 1 }, // « Araignées » non plus (Phobie = Peur 1 sur la source, LDB 21 l.85-87)
    ]));
  });
  it('parsePsychTraits : « un au choix » → Cible indéfinie (inerte)', () => {
    expect(parsePsychTraits([{ id: 'animosite', arg: 'un au choix' }]).psychTraits).toEqual([{ type: 'animosite', cible: undefined }]);
  });
  it('peurTerreurFromSize : écart ≥1 → Peur ; ≥2 → Terreur (Indice = écart)', () => {
    expect(peurTerreurFromSize('grande', 'moyenne')).toEqual({ kind: 'peur', indice: 1 });
    expect(peurTerreurFromSize('enorme', 'moyenne')).toEqual({ kind: 'terreur', indice: 2 });
    expect(peurTerreurFromSize('moyenne', 'moyenne')).toBeNull();
    expect(peurTerreurFromSize('petite', 'grande')).toBeNull(); // plus petit ne fait pas peur
  });
  it('resolvePeurTest : cumule le DR jusqu’à l’Indice (vaincue)', () => {
    const r = resolvePeurTest(80, 2, 0, makeRNG(2));
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(typeof r.calmeDR).toBe('number');
    expect(r.calmeDR >= 2).toBe(r.vaincue); // vaincue ⟺ DR cumulé ≥ Indice
  });
  it('resolveTerreurTest : échec → Brisé = Indice + |DR négatifs| ; devient Peur', () => {
    const r = resolveTerreurTest(1, 3, makeRNG(2)); // FM 1 → échec quasi sûr
    if (!r.success) expect(r.brise).toBeGreaterThanOrEqual(3);
    expect(r.devientPeur).toBe(3);
  });
  it('isFrenzyCapable : trait OU talent « Frénésie »', () => {
    expect(isFrenzyCapable({ traits: [{ id: 'frenesie' }], talents: [] } as unknown as Combatant)).toBe(true);
    expect(isFrenzyCapable({ traits: [], talents: [{ talentId: 'frenesie', times: 1 }] } as unknown as Combatant)).toBe(true);
    expect(isFrenzyCapable({ traits: [{ id: 'arme', value: 7 }], talents: [] } as unknown as Combatant)).toBe(false);
  });
  it('resolveFrenzyEntry : Test de FM, succès = entre', () => {
    const r = resolveFrenzyEntry(80, makeRNG(2));
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
    expect(r.target).toBe(80); // cible exposée pour la RollLine : FM, Intermédiaire +0
  });
  it('targetedTrigger : Animosité (elfe) se déclenche sur un ENNEMI du groupe elfe visible', () => {
    const self = { id: 's', kind: 'enemy', psychTraits: [{ type: 'animosite', cible: 'elfe' }], psychState: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'hero', groups: ['elfe', 'soldat'] } as unknown as Combatant;
    const other = { id: 'o', kind: 'hero', groups: ['humain'] } as unknown as Combatant;
    expect(targetedTrigger(self, [other, foe])).toEqual({ type: 'animosite', cible: 'elfe', sourceId: 'f' });
    expect(targetedTrigger(self, [other])).toBeNull(); // aucun membre du groupe visible
  });
  it('targetedTrigger : Amour se déclenche sur un membre du groupe MENACÉ (LDB 21 l.75) ; déjà en psychState → pas re-déclenché', () => {
    const self = { id: 's', kind: 'hero', psychTraits: [{ type: 'amour', cible: 'Famille' }], psychState: [] } as unknown as Combatant;
    const ally = { id: 'a', kind: 'hero', groups: ['Famille'] } as unknown as Combatant;
    const brigand = { id: 'b', kind: 'enemy' } as unknown as Combatant;
    expect(targetedTrigger(self, [ally])).toBeNull(); // aimé présent mais non menacé
    expect(targetedTrigger(self, [ally, brigand])?.type).toBe('amour');
    (self.psychState as { type: string; cible: string }[]).push({ type: 'amour', cible: 'Famille' });
    expect(targetedTrigger(self, [ally, brigand])).toBeNull();
  });
  it('targetedTrigger : « un au choix » (Cible indéfinie) → inerte', () => {
    const self = { id: 's', kind: 'enemy', psychTraits: [{ type: 'animosite', cible: undefined }], psychState: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'hero', groups: ['Elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [foe])).toBeNull();
  });
  it('effectivePsychTraits : « Vous êtes mon meilleur ami ! » (ignoreAnimosity) retire Animosité/Préjugé, laisse le reste (LDB 09 l.480)', () => {
    const c = {
      psychTraits: [{ type: 'animosite', cible: 'elfe' }, { type: 'prejuge', cible: 'nain' }, { type: 'haine', cible: 'skaven' }],
      activeEffects: [{ label: 'Ivresse', bonus: 0, ignoreAnimosity: true }],
    } as unknown as Combatant;
    expect(effectivePsychTraits(c)).toEqual([{ type: 'haine', cible: 'skaven' }]);
  });
  it('effectivePsychTraits : sans l’effet actif, Animosité/Préjugé restent', () => {
    const c = { psychTraits: [{ type: 'animosite', cible: 'elfe' }] } as unknown as Combatant;
    expect(effectivePsychTraits(c)).toEqual([{ type: 'animosite', cible: 'elfe' }]);
  });
  it('targetedTrigger : sous ignoreAnimosity, l’Animosité ne se déclenche PAS sur un ennemi visible du groupe cible', () => {
    const self = {
      id: 's', kind: 'enemy',
      psychTraits: [{ type: 'animosite', cible: 'elfe' }],
      psychState: [],
      activeEffects: [{ label: 'Ivresse', bonus: 0, ignoreAnimosity: true }],
    } as unknown as Combatant;
    const foe = { id: 'f', kind: 'hero', groups: ['elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [foe])).toBeNull();
  });
  it('targetedTrigger : effet EXPIRÉ (retiré des activeEffects) → l’Animosité redéclenche normalement', () => {
    const self = { id: 's', kind: 'enemy', psychTraits: [{ type: 'animosite', cible: 'elfe' }], psychState: [], activeEffects: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'hero', groups: ['elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [foe])).toEqual({ type: 'animosite', cible: 'elfe', sourceId: 'f' });
  });
  it('resolveCalmeSimple : Test de Calme binaire (succès = résisté)', () => {
    const r = resolveCalmeSimple(80, makeRNG(2));
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
  });
});

describe('Acquisition de Traits psychologiques (ADE II Annexe I, règle FACULTATIVE)', () => {
  // RNG fixe (un d100 constant) — fail (roll 100) / success (roll 1), déterministe.
  const fixed = deFixe;
  const mk = (p: Partial<Combatant> = {}): Combatant => ({
    id: 's', name: 'S', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    skills: [], talents: [], psychTraits: [], psychState: [], traits: [], groups: [],
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, armour: {} as never, weapons: [],
    ...p,
  } as unknown as Combatant);

  afterEach(() => resetRule('psych-acquisition-optional'));

  it('toutes les fonctions sont INERTES (null) tant que la règle est éteinte (défaut)', () => {
    const c = mk();
    expect(gainPhobieIfThreshold(c, 99, 'mort-vivant')).toBeNull();
    expect(animositeOrHaine(c, 'skaven', fixed(100))).toBeNull();
    expect(traumaOnImpossibleAmbition(c, fixed(100))).toBeNull();
  });

  it('Phobie du noir : Brisé(Terreur) cumulés ≥ BFM → Phobie liée à la cause (+ reset)', () => {
    setRule('psych-acquisition-optional', true);
    const c = mk(); // FM 35 → BFM 3
    expect(gainPhobieIfThreshold(c, 2, 'mort-vivant')).toBeNull(); // sous le seuil
    expect(gainPhobieIfThreshold(c, 3, 'mort-vivant')).toEqual({ phobie: { type: 'phobie', cible: 'mort-vivant', indice: 1 }, resetCounter: true });
  });

  it('Phobie du noir : une source sans Groupe → aucune Phobie, seuil atteint ou non', () => {
    setRule('psych-acquisition-optional', true);
    expect(gainPhobieIfThreshold(mk(), 3, undefined)).toBeNull();
  });

  it('Animosité & Haine : Calme raté → Animosité ; doublon → Haine ; réussite → rien', () => {
    setRule('psych-acquisition-optional', true);
    const fresh = mk();
    expect(animositeOrHaine(fresh, 'soldat', fixed(100))).toMatchObject({ trait: { type: 'animosite', cible: 'soldat' }, replacesAnimosite: false });
    const dup = mk({ psychTraits: [{ type: 'animosite', cible: 'soldat' }] });
    expect(animositeOrHaine(dup, 'soldat', fixed(100))).toMatchObject({ trait: { type: 'haine', cible: 'soldat' }, replacesAnimosite: true });
    expect(animositeOrHaine(fresh, undefined, fixed(100))).toBeNull(); // aucune Cible dérivée → aucun Trait
    const ok = animositeOrHaine(mk(), 'soldat', fixed(1)); // Calme réussi
    expect(ok!.test.success).toBe(true);
    expect(ok!.trait).toBeUndefined();
  });

  it('Trauma : Ambition rendue impossible → Calme Accessible raté → Trauma ; réussite → rien', () => {
    setRule('psych-acquisition-optional', true);
    expect(traumaOnImpossibleAmbition(mk(), fixed(100))).toMatchObject({ trait: { type: 'trauma' } });
    const ok = traumaOnImpossibleAmbition(mk(), fixed(1));
    expect(ok!.test.success).toBe(true);
    expect(ok!.trait).toBeUndefined();
  });
});

describe('Valeur de Calme : la valeur de Test, États compris (LDB 16 l.125)', () => {
  it('Sonné ×3 retire 30 à la Force Mentale plus les avances de Calme', () => {
    const c = { id: 'c', kind: 'enemy', characteristics: { 'force-mentale': 50 }, skills: [{ id: 'calme', advances: 10 }], talents: [], traits: [], conditions: [], items: [], weapons: [] } as unknown as Combatant;
    expect(calmeValue(c)).toBe(60);
    c.conditions = [{ id: 'sonne', value: 3 }];
    expect(calmeValue(c)).toBe(30);
  });
});
