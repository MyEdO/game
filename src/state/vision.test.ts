import { describe, it, expect } from 'vitest';
import { computeVisible, computeLightField, ambientScalar, baseSightTiles, combatantLights, darkSightTiles, mapLights, rayonEnCases, type LightField } from './vision';
import { Scene, WallSeg, emptyScene, sceneMetresPerTile, wallBetween } from './scene';
import { couvertDArete, losClear } from './lineOfSight';
import { pathTo } from './path';
import { structures } from '../data';
import { couvertDepuisDifficulte, cranDeCouvertEnMoins } from '../engine/cover';
import { METRES_PER_LEVEL } from './relief';
import { computeStateVisible } from './visionState';
import { parseWalledAscii } from './asciiMap';
import { builtinCampaigns, paquetDuJeu } from '../scenes/campaign';

/** L'échelle des scènes de ce fichier — LUE, jamais redite : elles ne déclarent pas de
 *  `metresPerTile`, donc c'est le défaut du monde (`LDB 15 l.12`). */
const MPT = sceneMetresPerTile(emptyScene(1, 1));
/** L'échelle MER, LUE sur une scène LIVRÉE : l'abordage de la cogue (combat naval, MDG 13). */
const MPT_MER = sceneMetresPerTile(
  paquetDuJeu(builtinCampaigns.find((c) => c.id === 'loup-et-saumure')!).scenes.find((s) => s.id === 'ls-abordage-cogue')!,
);

/**
 * RAYON RÉEL (#1507) — la donnée porte des MÈTRES, `rayonEnCases` les divise par l'échelle de la
 * scène, et le résultat n'est PLUS ENTIER : un brasero de 8 m vaut 0,8 case en mer. Le champ de
 * lumière DOIT l'accepter — ses bornes d'itération s'arrondissent vers l'extérieur, la distance
 * décide en réels, et la case de la source (distance 0) est toujours éclairée. Sans cela, les bornes
 * fractionnaires n'écrivaient que des clés impossibles (« 5.2,5.2,0 ») : AUCUNE case éclairée, et la
 * lampe s'éteignait en silence.
 */
describe('computeLightField — un rayon RÉEL éclaire, une lampe ne s’éteint jamais en silence', () => {
  const NUIT = 0; // aucun plancher ambiant : seul le halo des sources compte
  const halo = (rayonM: number, mpt: number) => {
    const s = scene(9, 1);
    const src = [{ pos: { x: 4, y: 0 }, radiusTiles: rayonEnCases(rayonM, mpt) }];
    const f = computeLightField(s, NUIT, src);
    return { champ: f, cases: [...Array(9).keys()].filter((x) => f.at(x, 0) > 0) };
  };

  it('brasero (8 m) sur une scène MER : 0,8 case — SA case est éclairée, aucune autre', () => {
    const { champ, cases } = halo(8, MPT_MER);
    expect(rayonEnCases(8, MPT_MER)).toBeCloseTo(0.8);
    expect(cases).toEqual([4]);
    expect(champ.at(4, 0)).toBeCloseTo(1);
    expect(champ.sourceLit!.has('4,0,0'), 'la case de la source est ÉCLAIRÉE, pas seulement non nulle').toBe(true);
  });

  it('marque arcanique (2 m, tables.json) en mer : 0,2 case — sa case reste éclairée', () => {
    const { cases, champ } = halo(2, MPT_MER);
    expect(cases).toEqual([4]);
    expect(champ.sourceLit!.has('4,0,0')).toBe(true);
  });

  it('lanterne (20 m) : 2 cases en mer, 10 à terre — le halo SUIT l’échelle', () => {
    expect(halo(20, MPT_MER).cases).toEqual([3, 4, 5]);       // 2 cases de rayon, bord exclu (falloff nul)
    expect(halo(20, MPT).cases.length).toBe(9);               // 10 cases de rayon : toute la bande de 9
  });

  it('à 2 m/case, un rayon ENTIER rend exactement ce qu’il rendait (aucun décalage de bornes)', () => {
    expect(halo(10, MPT).cases).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]); // bougie 10 m = 5 cases
    expect(halo(4, MPT).cases).toEqual([3, 4, 5]);                    // 2 cases de rayon
  });
});

const DAY = 12 * 60; // 12:00 → jour
const NIGHT = 23 * 60; // 23:00 → nuit (NIGHT_WINDOW 22:00-05:00)

function scene(w: number, h: number, tiles?: Record<string, string>, walls?: WallSeg[]): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles)
    for (const [k, v] of Object.entries(tiles)) {
      const [x, y] = k.split(',').map(Number);
      grid[y * w + x] = v;
    }
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    layers: [{ z: 0, tiles: grid }],
    entities: [],
   
    dialogues: [],
    triggers: [],
    encounters: [],
    walls,
  } as unknown as Scene;
}

/** Champ de lumière constant (tout éclairé) pour isoler la géométrie de vision. */
const BRIGHT: LightField = { at: () => 1 };
/** Champ de lumière nul (ténèbres totales). */
const DARK: LightField = { at: () => 0 };

describe('computeVisible — rayon de vue (plein jour)', () => {
  it('voit dans le rayon, pas au-delà (Chebyshev)', () => {
    const v = computeVisible(scene(8, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 3, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,0')).toBe(true);
    expect(v.has('4,0,0')).toBe(false);
  });
  it('voit toujours sa propre case', () => {
    const v = computeVisible(scene(5, 1), [{ pos: { x: 2, y: 0 }, radiusTiles: 0, darkTiles: 0 }], DARK);
    expect(v.has('2,0,0')).toBe(true);
  });
});

describe('computeVisible — vision cross-étage par HAUTEUR (sommet de rampe → chemin de ronde)', () => {
  // z0 : (1,0) élevé à 1 niveau (sommet de rampe) ; z1 : (1,1) = chemin de ronde à la MÊME hauteur.
  const H = METRES_PER_LEVEL;
  const rampScene = (): Scene => {
    const h0 = new Array(9).fill(0); h0[0 * 3 + 1] = H; // (1,0) élevé
    const t1 = new Array(9).fill('vide'); t1[1 * 3 + 1] = 'pierre'; // (1,1) chemin z1
    const h1 = new Array(9).fill(0); h1[1 * 3 + 1] = H;
    return {
      id: 's', name: 's', dimensions: { w: 3, h: 3 }, ambiance: 'jour',
      layers: [{ z: 0, tiles: new Array(9).fill('herbe'), height: h0 }, { z: 1, tiles: t1, height: h1 }],
      entities: [], dialogues: [], triggers: [], encounters: [],
    } as unknown as Scene;
  };
  it('au SOMMET d’une rampe (z0 à hauteur d’un étage) on voit le chemin de ronde z1 d’à côté', () => {
    const v = computeVisible(rampScene(), [{ pos: { x: 1, y: 0 }, z: 0, radiusTiles: 4, darkTiles: 0 }], BRIGHT);
    expect(v.has('1,1,1')).toBe(true);
  });
  it('au SOL (z0 à 0 m) on ne voit PAS l’étage z1 au-dessus (pas de vision à travers un plancher)', () => {
    const v = computeVisible(rampScene(), [{ pos: { x: 1, y: 2 }, z: 0, radiusTiles: 4, darkTiles: 0 }], BRIGHT);
    expect(v.has('1,1,1')).toBe(false);
  });
});

describe('computeVisible — murs bloquent la vue', () => {
  it('ne voit pas au-delà d\'un mur d\'arête', () => {
    const s = scene(6, 1, {}, [{ x: 2, y: 0, side: 'E' }]); // arête entre (2,0) et (3,0)
    const v = computeVisible(s, [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('2,0,0')).toBe(true);
    expect(v.has('3,0,0')).toBe(false);
  });
  it('ne voit pas une case COLLÉE derrière un mur de tuile (couvert total ≠ visible)', () => {
    // mur de tuile en (2,0) ; la case (3,0) lui est ADJACENTE de l'autre côté → couvert total au combat,
    // mais pour la VISION elle doit rester invisible (on ne voit pas à travers le mur).
    const s = scene(6, 1, { '2,0': 'mur' });
    const v = computeVisible(s, [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('2,0,0')).toBe(true); // on voit le mur lui-même
    expect(v.has('3,0,0')).toBe(false); // la case derrière : invisible
    expect(v.has('4,0,0')).toBe(false);
  });
  it('ne voit pas une case EFFLEURÉE au coin d\'un mur de tuile (anti-fuite diagonale)', () => {
    // mur vertical de tuiles en x=2, lignes y=2..5 ; viewer en haut (0,0). La case (3,2) est derrière
    // le coin du mur : le rayon (0,0)→(3,2) EFFLEURE la tuile (2,2) sans qu'un supercover entier ne la voie.
    const s = scene(6, 6, { '2,2': 'mur', '2,3': 'mur', '2,4': 'mur', '2,5': 'mur' });
    const v = computeVisible(s, [{ pos: { x: 0, y: 0 }, radiusTiles: 8, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,2,0')).toBe(false); // derrière le coin du mur : invisible
  });
});

describe('computeVisible — obscurité & vision nocturne', () => {
  it('dans le noir sans vision nocturne → ne voit que sa case', () => {
    const v = computeVisible(scene(6, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], DARK);
    expect(v.has('0,0,0')).toBe(true);
    expect(v.has('1,0,0')).toBe(false);
  });
  it('vision nocturne (darkTiles) perce le noir jusqu\'à sa portée', () => {
    const v = computeVisible(scene(8, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 0, darkTiles: 4 }], DARK);
    expect(v.has('4,0,0')).toBe(true);
    expect(v.has('5,0,0')).toBe(false);
  });
});

describe('computeVisible — lumière requise hors vision nocturne', () => {
  it('voit une case éclairée par une source, pas les cases sombres voisines', () => {
    // ambiant noir ; une torche rayon 3 en (0,0)
    const light = computeLightField(scene(8, 1), 0, [{ pos: { x: 0, y: 0 }, radiusTiles: 3 }]);
    const v = computeVisible(scene(8, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 6, darkTiles: 0 }], light);
    expect(v.has('2,0,0')).toBe(true); // éclairée
    expect(v.has('5,0,0')).toBe(false); // hors halo → sombre → invisible
  });
});

describe('computeVisible — union de tous les viewers', () => {
  it('voit ce qu\'au moins un viewer voit', () => {
    const viewers = [
      { pos: { x: 0, y: 0 }, radiusTiles: 1, darkTiles: 0 },
      { pos: { x: 9, y: 0 }, radiusTiles: 1, darkTiles: 0 },
    ];
    const v = computeVisible(scene(10, 1), viewers, BRIGHT);
    expect(v.has('1,0,0')).toBe(true); // près du viewer A
    expect(v.has('8,0,0')).toBe(true); // près du viewer B
    expect(v.has('5,0,0')).toBe(false); // entre les deux, hors des deux rayons
  });
});

describe('ambientScalar — niveau de lumière de la scène (dataset)', () => {
  const out = (ambientLight?: string) => ({ ...scene(2, 2), ambiance: 'exterieur', ambientLight } as unknown as Scene);
  it('niveau explicite lit le dataset', () => {
    expect(ambientScalar(out('jour'), DAY)).toBeCloseTo(1);
    expect(ambientScalar(out('nuit'), DAY)).toBeCloseTo(0.18);
    expect(ambientScalar(out('tenebres'), DAY)).toBeCloseTo(0);
  });
  it('auto (ou absent) suit l\'horloge en extérieur', () => {
    expect(ambientScalar(out('auto'), DAY)).toBeCloseTo(1); // jour
    expect(ambientScalar(out(), NIGHT)).toBeCloseTo(0.18); // nuit
  });
  it('override (setLight runtime) prime sur tout', () => {
    expect(ambientScalar(out('jour'), DAY, 0.3)).toBeCloseTo(0.3);
  });
});

describe('baseSightTiles — rayon de vue de base du niveau (MAISON, dataset)', () => {
  const out = (ambientLight?: string) => ({ ...scene(2, 2), ambiance: 'exterieur', ambientLight } as unknown as Scene);
  it('jour porte loin, nuit court, ténèbres nul', () => {
    expect(baseSightTiles(out('jour'), DAY)).toBeGreaterThanOrEqual(20);
    expect(baseSightTiles(out('nuit'), DAY)).toBeLessThanOrEqual(6);
    expect(baseSightTiles(out('tenebres'), DAY)).toBe(0);
  });
});

describe('darkSightTiles — vision nocturne (capability data)', () => {
  const c = (traits: string[] = [], talents: string[] = []) =>
    ({ traits: traits.map((id) => ({ id })), talents: talents.map((talentId) => ({ talentId })) }) as any;
  it('Infravision → illimité (grande portée)', () => {
    expect(darkSightTiles(c(['infravision']))).toBeGreaterThanOrEqual(100);
  });
  it('trait Vision nocturne → 10 cases (20 m canon)', () => {
    expect(darkSightTiles(c(['vision-nocturne']))).toBe(10);
  });
  it('talent Vision nocturne → 10 cases (lit la donnée du trait homonyme)', () => {
    expect(darkSightTiles(c([], ['vision-nocturne']))).toBe(10);
  });
  it('sans capacité → 0', () => {
    expect(darkSightTiles(c())).toBe(0);
  });
});

describe('mapLights — sources de lumière POSÉES (dataset props)', () => {
  it('un brasero éclaire ses alentours et rend les cases vues dans le noir', () => {
    const s = { ...scene(9, 1), entities: [{ id: 'b', kind: 'prop', pos: { x: 5, y: 0 }, ref: 'brasero' }] } as unknown as Scene;
    const sources = mapLights(s);
    expect(sources.length).toBe(1); // brasero émetteur (props.json light)
    const light = computeLightField(s, 0, sources); // ténèbres + brasero
    expect(light.at(5, 0)).toBeGreaterThan(0.9); // foyer
    expect(light.at(1, 0)).toBe(0); // hors halo → noir
    const v = computeVisible(s, [{ pos: { x: 0, y: 0 }, radiusTiles: 9, darkTiles: 0 }], light);
    expect(v.has('5, 0, 0'.replace(/ /g, ''))).toBe(true); // foyer éclairé + en vue
    expect(v.has('1,0,0')).toBe(false); // près du viewer mais sombre → invisible
  });
  it('en ténèbres (rayon ambiant 0), on voit une source DISTANTE en vue (feu dans le noir)', () => {
    const s = { ...scene(13, 1), entities: [{ id: 'b', kind: 'prop', pos: { x: 8, y: 0 }, ref: 'brasero' }] } as unknown as Scene;
    const light = computeLightField(s, 0, mapLights(s)); // ténèbres + brasero
    const v = computeVisible(s, [{ pos: { x: 0, y: 0 }, radiusTiles: 0, darkTiles: 0 }], light);
    expect(v.has('8,0,0')).toBe(true); // foyer distant éclairé + en vue → visible MALGRÉ rayon 0
    expect(v.has('0,0,0')).toBe(true); // sa propre case
    expect(v.has('2,0,0')).toBe(false); // entre les deux : sombre → invisible
  });
});

describe('combatantLights — la source PORTÉE suit son porteur : son ÉTAGE et son identité', () => {
  /** Deux étages construits — le porteur monte au z=1, la cour reste au z=0. */
  const deuxEtages = (): Scene => ({
    ...scene(6, 1),
    layers: [{ z: 0, tiles: new Array(6).fill('herbe') }, { z: 1, tiles: new Array(6).fill('herbe') }],
  } as unknown as Scene);
  const porteur = (z?: number) => ({
    id: 'h1',
    pos: { x: 2, y: 0, z },
    items: [{ uid: 'i1', trappingId: 'lanterne', equipped: true }],
  });

  it('une lanterne portée à l’ÉTAGE inscrit son halo à cet étage, et laisse le sol noir', () => {
    const s = deuxEtages();
    const src = combatantLights(porteur(1), MPT);
    expect(src.length).toBe(1);
    expect(src[0].z).toBe(1);
    const f = computeLightField(s, 0, src); // ténèbres + la seule lanterne
    expect(f.at(2, 0, 1)).toBeCloseTo(1); // l'étage du porteur : le foyer
    expect(f.at(2, 0, 0)).toBe(0); // la cour en contrebas : rien
    expect(f.sourceLit!.has('2,0,1')).toBe(true);
    expect(f.sourceLit!.has('2,0,0')).toBe(false);
  });

  it('au SOL (aucun z), le halo reste au sol — l’étage du porteur, jamais un défaut', () => {
    const f = computeLightField(deuxEtages(), 0, combatantLights(porteur(), MPT));
    expect(f.at(2, 0, 0)).toBeCloseTo(1);
    expect(f.at(2, 0, 1)).toBe(0);
  });

  it('la source PORTÉE nomme son porteur, la source POSÉE nomme son entité (`srcId`)', () => {
    expect(combatantLights(porteur(0), MPT)[0].srcId).toBe('h1');
    const s = { ...scene(9, 1), entities: [{ id: 'b7', kind: 'prop', pos: { x: 5, y: 0 }, ref: 'brasero' }] } as unknown as Scene;
    expect(mapLights(s)[0].srcId).toBe('b7');
  });
});

describe('computeLightField — ambiance plancher + halo de source', () => {
  it('l\'ambiant est le plancher partout', () => {
    const f = computeLightField(scene(5, 1), 0.3, []);
    expect(f.at(4, 0)).toBeCloseTo(0.3);
  });
  it('une source éclaire en dégradé (1 au centre, décroît avec la distance)', () => {
    const f = computeLightField(scene(6, 1), 0, [{ pos: { x: 0, y: 0 }, radiusTiles: 4 }]);
    expect(f.at(0, 0)).toBeCloseTo(1);
    expect(f.at(2, 0)).toBeCloseTo(0.5); // 1 - 2/4
    expect(f.at(4, 0)).toBeCloseTo(0); // bord du halo
  });
  it('un mur occulte la lumière (la torche n\'éclaire pas derrière)', () => {
    const s = scene(6, 1, {}, [{ x: 1, y: 0, side: 'E' }]); // arête (1,0)|(2,0)
    const f = computeLightField(s, 0, [{ pos: { x: 0, y: 0 }, radiusTiles: 5 }]);
    expect(f.at(1, 0)).toBeGreaterThan(0); // avant le mur : éclairé
    expect(f.at(3, 0)).toBe(0); // derrière le mur : noir
  });
});

/**
 * CE QUE LE GROUPE VOIT SUR UN PLAN COMPLET — empreinte de la vue (taille + hachage FNV-1a des cases)
 * à chaque poste d'une carte-FIXTURE bâtie pour ce seul contrat : une refend percée d'une PORTE et
 * d'une FENÊTRE, une refend pleine, un ÉTAGE au-dessus de l'aile est. Les petites scènes ci-dessus
 * disent la RÈGLE ; celle-ci dit le RÉSULTAT sur un plan entier — le filet qui attrape un changement
 * de brouillard né d'une optimisation (le rayon échantillonné décide d'un pixel de coin, et une
 * « accélération équivalente » qui déplace une seule case le fait ici tomber en rouge).
 *
 * La carte est CONSTRUITE (`parseWalledAscii`) : aucune scène jouée n'en est le sujet, donc aucune
 * édition d'auteur ne peut rougir ces empreintes. Une empreinte qui change = un changement de VUE :
 * le justifier, puis remesurer — jamais recopier la nouvelle valeur pour faire taire le rouge.
 */
describe('computeVisible — vue INCHANGÉE sur un plan complet (carte-fixture)', () => {
  /** (2W+1)×(2H+1) — refend nord-sud percée d'une porte (y=3) et d'une fenêtre (y=5), refend
   *  est-ouest pleine sous la porte, pourtour clos. */
  const ROWS = [
    '+-+-+-+-+-+-+-+-+-+-+',
    '|. . . . .|. . . . .|',
    '+ + + + + + + + + + +',
    '|. . . . .|. . . . .|',
    '+ + + + + + + + + + +',
    '|. . . . .|. . . . .|',
    '+ + + + + + + + + + +',
    '|. . . . .:. . . . .|',
    '+ + + + + +-+-+-+-+-+',
    '|. . . . .|. . . . .|',
    '+ + + + + + + + + + +',
    '|. . . . .o. . . . .|',
    '+ + + + + + + + + + +',
    '|. . . . .|. . . . .|',
    '+ + + + + + + + + + +',
    '|. . . . .#. . . . .|',
    '+-+-+-+-+-+-+-+-+-+-+',
  ];

  /** La carte-fixture : rez bâti + ÉTAGE au-dessus de l'aile est (x ≥ 5, y ≤ 3), à un niveau de haut. */
  const carteTemoin = (): Scene => {
    const { w, h, tiles, walls } = parseWalledAscii(ROWS, 'plancher', {}, { wallLegend: { '#': { structure: 'cloture-en-clayonnage' } } });
    const surEtage = (x: number, y: number) => x >= 5 && y <= 3;
    const t1 = new Array(w * h).fill('vide');
    const h1 = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (surEtage(x, y)) { t1[y * w + x] = 'plancher'; h1[y * w + x] = METRES_PER_LEVEL; }
    return {
      ...emptyScene(w, h),
      id: 'fixture-plan-complet',
      layers: [{ z: 0, tiles }, { z: 1, tiles: t1, height: h1 }],
      walls: [...walls, ...walls.filter((m) => m.x >= 5 && m.y <= 4).map((m) => ({ ...m, z: 1 }))],
    } as unknown as Scene;
  };

  const empreinte = (cases: Set<string>): string => {
    let hache = 0x811c9dc5;
    for (const k of [...cases].sort())
      for (let i = 0; i < k.length; i++) { hache ^= k.charCodeAt(i); hache = Math.imul(hache, 0x01000193) >>> 0; }
    return `${cases.size}:${hache.toString(16)}`;
  };

  /** Les postes : un dans chaque aile, sur le SEUIL de la porte, contre la FENÊTRE, aux quatre coins,
   *  et deux à l'ÉTAGE. Empreintes MESURÉES sur la fixture (croisée transparente : #1712). */
  const POSTES: [number, number, number, string][] = [
    [0, 0, 0, '48:5186005a'],
    [2, 3, 0, '60:88116a2'],
    [5, 3, 0, '54:bf797db4'],
    [6, 5, 0, '41:4288d460'],
    [4, 5, 0, '64:eebb8a15'],
    [9, 7, 0, '39:f8f6b6c1'],
    [0, 7, 0, '64:1ef3e600'],
    [6, 1, 1, '114:3fde5310'],
    [8, 2, 1, '111:5240e8ea'],
  ];

  const vueAu = (carte: Scene, x: number, y: number, z: number) =>
    computeStateVisible({ scene: carte, battle: null, party: [], partyPos: z ? { x, y, z } : { x, y }, gameTime: DAY, lightLevel: null });

  it('la carte-fixture porte bien les cinq cas du contrat — refend pleine, porte, fenêtre, clayonnage, étage', () => {
    const carte = carteTemoin();
    const arete = (x: number, y: number, side: 'N' | 'E') => carte.walls!.find((m) => m.x === x && m.y === y && m.side === side && (m.z ?? 0) === 0);
    expect(arete(4, 1, 'E'), 'refend pleine').toBeTruthy();
    expect(arete(4, 1, 'E')!.door).toBeUndefined();
    expect(arete(4, 3, 'E')!.door, 'porte dans la refend').toBe(true);
    expect(arete(4, 5, 'E')!.window, 'fenêtre dans la refend').toBe(true);
    expect(arete(4, 7, 'E')!.structure, 'clayonnage dans la refend').toBe('cloture-en-clayonnage');
    expect(carte.layers.map((l) => l.z)).toEqual([0, 1]);
  });

  it('chaque poste rend la MÊME vue qu’à la mesure', () => {
    const carte = carteTemoin();
    expect(POSTES.map(([x, y, z]) => `${x},${y},${z} → ${empreinte(vueAu(carte, x, y, z))}`))
      .toEqual(POSTES.map(([x, y, z, attendue]) => `${x},${y},${z} → ${attendue}`));
  });

  /** Attentes DÉRIVÉES du prédicat d'opacité d'arête (`areteOcculte`, `state/scene.ts`). */
  it('la refend pleine coupe ; la porte, la croisée et le clayonnage laissent voir', () => {
    const carte = carteTemoin();
    expect(vueAu(carte, 4, 1, 0).has('5,1,0'), 'à travers la refend PLEINE').toBe(false);
    expect(vueAu(carte, 4, 3, 0).has('5,3,0'), 'à travers la PORTE').toBe(true);
    expect(vueAu(carte, 4, 5, 0).has('5,5,0'), 'à travers la CROISÉE (#1712)').toBe(true);
    expect(vueAu(carte, 4, 7, 0).has('5,7,0'), 'à travers le CLAYONNAGE').toBe(true);
  });
});

/**
 * CROISÉE — arbitrage #1712 (2026-09-08), verbatim : « Fenêtre = on voit et on tire — la ligne de vue
 * passe, le tir passe avec le couvert dégradé, le déplacement reste bloqué […] Paramétrable par croisée
 * (volets fermés = opaque) ». Fixture MINIMALE : un couloir 4×1 coupé d'une croisée `o` entre (1,0) et
 * (2,0).
 */
describe('croisée (#1712) — la vue et le tir passent, le pas non ; volets clos = opaque', () => {
  const COULOIR = ['+-+-+-+-+', '|. .o. .|', '+-+-+-+-+'];
  const couloir = (croisee: Partial<WallSeg> = {}): Scene => {
    const { w, h, tiles, walls } = parseWalledAscii(COULOIR, 'plancher', {});
    return {
      ...emptyScene(w, h),
      layers: [{ z: 0, tiles }],
      walls: walls.map((m) => (m.window ? { ...m, ...croisee } : m)),
    } as unknown as Scene;
  };
  const A = { x: 0, y: 0 };
  const B = { x: 3, y: 0 };
  /** Une Structure OCCULTANTE dont le couvert perd un cran sous `cranDeCouvertEnMoins` — lue au dataset. */
  const porteuse = structures.find((s) => {
    if (!s.couvertPenalty || s.occulte === false) return false;
    const brut = couvertDepuisDifficulte(s.couvertPenalty);
    return cranDeCouvertEnMoins(brut) !== brut;
  })!;

  it('la fixture porte UNE croisée, entre (1,0) et (2,0)', () => {
    expect(couloir().walls!.filter((m) => m.window)).toEqual([{ x: 1, y: 0, side: 'E', window: true }]);
  });

  it('la LIGNE DE VUE passe la croisée', () => {
    expect(losClear(couloir(), A, B)).toBe(true);
  });

  it('le DÉPLACEMENT reste bloqué : `wallBetween` barre l’arête, `pathTo` ne trouve aucun chemin', () => {
    const s = couloir();
    expect(wallBetween(s, 1, 0, 2, 0)).toBe(true);
    expect(pathTo(s, A, B, { blocked: new Set<string>() })).toBeNull();
  });

  it('VOLETS CLOS (`shuttered`) : la croisée coupe la vue', () => {
    expect(losClear(couloir({ shuttered: true }), A, B)).toBe(false);
  });

  it('croisée portée par une Structure : le couvert descend d’UN cran', () => {
    expect(porteuse, 'une Structure à couvert dégradable existe au dataset').toBeTruthy();
    const brut = couvertDepuisDifficulte(porteuse.couvertPenalty!);
    expect(couvertDArete(couloir({ structure: porteuse.id }), A, { x: 2, y: 0 })).toBe(cranDeCouvertEnMoins(brut));
  });

  it('croisée sur MUR NU (sans `structure`) : aucun couvert', () => {
    expect(couvertDArete(couloir(), A, { x: 2, y: 0 })).toBe('none');
  });
});
