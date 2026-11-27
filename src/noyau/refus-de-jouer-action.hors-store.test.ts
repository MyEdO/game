/**
 * Le refus de `jouerAction` (#5122, #5148) : UN verdict pur (`refusDeJouerAction`), lu par l'offre d'exploration
 * (`gestesDExploration`) et par le verbe AVANT le Flow et ses clôtures. Une action refusée se dit, et ne coûte ni
 * horloge ni usage. Le refus d'ouverture d'un Flow est celui de son premier effet joué (`refusDOuverture`).
 *
 * Scènes FABRIQUÉES (doctrine : jamais une scène de campagne utilisée comme fixture).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type ActionAuthoree, type SceneEntity } from './monde/scene';

type Flow = ActionAuthoree['flow'];
import { gestesDExploration } from './gestesDExploration';
import { EFFECT_HANDLERS, applyEffects } from './combatEffects';
import { emptyNarratif } from './monde/campaignNarratif';
import { draineCascade } from './cascade.testkit';
import { partyMoneyTotal } from './bourseFlow';
import { toBrass } from '../engine/money';
import { t } from '../i18n';
import { setRule, resetRule } from '../engine/policy';
import { traumaById, dechirureFractureFicheId, avecSequelles } from '../engine/trauma';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { refusPersonneNePeutTenter } from '../engine/skills';
import type { Combatant } from '../engine/types';
import type { HealMode } from '../engine/healing';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { Jeu } from './etat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => { resetRule('jeux-de-taverne'); resetRule('interlude-actif'); resetRule('priere-petites'); resetRule('psycho-acquisition-optionnelle'); });

const SOEUR = 'soeur';
/** La sœur soignante : Guérison sur sa fiche, et le Talent Chirurgie s'il est demandé. */
const soeur = (chirurgienne: boolean): SceneEntity => ({
  id: SOEUR, kind: 'personnage', pos: { x: 2, y: 1 }, label: 'Sœur',
  statblock: { type: 'statblock', label: 'Sœur', char: { intelligence: 40 }, skills: [{ id: 'guerison', value: 80 }], ...(chirurgienne ? { talents: [{ id: 'chirurgie' }] } : {}) },
}) as SceneEntity;

const heros = (over: Partial<Combatant> = {}): Combatant =>
  combattantDeTest({ id: 'h', label: 'Héros', kind: 'heros', wounds: blessuresDeBase(12), conditions: [], ...over });

/** La sœur offre l'action « Se faire soigner », `unique` par défaut, qui joue `flow`, au groupe posé à son contact. */
function poser(flow: Flow, party: Combatant[], porteur: SceneEntity = soeur(true), etat: Partial<Jeu> = {}, unique = true): void {
  const sc = emptyScene('hospice', 8, 8);
  const action: ActionAuthoree = { id: 'soigner', label: 'Se faire soigner', unique, flow };
  sc.entities = [{ ...porteur, usable: { actions: [action] } } as SceneEntity];
  banc.setState({ scene: sc, mode: 'exploration', partyPos: { x: 1, y: 1 }, dialogue: null, flags: {}, party, medic: null, pendingHeal: null, pendingSurgery: null, journal: [], ...etat });
}

const effet = (e: Effect): Flow => ({ kind: 'effet', effet: e });
const offreDuPorteur = (porteur = SOEUR) =>
  gestesDExploration(banc.getState()).find((g) => g.gestes[0]?.verbe === 'jouerAction' && g.gestes[0].args[0] === porteur);
const derniereLigne = () => { const j = banc.getState().journal; return j[j.length - 1]?.texte; };

/** Joue l'offre du porteur ; rend son refus à l'offre, la ligne que le verbe a dite et ce que le refus a laissé. */
function jouerLOffre(porteur = SOEUR, actionId = 'soigner') {
  const refus = offreDuPorteur(porteur)?.refus;
  const avant = banc.getState().gameTime;
  banc.getState().jouerAction(porteur, actionId);
  return { refus, dit: derniereLigne(), minutes: banc.getState().gameTime - avant, toujoursOfferte: !!offreDuPorteur(porteur) };
}

/** Le patient qui porte ce que l'acte traite (`besoinDuMode`). LDB 09 l.256 ; LDB 18 */
const PATIENTS: Record<Extract<HealMode, 'blessures' | 'hemorragie' | 'traumatisme' | 'chirurgie'>, () => Combatant> = {
  blessures: () => heros({ wounds: blessuresDeBase(12, 6) }),
  hemorragie: () => heros({ conditions: [{ id: 'hemorragique', value: 1 }] }),
  traumatisme: () => heros({ traumas: avecSequelles([], [traumaById(dechirureFractureFicheId('dechirure', 'mineur', 'brasG'), { be: 3, d10: 5 }, 'brasG')]) }),
  chirurgie: () => heros({ conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] }),
};
const ACTES = Object.keys(PATIENTS) as (keyof typeof PATIENTS)[];

describe('chaque soin `medicalAid` offert : le refus de l’offre est celui que le verbe dit', () => {
  it.each(ACTES)('%s : soigné quand le patient en porte le besoin, refusé sinon, sans horloge ni usage', (acte) => {
    const flow = effet({ type: 'medicalAid', entityId: { id: SOEUR }, acts: [{ act: acte }] });
    poser(flow, [PATIENTS[acte]()]);
    const offerte = jouerLOffre();
    expect(offerte.refus, 'l’offre s’ouvre').toBeUndefined();
    expect(banc.getState().medic?.npc?.acts.map((a) => a.act)).toEqual([acte]);
    expect(banc.getState().pendingHeal?.mode, 'le brouillon de l’acte offert').toBe(acte);
    banc.getState().jetLancer('soins');
    expect(acte === 'chirurgie' ? banc.getState().pendingSurgery : banc.getState().pendingHeal?.roll, 'l’acte se joue').toBeTruthy();

    const autre = ACTES[(ACTES.indexOf(acte) + 1) % ACTES.length];
    poser(flow, [PATIENTS[autre]()]);
    const refusee = jouerLOffre();
    expect(refusee.refus, 'un patient que l’acte ne traite pas').toBe(t('medic.acteNonPropose', { pnj: 'Sœur' }));
    expect(refusee.dit, 'le verbe dit le refus de l’offre').toBe(refusee.refus);
    expect(refusee.minutes, 'un soin refusé ne coûte pas d’horloge').toBe(0);
    expect(refusee.toujoursOfferte, 'une action `unique` refusée reste offerte').toBe(true);
    expect(banc.getState().medic).toBeNull();
  });

  it('un groupe sans blessure : « personne à soigner », dit par l’offre et par le verbe', () => {
    poser(effet({ type: 'medicalAid', entityId: { id: SOEUR }, acts: [{ act: 'blessures' }] }), [heros()]);
    const r = jouerLOffre();
    expect(r).toEqual({ refus: t('medic.personneASoigner'), dit: t('medic.personneASoigner'), minutes: 0, toujoursOfferte: true });
  });
});

describe('le Talent Chirurgie d’un PNJ (LDB 10 l.184)', () => {
  it('sans le Talent, la sœur ne propose pas l’acte `chirurgie`, à l’offre comme aux `refs`', () => {
    const flow = effet({ type: 'medicalAid', entityId: { id: SOEUR }, acts: [{ act: 'chirurgie' }] });
    poser(flow, [PATIENTS.chirurgie()], soeur(false));
    const r = jouerLOffre();
    expect(r.refus).toBe(t('eff.medecinSansActe', { name: 'Sœur' }));
    expect(r.dit).toBe(r.refus);

    poser(effet({ type: 'medicalAid', entityId: { id: SOEUR }, acts: [{ act: 'blessures' }, { act: 'chirurgie' }] }), [PATIENTS.chirurgie()], soeur(false));
    expect(jouerLOffre().refus, 'elle soigne les Blessures, n’opère pas').toBe(t('medic.acteNonPropose', { pnj: 'Sœur' }));

    const ctx = { sceneIds: new Set<string>(), entityIds: new Set([SOEUR]), npcSheet: () => combattantDeTest({ skills: [{ id: 'guerison', advances: 10, characteristic: 'intelligence' }] }), within: () => true, walkable: () => true };
    expect(EFFECT_HANDLERS.medicalAid.refs!({ type: 'medicalAid', entityId: { id: SOEUR }, acts: [{ act: 'chirurgie' }] }, ctx).map((i) => i.level)).toEqual(['error']);
  });
});

describe('`jouerAction` sous une fenêtre qui tient la main', () => {
  it('l’état est inchangé, et le refus dit est celui de l’offre', () => {
    poser(effet({ type: 'medicalAid', entityId: { id: SOEUR }, acts: [{ act: 'blessures' }] }), [PATIENTS.blessures()], soeur(true), {}, false);
    banc.getState().jouerAction(SOEUR, 'soigner');
    expect(banc.getState().medic, 'l’infirmerie tient la main').not.toBeNull();
    const photo = () => { const s = banc.getState(); return structuredClone({ gameTime: s.gameTime, flags: s.flags, medic: s.medic, pendingHeal: s.pendingHeal, party: s.party }); };
    const avant = photo();
    const r = jouerLOffre();
    expect(r.refus).toBe(t('jouerAction.refus.mainTenue'));
    expect(r.dit).toBe(r.refus);
    expect(photo()).toEqual(avant);
  });
});

describe('le refus d’ouverture de chaque effet à fenêtre, lu par l’offre et dit par le verbe', () => {
  const mort = () => heros({ dead: true });
  /** effet, état posé, refus attendu */
  const CAS: [string, Effect, () => Partial<Jeu>, () => string][] = [
    ['castSpell', { type: 'castSpell', casterId: 'absent', sort: { id: 'fleche-aethyrique' }, mode: 'jet' }, () => ({}), () => t('eff.lanceurAbsent', { id: 'absent' })],
    ['openWorldMap', { type: 'openWorldMap' }, () => ({ worldMap: null }), () => t('carte.refus.sansCarte')],
    ['startCombat', { type: 'startCombat', encounter: { id: 'embuscade' } }, () => ({}), () => t('combat.refus.rencontreInconnue', { id: 'embuscade' })],
    ['openPort', { type: 'openPort', placeId: 'altdorf' }, () => ({ worldMap: null }), () => t('eff.portInconnu', { lieu: 'altdorf' })],
    ['openTavernGames', { type: 'openTavernGames' }, () => { setRule('jeux-de-taverne', false); return {}; }, () => t('tavern.optionEteinte')],
    ['extendedTest', { type: 'extendedTest', skill: { id: 'crochetage' }, difficulty: 'intermediaire', label: 'Crocheter', drCible: 5, flag: 'ouvert' }, () => ({}), () => refusPersonneNePeutTenter({ skill: { id: 'crochetage' } })],
    ['forceDoor', { type: 'forceDoor', label: 'Porte', doorBE: 3, doorB: 10, flag: 'enfoncee' }, () => ({ party: [mort()] }), () => t('eff.porteSansHeros')],
    ['openMerchant', { type: 'openMerchant', entityId: { id: SOEUR } }, () => ({}), () => t('mf.marchandAbsent', { id: SOEUR })],
    ['interlude', { type: 'interlude', weeks: 1 }, () => { setRule('interlude-actif', false); return {}; }, () => t('if.optionEteinte')],
    ['startPursuit', { type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [] }, () => ({}), () => t('pursuit.none')],
    ['petitePriere', { type: 'petitePriere', reward: { kind: 'sequence', etapes: [] } }, () => { setRule('priere-petites', false); return {}; }, () => t('eff.petitePriereOptionEteinte')],
    ['document', { type: 'document', documentId: 'lettre-perdue' }, () => ({}), () => t('eff.documentInconnu', { id: 'lettre-perdue' })],
    ['designerHeros', { type: 'designerHeros', etat: 'elu' }, () => ({ party: [mort()] }), () => t('eff.designationSansHeros')],
    ['transition', { type: 'transition', scene: { id: 'nulle-part' } }, () => ({}), () => t('store.sceneMissing', { scene: 'nulle-part' })],
    ['transitionBack', { type: 'transitionBack' }, () => ({ previousScene: null }), () => t('eff.aucuneSceneDOrigine')],
    ['fall', { type: 'fall', target: 'groupe', metres: 3, to: { x: 40, y: 40 } }, () => ({}), () => t('eff.chuteAtterrissageRefuse')],
  ];
  it.each(CAS)('%s', (_type, e, etat, attendu) => {
    const pose = etat();
    poser(effet(e), [heros()], soeur(true), pose);
    const r = jouerLOffre();
    expect(r.refus).toBe(attendu());
    expect(r.dit, 'le verbe dit le refus de l’offre').toBe(r.refus);
    expect(r.minutes).toBe(0);
  });

  const NARRATIF = { ...emptyNarratif(), indices: [{ id: 'lettre', affaireId: 'aff', kind: 'indice', titre: 'La lettre', stades: [{ id: 'lue', prose: 'a' }] }] } as unknown as Jeu['campaignNarratif'];
  const revelee: Effect = { type: 'revealClue', indiceId: 'lettre' };
  const ecartee: Effect = { type: 'discreditClue', indiceId: 'lettre' };
  /** effet, état posé, geste du jeu joué avant l'offre, refus attendu : l'effet qui ne ferait RIEN dans cet état. */
  const SANS_EFFET: [string, Effect, () => Partial<Jeu>, (() => void) | null, () => string][] = [
    ['corruptionExposure', { type: 'corruptionExposure', level: 'mineure', nature: 'physique' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['learnSpell', { type: 'learnSpell', sort: { id: 'arme-aethyrique' } }, () => ({}), null, () => t('eff.sortSansApprenti', { spell: 'Arme aethyrique' })],
    ['adjustVessel', { type: 'adjustVessel', morale: 5 }, () => ({ vessel: null }), null, () => t('eff.sansNavire')],
    ['grantFavor', { type: 'grantFavor', level: 'mineure', owedTo: 'x', desc: 'y' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['ops (rôle sans titulaire)', { type: 'ops', on: { role: { id: 'navigateur' } }, ops: [{ op: 'wounds', amount: 1 }] }, () => ({}), null, () => t('eff.roleSansTitulaire', { role: 'Navigateur' })],
    ['ops (navire absent)', { type: 'ops', on: 'navire', ops: [{ op: 'wounds', amount: 1 }] }, () => ({ vessel: null }), null, () => t('eff.navireAbsent')],
    ['ops (groupe sans vivant)', { type: 'ops', on: 'groupe', ops: [{ op: 'wounds', amount: 1 }] }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['zoneBlast', { type: 'zoneBlast', center: { x: 7, y: 7 }, radius: 0, ops: [{ op: 'wounds', amount: 1 }] }, () => ({}), null, () => t('eff.aucuneCible')],
    ['inflictDisease', { type: 'inflictDisease', disease: 'infection-mineure' }, () => ({}), () => { banc.getState().jouerAction(SOEUR, 'soigner'); draineCascade(banc.getState); }, () => t('eff.maladieDejaPortee', { name: 'Héros', disease: 'infection-mineure' })],
    ['inflictHunger', { type: 'inflictHunger', days: 1, target: 'groupe' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['inflictThirst', { type: 'inflictThirst', days: 1, target: 'groupe' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['exposureNight', { type: 'exposureNight', kind: 'froid', count: 1, target: 'groupe' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['waterExposure', { type: 'waterExposure', mode: 'ingestion', target: 'groupe' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['inflictPsychology', { type: 'inflictPsychology', kind: 'peur', indice: 1, label: 'Vision', target: 'groupe' }, () => ({ party: [mort()] }), null, () => t('eff.aucuneCible')],
    ['ambitionLost', { type: 'ambitionLost' }, () => { setRule('psycho-acquisition-optionnelle', false); return {}; }, null, () => t('eff.ambitionOptionEteinte')],
    ['revealClue', revelee, () => ({ campaignNarratif: NARRATIF }), () => applyEffects(banc.getState, banc.setState, [revelee]), () => t('eff.indiceSansNouveau', { titre: 'La lettre' })],
    ['discreditClue', ecartee, () => ({ campaignNarratif: NARRATIF }), () => applyEffects(banc.getState, banc.setState, [ecartee]), () => t('eff.indiceSansNouveau', { titre: 'La lettre' })],
    ['moveEntity', { type: 'moveEntity', id: 'statue', to: { x: 3, y: 3 } }, () => ({}), null, () => t('eff.entiteAbsente', { id: 'statue' })],
    ['endDialogue', { type: 'endDialogue' }, () => ({}), null, () => t('eff.aucunDialogue')],
    ['inflictDisease (héros absent)', { type: 'inflictDisease', disease: 'infection-mineure', heroId: 'absent' }, () => ({}), null, () => t('eff.aucuneCible')],
    ['ambitionLost (héros absent)', { type: 'ambitionLost', heroId: 'absent' }, () => { setRule('psycho-acquisition-optionnelle', true); return {}; }, null, () => t('eff.aucuneCible')],
    ['inflictTrauma', { type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: 'absent' }, () => ({}), null, () => t('eff.aucuneCible')],
    ['giveSin', { type: 'giveSin', amount: 1, heroId: 'absent' }, () => ({}), null, () => t('eff.aucuneCible')],
    ['givePossession', { type: 'givePossession', nature: 'bete', ref: { id: 'cheval', type: 'creature' }, heroId: 'absent' }, () => ({}), null, () => t('eff.aucuneCible')],
    ['inflictNightmares', { type: 'inflictNightmares', heroId: 'absent' }, () => ({}), null, () => t('eff.aucuneCible')],
    ['giveTrapping', { type: 'giveTrapping', custom: 'Fiole', heroId: 'absent' }, () => ({}), null, () => t('eff.aucuneCible')],
  ];
  it.each(SANS_EFFET)('%s : l’effet qui ne ferait rien est refusé, sans horloge ni usage', (_type, e, etat, avant, attendu) => {
    poser(effet(e), [heros()], soeur(true), etat(), avant === null);
    avant?.();
    banc.setState({ journal: [] });
    const r = jouerLOffre();
    expect(r.refus).toBe(attendu());
    expect(r.dit, 'le verbe dit le refus de l’offre').toBe(r.refus);
    expect(r.minutes).toBe(0);
    expect(r.toujoursOfferte).toBe(true);
  });

  it('les refus que le verdict de `jouerAction` couvre avant eux (combat, nuit à régler) : lus au registre', () => {
    const s = banc.getState();
    expect(EFFECT_HANDLERS.startMassBattle.refusDOuverture({ type: 'startMassBattle', battle: { puissanceAlliee: 50, puissanceEnnemie: 50, plannedRounds: 3 } }, { ...s, battle: {} as Jeu['battle'] })).toBe(t('mbf.inCombat'));
    expect(EFFECT_HANDLERS.rest.refusDOuverture({ type: 'rest', days: 1 }, { ...s, pendingRest: {} as Jeu['pendingRest'] })).toBe(t('repos.refus.nuitARegler'));
  });

  it('une `transition` refusée hors de l’offre (déclencheur) ne retient aucune scène d’où revenir', () => {
    poser(effet({ type: 'journal' }), [heros()], soeur(true), { previousScene: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'transition', scene: { id: 'nulle-part' } }]);
    expect(banc.getState().previousScene).toBeNull();
  });

  it('une `sequence` dont une étape agit s’ouvre, et l’action joue cette étape', () => {
    poser({ kind: 'sequence', etapes: [effet({ type: 'transitionBack' }), effet({ type: 'setFlag', flag: 'tire' })] }, [heros()], soeur(true), { previousScene: null });
    const r = jouerLOffre();
    expect(r.refus).toBeUndefined();
    expect(banc.getState().flags.tire).toBe(true);
  });

  it('une `sequence` dont CHAQUE étape est refusée est refusée, et dit le refus de la première', () => {
    poser({ kind: 'sequence', etapes: [effet({ type: 'transitionBack' }), effet({ type: 'endDialogue' })] }, [heros()], soeur(true), { previousScene: null });
    const r = jouerLOffre();
    expect(r.refus).toBe(t('eff.aucuneSceneDOrigine'));
    expect(r.dit).toBe(r.refus);
    expect(r.minutes).toBe(0);
  });

  it('`ops` : une op du monde que le meneur joue ouvre la feuille, même quand son rôle n’a pas de titulaire', () => {
    poser(effet({ type: 'ops', on: { role: { id: 'navigateur' } }, ops: [{ op: 'money', montant: { brass: 240 }, groupe: true }, { op: 'wounds', amount: 1 }] }), [heros()]);
    const avant = toBrass(partyMoneyTotal(banc.getState));
    const r = jouerLOffre();
    expect(r.refus).toBeUndefined();
    expect(toBrass(partyMoneyTotal(banc.getState)) - avant).toBe(240);
  });
});
