import { flowFromEffects, testFlow } from './monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { architectureSelectionForWarning, validateScene, type Warning } from './validateScene';
import { emptyNarratif } from './monde/campaignNarratif';
import { resolveStake, matieresDe, terrains } from '../data';
import { objetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { emptyScene, startOf, type Scene } from './monde/scene';
import * as zones from './monde/zones';
import { scenePlanDefects } from './planDefects';
import { unreachableDescriptiveZones } from './mapQC';
import { addEntity, deleteSel, paintTiles, setSceneFlags, setSceneLabel, setSceneScalaires, toggleEdgeWall } from './sceneEdit';
import { resetData, setDataset } from '../data/overrides';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { METRES_PER_LEVEL } from './monde/relief';
import type { WorldMap, MapPlace } from './worldMap';
import type { SeatAssignments } from './monde/seating';
import type { Effect } from '../data/schemas/defs-scenes/effets';

function base() {
  const s = emptyScene('scene-test', 5, 5);
  s.id = 'A';
  return s;
}
const msgs = (w: Warning[]) => w.map((x) => x.message);

describe('validateScene', () => {
  it('le verdict de l’éditeur suit les objets de campagne, y compris quand seul le narratif change', () => {
    const objet = objetDeCampagne({ id: 'hache-du-projet', shape: { id: 'hache' }, formChoices: ['hache'] });
    const narratif = { ...emptyNarratif(), objets: [objet] };
    const s = base();
    s.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 },
      appearance: { apparencesObjets: { [objet.id]: { id: 'hache_naine' } } } });
    const erreurs = (n: typeof narratif) => validateScene([s], undefined, n).filter((w) => w.level === 'error');
    expect(erreurs(narratif)).toEqual([]);
    const change = erreurs({ ...narratif, objets: [{ ...objet, shape: { id: 'epee' }, formChoices: ['epee'] }] });
    expect(change.some((w) => w.message.includes(objet.id) && w.message.includes('hache_naine'))).toBe(true);
  });
  it('avec un narratif, un objet donné ni au catalogue ni dans la campagne est refusé, à son lieu', () => {
    const narratif = { ...emptyNarratif(), objets: [objetDeCampagne()] };
    const s = base();
    s.entities.push({ id: 'coffre', kind: 'prop', decor: { id: 'coffre' }, pos: { x: 2, y: 2 },
      usable: { actions: [{ id: 'ouvrir', flow: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'giveTrapping', trappingId: 'objet-fantome' }] } } }] } });
    expect(validateScene([s], undefined, narratif).filter((w) => w.level === 'error').map((w) => `${w.scope}/${w.refId} :: ${w.message}`)).toEqual([
      'entity/coffre :: entité « coffre » › utilisable › actions « ouvrir » › effet Effets mécaniques › opérations 1 › objet : « objet-fantome » est absent du catalogue des objets de la campagne (collection « narratif.objets » du document).',
    ]);
  });
  it('scène propre = 0 avertissement', () => {
    expect(validateScene([base()])).toEqual([]);
  });

  /** L'espèce d'apparence est jugée au schéma (`especeDApparenceSchema`, `grammaire/valeurs.ts`). */
  it('apparence : espèce hors domaine → erreur nominative ; les deux catalogues du domaine passent', () => {
    const avec = (appearance: object) => {
      const s = base();
      s.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, appearance });
      return msgs(validateScene([s]).filter((x) => x.scope === 'entity' && x.refId === 'pnj' && x.level === 'error'));
    };
    for (const faute of ['zorglub', 'rat-geants'])
      expect(avec({ species: faute })).toEqual([`entité « pnj » › apparence › espèce : espèce « ${faute} » inconnue : ni espèce jouable, ni espèce du plan de bestiaire (planDeBestiaire.json).`]);
    for (const ok of [{ species: 'humains-reiklander' }, { species: 'amibe' }, { species: 'goule' }, { species: 'sangsue-geante' }])
      expect(avec(ok), JSON.stringify(ok)).toEqual([]);
  });

  /** Les Traits d'une entité — profil d'auteur et optionnels choisis (`LDB 76 l.45`) — passent la porte du
   *  schéma de scène : l'éditeur nomme un id de Trait fantôme et un Degré de Corruption donné en libellé. */
  it('Traits d’entité : un id fantôme et un `arg` hors registre sont refusés, nommés, au profil comme aux optionnels', () => {
    const erreurs = (entite: object) => {
      const s = base();
      s.entities.push({ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, ...entite } as Scene['entities'][number]);
      return msgs(validateScene([s]).filter((x) => x.scope === 'entity' && x.refId === 'pnj' && x.level === 'error')).join('\n');
    };
    const statblock = (traits: object[]) => ({ statblock: { type: 'statblock', label: 'Mutant', char: {}, traits } });
    expect(erreurs(statblock([{ id: 'trait-fantome' }]))).toMatch(/trait-fantome.*traits\.json/);
    expect(erreurs({ creature: { id: 'humain' }, combat: { optionals: [{ id: 'trait-fantome' }] } })).toMatch(/trait-fantome.*traits\.json/);
    expect(erreurs(statblock([{ id: 'corruption', arg: 'Mineure' }]))).toMatch(/« Mineure »/);
    expect(erreurs({ creature: { id: 'humain' }, combat: { optionals: [{ id: 'corruption', arg: 'Mineure' }] } })).toMatch(/« Mineure »/);
    expect(erreurs({ creature: { id: 'humain' }, ...statblock([{ id: 'corruption', arg: 'mineure' }]), combat: { optionals: [{ id: 'corruption', arg: 'majeure' }] } })).toBe('');
  });

  it("dialogueId d'entité inexistant → erreur", () => {
    const s = base();
    s.entities.push({ id: 'e-0', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, dialogueId: { id: 'manque' } });
    const w = validateScene([s]);
    expect(w.some((x) => x.scope === 'entity' && x.refId === 'e-0' && /« manque » est absent du catalogue des dialogues de la scène/.test(x.message))).toBe(true);
  });

  /**
   * CAP CARDINAL d'un décor VOLUMIQUE (#1680 ligne 3) : sa recette tourne là où son empreinte solide ne
   * tourne pas (#1509). L'émetteur du rendu lève sur une diagonale — c'est ici que
   * l'auteur l'apprend, AVANT le rendu. La règle est celle du CATALOGUE (`refEstVolumique`) : le même
   * cap sur un décor billboard reste licite.
   */
  it('décor VOLUMIQUE au cap diagonal → erreur nominative ; un décor hors catalogue n’en reçoit pas d’orientation', () => {
    const s = base();
    s.entities.push({ id: 'table', kind: 'prop', pos: { x: 1, y: 1 }, decor: { id: 'table-ronde-4-tabourets' }, facing: 'NE' });
    const w = validateScene([s]).filter((x) => x.scope === 'entity' && x.refId === 'table' && x.level === 'error');
    expect(msgs(w)).toEqual(['entité « table » › orientation : décor volumique « table-ronde-4-tabourets » au cap NE — un décor volumique ne prend qu\'un cap cardinal (N/E/S/O)']);

    const cardinal = base();
    cardinal.entities.push({ id: 'table', kind: 'prop', pos: { x: 1, y: 1 }, decor: { id: 'table-ronde-4-tabourets' }, facing: 'E' });
    expect(validateScene([cardinal])).toEqual([]);

    const billboard = base();
    billboard.entities.push({ id: 'brasero-1', kind: 'prop', pos: { x: 1, y: 1 }, decor: { id: 'decor-hors-catalogue' }, facing: 'NE' });
    expect(msgs(validateScene([billboard])).filter((m) => /orientation/.test(m))).toEqual([]);
  });

  it('entité sur un étage inexistant → avertissement', () => {
    const s = base(); // un seul niveau z=0
    s.entities.push({ id: 'e-z', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, z: 2 });
    expect(msgs(validateScene([s])).some((m) => /étage 2 inexistant/.test(m))).toBe(true);
  });

  it('effet transition vers scène inconnue → erreur', () => {
    const s = base();
    s.triggers.push({ id: 't-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'transition', scene: { id: 'nope' } }]) });
    expect(msgs(validateScene([s])).some((m) => /scène inexistante/.test(m))).toBe(true);
  });

  it('trigger hors carte → avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-1', rect: { x: 4, y: 4, w: 3, h: 3 }, flow: flowFromEffects([]) });
    expect(msgs(validateScene([s])).some((m) => /déborde/.test(m))).toBe(true);
  });

  it('ids dupliqués → erreur', () => {
    const s = base();
    s.entities.push({ id: 'dup', kind: 'prop', pos: { x: 0, y: 0 } }, { id: 'dup', kind: 'prop', pos: { x: 1, y: 1 } });
    expect(msgs(validateScene([s])).some((m) => /dupliqué/.test(m))).toBe(true);
  });

  it('ids de zones d’effet dupliqués → erreur', () => {
    const s = base();
    s.effectZones = [
      { id: 'zone', label: 'Une', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } },
      { id: 'zone', label: 'Deux', area: { kind: 'rect', x: 1, y: 0, w: 1, h: 1 } },
    ];
    expect(validateScene([s]).some((w) => w.scope === 'scene' && w.refId === 'zone' && /dupliqué/.test(w.message))).toBe(true);
  });

  it.each([
    ['masse hors carte', { footprint: [{ x: 4, y: 4, w: 3, h: 3 }] }],
    ['masse sans partie', { footprint: [] }],
  ])('architecture : refuse %s', (_label, patch) => {
    const s = base();
    s.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } }];
    s.architecture = [{
      id: 'corps', style: { id: 'maison' },
      storeys: [{ id: 'z0', z: 0, parts: [{ id: 'nef', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['salle'] }],
      facades: [],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: { id: 'tuile' } }],
    }];
    Object.assign(s.architecture[0].masses[0], patch);
    expect(validateScene([s]).some((w) => w.scope === 'architecture' && w.level === 'error')).toBe(true);
  });

  /** Une masse de toit ne se coiffe que d'un matériau que la DONNÉE déclare couvrant
   *  (`materials.json` domaine `roof`, champ `couverture`) : le pseudo-matériau de plan vu du dessus n'en est pas
   *  un, et un id inconnu non plus. Les couvertures admises sont LUES au catalogue, jamais récitées. */
  const massesToit = (materiau: string): Scene => {
    const s = base();
    s.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } }];
    s.architecture = [{
      id: 'corps', style: { id: 'maison' },
      storeys: [{ id: 'z0', z: 0, parts: [{ id: 'nef', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['salle'] }],
      facades: [],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: { id: materiau } }],
    }];
    return s;
  };
  const erreursDeToit = (materiau: string) =>
    validateScene([massesToit(materiau)]).filter((w) => w.scope === 'architecture' && w.refId === 'toit' && w.level === 'error');

  it('architecture : toute couverture DÉCLARÉE par la donnée est admise sur une masse', () => {
    const couvertures = matieresDe('roof').filter((m) => m.couverture).map((m) => m.id);
    expect(couvertures.length).toBeGreaterThan(0);
    for (const id of couvertures) expect(erreursDeToit(id), id).toEqual([]);
  });

  it('architecture : un matériau SANS `couverture` (plan vu du dessus) est REFUSÉ, nommément', () => {
    const plan = matieresDe('roof').find((m) => !m.couverture);
    expect(plan, 'le catalogue doit porter une entrée non couvrante pour que ce banc morde').toBeDefined();
    const erreurs = erreursDeToit(plan!.id);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0].message).toContain(plan!.id);
    expect(erreurs[0].message).toContain('couverture');
  });

  it('architecture : un id de matériau inconnu est refusé par la même porte', () => {
    const erreurs = erreursDeToit('materiau-fantome');
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0].message).toContain('materiau-fantome');
  });

  it('architecture : un ÉTAGE référençant une zone d’un autre étage (au-dessus OU en-dessous) → erreur', () => {
    const s = base();
    s.layers.push({ z: 1, tiles: new Array(25).fill('vide') });
    s.effectZones = [
      { id: 'rez-de-chaussee', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
      { id: 'combles', label: 'Combles', presentation: 'interior', z: 1, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
    ];
    s.architecture = [{
      id: 'corps', style: { id: 'maison' },
      storeys: [
        { id: 'rez', z: 0, parts: [{ id: 'partie-rez', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['combles'] },
        { id: 'etage', z: 1, parts: [{ id: 'partie-etage', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['rez-de-chaussee'] },
      ],
      facades: [],
      masses: [],
    }];
    const w = validateScene([s]);
    expect(w.some((x) => x.scope === 'architecture' && x.refId === 'rez' && x.level === 'error')).toBe(true);
    expect(w.some((x) => x.scope === 'architecture' && x.refId === 'etage' && x.level === 'error')).toBe(true);
  });

  it('architecture : un étage doit dominer celui du dessous d’une hauteur de mur (le relief, lui, reste libre)', () => {
    const s = base();
    s.layers.push({ z: 1, tiles: new Array(25).fill('sol') });
    s.architecture = [{
      id: 'corps', style: { id: 'maison' }, storeys: [], facades: [],
      masses: [{ id: 'toit', z: 1, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: { id: 'tuile' } }],
    }];
    // Couche d'étage NON cotée : plancher, murs et toiture de l'étage retombent tous au rez.
    expect(validateScene([s]).some((w) => w.scope === 'architecture' && w.refId === 'toit' && w.level === 'error' && /plancher/.test(w.message))).toBe(true);
    // Une scène validée est IMMUABLE (`memoByRefDeps`) : chaque cotation est une COPIE.
    const cotee = (hauteurs: Record<number, number>): Scene => ({
      ...s,
      layers: s.layers.map((layer) => (layer.z in hauteurs ? { ...layer, height: new Array(25).fill(hauteurs[layer.z]) } : layer)),
    });
    // CONTRE-ÉPREUVE : cotée au sommet des murs du rez, la même masse ne dit plus rien.
    expect(validateScene([cotee({ 1: METRES_PER_LEVEL })]).filter((w) => w.scope === 'architecture')).toEqual([]);
    // RELIEF LIBRE : bâtiment sur une BUTTE — les deux couches montent ensemble, l'empilement tient.
    expect(validateScene([cotee({ 0: 6, 1: 6 + METRES_PER_LEVEL })]).filter((w) => w.scope === 'architecture')).toEqual([]);
  });

  it('architecture : refuse ids dupliqués, arêtes invalides et valeurs de masse incohérentes', () => {
    const s = base();
    s.architecture = [{
      id: 'corps', style: { id: 'maison' },
      storeys: [
        { id: 'z', z: 0, parts: [{ id: 'p', foot: { x: 1, y: 1, w: 2, h: 2 } }, { id: 'p', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: [] },
        { id: 'z', z: 0, parts: [], roomZoneIds: [] },
      ],
      facades: [{ id: 'f', z: 0, edges: [{ x: 5, y: 0, side: 'S' as never, z: 1 }], appearance: 'mur', features: [{ id: 'g', kind: 'gable', edge: { x: 5, y: 0, side: 'S' as never } }] }],
      masses: [{ id: 'r', z: 0, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: -1, profile: 'bad' as never, ridge: 'z' as never, pitchDeg: 0, material: { id: 'inconnu' } }],
    }, {
      id: 'corps', style: { id: 'maison' }, storeys: [], facades: [], masses: [],
    }];
    const w = validateScene([s]).filter((x) => x.scope === 'architecture' && x.level === 'error');
    expect(w.length).toBeGreaterThanOrEqual(10);
  });

  it.each([
    ['offset négatif', { offset: -0.1 }, /offset/],
    ['offset supérieur à 1', { offset: 1.1 }, /offset/],
    ['offset non fini', { offset: Number.NaN }, /décalage/],
    ['largeur nulle', { width: 0 }, /largeur/],
    ['largeur négative', { width: -1 }, /largeur/],
    ['largeur non finie', { width: Number.POSITIVE_INFINITY }, /largeur/],
  ])('architecture : refuse une feature avec %s', (_label, patch, champ) => {
    const s = base();
    s.architecture = [{
      id: 'corps', style: { id: 'maison' }, storeys: [], masses: [],
      facades: [{
        id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'auberge-relais-imperiale',
        features: [{ id: 'feature', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, ...patch }],
      }],
    }];
    expect(validateScene([s]).some((warning) =>
      warning.scope === 'architecture' && warning.refId === 'feature' && champ.test(warning.message))).toBe(true);
  });

  it('architecture : expose une cible d’éditeur stable pour partie, feature et masse invalides', () => {
    const s = base();
    s.architecture = [{
      id: 'corps',
      style: { id: 'maison' },
      storeys: [{
        id: 'z0',
        z: 0,
        parts: [{ id: 'partie', foot: { x: 7, y: 7, w: 2, h: 2 } }],
        roomZoneIds: [],
      }],
      facades: [{
        id: 'facade',
        z: 0,
        edges: [{ x: 2, y: 2, side: 'N' }],
        appearance: 'auberge-relais-imperiale',
        features: [{ id: 'feature', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, width: 0 }],
      }],
      masses: [{
        id: 'toiture',
        z: 0,
        footprint: [{ x: 7, y: 7, w: 2, h: 2 }],
        levels: 1,
        profile: 'gable',
        ridge: 'x',
        pitchDeg: 42,
        material: { id: 'tuile' },
      }],
    }];

    const warnings = validateScene([s]);
    expect(warnings.find((warning) => warning.refId === 'partie')?.architectureRef).toEqual({
      type: 'architecturePart',
      bodyId: 'corps',
      storeyId: 'z0',
      id: 'partie',
    });
    expect(warnings.find((warning) => warning.refId === 'feature')?.architectureRef).toEqual({
      type: 'facadeSection',
      bodyId: 'corps',
      id: 'facade',
    });
    expect(warnings.find((warning) => warning.refId === 'toiture')?.architectureRef).toEqual({
      type: 'roofSection',
      bodyId: 'corps',
      id: 'toiture',
    });
  });

  it('architecture : rend navigables doublons de chaque famille et étage invalide', () => {
    const s = base();
    s.architecture = [{
      id: 'corps',
      style: { id: 'maison' },
      storeys: [
        {
          id: 'etage',
          z: 3,
          parts: [
            { id: 'partie', foot: { x: 0, y: 0, w: 1, h: 1 } },
            { id: 'partie', foot: { x: 1, y: 0, w: 1, h: 1 } },
          ],
          roomZoneIds: [],
        },
        { id: 'etage', z: 0, parts: [], roomZoneIds: [] },
      ],
      facades: [{
        id: 'facade',
        z: 0,
        edges: [{ x: 0, y: 0, side: 'N' }],
        appearance: 'mur',
        features: [
          { id: 'feature', kind: 'gable', edge: { x: 0, y: 0, side: 'N' } },
          { id: 'feature', kind: 'gable', edge: { x: 0, y: 0, side: 'N' } },
        ],
      }, {
        id: 'facade',
        z: 0,
        edges: [{ x: 1, y: 0, side: 'N' }],
        appearance: 'mur',
        features: [],
      }],
      masses: [{
        id: 'toiture',
        z: 0,
        footprint: [{ x: 0, y: 0, w: 1, h: 1 }],
        levels: 1,
        profile: 'gable',
        ridge: 'x',
        pitchDeg: 42,
        material: { id: 'tuile' },
      }, {
        id: 'toiture',
        z: 0,
        footprint: [{ x: 1, y: 0, w: 1, h: 1 }],
        levels: 1,
        profile: 'gable',
        ridge: 'x',
        pitchDeg: 42,
        material: { id: 'tuile' },
      }],
    }, {
      id: 'corps',
      style: { id: 'maison' },
      storeys: [],
      facades: [],
      masses: [],
    }];

    const warnings = validateScene([s]).filter((warning) => warning.scope === 'architecture');
    expect(warnings.every((warning) => warning.architectureRef !== undefined)).toBe(true);
    expect(warnings.find((warning) => warning.refId === 'corps')?.architectureRef).toEqual({
      type: 'architectureBody',
      id: 'corps',
    });
    expect(warnings.find((warning) => warning.refId === 'etage' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'architectureStorey',
      bodyId: 'corps',
      id: 'etage',
    });
    expect(warnings.find((warning) => warning.refId === 'etage' && warning.message.includes('inexistant'))?.architectureRef).toEqual({
      type: 'architectureStorey',
      bodyId: 'corps',
      id: 'etage',
    });
    expect(warnings.find((warning) => warning.refId === 'partie' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'architecturePart',
      bodyId: 'corps',
      storeyId: 'etage',
      id: 'partie',
    });
    expect(warnings.find((warning) => warning.refId === 'facade' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'facadeSection',
      bodyId: 'corps',
      id: 'facade',
    });
    expect(warnings.find((warning) => warning.refId === 'feature' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'facadeSection',
      bodyId: 'corps',
      id: 'facade',
    });
    expect(warnings.find((warning) => warning.refId === 'toiture' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'roofSection',
      bodyId: 'corps',
      id: 'toiture',
    });
  });

  it('effet imbriqué dans la branche RÉUSSITE d’un nœud Test est validé', () => {
    const s = base();
    s.triggers.push({
      id: 't-2',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: testFlow({ skill: { id: 'perception' }}, flowFromEffects([{ type: 'startDialogue', dialogue: { id: 'absent' } }]), EMPTY_FLOW),
    });
    expect(msgs(validateScene([s])).some((m) => m.includes('« absent » est absent du catalogue des dialogues de la scène'))).toBe(true);
  });

  it('une référence locale morte d’un effet : une faute, une seule erreur, celle du parse (#3606 M2d)', () => {
    const erreursSur = (id: string, effet: Effect) => {
      const s = base();
      s.triggers.push({ id: 't-mort', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([effet]) });
      return validateScene([s]).filter((w) => w.level === 'error' && w.message.includes(`« ${id} »`)).map((w) => w.message);
    };
    expect(erreursSur('dlg-fantome', { type: 'startDialogue', dialogue: { id: 'dlg-fantome' } })).toEqual([expect.stringContaining('« dlg-fantome » est absent du catalogue des dialogues de la scène')]);
    expect(erreursSur('fantome', { type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'fantome' } })).toEqual([expect.stringContaining('« fantome » est absent du catalogue des personnages de la scène')]);
  });

  it('la rencontre d’un `startCombat` ou d’un `startPursuit` : absente de la scène, une seule erreur, celle du parse ; présente, aucune (#3606 M4a)', () => {
    const scene = (effet: Effect) => {
      const s = base();
      s.encounters = [{ id: 'enc-presente', members: [] }];
      s.triggers.push({ id: 't-rencontre', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([effet]) });
      return s;
    };
    const combat = (id: string): Effect => ({ type: 'startCombat', encounter: { id } });
    const poursuite = (id: string): Effect => ({ type: 'startPursuit', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { id: 'humain' } }], encounter: { id } });
    const surRencontres = (s: Scene) => msgs(validateScene([s])).filter((m) => m.includes('catalogue des rencontres de la scène'));
    expect(surRencontres(scene(combat('enc-fantome')))).toEqual([expect.stringContaining('« enc-fantome » est absent du catalogue des rencontres de la scène')]);
    expect(surRencontres(scene(poursuite('enc-fantome')))).toEqual([expect.stringContaining('« enc-fantome » est absent du catalogue des rencontres de la scène')]);
    expect(msgs(validateScene([scene(combat('enc-fantome'))])).filter((m) => m.includes('« enc-fantome »'))).toHaveLength(1);
    expect(surRencontres(scene(combat('enc-presente')))).toEqual([]);
    expect(surRencontres(scene(poursuite('enc-presente')))).toEqual([]);
  });

  /**
   * ENJEU d'un Flow AUTHORÉ (#1117, arbitrage user 2026-08-12 / #1262) : « l'enjeu d'un Flow authoré
   * s'AUTHORE DANS LA SCÈNE — champ stake dans l'éditeur de Flow […] Le validateur de scène exige le
   * champ sur tout Flow qui LANCE un Test. » Ce que le jet met en jeu appartient au document : aucun
   * dataset app-owned ne peut le servir, et personne ne peut le deviner à sa place.
   */
  it('nœud Test SANS enjeu → erreur ; avec enjeu authoré → aucune', () => {
    const s = base();
    s.triggers.push({
      id: 't-muet',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: testFlow({ skill: { id: 'perception' }, label: 'Guetter la ruelle' }, EMPTY_FLOW, EMPTY_FLOW),
    });
    const muet = validateScene([s]);
    expect(muet.some((w) => w.level === 'error' && w.refId === 't-muet' && /sans enjeu/.test(w.message))).toBe(true);

    const dote = base();
    dote.triggers.push({
      id: 't-dote',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: testFlow(
        { skill: { id: 'perception' }, label: 'Guetter la ruelle', stake: { authored: 'Repérer le guet avant qu’il ne vous repère : sinon l’alarme est donnée.' } },
        EMPTY_FLOW, EMPTY_FLOW,
      ),
    });
    expect(validateScene([dote])).toEqual([]);
  });

  it('le jet d’un Flow d’INTERACTION d’entité est validé lui aussi (même porte)', () => {
    const s = base();
    s.entities.push({
      id: 'coffre', kind: 'prop', pos: { x: 1, y: 1 },
      usable: { actions: [{ id: 'crocheter', flow: testFlow({ skill: { id: 'crochetage' }, label: 'Crocheter' }, EMPTY_FLOW, EMPTY_FLOW) }] },
    });
    expect(validateScene([s]).some((w) => w.level === 'error' && w.refId === 'coffre›crocheter' && /sans enjeu/.test(w.message))).toBe(true);
  });

  /**
   * G1 — le validateur juge l'enjeu au MÊME critère que le runtime (`stakeSpeaks`) : un enjeu authoré
   * BLANC est un enjeu absent. Un document de campagne est PORTABLE (édité hors app, à la main ou par
   * un outil tiers) : tester la seule présence laisserait passer `'   '`, que `resolveStake` refuse
   * ensuite d'afficher — l'authoring déclarerait bon ce qui casse au jeu.
   */
  it('enjeu authoré BLANC = enjeu absent (même critère que `resolveStake`)', () => {
    const s = base();
    s.triggers.push({
      id: 't-blanc',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: testFlow({ skill: { id: 'perception' }, label: 'Guetter', stake: { authored: '   ' } }, EMPTY_FLOW, EMPTY_FLOW),
    });
    const w = validateScene([s]).filter((x) => x.level === 'error' && /sans enjeu/.test(x.message));
    expect(w).toHaveLength(1);
    expect(() => resolveStake({ authored: '   ' }), 'le runtime refuse déjà ce blanc — les deux portes disent la même chose').toThrow();
  });

  /**
   * G2 — un Flow PORTÉ par une feuille d'effet est validé comme tout autre. `petitePriere.reward`
   * (`scene.ts`) en porte un, et rien ne le déclare : le parcours les trouve PAR LA FORME
   * (`carriedFlows`) — sans quoi un jet muet y serait silencieux quand le même jet, posé sur un
   * trigger, est refusé.
   */
  it('un jet muet dans un Flow PORTÉ par un effet est refusé comme sur un trigger', () => {
    const muet = testFlow({ skill: { id: 'priere' }, label: 'Exaucée ?' }, EMPTY_FLOW, EMPTY_FLOW);
    const s = base();
    s.triggers.push({
      id: 't-priere',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: flowFromEffects([{ type: 'petitePriere', reward: muet }]),
    });
    const porte = validateScene([s]).filter((w) => w.level === 'error' && /sans enjeu/.test(w.message));

    const temoin = base();
    temoin.triggers.push({ id: 't-temoin', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: muet });
    const direct = validateScene([temoin]).filter((w) => w.level === 'error' && /sans enjeu/.test(w.message));

    expect(porte.map((w) => w.message), 'le Flow porté doit dire EXACTEMENT ce que dit le témoin').toEqual(direct.map((w) => w.message));
    expect(porte).toHaveLength(1);
  });

  it('l’échéance d’un `delayedEffect` reste validée par le MÊME parcours générique', () => {
    const s = base();
    s.triggers.push({
      id: 't-differe',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: flowFromEffects([{ type: 'delayedEffect', afterMinutes: 10, flow: testFlow({ skill: { id: 'perception' }, label: 'Plus tard' }, EMPTY_FLOW, EMPTY_FLOW) }]),
    });
    expect(validateScene([s]).some((w) => w.level === 'error' && /sans enjeu/.test(w.message))).toBe(true);
  });

  it('zoneBlast : aucun effet mécanique → erreur ; centre hors carte → avertissement', () => {
    const s = base(); // 5×5
    s.triggers.push({ id: 't-zb', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'zoneBlast', center: { x: 9, y: 9 }, radius: 2, ops: [] }]) });
    const m = msgs(validateScene([s]));
    expect(m.some((x) => /aucun effet mécanique/.test(x))).toBe(true);
    expect(m.some((x) => /centre.*hors de la carte/.test(x))).toBe(true);
  });

  it('zoneBlast bien formé = 0 avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-zb2', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'zoneBlast', center: { x: 2, y: 2 }, radius: 2, ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 15 } } }] }]) });
    expect(validateScene([s]).filter((w) => /zone/i.test(w.message))).toEqual([]);
  });

  it('musique de scène inconnue au registre → avertissement ; piste réelle / silence / auto = OK', () => {
    const s = base();
    expect(msgs(validateScene([{ ...s, music: { ambient: 'piste-fantome', combat: 'musique-combat' } }])).some((m) => /Musique .*piste-fantome/.test(m))).toBe(true);
    expect(validateScene([{ ...s, music: { ambient: null, combat: 'musique-combat' } }])).toEqual([]); // silence + piste réelle
    expect(validateScene([{ ...s, music: undefined }])).toEqual([]); // automatique
  });
});

describe('validateScene — POI de plan (#345 phase 5)', () => {
  // `services` : le lieu doit RÉSOUDRE (`placeServices`) la cible d'un POI de service (#360 — un POI
  // peut aussi cibler le port/marché AUTOMATIQUES du lieu, `port`/`marche`, sans service déclaré).
  const place = (poi: MapPlace['poi'], services?: MapPlace['services']): MapPlace => ({ id: 'lieu', label: 'Lieu', pos: { x: 0, y: 0 }, scene: { id: 'A' }, poi, services });
  const wm = (poi: MapPlace['poi'], services?: MapPlace['services']): WorldMap => ({ id: 'w', label: 'Carte', places: [place(poi, services)], routes: [] });

  it('POI bien formé ciblant une scène du projet → aucune erreur', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Entrée', pos: { x: 10, y: 10 }, sceneId: { id: 'A' } }]));
    expect(w.filter((x) => x.level === 'error')).toEqual([]);
  });

  it('POI bien formé ciblant un service DÉCLARÉ par le lieu → aucune erreur', () => {
    const w = validateScene([base()], wm(
      [{ id: 'poi-1', label: 'Auberge', pos: { x: 10, y: 10 }, serviceKind: { id: 'auberge' } }],
      [{ kind: { id: 'auberge' } }],
    ));
    expect(w.filter((x) => x.level === 'error')).toEqual([]);
  });

  it('POI ciblant le PORT automatique du lieu (`serviceKind` `port`, sans service déclaré) → aucune erreur', () => {
    const w = validateScene([base()], {
      id: 'w', label: 'Carte',
      places: [{
        id: 'lieu', label: 'Lieu', pos: { x: 0, y: 0 }, scene: { id: 'A' },
        port: { ref: undefined, taille: 1, richesse: 1, production: [] } as unknown as MapPlace['port'],
        poi: [{ id: 'poi-1', label: 'Le port', pos: { x: 10, y: 10 }, serviceKind: { id: 'port' } }],
      }],
      routes: [],
    });
    expect(w.filter((x) => x.level === 'error')).toEqual([]);
  });

  it('id de POI dupliqué (même lieu) → erreur du SCHÉMA de carte, le POI répété nommé par son libellé', () => {
    const w = validateScene([base()], wm([
      { id: 'poi-1', label: 'A', pos: { x: 1, y: 1 }, sceneId: { id: 'A' } },
      { id: 'poi-1', label: 'B', pos: { x: 2, y: 2 }, serviceKind: { id: 'auberge' } },
    ], [{ kind: { id: 'auberge' } }]));
    expect(w.filter((x) => x.level === 'error')).toEqual([
      expect.objectContaining({ scope: 'worldMap', refId: 'poi-1', message: 'points d’intérêt « B » : « poi-1 » dupliqué : « id » identifie l’élément dans sa liste, il y est unique.' }),
    ]);
  });

  it('id de POI dupliqué d’un lieu à l’AUTRE → erreur de carte, l’id et le lieu qui le porte déjà sont le sujet', () => {
    const w = validateScene([base()], {
      id: 'w', label: 'Carte', routes: [],
      places: [
        { ...place([{ id: 'poi-1', label: 'A', pos: { x: 1, y: 1 }, sceneId: { id: 'A' } }]), id: 'lieu-1', label: 'Lieu 1' },
        { ...place([{ id: 'poi-1', label: 'B', pos: { x: 2, y: 2 }, sceneId: { id: 'A' } }]), id: 'lieu-2', label: 'Lieu 2' },
      ],
    });
    expect(w.filter((x) => x.level === 'error')).toEqual([
      expect.objectContaining({ scope: 'worldMap', refId: 'poi-1', message: 'points d’intérêt « B » : POI « poi-1 » déjà posé au lieu « lieu-1 » : un id de POI est unique sur la carte.' }),
    ]);
  });

  it('ni scène ni service (cible absente) → erreur EXCLUSIVE', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Rien', pos: { x: 1, y: 1 } }]));
    expect(msgs(w).some((m) => /cible EXCLUSIVE/.test(m))).toBe(true);
  });

  it('scène ET service à la fois → erreur EXCLUSIVE', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Les deux', pos: { x: 1, y: 1 }, sceneId: { id: 'A' }, serviceKind: { id: 'auberge' } }]));
    expect(msgs(w).some((m) => /cible EXCLUSIVE/.test(m))).toBe(true);
  });

  it('sceneId inexistant → erreur', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Fantôme', pos: { x: 1, y: 1 }, sceneId: { id: 'nope' } }]));
    expect(msgs(w).some((m) => /scène inexistante/.test(m))).toBe(true);
  });

  it('serviceKind inconnu du catalogue → erreur du SCHÉMA, le catalogue nommé', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Faux', pos: { x: 1, y: 1 }, serviceKind: { id: 'nawak' } }]));
    expect(msgs(w).some((m) => /« nawak » est absent du catalogue des services de lieu/.test(m))).toBe(true);
  });

  it('serviceKind du catalogue que le lieu n’offre pas → erreur', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Temple', pos: { x: 1, y: 1 }, serviceKind: { id: 'temple' } }]));
    expect(msgs(w.filter((x) => x.level === 'error'))).toEqual(['POI « Temple » → service absent du lieu « temple »']);
  });
});

/**
 * ASSISE AUTHORÉE — invariant de DOCUMENT : la `pos` d'un PNJ authoré assis EST exactement la case
 * d'abord résolue de sa place (sa position LOGIQUE : c'est de là qu'il s'est assis et là qu'il se
 * relève). La case du MEUBLE (round de l'ancre) n'est pas une position de corps :
 * les 4 places de la table ronde y tiennent toutes, et elle est solide.
 */
describe('validateScene — assise authorée (`Scene.seatAssignments`)', () => {
  /** Table ronde en (2,2) cap `N` → abords : nord (2,1), est (3,2), sud (2,3), ouest (1,2). */
  const ABORD = { nord: { x: 2, y: 1 }, est: { x: 3, y: 2 }, sud: { x: 2, y: 3 }, ouest: { x: 1, y: 2 } };
  function attable(seatAssignments: SeatAssignments, pnjPos = ABORD.nord) {
    const s = base();
    s.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, decor: { id: 'table-ronde-4-tabourets' }, facing: 'N' });
    s.entities.push({ id: 'pnj-1', kind: 'personnage', creature: { id: 'humain' }, pos: pnjPos });
    s.seatAssignments = seatAssignments;
    return s;
  }

  it('assise saine (PNJ posé sur l’abord de sa place) = 0 avertissement', () => {
    expect(validateScene([attable({ 'table-1': { 'place-1': { kind: 'entite', entityId: 'pnj-1' } } })])).toEqual([]);
    expect(validateScene([attable({ 'table-1': { 'place-4': { kind: 'entite', entityId: 'pnj-1' } } }, ABORD.ouest)])).toEqual([]);
  });

  it('meuble, place et personnage inexistants portent chacun leur erreur NOMMÉE', () => {
    const absent = attable({ 'nulle-part': { 'place-1': { kind: 'entite', entityId: 'pnj-1' } } });
    expect(msgs(validateScene([absent])).some((m) => /« nulle-part\/place-1 ».*« pnj-1 ».*aucun décor/.test(m))).toBe(true);

    const place = attable({ 'table-1': { plafond: { kind: 'entite', entityId: 'pnj-1' } } });
    expect(msgs(validateScene([place])).some((m) => /« table-1\/plafond ».*n'offre pas de place « plafond »/.test(m))).toBe(true);

    const corps = attable({ 'table-1': { 'place-1': { kind: 'entite', entityId: 'fantome' } } });
    expect(msgs(validateScene([corps])).some((m) => /« table-1\/place-1 ».*aucun personnage « fantome »/.test(m))).toBe(true);
  });

  it('un PNJ assis POSÉ ailleurs que sur l’ABORD de sa place est une erreur qui dit les deux cases', () => {
    const w = validateScene([attable({ 'table-1': { 'place-1': { kind: 'entite', entityId: 'pnj-1' } } }, { x: 4, y: 0 })]);
    expect(w.some((x) => x.refId === 'pnj-1' && /est posé en \(4,0\) alors que l’abord de sa place est en \(2,1\)/.test(x.message))).toBe(true);
  });

  it('un PNJ posé sur la case du MEUBLE est REFUSÉ (l’ancienne règle inversée ne doit pas revenir)', () => {
    const w = validateScene([attable({ 'table-1': { 'place-1': { kind: 'entite', entityId: 'pnj-1' } } }, { x: 2, y: 2 })]);
    expect(w.some((x) => x.refId === 'pnj-1' && /est posé en \(2,2\) alors que l’abord de sa place est en \(2,1\)/.test(x.message))).toBe(true);
  });

  it('chaque place a SON abord : la même `pos` ne vaut pas pour deux places différentes', () => {
    // `pnj-1` posé sur l'abord NORD mais affecté à l'EST → refus nommant l'abord de l'est.
    const w = validateScene([attable({ 'table-1': { 'place-2': { kind: 'entite', entityId: 'pnj-1' } } }, ABORD.nord)]);
    expect(w.some((x) => x.refId === 'pnj-1' && /« table-1\/place-2 ».*\(2,1\).*l’abord de sa place est en \(3,2\)/.test(x.message))).toBe(true);
  });

  it('une place tenue par le GROUPE ne réclame aucune entité de scène', () => {
    expect(validateScene([attable({ 'table-1': { 'place-2': { kind: 'groupe', rang: 1 } } })])).toEqual([]);
  });
});

describe('validateScene — point d’entrée hors de la convention de pose (`borneALaCarte`)', () => {
  const entrees = (entryPoints: Scene['entryPoints']) =>
    validateScene([{ ...base(), entryPoints }]).filter((w) => w.message.startsWith('Point d\'entrée'));

  it('signale un point d’entrée hors carte ou hors d’une case entière, rattaché à son id', () => {
    const avis = entrees({ dehors: { x: 5, y: 0 }, negatif: { x: 1, y: -1 }, demi: { x: 1.5, y: 2 } });
    expect(avis.map((w) => [w.level, w.scope, w.refId])).toEqual([
      ['warn', 'scene', 'dehors'], ['warn', 'scene', 'negatif'], ['warn', 'scene', 'demi'],
    ]);
    expect(avis[0].message).toContain('(5,0)');
  });

  it('un point d’entrée posé sur une case de la carte, à tout étage, ne dit rien', () => {
    expect(entrees({ coin: { x: 4, y: 4 }, origine: { x: 0, y: 0 }, etage: { x: 2, y: 2, z: 1 } })).toEqual([]);
  });
});

describe('architectureSelectionForWarning', () => {
  it('sélectionne une cible architecturale de warning par ids stables', () => {
    expect(architectureSelectionForWarning({
      level: 'error',
      sceneId: 'scene',
      scope: 'architecture',
      refId: 'feature-0',
      message: 'Feature invalide',
      architectureRef: { type: 'facadeSection', bodyId: 'corps-0', id: 'facade-0' },
    })).toEqual({ type: 'facadeSection', bodyId: 'corps-0', id: 'facade-0' });
  });

  it('un avertissement hors architecture ne sélectionne rien', () => {
    expect(architectureSelectionForWarning({
      level: 'error', sceneId: 'scene', scope: 'entity', refId: 'e', message: 'x',
      architectureRef: { type: 'architectureBody', id: 'corps-0' },
    })).toBeNull();
  });
});

describe('validateScene — une écriture rend les avertissements d’une validation entière (#4043)', () => {
  afterEach(() => { resetData(); vi.restoreAllMocks(); });

  /** Les retouches de l'éditeur sur la première scène de La Diligence, par ses écrivains réels, et une écriture au
   *  catalogue des terrains par le seam (`setDataset`). */
  const RETOUCHES: readonly [string, (s: Scene) => Scene][] = [
    ['peindre une case', (s) => paintTiles(s, { x: 1, y: 1 }, 'dalle', 1)],
    ['poser un mur', (s) => toggleEdgeWall(s, 5, 5, 'E', 0, 'wall')],
    ['retirer le mur', (s) => toggleEdgeWall(s, 5, 5, 'E', 0, 'wall')],
    ['poser une entité', (s) => addEntity(s, { id: 'pnj-sonde', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 3, y: 3 } })],
    ['retirer l’entité', (s) => deleteSel(s, { type: 'entity', id: 'pnj-sonde' })],
    ['renommer la scène', (s) => setSceneLabel(s, `${s.label} (retouchée)`)],
    ['décrire', (s) => setSceneScalaires(s, { desc: 'Une description retouchée.' })],
    ['changer la météo', (s) => setSceneScalaires(s, { weather: 'brouillard' })],
    ['poser un drapeau', (s) => setSceneFlags(s, { sonde: true })],
    ['écrire au catalogue des terrains', (s) => {
      setDataset('terrains', terrains.map((t) => (t.id === 'plancher' ? { ...t, walkable: !t.walkable } : t)));
      return s;
    }],
  ];

  it('après chaque retouche, ceux du projet cloné (identités neuves), ordre compris', () => {
    const projet = paquetDuJeu(diligenceCampaign);
    let scenes = projet.scenes;
    for (const [nom, retouche] of RETOUCHES) {
      scenes = [retouche(scenes[0]), ...scenes.slice(1)];
      const clone = structuredClone({ scenes, worldMap: projet.worldMap, narratif: projet.narratif });
      expect(validateScene(scenes, projet.worldMap, projet.narratif), nom).toEqual(validateScene(clone.scenes, clone.worldMap, clone.narratif));
    }
  });

  /** Les cases de zone que lisent les défauts de plan et les pièces inatteignables pendant `f` (`sceneZoneTiles`,
   *  espionnée sur son namespace) : zéro si aucun des deux audits ne se refait. */
  function auditsRefaits(f: () => void): number {
    let n = 0;
    const ns = zones as unknown as Record<string, unknown>;
    const vrai = ns.sceneZoneTiles as (...a: unknown[]) => unknown;
    vi.spyOn(ns, 'sceneZoneTiles', 'get').mockReturnValue((...a: unknown[]) => (n++, vrai(...a)));
    f();
    vi.restoreAllMocks();
    return n;
  }
  const audits = (s: Scene) => { scenePlanDefects(s); const depart = startOf(s); if (depart) unreachableDescriptiveZones(s, depart); };

  it('un libellé ne refait ni les défauts de plan ni la connexité ; une case peinte ne refait que ceux de SA scène', () => {
    const { scenes } = paquetDuJeu(diligenceCampaign);
    scenes.forEach(audits);
    expect(auditsRefaits(() => audits(setSceneLabel(scenes[0], 'Renommée'))), 'nommer').toBe(0);
    const peinte = paintTiles(scenes[0], { x: 1, y: 1 }, 'dalle', 1);
    expect(auditsRefaits(() => audits(peinte)), 'la scène peinte se refait').toBeGreaterThan(0);
    expect(auditsRefaits(() => scenes.slice(1).forEach(audits)), 'les autres scènes').toBe(0);
  });
});
