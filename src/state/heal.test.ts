import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { creditBourse } from '../noyau/bourseFlow';
import { bourseOf } from '../engine/bourse';
import type { Combatant } from '../engine/types';
import { availableHealModes } from '../engine/healing';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import type { HitLocation } from '../engine/types';
const tk = (k: 'dechirure' | 'fracture', s: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, s, loc), opts, loc);
import { seedBattleRng } from '../noyau/battleRng';
import { setRule, resetRule } from '../engine/policy';

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Doc', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    } as any,
    pendingHeal: null,
  });
}

describe('Guérison — flux combat', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('battleHeal → healRoll → healConfirm : soigne et pose le flag, consomme l’Action', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const wounded = hero({ id: 'al', label: 'Blessé', wounds: { current: 3, max: 12 }, pos: { x: 2, y: 1 } });
    setBattle([doc, wounded], 'doc');
    useGame.getState().battleHeal('al', 'wounds');
    expect(useGame.getState().pendingHeal).not.toBeNull();
    useGame.getState().healRoll();
    expect(useGame.getState().pendingHeal!.roll).not.toBeNull();
    // fige un succès reproductible avant Appliquer
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 2 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.wounds.current).toBe(3 + 4 + 2); // +BI(4)+DR(2)
    expect(al.soinRencontreUtilise).toBe(true);
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingHeal).toBeNull();
  });

  it('healSetMode : surface unique — on cible sur la carte (mode défaut), on bascule Blessures ⇄ Hémorragie avant le jet, verrouillé après', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'wounds'); // ciblage carte → mode par défaut
    expect(useGame.getState().pendingHeal!.mode).toBe('wounds');
    useGame.getState().healSetMode('bleed'); // l'allié a les DEUX soins applicables → on bascule
    expect(useGame.getState().pendingHeal!.mode).toBe('bleed');
    useGame.getState().healRoll(); // dé lancé → choix verrouillé
    useGame.getState().healSetMode('wounds');
    expect(useGame.getState().pendingHeal!.mode).toBe('bleed'); // inchangé post-jet
  });

  it('healSetMode : refuse un mode non applicable à la cible', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, pos: { x: 2, y: 1 } }); // aucune Hémorragie
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'wounds');
    useGame.getState().healSetMode('bleed'); // indisponible (pas d'hémorragie) → ignoré
    expect(useGame.getState().pendingHeal!.mode).toBe('wounds');
  });

  it('limite 1/rencontre : 2e « wounds » indisponible, « bleed » reste possible', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }], soinRencontreUtilise: true, pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'wounds'); // refusé (déjà soigné cette rencontre)
    expect(useGame.getState().pendingHeal).toBeNull();
    useGame.getState().battleHeal('al', 'bleed'); // accepté
    expect(useGame.getState().pendingHeal!.mode).toBe('bleed');
  });

  it('soigner un allié Inconscient le relève une fois > 0 PB (LDB 18 l.15)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const ko = hero({ id: 'ko', wounds: { current: 0, max: 12 }, conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, ko], 'doc');
    useGame.getState().battleHeal('ko', 'wounds');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    const k = useGame.getState().battle!.combatants.find((c) => c.id === 'ko')!;
    expect(k.wounds.current).toBeGreaterThan(0);
    expect(k.conditions.find((c) => c.id === 'inconscient')).toBeUndefined();
  });

  it('battleHeal : difficulté du retrait d’Hémorragique — Intermédiaire (+0) en LDB, Accessible (+20) en variante AA (AA 07 l.9)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'bleed');
    expect(useGame.getState().pendingHeal!.difficulty).toBe('intermediaire'); // mode LDB par défaut
    useGame.setState({ pendingHeal: null });

    try {
      setRule('combat-aa-blessures', 'aa');
      useGame.getState().battleHeal('al', 'bleed');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('accessible');
      expect(useGame.getState().pendingHeal!.target).toBe(useGame.getState().pendingHeal!.skillValue + 20);
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('battleHeal : le soin de Blessures reste Intermédiaire (+0) en variante AA — seul le retrait d’Hémorragique change', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    try {
      setRule('combat-aa-blessures', 'aa');
      useGame.getState().battleHeal('al', 'wounds');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('intermediaire');
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('healSetMode : recalcule la difficulté au changement de mode (variante AA)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    try {
      setRule('combat-aa-blessures', 'aa');
      useGame.getState().battleHeal('al', 'wounds');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('intermediaire');
      useGame.getState().healSetMode('bleed');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('accessible');
      useGame.getState().healSetMode('wounds');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('intermediaire');
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('battleHeal : « ammo » proposé seulement si munition logée (LDB 62 l.250, #494)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'ammo'); // refusé : aucune munition logée
    expect(useGame.getState().pendingHeal).toBeNull();
    useGame.setState({ battle: { ...useGame.getState().battle!, combatants: [doc, { ...t, conditions: [{ id: 'munition-logee', value: 1 }] }] } });
    useGame.getState().battleHeal('al', 'ammo');
    expect(useGame.getState().pendingHeal!.mode).toBe('ammo');
    expect(useGame.getState().pendingHeal!.difficulty).toBe('intermediaire');
  });

  it('healConfirm (ammo) succès : la munition est retirée et le plafond de soin est relevé', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 10, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'ammo');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 0 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.id === 'munition-logee')).toBeUndefined();
    // plafond relevé : un soin de Blessures ultérieur peut désormais atteindre le max complet
    al.soinRencontreUtilise = false;
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false, action: null } });
    useGame.getState().battleHeal('al', 'wounds');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 5 } });
    useGame.getState().healConfirm();
    const al2 = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al2.wounds.current).toBe(12); // max atteignable (munition retirée)
  });

  it('healConfirm (ammo) échec : rien n’est retiré', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 10, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'ammo');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: false, sl: -2 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.id === 'munition-logee')?.value).toBe(1);
  });

  it('healConfirm (bleed) : arrête l’hémorragie sans consommer la limite de soin', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 12, max: 12 }, conditions: [{ id: 'hemorragique', value: 3 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'bleed');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.id === 'hemorragique')?.value).toBe(1); // 3 − (1+1)
    expect(al.soinRencontreUtilise).toBeUndefined(); // bleed ne consomme pas la limite
  });
});

describe('Guérison — infirmerie (hors combat)', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('openMedic + medicAct(wounds) : meilleur soigneur du groupe, applique, la modale RESTE ouverte', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Blessé', wounds: { current: 4, max: 12 }, skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'al' });
    useGame.getState().medicAct('wounds');
    const ph = useGame.getState().pendingHeal!;
    expect(useGame.getState().battle).toBeNull(); // contexte hors combat (résolution via party)
    expect(ph.healerId).toBe('doc');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    expect(useGame.getState().party.find((c) => c.id === 'al')!.wounds.current).toBeGreaterThan(4);
    expect(useGame.getState().medic).not.toBeNull(); // PERSISTANTE : on enchaîne actes et patients
    useGame.getState().closeMedic();
    expect(useGame.getState().medic).toBeNull();
  });

  it('medicAct(bleed) hors combat : panse l’Hémorragie via l’infirmerie — Test de Guérison réussi retire l’État (LDB 09 l.261 / LDB 16 l.107-109), sans consommer le soin de Blessures de la rencontre', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Saigné', conditions: [{ id: 'hemorragique', value: 2 }], skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'al' });
    useGame.getState().medicAct('bleed');
    const ph = useGame.getState().pendingHeal!;
    expect(useGame.getState().battle).toBeNull(); // résolu hors combat, via la party
    expect(ph.mode).toBe('bleed');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    const patient = useGame.getState().party.find((c) => c.id === 'al')!;
    expect(patient.conditions.find((c) => c.id === 'hemorragique')).toBeUndefined(); // 2 pions − (1+1 DR)
    expect(patient.soinRencontreUtilise).toBeUndefined(); // l'arrêt d'Hémorragie ne consomme pas la limite
  });

  it('medicAct(bleed) hors combat : difficulté recalculée sur la variante AA (Aux Armes 07 l.9, hors combat inclus), Intermédiaire en LDB', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Saigné', conditions: [{ id: 'hemorragique', value: 2 }], skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    try {
      setRule('combat-aa-blessures', 'aa');
      useGame.getState().openMedic({ patientId: 'al' });
      useGame.getState().medicAct('bleed');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('accessible');
      useGame.getState().healCancel();
      resetRule('combat-aa-blessures');
      useGame.getState().medicAct('bleed');
      expect(useGame.getState().pendingHeal!.difficulty).toBe('intermediaire');
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('patients/sortie verrouillés pendant un jet posé', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', wounds: { current: 4, max: 12 }, skills: [] });
    const bob = hero({ id: 'bob', wounds: { current: 2, max: 12 }, skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al, bob], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'al' });
    useGame.getState().medicAct('wounds');
    useGame.getState().medicSelectPatient('bob'); // refusé : jet en cours
    expect(useGame.getState().medic!.patientId).toBe('al');
    useGame.getState().closeMedic(); // refusé aussi
    expect(useGame.getState().medic).not.toBeNull();
  });

  it('mode trauma : la Guérison accélère la convalescence d’une déchirure (LDB 18 l.222)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], traumas: [tk('dechirure', 'mineur', 'jambeD', { be: 4 })] }); // 26 j
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('trauma');
    expect(useGame.getState().pendingHeal!.mode).toBe('trauma');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 2 } });
    useGame.getState().healConfirm();
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas![0].recoveryDays).toBe(26 - (1 + 2)); // −1 jour −1/DR
    expect(p.traumas![0].healAccelerated).toBe(true);
  });

  it('mode trauma : un ÉCHEC consomme aussi le jet — la même déchirure ne se re-traite pas (LDB 18 l.222)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], traumas: [tk('dechirure', 'mineur', 'jambeD', { be: 4 })] }); // 26 j
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('trauma');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: false, sl: -2 } });
    useGame.getState().healConfirm();
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas![0].recoveryDays).toBe(26); // aucun bénéfice…
    expect(p.traumas![0].healAccelerated).toBe(true); // …mais le jet est consommé
    expect(availableHealModes(p)).not.toContain('trauma'); // l'acte n'est plus proposé
  });

  it('soin de Blessures : un jet RATÉ consomme le soin de la rencontre (LDB 09 l.233 : « un jet »)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Blessé', wounds: { current: 4, max: 12 }, skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'al' });
    useGame.getState().medicAct('wounds');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: false, sl: -1 } }); // BI+DR ≥ 0 : pas de dégâts
    useGame.getState().healConfirm();
    const p = useGame.getState().party.find((c) => c.id === 'al')!;
    expect(p.wounds.current).toBe(4); // rien gagné…
    expect(p.soinRencontreUtilise).toBe(true); // …mais le patient a eu SON jet de Guérison
    useGame.getState().medicAct('wounds'); // refusé : plus re-tentable cette rencontre
    expect(useGame.getState().pendingHeal).toBeNull();
  });

  it('Guérison Échec Stupéfiant (DR ≤ −6) : le patient contracte une Infection Mineure (LDB 09-Compétences)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: { current: 6, max: 12 } });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('wounds');
    useGame.getState().healRoll();
    // fige un Échec Stupéfiant reproductible (DR −6) avant Appliquer.
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: false, sl: -6 } });
    useGame.getState().healConfirm();
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.diseases?.some((d) => d.id === 'infection-mineure')).toBe(true);
  });

  it('Chirurgie ARMÉE : Test ÉTENDU INFLUENÇABLE (LDB 10 l.184 / 12 l.200) — passes (modale) jusqu’à la cible, retire le trauma (1d10 + Hémorragie/passe)', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: { current: 40, max: 40 }, traumas: [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 })] });
    useGame.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('surgery'); // ARME l'opération (pas de jet) — chirurgien figé
    const sg0 = useGame.getState().medic!.surgery!;
    expect(sg0.healerId).toBe('doc');
    expect(sg0.targetDR).toBeGreaterThanOrEqual(5); // cible MJ 5-10 (LDB 10)
    expect(sg0.cumDR).toBe(0);
    expect(useGame.getState().pendingHeal).toBeNull();
    expect(useGame.getState().pendingSurgery).toBeNull(); // armer ≠ poser la passe
    // cible basse + compétence très haute → quelques passes suffisent (patient à 40 PB survit aux 1d10).
    useGame.setState({ medic: { ...useGame.getState().medic!, surgery: { ...sg0, targetDR: 1, skill: 99 } } });
    for (let i = 0; i < 12 && useGame.getState().medic?.surgery; i++) {
      useGame.getState().openSurgeryPass(); // POSE la passe (no-op si déjà posée par la réouverture)
      useGame.getState().surgeryRoll();     // jet de Médecine du chirurgien (influençable)
      useGame.getState().surgeryNext();      // applique + cumule ; réouvre ou termine
    }
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas!.length).toBe(0); // blessure chirurgicale réparée par le Test étendu
    expect(p.wounds.current).toBeLessThan(40); // 1d10 par passe
    expect(p.conditions.some((c) => c.id === 'hemorragique')).toBe(true);
    expect(useGame.getState().medic).not.toBeNull(); // l'infirmerie reste ouverte après l'opération
    expect(useGame.getState().pendingSurgery).toBeNull(); // la passe est fermée à la réussite
  });

  it('Chirurgie : à la cible atteinte, le Test d’infection du PATIENT est DIFFÉRÉ en étape cascade INFLUENÇABLE (Résistance +20, Menace : Maladie) — plus de jet silencieux, Infection non contractée avant l’influence', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: { current: 40, max: 40 }, traumas: [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 })] });
    useGame.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null, pendingCascade: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('surgery');
    const sg0 = useGame.getState().medic!.surgery!;
    useGame.setState({ medic: { ...useGame.getState().medic!, surgery: { ...sg0, targetDR: 1, skill: 99 } } });
    for (let i = 0; i < 12 && useGame.getState().medic?.surgery; i++) {
      useGame.getState().openSurgeryPass();
      useGame.getState().surgeryRoll();
      useGame.getState().surgeryNext(); // à la cible : ouvre la cascade d'infection (ne roule PLUS inline)
    }
    const pc = useGame.getState().pendingCascade;
    expect(pc).not.toBeNull(); // le Test d'infection est une modale différée, pas un jet subi
    // #1117 L4 : la Contraction est une BANDE (ici d'un seul porteur) — sa possession EST son porteur.
    const bande = pc!.participants.find((s) => s.kind === 'combatEndDisease' && s.actorId === 'p')!;
    expect(bande).toBeTruthy();
    const row = bande.participants!.find((r) => r.id === 'p')!;
    expect(row.result).toBeFalsy(); // Infection DIFFÉRÉE : pas encore roulée (influençable d'abord)
    expect(row.menace).toBe('maladie'); // Résistance (Menace : Maladie) offerte (LDB 10/17)
    expect((bande.meta as { disease?: string } | undefined)?.disease).toBe('infection-mineure');
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.diseases ?? []).toHaveLength(0); // rien contracté en silence AVANT la validation de l'étape
  });

  it('Chirurgie : le joueur choisit QUELLE Blessure Critique opérer (medicSetWound, avant la 1re passe)', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({
      id: 'p', label: 'Patient', skills: [], wounds: { current: 40, max: 40 },
      traumas: [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 }), tk('fracture', 'majeur', 'brasD', { be: 4, d10: 5 })],
    });
    useGame.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('surgery');
    useGame.getState().medicSetWound(1); // opérer la 2e blessure (brasD)
    expect(useGame.getState().medic!.surgery!.traumaIdx).toBe(1);
  });

  it('Récupération d’usage (« Épaule luxée », #166) : acte Guérison ARMÉ = Test ÉTENDU DR 6 (Accessible), retire le membre désactivé + pose −10 / 1d10 j, SANS dégât', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({
      id: 'p', label: 'Patient', skills: [], wounds: { current: 40, max: 40 },
      // Aide Médicale DÉJÀ reçue (awaitingMedicalAid absent) → la récupération est ouvrable (LDB 18 l.120).
      traumas: [{ label: 'Épaule luxée (bras perdu)', location: 'brasD', restoreDR: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }], recoveryPenalty: [{ op: 'charMod', char: 'capacite-de-combat', mod: -10 }] }],
    });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('recovery'); // ARME la rééducation (pas de jet)
    const sg0 = useGame.getState().medic!.surgery!;
    expect(sg0.kind).toBe('recovery');
    expect(sg0.difficulty).toBe('accessible'); // Test étendu de Guérison Accessible (+20), LDB 18 l.120/179
    expect(sg0.targetDR).toBe(6);
    // compétence très haute → converge en quelques passes ; on garde la vraie cible DR 6.
    useGame.setState({ medic: { ...useGame.getState().medic!, surgery: { ...sg0, skill: 99 } } });
    for (let i = 0; i < 20 && useGame.getState().medic?.surgery; i++) {
      useGame.getState().openSurgeryPass();
      useGame.getState().surgeryRoll();
      useGame.getState().surgeryNext();
    }
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas!.some((t) => t.restoreDR != null)).toBe(false); // membre désactivé retiré (usage récupéré)
    expect(p.wounds.current).toBe(40); // récupération = Guérison pure : AUCUN dégât (≠ Chirurgie)
    expect(p.conditions.some((c) => c.id === 'hemorragique')).toBe(false);
    expect(p.activeEffects?.some((e) => e.char === 'capacite-de-combat' && e.bonus === -10)).toBe(true); // pénalité −10 / 1d10 j posée
    expect(useGame.getState().medic).not.toBeNull();
  });

  it('Récupération BLOQUÉE tant que l’Aide Médicale n’a pas été reçue (LDB 18 l.120/179 : « Après application de cette Aide… »)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({
      id: 'p', label: 'Patient', skills: [], wounds: { current: 40, max: 40 },
      traumas: [{ label: 'Épaule luxée (bras perdu)', location: 'brasD', restoreDR: 6, awaitingMedicalAid: true, ops: [{ op: 'maxWeaponHands', hands: 1 }], recoveryPenalty: [{ op: 'charMod', char: 'capacite-de-combat', mod: -10 }] }],
    });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    useGame.getState().openMedic({ patientId: 'p' });
    useGame.getState().medicAct('recovery');
    expect(useGame.getState().medic!.surgery).toBeUndefined(); // ne s’arme pas : Aide Médicale requise d’abord
  });

  it('medicAct(ammo) hors combat : proposé seulement si munition logée, retire au succès (LDB 62 l.250, #494)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Percé', conditions: [{ id: 'munition-logee', value: 1 }], skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'al' });
    useGame.getState().medicAct('ammo');
    const ph = useGame.getState().pendingHeal!;
    expect(ph.mode).toBe('ammo');
    expect(ph.difficulty).toBe('intermediaire');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 0 } });
    useGame.getState().healConfirm();
    const patient = useGame.getState().party.find((c) => c.id === 'al')!;
    expect(patient.conditions.find((c) => c.id === 'munition-logee')).toBeUndefined();
  });

  it('medicAct(ammo) : indisponible sans munition logée', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    useGame.getState().openMedic({ patientId: 'al' });
    useGame.getState().medicAct('ammo');
    expect(useGame.getState().pendingHeal).toBeNull();
  });

  it('PNJ payant : débit à l’acte (DÉPENSE DE GROUPE), remboursé si on annule AVANT le jet', () => {
    const al = hero({ id: 'al', wounds: { current: 4, max: 12 }, skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [al], pendingHeal: null, medic: null });
    creditBourse(useGame.getState, useGame.setState, 'al', { gold: 0, silver: 10, brass: 0 }); // bourse du groupe (seul membre) = 10 pistoles
    const purse = () => bourseOf(useGame.getState().party.find((h) => h.id === 'al')!);
    useGame.getState().openMedic({ npc: { id: 'med', label: 'Médecin', skill: { id: 'guerison', value: 55 }, intBonus: 4, acts: [{ act: 'wounds', cost: { silver: 5 } }] }, patientId: 'al' });
    useGame.getState().medicAct('wounds');
    expect(purse().silver).toBe(5); // débité de la bourse du GROUPE (`payFromGroup`) au lancement de l'acte
    expect(useGame.getState().pendingHeal!.healerName).toBe('Médecin');
    useGame.getState().healCancel(); // avant le jet → remboursé au groupe
    expect(purse().silver).toBe(10);
    // relance et va au bout : pas de remboursement
    useGame.getState().medicAct('wounds');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    expect(purse().silver).toBe(5);
  });

  it('arbitrage user 2026-07-20 : un patient FAUCHÉ est soigné si le GROUPE peut se cotiser', () => {
    const al = hero({ id: 'al', wounds: { current: 4, max: 12 }, skills: [] }); // patient sans le sou
    const bob = hero({ id: 'bob', skills: [] }); // porte la bourse du groupe
    useGame.setState({ mode: 'exploration', battle: null, party: [al, bob], pendingHeal: null, medic: null });
    creditBourse(useGame.getState, useGame.setState, 'bob', { gold: 0, silver: 10, brass: 0 });
    useGame.getState().openMedic({ npc: { id: 'med', label: 'Médecin', skill: { id: 'guerison', value: 55 }, intBonus: 4, acts: [{ act: 'wounds', cost: { silver: 5 } }] }, patientId: 'al' });
    useGame.getState().medicAct('wounds');
    // Le soin s'arme MALGRÉ la bourse vide du patient : le groupe a payé.
    expect(useGame.getState().pendingHeal!.healerName).toBe('Médecin');
    expect(bourseOf(useGame.getState().party.find((h) => h.id === 'al')!).silver ?? 0).toBe(0);
    expect(bourseOf(useGame.getState().party.find((h) => h.id === 'bob')!).silver).toBe(5);
  });
});
