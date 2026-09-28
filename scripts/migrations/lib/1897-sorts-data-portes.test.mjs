/**
 * MORSURE des PORTES des deux migrations `src/data` de #1897 — la référence de sort d'une créature et
 * d'un dieu se DÉNUDE (`{ id }` → id nu) :
 *  - `2026-09-23-1897-sorts-de-creature-ids-nus.mjs` : `creatures.json › [].spells` ;
 *  - `2026-09-23-1897-sorts-des-dieux-ids-nus.mjs` : `gods.json › [].blessings`, `miracles`,
 *    `chaosSpells` (facultatif).
 *
 * Chaque migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario : migration
 * réelle, idempotence, porte de FORME (ni `{ id }` ni id nu), champ non-tableau, racine non-tableau,
 * formatage non canonique. Les rouges d'avant-écriture exigent sortie 1, message NOMINATIF et ZÉRO
 * fichier touché. FIXTURES FABRIQUÉES, état d'arrivée écrit à la main.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { crees, depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const CREATURES = '2026-09-23-1897-sorts-de-creature-ids-nus.mjs';
const DIEUX = '2026-09-23-1897-sorts-des-dieux-ids-nus.mjs';
const F_CREATURES = 'src/data/creatures.json';
const F_DIEUX = 'src/data/gods.json';

const creatures = () => [
  { id: 'sorciere', spells: [{ id: 'flechette' }, 'choc'] },
  { id: 'loup', spells: [] },
];
const creaturesApres = () => [
  { id: 'sorciere', spells: ['flechette', 'choc'] },
  { id: 'loup', spells: [] },
];
const dieux = () => [
  { id: 'sigmar', blessings: [{ id: 'benediction-de-bataille' }], miracles: ['marteau'] },
  { id: 'tzeentch', blessings: [], miracles: [], chaosSpells: [{ id: 'feu-bleu' }] },
];
const dieuxApres = () => [
  { id: 'sigmar', blessings: ['benediction-de-bataille'], miracles: ['marteau'] },
  { id: 'tzeentch', blessings: [], miracles: [], chaosSpells: ['feu-bleu'] },
];

const CAS = [
  {
    migration: CREATURES, fichier: F_CREATURES, avant: creatures, apres: creaturesApres, compte: '1 référence(s)',
    etranger: (d) => { d[0].spells = [{ id: 'flechette', rang: 2 }]; return d; },
    messageEtranger: 'sorciere spells[0] : {"id":"flechette","rang":2} — ni `{ id }` ni id nu',
    vide: (d) => { d[0].spells = [{ id: '' }]; return d; },
    messageVide: 'sorciere spells[0] : {"id":""} — ni `{ id }` ni id nu',
    nonTableau: (d) => { d[1].spells = 'choc'; return d; },
    messageNonTableau: 'loup : `spells` non-tableau',
  },
  {
    migration: DIEUX, fichier: F_DIEUX, avant: dieux, apres: dieuxApres, compte: '2 référence(s)',
    etranger: (d) => { d[0].miracles = [42]; return d; },
    messageEtranger: 'sigmar miracles[0] : 42 — ni `{ id }` ni id nu',
    vide: (d) => { d[1].chaosSpells = ['']; return d; },
    messageVide: 'tzeentch chaosSpells[0] : "" — ni `{ id }` ni id nu',
    nonTableau: (d) => { delete d[0].blessings; return d; },
    messageNonTableau: 'sigmar : `blessings` non-tableau',
  },
];

for (const c of CAS) {
  test(`${c.migration} (a) MIGRATION RÉELLE : chaque \`{ id }\` devient l'id nu À SA PLACE, le reste intact`, (t) => {
    const d = depot({ [c.fichier]: serialise(c.avant(), FORME_DATA) });
    t.after(() => efface(d.racine));
    const { code, sortie } = joue(d.racine, c.migration);
    assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
    assert.equal(lireDans(d.racine, c.fichier), serialise(c.apres(), FORME_DATA));
    assert.ok(sortie.includes(`${c.compte} de sort dénudée(s)`), `le compte ne se DIT pas : ${sortie.slice(0, 1200)}`);
  });

  test(`${c.migration} (b) IDEMPOTENCE : rejouée sur l'état d'arrivée, sortie 0 sans rien écrire`, (t) => {
    const d = depot({ [c.fichier]: serialise(c.apres(), FORME_DATA) });
    t.after(() => efface(d.racine));
    const { code, sortie } = joue(d.racine, c.migration);
    assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
    assert.ok(sortie.includes('no-op'), `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
    assert.deepEqual([...rienTouche(d.racine, d.avant), ...crees(d.racine, d.avant, 'src/data')], [], 'le rejeu a écrit');
  });

  test(`${c.migration} (c) PORTE DE FORME : un élément ni \`{ id }\` ni id nu est NOMMÉ, rien d'écrit`, () => {
    refuse(c.migration, { [c.fichier]: serialise(c.etranger(c.avant()), FORME_DATA) }, c.messageEtranger);
  });

  test(`${c.migration} (d) PORTE DE FORME : un id VIDE (nu ou enveloppé) est NOMMÉ, rien d'écrit`, () => {
    refuse(c.migration, { [c.fichier]: serialise(c.vide(c.avant()), FORME_DATA) }, c.messageVide);
  });

  test(`${c.migration} (e) FAIL-FAST champ NON-TABLEAU → sortie 1 NOMINATIVE, rien d'écrit`, () => {
    refuse(c.migration, { [c.fichier]: serialise(c.nonTableau(c.avant()), FORME_DATA) }, c.messageNonTableau);
  });

  test(`${c.migration} (f) FAIL-FAST racine NON-TABLEAU → sortie 1 NOMINATIVE, rien d'écrit`, () => {
    refuse(c.migration, { [c.fichier]: serialise({ entrees: c.avant() }, FORME_DATA) }, 'racine non-TABLEAU');
  });

  test(`${c.migration} (g) FORMATAGE non canonique (saut de ligne final) → sortie 1 NOMINATIVE, rien d'écrit`, () => {
    refuse(c.migration, { [c.fichier]: `${serialise(c.avant(), FORME_DATA)}\n` }, 'forme non canonique');
  });
}
