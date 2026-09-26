/**
 * Défauts de CONTENU rendus à l'auteur par `validateScene` : départ du groupe, connectivité à pied des
 * pièces nommées (`state/mapQC`), réf de créature irrésoluble (le même faisceau qu'au spawn), empreinte
 * d'un combattant de rencontre. Fixtures SYNTHÉTIQUES uniquement — une scène livrée bouge dès que son
 * auteur la corrige, et son verdict n'appartient pas à ce banc.
 */
import { describe, expect, it } from 'vitest';
import { validateScene, type Warning } from './validateScene';
import { emptyScene, type Scene, type WallSeg } from './scene';
import { RefIrresoluble, spawnEnemy } from './spawn';
import { creatures, siegeEngines, vehicles } from '../data';
import type { MapPlace, WorldMap } from './worldMap';

/** Ids LUS AUX REGISTRES (jamais un littéral : le bestiaire et les catalogues vivent). */
const REF_CREATURE = creatures[0].id;
const REF_COQUE = vehicles.find((v) => v.hull)!.id;
const REF_ENGIN = siegeEngines()[0].id;

/** Plain-pied 8×8 d'herbe (tout est marchable) avec le départ du groupe posé en (1,1). */
function scene(): Scene {
  const s = emptyScene(8, 8);
  s.id = 'S';
  s.entities.push({ id: 'start', kind: 'heroStart', pos: { x: 1, y: 1 } });
  return s;
}

/** Les 4 arêtes qui scellent la case (5,5) — forme canonique de stockage (`N`/`E`, cf. `scene.ts`). */
const cellule: WallSeg[] = [
  { x: 5, y: 5, side: 'N' },
  { x: 5, y: 5, side: 'E' },
  { x: 5, y: 6, side: 'N' },
  { x: 4, y: 5, side: 'E' },
];

/** Une pièce nommée d'une seule case en (5,5). */
const piece = (): NonNullable<Scene['effectZones']>[number] =>
  ({ id: 'cellule', label: 'Cellier', presentation: 'interior', area: { kind: 'rect', x: 5, y: 5, w: 1, h: 1 }, z: 0 });

const de = (s: Scene, scope: Warning['scope']) => validateScene([s]).filter((w) => w.scope === scope);

describe('une pièce nommée que RIEN ne relie au départ du groupe se dit à l’auteur', () => {
  it('pièce scellée par ses 4 arêtes → un avertissement, qui la NOMME et porte son id en réf cliquable', () => {
    const s = scene();
    s.walls = [...cellule];
    s.effectZones = [piece()];
    const warns = de(s, 'scene');
    expect(warns).toHaveLength(1);
    expect(warns[0].level).toBe('warn');
    expect(warns[0].refId).toBe('cellule');
    expect(warns[0].message).toContain('Cellier');
    expect(warns[0].message).toContain('(1,1');
  });

  it('CONTRE-ÉPREUVE : une PORTE percée dans l’une des quatre arêtes la rejoint — plus un mot', () => {
    const s = scene();
    s.walls = cellule.map((w, i) => (i === 0 ? { ...w, door: true } : w));
    s.effectZones = [piece()];
    expect(de(s, 'scene')).toEqual([]);
  });

  it('le DÉPART posé sur une case non marchable se dit, et la connectivité se TAIT (sinon toutes les pièces seraient fausses)', () => {
    const s = scene();
    s.layers[0].tiles[1 * 8 + 1] = 'mur';
    s.walls = [...cellule];
    s.effectZones = [piece()];
    const warns = validateScene([s]).filter((w) => w.scope === 'entity' || w.scope === 'scene');
    expect(warns).toHaveLength(1);
    expect(warns[0].refId).toBe('start');
    expect(warns[0].message).toContain("n'est pas marchable");
  });

  it('à l’échelle MER (case ≥ 4 m, navire-unité) rien de tout cela n’a de sujet : la grille est de l’eau et le groupe est à bord', () => {
    const s = scene();
    s.metresPerTile = 10;
    s.layers[0].tiles = s.layers[0].tiles.map(() => 'eau');
    s.walls = [...cellule];
    s.effectZones = [piece()];
    expect(validateScene([s]).filter((w) => w.scope === 'entity' || w.scope === 'scene')).toEqual([]);
  });
});

describe('une RÉF de créature que le spawn ne résout pas est une erreur, pas une surprise à l’écran', () => {
  it('réf inconnue → erreur nominative sur l’entité', () => {
    const s = scene();
    s.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ref: 'gobelin-des-cavernes-oublie' });
    const errs = validateScene([s]).filter((w) => w.level === 'error');
    expect(errs).toHaveLength(1);
    expect(errs[0].refId).toBe('e-1');
    expect(errs[0].message).toContain('créature inexistante « gobelin-des-cavernes-oublie »');
  });

  it('PARITÉ avec le spawn : les 3 branches du faisceau passent la validation ET se spawnent ; une réf fausse est dite ET lève', () => {
    for (const ref of [REF_CREATURE, REF_COQUE, REF_ENGIN]) {
      const s = scene();
      s.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ref });
      expect(validateScene([s]).filter((w) => w.level === 'error'), ref).toEqual([]);
      expect(spawnEnemy({ ref: ref }, 'e-1', { x: 2, y: 2 }).porteurDeFiche, ref).toEqual({ ref });
    }
    const faux = scene();
    faux.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ref: 'ref-qui-nexiste-nulle-part' });
    expect(validateScene([faux]).filter((w) => w.level === 'error')).toHaveLength(1);
    expect(() => spawnEnemy({ ref: 'ref-qui-nexiste-nulle-part' }, 'e-1', { x: 2, y: 2 })).toThrow(RefIrresoluble);
  });

  it('une réf du bestiaire passe ; une réf MORTE est dite même quand un statbloc la côtoie (#1882)', () => {
    const vraie = scene();
    vraie.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ref: REF_CREATURE });
    expect(validateScene([vraie]).filter((w) => w.level === 'error')).toEqual([]);

    const custom = scene();
    custom.entities.push({
      id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ref: 'gobelin-des-cavernes-oublie',
      statblock: { type: 'statblock', label: 'Brigand', char: { B: 10 } },
    });
    expect(validateScene([custom]).filter((w) => w.level === 'error').map((w) => w.message))
      .toEqual(['e-1 → créature inexistante « gobelin-des-cavernes-oublie »']);
  });

  it('un PNJ nommé (`presetId`) passe sans réf ; sa réf MORTE est dite (#1882)', () => {
    const sans = scene();
    sans.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, presetId: 'pnj-de-la-campagne' });
    expect(validateScene([sans]).filter((w) => w.level === 'error')).toEqual([]);

    const avecRefMorte = scene();
    avecRefMorte.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, presetId: 'pnj-de-la-campagne', ref: 'ref-qui-nexiste-nulle-part' });
    expect(validateScene([avecRefMorte]).filter((w) => w.level === 'error')).toHaveLength(1);
  });

  it('un DÉCOR à réf MORTE est une erreur, et un décor SANS type aussi — il se DIT ou se REFUSE (#877)', () => {
    const morte = scene();
    morte.entities.push({ id: 'p-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau-imaginaire' });
    expect(validateScene([morte]).filter((w) => w.level === 'error').map((w) => w.message))
      .toEqual(['p-1 → décor inexistant « tonneau-imaginaire »']);

    const sansType = scene();
    sansType.entities.push({ id: 'p-2', kind: 'prop', pos: { x: 2, y: 2 } });
    expect(validateScene([sansType]).filter((w) => w.level === 'error').map((w) => w.message))
      .toEqual(['p-2 : décor « p-2 » : « ref » absente — un décor NOMME son type au catalogue (props.json)']);
  });

  it('un PERSONNAGE sans fiche est une erreur nommée ; chaque porteur SEUL (réf, statbloc, preset) la lève (#1882)', () => {
    const sansFiche = scene();
    sansFiche.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, label: 'Aubergiste' });
    expect(validateScene([sansFiche]).filter((w) => w.level === 'error').map((w) => `${w.refId} ${w.message}`))
      .toEqual(['e-1 Aubergiste : personnage « e-1 » : « ref », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, statbloc ou preset de PNJ)']);

    for (const porteur of [
      { ref: REF_CREATURE },
      { statblock: { type: 'statblock' as const, label: 'Brigand', char: { B: 10 } } },
      { presetId: 'pnj-de-la-campagne' },
    ]) {
      const s = scene();
      s.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ...porteur });
      expect(validateScene([s]).filter((w) => w.level === 'error'), Object.keys(porteur)[0]).toEqual([]);
    }
  });

  it('une réf de personnage VIDE n’est pas un porteur : le personnage est dit SANS fiche (#1882)', () => {
    const vide = scene();
    vide.entities.push({ id: 'e-1', kind: 'personnage', pos: { x: 2, y: 2 }, ref: '' });
    expect(validateScene([vide]).filter((w) => w.level === 'error').map((w) => w.message))
      .toEqual(['e-1 : personnage « e-1 » : « ref », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, statbloc ou preset de PNJ)']);
  });
});

describe('une scène où la carte du monde fait DÉBARQUER le groupe doit dire OÙ', () => {
  const lieu = (extra: Partial<MapPlace> = {}): MapPlace =>
    ({ id: 'lieu', label: 'Le Relais', pos: { x: 0, y: 0 }, scene: 'S', ...extra });
  const carte = (place: MapPlace): WorldMap => ({ id: 'w', label: 'Carte', places: [place], routes: [] });
  /** La même scène que le reste du banc, mais SANS départ du groupe. */
  const sansDepart = (): Scene => {
    const s = scene();
    s.label = 'Le Relais';
    s.entities = s.entities.filter((e) => e.kind !== 'heroStart');
    return s;
  };

  it('lieu menant à une scène SANS départ et sans point d’arrivée nommé → un avertissement, qui nomme la porte', () => {
    const warns = validateScene([sansDepart()], carte(lieu())).filter((w) => w.scope === 'scene');
    expect(warns).toHaveLength(1);
    expect(warns[0].level).toBe('warn');
    expect(warns[0].refId).toBe('S');
    expect(warns[0].message).toContain('Le Relais');
  });

  it('CONTRE-ÉPREUVE : départ posé → rien ; point d’arrivée NOMMÉ sur le lieu → rien non plus (le runtime n’a plus à deviner)', () => {
    expect(validateScene([scene()], carte(lieu())).filter((w) => w.scope === 'scene')).toEqual([]);
    expect(validateScene([sansDepart()], carte(lieu({ entry: 'porche' }))).filter((w) => w.scope === 'scene')).toEqual([]);
  });

  it('un POI de plan ne porte AUCUN point d’arrivée : la scène qu’il ouvre doit avoir son départ', () => {
    const avecPoi = lieu({ entry: 'porche', scene: 'autre', poi: [{ id: 'poi', label: 'La cave', pos: { x: 1, y: 1 }, sceneId: 'S' }] });
    const warns = validateScene([sansDepart()], carte(avecPoi)).filter((w) => w.scope === 'scene');
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toContain('La cave');
  });

  it('une scène qu’AUCUNE porte de carte ne désigne n’est pas jugée : on y entre par transition, avec sa propre case d’arrivée', () => {
    expect(validateScene([sansDepart()]).filter((w) => w.scope === 'scene')).toEqual([]);
    expect(validateScene([sansDepart()], carte(lieu({ scene: 'autre' }))).filter((w) => w.scope === 'scene')).toEqual([]);
  });
});

describe('un combattant de rencontre occupe SON EMPREINTE, pas seulement son ancre', () => {
  /** Rencontre d'un seul membre, dont la Taille est déclarée au statbloc (`entitySize`). */
  function avecMembre(s: Scene, pos: { x: number; y: number }, size?: 'grande'): Scene {
    s.entities.push({
      id: 'ogre', kind: 'personnage', label: 'Ogre', pos,
      statblock: { type: 'statblock', label: 'Ogre', char: { B: 10 }, ...(size ? { size } : {}) },
    });
    s.encounters.push({ id: 'renc', members: [{ entityId: 'ogre', side: 'enemy' }] });
    return s;
  }

  it('une Grande (2×2) posée au ras d’un mur déborde sur une case qui ne l’accueille pas — les cases sont NOMMÉES', () => {
    const s = scene();
    s.layers[0].tiles[3 * 8 + 3] = 'mur'; // (3,3)
    const warns = de(avecMembre(s, { x: 2, y: 2 }, 'grande'), 'entity');
    expect(warns).toHaveLength(1);
    expect(warns[0].refId).toBe('ogre');
    expect(warns[0].message).toContain('empreinte 2×2');
    expect(warns[0].message).toContain('(3,3)');
  });

  it('la MÊME Grande décalée d’une case ne dit rien ; et son ancre seule ne suffisait pas à juger la pose', () => {
    const s = scene();
    s.layers[0].tiles[3 * 8 + 3] = 'mur';
    expect(de(avecMembre(s, { x: 4, y: 4 }, 'grande'), 'entity')).toEqual([]);
  });

  it('une empreinte qui SORT de la carte se dit à part (hors carte ≠ non marchable)', () => {
    const warns = de(avecMembre(scene(), { x: 7, y: 7 }, 'grande'), 'entity');
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toContain('hors de la carte');
    expect(warns[0].message).toContain('(8,7)');
  });

  it('à l’échelle MER aussi, une empreinte qui SORT de la carte se dit — le hors-carte ne dépend d’aucune échelle', () => {
    const s = scene();
    s.metresPerTile = 10;
    s.layers[0].tiles = s.layers[0].tiles.map(() => 'eau');
    const warns = de(avecMembre(s, { x: 7, y: 7 }, 'grande'), 'entity');
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toContain('hors de la carte');
  });

  it('une entité de scène HORS rencontre n’est pas jugée sur son empreinte : elle n’entre pas au combat', () => {
    const s = scene();
    s.layers[0].tiles[3 * 8 + 3] = 'mur';
    s.entities.push({
      id: 'ogre', kind: 'personnage', label: 'Ogre', pos: { x: 2, y: 2 },
      statblock: { type: 'statblock', label: 'Ogre', char: { B: 10 }, size: 'grande' },
    });
    expect(de(s, 'entity')).toEqual([]);
  });
});
