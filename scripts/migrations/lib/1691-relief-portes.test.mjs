/**
 * MORSURE des PORTES des deux migrations #1691 — la matière de relief passe en DONNÉE.
 *
 *  - `2026-09-07-1691-relief-en-donnee.mjs` (racine `src/data`) : pose la matière des flancs des
 *    terrains à BLOC PLEIN, déclare le plan vu du dessus.
 *  - `2026-09-07-1691-relief-defaults-scenes.mjs` (racine `src/scenes`) : pose `reliefDefaults` sur
 *    chaque Scène embarquée.
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue les migrations
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté).
 *
 * L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture : il est
 * reconstruit par projection INVERSE des documents VIVANTS (matière retirée, marqueur de plan
 * retiré, `reliefDefaults` retiré). Les cardinaux se LISENT sur les documents,
 * jamais récités ici.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { FORME_DATA, FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireArbre, lireDans, rienTouche } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION_DATA = '2026-09-07-1691-relief-en-donnee.mjs';
const MIGRATION_SCENES = '2026-09-07-1691-relief-defaults-scenes.mjs';
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

// ── Volet `src/data` ────────────────────────────────────────────────────────────────────────────

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

// ── Volet `src/scenes` ──────────────────────────────────────────────────────────────────────────

/** Les projets de scène de l'arbre, avec leur texte. */
const PROJETS = fs
  .readdirSync(path.join(RACINE, 'src/scenes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(RACINE, rel)));
assert.ok(PROJETS.length > 0, 'aucun projet de scène — la fixture ne mesure rien');

const SCENES_PAR_PROJET = Object.fromEntries(PROJETS.map((rel) => [rel, JSON.parse(lireArbre(rel)).scenes.length]));
for (const rel of PROJETS)
  assert.ok(
    JSON.parse(lireArbre(rel)).scenes.every((s) => s.reliefDefaults),
    `${rel} : une Scène sans \`reliefDefaults\` — l’arbre n’est pas migré`,
  );

/** Forme du document avant et après le bump porté par la migration des scènes. La borne haute de
 *  cette migration est OUVERTE depuis #1715 : l'arbre porte un `schema` PLUS RÉCENT, que la
 *  migration traverse sans le rabaisser. */
const SCHEMA_AVANT = 7;
const SCHEMA_APRES = 8;
/** Le `schema` que l'arbre porte AUJOURD'HUI — lu, jamais récité. */
const SCHEMA_ARBRE = Object.fromEntries(PROJETS.map((rel) => [rel, JSON.parse(lireArbre(rel)).schema]));
for (const rel of PROJETS)
  assert.ok(SCHEMA_ARBRE[rel] >= SCHEMA_APRES, `${rel} : \`schema\` ${SCHEMA_ARBRE[rel]} < ${SCHEMA_APRES} — l’arbre n’est pas migré`);

/** PROJECTION INVERSE d'un projet : `reliefDefaults` retiré de chaque Scène. Le `schema` de l'arbre
 *  est CONSERVÉ — c'est ce que la borne ouverte doit traverser sans rien rabaisser. */
function projetAvant(rel) {
  const doc = JSON.parse(lireArbre(rel));
  return { ...doc, scenes: doc.scenes.map(({ reliefDefaults: _pose, ...reste }) => reste) };
}

const depotScenes = (fabrique) =>
  ({ ...depot(Object.fromEntries(PROJETS.map((rel) => [rel, fabrique(rel)]))), migration: MIGRATION_SCENES });

test('(f) ALLER-RETOUR scènes : l’état d’avant projeté → chaque projet BYTE-IDENTIQUE à l’arbre', (t) => {
  const d = depotScenes((rel) => serialise(projetAvant(rel), FORME_PROJET));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(
      sortie.includes(`${rel} — schema ${SCHEMA_ARBRE[rel]} → ${SCHEMA_ARBRE[rel]}, reliefDefaults posés : ${SCENES_PAR_PROJET[rel]}`),
      `${rel} : le bump ou la pose ne DIT pas son compte : ${sortie.slice(0, 1200)}`,
    );
    assert.equal(lireDans(d.racine, rel), lireArbre(rel), `${rel} produit ≠ arbre`);
  }
});

test('(g) REJEU scènes sur arbre migré : sortie 0, rien d’écrit', (t) => {
  const d = depotScenes((rel) => lireArbre(rel));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /reliefDefaults posés : 0/, `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(h) `reliefDefaults` INCOMPLET (une partie manquante) → sortie 1 NOMMANT la partie, rien d’écrit', (t) => {
  const d = depotScenes((rel) => {
    const doc = JSON.parse(lireArbre(rel));
    const scenes = doc.scenes.map((s, i) => {
      if (i > 0) return s;
      const { cliff: _absent, ...reste } = s.reliefDefaults;
      return { ...s, reliefDefaults: reste };
    });
    return serialise({ ...doc, scenes }, FORME_PROJET);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 1, `sortie ${code} — un \`reliefDefaults\` incomplet doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /`reliefDefaults` sans cliff/, `arrêt sans NOMMER la partie manquante : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(i) CARDINAL DÉPLACÉ (une Scène retirée) : le passage PASSE et pose ce qui RESTE (#1812)', (t) => {
  // Une Scène est une donnée ÉDITABLE : son nombre bouge à chaque lot de campagne. Ce que ce passage
  // possède, c'est le `reliefDefaults` de CHAQUE Scène traversée — c'est cela que la porte mesure.
  const ampute = PROJETS[0];
  const restantes = SCENES_PAR_PROJET[ampute] - 1;
  const d = depotScenes((rel) => {
    const doc = projetAvant(rel);
    return serialise(rel === ampute ? { ...doc, scenes: doc.scenes.slice(1) } : doc, FORME_PROJET);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 0, `sortie ${code} — une Scène en moins n’est pas une anomalie : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${ampute} — schema`) && sortie.includes(`reliefDefaults posés : ${restantes} (déjà migrées : 0, scènes : ${restantes})`),
    `le passage ne dit pas avoir traité les Scènes qui RESTENT : ${sortie.slice(0, 1200)}`,
  );
});

test('(j) `schema` FUTUR : la borne haute est OUVERTE depuis #1715 — le document TRAVERSE sans être rabaissé', (t) => {
  // Ce rôle de sentinelle appartient à la DERNIÈRE migration de la chaîne dans l'ordre lexical
  // (`DERNIERE`, dérivée par `src/scenes/migrations-format-projet.test.ts`) : elle
  // seule sait ce qui existe après elle. Ici, la porte mesurée est l'inverse — un `schema` plus
  // récent ne doit ni ARRÊTER, ni redescendre à 8.
  const futur = Math.max(...Object.values(SCHEMA_ARBRE)) + 1;
  const d = depotScenes((rel) => serialise({ ...projetAvant(rel), schema: futur }, FORME_PROJET));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(sortie.includes(`${rel} — schema ${futur} → ${futur},`), `${rel} : le schema a été RABAISSÉ : ${sortie.slice(0, 1200)}`);
    assert.equal(JSON.parse(lireDans(d.racine, rel)).schema, futur, `${rel} : \`schema\` écrit ≠ ${futur}`);
  }
});

test('(j bis) `schema` ANTÉRIEUR à la chaîne → sortie 1 NOMMANT le numéro : la borne BASSE reste close', (t) => {
  const ancien = SCHEMA_AVANT - 1;
  const d = depotScenes((rel) => serialise({ ...projetAvant(rel), schema: ancien }, FORME_PROJET));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, d.migration);
  assert.equal(code, 1, `sortie ${code} — un schema antérieur doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`\`schema\` inattendu ${ancien} (${SCHEMA_AVANT} ou ≥ ${SCHEMA_APRES} attendus)`),
    `arrêt sans NOMMER le numéro : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

/** Les parties de relief que porte `Scene.reliefDefaults` (`src/state/scene.ts` ›
 *  `DEFAULT_RELIEF_DEFAULTS`, `src/data/schemas/defs-scenes/scene.ts` › `reliefDefaultsSchema`). */
const PARTS_RELIEF = ['cliff', 'ramp', 'deck', 'pilier'];

test('(k) PARITÉ au RÉEL : sur les projets LIVRÉS, chaque Scène porte `reliefDefaults` complet, à la position d’`emptyScene`', () => {
  // Les tests (f)–(j) mesurent la migration sur un dépôt jetable ; celui-ci mesure L'ARBRE. La
  // POSITION est porteuse : une Scène écrite à la main (ou par un outil) place la clé où elle veut,
  // et le fichier cesse d'être byte-identique à ce que `emptyScene` produit (`state/scene.ts` —
  // `reliefDefaults`, puis `roofDefaults` depuis #1715), donc à ce que la migration reposerait au rejeu.
  const fautes = [];
  for (const rel of PROJETS) {
    const scenes = JSON.parse(lireArbre(rel)).scenes;
    assert.ok(scenes.length > 0, `${rel} : aucune Scène — la parité ne mesure rien`);
    for (const s of scenes) {
      const k = Object.keys(s);
      const i = k.indexOf('reliefDefaults');
      const l = k.indexOf('roofDefaults');
      if (i < 0) { fautes.push(`${rel} › ${s.id} : AUCUN \`reliefDefaults\``); continue; }
      if (l < 0) { fautes.push(`${rel} › ${s.id} : AUCUN \`roofDefaults\``); continue; }
      if (i + 1 !== l) fautes.push(`${rel} › ${s.id} : \`reliefDefaults\` en position ${i}, \`roofDefaults\` en ${l} — non ADJACENTS`);
      const manquantes = PARTS_RELIEF.filter((p) => typeof s.reliefDefaults[p] !== 'string');
      if (manquantes.length) fautes.push(`${rel} › ${s.id} : \`reliefDefaults\` sans ${manquantes.join(', ')}`);
      const enTrop = Object.keys(s.reliefDefaults).filter((p) => !PARTS_RELIEF.includes(p));
      if (enTrop.length) fautes.push(`${rel} › ${s.id} : \`reliefDefaults\` porte ${enTrop.join(', ')} — hors vocabulaire`);
    }
  }
  assert.deepEqual(fautes, [], `Scène(s) divergente(s) de la forme d’arrivée :\n${fautes.join('\n')}`);
});
