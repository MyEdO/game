import { describe, it, expect } from 'vitest';
import { TENUE_NUE, TENUE_BY_ID } from './index';
import { TENUE_DEFS } from './_registry.generated';
import { viewOrFront } from '../types';
import { tenueFor, tenuePaletteFor } from '../career';
import { careers } from '../../../../data';

describe('registre des tenues (defs/ = source UNIQUE, data-driven)', () => {
  it('aucune tenue générique par CLASSE n’est chargée — seule « Nu » a du sens (décision utilisateur 2026-07-21)', () => {
    const classIds = new Set(careers.map((c) => c.class));
    const classDefs = TENUE_DEFS.filter((d) => classIds.has(d.id)).map((d) => d.id);
    expect(classDefs, `defs de classe encore présents : ${classDefs.join(', ')}`).toEqual([]);
  });

  it('toute carrière de careers.json résout une tenue SPÉCIFIQUE (def dédié ou tenue réutilisée) — jamais un repli silencieux', () => {
    const defSlugs = new Set(TENUE_DEFS.map((d) => d.id));
    const fautives = careers
      .filter((c) => {
        const parDef = c.id in TENUE_BY_ID;
        const parTenueReutilisee = !!c.tenue && c.tenue in TENUE_BY_ID;
        return !parDef && !parTenueReutilisee;
      })
      .map((c) => {
        if (c.tenue) return `${c.id} (classe ${c.class}) : champ tenue « ${c.tenue} » introuvable en defs/ (doit être l'id d'un def de tenue)`;
        if (defSlugs.has(c.id)) return `${c.id} (classe ${c.class}) : un def d'id « ${c.id} » existe hors TENUE_BY_ID — vérifier isClassDef/palette`;
        return `${c.id} (classe ${c.class}) : aucun def ni champ tenue authoré (id de tenue attendu « ${c.id} »)`;
      });
    expect(fautives).toEqual([]);
  });

  it("une tenue SPÉCIFIQUE déposée en defs/ est consommée par tenueFor (par ID) — un fichier, zéro merge", () => {
    expect(TENUE_BY_ID['guerrier-du-chaos']).toBeDefined();
    const t = tenueFor('guerrier-du-chaos');
    expect(viewOrFront(t.tete, 'profile')).toContain('@metal'); // heaume cornu, vue dédiée
    expect(tenuePaletteFor('guerrier-du-chaos').metal).toBe('#3a3a46'); // palette portée par le def
  });

  it('chaque def expose torse + jambes non vides', () => {
    for (const d of TENUE_DEFS) {
      expect(viewOrFront(d.set.torse, 'front'), d.label).toContain('<');
      expect(viewOrFront(d.set.jambes, 'front'), d.label).toContain('<');
    }
  });

  it('ne chausse pas = SOURCE UNIQUE (absence de `pied` dans le def) : Nu + Squelette (#736 Lot 1)', () => {
    expect(viewOrFront(TENUE_NUE.torse, 'front')).toContain('@peau'); // suit la palette d'espèce
    expect(TENUE_NUE.pied).toBeUndefined();
    expect(TENUE_BY_ID.squelette.pied).toBeUndefined();
  });

  it('tenueFor("nu") renvoie le corps nu', () => {
    expect(tenueFor('nu')).toBe(TENUE_NUE);
  });

  it("id inconnu / classe sans def de tenue → corps Nu (repli ultime — plus aucune tenue générique de classe)", () => {
    expect(tenueFor('carriere-imaginaire')).toBe(TENUE_NUE);
    // un id de CLASSE (defs supprimés) retombe sur Nu, jamais sur une tenue générique
    expect(tenueFor('citadins')).toBe(TENUE_NUE);
  });
});
