/**
 * Migration #3606 M4b — les références d'une rencontre à ses membres sont emboîtées : un id nu devient `{ id }`, à la
 * même clé, jugé contre les membres de la rencontre qui les porte (`MEMBRES_DE_LA_RENCONTRE`,
 * `MONTURES_DE_LA_RENCONTRE`, `defs-scenes/scene.ts`).
 *
 *   site                                              collection de la rencontre
 *   `encounters[].victoryCondition.targetId`          `members` (par `entityId`)
 *   `encounters[].members[].ridesEntityId`            `members` (par `entityId`) qui portent `mount`
 *
 * Entrées : chaque `src/scenes/<campagne>/<campagne>-projet.json`, chaque rencontre de chacune de ses scènes.
 *
 * Une entrée déjà `{ id }`, ou sans la clé, n'a aucun geste. Une valeur ni chaîne ni `{ id }` seul, un id absent des
 * membres (des montures) de sa rencontre, ou un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE
 * écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const idDe = (v) => (typeof v === 'string' ? v : v !== null && typeof v === 'object' && Object.keys(v).length === 1 && typeof v.id === 'string' ? v.id : undefined);

const documents = readdirSync(join(ROOT, 'src/scenes'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src/scenes', d.name, `${d.name}-projet.json`)))
  .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`);

const arrets = [];
const ecritures = [];
let gestes = 0;
for (const rel of documents) {
  const brut = readFileSync(join(ROOT, rel), 'utf8');
  const doc = JSON.parse(brut);
  let ici = 0;
  /** Emboîte `porteur[cle]` s'il est un id nu parmi `admis`, sous le nom `lieu` pour l'arrêt. */
  const emboiter = (porteur, cle, admis, catalogue, lieu) => {
    const v = porteur[cle];
    if (v === undefined) return;
    const id = idDe(v);
    if (id === undefined) arrets.push(`${rel} ${lieu}.${cle} : ni chaîne ni { id }`);
    else if (!admis.has(id)) arrets.push(`${rel} ${lieu}.${cle} : « ${id} » absent des ${catalogue}`);
    else if (typeof v === 'string') {
      porteur[cle] = { id };
      ici++;
    }
  };
  for (const scene of doc.scenes ?? [])
    for (const enc of scene.encounters ?? []) {
      const membres = enc.members ?? [];
      const lieu = `${scene.id}/${enc.id}`;
      if (enc.victoryCondition) emboiter(enc.victoryCondition, 'targetId', new Set(membres.map((m) => m.entityId)), 'membres de la rencontre', `${lieu}.victoryCondition`);
      const montures = new Set(membres.filter((m) => m.mount).map((m) => m.entityId));
      for (const m of membres) emboiter(m, 'ridesEntityId', montures, 'montures de la rencontre', `${lieu}.members[${m.entityId}]`);
    }
  if (ici === 0) continue;
  if (brut !== canonique(JSON.parse(brut))) arrets.push(`${rel} : forme non canonique`);
  ecritures.push([rel, canonique(doc)]);
  gestes += ici;
}
if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [rel, texte] of ecritures) writeFileSync(join(ROOT, rel), texte, 'utf8');
console.log(`migration 3606 M4b (références d'une rencontre à ses membres emboîtées) : ${gestes} référence(s), ${ecritures.length} fichier(s).`);
