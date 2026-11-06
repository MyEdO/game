/**
 * ACTE DE SOIN DE L'INFIRMERIE (#3059 L3) : le geste `medicAct` lit en tête le verdict `refusDActeDeSoin`
 * (`medicFlow.ts`) — un acte qu'il refuse se DIT (`refuserGesteDuSiege`, journal hors combat), au siège
 * qui a agi ; un acte que le verdict ouvre s'arme ou pose son jet. Une raison par cas, oracle littéral.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { initialNet } from './etat';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { creditBourse } from './bourseFlow';
import { currentTargetingMode } from './targetingModes';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import type { Combatant } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { MedicNpc } from './medicFlow';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function hero(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

const BARBIER: MedicNpc = { id: 'barbier', label: 'Barbier', skill: { id: 'guerison', value: 50 }, intBonus: 3, acts: [{ act: 'wounds', cost: { gold: 5 } }] };
const chirurgien = () => hero({ id: 'doc', talents: [{ talentId: 'chirurgie', times: 1 }] });
const saignant = (p: Partial<Combatant> = {}) => hero({ id: 'p', label: 'Patient', skills: [], conditions: [{ id: 'hemorragique', value: 1 }], ...p });

/** Pose le groupe et l'infirmerie sur `patientId`, journal vide. */
function poser(party: Combatant[], medic: Partial<{ npc: MedicNpc; surgery: unknown }> = {}): void {
  banc.setState({ mode: 'exploration', battle: null, party, pendingHeal: null, pendingSurgery: null, medic: { patientId: 'p', ...medic } as never, journal: [] });
}
const dernierRefus = () => banc.getState().journal[banc.getState().journal.length - 1];

describe('medicAct lit refusDActeDeSoin', () => {
  it('Hémorragie verrouillée par Chirurgie, chirurgien présent : « Opérer » arme l’opération', () => {
    poser([chirurgien(), saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().medicAct('surgery');
    expect(banc.getState().medic?.surgery?.kind).toBe('surgery');
    expect(banc.getState().medic?.surgery?.healerId).toBe('doc');
    expect(banc.getState().journal).toEqual([]);
  });

  it('PNJ à 5 co, bourse vide : refusé, dit « Le groupe n’a pas assez d’argent pour cet acte. »', () => {
    poser([hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(12, 4) })], { npc: BARBIER });
    banc.getState().medicAct('wounds');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(dernierRefus()).toBe('Le groupe n’a pas assez d’argent pour cet acte.');
  });

  it('jet posé : refusé, dit « Un jet de soin est déjà posé. »', () => {
    poser([hero({ id: 'doc' }), saignant()]);
    banc.getState().medicAct('bleed');
    const pose = banc.getState().pendingHeal;
    expect(pose?.mode).toBe('bleed');
    banc.getState().medicAct('bleed');
    expect(banc.getState().pendingHeal).toBe(pose);
    expect(dernierRefus()).toBe('Un jet de soin est déjà posé.');
  });

  it('opération en cours : la Chirurgie refusée, dit « Une opération est en cours. »', () => {
    poser([chirurgien(), saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().medicAct('surgery');
    const armee = banc.getState().medic?.surgery;
    banc.getState().medicAct('surgery');
    expect(banc.getState().medic?.surgery).toBe(armee);
    expect(dernierRefus()).toBe('Une opération est en cours.');
  });

  it('Rééducation sans Aide Médicale : refusée, dit « Aide Médicale requise avant de rééduquer le membre. »', () => {
    poser([hero({ id: 'doc' }), hero({ id: 'p', label: 'Patient', skills: [], traumas: [{ label: 'Épaule luxée', location: 'brasD', restoreDR: 6, awaitingMedicalAid: true, ops: [] }] })]);
    banc.getState().medicAct('recovery');
    expect(banc.getState().medic?.surgery).toBeUndefined();
    expect(dernierRefus()).toBe('Aide Médicale requise avant de rééduquer le membre.');
  });

  it('offre du PNJ absente : refusée, dit « Barbier ne propose pas cet acte. »', () => {
    poser([saignant()], { npc: BARBIER });
    banc.getState().medicAct('bleed');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(dernierRefus()).toBe('Barbier ne propose pas cet acte.');
  });

  it('aucun chirurgien au groupe : la Chirurgie refusée, dit « Aucun soigneur du groupe n’a le Talent Chirurgie. »', () => {
    poser([hero({ id: 'doc' }), saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().medicAct('surgery');
    expect(banc.getState().medic?.surgery).toBeUndefined();
    expect(dernierRefus()).toBe('Aucun soigneur du groupe n’a le Talent Chirurgie.');
  });

  it('aucun soigneur au groupe : refusé, dit « Aucun membre du groupe ne peut tenter un Test de Guérison. »', () => {
    poser([saignant()]);
    banc.getState().medicAct('bleed');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(dernierRefus()).toBe('Aucun membre du groupe ne peut tenter un Test de Guérison.');
  });

  it('raison du patient : Blessures pleines, dit « Blessures au maximum »', () => {
    poser([hero({ id: 'doc' }), saignant()]);
    banc.getState().medicAct('wounds');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(dernierRefus()).toBe('Blessures au maximum');
  });

  it('passe de Chirurgie posée : Bander refusé, dit « Un jet de soin est déjà posé. »', () => {
    poser([chirurgien(), saignant({ wounds: blessuresDeBase(12, 6), conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().medicAct('surgery');
    banc.getState().openSurgeryPass();
    expect(banc.getState().pendingSurgery).not.toBeNull();
    banc.getState().medicAct('wounds');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(dernierRefus()).toBe('Un jet de soin est déjà posé.');
  });

  it('hors combat, l’acte du jet posé ne se change pas : Bander reste Bander, dit « À l’infirmerie, l’acte se choisit avant le jet. »', () => {
    const p = saignant({ wounds: blessuresDeBase(12, 4), conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] });
    poser([p], { npc: BARBIER });
    creditBourse(banc.getState, banc.setState, 'p', { gold: 5, silver: 0, brass: 0 });
    banc.getState().medicAct('wounds');
    expect(banc.getState().pendingHeal?.mode).toBe('wounds');
    banc.getState().jetRegler('heal', 'mode', 'bleed');
    banc.getState().jetRegler('heal', 'mode', 'surgery');
    expect(banc.getState().pendingHeal?.mode).toBe('wounds');
    expect(dernierRefus()).toBe('À l’infirmerie, l’acte se choisit avant le jet.');
  });

  it('coop : l’acte refusé d’un invité ne se dit pas au journal de l’hôte', () => {
    poser([hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(12, 4) })], { npc: BARBIER });
    banc.setState({ net: { ...initialNet(), mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { p: 1 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } } } as never);
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'medicAct', ['wounds'])).toBe('appliquee');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().journal).toEqual([]);
  });
});

/** `doc` (Guérison) au tour face à `al`, adjacent, porteur d'une Hémorragie verrouillée par Chirurgie ; `doc`
 *  appartient au siège 1 (l'invité) quand ce client est l'hôte. */
function poserLeCombat(netMode: 'host' | 'local'): void {
  seedBattleRng(1);
  const doc = hero({ id: 'doc', pos: { x: 5, y: 5 } });
  const al = hero({ id: 'al', label: 'Blessé', skills: [], wounds: blessuresDeBase(12, 6), conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }], pos: { x: 6, y: 5 } });
  const order = ['doc', 'al'];
  banc.setState({
    mode: 'battle', scene: testScene(), party: [doc, al],
    battle: { combatants: [doc, al], order, baseOrder: order, turn: 0, round: 1, action: 'heal', selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
    pendingHeal: null, refus: null,
    net: netMode === 'host'
      ? { ...initialNet(), mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { doc: 1, al: 0 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } }
      : initialNet(),
  } as never);
}

describe('battleHeal lit le filtre de combat', () => {
  it('Chirurgie demandée en combat : refusée, dit « Ce soin ne se pratique pas en combat. »', () => {
    poserLeCombat('local');
    banc.getState().battleHeal('al', 'surgery');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus?.texte).toBe('Ce soin ne se pratique pas en combat.');
  });

  it('Chirurgie demandée en combat par un invité : `battleHeal` est de la machinerie, hors allowlist, sans effet ni bandeau', () => {
    poserLeCombat('host');
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'battleHeal', ['al', 'surgery'])).toBe('hors-allowlist');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus).toBeNull();
  });

  it('ciblage : un allié déjà soigné cette rencontre, ou à la seule déchirure, n’est pas candidat ; son clic dit le refus', () => {
    poserLeCombat('local');
    const dejaSoigne = hero({ id: 'a', label: 'Soigné', skills: [], wounds: blessuresDeBase(12, 5), soinRencontreUtilise: true, pos: { x: 5, y: 6 } });
    const dechire = hero({ id: 'b', label: 'Déchiré', skills: [], traumas: [traumaById(dechirureFractureFicheId('dechirure', 'mineur', 'brasG'), { be: 4, d10: 5 }, 'brasG')], pos: { x: 4, y: 5 } });
    const b0 = banc.getState().battle!;
    const order = [...b0.order, 'a', 'b'];
    banc.setState({ battle: { ...b0, combatants: [...b0.combatants, dejaSoigne, dechire], order, baseOrder: order } } as never);
    const mode = currentTargetingMode(banc.getState);
    const doc = banc.getState().battle!.combatants.find((c) => c.id === 'doc')!;
    expect(mode.candidates!(banc.getState, doc).map((c) => c.id).sort()).toEqual(['al']);
    expect(mode.affordance!(banc.getState, doc, banc.getState().battle!.combatants.find((c) => c.id === 'b')!)).toEqual({ kind: 'invalid', reason: 'sans-soin-de-combat' });
    banc.getState().battleClickEntity('a');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus?.texte).toBe('A déjà reçu son soin de Blessures (une fois par rencontre)');
    banc.getState().battleClickEntity('b');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus?.texte).toBe('Blessures au maximum');
  });

  it('Hémorragie demandée en combat : le jet se pose', () => {
    poserLeCombat('local');
    banc.getState().battleHeal('al', 'bleed');
    expect(banc.getState().pendingHeal?.mode).toBe('bleed');
  });
});
