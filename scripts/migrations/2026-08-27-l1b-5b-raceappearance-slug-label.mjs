/**
 * Migration #1467 L1b V-P4 — `raceAppearance.json` : l'`id` devient un SLUG, l'ancien id devient le
 * `label` ; la race par défaut de `speciesRace.json` suit dans le MÊME passage.
 *
 * MOTIF MESURÉ : les 21 races d'apparence portaient un `id` capitalisé en français (« Haut-Elfe »,
 * « Homme-bête », « Guerrier du Chaos »…) — un LIBELLÉ tenant lieu d'identité, et aucune entrée ne
 * portait de `label` (stock des structures, rôle « libellé », motif « clé absente », 21 entrées).
 * L'id passe au slug canonique et le libellé d'affichage prend le champ qui lui revient.
 * `speciesRace.json` (`default`) désigne CES ids : sa valeur est convertie dans le même geste.
 *
 * SLUG : mécanique RECOPIÉE de `slugId` (`src/data/slug.ts:7-15`) — NFD + retrait des diacritiques,
 * minuscules, œ/æ, `[^a-z0-9]+` → `-`, tirets de bord retirés. Recopiée et non importée : une
 * migration ne dépend d'aucun module du jeu (le TS n'est pas exécutable ici).
 *
 * ENTRÉES : `src/data/raceAppearance.json`, `src/data/speciesRace.json` (les seules données lues et
 * écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée dont l'`id` est déjà son propre slug ET qui
 * porte un `label` est reconnue migrée ; une valeur de `speciesRace` déjà slug est reconnue migrée ;
 * rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : `id` absent/non-chaîne, `label` préexistant en désaccord avec l'id d'origine, slugs en
 * collision, valeur de `speciesRace` ne résolvant vers AUCUN id (ni ancien ni neuf) → rien n'est
 * écrit (pour AUCUN des deux fichiers), sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** `slugId` de `src/data/slug.ts:7-15`, recopié à l'identique (mécanique, pas paraphrase). */
const slugId = (label) =>
  label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const echecs = [];

function lire(fichier) {
  const chemin = path.join(ROOT, fichier);
  const brut = fs.readFileSync(chemin, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    return null;
  }
  return { fichier, chemin, brut, data };
}

const races = lire('src/data/raceAppearance.json');
const pont = lire('src/data/speciesRace.json');
if (echecs.length || !races || !pont) {
  console.error(`ARBITRAGE REQUIS — AUCUNE écriture :\n  ${echecs.join('\n  ')}`);
  process.exit(1);
}

/** Ancien id (ou label) → id neuf. Sert aussi à convertir `speciesRace.json`. */
const idNeufPar = new Map();
const migres = [];
const dejaMigres = [];

const sortieRaces = races.data.map((e, i) => {
  if (typeof e?.id !== 'string' || !e.id) {
    echecs.push(`raceAppearance #${i} : \`id\` absent ou de forme inattendue ${JSON.stringify(e?.id)}`);
    return e;
  }
  const aLabel = typeof e.label === 'string' && e.label.length > 0;
  if (aLabel && e.id === slugId(e.label)) {
    // Déjà migrée : l'id EST le slug de son libellé.
    idNeufPar.set(e.id, e.id);
    idNeufPar.set(e.label, e.id);
    dejaMigres.push(e.id);
    return e;
  }
  if (aLabel) {
    echecs.push(`raceAppearance #${i} : \`label\` ${JSON.stringify(e.label)} préexistant en désaccord avec l'id ${JSON.stringify(e.id)} (slug attendu ${JSON.stringify(slugId(e.label))}) — arbitrage requis`);
    return e;
  }
  const ancien = e.id;
  const neuf = slugId(ancien);
  if (!neuf) {
    echecs.push(`raceAppearance #${i} : l'id ${JSON.stringify(ancien)} sluguerait en chaîne vide`);
    return e;
  }
  idNeufPar.set(ancien, neuf);
  migres.push(`${ancien} → ${neuf}`);
  // `label` prend la place JUSTE APRÈS `id` ; l'ordre des autres champs est préservé.
  return Object.fromEntries(
    Object.entries(e).flatMap(([k, v]) => (k === 'id' ? [['id', neuf], ['label', ancien]] : [[k, v]])),
  );
});

const idsNeufs = sortieRaces.map((e) => e.id);
if (new Set(idsNeufs).size !== idsNeufs.length) echecs.push(`raceAppearance : ids en collision après slugging (${idsNeufs.join(', ')})`);

/** Convertit une valeur `race` de `speciesRace.json` vers l'id neuf. */
const convertirRace = (valeur, ou) => {
  const neuf = idNeufPar.get(valeur);
  if (neuf) return neuf;
  echecs.push(`speciesRace ${ou} : race ${JSON.stringify(valeur)} ne résout vers AUCUN id de raceAppearance (ni ancien, ni neuf)`);
  return valeur;
};

const sortiePont = { ...pont.data };
sortiePont.default = convertirRace(pont.data.default, '`default`');

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture (les 2 fichiers restent intacts) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const plans = [
  { ...races, out: JSON.stringify(sortieRaces, null, 2) },
  { ...pont, out: JSON.stringify(sortiePont, null, 2) },
];
for (const p of plans) if (p.out !== p.brut) fs.writeFileSync(p.chemin, p.out, 'utf8');

// PREUVE post-écriture : chaque id est le slug de son label, et TOUTE race citée par le pont existe.
const apresRaces = JSON.parse(plans[0].out);
const apresPont = JSON.parse(plans[1].out);
const rouges = [];
for (const e of apresRaces) {
  if (typeof e.label !== 'string' || !e.label) rouges.push(`raceAppearance ${e.id} : \`label\` absent`);
  else if (e.id !== slugId(e.label)) rouges.push(`raceAppearance ${e.id} : id ≠ slugId(label ${JSON.stringify(e.label)})`);
}
const existants = new Set(apresRaces.map((e) => e.id));
for (const [ou, v] of [['default', apresPont.default]])
  if (!existants.has(v)) rouges.push(`speciesRace ${ou} : race ${JSON.stringify(v)} absente de raceAppearance`);
if (rouges.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE :\n  ${rouges.join('\n  ')}`);
  process.exit(1);
}

console.log(`raceAppearance.json — id capitalisé → slug + \`label\` : ${migres.length} ; déjà migrées (no-op) : ${dejaMigres.length}`);
for (const m of migres) console.log(`  ${m}`);
console.log(`speciesRace.json : default = ${apresPont.default}, accordée à un id existant`);
console.log(`Fichiers : raceAppearance ${plans[0].out !== plans[0].brut ? 'réécrit' : 'INCHANGÉ'}, speciesRace ${plans[1].out !== plans[1].brut ? 'réécrit' : 'INCHANGÉ'}`);
