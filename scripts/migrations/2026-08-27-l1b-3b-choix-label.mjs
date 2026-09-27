/**
 * Migration #1467 L1b V-P2 — `DialogueChoice.text` devient `label`.
 *
 * MOTIF MESURÉ : ce n'est PAS de la prose, c'est un LIBELLÉ — l'étiquette du bouton que le joueur
 * clique. Le rôle `libellé` de l'enveloppe a pour cible `label`
 * (`scripts/docs/lib/structures-lexique.mts`), et l'archive de dialogue la stocke déjà comme telle
 * (`DialogueTurn.choiceText`, `src/state/dialogueHistory.ts`). Le nœud PORTEUR, lui, porte de la
 * prose et part en `desc` (migration `…-3a-prose-desc.mjs`) : deux rôles distincts, deux clés.
 *
 * ENTRÉES : les 4 `src/scenes/<campagne>/<campagne>-projet.json` (chemin
 * `scenes[].dialogues[].nodes[].choices[]` — les choix, jamais leurs nœuds).
 *
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur
 * `JSON.stringify(doc, null, 1) + '\n'` (précédent déclaré par
 * `scripts/migrations/2026-08-24-give-trapping-label-vers-id.mjs`), vérifié AVANT toute écriture.
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un choix portant seulement `label` est reconnu migré ;
 * rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : choix portant `text` ET `label`, choix sans ni l'un ni l'autre, `text` non-chaîne →
 * rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RACINE = path.join(ROOT, 'src/scenes');
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const renomme = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k === 'text' ? 'label' : k, v]));

const echecs = [];
const ecritures = [];

for (const d of fs.readdirSync(RACINE, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE, d.name, `${d.name}-projet.json`);
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 1) + '\\n'\`)`); continue; }

  let migres = 0;
  let deja = 0;
  const scenes = (doc.scenes ?? []).map((s) => ({
    ...s,
    ...(Array.isArray(s.dialogues)
      ? {
        dialogues: s.dialogues.map((dl) => ({
          ...dl,
          nodes: (dl.nodes ?? []).map((n) => ({
            ...n,
            choices: (n.choices ?? []).map((c, i) => {
              const ou = `${rel} › ${s.id}/${dl.id}/${n.id}/choices[${i}]`;
              const aText = c?.text !== undefined;
              const aLabel = c?.label !== undefined;
              if (aText && aLabel) { echecs.push(`${ou} : porte À LA FOIS \`text\` et \`label\``); return c; }
              if (aLabel) { deja++; return c; }
              if (!aText) { echecs.push(`${ou} : ni \`text\` ni \`label\` — libellé PERDU`); return c; }
              if (typeof c.text !== 'string') { echecs.push(`${ou} : \`text\` de forme inattendue ${JSON.stringify(c.text)}`); return c; }
              migres++;
              return renomme(c);
            }),
          })),
        })),
      }
      : {}),
  }));

  ecritures.push({ rel, abs, brut, out: canonique({ ...doc, ...(doc.scenes ? { scenes } : {}) }), migres, deja });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let total = 0;
for (const e of ecritures) {
  if (e.out !== e.brut) fs.writeFileSync(e.abs, e.out, 'utf8');
  total += e.migres;
  console.log(`${e.rel} — choices[].text → label : ${e.migres} (déjà migrés : ${e.deja}) — fichier ${e.out !== e.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
console.log(`TOTAL : ${total} choix migré(s).`);
