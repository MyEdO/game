/**
 * MORSURE des PORTES de `2026-09-24-1897-projet-sorts-fusionnes.mjs` (#1897) — un id de sort FUSIONNÉ
 * désigne, dans un document de projet, l'entrée qui l'a absorbé, et le document passe au `schema` 14.
 * Sa borne haute est OUVERTE (`schema` ∈ {13, ≥ 14}) : elle n'est plus la DERNIÈRE de la chaîne (#1473,
 * `2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs`), un `schema` futur la TRAVERSE sans rabaissement.
 *
 * La migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario, avec la primitive
 * qu'elle importe (`src/data/sortsFusionnes.ts`, COPIÉE de l'arbre) ; les rouges d'avant-écriture
 * exigent sortie 1, message NOMINATIF et ZÉRO fichier posé touché, projet SAIN posé à côté compris.
 *
 * FIXTURES FABRIQUÉES : deux campagnes jouets, jamais les projets livrés. L'état d'arrivée est écrit à la
 * main, jamais dérivé de la table de fusion.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-24-1897-projet-sorts-fusionnes.mjs';
const COPIES = ['src/data/sortsFusionnes.ts'];
const SCHEMA_AVANT = 13;
const SCHEMA_APRES = 14;

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const BETA = 'src/scenes/beta/beta-projet.json';

/** Campagne jouet PORTEUSE : un id fusionné à une place de sort de chaque forme, et `nuee` en trait. */
const alpha = (schema = SCHEMA_AVANT) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  scenes: [{
    id: 'quai',
    entities: [{ id: 'mage', statblock: { spells: ['alarme', 'alerte', 'flamme'], traits: [{ id: 'nuee' }] } }],
    triggers: [{ flow: { kind: 'do', effect: { type: 'castSpell', casterId: 'mage', spellId: 'projectile' } } }],
  }],
  narratif: { presetsPnj: [{ id: 'sorcier', profil: { spells: ['fatigue'] } }] },
});

/** L'ÉTAT D'ARRIVÉE d'`alpha`, écrit à la main. */
const alphaApres = (schema = SCHEMA_APRES) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  scenes: [{
    id: 'quai',
    entities: [{ id: 'mage', statblock: { spells: ['alerte', 'flamme-magique'], traits: [{ id: 'nuee' }] } }],
    triggers: [{ flow: { kind: 'do', effect: { type: 'castSpell', casterId: 'mage', spellId: 'carreau' } } }],
  }],
  narratif: { presetsPnj: [{ id: 'sorcier', profil: { spells: ['drain'] } }] },
});

/** Campagne jouet SANS sort fusionné : le passage n'y fait que le bump. */
const beta = (schema = SCHEMA_AVANT) => ({ type: 'projet', schema, id: 'beta', scenes: [{ id: 'cour' }], narratif: { presetsPnj: [] } });

const poses = (a, b = beta()) => ({ [ALPHA]: serialise(a, FORME_PROJET), [BETA]: serialise(b, FORME_PROJET) });

test('(a) MIGRATION RÉELLE : chaque id fusionné cite l’absorbante À SA PLACE, le document passe à 14, le reste est intact', (t) => {
  const d = depot(poses(alpha()), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, ALPHA), serialise(alphaApres(), FORME_PROJET), `${ALPHA} produit ≠ état d’arrivée`);
  assert.equal(lireDans(d.racine, BETA), serialise(beta(SCHEMA_APRES), FORME_PROJET), `${BETA} : autre chose que le bump a changé`);
});

test('(b) IDEMPOTENCE : rejouée sur l’état d’arrivée, la migration sort 0 sans rien écrire', (t) => {
  const d = depot(poses(alphaApres(), beta(SCHEMA_APRES)), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /fichier INCHANGÉ/, `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) BORNE HAUTE OUVERTE : un `schema` FUTUR traverse en NO-OP nommé — aucun RABAISSEMENT', (t) => {
  const futur = SCHEMA_APRES + 7;
  const d = depot(poses(alphaApres(futur), beta(futur)), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  for (const rel of [ALPHA, BETA]) {
    assert.ok(sortie.includes(`${rel} — schema ${futur} → ${futur}`), `${rel} : le no-op ne se DIT pas, ou le document est rabaissé : ${sortie.slice(0, 1200)}`);
  }
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le passage a écrit sur un document qu’il ne possède plus');
});

test('(d) BORNE BASSE : un `schema` antérieur est refusé et NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, poses(alpha(SCHEMA_AVANT - 1)), `${ALPHA} : \`schema\` inattendu ${SCHEMA_AVANT - 1} (${SCHEMA_AVANT} ou plus récent attendu)`, COPIES);
});

test('(e) FAIL-FAST `schema` ABSENT → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const { schema: _retire, ...sansSchema } = alpha();
  refuse(MIGRATION, poses(sansSchema), `${ALPHA} : \`schema\` inattendu undefined (${SCHEMA_AVANT} ou plus récent attendu)`, COPIES);
});

test('(f) FAIL-FAST `scenes` NON-TABLEAU → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, poses({ ...alpha(), scenes: { quai: {} } }), `${ALPHA} : \`scenes\` absent ou non-tableau`, COPIES);
});

test('(g) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' }, 'aucun projet de scène trouvé — périmètre déplacé', COPIES);
});

test('(h) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { ...poses(alpha()), [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n` }, `${ALPHA} : FORME NON CANONIQUE`, COPIES);
});
