/**
 * MORSURE des PORTES de `2026-09-23-1897-sorts-fan-par-le-pont.mjs` (#1897) — les sorts du livre fan
 * passent par le pont : fusions, entrées fan neuves, listes `spells` dérivées des créatures fan.
 *
 * La migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario. Ses ENTRÉES y sont
 * COPIÉES de l'arbre (`COPIES` : le relevé des cellules et le pont, le registre des livres et ses
 * lecteurs, la table `SORTS_FUSIONNES_1897`, le dossier d'extraction du livre fan) ; `spells.json` et
 * `creatures.json` sont FABRIQUÉS par-dessus, depuis l'état d'arrivée de l'arbre : migration réelle
 * (une fusion défaite, puis refaite), idempotence, entrées neuves recréées à l'octet de la donnée
 * committée, et un rouge d'avant-écriture par porte FAIL-FAST de son en-tête — sortie 1, message
 * NOMINATIF, ZÉRO fichier posé touché.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { crees, depot, efface, joue, lireArbre, lireDans, refuse, rienTouche } from './joue.mjs';
import { SORTS_FUSIONNES_1897 } from '../../../src/data/sortsFusionnes.ts';

const MIGRATION = '2026-09-23-1897-sorts-fan-par-le-pont.mjs';
const F_SORTS = 'src/data/spells.json';
const F_CREATURES = 'src/data/creatures.json';
const F_FUSIONS = 'src/data/sortsFusionnes.ts';
const LIVRE_FAN = 'frenchy-bzh';
const DOSSIER_FAN = 'Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF';
const CHAPITRE_FIXTURE = `${DOSSIER_FAN}/99 - Fixture.md`;
const COPIES = [
  'scripts/data/lib', 'scripts/raw', 'scripts/guards/lib', 'scripts/source', 'scripts/port-dev.mjs',
  'src/data/source', 'src/data/hash.ts', 'src/data/books.json', F_FUSIONS, DOSSIER_FAN,
];

/** Les entrées fan NEUVES de la migration (`NEUVES`), dernières de `spells.json`. */
const NAISSANTS = new Set(['invocation-d-un-colosses-necrofex', 'invitation-a-la-danse-macabre-de-vanhel', 'putrefaction-2', 'bouclier-ruine']);

/** La fusion défaite puis refaite par (a) : l'entrée fan `alarme`, absorbée par `alerte`. */
const FAN = 'alarme';
const CIBLE = SORTS_FUSIONNES_1897[FAN];

const sortsArbre = () => JSON.parse(lireArbre(F_SORTS));
const creaturesArbre = () => JSON.parse(lireArbre(F_CREATURES));
const posesDe = (sorts, creatures) => ({ [F_SORTS]: serialise(sorts, FORME_DATA), [F_CREATURES]: serialise(creatures, FORME_DATA) });

/** L'entrée fan `alarme` RÉTABLIE sous le libellé `label` : la forme d'avant la fusion. */
const entreeFan = (label) => ({ id: FAN, type: 'spells', label, source: { book: LIVRE_FAN, page: 1 } });

/** L'état d'AVANT la fusion `alarme → alerte`, fabriqué depuis l'arbre : l'entrée fan rétablie sous le
 *  libellé imprimé (`quote`), l'emplacement secondaire de l'absorbante retiré, et `alarme` cité par une
 *  créature HORS livre fan. Rend aussi l'état d'ARRIVÉE attendu. */
function avantLaFusion() {
  const sorts = sortsArbre();
  const absorbante = sorts.find((s) => s.id === CIBLE);
  assert.equal(absorbante.alsoIn?.length, 1, `${CIBLE} doit porter UN emplacement secondaire (celui du livre fan)`);
  assert.equal(Object.keys(absorbante).indexOf('alsoIn'), Object.keys(absorbante).indexOf('source') + 1, '`alsoIn` suit `source`');
  const { quote } = absorbante.alsoIn[0];
  const sortsAvant = sorts.map((s) => {
    if (s.id !== CIBLE) return s;
    const { alsoIn: _retire, ...reste } = s;
    return reste;
  });
  sortsAvant.push(entreeFan(quote));
  const creatures = creaturesArbre();
  const i = creatures.findIndex((c) => c.source?.book !== LIVRE_FAN && Array.isArray(c.spells) && !c.spells.includes(CIBLE));
  const creaturesAvant = structuredClone(creatures);
  creaturesAvant[i].spells.push(FAN);
  const creaturesApres = structuredClone(creatures);
  creaturesApres[i].spells.push(CIBLE);
  return { avant: posesDe(sortsAvant, creaturesAvant), sortsApres: sorts, creaturesApres };
}

/** Un chapitre FABRIQUÉ du livre fan : un profil `Mage Fixture` et une table de Magie mineure. */
const chapitre = (rangees) => [
  '**Niveau 1 — Mage Fixture**',
  '',
  '**Sorts de Magie mineure**',
  '',
  '| Sort (VF) | Sort (VO) | NI | Portée | Cible | Durée | Effet |',
  '|---|---|---|---|---|---|---|',
  ...rangees,
  '',
].join('\n');
const mageFixture = { id: 'mage-fixture', label: 'Mage Fixture', folder: 'Fixture (frenchy.bzh)', source: { book: LIVRE_FAN, page: 1 }, spells: [] };

test(`${MIGRATION} (a) MIGRATION RÉELLE : l'entrée fan disparaît, l'absorbante regagne son emplacement, la créature cite l'absorbante`, (t) => {
  const { avant, sortsApres, creaturesApres } = avantLaFusion();
  const d = depot(avant, COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, F_SORTS), serialise(sortsApres, FORME_DATA));
  assert.equal(lireDans(d.racine, F_CREATURES), serialise(creaturesApres, FORME_DATA));
});

test(`${MIGRATION} (b) IDEMPOTENCE : rejouée sur l'état d'arrivée, sortie 0 sans rien écrire`, (t) => {
  const d = depot(posesDe(sortsArbre(), creaturesArbre()), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes('no-op'), `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  const creesHorsCopies = crees(d.racine, d.avant, 'src/data').filter((f) => !COPIES.some((c) => f.startsWith(`${c} :`)));
  assert.deepEqual([...rienTouche(d.racine, d.avant), ...creesHorsCopies], [], 'le rejeu a écrit');
});

test(`${MIGRATION} (c) FORME non canonique d'un fichier → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  const poses = posesDe(sortsArbre(), creaturesArbre());
  refuse(MIGRATION, { ...poses, [F_SORTS]: `${poses[F_SORTS]}\n` }, 'spells.json : forme non canonique', COPIES);
});

test(`${MIGRATION} (d) racine NON-TABLEAU → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  refuse(MIGRATION, { ...posesDe(sortsArbre(), creaturesArbre()), [F_CREATURES]: serialise({ entrees: [] }, FORME_DATA) }, 'creatures.json : racine non-TABLEAU', COPIES);
});

test(`${MIGRATION} (e) cible de fusion ABSENTE du catalogue → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  const sorts = sortsArbre().filter((s) => s.id !== CIBLE);
  refuse(MIGRATION, posesDe(sorts, creaturesArbre()), `fusion ${FAN} → ${CIBLE} : cible absente de spells.json`, COPIES);
});

test(`${MIGRATION} (f) cible de fusion ELLE-MÊME fusionnée → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  const table = lireArbre(F_FUSIONS);
  const ligne = `  '${FAN}': '${CIBLE}',\n`;
  assert.ok(table.includes(ligne), `ligne de fusion introuvable : ${ligne}`);
  const mutante = table.replace(ligne, `${ligne}  '${CIBLE}': 'flechette',\n`);
  refuse(MIGRATION, { ...posesDe(sortsArbre(), creaturesArbre()), [F_FUSIONS]: mutante }, `fusion ${FAN} → ${CIBLE} : la cible est elle-même fusionnée`, COPIES);
});

test(`${MIGRATION} (g) fusion sans CELLULE imprimée → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  const sorts = [...sortsArbre(), entreeFan('Libellé jamais imprimé')];
  refuse(MIGRATION, posesDe(sorts, creaturesArbre()), `fusion ${FAN} → ${CIBLE} : aucune cellule imprimée « Libellé jamais imprimé » résolue vers ${CIBLE}`, COPIES);
});

test(`${MIGRATION} (h) cellule que le pont ne RÉSOUT pas → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  refuse(MIGRATION, {
    ...posesDe(sortsArbre(), creaturesArbre()),
    [CHAPITRE_FIXTURE]: chapitre(['| Zorglub | _Zorglub_ | 3 | Vous | Vous | 1 heure | Rien. |']),
  }, 'cellule sans ligne de pont : 99 - Fixture.md:7 « Zorglub » / « Zorglub » (mineure)', COPIES);
});

test(`${MIGRATION} (i) id du pont ABSENT du catalogue → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  const cibles = new Set(Object.values(SORTS_FUSIONNES_1897));
  const creatures = creaturesArbre();
  const id = creatures
    .filter((c) => c.source?.book === LIVRE_FAN)
    .flatMap((c) => c.spells ?? [])
    .find((s) => !NAISSANTS.has(s) && !cibles.has(s));
  assert.ok(id, 'aucun sort de créature fan hors fusions et entrées neuves');
  refuse(MIGRATION, posesDe(sortsArbre().filter((s) => s.id !== id), creatures), `→ ${id}, absent de spells.json`, COPIES);
});

test(`${MIGRATION} (j) DOUBLON non déclaré dans une liste dérivée → sortie 1 NOMINATIVE, rien d'écrit`, () => {
  refuse(MIGRATION, {
    ...posesDe(sortsArbre(), [...creaturesArbre(), mageFixture]),
    [CHAPITRE_FIXTURE]: chapitre([
      '| Alarme | _Warning_ | 3 | Vous | Vous | 1 heure | Un. |',
      '| Alarme bis | _Warning_ | 4 | Vous | Vous | 1 heure | Deux. |',
    ]),
  }, `doublon non déclaré — mage-fixture : ${CIBLE} imprimé par « Alarme|Warning|3 » puis « Alarme bis|Warning|4 » (99 - Fixture.md l.8)`, COPIES);
});

test(`${MIGRATION} (k) ENTRÉES NEUVES retirées : la migration rend la donnée committée À L'OCTET`, (t) => {
  const sorts = sortsArbre();
  assert.deepEqual(sorts.slice(-NAISSANTS.size).map((s) => s.id), [...NAISSANTS], 'les entrées neuves ferment `spells.json`, dans l’ordre de `NEUVES`');
  const d = depot(posesDe(sorts.filter((s) => !NAISSANTS.has(s.id)), creaturesArbre()), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, F_SORTS), lireArbre(F_SORTS));
  assert.equal(lireDans(d.racine, F_CREATURES), lireArbre(F_CREATURES));
});
