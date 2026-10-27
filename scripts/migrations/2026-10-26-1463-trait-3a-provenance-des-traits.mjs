/**
 * Migration #1463 (PR-3a du Trait posé) — la provenance d'une valeur de Trait que l'entrée qui la porte ne
 * fonde pas.
 *
 * GESTE, sur `creatures.json` : l'instance de `VALEURS_VO` (profil VF cité ligne par ligne) prend la valeur
 * que la VO imprime, avec sa `source` et son `alsoIn` sur l'instance (doctrine
 * `user-doctrine-vo-fournit-la-donnee-mecanique-absente-de-la-vf`), aux autres champs recopiés.
 *
 * ENTRÉES : écrite — `src/data/creatures.json` ; aucun autre fichier n'est lu.
 * FAIL-FAST — avant toute écriture, sortie 1 : un hôte ou une liste introuvable ; une liste qui ne porte ni
 * l'instance d'origine ni l'instance migrée ; un fichier hors de son formatage.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const CREATURES = 'src/data/creatures.json';

/** Instance `{ trait, arg: avant }` de `hote.liste` → `{ trait, arg: apres, ...provenance }`. */
const VALEURS_VO = [
  // LDB 78 l.15 ; LDB 12 l.147
  {
    hote: 'araignee-geante', liste: 'optionals', trait: 'venin', avant: 'Moyen', apres: 'accessible',
    provenance: {
      // CRB 105 l.161
      source: { book: 'core-rulebook-5e', page: 326, note: 'CRB 105 l.161' },
      // CRB 116 l.27 — le span du folio n'imprime pas le nom du Trait : la `quote` ATTESTE
      // l'emplacement (`auditSecondaries`, scripts/guards/lib/folioIntegrity.mjs).
      alsoIn: [{ book: 'core-rulebook-5e', page: 364, note: 'CRB 116 l.27', quote: 'Average (+20) | Average (+2 SL)' }],
    },
  },
];

const fautes = [];
const docs = new Map();
for (const rel of [CREATURES]) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte });
}

let gestes = 0;
for (const { hote, liste, trait, avant, apres, provenance } of VALEURS_VO) {
  const l = docs.get(CREATURES).doc.find((e) => e.id === hote)?.[liste];
  if (!Array.isArray(l)) {
    fautes.push(`${CREATURES} : ${hote}.${liste} introuvable`);
    continue;
  }
  const i = l.findIndex((x) => x.id === trait && x.arg === avant);
  if (i >= 0) {
    l[i] = { ...l[i], arg: apres, ...provenance };
    gestes++;
  } else if (!l.some((x) => x.id === trait && x.arg === apres)) {
    fautes.push(`${CREATURES} : ${hote}.${liste} ne porte ni ${trait} « ${avant} » ni ${trait} « ${apres} »`);
  }
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait-3a : ${gestes} geste(s).`);
