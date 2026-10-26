/**
 * Migration #1463 (PR-3a du Trait posé) — la provenance d'une valeur de Trait que l'entrée qui la porte ne
 * fonde pas.
 *
 * GESTES :
 *  1. `creatures.json` : l'instance de `VALEURS_VO` (profil VF cité ligne par ligne) prend la valeur que la VO
 *     imprime, avec sa `source` et son `alsoIn` sur l'instance (doctrine
 *     `user-doctrine-vo-fournit-la-donnee-mecanique-absente-de-la-vf`), aux autres champs recopiés.
 *  2. `traits.json` : l'entrée de `LECTURES_MAISON` reçoit la raison `maison` de la lecture que le moteur en fait.
 *
 * ENTRÉES : écrites — `src/data/creatures.json`, `src/data/traits.json` ; aucun autre fichier n'est lu.
 * FAIL-FAST — avant toute écriture, sortie 1 : un hôte ou une liste introuvable ; une liste qui ne porte ni
 * l'instance d'origine ni l'instance migrée ; une entrée de `traits.json` qui porte une AUTRE raison `maison` ;
 * un fichier hors de son formatage.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis un script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

const CREATURES = 'src/data/creatures.json';
const TRAITS = 'src/data/traits.json';

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

/** Raison `maison` d'une entrée de `traits.json`. */
const LECTURES_MAISON = [
  // LDB 85 l.37-39 ; LDB 63 l.13 ; MCLB 02 l.85-87, l.101 ; EDOC 10 l.106, l.130
  {
    id: 'armure',
    maison: 'Un Aspect qui nomme des pièces d’armure (« Plastron et heaume », « Veste de cuir », « Chemise de mailles ») ne restreint pas l’Indice : il vaut à toutes les Localisations (LDB 85 l.39), et non aux seuls Emplacements des pièces nommées (LDB 63 l.13). Lecture proposée en cérémonie (#1463).',
  },
];

const fautes = [];
const docs = new Map();
for (const rel of [CREATURES, TRAITS]) {
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

for (const { id, maison } of LECTURES_MAISON) {
  const e = docs.get(TRAITS).doc.find((t) => t.id === id);
  if (!e) fautes.push(`${TRAITS} : ${id} introuvable`);
  else if (e.maison === undefined) {
    e.maison = maison;
    gestes++;
  } else if (e.maison !== maison) fautes.push(`${TRAITS} : ${id} porte une autre raison maison`);
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
