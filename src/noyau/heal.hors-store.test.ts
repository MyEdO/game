import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { creditBourse } from './bourseFlow';
import { ouvrirLeMedecin } from './medicFlow';
import { bourseOf } from '../engine/bourse';
import type { Combatant } from '../engine/types';
import { availableHealModes } from '../engine/healing';
import { traumaById, dechirureFractureFicheId, avecSequelles } from '../engine/trauma';
import type { HitLocation } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const tk = (k: 'dechirure' | 'fracture', s: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, s, loc), opts, loc);
import { setRule, resetRule } from '../engine/policy';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

function hero(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  banc.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: 'soins', selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    } as any, // le Soin se commet depuis son mode armé (`HEAL_MODE`)
    pendingHeal: null,
  });
}

describe('Guérison — flux combat', () => {
  it('ouvrirLaGuerison → jetLancer@soins → jetValider@soins : soigne et pose le flag, consomme l’Action', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const wounded = hero({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } });
    setBattle([doc, wounded], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    expect(banc.getState().pendingHeal).not.toBeNull();
    banc.getState().jetLancer('soins');
    expect(banc.getState().pendingHeal!.roll).not.toBeNull();
    // fige un succès reproductible avant Appliquer
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 2 } });
    banc.getState().jetValider('soins');
    const al = banc.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.wounds.current).toBe(3 + 4 + 2); // +BI(4)+DR(2)
    expect(al.soinRencontreUtilise).toBe(true);
    expect(banc.getState().battle!.acted).toBe(true);
    expect(banc.getState().pendingHeal).toBeNull();
  });

  it('réglage heal.mode : surface unique — on cible sur la carte (mode défaut), on bascule Blessures ⇄ Hémorragie avant le jet, verrouillé après', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al'); // ciblage carte → mode par défaut
    expect(banc.getState().pendingHeal!.mode).toBe('blessures');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie'); // l'allié a les DEUX soins applicables → on bascule
    expect(banc.getState().pendingHeal!.mode).toBe('hemorragie');
    banc.getState().jetLancer('soins'); // dé lancé → choix verrouillé
    banc.getState().jetRegler('soins', 'mode', 'blessures');
    expect(banc.getState().pendingHeal!.mode).toBe('hemorragie'); // inchangé post-jet
  });

  it('réglage heal.mode : refuse un mode non applicable à la cible', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } }); // aucune Hémorragie
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie'); // indisponible (pas d'hémorragie) → ignoré
    expect(banc.getState().pendingHeal!.mode).toBe('blessures');
  });

  it('limite 1/rencontre : 2e « wounds » indisponible, « bleed » reste possible', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }], soinRencontreUtilise: true, pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al'); // l'acte d'ouverture saute les Blessures (déjà soigné cette rencontre)
    expect(banc.getState().pendingHeal!.mode).toBe('hemorragie');
    banc.getState().jetRegler('soins', 'mode', 'blessures'); // refusé
    expect(banc.getState().pendingHeal!.mode).toBe('hemorragie');
  });

  it('soigner un allié Inconscient le relève une fois > 0 PB (LDB 18 l.15)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const ko = hero({ id: 'ko', wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, ko], 'doc');
    banc.getState().ouvrirLaGuerison('ko');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 1 } });
    banc.getState().jetValider('soins');
    const k = banc.getState().battle!.combatants.find((c) => c.id === 'ko')!;
    expect(k.wounds.current).toBeGreaterThan(0);
    expect(k.conditions.find((c) => c.id === 'inconscient')).toBeUndefined();
  });

  it('ouvrirLaGuerison : difficulté du retrait d’Hémorragique — Intermédiaire (+0) en LDB, Accessible (+20) en variante AA (AA 07 l.9)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    expect(banc.getState().pendingHeal!.difficulty).toBe('intermediaire'); // mode LDB par défaut
    banc.setState({ pendingHeal: null, battle: { ...banc.getState().battle!, action: 'soins' } }); // re-armé

    try {
      setRule('combat-aa-blessures', 'aa');
      banc.getState().ouvrirLaGuerison('al');
      banc.getState().jetRegler('soins', 'mode', 'hemorragie');
      expect(banc.getState().pendingHeal!.difficulty).toBe('accessible');
      expect(banc.getState().pendingHeal!.target).toBe(banc.getState().pendingHeal!.skillValue + 20);
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('ouvrirLaGuerison : le soin de Blessures reste Intermédiaire (+0) en variante AA — seul le retrait d’Hémorragique change', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    try {
      setRule('combat-aa-blessures', 'aa');
      banc.getState().ouvrirLaGuerison('al');
      expect(banc.getState().pendingHeal!.difficulty).toBe('intermediaire');
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('réglage heal.mode : recalcule la difficulté au changement de mode (variante AA)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 2 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    try {
      setRule('combat-aa-blessures', 'aa');
      banc.getState().ouvrirLaGuerison('al');
      expect(banc.getState().pendingHeal!.difficulty).toBe('intermediaire');
      banc.getState().jetRegler('soins', 'mode', 'hemorragie');
      expect(banc.getState().pendingHeal!.difficulty).toBe('accessible');
      banc.getState().jetRegler('soins', 'mode', 'blessures');
      expect(banc.getState().pendingHeal!.difficulty).toBe('intermediaire');
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('réglage heal.mode : « ammo » proposé seulement si munition logée (LDB 62 l.250, #494)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 3), pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'munition'); // refusé : aucune munition logée
    expect(banc.getState().pendingHeal!.mode).toBe('blessures');
    banc.setState({ battle: { ...banc.getState().battle!, combatants: [doc, { ...t, conditions: [{ id: 'munition-logee', value: 1 }] }] } });
    banc.getState().jetRegler('soins', 'mode', 'munition');
    expect(banc.getState().pendingHeal!.mode).toBe('munition');
    expect(banc.getState().pendingHeal!.difficulty).toBe('intermediaire');
  });

  it('jetValider@soins (ammo) succès : la munition est retirée et le plafond de soin est relevé', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 10), conditions: [{ id: 'munition-logee', value: 1 }], pos: { x: 2, y: 1 } });
    const ennemi = hero({ id: 'e', kind: 'ennemi', pos: { x: 9, y: 9 } }); // le combat dure au-delà de la 1re Action
    setBattle([doc, t, ennemi], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'munition');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 0 } });
    banc.getState().jetValider('soins');
    const al = banc.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.id === 'munition-logee')).toBeUndefined();
    // plafond relevé : un soin de Blessures ultérieur peut atteindre le max complet
    al.soinRencontreUtilise = false;
    banc.setState({ battle: { ...banc.getState().battle!, acted: false, action: 'soins' } });
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 5 } });
    banc.getState().jetValider('soins');
    const al2 = banc.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al2.wounds.current).toBe(12); // max atteignable (munition retirée)
  });

  it('jetValider@soins (ammo) échec : rien n’est retiré', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12, 10), conditions: [{ id: 'munition-logee', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'munition');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: false, sl: -2 } });
    banc.getState().jetValider('soins');
    const al = banc.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.id === 'munition-logee')?.value).toBe(1);
  });

  it('jetValider@soins (bleed) : arrête l’hémorragie sans consommer la limite de soin', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: blessuresDeBase(12), conditions: [{ id: 'hemorragique', value: 3 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 1 } });
    banc.getState().jetValider('soins');
    const al = banc.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.id === 'hemorragique')?.value).toBe(1); // 3 − (1+1)
    expect(al.soinRencontreUtilise).toBeUndefined(); // bleed ne consomme pas la limite
  });
});

describe('Guérison — infirmerie (hors combat)', () => {
  it('ouvrirLeMedecin : le brouillon (Blessures) au meilleur soigneur du groupe, applique, la modale RESTE ouverte', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 4), skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('al');
    const ph = banc.getState().pendingHeal!;
    expect(ph.mode).toBe('blessures');
    expect(banc.getState().battle).toBeNull(); // contexte hors combat (résolution via party)
    expect(ph.healerId).toBe('doc');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 1 } });
    banc.getState().jetValider('soins');
    expect(banc.getState().party.find((c) => c.id === 'al')!.wounds.current).toBeGreaterThan(4);
    expect(banc.getState().medic).not.toBeNull(); // PERSISTANTE : on enchaîne actes et patients
    banc.getState().fenetreFermer('infirmerie');
    expect(banc.getState().medic).toBeNull();
    expect(banc.getState().pendingHeal).toBeNull(); // le brouillon part avec l'infirmerie
  });

  it('acte bleed hors combat : panse l’Hémorragie via l’infirmerie — Test de Guérison réussi retire l’État (LDB 09 l.261 / LDB 16 l.107-109), sans consommer le soin de Blessures de la rencontre', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Saigné', conditions: [{ id: 'hemorragique', value: 2 }], skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    const ph = banc.getState().pendingHeal!;
    expect(banc.getState().battle).toBeNull(); // résolu hors combat, via la party
    expect(ph.mode).toBe('hemorragie');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 1 } });
    banc.getState().jetValider('soins');
    const patient = banc.getState().party.find((c) => c.id === 'al')!;
    expect(patient.conditions.find((c) => c.id === 'hemorragique')).toBeUndefined(); // 2 pions − (1+1 DR)
    expect(patient.soinRencontreUtilise).toBeUndefined(); // l'arrêt d'Hémorragie ne consomme pas la limite
  });

  it('acte bleed hors combat : difficulté recalculée sur la variante AA (Aux Armes 07 l.9, hors combat inclus), Intermédiaire en LDB', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Saigné', conditions: [{ id: 'hemorragique', value: 2 }], skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    try {
      setRule('combat-aa-blessures', 'aa');
      banc.getState().ouvrirLeMedecin('al');
      banc.getState().jetRegler('soins', 'mode', 'hemorragie');
      expect(banc.getState().pendingHeal!.difficulty).toBe('accessible');
      resetRule('combat-aa-blessures');
      banc.getState().jetRegler('soins', 'mode', 'hemorragie'); // l'acte recalcule son soin
      expect(banc.getState().pendingHeal!.difficulty).toBe('intermediaire');
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('patients/sortie verrouillés pendant un jet posé', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', wounds: blessuresDeBase(12, 4), skills: [] });
    const bob = hero({ id: 'bob', wounds: blessuresDeBase(12, 2), skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al, bob], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('al');
    banc.getState().jetLancer('soins');
    banc.getState().fenetreChoisir('infirmerie', 'patient', 'bob'); // refusé : jet en cours
    expect(banc.getState().medic!.patientId).toBe('al');
    banc.getState().fenetreFermer('infirmerie'); // refusé aussi
    expect(banc.getState().medic).not.toBeNull();
  });

  it('mode trauma : la Guérison accélère la convalescence d’une déchirure (LDB 18 l.222)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], traumas: avecSequelles([], [tk('dechirure', 'mineur', 'jambeD', { be: 4 })]) }); // 26 j
    banc.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'traumatisme');
    expect(banc.getState().pendingHeal!.mode).toBe('traumatisme');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 2 } });
    banc.getState().jetValider('soins');
    const p = banc.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas![0].recoveryDays).toBe(26 - (1 + 2)); // −1 jour −1/DR
    expect(p.traumas![0].healAccelerated).toBe(true);
  });

  it('mode trauma : un ÉCHEC consomme aussi le jet — la même déchirure ne se re-traite pas (LDB 18 l.222)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], traumas: avecSequelles([], [tk('dechirure', 'mineur', 'jambeD', { be: 4 })]) }); // 26 j
    banc.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'traumatisme');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: false, sl: -2 } });
    banc.getState().jetValider('soins');
    const p = banc.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas![0].recoveryDays).toBe(26); // aucun bénéfice…
    expect(p.traumas![0].healAccelerated).toBe(true); // …mais le jet est consommé
    expect(availableHealModes(p)).not.toContain('traumatisme'); // l'acte n'est plus proposé
  });

  it('soin de Blessures : un jet RATÉ consomme le soin de la rencontre (LDB 09 l.233 : « un jet »)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 4), skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('al');
    banc.getState().jetRegler('soins', 'mode', 'blessures');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: false, sl: -1 } }); // BI+DR ≥ 0 : pas de dégâts
    banc.getState().jetValider('soins');
    const p = banc.getState().party.find((c) => c.id === 'al')!;
    expect(p.wounds.current).toBe(4); // rien gagné…
    expect(p.soinRencontreUtilise).toBe(true); // …mais le patient a eu SON jet de Guérison
    expect(banc.getState().pendingHeal).toBeNull(); // plus re-tentable cette rencontre : aucun acte, aucun brouillon
  });

  it('Guérison Échec Stupéfiant (DR ≤ −6) : le patient contracte une Infection Mineure (LDB 09-Compétences)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(12, 6) });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'blessures');
    banc.getState().jetLancer('soins');
    // fige un Échec Stupéfiant reproductible (DR −6) avant Appliquer.
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: false, sl: -6 } });
    banc.getState().jetValider('soins');
    const p = banc.getState().party.find((c) => c.id === 'p')!;
    expect(p.diseases?.some((d) => d.id === 'infection-mineure')).toBe(true);
  });

  it('Chirurgie ARMÉE : Test ÉTENDU INFLUENÇABLE (LDB 10 l.184 / 12 l.200) — passes (modale) jusqu’à la cible, retire le trauma (1d10 + Hémorragie/passe)', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(40), traumas: avecSequelles([], [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 })]) });
    banc.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    banc.getState().jetLancer('soins'); // ARME l'opération — chirurgien figé — et pose la 1re passe
    const sg0 = banc.getState().medic!.surgery!;
    expect(sg0.healerId).toBe('doc');
    expect(sg0.drCible).toBeGreaterThanOrEqual(5); // cible MJ 5-10 (LDB 10)
    expect(sg0.cumDR).toBe(0);
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().pendingSurgery?.roll).toBeNull(); // la passe posée, pas jetée
    // cible basse + compétence très haute → quelques passes suffisent (patient à 40 PB survit aux 1d10).
    banc.setState({ medic: { ...banc.getState().medic!, surgery: { ...sg0, drCible: 1, skill: 99 } } });
    for (let i = 0; i < 12 && banc.getState().medic?.surgery; i++) {
      banc.getState().jetLancer('chirurgie');     // jet de Médecine du chirurgien (influençable)
      banc.getState().jetValider('chirurgie');      // applique + cumule ; réouvre ou termine
    }
    const p = banc.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas!.length).toBe(0); // blessure chirurgicale réparée par le Test étendu
    expect(p.wounds.current).toBeLessThan(40); // 1d10 par passe
    expect(p.conditions.some((c) => c.id === 'hemorragique')).toBe(true);
    expect(banc.getState().medic).not.toBeNull(); // l'infirmerie reste ouverte après l'opération
    expect(banc.getState().pendingSurgery).toBeNull(); // la passe est fermée à la réussite
  });

  it('#2961 — Chirurgie : « Annuler la passe » ferme la passe avant son jet sans toucher l’opération ; après le jet, elle est sans effet ; « Arrêter l’opération » ferme les deux', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(40), traumas: avecSequelles([], [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 })]) });
    banc.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    banc.getState().jetLancer('soins');
    expect(banc.getState().pendingSurgery).not.toBeNull();
    banc.getState().jetAnnuler('chirurgie');
    expect(banc.getState().pendingSurgery).toBeNull();
    expect(banc.getState().medic?.surgery).toBeTruthy();
    expect(banc.getState().pendingHeal?.mode, 'le brouillon reprend l’opération armée').toBe('chirurgie');

    banc.getState().jetLancer('soins'); // reprend : rouvre la passe
    expect(banc.getState().pendingHeal).toBeNull();
    banc.getState().jetLancer('chirurgie');
    const jouee = banc.getState().pendingSurgery;
    expect(jouee?.roll).toEqual(expect.any(Number));
    banc.getState().jetAnnuler('chirurgie');
    expect(banc.getState().pendingSurgery).toBe(jouee);

    banc.getState().fenetreChoisir('infirmerie', 'abandon', true);
    expect(banc.getState().pendingSurgery).toBeNull();
    expect(banc.getState().medic?.surgery).toBeUndefined();
    expect(banc.getState().medic).not.toBeNull();
  });

  it('Chirurgie : à la cible atteinte, le Test d’infection du PATIENT est DIFFÉRÉ en étape cascade INFLUENÇABLE (Résistance +20, Menace : Maladie) — plus de jet silencieux, Infection non contractée avant l’influence', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(40), traumas: avecSequelles([], [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 })]) });
    banc.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null, pendingCascade: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    banc.getState().jetLancer('soins');
    const sg0 = banc.getState().medic!.surgery!;
    banc.setState({ medic: { ...banc.getState().medic!, surgery: { ...sg0, drCible: 1, skill: 99 } } });
    for (let i = 0; i < 12 && banc.getState().medic?.surgery; i++) {
      banc.getState().jetLancer('chirurgie');
      banc.getState().jetValider('chirurgie'); // à la cible : ouvre la cascade d'infection (aucun jet inline)
    }
    const pc = banc.getState().pendingCascade;
    expect(pc).not.toBeNull(); // le Test d'infection est une modale différée, pas un jet subi
    // #1117 L4 : la Contraction est une BANDE (ici d'un seul porteur) — sa possession EST son porteur.
    const bande = pc!.participants.find((s) => s.kind === 'maladieDeFinDeCombat' && s.actorId === 'p')!;
    expect(bande).toBeTruthy();
    const row = bande.participants!.find((r) => r.id === 'p')!;
    expect(row.result).toBeFalsy(); // Infection DIFFÉRÉE : pas encore roulée (influençable d'abord)
    expect(row.menace).toBe('maladie'); // Résistance (Menace : Maladie) offerte (LDB 10/17)
    expect((bande.meta as { disease?: string } | undefined)?.disease).toBe('infection-mineure');
    const p = banc.getState().party.find((c) => c.id === 'p')!;
    expect(p.diseases ?? []).toHaveLength(0); // rien contracté en silence AVANT la validation de l'étape
  });

  it('Chirurgie : le joueur choisit QUELLE Blessure Critique opérer (choix `infirmerie.plaie`, au brouillon puis avant la 1re passe)', () => {
    const surgeon = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    const patient = hero({
      id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(40),
      traumas: avecSequelles([], [tk('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 }), tk('fracture', 'majeur', 'brasD', { be: 4, d10: 5 })]),
    });
    banc.setState({ mode: 'exploration', battle: null, party: [surgeon, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    const brasD = patient.traumas!.find((t) => t.location === 'brasD')!;
    const jambeG = patient.traumas!.find((t) => t.location === 'jambeG')!;
    banc.getState().fenetreChoisir('infirmerie', 'plaie', brasD.uid); // au brouillon : opérer la blessure du brasD
    expect(banc.getState().pendingHeal!.plaie).toBe(brasD.uid);
    banc.getState().jetLancer('soins');
    expect(banc.getState().medic!.surgery!.traumaUid).toBe(brasD.uid);
    banc.getState().fenetreChoisir('infirmerie', 'plaie', jambeG.uid); // opération armée, avant la 1re passe
    expect(banc.getState().medic!.surgery!.traumaUid).toBe(jambeG.uid);
  });

  it('Récupération d’usage (« Épaule luxée », #166) : acte Guérison ARMÉ = Test ÉTENDU DR 6 (Accessible), retire le membre désactivé + pose −10 / 1d10 j, SANS dégât', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({
      id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(40),
      // Aide Médicale DÉJÀ reçue (awaitingMedicalAid absent) → la récupération est ouvrable (LDB 18 l.120).
      traumas: [{ uid: 't1', label: 'Épaule luxée (bras perdu)', location: 'brasD', drCible: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }], recoveryPenalty: [{ op: 'charMod', characteristic: 'capacite-de-combat', mod: -10 }] }],
    });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    expect(banc.getState().pendingHeal!.mode).toBe('reeducation');
    banc.getState().jetLancer('soins'); // ARME la rééducation et pose la 1re passe
    const sg0 = banc.getState().medic!.surgery!;
    expect(sg0.kind).toBe('reeducation');
    expect(sg0.difficulty).toBe('accessible'); // Test étendu de Guérison Accessible (+20), LDB 18 l.120/179
    expect(sg0.drCible).toBe(6);
    // compétence très haute → converge en quelques passes ; on garde la vraie cible DR 6.
    banc.setState({ medic: { ...banc.getState().medic!, surgery: { ...sg0, skill: 99 } } });
    for (let i = 0; i < 20 && banc.getState().medic?.surgery; i++) {
      banc.getState().jetLancer('chirurgie');
      banc.getState().jetValider('chirurgie');
    }
    const p = banc.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas!.some((t) => t.drCible != null)).toBe(false); // membre désactivé retiré (usage récupéré)
    expect(p.wounds.current).toBe(40); // récupération = Guérison pure : AUCUN dégât (≠ Chirurgie)
    expect(p.conditions.some((c) => c.id === 'hemorragique')).toBe(false);
    expect(p.activeEffects?.some((e) => e.characteristic === 'capacite-de-combat' && e.bonus === -10)).toBe(true); // pénalité −10 / 1d10 j posée
    expect(banc.getState().medic).not.toBeNull();
  });

  it('Récupération BLOQUÉE tant que l’Aide Médicale n’a pas été reçue (LDB 18 l.120/179 : « Après application de cette Aide… »)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const patient = hero({
      id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(40),
      traumas: [{ uid: 't2', label: 'Épaule luxée (bras perdu)', location: 'brasD', drCible: 6, awaitingMedicalAid: true, ops: [{ op: 'maxWeaponHands', hands: 1 }], recoveryPenalty: [{ op: 'charMod', characteristic: 'capacite-de-combat', mod: -10 }] }],
    });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null, pendingSurgery: null, medic: null });
    banc.getState().ouvrirLeMedecin('p');
    expect(banc.getState().pendingHeal).toBeNull(); // aucun acte ouvert : Aide Médicale requise d’abord
    banc.getState().jetLancer('soins');
    expect(banc.getState().medic!.surgery).toBeUndefined(); // ne s’arme pas
  });

  it('acte ammo hors combat : proposé seulement si munition logée, retire au succès (LDB 62 l.250, #494)', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', label: 'Percé', conditions: [{ id: 'munition-logee', value: 1 }], skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('al');
    banc.getState().jetRegler('soins', 'mode', 'munition');
    const ph = banc.getState().pendingHeal!;
    expect(ph.mode).toBe('munition');
    expect(ph.difficulty).toBe('intermediaire');
    banc.getState().jetLancer('soins');
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 0 } });
    banc.getState().jetValider('soins');
    const patient = banc.getState().party.find((c) => c.id === 'al')!;
    expect(patient.conditions.find((c) => c.id === 'munition-logee')).toBeUndefined();
  });

  it('acte ammo : indisponible sans munition logée', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const al = hero({ id: 'al', skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null, medic: null });
    banc.getState().ouvrirLeMedecin('al');
    banc.getState().jetRegler('soins', 'mode', 'munition');
    expect(banc.getState().pendingHeal!.mode).toBe('blessures');
  });

  it('PNJ payant : débit au lancer (DÉPENSE DE GROUPE), jamais au brouillon, qui ne s’annule pas', () => {
    const al = hero({ id: 'al', wounds: blessuresDeBase(12, 4), skills: [] });
    banc.setState({ mode: 'exploration', battle: null, party: [al], pendingHeal: null, medic: null });
    creditBourse(banc.getState, banc.setState, 'al', { gold: 0, silver: 10, brass: 0 }); // bourse du groupe (seul membre) = 10 pistoles
    const purse = () => bourseOf(banc.getState().party.find((h) => h.id === 'al')!);
    ouvrirLeMedecin(banc.getState, banc.setState, 'al', { id: 'med', label: fixtureText('Médecin'), skill: { id: 'guerison', value: 55 }, intBonus: 4, acts: [{ act: 'blessures', cost: { silver: 5 } }] });
    expect(banc.getState().pendingHeal!.healerName).toBe('Médecin');
    expect(purse().silver).toBe(10); // le brouillon ne coûte rien
    banc.getState().jetAnnuler('soins'); // fermé hors combat
    expect(purse().silver).toBe(10);
    expect(banc.getState().pendingHeal?.roll).toBeNull();
    banc.getState().jetLancer('soins');
    expect(purse().silver).toBe(5); // débité de la bourse du GROUPE (`payFromGroup`) au lancer de l'acte
    banc.setState({ pendingHeal: { ...banc.getState().pendingHeal!, success: true, sl: 1 } });
    banc.getState().jetValider('soins');
    expect(purse().silver).toBe(5);
  });

  it('arbitrage user 2026-07-20 : un patient FAUCHÉ est soigné si le GROUPE peut se cotiser', () => {
    const al = hero({ id: 'al', wounds: blessuresDeBase(12, 4), skills: [] }); // patient sans le sou
    const bob = hero({ id: 'bob', skills: [] }); // porte la bourse du groupe
    banc.setState({ mode: 'exploration', battle: null, party: [al, bob], pendingHeal: null, medic: null });
    creditBourse(banc.getState, banc.setState, 'bob', { gold: 0, silver: 10, brass: 0 });
    ouvrirLeMedecin(banc.getState, banc.setState, 'al', { id: 'med', label: fixtureText('Médecin'), skill: { id: 'guerison', value: 55 }, intBonus: 4, acts: [{ act: 'blessures', cost: { silver: 5 } }] });
    banc.getState().jetLancer('soins');
    // Le soin se lance MALGRÉ la bourse vide du patient : le groupe a payé.
    expect(banc.getState().pendingHeal!.healerName).toBe('Médecin');
    expect(bourseOf(banc.getState().party.find((h) => h.id === 'al')!).silver ?? 0).toBe(0);
    expect(bourseOf(banc.getState().party.find((h) => h.id === 'bob')!).silver).toBe(5);
  });
});
