import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { props } from '../../data';
import { setDataset } from '../../data/overrides';
import { empreinteDuProp, validatePropCatalog, type PropData } from '../../data/props.types';
import { decorEnCase, decorEnCaseEtage } from '../../state/decorIndex';
import { DIR4_ORDER, type Dir4 } from '../../state/dir8';
import { propFootTiles } from '../../state/footprint';
import { losClear, tileBlocksSight } from '../../state/lineOfSight';
import { emptyScene, isWalkable, sceneMetresPerTile, type Scene } from '../../state/scene';
import { entityAt } from '../../state/sceneEdit';
import { seatSlotsOf } from '../../state/seating';
import { validateScene } from '../../state/validateScene';
import { buildOpaque } from '../../state/vision';
import { interactionHalos } from '../builders/interactHalos';
import { buildProps } from '../builders/props';

/**
 * MEUBLE MULTI-CASE NEUF, ZÉRO LIGNE DE CODE (#1509) : une recette 3×1 NON carrée, OPAQUE, à trois
 * places, qu'aucun module ne connaît par son id, entre au catalogue par la seule donnée (`setDataset`).
 * Aux quatre caps, elle traverse ces coutures, et chacune la lit par sa donnée, jamais par son id :
 * - catalogue : `validatePropCatalog` (`data/props.types.ts`) ;
 * - empreinte : `empreinteDuProp` (`data/props.types.ts`), `propFootTiles` (`state/footprint.ts`) ;
 * - occupation : `isWalkable` (`state/scene.ts`) ;
 * - index case → décor : `decorEnCase`, `decorEnCaseEtage` (`state/decorIndex.ts`) ;
 * - picking du jeu : `decorEnCaseEtage`, que lit `meubleDessine` (`gameIso/stage/pickResolve.ts`) ;
 * - clic d'éditeur : `entityAt` (`state/sceneEdit.ts`) ;
 * - Ligne de Vue : `tileBlocksSight`, `losClear` (`state/lineOfSight.ts`) ;
 * - opacité en vision : `buildOpaque` (`state/vision.ts`) ;
 * - rendu d'entité : `buildProps` (`gameIso/builders/props.ts`) ;
 * - halo d'interaction : `interactionHalos` (`gameIso/builders/interactHalos.ts`) ;
 * - places assises : `seatSlotsOf` (`state/seating.ts`) ;
 * - validateur de scène : `validateScene` (`state/validateScene.ts`).
 * Une SCÈNE authorée qui pose un meuble neuf exige son id au registre généré
 * (`src/data/schemas/_ids.generated.ts`, `npm run gen`) : ce test pose le catalogue par `setDataset`
 * et sa scène en mémoire, sans passer par ce registre.
 */
const ID = 'banquette-de-fixture-3x1';
const tabouret = (xM: number) => [
  { kind: 'cylinder', axis: 'h', center: { xM, yM: -0.4, hM: 0.425 }, radiusM: 0.32, longueurM: 0.07, sides: 16, material: 'bois-chene' },
  { kind: 'cylinder', axis: 'h', center: { xM, yM: -0.4, hM: 0.195 }, radiusM: 0.15, longueurM: 0.39, sides: 8, material: 'fer-noirci' },
];
const NEUF = {
  id: ID,
  type: 'props',
  label: 'Banquette de fixture',
  solid: true,
  opaque: true,
  cover: 'totale',
  volume: {
    capIdentite: 'S',
    primitives: [
      { kind: 'box', center: { xM: 0, yM: 0.38, hM: 0.76 }, size: { xM: 5, yM: 1, hM: 0.06 }, material: 'bois-chene' },
      { kind: 'prism', center: { xM: 2.2, yM: 0.4, hM: 0.365 }, size: { xM: 0.16, yM: 0.88, hM: 0.73 }, slope: 'y-', material: 'bois-chene' },
      { kind: 'prism', center: { xM: -2.2, yM: 0.4, hM: 0.365 }, size: { xM: 0.16, yM: 0.88, hM: 0.73 }, slope: 'y-', material: 'bois-chene' },
      ...tabouret(2),
      ...tabouret(0),
      ...tabouret(-2),
    ],
  },
  seatSlots: [2, 0, -2].map((xM, i) => ({
    id: `place-${i + 1}`,
    anchor: { xM, yM: -0.4, hM: 0.46 },
    facing: 'S',
    approach: { x: 0, y: -1 },
  })),
} as unknown as PropData;

const POS = { x: 5, y: 5 };
const scèneAu = (facing: Dir4): Scene => {
  const s = emptyScene(14, 14);
  s.entities = [{ id: 'banquette-1', kind: 'prop', pos: POS, ref: ID, facing, usable: { assise: true } }];
  return s;
};
const attendue = (facing: Dir4) => (facing === 'E' || facing === 'O' ? { w: 1, h: 3 } : { w: 3, h: 1 });
const cle = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('meuble multi-case NEUF : la donnée suffit, aucune couture ne le connaît par son id', () => {
  let avant: readonly PropData[];
  beforeEach(() => {
    avant = [...props];
    setDataset('props', [...props, NEUF]);
  });
  afterEach(() => setDataset('props', avant));

  it.each(DIR4_ORDER)('cap %s : chaque couture suit le corps tourné', (facing) => {
    const scene = scèneAu(facing);
    const mpt = sceneMetresPerTile(scene);

    // EMPREINTE : 3×1, échangée au quart de tour.
    expect(empreinteDuProp(NEUF, facing, mpt)).toEqual(attendue(facing));

    // OCCUPATION : chacune de ses cases bloque, et rien au-delà.
    const cases = propFootTiles(ID, POS, facing, mpt);
    expect(cases).toHaveLength(3);
    for (const c of cases) expect(isWalkable(scene, c.x, c.y), `case ${cle(c)}`).toBe(false);
    const { w, h } = attendue(facing);
    expect(isWalkable(scene, POS.x + w, POS.y), 'à droite du corps').toBe(true);
    expect(isWalkable(scene, POS.x, POS.y + h), 'sous le corps').toBe(true);

    // RENDU D'ENTITÉ : un décor VOLUMIQUE, qui porte l'empreinte au cap jusqu'au halo.
    const els = buildProps(scene).filter((el) => el.source === 'entity');
    expect(els).toHaveLength(1);
    expect('faces' in els[0] && els[0].faces.length).toBeGreaterThan(0);
    expect(els[0].source === 'entity' && els[0].span).toEqual(attendue(facing));

    // HALO : l'utilisable est posté, et son halo épouse l'empreinte.
    const halos = interactionHalos([], els, scene, {}, { survol: null, reveler: true });
    expect(halos.map((x) => x.span)).toEqual([attendue(facing)]);

    // PLACES : trois places distinctes, abordées depuis une case LIBRE hors du corps.
    const places = seatSlotsOf(scene, 'banquette-1');
    expect(places).toHaveLength(3);
    const occupees = new Set(cases.map(cle));
    const abords = places.map((p) => cle(p.approach));
    expect(new Set(abords).size, 'abords distincts').toBe(3);
    for (const p of places) {
      const assise = { x: Math.round(p.anchor.x), y: Math.round(p.anchor.y) };
      expect(occupees.has(cle(assise)), `assise ${cle(assise)} sur le corps tourné`).toBe(true);
      expect(occupees.has(cle(p.approach)), `abord ${cle(p.approach)} hors du corps`).toBe(false);
      expect(isWalkable(scene, p.approach.x, p.approach.y), `abord ${cle(p.approach)} marchable`).toBe(true);
    }

    // CATALOGUE : la fiche neuve est intègre à l'échelle de la scène.
    expect(validatePropCatalog([NEUF], mpt)).toEqual([]);
    // PRÉMISSE — la même fiche, abords posés SUR leur siège, est refusée trois fois : le validateur
    // mesure l'empreinte 3×1 par la donnée (`data/props.types.ts:607`, abord dans l'empreinte).
    const abordsSurLeSiege = { ...NEUF, seatSlots: NEUF.seatSlots!.map((s) => ({ ...s, approach: { x: 0, y: 0 } })) } as PropData;
    expect(validatePropCatalog([abordsSurLeSiege], mpt).filter((e) => e.includes('tombe sur la case')), 'un abord par place dans le corps')
      .toHaveLength(3);

    // INDEX, PICKING, CLIC D'ÉDITEUR, LIGNE DE VUE, VISION : chaque case du corps rend le meuble et
    // bloque la vue ; la case au-delà, non.
    const occ = buildOpaque(scene);
    for (const c of cases) {
      expect(decorEnCase(scene, c.x, c.y)?.id, `index ${cle(c)}`).toBe('banquette-1');
      expect(decorEnCaseEtage(scene, c.x, c.y, 0)?.id, `picking ${cle(c)}`).toBe('banquette-1');
      expect(entityAt(scene, c, 0)?.id, `éditeur ${cle(c)}`).toBe('banquette-1');
      expect(tileBlocksSight(scene, c.x, c.y), `LdV ${cle(c)}`).toBe(true);
      expect(occ.g[c.y * occ.w + c.x], `vision ${cle(c)}`).toBe(1);
    }
    const audela = w > 1 ? { x: POS.x + w, y: POS.y } : { x: POS.x, y: POS.y + h };
    expect(decorEnCaseEtage(scene, audela.x, audela.y, 0), `picking ${cle(audela)}`).toBeUndefined();
    expect(tileBlocksSight(scene, audela.x, audela.y), `LdV ${cle(audela)}`).toBe(false);
    expect(occ.g[audela.y * occ.w + audela.x], `vision ${cle(audela)}`).toBe(0);
    // Un rayon qui franchit la DERNIÈRE case du corps est coupé ; son voisin juste au-delà passe.
    const traverse = (x: number, y: number) =>
      w > 1 ? losClear(scene, { x, y: y - 2 }, { x, y: y + 2 }) : losClear(scene, { x: x - 2, y }, { x: x + 2, y });
    const derniere = { x: POS.x + w - 1, y: POS.y + h - 1 };
    expect(traverse(derniere.x, derniere.y), `rayon par ${cle(derniere)}`).toBe(false);
    expect(traverse(audela.x, audela.y), `rayon par ${cle(audela)}`).toBe(true);

    // VALIDATEUR : un cap cardinal sur un décor volumique est licite, la scène ne dit rien du meuble.
    expect(validateScene([scene]).filter((w0) => w0.refId === 'banquette-1')).toEqual([]);
    // PRÉMISSE — la MÊME pose au cap diagonal est signalée (`state/validateScene.ts:165`, cap d'un décor
    // volumique) : le validateur lit bien le meuble neuf comme VOLUMIQUE, par sa donnée.
    const diagonale: Scene = { ...scene, entities: scene.entities.map((e) => ({ ...e, facing: 'NE' as const })) };
    expect(
      validateScene([diagonale]).filter((w0) => w0.refId === 'banquette-1').map((w0) => w0.level),
      'le cap diagonal d’un décor volumique est une erreur',
    ).toEqual(['error']);
  });
});
