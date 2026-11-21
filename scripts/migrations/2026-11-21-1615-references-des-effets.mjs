/**
 * #1615 — références emboîtées des dons, de l’apprentissage d’un sort et de la mise à disposition d’un navire.
 *
 * Entrées : src/data/trappings.json et src/data/vehicles.json (catalogues lus),
 * src/data/spells.json, src/scenes/arene/arene-projet.json, src/scenes/barge-du-sel/barge-du-sel-projet.json
 * et src/scenes/loup-et-saumure/loup-et-saumure-projet.json (lus et écrits).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsDe, migrerLesIdsNus } from './lib/idNuEnRef.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const catalogue = (fichier, retient) => new Set(
  JSON.parse(readFileSync(join(racine, 'src/data', fichier), 'utf8')).filter(retient).map((entree) => entree.id),
);
const don = (discriminant) => ({ vers: [{ cle: 'objet', type: 'trapping', si: { [discriminant]: 'giveTrapping' } }] });
const navire = { vers: [{ cle: 'navire', type: 'navire', si: { type: 'setVessel' } }] };

migrerLesIdsNus({
  racine,
  lot: '1615 références des effets',
  catalogues: {
    trapping: catalogue('trappings.json', (e) => e.service == null),
    navire: catalogue('vehicles.json', (e) => e.ship != null),
    spell: idsDe(racine, 'src/data/spells.json'),
  },
  porteurs: {
    'src/data/spells.json': { cles: {
      'effects.etapes[].effet.ops[].trappingId': don('op'),
      'effects.etapes[].effet.ops[].ops[].trappingId': don('op'),
    } },
    'src/scenes/arene/arene-projet.json': { objet: true, cles: {
      'scenes[].entities[].usable.actions[].flow.etapes[].effet.trappingId': don('type'),
      'scenes[].entities[].usable.actions[].flow.reussite.etapes[].effet.trappingId': don('type'),
      'scenes[].entities[].usable.actions[].flow.etapes[].effet.spell': { vers: [{ cle: 'sort', type: 'spell', si: { type: 'learnSpell' } }] },
    } },
    'src/scenes/barge-du-sel/barge-du-sel-projet.json': { objet: true, cles: {
      'scenes[].triggers[].flow.etapes[].effet.vehicleId': navire,
    } },
    'src/scenes/loup-et-saumure/loup-et-saumure-projet.json': { objet: true, cles: {
      'scenes[].dialogues[].nodes[].choices[].flow.etapes[].effet.vehicleId': navire,
    } },
  },
  parPorteur: {
    'spells.json › effects.etapes[].effet.ops[].trappingId → objet': 2,
    'spells.json › effects.etapes[].effet.ops[].ops[].trappingId → objet': 1,
    'arene-projet.json › scenes[].entities[].usable.actions[].flow.etapes[].effet.trappingId → objet': 17,
    'arene-projet.json › scenes[].entities[].usable.actions[].flow.reussite.etapes[].effet.trappingId → objet': 1,
    'arene-projet.json › scenes[].entities[].usable.actions[].flow.etapes[].effet.spell → sort': 1,
    'barge-du-sel-projet.json › scenes[].triggers[].flow.etapes[].effet.vehicleId → navire': 1,
    'loup-et-saumure-projet.json › scenes[].dialogues[].nodes[].choices[].flow.etapes[].effet.vehicleId → navire': 1,
  },
  cardinal: 24,
});
