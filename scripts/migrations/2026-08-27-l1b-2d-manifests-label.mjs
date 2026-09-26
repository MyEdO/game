/**
 * Migration #1467 L1b V-P1 — les 3 manifestes d'outillage : la clé d'AFFICHAGE `nom` devient `label`.
 *
 * MOTIF MESURÉ : `label` est le nom canonique du libellé d'affichage dans l'enveloppe de document
 * (`src/data/schemas/grammaire/document.ts`) ; `nom` en était une graphie divergente, inscrite au
 * stock des structures (`scripts/guards/lib/structuresStock.mjs`, rôle « libellé », motif « clé
 * divergente »). Le nom du CHAMP change, les VALEURS ne changent pas : les docs générés qui les
 * impriment (`docs/systemes.md`, `docs/donnees.md`) doivent sortir byte-stables.
 *
 * PORTEURS ET CHEMINS (mesurés, 0 champ `label` préexistant sur ces chemins — donc 0 collision) :
 *  - `primitives.manifest.json` : 30 entrées de premier niveau (28 → 30, #1728 : `itemIcon` et
 *    `mediaSelect` entrent au manifeste, de la MÊME forme que les 28 autres) ;
 *  - `systemes.manifest.json`   : 16 entrées de premier niveau ;
 *  - `donnees.manifest.json`    : 11 entrées de `rubriques` (document de famille `config` — il n'a
 *    PAS de `nom` de premier niveau ; les `mot`/`desc`/`lecon` des homonymes sont d'autres champs).
 *
 * POSITION PRÉSERVÉE : `label` prend la place exacte qu'occupait `nom` dans l'entrée.
 *
 * ENTRÉES : `src/data/primitives.manifest.json`, `src/data/systemes.manifest.json`,
 * `src/data/donnees.manifest.json` (les seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `label` (et plus de `nom`) est
 * reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `nom` ET `label`, entrée sans ni l'un ni l'autre, `nom` non-chaîne ou
 * vide, compte d'entrées divergent de l'attendu → rien n'est écrit (pour AUCUN des 3 fichiers),
 * sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Les 3 porteurs : fichier, sélecteur des entrées PORTEUSES du libellé, et compte ATTENDU. */
const PORTEURS = [
  // 30 → 62 (#1728) : les entrées de la table CLAUDE.md sont portées au manifeste, de la MÊME forme
  // que les 30 autres — primitives EXISTANTES ; le périmètre mesuré suit, à l'ÉGALITÉ.
  { fichier: 'src/data/primitives.manifest.json', entrees: (d) => d, attendu: 62 },
  { fichier: 'src/data/systemes.manifest.json', entrees: (d) => d, attendu: 16 },
  { fichier: 'src/data/donnees.manifest.json', entrees: (d) => d.rubriques, attendu: 11 },
];

const echecs = [];
/** @type {{ chemin: string, brut: string, out: string, migres: string[], dejaMigres: string[] }[]} */
const plans = [];

for (const { fichier, entrees, attendu } of PORTEURS) {
  const chemin = path.join(ROOT, fichier);
  const brut = fs.readFileSync(chemin, 'utf8');
  const data = JSON.parse(brut);

  if (JSON.stringify(data, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }

  const liste = entrees(data);
  if (!Array.isArray(liste)) {
    echecs.push(`${fichier} : les entrées porteuses du libellé sont introuvables (chemin de sélection vide)`);
    continue;
  }
  if (liste.length !== attendu) {
    echecs.push(`${fichier} : ${liste.length} entrée(s) porteuse(s), ${attendu} attendue(s) — périmètre déplacé`);
    continue;
  }

  const migres = [];
  const dejaMigres = [];
  // Renommage EN PLACE, entrée par entrée : `label` occupe la position exacte de `nom`.
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    const aNom = e?.nom !== undefined;
    const aLabel = e?.label !== undefined;
    if (aNom && aLabel) {
      echecs.push(`${fichier} #${i} : porte À LA FOIS \`nom\` (${JSON.stringify(e.nom)}) et \`label\` (${JSON.stringify(e.label)}) — arbitrage requis`);
      continue;
    }
    if (!aNom && !aLabel) {
      echecs.push(`${fichier} #${i} : ni \`nom\` ni \`label\` — libellé PERDU`);
      continue;
    }
    if (aLabel) { dejaMigres.push(e.label); continue; }
    if (typeof e.nom !== 'string' || !e.nom) {
      echecs.push(`${fichier} #${i} : \`nom\` de forme inattendue ${JSON.stringify(e.nom)} (chaîne non vide attendue)`);
      continue;
    }
    migres.push(e.nom);
    liste[i] = Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'nom' ? 'label' : k, v]));
  }

  plans.push({ fichier, chemin, brut, out: JSON.stringify(data, null, 2), migres, dejaMigres, liste: entrees(data) });
}

// Écriture TOUT OU RIEN : une anomalie sur un seul porteur laisse les trois fichiers intacts.
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture (les 3 fichiers restent intacts) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const p of plans) if (p.out !== p.brut) fs.writeFileSync(p.chemin, p.out, 'utf8');

// PREUVE post-écriture : plus aucun `nom` sur les chemins porteurs, chaque entrée porte un `label`.
const rouges = [];
for (const p of plans) {
  const residus = p.liste.filter((e) => e.nom !== undefined).length;
  const sansLabel = p.liste.filter((e) => typeof e.label !== 'string' || !e.label).length;
  if (residus || sansLabel) rouges.push(`${p.fichier} : ${residus} \`nom\` résiduel(s), ${sansLabel} sans \`label\``);
}
if (rouges.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE :\n  ${rouges.join('\n  ')}`);
  process.exit(1);
}

for (const p of plans) {
  console.log(`${p.fichier} — \`nom\` → \`label\` : ${p.migres.length} ; déjà migrées (no-op) : ${p.dejaMigres.length} ; ${p.out !== p.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
console.log(`Total : ${plans.reduce((n, p) => n + p.migres.length, 0)} libellé(s) renommé(s) ; \`nom\` restant sur les chemins porteurs : 0 ; aucune valeur modifiée.`);
