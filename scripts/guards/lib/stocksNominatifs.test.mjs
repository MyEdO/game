import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { entreesNominatives, croissanceDesStocks, bilanDesStocks, croissanceDesCles, croissancesNonCouvertes, raisonDeRefus } from './stocksNominatifs.mjs';
import { refusDeLaPlage } from './plageStock.mjs';

const PORTEUR = 'scripts/guards/lib/temoin.mjs';
const compter = (source, chemin = PORTEUR) => entreesNominatives(source, chemin).length;
test('les mêmes formes sont classées par structure dans chaque dialecte et hors test', () => {
  for (const chemin of [PORTEUR, 'scripts/outils.test.mjs', 'src/fixture.test.ts']) {
    assert.equal(compter("readCorpus({ racines: ['src/ui'] })", chemin), 0);
    assert.equal(compter("const chemin = ['docs', 'vivant.md'].join('/')", chemin), 0);
    assert.equal(compter("const stock = Object.freeze(['src/a.ts'])", chemin), 1);
    assert.equal(compter("test('fixture', () => { const fichiers = ['src/a.ts'] })", chemin), 0);
  }
});
test('un foyer est canonique et une déclaration attendue supplémentaire reste une croissance', () => {
  assert.equal(compter("const registre = { foyer: 'src/a.ts' }"), 0);
  assert.equal(compter("const ATTENDU = ['src/a.ts']"), 1);
});
test('un constructeur de collection garde les racines de son stock', () => {
  assert.equal(compter("const stock = new Set(['src/ui'])"), 1);
  assert.equal(compter("const stock = new Map([['src/ui', 1]])"), 1);
  assert.equal(compter("readCorpus({ options: { fichiers: ['src/a.ts'] } })"), 1);
});
test('les racines sous options sont des paramètres, même avec enveloppes transparentes', () => {
  for (const source of [
    "readCorpus({ racines: ['src/data'] })",
    "readCorpus(({ options: { racines: ['src/data'] } }))",
    "readCorpus({ racines: (['src/data'] as const) })",
  ]) assert.equal(compter(source), 0, source);
});
test('les chemins scalaires join et le descripteur de corpus réel ne sont pas des stocks', () => {
  for (const source of [
    "const chemin = ['docs', 'vivant.md'].join('/')",
    "const chemin = ['docs', nom].join('\\\\')",
    "const RACINE = Object.freeze({ dossier: 'fixtures', suffixe: '-projet.json', recursif: true });",
    "const RACINE = Object.freeze({ dossier: 'src/scenes', suffixe: '-projet.json', recursif: true });",
  ]) assert.equal(compter(source), 0, source);
});
test('un fichier nominatif reste vu sous options et les sept façades', () => {
  for (const source of [
    "readCorpus({ racines: ['src/data'], fichiers: ['src/a.ts'] })",
    "defineStock(['src/a.ts'])", "registre(['src/a.ts'])", "Array.from(['src/a.ts'])",
    "[].concat(['src/a.ts'])", "identite(['src/a.ts'])", "Object.freeze(registre(['src/a.ts']))",
    "table({ 'src/a.ts': 1 })",
    "Object.freeze({ dossier: 'fixtures', suffixe: '-projet.json', recursif: true, fichier: 'src/a.ts' })",
    "const stock = ['src/a.ts', { fichier: 'src/b.ts' }].join('/')",
    "const stock = ['src/a.ts', ...autres].join('/')",
    "const stock = ['src/a.ts'].join('-')",
    "const RACINE = { dossier: 'src/a.ts', suffixe: '-projet.json', recursif: true }",
    "const RACINE = { dossier: 'src/scenes', suffixe: '-projet.json', recursif: choix }",
    "const RACINE = { dossier: 'src/scenes', suffixe: '-projet.json', recursif: true, ...autres }",
  ]) assert.ok(compter(source) > 0, source);
});

test('fixture dépôt : la clé littérale originale #1699 est un fichier jetable', () => {
  const source = "import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs';\n" +
    "const fixture = () => instanceDeDepot({ fichiers: { 'scripts/raw/empty-folios-baseline.json': STOCK } });";
  assert.equal(compter(source, 'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs'), 0);
});
test('fixture dépôt : les imports alias et namespace canoniques sont reconnus', () => {
  for (const [entete, appel] of [
    ["import { instanceDeDepot as depot } from '../../guards/lib/depotGabarit.mjs';", 'depot'],
    ["import * as banc from '../../guards/lib/depotGabarit.mjs';", 'banc.instanceDeDepot'],
    ["import { gabaritDeDepot as depot } from '../../guards/lib/depotGabarit.mjs';", 'depot'],
  ]) {
    assert.equal(compter(entete + "\nconst fixture = () => " + appel + "({ fichiers: { 'src/a.ts': SOURCE } });",
      'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs'), 0);
    assert.equal(compter(entete + "\nconst fixtures = [" + appel + "({ fichiers: { 'src/a.ts': SOURCE } })];",
      'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs'), 0);
  }
});
test('fixture dépôt : les vrais stocks voisins et les fausses fabriques restent comptés', () => {
  const entete = "import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs';\n";
  const suite = 'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs';
  for (const [source, chemin, attendu] of [
    [entete + "const fixture = () => instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } });", 'scripts/guards/lib/production.mjs', 1],
    ["function instanceDeDepot() {}\nconst fixture = () => instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } });", suite, 1],
    ["import { instanceDeDepot } from './autre.mjs';\nconst fixture = () => instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } });", suite, 1],
    [entete + "function f(instanceDeDepot) { return instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } }); }", suite, 1],
    ["import { instanceDeDepot as depot } from '../../guards/lib/depotGabarit.mjs';\nfunction f(depot) { return depot({ fichiers: { 'src/a.ts': SOURCE } }); }", suite, 1],
    ["import * as banc from '../../guards/lib/depotGabarit.mjs';\nfunction f(banc) { return banc.instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } }); }", suite, 1],
    [entete + "const fixture = () => instanceDeDepot({}, { fichiers: { 'src/a.ts': SOURCE } });", suite, 1],
    [entete + "const fixture = () => instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE },\n exceptions: ['src/b.ts'] });", suite, 1],
    [entete + "const STOCK = { 'src/a.ts': SOURCE };\nconst fixture = () => instanceDeDepot({ fichiers: STOCK });", suite, 1],
    ["import type { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs';\nconst fixture = () => instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } });",
      'scripts/migrations/lib/fixture.test.ts', 1],
    ["import { type instanceDeDepot as depot } from '../../guards/lib/depotGabarit.mjs';\nconst fixture = () => depot({ fichiers: { 'src/a.ts': SOURCE } });",
      'scripts/migrations/lib/fixture.test.ts', 1],
    ["import type * as banc from '../../guards/lib/depotGabarit.mjs';\nconst fixture = () => banc.instanceDeDepot({ fichiers: { 'src/a.ts': SOURCE } });",
      'scripts/migrations/lib/fixture.test.ts', 1],
  ]) assert.equal(compter(source, chemin), attendu, source);
});
test('occurrences originales : options de scan et trois chemins porteSpawn restent scalaires', () => {
  assert.equal(compter("reparerAdresses({ racines: ['src/data'] });", 'src/data/source/reparer-adresses.test.ts'), 0);
  for (const fragments of [
    "[docs, 'architecture.md']", "[docs, 'raw', 'talents.md']", "[docs, 'plans', 'plan-fictif.md']",
  ]) assert.equal(compter("const docs = 'docs';\nconst chemin = " + fragments + ".join('/');", 'scripts/guards/lib/porteSpawn.test.mjs'), 0);
});
const ancien = 'src/state/projet-migration-12-vers-13.test.ts';
const nouveau = 'src/data/schemas/defs-scenes/personnage-fiche-schema.test.ts';
const titres = [
  'au SCHÉMA : chaque porteur SEUL suffit, l’absence de tous est l’issue nommée au chemin `ref`',
  'au SCHÉMA : une réf VIDE est une absence, une réf MORTE est refusée en la nommant (#1882)',
  'au SCHÉMA : la famille est CELLE du spawn — un équipement sans affut, un véhicule sans coque sont refusés au PARSE (#1882)',
];
const sourceStock = (fichier, valeurs = titres, extra = '') => 'const SANS_FICHE_PROUVES = [\n' +
  valeurs.map(it => '  { fichier: ' + JSON.stringify(fichier) + ', it: ' + JSON.stringify(it) + extra + ' },').join('\n') + '\n];';
const tests = (valeurs) => valeurs.map(it => 'it(' + JSON.stringify(it) + ', () => {});').join('\n');
function cas({ vivant = false, avantNouveau = null, titresApres = titres, titresAvant = titres, extra = '', proprietaire = 'SANS_FICHE_PROUVES' } = {}) {
  const pre = sourceStock(ancien, [...titres, 'un autosave au format 12 est restauré TYPÉ par la migration, et un patch de cap passe']);
  const post = sourceStock(nouveau, titres, extra).replace('SANS_FICHE_PROUVES', proprietaire);
  const images = {
    lirePreImage: p => p === PORTEUR ? pre : p === ancien ? tests(titresAvant) : p === nouveau ? avantNouveau : null,
    lirePostImage: p => p === PORTEUR ? post : p === ancien ? (vivant ? tests(titres) : null) : p === nouveau ? tests(titresApres) : null,
  };
  const diff = '--- a/' + PORTEUR + '\n+++ b/' + PORTEUR + '\n@@ -1,6 +1,5 @@\n' +
    pre.split('\n').map(l => '-' + l).join('\n') + '\n' + post.split('\n').map(l => '+' + l).join('\n');
  return { diff, images };
}
test('les trois sites de tests déménagés et le retrait quatrième ont un net sans croissance', () => {
  const { diff, images } = cas();
  assert.deepEqual(croissanceDesStocks(diff, images), []);
  const bilan = bilanDesStocks(diff, images);
  assert.equal(bilan[0].retenues.length, 0);
  assert.equal(bilan[0].perdues.length, 1);
  assert.deepEqual(refusDeLaPlage({ commits: [{ sha: 'temoin', message: 'migration', diff, images }], cumul: bilan }), []);
});
test('chaque preuve manquante conserve les trois entrées retenues au bilan', () => {
  for (const options of [
    { vivant: true }, { avantNouveau: tests(titres) }, { titresApres: [] }, { titresApres: ['nouveau titre'] },
    { extra: ', ref: "autre"' }, { proprietaire: 'AUTRE' }, { titresAvant: [] },
  ]) {
    const { diff, images } = cas(options);
    assert.equal(bilanDesStocks(diff, images)[0].retenues.length, 3, JSON.stringify(options));
    assert.deepEqual(croissanceDesStocks(diff, images), [], JSON.stringify(options));
  }
});
test('une copie supplémentaire du même site reste une croissance', () => {
  const { diff, images } = cas();
  const lire = images.lirePostImage;
  images.lirePostImage = p => p === PORTEUR
    ? sourceStock(nouveau, [...titres, titres[0], titres[0]]) : lire(p);
  assert.equal(compter(images.lirePreImage(PORTEUR)), 4);
  assert.equal(compter(images.lirePostImage(PORTEUR)), 5);
  assert.equal(croissanceDesStocks(diff, images)[0].net, 1);
  assert.equal(croissancesNonCouvertes({ diff, message: '' }, images)[0].net, 1);
});
test('les stocks RAW perdus et bénins restent deux classes distinctes', () => {
  const a = 'scripts/raw/empty-folios-perdues-stock.json';
  const b = 'scripts/raw/empty-folios-benignes-stock.json';
  const source = '[\n{ "fichier": "Source/Livre/Chapitre.md" }\n]';
  const diff = '--- a/' + a + '\n+++ b/' + a + '\n@@ -1 +1 @@\n-x\n+y\n' +
    'diff --git a/' + b + ' b/' + b + '\n--- a/' + b + '\n+++ b/' + b + '\n@@ -1 +1 @@\n-x\n+y';
  const images = {
    lirePreImage: p => p === a ? source : '[]',
    lirePostImage: p => p === b ? source : '[]',
  };
  assert.deepEqual(croissanceDesStocks(diff, images).map(x => [x.fichier, x.net]), [[b, 1]]);
});
function avecSourcesDeSites(source, production = false) {
  const { diff, images } = cas();
  const vieux = production ? 'src/ancien.ts' : ancien;
  const neuf = production ? 'src/nouveau.ts' : nouveau;
  const lireAvant = images.lirePreImage;
  const lireApres = images.lirePostImage;
  return {
    diff,
    images: {
      lirePreImage: p => p === vieux ? source : p === PORTEUR
        ? lireAvant(p).replaceAll(ancien, vieux) : null,
      lirePostImage: p => p === neuf ? source : p === PORTEUR
        ? lireApres(p).replaceAll(nouveau, neuf) : null,
    },
  };
}
test('migration APIs : production, machine.test et homonymes ne sont pas des sites de test', () => {
  for (const [entete, appel, production] of [
    ["const machine = { test() {} };", 'machine.test', true],
    ["import { test } from 'node:test';", 'test', true],
    ["const machine = { test() {} };", 'machine.test', false],
    ["function it() {}", 'it', false],
    ["const test = () => {};", 'test', false],
    ["import { it } from 'ailleurs';", 'it', false],
    ["import { it } from 'vitest'; function f(it) {", 'it', false],
    ["import * as banc from 'node:test'; function f(banc) {", 'banc.test', false],
    ["import type { it } from 'vitest';", 'it', false],
    ["import { type test } from 'node:test';", 'test', false],
  ]) {
    const source = entete + '\n' + titres.map(titre => appel + '(' + JSON.stringify(titre) + ', () => {});').join('\n')
      + (entete.endsWith('{') ? '\n}' : '');
    const { diff, images } = avecSourcesDeSites(source, production);
    assert.equal(bilanDesStocks(diff, images)[0].retenues.length, 3, source);
    assert.deepEqual(croissanceDesStocks(diff, images), [], source);
  }
});
test('migration APIs : imports nommés alias, namespaces et défaut node:test prouvent les sites', () => {
  for (const [entete, appel] of [
    ["import { it as scenario } from 'vitest';", 'scenario'],
    ["import { test as scenario } from 'node:test';", 'scenario'],
    ["import * as banc from 'vitest';", 'banc.it'],
    ["import * as banc from 'node:test';", 'banc.test'],
    ["import scenario from 'node:test';", 'scenario'],
  ]) {
    const source = entete + '\n' + titres.map(titre => appel + '(' + JSON.stringify(titre) + ', () => {});').join('\n');
    const { diff, images } = avecSourcesDeSites(source);
    assert.deepEqual(croissanceDesStocks(diff, images), [], source);
  }
});
test('migration payload : l’ordre des champs ne change pas une entrée littérale', () => {
  const { diff, images } = cas({ extra: ', ref: "r1", occurrence: 1' });
  const lireAvant = images.lirePreImage;
  const lire = images.lirePostImage;
  images.lirePreImage = p => p === PORTEUR ? lireAvant(p).replaceAll(' },', ', ref: "r1", occurrence: 1 },') : lireAvant(p);
  images.lirePostImage = p => p === PORTEUR ? 'const SANS_FICHE_PROUVES = [\n' +
    titres.map(titre => '{ occurrence: 1, it: ' + JSON.stringify(titre) + ', ref: "r1", fichier: ' + JSON.stringify(nouveau) + ' },').join('\n') +
    '\n];' : lire(p);
  assert.deepEqual(croissanceDesStocks(diff, images), []);
});
test('migration payload : une clé calculée ou un étalement ne prouve pas une entrée littérale', () => {
  for (const extra of [', [cle]: "r1"', ', ...autres']) {
    const { diff, images } = cas({ extra });
    const lire = images.lirePreImage;
    images.lirePreImage = p => p === PORTEUR ? lire(p).replaceAll(' },', extra + ' },') : lire(p);
    assert.equal(bilanDesStocks(diff, images)[0].retenues.length, 3, extra);
    assert.deepEqual(croissanceDesStocks(diff, images), [], extra);
  }
});
test('une panne du lecteur ne prouve pas la disparition du site', () => {
  const { diff, images } = cas();
  const lire = images.lirePostImage;
  images.lirePostImage = p => { if (p === ancien) throw new Error('panne'); return lire(p); };
  assert.equal(bilanDesStocks(diff, images)[0].retenues.length, 3);
  assert.deepEqual(croissanceDesStocks(diff, images), []);
});

test('#2472 le bilan réduit toutes les clés signées du même porteur', () => {
  assert.equal(croissanceDesCles(new Map([['a', 2], ['b', -2]])), 0);
  assert.equal(croissanceDesCles(new Map([['a', 189], ['b', -5]])), 184);
  assert.equal(croissanceDesCles(new Map([['a', -2]])), -2);
});

const sha256 = texte => createHash('sha256').update(texte).digest('hex');
function temoinReel(ref) {
  const fixture = JSON.parse(gunzipSync(Buffer.from(readFileSync(new URL('./fixtures/2472-' + ref + '.json.gz.b64', import.meta.url), 'ascii').trim(), 'base64')).toString('utf8'));
  assert.match(fixture.sha, new RegExp('^' + ref + '[a-f0-9]{' + (40 - ref.length) + '}$'));
  assert.match(fixture.parent, /^[a-f0-9]{40}$/);
  assert.ok(fixture.commande.includes(fixture.sha));
  assert.equal(sha256(fixture.diff), fixture.hashDiff);
  for (const image of fixture.images) {
    assert.equal(sha256(image.pre), image.hashPre);
    assert.equal(image.post === null ? null : sha256(image.post), image.hashPost);
  }
  const images = {
    lirePreImage: fichier => fixture.images.find(i => i.fichier === fichier)?.pre ?? null,
    lirePostImage: fichier => fixture.images.find(i => i.fichier === fichier)?.post ?? null,
  };
  return { ...fixture, images };
}

test('#2472 témoin réel 904a78dda : deux ajouts et deux retraits ont un net nul', () => {
  const { sha, diff, images } = temoinReel('904a78dda');
  const bilan = bilanDesStocks(diff, images);
  const porteur = bilan.find(b => b.fichier === 'scripts/gates/ecrivainsAtteints.test.mjs');
  assert.deepEqual([porteur.retenues.length, porteur.perdues.length], [2, 2]);
  assert.deepEqual(croissanceDesStocks(diff, images), []);
  assert.deepEqual(croissancesNonCouvertes({ diff, message: '' }, images), []);
  assert.deepEqual(refusDeLaPlage({ commits: [{ sha, diff, images, message: '' }], cumul: bilan }), []);
});

test('#2472 témoin réel 1befc7e36 : le compte affiché, jugé et déclaré vaut 184', () => {
  const { sha, diff, images } = temoinReel('1befc7e36');
  const fichier = 'scripts/guards/balayages-non-resolus-stock.json';
  const bilan = bilanDesStocks(diff, images);
  const croissances = croissanceDesStocks(diff, images);
  const mesure = croissances.find(c => c.fichier === fichier);
  assert.deepEqual([mesure.ajoutees, mesure.retirees, mesure.net], [189, 5, 184]);
  const jugement = croissancesNonCouvertes({ diff, message: '' }, images);
  assert.equal(jugement.find(c => c.fichier === fichier).net, 184);
  assert.match(raisonDeRefus(jugement), /\+184 entrée\(s\) nette\(s\) \(189 ajoutée\(s\), 5 retirée\(s\)\)/);
  assert.equal(refusDeLaPlage({ commits: [{ sha, diff, images, message: '' }], cumul: bilan }).find(c => c.fichier === fichier).net, 184);
  for (const [n, attendu] of [[184, false], [189, true]]) {
    const message = 'CLIQUET: ' + fichier + ' +' + n + ' — croissance du stock mesurée sur les images réelles';
    assert.equal(croissancesNonCouvertes({ diff, message }, images).some(c => c.fichier === fichier), attendu);
    assert.equal(refusDeLaPlage({ commits: [{ sha, diff, images, message }], cumul: bilan }).some(c => c.fichier === fichier), attendu);
  }
  const autre = croissances.find(c => c.fichier !== fichier);
  assert.equal(autre.net, 4);
  assert.ok(croissancesNonCouvertes({ diff, message: '' }, images).some(c => c.fichier === autre.fichier && c.net === 4));
});

test('#2472 supprimer le fichier porteur retire toutes ses entrées', () => {
  const { diff, images } = temoinReel('904a78dda');
  const fichier = 'scripts/hooks/solde-ticket-guard.test.mjs';
  assert.equal(images.lirePostImage(fichier), null);
  const bilan = bilanDesStocks(diff, images).find(b => b.fichier === fichier);
  assert.deepEqual([bilan.retenues.length, bilan.perdues.length, croissanceDesCles(bilan.parCle)], [0, 1, -1]);
  assert.deepEqual(croissanceDesStocks(diff, images), []);
});
