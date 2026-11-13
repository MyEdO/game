/**
 * LE BROUILLON DU SOIN DE L'INFIRMERIE (#3612 L1) : l'acte a une seule entrée, `jetRegler('soins', 'mode')`, sur le
 * brouillon que la transition du jeu tient (`brouillonTenu`, `acteDeSoin.ts`) ; `jetLancer('soins')` le joue. Contrat de
 * coop (qui choisit, ferme, lance, valide) et d'argent (le tarif d'un PNJ se débite au lancer, jamais au brouillon).
 * LDB 75 ; LDB 12 l.170-174.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { modalOwnerOf } from './modalArbiter';
import { libelleDeLaFermeture } from './libelles';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { fenetreADessiner } from '../hote/gestes';
import { toBrass, toMoney } from '../engine/money';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';
import type { MedicNpc } from './acteDeSoin';
import { ouvrirLeMedecin } from './medicFlow';
import { setDesFixes } from '../engine/fixedDie';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 55, force: 35, endurance: 43, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 35, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant => blessuresSurLeProfil({
  id, label: id, kind: 'heros', characteristics: { ...CHARS }, conditions: [], skills: [], talents: [], weapons: [], advantage: 0,
  pos: { x: 0, y: 0 }, wounds: blessuresDeBase(14), fortune: 2, resilience: 1, movement: 4,
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over,
} as Combatant) as Combatant;
const GUERISON = [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] as Combatant['skills'];
const blesse = (id: string) => mk(id, { wounds: blessuresDeBase(14, 4), conditions: [{ id: 'hemorragique', value: 2 }] });
const BARBIER: MedicNpc = { id: 'medecin-de-scene', label: fixtureText('Barbier'), skill: { id: 'guerison', value: 45 }, intBonus: 3, acts: [{ act: 'blessures', cost: { silver: 2 } }, { act: 'hemorragie', cost: { silver: 3 } }] };

/** Le groupe `party` hors combat, en coop : chaque héros au siège que `sieges` lui donne. */
function poser(party: Combatant[], sieges: Record<string, number>): void {
  banc.setState({
    mode: 'exploration', battle: null, party, pendingHeal: null, pendingSurgery: null, medic: null, journal: [],
    net: { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: sieges, slots: [0, 1, 2, 0], seatNames: { 0: 'Hôte', 1: 'A', 2: 'B' } },
  } as never);
}
const parSiege = (verbe: string, args: unknown[]) => [0, 1, 2].map((siege) => intentAllowedFor(g(), siege, verbe, args));
/** Les gestes OFFERTS de la fenêtre courante, par leur clé (`fenetreADessiner`). */
const offerts = () => (fenetreADessiner(g())?.gestes ?? []).filter((x) => x.ouvert).map((x) => x.cle);
const argent = () => toBrass(partyMoneyTotal(g));

describe('J1 — le brouillon : patient et sortie à tous les sièges', () => {
  it('soigneur héros : choix du patient et fermeture [true,true,true] ; un invité ferme, le brouillon part avec l’infirmerie', () => {
    poser([mk('doc', { skills: GUERISON }), blesse('p'), blesse('q')], { doc: 0, p: 1, q: 2 });
    g().ouvrirLeMedecin('p');
    expect(g().pendingHeal).toMatchObject({ healerId: 'doc', targetId: 'p', roll: null });
    expect(parSiege('fenetreChoisir', ['infirmerie', 'patient', 'q'])).toEqual([true, true, true]);
    expect(parSiege('fenetreFermer', ['infirmerie'])).toEqual([true, true, true]);
    expect(appliquerLIntentionDUnSiege(g, 2, 'fenetreChoisir', ['infirmerie', 'patient', 'q'])).toBe('appliquee');
    expect(g().pendingHeal?.targetId, 'le brouillon suit le patient').toBe('q');
    expect(appliquerLIntentionDUnSiege(g, 2, 'fenetreFermer', ['infirmerie'])).toBe('appliquee');
    expect(g().medic).toBeNull();
    expect(g().pendingHeal).toBeNull();
  });
});

describe('R3-D — après une validation ou une annulation, l’acte suivant reste offert sans rechoisir le patient', () => {
  it('validation d’un soin : le brouillon renaît sur l’acte suivant, lancer et acte offerts', () => {
    poser([mk('doc', { skills: GUERISON }), blesse('p')], { doc: 0, p: 1 });
    g().ouvrirLeMedecin('p');
    expect(g().pendingHeal?.mode).toBe('blessures');
    g().jetLancer('soins');
    g().jetValider('soins');
    expect(g().medic).not.toBeNull();
    expect(g().pendingHeal).toMatchObject({ targetId: 'p', mode: 'hemorragie', roll: null });
    expect(offerts()).toEqual(expect.arrayContaining(['jetLancer@soins', 'jetRegler@soins#mode']));
  });

  it('passe d’opération annulée : le brouillon reprend l’opération armée, et son lancer rouvre la passe', () => {
    const chir = mk('doc', { skills: GUERISON, talents: [{ talentId: 'chirurgie', times: 1 }] });
    poser([chir, mk('p', { conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] })], { doc: 0, p: 1 });
    g().ouvrirLeMedecin('p');
    g().jetRegler('soins', 'mode', 'chirurgie');
    g().jetLancer('soins');
    const armee = g().medic?.surgery;
    expect(g().pendingSurgery).not.toBeNull();
    g().jetAnnuler('chirurgie');
    expect(g().pendingHeal).toMatchObject({ targetId: 'p', mode: 'chirurgie', roll: null });
    expect(offerts()).toEqual(expect.arrayContaining(['jetLancer@soins', 'jetRegler@soins#mode']));
    g().jetLancer('soins');
    expect(g().pendingSurgery).not.toBeNull();
    expect(g().medic?.surgery, 'la même opération, son cumul intact').toBe(armee);
  });
});

describe('R3-A — soin lancé par un soigneur PNJ : la fenêtre au patient, son seul siège valide', () => {
  it('le patient lance, puis seul son siège valide ; le PNJ n’a aucune ressource que quiconque dépense', () => {
    poser([mk('doc'), blesse('p'), blesse('q')], { doc: 0, p: 1, q: 2 });
    ouvrirLeMedecin(g, banc.setState, 'p', { ...BARBIER, acts: [{ act: 'blessures' }, { act: 'hemorragie' }] });
    expect(appliquerLIntentionDUnSiege(g, 1, 'jetLancer', ['soins'])).toBe('appliquee');
    expect(g().pendingHeal?.roll).not.toBeNull();
    expect(modalOwnerOf(g())).toBe('p');
    expect(parSiege('jetValider', ['soins'])).toEqual([false, true, false]);
    expect(parSiege('fenetreFermer', ['infirmerie'])).toEqual([false, true, false]); // au propriétaire ; la sortie elle-même se ferme (`soinEnCours`)
    expect(parSiege('jetRelancer', ['soins'])).toEqual([false, false, false]);
  });
});

describe('le brouillon ne s’annule pas : l’annulation fermée se dit', () => {
  it('hors combat, `jetAnnuler(soins)` sur le brouillon est refusé, dit `jet.ferme.acteAChanger`, et l’état ne bouge pas', () => {
    poser([mk('doc', { skills: GUERISON }), blesse('p')], { doc: 0, p: 1 });
    g().ouvrirLeMedecin('p');
    const brouillon = g().pendingHeal;
    const medic = g().medic;
    g().jetAnnuler('soins');
    expect(g().pendingHeal).toBe(brouillon);
    expect(g().medic).toBe(medic);
    expect(g().journal[g().journal.length - 1]).toBe(libelleDeLaFermeture('acteAChanger'));
  });
});

describe('R4-E — aucun argent créé par l’infirmerie d’un PNJ payant', () => {
  it('ouverture, acte, annulations répétées : la bourse ne bouge pas ; le lancer débite une fois', () => {
    poser([blesse('p')], { p: 1 });
    creditBourse(g, banc.setState, 'p', { gold: 0, silver: 10, brass: 0 });
    const avant = argent();
    ouvrirLeMedecin(g, banc.setState, 'p', BARBIER);
    expect(argent()).toBe(avant);
    expect(appliquerLIntentionDUnSiege(g, 1, 'jetRegler', ['soins', 'mode', 'hemorragie'])).toBe('appliquee');
    expect(g().pendingHeal?.mode).toBe('hemorragie');
    expect(offerts()).not.toContain('jetAnnuler@soins');
    for (let i = 0; i < 3; i++) appliquerLIntentionDUnSiege(g, 1, 'jetAnnuler', ['soins']);
    expect(argent()).toBe(avant);
    g().jetLancer('soins');
    expect(argent()).toBe(avant - toBrass(toMoney({ silver: 3 })));
  });
});

describe('le premier jet du brouillon, quel que soit le geste qui le pose, passe par le lancer de l’acte', () => {
  const luxee = (id: string) => mk(id, { wounds: blessuresDeBase(40), traumas: [{ uid: 't1', label: 'Épaule luxée (bras perdu)', location: 'brasD', drCible: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }], recoveryPenalty: [{ op: 'charMod', characteristic: 'capacite-de-combat', mod: -10 }] }] } as Partial<Combatant>);
  const barbierPayant = (): void => {
    poser([blesse('p')], { p: 1 });
    creditBourse(g, banc.setState, 'p', { gold: 0, silver: 10, brass: 0 });
  };

  it('X1 — Résilience avant le jet sur une rééducation : l’opération s’arme, aucun jet de rééducation sans elle, le point n’est pas perdu', () => {
    poser([mk('doc', { skills: GUERISON }), luxee('p')], { doc: 0, p: 1 });
    g().ouvrirLeMedecin('p');
    expect(g().pendingHeal?.mode).toBe('reeducation');
    g().jetForcerLaReussite('soins');
    expect(g().pendingHeal, 'aucun soin de rééducation tiré hors de l’opération').toBeNull();
    expect(g().medic?.surgery?.kind).toBe('reeducation');
    expect(g().pendingSurgery).not.toBeNull();
    expect(g().party.find((h) => h.id === 'doc')!.resilience).toBe(1);
  });

  it('X2 — dé imposé, option « Dés fixés » active, sur le brouillon d’un PNJ payant : le tarif se débite', () => {
    barbierPayant();
    const avant = argent();
    ouvrirLeMedecin(g, banc.setState, 'p', { ...BARBIER, acts: [{ act: 'blessures', cost: { silver: 2 } }] });
    setDesFixes(true);
    try {
      g().jetImposerLeResultat('soins', 5);
    } finally { setDesFixes(false); }
    expect(g().pendingHeal?.roll).toBe(5);
    expect(argent()).toBe(avant - toBrass(toMoney({ silver: 2 })));
  });

  it('X3 — dé imposé, option éteinte, par l’appel direct d’un hôte : aucun jet posé sans son tarif', () => {
    barbierPayant();
    const avant = argent();
    ouvrirLeMedecin(g, banc.setState, 'p', { ...BARBIER, acts: [{ act: 'blessures', cost: { silver: 2 } }] });
    g().jetImposerLeResultat('soins', 5);
    const pose = g().pendingHeal?.roll != null;
    expect(argent()).toBe(pose ? avant - toBrass(toMoney({ silver: 2 })) : avant);
  });

  it('B2 — dé imposé sur une rééducation sans opération armée : refusé, dit, et rien ne s’arme', () => {
    poser([mk('doc', { skills: GUERISON }), luxee('p')], { doc: 0, p: 1 });
    g().ouvrirLeMedecin('p');
    setDesFixes(true);
    try {
      g().jetImposerLeResultat('soins', 3);
    } finally { setDesFixes(false); }
    expect(g().pendingHeal).toMatchObject({ mode: 'reeducation', roll: null });
    expect(g().medic?.surgery).toBeUndefined();
    expect(g().journal[g().journal.length - 1]).toBe(libelleDeLaFermeture('jetNonLance'));
  });
});
