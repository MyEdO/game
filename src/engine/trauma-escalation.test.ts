import { describe, it, expect } from 'vitest';
import { receiveMedicalAid, tickTraumaEscalation, tickTraumaRecovery, stampCriticalEscalation,
  recoverableTraumas, hasRecoverableTrauma, hasLimbAwaitingAid, recoverDisabledLimb, cannotWieldTwoHanded,
  traumaMovementHalved, reinjuryBleed, removeSurgicalTrauma } from './trauma';
import { resolveCritique } from './critical';
import { addCondition, removeCondition, hasCondition, releaseConditionLocks } from './conditions';
import { applyOps } from './ops';
import type { Combatant, Trauma, HitLocation } from './types';
import type { RNG } from './dice';
import { critiqueDoc } from '../data/criticals';
import { desDuTest, desEnSuite } from './dice.testkit';


const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'c', label: 'C', kind: 'hero', conditions: [], skills: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as Combatant);

/** Plaie chirurgicale (« Amputation ») telle que la pose resolveCritique. */
const plaie = (loc: HitLocation, extra: Partial<Trauma> = {}): Trauma =>
  ({ label: 'Amputation', location: loc, needsSurgery: true, desc: 'x', ...extra });

/** Escalade « Main ouverte » telle qu'elle est DÉCLARÉE en donnée (`criticals.json`, les deux jeux). */
const FINGER_PER_ROUND = { versTraumaId: 'doigt-ampute' };
/** Escalade « Pied écrasé » DÉCLARÉE : délai 1d10 jours puis perte du membre. */
const FOOT_AFTER_DELAY = { jours: { dice: { n: 1, sides: 10 } }, versTraumaId: 'membre-inferieur-ampute' };

/** RNG qui débite une séquence fixe (int() ignore min/max — tests ciblés). */
const seq = (vals: number[]): RNG => desEnSuite(vals, { boucle: true });

describe('#166/#167 — Aide Médicale reçue (LDB 18 l.307-312) : flag partagé', () => {
  it('receiveMedicalAid lève awaitingMedicalAid sur TOUTES les séquelles en attente', () => {
    const c = C({ traumas: [plaie('brasD', { awaitingMedicalAid: true, perRound: FINGER_PER_ROUND }), plaie('corps')] });
    const log = receiveMedicalAid(c);
    expect(c.traumas!.every((t) => !t.awaitingMedicalAid)).toBe(true);
    expect(log.join(' ')).toMatch(/Aide Médicale/);
  });
  it('receiveMedicalAid : no-op (aucune ligne) si rien en attente', () => {
    const c = C({ traumas: [plaie('brasD')] });
    expect(receiveMedicalAid(c)).toEqual([]);
  });
  it('les formes op (sort/prière = heal ; bandage/cataplasme = preventInfection) lèvent le flag via applyOps', () => {
    const gate = (): Trauma => plaie('brasD', { awaitingMedicalAid: true, perRound: FINGER_PER_ROUND });
    const cHeal = C({ wounds: { current: 3, max: 10 }, traumas: [gate()] });
    applyOps(cHeal, [{ op: 'heal', amount: 2 }], { rng: desDuTest });
    expect(cHeal.traumas!.every((t) => !t.awaitingMedicalAid)).toBe(true);
    const cBandage = C({ traumas: [gate()] });
    applyOps(cBandage, [{ op: 'preventInfection' }], { rng: desDuTest });
    expect(cBandage.traumas!.every((t) => !t.awaitingMedicalAid)).toBe(true);
  });
});

describe('#167 — « Main ouverte » : 1 doigt de plus par Round sans Aide Médicale (AA 07 l.127 / LDB)', () => {
  it('chaque tick perd un doigt ; 4 doigts → main tranchée ; l’escalade se coupe alors', () => {
    const c = C({ traumas: [plaie('brasD', { awaitingMedicalAid: true, perRound: FINGER_PER_ROUND })] });
    for (let r = 0; r < 3; r++) tickTraumaEscalation(c);
    const fingers = c.traumas!.find((t) => t.traumaId === 'doigt-ampute');
    expect(fingers?.count).toBe(3);
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute')).toBe(false);
    tickTraumaEscalation(c); // 4e doigt → main tranchée
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute')).toBe(true);
    expect(c.traumas!.some((t) => t.traumaId === 'doigt-ampute')).toBe(false);
    const stump = c.traumas!.find((t) => t.label === 'Amputation');
    expect(stump?.perRound).toBeFalsy();
    expect(stump?.awaitingMedicalAid).toBeFalsy();
  });
  it('Aide Médicale reçue AVANT le 4e Round stoppe l’escalade (le membre est sauvé)', () => {
    const c = C({ traumas: [plaie('brasD', { awaitingMedicalAid: true, perRound: FINGER_PER_ROUND })] });
    tickTraumaEscalation(c); // 1 doigt
    receiveMedicalAid(c); // soin
    tickTraumaEscalation(c); // plus rien
    tickTraumaEscalation(c);
    expect(c.traumas!.find((t) => t.traumaId === 'doigt-ampute')?.count).toBe(1);
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute')).toBe(false);
  });
  it('une main déjà amputée sur l’AUTRE bras ne coupe PAS une escalade « Main ouverte » fraîche', () => {
    // brasD : ancienne amputation de main (crit antérieur). brasG : escalade « Main ouverte » fraîche.
    const c = C({ traumas: [
      { label: 'Main tranchée (brasD)', traumaId: 'main-bras-ampute', location: 'brasD', desc: 'x', ops: [{ op: 'maxWeaponHands', hands: 1 }] },
      plaie('brasG', { awaitingMedicalAid: true, perRound: FINGER_PER_ROUND }),
    ] });
    for (let r = 0; r < 3; r++) tickTraumaEscalation(c);
    // L'escalade de brasG doit avoir progressé malgré la main amputée de brasD.
    expect(c.traumas!.find((t) => t.traumaId === 'doigt-ampute' && t.location === 'brasG')?.count).toBe(3);
    const stumpG = c.traumas!.find((t) => t.label === 'Amputation' && t.location === 'brasG');
    expect(stumpG?.perRound).toEqual(FINGER_PER_ROUND); // toujours en escalade (pas coupée par brasD)
    expect(stumpG?.awaitingMedicalAid).toBe(true);
    tickTraumaEscalation(c); // 4e doigt sur brasG → main tranchée sur brasG
    expect(c.traumas!.some((t) => t.traumaId === 'main-bras-ampute' && t.location === 'brasG')).toBe(true);
    expect(c.traumas!.find((t) => t.label === 'Amputation' && t.location === 'brasG')?.perRound).toBeFalsy();
  });
});

describe('#167 — « Pied écrasé » : perte du pied si pas de Chirurgie sous 1d10 jours (AA 07 l.180 / LDB)', () => {
  it('le décompte expire sans Chirurgie → séquelle permanente du membre inférieur posée', () => {
    const c = C({ traumas: [plaie('jambeD', { amputateAfterDays: 3, amputateSequel: 'membre-inferieur-ampute' })] });
    tickTraumaRecovery(c, 1, () => {});
    expect(c.traumas!.find((t) => t.label === 'Amputation')?.amputateAfterDays).toBe(2);
    const log = tickTraumaRecovery(c, 2, () => {}); // échéance atteinte
    expect(log.join(' ')).toMatch(/membre est perdu/);
    const seqT = c.traumas!.find((t) => t.traumaId === 'membre-inferieur-ampute');
    expect(seqT).toBeTruthy();
    expect(seqT!.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    // La plaie subsiste (moignon à opérer) mais sans décompte d’escalade.
    expect(c.traumas!.find((t) => t.label === 'Amputation')?.amputateAfterDays).toBeUndefined();
  });
  it('Chirurgie AVANT l’échéance (plaie retirée) → pas d’amputation du pied', () => {
    const c = C({ traumas: [plaie('jambeD', { amputateAfterDays: 3, amputateSequel: 'membre-inferieur-ampute' })] });
    c.traumas = []; // simule removeSurgicalTrauma (l’opération a retiré la plaie chirurgicale)
    const log = tickTraumaRecovery(c, 5, () => {});
    expect(log.join(' ')).not.toMatch(/membre est perdu/);
    expect(c.traumas!.some((t) => t.traumaId === 'membre-inferieur-ampute')).toBe(false);
  });
});

describe('#166/#167 — câblage DONNÉE→plaie (stampCriticalEscalation) + entrées de tables', () => {
  it('stamp « Main ouverte » pose l’escalade périodique DÉCLARÉE + awaitingMedicalAid sur la plaie', () => {
    const traumas = [plaie('brasD')];
    stampCriticalEscalation(traumas, { perRound: FINGER_PER_ROUND }, 'brasD', C({}), desDuTest);
    expect(traumas[0].perRound).toEqual(FINGER_PER_ROUND);
    expect(traumas[0].awaitingMedicalAid).toBe(true);
  });
  it('stamp « Pied écrasé » pose amputateAfterDays (délai 1d10 résolu) + amputateSequel', () => {
    const traumas = [plaie('jambeD')];
    stampCriticalEscalation(traumas, { apresDelai: FOOT_AFTER_DELAY }, 'jambeD', C({}), seq([7]));
    expect(traumas[0].amputateAfterDays).toBe(7);
    expect(traumas[0].amputateSequel).toBe('membre-inferieur-ampute');
  });
  it('les 4 entrées d’escalade doigt/pied portent l’escalade attendue', () => {
    const find = (arr: { id: string; escalation?: unknown }[], id: string) => arr.find((e) => e.id === id)!.escalation as Record<string, unknown>;
    expect(find(critiqueDoc('aa', 'bras').entries, 'aa-bras-116')).toEqual({ perRound: FINGER_PER_ROUND });
    expect(find(critiqueDoc('aa', 'jambe').entries, 'aa-jambe-106')).toEqual({ apresDelai: FOOT_AFTER_DELAY });
    expect(find(critiqueDoc('ldb', 'bras').entries, 'main-ouverte')).toEqual({ perRound: FINGER_PER_ROUND });
    expect(find(critiqueDoc('ldb', 'jambe').entries, 'pied-ecrase')).toEqual({ apresDelai: FOOT_AFTER_DELAY });
  });
  it('resolveCritique(aa, « Pied écrasé ») stampe l’escalade sur la plaie (overkill place le jet en 106-115)', () => {
    // roll = d100 + 10×overkill ; d100=100, overkill=1 → 110 (aa-jambe-106). Puis d10=5 pour
    // `amputateAfterDays` : depuis #1657 B3-1b le Test d'amputation n'est plus roulé ici (il part par
    // la porte), donc AUCUN dé ne s'intercale entre la sévérité et le délai de l'escalade.
    const c = C({ skills: [{ id: 'resistance', characteristic: 'endurance', advances: 0 }] });
    const res = resolveCritique('aa', c, 'jambeD', seq([100, 5]), { overkill: 1 });
    const p = res.traumas.find((t) => t.label === 'Amputation');
    expect(p?.amputateAfterDays).toBe(5);
    expect(p?.amputateSequel).toBe('membre-inferieur-ampute');
  });
});

describe('#166 — « Épaule luxée »/« Genou démis » : membre désactivé → Test étendu de Guérison (AA 07 l.125/179 / LDB)', () => {
  it('stamp `medicalAidGate` POUSSE une séquelle « membre désactivé » (pas de plaie chirurgicale) à la localisation', () => {
    const traumas: Trauma[] = []; // Épaule luxée n’engendre PAS d’amputation → aucune plaie chirurgicale préalable
    stampCriticalEscalation(traumas, {
      medicalAidGate: { label: 'Épaule luxée (bras perdu)', disable: [{ op: 'maxWeaponHands', hands: 1 }], restoreDR: 6, recoveryPenalty: [{ op: 'charMod', char: 'capacite-de-combat', mod: -10 }] },
    }, 'brasD', C({}), desDuTest);
    expect(traumas).toHaveLength(1);
    const t = traumas[0];
    expect(t.location).toBe('brasD');
    expect(t.restoreDR).toBe(6);
    expect(t.awaitingMedicalAid).toBe(true);
    expect(t.ops).toEqual([{ op: 'maxWeaponHands', hands: 1 }]);
    expect(t.recoveryPenalty).toEqual([{ op: 'charMod', char: 'capacite-de-combat', mod: -10 }]);
  });

  it('le membre désactivé grève passivement (bras → 2 mains impossibles ; jambe → Mouvement ÷2)', () => {
    const arm = C({ traumas: [{ label: 'x', location: 'brasD', awaitingMedicalAid: true, restoreDR: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }] }] });
    expect(cannotWieldTwoHanded(arm)).toBe(true);
    const leg = C({ traumas: [{ label: 'x', location: 'jambeD', awaitingMedicalAid: true, restoreDR: 6, ops: [{ op: 'moveScale', num: 1, den: 2 }] }] });
    expect(traumaMovementHalved(leg)).toBe(true);
  });

  it('récupération BLOQUÉE tant que l’Aide Médicale n’est pas reçue, puis débloquée (LDB 18 l.120/179)', () => {
    const c = C({ traumas: [{ label: 'x', location: 'brasD', awaitingMedicalAid: true, restoreDR: 6, recoveryPenalty: [{ op: 'charMod', char: 'capacite-de-combat', mod: -10 }] }] });
    expect(hasLimbAwaitingAid(c)).toBe(true);
    expect(hasRecoverableTrauma(c)).toBe(false); // le Test étendu demeure indisponible avant l’Aide Médicale
    receiveMedicalAid(c);
    expect(hasLimbAwaitingAid(c)).toBe(false);
    expect(recoverableTraumas(c)).toHaveLength(1);
  });

  it('`recoverDisabledLimb` retire la séquelle et rend sa `recoveryPenalty` (posée par l’appelant, 1d10 j)', () => {
    const c = C({ traumas: [
      { label: 'Genou démis (jambe perdue)', location: 'jambeD', restoreDR: 6, ops: [{ op: 'moveScale', num: 1, den: 2 }], recoveryPenalty: [{ op: 'testMod', char: 'agilite', amount: -10, movementOnly: true }, { op: 'moveScale', num: 1, den: 2 }] },
    ] });
    const { penalty, log } = recoverDisabledLimb(c, 0);
    expect(c.traumas).toHaveLength(0); // le membre désactivé est retiré (usage récupéré)
    expect(penalty).toEqual([{ op: 'testMod', char: 'agilite', amount: -10, movementOnly: true }, { op: 'moveScale', num: 1, den: 2 }]);
    expect(log.join(' ')).toMatch(/usage du membre récupéré/);
  });

  // #193 — « Tests effectués avec ce bras » (LDB/AA) : `recoverDisabledLimb` scope le `testMod{char:'capacite-de-combat'}`
  // à la main RÉELLE du membre (convention DROITIER, MÊME donnée pour brasD/brasG).
  it("`recoverDisabledLimb` injecte `weaponHand` sur un `testMod{char:'capacite-de-combat'}` selon la Localisation (brasD → main, brasG → off)", () => {
    const cD = C({ traumas: [{ label: 'x', location: 'brasD', restoreDR: 6, recoveryPenalty: [{ op: 'testMod', char: 'capacite-de-combat', amount: -10 }] }] });
    expect(recoverDisabledLimb(cD, 0).penalty).toEqual([{ op: 'testMod', char: 'capacite-de-combat', amount: -10, weaponHand: 'main' }]);
    const cG = C({ traumas: [{ label: 'x', location: 'brasG', restoreDR: 6, recoveryPenalty: [{ op: 'testMod', char: 'capacite-de-combat', amount: -10 }] }] });
    expect(recoverDisabledLimb(cG, 0).penalty).toEqual([{ op: 'testMod', char: 'capacite-de-combat', amount: -10, weaponHand: 'off' }]);
  });

  it('Sonné « jusqu’à Aide Médicale » (Épaule luxée/Genou démis) : `unlockBy:medicalAid` le retient, l’Aide le retire', () => {
    const c = C({ traumas: [{ label: 'x', location: 'brasD', awaitingMedicalAid: true, restoreDR: 6 }] });
    addCondition(c, 'sonne', 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    removeCondition(c, 'sonne'); // récupération d’État normale : INERTE (verrouillé)
    expect(hasCondition(c, 'sonne')).toBe(true);
    releaseConditionLocks(c, 'medicalAid'); // Aide reçue → l’acte retire l’État
    expect(hasCondition(c, 'sonne')).toBe(false);
  });

  it('resolveCritique(aa, « Épaule luxée » 96-109) stampe le membre désactivé (usage à récupérer)', () => {
    const c = C({});
    const res = resolveCritique('aa', c, 'brasD', seq([100])); // d100=100 → aa-bras-96 (96-109)
    const t = res.traumas.find((x) => x.restoreDR != null);
    expect(t?.restoreDR).toBe(6);
    expect(t?.awaitingMedicalAid).toBe(true);
    expect(t?.location).toBe('brasD');
    expect(t?.ops).toEqual([{ op: 'maxWeaponHands', hands: 1 }]);
  });

  it('les 4 entrées « Épaule luxée »/« Genou démis » portent `medicalAidGate` (DR 6)', () => {
    const gate = (arr: { id: string; escalation?: { medicalAidGate?: { restoreDR: number } } }[], id: string) =>
      arr.find((e) => e.id === id)!.escalation!.medicalAidGate!;
    expect(gate(critiqueDoc('aa', 'bras').entries, 'aa-bras-96').restoreDR).toBe(6);
    expect(gate(critiqueDoc('aa', 'jambe').entries, 'aa-jambe-96').restoreDR).toBe(6);
    expect(gate(critiqueDoc('ldb', 'bras').entries, 'epaule-luxee').restoreDR).toBe(6);
    expect(gate(critiqueDoc('ldb', 'jambe').entries, 'genou-demis').restoreDR).toBe(6);
  });
});

describe('#190 — réouverture (bleedOnReinjury) : chaque Dégât à la Localisation → +N Hémorragique, levée par Chirurgie (LDB 18 / AA 07)', () => {
  it('stamp pose une séquelle chirurgicale porteuse de `bleedOnReinjury` à la localisation', () => {
    const traumas: Trauma[] = []; // Blessure béante n’engendre PAS d’amputation → aucune plaie préalable
    stampCriticalEscalation(traumas, { bleedOnReinjury: { amount: 2, label: 'Dégâts artériels' } }, 'corps', C({}), desDuTest);
    expect(traumas).toHaveLength(1);
    expect(traumas[0]).toMatchObject({ label: 'Dégâts artériels', location: 'corps', bleedOnReinjury: 2, needsSurgery: true });
  });

  it('reinjuryBleed : nouveau Dégât à la MÊME Localisation → N ; autre Localisation → 0', () => {
    const c = C({ traumas: [{ label: 'Blessure béante', location: 'brasD', bleedOnReinjury: 1, needsSurgery: true }] });
    expect(reinjuryBleed(c, 'brasD')).toBe(1); // le bras rouvert saigne
    expect(reinjuryBleed(c, 'brasG')).toBe(0); // autre bras : rien
    expect(reinjuryBleed(c, 'corps')).toBe(0); // Dégât non localisé au bras : rien
  });

  it('reinjuryBleed : plusieurs plaies gatées à la même Localisation CUMULENT (RAW ne les fusionne pas)', () => {
    const c = C({ traumas: [
      { label: 'Blessure béante', location: 'corps', bleedOnReinjury: 1, needsSurgery: true },
      { label: 'Dégâts artériels', location: 'corps', bleedOnReinjury: 2, needsSurgery: true },
    ] });
    expect(reinjuryBleed(c, 'corps')).toBe(3);
  });

  it('la Chirurgie (removeSurgicalTrauma) retire la plaie → plus de réouverture', () => {
    const c = C({ criticalWounds: 1, traumas: [{ label: 'Cuisse lacérée', location: 'jambeD', bleedOnReinjury: 1, needsSurgery: true }] });
    expect(reinjuryBleed(c, 'jambeD')).toBe(1);
    removeSurgicalTrauma(c);
    expect(reinjuryBleed(c, 'jambeD')).toBe(0);
    expect(c.criticalWounds).toBe(0);
  });

  it('resolveCritique(ldb, « Blessure béante » bras 46-50) stampe la plaie `bleedOnReinjury` à la localisation du coup', () => {
    const c = C({ skills: [{ id: 'resistance', characteristic: 'endurance', advances: 0 }] });
    const res = resolveCritique('ldb', c, 'brasG', seq([48])); // 48 ∈ 46-50 (Blessure béante)
    const p = res.traumas.find((t) => t.bleedOnReinjury != null);
    expect(p).toMatchObject({ location: 'brasG', bleedOnReinjury: 1, needsSurgery: true });
  });

  it('les entrées de réouverture LDB portent le bon montant ; AA idem (l’Artère AA n’en porte PAS)', () => {
    const bleed = (arr: { id: string; escalation?: { bleedOnReinjury?: { amount: number } } }[], id: string) =>
      arr.find((e) => e.id === id)?.escalation?.bleedOnReinjury?.amount;
    // LDB (6 entrées)
    expect(bleed(critiqueDoc('ldb', 'bras').entries, 'blessure-beante')).toBe(1);
    expect(bleed(critiqueDoc('ldb', 'bras').entries, 'artere-endommagee')).toBe(2);
    expect(bleed(critiqueDoc('ldb', 'corps').entries, 'blessure-beante-2')).toBe(1);
    expect(bleed(critiqueDoc('ldb', 'corps').entries, 'degats-arteriels')).toBe(2);
    expect(bleed(critiqueDoc('ldb', 'corps').entries, 'blessure-majeure-au-torse')).toBe(2);
    expect(bleed(critiqueDoc('ldb', 'jambe').entries, 'cuisse-laceree')).toBe(1);
    // AA (5 entrées) — l’« Artère endommagée » AA (aa-bras-91) n’a PAS la clause de réouverture (RAW AA 07)
    expect(bleed(critiqueDoc('aa', 'bras').entries, 'aa-bras-56')).toBe(1);
    expect(bleed(critiqueDoc('aa', 'corps').entries, 'aa-corps-56')).toBe(1);
    expect(bleed(critiqueDoc('aa', 'corps').entries, 'aa-corps-66')).toBe(2);
    expect(bleed(critiqueDoc('aa', 'corps').entries, 'aa-corps-81')).toBe(2);
    expect(bleed(critiqueDoc('aa', 'jambe').entries, 'aa-jambe-76')).toBe(1);
    expect(bleed(critiqueDoc('aa', 'bras').entries, 'aa-bras-91')).toBeUndefined();
  });
});
