import { describe, it, expect, vi } from 'vitest';
import { careerClass, tenueForClass, tenueFor, tenuePaletteFor, wardrobeKeyResolves } from './career';
import { TENUE_BY_ID, TENUE_NUE } from './tenues';
import { viewOrFront } from './types';
import { careers } from '../../../data';

describe('careerClass — renvoie un id de CLASSE, par id de carrière EXACT (aucun libellé)', () => {
  it('lit la classe depuis careers.json (id → classe)', () => {
    expect(careerClass('soldat')).toBe('guerriers');
    expect(careerClass('sorcier')).toBe('lettres');
    expect(careerClass('agitateur')).toBe('citadins');
  });
  it('un LIBELLÉ (« Soldat ») n’est PAS un id → citadins (défaut neutre)', () => {
    expect(careerClass('Soldat')).toBe('citadins');
    expect(careerClass('Carrière imaginaire')).toBe('citadins');
  });
});

describe('tenueForClass — plus aucune tenue générique de classe : repli Nu (décision utilisateur 2026-07-21)', () => {
  it('une classe (sans def dédié) résout le corps Nu, jamais une tenue générique', () => {
    for (const c of ['guerriers', 'lettres', 'roublards', 'ruraux', 'citadins', 'courtisans', 'itinerants', 'riverains']) {
      expect(tenueForClass(c), c).toBe(TENUE_NUE);
    }
  });
});

describe('tenueFor — garde-robe id→id (aucun slugId au milieu)', () => {
  it('tenue EXPLICITE : un id de def de tenue résout sa tenue spécifique', () => {
    expect(tenueFor('noble')).toBe(TENUE_BY_ID.noble);
    expect(tenueFor('soldat')).toBe(TENUE_BY_ID.soldat);
  });
  it('id INCONNU (ni carrière ∪ classe ∪ tenue) → warn BRUYANT + corps Nu (#223)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tenueFor('carriere-imaginaire')).toBe(TENUE_NUE);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
  it('un LIBELLÉ (« Soldat ») ne résout PAS sa tenue → warn + corps Nu', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tenueFor('Soldat')).toBe(TENUE_NUE);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
  it('vues dos/profil E·7 branchées (tenue générée)', () => {
    const t = tenueFor('noble');
    const front = viewOrFront(t.torse, 'front');
    expect(front).toContain('<');
    expect(viewOrFront(t.torse, 'back')).not.toBe(front);
    expect(viewOrFront(t.torse, 'profile')).not.toBe(front);
  });
});

describe('tenueFor — carrière SANS archétype de classe réutilisant la tenue d’une autre (CareerData.tenue, MDG 09 « Côtier »)', () => {
  it('marin/naufrageur/nautonier (Côtier) résolvent la tenue de leur carrière de base', () => {
    expect(tenueFor('marin-cotier')).toBe(TENUE_BY_ID.marin);
    expect(tenueFor('naufrageur-cotier')).toBe(TENUE_BY_ID.naufrageur);
    expect(tenueFor('nautonier-cotier')).toBe(TENUE_BY_ID.nautonier);
  });
  it('tenuePaletteFor en miroir exact', () => {
    expect(tenuePaletteFor('marin-cotier')).toBe(tenuePaletteFor('marin'));
    expect(tenuePaletteFor('naufrageur-cotier')).toBe(tenuePaletteFor('naufrageur'));
    expect(tenuePaletteFor('nautonier-cotier')).toBe(tenuePaletteFor('nautonier'));
  });
  it('garde d’intégrité : toute `CareerData.tenue` référence une tenue connue (TENUE_BY_ID)', () => {
    const orphans = (careers as Array<{ id: string; tenue?: string }>)
      .filter((c) => c.tenue && !(c.tenue in TENUE_BY_ID))
      .map((c) => `${c.id} → ${c.tenue}`);
    expect(orphans, `tenue(s) orpheline(s) : ${orphans.join(', ')}`).toEqual([]);
  });
});

describe('tenueFor — un id de CLASSE (defs supprimés) retombe sur le corps Nu, jamais une tenue générique', () => {
  it('chaque classe de careers.json résout Nu en garde-robe (aucun archétype de classe)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const classId of new Set(careers.map((c) => c.class))) {
      expect(tenueFor(classId), classId).toBe(TENUE_NUE);
    }
    warn.mockRestore();
  });
});

describe('wardrobeKeyResolves — exact-id (carrière ∪ tenue ∪ nu ∪ vide)', () => {
  it('accepte les ids valides, refuse les libellés ET les ids de classe (plus de tenue de classe)', () => {
    expect(wardrobeKeyResolves('soldat')).toBe(true); // carrière (et tenue)
    expect(wardrobeKeyResolves('noble')).toBe(true); // tenue
    expect(wardrobeKeyResolves('nu')).toBe(true);
    expect(wardrobeKeyResolves('')).toBe(true);
    expect(wardrobeKeyResolves(undefined)).toBe(true);
    expect(wardrobeKeyResolves('guerriers')).toBe(false); // classe : plus une garde-robe résolvable → Nu
    expect(wardrobeKeyResolves('Soldat')).toBe(false);
    expect(wardrobeKeyResolves('carriere-imaginaire')).toBe(false);
  });
});
