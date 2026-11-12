/**
 * LA FORME PERSISTÉE (#3058) : ce que l'écriture d'une save porte (`snapshotSave`), ce que sa relecture refuse
 * (`lireSave`) et ce que son chargement lit (`chargerLaSave`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { etatInitialDuJeu } from './etat';
import { testDeRegle } from '../engine/reglesChiffrees';
import { chargerLaSave, lireSave, snapshotSave, type SaveGame } from './persistance/save';
import { FORMAT_SAVE } from './persistance/formats.generated';
import { OPTIONAL_RULES } from '../engine/policy';
import { talents, careerLevels, combatStakeRef, conditionIds } from '../data/index';
import { specAuCatalogue } from '../data/schemas/grammaire/ref';
import { applierDe } from './cascade';
import { ouvrirLeBanc } from './banc.testkit';
import { talentSlots, slotCovers } from '../engine/careerSlots';
import { createHero } from '../engine/character';
import { testValue } from '../engine/skills';
import { makeRNG } from '../engine/dice';
import { stampCriticalEscalation } from '../engine/trauma';
import { resolveCritique } from '../engine/critical';
import { CRITIQUE_DOCS } from '../data/criticals';
import type { Combatant, Trauma } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from './monde/scene';
import { pruneSeatAssignments } from './monde/seating';
import { capDuGroupe, poserCapDuGroupe } from './monde/combatants';
import type { Dir8 } from '../geometry/dir8';
import { entityBlockedAt } from './monde/sceneRules';
import { phaseDeChute } from './fallMove';
import type { PendingFall } from './pendings';
import { findPropById, findSpellById } from '../data/index';
import { spellEffectOps } from '../engine/flowCore';
import { applyOps } from '../engine/ops';
import { desDuTest } from '../engine/dice.testkit';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/** Porteur sans séquelle. */
const hero38 = (): Combatant => combattantDeTest({ id: 'h', label: 'H', kind: 'heros', traumas: [] });

/** Le MÊME porteur : `resolveCritique` lit l'Endurance (sévérité du d100). */
const heroCritique = (): Combatant => combattantDeTest({
  id: 'h', label: 'H', kind: 'heros', traumas: [],
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40 },
  wounds: blessuresDeBase(12, 6), bodyShape: 'humanoide', critEntriesSuffered: [],
});

/** Comportements VIVANTS de la forme persistée : chacun verrouille ce que lit le chargement d'une save. */
describe('forme persistée — ce que le chargement lit', () => {
  it('une `SkillInstance` s’apparie par `id` (#1548) : la graphie `skillId` perd ses Augmentations', () => {
    // Une instance à la graphie `skillId` n'est appariée par AUCUN Test — le moteur
    // apparie sur `id`, donc la valeur retombe sur la Caractéristique nue, Augmentations perdues.
    const nu = { ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sonde', seed: 1 }), skills: [] };
    const avecAncienneGraphie = { ...nu, skills: [{ skillId: 'resistance', characteristic: 'endurance', advances: 20 }] } as unknown as typeof nu;
    const avecGraphieCourante = { ...nu, skills: [{ id: 'resistance', characteristic: 'endurance', advances: 20 }] } as unknown as typeof nu;
    expect(testValue(avecAncienneGraphie, { skill: { id: 'resistance' } })).toBe(testValue(nu, { skill: { id: 'resistance' } }));
    expect(testValue(avecGraphieCourante, { skill: { id: 'resistance' } })).toBe(testValue(nu, { skill: { id: 'resistance' } }) + 20);
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
      { id: 'table-1', kind: 'prop', decor: { id: 'table-ronde-4-tabourets' }, pos: { x: 5, y: 5 }, usable: { assise: true } },
      { id: 'pnj-1', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 5, y: 6 } },
    ] as typeof scene.entities;
    const ancien = { 'table-1': { 'place-nord': { kind: 'entite' as const, entityId: 'pnj-1' } } };
    expect(pruneSeatAssignments({ ...scene, seatAssignments: ancien }, 4), 'l’élagage est MUET').toEqual({});
    // La MÊME assise, dite au vocabulaire courant, SURVIT : c'est bien l'id, et rien d'autre, qui
    // décide — sans cette moitié, le contrat ci-dessus passerait aussi sur une scène mal formée.
    const courant = { 'table-1': { 'place-1': { kind: 'entite' as const, entityId: 'pnj-1' } } };
    expect(pruneSeatAssignments({ ...scene, seatAssignments: courant }, 4)).toEqual(courant);
  });
  it('une op de Talent hors grammaire (`grantTalent`) lève à `applyOps` (#1473)', () => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    expect(() => applyOps(h, [{ op: 'grantTalent', talentId: 'chanceux' } as never], { idNeuf: idsDeTest, rng: makeRNG(1) })).toThrow();
  });
  it('une chute se dérive de ses `participants` ; une chute à tombant unique lève (#700)', () => {
    const tombantUnique = { combatantId: 'h', to: { x: 1, y: 1 }, metres: 4, attempt: null, phase: 'choix', result: null };
    // LE DÉFAUT, sur le chemin réel : `FallModal` dérive sa phase par `phaseDeChute` à l'ouverture.
    expect(() => phaseDeChute(tombantUnique as never)).toThrow(TypeError);
    const courante: PendingFall = { test: testDeRegle('chute', 'tenter'), to: { x: 1, y: 1 }, metres: 4, initiateurId: 'h', participants: [{ id: 'h', attempt: null, result: null }] };
    expect(phaseDeChute(courante)).toBe('choix');
  });
  it('l’empreinte d’un décor à recette TOURNE avec son cap (#1509)', () => {
    const scene = emptyScene('scene-test', 12, 12);
    scene.entities = [{ id: 'table-1', kind: 'prop', decor: { id: 'table-2x1' }, pos: { x: 5, y: 5 }, facing: 'E' }] as typeof scene.entities;
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
    applyOps(porteur, [lumiere], { idNeuf: idsDeTest, rng: desDuTest, label: 'Lumière' });
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
    const enjeu = combatStakeRef('critique-ligne-test', { entryId: 'commotion-cerebrale', entryCategory: 'criticalsTete' });
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
      .toEqual(combatStakeRef('critique-ligne-test', { entryId: 'coupure-a-l-orteil', entryCategory: 'criticalsJambe' }));
  });
  it('le coup à l’équipage d’un bateau s’ouvre en BANDE (#1657 B3-2)', () => {
    ouvrirLeBanc(); // les tables du jeu posées
    expect(applierDe('testDeclencheEnBande'), 'la porte qui sert désormais ce jet doit exister').toBeDefined();
  });

  it('les étapes d’entretien se servent par l’applier de la porte (#1657 B3-3)', () => {
    ouvrirLeBanc(); // les tables du jeu posées
    expect(applierDe('maladie-test-quotidien'), 'l’applier du cycle de maladie doit exister').toBeDefined();
  });

  it('les jets en attente sauvés portent le nom figé (#1882, #1906)', () => {
    const approche = { combatantId: 'H', sourceId: 'E', sourceName: 'Ogre', intent: { kind: 'entity' as const, id: 'E' }, result: null };
    const s = snapshotSave({ ...etatInitialDuJeu(), pendingApproach: approche as never }, 'x');
    expect((s.data as { pendingApproach?: unknown }).pendingApproach, 'la forme neuve est PERSISTÉE').toEqual(approche);
  });

  it('le cap d’exploration est une entrée de GROUPE (#1362)', () => {
    const data = snapshotSave({ ...etatInitialDuJeu(), facing: poserCapDuGroupe({}, 'E') }, 'maintenant').data as { facing: Record<string, Dir8> };
    expect(capDuGroupe({ facing: data.facing })).toBe('E');
  });

  it('la spéc en LIBELLÉ ne couvre pas son emplacement (#1548)', () => {
    const sv = talents.find((t) => t.id === 'savoir-vivre')!;
    expect(specAuCatalogue('talent', sv.id, 'Érudit'), 'valeur PERSISTÉE par un héros de 33').toBe(false);
    expect(specAuCatalogue('talent', sv.id, 'erudits')).toBe(true);
    const slots = talentSlots(careerLevels.filter((l) => l.career.id === 'apothicaire'), 1);
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
  it('objet malformé / version absente → autre format', () => {
    expect(lireSave('null')).toBe('autreFormat');
    expect(lireSave('"pas un objet"')).toBe('autreFormat');
    expect(lireSave(JSON.stringify({ savedAt: 'x', data: {} }))).toBe('autreFormat'); // version absente
    expect(lireSave(JSON.stringify({ version: 66, savedAt: 'x', data: {} }))).toBe('autreFormat'); // version numérique
  });
});

describe('FORMAT — une save d’un autre format est jetée, jamais migrée', () => {
  const save = (version: string | number, sceneLabel = 'Ancienne') => ({ version, savedAt: '2026-08-17', sceneLabel, gameTime: 3, data: { flags: { 'drapeau-x': true } } });

  it('chargerLaSave : une save que le registre reconnaît entière ne perd rien, et ne dit rien', () => {
    const r = OPTIONAL_RULES[0];
    const entiere = { ...save(FORMAT_SAVE), rules: { [r.id]: r.default }, data: { party: [combattantDeTest({ id: 'h', conditions: [{ id: conditionIds()[0], value: 1 }] })] } } as unknown as SaveGame;
    const chargee = chargerLaSave(entiere);
    expect(chargee.retraits).toBeNull();
    expect(chargee.regles).toEqual(entiere.rules);
    expect(chargee.etat.party).toEqual(entiere.data.party);
  });
});
