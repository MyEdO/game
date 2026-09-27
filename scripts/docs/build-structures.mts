// Carte des STRUCTURES de la donnée — GÉNÉRÉE, croisement OBSERVÉ × DÉCLARÉ sur les DEUX racines
// de documents (`src/data`, `src/scenes`).
//   observé  → scripts/docs/lib/structures-scan.mts (index des ids + parcours des JSON + AST des defs)
//   déclaré  → scripts/docs/lib/zod-introspect.mts (les 120 schémas du registre)
//   lexique  → scripts/docs/lib/structures-lexique.mts (concepts FERMÉS, une entrée = un concept)
// Sortie : docs/structures-donnees.md. Re-run : npx tsx scripts/docs/build-structures.mts
// (npm run docs:structures). Mode --check (chaîné dans npm run docs:check) : régénère en mémoire,
// compare au .md committé, exit 1 avec message actionnable si diff — jamais d'écriture en --check.
//
// Le doc est la carte de PILOTAGE du chantier #1463 : le stock nominatif décroissant qu'il
// alimente vit dans scripts/guards/lib/structuresStock.mjs (garde src/data/structures-contrat.test.ts).
import { execFileSync } from 'node:child_process';
import { emitOrCheck } from './lib/jsdocUnion.mjs';
import {
  scanDuCorpus,
  scannerRedeclarations,
  listerDocuments,
  empreintesDefs,
  MARQUE_HORS_STRATE,
  RACINES,
} from './lib/structures-scan.mjs';
import {
  ANGLES_MORTS,
  ANGLES_MORTS_SLOTS,
  CONCEPTS,
  LOTS_DE_PEUPLEMENT,
  MANDAT_SLOTS,
  ROLES_ENVELOPPE,
  TERMES_COLLECTION_A_CLE,
  clesDuRole,
} from './lib/structures-lexique.mjs';
import { champsJoints, champsSansSlot, registreDesSlots, slotsDuParse } from './lib/slots-registre.mjs';
import { collectionsDesDocuments } from '../../src/data/schemas/grammaire/collection-cle';
import { effectSchema } from '../../src/data/schemas/defs-scenes/effets';
import { defDe, descendre, enfantsDe } from '../../src/data/schemas/grammaire/descente';

const OUT = 'docs/structures-donnees.md';
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/** Le DÉCLARÉ couvre les DEUX racines (#1466 L1a) — jointure par BASENAME, comme le scan key.
 *  La composition defs → familles/enums → scan vit dans `scanDuCorpus` (`structures-scan.mts`). */
const { defs: DEFS, declares, scan } = scanDuCorpus(ROOT);
const parFichierDeclare = new Map(declares.map((d) => [d.file, d]));
const { redeclarations, totalLitteraux } = scannerRedeclarations(ROOT);

/** Numérotation des sous-sections de §3 — table UNIQUE : titres ET renvois s'y lisent. */
const SECTION = {
  concept: (c: (typeof CONCEPTS)[number]) => `3.${CONCEPTS.indexOf(c) + 1}`,
  homonymes: `3.${CONCEPTS.length + 1}`,
  parametres: `3.${CONCEPTS.length + 2}`,
  textes: `3.${CONCEPTS.length + 3}`,
  orphelines: `3.${CONCEPTS.length + 4}`,
};

const echappe = (s: string) => String(s).replace(/\|/g, '\\|');

/** Discriminants DÉCLARÉS des options de la première union sous `effectSchema` (`descendre`). */
function discriminantsDeffet(): string[] {
  let union: unknown;
  descendre([effectSchema], ({ noeud, def }) => {
    if (def.type !== 'union') return;
    union = noeud;
    return 'arreter';
  });
  const options = enfantsDe(union).filter((e) => e.segment.startsWith('|'));
  return options.flatMap(({ noeud }) => {
    const litteral = enfantsDe(noeud).find((e) => e.cle === 'type')?.noeud;
    const d = defDe(litteral);
    const valeurs = Array.isArray(d?.values) ? d.values : [];
    return valeurs.filter((v): v is string => typeof v === 'string');
  });
}

/** Variantes d'`Effect` DÉCLARÉES et posées NULLE PART dans les deux racines (`type: '<t>'`). */
function variantesDeffetJamaisPosees(): string[] {
  const posees = new Set<string>();
  const marche = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(marche);
    if (!n || typeof n !== 'object') return;
    const v = (n as Record<string, unknown>).type;
    if (typeof v === 'string') posees.add(v);
    for (const enfant of Object.values(n as Record<string, unknown>)) marche(enfant);
  };
  for (const brut of scan.brutParNom.values()) marche(brut);
  return discriminantsDeffet().filter((t) => !posees.has(t)).sort();
}
const tableau = (entetes: string[], lignes: (string | number)[][]) =>
  [
    `| ${entetes.join(' | ')} |`,
    `|${entetes.map(() => '---').join('|')}|`,
    ...lignes.map((l) => `| ${l.map((c) => echappe(String(c))).join(' | ')} |`),
  ].join('\n') + '\n\n';

let out = '';
out += '# Structures de la donnée — carte GÉNÉRÉE (observé × déclaré)\n\n';
out += '> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-structures.mts` (`npm run docs:structures`) — NE PAS ÉDITER À LA MAIN.\n';
out += '> Toute correction se fait dans le générateur, dans le lexique `scripts/docs/lib/structures-lexique.mts`\n';
out += '> ou dans la donnée. `npm run docs:check` échoue si ce fichier diverge de la mesure.\n>\n';
out += '> Question à laquelle ce doc répond : **sous quelle forme ce concept est-il écrit, dans quel dataset, sous quel CHAMP ?**\n';
out += `> Stock nominatif décroissant des formes à éteindre : \`scripts/guards/lib/structuresStock.mjs\`\n`;
out += '> (garde `src/data/structures-contrat.test.ts`).\n\n';

// ---------------------------------------------------------------------------
out += '## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)\n\n';
out += 'Périmètre : les documents AUTHORÉS des deux racines (`src/data`, `src/scenes`), leurs schémas zod\n';
out += 'du registre, et les littéraux d’objet zod des `src/data/schemas/defs/*.ts`.\n';
out += 'Ce que la mesure ci-dessous **ne voit pas** — un compte n’a de sens qu’avec son périmètre.\n\n';
out += ANGLES_MORTS.map((a) => `- ${a}`).join('\n');
out += '\n\n';

// ---------------------------------------------------------------------------
out += '## 1. Racines\n\n';
const docs = listerDocuments(ROOT);
const parRacine = new Map<string, number>();
for (const d of docs) parRacine.set(d.racine, (parRacine.get(d.racine) ?? 0) + 1);
/** « Au registre zod » est CALCULÉ par racine : le déclaré couvre les deux depuis #1466 L1a. */
const declaresParRacine = new Map<string, number>();
for (const d of DEFS) declaresParRacine.set(d.root, (declaresParRacine.get(d.root) ?? 0) + 1);
out += tableau(
  ['Racine', 'Fichiers retenus', 'Documents', 'Au registre zod'],
  RACINES.map((r) => [
    `\`${r.dir}\``,
    `\`${r.motif}\`${r.recursif ? ' (récursif)' : ''}`,
    parRacine.get(r.id) ?? 0,
    `${declaresParRacine.get(r.id) ?? 0} / ${parRacine.get(r.id) ?? 0}`,
  ]),
);
{
  const orphelins = scan.documents.filter((d) => !parFichierDeclare.has(d.nom));
  out += `Documents qu’AUCUNE def ne déclare : **${orphelins.length}**`;
  out += `${orphelins.length ? ` — ${orphelins.map((d) => `\`${d.chemin}\``).join(' ')}` : ''}.\n`;
  out += '\n';
}

out += '### 1bis. Index des ids (le cœur du détecteur)\n\n';
out += `Identités indexées : **${scan.index.ids}** (entrées de racine + documents embarqués) ; libellés\n`;
out += `normalisés : **${scan.index.libelles}**. Un id vu dans PLUSIEURS datasets rend la résolution\n`;
out += `AMBIGUË (jamais fausse) : **${scan.index.collisions.length}** collisions, et **${scan.index.labelsQuiSontDesIds.length}** ids\n`;
out += 'sont aussi le libellé d’une entité (faux positif possible sur la résolvabilité d’un `{text}`).\n\n';
out += tableau(
  ['Id', 'Datasets'],
  scan.index.collisions.map((c) => [`\`${c.id}\``, c.datasets.map((d) => `\`${d}\``).join(' ')]),
);

out += '#### Résolutions AMBIGUËS (la collision qui MORD)\n\n';
{
  const total = scan.ambigues.reduce((a, x) => a + x.occurrences, 0);
  out += 'La résolution est mesurée PAR SITE `(dataset, champ, clé)` : les cibles MAJORITAIRES d’un site\n';
  out += 'sont les datasets qui couvrent ≥ 50 % de ses valeurs résolvantes. Une valeur qui ne résout QUE\n';
  out += 'vers un dataset HORS de ces cibles est AMBIGUË : elle compte encore comme référence, mais le\n';
  out += 'dataset atteint n’est pas celui que le site vise — c’est là qu’une collision d’ids peut mentir.\n\n';
  out += `**${scan.ambigues.length}** valeurs ambiguës, **${total}** occurrences. Les ${Math.min(40, scan.ambigues.length)} plus fréquentes :\n\n`;
  out += tableau(
    ['Dataset', 'Champ', 'Clé', 'Valeur', 'Résout vers', 'Cibles majoritaires du site', 'Occurrences'],
    scan.ambigues
      .slice(0, 40)
      .map((a) => [
        `\`${a.dataset}\``,
        `\`${a.champ}\``,
        `\`${a.cle}\``,
        `\`${a.valeur}\``,
        a.parasites.map((d) => `\`${d}\``).join(' '),
        a.majoritaires.map((d) => `\`${d}\``).join(' '),
        a.occurrences,
      ]),
  );
}

// ---------------------------------------------------------------------------
out += '### 1ter. Collections à clé (déclarées au schéma, relevées par la co-descente)\n\n';
{
  const collections = collectionsDesDocuments(DEFS, scan.brutParNom);
  out += 'Termes : source UNIQUE `TERMES_COLLECTION_A_CLE` (`scripts/docs/lib/structures-lexique.mts`).\n\n';
  out += TERMES_COLLECTION_A_CLE.map(([terme, definition]) => `- **${terme}** — ${definition}`).join('\n');
  out += `\n\nCollections à clé relevées dans les documents des deux racines : **${collections.length}**, dont **${collections.filter((c) => c.marque.espace).length}** espaces de noms.\n\n`;
}

out += '## 2. Enveloppe des documents\n\n';
out += '### 2.1 Un document, sa racine, ses clés de premier niveau\n\n';
out += 'Racine JSON = forme réelle du fichier ; famille déclarée = ce que dit son schéma zod (vide si le\n';
out += 'document n’est pas au registre) ; famille MESURÉE = `entité` / `table` (liste dont la moitié des\n';
out += 'entrées portent une plage) / `config` / `record`. C’est la famille déclarée qui donne le RÉGIME\n';
out += 'D’ENTRÉES, donc à qui appartiennent les clés. Chaque clé porte ses classes de type observées et le\n';
out += 'nombre d’entrées qui la portent.\n\n';
out += tableau(
  ['Document', 'Racine JSON', 'Famille déclarée', 'Famille mesurée', 'Entrées', 'Clés de 1er niveau'],
  scan.documents.map((d) => [
    `\`${d.chemin}\``,
    d.racineJson,
    parFichierDeclare.get(d.nom)?.famille ?? '—',
    d.famille,
    d.nbEntrees,
    d.clesNiveau1.length
      ? d.clesNiveau1.map((k) => `\`${k.cle}\`:${k.parClasse.map((c) => c.classe).join('/')}(${k.n})`).join(' ')
      : '—',
  ]),
);

out += '### 2.2 Fréquence globale des signatures d’entrée\n\n';
const signaturesEntree = scan.clesEnveloppe.slice(0, 40);
out += `Signatures distinctes d’entrée de document : **${scan.clesEnveloppe.length}**. Les ${signaturesEntree.length} plus fréquentes :\n\n`;
out += tableau(
  ['Signature d’entrée', 'Entrées'],
  signaturesEntree.map(([sig, n]) => [`\`${sig}\``, n]),
);

out += '### 2.3 Divergences nominatives d’enveloppe (strate Document)\n\n';
out += 'Un même RÔLE porté par des noms de clé différents selon le document — l’objet du lot L1b (#1467).\n';
out += 'Les ENTRÉES DE RACINE doivent porter `id` et `source` (et `label` sur les familles `entité`/`table`) :\n';
out += 'leur absence est une divergence. Un DOCUMENT EMBARQUÉ (étape de Flow, rangée de table, nœud de\n';
out += 'dialogue) n’est sommé de rien : on n’y compte que les clés DIVERGENTES.\n\n';
{
  const lignes: (string | number)[][] = [];
  const parCle = new Map(scan.clesParDocument);
  for (const [role, def] of Object.entries(ROLES_ENVELOPPE))
    for (const cle of clesDuRole(def)) {
      const usages = parCle.get(cle) ?? [];
      lignes.push([
        role,
        `\`${cle}\``,
        cle === def.cible ? `cible${def.typeAttendu ? ` (\`${def.typeAttendu}\`)` : ''}` : 'divergente',
        usages.length,
        usages.slice(0, 12).join(' ') + (usages.length > 12 ? ' …' : '') || '—',
      ]);
    }
  out += tableau(['Rôle', 'Clé', 'Statut de la clé', 'Documents', 'Documents (n entrées)'], lignes);

  const racines = scan.groupesEnveloppe.filter((g) => g.portee === 'racine');
  const embarques = scan.groupesEnveloppe.filter((g) => g.portee === 'embarqué');
  out += `Groupes mesurés : **${racines.length}** jeux d’ENTRÉES DE RACINE et **${embarques.length}** chemins de\n`;
  out += `DOCUMENTS EMBARQUÉS (**${scan.objets.documentsEmbarques}** objets). **${scan.enveloppe.length}** divergences\n`;
  out += '(rôle × clé × document × chemin) au stock `STRUCTURES_ENVELOPPE` (`scripts/guards/lib/structuresStock.mjs`,\n';
  out += 'garde `src/data/structures-contrat.test.ts`) — une ligne se solde en migrant l’enveloppe, la ligne part\n';
  out += 'dans le MÊME commit :\n\n';
  out += tableau(
    ['Rôle', 'Motif', 'Groupes'],
    scan.enveloppeParMotif.map((m) => [m.role, m.motif, m.documents]),
  );
  const sourceAbsente = scan.enveloppe.filter((e) => e.role === 'source' && e.motif === 'clé absente');
  out += `Documents dont AUCUNE ENTRÉE DE RACINE ne porte \`source\` : **${sourceAbsente.length}** (lot \`L1d #1469\`) —\n`;
  out += `${sourceAbsente.map((e) => `\`${e.document}\`(${e.entrees})`).join(' ')}\n\n`;
  out += 'Le DoD ajouté de #1465 annonçait « 13 datasets sans `source` » : la mesure en trouve\n';
  out += `**${sourceAbsente.length}** — le chiffre de 13 n’a pas de porteur dans l’arbre, il ne se recopie pas.\n\n`;
  out += `Documents de racine ne portant AUCUNE clé \`source\` à quelque profondeur que ce soit : **${scan.documentsSansSource.length}**\n`;
  out += `(lot \`L1d #1469\`) — ${scan.documentsSansSource.map((d) => `\`${d}\``).join(' ')}\n\n`;
  out += 'Documents EMBARQUÉS mesurés, par chemin :\n\n';
  out += tableau(
    ['Document', 'Chemin', 'Objets', 'Clés'],
    embarques.map((g) => [
      `\`${g.document}\``,
      `\`${g.chemin}\``,
      g.nbEntrees,
      g.cles.map((k) => `\`${k.cle}\`(${k.n})`).join(' '),
    ]),
  );
}

out += '### 2.4 Formes DÉCLARÉES jamais observées\n\n';
out += 'Clé déclarée par le schéma zod d’un document mais portée par AUCUNE entrée du JSON — schéma plus\n';
out += 'large que la donnée (un champ à retirer, ou une donnée à écrire).\n';
out += 'Deux régimes, et ils ne se confondent pas : **par DÉFAUT** (table A) la forme n’a AUCUN lot de\n';
out += 'peuplement — c’est du dénominateur, elle va au stock `STRUCTURES_DEFAUT` et ne fait que décroître ;\n';
out += '**`cible-declaree`** (table B) est un déclaré-avant-posé ASSUMÉ, avec son lot de peuplement — il ne\n';
out += 'se STOCKE pas (un stock décroît, une cible se solde en PEUPLANT la donnée), il s’ÉMET ici.\n\n';
{
  out += '#### A. Par défaut — sans lot de peuplement (stock `STRUCTURES_DEFAUT`)\n\n';
  const lignes: (string | number)[][] = [];
  let nCles = 0;
  for (const d of scan.documents) {
    const dec = parFichierDeclare.get(d.nom);
    if (!dec) continue;
    const vues = new Set(d.clesNiveau1.map((k) => k.cle));
    const jamais = Object.keys(dec.cles).filter((k) => !vues.has(k)).sort();
    if (jamais.length) {
      nCles += jamais.length;
      lignes.push([`\`${d.nom}\``, jamais.length, jamais.map((k) => `\`${k}\``).join(' ')]);
    }
  }
  out += `**${lignes.length}** documents portent au moins une clé déclarée jamais observée, **${nCles}** clés en tout\n`;
  out += '(stock `STRUCTURES_DEFAUT`, `scripts/guards/lib/structuresStock.mjs`, garde `src/data/structures-contrat.test.ts`).\n\n';
  out += tableau(['Document', 'Clés', 'Détail'], lignes);

  out += '#### B. `cible-declaree` — déclaré-avant-posé ASSUMÉ (émission, jamais un stock)\n\n';
  out += 'Le CONTENU de cette table est MESURÉ (déclaré du schéma × valeurs posées dans les deux racines) ;\n';
  out += 'seuls la DATE et le LOT DE PEUPLEMENT se déclarent, une fois par famille\n';
  out += '(`LOTS_DE_PEUPLEMENT`, `scripts/docs/lib/structures-lexique.mts`).\n\n';
  out += tableau(
    ['Forme', 'Famille', 'Date', 'Lot de peuplement'],
    variantesDeffetJamaisPosees().map((t) => {
      const l = LOTS_DE_PEUPLEMENT['variante d’`Effect`'];
      return [`\`type: '${t}'\``, 'variante d’`Effect`', l.date, l.lot];
    }),
  );

  out += 'Même règle pour le LEXIQUE : une signature qu’il déclare et que la donnée ne porte nulle part.\n';
  out += 'Une CIBLE à `0` est une forme visée que rien n’écrit encore — elle se lit ici, jamais en silence.\n\n';
  const occurrencesParSig = new Map<string, number>();
  for (const f of scan.formes)
    occurrencesParSig.set(`${f.concept} | ${f.signature}`, (occurrencesParSig.get(`${f.concept} | ${f.signature}`) ?? 0) + f.occurrences);
  out += tableau(
    ['Concept', 'Signature du lexique', 'Statut', 'Occurrences'],
    CONCEPTS.flatMap((c) =>
      c.signatures.map((s) => [c.id, `\`${s.sig}\``, s.statut, occurrencesParSig.get(`${c.id} | ${s.sig}`) ?? 0]),
    ),
  );
}

// ---------------------------------------------------------------------------
out += '## 3. Concepts transverses (lexique FERMÉ)\n\n';
out += 'Statuts : **cible** = forme visée, rien à migrer (liste FIGÉE au stock `STRUCTURES_CIBLES`) ·\n';
out += '**historique** = graphie connue à éteindre par un lot L1-L5 · **declaree** = forme volontairement\n';
out += 'conservée · **divergente** = graphie inconnue du lexique.\n\n';
{
  const tally: Record<string, number> = {};
  for (const f of scan.formes) tally[f.statut] = (tally[f.statut] ?? 0) + 1;
  out += `Lignes concept × dataset × champ × forme : **${scan.formes.length}** (`;
  out += ['cible', 'declaree', 'historique', 'divergente'].map((s) => `${s} ${tally[s] ?? 0}`).join(' · ');
  out += `). Objets JSON parcourus : **${scan.objets.vus}**, dont **${scan.objets.classes}** portent une forme\n`;
  out += `mesurée. Champs porteurs de référence MESURÉS : **${scan.champsDeReference.length}**.\n\n`;
  out += `Entrées de racine sans concept de valeur : **${scan.objets.racinesSansValeur}** sur **${scan.objets.entreesDeRacine}** —\n`;
  out += `un document n’est ni orphelin ni hors strate : ce compte est le seul porteur de ce qu’aucun concept ne revendique.\n`;
  out += `Dont, NOMMÉES, celles qu’un concept de valeur revendiquerait sans la clause \`horsDesignation\` du lexique : `;
  out += (scan.objets.racinesDisqualifiees.map((d) => `\`${d.dataset}\` ${d.entrees}`).join(' · ') || 'aucune') + `.\n\n`;
}
for (const c of CONCEPTS) {
  const lignes = scan.formes.filter((f) => f.concept === c.id);
  const total = lignes.reduce((a, f) => a + f.occurrences, 0);
  out += `### ${SECTION.concept(c)} ${c.label} — \`${c.id}\` (strate ${c.strate})\n\n`;
  out += `${lignes.length} ligne(s), ${total} occurrence(s).\n`;
  out += `Reconnu par : ${c.resolvables ? 'RÉSOLUTION vers l’index des ids (cible majoritaire du site), ou GRAPHIE du lexique sous un champ porteur mesuré' : c.listeIdsNus ? 'tableau de chaînes dont au moins un élément résout' : c.champs?.length ? `la clé porteuse ${c.champs.map((x) => `\`${x}\``).join(' ')}` : `son noyau ${(c.noyau ?? []).map((k) => `\`${k}\``).join(' ')}${c.noyauMin ? ` (≥ ${c.noyauMin})` : ''}`}\n\n`;
  if (!lignes.length) {
    out += '_aucune occurrence observée._\n\n';
    continue;
  }
  out += tableau(
    ['Famille', 'Champ', 'Forme', 'Statut', 'Dataset', 'Occurrences', ...(c.resolvables ? ['Résolvables'] : []), 'Cibles résolues', 'Note'],
    lignes.map((f) => [
      f.famille,
      `\`${f.champ}\``,
      `\`${f.signature}\``,
      f.statut,
      `\`${f.dataset}\``,
      f.occurrences,
      ...(c.resolvables ? [f.resolvables || '—'] : []),
      f.cibles.slice(0, 6).map((d) => `\`${d}\``).join(' ') + (f.cibles.length > 6 ? ' …' : '') || '—',
      f.note || '',
    ]),
  );
  if (!c.graphiesEnveloppantes?.length) continue;
  // Réconciliation des graphies ENVELOPPANTES : une même graphie se lit sous sa signature NUE et
  // sous le chemin `enveloppe>graphie`. Le total par graphie ne se lit donc sur aucune ligne seule.
  const rangs = c.graphiesEnveloppantes.map((g) => {
    const nue = lignes.filter((f) => f.signature === g);
    const sous = lignes.filter((f) => f.signature.endsWith(`>${g}`));
    const somme = (xs: typeof lignes) => xs.reduce((a, f) => a + f.occurrences, 0);
    return {
      graphie: g,
      brut: scan.graphiesBrutes[g] ?? 0,
      nue: somme(nue),
      sous: somme(sous),
      chemins:
        sous
          .map((f) => `\`${f.signature}\` ${f.occurrences} (\`${f.dataset}\` › \`${f.champ}\`)`)
          .join(' · ') || '—',
    };
  }).filter((r) => r.sous > 0);
  if (rangs.length) {
    out += 'Une graphie ENVELOPPANTE se compte sous sa signature NUE **et** sous le chemin\n';
    out += '`enveloppe>graphie` : le total par graphie ne se lit sur aucune ligne seule de la table\n';
    out += 'ci-dessus. La colonne BRUT compte la clé dans la donnée, tout classement confondu : ce qu’elle\n';
    out += 'dépasse de `nue + sous` est hors du périmètre du concept (champ porteur non mesuré, objet orphelin\n';
    out += `ou hors strate, §${SECTION.orphelines}).\n\n`;
    out += tableau(
      ['Graphie', 'Clé dans la donnée (brut)', 'Signature nue', 'Sous une enveloppe', 'Nue + sous', 'Chemins composés'],
      rangs.map((r) => [`\`${r.graphie}\``, r.brut, r.nue, r.sous, r.nue + r.sous, r.chemins]),
    );
  }
}

out += `### ${SECTION.homonymes} Homonymes nominatifs\n\n`;
out += 'Une clé RÉSERVÉE à un concept qui porte ≥ 2 classes de type dans la donnée : le NOM ne dit plus le\n';
out += 'type. Cible #1463 S2 : un nom de concept est réservé à son type. Une clé réservée encore homonyme\n';
out += 'ne FORCE aucun concept — seul `price` nomme le concept `prix`, parce que `Price` est un type.\n\n';
out += tableau(
  ['Clé', 'Classes', 'Occurrences', 'Détail par classe'],
  scan.homonymes.map((h) => [
    `\`${h.cle}\``,
    h.classes.join(' \\| '),
    h.total,
    h.parClasse.map((c) => `**${c.classe}** ${c.datasets.slice(0, 8).join(' ')}${c.datasets.length > 8 ? ' …' : ''}`).join(' — '),
  ]),
);

out += `### ${SECTION.parametres} Paramètres d’entité (\`arg\`) et régimes de \`price\`\n\n`;
{
  const total = scan.parametres.reduce((a, p) => a + p.occurrences, 0);
  const enData = scan.parametres.filter((p) => p.racines.includes('src/data')).length;
  const scenesSeules = scan.parametres.filter((p) => !p.racines.includes('src/data'));
  out += `Valeurs distinctes d’\`arg\` sur un objet porteur d’\`id\` : **${scan.parametres.length}** `;
  out += `(${total} occurrences) — **${enData}** vues en \`src/data\`, **${scenesSeules.length}** propres aux scènes `;
  out += `(${scenesSeules.map((p) => `\`${p.valeur}\``).join(', ') || '—'}). Aucun schéma ne les DÉCLARE aujourd’hui :\n`;
  out += 'cette table EST le dénominateur A11 de #1466. La « nature » est devinée par MOTIF (id d’entité,\n';
  out += 'enum-libellé, taille, seuil `N+`, prose, nombre) : un candidat à examiner, jamais un verdict.\n\n';
  out += tableau(
    ['Valeur d’`arg`', 'Nature (motif)', 'Occurrences', 'Datasets'],
    scan.parametres.map((p) => [
      `\`${p.valeur}\``,
      p.nature,
      p.occurrences,
      p.datasets.slice(0, 6).map((d) => `\`${d}\``).join(' ') + (p.datasets.length > 6 ? ' …' : ''),
    ]),
  );
}
out += '`Price = Money | {saison} | {dice} | "ND"` (DESIGN v2 S4) : les régimes ci-dessous sont la colonne\n';
out += 'Prix du RAW, pas une bourse unique — un coefficient saisonnier n’est pas une monnaie à éteindre.\n\n';
out += tableau(
  ['Régime de `price`', 'Occurrences'],
  scan.regimesPrix.map(([r, n]) => [r, n]),
);

out += `### ${SECTION.textes} Dotations narratives \`{text}\`\n\n`;
out += 'Un `{text}` n’est une occurrence de référence que si son texte normalisé (casse, accents, ponctuation,\n';
out += 'espaces) égale le `label` d’une entité d’un dataset de la CIBLE MAJORITAIRE de son site — de n’importe\n';
out += 'quel dataset quand le site n’a pas de cible, et sans vérification du TYPE attendu (angle mort). Ces\n';
out += 'occurrences-là portent la forme `text (résolvable)` (divergente, à migrer en `{id}`, #624) ; les autres\n';
out += 'sont le narratif irréductible que la forme `text` DÉCLARE (#1463, #624).\n\n';
out += tableau(
  ['Signature de l’objet', 'Occurrences', 'Résolvables'],
  scan.textes.map((t) => [`\`${t.signature}\``, t.occurrences, t.resolvables || '—']),
);

out += `### ${SECTION.orphelines} Hors strate — signatures ORPHELINES\n\n`;
out += 'Objet qui ANNONCE une référence (clé `…Id`/`…Ids`/`…Ref`, clé réservée, clé d’identité) et qui ne\n';
out += 'résout vers RIEN, sans être un document, et qui ne porte pas d’`op` (la strate Ops le porterait).\n';
out += 'Aucune strate ne le porte : c’est ce que le détecteur ne sait pas nommer, et il se compte au lieu\n';
out += 'de se taire. Stock `STRUCTURES_ORPHELINES` ; le LOT suit le motif — `L1a #1466` quand le NOM de la\n';
out += 'clé annonçait une FK (`clé de référence non résolue`), `#1553` pour les autres motifs.\n\n';
out += 'Ce que le motif `clé réservée` nomme : le DÉCLENCHEUR est le NOM de la clé (`CLES_RESERVEES` du\n';
out += 'lexique), pas une valeur qui pointerait vers rien — le contenu de ces objets est légitime, et la\n';
out += 'clé `source` à elle seule en déclenche la majorité. Ce motif-là se solde au VOCABULAIRE (#1463 S2 :\n';
out += 'un nom de concept est réservé à son type), pas en curant un contenu ni en posant une enveloppe.\n\n';
{
  const total = scan.orphelines.reduce((a, o) => a + o.occurrences, 0);
  const parMotif = new Map<string, { lignes: number; occurrences: number }>();
  for (const o of scan.orphelines) {
    const vu = parMotif.get(o.motif) ?? { lignes: 0, occurrences: 0 };
    parMotif.set(o.motif, { lignes: vu.lignes + 1, occurrences: vu.occurrences + o.occurrences });
  }
  const motifs = ['clé de référence non résolue', 'clé réservée', 'identité non résolue'] as const;
  out += `**${scan.orphelines.length}** signatures orphelines, **${total}** occurrences. Par motif : `;
  out += motifs.map((m) => `\`${m}\` ${parMotif.get(m)?.lignes ?? 0}`).join(' · ');
  out += `. Le lot \`L1a #1466\` porte donc ${parMotif.get('clé de référence non résolue')?.lignes ?? 0} ligne(s) ici, `;
  out += `\`#1553\` en porte ${scan.orphelines.length - (parMotif.get('clé de référence non résolue')?.lignes ?? 0)}.\n\n`;
  out += tableau(
    ['Dataset', 'Champ', 'Signature', 'Motif', 'Occurrences'],
    scan.orphelines.map((o) => [`\`${o.dataset}\``, `\`${o.champ}\``, `\`${o.signature}\``, o.motif, o.occurrences]),
  );
  out += `Au-delà des orphelines, **${scan.objets.invisibles}** objets sur **${scan.objets.vus}** ne sont portés par AUCUNE\n`;
  out += 'strate : ils n’annoncent aucune référence, ne portent aucune valeur du lexique et ne sont pas des\n';
  out += 'documents. Les GRAPHIES de référence les ont quittés (une enveloppe `{ref:{…}}` ou une dotation\n';
  out += `\`{text}\` sous un champ porteur mesuré est une FORME, §${SECTION.concept(CONCEPTS[0])}). Restent trois familles : les CHARGES UTILES pures\n`;
  out += '(`{x,y}` d’une tuile, bloc de caractéristiques, `{flat,plusBF}` de dégâts), les objets d’un `Flow`\n';
  out += `ou d’une \`Formula\` (\`{kind,steps}\`, \`{bonusOf}\`) et les objets à \`op\`, dont la grammaire est mesurée en §5.\n`;
  out += 'Ils ne sont pas au stock — ils se lisent ici, EN ENTIER : les\n';
  out += `**${scan.invisibles.length}** signatures hors strate, triées par occurrences décroissantes. Le diff de cette\n`;
  out += 'table EST la revue de toute signature neuve ; le CLIQUET qui la garde vit dans\n';
  out += '`src/data/structures-contrat.test.ts` (plafond sur le COMPTE, liste de référence = cette table).\n\n';
  out += `${MARQUE_HORS_STRATE.debut}\n`;
  out += tableau(
    ['Dataset', 'Champ', 'Signature', 'Occurrences'],
    scan.invisibles.map((o) => [`\`${o.dataset}\``, `\`${o.champ}\``, `\`${o.signature}\``, o.occurrences]),
  );
  out += `${MARQUE_HORS_STRATE.fin}\n\n`;
}

// ---------------------------------------------------------------------------
out += '## 4. Redéclarations locales dans `src/data/schemas/defs/*.ts`\n\n';
out += `Littéraux d’objet zod lus : **${totalLitteraux}** ; **${redeclarations.length}** recoupent le lexique\n`;
out += 'ou un littéral de `src/data/schemas/grammaire/`. « Schéma commun candidat » = même signature EXACTE\n';
out += 'qu’un littéral de la grammaire (candidat à examiner, cf. angles morts).\n\n';
out += '### 4.1 Empreinte par concept, critère SUPERSET (indépendant du classement ordonné)\n\n';
out += 'Un littéral qui porte le noyau d’un concept, même s’il a été classé sous un autre concept en §4.2 :\n';
out += 'ce compte lève l’angle mort du classement ordonné.\n';
{
  const money = empreintesDefs(ROOT).find((e) => e.concept === 'monnaie');
  const nMonnaie = money?.litteraux ?? 0;
  out += `Le DoD de #1463 annonçait « 5 defs redéclarent la monnaie » : la mesure en trouve **${nMonnaie}** littéraux\n`;
  out += `dans **${money?.defs.length ?? 0}** defs (${(money?.defs ?? []).map((d) => `\`${d}\``).join(' ')}).\n`;
  out += nMonnaie === 5 ? 'Le chiffre du DoD est CONFIRMÉ par la mesure.\n' : 'Le chiffre du DoD n’a pas ce porteur dans l’arbre : il ne se recopie pas.\n';
  // Le critère est NOMMÉ, sites compris : un littéral PARTIEL du noyau compte (noyauMin), et c'est
  // ce qui sépare cette mesure d'une mesure à noyau COMPLET.
  const partiels = (money?.sites ?? []).filter((s) => s.cles.length < (money?.noyau.split(',').length ?? 0));
  out += `Critère : ≥ **${money?.noyauMin ?? 0}** clé(s) du noyau \`${money?.noyau ?? ''}\`. Sites : `;
  out += `${(money?.sites ?? []).map((s) => `\`${s.site}\`${s.champ ? ` (\`${s.champ}\`)` : ''} \`{${s.cles.join(',')}}\``).join(' · ') || '—'}.\n`;
  out += `Dont **${partiels.length}** littéral(aux) PARTIEL(s) du noyau — `;
  out += `${partiels.map((s) => `\`${s.site}\``).join(' ') || '—'} : une mesure qui exigerait le noyau COMPLET `;
  out += `\`${money?.noyau ?? ''}\` en compterait **${nMonnaie - partiels.length}**, pas ${nMonnaie}. Le compte du DoD se lit avec le critère.\n\n`;
}
out += tableau(
  ['Concept', 'Noyau', 'Littéraux', 'Defs', 'Liste des defs'],
  empreintesDefs(ROOT).map((e) => [
    e.concept,
    `\`${e.noyau}\``,
    e.litteraux,
    e.defs.length,
    e.defs.map((d) => `\`${d}\``).join(' ') || '—',
  ]),
);

{
  const idSpec = redeclarations.filter((r) => {
    const cles = r.signature.replace('+…', '').split(',');
    return cles.includes('id') && cles.includes('spec');
  });
  out += `Le DoD de #1463 annonçait « 5 \`{id,spec}\` » : la mesure en trouve **${idSpec.length}** littéral(aux) —\n`;
  out += `${idSpec.map((r) => `\`${r.def}\`${r.champ ? ` › \`${r.champ}\`` : ''} \`{${r.signature}}\` (${r.statut})`).join(' · ')}. Les autres n’ont pas de\n`;
  out += 'porteur dans l’arbre, le chiffre ne se recopie pas.\n\n';
}

out += '### 4.2 Littéral par littéral\n\n';
out += tableau(
  ['Def', 'Ligne', 'Champ', 'Concept', 'Statut', 'Empreinte', 'Schéma commun candidat'],
  redeclarations.map((r) => [
    `\`${r.def}\``,
    r.ligne,
    r.champ ? `\`${r.champ}\`` : '—',
    r.concept || '—',
    r.statut,
    `\`${r.signature}\``,
    r.commun ? `\`${r.commun}\`` : '—',
  ]),
);

// ---------------------------------------------------------------------------
out += '## 5. Ops en donnée (strate Ops)\n\n';
const nbSignaturesOps = new Set(scan.ops.map((o) => `${o.op} | ${o.signature}`)).size;
const totalObjetsAOp = scan.totalOps + scan.totalConditionsAvecOp;
out += '`gameOpSchema` est un `looseObject` (`src/data/schemas/grammaire/mecanique.ts`) : seul `op` est contraint.\n';
out += `Mesure : **${totalObjetsAOp}** objets portent un \`op\` = **${scan.totalOps}** ops de jeu + **${scan.totalConditionsAvecOp}**\n`;
out += `Conditions dont l’\`op\` est un COMPARATEUR (\`kind\` reconnu par \`conditionSchema\`, kinds lus par AST).\n`;
out += `**${scan.totalConditionsAvecOp + scan.totalConditionsSansOp}** Conditions au total, dont **${scan.totalConditionsSansOp}** sans \`op\` :\n`;
out += 'celles-là n’ont jamais été comptées en op — le retrait des Conditions du compte d’ops vaut\n';
out += `${totalObjetsAOp} → ${scan.totalOps}, jamais ${totalObjetsAOp} → ${totalObjetsAOp - (scan.totalConditionsAvecOp + scan.totalConditionsSansOp)}.\n`;
out += `Noms d’op distincts : **${new Set(scan.ops.map((o) => o.op)).size}**, signatures distinctes : **${nbSignaturesOps}**.\n\n`;
out += tableau(
  ['`kind` de Condition', 'Avec `op`', 'Sans `op`'],
  scan.conditions.map((c) => [`\`${c.kind}\``, c.avecOp || '—', c.sansOp || '—']),
);
{
  const total = scan.opsComparateurs.reduce((a, o) => a + o.occurrences, 0);
  out += `Restent **${total}** occurrence(s) dont le nom d’op n’est pas alphabétique (un COMPARATEUR) sous un\n`;
  out += '`kind` étranger à `conditionSchema` : elles sont encore comptées en op ci-dessous, mesurées ici.\n\n';
  out += tableau(
    ['Op', '`kind` porté', 'Dataset', 'Occurrences'],
    scan.opsComparateurs.map((o) => [`\`${o.op}\``, `\`${o.kind}\``, `\`${o.dataset}\``, o.occurrences]),
  );
}
{
  const CLES_REF = ['skillId', 'skill', 'talentId', 'trappingId', 'traitId', 'spellId', 'creatureId', 'vehicleId', 'tableId', 'spec'];
  out += 'Une ligne par (op, signature, dataset) — stock `STRUCTURES_OPS`, lot `L1c #1468` : la cible est une\n';
  out += 'union discriminée générée d’`OP_DEFS`, à refs EMBOÎTÉES (`skill: {id, spec}`).\n\n';
  out += tableau(
    ['Op', 'Signature', 'Dataset', 'Occurrences', 'Clés de ref à plat'],
    scan.ops.map((o) => {
      const refs = CLES_REF.filter((k) => o.signature.split(',').includes(k));
      return [`\`${o.op}\``, `\`${o.signature}\``, `\`${o.dataset}\``, o.occurrences, refs.length ? refs.map((r) => `\`${r}\``).join(' ') : '—'];
    }),
  );
}

// ---------------------------------------------------------------------------
out += '## 6. Slots DÉCLARÉS × réfs OBSERVÉES (registre des slots)\n\n';
out += 'Le côté DÉCLARÉ des références est ce que le PARSE valide : chaque document est parsé par son schéma\n';
out += 'réel au PARSE DE MESURE (`reperesDuParse`, `src/data/schemas/grammaire/ref.ts`), et chaque case\n';
out += '`(porteur, clé)` dont la valeur est validée par `idDe` est un SLOT, avec son type. Son enforcement vit\n';
out += 'dans `src/data/slots-contrat.test.ts`.\n\n';
out += `${MANDAT_SLOTS}\n\n`;
{
  const slots = slotsDuParse(scan, DEFS);
  const lignes = registreDesSlots(scan, slots);

  out += `Slots déclarés : **${slots.length}**, sur **${lignes.length}** paths de donnée.\n\n`;

  out += '### 6.1 Registre des slots — une ligne par (document, path, type)\n\n';
  out += 'Le path est celui de la DONNÉE, indices normalisés en `[]` ; une référence portée par une CLÉ de\n';
  out += 'record s’y écrit `{}`. « Valeurs » : les slots de la ligne, chacun validé contre le registre des ids au\n';
  out += 'parse. « Couples touchés » : les couples `(dataset, champ)` que le scan attribue aux occurrences dont\n';
  out += 'ces slots sont des cases (jointure par occurrence) — « — » quand ils n’en touchent aucune.\n\n';
  out += tableau(
    ['Dataset', 'Path', 'Type', 'Valeurs', 'Couples touchés'],
    lignes.map((l) => [
      `\`${l.dataset}\``,
      `\`${l.path}\``,
      `\`${l.type}\``,
      l.valeurs,
      l.couples.length ? l.couples.map((k) => `\`${k}\``).join(' ') : '—',
    ]),
  );

  const joints = champsJoints(scan, slots);
  out += `Couples porteurs de réfs OBSERVÉES dont le déclaré ATTEINT toutes les occurrences : **${joints.length}** — `;
  out += `${joints.map((k) => `\`${k}\``).join(' ') || '—'}. Une jointure VIDE rendrait ce volet muet :\n`;
  out += 'la garde l’exige NON VIDE.\n\n';

  out += '### 6.2 Couverture — réfs observées qu’AUCUN slot ne déclare\n\n';
  out += 'La dette d’ADOPTION du registre : un `(dataset, champ)` porteur de références mesurées (strate\n';
  out += '`Référence`) dont une occurrence au moins n’est pas ATTEINTE — une de ses cases n’est pas un slot. Stock `SLOTS_SANS_DECLARATION`\n';
  out += '(`scripts/guards/lib/slotsStock.mjs`, garde `src/data/slots-contrat.test.ts`) — il se solde concept\n';
  out += 'par concept en L2/L3 (#1473), et ne fait que DÉCROÎTRE.\n\n';
  const sansSlot = champsSansSlot(scan, slots);
  out += `**${sansSlot.length}** couples (dataset, champ) sans slot déclaré.\n\n`;
  out += tableau(
    ['Dataset', 'Champ', 'Occurrences observées', 'Atteintes'],
    sansSlot.map((c) => [`\`${c.dataset}\``, `\`${c.champ}\``, c.occurrences, c.atteintes]),
  );

  out += '### 6.3 Angles morts DÉCLARÉS de ce volet\n\n';
  out += 'Source UNIQUE `ANGLES_MORTS_SLOTS` (`scripts/docs/lib/structures-lexique.mts`).\n\n';
  out += ANGLES_MORTS_SLOTS.map((a) => `- ${a}`).join('\n');
  out += '\n\n';
}

emitOrCheck({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:structures — ${OUT} est PÉRIMÉ (diverge de la donnée / des defs mesurées).`,
  rerunMsg: '  → relancer `npm run docs:structures` et committer le résultat.',
  okMsg: `docs:structures — OK (${OUT} à jour, ${scan.documents.length} documents, ${scan.formes.length} formes)`,
  writeMsg: `${OUT} — ${scan.documents.length} documents (2 racines), ${scan.index.ids} ids indexés, ${scan.formes.length} lignes de forme, ${scan.orphelines.length} signatures orphelines, ${scan.homonymes.length} homonymes, ${redeclarations.length} redéclarations locales, ${scan.ops.length} lignes d’op / ${scan.totalOps} ops.`,
});
