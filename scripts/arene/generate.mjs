#!/usr/bin/env -S npx tsx
/**
 * Génère `src/scenes/arene/arene-projet.json` (`projectDoc()` : paquet de projet au schema courant, forme décidée par `documentDeProjet`).
 * OUTIL D'AUTEUR (itération de layout) — le JSON commité reste la source canonique, 100 %
 * éditable dans l'éditeur. Usage : `tsx scripts/arene/generate.mjs` (tsx car `scripts/campagne/lib.mjs` importe
 * `buildScene` du moteur — l'ASCII, l'architecture, les murs, les couches et les rencontres sont compilés par le compilateur
 * headless-editor `src/state/mapSpec.ts`, zéro fabrique de scène dupliquée).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectDoc } from '../campagne/lib.mjs';
import { makeHub } from './hub.mjs';
import { makeZone1, makeZone2, makeZone3, makeZone4, makeZone5, makeZone6, makeZone7 } from './zones1-7.mjs';
import { makeZone8, makeZone9, makeZone10, makeZone11, makeZone12, makeZone13 } from './zones8-13.mjs';
import { makeForet, makeMarais, makeVillage, makeEmbuscade } from './expeditions.mjs';

/** Construction PURE du document de projet : la SOURCE possède 100 % de la donnée de l'artefact
 *  (`src/scenes/arene/arene-projet.json`), le CLI ci-dessous n'en est que la voie d'écriture.
 *  Rejouable à volonté dans un même process — garde `src/scenes/generateurs-byte-stables.test.ts`. */
export function build() {
// L'ordre compte : scenes[0] = arene-zone1 (départ de « Nouvelle partie »). Le Bourg est TOUT-EN-SCÈNE :
// les 4 corps architecturaux (taverne/chapelle/forge/échoppe) sont DANS `arene-hub`.
const scenes = [
  makeZone1(),
  makeHub(),
  makeZone2(),
  makeZone3(),
  makeZone4(),
  makeZone5(),
  makeZone6(),
  makeZone7(),
  makeZone8(),
  makeZone9(),
  makeZone10(),
  makeZone11(),
  makeZone12(),
  makeZone13(),
  makeForet(),
  makeMarais(),
  makeVillage(),
  makeEmbuscade(),
];

/** Carte du monde (#T2) : le Bourg + 3 destinations de contrat, routes paramétrées
 *  (km, modes, prix, péripéties d'auteur, embuscade « Attaqués ! »). */
const worldMap = {
  id: 'arene-carte',
  label: 'Les Terres de l’Arène',
  places: [
    { id: 'bourg', label: 'Le Bourg de l’Arène', pos: { x: 22, y: 55 }, scene: 'arene-hub', entry: 'route', icon: 'scenario/village' },
    { id: 'foret', label: 'La Vieille Futaie', pos: { x: 55, y: 30 }, scene: 'arene-exp-foret', icon: 'scenario/hamlet' },
    { id: 'marais', label: 'La Tourbière Noire', pos: { x: 72, y: 62 }, scene: 'arene-exp-marais', icon: 'scenario/trap' },
    { id: 'village', label: 'Felsbach', pos: { x: 48, y: 80 }, scene: 'arene-exp-village', icon: 'journal/death' },
  ],
  routes: [
    {
      id: 'route-futaie',
      a: 'bourg',
      b: 'foret',
      km: 18,
      modes: ['pied'],
      perils: [
        {
          label: 'Hurlements dans la nuit',
          chancePct: 25,
          effects: [{ type: 'journal', desc: 'Des hurlements suivent la colonne toute la nuit — au matin, des empreintes de loups cernent le bivouac.' }],
        },
      ],
      ambush: { scene: 'arene-route-embuscade', encounter: 'enc-embuscade' },
    },
    {
      id: 'route-felsbach',
      a: 'bourg',
      b: 'village',
      km: 24,
      modes: ['pied', 'diligence'],
      inns: true, // relais de diligence : la halte de nuit propose l'auberge (modale de Repos)
      perils: [
        {
          label: 'Charrette de réfugiés',
          chancePct: 20,
          effects: [{ type: 'journal', desc: 'Une charrette de réfugiés de Felsbach passe sans s’arrêter. Une femme crie : « N’y allez pas ! L’EAU ! »' }],
        },
      ],
      ambush: { scene: 'arene-route-embuscade', encounter: 'enc-embuscade' },
    },
    {
      id: 'route-tourbiere',
      a: 'foret',
      b: 'marais',
      km: 14,
      modes: ['pied'],
      perilDie: 7, // sentier de tourbière : péripétie sur 7+ (plus risqué que la route)
      perils: [
        {
          label: 'Feux follets',
          chancePct: 30,
          effects: [{ type: 'journal', desc: 'Des lueurs dansent hors du sentier, insistantes. Ceux qui les suivent ne reviennent pas — vous ne les suivez PAS.' }],
        },
      ],
      ambush: { scene: 'arene-route-embuscade', encounter: 'enc-embuscade' },
    },
    {
      id: 'route-basse',
      a: 'village',
      b: 'marais',
      km: 12,
      modes: ['pied'],
      ambush: { scene: 'arene-route-embuscade', encounter: 'enc-embuscade' },
    },
  ],
};

// ── Garde-fous d'authoring (le gros de la validation vit dans les tests vitest) ─────────────
const ids = new Set();
for (const s of scenes) {
  if (ids.has(s.id)) throw new Error(`id de scène dupliqué : ${s.id}`);
  ids.add(s.id);
  const starts = s.entities.filter((e) => e.kind === 'heroStart');
  if (starts.length !== 1) throw new Error(`${s.id} : ${starts.length} heroStart (1 attendu)`);
}
for (const p of worldMap.places) if (!ids.has(p.scene)) throw new Error(`carte : lieu ${p.id} → scène inconnue ${p.scene}`);

return projectDoc({
  identite: { id: 'arene', label: 'L’Arène', icon: 'scenario/arena', versionContenu: 1, maison: "bac à sable de combat authoré pour le jeu — aucun livre ne publie cette arène ; les créatures, armes et règles qu'elle compose portent chacune sa propre source" },
  scenes,
  worldMap,
});
}

/** Chemin de l'artefact écrit par le CLI — lu aussi par la garde byte-stable. */
export const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../src/scenes/arene/arene-projet.json');

if (import.meta.main) {
  const doc = build();
  writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
  console.log(`arene-projet.json : ${doc.scenes.length} scènes, ${doc.worldMap.places.length} lieux, ${doc.worldMap.routes.length} routes.`);
}
