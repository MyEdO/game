/**
 * MORSURE DU MODE CROISSANCE (#1812) — `node --test scripts/migrations/lib/croissance.test.mjs`.
 *
 * La garde de croissance (`npm run migrations:replay:croissance`) fabrique l'ÉVÉNEMENT que le ticket
 * interdit de faire payer : une entrée de plus dans un dataset app-owned. Deux pièces doivent mordre
 * pour qu'elle vaille quelque chose, et ce sont les deux que ce banc tient :
 *   1. la MUTATION des documents — le clone est une entrée de PLUS, d'identité PROPRE, et ce qui ne
 *      peut pas croître est laissé INTACT (racine non-tableau, dernière entrée sans `id`) ;
 *   2. la reconnaissance de la RÉFÉRENCE NUE — l'exemption d'un cardinal IMPOSÉ par le livre vit dans
 *      le REFUS que le code prononce, LIGNE PAR LIGNE ; un mot NU n'exempte rien, et un refus double
 *      dont une seule ligne porte sa réf laisse l'autre ROUGE.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SANS_CROISSANCE,
  SUFFIXE,
  croitre,
  croitreDocuments,
  lignesDeRefus,
  migrationsDatees,
  reconnaisseurDeRef,
  refusSansReference,
} from './croissance.mjs';
import { pagesDeLAtlas } from '../../raw/_lib.mjs';
import { efface } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

// --- 1. La mutation des documents ---------------------------------------------------------------

test('croitre : la dernière entrée est CLONÉE sous un id PROPRE, jamais un doublon', () => {
  const liste = [{ id: 'a', type: 'x' }, { id: 'b', type: 'x', desc: 'prose' }];
  const ajoute = croitre(liste);
  assert.equal(liste.length, 3, 'la liste n’a pas grandi d’EXACTEMENT une entrée');
  assert.equal(ajoute.id, `b${SUFFIXE}`);
  assert.deepEqual({ ...ajoute, id: 'b' }, liste[1], 'le clone ne porte pas la MÊME forme que son modèle');
  assert.equal(new Set(liste.map((e) => e.id)).size, 3, 'deux entrées partagent un id');
});

test('croitre : le clone est PROFOND — muter le clone ne touche pas son modèle', () => {
  const liste = [{ id: 'a', volume: { primitives: [{ kind: 'box' }] } }];
  const ajoute = croitre(liste);
  ajoute.volume.primitives[0].kind = 'cylinder';
  assert.equal(liste[0].volume.primitives[0].kind, 'box');
});

test('croitre : ce qui n’a pas d’entrée à cloner est LAISSÉ tel quel', () => {
  assert.equal(croitre({ seasons: [] }), null, 'une racine OBJET n’est pas une liste d’entrées');
  assert.equal(croitre([]), null, 'une liste vide n’a pas de modèle');
  assert.equal(croitre([{ label: 'sans id' }]), null, 'un clone sans identité propre serait un doublon');
  assert.equal(croitre([['a', 1]]), null, 'un tuple n’est pas une entrée');
});

test('croitreDocuments : les documents grandissent, le NON CANONIQUE reste INTACT', (t) => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'croissance-'));
  t.after(() => efface(racine));
  fs.mkdirSync(path.join(racine, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'src/scenes/arene'), { recursive: true });

  const canonique = [{ id: 'un', type: 't' }, { id: 'deux', type: 't' }];
  const brutNonCanonique = JSON.stringify([{ id: 'x' }], null, 4);
  fs.writeFileSync(path.join(racine, 'src/data/exemple.json'), JSON.stringify(canonique, null, 2), 'utf8');
  fs.writeFileSync(path.join(racine, 'src/data/reflow.json'), brutNonCanonique, 'utf8');
  fs.writeFileSync(path.join(racine, 'src/data/objet.json'), JSON.stringify({ a: 1 }, null, 2), 'utf8');
  const projet = { schema: 12, scenes: [{ id: 's1', entities: [] }] };
  fs.writeFileSync(path.join(racine, 'src/scenes/arene/arene-projet.json'), `${JSON.stringify(projet, null, 1)}\n`, 'utf8');

  const { faits, sautes } = croitreDocuments(racine);
  assert.deepEqual(faits, [`src/data/exemple.json → deux${SUFFIXE}`, `src/scenes/arene/arene-projet.json → s1${SUFFIXE}`]);
  assert.equal(
    fs.readFileSync(path.join(racine, 'src/data/reflow.json'), 'utf8'),
    brutNonCanonique,
    'un document non canonique a été REFLOWÉ — la croissance n’écrit pas ce qu’elle ne sait pas relire',
  );
  assert.ok(
    sautes.some((s) => s.startsWith('src/data/reflow.json')) && sautes.some((s) => s.startsWith('src/data/objet.json')),
    `ce qui n’a pas grandi doit se DIRE, sinon la garde est verte par le vide : ${sautes.join(' | ')}`,
  );
  const relu = JSON.parse(fs.readFileSync(path.join(racine, 'src/scenes/arene/arene-projet.json'), 'utf8'));
  assert.equal(relu.scenes.length, 2, 'le document de projet n’a pas reçu sa Scène de plus');
});

test('SANS_CROISSANCE : chaque document écarté NOMME la porte qui l’exige (`fichier:ligne`)', () => {
  const datees = new Set(migrationsDatees(path.join(RACINE, 'scripts/migrations')));
  for (const [rel, raison] of Object.entries(SANS_CROISSANCE)) {
    assert.ok(fs.existsSync(path.join(RACINE, rel)), `${rel} : document écarté qui n’existe plus — l’entrée doit partir`);
    const cite = /(\d{4}-\d{2}-\d{2}-[^\s:]+\.mjs):(\d+)$/.exec(raison);
    assert.ok(cite, `${rel} : la raison ne cite pas sa porte en \`fichier:ligne\` — ${raison}`);
    assert.ok(datees.has(cite[1]), `${rel} : ${cite[1]} n’est pas une migration datée du dossier`);
    const lignes = fs.readFileSync(path.join(RACINE, 'scripts/migrations', cite[1]), 'utf8').split('\n');
    assert.ok(lignes.length >= Number(cite[2]), `${rel} : ${cite[1]} n’a pas de ligne ${cite[2]}`);
  }
});

// --- 2. La référence nue ------------------------------------------------------------------------

const porteRef = reconnaisseurDeRef(RACINE);
/** Un topic RÉEL de l'Atlas, pris à la couture : un topic écrit ici figerait la partition du jour. */
const [UN_TOPIC] = pagesDeLAtlas(path.join(RACINE, 'docs/raw'), { classes: ['fiche'] })
  .map((p) => p.relatif.replace(/\.md$/, ''));

test('une RÉFÉRENCE NUE exempte : abréviation du catalogue + chapitre, ou topic de l’Atlas', () => {
  assert.ok(UN_TOPIC, 'la couture n’énumère aucune fiche — le cas serait vert à vide');
  assert.ok(porteRef(`cardinal 20 ≠ 19 attendu — registre CLOS, docs/raw/${UN_TOPIC}`));
  assert.ok(porteRef('9 document(s) / 180 rangée(s) — LDB 18 l.53'));
  assert.ok(porteRef('3 bande(s) ≠ 4 — MDG 13 l.684'));
  assert.ok(porteRef(`les 4 saisons — ${UN_TOPIC}#regles-de-deplacement`));
});

test('un mot NU n’exempte rien (« combat », « destin »… traînent dans toutes les proses)', () => {
  assert.equal(porteRef('le combat et le destin du personnage : 20 ≠ 19'), false);
  assert.equal(porteRef('cardinal 20 ≠ 19 attendu — périmètre mesuré changé'), false);
  assert.equal(porteRef('LDB sans chapitre'), false);
});

// --- 3. L'exemption est évaluée LIGNE PAR LIGNE -------------------------------------------------

test('refus DOUBLE dont une SEULE ligne porte une réf : l’autre est ROUGE, nommément', () => {
  // Le voisinage n'exempte pas : `1659-sub-lengthm-plage` passait ainsi sa table nominative de
  // sous-tirages grâce à la réf de la ligne CARDINAL d'à côté (mesuré, passe 3 du juge).
  const sortie = [
    'ARRÊT — 2 anomalie(s), AUCUNE écriture :',
    '  stars.json › [].sub : entrées du document ≠ entrées nommées',
    '  CARDINAL : 7 fourchette(s) au résultat, attendu 11 (ADE II 03 l.63)',
  ].join('\n');
  assert.deepEqual(refusSansReference(sortie, porteRef), ['stars.json › [].sub : entrées du document ≠ entrées nommées']);
});

test('chaque ligne de refus porte SA réf → aucune ROUGE ; l’en-tête générique ne compte pas', () => {
  const sortie = [
    'FIDÉLITÉ AU SOURCE ROMPUE — rien n’est écrit (2) :',
    '  advancementCosts.json : 16 bande(s) ≠ 15 — table CLOSE, LDB 07 l.56-70',
    '  weather.json : 5 saison(s) ≠ 4 — table CLOSE, EDOC 08 l.52-59',
  ].join('\n');
  assert.deepEqual(refusSansReference(sortie, porteRef), []);
});

test('la SUITE indentée d’un écart lui appartient, et la réf peut venir du SURPLOMB', () => {
  const avecSuite = ['ARRÊT :', '  stars.json › [].sub : entrées ≠ nommées — ADE II 03 l.63', '    vues   : a, b', '    nommées: a'].join('\n');
  assert.deepEqual(lignesDeRefus(avecSuite).map((b) => b.texte), [
    'stars.json › [].sub : entrées ≠ nommées — ADE II 03 l.63 vues   : a, b nommées: a',
  ]);
  const parSurplomb = ['Tableaux CLOS — LDB 18 l.53 :', '  criticals.json : 180 rangée(s) ≠ 160'].join('\n');
  assert.deepEqual(refusSansReference(parSurplomb, porteRef), []);
});

test('un refus SANS aucun écart listé : l’en-tête EST le refus, et il doit porter sa réf', () => {
  assert.deepEqual(refusSansReference('cardinal 9, attendu 8 — périmètre mesuré changé', porteRef), [
    'cardinal 9, attendu 8 — périmètre mesuré changé',
  ]);
  assert.deepEqual(refusSansReference('✗ oups.json — cardinal 9, attendu 8 — LDB 14 l.21-30', porteRef), []);
});

test('l’entrée FABRIQUÉE ne s’exempte pas elle-même (un id cloné porte `<topic>#<ancre>`)', () => {
  const sortie = `  topic « deplacement#option-attraper-froid${SUFFIXE} » : 0 champ(s) dans deplacement.md`;
  assert.equal(refusSansReference(sortie, porteRef).length, 1, 'le clone exempte le refus qu’il provoque');
});
