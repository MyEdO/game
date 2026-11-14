import { describe, it, expect } from 'vitest';
import { emptyScene, isDescriptiveZone, layerTiles, type Scene } from './monde/scene';
import { isRoomZone } from './monde/rooms';
import { EFFECT_ZONE_SEEDS } from './sceneEditLecture';
// `putLayer` : appelant unique `noyau/mapSpec.ts` (`buildScene`), sans porte d'écran (#855).
import {
  editEntity,
  editEntityCombat,
  putLayer,
  renameActionAuthoree,
  setSceneScalaires,
  setSceneLabel,
  renameScene,
  editEntry,
  setSceneFlags,
  addArchitectureBody,
  patchArchitectureBody,
  patchArchitecturePart,
  patchBuildingMass,
  patchRoofExclusion,
  addRoofExclusion,
  setFacadeSectionZ,
  addFacadeSection,
  addFacadeFeature,
  patchFacadeFeature,
  removeFacadeFeature,
  BORNES_D_OUVERTURE,
  addBuildingMass,
  rederiveRoofMasses,
  addEffectZone,
  renameEffectZone,
} from './sceneEdit';
import { sceneEntitySchema, PENTE_TOIT_DEG, type Terrain } from '../data/schemas/defs-scenes/scene';
import { buildingRoofMaterial } from './monde/buildings';
import { encloseRect } from './sceneEdit.testkit';
import type { ActionAuthoree, SceneEntity } from './monde/scene';

/** Primitives pures consommées par le headless-editor `buildScene`. */

describe('édition de scène — scalaires de scène', () => {
  it('emptyScene pose des défauts EXPLICITES pour metresPerTile/ambientLight (#841 FU-A)', () => {
    const s = emptyScene('scene-test', 4, 4);
    expect(s.metresPerTile).toBe(2);
    expect(s.ambientLight).toBe('auto');
    expect(s.environment).toBeUndefined(); // « non spécifié » est une valeur légitime, pas un défaut caché
  });

  it('setSceneScalaires pose puis retire chaque scalaire, sans muter la scène — survit à un aller-retour JSON (#841 FU-A)', () => {
    const s = emptyScene('scene-test', 4, 4);
    const pose = setSceneScalaires(s, { metresPerTile: 10, ambientLight: 'jour', environment: 'sauvage', weather: 'brouillard' });
    expect(JSON.parse(JSON.stringify(pose))).toMatchObject({ metresPerTile: 10, ambientLight: 'jour', environment: 'sauvage', weather: 'brouillard' });
    const retire = setSceneScalaires(pose, { metresPerTile: undefined, ambientLight: undefined, environment: undefined, weather: undefined });
    for (const k of ['metresPerTile', 'ambientLight', 'environment', 'weather'] as const) expect(k in retire, `${k} retiré du document`).toBe(false);
    expect(s.metresPerTile).toBe(2); // immuable — défaut d'origine inchangé
    expect(s.ambientLight).toBe('auto');
  });

  it('renameScene refuse un id vide ou porté par une autre scène du projet', () => {
    const s = emptyScene('scene-test', 4, 4);
    const autres = [emptyScene('cave', 4, 4)];
    expect(renameScene(s, autres, 'cave')).toBe(s);
    expect(renameScene(s, autres, '  ')).toBe(s);
    expect(renameScene(s, autres, ' grenier ').id).toBe('grenier');
  });

  it('editEntry plafonne la case à la carte et la ramène à une case entière, comme `moveSel`', () => {
    const s: Scene = { ...emptyScene('scene-test', 4, 4), entryPoints: { porte: { x: 1, y: 1 } } };
    expect(editEntry(s, 'porte', { x: 9, y: -2 }).entryPoints?.porte).toEqual({ x: 3, y: 0 });
    expect(editEntry(s, 'porte', { y: 2.6, z: 1 }).entryPoints?.porte).toEqual({ x: 1, y: 2, z: 1 });
    expect(editEntry(editEntry(s, 'porte', { z: 1 }), 'porte', { z: 0 }).entryPoints?.porte).toEqual({ x: 1, y: 1 });
    expect(editEntry(s, 'absente', { x: 2 })).toBe(s);
  });

  it('setSceneScalaires refuse au TYPE d’effacer `label`, seul champ requis du sous-ensemble ; `setSceneLabel` le pose', () => {
    const s = emptyScene('scene-test', 4, 4);
    // @ts-expect-error `label` est requis par le schéma : il n'est pas un scalaire effaçable.
    setSceneScalaires(s, { label: undefined });
    expect(setSceneLabel(s, 'Cour').label).toBe('Cour');
  });

  it('setSceneFlags fusionne dans flags sans muter la scène', () => {
    const s: Scene = { ...emptyScene('scene-test', 4, 4), flags: { a: true } };
    const out = setSceneFlags(s, { b: false });
    expect(out.flags).toEqual({ a: true, b: false });
    expect(s.flags).toEqual({ a: true });
  });
});

describe('édition de scène — zone d’effet : presentation/id (#841 FU-B, le nœud)', () => {
  it('la variante « Pièce » de l’outil zone crée un intérieur NU : aucun effet, satisfait le filtre « Pièces révélées » (Inspector.tsx)', () => {
    const { scene } = addEffectZone(emptyScene('scene-test', 6, 6), { x: 0, y: 0, w: 2, h: 2 }, 0, EFFECT_ZONE_SEEDS.room);
    const zone = scene.effectZones![0];
    expect(zone.presentation).toBe('interior');
    // Le geste de l'auteur est ENTIER dès le glissé : rien à désarmer derrière lui.
    expect(zone.onCross).toBeUndefined();
    expect(zone.perRound).toBeUndefined();
    expect(zone.crossTest).toBeUndefined();
    expect(zone.barrier).toBeUndefined();
    expect(zone.blocksLoS).toBeUndefined();
    expect(isRoomZone(zone)).toBe(true);
    expect(JSON.parse(JSON.stringify(scene)).effectZones[0].presentation).toBe('interior'); // survit au JSON
  });

  it('la variante « Piège / hasard » porte SA graine — l’effet vient de l’outil, pas du créateur partagé', () => {
    const { scene } = addEffectZone(emptyScene('scene-test', 6, 6), { x: 0, y: 0, w: 2, h: 2 }, 0, EFFECT_ZONE_SEEDS.effect);
    const zone = scene.effectZones![0];
    expect(zone.onCross?.some((o) => o.op === 'wounds')).toBe(true);
    expect(isDescriptiveZone(zone)).toBe(false);
    expect(zone.presentation).toBeUndefined();
  });

  it('renameEffectZone renomme l’id ET repropage la référence dans FacadeSection.roomZoneIds', () => {
    const { scene } = addEffectZone(emptyScene('scene-test', 6, 6), { x: 0, y: 0, w: 2, h: 2 });
    const oldId = scene.effectZones![0].id;
    const withFacade: Scene = {
      ...scene,
      architecture: [{
        id: 'corps-0',
        style: { id: 'maison' },
        storeys: [],
        facades: [{ id: 'facade-0', z: 0, edges: [], appearance: 'crepi', roomZoneIds: [oldId] }],
        masses: [],
      }],
    };
    const renamed = renameEffectZone(withFacade, oldId, 'salle-du-tresor');
    expect(renamed.effectZones![0].id).toBe('salle-du-tresor');
    expect(renamed.architecture![0].facades[0].roomZoneIds).toEqual(['salle-du-tresor']);
  });

  it('renameEffectZone est un no-op si id absent, vide, identique ou en collision', () => {
    const { scene } = addEffectZone(emptyScene('scene-test', 6, 6), { x: 0, y: 0, w: 2, h: 2 });
    const oldId = scene.effectZones![0].id;
    const { scene: scene2 } = addEffectZone(scene, { x: 3, y: 3, w: 2, h: 2 });
    const dupeId = scene2.effectZones![1].id;
    expect(renameEffectZone(scene2, 'inexistant', 'x')).toBe(scene2);
    expect(renameEffectZone(scene2, oldId, '  ')).toBe(scene2);
    expect(renameEffectZone(scene2, oldId, oldId)).toBe(scene2);
    expect(renameEffectZone(scene2, oldId, dupeId)).toBe(scene2);
  });
});

describe('édition de scène — patch d’entité', () => {
  const base = (): Scene => {
    const s = emptyScene('scene-test', 6, 6);
    s.entities = [{ id: 'e0', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, combat: { hiddenUntilCombat: true } }];
    return s;
  };

  it('editEntity fusionne les champs de haut niveau (crewIds/upgrades/facing)', () => {
    const out = editEntity(base(), 'e0', { crewIds: ['c1'], upgrades: [{ id: 'blindage-fer' }], facing: 'N' });
    const e = out.entities[0];
    expect(e.crewIds).toEqual(['c1']);
    expect(e.upgrades).toEqual([{ id: 'blindage-fer' }]);
    expect(e.facing).toBe('N');
  });

  it('editEntityCombat fusionne DANS combat sans écraser l’existant', () => {
    const out = editEntityCombat(base(), 'e0', { skills: [{ id: 'projectiles', spec: 'poudre-noire', value: 40 }] });
    const e = out.entities[0];
    expect(e.combat?.skills?.[0].spec).toBe('poudre-noire');
    expect(e.combat?.hiddenUntilCombat).toBe(true); // préservé
  });

  it('no-op si l’entité est absente', () => {
    const s = base();
    expect(editEntity(s, 'nope', { facing: 'S' })).toEqual(s);
    expect(editEntityCombat(s, 'nope', { spells: ['x'] })).toEqual(s);
  });
});

describe('édition de scène — putLayer', () => {
  it('ajoute une couche z avec tuiles + hauteurs, triée', () => {
    const s = emptyScene('scene-test', 2, 2);
    const tiles: Terrain[] = ['pierre', 'pierre', 'pierre', 'pierre'];
    const height = [4, 4, 4, 4];
    const out = putLayer(s, 1, tiles, height);
    const l = out.layers.find((l) => l.z === 1)!;
    expect(l.tiles).toEqual(tiles);
    expect(l.height).toEqual(height);
    expect(out.layers.map((l) => l.z)).toEqual([0, 1]);
  });

  it('remplace la couche z existante (pas de doublon)', () => {
    const s = emptyScene('scene-test', 2, 2);
    const out = putLayer(putLayer(s, 0, ['eau', 'eau', 'eau', 'eau']), 0, ['herbe', 'herbe', 'herbe', 'herbe']);
    expect(out.layers.filter((l) => l.z === 0)).toHaveLength(1);
    expect(layerTiles(out, 0)).toEqual(['herbe', 'herbe', 'herbe', 'herbe']);
  });
});

/**
 * L'ÉDITEUR N'ÉCRIT JAMAIS UN DOCUMENT QUE LE SCHÉMA REFUSE (AGENTS.md règle 2). L'unicité des ids
 * d'action est portée par le `refine` d'`usable` (`data/schemas/defs-scenes/scene.ts`), qui ne mord
 * qu'au PARSE : entre deux chargements, la scène vivante porterait deux actions homonymes, et
 * `jouerAction` jouerait la première pour les deux. La garde vit donc AU GESTE.
 */
describe('renameActionAuthoree — l’unicité d’un id d’action se garde au GESTE, pas au parse', () => {
  const decor = (actions: ActionAuthoree[]): SceneEntity =>
    ({ id: 'coffre', kind: 'prop', pos: { x: 1, y: 1 }, decor: { id: 'coffre' }, usable: { actions } });
  const deux = (): ActionAuthoree[] => [
    { id: 'fouiller', flow: { kind: 'sequence', etapes: [] } },
    { id: 'crocheter', flow: { kind: 'sequence', etapes: [] } },
  ];

  it('vers un id LIBRE : renommé', () => {
    const suivant = renameActionAuthoree(deux(), 'crocheter', 'forcer');
    expect(suivant.map((a) => a.id)).toEqual(['fouiller', 'forcer']);
    expect(sceneEntitySchema.safeParse(decor(suivant)).success, 'et le document reste lisible').toBe(true);
  });

  it('vers un id DÉJÀ PORTÉ : liste INCHANGÉE (même référence — c’est là que l’appelant lit le refus)', () => {
    const avant = deux();
    const suivant = renameActionAuthoree(avant, 'crocheter', 'fouiller');
    expect(suivant, 'référence identique : rien n’a été écrit').toBe(avant);
    expect(suivant.map((a) => a.id)).toEqual(['fouiller', 'crocheter']);
    // CE QUE LA GARDE ÉVITE — le document que l'écriture naïve aurait posé est refusé au parse.
    const double = avant.map((a) => (a.id === 'crocheter' ? { ...a, id: 'fouiller' } : a));
    const verdict = sceneEntitySchema.safeParse(decor(double));
    expect(verdict.success, 'deux actions homonymes : un document que le schéma refuse').toBe(false);
    expect(JSON.stringify(verdict.error?.issues)).toContain('« fouiller » dupliqué');
  });

  it('id vide, inchangé, ou action absente : rien n’est écrit', () => {
    const avant = deux();
    expect(renameActionAuthoree(avant, 'fouiller', '   '), 'un id vide n’est pas une identité').toBe(avant);
    expect(renameActionAuthoree(avant, 'fouiller', 'fouiller'), 'inchangé').toBe(avant);
    expect(renameActionAuthoree(avant, 'inconnue', 'forcer'), 'aucune action à renommer').toBe(avant);
    expect(renameActionAuthoree(avant, 'fouiller', '  forcer  ').map((a) => a.id), 'l’id est TRIMÉ comme partout').toEqual(['forcer', 'crocheter']);
  });
});

describe('édition de scène — corps d’architecture : écrivains bornés du noyau', () => {
  const corps = () => {
    const out = addArchitectureBody(emptyScene('scene-test', 6, 6), { id: 'maison' }, { x: 1, y: 1, w: 2, h: 2 });
    return { scene: rederiveRoofMasses(out.scene), id: out.id, storeyId: out.storeyId };
  };
  const body = (s: Scene, id: string) => s.architecture!.find((b) => b.id === id)!;

  it('changer le type de bâtiment re-dérive la couverture des masses dans le geste', () => {
    // Corps sans intention de toiture propre : sa couverture est celle de son TYPE (`toitureEffective`).
    const plan = encloseRect({ ...emptyScene('scene-test', 12, 12), architecture: [{ id: 'corps', style: { id: 'maison' }, storeys: [], facades: [], masses: [] }] }, { x: 1, y: 1, w: 4, h: 2 });
    const scene = rederiveRoofMasses(plan);
    const couvertures = (s: Scene) => body(s, 'corps').masses.map((m) => m.material);
    expect(couvertures(scene), 'la dérivation ne coiffe pas la pièce').toEqual([buildingRoofMaterial({ id: 'maison' })]);
    expect(buildingRoofMaterial({ id: 'echoppe' }), 'fixture : deux types aux couvertures distinctes').not.toEqual(buildingRoofMaterial({ id: 'maison' }));
    expect(couvertures(patchArchitectureBody(scene, 'corps', { style: { id: 'echoppe' } }))).toEqual([buildingRoofMaterial({ id: 'echoppe' })]);
    expect('label' in body(patchArchitectureBody(patchArchitectureBody(scene, 'corps', { label: 'Logis' }), 'corps', { label: undefined }), 'corps')).toBe(false);
  });

  it('l’emprise d’un volume et d’une exclusion est plafonnée à la carte, comme à la création', () => {
    const { scene, id, storeyId } = corps();
    const partId = body(scene, id).storeys[0].parts[0].id;
    const out = patchArchitecturePart(scene, id, storeyId, partId, { foot: { x: 9, y: -1, w: 3, h: 9 } });
    expect(body(out, id).storeys[0].parts[0].foot).toEqual({ x: 3, y: 0, w: 3, h: 6 });
    const ex = patchRoofExclusion(addRoofExclusion(scene, id, 0, { x: 0, y: 0, w: 2, h: 2 }), id, 0, { rect: { x: 7, y: 0, w: 2, h: 2 } });
    expect(body(ex, id).roofExclusions?.[0].rect).toEqual({ x: 4, y: 0, w: 2, h: 2 });
  });

  it('une masse de toiture garde un niveau entier ≥ 1 et une pente dans `PENTE_TOIT_DEG`', () => {
    const { scene: base, id } = corps();
    const { scene, id: massId } = addBuildingMass(base, id, { x: 1, y: 1, w: 2, h: 2 }, 0)!;
    const out = patchBuildingMass(scene, id, massId, { levels: 0, pitchDeg: 90, footprint: [{ x: 5, y: 5, w: 4, h: 1 }] });
    expect(body(out, id).masses.find((m) => m.id === massId)).toMatchObject({ levels: 1, pitchDeg: PENTE_TOIT_DEG.max, footprint: [{ x: 2, y: 5, w: 4, h: 1 }] });
  });

  it('une ouverture de façade se pose, se borne dans `BORNES_D_OUVERTURE` et se retire au noyau', () => {
    const { scene, id } = corps();
    const pan = addFacadeSection(scene, id, { x: 1, y: 1, side: 'N' })!;
    const pose = addFacadeFeature(pan.scene, id, pan.id)!;
    const ouverture = (s: Scene) => body(s, id).facades.find((f) => f.id === pan.id)!.features?.find((f) => f.id === pose.id);
    expect(ouverture(pose.scene)).toMatchObject({ kind: 'gable', edge: { x: 1, y: 1, side: 'N' } });
    const hors = patchFacadeFeature(pose.scene, id, pan.id, pose.id, { offset: 3, width: 0 });
    expect(ouverture(hors)).toMatchObject({ offset: BORNES_D_OUVERTURE.offset.max, width: BORNES_D_OUVERTURE.width.min });
    const vide = patchFacadeFeature(hors, id, pan.id, pose.id, { offset: undefined, appearance: undefined });
    expect('offset' in ouverture(vide)!, 'vide = défaut de rendu : le champ quitte l’ouverture').toBe(false);
    const retire = removeFacadeFeature(vide, id, pan.id, pose.id);
    expect('features' in body(retire, id).facades.find((f) => f.id === pan.id)!).toBe(false);
  });

  it('porter une façade à un étage y porte ses arêtes et celles de ses ouvertures', () => {
    const { scene, id } = corps();
    const pose = addFacadeSection(scene, id, { x: 1, y: 1, side: 'N' })!;
    const out = setFacadeSectionZ(pose.scene, id, pose.id, 1);
    const facade = body(out, id).facades.find((f) => f.id === pose.id)!;
    expect(facade.z).toBe(1);
    expect(facade.edges.every((e) => e.z === 1)).toBe(true);
    const retour = body(setFacadeSectionZ(out, id, pose.id, 0), id).facades.find((f) => f.id === pose.id)!;
    expect(retour.edges.every((e) => !('z' in e))).toBe(true);
  });
});
