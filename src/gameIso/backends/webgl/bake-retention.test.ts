import { afterEach, describe, expect, it } from 'vitest';
import { bakeWorldGeometry, roomZonesByElKey, worldBakeDeps, type BakedWorld } from './sceneMeshes';
import { memoByRefDeps } from '../../../state/sceneMemo';
import { emptyScene, sceneMetresPerTile, setDoorOpen, setDoorRevealed, setStructureDown, setTileCollapsed, type Scene } from '../../../state/scene';
import { scenario } from '../../../scenes/test-scenarios/zones-pieces';
import { findPropById, materials, matieresDe, props, terrains } from '../../../data';
import { setDataset, resetData } from '../../../data/overrides';
import type { MaterialEntry } from '../../../data/materials.types';
import type { TerrainDef } from '../../../data/terrains.types';
import { effectiveArchitecture } from '../../../state/sceneEdit';
import { roofMaterial } from '../../catalog/roofs';
import { allBuiltinCampaigns, paquetDuJeu } from '../../../scenes/campaign';
import { testScenarios } from '../../../scenes/test-scenarios';

/**
 * GARDE DE SOUS-DÉCLARATION (#1176, P3-3). La cuisson du monde est RETENUE sur un read-set déclaré
 * (`worldBakeDeps`) au lieu de la référence de scène : un hôte qui reforge la scène à chaque geste
 * (l'éditeur : une référence par `pointermove`) ne repaie plus 100 à 634 ms par tick.
 *
 * Le prix de cette rétention est un DANGER SILENCIEUX : un champ oublié dans la liste = un monde
 * PÉRIMÉ à l'écran, que rien ne signale. Cette garde le rend impossible à introduire — elle passe sur
 * CHAQUE champ de `Scene` (le type l'y force : `Record<keyof Scene, …>` ne compile pas si un champ
 * apparaît) et vérifie les deux sens :
 *  - champ DANS le read-set  ⇒ la cuisson retenue change d'identité (le monde se recuit) ;
 *  - champ HORS du read-set  ⇒ elle ne change pas, ET une cuisson FRAÎCHE de la scène mutée est
 *    IDENTIQUE (sommets, groupes de surface, plages de faces) — la preuve que l'omission n'est pas
 *    une sous-déclaration, mais un champ qui ne cuit rien.
 *
 * Fixture `zones-pieces` : petite (10×9) mais complète pour ce qui est en jeu — murs d'arête et
 * portes, un corps d'architecture avec sa masse de toit à deux pans, et quatre zones d'effet
 * INTÉRIEURES (le cas risqué : `buildRoofs` LIT `scene.effectZones`).
 */
const base = scenario.construire().scene;
const mpt = sceneMetresPerTile(base);

/**
 * Empreinte STRUCTURELLE d'une cuisson — tout ce que le rendu en tire, hors identités d'objet.
 * ANGLE MORT DÉCLARÉ : elle ne compare PAS le contenu des `spans[].el` (les éléments de provenance
 * retenus). Un champ d'`el` dérivé d'une donnée hors read-set y périmerait donc sans que cette
 * comparaison bronche — c'est exactement le cas `roomZoneIds` (dérivé de `scene.effectZones`, lu par
 * la loi de dégagement). Il n'est pas gardé ICI, il est rendu IMPOSSIBLE à la source : `elCuit` le
 * retire du monde cuit, et le test « aucune zone de pièce ne survit à la cuisson » plus bas le
 * vérifie. Toute nouvelle donnée d'`el` hors read-set demande le même traitement.
 */
function empreinte(b: BakedWorld) {
  const attr = (nom: string) => Array.from(b.geometry.getAttribute(nom).array as Float32Array);
  return {
    positions: attr('position'),
    uv: attr('uv'),
    groupes: b.geometry.userData.surfaceGroups.map((g) => `${g.key}|${g.kind ?? ''}|${g.variant ?? ''}|${g.color ?? ''}`),
    dessins: b.geometry.groups.map((g) => `${g.start},${g.count},${g.materialIndex}`),
    spans: b.spans.map((s) => `${s.cell.x},${s.cell.y},${s.cell.z}|${s.group}|${s.start}|${s.count}|${s.color}|${s.varFactor}`),
  };
}

const cloneLayers = (s: Scene): Scene['layers'] => s.layers.map((l) => ({ ...l, tiles: [...l.tiles] }));

/** Une mutation RÉELLE par champ (jamais un clone à valeur égale sur un scalaire : il ne prouverait
 *  rien). Le type impose l'exhaustivité — un champ neuf de `Scene` casse la compilation ici.
 *  `type` en est EXCLU, et lui seul : sa valeur est le littéral `'scene'` (#1552), donc aucune
 *  mutation ne peut le faire varier — l'entrée ne pourrait être qu'un clone à valeur égale. */
const MUTATIONS: Record<Exclude<keyof Scene, 'type'>, (s: Scene) => Scene> = {
  id: (s) => ({ ...s, id: `${s.id}-bis` }),
  label: (s) => ({ ...s, label: 'Autre nom' }),
  desc: (s) => ({ ...s, desc: 'Autre description' }),
  dimensions: (s) => ({ ...s, dimensions: { ...s.dimensions } }),
  metresPerTile: (s) => ({ ...s, metresPerTile: sceneMetresPerTile(s) + 1 }),
  ambiance: (s) => ({ ...s, ambiance: s.ambiance === 'interieur' ? 'exterieur' : 'interieur' }),
  environment: (s) => ({ ...s, environment: 'urbain' }),
  weather: (s) => ({ ...s, weather: 'tempete' }),
  ambientLight: (s) => ({ ...s, ambientLight: 'nuit' }),
  northDeg: (s) => ({ ...s, northDeg: (s.northDeg ?? 0) + 90 }),
  rest: (s) => ({ ...s, rest: { camp: true } }),
  restZones: (s) => ({ ...s, restZones: [{ rect: { x: 0, y: 0, w: 2, h: 2 }, places: { camp: true } }] }),
  effectZones: (s) => ({
    ...s,
    effectZones: [...(s.effectZones ?? []), { id: 'zone-neuve', label: 'Zone neuve', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 2, h: 2 } }],
  }),
  music: (s) => ({ ...s, music: { ambient: null } }),
  reliefDefaults: (s) => ({ ...s, reliefDefaults: { ...s.reliefDefaults, cliff: 'pierre' } }),
  roofDefaults: (s) => ({ ...s, roofDefaults: { ...s.roofDefaults, material: 'chaume' } }),
  layers: (s) => ({ ...s, layers: cloneLayers(s) }),
  walls: (s) => ({ ...s, walls: [...(s.walls ?? [])] }),
  entities: (s) => ({ ...s, entities: [...s.entities] }),
  seatAssignments: (s) => ({ ...s, seatAssignments: { 'table-1': { 'place-1': { kind: 'entity', entityId: 'attable' } } } }),
  architecture: (s) => ({ ...s, architecture: [...(s.architecture ?? [])] }),
  dialogues: (s) => ({ ...s, dialogues: [...s.dialogues] }),
  triggers: (s) => ({ ...s, triggers: [...s.triggers] }),
  encounters: (s) => ({ ...s, encounters: [...s.encounters] }),
  stations: (s) => ({ ...s, stations: [{ sceneId: 'ailleurs', pos: { x: 1, y: 1 } }] }),
  flags: (s) => ({ ...s, flags: { ...s.flags, neuf: true } }),
  entryPoints: (s) => ({ ...s, entryPoints: { ...(s.entryPoints ?? {}), porte: { x: 1, y: 1 } } }),
  startMessage: (s) => ({ ...s, startMessage: 'Autre message' }),
  couvre: (s) => ({ ...s, couvre: ['EDO-01#b1'] }),
};

/** Le read-set DÉCLARÉ, champ par champ — la liste que la garde confronte à la réalité. */
const DANS_LE_READ_SET = new Set<keyof Scene>(['dimensions', 'metresPerTile', 'layers', 'walls', 'architecture', 'reliefDefaults', 'roofDefaults']);

const memesDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/** Le document des matières, une entrée retouchée — les AUTRES gardent leur identité d'objet (c'est ce
 *  qui rend les contrats discriminants : une matière non référencée ne doit rien recuire). */
const editee = (id: string, patch: Partial<MaterialEntry>): MaterialEntry[] =>
  materials.map((e) => (e.id === id ? ({ ...e, ...patch } as MaterialEntry) : e));

describe('Cuisson du monde — rétention par CONTENU, read-set gardé champ par champ (#1176, P3-3)', () => {
  for (const champ of Object.keys(MUTATIONS) as (keyof typeof MUTATIONS)[]) {
    const attendu = DANS_LE_READ_SET.has(champ);
    it(`\`${champ}\` : ${attendu ? 'recuit le monde' : 'ne le recuit pas — et ne le PÉRIME pas'}`, () => {
      const muté = MUTATIONS[champ](base);
      // La rétention TELLE QUE L'ÉCRAN la monte : le patron canonique, sur les deps déclarées.
      const memo = memoByRefDeps<object, BakedWorld>();
      const clé = {};
      const avant = memo(clé, worldBakeDeps(base, mpt), () => bakeWorldGeometry(base, mpt, 'jeu'));
      const après = memo(clé, worldBakeDeps(muté, mpt), () => bakeWorldGeometry(muté, mpt, 'jeu'));
      expect(memesDeps(worldBakeDeps(base, mpt), worldBakeDeps(muté, mpt))).toBe(!attendu);
      expect(après !== avant).toBe(attendu);
      // Hors read-set : la cuisson FRAÎCHE de la scène mutée doit être identique — sans quoi la
      // rétention laisserait un monde périmé à l'écran, et personne ne le verrait.
      if (!attendu) expect(empreinte(bakeWorldGeometry(muté, mpt, 'jeu'))).toEqual(empreinte(avant));
    });
  }

  /** Contrôle : l'empreinte comparée ci-dessus DISTINGUE réellement deux mondes. Sans lui, un
   *  comparateur aveugle rendrait toutes les assertions « identiques » gratuites. */
  it('l’empreinte comparée MORD : une seule case de terrain changée la fait diverger', () => {
    const layers = cloneLayers(base);
    layers[0].tiles[0] = layers[0].tiles[0] === 'eau' ? 'herbe' : 'eau';
    expect(empreinte(bakeWorldGeometry({ ...base, layers }, mpt, 'jeu'))).not.toEqual(empreinte(bakeWorldGeometry(base, mpt, 'jeu')));
  });

  /** L'ÉCHELLE est le sixième terme du read-set : elle n'est pas un champ de `Scene`, mais elle cuit. */
  it('l’ÉCHELLE (`mpt`) recuit le monde, elle aussi', () => {
    expect(memesDeps(worldBakeDeps(base, mpt), worldBakeDeps(base, mpt * 2))).toBe(false);
    expect(empreinte(bakeWorldGeometry(base, mpt * 2, 'jeu'))).not.toEqual(empreinte(bakeWorldGeometry(base, mpt, 'jeu')));
  });
});

/**
 * `scene.flags` n'entre PAS entier au read-set : seuls les flags qu'une LECTURE de cuisson consulte
 * (état d'arête de `wallGeometry` — porte en jeu, battant, structure abattue — et tuiles effondrées de
 * `isWalkable`) recuisent. Fixture portant les trois arêtes : porte fermée, porte secrète, structure.
 */
describe('Cuisson du monde — l’état RUNTIME des arêtes recuit, un flag sans lecteur non', () => {
  const aretes = (): Scene => {
    const s = emptyScene(6, 6);
    s.walls = [
      { x: 1, y: 1, side: 'E', door: true, closed: true },
      { x: 3, y: 1, side: 'E', door: true, closed: true, secret: { difficulty: 'complexe', face: 'les-deux' } },
      { x: 1, y: 3, side: 'E', structure: 'mur-de-chateau' },
    ];
    return s;
  };
  const cas: [string, (s: Scene) => Scene, boolean][] = [
    ['flag SANS lecteur de cuisson', (s) => ({ ...s, flags: { ...s.flags, neuf: true } }), false],
    ['porte OUVERTE', (s) => setDoorOpen(s, 1, 1, 'E', 0, true), true],
    ['porte secrète RÉVÉLÉE', (s) => setDoorRevealed(s, 3, 1, 'E', 0, true), true],
    ['structure ABATTUE', (s) => setStructureDown(s, 1, 3, 'E', 0, true), true],
    ['tuile EFFONDRÉE', (s) => setTileCollapsed(s, 2, 2, 1), true],
  ];
  for (const [quoi, muter, recuit] of cas) {
    it(`${quoi} : ${recuit ? 'recuit le monde' : 'ne le recuit pas'}`, () => {
      const s = aretes();
      const m = muter(s);
      expect(m.flags, 'la mutation passe par `scene.flags`').not.toEqual(s.flags);
      expect(memesDeps(worldBakeDeps(s, mpt), worldBakeDeps(m, mpt))).toBe(!recuit);
      if (!recuit) expect(empreinte(bakeWorldGeometry(m, mpt, 'jeu'))).toEqual(empreinte(bakeWorldGeometry(s, mpt, 'jeu')));
    });
  }

  it('la cuisson FRAÎCHE diverge bien pour les trois arêtes (la dep n’est pas gratuite)', () => {
    const s = aretes();
    const avant = empreinte(bakeWorldGeometry(s, mpt, 'jeu'));
    for (const m of [setDoorOpen(s, 1, 1, 'E', 0, true), setDoorRevealed(s, 3, 1, 'E', 0, true), setStructureDown(s, 1, 3, 'E', 0, true)])
      expect(empreinte(bakeWorldGeometry(m, mpt, 'jeu'))).not.toEqual(avant);
  });
});

/**
 * LE TROU QUE LA RÉTENTION AURAIT OUVERT (#1176, P3-3) : `applyCutawayMask` interroge la loi de
 * dégagement sur l'élément CUIT (`keepEl(span.el)`), et cette loi lit `roomZoneIds` — pour les nappes
 * de toit ET pour les façades (`frontFacadeCutaway`). Ce champ descend de `scene.effectZones`, HORS
 * read-set : retenu, il aurait figé le cutaway par pièce sur l'état de la scène au moment de la
 * cuisson. Il ne survit donc plus au bake, et la vérité vive se résout par la clé de l'élément.
 */
describe('Zones de pièce — hors du monde CUIT, résolues sur la scène VIVE (#1176, P3-3)', () => {
  it('aucune zone de pièce ne survit à la cuisson (toits ET façades)', () => {
    const cuit = bakeWorldGeometry(base, mpt, 'jeu');
    const porteurs = cuit.spans.filter((s) => s.el.kind === 'roof' || s.el.kind === 'wall');
    expect(porteurs.length).toBeGreaterThan(0); // la fixture porte bien des toits et des murs
    expect(porteurs.filter((s) => 'roomZoneIds' in s.el)).toEqual([]);
  });

  it('…alors que les éléments VIVANTS du builder en portent (c’est bien une donnée réelle)', () => {
    const vives = roomZonesByElKey(base);
    expect([...new Set([...vives.values()].flat())]).toEqual(expect.arrayContaining(['cave', 'chambre']));
  });

  it('la table vive SUIT `effectZones` — l’hôte voit la zone neuve que la cuisson, elle, ignore', () => {
    const muté = MUTATIONS.effectZones(base);
    const avant = [...new Set([...roomZonesByElKey(base).values()].flat())];
    const après = [...new Set([...roomZonesByElKey(muté).values()].flat())];
    expect(après).toContain('zone-neuve');
    expect(avant).not.toContain('zone-neuve');
    // …et la cuisson, elle, n'a pas bougé d'un sommet (c'est tout l'intérêt de l'exclusion).
    expect(empreinte(bakeWorldGeometry(muté, mpt, 'jeu'))).toEqual(empreinte(bakeWorldGeometry(base, mpt, 'jeu')));
  });
});

/**
 * CHAÎNE DE RE-CUISSON DES MATIÈRES (#1686 lot 3a-1) — le read-set ne se lit pas QUE sur la scène : la
 * cuisson lit aussi le CATALOGUE (recettes de décor et matières). Une matière retouchée au Codex mute
 * le document EN PLACE, sans que la scène bouge d'un octet : sans dep sur l'objet de matière, le monde
 * retenu resterait peint à l'ancienne teinte, et rien ne le signalerait.
 *
 * `propRecipeDeps` porte le domaine `prop` ; les deux autres domaines cuits entrent par `matiereDeps`
 * — les toitures que la SCÈNE nomme, et le domaine `relief` ENTIER (les ids de relief sont écrits dans
 * `builders/floors.ts`, les recopier ici en ferait une seconde vérité).
 */
describe('Cuisson du monde — les MATIÈRES entrent dans le read-set (#1686)', () => {
  afterEach(() => resetData());

  const couvertureDeLaScene = base.architecture![0].masses[0].material;

  it('la fixture pose bien une masse de toit sur une couverture RÉELLE (sinon rien n’est mesuré)', () => {
    expect(matieresDe('roof').map((m) => m.id)).toContain(couvertureDeLaScene);
  });

  it('éditer la couverture que la SCÈNE nomme change les deps — le monde se recuit', () => {
    const avant = worldBakeDeps(base, mpt);
    setDataset('materials', editee(couvertureDeLaScene, { N: '#0e0e0e' }));
    expect(memesDeps(avant, worldBakeDeps(base, mpt))).toBe(false);
  });

  it('éditer une couverture qu’AUCUNE masse ne pose laisse les deps intactes', () => {
    const autre = matieresDe('roof').find((m) => m.id !== couvertureDeLaScene)!;
    const avant = worldBakeDeps(base, mpt);
    setDataset('materials', editee(autre.id, { N: '#0c0c0c' }));
    expect(memesDeps(avant, worldBakeDeps(base, mpt))).toBe(true);
  });

  it('éditer une matière de RELIEF change les deps (le domaine entier est lu par le sol)', () => {
    const relief = matieresDe('relief').find((m) => m.id === 'pierre')!;
    const avant = worldBakeDeps(base, mpt);
    setDataset('materials', editee(relief.id, { face: '#0d0d0d' }));
    expect(memesDeps(avant, worldBakeDeps(base, mpt))).toBe(false);
  });

  /** Le dataset des TERRAINS (#1690) est lu ENTIER par la cuisson : `swatch`, `detail`, `priority` et
   *  `solidHeightM` entrent tous dans les faces de sol. Prix DIT du choix, et mesuré par le second
   *  cas : éditer un terrain qu'aucune couche ne pose recuit quand même. */
  const editeeT = (id: string, patch: Partial<TerrainDef>): TerrainDef[] =>
    terrains.map((t) => (t.id === id ? { ...t, ...patch } : t));

  it('éditer un TERRAIN que la scène pose change les deps — le monde se recuit', () => {
    const pose = base.layers[0].tiles[0];
    expect(terrains.map((t) => t.id), 'la fixture doit poser un terrain RÉEL').toContain(pose);
    const avant = worldBakeDeps(base, mpt);
    setDataset('terrains', editeeT(pose, { swatch: '#0b0b0b' }) as never);
    expect(memesDeps(avant, worldBakeDeps(base, mpt))).toBe(false);
  });

  it('le dataset des terrains est lu ENTIER : un terrain qu’aucune couche ne pose recuit AUSSI (prix dit)', () => {
    const poses = new Set(base.layers.flatMap((l) => l.tiles));
    const absent = terrains.find((t) => !poses.has(t.id))!;
    expect(absent, 'la fixture pose tous les terrains — le prix ne serait pas mesurable').toBeDefined();
    const avant = worldBakeDeps(base, mpt);
    setDataset('terrains', editeeT(absent.id, { swatch: '#0a0a0a' }) as never);
    expect(memesDeps(avant, worldBakeDeps(base, mpt))).toBe(false);
  });
});

/** TOUTES les scènes LIVRÉES — un scénario du registre généré porte la sienne, une campagne les
 *  siennes (patron `state/wallIndex.test.ts › scenesLivrees`). La population est DÉRIVÉE : une scène
 *  neuve entre dans le contrat sans qu'aucune liste ne soit récitée ici. */
const scenesLivrees = (): { nom: string; scene: Scene }[] => {
  const out: { nom: string; scene: Scene }[] = [];
  for (const s of testScenarios) out.push({ nom: `scenario:${s.id}`, scene: s.construire().scene });
  for (const c of allBuiltinCampaigns) for (const sc of paquetDuJeu(c).scenes) out.push({ nom: `campagne:${c.id}/${sc.id}`, scene: sc });
  return out;
};
/** Plancher DÉRIVÉ du registre : un scan vide (registre non chargé, campagne sans scène) ne peut pas
 *  rester vert. */
const plancherScenes = (): number =>
  testScenarios.length + allBuiltinCampaigns.reduce((n, c) => n + c.paquet.scenes.length, 0);

/**
 * SUR-ENSEMBLE DU READ-SET DES TOITURES (#1686 lot 3a-1) — `buildRoofs` résout la couverture de CHAQUE
 * masse par `roofMaterial(mass.material)` (`builders/roofs.ts`), et les masses qu'il voit sont les
 * masses EFFECTIVES : celles que l'auteur a écrites ET celles que `deriveArchitectureMasses` calcule
 * depuis `roofDefaults`. Le read-set, lui, se déclare sur `scene.architecture` (l'intention). La
 * question que cette garde tranche est donc : l'intention couvre-t-elle, PAR IDENTITÉ D'OBJET, tout
 * ce que la dérivation fait lire ? Un manquant = une couverture retouchée au Codex qui laisse le
 * monde retenu peint à l'ancienne teinte, sans que rien ne le signale.
 *
 * Le contrat porte sur TOUTES les scènes livrées, parce que c'est l'authoring qui décide ce qu'une
 * masse dérivée hérite : une seule scène ne mesurerait que sa propre forme d'architecture.
 */
describe('Cuisson du monde — les matières de TOIT du read-set couvrent les masses EFFECTIVES (#1686)', () => {
  it('toute couverture résolue par `buildRoofs` est dans `worldBakeDeps`, sur toutes les scènes livrées', () => {
    const livrees = scenesLivrees();
    expect(livrees.length).toBeGreaterThanOrEqual(plancherScenes());
    const manquants: string[] = [];
    let masses = 0;
    for (const { nom, scene } of livrees) {
      const deps = new Set(worldBakeDeps(scene, sceneMetresPerTile(scene)));
      for (const body of effectiveArchitecture(scene))
        for (const mass of body.masses) {
          masses++;
          if (!deps.has(roofMaterial(mass.material))) manquants.push(`${nom} · masse ${mass.id} → ${mass.material}`);
        }
    }
    expect(manquants).toEqual([]);
    expect(masses).toBeGreaterThan(0); // sans masse de toit, la boucle ci-dessus ne prouverait rien
  });
});

/**
 * TAILLE du read-set — la part RECETTES est bornée par le CATALOGUE EMPLOYÉ, pas par le mobilier posé
 * (#1343 lot B). Les entrées du read-set sont comparées par IDENTITÉ, terme à terme, à chaque geste de
 * l'hôte : N instances d'une même def y poussaient N fois les MÊMES objets, donc une salle meublée
 * payait une liste proportionnelle à son mobilier pour une information que la PREMIÈRE entrée porte
 * déjà en entier. Ce que la rétention DÉTECTE ne change pas — c'est la seconde moitié du contrat
 * ci-dessous.
 *
 * Scène CONSTRUITE pour cette garde, jamais une carte livrée (fait utilisateur du 2026-09-07, en tête
 * de `bake-compte.test.ts`) : aucun chiffre ici ne descend d'une scène jouée.
 */
describe('Cuisson du monde — la part RECETTES du read-set se compte en DEFS, pas en instances (#1343)', () => {
  afterEach(() => resetData());

  /** Les deux premières recettes du catalogue, DÉRIVÉES : cette garde mesure une TAILLE de liste, pas
   *  une def en particulier. */
  const [DEF_A, DEF_B] = props.filter((p) => p.volume).map((p) => p.id);

  const salle = (defs: readonly string[], parDef: number): Scene => {
    const scene = emptyScene(40, 40);
    scene.entities = defs.flatMap((ref, d) => Array.from({ length: parDef }, (_, i) => ({
      id: `p-${d}-${i}`, kind: 'prop', ref, pos: { x: i % 40, y: (d + Math.floor(i / 40)) % 40 },
    }))) as Scene['entities'];
    return scene;
  };

  /** La part RECETTES, isolée SANS index dans le read-set : ce que la scène MEUBLÉE porte en plus de la
   *  même scène vidée de ses entités. La signature d'entités, elle, est une CHAÎNE — d'où le filtre sur
   *  les objets, qui sont les seules deps de catalogue. */
  const partRecettes = (scene: Scene): unknown[] => {
    const mptS = sceneMetresPerTile(scene);
    const nue = new Set(worldBakeDeps({ ...scene, entities: [] }, mptS));
    return worldBakeDeps(scene, mptS).filter((d) => typeof d === 'object' && d !== null && !nue.has(d));
  };

  /** Ce que le CATALOGUE porte pour ces defs : une entrée par recette, une par matière NOMMÉE — le
   *  compte est dérivé de la donnée, jamais récité. */
  const attendu = (ids: readonly string[]): number => {
    const clés = new Set<unknown>();
    for (const id of ids) {
      const v = findPropById(id)!.volume!;
      clés.add(id);
      for (const p of v.primitives) clés.add(`m:${p.material}`);
    }
    return clés.size;
  };

  it('300 instances d’une même def : la part recettes a la taille d’UNE def', () => {
    expect(partRecettes(salle([DEF_A], 300))).toHaveLength(attendu([DEF_A]));
    expect(partRecettes(salle([DEF_A], 300))).toHaveLength(partRecettes(salle([DEF_A], 1)).length);
  });

  it('…et elle porte bien la recette elle-même (sinon elle ne mesurerait rien)', () => {
    expect(partRecettes(salle([DEF_A], 300))).toContain(findPropById(DEF_A)!.volume);
  });

  it('retoucher cette recette invalide TOUJOURS la rétention', { timeout: 60_000 }, () => {
    const scene = salle([DEF_A], 300);
    const mptS = sceneMetresPerTile(scene);
    const memo = memoByRefDeps<object, BakedWorld>();
    const clé = {};
    const depsAvant = worldBakeDeps(scene, mptS);
    const avant = memo(clé, depsAvant, () => bakeWorldGeometry(scene, mptS, 'jeu'));
    setDataset('props', props.map((p) => (p.id === DEF_A ? { ...p, volume: { ...p.volume!, primitives: [...p.volume!.primitives] } } : p)));
    expect(memesDeps(depsAvant, worldBakeDeps(scene, mptS))).toBe(false);
    const après = memo(clé, worldBakeDeps(scene, mptS), () => bakeWorldGeometry(scene, mptS, 'jeu'));
    expect(après).not.toBe(avant);
    expect(partRecettes(scene)).toContain(findPropById(DEF_A)!.volume);
  });

  it('deux defs → DEUX parts, et une seule par def', () => {
    const part = partRecettes(salle([DEF_A, DEF_B], 300));
    expect(part).toContain(findPropById(DEF_A)!.volume);
    expect(part).toContain(findPropById(DEF_B)!.volume);
    expect(part).toHaveLength(attendu([DEF_A, DEF_B]));
    expect(attendu([DEF_A, DEF_B])).toBeGreaterThan(attendu([DEF_A]));
  });

  /** L'AUTRE moisson de catalogue, sous la MÊME règle (`depsUniques`) : un quartier de N corps couverts
   *  de la même tuile n'a qu'UNE couverture à surveiller. Sans ce contrat, le dédoublonnage du décor
   *  aurait été une correction de SITE là où le juge a nommé une règle de TAILLE du read-set. */
  const toits = (n: number): Scene => {
    const scene = emptyScene(40, 40);
    const couverture = matieresDe('roof')[0].id;
    scene.architecture = Array.from({ length: n }, (_, i) => ({
      id: `corps-${i}`, kind: 'batiment', footprint: [{ x: i % 20, y: Math.floor(i / 20) }],
      masses: [{ id: `m-${i}`, material: couverture, shape: 'appentis', heightM: 3 }],
    })) as unknown as Scene['architecture'];
    return scene;
  };

  it('N corps sous la MÊME couverture : la part matières ne compte qu’une fois cette couverture', () => {
    const une = worldBakeDeps(toits(1), sceneMetresPerTile(toits(1)));
    const cent = worldBakeDeps(toits(100), sceneMetresPerTile(toits(100)));
    expect(cent).toHaveLength(une.length);
    expect(cent).toContain(roofMaterial(matieresDe('roof')[0].id));
  });

  it('…et la couverture RETOUCHÉE recuit toujours ce quartier', () => {
    const scene = toits(100);
    const mptS = sceneMetresPerTile(scene);
    const couverture = matieresDe('roof')[0].id;
    const depsAvant = worldBakeDeps(scene, mptS);
    setDataset('materials', editee(couverture, { N: '#0f0f0f' }));
    expect(memesDeps(depsAvant, worldBakeDeps(scene, mptS))).toBe(false);
  });
});
