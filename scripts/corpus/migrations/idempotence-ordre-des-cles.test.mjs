/**
 * MORSURE — une migration DATÉE n'écrit que ce qu'elle POSSÈDE (#1657) : famille 1 du banc
 * `scripts/migrations/lib/idempotence-ordre-des-cles.test.mjs`.
 *
 *  1. NO-OP SUR CORPUS RENVERSÉ : `src/data` ENTIER est recopié dans un dépôt jetable, clés
 *     renversées document par document, puis TOUTES les migrations datées y sont rejouées une à une.
 *     Exigé : zéro réécriture (octet ET horodatage), et sortie 0 partout.
 *
 * CE QUE LE RENVERSEMENT PRÉSERVE : la TÊTE d'enveloppe, jamais la queue. Sur une entrée de racine
 * tableau, `id` reste en tête (l'invariant que les vagues 9 à 12 posent et vérifient) ; sur une
 * racine OBJET, c'est le préfixe de clés d'enveloppe (`CLES_ENVELOPPE`, dérivé de
 * `src/data/schemas/grammaire/document.ts`) qui reste en place — le défaire mesurerait la violation
 * d'un invariant que les migrations POSSÈDENT au lieu de l'ordre des AUTRES clés.
 */
import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { ANTIDATE, efface, joue } from '../../migrations/lib/joue.mjs'
import { DATEES, RACINE } from '../../test/lib/bancIdempotence.mjs'

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Les clés d'ENVELOPPE, dérivées du texte de la grammaire — jamais recopiées ici. */
const CLES_ENVELOPPE = (() => {
  const grammaire = fs.readFileSync(path.join(RACINE, 'src/data/schemas/grammaire/document.ts'), 'utf8');
  const m = /export const CLES_ENVELOPPE = \[([^\]]*)\]/.exec(grammaire);
  assert.ok(m, 'CLES_ENVELOPPE introuvable dans `src/data/schemas/grammaire/document.ts`');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/gu, '')).filter(Boolean);
})();

/** Une ENTRÉE aux clés renversées, `id` maintenu en tête (cf. en-tête). */
const renverseEntree = (e) => (estObjet(e)
  ? Object.fromEntries([['id', e.id], ...Object.entries(e).filter(([k]) => k !== 'id').reverse()]) : e);

/** Une RACINE OBJET aux clés renversées, son préfixe d'enveloppe maintenu en place (cf. en-tête). */
const renverseRacine = (doc) => {
  const cles = Object.keys(doc);
  let tete = 0;
  while (tete < cles.length && CLES_ENVELOPPE.includes(cles[tete])) tete++;
  return Object.fromEntries([
    ...cles.slice(0, tete).map((k) => [k, doc[k]]),
    ...cles.slice(tete).map((k) => [k, doc[k]]).reverse(),
  ]);
};

/** Le document, même contenu, AUTRE sérialisation. Ce qui n'est ni entrée ni racine à `id` passe. */
const renverse = (doc) => {
  if (Array.isArray(doc)) return doc.map(renverseEntree);
  if (estObjet(doc) && typeof doc.id === 'string') return renverseRacine(doc);
  return doc;
};

// --- 1. NO-OP SUR LE CORPUS ENTIER, CLÉS RENVERSÉES ---------------------------------------------

/**
 * Ce que le dépôt jetable doit porter pour qu'une migration échoue sur son CONTRAT et jamais sur une
 * absence de dépôt : sans `Source/`, des migrations sortent 1 sur une extraction introuvable — une
 * raison de dépôt, pas de contrat. COPIE PURE : aucun lien.
 *
 * Ce que les migrations lisent de `Source/`, ce sont les extractions `.md` ; les PDF (lourds,
 * gitignorés) sont écartés de la copie par leur EXTENSION — jamais par le nom de leur dossier.
 */
const CORPUS = ['src/data', 'src/scenes', 'scripts', 'src/gameIso/catalog', 'src/lib/ordre.mjs', 'src/lib/coupeAuMot.mjs', 'src/lib/normalize.ts', 'src/lib/regex.ts', 'src/lib/tableTotale.ts', 'docs/raw', 'Source'];

test('les migrations DATÉES sont NO-OP sur `src/data` ENTIER aux clés renversées', (t) => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-corpus-'));
  t.after(() => efface(racine));
  for (const rel of CORPUS)
    fs.cpSync(path.join(RACINE, rel), path.join(racine, rel), {
      recursive: true,
      filter: (src) => path.extname(src).toLowerCase() !== '.pdf',
    });

  const data = path.join(racine, 'src/data');
  const jsons = fs.readdirSync(data).filter((f) => f.endsWith('.json'));
  // Plancher du corpus (#1686 : les catalogues de matières fusionnent en `materials.json`).
  assert.ok(jsons.length >= 119, `corpus de ${jsons.length} document(s) — la copie n'a pas pris \`src/data\``);

  /** Le corpus RENVERSÉ, posé et gardé en référence : toute divergence ultérieure est une écriture. */
  const avant = new Map();
  for (const f of jsons) {
    const cible = path.join(data, f);
    const texte = `${JSON.stringify(renverse(JSON.parse(fs.readFileSync(cible, 'utf8'))), null, 2)}`;
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(f, texte);
  }

  const fautes = [];
  for (const migration of DATEES) {
    const r = joue(racine, migration);
    if (r.code !== 0) {
      const queue = `${r.stdout}${r.stderr}`.trim().split(/\r?\n/).slice(-4).join(' / ');
      fautes.push(`${migration} : sortie ${r.code} — ${queue}`);
    }
    const touches = jsons.filter((f) => fs.statSync(path.join(data, f)).mtimeMs !== ANTIDATE.getTime());
    for (const f of touches) {
      const octets = fs.readFileSync(path.join(data, f), 'utf8') === avant.get(f) ? 'octet IDENTIQUE' : 'octet DIVERGENT';
      fautes.push(`${migration} : ${f} RÉÉCRIT alors que rien n’a changé (${octets})`);
      fs.writeFileSync(path.join(data, f), avant.get(f), 'utf8');
      fs.utimesSync(path.join(data, f), ANTIDATE, ANTIDATE);
    }
  }

  for (const f of jsons) {
    if (fs.readFileSync(path.join(data, f), 'utf8') !== avant.get(f)) fautes.push(`${f} : corpus ALTÉRÉ à l’issue du rejeu`);
  }
  assert.deepEqual(fautes, [], `${fautes.length} faute(s) sur ${DATEES.length} migration(s) :\n  ${fautes.join('\n  ')}`);
});
