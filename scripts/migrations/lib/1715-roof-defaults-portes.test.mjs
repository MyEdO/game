/**
 * MORSURE des PORTES de la migration #1715 — la TOITURE PAR DÉFAUT passe en DONNÉE.
 *
 *  - `2026-09-09-1715-roof-defaults-scenes.mjs` (racine `src/scenes`) : pose `roofDefaults` sur
 *    chaque Scène embarquée et porte le document à `schema` ≥ 9 (borne haute OUVERTE depuis #1687).
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté).
 *
 * L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture : il est
 * reconstruit par projection INVERSE des documents VIVANTS (`roofDefaults` retiré, `schema` rendu à
 * 8). Les cardinaux se LISENT sur les documents, jamais récités ici.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../guards/lib/lister.mjs';
import { FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireArbre, lireDans, rienTouche } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION = '2026-09-09-1715-roof-defaults-scenes.mjs';

/** Les projets de scène de l'arbre (listage par la primitive `listerDossier` — ordre total ; une
 *  entrée qui n'est pas un dossier de campagne ne porte aucun document et tombe au filtre). */
const PROJETS = listerDossier(path.join(RACINE, 'src/scenes'))
  .map((nom) => `src/scenes/${nom}/${nom}-projet.json`)
  .filter((rel) => fs.existsSync(path.join(RACINE, rel)));
assert.ok(PROJETS.length > 0, 'aucun projet de scène — la fixture ne mesure rien');

/** Cardinaux LUS sur les documents migrés — jamais récités. */
const SCENES_PAR_PROJET = Object.fromEntries(PROJETS.map((rel) => [rel, JSON.parse(lireArbre(rel)).scenes.length]));
for (const rel of PROJETS)
  assert.ok(
    JSON.parse(lireArbre(rel)).scenes.every((s) => s.roofDefaults),
    `${rel} : une Scène sans \`roofDefaults\` — l’arbre n’est pas migré`,
  );

/** Forme du document avant et après le bump porté par cette migration. La borne haute de cette
 *  migration est OUVERTE depuis #1687 : l'arbre porte un `schema` PLUS RÉCENT, que la migration
 *  traverse sans le rabaisser. */
const SCHEMA_AVANT = 8;
const SCHEMA_APRES = 9;
/** Le `schema` que l'arbre porte AUJOURD'HUI — lu, jamais récité. */
const SCHEMA_ARBRE = Object.fromEntries(PROJETS.map((rel) => [rel, JSON.parse(lireArbre(rel)).schema]));
for (const rel of PROJETS)
  assert.ok(SCHEMA_ARBRE[rel] >= SCHEMA_APRES, `${rel} : \`schema\` ${SCHEMA_ARBRE[rel]} < ${SCHEMA_APRES} — l’arbre n’est pas migré`);

/** PROJECTION INVERSE d'un projet : `roofDefaults` retiré de chaque Scène. Le `schema` de l'arbre est
 *  CONSERVÉ — c'est ce que la borne ouverte doit traverser sans rien rabaisser. */
function projetAvant(rel) {
  const doc = JSON.parse(lireArbre(rel));
  return { ...doc, scenes: doc.scenes.map(({ roofDefaults: _pose, ...reste }) => reste) };
}

const depotScenes = (fabrique) => depot(Object.fromEntries(PROJETS.map((rel) => [rel, fabrique(rel)])));

test('(a) ALLER-RETOUR : l’état d’avant projeté → chaque projet BYTE-IDENTIQUE à l’arbre', (t) => {
  const d = depotScenes((rel) => serialise(projetAvant(rel), FORME_PROJET));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(
      sortie.includes(`${rel} — schema ${SCHEMA_ARBRE[rel]} → ${SCHEMA_ARBRE[rel]}, roofDefaults posés : ${SCENES_PAR_PROJET[rel]}`),
      `${rel} : le bump ou la pose ne DIT pas son compte : ${sortie.slice(0, 1200)}`,
    );
    assert.equal(lireDans(d.racine, rel), lireArbre(rel), `${rel} produit ≠ arbre`);
  }
});

test('(b) REJEU sur arbre migré : sortie 0, rien d’écrit', (t) => {
  const d = depotScenes((rel) => lireArbre(rel));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /roofDefaults posés : 0/, `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) `roofDefaults` INCOMPLET (la couverture manquante) → sortie 1 NOMMANT le champ, rien d’écrit', (t) => {
  const d = depotScenes((rel) => {
    const doc = JSON.parse(lireArbre(rel));
    const scenes = doc.scenes.map((s, i) => {
      if (i > 0) return s;
      const { material: _absent, ...reste } = s.roofDefaults;
      return { ...s, roofDefaults: reste };
    });
    return serialise({ ...doc, scenes }, FORME_PROJET);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un \`roofDefaults\` incomplet doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /`roofDefaults` sans material/, `arrêt sans NOMMER le champ manquant : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(c bis) `roofDefaults` de TYPE inattendu (pente en chaîne) → sortie 1 NOMMANT le champ, rien d’écrit', (t) => {
  const d = depotScenes((rel) => {
    const doc = JSON.parse(lireArbre(rel));
    const scenes = doc.scenes.map((s, i) => (i > 0 ? s : { ...s, roofDefaults: { ...s.roofDefaults, pitchDeg: '45' } }));
    return serialise({ ...doc, scenes }, FORME_PROJET);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — une pente non numérique doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /`roofDefaults` sans pitchDeg/, `arrêt sans NOMMER le champ : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(d) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', (t) => {
  const d = depotScenes((rel) => `${JSON.stringify(projetAvant(rel), null, 4)}\n`);
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /FORME NON CANONIQUE/, `arrêt sans NOMMER la faute : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

test('(e) CARDINAL DÉPLACÉ (une Scène retirée) : le passage PASSE et pose ce qui RESTE (#1812)', (t) => {
  // Une Scène est une donnée ÉDITABLE : son nombre bouge à chaque lot de campagne. Ce que ce passage
  // possède, c'est le `roofDefaults` de CHAQUE Scène traversée — c'est cela que la porte mesure.
  const ampute = PROJETS[0];
  const restantes = SCENES_PAR_PROJET[ampute] - 1;
  const d = depotScenes((rel) => {
    const doc = projetAvant(rel);
    return serialise(rel === ampute ? { ...doc, scenes: doc.scenes.slice(1) } : doc, FORME_PROJET);
  });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — une Scène en moins n’est pas une anomalie : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${ampute} — schema`) && sortie.includes(`scènes : ${restantes}`),
    `le passage ne dit pas avoir traité les Scènes qui RESTENT : ${sortie.slice(0, 1200)}`,
  );
});

test('(f) `schema` FUTUR : la borne haute est OUVERTE depuis #1687 — le document TRAVERSE sans être rabaissé', (t) => {
  // Ce rôle de sentinelle appartient à la DERNIÈRE migration de la chaîne dans l'ordre lexical
  // (`DERNIERE`, dérivée par `src/scenes/migrations-format-projet.test.ts`) : elle seule
  // sait ce qui existe après elle. Ici, la porte mesurée est l'inverse — un `schema` plus récent ne
  // doit ni ARRÊTER, ni redescendre à 9.
  const futur = Math.max(...Object.values(SCHEMA_ARBRE)) + 1;
  const d = depotScenes((rel) => serialise({ ...projetAvant(rel), schema: futur }, FORME_PROJET));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  for (const rel of PROJETS) {
    assert.ok(sortie.includes(`${rel} — schema ${futur} → ${futur},`), `${rel} : le schema a été RABAISSÉ : ${sortie.slice(0, 1200)}`);
    assert.equal(JSON.parse(lireDans(d.racine, rel)).schema, futur, `${rel} : \`schema\` écrit ≠ ${futur}`);
  }
});

test('(f bis) `schema` ANTÉRIEUR à la chaîne → sortie 1 NOMMANT le numéro : la borne BASSE reste close', (t) => {
  const ancien = SCHEMA_AVANT - 1;
  const d = depotScenes((rel) => serialise({ ...projetAvant(rel), schema: ancien }, FORME_PROJET));
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 1, `sortie ${code} — un schema antérieur doit ARRÊTER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`\`schema\` inattendu ${ancien} (${SCHEMA_AVANT} ou ≥ ${SCHEMA_APRES} attendus)`),
    `arrêt sans NOMMER le numéro : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
});

/** Les champs que porte `Scene.roofDefaults` (`src/state/scene.ts` › `DEFAULT_ROOF_DEFAULTS`,
 *  `src/data/schemas/defs-scenes/scene.ts` › `sceneRoofDefaultsSchema`). */
const CHAMPS_TOITURE = ['material', 'pitchDeg', 'riseMaxStoreys'];

test('(g) PARITÉ au RÉEL : sur les projets LIVRÉS, chaque Scène porte `roofDefaults` complet, à la position d’`emptyScene`', () => {
  // Les tests (a)–(f) mesurent la migration sur un dépôt jetable ; celui-ci mesure L'ARBRE. La
  // POSITION est porteuse : une Scène écrite à la main (ou par un outil) place la clé où elle veut,
  // et le fichier cesse d'être byte-identique à ce que `emptyScene` produit (`state/scene.ts` —
  // `reliefDefaults`, `roofDefaults`, puis `layers`), donc à ce que la migration reposerait au rejeu.
  const fautes = [];
  for (const rel of PROJETS) {
    const scenes = JSON.parse(lireArbre(rel)).scenes;
    assert.ok(scenes.length > 0, `${rel} : aucune Scène — la parité ne mesure rien`);
    for (const s of scenes) {
      const k = Object.keys(s);
      const i = k.indexOf('roofDefaults');
      const l = k.indexOf('layers');
      if (i < 0) { fautes.push(`${rel} › ${s.id} : AUCUN \`roofDefaults\``); continue; }
      if (l < 0) { fautes.push(`${rel} › ${s.id} : AUCUN \`layers\``); continue; }
      if (i + 1 !== l) fautes.push(`${rel} › ${s.id} : \`roofDefaults\` en position ${i}, \`layers\` en ${l} — non ADJACENTS`);
      const manquants = CHAMPS_TOITURE.filter((c) => s.roofDefaults[c] === undefined);
      if (manquants.length) fautes.push(`${rel} › ${s.id} : \`roofDefaults\` sans ${manquants.join(', ')}`);
      const enTrop = Object.keys(s.roofDefaults).filter((c) => !CHAMPS_TOITURE.includes(c));
      if (enTrop.length) fautes.push(`${rel} › ${s.id} : \`roofDefaults\` porte ${enTrop.join(', ')} — hors vocabulaire`);
    }
  }
  assert.deepEqual(fautes, [], `Scène(s) divergente(s) de la forme d’arrivée :\n${fautes.join('\n')}`);
});
