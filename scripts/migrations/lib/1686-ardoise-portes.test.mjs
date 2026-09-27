/**
 * MORSURE des PORTES de `2026-09-05-1686-ardoise-ids-composes.mjs` (#1686 lot 1).
 *
 * La migration DÉCLARE deux fail-fast qui précèdent toute écriture : un porteur de l'id nu hors
 * masse de toit / primitive de recette, et un cardinal qui s'écarte de celui mesuré au moment de
 * l'écriture. Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la
 * migration sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige à chaque fois la
 * sortie 1, un message NOMINATIF, et ZÉRO fichier touché (octet ET horodatage antidaté).
 *
 * Le TÉMOIN ouvre le banc : sur la copie FIDÈLE de l'arbre (déjà migré), la migration sort 0 sans
 * rien écrire — sans lui, les deux rouges ne prouveraient pas que le dépôt jetable est jouable.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ — un `.test.mjs` posé à côté des migrations y serait rejoué ou refusé.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { FORME_DATA, FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireArbre, rienTouche } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION = '2026-09-05-1686-ardoise-ids-composes.mjs';

/** Les documents de projet du dépôt, tels que la migration les découvre. */
const PROJETS = fs
  .readdirSync(path.join(RACINE, 'src/scenes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(RACINE, rel)));

const DATASETS = ['src/data/materials.json', 'src/data/props.json'];

/**
 * Dépôt jetable portant EXACTEMENT ce que la migration lit — les documents de l'arbre, sous leur
 * forme canonique. `mute` reçoit `{ docs }` (documents parsés, keyés par chemin relatif) et les
 * modifie en place avant la pose.
 */
function depotMute(mute) {
  const docs = Object.fromEntries([...DATASETS, ...PROJETS].map((rel) => [rel, JSON.parse(lireArbre(rel))]));
  mute(docs);
  return depot(
    Object.fromEntries(
      Object.entries(docs).map(([rel, doc]) => [rel, serialise(doc, DATASETS.includes(rel) ? FORME_DATA : FORME_PROJET)]),
    ),
  );
}

test('TÉMOIN : sur la copie fidèle de l’arbre (déjà migré), la migration sort 0 sans rien écrire', (t) => {
  const { racine, avant } = depotMute(() => {});
  t.after(() => efface(racine));
  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — le dépôt jetable n’est pas jouable : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /déjà migrée/, `le no-op ne se DIT pas : ${sortie.slice(0, 600)}`);
  assert.deepEqual(rienTouche(racine, avant), []);
});

test('PORTE 1 : un porteur `ardoise` HORS masse de toit / primitive → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  let pose = null;
  const { racine, avant } = depotMute((docs) => {
    for (const rel of PROJETS)
      for (const s of docs[rel].scenes ?? [])
        for (const b of s.architecture ?? [])
          for (const f of b.facades ?? [])
            for (const ft of f.features ?? []) {
              if (!pose) {
                ft.material = 'ardoise';
                pose = `${rel} ${b.id}/${f.id}/${ft.id}`;
              }
            }
  });
  t.after(() => efface(racine));
  assert.ok(pose, 'aucune ouverture de façade dans les documents de projet — la morsure ne mesure rien');

  const { code, sortie } = joue(racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un porteur hors périmètre doit ARRÊTER la migration : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /hors masse de toit/, `arrêt sans NOMMER la classe du porteur : ${sortie.slice(0, 600)}`);
  assert.match(sortie, /features/, `arrêt sans NOMMER le chemin du porteur : ${sortie.slice(0, 600)}`);
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
