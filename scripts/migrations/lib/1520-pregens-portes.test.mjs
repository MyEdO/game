/**
 * MORSURE des PORTES de `2026-09-23-1520-pregens-choix-par-id.mjs` — les choix authorés d'un
 * pré-tiré passent du LIBELLÉ à l'id (`pettySpells` → ids de sort, `careerTalent` → `{ id, spec? }`).
 *
 * Joué sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario : migration réelle, idempotence,
 * fail-fast sur 0 et 2+ candidats (sort, talent, spécialisation), `specsSource` non lue, talent sans
 * catalogue de spécialisations, forme
 * étrangère, formatage. Les rouges d'avant-écriture exigent sortie 1, message NOMINATIF et ZÉRO
 * fichier touché. FIXTURES FABRIQUÉES (pré-tirés ET catalogues), état d'arrivée écrit à la main.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { crees, depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-23-1520-pregens-choix-par-id.mjs';
const PREGENS = 'src/data/pregens.json';

const catalogues = {
  'src/data/spells.json': serialise([
    { id: 'flechette', label: 'Fléchette' },
    { id: 'choc', label: 'Choc' },
    { id: 'lumiere-a', label: 'Lumière' },
    { id: 'lumiere-b', label: 'Lumière' },
  ], FORME_DATA),
  'src/data/talents.json': serialise([
    { id: 'magie-mineure', label: 'Magie mineure' },
    { id: 'beni', label: 'Béni', specsSource: 'cultBlessings' },
    { id: 'sens-aiguise', label: 'Sens aiguisé', specs: [{ id: 'gout', label: 'Goût' }] },
    { id: 'chanson-de-marin', label: 'Chanson de marin', specsSource: 'seaShanties' },
  ], FORME_DATA),
  'src/data/gods.json': serialise([{ id: 'sigmar', label: 'Sigmar' }], FORME_DATA),
};

const pregens = () => [
  { id: 'sorciere', careerTalent: 'Magie mineure', pettySpells: ['Fléchette', 'choc'] },
  { id: 'pretre', careerTalent: 'Béni (Sigmar)' },
  { id: 'chasseur', careerTalent: 'Sens aiguisé (Goût)' },
  { id: 'soldat' },
];
const pregensApres = () => [
  { id: 'sorciere', careerTalent: { id: 'magie-mineure' }, pettySpells: ['flechette', 'choc'] },
  { id: 'pretre', careerTalent: { id: 'beni', spec: 'sigmar' } },
  { id: 'chasseur', careerTalent: { id: 'sens-aiguise', spec: 'gout' } },
  { id: 'soldat' },
];

/** Le dépôt : les catalogues fabriqués + `pregens` sous la forme demandée. */
const fichiers = (liste, texte = serialise(liste, FORME_DATA)) => ({ ...catalogues, [PREGENS]: texte });

/** `pregens()` dont le pré-tiré `id` reçoit `champs`. */
const avec = (id, champs) => pregens().map((p) => (p.id === id ? { ...p, ...champs } : p));

test('(a) MIGRATION RÉELLE : libellés résolus en ids À LEUR PLACE, spécialisation en id de son catalogue', (t) => {
  const d = depot(fichiers(pregens()));
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, PREGENS), serialise(pregensApres(), FORME_DATA));
  assert.ok(sortie.includes('4 libellé(s) résolu(s) en id'), `le compte ne se DIT pas : ${sortie.slice(0, 1200)}`);
});

test('(b) IDEMPOTENCE : rejouée sur l’état d’arrivée, sortie 0 sans rien écrire', (t) => {
  const d = depot(fichiers(pregensApres()));
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes('no-op'), `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual([...rienTouche(d.racine, d.avant), ...crees(d.racine, d.avant, 'src/data')], [], 'le rejeu a écrit');
});

test('(c) FAIL-FAST sort à 2+ candidats → NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('sorciere', { pettySpells: ['Lumière'] })),
    'pré-tiré « sorciere » pettySpells[0] : « Lumière » — 2 candidats : lumiere-a, lumiere-b');
});

test('(d) FAIL-FAST sort à 0 candidat → NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('sorciere', { pettySpells: ['Boule de feu'] })),
    'pré-tiré « sorciere » pettySpells[0] : « Boule de feu » — aucun sort à ce libellé');
});

test('(e) FAIL-FAST talent à 0 candidat → NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('soldat', { careerTalent: 'Coup puissant' })),
    'pré-tiré « soldat » careerTalent : « Coup puissant » — aucun talent à ce libellé');
});

test('(f) FAIL-FAST spécialisation à 0 candidat dans le catalogue de culte → NOMMÉE, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('pretre', { careerTalent: 'Béni (Khorne)' })),
    'pré-tiré « pretre » careerTalent : « Khorne » — aucun dieu (cultBlessings) à ce libellé');
});

test('(g) FAIL-FAST `specsSource` que la migration ne lit pas → NOMMÉE, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('soldat', { careerTalent: 'Chanson de marin (Refrain)' })),
    'pré-tiré « soldat » careerTalent : « chanson-de-marin » tire ses spécialisations de `seaShanties`, que cette migration ne lit pas');
});

test('(g2) FAIL-FAST libellé à parenthèses sur un talent SANS catalogue de spécialisations → NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('sorciere', { careerTalent: 'Magie mineure (Feu)' })),
    'pré-tiré « sorciere » careerTalent : « magie-mineure » ne déclare aucune spécialisation (ni `specs` ni `specsSource`), « Feu » n\'en désigne donc aucune');
});

test('(h) PORTE DE FORME : `pettySpells` non-tableau, élément non-chaîne, `careerTalent` ni libellé ni objet', () => {
  refuse(MIGRATION, fichiers(avec('sorciere', { pettySpells: 'Choc' })), 'pré-tiré « sorciere » : `pettySpells` non-tableau');
  refuse(MIGRATION, fichiers(avec('sorciere', { pettySpells: [{ id: 'choc' }] })),
    'pré-tiré « sorciere » pettySpells[0] : {"id":"choc"} — ni libellé ni id de sort');
  refuse(MIGRATION, fichiers(avec('soldat', { careerTalent: 7 })),
    'pré-tiré « soldat » careerTalent : 7 — ni libellé ni `{ id, spec? }`');
});

test('(i) FAIL-FAST racine NON-TABLEAU, formatage non canonique → NOMMÉS, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(null, serialise({ pregens: pregens() }, FORME_DATA)), 'pregens.json : racine non-TABLEAU');
  refuse(MIGRATION, fichiers(null, `${serialise(pregens(), FORME_DATA)}\n`), 'pregens.json : forme non canonique');
});
