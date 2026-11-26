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

/** Une sauvegarde de la version 2, le Jardin de Morr au palier `memorial`, deux tombes au registre. */
function versionDeux(memorial: number) {
  const { version: _v, batiments, tutoriel: _t, ...reste } = nouvellePartie(7);
  const tombe = { nom: 'Ulla', carriere: 'soldat', expeditions: 2, ou: 'Reikwald', jour: 3 };
  return { ...reste, version: 2, batiments: { ...batiments, memorial }, cimetiere: [tombe, tombe] };
}

describe('la sauvegarde de la version 2 passe à la version 4 sans le Jardin de Morr (#5032)', () => {
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
  });
});

describe('la sauvegarde de la version 3 passe à la version 4 (#5129)', () => {
  it('une partie déjà en cours se poursuit sans tutoriel', () => {
    const { tutoriel: _t, ...reste } = nouvellePartie(7);
    stockage({ ...reste, version: 3 });
    const e = charger()!;
    expect([e.version, e.tutoriel]).toEqual([4, null]);
    expect(e.roster.map((h) => h.c.id)).toEqual(reste.roster.map((h) => h.c.id));
  });
});
