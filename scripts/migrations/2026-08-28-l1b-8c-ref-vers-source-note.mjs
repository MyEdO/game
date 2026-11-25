/**
 * Migration #1467 L1b V-FLIP-TABLE — le scalaire `ref` MEURT sur les 2 documents qui le portaient
 * (`obsessions`, `surincantation`) : c'est un HOMONYME de provenance, alors que l'enveloppe de la
 * fabrique a UN seul foyer de citation — `source` (`{book, page, note}`).
 *
 * ARBITRAGE MESURÉ AU SOURCE (2026-08-28), les deux réfs étant CONTRADICTOIRES sur
 * `surincantation.json` (`ref` « VDM 02 l.207-215 » vs `source.note` « VDM 02 l.205-215 »).
 * FAITS relevés dans `Source/Warhammer v4 - Les Vents de Magie/02 - Révisions des règles
 * d'incantation.md` : le titre « ### TABLEAU DE SURINCANTATION » est en l.205, l'en-tête de tableau
 * en l.207-208, les 7 rangées de palier en l.209-215 ; l'ancre `data-folio` gouvernant tout ce bloc
 * est 23, soit exactement le `source.page` déclaré — les deux bornes candidates désignent donc le
 * MÊME folio, et aucune ne « ment » au sens du garde d'alignement.
 * La plage RETENUE est `l.205-215` : elle couvre le titre gouvernant ET l'intégralité des rangées,
 * là où `l.207-215` commençait au milieu (l'en-tête de colonnes) sans rien désigner de plus. Aucune
 * convention générale n'est invoquée : le dépôt est MIXTE sur ce point (des notes ancrent au titre,
 * d'autres au contenu). `ref` est le doublon, il disparaît sans rien emporter.
 *
 * `obsessions.json` n'a, lui, aucune contradiction : `source` est sans `note` et `ref`
 * (« EDOC 12 l.170 » = le titre « ### OBSESSIONS », vérifié au Source, rangées en l.172-197) se
 * RÉCONCILIE dans `source.note`, valeur INCHANGÉE.
 *
 * ENTRÉES : `src/data/obsessions.json`, `src/data/surincantation.json` (les seules données lues et
 * écrites) — la vérification au `Source/` est faite, elle n'est pas rejouée ici.
 *
 * IDEMPOTENT : un document sans `ref` n'est plus dans la forme d'avant ; il passe sans faute (#1463).
 * FAIL-FAST : `ref` d'une autre valeur que celle mesurée → rien n'est écrit, exit 1.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` vérifié AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * `fichier → { ref, note }` : `ref` = la valeur EXACTE attendue avant migration (toute autre est un
 * arbitrage) ; `note` = la note de `source` APRÈS migration.
 */
const CIBLES = {
  'obsessions.json': { ref: 'EDOC 12 l.170', note: 'Tableau des Obsessions, EDOC 12 l.170' },
  'surincantation.json': { ref: 'VDM 02 l.207-215', note: 'TABLEAU DE SURINCANTATION, VDM 02 l.205-215' },
};

const echecs = [];
const rapport = [];

for (const [fichier, attendu] of Object.entries(CIBLES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const data = JSON.parse(brut);

  if (!Object.prototype.hasOwnProperty.call(data, 'ref')) {
    rapport.push(`  no-op ${fichier} — \`ref\` absente`);
    continue;
  }
  if (JSON.stringify(data, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }
  if (!data.source || typeof data.source !== 'object') {
    echecs.push(`${fichier} : \`source\` absente ou de forme inattendue`);
    continue;
  }
  if (data.ref !== attendu.ref) {
    echecs.push(`${fichier} : \`ref\` = ${JSON.stringify(data.ref)} ≠ ${JSON.stringify(attendu.ref)} — arbitrage requis`);
    continue;
  }

  const sortie = Object.fromEntries(
    Object.entries(data)
      .filter(([k]) => k !== 'ref')
      .map(([k, v]) => (k === 'source' ? [k, { ...v, note: attendu.note }] : [k, v])),
  );
  const out = JSON.stringify(sortie, null, 2);
  fs.writeFileSync(cible, out, 'utf8');
  rapport.push(`  migré ${fichier} — ref ${JSON.stringify(data.ref)} → source.note ${JSON.stringify(attendu.note)}`);

  // PREUVE post-écriture : `ref` partie, note posée, aucune autre clé altérée.
  const apres = JSON.parse(out);
  if ('ref' in apres) echecs.push(`${fichier} : POST — \`ref\` survivante`);
  if (apres.source.note !== attendu.note) echecs.push(`${fichier} : POST — note non conforme`);
  for (const k of Object.keys(data)) {
    if (k === 'ref' || k === 'source') continue;
    if (JSON.stringify(apres[k]) !== JSON.stringify(data[k])) echecs.push(`${fichier} : POST — la valeur de \`${k}\` a été ALTÉRÉE`);
  }
  if (apres.source.book !== data.source.book || apres.source.page !== data.source.page) {
    echecs.push(`${fichier} : POST — book/page de \`source\` altérés`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`\`ref\` scalaire → \`source.note\` : ${Object.keys(CIBLES).length} document(s)`);
for (const l of rapport) console.log(l);
