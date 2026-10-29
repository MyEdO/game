/**
 * Migration #1467 L1b V-P1 (G3) — `donnees.manifest.json` : les 11 rubriques reçoivent leur `id`.
 *
 * MOTIF MESURÉ : `scripts/docs/build-donnees.mjs` BRANCHAIT sur le libellé
 * (`r.label === 'Contenu de campagne / interlude / rencontres'`) pour décider d'imprimer
 * `narratifNote`. C'est une LOGIQUE keyée par un texte d'affichage — CLAUDE.md : « Toute LOGIQUE est
 * keyée par id STABLE — le `label` est de l'AFFICHAGE ». Reformuler ce libellé (une virgule, un
 * accent) éteignait la note SANS UN MOT (MESURÉ : la note entière disparaît du doc généré).
 *
 * DEUX GESTES, un seul motif — l'identité PUIS l'extinction du branchement :
 *  (1) les 11 rubriques reçoivent leur `id` ;
 *  (2) `narratifNote` (scalaire de RACINE, porté par le document entier alors qu'il ne décrit QU'UNE
 *      rubrique) devient le champ `note` DE CETTE RUBRIQUE. Le générateur n'a plus de cas particulier
 *      à connaître : il imprime la `note` de toute rubrique qui en porte une. C'est la forme que le
 *      garde #842 prescrit — « le comportement particulier se déclare en CHAMP sur l'entrée, jamais
 *      en test d'id » — et un `if (r.id === '…')` y aurait été la MÊME faute que le test de libellé,
 *      d'un cran plus stable seulement. Toute rubrique peut désormais porter sa note.
 *
 * SLUGS : kebab-case COURTS, dérivés du sens de la rubrique et non de la ponctuation de son libellé
 * (un slug qui recopierait le libellé rejouerait la même fragilité). Table EXPLICITE ci-dessous,
 * appariée au libellé ATTENDU : si un libellé a bougé, la migration s'arrête au lieu de deviner.
 *
 * ENTRÉES : `src/data/donnees.manifest.json` (la seule donnée lue et écrite).
 *
 * FORME D'AVANT SEULE : seule une rubrique SANS `id` reçoit le sien, et la note ne se déplace que tant
 * que `narratifNote` est à la racine ; une rubrique absente, déjà migrée ou révisée après la migration est
 * laissée telle quelle ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : rubrique sans `id` au libellé inconnu de la table, collision d'ids posés, note de racine
 * sans porteuse ou de forme inattendue → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/donnees.manifest.json');

/** libellé ATTENDU → `id` de rubrique. L'appariement est explicite : aucun slug n'est dérivé au vol. */
const IDS = new Map([
  ['Personnage — fiche & progression', 'personnage'],
  ['Magie & religion', 'magie-religion'],
  ['Combat & résolution', 'combat'],
  ['Santé — blessures, maladies, corruption', 'sante'],
  ['Objets & équipement', 'objets'],
  ['Bestiaire', 'bestiaire'],
  ['Monde, voyage terrestre & temps', 'monde-voyage'],
  ['Naval & fluvial (*Mer des Griffes* · *Mort sur le Reik*)', 'naval-fluvial'],
  ['Contenu de campagne / interlude / rencontres', 'campagne'],
  ['Rendu / apparence / décor (NON-règles)', 'rendu-apparence'],
  ['Méta', 'meta'],
]);

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (serializeDataset(data) !== brut) {
  console.error('FORME NON CANONIQUE — src/data/donnees.manifest.json n’est pas `JSON.stringify(doc, null, 2)` ; AUCUNE écriture.');
  process.exit(1);
}

const echecs = [];
const migres = [];
const dejaMigres = [];

if (Array.isArray(data.rubriques)) {
  data.rubriques = data.rubriques.map((r, i) => {
    if (r.id !== undefined) {
      dejaMigres.push(r.id);
      return r;
    }
    const attendu = IDS.get(r.label);
    if (!attendu) {
      echecs.push(`rubrique #${i} : libellé ${JSON.stringify(r.label)} inconnu de la table d’ids — arbitrage requis`);
      return r;
    }
    migres.push(attendu);
    // `id` en PREMIÈRE clé — l'identité ouvre l'entrée.
    return { id: attendu, ...r };
  });

  const ids = data.rubriques.map((r) => r.id).filter((v) => typeof v === 'string');
  if (migres.length && new Set(ids).size !== ids.length) echecs.push(`ids de rubrique en collision : ${ids.join(', ')}`);
}

/** Rubrique à laquelle appartient la note de racine — son SEUL sujet (le bloc `narratif` d'un paquet
 *  de campagne), vérifié au texte avant déplacement. */
const PORTEUSE_DE_LA_NOTE = 'campagne';
let noteDeplacee = false;

if (!echecs.length && data.narratifNote !== undefined) {
  const cible = Array.isArray(data.rubriques) ? data.rubriques.find((r) => r.id === PORTEUSE_DE_LA_NOTE) : undefined;
  if (!cible) {
    echecs.push(`rubrique « ${PORTEUSE_DE_LA_NOTE} » introuvable : la note de racine n'a pas de porteuse`);
  } else if (typeof data.narratifNote === 'string') {
    if (cible.note !== undefined) {
      echecs.push(`rubrique « ${PORTEUSE_DE_LA_NOTE} » : porte DÉJÀ une \`note\` alors que \`narratifNote\` existe encore — arbitrage requis`);
    } else {
      // `note` se pose APRÈS `label`, avant la charge utile `entrees` : l'élément est REMPLACÉ
      // (un `Object.assign` laisserait la clé neuve en fin d'objet).
      const { id, label, ...reste } = cible;
      data.rubriques[data.rubriques.indexOf(cible)] = { id, label, note: data.narratifNote, ...reste };
      delete data.narratifNote;
      noteDeplacee = true;
    }
  } else {
    echecs.push(`\`narratifNote\` de forme inattendue ${JSON.stringify(data.narratifNote)} (chaîne attendue)`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = serializeDataset(data);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : chaque rubrique migrée porte SON id, et la note déplacée a sa porteuse.
const apres = JSON.parse(out);
const rubriques = apres.rubriques ?? [];
const fautifs = rubriques.filter((r) => migres.includes(r.id) && r.id !== IDS.get(r.label));
const porteuse = rubriques.find((r) => r.id === PORTEUSE_DE_LA_NOTE);
if (fautifs.length || apres.narratifNote !== undefined || (noteDeplacee && !porteuse?.note)) {
  console.error(
    `VÉRIFICATION POST-ÉCRITURE ROUGE : ${fautifs.length} id(s) fautif(s) [${fautifs.map((r) => r.label).join(', ')}] ; ` +
      `\`narratifNote\` de racine ${apres.narratifNote === undefined ? 'absente (OK)' : 'ENCORE PRÉSENTE'} ; ` +
      `note portée par « ${PORTEUSE_DE_LA_NOTE} » : ${porteuse?.note ? 'oui' : 'NON'}`,
  );
  process.exit(1);
}

console.log(`donnees.manifest.json — \`id\` de rubrique posé : ${migres.length}`);
for (const r of rubriques) console.log(`  ${String(r.id).padEnd(18)} ${r.label}`);
console.log(`Déjà migrées (no-op) : ${dejaMigres.length}`);
console.log(`\`narratifNote\` de racine → \`note\` de la rubrique « ${PORTEUSE_DE_LA_NOTE} » : ${noteDeplacee ? 'DÉPLACÉE' : 'déjà en place (no-op)'}`);
console.log(`Rubriques : ${rubriques.length} ; ids distincts : ${new Set(rubriques.map((r) => r.id)).size}`);
console.log(`Fichier ${out !== brut ? 'réécrit' : 'INCHANGÉ'} : src/data/donnees.manifest.json`);
