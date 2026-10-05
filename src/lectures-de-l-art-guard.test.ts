/**
 * Garde des LECTURES DE L'ART du rig hors de leur foyer (#1903) : les sept constructions de
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
    expect(vu('const re = /@([a-zA-Z]\\w*)/g;', MODULE)).toEqual([]);
  });

  it('REGEX_DE_JETON', () => {
    expect(vu('const re = /@([a-zA-Z]\\w*)/g;', 'src/gameIso/rig/x.test.ts')).toEqual(['REGEX_DE_JETON']);
    expect(vu('const re = new RegExp(`@${k}(?![A-Za-z0-9_])`);')).toEqual(['REGEX_DE_JETON']);
    expect(vu('const re = /@(?:peau|cuir)/;')).toEqual(['REGEX_DE_JETON']);
    expect(vu('const re = /@[^\\s]/;'), 'un @ suivi d’autre chose n’est pas un jeton').toEqual([]);
    expect(vu('// const re = /@([a-zA-Z]\\w*)/g;'), 'commentaire').toEqual([]);
    expect(vu('const re = /@([a-zA-Z]\\w*)/g;', 'src/gameIso/rig/palette.ts'), 'foyer').toEqual([]);
  });

  it('GAMME_EN_LIGNE', () => {
    expect(vu('const g = `${k}H`;', 'scripts/x.mts')).toEqual(['GAMME_EN_LIGNE']);
    expect(vu('const s = `<path fill="@${t}O" stroke="x"/>`;')).toEqual(['GAMME_EN_LIGNE']);
    expect(vu("const t = x ? 'O' : ''; const k = fam + t;")).toEqual(['GAMME_EN_LIGNE']);
    expect(vu("const k = fam + 'H';")).toEqual(['GAMME_EN_LIGNE']);
    expect(vu("const k = 'O' + 'H';")).toEqual([]);
    expect(vu("for (const s of ['', 'O', 'H']) f(s);")).toEqual(['GAMME_EN_LIGNE']);
    expect(vu('const re = /^(.+)(O|H)$/;')).toEqual(['GAMME_EN_LIGNE']);
    expect(vu("const g = [gammeDe(k, 'ombre'), gammeDe(k, 'lumiere')];")).toEqual(['GAMME_EN_LIGNE']);
    expect(vu('const g = ROLES_DE_GAMME.map((r) => gammeDe(k, r));')).toEqual([]);
    expect(vu('type G<K extends string> = `${K}O`;'), 'type littéral').toEqual([]);
    expect(vu('const d = `M${x}H${y}`;'), 'commande de chemin SVG').toEqual([]);
  });

  it('PROJECTION_DE_VUES', { timeout: 30_000 }, () => {
    const un = ['PROJECTION_DE_VUES'];
    expect(vu("const f = (a) => typeof a === 'string' ? a : a.front;")).toEqual(un);
    expect(vu("const f = (a) => typeof a === 'string' ? a : a.front;", 'src/gameIso/rig/parts/types.ts')).toEqual(un);
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
    expect(vu("const f = (a) => typeof a === 'string' ? a : a.front;", 'src/gameIso/rig/viewArt.ts'), 'foyer').toEqual([]);
  });

  it('PROJECTION_DE_VUES lit ses vues dans la table, jamais dans le prédicat', () => {
    const deux = { ...projectionDeVues(['front', 'back']), foyer: GARDE };
    const texte = 'const p = { front: a.front, back: a.back };';
    expect(vu(texte, 'src/fixture.ts', [deux])).toEqual(['PROJECTION_DE_VUES']);
    expect(vu(texte)).toEqual([]);
  });

  it('REGEX_DE_DEGRADE_DERIVE et REGEX_DE_DEGRADE_FIXE', () => {
    expect(vu('const re = /url\\(#dg-/;')).toEqual(['REGEX_DE_DEGRADE_DERIVE']);
    expect(vu("const re = new RegExp('url\\\\(#dg-');")).toEqual(['REGEX_DE_DEGRADE_DERIVE']);
    expect(vu('const re = /url\\(#g_\\w+\\)/;')).toEqual(['REGEX_DE_DEGRADE_FIXE']);
    expect(vu('const re = /g_steel/;'), 'sous-chaîne sans classe').toEqual([]);
  });

  it('CANON_VIEWS et CANON_ROLES_DE_GAMME', () => {
    expect(vu("const v = ['back', 'profile', 'front'];")).toEqual(['VIEWS']);
    expect(vu("let view: 'front' | 'back' | 'profile';")).toEqual(['VIEWS']);
    expect(vu('interface X { front: string; back: string; profile: string }')).toEqual(['VIEWS']);
    expect(vu("// const v = ['back', 'profile', 'front'];"), 'commentaire').toEqual([]);
    expect(vu("for (const r of ['ombre', 'lumiere']) f(r);")).toEqual(['ROLES_DE_GAMME']);
    expect(vu('type L = { ombre?: string; lumiere?: string };')).toEqual(['ROLES_DE_GAMME']);
  });
});
