/** Migration #1675 — Flow d'amputation des Blessures critiques.
 * Entrées : src/data/criticals.json (écrite).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/schemas/serialize.ts';

const fichier = new URL('../../src/data/criticals.json', import.meta.url);
const tables = JSON.parse(readFileSync(fichier, 'utf8'));

const sequence = (...etapes) => ({ kind: 'sequence', etapes });
const effet = (...ops) => ({ kind: 'effet', effet: { type: 'ops', ops } });
const etat = (id) => ({ op: 'condition', id: { id }, value: 1 });
const auSeuil = (id, dr) => ({
  kind: 'si',
  condition: { kind: 'slThreshold', op: '<=', value: dr },
  alors: effet(etat(id)),
});
const resistance = (difficulty, echec, label) => ({
  kind: 'test',
  test: { skill: { id: 'resistance' }, difficulty, ...(label ? { label } : {}) },
  reussite: sequence(),
  echec,
});

// LDB 18 l.237.
const chocDeLaPlaie = sequence(effet(etat('a-terre')), auSeuil('sonne', -2), auSeuil('inconscient', -4));

function migrer(entree) {
  const { difficulty, sequels, unites, timing, loss } = entree.amputation;
  const amputer = { op: 'amputer', sequels, ...(unites == null ? {} : { unites }) };
  const plaie = resistance(difficulty, chocDeLaPlaie, (loss || entree.test) ? 'Plaie d’amputation' : undefined);
  // LDB 18 l.171 ; AA 07 l.171.
  if (timing === 'postEncounter') {
    return { flow: resistance(loss.difficulty, sequence(effet(amputer), plaie), 'Perte de l’orteil'), timing };
  }
  // LDB 18 l.180 ; AA 07 l.180.
  if (loss?.perDR) {
    const perte = effet(etat('a-terre'), { ...amputer, unitesPerSL: { every: 1, amount: 1, onFailure: true } });
    return { flow: resistance(difficulty, sequence(perte, plaie), 'Perte de l’orteil') };
  }
  return { flow: sequence(effet(amputer), plaie) };
}

let migrees = 0;
for (const table of tables) {
  for (const entree of table.entries) {
    if (!entree.amputation || Object.hasOwn(entree.amputation, 'flow')) continue;
    entree.amputation = migrer(entree);
    migrees += 1;
  }
}
if (migrees !== 0 && migrees !== 26) {
  throw new Error(`Migration #1675 : 26 amputations historiques attendues, ${migrees} trouvées.`);
}
if (migrees) writeFileSync(fichier, serializeDataset(tables));
console.log(`Migration #1675 : ${migrees} amputation(s) migrée(s).`);
