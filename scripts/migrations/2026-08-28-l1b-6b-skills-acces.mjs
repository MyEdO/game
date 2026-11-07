/**
 * Migration #1467 L1b V-P5 — `skills.json` : le discriminant `type` devient `acces`, et sa valeur
 * `avancée` devient `avancee`.
 *
 * MOTIF MESURÉ : le champ départage les Compétences utilisables sans formation de celles qui
 * exigent une Augmentation (`LDB 09 l.25/l.30`) — mesuré 25 `base` / 23 `avancée` sur 48 entrées.
 * C'est un ACCÈS, et c'est un DISCRIMINANT DE LOGIQUE : `engine/skillCombatApps.ts:32`
 * (`possesses`) et `engine/activities.ts:762` (coût de tuteur) y branchent. Un discriminant de
 * logique ne porte pas d'accent : la valeur passe en `avancee`, l'accent redevient de l'AFFICHAGE.
 *
 * POSITION PRÉSERVÉE : `acces` prend la place exacte qu'occupait `type` dans l'entrée.
 *
 * ENTRÉES : `src/data/skills.json` (la seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `acces` (et plus de `type`) est
 * reconnue migrée, quelle que soit la graphie déjà normalisée ; rejouée sur l'état final, la
 * migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant `type` ET `acces`, entrée sans ni l'un ni l'autre, valeur hors
 * {base, avancée, avancee}, racine VIDE → rien n'est écrit, sortie 1. JAMAIS un cardinal (#1812) :
 * le catalogue des Compétences porte déjà des entrées de plusieurs livres FR et grandit avec eux.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/skills.json');
/** Ancienne graphie → valeur normalisée. L'espace de valeurs reste binaire. */
const NORMALISE = { base: 'base', 'avancée': 'avancee', avancee: 'avancee' };

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/skills.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
if (!Array.isArray(data)) echecs.push('racine non tableau');
else if (!data.length) echecs.push('racine VIDE — périmètre déplacé');

let migres = 0;
let dejaMigres = 0;

/**
 * `type` D'ENVELOPPE (#1467 L1b V-FLIP-ENTITE-b) : depuis l'adoption de `document()`, chaque entrée
 * porte `type: "skills"` — le NOM DU DOCUMENT, pas l'ancien accès. Sans cette distinction, la
 * migration lisait l'enveloppe comme un `type` ressuscité et exigeait un arbitrage sur les 48 entrées.
 * L'ancien `type` était une clé de `NORMALISE` ({base, avancée, avancee}), jamais le nom du dataset.
 */
const TYPE_ENVELOPPE = 'skills';
const typeAncien = (e) => (e?.type !== undefined && e.type !== TYPE_ENVELOPPE ? e.type : undefined);

const sortie = Array.isArray(data)
  ? data.map((e, i) => {
      const aType = typeAncien(e) !== undefined;
      const aAcces = e?.acces !== undefined;
      if (aType && aAcces) { echecs.push(`entrée #${i} (${e.id}) : porte À LA FOIS \`type\` et \`acces\` — arbitrage requis`); return e; }
      if (!aType && !aAcces) { echecs.push(`entrée #${i} (${e?.id}) : ni \`type\` ni \`acces\` — accès PERDU`); return e; }
      const brute = aAcces ? e.acces : typeAncien(e);
      const norm = NORMALISE[brute];
      if (norm === undefined) { echecs.push(`entrée #${i} (${e.id}) : accès ${JSON.stringify(brute)} hors {base, avancée, avancee}`); return e; }
      if (aAcces) {
        if (e.acces !== norm) { echecs.push(`entrée #${i} (${e.id}) : \`acces\` déjà posé mais NON normalisé (${JSON.stringify(e.acces)})`); return e; }
        dejaMigres++;
        return e;
      }
      migres++;
      return Object.fromEntries(Object.entries(e).map(([k, v]) => (k === 'type' ? ['acces', norm] : [k, v])));
    })
  : data;

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : plus aucun ANCIEN `type`, l'accent est mort, la PARTITION est conservée
// entrée par entrée. Le `type` d'ENVELOPPE, lui, est attendu et ne compte pas pour un résidu.
const apres = JSON.parse(out);
const residus = apres.filter((e) => typeAncien(e) !== undefined).length;
const avant = data.map((e) => NORMALISE[typeAncien(e) ?? e.acces]).join(',');
const rendu = apres.map((e) => e.acces).join(',');
const accents = apres.filter((e) => e.acces === 'avancée').length;
if (residus || accents || avant !== rendu || apres.length !== data.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residus} \`type\` résiduel(s), ${accents} valeur(s) accentuée(s), ${apres.length} entrée(s), partition ${avant === rendu ? 'conservée' : 'ALTÉRÉE'}`);
  process.exit(1);
}

const parAcces = apres.reduce((m, e) => ({ ...m, [e.acces]: (m[e.acces] ?? 0) + 1 }), {});
console.log(`skills.json — \`type\` → \`acces\` (+ \`avancée\` → \`avancee\`) : ${migres} migrée(s), ${dejaMigres} déjà migrée(s)`);
console.log(`Entrées : ${apres.length} ; ancien \`type\` restant : 0 ; répartition ${JSON.stringify(parAcces)}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/skills.json`);
