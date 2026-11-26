import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { poserLesReglesDuRoguelite } from '../noyau';
import { charger, nouvellePartie } from './index';

beforeAll(() => poserLesReglesDuRoguelite());
afterEach(() => { vi.unstubAllGlobals(); });

/** Le stockage du navigateur tenant la sauvegarde `brut`. */
function stockage(brut: unknown) {
  const m = new Map([['grisefosse-v1', JSON.stringify(brut)]]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } });
}

/** Une sauvegarde de la version 3, le Péage du pont au palier `peage`. */
function versionTrois(peage: number) {
  const { version: _v, batiments, ...reste } = nouvellePartie(7);
  return { ...reste, version: 3, batiments: { ...batiments, peage } };
}

/** Une sauvegarde de la version 2, le Jardin de Morr au palier `memorial`, deux tombes au registre. */
function versionDeux(memorial: number) {
  const { version: _v, batiments, ...reste } = versionTrois(0);
  const tombe = { nom: 'Ulla', carriere: 'soldat', expeditions: 2, ou: 'Reikwald', jour: 3 };
  return { ...reste, version: 2, batiments: { ...batiments, memorial }, cimetiere: [tombe, tombe] };
}

describe('la sauvegarde de la version 3 passe à la version 4 sans le Péage du pont (#5130)', () => {
  it.each([[0, 0, 0], [1, 90, 0], [2, 330, 1], [3, 810, 3]])('Péage au palier %i : %i CO et %i trophées rendus, bâtiment retiré', (palier, or, trophees) => {
    const v3 = versionTrois(palier);
    stockage(v3);
    const e = charger()!;
    expect(e.version).toBe(4);
    expect(e.or).toBe(v3.or + or);
    expect(e.trophees).toBe(v3.trophees + trophees);
    expect(Object.keys(e.batiments)).toEqual(Object.keys(nouvellePartie(7).batiments));
    expect(e.roster.map((h) => h.c.id)).toEqual(v3.roster.map((h) => h.c.id));
  });
});

describe('la sauvegarde de la version 2 passe par la version 3 sans le Jardin de Morr (#5032)', () => {
  it.each([[0, 0, 0], [1, 110, 0], [2, 410, 1]])('Jardin au palier %i : %i CO et %i trophée rendus, bâtiment et registre retirés', (palier, or, trophees) => {
    const v2 = versionDeux(palier);
    stockage(v2);
    const e = charger()!;
    expect(e.version).toBe(4);
    expect(e.or).toBe(v2.or + or);
    expect(e.trophees).toBe(v2.trophees + trophees);
    expect(Object.keys(e.batiments)).toEqual(Object.keys(nouvellePartie(7).batiments));
    expect(e).not.toHaveProperty('cimetiere');
    expect(e.roster.map((h) => h.c.id)).toEqual(v2.roster.map((h) => h.c.id));
  });

  it('une sauvegarde de la version 1 passe par les versions 2 et 3 jusqu’à la version 4', () => {
    const { jour, batiments: { forge: _f, ...batiments }, cimetiere, ...v2 } = versionDeux(1);
    stockage({ ...v2, version: 1, semaine: jour, batiments, cimetiere: cimetiere.map(({ jour: s, ...t }) => ({ ...t, semaine: s })), expedition: null });
    const e = charger()!;
    expect([e.version, e.jour, e.batiments.forge, e.or]).toEqual([4, jour, 0, v2.or + 110]);
    expect(e).not.toHaveProperty('cimetiere');
    expect(e.batiments).not.toHaveProperty('peage');
  });
});
