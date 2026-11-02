import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { restRecovery, dailyDiseaseUpkeep } from '../engine/rest';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import type { HitLocation } from '../engine/types';
const tk = (k: 'dechirure' | 'fracture', s: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, s, loc), opts, loc);
import { contractDisease } from '../engine/disease';
import { hasCondition, stacks } from '../engine/conditions';
import { dayPhase, MINUTES_PER_DAY } from '../engine/clock';
import type { RNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import { deFixe } from '../engine/dice.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = (p: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  }) as Combatant);

describe('restRecovery — repos d’une nuit (LDB 16 l.92 / 18 l.380 / 21 l.95)', () => {
  it('retire TOUS les États Exténué (cadence « nuit complète »)', () => {
    const c = hero({ conditions: [{ id: 'extenue', value: 2 }] });
    restRecovery(c, deFixe(1));
    expect(hasCondition(c, 'extenue')).toBe(false);
  });

  it('soigne des Blessures : Test Résistance +20 réussi (DR+BE, volet a) ET +BE de la journée (volet b)', () => {
    const c = hero({ wounds: blessuresDeBase(20, 4) }); // E 40 → BE 4
    // Résistance Accessible (+20) : cible 60 ; jet 30 → réussite DR=3 → volet a = 3+4 = 7 ; volet b = +4.
    restRecovery(c, deFixe(30));
    expect(c.wounds.current).toBe(15); // 4 + 7 (volet a) + 4 (volet b)
  });

  it('Résistance ratée → seul le +BE de la journée soigne (volet b, inconditionnel)', () => {
    const c = hero({ wounds: blessuresDeBase(20, 4) });
    restRecovery(c, deFixe(95)); // 95 > 60 → Test raté → volet a = 0
    expect(c.wounds.current).toBe(8); // 4 + 4 (volet b uniquement)
  });

  it('repos de plusieurs jours : volet a + volet b cumulés CHAQUE jour (LDB 18 l.296)', () => {
    const c = hero({ wounds: blessuresDeBase(100, 0) }); // E 40 → BE 4 ; pas de plafond
    restRecovery(c, deFixe(30), 3); // 3 jours, chaque jour Résistance réussie (DR 3)
    expect(c.wounds.current).toBe(33); // 3 × (volet a 7 + volet b 4)
  });

  it('cauchemars : un héros marqué qui échoue regagne l’Exténué malgré le repos (l’ironie du trauma)', () => {
    const c = hero({ nightmares: true, conditions: [{ id: 'extenue', value: 1 }] });
    const fail: RNG = deFixe(90); // Calme +40 : cible 75 ; 90 > 75 → échec
    restRecovery(c, fail);
    expect(stacks(c, 'extenue')).toBe(1); // l’ancien dissipé, un nouveau gagné
  });

  it('un héros Inconscient soigné > 0 PB reprend connaissance (LDB 18 l.15)', () => {
    const c = hero({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], roundsAtZero: 3 });
    restRecovery(c, deFixe(30)); // Résistance réussie → soigne 7 PB (>0)
    expect(c.wounds.current).toBeGreaterThan(0);
    expect(hasCondition(c, 'inconscient')).toBe(false);
    expect(c.roundsAtZero).toBe(0);
  });

  it('un héros Hémorragique ne trouve pas le repos (LDB 16 l.105) — pas de récup, pas de mort', () => {
    const c = hero({ conditions: [{ id: 'hemorragique', value: 1 }, { id: 'extenue', value: 1 }], fate: 0 });
    const log = restRecovery(c, deFixe(1));
    expect(log.join(' ')).toMatch(/ne trouve pas le repos/);
    expect(hasCondition(c, 'extenue')).toBe(true); // pas dissipé (repos refusé)
    expect(c.dead).not.toBe(true); // restRecovery ne tue pas
  });

  it('un héros À Terre soigné au réveil se relève (≥1 PB)', () => {
    const c = hero({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'a-terre', value: 1 }] });
    restRecovery(c, deFixe(30)); // Résistance réussie → soigne, >0 PB
    expect(c.wounds.current).toBeGreaterThan(0);
    expect(hasCondition(c, 'a-terre')).toBe(false);
  });

  // (Convalescence des traumas : décomptée par l'ENTRETIEN quotidien — #T3, jours calendaires —
  //  testée sur le chemin du noyau « restParty » ci-dessous et dans upkeep-cascade.hors-store.test.ts.)

  it('un mort ne se repose pas', () => {
    const c = hero({ dead: true, conditions: [{ id: 'extenue', value: 1 }] });
    restRecovery(c, deFixe(1));
    expect(hasCondition(c, 'extenue')).toBe(true);
  });

  it('maladie : l’incubation se déclare à l’entretien quotidien et le malaise impose un Exténué « collant » (LDB 20 l.188)', () => {
    // Infection Mineure : incubation 1 j, durée 5 j. E 40 → blessé Accessible (cible 60) réussi avec d100=10.
    const c = hero({ wounds: blessuresDeBase(12), diseases: [contractDisease('infection-mineure', deFixe(1), { incubation: 1, duration: 5 })!] });
    dailyDiseaseUpkeep(c, deFixe(10), () => {}); // jour 1 (cascade #T3) → symptômes déclarés → +1 Exténué (malaise)
    expect(c.diseases![0].phase).toBe('active');
    expect(stacks(c, 'extenue')).toBe(1);
    restRecovery(c, deFixe(10)); // la nuit de sommeil ne dissipe PAS l'Exténué du malaise
    expect(stacks(c, 'extenue')).toBe(1);
  });

  it('maladie : les soins d’un soignant raccourcissent la durée (−1 j/jour en plus, LDB 09-Compétences)', () => {
    const cared = hero({ wounds: blessuresDeBase(12), diseases: [contractDisease('infection-mineure', deFixe(1), { incubation: 0, duration: 6 })!] });
    const alone = hero({ wounds: blessuresDeBase(12), diseases: [contractDisease('infection-mineure', deFixe(1), { incubation: 0, duration: 6 })!] });
    dailyDiseaseUpkeep(cared, deFixe(10), () => {}, true);  // soigné : tick naturel −1 + soins −1
    dailyDiseaseUpkeep(alone, deFixe(10), () => {}, false); // seul : tick naturel −1
    expect(cared.diseases![0].minutesLeft).toBe(alone.diseases![0].minutesLeft - MINUTES_PER_DAY);
  });

  it('munition Empaleuse logée bloque la récupération naturelle (LDB 62 l.250, plafonné SOURCE UNIQUE `applyHealWounds`)', () => {
    const c = hero({ wounds: blessuresDeBase(12, 8), conditions: [{ id: 'munition-logee', value: 1 }] }); // E 40 → BE 4
    restRecovery(c, deFixe(30)); // Résistance réussie : volet a 7 + volet b 4 = 11 SANS plafond → 19 (>max)
    expect(c.wounds.current).toBe(11); // plafonné à max(12) − 1 munition logée
  });

  it('maladie : un symptôme « blessé » bloque la guérison d’1 PB (LDB 20 l.110)', () => {
    const base = hero({ wounds: blessuresDeBase(20, 4) }); // E 40 → BE 4 ; sans maladie
    restRecovery(base, deFixe(30));
    const sick = hero({ wounds: blessuresDeBase(20, 4), diseases: [contractDisease('infection-mineure', deFixe(1), { incubation: 0, duration: 5 })!] });
    restRecovery(sick, deFixe(30)); // blessé Accessible réussi (d100=30 ≤ 60) → pas de Blessure Purulente
    expect(sick.wounds.current).toBe(base.wounds.current - 1); // exactement 1 PB de moins (1 symptôme « blessé »)
  });
});

describe('restParty (store) — « Dormir jusqu’à l’aube »', () => {
  beforeEach(() => { banc.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('avance jusqu’à l’aube et applique la récupération', () => {
    const c = hero({ id: 'a', conditions: [{ id: 'extenue', value: 1 }] });
    banc.setState({ party: [c], gameTime: 12 * 60 }); // midi
    banc.getState().restParty();
    const after = banc.getState();
    expect(dayPhase(after.gameTime).id).toBe('aube'); // réveil à l’aube
    expect(hasCondition(after.party[0], 'extenue')).toBe(false);
    expect(after.journal.some((l) => /dort jusqu|aube/i.test(l))).toBe(true);
  });

  it('un héros Hémorragique sans Destin SURVIT à la nuit (pas de spirale d’entretien — régression du bloquant)', () => {
    const c = hero({ id: 'a', wounds: blessuresDeBase(12), conditions: [{ id: 'hemorragique', value: 1 }], fate: 0 });
    banc.setState({ party: [c], gameTime: 12 * 60 });
    banc.getState().restParty();
    const after = banc.getState().party[0];
    expect(after.dead).not.toBe(true);
    expect(hasCondition(after, 'hemorragique')).toBe(true); // toujours à stabiliser (Guérison), pas mort en dormant
  });

  it('restParty(3) avance ~3 jours et soigne davantage qu’une nuit', () => {
    const c = hero({ id: 'a', wounds: blessuresDeBase(100, 2) });
    banc.setState({ party: [c], gameTime: 12 * 60 });
    const t0 = banc.getState().gameTime;
    banc.getState().restParty(3);
    const after = banc.getState();
    expect(after.gameTime - t0).toBeGreaterThanOrEqual(2 * 24 * 60); // au moins 2 jours pleins + la 1re nuit
    expect(after.party[0].wounds.current).toBeGreaterThan(2 + 4); // bien plus qu’un seul +BE
    expect(after.journal.some((l) => /se repose 3 jours/i.test(l))).toBe(true);
  });

  it('le repos fait avancer la convalescence des traumas (cascade #T3 — via l’entretien quotidien)', () => {
    const c = hero({ id: 'a', traumas: [tk('dechirure', 'mineur', 'jambeD', { be: 28 })] }); // 30−28 = 2 jours
    banc.setState({ party: [c], gameTime: 12 * 60, lastUpkeepDay: 0 });
    banc.getState().restParty(3); // 3 jours franchis ≥ 2 → guéri
    expect(banc.getState().party[0].traumas!.length).toBe(0);
  });

  it('ne fait rien en plein combat', () => {
    banc.setState({ battle: { combatants: [], order: [], turn: 0, round: 1, log: [], over: null } as any, gameTime: 12 * 60 });
    const t0 = banc.getState().gameTime;
    banc.getState().restParty();
    expect(banc.getState().gameTime).toBe(t0); // inchangé
  });
});
