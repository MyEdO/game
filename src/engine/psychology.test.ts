import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect, afterEach } from 'vitest';
import {
  parsePsychTraits,
  peurTerreurFromSize,
  pasDePeur,
  psychBranchOps,
  isFrenzyCapable,
  resolveFrenzyEntry,
  targetedTrigger,
  resolveCalmeSimple,
  calmeDeLAnimositeAcquise,
  traumaOnImpossibleAmbition,
  effectivePsychTraits,
  calmeValue,
  sourceCombattant,
} from './psychology';
import { makeRNG } from './dice';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { applyOps } from './ops';
import { deFixe } from './dice.testkit';
import { ciblePsy } from './psych/ciblage';
import { blessuresSurLeProfil, blessuresDeBase, combattantDeTest } from './combattantDeTest.testkit';

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
      { type: 'animosite', cible: ciblePsy.groupe('elfe') },
      { type: 'haine', cible: ciblePsy.groupe('skaven') },
      { type: 'prejuge', cible: ciblePsy.groupe('nain') },
      { type: 'amour', cible: undefined }, // « Famille » n'est pas un id de Groupe (groups.json) → inerte
      { type: 'camaraderie', cible: ciblePsy.groupe('soldat') },
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
  it('pasDePeur : cumule le DR jusqu’à l’Indice (surmontée), LDB 21 l.25', () => {
    expect(pasDePeur(0, { success: true, sl: 1 }, 2)).toEqual({ calmeDR: 1, surmontee: false });
    expect(pasDePeur(1, { success: true, sl: 1 }, 2)).toEqual({ calmeDR: 2, surmontee: true });
    expect(pasDePeur(1, { success: false, sl: -3 }, 2)).toEqual({ calmeDR: 0, surmontee: false });
  });
  it('Terreur ratée : Brisé = Indice + |DR négatifs| ; la Peur héritée n’est pas surmontée, LDB 21 l.54-56', () => {
    const c = blessuresSurLeProfil({
      id: 'c', label: 'c', kind: 'heros', characteristics: { 'force-mentale': 30 }, skills: [], talents: [], psychTraits: [], psychState: [], traits: [], groups: [],
      wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4, armour: {} as never, weapons: [],
    }) as unknown as Combatant;
    applyOps(c, psychBranchOps({ kind: 'terreur', sourceId: 'o', indice: 3 }, { success: false }), { idNeuf: idsDeTest, rng: makeRNG(2), sl: -2 });
    expect(c.conditions.find((k) => k.id === 'brise')?.value).toBe(5);
    expect(c.psychState).toEqual([{ type: 'peur', sourceId: 'o', indice: 3, calmeDR: 0, surmontee: false }]);
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
    const self = { id: 's', kind: 'ennemi', psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }], psychState: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'heros', groups: ['elfe', 'soldat'] } as unknown as Combatant;
    const other = { id: 'o', kind: 'heros', groups: ['humain'] } as unknown as Combatant;
    expect(targetedTrigger(self, [other, foe].map(sourceCombattant))).toEqual({ type: 'animosite', cible: ciblePsy.groupe('elfe'), sourceId: 'f' });
    expect(targetedTrigger(self, [sourceCombattant(other)])).toBeNull(); // aucun membre du groupe visible
  });
  it('targetedTrigger : Amour se déclenche sur un membre du groupe MENACÉ (LDB 21 l.75) ; déjà en psychState → pas re-déclenché', () => {
    const self = { id: 's', kind: 'heros', psychTraits: [{ type: 'amour', cible: ciblePsy.groupe('humain') }], psychState: [] } as unknown as Combatant;
    const ally = { id: 'a', kind: 'heros', groups: ['humain'] } as unknown as Combatant;
    const brigand = { id: 'b', kind: 'ennemi' } as unknown as Combatant;
    expect(targetedTrigger(self, [sourceCombattant(ally)])).toBeNull(); // aimé présent mais non menacé
    expect(targetedTrigger(self, [ally, brigand].map(sourceCombattant))?.type).toBe('amour');
    self.psychState!.push({ type: 'amour', cible: ciblePsy.groupe('humain') });
    expect(targetedTrigger(self, [ally, brigand].map(sourceCombattant))).toBeNull();
  });
  it('targetedTrigger : « un au choix » (Cible indéfinie) → inerte', () => {
    const self = { id: 's', kind: 'ennemi', psychTraits: [{ type: 'animosite', cible: undefined }], psychState: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'heros', groups: ['elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [sourceCombattant(foe)])).toBeNull();
  });
  it('effectivePsychTraits : « Vous êtes mon meilleur ami ! » (ignoreAnimosity) retire Animosité/Préjugé, laisse le reste (LDB 09 l.480)', () => {
    const c = {
      psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }, { type: 'prejuge', cible: ciblePsy.groupe('nain') }, { type: 'haine', cible: ciblePsy.groupe('skaven') }],
      activeEffects: [{ label: 'Ivresse', bonus: 0, ignoreAnimosity: true }],
    } as unknown as Combatant;
    expect(effectivePsychTraits(c)).toEqual([{ type: 'haine', cible: ciblePsy.groupe('skaven') }]);
  });
  it('effectivePsychTraits : sans l’effet actif, Animosité/Préjugé restent', () => {
    const c = { psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] } as unknown as Combatant;
    expect(effectivePsychTraits(c)).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('elfe') }]);
  });
  it('targetedTrigger : sous ignoreAnimosity, l’Animosité ne se déclenche PAS sur un ennemi visible du groupe cible', () => {
    const self = {
      id: 's', kind: 'ennemi',
      psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }],
      psychState: [],
      activeEffects: [{ label: 'Ivresse', bonus: 0, ignoreAnimosity: true }],
    } as unknown as Combatant;
    const foe = { id: 'f', kind: 'heros', groups: ['elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [sourceCombattant(foe)])).toBeNull();
  });
  it('targetedTrigger : effet EXPIRÉ (retiré des activeEffects) → l’Animosité redéclenche normalement', () => {
    const self = { id: 's', kind: 'ennemi', psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }], psychState: [], activeEffects: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'heros', groups: ['elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [sourceCombattant(foe)])).toEqual({ type: 'animosite', cible: ciblePsy.groupe('elfe'), sourceId: 'f' });
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
  const mk = (p: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
    id: 's', name: 'S', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    skills: [], talents: [], psychTraits: [], psychState: [], traits: [], groups: [],
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4, armour: {} as never, weapons: [],
    ...p,
  }) as unknown as Combatant);

  afterEach(() => resetRule('psycho-acquisition-optionnelle'));

  it('toutes les fonctions sont INERTES tant que la règle est éteinte (défaut)', () => {
    const c = mk();
    expect(calmeDeLAnimositeAcquise(c, fixed(100))).toBeNull();
    expect(traumaOnImpossibleAmbition(c, fixed(100))).toBeNull();
  });

  it('Animosité acquise : Test de Calme Intermédiaire (+0) (ADE II 09 l.15)', () => {
    setRule('psycho-acquisition-optionnelle', true);
    const c = mk();
    expect(calmeDeLAnimositeAcquise(c, fixed(50))!.target).toBe(calmeValue(c));
    expect(traumaOnImpossibleAmbition(c, fixed(50))!.test.target, 'Accessible (+20), pour comparaison').toBe(calmeValue(c) + 20);
  });

  it('Trauma : Ambition rendue impossible → Calme Accessible raté → Trauma ; réussite → rien', () => {
    setRule('psycho-acquisition-optionnelle', true);
    expect(traumaOnImpossibleAmbition(mk(), fixed(100))).toMatchObject({ trait: { type: 'trauma' } });
    const ok = traumaOnImpossibleAmbition(mk(), fixed(1));
    expect(ok!.test.success).toBe(true);
    expect(ok!.trait).toBeUndefined();
  });
});

describe('Valeur de Calme : la valeur de Test, États compris (LDB 16 l.125)', () => {
  it('Sonné ×3 retire 30 à la Force Mentale plus les avances de Calme', () => {
    const c = { id: 'c', kind: 'ennemi', characteristics: { 'force-mentale': 50 }, skills: [{ id: 'calme', advances: 10 }], talents: [], traits: [], conditions: [], items: [], weapons: [] } as unknown as Combatant;
    expect(calmeValue(c)).toBe(60);
    c.conditions = [{ id: 'sonne', value: 3 }];
    expect(calmeValue(c)).toBe(30);
  });
});

describe('Talent qui confère un Trait psy : même chemin que le Trait (LDB 10 l.548 ; LDB 21 l.39)', () => {
  const porteur = (talents: Combatant['talents']): Combatant => combattantDeTest({ label: 'Porteur', talents });
  const orque = combattantDeTest({ id: 'orque', label: 'Orque', groups: ['peau-verte'] });

  it('Haine (Groupe) : la Haine de cette Cible, celle du Trait posé arg Groupe', () => {
    const c = porteur([{ talentId: 'haine', spec: 'peau-verte', times: 1 }]);
    expect(effectivePsychTraits(c)).toEqual([{ type: 'haine', cible: ciblePsy.groupe('peau-verte') }]);
    expect(effectivePsychTraits(c)).toEqual(parsePsychTraits([{ id: 'haine', arg: 'peau-verte' }]).psychTraits);
    expect(targetedTrigger(c, [sourceCombattant(orque)])).toMatchObject({ type: 'haine', sourceId: 'orque' });
  });
  it('Haine sans spécialisation : aucune Cible, aucun Test', () => {
    const c = porteur([{ talentId: 'haine', times: 1 }]);
    expect(effectivePsychTraits(c).filter((p) => p.cible)).toEqual([]);
    expect(targetedTrigger(c, [sourceCombattant(orque)])).toBeNull();
  });
});
