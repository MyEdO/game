/**
 * Migration #1467 L1b V-P3 — MORT des méta libres de commentaire : `_comment` de `grapple.json`,
 * `_doc` de `speciesRace.json`.
 *
 * MOTIF : ces deux clés sont de la PROSE d'atelier logée dans la donnée — jamais lues par un
 * runtime (les deux documents sont consommés par cast `as` sur les champs mécaniques). La doc d'un
 * document vit dans son def (`src/data/schemas/defs/*.ts`), et git porte l'historique. Les
 * déclarations correspondantes meurent des deux defs dans le MÊME commit : le `strictObject` refuse
 * dès lors la clé par construction, aucune n'a besoin d'un détecteur.
 *
 * ENTRÉES : `src/data/grapple.json`, `src/data/speciesRace.json` (les seules données lues et
 * écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un document déjà sans sa méta libre est reconnu migré ;
 * rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : méta libre d'un type autre que chaîne, ou ancre textuelle introuvable / non unique
 * alors que la clé EST présente structurellement → rien n'est écrit, sortie 1. TOUT-OU-RIEN : les
 * deux documents sont calculés et vérifiés AVANT la première écriture.
 * FORMATAGE PRÉSERVÉ : suppression TEXTUELLE de la ligne porteuse — aucun `JSON.stringify` du
 * document.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** @type {[string, string][]} document → clé de méta libre à supprimer */
const CIBLES = [
  ['src/data/grapple.json', '_comment'],
  ['src/data/speciesRace.json', '_doc'],
];

const echecs = [];
/** Écritures PRÊTES — rien n'est posé sur le disque avant que les DEUX documents soient vérifiés. */
const aEcrire = [];
const migres = [];
const dejaMigres = [];

for (const [rel, cle] of CIBLES) {
  const abs = path.join(ROOT, rel);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);

  if (data[cle] === undefined) {
    dejaMigres.push(`${rel} (${cle})`);
    continue;
  }
  if (typeof data[cle] !== 'string') {
    echecs.push(`${rel} : \`${cle}\` de type ${typeof data[cle]} (chaîne attendue) — forme inattendue`);
    continue;
  }

  // Ligne ENTIÈRE porteuse de la clé, virgule comprise (la méta est toujours la 1re propriété).
  const motif = new RegExp(`^[ \\t]*"${cle}":[ ]"(?:[^"\\\\]|\\\\.)*",\\r?\\n`, 'm');
  const trouvees = brut.split('\n').filter((l) => new RegExp(`^[ \\t]*"${cle}":`).test(l)).length;
  if (trouvees !== 1 || !motif.test(brut)) {
    echecs.push(`${rel} : ancre textuelle de \`${cle}\` introuvable ou non unique (${trouvees} ligne(s))`);
    continue;
  }

  const out = brut.replace(motif, '');
  const apres = JSON.parse(out);
  if (apres[cle] !== undefined) {
    echecs.push(`${rel} : \`${cle}\` survit à la réécriture`);
    continue;
  }
  // La charge utile est INTACTE : seules les clés diffèrent, d'exactement la méta libre.
  const attendu = { ...data };
  delete attendu[cle];
  if (JSON.stringify(apres) !== JSON.stringify(attendu)) {
    echecs.push(`${rel} : la charge utile a bougé au-delà de \`${cle}\``);
    continue;
  }

  aEcrire.push([abs, out]);
  migres.push(`${rel} (${cle})`);
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const [abs, out] of aEcrire) fs.writeFileSync(abs, out, 'utf8');

console.log(`Méta libres supprimées : ${migres.length}`);
for (const m of migres) console.log(`  ${m}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}${dejaMigres.length ? ` — ${dejaMigres.join(', ')}` : ''}`);
