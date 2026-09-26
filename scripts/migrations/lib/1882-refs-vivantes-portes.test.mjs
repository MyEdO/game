/**
 * MORSURE des PORTES de la migration 13 → 14 de #1882 (T2d) — une réf. vivante d'effet n'est jamais VIDE.
 *
 *  - `2026-09-24-1882-refs-vivantes-semees.mjs` (racine `src/scenes`) : sème la PREMIÈRE créature (resp. le
 *    PREMIER véhicule) du catalogue dans tout `startPursuit.foes[].ref.creatureId` et tout
 *    `givePossession.ref.creatureId`/`vehicleId` VIDE, où que l'effet soit niché, et porte le document au
 *    `schema` 14. Borne haute CLOSE (`schema` ∈ {13, 14}) : DERNIÈRE de la chaîne, elle NOMME un futur.
 *
 * Le banc joue la migration sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la
 * sortie attendue, un message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché
 * (octet ET horodatage antidaté). FIXTURES FABRIQUÉES : catalogues jouets, la réf. ATTENDUE est récitée
 * ici, jamais importée.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { joue } from './joue.mjs';

const MIGRATION = '2026-09-24-1882-refs-vivantes-semees.mjs';
const SCHEMA_AVANT = 13;
const SCHEMA_APRES = 14;
const serialise = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const ANTIDATE = new Date('2000-01-01T00:00:00Z');

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const CREATURES = 'src/data/creatures.json';
const VEHICLES = 'src/data/vehicles.json';
const catalogue = (...ids) => `${JSON.stringify(ids.map((id) => ({ id })), null, 2)}\n`;

/** Poursuite nichée dans un choix de dialogue, possessions dans un déclencheur ; péril de ROUTE (hors
 *  Scène) portant une possession et un navire de campagne. */
const alpha = (schema = SCHEMA_AVANT, poursuivi = '', vehicule = '', bete = '', peril = '', navire = '') => ({
  type: 'projet',
  schema,
  id: 'alpha',
  worldMap: { routes: [{ id: 'r', perils: [{ label: 'Péril', effects: [
    { type: 'givePossession', nature: 'bete', ref: { creatureId: peril } },
    { type: 'setVessel', vehicleId: navire },
  ] }] }] },
  scenes: [{
    id: 's1',
    dialogues: [{ id: 'd', nodes: [{ id: 'n', choices: [{ id: 'c', flow: { kind: 'do', effect: { type: 'startPursuit', foes: [{ ref: { creatureId: poursuivi } }, { ref: { creatureId: 'loup' } }] } } }] }] }],
    triggers: [{ id: 't', flow: { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'givePossession', nature: 'vehicule', ref: { vehicleId: vehicule } } },
      { kind: 'do', effect: { type: 'givePossession', nature: 'bete', ref: { creatureId: bete } } },
      { kind: 'do', effect: { type: 'autre', ref: { creatureId: '' } } },
    ] } }],
  }],
});

function depot(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1882b-'));
  const avant = new Map();
  for (const [rel, texte] of Object.entries(fichiers)) {
    const cible = path.join(racine, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  return { racine, avant };
}
const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });
function rienTouche(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté`);
  }
  return fautes;
}
function refuse(fichiers, message) {
  const d = depot(fichiers);
  try {
    const { code, sortie } = joue(d.racine, MIGRATION);
    assert.equal(code, 1, `sortie ${code} — la migration devait ARRÊTER : ${sortie.slice(0, 1200)}`);
    assert.ok(sortie.includes('ARBITRAGE REQUIS') && sortie.includes(message), `arrêt sans NOMMER « ${message} » : ${sortie.slice(0, 1200)}`);
    assert.deepEqual(rienTouche(d.racine, d.avant), []);
  } finally {
    efface(d.racine);
  }
}
const cats = () => ({ [CREATURES]: catalogue('humain-jouet', 'loup'), [VEHICLES]: `${JSON.stringify([{ id: 'diligence-jouet' }, { id: 'cogue-jouet', ship: {} }], null, 2)}\n` });

test('(a) MIGRATION RÉELLE : chaque réf. vide d’effet reçoit la première offerte, en place ; le reste est intact', (t) => {
  const d = depot({ ...cats(), [ALPHA]: serialise(alpha()) });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, sortie);
  const attendu = alpha(SCHEMA_APRES, 'humain-jouet', 'diligence-jouet', 'humain-jouet', 'humain-jouet', 'cogue-jouet');
  assert.equal(fs.readFileSync(path.join(d.racine, ALPHA), 'utf8'), serialise(attendu));
  assert.ok(sortie.includes(`${ALPHA} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, réf. vides semées : 5 — fichier réécrit`), sortie);
});

test('(b) IDEMPOTENT : rejouée sur l’état final, sortie 0 et rien d’écrit', (t) => {
  const d = depot({ ...cats(), [ALPHA]: serialise(alpha(SCHEMA_APRES, 'humain-jouet', 'diligence-jouet', 'humain-jouet', 'humain-jouet', 'cogue-jouet')) });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, sortie);
  assert.ok(sortie.includes('réf. vides semées : 0 — fichier INCHANGÉ'), sortie);
  assert.deepEqual(rienTouche(d.racine, d.avant), []);
});

test('(c) BORNE HAUTE CLOSE : un `schema` futur est refusé et NOMMÉ, rien d’écrit', () => {
  refuse({ ...cats(), [ALPHA]: serialise(alpha(SCHEMA_APRES + 1)) }, `${ALPHA} : \`schema\` inattendu ${SCHEMA_APRES + 1} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
});

test('(d) BORNE BASSE : un `schema` antérieur est refusé et NOMMÉ, rien d’écrit', () => {
  refuse({ ...cats(), [ALPHA]: serialise(alpha(SCHEMA_AVANT - 1)) }, `${ALPHA} : \`schema\` inattendu ${SCHEMA_AVANT - 1} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
});

test('(e) FORMATAGE non canonique → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse({ ...cats(), [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n` }, `${ALPHA} : FORME NON CANONIQUE`);
});

test('(f) ENTRÉE DÉCLARÉE ABSENTE (catalogue des créatures) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse({ [VEHICLES]: catalogue('diligence-jouet'), [ALPHA]: serialise(alpha()) }, `${CREATURES} absent — entrée déclarée de la réf. semée`);
});

test('(g) PÉRIMÈTRE VIDE → sortie 1 NOMINATIVE', () => {
  refuse({ ...cats(), 'src/scenes/orpheline/notes.txt': 'rien\n' }, 'aucun projet de scène trouvé — périmètre déplacé');
});
