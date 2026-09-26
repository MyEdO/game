import { describe, expect, it } from 'vitest';
import { communes, vocabulaire } from './clesDePalette';
import type { PaletteDeclaree, PaletteDeCouchePortee } from './palette';
import type { PaletteDEspece } from '../../data/palette.types';

describe('clesDePalette — lignes communes', () => {
  it('`suit` vise une clé de la table : recoloriable ou commune', () => {
    const t = communes({ botte: { defaut: '#3a2614' }, semelle: { defaut: '#241608', suit: 'botte' }, aile: { suit: 'corps' } });
    expect(t.semelle.suit).toBe('botte');
    // @ts-expect-error `suit` hors de la table (faute de frappe)
    communes({ botte: { defaut: '#3a2614' }, semelle: { defaut: '#241608', suit: 'botet' } });
    // @ts-expect-error une clé commune ne peut pas être un Slot
    communes({ peau: { defaut: '#ffffff' } });
  });
});

describe('clesDePalette — vocabulaire', () => {
  it('une ligne de vocabulaire ne porte que ce qu’elle peint, sous une clé neuve', () => {
    expect(vocabulaire({ gouvernail: { peint: 'gouvernail' } }).gouvernail.peint).toBe('gouvernail');
    // @ts-expect-error une ligne de vocabulaire n'a pas de défaut
    vocabulaire({ gouvernail: { peint: 'gouvernail', defaut: '#6b4a2b' } });
    // @ts-expect-error une ligne de vocabulaire ne suit aucune clé
    vocabulaire({ gouvernail: { peint: 'gouvernail', suit: 'corps' } });
    // @ts-expect-error une clé de vocabulaire ne peut pas être un Slot
    vocabulaire({ cuir: { peint: 'cuir' } });
    // @ts-expect-error une clé de vocabulaire ne peut pas être une clé commune
    vocabulaire({ or: { peint: 'or' } });
  });
});

describe('palettes déclarées — types dérivés de la table', () => {
  it('une palette ne déclare que des gammes de la table', () => {
    const p: PaletteDeclaree = { coque: '#6b4a2b', coqueO: '#3a2614', peau: '#e2b48c' };
    // @ts-expect-error clé hors table
    const horsTable: PaletteDeclaree = { gouvernail: '#6b4a2b' };
    expect([p, horsTable]).toHaveLength(2);
  });

  it('une couche portée ne déclare aucune gamme de sorte porteur, suiveuses comprises', () => {
    const q: PaletteDeCouchePortee = { cuir: '#5a3f24', fourrure: '#8a7a5e' };
    // @ts-expect-error `peau` : clé porteur
    const peau: PaletteDeCouchePortee = { peau: '#e2b48c' };
    // @ts-expect-error `peauO` : rôle d'une clé porteur
    const peauO: PaletteDeCouchePortee = { peauO: '#8c4a28' };
    // @ts-expect-error `voilure` : suiveuse d'une clé porteur
    const voilure: PaletteDeCouchePortee = { voilure: '#5a4427' };
    const nonFraiche = { cuir: '#5a3f24', cheveuxH: '#7a6040' };
    // @ts-expect-error un objet non frais qui porte une gamme porteur est refusé aussi
    const deNonFraiche: PaletteDeCouchePortee = nonFraiche;
    expect([q, peau, peauO, voilure, deNonFraiche]).toHaveLength(5);
  });

  it('une palette d’espèce admet les gammes porteur, et elles seules', () => {
    const e: PaletteDEspece = { peau: '#e2b48c', peauO: '#8c4a28', cheveuxH: '#7a6040', yeux: '#5a3e28' };
    // @ts-expect-error `cuir` : hors des gammes porteur
    const cuir: PaletteDEspece = { cuir: '#5a3f24' };
    expect([e, cuir]).toHaveLength(2);
  });
});
