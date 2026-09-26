import { describe, it, expect } from 'vitest';
import { crenellatedAt, DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, DEFAULT_TERRAIN, emptyScene, tileAt, type ArchitectureBody, type ArchitectureRect, type BuildingMass, type Scene, type Terrain } from './scene';
import { semencesDeScene } from '../data';
import { METRES_PER_LEVEL } from './relief';
import {
  addArchitectureBody,
  bodyFootCells,
  ROOF_GABLE_SPAN_MAX_M,
  deriveArchitectureMasses,
  fittedPitchDeg,
  gableSpanMaxTiles,
  localCrossSpans,
  maxCrossSpan,
  editEntity,
  TypeNonNomme,
  moveEntityTo,
  normaliseAssises,
  paintCrenellated,
  putLayer,
  resizeGrid,
  rectCoverOf,
  ridgeAxisOf,
  poseToitureDeCorps,
  seatOccupant,
  toitureEffective,
} from './sceneEdit';
import { PARTY_MAX } from './combatants';
import { validateScene } from './validateScene';
import { estAbsent, terrainAbsent } from './terrain';
import { perimeterWallSegs } from './sceneEdit.testkit';
import { stairFlightCells } from './planDefects';
import { parseProject } from './worldMap';
import diligenceProjet from '../scenes/diligence/diligence-projet.json';

/**
 * Toiture DÉRIVÉE du plan (#829, #930) — UN corps de bâtiment reçoit UN toit. La portée de charpente
 * est une contrainte de FORME, jamais de nombre : au-delà d'elle la nappe s'abat en CROUPE au lieu de
 * dresser deux grands pignons, et rien ne se découpe. La cible est la planche officielle
 * (`art-ref/page012_img3.png`) : un long faîtage unique courant sur toute la longueur, des ailes
 * perpendiculaires, des noues à leur rencontre — pas un peigne de faîtages parallèles.
 */

// Les murs de pourtour des fixtures viennent du kit partagé `sceneEdit.testkit` (`perimeterWallSegs`,
// canonicalisation N/E par `canonEdge`).

/** Scène d'un corps unique dont le plancher du rez est délimité par des MURS clos (la règle
 *  d'`interiorCells`/`realFloorAt` à `z=0`, #881), sans aucune masse authorée : tout est à dériver.
 *  AUCUNE zone déclarée — les murs seuls suffisent (le point du ticket #881). */
function corpsScene(size: number, pieces: ArchitectureRect[], body: Partial<ArchitectureBody> = {}): Scene {
  const scene = emptyScene(size, size);
  scene.walls = perimeterWallSegs(pieces);
  scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [], ...body }];
  return scene;
}

const cellsOf = (footprint: readonly ArchitectureRect[]): Set<string> => {
  const out = new Set<string>();
  for (const rect of footprint)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) out.add(`${x},${y}`);
  return out;
};

/** Portée d'une masse : la plus large de ses tranches perpendiculaires au faîtage, en cases. */
const spanOf = (mass: BuildingMass): number => maxCrossSpan(cellsOf(mass.footprint), mass.ridge!);
const massesOf = (scene: Scene): BuildingMass[] => deriveArchitectureMasses(scene)[0].masses;
/** Largeur de la tranche la plus ÉTROITE possible du corps : 1 ⇒ une bande d'une case de large. */
const minSpanOf = (mass: BuildingMass): number => {
  const cells = cellsOf(mass.footprint);
  return Math.min(maxCrossSpan(cells, 'x'), maxCrossSpan(cells, 'y'));
};

describe('deriveArchitectureMasses — un corps, UN toit (#930)', () => {
  // 14 × 18 cases à 2 m = un corps de 28 m sur 36 m : l'emprise mesurée sur l'étage de La Diligence.
  const profond = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);

  it('un corps PROFOND rend UNE seule masse — jamais un peigne de travées parallèles', () => {
    const masses = massesOf(profond);
    expect(masses).toHaveLength(1);
    expect(cellsOf(masses[0].footprint).size).toBe(14 * 18);
  });

  it('la masse PARTITIONNE le plancher : ses rectangles ne se recouvrent pas, aucune case perdue', () => {
    const vues = new Set<string>();
    for (const mass of massesOf(profond))
      for (const rect of mass.footprint) {
        for (const key of cellsOf([rect])) {
          expect(vues.has(key)).toBe(false);
          vues.add(key);
        }
      }
    expect(vues.size).toBe(14 * 18);
    for (let y = 2; y < 20; y++) for (let x = 2; x < 16; x++) expect(vues.has(`${x},${y}`)).toBe(true);
  });

  it('au-delà de la portée de pignon, la nappe s’abat en CROUPE — elle ne se découpe pas', () => {
    const [masse] = massesOf(profond);
    expect(spanOf(masse)).toBeGreaterThan(gableSpanMaxTiles(profond));
    expect(masse.profile).toBe('hip');
    expect(masse.ridge).toBe(ridgeAxisOf(cellsOf(masse.footprint)));
  });

  it('en deçà de la portée, deux pentes et un faîtage sur toute la longueur', () => {
    const etroit = corpsScene(24, [{ x: 2, y: 2, w: 3, h: 16 }]);
    const [masse] = massesOf(etroit);
    expect(spanOf(masse)).toBeLessThanOrEqual(gableSpanMaxTiles(etroit));
    expect(masse.profile).toBe('gable');
    expect(masse.ridge).toBe('y'); // le faîtage court sur les 16 cases, pas sur les 3
  });

  it('un corps en L reste UN corps : une masse, une emprise en plusieurs rectangles', () => {
    const enL = corpsScene(24, [{ x: 2, y: 2, w: 16, h: 3 }, { x: 2, y: 5, w: 3, h: 13 }]);
    const masses = massesOf(enL);
    expect(masses).toHaveLength(1);
    expect(masses[0].footprint.length).toBeGreaterThan(1);
    expect(cellsOf(masses[0].footprint)).toEqual(cellsOf([{ x: 2, y: 2, w: 16, h: 3 }, { x: 2, y: 5, w: 3, h: 13 }]));
  });

  it('une aile d’UNE case de large accolée au corps reste DANS sa masse — aucune bande à pignons dans le vide', () => {
    const galerie = corpsScene(24, [{ x: 2, y: 2, w: 8, h: 6 }, { x: 10, y: 4, w: 7, h: 1 }]);
    const masses = massesOf(galerie);
    expect(masses).toHaveLength(1);
    for (const mass of masses) expect(minSpanOf(mass)).toBeGreaterThan(1);
  });

  it('la portée maximale est MÉTRIQUE : une scène à grosses cases passe en croupe plus tôt', () => {
    const grosses = corpsScene(24, [{ x: 2, y: 2, w: 3, h: 16 }]);
    grosses.metresPerTile = 4;
    expect(gableSpanMaxTiles(grosses)).toBe(2); // 8 m ⇒ 2 cases de 4 m
    expect(massesOf(grosses)[0].profile).toBe('hip'); // 3 cases de portée = 12 m
    const enorme = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);
    enorme.metresPerTile = 20; // case plus large que la portée : une case de pignon, jamais zéro
    expect(gableSpanMaxTiles(enorme)).toBe(1);
  });

  it('DÉTERMINISTE : deux dérivations de la même scène rendent la MÊME emprise', () => {
    expect(massesOf(profond)).toEqual(massesOf(profond));
    const enU = cellsOf([{ x: 0, y: 0, w: 10, h: 2 }, { x: 0, y: 2, w: 2, h: 6 }, { x: 8, y: 2, w: 2, h: 6 }]);
    expect(rectCoverOf(enU)).toEqual(rectCoverOf(enU));
  });

  it('les masses AUTHORÉES traversent intactes, et leur emprise n’est jamais re-dérivée', () => {
    const authoree: BuildingMass = {
      id: 'grande-nef', z: 0, footprint: [{ x: 2, y: 2, w: 14, h: 9 }], levels: 1,
      profile: 'hip', ridge: 'x', pitchDeg: 22, material: 'chaume',
    };
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], { masses: [authoree] });
    const masses = massesOf(scene);
    expect(masses.filter((mass) => !mass.derived)).toEqual([authoree]); // intention de l'auteur, mot pour mot
    const derivees = masses.filter((mass) => mass.derived);
    expect(derivees.length).toBeGreaterThan(0);
    for (const mass of derivees) for (const key of cellsOf(mass.footprint)) {
      const [, y] = key.split(',').map(Number);
      expect(y).toBeGreaterThan(10); // le reste du plancher SEUL, jamais l'emprise déjà surchargée
    }
  });

  it('profil, pente et matériau restent l’intention de l’auteur — un pignon DEMANDÉ tient la grande portée', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], {
      roofDefaults: { profile: 'gable', pitchDeg: 32, material: 'chaume' },
    });
    const masses = massesOf(scene);
    expect(masses).toHaveLength(1);
    for (const mass of masses) {
      expect(spanOf(mass)).toBeGreaterThan(gableSpanMaxTiles(scene)); // la portée dirait « croupe »…
      expect(mass.profile).toBe('gable'); // … l'auteur dit « pignon », et il tranche
      expect(mass.pitchDeg).toBe(32);
      expect(mass.material).toBe('chaume');
    }
  });

  it('une croupe DEMANDÉE s’applique aussi sous la portée de pignon', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 3, h: 16 }], {
      roofDefaults: { profile: 'hip', pitchDeg: 40, material: 'toit-ardoise' },
    });
    const [masse] = massesOf(scene);
    expect(spanOf(masse)).toBeLessThanOrEqual(gableSpanMaxTiles(scene));
    expect(masse.profile).toBe('hip');
  });

  it('un appentis dérivé recopie le côté d’égout DÉCLARÉ par l’auteur', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], {
      roofDefaults: { profile: 'shed', pitchDeg: 20, material: 'toit-ardoise', eaveSide: 'S' },
    });
    for (const mass of massesOf(scene)) expect(mass.eaveSide).toBe('S');
  });

  /**
   * FORME COMPLÈTE d'une scène neuve (#1716) — l'attendu est un objet LITTÉRAL GELÉ, jamais la
   * semence relue (`semencesDeScene`) : comparer `emptyScene()` au dataset qu'il vient de lire ne
   * prouverait rien. Ce test est le témoin du passage des littéraux de code à la DONNÉE : la scène
   * créée est byte-identique à celle d'avant le lot, `id` horodaté mis à part.
   */
  it('une scène NEUVE reçoit EXACTEMENT les semences d’aujourd’hui — forme complète, pente raide, ardoise, un étage de comble', () => {
    const { id, ...scene } = emptyScene(8, 8);
    expect(id).toMatch(/^scene-\d+$/);
    expect(scene).toEqual({
      type: 'scene',
      label: 'Nouvelle scène',
      dimensions: { w: 8, h: 8 },
      ambiance: 'exterieur',
      metresPerTile: 2,
      ambientLight: 'auto',
      reliefDefaults: { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' },
      roofDefaults: { material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1 },
      layers: [{ z: 0, tiles: new Array(64).fill('herbe') }],
      entities: [],
      dialogues: [],
      triggers: [],
      encounters: [],
      flags: {},
    });
    expect(ROOF_GABLE_SPAN_MAX_M).toBe(8);
  });

  /** Les deux DÉRIVÉES publiques sont la semence elle-même : onze modules les importent (fixtures de
   *  scène, gardes de plan, panneaux) — elles doivent SUIVRE l'édition, pas figer une copie. */
  it('`DEFAULT_RELIEF_DEFAULTS`/`DEFAULT_ROOF_DEFAULTS`/`DEFAULT_TERRAIN` sont les semences du dataset (#1716)', () => {
    expect(DEFAULT_RELIEF_DEFAULTS).toEqual(semencesDeScene.reliefDefaults);
    expect(DEFAULT_ROOF_DEFAULTS).toEqual(semencesDeScene.roofDefaults);
    expect(DEFAULT_TERRAIN).toBe(semencesDeScene.terrain);
  });

  /** #1715 — la pente de RÉFÉRENCE est une donnée de la SCÈNE : la dérivation la lit, elle n'en
   *  porte plus aucune. Sur la portée que montre la planche, la pente dérivée EST celle de la scène ;
   *  changer la scène change la charpente de toutes ses masses dérivées. */
  it('la pente de référence de la SCÈNE commande les masses dérivées', () => {
    const emprise = [{ x: 2, y: 2, w: ROOF_GABLE_SPAN_MAX_M / 2, h: 16 }];
    const scene = corpsScene(24, emprise);
    expect(massesOf(scene)[0].pitchDeg).toBe(scene.roofDefaults.pitchDeg);

    const plate = corpsScene(24, emprise);
    plate.roofDefaults = { ...plate.roofDefaults, pitchDeg: 25 };
    expect(massesOf(plate)[0].pitchDeg).toBe(25);
    expect(massesOf(plate)[0].pitchDeg).toBeLessThan(massesOf(scene)[0].pitchDeg);
  });

  /** #1715 — TROIS étages pour la couverture : surcharge du corps, puis couverture du TYPE de
   *  bâtiment, puis toiture de la scène. Un corps sans type ne connaît que la scène. */
  it('la couverture se résout corps > type de bâtiment > scène', () => {
    const emprise = [{ x: 2, y: 2, w: 6, h: 12 }];

    const sansType = corpsScene(24, emprise, { style: undefined });
    expect(sansType.roofDefaults.material).toBe('toit-ardoise');
    expect(massesOf(sansType)[0].material).toBe(sansType.roofDefaults.material);

    // `maison` est couverte de tuile par son TYPE (`buildings.json › roofMaterial`) : le type passe
    // devant la scène, sans que le corps ait rien à déclarer.
    const parType = corpsScene(24, emprise, { style: 'maison' });
    expect(massesOf(parType)[0].material).toBe('tuile');
    expect(massesOf(parType)[0].material).not.toBe(parType.roofDefaults.material);

    // …et la SURCHARGE du corps passe devant les deux.
    const surcharge = corpsScene(24, emprise, { style: 'maison', roofDefaults: { material: 'chaume' } });
    expect(massesOf(surcharge)[0].material).toBe('chaume');

    // La scène redevient la source dès que ni le corps ni le type ne tranchent.
    const autreScene = corpsScene(24, emprise, { style: undefined });
    autreScene.roofDefaults = { ...autreScene.roofDefaults, material: 'chaume' };
    expect(massesOf(autreScene)[0].material).toBe('chaume');
    expect(toitureEffective(autreScene, autreScene.architecture![0]).material).toBe('chaume');
  });

  /** #1715 — le réducteur que le panneau de CORPS appelle : « suivre la scène » RETIRE le champ, et un
   *  corps qui ne surcharge plus rien perd `roofDefaults` entier (aucune poche vide ne survit). */
  it('poseToitureDeCorps écrit UN champ, et « suivre » le retire jusqu’à la poche', () => {
    const nu: ArchitectureBody = { id: 'corps-1', storeys: [], facades: [], masses: [] };

    const avecMatiere = poseToitureDeCorps(nu, 'material', 'chaume');
    expect(avecMatiere.roofDefaults).toEqual({ material: 'chaume' });
    expect(nu.roofDefaults, 'le réducteur a muté son entrée').toBeUndefined();

    const avecPente = poseToitureDeCorps(avecMatiere, 'pitchDeg', 32);
    expect(avecPente.roofDefaults).toEqual({ material: 'chaume', pitchDeg: 32 });

    // « suivre la scène » sur UN champ : les autres surcharges restent.
    expect(poseToitureDeCorps(avecPente, 'pitchDeg', undefined).roofDefaults).toEqual({ material: 'chaume' });
    // …et sur le DERNIER : la poche disparaît, le corps ne surcharge plus rien.
    expect(poseToitureDeCorps(avecMatiere, 'material', undefined).roofDefaults).toBeUndefined();
    expect('roofDefaults' in poseToitureDeCorps(avecMatiere, 'material', undefined)).toBe(false);
  });
});

/**
 * #947 — LA HAUTEUR DU COMBLE SE BORNE AU BÂTI, et c'est la PENTE qui s'adapte à la portée. La
 * couverture, elle, ne se redécoupe jamais (le peigne de travées de #930 ne revient pas) : un corps
 * profond porte UN toit, plus PLAT. Contrat POSITIF (le comble tient sous la borne, à toute portée)
 * et son RÉFUTANT (une pente POSÉE par l'auteur monte en pyramide si l'auteur le veut — elle ne
 * s'adapte jamais).
 */
describe('deriveArchitectureMasses — borne de comble (#947)', () => {
  /** Montée au faîte, en mètres : `portée / 2 × tan(pente)` — LA formule des nappes (`riseAt`). */
  const monteeM = (mass: BuildingMass, metresPerTile = 2): number =>
    ((spanOf(mass) * metresPerTile) / 2) * Math.tan((mass.pitchDeg * Math.PI) / 180);
  const borneM = emptyScene(4, 4).roofDefaults.riseMaxStoreys * METRES_PER_LEVEL;

  it('quelle que soit la portée, le comble tient sous la borne — et reste UNE seule masse', () => {
    for (const profondeur of [3, 5, 8, 12, 17, 24]) {
      const scene = corpsScene(32, [{ x: 2, y: 2, w: profondeur, h: 26 }]);
      const masses = massesOf(scene);
      expect(masses).toHaveLength(1); // jamais un redécoupage en travées
      expect(monteeM(masses[0])).toBeLessThanOrEqual(borneM + 1e-9);
    }
  });

  it('plus le corps est PROFOND, plus son toit est PLAT — jamais l’inverse', () => {
    const pentes = [8, 12, 17, 24].map((profondeur) =>
      massesOf(corpsScene(32, [{ x: 2, y: 2, w: profondeur, h: 26 }]))[0].pitchDeg);
    for (let i = 1; i < pentes.length; i++) expect(pentes[i]).toBeLessThan(pentes[i - 1]);
  });

  it('sur les portées que MONTRE la planche, la pente de référence reste intacte', () => {
    // 8 m de portée (l'aile la plus profonde de la planche) à 45° : 4 m de comble, soit exactement un
    // étage — la borne ne rabat rien de ce que la référence donne à voir.
    const scene = corpsScene(24, [{ x: 2, y: 2, w: ROOF_GABLE_SPAN_MAX_M / 2, h: 16 }]);
    const [masse] = massesOf(scene);
    expect(masse.pitchDeg).toBe(scene.roofDefaults.pitchDeg);
    expect(monteeM(masse)).toBeCloseTo(METRES_PER_LEVEL, 9);
  });

  it('une pente POSÉE par l’auteur ne s’adapte JAMAIS, même là où elle monte en pyramide', () => {
    const scene = corpsScene(32, [{ x: 2, y: 2, w: 20, h: 26 }], {
      roofDefaults: { profile: 'hip', pitchDeg: 45, material: 'toit-ardoise' },
    });
    const [masse] = massesOf(scene);
    expect(masse.pitchDeg).toBe(45);
    expect(monteeM(masse)).toBeGreaterThan(borneM); // l'auteur a demandé sa charpente : il l'a
  });

  it('la borne est une DONNÉE de corps : un comble de deux étages laisse remonter la charpente', () => {
    const emprise = [{ x: 2, y: 2, w: 20, h: 26 }];
    const defaut = massesOf(corpsScene(32, emprise))[0];
    const haut = massesOf(corpsScene(32, emprise, {
      roofDefaults: { profile: 'hip', riseMaxStoreys: 2 },
    }))[0];
    expect(haut.pitchDeg).toBeGreaterThan(defaut.pitchDeg);
    expect(monteeM(haut)).toBeGreaterThan(borneM);
    expect(monteeM(haut)).toBeLessThanOrEqual(2 * METRES_PER_LEVEL + 1e-9);
  });

  it('la borne est MÉTRIQUE : à grosses cases, la même portée en CASES rabat davantage', () => {
    const grosses = corpsScene(24, [{ x: 2, y: 2, w: 6, h: 16 }]);
    grosses.metresPerTile = 4;
    const [masse] = massesOf(grosses);
    expect(monteeM(masse, 4)).toBeLessThanOrEqual(borneM + 1e-9);
    expect(masse.pitchDeg).toBeLessThan(massesOf(corpsScene(24, [{ x: 2, y: 2, w: 6, h: 16 }]))[0].pitchDeg);
  });

  it('fittedPitchDeg : la pente de référence PLAFONNE, la borne rabat, l’arrondi ne la dépasse jamais', () => {
    expect(fittedPitchDeg(1, 2, 45, 1)).toBe(45); // une case de portée : rien à rabattre
    for (const spanTiles of [1, 2, 3, 4, 5, 7, 9, 13, 21, 40]) {
      const pente = fittedPitchDeg(spanTiles, 2, 45, 1);
      expect(pente).toBeLessThanOrEqual(45);
      expect((spanTiles * 2 / 2) * Math.tan((pente * Math.PI) / 180)).toBeLessThanOrEqual(METRES_PER_LEVEL + 1e-9);
    }
  });
});

/**
 * #881 — LES MURS DÉFINISSENT L'INTÉRIEUR, jamais la seule zone `presentation:'interior'`. Contrat
 * POSITIF (une boucle fermée de murs porte plancher+toiture SANS aucune zone) et son RÉFUTANT
 * (l'enclosure seule ne suffit pas : une cour ceinte de murs et déclarée `exterior` reste à ciel
 * ouvert) — mesuré sur `diligence-projet.json` : au rez, clos 1066 − exterior 472 = 594 cases contre
 * 593 déclarées `interior` (sans le filtre `exterior`, les deux cours, le passage couvert et le
 * potager, 472 cases, recevraient une toiture).
 */
describe('realFloorAt/deriveArchitectureMasses — les MURS définissent l’intérieur (#881)', () => {
  it('boucle fermée de murs, AUCUNE zone déclarée → plancher réel ET masse de toiture', () => {
    const scene = corpsScene(12, [{ x: 2, y: 2, w: 3, h: 3 }]);
    expect(scene.effectZones ?? []).toHaveLength(0); // aucune zone : les murs seuls suffisent
    const masses = massesOf(scene);
    expect(masses.length).toBeGreaterThan(0);
    const covered = cellsOf(masses.flatMap((mass) => mass.footprint));
    expect(covered).toEqual(cellsOf([{ x: 2, y: 2, w: 3, h: 3 }]));
  });

  it('cour ceinte de murs et déclarée EXTERIOR → AUCUNE toiture (l’enclosure seule ne suffit pas)', () => {
    const cour = { x: 2, y: 2, w: 3, h: 3 };
    const scene: Scene = {
      ...emptyScene(12, 12),
      walls: perimeterWallSegs([cour]),
      effectZones: [{ id: 'cour', label: 'Cour', area: { kind: 'rect', ...cour }, presentation: 'exterior' }],
      architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }],
    };
    const [corps] = deriveArchitectureMasses(scene);
    expect(corps.masses).toHaveLength(0); // close par les murs, mais à ciel ouvert : rien à couvrir
  });
});

describe('rectCoverOf / ridgeAxisOf — DÉCRIRE un corps, jamais le découper', () => {
  it('un rectangle sort ENTIER, d’une seule pièce', () => {
    expect(rectCoverOf(cellsOf([{ x: 3, y: 1, w: 12, h: 4 }]))).toEqual([{ x: 3, y: 1, w: 12, h: 4 }]);
  });

  it('un corps trop profond n’est PAS tranché : sa couverture reste le rectangle entier', () => {
    expect(rectCoverOf(cellsOf([{ x: 0, y: 0, w: 12, h: 10 }]))).toEqual([{ x: 0, y: 0, w: 12, h: 10 }]);
  });

  it('une case isolée reste un rectangle d’une case — la récurrence termine sur toute emprise', () => {
    expect(rectCoverOf(new Set(['5,7']))).toEqual([{ x: 5, y: 7, w: 1, h: 1 }]);
  });

  it('un anneau autour d’une cour se DÉCRIT en rectangles qui PARTITIONNENT l’emprise', () => {
    const anneau = cellsOf([
      { x: 0, y: 0, w: 10, h: 2 }, { x: 0, y: 8, w: 10, h: 2 },
      { x: 0, y: 2, w: 2, h: 6 }, { x: 8, y: 2, w: 2, h: 6 },
    ]);
    const rects = rectCoverOf(anneau);
    const couvert = new Set<string>();
    for (const rect of rects) for (const key of cellsOf([rect])) {
      expect(couvert.has(key)).toBe(false); // aucun recouvrement
      couvert.add(key);
    }
    expect(couvert).toEqual(anneau); // aucune case perdue, aucune case de la cour couverte
  });

  it('le faîtage court le long de la LONGUEUR, et la portée se lit tranche par tranche, jamais sur la boîte englobante', () => {
    const enT = cellsOf([{ x: 0, y: 0, w: 12, h: 2 }, { x: 0, y: 2, w: 2, h: 4 }]);
    expect(ridgeAxisOf(enT)).toBe('x'); // 6 cases de portée en y contre 12 en x
    const escalier = new Set(['0,0', '1,1', '2,2']); // boîte englobante 3×3, portée locale d'UNE case
    expect(maxCrossSpan(escalier, 'x')).toBe(1);
    expect(localCrossSpans(escalier, 'x').get(1)).toEqual({ lo: 1, hi: 2 });
  });
});

/**
 * TRÉMIE de volée (#822 bis, #1181) — l'ouverture par laquelle un escalier monte à l'étage est un TROU
 * dans le plancher du dessus, pas la ligne de toit d'un édifice : elle ne fonde aucune masse à la cote
 * de ses marches (des nappes d'ardoise plantées DANS le volume que les murs enferment, #822 bis), et
 * elle ne coûte AUCUN trou de couverture (#1181) — le toit passe CONTINU au-dessus d'elle, à la
 * hauteur de la nappe qui l'entoure. La colonne ouverte au sommet ADOPTE le groupe de ses voisines ;
 * le ciel ouvert, lui, se DÉCLARE (`roofExclusions`).
 */
describe('deriveArchitectureMasses — une colonne OUVERTE au sommet adopte la nappe qui l’entoure', () => {
  const TREMIE = { x: 2, y: 2 };
  const CLE = `${TREMIE.x},${TREMIE.y}`;
  const MAISON = { x: 1, y: 1, w: 4, h: 4 };

  /** Maison d'emprise `MAISON` dont la case `TREMIE` est OUVERTE au plancher de l'étage. `reliefM` cote
   *  cette case au rez : à `METRES_PER_LEVEL` c'est le palier haut d'une volée (le vide au-dessus est la
   *  trémie par laquelle on monte), à 0 c'est un trou de plancher qu'aucune marche n'explique.
   *  `etage: false` retire la couche du dessus — le vide au-dessus de la case est alors le CIEL. */
  function maison(reliefM: number, opts: { etage?: boolean; roofExclusions?: ArchitectureBody['roofExclusions'] } = {}): Scene {
    const size = 8;
    const idx = (x: number, y: number) => y * size + x;
    const dedans = (x: number, y: number) =>
      x >= MAISON.x && x < MAISON.x + MAISON.w && y >= MAISON.y && y < MAISON.y + MAISON.h;

    const rez: Terrain[] = new Array(size * size).fill('herbe');
    const cotes = new Array<number>(size * size).fill(0);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (dedans(x, y)) rez[idx(x, y)] = 'pierre';
    cotes[idx(TREMIE.x, TREMIE.y)] = reliefM;

    let scene = putLayer(emptyScene(size, size), 0, rez, cotes);
    if (opts.etage !== false) {
      const etage: Terrain[] = new Array(size * size).fill('vide');
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (dedans(x, y) && !(x === TREMIE.x && y === TREMIE.y)) etage[idx(x, y)] = 'pierre';
      scene = putLayer(scene, 1, etage);
    }
    scene.walls = perimeterWallSegs([MAISON]); // #881 : les murs closent la maison, AUCUNE zone déclarée
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [], masses: [],
      ...(opts.roofExclusions ? { roofExclusions: opts.roofExclusions } : {}),
    }];
    return scene;
  }

  it('le palier d’une volée est COUVERT par la MÊME masse que ses voisines — le toit passe au-dessus de la trémie', () => {
    const masses = massesOf(maison(METRES_PER_LEVEL));
    const porteuse = masses.find((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuse).toBeDefined();
    // …et c'est la nappe des voisines, pas une masse à elle : même id des quatre côtés.
    for (const voisine of [`${TREMIE.x - 1},${TREMIE.y}`, `${TREMIE.x + 1},${TREMIE.y}`, `${TREMIE.x},${TREMIE.y - 1}`, `${TREMIE.x},${TREMIE.y + 1}`])
      expect(masses.find((mass) => cellsOf(mass.footprint).has(voisine))?.id).toBe(porteuse!.id);
  });

  it('le bâti se coiffe d’un SEUL tenant, à la hauteur de son étage — aucune masse au rez dans le volume', () => {
    for (const mass of massesOf(maison(METRES_PER_LEVEL))) {
      expect(mass.z).toBe(1);
      expect(mass.levels).toBe(2);
    }
  });

  it('la trémie ne coûte AUCUN trou de couverture : tout le plancher de l’emprise est sous une masse', () => {
    const couvert = new Set<string>();
    for (const mass of massesOf(maison(METRES_PER_LEVEL)))
      for (const key of cellsOf(mass.footprint)) couvert.add(key);
    const attendu = new Set<string>();
    for (let y = MAISON.y; y < MAISON.y + MAISON.h; y++)
      for (let x = MAISON.x; x < MAISON.x + MAISON.w; x++) attendu.add(`${x},${y}`);
    expect([...couvert].sort()).toEqual([...attendu].sort());
  });

  it('un trou de plancher qu’AUCUNE marche n’explique est TOITÉ lui aussi — l’ENCLOSURE suffit, la volée n’est qu’un cas', () => {
    const masses = massesOf(maison(0));
    const porteuse = masses.find((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuse?.z).toBe(1); // la nappe de l'étage, jamais une masse au rez plantée dans le volume
    expect(masses.find((mass) => cellsOf(mass.footprint).has(`${TREMIE.x + 1},${TREMIE.y}`))?.id).toBe(porteuse!.id);
  });

  it('le CIEL OUVERT se DÉCLARE : `roofExclusions` tient la case hors de TOUTE masse, à n’importe quel z', () => {
    const rect = { x: TREMIE.x, y: TREMIE.y, w: 1, h: 1 };
    const voisine = `${TREMIE.x + 1},${TREMIE.y}`;
    // Déclarée au niveau de la NAPPE comme au niveau du PLANCHER : AUCUNE masse, d'AUCUN étage, ne
    // coiffe la case. Ne l'exclure que de la nappe laissait la colonne se rabattre d'un cran et poser
    // une masse au rez DANS le volume, sous le ciel que l'auteur venait d'ouvrir.
    for (const z of [0, 1]) {
      const masses = massesOf(maison(0, { roofExclusions: [{ z, rect }] }));
      expect(masses.some((mass) => cellsOf(mass.footprint).has(CLE)), `exclusion z=${z}`).toBe(false);
      expect(masses.find((mass) => cellsOf(mass.footprint).has(voisine))?.z, `exclusion z=${z}`).toBe(1);
    }
  });

  it('au DERNIER étage, le vide au-dessus d’une case cotée est le CIEL : sa masse lui revient', () => {
    const porteuses = massesOf(maison(METRES_PER_LEVEL, { etage: false }))
      .filter((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuses).toHaveLength(1);
    expect(porteuses[0].z).toBe(0);
  });
});

const S = 10;
const dans = (rect: ArchitectureRect, x: number, y: number) =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

/** Bâti à N couches : chaque couche pose `pierre` sur ses rectangles, moins ses `trous`. `cotes`
 *  cote le rez (palier haut d'une volée à `METRES_PER_LEVEL`). */
function bati(
  couches: { z: number; rects: ArchitectureRect[]; trous?: string[] }[],
  cotes: Record<string, number>,
  emprise: ArchitectureRect[],
): Scene {
  let scene = emptyScene(S, S);
  for (const couche of couches) {
    const tiles: Terrain[] = new Array(S * S).fill(couche.z === 0 ? 'herbe' : 'vide');
    const height = new Array<number>(S * S).fill(0);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (couche.rects.some((r) => dans(r, x, y)) && !(couche.trous ?? []).includes(`${x},${y}`))
          tiles[y * S + x] = 'pierre';
    if (couche.z === 0)
      for (const [key, m] of Object.entries(cotes)) {
        const [x, y] = key.split(',').map(Number);
        height[y * S + x] = m;
      }
    scene = putLayer(scene, couche.z, tiles, couche.z === 0 ? height : undefined);
  }
  scene.walls = perimeterWallSegs(emprise);
  scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }];
  return scene;
}
const porteuse = (scene: Scene, key: string) => massesOf(scene).find((mass) => cellsOf(mass.footprint).has(key));

/**
 * ADOPTION au DÉBOUCHÉ (#1181) — une volée n'ouvre QUE vers l'étage où elle monte. Élire le voisin le
 * plus HAUT donnait la trémie à la TOUR qui la borde : une masse de trois niveaux posée sur une case
 * qui n'en porte qu'un, nappe passée par-dessus le corps au lieu de le coiffer.
 */
describe('deriveArchitectureMasses — la colonne ouverte est adoptée au DÉBOUCHÉ, jamais par le voisin le plus haut', () => {
  it('une TOUR accolée ne vole pas la trémie : la volée qui débouche sur l’étage prend la nappe de l’ÉTAGE', () => {
    // Tour de 3 niveaux (x1..2) contre un corps de 2 (x3..6) ; volée en (3,2), contre la tour, qui
    // débouche sur le plancher z1 du corps.
    const scene = bati(
      [
        { z: 0, rects: [{ x: 1, y: 1, w: 6, h: 4 }] },
        { z: 1, rects: [{ x: 1, y: 1, w: 6, h: 4 }], trous: ['3,2'] },
        { z: 2, rects: [{ x: 1, y: 1, w: 2, h: 4 }] },
      ],
      { '3,2': METRES_PER_LEVEL },
      [{ x: 1, y: 1, w: 6, h: 4 }],
    );
    expect([...stairFlightCells(scene, 0, 1)]).toEqual(['3,2']);
    const tremie = porteuse(scene, '3,2');
    expect(tremie?.z).toBe(1);
    expect(tremie?.levels).toBe(2);
    expect(tremie?.id).toBe(porteuse(scene, '4,2')?.id); // la nappe du corps, celle du débouché
    expect(porteuse(scene, '2,2')?.z).toBe(2); // la tour garde SA hauteur, sans avoir rien adopté
  });

  it('un PUITS de deux étages reste adopté par la nappe qui l’enclôt — l’enclosure ne compte pas les crans', () => {
    const scene = bati(
      [
        { z: 0, rects: [{ x: 1, y: 1, w: 6, h: 6 }] },
        { z: 1, rects: [{ x: 1, y: 1, w: 6, h: 6 }], trous: ['3,3'] },
        { z: 2, rects: [{ x: 1, y: 1, w: 6, h: 6 }], trous: ['3,3'] },
      ],
      {},
      [{ x: 1, y: 1, w: 6, h: 6 }],
    );
    const puits = porteuse(scene, '3,3');
    expect(puits?.z).toBe(2);
    expect(puits?.levels).toBe(3);
    expect(puits?.id).toBe(porteuse(scene, '4,3')?.id);
  });

  it('une AILE BASSE accolée n’est PAS avalée : elle n’est ni enclose, ni débouchante', () => {
    const scene = bati(
      [
        { z: 0, rects: [{ x: 1, y: 1, w: 6, h: 4 }] },
        { z: 1, rects: [{ x: 1, y: 1, w: 3, h: 4 }] },
      ],
      {},
      [{ x: 1, y: 1, w: 6, h: 4 }],
    );
    expect(porteuse(scene, '5,2')?.z).toBe(0);
    expect(porteuse(scene, '5,2')?.levels).toBe(1);
    expect(porteuse(scene, '2,2')?.z).toBe(1);
  });
});

/**
 * VOLÉES SOUS PLANCHER (#1181) — une volée de relief ouvre une TRÉMIE dans le plancher de l'étage
 * qu'elle rejoint, et chacune faisait un TROU dans la nappe (diagnostic utilisateur : « il ne genere
 * pas de toit au dessus d'une case vide, mais en dessous c'est l'escalier »). Le toit doit passer
 * au-dessus, à la hauteur de la nappe qui l'entoure. Mesuré sur une scène CONSTRUITE (#1709) : DEUX
 * volées de quatre marches, chacune ouvrant quatre trémies dans un plancher d'étage plein.
 */
describe('deriveArchitectureMasses — les trémies d’une volée sont TOITÉES', () => {
  const CORPS = { x: 1, y: 1, w: 8, h: 8 };
  /** Deux volées de quatre marches, CONTRE les faces ouest et est du corps (comme celles d'un plan
   *  livré) : leur trémie touche le bord de la nappe, donc AUCUNE enclosure ne la rattrape — seule
   *  l'adoption au débouché la coiffe. La dernière marche affleure le plancher de l'étage
   *  (`METRES_PER_LEVEL`), les trois précédentes montent d'un mètre par case (lien `ramp`). */
  const VOLEES = [CORPS.x, CORPS.x + CORPS.w - 1].map((x) => [1, 2, 3, 4].map((m, i) => ({ key: `${x},${2 + i}`, m })));
  const CELLULES = VOLEES.flat().map((c) => c.key);
  const scene = bati(
    [
      { z: 0, rects: [CORPS] },
      { z: 1, rects: [CORPS], trous: CELLULES },
    ],
    Object.fromEntries(VOLEES.flat().map((c) => [c.key, c.m])),
    [CORPS],
  );
  const tremies = [...stairFlightCells(scene, 0, 1)].sort();
  const masses = deriveArchitectureMasses(scene).flatMap((body) => body.masses);
  const porte = (key: string) => masses.find((mass) => cellsOf(mass.footprint).has(key));

  it('la fixture EXERCE le cas : les cases de volée cotées SONT les trémies détectées', () => {
    expect(tremies).toEqual([...CELLULES].sort());
  });

  it('chaque trémie est couverte, à la hauteur de l’étage (z1, deux niveaux) — jamais à la cote de la marche', () => {
    for (const key of tremies) {
      expect(porte(key), key).toBeDefined();
      expect(porte(key)!.z, key).toBe(1);
      expect(porte(key)!.levels, key).toBe(2);
    }
  });

  it('la nappe est CONTINUE : la trémie porte la MÊME masse que le plancher d’étage voisin', () => {
    for (const key of tremies) {
      const [x, y] = key.split(',').map(Number);
      // Premier 4-voisin qui porte VRAIMENT le plancher d'étage : ni trémie, ni hors emprise.
      const voisin = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => ({ key: `${x + dx},${y + dy}`, x: x + dx, y: y + dy }))
        .find((c) => dans(CORPS, c.x, c.y) && !CELLULES.includes(c.key))!;
      expect(voisin, `${key} : aucun plancher d’étage voisin, la mesure n’a plus de sujet`).toBeDefined();
      expect(porte(key)!.id, `${key} vs ${voisin.key}`).toBe(porte(voisin.key)!.id);
    }
  });
});

/**
 * L'ATTRIBUTION du plancher résiduel ne doit rien devoir à l'ORDRE du tableau `architecture` (#1172).
 * La Diligence portait DEUX corps non bornés (`diligence` et un `architecture-0` vide) : la dérivation
 * donnait tout son plancher et toutes ses masses au PREMIER du tableau, et tout basculait sur l'autre
 * à l'ordre inversé. Le corps mort purgé, le résultat est le MÊME dans les deux sens — c'est cette
 * ÉGALITÉ des deux sens qui se mesure ici, jamais un compte figé du plan livré (#1709).
 */
describe('deriveArchitectureMasses — l’ORDRE du tableau `architecture` ne décide de rien', () => {
  const scene = parseProject(diligenceProjet).scenes[0];
  const bilan = (s: Scene) => deriveArchitectureMasses(s)
    .map((body) => `${body.id}:${body.masses.length}:${cellsOf(body.masses.flatMap((mass) => mass.footprint)).size}`)
    .sort();

  it('au plus UN corps NON BORNÉ : deux résiduels se disputeraient le plancher', () => {
    const nonBornes = (scene.architecture ?? []).filter((body) => bodyFootCells(body).size === 0);
    // Flanc à zéro assumé : un plan SANS résiduel passe ici, et c'est la non-vacuité de l'`it` suivant
    // (au moins une masse dérivée) qui refuse un plan devenu muet.
    expect(nonBornes.map((body) => body.id).length).toBeLessThanOrEqual(1);
  });

  it('le MÊME bilan à l’endroit comme à l’envers', () => {
    const endroit = bilan(scene);
    // NON-VACUITÉ : un plan qui ne dériverait aucune masse rendrait l'égalité muette.
    expect(endroit.some((ligne) => !ligne.endsWith(':0:0')), 'aucune masse dérivée : rien à comparer').toBe(true);
    expect(bilan({ ...scene, architecture: [...(scene.architecture ?? [])].reverse() })).toEqual(endroit);
  });
});

/**
 * Un corps CRÉÉ à l'éditeur naît BORNÉ (#1172) : sans emprise, chaque nouvelle maison posée serait un
 * second résiduel qui se disputerait le plancher avec le premier.
 */
describe('addArchitectureBody — le corps naît BORNÉ à l’emprise du geste', () => {
  it('l’étage z0 porte d’emblée un volume à l’emprise demandée', () => {
    const { scene, id } = addArchitectureBody(emptyScene(10, 10), 'maison', { x: 3, y: 4, w: 2, h: 2 });
    const body = scene.architecture!.find((candidate) => candidate.id === id)!;
    expect(body.storeys[0].parts).toEqual([{ id: 'part-0', foot: { x: 3, y: 4, w: 2, h: 2 } }]);
    expect([...bodyFootCells(body)].sort()).toEqual(['3,4', '3,5', '4,4', '4,5']);
  });

  it('l’emprise est bornée à la scène, et le corps n’est JAMAIS non borné', () => {
    const { scene, id } = addArchitectureBody(emptyScene(10, 10), 'maison', { x: 9, y: 9, w: 4, h: 4 });
    const body = scene.architecture!.find((candidate) => candidate.id === id)!;
    expect(body.storeys[0].parts[0].foot).toEqual({ x: 6, y: 6, w: 4, h: 4 });
    expect(bodyFootCells(body).size).toBeGreaterThan(0);
  });
});

/**
 * ASSISE — SEAM UNIQUE. Les mutations d'authoring rendent toujours un document DÉJÀ valide : occupation
 * normalisée, places devenues inoccupables levées, corps attablés sur l'abord RE-RÉSOLU de leur place
 * (`seatAssignmentDefects`, le même validateur que `validateScene` et `buildScene`).
 */
describe('normaliseAssises / seatOccupant — le seam unique d’assise', () => {
  const HORS_PARTIE = 0; // l'éditeur n'a pas de groupe : aucun emplacement n'est TENU

  /** Table ronde en (2,2) cap `N` → abords : nord (2,1), est (3,2), sud (2,3), ouest (1,2). */
  function attablee(seatAssignments?: Scene['seatAssignments']): Scene {
    const s = emptyScene(10, 10);
    s.layers = [{ z: 0, tiles: new Array(100).fill('plancher') }];
    s.entities = [
      { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } },
      { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 8, y: 8 } },
    ];
    if (seatAssignments) s.seatAssignments = seatAssignments;
    return s;
  }

  const NORD = { 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-1' } } } as Scene['seatAssignments'];
  const erreurs = (s: Scene) => validateScene([s]).filter((w) => w.level === 'error').map((w) => w.message);

  /** Mure toute la carte SAUF les cases citées — de quoi cerner un siège. */
  function murerSauf(s: Scene, libres: [number, number][]): Scene {
    const tiles = new Array(100).fill('mur');
    for (const [x, y] of libres) tiles[y * 10 + x] = 'plancher';
    return { ...s, layers: [{ z: 0, tiles }] };
  }

  it('assoit un PNJ et pose sa `pos` sur l’abord, en une écriture', () => {
    const res = seatOccupant(attablee(), 'table-1', 'place-1', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE);
    expect(res.ok).toBe(true);
    expect(res.scene.seatAssignments).toEqual(NORD);
    expect(res.scene.entities.find((e) => e.id === 'pnj-1')?.pos).toEqual({ x: 2, y: 1 });
    expect(erreurs(res.scene)).toEqual([]);
  });

  it('refuse par une RAISON stable, sans rien écrire', () => {
    const res = seatOccupant(attablee(), 'table-1', 'plafond', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE);
    expect(res).toMatchObject({ ok: false, reason: 'slot-absent' });
    expect(res.scene.seatAssignments).toBeUndefined();
  });

  it('un EMPLACEMENT que le groupe courant n’atteint pas n’est pas assis', () => {
    expect(seatOccupant(attablee(), 'table-1', 'place-1', { kind: 'party', rang: 2 }, 1)).toMatchObject({
      ok: false,
      reason: 'occupant-absent',
    });
  });

  it('un emplacement DANS le groupe s’assoit — le rang est ce qui est écrit, jamais un id', () => {
    const res = seatOccupant(attablee(), 'table-1', 'place-1', { kind: 'party', rang: 2 }, 2);
    expect(res.ok).toBe(true);
    expect(res.scene.seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'party', rang: 2 } } });
  });

  it('un rang HORS BORNE du groupe canonique est refusé quel que soit le groupe', () => {
    expect(seatOccupant(attablee(), 'table-1', 'place-1', { kind: 'party', rang: PARTY_MAX + 1 }, 99)).toMatchObject({
      ok: false,
      reason: 'occupant-absent',
    });
  });

  it('normaliseAssises retire la place dont le meuble n’offre plus le slot', () => {
    const s = attablee({ 'table-1': { plafond: { kind: 'entity', entityId: 'pnj-1' } } });
    expect(normaliseAssises(s, HORS_PARTIE).seatAssignments).toEqual({});
  });

  it('normaliseAssises garde l’emplacement que le groupe fourni atteint', () => {
    const s = attablee({ 'table-1': { 'place-1': { kind: 'party', rang: 1 } } });
    expect(normaliseAssises(s, 1).seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'party', rang: 1 } } });
    expect(normaliseAssises(s, 0).seatAssignments).toEqual({});
  });

  it('normaliseAssises ne fabrique aucun champ sur une scène sans assise', () => {
    expect(normaliseAssises(attablee(), HORS_PARTIE).seatAssignments).toBeUndefined();
  });

  // ── C2 (sonde B du juge, promue) ────────────────────────────────────────────────────────────────
  it('un meuble poussé dans un recoin muré LÈVE la place — jamais un corps posé dans un mur', () => {
    const assis = seatOccupant(attablee(), 'table-1', 'place-1', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE);
    const cerne = murerSauf(assis.scene, [[9, 9]]);
    const pousse = moveEntityTo(cerne, 'table-1', { x: 9, y: 9 });
    expect(pousse.seatAssignments).toEqual({});
    expect(erreurs(pousse)).toEqual([]);
  });

  // ── M2 (sonde D du juge, promue) ────────────────────────────────────────────────────────────────
  it('deux corps attablés ne se retrouvent JAMAIS sur la même case', () => {
    let s = attablee();
    s.entities.push({ id: 'pnj-2', kind: 'personnage', ref: 'humain', pos: { x: 7, y: 7 } });
    s = seatOccupant(s, 'table-1', 'place-1', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE).scene;
    s = seatOccupant(s, 'table-1', 'place-2', { kind: 'entity', entityId: 'pnj-2' }, HORS_PARTIE).scene;
    const deplacee = moveEntityTo(s, 'table-1', { x: 5, y: 5 });
    const cases = deplacee.entities.filter((e) => e.kind === 'personnage').map((e) => `${e.pos.x},${e.pos.y}`);
    expect(new Set(cases).size).toBe(cases.length);
    expect(erreurs(deplacee)).toEqual([]);
  });

  // ── I1 (sonde S5 du juge, promue) ───────────────────────────────────────────────────────────────
  it('TOURNER un meuble attablé recale le corps dans la même mutation', () => {
    const assis = seatOccupant(attablee(), 'table-1', 'place-1', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE).scene;
    const tournee = editEntity(assis, 'table-1', { facing: 'E' });
    expect(erreurs(tournee)).toEqual([]);
    expect(tournee.entities.find((e) => e.id === 'pnj-1')?.pos).not.toEqual({ x: 2, y: 1 });
  });

  it('MONTER un meuble attablé sur un étage VIDE lève la place plutôt que d’inventer un abord', () => {
    const s = attablee();
    s.layers = [...s.layers, { z: 1, tiles: new Array(100).fill('vide') }];
    const assis = seatOccupant(s, 'table-1', 'place-1', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE).scene;
    const monte = editEntity(assis, 'table-1', { z: 1 });
    expect(monte.seatAssignments).toEqual({});
    expect(erreurs(monte)).toEqual([]);
  });
});

/**
 * CARDINAL de la grille au RUNTIME (#1789) — le refine du schéma garde les DOCUMENTS, `putLayer`
 * garde les POSES : une couche plus courte que `w×h` rendrait des trous au même index aplati
 * `y·w+x`, et `tileAt` (`state/scene.ts`) n'a plus AUCUN repli de tuile pour les masquer.
 */
describe('putLayer — une couche posée porte EXACTEMENT `w×h` entrées', () => {
  const grille = () => emptyScene(4, 4);
  const pleines = (n: number, t: Terrain = 'sol'): Terrain[] => new Array(n).fill(t);

  it('une couche COURTE est refusée, en nommant l’étage, le tableau, la longueur et l’attendu', () => {
    expect(() => putLayer(grille(), 1, pleines(15))).toThrow(
      'putLayer : couche z=1, `tiles` porte 15 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    );
  });

  it('un `height` COURT est refusé de la même façon, et c’est `height` qui est nommé', () => {
    expect(() => putLayer(grille(), 0, pleines(16), new Array(15).fill(0))).toThrow(
      'putLayer : couche z=0, `height` porte 15 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    );
  });

  it('la couche EXACTE est posée, hauteurs comprises', () => {
    const pose = putLayer(grille(), 1, pleines(16, 'pierre'), new Array(16).fill(2));
    const couche = pose.layers.find((l) => l.z === 1);
    expect(couche?.tiles).toHaveLength(16);
    expect(couche?.height).toHaveLength(16);
    expect(tileAt(pose, 3, 3, 1)).toBe('pierre');
  });

  /**
   * REDIMENSIONNEMENT (#1789) — `resizeGrid` est la SEULE voie du redimensionnement de grille, et elle
   * POSE par `putLayer` : le cardinal runtime tient donc sur le produit. Le câblage se mesure sur ce
   * produit : autant d'entrées que de cases, pour CHAQUE couche, et la dernière case rendue par
   * `tileAt` — une couche courte ferait LEVER `putLayer` au lieu de rendre une grille trouée.
   */
  describe('resizeGrid — le redimensionnement POSE par `putLayer` (#1789)', () => {
    it('agrandit chaque couche au cardinal, garde la zone commune et sème le reste SELON LA COUCHE : sol de départ à la base, absence à l’étage', () => {
      const avant = putLayer(putLayer(grille(), 0, pleines(16, 'pierre')), 1, pleines(16, 'mur'), new Array(16).fill(4));
      const apres = resizeGrid(avant, 6, 5);
      expect(apres.dimensions).toEqual({ w: 6, h: 5 });
      expect(apres.layers.map((l) => l.z)).toEqual([0, 1]);
      for (const couche of apres.layers) {
        expect(couche.tiles, `couche z=${couche.z}`).toHaveLength(30);
        if (couche.height) expect(couche.height, `hauteurs z=${couche.z}`).toHaveLength(30);
      }
      expect(tileAt(apres, 3, 3, 0)).toBe('pierre'); // zone commune préservée
      expect(tileAt(apres, 5, 4, 0)).toBe(DEFAULT_TERRAIN); // DERNIÈRE case de la grille agrandie
      expect(tileAt(apres, 5, 4, 1)).toBe(terrainAbsent()); // un ÉTAGE naît absent, jamais bâti
    });

    /**
     * SEMENCE des cases neuves (#1789) — agrandir une grille ne BÂTIT rien : un étage naît ABSENT,
     * comme à `addLayer`/`buildScene`. Sans cela, la colonne neuve d'un étage porte un plancher
     * au-dessus du sol nu et `validateScene` lève autant d'« Étage sans appui » qu'il y a de cases.
     */
    it('les cases NEUVES d’un étage sont ABSENTES, celles de la base reçoivent la semence de sol', () => {
      const avant = putLayer(putLayer(grille(), 0, pleines(16, 'pierre')), 1, pleines(16, 'plancher'));
      const apres = resizeGrid(avant, 6, 5);
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 6; x++) {
          const neuve = x >= 4 || y >= 4;
          if (!neuve) continue;
          expect(estAbsent(tileAt(apres, x, y, 1)), `étage : case neuve (${x},${y})`).toBe(true);
          expect(tileAt(apres, x, y, 0), `base : case neuve (${x},${y})`).toBe(DEFAULT_TERRAIN);
        }
      expect(tileAt(apres, 3, 3, 1), 'la zone COMMUNE de l’étage est intacte').toBe('plancher');
    });

    /**
     * La sonde de la RECETTE (#1789) : agrandir une scène à étages n'ouvre AUCUN « Étage sans
     * appui ». Les deux FORMES d'étage la discriminent — la semence des cases neuves ne dépend pas
     * de la couverture de l'étage, mais de la COUCHE : un plancher posé sur une colonne neuve
     * FLOTTE, que l'étage couvre un coin du plan ou le plan entier (mesuré : semer le sol de départ
     * à l'étage ouvre 14 avertissements sur le plan entier 4×4 → 6×5, 9 sur le coin 4×4 → 5×5).
     */
    it('agrandir une scène à étage PARTIEL n’ouvre aucun avertissement d’étage sans appui', () => {
      const etage = new Array(16).fill(terrainAbsent()) as Terrain[];
      for (const i of [0, 1, 4, 5]) etage[i] = 'plancher';
      const avant = putLayer(putLayer(grille(), 0, pleines(16, 'herbe')), 1, etage);
      const neufs = (s: Scene) => validateScene([s]).filter((w) => w.message.includes('Étage sans appui')).length;
      expect(neufs(resizeGrid(avant, 5, 5)) - neufs(avant)).toBe(0);
    });

    it('agrandir une scène à étage PLEIN n’ouvre aucun avertissement d’étage sans appui', () => {
      const avant = putLayer(putLayer(grille(), 0, pleines(16, 'herbe')), 1, pleines(16, 'plancher'));
      const neufs = (s: Scene) => validateScene([s]).filter((w) => w.message.includes('Étage sans appui')).length;
      expect(neufs(resizeGrid(avant, 6, 5)) - neufs(avant)).toBe(0);
    });

    it('rétrécit au cardinal de la NOUVELLE grille, sans une entrée de trop', () => {
      const apres = resizeGrid(putLayer(grille(), 0, pleines(16, 'pierre')), 2, 2);
      expect(apres.layers[0].tiles).toHaveLength(4);
      expect(tileAt(apres, 1, 1, 0)).toBe('pierre');
    });

    /** La CRÉNELURE est le troisième tableau par case : elle suit le même remappage `y·w+x` que les
     *  hauteurs — un merlon de la zone commune survit, un merlon exclu part avec sa case. */
    it('un MERLON de la zone commune survit à l’agrandissement et part avec la case que le rétrécissement exclut', () => {
      const avant = paintCrenellated(putLayer(grille(), 0, pleines(16, 'pierre')), { x: 1, y: 1 }, 'creneau-x', 1);
      expect(crenellatedAt(avant, 1, 1, 0)).toBe('creneau-x');
      const agrandie = resizeGrid(avant, 6, 5);
      expect(agrandie.layers[0].crenellated, 'crénelure au cardinal de la grille agrandie').toHaveLength(30);
      expect(crenellatedAt(agrandie, 1, 1, 0), 'le merlon (1,1) a sauté l’agrandissement').toBe('creneau-x');
      const retrecie = resizeGrid(avant, 1, 1);
      expect(retrecie.layers[0].crenellated, 'un merlon hors grille survit au rétrécissement').toBeUndefined();
    });
  });
});

describe('editEntity — un patch ne retire jamais le dernier porteur du type (#877, #1882)', () => {
  const sb = { type: 'statblock' as const, label: 'Brigand', char: { B: 10 } };
  const avec = (...entities: Scene['entities']): Scene => ({ ...emptyScene(4, 4), entities });

  it('retirer la SEULE fiche d’un personnage est refusé, en nommant l’entité', () => {
    const s = avec({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' });
    expect(() => editEntity(s, 'pnj', { ref: undefined })).toThrow(TypeNonNomme);
    expect(() => editEntity(s, 'pnj', { ref: undefined })).toThrow(/personnage « pnj » : « ref », « statblock », « presetId » absents/);
  });

  it('retirer un porteur quand un autre DEMEURE passe', () => {
    const s = avec({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain', statblock: sb });
    const out = editEntity(s, 'pnj', { statblock: undefined });
    expect(out.entities[0]).toMatchObject({ ref: 'humain' });
    expect(out.entities[0].statblock).toBeUndefined();
  });

  it('remplacer la fiche dans le MÊME patch passe', () => {
    const s = avec({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, statblock: sb });
    expect(editEntity(s, 'pnj', { statblock: undefined, ref: 'gobelin' }).entities[0]).toMatchObject({ ref: 'gobelin' });
  });

  it('la même porte vaut pour le décor : retirer son type est refusé', () => {
    const s = avec({ id: 'tonneau-1', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    expect(() => editEntity(s, 'tonneau-1', { ref: undefined })).toThrow(/décor « tonneau-1 » : « ref » absente/);
  });

  it('un patch sans rapport avec la fiche passe', () => {
    const s = avec({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' });
    expect(editEntity(s, 'pnj', { label: 'Aubergiste' }).entities[0]).toMatchObject({ ref: 'humain', label: 'Aubergiste' });
  });
});

describe('editEntity — la TRANSITION est jugée, pas l’état (#1882)', () => {
  it('un patch sans rapport sur une entité DÉJÀ sans type passe ; `validateScene` la nomme', () => {
    const s: Scene = { ...emptyScene(4, 4), entities: [{ id: 'badaud', kind: 'personnage', pos: { x: 0, y: 0 } }] };
    const out = editEntity(s, 'badaud', { facing: 'E', label: 'Badaud' });
    expect(out.entities[0]).toMatchObject({ facing: 'E', label: 'Badaud' });
    expect(validateScene([out]).filter((w) => w.level === 'error').map((w) => w.refId)).toContain('badaud');
  });
});
