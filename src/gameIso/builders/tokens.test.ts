import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import type { BattleState } from '../../noyau/etat';
import { Combatant } from '../../engine/types';
import { buildTokens, partyTokenOf } from './tokens';
import { combatantRingDecor, teamRings } from './dynamicMarks';
import { tokenChromes } from './tokenChrome';
import { isOverhang, capsSolid } from './floors';

/** Fabrique un combattant MINIMAL (champs consommés par le builder + prédicats de filtre). */
function cbt(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number; z?: number }, extra: Partial<Combatant> = {}): Combatant {
  return {
    id,
    name: id,
    kind,
    pos,
    size: 'moyenne',
    conditions: [],
    wounds: { current: 10, max: 10 },
    ...extra,
  } as unknown as Combatant;
}

const battleOf = (combatants: Combatant[]): BattleState => ({ combatants } as unknown as BattleState);

/** Toutes les cases de la couche 0 visibles. */
const allVisible = (s: Scene) => {
  const v = new Set<string>();
  for (let y = 0; y < s.dimensions.h; y++) for (let x = 0; x < s.dimensions.w; x++) v.add(`${x},${y},0`);
  return v;
};

const VIEW = { activeZ: 0, viewZ: null, top: false };

describe('buildTokens — figurants (PNJ d’ambiance)', () => {
  const scene = () => {
    const s = emptyScene('scene-test', 6, 6);
    s.entities = [
      { id: 'f1', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 } },
      { id: 'f2', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, combat: { hiddenUntilCombat: true } }, // embuscade
      { id: 'pr', kind: 'prop', pos: { x: 3, y: 3 } }, // prop → buildProps, pas un token
      { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    ] as SceneEntity[];
    s.encounters = [{ id: 'enc', members: [{ entityId: 'f1' }] }] as Scene['encounters'];
    return s;
  };

  it('émet les figurants visibles (embusqués/props/heroStart exclus) et marque les enrôlés', () => {
    const els = buildTokens(scene(), allVisible(scene()), null, VIEW, ['h1', 'h2']);
    expect(els.map((e) => e.key)).toEqual(['fig:f1']);
    expect(els[0].subject).toMatchObject({ kind: 'figurant', enrolled: true, inBattle: false });
    expect(els[0].states.visible).toBe(true);
  });

  it('coupe un figurant hors-vue (brouillard)', () => {
    expect(buildTokens(scene(), new Set(), null, VIEW, ['h1', 'h2'])).toHaveLength(0);
  });

  it('un figurant ASSIS porte sa place (ancre métrique + cap), sans aucun porteur', () => {
    const s = scene();
    s.entities = [
      { id: 'table-1', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
      { id: 'f1', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 1 } }, // assis à l'est : sa `pos` EST son abord
      { id: 'f2', kind: 'personnage', ref: 'humain', pos: { x: 4, y: 4 } }, // debout : aucune place
    ] as SceneEntity[];
    s.encounters = [] as Scene['encounters'];
    s.seatAssignments = { 'table-1': { 'place-2': { kind: 'entity', entityId: 'f1' } } };
    const par = new Map(buildTokens(s, allVisible(s), null, VIEW, ['h1', 'h2']).map((e) => [e.id, e.subject]));
    const assis = par.get('f1') as { kind: string; seat?: { slotId: string; facing: string; anchor: { x: number; y: number; h: number } } };
    expect(assis.seat?.slotId).toBe('place-2');
    expect(assis.seat?.facing).toBe('O');           // recette face au N : le corps de l'est regarde l'ouest
    expect(assis.seat?.anchor.x).toBeCloseTo(1.48, 4);
    expect(assis.seat?.anchor.h).toBeCloseTo(0.46, 4);
    // Un attablé n'est PAS un couple monté : aucun token `mounted` n'est émis pour lui, et le sujet
    // reste un figurant (assertion qui rougirait si l'assise passait par la voie monture).
    expect(assis.kind).toBe('figurant');
    expect(buildTokens(s, allVisible(s), null, VIEW, ['h1', 'h2']).map((e) => e.subject.kind)).toEqual(['figurant', 'figurant']);
    expect(par.get('f2')).not.toHaveProperty('seat'); // debout : aucun champ d'assise
  });

  it('en combat : saute un figurant enrôlé (rendu par son combattant) ou couvert par un combattant', () => {
    const s = scene();
    // f1 enrôlé dans la bataille → c'est le combattant qui le rend.
    const b1 = battleOf([cbt('f1', 'enemy', { x: 1, y: 1 })]);
    expect(buildTokens(s, allVisible(s), b1, VIEW, ['h1', 'h2']).filter((e) => e.subject.kind === 'figurant')).toHaveLength(0);
    // Un combattant OCCUPE la case du figurant → pas d'empilement de corps.
    const b2 = battleOf([cbt('h', 'hero', { x: 1, y: 1 })]);
    expect(buildTokens(s, allVisible(s), b2, VIEW, ['h1', 'h2']).filter((e) => e.subject.kind === 'figurant')).toHaveLength(0);
    // Case libre → figurant maintenu, estompé (inBattle).
    const b3 = battleOf([cbt('h', 'hero', { x: 4, y: 4 })]);
    const figs = buildTokens(s, allVisible(s), b3, VIEW, ['h1', 'h2']).filter((e) => e.subject.kind === 'figurant');
    expect(figs).toHaveLength(1);
    expect(figs[0].subject).toMatchObject({ kind: 'figurant', inBattle: true });
  });
});

describe('buildTokens — combattants', () => {
  const scene6 = () => emptyScene('scene-test', 6, 6);

  it('émet les combattants placés, coupe un ENNEMI hors-vue mais jamais un héros', () => {
    const s = scene6();
    const b = battleOf([cbt('h1', 'hero', { x: 0, y: 0 }), cbt('e1', 'enemy', { x: 5, y: 5 }), cbt('e2', 'enemy', { x: 1, y: 0 })]);
    const els = buildTokens(s, new Set(['0,0,0', '1,0,0']), b, VIEW, ['h1', 'h2']).filter((e) => e.subject.kind === 'combatant');
    expect(els.map((e) => e.id)).toEqual(['h1', 'e2']); // e1 hors-vue coupé ; h1 (viewer) toujours rendu
  });

  it('ordre d’ANNEAU héros : un cavalier non dessiné consomme quand même son ordinal (couleur stable)', () => {
    const s = scene6();
    const b = battleOf([
      cbt('h1', 'hero', { x: 0, y: 0 }, { mountId: 'm1' }),
      cbt('m1', 'enemy', { x: 0, y: 0 }, { riderId: 'h1' }),
      cbt('h2', 'hero', { x: 2, y: 2 }),
    ]);
    const els = buildTokens(s, allVisible(s), b, VIEW, ['h1', 'h2']);
    const h2 = els.find((e) => e.id === 'h2')!;
    expect(h2.subject).toMatchObject({ kind: 'combatant', heroIndex: 1 }); // 0 consommé par le cavalier h1
    // Le couple monté est émis comme UN composite à la tuile de la monture.
    const mtd = els.filter((e) => e.subject.kind === 'mounted');
    expect(mtd.map((e) => e.key)).toEqual(['mtd:m1']);
  });

  it('l’identité du second héros reste commune aux anneaux et au chrome quand le premier est filtré', () => {
    const s = scene6();
    const premier = cbt('h1', 'hero', { x: 0, y: 0 }, { pos: undefined });
    const second = cbt('h2', 'hero', { x: 2, y: 2 });
    const population = [premier, second];
    const tokens = buildTokens(s, allVisible(s), battleOf(population), VIEW, ['h1', 'h2']);
    expect(tokens.map((token) => token.id)).toEqual(['h2']);
    const attendu = combatantRingDecor(second, ['h1', 'h2'], population);
    const [anneau] = teamRings(tokens, null);
    expect({ color: anneau.color, dash: anneau.dash }).toEqual(attendu);
    expect(tokenChromes(tokens, { ghostIds: new Set(), hoveredId: null })[0].team).toEqual(attendu);
  });

  it('le meneur non premier garde son identité sur son anneau et son pion de groupe', () => {
    const s = scene6();
    const premier = cbt('h1', 'hero', { x: 0, y: 0 });
    const meneur = cbt('h2', 'hero', { x: 1, y: 1 });
    const population = [premier, meneur];
    const groupe = partyTokenOf(s, meneur, { x: 2, y: 2 }, ['h1', 'h2'])!;
    const attendu = combatantRingDecor(meneur, ['h1', 'h2'], population);
    const [anneau] = teamRings([], groupe);
    expect(groupe.heroIndex).toBe(1);
    expect({ color: anneau.color, dash: anneau.dash }).toEqual(attendu);
    expect(tokenChromes([], { ghostIds: new Set(), hoveredId: null }, groupe)[0].team).toEqual(attendu);
  });

  it('la décoration de la monture suit le même couple iso ou pion dissocié que les anneaux et le chrome', () => {
    const s = scene6();
    const premier = cbt('h1', 'hero', { x: 0, y: 0 });
    const cavalier = cbt('h2', 'hero', { x: 2, y: 2 }, { mountId: 'm1' });
    const monture = cbt('m1', 'enemy', { x: 2, y: 2 }, { riderId: cavalier.id });
    const population = [premier, cavalier, monture];
    for (const top of [false, true]) {
      const tokens = buildTokens(s, allVisible(s), battleOf(population), { ...VIEW, top }, ['h1', 'h2']);
      const anneau = teamRings(tokens, null).find((mark) => mark.id === monture.id)!;
      const chrome = tokenChromes(tokens, { ghostIds: new Set(), hoveredId: null }).find((mark) => mark.id === monture.id)!;
      const attendu = combatantRingDecor(monture, ['h1', 'h2'], population, top);
      expect({ color: anneau.color, dash: anneau.dash }).toEqual(attendu);
      expect(chrome.team).toEqual(attendu);
    }
  });

  it('vue du DESSUS : cavalier et monture redeviennent deux pions distincts (aucun composite)', () => {
    const s = scene6();
    const b = battleOf([
      cbt('h1', 'hero', { x: 0, y: 0 }, { mountId: 'm1' }),
      cbt('m1', 'hero', { x: 0, y: 0 }, { riderId: 'h1' }),
    ]);
    const els = buildTokens(s, allVisible(s), b, { ...VIEW, top: true }, ['h1', 'h2']);
    expect(els.filter((e) => e.subject.kind === 'mounted')).toHaveLength(0);
    expect(els.filter((e) => e.subject.kind === 'combatant').map((e) => e.id).sort()).toEqual(['h1', 'm1']);
  });

  it('un couple ENNEMI subit les MÊMES filtres qu’un ennemi à pied : brouillard et étage le coupent', () => {
    const s = scene6();
    const couple = (z = 0) => battleOf([
      cbt('h1', 'hero', { x: 0, y: 0 }), // le viewer (sinon rien à voir depuis nulle part)
      cbt('e1', 'enemy', { x: 4, y: 4, z }, { mountId: 'm1' }),
      cbt('m1', 'enemy', { x: 4, y: 4, z }, { riderId: 'e1' }),
    ]);
    // Brouillard : aucune case vue → le couple ne s'affiche pas, comme le témoin à pied.
    const rienDeVu = new Set(['0,0,0']);
    expect(buildTokens(s, rienDeVu, couple(), VIEW, ['h1', 'h2']).map((e) => e.key)).toEqual(['cbt:h1']);
    const àPied = battleOf([cbt('h1', 'hero', { x: 0, y: 0 }), cbt('p1', 'enemy', { x: 4, y: 4 })]);
    expect(buildTokens(s, rienDeVu, àPied, VIEW, ['h1', 'h2']).map((e) => e.key)).toEqual(['cbt:h1']); // témoin
    // La sonde mord : la case vue, le couple sort bien en composite.
    const vu = new Set(['0,0,0', '4,4,0']);
    expect(buildTokens(s, vu, couple(), VIEW, ['h1', 'h2']).map((e) => e.key)).toEqual(['cbt:h1', 'mtd:m1']);
    // Étage : un couple au z1 sur du VIDE (pas un surplomb) est coupé depuis l'étage actif 0.
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    s.layers[0].tiles[4 * 6 + 4] = 'vide';
    expect(buildTokens(s, new Set([...vu, '4,4,1']), couple(1), VIEW, ['h1', 'h2']).map((e) => e.key)).toEqual(['cbt:h1']);
  });

  it('un couple HÉROS reste rendu dans le brouillard (les alliés sont les viewers)', () => {
    const s = scene6();
    // La monture porte le camp de son record (ennemi) : c'est le CAVALIER héros qui fait le viewer.
    const b = battleOf([
      cbt('h1', 'hero', { x: 4, y: 4 }, { mountId: 'm1' }),
      cbt('m1', 'enemy', { x: 4, y: 4 }, { riderId: 'h1' }),
    ]);
    expect(buildTokens(s, new Set(), b, VIEW, ['h1', 'h2']).map((e) => e.key)).toEqual(['mtd:m1']);
  });

  it('saute une STRUCTURE de siège (rendue sur son arête) et un combattant d’étage supérieur non-surplomb', () => {
    const s = scene6();
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    s.layers[0].tiles[2 * 6 + 2] = 'vide'; // sous (2,2) : rien de marchable → z1 n'y est PAS un surplomb
    const b = battleOf([
      cbt('mur', 'enemy', { x: 1, y: 1 }, { bodyShape: 'structure' } as Partial<Combatant>),
      cbt('e-haut', 'enemy', { x: 2, y: 2, z: 1 }), // z1 sur du VIDE (pas un surplomb) → coupé depuis z0
      cbt('h1', 'hero', { x: 0, y: 0 }),
    ]);
    const els = buildTokens(s, new Set([...allVisible(s), '2,2,1']), b, VIEW, ['h1', 'h2']);
    expect(els.filter((e) => e.subject.kind === 'combatant').map((e) => e.id)).toEqual(['h1']);
  });

  /** CHEMIN DE RONDE : sol de z1 posé sur la MASSE PLEINE du rempart (`capsSolid`) — le monde le
   *  DESSINE depuis la cour (`buildFloors`), donc ses occupants aussi. Le z0 sous la masse n'est pas
   *  marchable : ce n'est PAS un surplomb (`isOverhang` faux) — c'était le trou #1567 (le plancher
   *  peint, la garnison coupée : défenseurs ET pièces d'artillerie servies). */
  const rempart = () => {
    const s = emptyScene('scene-test', 6, 6);
    s.layers[0] = { ...s.layers[0], tiles: s.layers[0].tiles.map((t, i) => (i === 2 * 6 + 2 ? 'mur' : t)) };
    const tiles = new Array(36).fill('vide');
    tiles[2 * 6 + 2] = 'pierre';
    const height = new Array(36).fill(0);
    height[2 * 6 + 2] = 4;
    s.layers.push({ z: 1, tiles, height });
    return s;
  };

  it('sol de z1 coiffant un BLOC PLEIN : c’est un dessus de rempart, pas un surplomb', () => {
    const s = rempart();
    expect(isOverhang(s, 2, 2, 1)).toBe(false);
    expect(capsSolid(s, 2, 2, 1)).toBe(true);
  });

  it('un défenseur et sa PIÈCE servie sur le chemin de ronde restent rendus depuis la cour (activeZ 0)', () => {
    const s = rempart();
    const b = battleOf([
      cbt('h1', 'hero', { x: 0, y: 0 }),
      cbt('garde', 'hero', { x: 2, y: 2, z: 1 }),
      cbt('baliste', 'hero', { x: 2, y: 2, z: 1 }, { bodyShape: 'engin' } as Partial<Combatant>),
    ]);
    const els = buildTokens(s, allVisible(s), b, VIEW, ['h1', 'h2']).filter((e) => e.subject.kind === 'combatant');
    expect(els.map((e) => e.id)).toEqual(['h1', 'garde', 'baliste']);
  });

  it('MÊME loi pour un FIGURANT posté sur le chemin de ronde (hors combat)', () => {
    const s = rempart();
    s.entities = [{ id: 'fig-rempart', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, z: 1 }] as SceneEntity[];
    expect(buildTokens(s, new Set([...allVisible(s), '2,2,1']), null, VIEW, ['h1', 'h2']).map((e) => e.key)).toEqual(['fig:fig-rempart']);
  });
});
