/**
 * MORSURE des PORTES de `2026-09-05-1686-ardoise-ids-composes.mjs` (#1686 lot 1).
 *
 * La migration DÉCLARE deux fail-fast qui précèdent toute écriture : un porteur de l'id nu hors
 * masse de toit / primitive de recette, et un cardinal qui s'écarte de celui mesuré au moment de
 * l'écriture. Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la
 * migration sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige à chaque fois la
 * sortie 1, un message NOMINATIF, et ZÉRO fichier touché (octet ET horodatage antidaté).
 *
 * Le TÉMOIN ouvre le banc : sur les catalogues de l'arbre (déjà migrés), la migration sort 0 sans
 * rien écrire — sans lui, les deux rouges ne prouveraient pas que le dépôt jetable est jouable.
 * Le document de projet est le paquet de test du commun, posé là où la migration le cherche et dans
 * l'état qu'elle produit : la couverture en id nu (#2968 L12, #4936).
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ — un `.test.mjs` posé à côté des migrations y serait rejoué ou refusé.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FORME_DATA, FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireArbre, rienTouche } from './joue.mjs';
import { tableTotale } from '../../../src/lib/tableTotale.ts';

const MIGRATION = '2026-09-05-1686-ardoise-ids-composes.mjs';

/** Le paquet de test du commun, et l'emplacement où la migration découvre un document de projet. */
const PAQUET_DE_TEST = 'src/scenes/fixtures/paquet-de-test.json';
const PROJET = 'projets/paquet-de-test/paquet-de-test-projet.json';

const DATASETS = ['src/data/materials.json', 'src/data/props.json'];

/** La couverture `{ id }` de `porteur` rendue en id nu, l'état que la migration produit. */
const couvertureNue = (porteur) => (porteur?.material === undefined ? porteur : { ...porteur, material: porteur.material.id });

/** Le document de projet `doc`, chaque couverture (scène, intention de toiture d'un corps, masse) en id nu. */
const projetEnIdNu = (doc) => ({
  ...doc,
  scenes: (doc.scenes ?? []).map((s) => ({
    ...s,
    roofDefaults: couvertureNue(s.roofDefaults),
    ...(s.architecture ? { architecture: s.architecture.map((b) => ({ ...b, ...(b.roofDefaults ? { roofDefaults: couvertureNue(b.roofDefaults) } : {}), masses: b.masses.map(couvertureNue) })) } : {}),
  })),
});

/**
 * Dépôt jetable portant EXACTEMENT ce que la migration lit — les catalogues de l'arbre et le document
 * de projet, sous leur forme canonique, ce dernier à sa couverture en id nu. `mute` reçoit `{ docs }`
 * (documents parsés, keyés par chemin relatif) et les modifie en place avant la pose.
 */
function depotMute(mute) {
  const docs = {
    ...tableTotale(DATASETS, (rel) => JSON.parse(lireArbre(rel))),
    [PROJET]: projetEnIdNu(JSON.parse(lireArbre(PAQUET_DE_TEST))),
  };
  mute(docs);
  return depot(
    Object.fromEntries(
      Object.entries(docs).map(([rel, doc]) => [rel, serialise(doc, DATASETS.includes(rel) ? FORME_DATA : FORME_PROJET)]),
    ),
  );
}

test('TÉMOIN : sur les catalogues de l’arbre (déjà migrés) et le paquet de test, la migration sort 0 sans rien écrire', (t) => {
  const { racine, avant } = depotMute(() => {});
  t.after(() => efface(racine));
  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — le dépôt jetable n’est pas jouable : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 600)}`);
  assert.deepEqual(rienTouche(racine, avant), []);
});

test('PORTE 1 : un porteur `ardoise` HORS masse de toit / primitive → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const { racine, avant } = depotMute((docs) => {
    const scene = docs[PROJET].scenes[0];
    assert.ok(scene?.roofDefaults, 'aucune couverture de scène au paquet de test — la morsure ne mesure rien');
    scene.roofDefaults.material = 'ardoise';
  });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un porteur hors périmètre doit ARRÊTER la migration : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /hors masse de toit/, `arrêt sans NOMMER la classe du porteur : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /scenes\[0\]\.roofDefaults/, `arrêt sans NOMMER le chemin du porteur : ${sortie.slice(0, 600)}`);
  assert.deepEqual(rienTouche(racine, avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('PORTE 2 : une entrée revenue à l’id NU est RECOMPOSÉE — l’identité est la porte, pas un compte (#1812)', (t) => {
  const { racine } = depotMute((docs) => {
    const toit = docs['src/data/materials.json'].find((e) => e.id === 'toit-ardoise');
    assert.ok(toit, '`toit-ardoise` absent du catalogue de matières — la fixture ne mesure rien');
    toit.id = 'ardoise';
  });
  t.after(() => efface(racine));

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un id NU est la forme SOURCE, elle se migre : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /1 entrée ardoise→toit-ardoise/, `la recomposition ne se DIT pas : ${sortie.slice(0, 600)}`);
  const relu = JSON.parse(fs.readFileSync(path.join(racine, 'src/data/materials.json'), 'utf8'));
  assert.deepEqual(relu.filter((e) => e.id === 'ardoise'), [], 'un id NU survit à l’écriture');
});
