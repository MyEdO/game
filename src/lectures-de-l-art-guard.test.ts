/**
 * Garde des LECTURES DE L'ART hors de leur foyer (#1903) : les trois constructions de
 * `LECTURES_DE_L_ART` (`scripts/guards/lib/lecturesDeLArt.ts`), jugées sur le périmètre des gardes.
 * Angles morts : `lecturesDeLArt.ts`.
 */
import { describe, it, expect } from 'vitest';
import { constructionsReserveesDuCorpus, scanConstructionsReservees } from '../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import { LECTURES_DE_L_ART, MODULE, GARDE, projectionDeVues } from '../scripts/guards/lib/lecturesDeLArt';

/** Les constructions reconnues dans un texte, sous le chemin `rel`. */
const vu = (text: string, rel = 'src/fixture.ts', constructions = LECTURES_DE_L_ART) =>
  scanConstructionsReservees({ rel, text }, constructions).map((t) => t.construction);

describe("lectures de l'art (#1903)", () => {
  it("aucune lecture de l'art hors de son foyer dans le périmètre des gardes", { timeout: 120_000 }, () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), LECTURES_DE_L_ART)).toEqual([]);
  });

  it('le module et sa garde sont dans le foyer de chaque construction', () => {
    for (const c of LECTURES_DE_L_ART) expect([c.foyer].flat(), c.nom).toEqual(expect.arrayContaining([MODULE, GARDE]));
    expect(vu("const v = ['back', 'profile', 'front'];", MODULE)).toEqual([]);
  });

  it('PROJECTION_DE_VUES', { timeout: 30_000 }, () => {
    const un = ['PROJECTION_DE_VUES'];
    expect(vu("const f = (a) => typeof a === 'string' ? a : a.front;")).toEqual(un);
    expect(vu("const f = (a) => typeof a === 'string' ? a : a.front;", 'src/gameIso/catalog/types.ts')).toEqual(un);
    expect(vu("const b = typeof a === 'object' ? a.back : undefined;")).toEqual(un);
    expect(vu("const f = (a) => typeof a === 'string' ? { front: a } : a;")).toEqual(un);
    expect(vu('const p = { front: a.front, back: a.back ?? a.front, profile: a.profile };')).toEqual(un);
    expect(vu("const p = { front: f('front'), back: f('back'), profile: f('profile') };")).toEqual(un);
    expect(vu('const p = { front: f(h.front, d?.front), back: f(h.back, d?.back), profile: f(h.profile, d?.profile) };')).toEqual(un);
    expect(vu('const p = { front: f(h.front), back: g(h.back), profile: f(h.profile) };'), 'deux callees').toEqual([]);
    expect(vu("out.push(f('front'), f('back'), f('profile'));")).toEqual(un);
    expect(vu("const l = [g('front'), g('profile'), g('back')];")).toEqual(un);
    expect(vu("function h() { f('front'); f('back'); f('profile'); }")).toEqual(un);
    expect(vu("const p = { profile: s('profile'), back: s('back') };")).toEqual([]);
    expect(vu("const l = [f('front'), f('back')];")).toEqual([]);
    expect(vu("const l = [f('front'), g('back'), f('profile')];"), 'deux callees').toEqual([]);
    expect(vu("const f = (a) => typeof a === 'string' ? a : a.front;", 'src/gameIso/catalog/viewArt.ts'), 'foyer').toEqual([]);
  });

  it('PROJECTION_DE_VUES lit ses vues dans la table, jamais dans le prédicat', () => {
    const deux = { ...projectionDeVues(['front', 'back']), foyer: GARDE };
    const texte = 'const p = { front: a.front, back: a.back };';
    expect(vu(texte, 'src/fixture.ts', [deux])).toEqual(['PROJECTION_DE_VUES']);
    expect(vu(texte)).toEqual([]);
  });

  it('REGEX_DE_DEGRADE_FIXE', () => {
    expect(vu('const re = /url\\(#g_\\w+\\)/;')).toEqual(['REGEX_DE_DEGRADE_FIXE']);
    expect(vu("const re = new RegExp('url\\\\(#g_[a-z]+\\\\)');")).toEqual(['REGEX_DE_DEGRADE_FIXE']);
    expect(vu('const re = /g_steel/;'), 'sous-chaîne sans classe').toEqual([]);
  });

  it('CANON_VIEWS', () => {
    expect(vu("const v = ['back', 'profile', 'front'];")).toEqual(['VIEWS']);
    expect(vu("let view: 'front' | 'back' | 'profile';")).toEqual(['VIEWS']);
    expect(vu('interface X { front: string; back: string; profile: string }')).toEqual(['VIEWS']);
    expect(vu("// const v = ['back', 'profile', 'front'];"), 'commentaire').toEqual([]);
    expect(vu("const v = ['back', 'profile', 'front'];", 'src/gameIso/facing.ts'), 'foyer').toEqual([]);
  });
});
