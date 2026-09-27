/**
 * MORSURE des PORTES de la migration #1882 — la FICHE d'un personnage se NOMME.
 *
 *  - `2026-09-23-1882-fiche-de-personnage-nommee.mjs` (racine `src/scenes`) : pose `ref` = le profil
 *    standard de l'espèce (`LDB 77 l.7`, `species.json › profilStandard`) en QUEUE de tout personnage
 *    sans `ref`/`statblock`/`presetId`, et porte le document au `schema` 13 au moins. Un personnage
 *    dont l'espèce n'a pas de profil standard se NOMME : « ARBITRAGE REQUIS », rien d'écrit. Sa borne
 *    haute est OUVERTE (`schema` ∈ {12, ≥ 13}) : un document plus récent traverse à l'octet, seule la
 *    DERNIÈRE de la chaîne (`src/scenes/migrations-format-projet.test.ts`) nomme un `schema` futur.
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté), y compris sur le projet SAIN posé à côté du projet fautif.
 *
 * FIXTURES FABRIQUÉES : deux campagnes jouets et un `species.json` jouet, jamais les fichiers livrés —
 * ce passage ne porte aucun cardinal d'identité (#1812), la forme suffit. Le profil ATTENDU est récité
 * ici, jamais importé du catalogue : un banc qui lirait sa donnée ne mesurerait que sa cohérence
 * avec elle-même.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-23-1882-fiche-de-personnage-nommee.mjs';

/** Forme d'entrée et CIBLE du bump porté par cette migration — borne haute OUVERTE. */
const SCHEMA_AVANT = 12;
const SCHEMA_APRES = 13;

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const BETA = 'src/scenes/beta/beta-projet.json';
const SPECIES = 'src/data/species.json';

/** Catalogue d'espèces JOUET : une espèce à profil standard, une sans. */
const especes = () => `${JSON.stringify([
  { id: 'humains-jouet', profilStandard: { id: 'humain' } },
  { id: 'gnomes-jouet' },
], null, 2)}\n`;

const STATBLOC = { type: 'statblock', label: 'Marin', char: { B: 12 } };

/** Campagne jouet PORTEUSE : un personnage sans fiche d'espèce à profil (la population), trois
 *  personnages qui portent déjà un porteur (ref MORTE comprise), un décor, un départ, une Scène sans
 *  `entities`, et des clés de document hors du passage. */
const alpha = (schema = SCHEMA_AVANT, sansFiche = { appearance: { species: 'humains-jouet' } }) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  label: 'Alpha',
  scenes: [
    {
      id: 'taverne',
      entities: [
        { id: 'aubergiste', kind: 'personnage', pos: { x: 1, y: 2 }, label: 'Aubergiste', ...sansFiche },
        { id: 'bandit', kind: 'personnage', ref: 'id-hors-registre', pos: { x: 0, y: 0 } },
        { id: 'marin', kind: 'personnage', pos: { x: 3, y: 3 }, statblock: STATBLOC },
        { id: 'baron', kind: 'personnage', pos: { x: 4, y: 4 }, presetId: 'baron' },
        { id: 'tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 5, y: 5 } },
        { id: 'start', kind: 'heroStart', pos: { x: 6, y: 6 } },
      ],
    },
    { id: 'vide' },
  ],
  narratif: { affaires: [] },
});

/** L'ÉTAT D'ARRIVÉE d'`alpha`, écrit à la main : `ref` en QUEUE du seul personnage sans fiche,
 *  `schema` à sa place, tout le reste identique. */
const alphaApres = (schema = SCHEMA_APRES) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  label: 'Alpha',
  scenes: [
    {
      id: 'taverne',
      entities: [
        { id: 'aubergiste', kind: 'personnage', pos: { x: 1, y: 2 }, label: 'Aubergiste', appearance: { species: 'humains-jouet' }, ref: 'humain' },
        { id: 'bandit', kind: 'personnage', ref: 'id-hors-registre', pos: { x: 0, y: 0 } },
        { id: 'marin', kind: 'personnage', pos: { x: 3, y: 3 }, statblock: STATBLOC },
        { id: 'baron', kind: 'personnage', pos: { x: 4, y: 4 }, presetId: 'baron' },
        { id: 'tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 5, y: 5 } },
        { id: 'start', kind: 'heroStart', pos: { x: 6, y: 6 } },
      ],
    },
    { id: 'vide' },
  ],
  narratif: { affaires: [] },
});

/** Campagne jouet SANS personnage sans fiche : le passage n'y fait que le bump. */
const beta = (schema = SCHEMA_AVANT) => ({
  type: 'projet',
  schema,
  id: 'beta',
  label: 'Beta',
  scenes: [{ id: 'cour', entities: [{ id: 'garde', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 } }] }],
});

test('(a) MIGRATION RÉELLE : le personnage sans fiche reçoit le profil standard de son espèce en QUEUE, le document passe à 13, le reste est intact', (t) => {
  const d = depot({ [SPECIES]: especes(), [ALPHA]: serialise(alpha(), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, ALPHA), serialise(alphaApres(), FORME_PROJET), `${ALPHA} produit ≠ état d’arrivée`);
  assert.equal(lireDans(d.racine, BETA), serialise(beta(SCHEMA_APRES), FORME_PROJET), `${BETA} : autre chose que le bump a changé`);
  assert.equal(lireDans(d.racine, SPECIES), especes(), 'le catalogue d’espèces est une ENTRÉE, jamais écrit');
  assert.ok(
    sortie.includes(`${ALPHA} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, personnages dont la fiche se NOMME désormais : 1 (scènes : 2) — fichier réécrit`),
    `${ALPHA} : le bump ou la pose ne DIT pas son compte : ${sortie.slice(0, 1200)}`,
  );
  assert.ok(
    sortie.includes(`${BETA} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, personnages dont la fiche se NOMME désormais : 0 (scènes : 1) — fichier réécrit`),
    `${BETA} : le bump seul ne se DIT pas : ${sortie.slice(0, 1200)}`,
  );
});

test('(b) IDEMPOTENT : rejouée sur l’état final, sortie 0 et rien d’écrit', (t) => {
  const d = depot({ [SPECIES]: especes(), [ALPHA]: serialise(alphaApres(), FORME_PROJET), [BETA]: serialise(beta(SCHEMA_APRES), FORME_PROJET) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  for (const rel of [ALPHA, BETA]) {
    const ligne = sortie.split('\n').find((l) => l.includes(`${rel} — `)) ?? '';
    assert.ok(
      ligne.includes(`schema ${SCHEMA_APRES} → ${SCHEMA_APRES}, personnages dont la fiche se NOMME désormais : 0`)
        && ligne.endsWith('fichier INCHANGÉ'),
      `${rel} : le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`,
    );
  }
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) SANS PROFIL STANDARD : espèce sans profil, id de rig, espèce absente → ARBITRAGE REQUIS nommant CHAQUE entité, rien d’écrit', () => {
  // espèce sans profil · id de rig · espèce absente
  for (const [sansFiche, espece] of [
    [{ appearance: { species: 'gnomes-jouet' } }, '"gnomes-jouet"'],
    [{ appearance: { species: 'rat-geant' } }, '"rat-geant"'],
    [{}, 'undefined'],
  ]) {
    refuse(
      MIGRATION,
      { [SPECIES]: especes(), [ALPHA]: serialise(alpha(SCHEMA_AVANT, sansFiche), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
      `${ALPHA} › taverne › aubergiste : personnage sans fiche, espèce ${espece} sans profil standard (LDB 77 l.7)`,
    );
  }
});

test('(d) BORNE HAUTE OUVERTE : un document déjà porté au-delà de 13 traverse à l’octet, jamais rabaissé', (t) => {
  const futur = SCHEMA_APRES + 1;
  const d = depot({ [SPECIES]: especes(), [ALPHA]: serialise(alphaApres(futur), FORME_PROJET), [BETA]: serialise(beta(futur), FORME_PROJET) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${ALPHA} — schema ${futur} → ${futur} — DÉJÀ MIGRÉ au-delà de ${SCHEMA_APRES}`),
    `le passage d'un schema futur ne se DIT pas : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'un schema futur a été réécrit ou rabaissé');
});

test('(e) BORNE BASSE : un `schema` antérieur à la chaîne est refusé et NOMMÉ, rien d’écrit', () => {
  const ancien = SCHEMA_AVANT - 1;
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), [ALPHA]: serialise(alpha(ancien), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`schema\` inattendu ${ancien} (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(f) FAIL-FAST `schema` ABSENT → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const { schema: _retire, ...sansSchema } = alpha();
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), [ALPHA]: serialise(sansSchema, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`schema\` inattendu undefined (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(g) FAIL-FAST `schema` NON NUMÉRIQUE (la chaîne "12") → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), [ALPHA]: serialise(alpha(String(SCHEMA_AVANT)), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`schema\` inattendu "${SCHEMA_AVANT}" (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(h) FAIL-FAST `scenes` NON-TABLEAU → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), [ALPHA]: serialise({ ...alpha(), scenes: { taverne: {} } }, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`scenes\` absent ou non-tableau`,
  );
});

test('(i) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' },
    'aucun projet de scène trouvé — périmètre déplacé',
  );
});

test('(j) FAIL-FAST PÉRIMÈTRE VIDE (aucune Scène embarquée) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), [ALPHA]: serialise({ ...alpha(), scenes: [] }, FORME_PROJET) },
    'aucune Scène embarquée — périmètre déplacé',
  );
});

test('(k) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [SPECIES]: especes(), [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n`, [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : FORME NON CANONIQUE`,
  );
});

test('(l) ENTRÉE DÉCLARÉE ABSENTE (`species.json`) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: serialise(alpha(), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    'src/data/species.json absent — entrée déclarée des profils standard',
  );
});
