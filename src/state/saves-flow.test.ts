/**
 * Jalon 5 — Sauvegarde/chargement de partie : snapshot zéro-maintenance (clés de données de
 * getInitialState), localStorage 3 slots, export/import JSON, refus en combat.
 *
 * Plus le FORMAT (#2404) : une save dont la version diffère de `FORMAT_SAVE` est REJETÉE et RETIRÉE
 * du stockage, avec un témoin de message pour le joueur.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGame, resetSceneRegistry } from './store';
import { lancerCampagne } from '../scenes/campaign';
import { idDeSortVivant } from '../data/sortsFusionnes';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, parseSave, snapshotSave, takeObsoleteNotice, type SaveGame } from './saves';
import { FORMAT_SAVE } from './formats.generated';
import { rule, setRule, loadRuleOverrides } from '../engine/policy';
import { talents, careerLevels, specResolves, combatStakeRef } from '../data/index';
import { cascadeAppliers } from './cascade';
import './combatFlow'; // baril : enregistre les appliers de cascade (`triggeredBatchTest`), effet de bord
import { talentSlots, slotCovers } from '../engine/careerSlots';
import { createHero } from '../engine/character';
import { testValue } from '../engine/skills';
import { makeRNG } from '../engine/dice';
import { stampCriticalEscalation } from '../engine/trauma';
import { resolveCritique } from '../engine/critical';
import { CRITIQUE_DOCS } from '../data/criticals';
import type { Combatant, Trauma } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from './scene';
import { pruneSeatAssignments } from './seating';
import { capDuGroupe, poserCapDuGroupe } from './combatants';
import type { Dir8 } from './dir8';
import { entityBlockedAt } from './sceneRules';
import { phaseDeChute } from './fallMove';
import type { PendingFall } from './pendings';
import { findPropById, findSpellById } from '../data/index';
import { spellEffectOps } from './flow';
import { applyOps } from '../engine/ops';

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
    useGame.setState({ party: [hero], battle: null });
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
   * SNAPSHOT ZÉRO-MAINTENANCE : le contrat POSITIF de `snapshotSave` — tout champ de DONNÉES de l'état
   * initial entre dans la save, sans qu'aucune liste ne le déclare ; ce qui n'y entre pas est une
   * exclusion NOMMÉE dans le module, et elles se comptent ici. Un champ neuf oublié (une préférence
   * qui ne se rechargerait pas) rougit sans qu'on ait rien à inscrire.
   */
  it('tout champ de données de l’état initial entre au snapshot ; les exclusions sont NOMMÉES', () => {
    const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
    const champsDeDonnees = Object.keys(initial).filter((k) => typeof initial[k] !== 'function');
    expect(champsDeDonnees.length, 'témoin : l’état initial porte bien des données').toBeGreaterThan(20);
    const data = snapshotSave(useGame.getState() as unknown as Record<string, unknown>, initial, 'maintenant').data;
    const absents = champsDeDonnees.filter((k) => !(k in data));
    expect(absents.sort(), 'un champ de données hors save sans exclusion nommée')
      .toEqual(['campaignNarratif', 'debugLabels', 'debugRoofCut', 'reveler']);
  });

  it('`reveler` (Alt maintenu) n’entre dans AUCUNE save : c’est un état de TOUCHE', () => {
    useGame.setState({ reveler: true } as never);
    expect(useGame.getState().saveGame(1), 'témoin : la save est bien écrite').toBe(true);
    expect('reveler' in readSlot(1)!.data, 'une partie rechargée aurait ses utilisables révélés, touche relâchée').toBe(false);
  });

  it('les drapeaux de RECETTE (#1478) n’entrent dans AUCUNE save : ni l’overlay, ni le lève-toit', () => {
    useGame.setState({ debugLabels: true, debugRoofCut: false });
    expect(useGame.getState().saveGame(1), 'témoin : la save est bien écrite').toBe(true);
    const data = readSlot(1)!.data;
    expect('debugLabels' in data, 'une partie rechargée aurait la carte annotée de debug').toBe(false);
    expect('debugRoofCut' in data, 'une partie rechargée aurait le lève-toit débrayé — et l’invité coop avec').toBe(false);
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

describe('parseSave — la version DOIT être le format courant', () => {
  const cur = { version: FORMAT_SAVE, savedAt: '2026', sceneLabel: 's', gameTime: 0, data: {} };
  it('save à le format courant : acceptée telle quelle', () => {
    expect(parseSave(cur)).toEqual(cur);
  });
  it('autre format, numéro de version compris → null : la save se jette', () => {
    expect(parseSave({ ...cur, version: 'autre-format' })).toBeNull();
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
    const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
    const data = snapshotSave(initial, initial, '2026-08-31T00:00:00.000Z').data;
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['chapitreDepuis', 'objectifsSoldes', 'pendingOuverture', 'pendingChapterRecap']));
  });
  it('la SCÈNE persistée s’annonce (#1552)', () => {
    const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
    const data = snapshotSave({ ...initial, scene: testScene() }, initial, '2026-08-31T00:00:00.000Z').data;
    expect(testScene().type, 'une scène du dépôt s’annonce').toBe('scene');
    expect((data.scene as { type?: string }).type, 'la scène persistée doit porter son `type`').toBe('scene');
  });
  it('les ids de PLACE sont des rangs (#1680) : un autre vocabulaire est élagué en silence', () => {
    const places = findPropById('table-ronde-4-tabourets')!.seatSlots!.map((s) => s.id);
    expect(places).toEqual(['place-1', 'place-2', 'place-3', 'place-4']);

    // LE DÉFAUT, mesuré sur le chemin réel : ce que ferait le chargement si la version laissait passer.
    const scene = emptyScene(12, 12);
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
  it('un sort FUSIONNÉ est absent du catalogue, son id vivant est celui de la fusion (#1897)', () => {
    expect(findSpellById('alarme'), 'l’id fusionné est absent du catalogue').toBeUndefined();
    expect(idDeSortVivant('alarme')).toBe('alerte');
  });
  it('une op de Talent hors grammaire (`grantTalent`) lève à `applyOps` (#1473)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    expect(() => applyOps(h, [{ op: 'grantTalent', talentId: 'chanceux' } as never], { rng: makeRNG(1) })).toThrow();
  });
  it('une save neuve d’Arène, rechargée, résout ses zones (#1692)', () => {
    expect(lancerCampagne(useGame.getState, null)).toBeNull();
    const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
    const json = exportSave(snapshotSave(useGame.getState() as unknown as Record<string, unknown>, initial, '2026-09-27T00:00:00.000Z'));
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
    const courante: PendingFall = { to: { x: 1, y: 1 }, metres: 4, initiateurId: 'h', participants: [{ id: 'h', attempt: null, result: null }] };
    expect(phaseDeChute(courante)).toBe('choice');
  });
  it('l’empreinte d’un décor à recette TOURNE avec son cap (#1509)', () => {
    const scene = emptyScene(12, 12);
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
    applyOps(porteur, [lumiere], { label: 'Lumière' });
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
    expect(Object.keys(cascadeAppliers), 'la porte qui sert désormais ce jet doit exister').toContain('triggeredBatchTest');
  });

  it('les étapes d’entretien se servent par l’applier de la porte (#1657 B3-3)', () => {
    expect(Object.keys(cascadeAppliers), 'l’applier du cycle de maladie doit exister').toContain('diseaseTick');
  });

  it('les jets en attente sauvés portent le nom figé (#1882, #1906)', () => {
    const init = useGame.getInitialState();
    const approche = { combatantId: 'H', sourceId: 'E', sourceName: 'Ogre', intent: { kind: 'entity' as const, id: 'E' }, result: null };
    const s = snapshotSave({ ...init, pendingApproach: approche } as unknown as Record<string, unknown>, init as unknown as Record<string, unknown>, 'x');
    expect((s.data as { pendingApproach?: unknown }).pendingApproach, 'la forme neuve est PERSISTÉE').toEqual(approche);
  });

  it('le cap d’exploration est une entrée de GROUPE (#1362)', () => {
    useGame.setState({ facing: poserCapDuGroupe({}, 'E') });
    const etat = useGame.getState() as unknown as Record<string, unknown>;
    const data = snapshotSave(etat, etat, 'maintenant').data as { facing: Record<string, Dir8> };
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

  /**
   * TÉMOIN d'une couture que le TYPECHECK NE VOIT PAS : `snapshotSave` reçoit un `Record` opaque, donc
   * l'accès au libellé de scène passe par un cast — un champ renommé y dégraderait la vignette vers
   * l'id EN SILENCE, sans une seule erreur de compilation. Ce test mesure le RÉSULTAT (un libellé, pas
   * l'id) : il rougit dès que la couture se débranche.
   */
  it('la vignette porte le LIBELLÉ de la scène (jamais son id), et la scène voyage ENTIÈRE dans `data`', () => {
    const initial = useGame.getState() as unknown as Record<string, unknown>;
    const scene = { id: 'scene-id-a-ne-pas-afficher', label: 'La Salle du Trône', dimensions: { w: 2, h: 2 } };
    const save = snapshotSave({ ...initial, scene }, initial, '2026-08-29T00:00:00.000Z');
    expect(save.sceneLabel).toBe('La Salle du Trône');
    expect((save.data.scene as { label?: string })?.label).toBe('La Salle du Trône');
    // Sans scène, la vignette le DIT — elle ne rend pas une chaîne vide.
    expect(snapshotSave({ ...initial, scene: null }, initial, '2026').sceneLabel).toBe('Sans scène');
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
