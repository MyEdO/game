import test from 'node:test';
import assert from 'node:assert/strict';
import { cheminsProseNommee } from './proseNommee.mjs';

const fichier = (text) => ({ rel: 'src/data/schemas/defs-scenes/fixture-prose.ts', text });

test('la déclaration sur un schéma nommé compte, les commentaires et chaînes ne comptent pas', () => {
  const chemins = cheminsProseNommee([fichier(`
    import { proseNommee } from '../grammaire/prose';
    const base = {};
    // proseNommee(z.strictObject({}), 'commentaire');
    /* proseNommee(z.strictObject({}), 'bloc'); */
    const texte = "proseNommee(z.strictObject({}), 'chaine')";
    const schema = proseNommee(base, 'massBattle.terrain');
  `)]);
  assert.deepEqual(chemins, ['massBattle.terrain']);
});

test('les imports renommés et les espaces de noms comptent ; leurs homonymes locaux ne comptent pas', () => {
  const chemins = cheminsProseNommee([fichier(`
    import { proseNommee as compose } from '../grammaire/prose';
    import * as grammaire from '../grammaire/prose';
    const base = {};
    compose(base, 'narratif.ouverture.pitch');
    grammaire.proseNommee(base, 'massBattle.terrain');
    function local(compose) { compose(base, 'homonyme'); }
    function proseNommee(schema, chemin) { return schema; }
    proseNommee(base, 'fonction-locale');
  `)]);
  assert.deepEqual(chemins, ['narratif.ouverture.pitch', 'massBattle.terrain']);
});

test('une chaîne optionnelle sans wrapper ne déclare aucune provenance de prose nommée', () => {
  assert.deepEqual(cheminsProseNommee([fichier(`
    const schema = { terrain: z.string().optional() };
  `)]), []);
});
