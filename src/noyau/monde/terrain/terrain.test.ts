/**
 * Terrains — la façade sert le dataset `src/data/terrains.json` (#1690).
 *
 * Deux contrats : la RÈGLE (franchissabilité, précédence, repli bloquant d'un id inconnu) et la
 * FRAÎCHEUR (une entrée ajoutée à l'atelier est vue par la façade, alors que `setDataset` mute le
 * tableau EN PLACE et n'en change jamais l'identité).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  tousLesTerrains, terrainIds, terrainEntree, terrainLabel, terrainWalkable, terrainPriority,
  terrainOpaque, terrainBuilt, terrainSolidHeightM, terrainOverlayProp, terrainDetail,
  terrainAbsent, estAbsent, terrainHorsGrille, glypheDe, terrainsAvecGlyphe, terrainStopsOrdonnes,
} from './index';
import { GLYPHES_RESERVES } from '../../../data/schemas/grammaire/carte-ascii';
import { setDataset } from '../../../data/overrides';

const AVANT = tousLesTerrains().map((t) => ({ ...t }));
afterEach(() => setDataset('terrains', AVANT as never));

describe('terrains — la règle lue au dataset', () => {
  it('le dataset porte les ids attendus, et la façade les sert', () => {
    for (const id of ['herbe', 'sol', 'route', 'eau', 'plancher', 'bois', 'mur', 'porte', 'pave', 'terre', 'dalle'])
      expect(terrainEntree(id), id).toBeDefined();
    expect(terrainIds()).toHaveLength(tousLesTerrains().length);
  });

  it('walkability : herbe/route/pave franchissables, eau/mur non', () => {
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainWalkable('pave')).toBe(true);
    expect(terrainWalkable('eau')).toBe(false);
    expect(terrainWalkable('mur')).toBe(false);
  });

  it('id inconnu → non franchissable, transparent, non bâti, sans bloc ni décor ni recette', () => {
    expect(terrainWalkable('zzz-inconnu')).toBe(false);
    expect(terrainOpaque('zzz-inconnu')).toBe(false);
    expect(terrainBuilt('zzz-inconnu')).toBe(false);
    expect(terrainSolidHeightM('zzz-inconnu')).toBe(0);
    expect(terrainOverlayProp('zzz-inconnu')).toBeUndefined();
    expect(terrainDetail('zzz-inconnu')).toBeNull();
  });

  it('`terrainLabel` (id garanti au parse) : le nom d’auteur, et un id inconnu LÈVE (#3031)', () => {
    const premier = tousLesTerrains()[0];
    expect(terrainLabel(premier.id)).toBe(premier.label);
    expect(() => terrainLabel('zzz-inconnu')).toThrow('zzz-inconnu');
  });

  it('précédence : pave déborde sur herbe (priorité plus haute)', () => {
    expect(terrainPriority('pave')).toBeGreaterThan(terrainPriority('herbe'));
  });

  it('mur : opaque, bâti, bloc plein ; bois : décor posé sur chaque tuile', () => {
    expect(terrainOpaque('mur')).toBe(true);
    expect(terrainBuilt('mur')).toBe(true);
    expect(terrainSolidHeightM('mur')).toBeGreaterThan(0);
    expect(terrainOverlayProp('bois')).toBe('arbre');
  });
});

describe('terrains — les deux RÔLES ADRESSÉS, jamais un id récité (#1789)', () => {
  it('`terrainAbsent()` rend le terrain qui PORTE le rôle d’absence, `terrainHorsGrille()` celui du bord du monde', () => {
    const absent = terrainAbsent();
    expect(terrainEntree(absent)?.absence, 'le terrain rendu ne porte pas le rôle d’absence.').toBe(true);
    const bord = terrainHorsGrille();
    expect(terrainEntree(bord)?.bordDuMonde, 'le terrain rendu ne porte pas le rôle de bord du monde.').toBe(true);
    expect(bord, 'le bord du monde et la non-tuile ont fusionné.').not.toBe(absent);
  });

  it('le bord du monde porte ce qui FAIT la Ligne de Vue au bord : opaque, bâti, bloc plein', () => {
    const bord = terrainHorsGrille();
    expect(terrainOpaque(bord)).toBe(true);
    expect(terrainBuilt(bord)).toBe(true);
    expect(terrainSolidHeightM(bord)).toBeGreaterThan(0);
  });

  it('`estAbsent` : vrai sur le porteur du rôle, faux partout ailleurs — un id INCONNU n’est pas une absence', () => {
    expect(estAbsent(terrainAbsent())).toBe(true);
    expect(estAbsent(terrainHorsGrille())).toBe(false);
    expect(estAbsent('herbe')).toBe(false);
    expect(estAbsent('zzz-inconnu'), 'un id inconnu a été pris pour la non-tuile.').toBe(false);
    expect(estAbsent('')).toBe(false);
  });

  it('une entrée ÉDITÉE qui reçoit le rôle est vue sans rechargement (les deux rôles)', () => {
    const absentAvant = terrainAbsent();
    const bordAvant = terrainHorsGrille();
    const editees = AVANT.map((t) => {
      if (t.id === absentAvant) { const { absence: _a, ...reste } = t; return reste; }
      if (t.id === bordAvant) { const { bordDuMonde: _b, ...reste } = t; return reste; }
      if (t.id === 'eau') return { ...t, absence: true };
      if (t.id === 'roche') return { ...t, bordDuMonde: true };
      return t;
    });
    setDataset('terrains', editees as never);
    expect(terrainAbsent(), 'la façade a servi un porteur de rôle PÉRIMÉ').toBe('eau');
    expect(estAbsent('eau'), 'le rôle édité n’est pas vu par `estAbsent`').toBe(true);
    expect(estAbsent(absentAvant), 'l’ancien porteur passe encore pour la non-tuile').toBe(false);
    expect(terrainHorsGrille(), 'le bord du monde a servi un porteur PÉRIMÉ').toBe('roche');
  });

  it('un dataset SANS porteur d’un rôle lève, nommément — aucun repli silencieux', () => {
    setDataset('terrains', AVANT.map((t) => { const { absence: _a, ...reste } = t; return reste; }) as never);
    expect(() => terrainAbsent()).toThrow(/absence.*0 entrée/s);
  });
});

describe('terrains — le GLYPHE d’authoring est une donnée (#1789)', () => {
  it('`glypheDe` rend le glyphe DÉCLARÉ, `undefined` sur un terrain qui n’en porte pas, sur un id inconnu', () => {
    const declare = tousLesTerrains().find((t) => typeof t.ascii === 'string');
    expect(declare, 'aucun terrain ne déclare de glyphe : la façade servirait un vocabulaire vide.').toBeDefined();
    expect(glypheDe(declare!.id)).toBe(declare!.ascii);
    const sans = tousLesTerrains().find((t) => t.ascii === undefined)!;
    expect(glypheDe(sans.id), `« ${sans.id} » n’a pas de glyphe au dataset`).toBeUndefined();
    expect(glypheDe('zzz-inconnu')).toBeUndefined();
  });

  it('`terrainsAvecGlyphe` EST la légende de base : un glyphe par terrain déclarant, hors grammaire du plan', () => {
    const legende = terrainsAvecGlyphe();
    const declarants = tousLesTerrains().filter((t) => typeof t.ascii === 'string');
    expect(Object.keys(legende)).toHaveLength(declarants.length);
    for (const t of declarants) expect(legende[t.ascii!], t.id).toBe(t.id);
    for (const ch of Object.keys(legende))
      expect(GLYPHES_RESERVES.has(ch), `le glyphe « ${ch} » est un mot de la grammaire du plan`).toBe(false);
  });

  it('un glyphe ÉDITÉ au dataset est vu sans rechargement (lecture VIVANTE)', () => {
    const declare = tousLesTerrains().find((t) => typeof t.ascii === 'string')!;
    expect(terrainsAvecGlyphe()['§']).toBeUndefined();
    setDataset('terrains', AVANT.map((t) => (t.id === declare.id ? { ...t, ascii: '§' } : t)) as never);
    expect(glypheDe(declare.id), 'la façade a servi un glyphe PÉRIMÉ').toBe('§');
    expect(terrainsAvecGlyphe()['§']).toBe(declare.id);
    expect(terrainsAvecGlyphe()[declare.ascii!], 'l’ancien glyphe désigne encore son terrain').toBeUndefined();
  });
});

describe('terrains — la façade et le catalogue de rendu lisent VIVANT', () => {
  it('une entrée AJOUTÉE est référençable aussitôt', () => {
    const neuf = { ...AVANT[0], id: 'terrain-neuf', label: 'Terrain neuf', walkable: true };
    setDataset('terrains', [...AVANT, neuf] as never);
    expect(terrainEntree('terrain-neuf')).toBeDefined();
    expect(terrainWalkable('terrain-neuf')).toBe(true);
  });
});

describe('rampe d’un terrain — l’ordre des arrêts', () => {
  it('les arrêts se trient par offset croissant, quel que soit l’ordre des clés du Record', () => {
    expect(terrainStopsOrdonnes({ '100%': '#ffffff', '0%': '#000000', '45%': '#808080' })).toEqual([
      ['0%', '#000000'],
      ['45%', '#808080'],
      ['100%', '#ffffff'],
    ]);
  });
});
