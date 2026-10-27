/**
 * Jalon 5 — Sauvegarde/chargement de partie par le store : snapshot de l'état du JEU (`EtatDeJeu`, jamais l'état
 * d'interface), localStorage 3 slots, export/import JSON, refus en combat et chez l'invité (`refusDeSauvegarde`).
 *
 * Plus le FORMAT (#2404) : une save dont la version diffère de `FORMAT_SAVE` est REJETÉE et RETIRÉE
 * du stockage, avec un témoin de message pour le joueur.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGame, etatInitialDeLAdaptateur } from './store';
import { etatInitialDuJeu, initialNet } from '../noyau/etat';
import { t } from '../i18n';
import { resetSceneRegistry } from '../noyau/monde/registreDesScenes';
import { testDeRegle } from '../engine/reglesChiffrees';
import { lancerCampagne } from '../scenes/campaign';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, takeObsoleteNotice } from './saves';
import { parseSave, snapshotSave, elaguerSave, type SaveGame } from '../noyau/persistance/save';
import { FORMAT_SAVE } from '../noyau/persistance/formats.generated';
import { rule, setRule, loadRuleOverrides, OPTIONAL_RULES } from '../engine/policy';
import { talents, careerLevels, specResolves, combatStakeRef, conditionIds } from '../data/index';
import { applierDe } from '../noyau/cascade';
import { talentSlots, slotCovers } from '../engine/careerSlots';
import { createHero } from '../engine/character';
import { testValue } from '../engine/skills';
import { makeRNG } from '../engine/dice';
import { stampCriticalEscalation } from '../engine/trauma';
import { resolveCritique } from '../engine/critical';
import { CRITIQUE_DOCS } from '../data/criticals';
import type { Combatant, Trauma } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from '../noyau/monde/scene';
import { pruneSeatAssignments } from '../noyau/monde/seating';
import { capDuGroupe, poserCapDuGroupe } from '../noyau/monde/combatants';
import type { Dir8 } from '../geometry/dir8';
import { entityBlockedAt } from '../noyau/monde/sceneRules';
import { phaseDeChute } from '../noyau/fallMove';
import type { PendingFall } from '../noyau/pendings';
import { findPropById, findSpellById } from '../data/index';
import { spellEffectOps } from '../engine/flowCore';
import { applyOps } from '../engine/ops';
import { desDuTest } from '../engine/dice.testkit';

/** Porteur minimal : `stampCriticalEscalation` ne lit que ses séquelles. */
const hero38 = (): Combatant => ({ id: 'h', label: 'H', kind: 'hero', conditions: [], skills: [], traumas: [] } as unknown as Combatant);

/** Le MÊME porteur, doté de ses Caractéristiques : `resolveCritique` lit l'Endurance (sévérité du d100). */
const heroCritique = (): Combatant => ({
  ...hero38(),
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 6, max: 12 }, bodyShape: 'humanoide', critEntriesSuffered: [],
} as unknown as Combatant);

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('Sauvegarde / chargement (Jalon 5)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    vi.useFakeTimers();
    vi.clearAllTimers();
    deleteSlot(1); deleteSlot(2); deleteSlot(3);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sauvé', seed: 4 });
    useGame.setState({ party: [hero], battle: null, net: initialNet() });
    useGame.getState().startScene(testScene());
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); deleteSlot(1); deleteSlot(2); deleteSlot(3); loadRuleOverrides({}); });

  it('saveGame → slot rempli avec métadonnées (scène, horloge) ; listSaves le voit', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'drapeau-test': true } });
    expect(useGame.getState().saveGame(1)).toBe(true);
    const s = readSlot(1)!;
    expect(s.version).toBe(FORMAT_SAVE);
    expect(s.sceneLabel).toBe(testScene().label); // le NOM de la scène, pas son id
    expect(s.sceneLabel.length).toBeGreaterThan(0);
    expect((s.data.flags as Record<string, unknown>)['drapeau-test']).toBe(true);
    const metas = listSaves();
    expect(metas[0]?.slot).toBe(1);
    expect(metas[1]).toBeNull();
  });

  it('round-trip : muter → sauver → réinitialiser → charger restaure données + actions vivantes', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'quete-x': true }, gameTime: 12345, journal: ['ligne de test'] });
    useGame.getState().party[0].wounds.current = 3;
    expect(useGame.getState().saveGame(2)).toBe(true);
    // « Nouvelle partie » : tout est réinitialisé.
    useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
    expect(useGame.getState().loadGame(2)).toBe(true);
    const after = useGame.getState();
    expect(after.flags['quete-x']).toBe(true);
    expect(after.gameTime).toBe(12345);
    expect(after.party[0]?.label).toBe('Sauvé');
    expect(after.party[0]?.wounds.current).toBe(3);
    expect(after.scene?.id).toBe(testScene().id);
    expect(after.screen).toBe('campaign');
    after.log('le store répond'); // les actions n'ont pas été écrasées par le merge
    const j = useGame.getState().journal;
    expect(j[j.length - 1]).toBe('le store répond');
  });

  it('règles maison : la save porte les surcharges et les restaure au chargement (portabilité)', () => {
    const id = 'test-critiques-doubles'; // un flag optionnel quelconque
    loadRuleOverrides({}); // baseline propre
    const def = rule(id) as boolean; // défaut RAW du registre
    setRule(id, !def); // l'utilisateur active la règle maison
    expect(useGame.getState().saveGame(1)).toBe(true);
    expect(readSlot(1)!.rules?.[id]).toBe(!def); // la surcharge voyage DANS la save
    loadRuleOverrides({}); // « autre machine » : aucune règle maison locale → défaut
    expect(rule(id)).toBe(def);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(rule(id)).toBe(!def); // … restaurée par le chargement
  });

  /**
   * SNAPSHOT ZÉRO-MAINTENANCE : tout champ de l'état initial du JEU entre dans la save, hors l'exclusion NOMMÉE du
   * noyau (`HORS_SAVE`) ; aucune clé de l'interface du web n'y entre (#3041).
   */
  it('la save porte l’état du JEU, hors `HORS_SAVE`, et aucune clé de l’interface', () => {
    const jeu = Object.keys(etatInitialDuJeu());
    expect(jeu.length, 'témoin : l’état initial du jeu porte bien des données').toBeGreaterThan(20);
    useGame.setState({ reveler: true, debugLabels: true, debugRoofCut: false, camRot: 2, zoom: 1.8, sheetId: 'h' });
    expect(useGame.getState().saveGame(1), 'témoin : la save est bien écrite').toBe(true);
    const cles = Object.keys(readSlot(1)!.data);
    expect(jeu.filter((k) => !cles.includes(k)), 'un champ de jeu hors save sans exclusion nommée').toEqual(['campaignNarratif']);
    expect(cles.filter((k) => !jeu.includes(k)), 'une clé de la save hors `EtatDeJeu`').toEqual([]);
    const interface_ = [...Object.keys(etatInitialDeLAdaptateur()), 'keyOverrides'];
    expect(interface_.filter((k) => cles.includes(k)), 'une clé d’interface dans la save').toEqual([]);
  });

  it('le chargement garde les préférences de vue et de touches, et remet le reste de l’interface', () => {
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.setState({ camRot: 3, zoom: 2, keyOverrides: { 'toggle-menu': 'KeyP' }, sheetId: 'h', gameMenuOpen: true });
    expect(useGame.getState().loadGame(1)).toBe(true);
    const s = useGame.getState();
    expect([s.camRot, s.zoom, s.keyOverrides]).toEqual([3, 2, { 'toggle-menu': 'KeyP' }]);
    expect([s.sheetId, s.gameMenuOpen]).toEqual([null, false]);
  });

  it('chez l’invité : sauvegarde refusée, message au journal, aucun emplacement écrit', () => {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 2 } });
    expect(useGame.getState().saveGame(1)).toBe(false);
    expect(useGame.getState().autoSave()).toBe(false);
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('store.saveInvite'));
    expect(readSlot(1)).toBeNull();
    expect(readSlot('auto')).toBeNull();
  });

  it('en combat : sauvegarde refusée, le slot reste vide', () => {
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    expect(useGame.getState().saveGame(1)).toBe(false);
    expect(readSlot(1)).toBeNull();
  });

  it('export / import : round-trip JSON validé ; autre format rejeté', () => {
    expect(useGame.getState().saveGame(3)).toBe(true);
    const json = exportSave(readSlot(3)!);
    const re = importSave(json);
    expect(typeof re === 'object' && re.sceneLabel).toBe(readSlot(3)!.sceneLabel);
    expect(importSave('{pas du json')).toBe('illisible');
    expect(importSave(JSON.stringify({ ...JSON.parse(json), version: 'autre-format' }))).toBe('autreFormat');
    expect(importSave(JSON.stringify({ ...JSON.parse(json), version: 66 }))).toBe('autreFormat');
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBeNull();
    expect(useGame.getState().scene?.id).toBe(testScene().id);
  });
});

/** Comportements VIVANTS de la forme persistée : chacun verrouille ce que lit le chargement d'une save. */
describe('forme persistée — ce que le chargement lit', () => {
  it('une `SkillInstance` s’apparie par `id` (#1548) : la graphie `skillId` perd ses Augmentations', () => {
    // Une instance à la graphie `skillId` n'est appariée par AUCUN Test — le moteur
    // apparie sur `id`, donc la valeur retombe sur la Caractéristique nue, Augmentations perdues.
    const nu = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sonde', seed: 1 }), skills: [] };
    const avecAncienneGraphie = { ...nu, skills: [{ skillId: 'resistance', characteristic: 'endurance', advances: 20 }] } as unknown as typeof nu;
    const avecGraphieCourante = { ...nu, skills: [{ id: 'resistance', characteristic: 'endurance', advances: 20 }] } as unknown as typeof nu;
    expect(testValue(avecAncienneGraphie, 'resistance')).toBe(testValue(nu, 'resistance'));
    expect(testValue(avecGraphieCourante, 'resistance')).toBe(testValue(nu, 'resistance') + 20);
  });
  it('le CADRE DE CAMPAGNE entre au snapshot (#717)', () => {
    const data = snapshotSave(etatInitialDuJeu(), '2026-08-31T00:00:00.000Z').data;
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['chapitreDepuis', 'objectifsSoldes', 'pendingOuverture', 'pendingChapterRecap']));
  });
  it('la SCÈNE persistée s’annonce (#1552)', () => {
    const data = snapshotSave({ ...etatInitialDuJeu(), scene: testScene() }, '2026-08-31T00:00:00.000Z').data;
    expect(testScene().type, 'une scène du dépôt s’annonce').toBe('scene');
    expect((data.scene as { type?: string }).type, 'la scène persistée doit porter son `type`').toBe('scene');
  });
  it('les ids de PLACE sont des rangs (#1680) : un autre vocabulaire est élagué en silence', () => {
    const places = findPropById('table-ronde-4-tabourets')!.seatSlots!.map((s) => s.id);
    expect(places).toEqual(['place-1', 'place-2', 'place-3', 'place-4']);

    // LE DÉFAUT, mesuré sur le chemin réel : ce que ferait le chargement si la version laissait passer.
    const scene = emptyScene('scene-test', 12, 12);
    scene.entities = [
      { id: 'table-1', kind: 'prop', ref: 'table-ronde-4-tabourets', pos: { x: 5, y: 5 }, usable: { assise: true } },
      { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 6 } },
    ] as typeof scene.entities;
    const ancien = { 'table-1': { 'place-nord': { kind: 'entity' as const, entityId: 'pnj-1' } } };
    expect(pruneSeatAssignments({ ...scene, seatAssignments: ancien }, 4), 'l’élagage est MUET').toEqual({});
    // La MÊME assise, dite au vocabulaire courant, SURVIT : c'est bien l'id, et rien d'autre, qui
    // décide — sans cette moitié, le contrat ci-dessus passerait aussi sur une scène mal formée.
    const courant = { 'table-1': { 'place-1': { kind: 'entity' as const, entityId: 'pnj-1' } } };
    expect(pruneSeatAssignments({ ...scene, seatAssignments: courant }, 4)).toEqual(courant);
  });
  it('une op de Talent hors grammaire (`grantTalent`) lève à `applyOps` (#1473)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    expect(() => applyOps(h, [{ op: 'grantTalent', talentId: 'chanceux' } as never], { rng: makeRNG(1) })).toThrow();
  });
  it('une save neuve d’Arène, rechargée, résout ses zones (#1692)', () => {
    expect(lancerCampagne(useGame.getState, null)).toBeNull();
    const json = exportSave(snapshotSave(useGame.getState(), '2026-09-27T00:00:00.000Z'));
    resetSceneRegistry();
    useGame.setState(useGame.getInitialState());
    expect(useGame.getState().importGame(json)).toBeNull();
    useGame.getState().transitionTo('arene-hub');
    expect(useGame.getState().scene?.id).toBe('arene-hub');
  });
  it('une chute se dérive de ses `participants` ; une chute à tombant unique lève (#700)', () => {
    const tombantUnique = { combatantId: 'h', to: { x: 1, y: 1 }, metres: 4, attempt: null, phase: 'choice', result: null };
    // LE DÉFAUT, sur le chemin réel : `FallModal` dérive sa phase par `phaseDeChute` à l'ouverture.
    expect(() => phaseDeChute(tombantUnique as never)).toThrow(TypeError);
    const courante: PendingFall = { test: testDeRegle('chute', 'tenter'), to: { x: 1, y: 1 }, metres: 4, initiateurId: 'h', participants: [{ id: 'h', attempt: null, result: null }] };
    expect(phaseDeChute(courante)).toBe('choice');
  });
  it('l’empreinte d’un décor à recette TOURNE avec son cap (#1509)', () => {
    const scene = emptyScene('scene-test', 12, 12);
    scene.entities = [{ id: 'table-1', kind: 'prop', ref: 'table-2x1', pos: { x: 5, y: 5 }, facing: 'E' }] as typeof scene.entities;
    expect(entityBlockedAt(scene, 5, 6, 0), 'au cap E la table occupe la case au SUD').toBe(true);
    expect(entityBlockedAt(scene, 6, 5, 0), 'au cap E la case à l’EST est libre').toBe(false);
    const auSud = { ...scene, entities: [{ ...scene.entities[0], facing: 'S' }] as typeof scene.entities };
    expect(entityBlockedAt(auSud, 6, 5, 0), 'au cap S la table occupe la case à l’EST').toBe(true);
    expect(entityBlockedAt(auSud, 5, 6, 0), 'au cap S la case au SUD est libre').toBe(false);
  });

  it('les rayons de lumière PERSISTÉS sont en MÈTRES (#1507)', () => {
    const lumiere = spellEffectOps(findSpellById('lumiere')!.effects).find((o) => o.op === 'light')!;
    expect((lumiere as unknown as Record<string, unknown>).radiusTiles, 'graphie en cases ressuscitée').toBeUndefined();
    const porteur = hero38();
    applyOps(porteur, [lumiere], { rng: desDuTest, label: 'Lumière' });
    const effet = (porteur.activeEffects ?? []).find((e) => e.light)!;
    expect(effet.light!.radiusM, 'la forme PERSISTÉE porte les mètres du folio (LDB 74 l.58)').toBe(20);
    expect((effet.light as unknown as Record<string, unknown>).radiusTiles).toBeUndefined();
  });
  it('le `critTrigger` persisté porte son ENJEU (#1657 B3-1)', () => {
    const commotion = CRITIQUE_DOCS.flatMap((d) => d.entries).find((e) => e.id === 'commotion-cerebrale')!;
    const arme = commotion.escalation!.onNextCritWhileCondition!;
    expect(arme.test.kind, 'la donnée doit porter le nœud, pas la graphie `resist`').toBe('test');
    expect(arme.test.test.stake, 'la DONNÉE ne porte pas d’enjeu : il est posé à l’armement').toBeUndefined();
    const traumas: Trauma[] = [];
    const enjeu = combatStakeRef('critRowTest', { entryId: 'commotion-cerebrale', entryCategory: 'criticalsTete' });
    stampCriticalEscalation(traumas, commotion.escalation!, 'tete', hero38(), makeRNG(1), [], enjeu);
    const pose = traumas.find((t) => t.critTrigger)!.critTrigger!.test;
    expect(pose.test.stake, 'le nœud PERSISTÉ doit porter l’enjeu de la rangée qui l’a armé').toEqual(enjeu);
    expect({ ...pose, test: { ...pose.test, stake: undefined } })
      .toEqual({ ...arme.test, test: { ...arme.test.test, stake: undefined } }); // rien d’autre n’a bougé
  });
  it('le marqueur d’amputation DIFFÉRÉE porte son NŒUD (#1657 B3-1b)', () => {
    const coupure = CRITIQUE_DOCS.flatMap((d) => d.entries).find((e) => e.id === 'coupure-a-l-orteil')!;
    expect(coupure.amputation!.timing).toBe('postEncounter');
    const r = resolveCritique('ldb', heroCritique(), 'jambeD', makeRNG(1), { forcedRoll: coupure.min });
    const marque = r.traumas.find((t) => t.pendingAmputation)!.pendingAmputation!;
    expect(marque.kind, 'le marqueur PERSISTÉ doit être un nœud `test`, pas la donnée `Amputation`').toBe('test');
    expect((marque as Extract<typeof marque, { kind: 'test' }>).test.stake, 'et porter l’enjeu de sa rangée')
      .toEqual(combatStakeRef('critRowTest', { entryId: 'coupure-a-l-orteil', entryCategory: 'criticalsJambe' }));
  });
  it('le coup à l’équipage d’un bateau s’ouvre en BANDE (#1657 B3-2)', () => {
    expect(applierDe('triggeredBatchTest'), 'la porte qui sert désormais ce jet doit exister').toBeDefined();
  });

  it('les étapes d’entretien se servent par l’applier de la porte (#1657 B3-3)', () => {
    expect(applierDe('diseaseTick'), 'l’applier du cycle de maladie doit exister').toBeDefined();
  });

  it('les jets en attente sauvés portent le nom figé (#1882, #1906)', () => {
    const approche = { combatantId: 'H', sourceId: 'E', sourceName: 'Ogre', intent: { kind: 'entity' as const, id: 'E' }, result: null };
    const s = snapshotSave({ ...etatInitialDuJeu(), pendingApproach: approche as never }, 'x');
    expect((s.data as { pendingApproach?: unknown }).pendingApproach, 'la forme neuve est PERSISTÉE').toEqual(approche);
  });

  it('le cap d’exploration est une entrée de GROUPE (#1362)', () => {
    useGame.setState({ facing: poserCapDuGroupe({}, 'E') });
    const data = snapshotSave(useGame.getState(), 'maintenant').data as { facing: Record<string, Dir8> };
    expect(capDuGroupe({ facing: data.facing })).toBe('E');
  });

  it('la spéc en LIBELLÉ ne couvre pas son emplacement (#1548)', () => {
    const sv = talents.find((t) => t.id === 'savoir-vivre')!;
    expect(specResolves(sv, 'Érudit'), 'valeur PERSISTÉE par un héros de 33').toBe(false);
    expect(specResolves(sv, 'erudits')).toBe(true);
    const slots = talentSlots(careerLevels.filter((l) => l.career === 'apothicaire'), 1);
    const slot = slots.find((s) => s.options.some((o) => o.optionId === 'savoir-vivre'))!;
    expect(slotCovers(slot, 'savoir-vivre', 'Érudit')).toBe(false);
    expect(slotCovers(slot, 'savoir-vivre', 'erudits')).toBe(true);
  });

  it('la vignette porte le LIBELLÉ de la scène (jamais son id), et la scène voyage ENTIÈRE dans `data`', () => {
    const scene = { ...emptyScene('scene-id-a-ne-pas-afficher', 2, 2), label: 'La Salle du Trône' };
    const save = snapshotSave({ ...etatInitialDuJeu(), scene }, '2026-08-29T00:00:00.000Z');
    expect(save.sceneLabel).toBe('La Salle du Trône');
    expect(save.data.scene?.label).toBe('La Salle du Trône');
    expect(snapshotSave({ ...etatInitialDuJeu(), scene: null }, '2026').sceneLabel).toBe('Sans scène');
  });
  it('objet malformé / version absente → null', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('pas un objet')).toBeNull();
    expect(parseSave({ savedAt: 'x', data: {} })).toBeNull(); // version absente
  });
});

// #2404 · `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`
describe('FORMAT — une save d’un autre format est jetée, jamais migrée', () => {
  const stableKey = (slot: number) => `wfrp4.save.${slot}`;
  const save = (version: string | number, sceneLabel = 'Ancienne') => ({ version, savedAt: '2026-08-17', sceneLabel, gameTime: 3, data: { flags: { 'drapeau-x': true } } });
  const ls = () => (globalThis as { localStorage: Storage }).localStorage;

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });

  it('save d’un autre format : REJETÉE, RETIRÉE du stockage, témoin « autreFormat » posé', () => {
    ls().setItem(stableKey(1), JSON.stringify(save('autre-format')));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull(); // la donnée est SUPPRIMÉE, pas laissée à pourrir
    expect(takeObsoleteNotice()).toEqual([{ slot: 1, cause: 'autreFormat' }]);
    expect(takeObsoleteNotice()).toEqual([]); // témoin à usage unique
    expect(t('saveload.error.autreFormat', { emplacement: 'Emplacement 1' })).toBe('Emplacement 1 : sauvegarde d’un autre format, retirée.');
  });

  it('save à numéro de version : même sort', () => {
    ls().setItem(stableKey(2), JSON.stringify(save(66)));
    expect(readSlot(2)).toBeNull();
    expect(ls().getItem(stableKey(2))).toBeNull();
    expect(takeObsoleteNotice()).toEqual([{ slot: 2, cause: 'autreFormat' }]);
  });

  it('save à le format courant : chargée normalement, rien de jeté, aucun message', () => {
    ls().setItem(stableKey(2), JSON.stringify(save(FORMAT_SAVE, 'Courante')));
    expect(readSlot(2)?.sceneLabel).toBe('Courante');
    expect(ls().getItem(stableKey(2))).not.toBeNull();
    expect(takeObsoleteNotice()).toEqual([]);
  });

  it('loadGame sur une save d’un autre format : refusé, l’état courant INTACT, l’emplacement vidé', () => {
    useGame.setState({ flags: { 'drapeau-vivant': true } });
    ls().setItem(stableKey(1), JSON.stringify(save('autre-format')));
    expect(useGame.getState().loadGame(1)).toBe(false);
    expect(useGame.getState().flags['drapeau-vivant']).toBe(true);
    expect(useGame.getState().flags['drapeau-x']).toBeUndefined();
    expect(listSaves()[0]).toBeNull();
    expect(takeObsoleteNotice()).toEqual([{ slot: 1, cause: 'autreFormat' }]);
  });

  it('save au format courant qui nomme une règle ou un État hors du registre : CHARGÉE élaguée de ces seuls ids, nommés ; l’emplacement reste (#1463 LD.1)', () => {
    const r = OPTIONAL_RULES.find((x) => x.kind === 'flag')!;
    const autre = OPTIONAL_RULES.find((x) => x.kind === 'flag' && x.id !== r.id)!;
    const connu = conditionIds()[0];
    const lue = {
      ...save(FORMAT_SAVE),
      rules: { [r.id]: !r.default, 'regle-hors-registre': true, [autre.id]: 'texte' },
      data: { party: [{ id: 'h', label: 'H', kind: 'hero', conditions: [{ id: connu, value: 1 }, { id: 'etat-hors-registre', value: 1 }] }] },
    };
    ls().setItem(stableKey(1), JSON.stringify(lue));
    expect(readSlot(1), 'la dérive du registre ne jette pas la save').not.toBeNull();
    expect(takeObsoleteNotice()).toEqual([]);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(rule(r.id), 'la surcharge connue s’applique').toBe(!r.default);
    expect(rule(autre.id), 'la valeur non conforme est retirée').toBe(autre.default);
    expect(useGame.getState().party[0].conditions.map((c) => c.id), 'le héros reste, sans l’État inconnu').toEqual([connu]);
    expect(useGame.getState().retraitsDeChargement).toEqual({ regles: ['regle-hors-registre', autre.id], etats: ['etat-hors-registre'] });
    expect(ls().getItem(stableKey(1)), 'l’emplacement n’est pas vidé').not.toBeNull();
  });

  it('elaguerSave : une save que le registre reconnaît entière ne perd rien, et ne dit rien', () => {
    const r = OPTIONAL_RULES[0];
    const entiere = { ...save(FORMAT_SAVE), rules: { [r.id]: r.default }, data: { party: [{ id: 'h', conditions: [{ id: conditionIds()[0], value: 1 }] }] } } as unknown as SaveGame;
    expect(elaguerSave(entiere)).toEqual({ save: entiere, retraits: { regles: [], etats: [] } });
  });

  it('contenu illisible : jeté, témoin « illisible » — jamais un crash', () => {
    ls().setItem(stableKey(1), 'pas du json');
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toEqual([{ slot: 1, cause: 'illisible' }]);
  });

  it('emplacement VIDE : ni message ni bruit', () => {
    expect(readSlot(1)).toBeNull();
    expect(listSaves()).toEqual([null, null, null]);
    expect(takeObsoleteNotice()).toEqual([]);
  });

  it('saveToSlot écrase une save d’un autre format', () => {
    ls().setItem(stableKey(1), JSON.stringify(save('autre-format', 'Autre')));
    const neuve = { version: FORMAT_SAVE, savedAt: '2026-08-17', sceneLabel: 'Nouveau', gameTime: 0, data: {}, rules: {} } as unknown as SaveGame;
    expect(saveToSlot(1, neuve)).toBe(true);
    expect(readSlot(1)?.sceneLabel).toBe('Nouveau');
  });

  it('deleteSlot vide l’emplacement', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(FORMAT_SAVE)));
    deleteSlot(1);
    expect(ls().getItem(stableKey(1))).toBeNull();
  });
});
