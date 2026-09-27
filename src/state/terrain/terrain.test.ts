/**
 * Terrains — la façade sert le dataset `src/data/terrains.json` (#1690).
 *
 * Trois contrats : la RÈGLE (franchissabilité, précédence, repli bloquant d'un id inconnu), la
 * FRAÎCHEUR (une entrée éditée à l'atelier est vue par la façade ET par le catalogue de rendu, alors
 * que `setDataset` mute le tableau EN PLACE et n'en change jamais l'identité), et l'ASSEMBLAGE des
 * dégradés SVG (un dégradé par terrain, ses PROPRES arrêts).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  tousLesTerrains, terrainIds, terrainEntree, terrainLabel, terrainWalkable, terrainPriority,
  terrainOpaque, terrainBuilt, terrainSolidHeightM, terrainOverlayProp, terrainDetail,
  terrainAbsent, estAbsent, terrainHorsGrille, glypheDe, terrainsAvecGlyphe,
} from './index';
import { GLYPHES_RESERVES } from '../../data/schemas/grammaire/carte-ascii';
import { setDataset } from '../../data/overrides';
import { terrainDef, terrainGradient, terrainGradientId, MISSING_GRADIENT } from '../../gameIso/catalog/terrain';
import { defsGlobaux } from '../../gameIso/sprites';

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
    expect(terrainLabel('zzz-inconnu')).toBeUndefined();
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
  it('une entrée éditée est vue par la façade ET par le catalogue, sans rechargement', () => {
    const editees = AVANT.map((t) => {
      if (t.id === 'herbe') return { ...t, walkable: false };
      if (t.id === 'eau') return { ...t, swatch: '#0d0d0d' };
      return t;
    });
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainDef('eau').swatch).not.toBe('#0d0d0d');
    setDataset('terrains', editees as never);
    expect(terrainWalkable('herbe'), 'la façade a servi un index PÉRIMÉ').toBe(false);
    expect(terrainDef('eau').swatch, 'le catalogue de rendu a servi un index PÉRIMÉ').toBe('#0d0d0d');
  });

  // Ce que ce test mesure : `defsGlobaux()` ré-émet la rampe ÉDITÉE (l'émetteur relit le dataset, il
  // ne sert pas une chaîne assemblée à l'import). Ce que MONTE ce SVG dans le document est un autre
  // fait, prouvé à l'écran par la recette navigateur (#1690 lot 3, étape 5).
  it('`defsGlobaux()` ré-émet la rampe éditée (l’émetteur relit le dataset, sans rechargement)', () => {
    const neuf = '#123456';
    expect(defsGlobaux(), 'la rampe de test existait déjà').not.toContain(`stop-color="${neuf}"`);
    const avantEdition = defsGlobaux();
    setDataset('terrains', AVANT.map((t) => (t.id === 'herbe' ? { ...t, stops: { '0%': neuf, '100%': neuf } } : t)) as never);
    const apres = defsGlobaux();
    expect(apres, 'les `<defs>` ont été assemblés UNE fois au chargement').not.toBe(avantEdition);
    expect(apres).toContain(`<linearGradient id="g_herbe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${neuf}"/>`);
    // Les dégradés des AUTRES terrains et ceux du rig/FX traversent l'édition intacts.
    expect(apres).toContain(`<linearGradient id="g_bois"`);
    expect(apres).toContain(MISSING_GRADIENT);
  });

  it('une entrée AJOUTÉE est référençable aussitôt', () => {
    const neuf = { ...AVANT[0], id: 'terrain-neuf', label: 'Terrain neuf', walkable: true };
    setDataset('terrains', [...AVANT, neuf] as never);
    expect(terrainEntree('terrain-neuf')).toBeDefined();
    expect(terrainWalkable('terrain-neuf')).toBe(true);
  });
});

describe('terrains — dégradés SVG dérivés, jamais partagés', () => {
  it('l’id de dégradé se DÉRIVE de l’id du terrain : deux terrains n’en partagent aucun', () => {
    const ids = tousLesTerrains().map((t) => terrainGradientId(t.id));
    expect(new Set(ids).size, 'deux terrains au même dégradé').toBe(ids.length);
    expect(terrainGradient('herbe')).toBe('g_herbe');
    expect(terrainGradient('bois')).toBe('g_bois');
  });

  it('defsGlobaux() émet UN dégradé par terrain, avec SES arrêts — l’herbe garde ses couleurs', () => {
    for (const t of tousLesTerrains()) {
      expect(defsGlobaux(), t.id).toContain(`<linearGradient id="${terrainGradientId(t.id)}"`);
      for (const [off, color] of Object.entries(t.stops)) {
        expect(off, `${t.id}: offset`).toMatch(/^(?:100|[0-9]{1,2})%$/);
        expect(color, `${t.id}: couleur`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    const herbe = terrainEntree('herbe')!;
    const bois = terrainEntree('bois')!;
    expect(herbe.stops['0%']).not.toBe(bois.stops['0%']);
    expect(defsGlobaux()).toContain(`<linearGradient id="g_herbe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${herbe.stops['0%']}"/>`);
    expect(defsGlobaux()).toContain(`<linearGradient id="g_bois" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bois.stops['0%']}"/>`);
  });

  it('aucun terrain ne dérive vers le dégradé de REPLI VISIBLE (#877)', () => {
    expect(tousLesTerrains().map((t) => terrainGradientId(t.id))).not.toContain(MISSING_GRADIENT);
  });
});
