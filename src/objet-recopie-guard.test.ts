/**
 * Garde du PRÉDICAT D'OBJET (#3117) et de la LECTURE AU CHEMIN (#4020) : une valeur objet, ni `null` ni tableau, se
 * teste par `estObjet`, et la valeur d'une donnée à un chemin se lit par `auChemin`, déclarés dans `src/lib/objet.mjs`,
 * le foyer. Hors du foyer, sur le périmètre des gardes (tests compris), aucune recopie du prédicat, en ligne ou sous une
 * déclaration renommée, ni de sa forme niée (`PREDICAT_D_OBJET`), ni de la lecture (`LECTURE_AU_CHEMIN`).
 *
 * Le lanceur du harnais joue un workflow JavaScript reconnu par sa forme dans une enveloppe autonome
 * (`scripts/guards/lib/jouer-workflow.mjs`). Les validations d’arguments de cette famille sont hors garde.
 * Le prédicat réparti sur plusieurs instructions et la lecture en boucle échappent au détecteur.
 * Un mod de `.claude/skills/` se copie seul pour sa vérification (`scripts/mods/verifier.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { constructionsReserveesDuCorpus, scanConstructionsReservees, LECTURE_AU_CHEMIN, PREDICAT_D_OBJET } from '../scripts/guards/lib/canonUnique.mjs';
import { corpusTypeScriptDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import { estDialecteDeWorkflow, lireWorkflow } from '../scripts/guards/lib/formeDeWorkflow.mjs';

const FOYER = 'src/lib/objet.mjs';

const PREDICAT = [{ ...PREDICAT_D_OBJET, foyer: FOYER }];

const LECTURE = [{ ...LECTURE_AU_CHEMIN, foyer: FOYER }];

/** La forme d'un workflow n'est jugée que dans les fichiers où le scan a trouvé une recopie. */
function recopiesDesModules(
  ...[corpus, constructions]: Parameters<typeof constructionsReserveesDuCorpus>
) {
  const textes = new Map(corpus.map(({ rel, text }) => [rel, text]));
  return constructionsReserveesDuCorpus(corpus, constructions).filter(({ rel }) => {
    if (!estDialecteDeWorkflow(rel)) return true;
    const { script, defauts } = lireWorkflow(textes.get(rel)!, rel);
    return !script || defauts.length > 0;
  });
}

/** Les constructions reconnues dans un texte, par défaut un module de `src/`. */
const fixture = (text: string, rel = 'src/noyau/fixture.ts') =>
  scanConstructionsReservees({ rel, text }, PREDICAT).map((t) => t.construction);
const VU = ['PREDICAT_D_OBJET'];

it('seul un workflow JavaScript reconnu par le harnais écarte une recopie', () => {
  const source = "const objet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);\n" +
    'const lire = (o, chemin) => chemin.reduce((v, pas) => v[pas], o);\n';
  const workflow = 'export const meta = {};\n' + source + "return agent('témoin');";
  const candidatTypeScript = 'export const meta = {}; declare global { function agent(): void; }\n' +
    "export const objet = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);\n" +
    'const lire = (o: Record<string, unknown>, chemin: string[]) => chemin.reduce((v, pas) => v[pas], o);\n' +
    'agent();';
  const fichiers = [
    { rel: 'scripts/enveloppe.js', text: workflow },
    { rel: 'scripts/enveloppe.mjs', text: workflow },
    { rel: 'scripts/enveloppe.cjs', text: workflow },
    { rel: 'scripts/incomplet.workflow.js', text: 'export const meta = {};\n' + source },
    { rel: 'scripts/module.workflow.js', text: source },
    { rel: 'src/lib/module.ts', text: candidatTypeScript },
  ];
  for (const constructions of [PREDICAT, LECTURE]) {
    expect(recopiesDesModules(fichiers, constructions).map(({ rel }) => rel))
      .toEqual(['scripts/incomplet.workflow.js', 'scripts/module.workflow.js', 'src/lib/module.ts']);
  }
});

describe('prédicat d’objet (#3117)', () => {
  it('aucune recopie du prédicat d’objet hors du foyer', () => {
    expect(recopiesDesModules(corpusTypeScriptDesGardes(), PREDICAT)).toEqual([]);
  });

  it('la déclaration recopiée, quel que soit son nom et l’ordre de ses opérandes', () => {
    expect(fixture("const estObjet = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);")).toEqual(VU);
    expect(fixture("const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);"), 'renommée').toEqual(VU);
    expect(fixture("function f(x) { return x != null && 'object' === typeof x && !Array.isArray(x); }"), 'commutée').toEqual(VU);
    expect(fixture("const ok = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);"), 'Boolean').toEqual(VU);
  });

  it('le prédicat en ligne, parmi d’autres opérandes, et sur une propriété', () => {
    expect(fixture("if (r && typeof r === 'object' && !Array.isArray(r) && typeof r.min === 'number') f();")).toEqual(VU);
    expect(fixture("const d = m.data != null && typeof m.data === 'object' && !Array.isArray(m.data) ? m.data : null;")).toEqual(VU);
    expect(fixture("const ok = a && (typeof a === 'object' && !Array.isArray(a));"), 'chaîne parenthésée').toEqual(VU);
  });

  it('la forme niée', () => {
    expect(fixture("if (!v || typeof v !== 'object' || Array.isArray(v)) return null;")).toEqual(VU);
    expect(fixture("if (Array.isArray(data) || data === null || typeof data !== 'object') throw e;")).toEqual(VU);
    expect(fixture("if (v == null || typeof v !== 'object' || Array.isArray(v) || !v.id) return;")).toEqual(VU);
  });

  it('un autre prédicat n’est pas une recopie', () => {
    expect(fixture("const c = (v) => v !== null && typeof v === 'object';"), 'objet ou tableau').toEqual([]);
    expect(fixture("const ok = typeof v === 'object' && !Array.isArray(v);"), 'sans test de présence').toEqual([]);
    expect(fixture("const ok = a && typeof b === 'object' && !Array.isArray(a);"), 'deux sujets').toEqual([]);
    expect(fixture("const ok = !v || typeof v !== 'object' && Array.isArray(v);"), 'opérateurs mêlés').toEqual([]);
    expect(fixture("import { estObjet } from '../lib/objet.mjs';\nconst ok = estObjet(v) && typeof v.id === 'string';")).toEqual([]);
  });

  it('le foyer, et un test hors du foyer', () => {
    expect(fixture("export const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)", FOYER)).toEqual([]);
    expect(fixture("const ok = v && typeof v === 'object' && !Array.isArray(v);", 'scripts/fixture.test.mjs')).toEqual(VU);
  });
});

describe('lecture au chemin (#4020)', () => {
  const lecture = (text: string, rel = 'src/noyau/fixture.ts') => scanConstructionsReservees({ rel, text }, LECTURE).map((t) => t.construction);
  const LU = ['LECTURE_AU_CHEMIN'];

  it('aucune recopie de la lecture au chemin hors du foyer', () => {
    expect(recopiesDesModules(corpusTypeScriptDesGardes(), LECTURE)).toEqual([]);
  });

  it('la lecture recopiée, quel que soit son nom, sa conversion et sa garde', () => {
    expect(lecture('const lire = (o, c) => c.reduce((v, p) => v[p], o);')).toEqual(LU);
    expect(lecture('const x = c.reduce((n, k) => n?.[k], doc);'), 'chaînage optionnel').toEqual(LU);
    expect(lecture('const x = c.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], doc);'), 'conversion').toEqual(LU);
    expect(lecture("const x = c.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), doc);"), 'gardée').toEqual(LU);
    expect(lecture('const x = c.reduce((o, k) => { return o[k]; }, doc);'), 'corps en bloc').toEqual(LU);
  });

  it('un autre reduce n’est pas une lecture au chemin', () => {
    expect(lecture('const n = c.reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {});'), 'compte').toEqual([]);
    expect(lecture('const t = c.reduce((a, b) => a + b, 0);'), 'somme').toEqual([]);
    expect(lecture('const x = c.reduce((v, p) => t[p], o);'), 'autre objet lu').toEqual([]);
    expect(lecture("import { auChemin } from '../lib/objet.mjs';\nconst x = auChemin(doc, c);")).toEqual([]);
  });

  it('le foyer, et un test hors du foyer', () => {
    expect(lecture("export const auChemin = (o, chemin) => chemin.reduce((v, pas) => (estObjet(v) || Array.isArray(v) ? v[pas] : undefined), o)", FOYER)).toEqual([]);
    expect(lecture('const x = c.reduce((v, p) => v[p], o);', 'scripts/fixture.test.mjs')).toEqual(LU);
  });
});
