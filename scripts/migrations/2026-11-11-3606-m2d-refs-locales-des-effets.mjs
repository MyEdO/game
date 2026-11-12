/**
 * Migration #3606 M2d — les références LOCALES des effets de scène sont emboîtées : un id nu devient `{ id }`, à la même
 * clé, jugé contre la collection de la scène qui les porte (`PORTEES_DE_LA_SCENE`, `defs-scenes/communs.ts`).
 *
 *   effet            clés                    collection de la scène
 *   `startDialogue`  `dialogue`              `dialogues`
 *                    `speakerId`             `entities`
 *   `openMerchant`   `entityId`              `entities`
 *   `medicalAid`     `entityId`              `entities`
 *
 * Entrées : chaque `src/data/*.json` (`readdirSync`) et chaque `src/scenes/<campagne>/<campagne>-projet.json` ; tout
 * effet de ces sortes, où qu'il soit dans le document, sous la scène (`type: 'scene'`) la plus proche.
 *
 * Une entrée absente passe sans faute : un effet déjà `{ id }`, ou sans la clé, n'a aucun geste. Une valeur ni chaîne ni
 * `{ id }` seul, un id absent de la collection de sa scène, un effet hors de toute scène, ou un document non canonique
 * sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { emboiterLesRefsDOps } from './lib/refsDOpsEmboitees.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIALOGUES = { collection: 'dialogues', catalogue: 'dialogues de la scène' };
const ENTITES = { collection: 'entities', catalogue: 'entités de la scène' };

const canoniqueDeScene = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
emboiterLesRefsDOps(
  ROOT,
  [
    ...readdirSync(join(ROOT, 'src/data')).filter((f) => f.endsWith('.json')).map((f) => ({ rel: `src/data/${f}`, canonique: serializeDataset })),
    ...readdirSync(join(ROOT, 'src/scenes'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src/scenes', d.name, `${d.name}-projet.json`)))
      .map((d) => ({ rel: `src/scenes/${d.name}/${d.name}-projet.json`, canonique: canoniqueDeScene })),
  ],
  { startDialogue: { dialogue: DIALOGUES, speakerId: ENTITES }, openMerchant: { entityId: ENTITES }, medicalAid: { entityId: ENTITES } },
  'migration 3606 M2d (références locales des effets emboîtées)',
  { discriminant: 'type', ouvre: (n) => n.type === 'scene' },
);
