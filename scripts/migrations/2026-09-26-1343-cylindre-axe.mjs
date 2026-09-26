/**
 * Migration #1343 lot C — le CYLINDRE d'une recette de décor porte son AXE.
 *
 * Le vocabulaire des volumes (`PropPrimitive`, `src/data/props.types.ts`) admet un cylindre
 * COUCHÉ (roue, tonneau couché, rouleau) : `axis: 'h' | 'x' | 'y'` indexe la table `REPERE_D_AXE`,
 * patron de `BAS_DE_PENTE`. Le champ est REQUIS — une seule graphie du cylindre vertical — et la
 * longueur le long de l'axe s'appelle `longueurM` : `heightM` disait « hauteur » pour une cote qui,
 * couchée, n'en est plus une (design `.superpowers/sdd/1343-lot-c/design-cylindre-couche.md`,
 * décisions 1 et 2).
 *
 * GESTE, sur CHAQUE primitive `cylinder` de chaque recette : `heightM` → `longueurM` (même valeur, même
 * place dans l'ordre des clés), et `axis: 'h'` posé juste après `center`. Aucun cylindre existant ne
 * change de géométrie : l'axe `h` est l'identité de `REPERE_D_AXE`.
 *
 * ENTRÉES : `src/data/props.json` (seule donnée lue et écrite).
 *
 * MARQUEUR D'IDEMPOTENCE : la FORME du cylindre — `longueurM` et `axis` présents, `heightM` absent.
 * Rejoué sur l'état final, le script ne trouve aucun cylindre à migrer et n'écrit rien.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : racine non-tableau, forme non canonique,
 * aucune recette, ou cylindre MÊLÉ (`heightM` à côté de `longueurM` ou d'`axis`, ou ni l'un ni
 * l'autre) — ce script renomme une cote qu'il reconnaît, il ne tranche pas entre deux graphies.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/props.json');

/** L'axe de tout cylindre d'avant ce lot : vertical, l'identité de `REPERE_D_AXE`. */
const AXE_VERTICAL = 'h';

const brut = fs.readFileSync(CIBLE, 'utf8');
const avant = JSON.parse(brut);

if (!Array.isArray(avant)) {
  console.error('src/data/props.json : racine non-TABLEAU — rien n’est écrit');
  process.exit(1);
}
if (JSON.stringify(avant, null, 2) !== brut) {
  console.error('src/data/props.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`) — rien n’est écrit');
  process.exit(1);
}

const cylindresDe = (e) => (e?.volume?.primitives ?? []).filter((p) => p?.kind === 'cylinder');
const estAncien = (p) => 'heightM' in p && !('longueurM' in p) && !('axis' in p);
const estMigre = (p) => !('heightM' in p) && 'longueurM' in p && 'axis' in p;

// PORTE DE LECTURE — FORME, jamais cardinal (#1812) : le catalogue de décor grandit.
{
  const ecarts = [];
  if (!avant.some((e) => e?.volume)) ecarts.push('aucune recette de volume — périmètre déplacé');
  for (const e of avant)
    cylindresDe(e).forEach((p, i) => {
      if (!estAncien(p) && !estMigre(p))
        ecarts.push(`${e.id} : cylindre n°${i + 1} de graphie MÊLÉE (clés : ${Object.keys(p).join(', ')})`);
    });
  if (ecarts.length) {
    console.error(`ARBITRAGE REQUIS — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

/** Le cylindre migré : `axis` après `center`, `heightM` renommé EN PLACE. */
const migrer = (p) => {
  const sortie = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'heightM') sortie.longueurM = v;
    else sortie[k] = v;
    if (k === 'center') sortie.axis = AXE_VERTICAL;
  }
  return sortie;
};

let migres = 0;
const apres = avant.map((e) => {
  if (!cylindresDe(e).some(estAncien)) return e;
  return {
    ...e,
    volume: {
      ...e.volume,
      primitives: e.volume.primitives.map((p) => {
        if (p?.kind !== 'cylinder' || !estAncien(p)) return p;
        migres++;
        return migrer(p);
      }),
    },
  };
});

// NO-OP SÉMANTIQUE : ce script ne possède que le renommage de la cote et la pose de l'axe.
if (migres === 0) {
  const total = avant.reduce((n, e) => n + cylindresDe(e).length, 0);
  console.log(`src/data/props.json : no-op (0 cylindre à migrer — ${total} cylindre(s) portent déjà \`axis\` et \`longueurM\`)`);
  process.exit(0);
}

fs.writeFileSync(CIBLE, JSON.stringify(apres, null, 2), 'utf8');

// PREUVE post-écriture : même cardinal et même ordre d'entrées et de primitives, plus aucun `heightM`,
// et chaque cylindre migré porte `axis: 'h'` et la cote d'origine sous `longueurM`, le reste intact.
{
  const relu = JSON.parse(fs.readFileSync(CIBLE, 'utf8'));
  const post = [];
  if (relu.length !== avant.length) post.push(`POST : ${relu.length} entrée(s) ≠ ${avant.length}`);
  for (let i = 0; i < relu.length; i++) {
    const d = relu[i], a = avant[i];
    if (d?.id !== a?.id) post.push(`POST [${i}] : id ${d?.id} ≠ ${a?.id}`);
    const pa = a?.volume?.primitives ?? [], pd = d?.volume?.primitives ?? [];
    if (pa.length !== pd.length) { post.push(`POST ${a?.id} : ${pd.length} primitive(s) ≠ ${pa.length}`); continue; }
    pa.forEach((p, k) => {
      const q = pd[k];
      if (p?.kind !== 'cylinder' || !estAncien(p)) {
        if (JSON.stringify(q) !== JSON.stringify(p)) post.push(`POST ${a.id}[${k}] : primitive altérée`);
        return;
      }
      const { heightM, ...reste } = p;
      const { longueurM, axis, ...resteApres } = q;
      if ('heightM' in q) post.push(`POST ${a.id}[${k}] : \`heightM\` survivant`);
      if (longueurM !== heightM) post.push(`POST ${a.id}[${k}] : longueurM ${longueurM} ≠ heightM ${heightM}`);
      if (axis !== AXE_VERTICAL) post.push(`POST ${a.id}[${k}] : axe « ${axis} » ≠ « ${AXE_VERTICAL} »`);
      if (JSON.stringify(resteApres) !== JSON.stringify(reste)) post.push(`POST ${a.id}[${k}] : cotes hors du geste altérées`);
    });
  }
  if (post.length) {
    console.error(`ARBITRAGE REQUIS — ${post.length} anomalie(s) après écriture :`);
    for (const m of post) console.error(`  ${m}`);
    process.exit(1);
  }
}

console.log(`src/data/props.json : ${migres} cylindre(s) — \`heightM\` → \`longueurM\`, \`axis: '${AXE_VERTICAL}'\` posé (#1343 lot C)`);
