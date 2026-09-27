import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lecturesDefZod } from './lectureDefZod.mjs';

const CHAMPS = ['shape', 'element', 'options', 'innerType', 'in', 'out'];

test('un `_zod.def` écrit à la main est une lecture, sous toutes ses graphies', () => {
  const texte = ['const a = n._zod.def;', 'const b = n?._zod?.def?.type;', 'const c = n._zod!.def!.entries;'].join('\n');
  assert.deepEqual(lecturesDefZod(texte, CHAMPS).map((t) => t.ligne), [1, 2, 3]);
});

test('un champ d’enfants lu sur un `def` ou un `defDe(…)` est une lecture ; un autre champ non', () => {
  const texte = ['if (def.shape) f();', 'x = defDe(n)?.options;', 'y = s.def!.element;', 'z = def.type;', 'w = def.checks;', 'v = definition.shape;'].join('\n');
  assert.deepEqual(lecturesDefZod(texte, CHAMPS).map((t) => t.ligne), [1, 2, 3]);
});

test('`_def` et `_zod[\'def\']` sont des accès à `def`', () => {
  const texte = ['a = x._def.shape;', "b = x._zod['def'].shape;", 'c = x._zod?.["def"];', "d = x._zod['type'];", 'e = mon_def_local;'].join('\n');
  assert.deepEqual(lecturesDefZod(texte, CHAMPS).map((t) => t.ligne), [1, 2, 3]);
});

test('un identifiant assigné depuis `defDe(` est un `def`, quel que soit son nom', () => {
  const texte = ['const nd = defDe(n);', 'if (nd?.shape) f();', 'let d: DefZod | undefined = defDe(m);', 'g(d!.options);', 'nd.type;', 'autre.shape;'].join('\n');
  assert.deepEqual(lecturesDefZod(texte, CHAMPS).map((t) => t.ligne), [2, 4]);
});

test('un `defDe(…)` aux parenthèses imbriquées, et une déstructuration de `defDe(…)`', () => {
  const texte = ['x = defDe(defDe(n)?.x)?.shape;', 'y = defDe(f(n, g(m))).element;', 'const { shape, type } = defDe(n);', 'const { type } = defDe(n);', 'z = defDe(n)?.type;'].join('\n');
  assert.deepEqual(lecturesDefZod(texte, CHAMPS).map((t) => t.ligne), [1, 2, 3]);
});

test('un commentaire ou une chaîne ne sont pas du code', () => {
  const texte = ['// on lit `_zod.def` ici', "const s = 'def.shape';", '/* def.options */'].join('\n');
  assert.deepEqual(lecturesDefZod(texte, CHAMPS), []);
});
