import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { applyOps, skillDRBonus, charDRBonusOf } from '../engine/ops';
import { testStatePenalty, addCondition } from '../engine/conditions';
import { crewRoleValue, crewTalentDR, crewTestModOf } from '../engine/crewMorale';
import { findCrewRoleById, findSeaShantyById } from '../data';
import { rollCrewRole } from './shipManeuver';
import { endShanty, applyShantyToCrew, quartIndex, DEBUTS_DES_QUARTS } from './shipCrew';
import { MINUTES_PER_DAY } from '../engine/clock';
import { makeRNG } from '../engine/dice';
import type { Combatant, SkillInstance } from '../engine/types';

/**
 * #34 — CHANSONS DE MARIN (MDG 09 l.32-40 Talent + l.218-248 liste) : vocabulaire GÉNÉRIQUE
 * (crewTestMod / skillDRBonus & charDRBonus temporisés / ignoreStatePenalties{count}), flux
 * d'activation (choix de chanson + Test de Divertissement (Chant), 1 chanson par quart), fin de
 * chant sur Dégâts (l.38), et « Commandant émérite » (l.50-54) sur les Tests d'équipage.
 */
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind: 'hero', characteristics: { ...chars },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], items: [], skills: [], talents: [], weapons: [],
    fortune: 2, resilience: 2,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 }, ...over }) as unknown as Combatant;

describe('Vocabulaire des chansons (ops génériques → ActiveEffect)', () => {
  it('crewTestMod +10 (« Naviguons tous ensemble », MDG 09 l.224) → crewRoleValue du marin +10', () => {
    const c = mk('m1', { skills: [{ id: 'voile', characteristic: 'agilite', advances: 20 } as SkillInstance] });
    const base = crewRoleValue(c, findCrewRoleById('timonier')!).value;
    applyOps(c, [{ op: 'crewTestMod', mod: 10 }], { label: 'Chanson', rng: makeRNG(1), defaultUntilTime: 100 });
    expect(crewTestModOf(c)).toBe(10);
    expect(crewRoleValue(c, findCrewRoleById('timonier')!).value).toBe(base + 10);
  });

  it('skillDRBonus appliqué (« Jacques Bret », l.228) → lu par le lecteur skillDRBonus (effets actifs)', () => {
    const c = mk('m2');
    expect(skillDRBonus(c, 'corps-a-corps')).toBe(0);
    applyOps(c, [{ op: 'skillDRBonus', skill: { id: 'corps-a-corps' }, bonus: 1 }], { label: 'Chanson', rng: makeRNG(1), defaultUntilTime: 100 });
    expect(skillDRBonus(c, 'corps-a-corps')).toBe(1);
    expect(skillDRBonus(c, 'calme')).toBe(0); // pas de fuite vers une autre Compétence
  });

  it('charDRBonus Soc (« Camarades d’équipage », l.236) → charDRBonusOf', () => {
    const c = mk('m3');
    applyOps(c, [{ op: 'charDRBonus', char: 'sociabilite', bonus: 1 }], { label: 'Chanson', rng: makeRNG(1), defaultUntilTime: 100 });
    expect(charDRBonusOf(c, 'sociabilite')).toBe(1);
    expect(charDRBonusOf(c, 'force-mentale')).toBe(0);
  });

  it('ignoreStatePenalties{count:1} (« Les dames de L’Anguille », l.244) : ignore le PIRE État, pas les autres', () => {
    const c = mk('m4');
    addCondition(c, 'empoisonne'); // −10
    expect(testStatePenalty(c, 'calme')).toBe(-10);
    applyOps(c, [{ op: 'ignoreStatePenalties', count: 1 }], { label: 'Chanson', rng: makeRNG(1), defaultUntilTime: 100 });
    expect(testStatePenalty(c, 'calme')).toBe(0); // l'unique État est ignoré
    addCondition(c, 'extenue'); addCondition(c, 'extenue'); // Exténué ×2 = −20 (pire) ; Empoisonné −10 reste
    expect(testStatePenalty(c, 'calme')).toBe(-10); // le pire (−20) ignoré → le suivant s'applique
  });
});

// ── Flux d'activation (Talent, MDG 09 l.32-40) ──
const singer = (): Combatant => mk('barde', {
  characteristics: { ...chars, sociabilite: 50 },
  skills: [{ id: 'divertissement', spec: 'chant', characteristic: 'sociabilite', advances: 20 } as SkillInstance],
  talents: [{ talentId: 'chanson-de-marin', spec: 'jacques-bret-a-rencontre-notre-acier', times: 1 }],
});
const marin = (): Combatant => mk('marin', { skills: [{ id: 'voile', characteristic: 'agilite', advances: 10 } as SkillInstance] });
const ship = (over: Partial<Combatant> = {}): Combatant =>
  mk('ship', { kind: 'npc', bodyShape: 'vehicule', creatureId: 'coracle', crewIds: ['barde', 'marin'], ...over });

function openShanty() {
  seedBattleRng(3);
  useGame.setState({
    battle: { combatants: [ship(), singer(), marin()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
    party: [singer(), marin()], facing: { ship: 'N' }, pendingShanty: null, scene: null as never, gameTime: 0,
  });
  useGame.getState().battleSingShanty('ship');
}

describe('Flux « Chanson de marin » (Talent, MDG 09 l.32-40)', () => {
  beforeEach(() => useGame.setState({ pendingShanty: null }));

  it('battleSingShanty ouvre la modale (chanteur = le marin au Talent) ; UNE chanson connue → présélectionnée', () => {
    openShanty();
    const p = useGame.getState().pendingShanty!;
    expect(p.singerId).toBe('barde');
    expect(p.shantyId).toBe('jacques-bret-a-rencontre-notre-acier'); // sa seule chanson connue (spec du Talent)
  });

  it('réussite → l’effet couvre TOUT l’équipage (3 min + DR) ; le quart est consommé (l.40)', () => {
    openShanty();
    // Jet FORCÉ (Résilience) : succès garanti, déterministe — le flux réel passe par la même modale.
    useGame.getState().shantyForceSuccess();
    useGame.getState().shantyConfirm();
    const st = useGame.getState();
    const crew = st.battle!.combatants.filter((c) => c.id === 'barde' || c.id === 'marin');
    for (const c of crew) expect(skillDRBonus(c, 'corps-a-corps')).toBe(1); // « +1 DR sur tout Test de Corps à corps réussi »
    const hull = st.battle!.combatants.find((c) => c.id === 'ship')!;
    expect(hull.lastShantyQuart).toBe(quartIndex(0));
    const bard = st.battle!.combatants.find((c) => c.id === 'barde')!;
    expect(bard.singingShanty?.shantyId).toBe('jacques-bret-a-rencontre-notre-acier');
    // « Une seule chanson de marin peut être chantée lors de chaque quart » → 2e tentative refusée.
    useGame.getState().battleSingShanty('ship');
    expect(useGame.getState().pendingShanty).toBeNull();
  });

  it('fin de chant sur Dégâts (l.38) : endShanty retire l’effet de TOUT l’équipage', () => {
    openShanty();
    useGame.getState().shantyForceSuccess();
    useGame.getState().shantyConfirm();
    const st = useGame.getState();
    const bard = st.battle!.combatants.find((c) => c.id === 'barde')!;
    const lines = endShanty(useGame.getState, bard);
    expect(lines.length).toBe(1);
    for (const c of st.battle!.combatants) expect(skillDRBonus(c, 'corps-a-corps')).toBe(0);
    expect(bard.singingShanty).toBeUndefined();
  });

  it('les effets de chant portent effectId === shantyId ; endShanty retire PAR effectId (pas par libellé)', () => {
    openShanty();
    useGame.getState().shantyForceSuccess();
    useGame.getState().shantyConfirm();
    const st = useGame.getState();
    const bard = st.battle!.combatants.find((c) => c.id === 'barde')!;
    const marinC = st.battle!.combatants.find((c) => c.id === 'marin')!;
    const shantyId = bard.singingShanty!.shantyId;
    const label = bard.singingShanty!.label;
    for (const c of [bard, marinC]) {
      expect((c.activeEffects ?? []).length).toBeGreaterThan(0);
      expect((c.activeEffects ?? []).every((e) => e.effectId === shantyId)).toBe(true);
    }
    // DÉCOY : effet ÉTRANGER dont le LIBELLÉ collisionne avec celui de la chanson mais SANS le bon effectId.
    marinC.activeEffects = [...(marinC.activeEffects ?? []), { label, bonus: 3, char: 'force-mentale', duration: { scale: 'permanent' } } as never];
    endShanty(useGame.getState, bard);
    expect((marinC.activeEffects ?? []).some((e) => e.label === label && e.bonus === 3)).toBe(true); // le décoy survit
    expect((marinC.activeEffects ?? []).some((e) => e.effectId === shantyId)).toBe(false); // le vrai effet de chant est parti
  });

  it('au quart suivant (MDG 03 l.76, 04h), on peut de nouveau chanter', () => {
    openShanty();
    useGame.getState().shantyForceSuccess();
    useGame.getState().shantyConfirm();
    useGame.setState({ gameTime: DEBUTS_DES_QUARTS[1] });
    const bard = useGame.getState().battle!.combatants.find((c) => c.id === 'barde')!;
    delete bard.singingShanty; // le chant précédent est fini
    useGame.getState().battleSingShanty('ship');
    expect(useGame.getState().pendingShanty).not.toBeNull();
  });
});

describe('les sept QUARTS d’un navire (MDG 03 l.71-81)', () => {
  const h = (heure: number) => heure * 60;

  it('16h-18h et 18h-20h sont deux quarts distincts (mi-quarts du chien, l.79-80)', () => {
    expect(quartIndex(h(17))).not.toBe(quartIndex(h(19)));
    expect(quartIndex(h(16))).toBe(quartIndex(h(18) - 1));
    expect(quartIndex(h(18))).toBe(quartIndex(h(20) - 1));
  });

  it('sept quarts par jour (l.71) : 20h-00h est UN quart, minuit ouvre le quart de nuit du lendemain', () => {
    expect(quartIndex(h(20))).toBe(quartIndex(MINUTES_PER_DAY - 1));
    expect(quartIndex(MINUTES_PER_DAY)).toBe(7);
    expect(new Set([0, 4, 8, 12, 16, 18, 20].map((x) => quartIndex(h(x)))).size).toBe(7);
  });
});

describe('« Suivez le capitaine » : captainOps sur le SEUL titulaire du rôle Capitaine (MDG 09 l.246-248)', () => {
  it('applyShantyToCrew pose le +20 Soc sur le capitaine, pas sur les autres', () => {
    seedBattleRng(3);
    const capitaine = mk('cap', { skills: [{ id: 'commandement', characteristic: 'sociabilite', advances: 20 } as SkillInstance] });
    const mousse = marin();
    const hull = mk('ship', { kind: 'npc', bodyShape: 'vehicule', creatureId: 'coracle', crewIds: ['cap', 'marin'] });
    useGame.setState({
      battle: { combatants: [hull, capitaine, mousse], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [capitaine, mousse], facing: {}, scene: null as never, gameTime: 0,
    });
    applyShantyToCrew(useGame.getState, hull, capitaine, 'suivez-le-capitaine', 2);
    expect((capitaine.activeEffects ?? []).some((e) => e.testMod === 20 && e.testModChar === 'sociabilite')).toBe(true);
    expect((mousse.activeEffects ?? []).length).toBe(0);
    expect(findSeaShantyById('suivez-le-capitaine')!.captainOps).toBeTruthy();
  });
});

describe('Commandant émérite (MDG 09 l.50-54) — +niveau DR aux Tests d’équipage', () => {
  const cap = (times: number): Combatant => mk('cap', {
    characteristics: { ...chars, sociabilite: 60 },
    skills: [{ id: 'commandement', characteristic: 'sociabilite', advances: 20 } as SkillInstance],
    talents: [{ talentId: 'commandant-emerite', times }],
  });

  it('crewTalentDR : +niveau pour le rôle Capitaine (Commandement) ; 0 pour un rôle sans Talent', () => {
    expect(crewTalentDR(cap(2), findCrewRoleById('capitaine')!)).toBe(2);
    expect(crewTalentDR(cap(2), findCrewRoleById('mousse')!)).toBe(0); // le Talent vise Commandement
    expect(crewTalentDR(marin(), findCrewRoleById('capitaine')!)).toBe(0);
  });

  it('rollCrewRole : le +DR ne s’applique QUE sur un jet RÉUSSI (règle LDB 10 l.19)', () => {
    // valeur 80 : succès quasi garanti avec ce seed ; on vérifie sl = DR de base + niveau.
    const c = cap(3);
    c.characteristics.sociabilite = 80;
    const withTalent = rollCrewRole(c, 'capitaine', makeRNG(11))!;
    const sans = { ...c, talents: [] } as Combatant;
    const without = rollCrewRole(sans, 'capitaine', makeRNG(11))!;
    expect(withTalent.roll).toBe(without.roll); // même dé (même seed)
    if (withTalent.roll <= withTalent.target) expect(withTalent.sl).toBe(without.sl + 3);
    else expect(withTalent.sl).toBe(without.sl); // raté → pas de bonus
  });
});
