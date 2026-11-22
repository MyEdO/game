/**
 * ACTE DE SOIN DE L'INFIRMERIE (#3059 L3, #3612) : l'acte se règle par `jetRegler('soins', 'mode')` sur le brouillon que
 * la transition du jeu tient, jugé par `refusDuModeDuSoin` (hors combat : `refusDeLActeALInfirmerie`, `acteDeSoin.ts`) —
 * un acte refusé se DIT (journal hors combat), au siège qui a agi ; `jetLancer('soins')` pose le jet ou arme
 * l'opération. Une raison par cas, oracle littéral.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { initialNet } from './etat';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { creditBourse } from './bourseFlow';
import { currentTargetingMode } from './targetingModes';
import { traumaById, dechirureFractureFicheId, avecSequelles } from '../engine/trauma';
import type { Combatant } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { refusDeLActeALInfirmerie, type MedicNpc } from './acteDeSoin';
import { intentAllowedFor } from './netOwnership';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function hero(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

const BARBIER: MedicNpc = { id: 'barbier', label: fixtureText('Barbier'), skill: { id: 'guerison', value: 50 }, intBonus: 3, acts: [{ act: 'blessures', cost: { gold: 5 } }] };
const chirurgien = () => hero({ id: 'doc', talents: [{ talentId: 'chirurgie', times: 1 }] });
const saignant = (p: Partial<Combatant> = {}) => hero({ id: 'p', label: 'Patient', skills: [], conditions: [{ id: 'hemorragique', value: 1 }], ...p });

/** Pose le groupe et l'infirmerie sur `patientId`, journal vide. */
function poser(party: Combatant[], medic: Partial<{ npc: MedicNpc; surgery: unknown }> = {}): void {
  banc.setState({ mode: 'exploration', battle: null, party, pendingHeal: null, pendingSurgery: null, medic: { patientId: 'p', ...medic } as never, journal: [] });
}
const dernierRefus = () => banc.getState().journal[banc.getState().journal.length - 1];

describe('l’acte de l’infirmerie : `jetRegler(soins, mode)` sur le brouillon, joué par `jetLancer(soins)`', () => {
  it('Hémorragie verrouillée par Chirurgie, chirurgien présent : « Opérer » arme l’opération au lancer', () => {
    poser([chirurgien(), saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    expect(banc.getState().medic?.surgery).toBeUndefined(); // le brouillon n'arme rien
    banc.getState().jetLancer('soins');
    expect(banc.getState().medic?.surgery?.kind).toBe('chirurgie');
    expect(banc.getState().medic?.surgery?.healerId).toBe('doc');
    expect(banc.getState().journal).toEqual([]);
  });

  it('PNJ à 5 co, bourse vide : aucun acte, aucun brouillon ; le verdict dit « Le groupe n’a pas assez d’argent pour cet acte. »', () => {
    poser([hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(12, 4) })], { npc: BARBIER });
    expect(banc.getState().pendingHeal).toBeNull();
    expect(refusDeLActeALInfirmerie(banc.getState(), 'blessures')).toBe('Le groupe n’a pas assez d’argent pour cet acte.');
  });

  it('jet lancé : l’acte refusé, dit « Le jet est lancé. »', () => {
    poser([hero({ id: 'doc' }), saignant()]);
    expect(banc.getState().pendingHeal?.mode).toBe('hemorragie');
    banc.getState().jetLancer('soins');
    const lance = banc.getState().pendingHeal;
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    expect(banc.getState().pendingHeal).toBe(lance);
    expect(dernierRefus()).toBe('Le jet est lancé.');
  });

  it('opération armée, passe annulée : un acte au long cours refusé, dit « Une opération est en cours. »', () => {
    poser([chirurgien(), saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    banc.getState().jetLancer('soins');
    banc.getState().jetAnnuler('chirurgie');
    expect(banc.getState().pendingHeal?.mode).toBe('chirurgie'); // la reprise de l'opération armée
    banc.getState().jetRegler('soins', 'mode', 'reeducation');
    expect(banc.getState().pendingHeal?.mode).toBe('chirurgie');
    expect(dernierRefus()).toBe('Une opération est en cours.');
  });

  it('Rééducation sans Aide Médicale : refusée, dit « Aide Médicale requise avant de rééduquer le membre. »', () => {
    poser([hero({ id: 'doc' }), saignant({ traumas: [{ uid: 't1', label: 'Épaule luxée', location: 'brasD', drCible: 6, awaitingMedicalAid: true, ops: [] }] })]);
    banc.getState().jetRegler('soins', 'mode', 'reeducation');
    expect(banc.getState().pendingHeal?.mode).toBe('hemorragie');
    expect(dernierRefus()).toBe('Aide Médicale requise avant de rééduquer le membre.');
  });

  it('offre du PNJ absente : refusée, dit « Barbier ne propose pas cet acte. »', () => {
    poser([saignant({ wounds: blessuresDeBase(12, 4) })], { npc: BARBIER });
    creditBourse(banc.getState, banc.setState, 'p', { gold: 5, silver: 0, brass: 0 });
    expect(banc.getState().pendingHeal?.mode).toBe('blessures');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    expect(banc.getState().pendingHeal?.mode).toBe('blessures');
    expect(dernierRefus()).toBe('Barbier ne propose pas cet acte.');
  });

  it('aucun chirurgien au groupe : la Chirurgie refusée, dit « Aucun soigneur du groupe n’a le Talent Chirurgie. »', () => {
    poser([hero({ id: 'doc' }), saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    expect(banc.getState().pendingHeal?.mode).toBe('hemorragie');
    expect(dernierRefus()).toBe('Aucun soigneur du groupe n’a le Talent Chirurgie.');
  });

  it('aucun soigneur au groupe : aucun brouillon ; le verdict dit « Aucun membre du groupe ne peut tenter un Test de Guérison. »', () => {
    poser([saignant()]);
    expect(banc.getState().pendingHeal).toBeNull();
    expect(refusDeLActeALInfirmerie(banc.getState(), 'hemorragie')).toBe('Aucun membre du groupe ne peut tenter un Test de Guérison.');
  });

  it('raison du patient : Blessures pleines, dit « Blessures au maximum »', () => {
    poser([hero({ id: 'doc' }), saignant()]);
    banc.getState().jetRegler('soins', 'mode', 'blessures');
    expect(banc.getState().pendingHeal?.mode).toBe('hemorragie');
    expect(dernierRefus()).toBe('Blessures au maximum');
  });

  it('passe de Chirurgie posée : aucun brouillon ; le verdict dit « Un jet de soin est déjà posé. »', () => {
    poser([chirurgien(), saignant({ wounds: blessuresDeBase(12, 6), conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    banc.getState().jetLancer('soins');
    expect(banc.getState().pendingSurgery).not.toBeNull();
    expect(banc.getState().pendingHeal).toBeNull();
    expect(refusDeLActeALInfirmerie(banc.getState(), 'blessures')).toBe('Un jet de soin est déjà posé.');
  });

  it('C5 — hors combat, `soins.mode` recalcule le soin : le soigneur de l’acte, sa Difficulté, et le siège qui le lance', () => {
    const doc = hero({ id: 'doc', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] });
    const chir = hero({ id: 'chir', label: 'Chirurgienne', skills: [{ id: 'guerison', advances: 5, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] });
    poser([doc, chir, saignant({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })]);
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { doc: 1, chir: 2, p: 0 }, slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'A', 2: 'B' } } } as never);
    expect(banc.getState().pendingHeal).toMatchObject({ mode: 'hemorragie', healerId: 'doc' });
    const lancer = () => [0, 1, 2].map((siege) => intentAllowedFor(banc.getState(), siege, 'jetLancer', ['soins']));
    expect(lancer()).toEqual([false, true, false]);
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    expect(banc.getState().pendingHeal).toMatchObject({ mode: 'chirurgie', healerId: 'chir', difficulty: 'intermediaire' });
    expect(lancer()).toEqual([false, false, true]);
  });

  it('coop : l’acte refusé d’un invité ne se dit pas au journal de l’hôte', () => {
    poser([hero({ id: 'p', label: 'Patient', skills: [], wounds: blessuresDeBase(12, 4) })], { npc: BARBIER });
    creditBourse(banc.getState, banc.setState, 'p', { gold: 5, silver: 0, brass: 0 });
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { p: 1 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } }, journal: [] } as never);
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'jetRegler', ['soins', 'mode', 'hemorragie'])).toBe('appliquee');
    expect(banc.getState().pendingHeal?.mode).toBe('blessures');
    expect(banc.getState().journal).toEqual([]);
  });
});

/** `doc` (Guérison) au tour face à `al`, adjacent, porteur d'une Hémorragie verrouillée par Chirurgie ; `doc`
 *  appartient au siège 1 (l'invité) quand ce client est l'hôte. */
function poserLeCombat(netMode: 'hote' | 'local'): void {
  seedBattleRng(1);
  const doc = hero({ id: 'doc', pos: { x: 5, y: 5 } });
  const al = hero({ id: 'al', label: 'Blessé', skills: [], wounds: blessuresDeBase(12, 6), conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }], pos: { x: 6, y: 5 } });
  const order = ['doc', 'al'];
  banc.setState({
    mode: 'battle', scene: testScene(), party: [doc, al],
    battle: { combatants: [doc, al], order, baseOrder: order, turn: 0, round: 1, action: 'soins', selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
    pendingHeal: null, refus: null,
    net: netMode === 'hote'
      ? { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { doc: 1, al: 0 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } }
      : initialNet(),
  } as never);
}

describe('ouvrirLaGuerison et `soins.mode` lisent le filtre de combat', () => {
  it('Chirurgie demandée en combat : refusée, dit « Ce soin ne se pratique pas en combat. »', () => {
    poserLeCombat('local');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    expect(banc.getState().pendingHeal?.mode).toBe('blessures');
    expect(banc.getState().refus?.texte).toBe('Ce soin ne se pratique pas en combat.');
  });

  it('Soin demandé en combat par un invité : `ouvrirLaGuerison` est de la machinerie, hors allowlist, sans effet ni bandeau', () => {
    poserLeCombat('hote');
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'ouvrirLaGuerison', ['al'])).toBe('hors-allowlist');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus).toBeNull();
  });

  it('ciblage : un allié déjà soigné cette rencontre, ou à la seule déchirure, n’est pas candidat ; son clic dit le refus', () => {
    poserLeCombat('local');
    const dejaSoigne = hero({ id: 'a', label: 'Soigné', skills: [], wounds: blessuresDeBase(12, 5), soinRencontreUtilise: true, pos: { x: 5, y: 6 } });
    const dechire = hero({ id: 'b', label: 'Déchiré', skills: [], traumas: avecSequelles([], [traumaById(dechirureFractureFicheId('dechirure', 'mineur', 'brasG'), { be: 4, d10: 5 }, 'brasG')]), pos: { x: 4, y: 5 } });
    const b0 = banc.getState().battle!;
    const order = [...b0.order, 'a', 'b'];
    banc.setState({ battle: { ...b0, combatants: [...b0.combatants, dejaSoigne, dechire], order, baseOrder: order } } as never);
    const mode = currentTargetingMode(banc.getState);
    const doc = banc.getState().battle!.combatants.find((c) => c.id === 'doc')!;
    expect(mode.candidates!(banc.getState, doc).map((c) => c.id).sort()).toEqual(['al']);
    expect(mode.affordance!(banc.getState, doc, banc.getState().battle!.combatants.find((c) => c.id === 'b')!)).toEqual({ kind: 'invalid', reason: 'sans-soin-de-combat' });
    cliquerSurLeCombattant(banc.getState, 'a');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus?.texte).toBe('A déjà reçu son soin de Blessures (une fois par rencontre)');
    cliquerSurLeCombattant(banc.getState, 'b');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().refus?.texte).toBe('Blessures au maximum');
  });

  it('Hémorragie demandée en combat : le jet se pose', () => {
    poserLeCombat('local');
    banc.getState().ouvrirLaGuerison('al');
    banc.getState().jetRegler('soins', 'mode', 'hemorragie');
    expect(banc.getState().pendingHeal?.mode).toBe('hemorragie');
  });
});
