/**
 * MORSURE des PORTES de la migration #1691 `2026-09-07-1691-relief-en-donnee.mjs` (racine `src/data`) —
 * la matière de relief passe en DONNÉE : pose la matière des flancs des terrains à BLOC PLEIN, déclare
 * le plan vu du dessus.
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté).
 *
 * L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture : il est
 * reconstruit par projection INVERSE des documents VIVANTS (matière retirée, marqueur de plan
 * retiré). Les cardinaux se LISENT sur les documents,
 * jamais récités ici.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { depot, efface, joue, lireArbre, lireDans, rienTouche } from './joue.mjs';

const MIGRATION_DATA = '2026-09-07-1691-relief-en-donnee.mjs';
const TERRAINS = 'src/data/terrains.json';
const MATERIALS = 'src/data/materials.json';

const TEXTE_TERRAINS = lireArbre(TERRAINS);
const TEXTE_MATERIALS = lireArbre(MATERIALS);
const TERRAINS_DOC = JSON.parse(TEXTE_TERRAINS);
const MATERIALS_DOC = JSON.parse(TEXTE_MATERIALS);

/** Cardinaux LUS sur les documents migrés — jamais récités. */
const BLOCS = TERRAINS_DOC.filter((e) => e.solidHeightM !== undefined);
assert.ok(BLOCS.length > 0, 'aucun terrain à bloc plein — la fixture ne mesure rien');
assert.ok(BLOCS.every((e) => typeof e.matiere === 'string'), 'un bloc plein sans `matiere` : l’arbre n’est pas migré');
assert.equal(MATERIALS_DOC.filter((e) => e.vueDeDessus === true).length, 1, 'le plan vu du dessus n’est pas déclaré');

/** PROJECTION INVERSE de `terrains.json` : la matière des flancs retirée. */
const terrainsAvant = () => TERRAINS_DOC.map(({ matiere: _pose, ...reste }) => reste);
/** PROJECTION INVERSE de `materials.json` : marqueur de plan retiré. */
const materialsAvant = () => MATERIALS_DOC.map(({ vueDeDessus: _pose, ...reste }) => reste);

const depotData = (terrains, materials) =>
  ({ ...depot({ [TERRAINS]: terrains, [MATERIALS]: materials }), migration: MIGRATION_DATA });

test('(a) ALLER-RETOUR data : l’état d’avant projeté → terrains.json ET materials.json BYTE-IDENTIQUES à l’arbre', (t) => {
  const d = depotData(serialise(terrainsAvant(), FORME_DATA), serialise(materialsAvant(), FORME_DATA));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 800)}`);
  assert.ok(sortie.includes(`${BLOCS.length} terrain(s) à bloc plein reçoivent leur matière`), `la pose ne DIT pas son compte : ${sortie.slice(0, 800)}`);
  assert.ok(
    sortie.includes(`relief ${MATERIALS_DOC.filter((e) => e.domain === 'relief').length} intact`),
    `la migration ne DIT pas que le domaine relief est intact : ${sortie.slice(0, 800)}`,
  );
  assert.match(sortie, /plan vu du dessus déclaré/, `le marqueur de plan ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.equal(lireDans(d.racine, TERRAINS), TEXTE_TERRAINS, 'terrains.json produit ≠ arbre');
  assert.equal(lireDans(d.racine, MATERIALS), TEXTE_MATERIALS, 'materials.json produit ≠ arbre');
});

test('(b) REJEU data sur arbre migré : sortie 0, rien d’écrit', (t) => {
  const d = depotData(TEXTE_TERRAINS, TEXTE_MATERIALS);
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) BLOC PLEIN inconnu de la table des matières → sortie 1 NOMMANT le terrain, rien d’écrit', (t) => {
  // Le bloc est RENOMMÉ (cardinal du dataset intact) : c'est bien la table des matières de bloc que
  // la porte mesure, pas le compte d'entrées.
  const renomme = terrainsAvant().map((e) => (e.solidHeightM !== undefined ? { ...e, id: 'palissade' } : e));
  const d = depotData(serialise(renomme, FORME_DATA), serialise(materialsAvant(), FORME_DATA));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 1, `sortie ${code} — un bloc sans matière déclarée doit ARRÊTER : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /aucune matière déclarée pour le\(s\) bloc\(s\) palissade/, `arrêt sans NOMMER le terrain : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(c bis) `matiere` SANS bloc plein → sortie 1 NOMMANT le terrain, rien d’écrit', (t) => {
  const orphelin = terrainsAvant().map((e, i) => (i === 0 ? { ...e, matiere: 'terre' } : e));
  const d = depotData(serialise(orphelin, FORME_DATA), serialise(materialsAvant(), FORME_DATA));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 1, `sortie ${code} — une matière sans bloc doit ARRÊTER : ${sortie.slice(0, 800)}`);
  assert.ok(sortie.includes(TERRAINS_DOC[0].id), `arrêt sans NOMMER le terrain : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d) DEUX entrées `roof` sans couverture → sortie 1 : le plan ne se désigne plus par sa donnée', (t) => {
  // Une couverture EXISTANTE est dépouillée de son marqueur (cardinal du dataset intact) : deux
  // entrées `roof` deviennent candidates au rôle de plan, et plus rien ne les départage.
  assert.ok(MATERIALS_DOC.some((e) => e.domain === 'roof' && e.couverture === true), 'aucune couverture de toit — la fixture ne mesure rien');
  let depouillee = false;
  const deuxPlans = materialsAvant().map((e) => {
    if (depouillee || e.domain !== 'roof' || e.couverture !== true) return e;
    depouillee = true;
    const { couverture: _sans, ...reste } = e;
    return reste;
  });
  const d = depotData(serialise(terrainsAvant(), FORME_DATA), serialise(deuxPlans, FORME_DATA));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 1, `sortie ${code} — deux plans candidats doivent ARRÊTER : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /2 entrée\(s\) `roof` sans `couverture`/, `arrêt sans CHIFFRER l’écart : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(e) FORMATAGE data non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const d = depotData(JSON.stringify(terrainsAvant(), null, 4), serialise(materialsAvant(), FORME_DATA));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 1, `sortie ${code} : ${sortie.slice(0, 800)}`);
  assert.match(sortie, /formatage non canonique/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 800)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});
