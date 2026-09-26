import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classerValeur,
  mesurerEnveloppe,
  scannerDonnees,
  scannerRedeclarations,
  MARQUE_HORS_STRATE,
} from '../../scripts/docs/lib/structures-scan.mjs';
import {
  ANGLES_MORTS,
  CLES_DE_VALEUR,
  CONCEPTS,
  LOTS_CONNUS,
  LOTS_DE_PEUPLEMENT,
  LOT_CLE_RESERVEE,
  lotDeForme,
  CLES_IDENTITE,
  RX_CLE_REFERENCE,
  signature,
} from '../../scripts/docs/lib/structures-lexique.mjs';
import { choixDeclares, introspecterDefs } from '../../scripts/docs/lib/zod-introspect.mjs';
import { CLES_ENVELOPPE } from './schemas/grammaire/document';

/**
 * Clés que `document()` pose sur TOUT document, sans qu'aucun def ne les demande — DÉRIVÉES de
 * `CLES_ENVELOPPE`, jamais re-tapées.
 *
 * `variants` en est EXCLUE et c'est la seule : la fabrique ne la pose que si le def le DEMANDE
 * (`options.variantes`, `document.ts` — « un document sans `variantes` n'admet aucun `variants` »).
 * Elle reste donc une DÉCLARATION du def, comme n'importe quel champ de `champs` : un def qui
 * l'active sans qu'aucune entrée ne la porte est bien « un schéma plus large que sa donnée », et sa
 * dette se compte. Mesuré au 2026-08-28 : 3 defs l'activent — `spells` (18 entrées porteuses),
 * `talents` (12), `traits` (0/131, dette réelle).
 */
const CLES_POSEES_INCONDITIONNELLEMENT: readonly string[] = (CLES_ENVELOPPE as readonly string[]).filter((k) => k !== 'variants');
import { defsDeDocument } from '../../scripts/docs/lib/slots-registre.mjs';
import {
  STRUCTURES_CIBLES,
  STRUCTURES_DEFAUT,
  STRUCTURES_ENVELOPPE,
  STRUCTURES_FORMES,
  STRUCTURES_HOMONYMES,
  STRUCTURES_OPS,
  STRUCTURES_ORPHELINES,
  STRUCTURES_REDECLARATIONS,
} from '../../scripts/guards/lib/structuresStock.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — sous quelle FORME chaque concept est-il écrit dans la donnée (dataset, champ porteur mesuré, signature) ? ' +
    'B — le stock NOMINATIF de ce qui reste à migrer, ligne par ligne, avec son compte d’occurrences. ' +
    'C — chaque ligne porte le LOT qui l’éteint (L1a #1466 FK · L1b #1467 enveloppe · L1c #1468 ops · ' +
    'L1d #1469 source · L2 refs de Compétence · L3 Talent/Trait/Objet · L4 Valeurs), et part avec sa migration.',
  primitive:
    '`scannerDonnees` / `scannerRedeclarations` (`scripts/docs/lib/structures-scan.mts`). Ce scan lit la DONNÉE JSON ' +
    'des deux racines (`src/data`, `src/scenes`) et l’AST des `src/data/schemas/defs/*.ts` — il ne passe donc PAS par ' +
    '`readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`), qui ne lit que du CODE.',
  perimetre:
    'Les documents authorés des deux racines `src/data` et `src/scenes`, leurs schémas zod du registre, et les littéraux ' +
    'd’objet zod des defs. La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par dataset : le champ porteur est mesuré ' +
    '(clé du parent), jamais déclaré, et la résolution se mesure par SITE (dataset, champ, clé).',
  angleMort: ANGLES_MORTS,
  baseline: {
    fichier: 'scripts/guards/lib/structuresStock.mjs',
    decroissant: true,
    raison:
      'Le stock EST le dénominateur du chantier #1463 : chaque ligne se solde par une migration vers la forme cible, ' +
      'et part dans le MÊME commit. Une ligne neuve est une dérive, jamais une exception à inscrire.',
  },
  ticket: '#1465',
} as const;

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
/** Le DÉCLARÉ couvre les DEUX racines (#1466 L1a) — jointure par BASENAME, comme le scan key. */
const DEFS = defsDeDocument();
/** UN seul scan pour tout le fichier : le test consomme la mesure, il ne relit jamais les JSON. */
const DECLARES = introspecterDefs(DEFS);
const FAMILLES = new Map(DECLARES.map((d) => [d.file, d.famille]));
const CHOIX = choixDeclares(DEFS);
const scan = scannerDonnees(ROOT, FAMILLES, CHOIX);
const { redeclarations } = scannerRedeclarations(ROOT);

/** Un ensemble de lignes en texte, trié — les diffs de vitest restent lisibles. */
const lignes = (xs: string[]): string[] => [...xs].sort();

/**
 * DATE par DÉFAUT d'une ligne de stock : elle entre dans la clé comparée. Sur les stocks dont la
 * ligne OBSERVÉE ne reprend PAS le pilotage — tous sauf `STRUCTURES_FORMES` —, re-dater une ligne
 * pour la faire passer est impossible : elle se compare, date comprise, à la mesure du jour du lot.
 * Sur `STRUCTURES_FORMES`, `lot`/`motif`/`date` sont du PILOTAGE que `cleFormeObservee` reprend du
 * stock par le SITE : la sonde ne les mesure pas, ils se DÉCIDENT en revue (angle mort déclaré,
 * `ANGLES_MORTS` de `scripts/docs/lib/structures-lexique.mts`).
 */
const DATE_STOCK = '2026-08-23';
/**
 * `lot`, `motif` et `date` ENTRENT dans la clé comparée (#1465 F1) ; le LOT attendu se DÉDUIT du
 * concept quand la ligne n'en déclare pas. Ces trois champs sont du PILOTAGE : ils se DÉCIDENT en
 * revue, la sonde ne les mesure pas — c'est pourquoi la forme observée les reprend du stock
 * (`pilotageDeForme` ci-dessous).
 */
type Trace = { lot?: string; date?: string; motif?: string };
const trace = (x: Trace, lot: string) => ` | ${x.lot ?? lot} | ${x.date ?? DATE_STOCK}`;
/** LOT par défaut d'une divergence d'ENVELOPPE observée (le stock, lui, le porte ligne à ligne) :
 *  une absence sur les ENTRÉES DE RACINE part en `L1d #1469`, une clé divergente en `L1b #1467`. */
const lotEnveloppe = (e: { role: string }) => (e.role === 'source' ? 'L1d #1469' : 'L1b #1467');
const cleForme = (
  f: {
    concept: string;
    dataset: string;
    champ: string;
    signature: string;
    statut: string;
    strate: string;
    occurrences: number;
    cibles?: readonly string[];
  } & Trace,
) =>
  `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.strate} | ${f.occurrences}` +
  trace(f, lotDeForme(f.concept, f.signature, f.cibles ?? [])) +
  (f.motif ? ` | ${f.motif}` : '');
/** SITE d'une forme : ce qui l'identifie indépendamment de sa mesure et de son pilotage. */
const siteDeForme = (f: { concept: string; dataset: string; champ: string; signature: string }) =>
  `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature}`;
/** Le stock des formes, typé pour la lecture de son PILOTAGE (`lot`, `motif`, `date`). */
const FORMES: readonly (Parameters<typeof cleForme>[0])[] = STRUCTURES_FORMES;
/**
 * LOTISSEMENT déclaré d'un site, repris par la forme OBSERVÉE. Le lot déduit de `lotDeForme` lit la
 * colonne `cibles`, qui liste TOUS les datasets atteignables (angle mort des COLLISIONS d'ids) : une
 * ligne dont le concept réel n'est pas celui-là se re-lotit en revue et porte son `motif`. Un site
 * que le stock ne connaît pas garde son lot déduit — une dérive neuve entre avec son heuristique.
 */
const pilotageDeForme = new Map(FORMES.map((f) => [siteDeForme(f), { lot: f.lot, motif: f.motif, date: f.date }]));
const cleFormeObservee = (f: Parameters<typeof cleForme>[0]) => cleForme({ ...f, ...pilotageDeForme.get(siteDeForme(f)) });
const cleOrpheline = (o: { dataset: string; champ: string; signature: string; motif: string; occurrences: number } & Trace) =>
  `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif} | ${o.occurrences}` +
  trace(o, o.motif === 'clé de référence non résolue' ? 'L1a #1466' : '#1553');
/**
 * PILOTAGE (`lot`, `date`) d'une ORPHELINE, repris du stock par SITE — MÊME patron que
 * `pilotageDeForme` ci-dessous : la sonde ne mesure ni le lot ni la date (angle mort déclaré). Sans
 * cette reprise, toute ligne était sommée de porter la date GLOBALE du stock, et une entrée née plus
 * tard ne pouvait être verte qu'en MENTANT sur sa date de naissance. Les deux champs restent gardés :
 * une ligne du stock que la mesure n'observe plus reste rouge, et le test de MUTATION par champ
 * (ci-dessous) prouve qu'ils entrent toujours dans la clé comparée.
 */
const siteOrpheline = (o: { dataset: string; champ: string; signature: string }) => `${o.dataset} | ${o.champ} | ${o.signature}`;
const pilotageOrpheline = new Map(STRUCTURES_ORPHELINES.map((o) => [siteOrpheline(o), { lot: o.lot, date: o.date }]));
const cleOrphelineObservee = (o: Parameters<typeof cleOrpheline>[0]) => cleOrpheline({ ...o, ...pilotageOrpheline.get(siteOrpheline(o)) });
/**
 * CLIQUET des signatures hors strate (#1465) : elles ne sont pas au stock — la table EXHAUSTIVE
 * de `docs/structures-donnees.md` EST la liste de référence, et ce plafond garde son COMPTE.
 */
// Vague console #1411/#1426 distante, réconciliation post-rebase : `actions.json` gagne une entrée
// et le champ `hote` — la donnée est committée, le cliquet la rattrape (1116→1118).
// #1466 L1a volet A (1118→1119) : le DÉCLARÉ couvre désormais `src/scenes`, donc les discriminants
// des 4 projets se FERMENT — `loup-et-saumure-projet.json › threat {camp,tier}` cesse d'être compté
// comme référence `tier+…` (sa valeur est un littéral d'enum du schéma) et tombe hors strate. C'est
// le MÊME objet qui change de classement, pas une structure neuve : le dénominateur des formes
// décroît de 8 lignes dans le même geste.
// #1467 L1b V-P1 (1119→1120) : `donnees.manifest.json › rubriques` passe `nom` → `label`, donc sa
// signature `entrees,nom` (divergente, au stock) devient `entrees,label` (forme CIBLE du lexique,
// hors strate). MÊME objet, nouveau classement — le stock perd 12 lignes dans le même geste
// (identité+libellé `nom` des 3 manifestes, `id` de careerLevels/calendarPhases/raw.manifest,
// `key` de calendarPhases, `label` absent de primitives/systemes).
// L2 #1548, commit 3c (1120→1135) : AUCUNE structure neuve — les 334 références de Compétence qui
// s'emboîtent en `skill: { id, spec? }` posent chacune un OBJET là où il n'y avait qu'une chaîne, et
// ces objets sont à la forme CIBLE (`id` / `id,spec`) : ils sont HORS STRATE par construction. Les
// signatures nommées par la garde (`bonus,op,skill`, `mod,op,skill`, `blocked,op,skill`…) sont les
// PAYLOADS D'OP qui, ayant perdu leur `spec` frère ou leur `skill` chaîne, rejoignent la table hors
// strate. Le dénominateur À ÉTEINDRE, lui, décroît de 16 lignes dans le même geste (cf. cliquets).
// L2 #1548, commit 3d (1135→1137) : AUCUNE structure neuve — `talents.json › reverseFailed` porte
// désormais une LISTE nommée `skills` là où `skill` désignait tantôt une réf, tantôt une liste. La
// clé cessant d'être un nom de concept RÉSERVÉ, ses deux signatures (`skills`, `capDR,skills`)
// quittent le dénominateur à éteindre (`STRUCTURES_ORPHELINES` 106→104) et rejoignent la table hors
// strate. MÊMES objets, nouveau classement.
// L2 #1548, commit 4 (1137→1139) : AUCUNE structure neuve — l'avancement quitte ses quatre graphies
// enveloppantes, et le « A ou B » des listes s'écrit `{pick, of}`, une signature CIBLE du lexique.
// Les trois signatures NOMMÉES par la garde sont ce re-classement : `careerLevels.json › skills
// {of,pick}`, `careerLevels.json › talents {of,pick}`, `species.json › talents {of,pick}` — les
// MÊMES 45 objets qui s'écrivaient `{choice}`. +3 donc, et −1 : `species.json › choice
// {specOptions,wildcard}` MEURT (le joker à options bornées s'écrit `{id, choix: [ids]}`, forme
// CIBLE, et ne pose plus d'objet sous `choice`). +2 net, 1137 → 1139. Le dénominateur À ÉTEINDRE,
// lui, perd 19 lignes dans le même geste (cf. les cliquets par lot ci-dessous).
// #862 (1139→1142) : AUCUNE structure neuve — `mutations.json` porte pour la première fois un
// `effects` de déclencheur (Haine sporadique, `onDayStart`), et ses TROIS objets d'enveloppe sont les
// formes CIBLES déjà écrites par `traits.json`/`talents.json` : `effects {flow,on,trigger}`,
// `flow {effect,kind}`, `effect {on,ops,type}` — mesurées une par une contre la table du doc.
// #674 (1142→1144) : AUCUNE structure neuve — la RÉ-EXPOSITION (EDOC 08 l.122 : « Les Personnages
// atteints du rhume qui sont à nouveau exposés à la pluie ou à la neige voient la durée de la maladie
// prolongée de 1d10 jours ») devient une propriété de `maladies.json`, et son temps s'écrit à la
// graphie DÉJÀ posée par `incubation`/`duration` : `reExposition {prolonge}` + `prolonge {dice,unit}`
// (le `DiseaseTime` du fichier). Les deux signatures NOMMÉES par la garde sont ces deux enveloppes.
// #684 L4 (1144ⅆ1146) : AUCUNE structure neuve — le premier tronçon de carte du chapitre 1 pose deux
// objets aux formes DÉJÀ déclarées par le schéma de carte (`defs-scenes/worldmap.ts`) : le gating de
// nœud `when {expr,kind}` (l'algèbre `Condition` du moteur) et le Déplacement d'auteur par mode
// `speed {diligence}` (`MapRoute.speed`). Les deux signatures NOMMÉES par la garde sont ces deux-là.
// #717 (1146→1147) : AUCUNE structure neuve — le CADRE du chapitre pose deux objets aux formes DÉJÀ
// déclarées par le schéma du narratif (`defs-scenes/narratif.ts`) : `cloture {sousTitre,titre,when}`,
// dont le `when` est l'algèbre `Condition` déjà comptée pour le gating de carte, et l'enveloppe
// `narratif` qui gagne ses deux clés OPTIONNELLES. Solde net +1 (la signature `narratif` précédente,
// sans cadre, disparaît au profit de celle-ci).
// #684+#717 sur « La Barge du Sel » (1147→1149) : AUCUNE structure neuve — les MÊMES formes, portées
// par un second paquet. Signatures nommées par la garde : `when {expr,kind}` (l'algèbre `Condition`
// du moteur, portée par le lieu, la route et la clôture), `ouverture {ambiance,pitch,sousTitre,titre}`
// (`ouvertureSchema`), `cloture {sousTitre,titre,when}` (`clotureSchema`) et l'enveloppe `narratif`
// qui gagne ses deux clés optionnelles (`defs-scenes/narratif.ts`, #717) — solde net +2, la signature
// `narratif` sans cadre de ce paquet disparaissant au profit de celle-ci. Ces deux bumps (1146→1147
// et 1147→1149) sont SOLDÉS par #1633 ci-dessous : les formes qu'ils comptaient hors strate sont
// désormais DÉCLARÉES, porte par porte.
// #1463 L-monnaie-3 (1149→1152) : AUCUNE structure neuve — l'effet `giveMoney` cesse d'ÉTALER ses
// dénominations et porte sa charge sous `montant` (`giveMoneySchema`, `defs-scenes/effets.ts`), comme
// `giveXp.amount`. Les 3 signatures NOMMÉES par la garde sont la MEME enveloppe `{montant, type}`, une
// par projet porteur ; ce qu'elles remplacent (`{gold,type}`, `{silver,type}`, `{gold,silver,type}`)
// était compté DIVERGENT au stock des formes, d'où la hausse ici et la baisse de 8 lignes là-bas.
// #1463 L-monnaie-4 (1152→1157) : AUCUNE structure neuve — le nom `cost` rend son type. Sept formes
// quittent `STRUCTURES_ORPHELINES` (elles n'y étaient QUE parce que le NOM `cost` est réservé) et
// rejoignent le hors-strate à l'identique : `install {installation}` / `{installation,weightEnc}`,
// `flow {advantageCost,…}`, `advantageDefenseReaction {avantage}`, `prosthesisTraining` ×3 — d'où la
// hausse ici et la baisse de 7 lignes (29 occurrences) là-bas. Trois autres sont des RENOMMAGES 1:1
// (`cost|bands` → `installation|bands`, `cost|bands,per`, `ops {cost,…}` → `ops {advantageOrMovement,…}`),
// et DEUX enveloppes à clef unique DISPARAISSENT, aplaties sur leur porteur (`qualities cost {advantage}`,
// `talents cost {advantageOrMovement}`). Solde net +7 − 2 = +5.
// #1633 (1157→1145) : la strate `Document` du lexique se PEUPLE — quatre concepts d'ENVELOPPE
// (`ouverture`, `cloture`, `narratif`, `condition`), reconnus à leur NOYAU de clés requises et non au
// nom du champ porteur, et chacun adossé à sa PORTE zod (cf. `STRUCTURES_CIBLES`). DOUZE lignes
// quittent le hors-strate, et ce sont EXACTEMENT celles que les bumps #717/#684 ci-dessus
// annonçaient : `narratif` ×4 (arene, barge, diligence, loup), `ouverture` ×1 (barge), `cloture` ×2
// (barge, diligence), `{expr,kind}` ×5 (`when` d'arene/barge/diligence/loup + `cond` de loup — une
// Condition sous `cond` EST une Condition, débordement légitime et nommé). La donnée n'est pas
// touchée : c'est le lexique qui reconnaît des formes déjà posées, et le cliquet SUIT la baisse.
// Cliquet DESCENDU 1145 → 1141 (#1463 L-de-1, 2026-09-01) : le lexique NOMME la composition d'une
// `Formula` (concept `formule`, signatures `sum` et `sinPoints`), et 7 signatures quittent le hors
// strate pour la strate Valeur — `criticals › durationRounds | sum` (les deux jeux),
// `etats › amount | sum`, `miscast › amount|rounds|value | sum` et `miscast › sum | sinPoints` —,
// tandis qu'une 8ᵉ entre au stock des FORMES comme divergente (`sea-cargo › offerPrice | sum+…`).
// Les 10 termes de Péché de la Colère des dieux sont à la forme CIBLE : ils ne pèsent nulle part.
// Cliquet DESCENDU 1141 → 1136 (#1659 L-1659-1, 2026-09-01) : la candidature `plage` cesse d'être
// POSITIONNELLE (`candidatureHorsTableau` au lexique) — un `{min,max}` numérique porté par un CHAMP
// est la MÊME fourchette que celui d'un élément de tableau. AUCUNE donnée n'est touchée : les CINQ
// signatures qui quittent le hors-strate sont exactement les cinq `{min,max}` hors tableau des deux
// racines, et elles rejoignent la strate Valeur à la forme CIBLE — `sea-events.json › impressed` et
// `› wrathful` (`manannD10,max,min` → `plage max,min+…`), `tavernGames.json › targetRange` et
// `› libre` (`max,min` → `plage max,min`), `water-exposure.json › auto` (`kind,max,min,op` →
// `plage max,min+…`). Le stock des FORMES à éteindre ne bouge pas (ces cinq étaient hors strate, pas
// divergentes) ; les lignes de forme montent de 855 à 860 (cible 388 → 393) et le concept `plage`
// passe de 66 à 71 lignes / 1454 à 1459 occurrences.
// Cliquet MONTÉ 1136 → 1137 (#1659 L-1659-3, 2026-09-01), et c'est le SEUL cran de hausse de la
// vague : les 7 longueurs de coque passent du TUPLE à la fourchette, 6 entrent à la forme CIBLE
// (`ship-construction.json › lengthM | max,min`) et la 7ᵉ — la bande FINALE, que MDG 12 l.129
// imprime « 81+ » — porte `max: null`. Or l'ANGLE MORT déclaré du lexique dit que la candidature
// `plage` est bornée au TYPE : « une borne non numérique (`null` d'une bande ouverte comprise)
// n'ouvre pas la plage » (`scripts/docs/lib/structures-lexique.mts`). Une bande ouverte tombe donc
// hors strate — précédents MESURÉS et déjà au doc : `advancementCosts.json › (racine)` et
// `sea-cargo.json › offerPrice`. Ce cran n'est pas une structure neuve : c'est une fourchette rendue
// VISIBLE, sur un type que la candidature du lexique exclut. Solde de la vague : 1141 → 1136
// (L-1659-1) → 1137, net −4. Ce que ce +1 nomme : la candidature `plage` exclut `plageOuverteSchema`,
// pourtant nœud DÉCLARÉ de la grammaire — l'y admettre sortirait les TROIS bandes ouvertes du
// hors-strate d'un coup (le plafond qui en résulte est à MESURER, pas à prédire ici).
// 1137 → 1140 (#1657 B3-2b-a) : cinq signatures NEUVES à la forme CIBLE, toutes nommées —
// `ship-criticals.json | crewHit | crewTarget,test` et `| crewTarget | poste` (la cible d'un coup
// devient REQUISE et fermée), `river-criticals.json | crewTarget | role` (MSRC 07 l.86 nomme le
// timonier), et les deux `replisSansExpose` (`cible` maritime, RAW MDG 13 l.584 ; `cible,maison`
// fluvial, arbitrage du choix que MSRC 07 l.70 laissait au MJ). Deux signatures de `crewHit` du
// stock partent avec (`crewTarget` textuel).
// 1140 → 1145 (#1657 B3-2b-c) : cinq signatures NEUVES, toutes à la forme CIBLE, toutes MESURÉES —
// `ship-criticals.json | ops | hauteur,op` (5, l'op `fall` des rangées du gréement),
// `| hauteur | table` (5, la réf `{id}` de la table de hauteurs), `| bandes | hauteurs,tailles` (3),
// `| hauteurs | greement,nid-de-pie` (3) et `| greement | dice` (3) — la table « Tomber du gréement »
// (MDG 13 l.684-688). DETTE NOMMÉE : les deux dernières sont indexées sur des IDS DE STATION
// (`ship-stations.json`) — leur signature s'allonge, et leur compte croît, à chaque station qui
// gagne une colonne de hauteur ; c'est le prix de la lecture PAR CLÉ (aucun `if` par station dans
// le moteur), pas une dérive à migrer.
// 1145 → 1148 (#1661) : trois signatures NEUVES, toutes MESURÉES, toutes portées par l'Atout Taillade
// (`AA 08 l.87`, « Vous pouvez dépenser X Avantages pour que votre opposant subisse 1 État Hémorragique
// supplémentaire ») — `qualities.json | indice | label,unite` (l'UNITÉ imprimée par le livre avec la
// valeur, « (1A) », qui pilote `qualityRefLabel`), `| steps | advantageCost,icon,kind,no,prompt,yes`
// et `| yes | effect,kind` (le nœud `choice` de la grammaire, jusqu'ici vu au seul TOP-LEVEL de
// Déstabilisante : le mettre dans un `seq` derrière l'État automatique EXPOSE ses deux signatures).
// Aucune n'est une graphie neuve : ce sont les nœuds DÉCLARÉS de `flowSchema` (`grammaire/mecanique.ts`),
// que la mesure voit ici à une PROFONDEUR inédite dans `qualities.json` (un `choice` sous un `seq`).
// 1148 → 1156 (#1690, mesuré APRÈS rebase sur 6a30233aa) : les formes de `terrains.json` entrent dans la
// mesure des deux racines pour la première fois — le registre TS des 25 sols devient un dataset. Dix
// signatures neuves NOMMÉES par la mesure, +8 net au compte : deux de la rampe de dégradé passée en Record
// (`stops | 0%,100%` et `| 0%,100%,45%`), quatre nœuds DÉCLARÉS de `detailRecipeSchema`
// (`detail | courses,seedScope`, `| seedScope,speckle,tintVar`, `| seedScope,tintVar`,
// `| seedScope,tintVar,tufts`) et quatre recettes (`courses | blockWM,edgeWobble,hM,joint,jointW,
// paletteVar,stagger`, `courses | blockWM,hM,joint,jointW,paletteVar,stagger`, `speckle | colors,perM2,rM`,
// `tufts | colors,hM,perM2`) que plus aucun autre document ne porte à l'identique depuis la purge de
// `structureAppearance.material` (#1686). Aucune graphie neuve : toutes sont la forme CIBLE du lexique.
// 1148 → 1166 (#1612, 2026-09-06) : dix-huit signatures NEUVES, toutes MESURÉES, toutes portées par
// l'Activité Mendier (`LDB 09 l.97/l.99`) et sa table MAISON. Aucune n'est une graphie neuve : ce sont
// les nœuds DÉCLARÉS de `formulaSchema`/`conditionSchema`/`gameOpSchema`, que la mesure voit à une
// profondeur inédite dans ces deux datasets. Quatorze côté `activities.json` :
//   `| brass | times` · `| times | factor,of` · `| of | times` · `| of | bonusOf` · `| factor | sl` —
//   la formule RAW « Bonus de Sociabilité x DR par heure », terme par terme ;
//   `| ops | montant,op` et `| montant | brass` — l'op `money`, qui porte sa charge sous `montant`
//   comme `giveMoney` depuis L-monnaie-3 (la garde `monnaie-forme-unique`, sonde A, l'EXIGE) ;
//   `| outcomes | minSL,on,ops` et `| outcomes | maxSL,on,ops` — les deux bandes de réussite, les
//   bandes d'`activities.json` n'ayant jusqu'ici jamais porté d'`ops` NUES (elles portaient `note`,
//   `payoutPct` ou `resolver`) ;
//   `| testMods | label,mod` et `| testMods | label,mod,when` — les deux modificateurs de situation ;
//   `| when | kind,who` et `| unless | kind,of` · `| of | atLeast,kind,who` — les Conditions du gate
//   d'apparence et de l'exemption de Statut.
// Quatre côté `tables.json`, où l'amende des gardes locaux (`mendier-ennuis.maison`) pose une op
// `money` à `Formula` : `| ops | montant,op`, `| montant | brass`, `| brass | times` et
// `| times | factor,of` — signatures déjà connues d'`activities.json`, neuves dans CE dataset.
// L'op `wounds` de la rangée « autres mendiants », elle, n'ajoute AUCUNE ligne : ses deux mitigations
// déclarées la rangent sous la signature commune de `tables.json` (5 → 6 occurrences).
// 1174 → 1175 (#1687, 2026-09-10) : UNE signature neuve, mesurée —
// `diligence-projet.json | usable | ` (signature VIDE, 5 occurrences) : l'activation d'un décor par
// l'auteur est une ENVELOPPE sans clé (`usable: z.strictObject({})`, `sceneEntitySchema`) — un
// drapeau posé sur l'instance, aucune graphie neuve.
// 1175 → 1177 (#1687 lot 3-I, 2026-09-11) : le champ `interact` des instances de décor MEURT au
// profit de `usable.{assise,actions}` — mesure ligne à ligne, 5 lignes SORTENT, 7 ENTRENT, occurrences
// 13201 → 13205. Sortent : `arene-projet.json | interact | flow` (28) et `| interact | consume,flow` (1),
// `loup-et-saumure-projet.json | interact | flow` (2), `barge-du-sel-projet.json | interact | flow` (1),
// `diligence-projet.json | usable | ` (5, la signature VIDE de la ligne ci-dessus). Entrent, aux MÊMES
// comptes : `usable | actions` (29 / 2 / 1) et `usable | assise` (5) — un champ porteur de plus, la même
// donnée. La hausse NETTE (+2) a une autre cause, MESURÉE par quatre scans {defs} × {données} : les
// 4 objets `effect` des graphies `arene-projet.json › lodging,type` (1), `phase,type` (2) et `type+…` (1)
// ne vivent PAS sous `interact` (ils vivent sous `.scenes[].dialogues[].nodes[].choices[].flow.steps[]`
// et `.scenes[].triggers[].flow.steps[]`, et leur donnée n'a pas bougé d'un octet) ; c'est la
// DÉCLARATION qui a changé, et ce n'est PAS un enum neuf : `effectSchema` déclare `phase` (aube…nuit)
// et `lodging` (auberge/maison/camp) DÉJÀ à HEAD (`schemas/defs-scenes/effets.ts`, fichier intouché par
// ce lot). Ce qui bouge est la PORTÉE de l'INSTRUMENT : `choixDeclares` (`scripts/docs/lib/zod-introspect.mts`)
// marche en DFS mémoïsé PAR IDENTITÉ, borné à `PROFONDEUR_MEMO = 12` — borne ATTEIGNANTE sur ce schéma,
// mesurée : 452 clés visitées à 12, 488 à 20 et au-delà. Le PREMIER chemin qui atteint un nœud décide
// donc s'il est vu : `interact` (chemin COURT vers le flux) meurt au profit de `usable → refine →
// actions[] → flow` (plus profond), l'ordre de visite change, et avec lui les littéraux tenus sous la
// borne. `ouvreReference` (`structures-scan.mts:501`) refusant comme FK toute valeur qui EST un littéral
// d'enum déclaré, ces 4 objets cessent d'être des références et passent hors strate (comptés, pas
// perdus ; le dataset déclare en tout 47 clés / 348 littéraux dans l'arbre de ce lot). Qu'un instrument
// classe une valeur selon la PROFONDEUR d'un chemin de schéma est un DÉFAUT, nommé sur #1687 et hors de
// ce lot. Mesure : defs HEAD → 873 formes /
// 1175 hors strate, que les données soient HEAD ou celles de ce lot ; defs de ce lot → 870 / 1178 sur les
// données HEAD et 870 / 1177 sur les siennes (le −1 restant vient de la donnée). Le reclassement est
// JUSTE (un discriminant déclaré n'est pas une clé étrangère), et il ne migre rien : ces 4 objets
// changent de dénominateur, cf. `STRUCTURES_FORMES` 394 → 391 pour le lot L3 #1463.
// 1177 → 1176 (#1508 T3, 2026-09-07) : la signature `spells.json | ops | op,radius` MEURT — les auras
// de garde (Dôme, Bouclier anti-flèches) lisent leur zone dans la ligne « Cible » de leur sort
// (`OpsCtx.sourceSpell.zde` ; une ZdE est un DIAMÈTRE, `LDB 47 l.28`, `l.356`, `l.408`) ; `arrowWard`
// porte la signature `ops | op`, `domeWard` est TYPÉE (`ops | indice,op,traitId`).
// `spells.json | radius | bonusOf` reste VIVANTE : c'est celle de `castWard`, dont le sort porteur n'a
// pas de ZdE (`target.kind === 'special'`).
const PLAFOND_HORS_STRATE = 1176;
const cleInvisible = (o: { dataset: string; champ: string; signature: string }) =>
  `${o.dataset} | ${o.champ} | ${o.signature}`;

/** La table hors strate du doc COMMITTÉ (HEAD), bornée par `MARQUE_HORS_STRATE`. */
const horsStrateDuDoc = (): Set<string> => {
  const chemin = 'docs/structures-donnees.md';
  const versions: string[] = [];
  try {
    versions.push(execFileSync('git', ['show', `HEAD:${chemin}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }));
  } catch {
    /* pas de HEAD lisible (worktree neuf) : la version de travail fait référence. */
  }
  versions.push(readFileSync(join(ROOT, chemin), 'utf8'));
  const cles = new Set<string>();
  for (const md of versions) {
    const debut = md.indexOf(MARQUE_HORS_STRATE.debut);
    const fin = md.indexOf(MARQUE_HORS_STRATE.fin);
    if (debut < 0 || fin <= debut) continue;
    for (const ligne of md.slice(debut, fin).split('\n')) {
      const cellules = ligne.split('|').map((c) => c.trim().replace(/^`|`$/g, '').replace(/\\\|/g, '|'));
      if (cellules.length !== 6 || !/^\d+$/.test(cellules[4])) continue;
      cles.add(`${cellules[1]} | ${cellules[2]} | ${cellules[3]}`);
    }
    if (cles.size) break;
  }
  return cles;
};

const cleOp = (o: { op: string; signature: string; dataset: string; occurrences: number } & Trace) =>
  `${o.op} | ${o.signature} | ${o.dataset} | ${o.occurrences}` + trace(o, 'L1c #1468');

describe('structures de la donnée — stock nominatif décroissant (#1463 L0)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('structures-scan.mts');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines mesurées.').toMatch(/src\/data.*src\/scenes/s);
    expect(GARDE.angleMort, 'les angles morts se lisent dans UNE source (`ANGLES_MORTS`), jamais recopiés.').toBe(ANGLES_MORTS);
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(10);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/structuresStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1465');
  });

  it('signatures CIBLES : lexique == `STRUCTURES_CIBLES` (une cible ne se décrète pas dans le lexique)', () => {
    const auLexique = CONCEPTS.flatMap((c) =>
      c.signatures.filter((s) => s.statut === 'cible').map((s) => `${c.id} | ${s.sig}`),
    );
    expect(
      lignes(auLexique),
      'le lexique déclare des signatures `cible` que `STRUCTURES_CIBLES` ne connaît pas (ou l’inverse) — faire passer une graphie en cible la sort du dénominateur : ça se décide au STOCK, pas d’un mot du lexique.',
    ).toEqual(lignes(STRUCTURES_CIBLES.map((c) => `${c.concept} | ${c.signature}`)));
  });

  it('formes à éteindre : observé == stock (présence, statut, strate ET occurrences)', () => {
    const observees = scan.formes
      .filter((f) => f.statut === 'historique' || f.statut === 'divergente')
      .map(cleFormeObservee);
    expect(
      lignes(observees),
      'écart entre les formes OBSERVÉES et `STRUCTURES_FORMES` — une ligne en trop côté observé est une dérive neuve (elle se migre), une ligne en trop côté stock est périmée (elle se retire). Le `statut` et la `strate` entrent dans la clé : un statut menteur rougit.',
    ).toEqual(lignes(STRUCTURES_FORMES.map(cleForme)));
  });

  it('signatures ORPHELINES (hors strate) : observé == stock', () => {
    expect(
      lignes(scan.orphelines.map(cleOrphelineObservee)),
      'écart entre les signatures ORPHELINES observées et `STRUCTURES_ORPHELINES` — un objet qui annonce une référence et ne résout vers rien se compte, il ne se tait pas.',
    ).toEqual(lignes(STRUCTURES_ORPHELINES.map(cleOrpheline)));
  });

  it('cliquet HORS STRATE : le COMPTE de signatures ne fait que décroître, les neuves sont NOMMÉES', () => {
    const reference = horsStrateDuDoc();
    expect(
      reference.size,
      'la table EXHAUSTIVE des signatures hors strate est introuvable dans `docs/structures-donnees.md` ' +
        '(bornes `MARQUE_HORS_STRATE`) — sans elle le cliquet n’a plus de liste de référence : régénérer le doc.',
    ).toBeGreaterThan(0);
    const neuves = lignes(scan.invisibles.filter((o) => !reference.has(cleInvisible(o))).map(cleInvisible));
    expect(
      scan.invisibles.length,
      `signatures HORS STRATE en HAUSSE (${scan.invisibles.length} > ${PLAFOND_HORS_STRATE}) — une structure neuve ` +
        'se pose à la forme CIBLE du lexique. Signature(s) NEUVE(s), absentes de la table du doc de référence :\n' +
        (neuves.join('\n') || '(aucune : la hausse vient d’occurrences reventilées, comparer la table du doc)'),
    ).toBeLessThanOrEqual(PLAFOND_HORS_STRATE);
  });

  it('signatures d’OPS : observé == stock (dénominateur du lot L1c #1468)', () => {
    expect(
      lignes(scan.ops.map(cleOp)),
      'écart entre les signatures d’op OBSERVÉES et `STRUCTURES_OPS` — `gameOpSchema` ne valide rien, ce stock EST le dénominateur de la strate Ops.',
    ).toEqual(lignes(STRUCTURES_OPS.map(cleOp)));
  });

  it('homonymes nominatifs : observé == stock', () => {
    const cle = (h: { cle: string; classes: readonly string[]; occurrences: number } & Trace) =>
      `${h.cle} | ${[...h.classes].sort().join('/')} | ${h.occurrences}` + trace(h, LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463');
    const observees = scan.homonymes.map((h) => cle({ cle: h.cle, classes: h.classes, occurrences: h.total }));
    expect(
      lignes(observees),
      'écart entre les homonymes OBSERVÉS et `STRUCTURES_HOMONYMES` — un nom de concept est RÉSERVÉ à son type (#1463 S2).',
    ).toEqual(lignes(STRUCTURES_HOMONYMES.map(cle)));
  });

  it('divergences d’enveloppe (racine ET documents embarqués) : observé == stock', () => {
    const cle = (e: {
      role: string;
      cle: string;
      motif: string;
      detail: string;
      document: string;
      chemin: string;
      entrees: number;
    } & Trace) =>
      `${e.role} | ${e.cle} | ${e.motif}${e.detail ? `:${e.detail}` : ''} | ${e.document} › ${e.chemin} | ${e.entrees}` +
      trace(e, lotEnveloppe(e));
    expect(
      lignes(scan.enveloppe.map(cle)),
      'écart entre les divergences d’ENVELOPPE observées et `STRUCTURES_ENVELOPPE` — absences sur les ENTRÉES DE RACINE (`L1d #1469`), clés divergentes partout (`L1b #1467`), y compris sur les documents EMBARQUÉS.',
    ).toEqual(lignes(STRUCTURES_ENVELOPPE.map(cle)));
  });

  it('redéclarations locales dans les defs : observé == stock (keyé par def | champ | concept | signature)', () => {
    const cle = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string }) =>
      `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun}`;
    const compte = new Map<string, { r: (typeof redeclarations)[number]; n: number }>();
    for (const r of redeclarations) {
      const vu = compte.get(cle(r)) ?? { r, n: 0 };
      compte.set(cle(r), { r, n: vu.n + 1 });
    }
    // PILOTAGE (`lot`, `date`) repris du stock par SITE — MÊME patron que `pilotageDeForme` et
    // `pilotageOrpheline` : la sonde ne mesure ni le lot ni la date. Sans cette reprise, toute ligne
    // était sommée de porter la date GLOBALE du stock, et une ligne née plus tard ne pouvait être
    // verte qu'en MENTANT sur sa date de naissance. Les deux champs restent gardés : une ligne du
    // stock que l'AST n'observe plus reste rouge, et le test de MUTATION par champ (ci-dessous)
    // prouve qu'ils entrent toujours dans la clé comparée.
    const pilotage = new Map(STRUCTURES_REDECLARATIONS.map((r) => [cle(r), { lot: r.lot, date: r.date }]));
    const observees = [...compte].map(
      ([k, { r, n }]) => `${k} | ${n}` + trace(pilotage.get(k) ?? {}, lotDeForme(r.concept, r.signature)),
    );
    const stockees = STRUCTURES_REDECLARATIONS.map((r) => `${cle(r)} | ${r.occurrences}` + trace(r, lotDeForme(r.concept, r.signature)));
    expect(
      lignes(observees),
      'écart entre les redéclarations OBSERVÉES (AST des `src/data/schemas/defs/*.ts`) et `STRUCTURES_REDECLARATIONS` — une forme partagée se déclare UNE fois dans la grammaire (`src/data/schemas/grammaire/`). Le CHAMP entre dans la clé : sans lui, des littéraux de champs différents s’agrègent en une ligne.',
    ).toEqual(lignes(stockees));
  });

  /**
   * Le concept `reference` est SOLDÉ au stock des redéclarations (#1463 L-gram-2) : plus AUCUN def
   * ne re-tape `{id, spec?}`/`{id, value?}` — les six sites qui le faisaient composent les fabriques
   * de `grammaire/ref.ts` ou importent `qualityRefSchema`. Affirmation POSITIVE et bidirectionnelle :
   * elle rougit à la première réintroduction d'un littéral de référence dans un def, avant même que
   * la ligne de stock ne renaisse.
   */
  it('le concept `reference` ne pèse plus AUCUNE ligne, ni à l’OBSERVÉ ni au stock (#1463 L-gram-2)', () => {
    // L'OBSERVÉ d'abord (AST des defs) : c'est lui qui rougit à la réintroduction d'un littéral,
    // sans attendre qu'une ligne de stock renaisse.
    expect(
      redeclarations.filter((r) => r.concept === 'reference').map((r) => `${r.def} | ${r.champ} | ${r.signature}`),
      'un def re-déclare une RÉFÉRENCE : la désignation d’une entité par son id a UNE fabrique (`ref`/`specRef`/`refOuSpec`, `grammaire/ref.ts`), et la vue commune des Atouts est `qualityRefSchema`.',
    ).toEqual([]);
    expect(
      STRUCTURES_REDECLARATIONS.filter((r) => r.concept === 'reference').map((r) => `${r.def} | ${r.champ} | ${r.signature}`),
      'une ligne `reference` PÉRIMÉE traîne au stock : le concept est soldé côté defs.',
    ).toEqual([]);
    // Sans concept encore peuplé, les deux assertions seraient vacueuses : la mesure porte toujours.
    expect(redeclarations.length, 'l’AST n’observe plus AUCUNE redéclaration : le volet ne mesure rien.').toBeGreaterThan(0);
  });

  /**
   * CONTRAT du côté DÉCLARÉ : un document SCELLÉ par la fabrique `document()` — `pipe` à la racine —
   * rend ses clés. La SORTIE d'un tel pipe est un `transform`, qui n'en porte AUCUNE : un relevé qui
   * la prend pour entrée rend 0 clé sur TOUTE la famille config/record, et les deux volets qui
   * comparent déclaré × observé (clés jamais observées, forme déclarée jamais posée) se taisent au
   * lieu de mordre. La lecture se fait donc sur le nœud PORTEUR du pipe.
   */
  it('un document SCELLÉ par `document()` déclare ses clés — jamais zéro', () => {
    const scelles = DECLARES.filter((d) => d.racine.startsWith('pipe<'));
    expect(scelles.length, 'aucun document scellé au registre : le contrat ci-dessous ne mesurerait rien.').toBeGreaterThan(40);
    // Les SEULS documents scellés sans clé à rendre sont les deux records de valeur SCALAIRE :
    // `decorPalette.ts:18,31` et `teintesJeu.ts:140` déclarent `{}` champs et une `valeurRecord`
    // chaîne (palettes hex). La liste est NOMINATIVE, pas un filtre : un muet de plus sort par son
    // nom — c'est ainsi que se voit un relevé qui lirait la SORTIE du pipe (un `transform` sans clé)
    // au lieu de son nœud PORTEUR.
    expect(
      scelles.filter((d) => Object.keys(d.cles).length === 0).map((d) => `${d.file} (${d.note})`).sort(),
      'document(s) scellé(s) rendant ZÉRO clé déclarée — `introspecterDefs` (`scripts/docs/lib/zod-introspect.mts`) doit lire le nœud PORTEUR du pipe.',
    ).toEqual(['decorPalette.json (non-objet(string))', 'teintesJeu.json (non-objet(string))']);
    // Nominatif : un `config` (`crew-morale.ts:18-48`) et un `record` enveloppé rendent LEURS clés,
    // pas seulement celles que la fabrique pose d'office.
    expect(Object.keys(DECLARES.find((d) => d.file === 'crew-morale.json')!.cles).sort()).toEqual(
      expect.arrayContaining(['base', 'bands', 'factors']),
    );
    expect(Object.keys(DECLARES.find((d) => d.file === 'sizes.json')!.cles).length).toBeGreaterThan(0);
  });

  it('formes DÉCLARÉES jamais observées, sans lot de peuplement : observé == stock', () => {
    const cle = (x: { dataset: string; cle: string; date?: string }) => `${x.dataset} | ${x.cle} | ${x.date ?? DATE_STOCK}`;
    const observees: string[] = [];
    const parFichier = new Map(DECLARES.map((d) => [d.file, d]));
    for (const d of scan.documents) {
      const dec = parFichier.get(d.nom);
      if (!dec) continue;
      const vues = new Set(d.clesNiveau1.map((k) => k.cle));
      // Les clés posées INCONDITIONNELLEMENT par la fabrique (`document.ts`) sortent de la question
      // posée ici (un SCHÉMA plus large que sa donnée) : un `labelF` ou un `icon` qu'un dataset
      // n'emploie pas ne se « solde » pas — il n'y a rien à retirer d'un def qui ne l'a pas écrit.
      // Sans ce filtre, la restauration de couverture du sceau `pipe` (`zod-introspect.mts`, même
      // lot) en aurait versé 298 au stock, tous inertes.
      for (const c of Object.keys(dec.cles).filter((k) => !vues.has(k) && !CLES_POSEES_INCONDITIONNELLEMENT.includes(k)))
        observees.push(cle({ dataset: d.nom, cle: c, date: STRUCTURES_DEFAUT.find((s) => s.dataset === d.nom && s.cle === c)?.date }));
    }
    expect(
      lignes(observees),
      'écart entre les clés DÉCLARÉES JAMAIS OBSERVÉES et `STRUCTURES_DEFAUT` — un schéma plus large que la donnée se solde en retirant le champ ou en écrivant la donnée. Un déclaré-avant-posé ASSUMÉ ne se stocke PAS ici : il porte un lot de peuplement et s’ÉMET (`LOTS_DE_PEUPLEMENT`, doc §2.4 table B).',
    ).toEqual(lignes(STRUCTURES_DEFAUT.map(cle)));
  });

  /**
   * Ce que l'exclusion COÛTE, MESURÉ (#1467 L1b V-FLIP-ENTITE-b) — pas déclaré en prose. Une clé
   * ajoutée à `CLES_POSEES_INCONDITIONNELLEMENT` fait TAIRE toutes les dettes qu'elle porte : le
   * filtre se relit donc ici clé par clé, sur la mesure.
   *
   * `variants` est le cas qui a MORDU : rangée d'abord parmi les clés d'office, elle escamotait
   * `traits.json › variants` — une dette réelle, l'option étant DEMANDÉE par le def et portée par
   * 0 des 131 entrées. Le test ci-dessous gèle les deux comptes : sans `variants` dans l'exclusion
   * (l'état courant) le relevé en a UNE de plus, et cette une-là est nommée.
   */
  it('l’exclusion des clés d’office ne cache AUCUNE dette d’option — son coût est mesuré, clé par clé', () => {
    const releve = (exclues: readonly string[]) => {
      const out: string[] = [];
      const parFichier = new Map(DECLARES.map((d) => [d.file, d]));
      for (const d of scan.documents) {
        const dec = parFichier.get(d.nom);
        if (!dec) continue;
        const vues = new Set(d.clesNiveau1.map((k) => k.cle));
        for (const c of Object.keys(dec.cles).filter((k) => !vues.has(k) && !exclues.includes(k))) out.push(`${d.nom} | ${c}`);
      }
      return out.sort();
    };
    const courant = releve(CLES_POSEES_INCONDITIONNELLEMENT);
    const avecVariants = releve(CLES_ENVELOPPE as readonly string[]);
    expect(
      courant.filter((l) => !avecVariants.includes(l)),
      'exclure `variants` ne doit escamoter QUE la dette d’option de `traits.json` — une seconde ligne signalerait une clé d’office mal rangée.',
    ).toEqual(['traits.json | variants']);
    expect(CLES_POSEES_INCONDITIONNELLEMENT).not.toContain('variants');
    expect(courant.length - avecVariants.length, 'le delta d’exclusion vaut EXACTEMENT une ligne').toBe(1);
  });

  it('`cible-declaree` ne se STOCKE nulle part : c’est une ÉMISSION du doc, pas un dénominateur', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/structuresStock.mjs'), 'utf8');
    expect(
      /statut:\s*["']cible-declaree["']/.test(stock),
      'une ligne `cible-declaree` est entrée au stock : elle CROÎTRAIT (une forme se déclare avant d’être posée), et rendrait menteurs `GARDE.baseline.decroissant` et le cliquet des huit stocks.',
    ).toBe(false);
    expect(Object.keys(LOTS_DE_PEUPLEMENT).length, 'aucun lot de peuplement déclaré : la table B du doc serait vide de sens.').toBeGreaterThan(0);
  });

  it('les huit stocks ne font que DÉCROÎTRE (aucune ligne neuve hors migration)', () => {
    const mesure = [
      // #1443 (mobilier volumique) : trois lignes s'ajoutent au dénominateur, chacune INSTANCE d'une
      // famille déjà stockée et rangée dans son lot — `ref` id-nu d'un pion de scène (L3, comme les
      // 306 des trois autres scènes), `primitives {material+…}` (L3, comme `walls`/`masses`),
      // `source` absente de `materials.json` (L1d, comme `lightTones.json`).
      // #1466 T3-b (dons de `giveTrapping`) : deux lignes s'ajoutent au dénominateur, chacune
      // INSTANCE de la famille déjà stockée `arene-projet.json › effect {<réf>,type}` (`encounter,type`,
      // `entityId,type`, `scene,type`, `spell,type`…) et rangée dans le MÊME lot L3. Elles n'existaient
      // pas AVANT la migration parce que le champ portait un LIBELLÉ, qui n'ouvre aucune référence :
      // c'est la donnée qui ENTRE dans la strate mesurée, pas une dérive de forme.
      // #1466 T3-b (migration qualités LIBELLÉ→id) : une ligne s'ajoute au dénominateur — le tableau
      // résolu DEVIENT une forme refs/ids-nus mesurée (ligne nominative `arene-projet.json › qualities`),
      // rangée dans le MÊME lot L3 : la donnée ENTRE dans la strate, ce n'est pas une dérive de forme.
      // #1466 L1a volet A : le DÉCLARÉ couvre les 2 racines — la fermeture des discriminants de
      // scène retire 8 lignes de formes (`ambiance`/`weather`/`threat` des 4 projets : leurs valeurs
      // sont des littéraux d'enum du schéma, elles n'ouvrent plus de référence). Le cliquet SUIT la
      // baisse : 679 → 671, sinon la marge regagnée servirait à absorber une dérive future.
      // Cliquet REMONTÉ 15 → 16 (L2 #1548, commit 0) : `refs / ids-nus` reçoit le statut `cible`. DESIGN
      // v2 S2 (#1463, commentaire du 2026-08-23) : « `refs(type)` = liste d'ids nus brandée (75 champs
      // `string[]`) » — la liste d'ids nus EST la forme visée, ce qui reste à faire est le TYPAGE du
      // champ. Une cible neuve se décide en revue : celle-ci porte sa citation et sa date.
      // Cliquet REMONTÉ 16 → 19 (L2 #1548, commit 4bis) : trois graphies reçoivent le statut `cible`
      // AU SITE du statbloc (`id,value`, `id,spec,value`, `choix,id,value`). Une cible neuve se
      // décide en revue : celles-ci portent leur citation (#1463, « `value` = le seul nom du NOMBRE
      // IMPRIMÉ au statbloc ») et leur date au stock, et leur réserve ouverte y est dite.
      // Cliquet REMONTÉ 19 → 21 (L4 #1463, vague `plage`, 2026-08-31) : deux graphies reçoivent le
      // statut `cible`, et aucune donnée ne bouge pour ça. (1) `plage | max,min+…` : la cible d'une
      // rangée de table est TRANCHÉE — fourchette PLATE `{min, max}` + `findTableEntry`
      // (`src/engine/tables.ts`, primitive de la table `docs/primitives.md`), et la charge utile d'une rangée
      // (102 charges distinctes mesurées) est INHÉRENTE : c'est ce que le suffixe `+…` de la
      // projection nomme, pas une divergence. Mesuré 2026-08-31 : 1441 objets à deux bornes, TOUS
      // `min,max` — zéro `from/to`, zéro `de/a`, zéro `low/high` — et ZÉRO `{range:{min,max}}`, la
      // cible emboîtée que le lexique déclarait n'existait NULLE PART (#1463 S1 amendé 2026-08-31,
      // motif au pilotage). (2) `bornes | max,min+…` : concept NEUF du lexique, les 23 objets de
      // `reglesOptionnelles.json` étaient comptés `plage divergente` par MISCLASSEMENT — ce sont les
      // bornes du DOMAINE d'un réglage (co-présence `default`/`step`), aucun d100 ne les traverse.
      // (3) `monnaie` × 6 sous-signatures (#1463 L-monnaie-3) : `moneyPartialSchema` déclare les 3
      // dénominations OPTIONNELLES et `toMoney` complète à 0 — un coût authoré qui n'écrit que ce
      // qu'il chiffre est à la forme cible. Les variantes `+…` restent HORS cibles : un étalement se
      // migre, il ne se blanchit pas.
      // Cliquet REMONTÉ 27 → 34 (#1633, 2026-09-01) : la strate `Document` reçoit ses quatre concepts
      // d'ENVELOPPE, et chacun déclare la ou les PROJECTIONS de son noyau requis — `ouverture`
      // (`pitch,titre` ± optionnels), `cloture` (`titre,when` ±), `narratif`
      // (`affaires,indices,objets,presetsPnj` ±) et `condition` (`expr,kind`). Chaque ligne porte SA
      // PORTE zod au stock ; aucune donnée n'est réécrite, 12 lignes hors strate s'éteignent.
      // (5) `formule | sum` et `formule | sinPoints` (#1463 L-de-1) : concept NEUF du lexique — la
      // COMPOSITION d'une `Formula` (`formulaSchema`, `grammaire/valeurs.ts`) et le terme de Péché qui
      // s'y ajoute (`sinPointsSchema`, LDB 40). Deux cibles de plus, mesurées : elles ne blanchissent
      // AUCUN étalement (`sea-cargo › offerPrice {sum+…}` reste divergent au stock), et le noyau du
      // concept est borné aux deux clés qui ne nomment QU'une formule — `dice`/`times` en sont exclus,
      // ils nomment aussi un `DiseaseTime` et le COMPTE d'une réf de Talent (motif mesuré au lexique).
      // Cliquet REMONTÉ 36 → 39 (#1389, épique #1388) : deux concepts NEUFS du lexique, trois
      // signatures cibles — l'ADRESSE d'un passage du Source (`book,ch,parts`) et ses deux FRAGMENTS
      // (suite de blocs, cellule de table). Elles ne blanchissent AUCUN étalement : ces objets
      // n'existaient nulle part avant la migration du pilote (`psychology.json`), et `descRefSchema`
      // (`grammaire/valeurs.ts`) refuse toute autre graphie — il n'y a pas d'ancienne forme à
      // éteindre. Sans elles, `book` les rangeait sous `source` et `sum` sous `formule`.
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES.length, 39],
      // Cliquet DESCENDU 671 → 670 (#1467 L1b V-P7) : le statbloc à `size` d'`arene-projet.json` quitte
      // ce stock — le profil embarqué s'ANNONCE (`type: 'statblock'`) et sa forme est déclarée champ par
      // champ (`defs-scenes/communs.ts`), donc sa signature n'est plus lue comme une référence non
      // résolue. Il réapparaît à `STRUCTURES_ORPHELINES` ci-dessous : même objet, autre stock.
      // Cliquet DESCENDU 670 → 594 (L2 #1548, commit 0) : les 76 lignes `refs / ids-nus` quittent le
      // dénominateur avec la cible ci-dessus — aucune donnée ne bouge, c'est le LEXIQUE qui reconnaît
      // la forme déjà posée. Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 594 → 587 (L2 #1548, commit 3b) : la graphie `skillId` MEURT de la donnée —
      // 8 lignes de référence de Compétence s'éteignent (activities ×2, axes ×2, crew-roles ×2,
      // talents, creatures.grant : 92 occurrences migrées vers la forme canonique `{id, spec?}`),
      // 1 ligne neuve apparaît (`creatures.json › spec` mesuré en id nu). Les conteneurs de TEST
      // gardent leur ligne (lot L4) : seule la référence DEDANS s'est emboîtée. Le cliquet SUIT.
      // Cliquet DESCENDU 587 → 557 (L2 #1548, commit 3c) : les FRÈRES PLATS `skill`+`spec` MEURENT de la
      // donnée — 334 références de Compétence s'emboîtent en `skill: { id, spec? }` sur 21 documents, si
      // bien que 31 lignes de graphie plate s'éteignent (ops `skillMod`/`skillDRBonus`/`castPenalty`/
      // `corruptionExposure`, conteneurs de Test, `talents.matches`/`reverseFailed`, `tavernGames`) et
      // qu'1 ligne neuve apparaît (`domains.json › test` : la même entrée, sa signature perdant le `spec`
      // frère — `difficulty,skill+…` → `difficulty,skill`). Le cliquet SUIT.
      // Cliquet REMONTÉ 557 → 558 (L2 #1548, commit 3d) : AUCUNE dérive neuve — la valeur de Test du
      // PNJ soigneur (`medicalAid`) ÉTAIT un NOMBRE nu, INVISIBLE à ce scan qui ne mesure que des
      // références ; devenue la référence de statbloc `{id, value}` de la racine scènes, elle entre au
      // dénominateur à la MÊME graphie historique que ses 4 562 sœurs (`creatures.json › skills`). Le
      // dénominateur GLOBAL, lui, DÉCROÎT : 557+106 = 663 → 558+104 = 662.
      // Cliquet DESCENDU 558 → 557 (L2 #1548, geste modèle) : les DEUX pseudo-PNJ de l'effet
      // `medicalAid` meurent de la donnée — la valeur de Guérison recopiée (`skill {id,value}`, 2
      // occurrences) s'éteint AVEC sa signature d'effet (`effect entityId,skill,type+…` → `entityId,type+…`),
      // et les 2 soigneurs de l'arène RÉFÉRENCENT désormais leur fiche de bestiaire (`ref id-nu` :
      // 291 → 293, la graphie déjà canonique du pion de scène). Une ligne de moins au stock.
      // Cliquet DESCENDU 557 → 538 (L2 #1548, commit 4) : les QUATRE graphies enveloppantes du champ
      // d'AVANCEMENT meurent de la donnée (careerLevels + species, 4 462 nœuds) — 20 lignes
      // s'éteignent (les 6 enveloppes `ref>…`/`wildcard>…` du lot L2, et les 14 lignes de graphie
      // côté champ porteur `skills`/`talents`), 1 ligne neuve apparaît (`species.json › of {random}` :
      // les 2 tirages qui vivaient en branche de `choice` vivent en branche de `pick`). Le cliquet SUIT.
      // Cliquet REMONTÉ 538 → 540 (#862) : deux lignes s'ajoutent au dénominateur, chacune INSTANCE
      // d'une famille déjà stockée et rangée dans son lot — `mutations.json › ops` reçoit les deux
      // graphies de référence de Trait que `mutations.json › passive` porte déjà (`traitId+…`,
      // `argFrom,traitId+…`, L3). C'est la donnée qui ENTRE dans la strate mesurée (le dataset n'avait
      // aucune op authorée avant le re-ciblage quotidien de Haine sporadique), pas une dérive de forme.
      // Cliquet DESCENDU 540 → 534 (L2 #1548, commit 4bis) : les 6 lignes de référence de Compétence
      // sous `skills` d'un STATBLOC (bestiaire ×2, `barge-du-sel` ×2, `loup-et-saumure` ×2 — 5 996
      // occurrences) sortent du dénominateur : ce sont des CIBLES au site (cf. `STRUCTURES_CIBLES`).
      // RECLASSEMENT, pas migration — aucune de ces 5 996 occurrences n'est réécrite ; ce que le
      // commit MIGRE, ce sont les 59 sentinelles textuelles qui vivaient DANS ces lignes.
      // Cliquet REMONTÉ 534 → 538 (#674, 2026-08-31) : la Pneumonie et le Rhume commun (EDOC 08
      // l.94-122) ENTRENT dans la strate mesurée avec deux champs que `maladies.json` ne portait pas
      // — `mutation {into+…}`, `dailyTest {difficulty+…}` — et deux conteneurs d'ops (`onFail`,
      // `otherwise`, tous deux `disease,symptomId+…`). Chacune est l'INSTANCE d'une famille déjà
      // stockée et rangée dans son lot (L3 pour les 3 références, L4 pour le Test) : donnée neuve, pas
      // forme neuve.
      // Cliquet REMONTÉ 538 → 541 (#684 L4, 2026-08-31) : le premier tronçon de carte du chapitre 1
      // fait ENTRER `diligence-projet.json` dans la strate des références de CARTE — `a`, `b`, `scene`
      // en `id-nu`, les trois lignes que les trois autres projets portent déjà pour leur worldMap,
      // rangées dans le MÊME lot L3. Donnée neuve à la forme déjà stockée, pas forme neuve : leur
      // extinction est celle de la fabrique de référence du schéma de carte (L2/L3 #1473), pour les
      // quatre projets à la fois.
      // Cliquet DESCENDU 541 → 480 (L4 #1463, vague `plage`, 2026-08-31) : les 61 lignes `plage`
      // (1421 occurrences) sortent du dénominateur — la fourchette PLATE `{min, max}` est la CIBLE
      // (cf. `STRUCTURES_CIBLES` ci-dessus), et ces objets y étaient déjà. AUCUNE de ces 1421
      // occurrences n'est réécrite : le suffixe `+…` que la projection leur donnait n'était pas une
      // divergence de graphie, c'était la charge utile INHÉRENTE d'une rangée de table. Le cliquet
      // SUIT la baisse, sinon la marge regagnée servirait à absorber une dérive future.
      // Cliquet REMONTÉ 480 → 481 (équipage de la Louve grise, 3fe450675, 2026-09-01) : les entités d'équipage de la barge portent
      // `appearance {species, tenue}`, la ligne SŒUR de celles que `loup-et-saumure`, `arene` et
      // `creatures.json` portent déjà (même concept, même lot L3). Donnée neuve à la forme déjà
      // stockée, pas forme neuve : son extinction est celle d'`entityAppearanceSchema`
      // (`src/data/schemas/grammaire/valeurs.ts`), où `species`/`tenue` sont des `z.string()` nus —
      // aucun `idDe(...)`, donc aucun slot, pour AUCUN des quatre porteurs.
      // Cliquet REMONTÉ 481 → 483 (équipage du Grimm et statblocs d'auteur de l'arène, 2026-09-01) : le MÊnE trou
      // étendu aux deux paquets restants — `loup-et-saumure` gagne la ligne `species,tenue` (équipage adverse
      // anonyme des deux abordages), `arene` la ligne `species` (les statblocs d'auteur Nuée de rats / Dragon
      // des ténèbres, sans tenue : une bête ne s'habille pas). Deux lignes SŒURS de plus, même lot, même
      // extinction qu'au cliquet précédent — donnée neuve à la forme déjà stockée, pas forme neuve.
      // Cliquet DESCENDU 483 → 481 (#1463 L-ref-2, 2026-09-01) : les DEUX lignes
      // `spells.json › range|target {text+… (résolvable)}` sont SOLDÉES — les 38 occurrences stockées (54 sites migrés — les 16 Mage/Shaman n'entraient pas au stock) qui
      // désignaient le lanceur en toutes lettres portent `{kind:'self'}`. Le cliquet SUIT la baisse :
      // deux crans libres absorberaient en silence la réapparition de la forme.
      // Cliquet DESCENDU 481 → 479 (#1463 L-ref-0 + L-ref-1, 2026-09-01) : les DEUX lignes
      // `careerLevels.json › trappings {text|count,text (résolvable)}` (64 occurrences) MEURENT. Elles
      // ne mesuraient rien : la résolvabilité d'un `{text}` se calculait sur la seule clé `text` du
      // site — vide de cible par construction, donc « n'importe quel dataset » (« Assistant »
      // → `careerLevels`, « Bureau » → `props`, « Munitions » → `weaponGroups`). La mesure est
      // scopée aux cibles majoritaires du SITE (`structures-scan.mts` › `ciblesMajoritairesDuSite`),
      // et les 49 dotations qui NOMMAIENT vraiment une possession sont liées (`{id, spec}`, `{id}`,
      // `choice`). Une ligne ENTRE en route — `careerLevels.json › choice {choice>id,spec}`, les deux
      // branches d'`alchimiste-4` —, sœur des `choice>id` déjà stockées : le MÊME objet qui change de
      // classement, pas une structure neuve. Solde : −2.
      // Cliquet DESCENDU 480 → 479 (#1463 L-ref-1bis, 2026-09-01) : `creatures.json › trappings
      // {text (résolvable)}` est SOLDÉE — son unique porteur (`long-drong-silver` › « cache-œil »,
      // MDG `16 - Bestiaire.md` l.407) est lié à `{id:'cache-oeil'}`, la forme CIBLE que la même liste
      // portait déjà (`{id:'crochet'}`). Plus AUCUNE ligne `text (résolvable)` au stock. Le cliquet
      // SUIT la baisse : un cran libre absorberait en silence la réapparition de la forme.
      // Cliquet DESCENDU 479 → 468 (#1463 L-de-1, 2026-09-01), en DEUX temps. (a) Le lot : la ligne
      // `miscast.json › dice {n,sides+…}` est SOLDÉE — les 6 dés qui portaient un `sinPlus` en 4ᵉ clé
      // écrivent la somme générale `{sum:[{dice},{sinPoints:true}]}` — et une ligne ENTRE, le constat
      // `sea-cargo.json › offerPrice {sum+…}` que le concept `formule` rend enfin mesurable : −1 +1 = 0.
      // (b) Le MOU : le plafond portait 11 crans libres sur une liste de 468 — il est posé AU RÉEL
      // (même doctrine que le cliquet par lot, l.915 : « le terrain gagné se VERROUILLE : abaisser le
      // plafond au réel mesuré » ; #1654 « plafond ≤ réel puis décroissant »). Le concept `de` ne pèse
      // plus AUCUNE ligne ici.
      // Cliquet DESCENDU 468 → 467 (#1463 L-gram-2, 2026-09-01) : `species.json › preview {career}`
      // est SOLDÉE — les 27 aperçus de vitrine nomment leur carrière par la RÉFÉRENCE `previewCareer
      // {id}`, résolue au parse contre `careers.json` (`ref('career')`). Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 467 → 462 (#1657 geste A) : le concept `test` cède les objets qui DÉSIGNENT
      // (identité ou clé de référence) et passe APRÈS `plage` — 7 lignes s'éteignent (81 occurrences :
      // `activities › (racine)` 51 et `› skills` 2, `sea-weather › temperatures` 4, `maladies › symptoms` 8
      // et `› dailyTest` 1, `sea-navigation › table` 5 et `› voirLaLumiere` 3 ; `tavernGames › rows` 14 → 7),
      // les 3 lignes du concept `sequence` s'éteignent avec lui (son noyau de 10 clés hétérogènes ne
      // nommait aucune forme partagée : 3 entrées de racine de `tavernGames.json`, 3 jeux), et 5 lignes
      // entrent — la RÉFÉRENCE que ces objets portaient déjà et que `test` masquait (`activities › skills`
      // ×2, `› rule` id-nu, `maladies › symptoms {difficulty,symptomId}`, `› dailyTest`). Aucune donnée ne
      // bouge : −10 +5.
      // Cliquet DESCENDU 462 → 461 (#1463 L-gram-3, 2026-09-01) : `sea-cargo.json › offerPrice {sum+…}`
      // est SOLDÉE — la colonne d'entrée du tableau du Prix d'offre ÉTAIT un seuil (une borne basse
      // seule, relue à l'envers) ; c'est une FOURCHETTE `{min, max}` que `findTableEntry` lit, la
      // dernière bande gardant sa borne haute OUVERTE (« 4 ou plus », MDG 15 l.383). Le cliquet SUIT.
      // Cliquet REMONTÉ 461 → 462 (#1691, 2026-09-07) : la matière de RELIEF quitte le code pour la
      // donnée — CINQ lignes NEUVES au dénominateur (`terrains.json › matiere`, id nu comme son voisin
      // `overlayProp` ; `reliefDefaults` sur les 4 projets de scène). Le stock mesuré passe de 457 à
      // 462, au-delà des 4 places que les lots précédents avaient laissées sous le plafond. Ce ne sont
      // pas des graphies neuves : ce sont les références que `gameIso/builders/floors.ts` portait EN DUR
      // et qui deviennent mesurables, à la forme CIBLE (`idDe('material', 'relief')` les refine au parse).
      // Cliquet REMONTÉ 464 → 468 (#1715 volet b, 2026-09-09) : la TOITURE PAR DÉFAUT d'une scène passe
      // en donnée (`Scene.roofDefaults`, EXIGÉE). Les QUATRE projets livrés portent le record sur chaque
      // scène, et le scan y voit UN nœud de référence à graphie divergente par projet — même forme et
      // même solde que `reliefDefaults` (#1691) : la ligne meurt avec le dériveur d'un niveau.
      // Cliquet REMONTÉ 462 → 464 (#1715, 2026-09-09) : le catalogue des BÂTIMENTS quitte le code pour
      // la donnée — TROIS lignes NEUVES (`buildings.json › roofMaterial` id nu, `› features` référence
      // enveloppée à charge, `diligence-projet.json › style` id nu, le TYPE de bâtiment d'un corps
      // devenu une référence résolue au parse), UNE morte (`arene-projet.json › style` : ses deux corps
      // COMPOSITES n'ont pas de type de bâtiment, le champ y est absent). Aucune graphie neuve : ce
      // sont celles que le registre TypeScript des bâtiments portait EN DUR avant #1715, devenues mesurables.
      ['STRUCTURES_FORMES', STRUCTURES_FORMES.length, 468],
      // 8ᵉ stock, né du volet A : les clés déclarées jamais observées des DEUX racines (dont 5
      // apportées par les 4 projets de scène qui entrent au déclaré).
      // Cliquet DESCENDU 24 → 23 (#1467 L1b V-FLIP-ENTITE-c) : `creatures.json › group` est SOLDÉ —
      // 0 porteur en donnée ET 0 consommateur mesuré, le champ MEURT du def. Le cliquet SUIT la
      // baisse (même doctrine qu'à `STRUCTURES_FORMES` ci-dessus).
      // Cliquet REMONTÉ 23 → 27 (#1467 L1b V-formeProjet) : c'est la COUVERTURE du relevé qui a
      // changé, pas la donnée ni les defs — même mécanique que `STRUCTURES_REDECLARATIONS` ci-dessous.
      // Ce scan mesure les clés de RACINE d'un document ; `auteur` (identité de campagne #766,
      // optionnelle, portée par 0 des 4 projets committés) vivait sous la poche `meta`, où il lui
      // échappait. L'aplatissement de l'enveloppe le SURFACE sur les 4 documents. La donnée est
      // INCHANGÉE : aucun projet n'en portait avant, aucun n'en porte après.
      // Cliquet DESCENDU 27 → 26 (#684 L4, 2026-08-31) : `diligence-projet.json › worldMap` cesse
      // d'être un déclaré-jamais-observé — le document PORTE sa carte. Le cliquet suit la baisse.
      // Cliquet REMONTÉ 26 → 27 : c'est la COUVERTURE du relevé qui revient, pas la donnée qui
      // régresse. `introspecterDefs` prenait pour entrée d'un `pipe` à la racine sa SORTIE — un
      // `transform` sans clés : les 45 documents scellés par `document()` rendaient ZÉRO clé
      // déclarée. Le relevé lit désormais le PORTEUR du pipe, et les 8 clés des 4 `*-projet.json`
      // (`activeAxes`, `auteur`) redeviennent mesurables. Mesure du doc §2.4 : 370 → 621 clés
      // déclarées-jamais-observées, dont 243 posées d'office par la fabrique, hors dénominateur ici
      // (`CLES_POSEES_INCONDITIONNELLEMENT`) — ces 8-là sont les seules à entrer au stock.
      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT.length, 27],
      // Cliquet DESCENDU 6 → 5 : le stock est à 5 depuis un lot antérieur et la marge n'avait pas été
      // reprise. Aucune raison de garder un cran libre : il servirait à absorber un homonyme neuf.
      // … et 5 → 4 (L2 #1548, commit 3d) : l'homonyme `skill` MEURT — la clé n'a plus qu'UNE classe
      // (object) dans les deux racines (coûts en PX renommés, valeur de Test emboîtée, `null` devenu
      // absence, liste renommée `skills`).
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES.length, 4],
      // Cliquet REMONTÉ 102 → 108 (#1467 L1b V-FLIP-ENTITE-b) : c'est la COUVERTURE du relevé qui a
      // changé, pas la donnée ni les defs. `litterauxZod` (structures-scan.mts) visite désormais
      // l'argument `champs` de `document()` — forme DOMINANTE (43 defs adoptés) qu'il ne voyait pas :
      // 8 déclarations SURFACÉES (7 `entries` de defs config/table + `interludeEvents` min/max, qui
      // était stockée AVANT l'adoption et revit à l'identique). Sans l'extension, l'adoption faisait
      // DISPARAÎTRE des lignes et ce cliquet lisait la perte comme un solde.
      // Cliquet DESCENDU 108 → 105 (L2 #1548, commit 3b) : `activities.ts`, `axes.ts` et
      // `crew-roles.ts` ne redéclarent plus leur propre objet de référence de Compétence — ils
      // composent la grammaire (`refOuSpec('skill')`, `grammaire/ref.ts`). Le cliquet SUIT.
      // Cliquet DESCENDU 105 → 104 (L2 #1548, commit 4bis) : `creatures.ts` ne redéclare plus son
      // objet de référence de Compétence — il compose `refOuSpec('skill', {value})`, comme le fait
      // désormais `defs-scenes/communs.ts`. Le cliquet SUIT.
      // Cliquet REMONTÉ 104 → 105 (#674, 2026-08-31) : `maladies.ts` déclare le Test quotidien de la
      // Pneumonie (`dailyTest {difficulty+…}`, EDOC 08 l.104) avec son propre objet, comme le font
      // encore les autres porteurs de Test du même lot L4. La ligne s'éteindra avec eux.
      // Cliquet REMONTÉ 105 → 107 (L4 #1463, vague `plage`, 2026-08-31) — deux lignes ENTRENT, et
      // c'est l'empreinte de la migration P2 sur les defs, pas une dérive de forme : `weather.json`
      // et `advancementCosts.json` encodaient leurs tables par la BORNE HAUTE SEULE (19 + 15 rangées,
      // borne basse reconstruite par POSITION, donc ni authorée ni éditable). Leurs deux bornes étant
      // désormais en donnée (EDOC 08 l.52-59 ; LDB 07 l.56-70), leurs deux schémas déclarent le
      // littéral `{min, max, …}` — ils rejoignent la famille des 30 defs qui le redéclarent déjà.
      // RESTE NOMMÉ : le schéma PARTAGÉ (P1, `grammaire/valeurs.ts`) éteint les 32 d'un coup ; ces
      // deux lignes-là sont à éteindre AVEC elles, pas séparément.
      // Cliquet DESCENDU 107 → 97 (L4 #1463, vague `plage`, LOT P1-a) : les deux bornes d'une rangée
      // de table se déclarent UNE fois — `plageSchema` (`grammaire/valeurs.ts`) — et les schémas de
      // RANGÉE la composent PAR SHAPE (`z.strictObject({ ...plageSchema.shape, … })`, graphie unique
      // de dérivation tenue par `grammaire-guard.test.ts`). Dix lignes SORTENT : sept par composition
      // (criticals × 2 jeux, localisation — une ligne à 2 occurrences —, structure-criticals,
      // water-exposure › diseases, mutationTables › ranges, obsessions › entries), trois par ADOPTION
      // NUE, les deux bornes y étant toute la charge utile (sea-navigation, tavernGames › libre et
      // › targetRange). `shipCritEntrySchema` (grammaire) porte river/ship-criticals, déjà hors stock.
      // Le scanner ne résout PAS un spread : la garde est le test POSITIF de composition
      // (`grammaire/formes-partagees.test.ts`), qui refuse une rangée sans borne AU SCHÉMA PARTAGÉ et
      // à chacun des 9 documents adoptants. Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 97 → 88 (LOT P1-b, même graphie) : les rangées de table de MAGIE et les tables
      // générales composent à leur tour `plageSchema` par la SHAPE — miscast › entries,
      // arcane-phenomena › tables[].rows, vents-tourbillonnants › entries, tables › rows,
      // interludeEvents (racine), drunkenness › entries, weather › seasons[].ranges, tavernGames › table
      // et › pot.rows. TROIS lignes RESTENT au stock, refusées AVEC leur mesure : `oups.ts` et
      // `reglesOptionnelles.ts` portent des bornes OPTIONNELLES (le premier hors table pour `misfire`, le
      // second relève du concept `bornes` d'un réglage), `advancementCosts.ts` a une borne haute
      // `nullable` (dernière bande ouverte). Le gate reste POSITIF (`grammaire/formes-partagees.test.ts`,
      // +10 sites à la porte réelle `validateDataset`), le scanner ne résolvant pas un spread.
      // Cliquet DESCENDU 88 → 76 (LOT P1-c, même graphie) : les rangées de table de MER, de ROUTE et de
      // BATAILLE composent à leur tour `plageSchema` par la SHAPE — artillery-misfire › entries,
      // crew-morale › bands, driving-mishap › entries, land-cargo › wineQuality et › rumours,
      // mass-battle › hazards, naval-progression › entries, river-navigation › windForces/windDirections
      // (même `bandRow`), sea-events › boardEvents/portEvents (même `seaEventDef`) et › fastVoyage.paliers,
      // sea-weather › table et › roseDesVents, steam-breakdown (racine). La famille `plage` est à son
      // ÉTAT TERMINAL : TROIS lignes restent, chacune refusée AVEC sa mesure — `oups.ts` (bornes
      // OPTIONNELLES, le `kind` misfire est hors table), `advancementCosts.ts` (borne haute `nullable`,
      // dernière bande ouverte) et `water-exposure.ts` (les deux bornes y sont celles d'un PRÉDICAT
      // `auto.{kind:'woundsLost', op:'between'}` sur des Blessures perdues — aucune rangée tirable,
      // aucun `findTableEntry` ; la table du document, `diseases`, compose depuis P1-a).
      // Cliquet DESCENDU 76 → 69 (#1463 L-de-1, 2026-09-01), en DEUX temps. (a) Le lot : les TROIS dés
      // re-tapés dans les defs sortent — `maladies.ts` et `miscast.ts › engineFormulaSchema.dice`
      // composent le `diceSpecSchema` de la grammaire, et le `jsonDiceSchema` du dialecte
      // (`{n,sides,plus,sinPlus}`) MEURT ; une ligne ENTRE, `sea-cargo.ts › offerPrice {sum+…}`, que le
      // concept `formule` rend mesurable : −3 +1 = −2. Le concept `de` disparaît de la table.
      // (b) Le MOU : 5 crans libres restants sur une liste de 69, posés AU RÉEL — même doctrine que le
      // cliquet par lot (l.915 : « le terrain gagné se VERROUILLE : abaisser le plafond au réel
      // mesuré ») et #1654 « plafond ≤ réel puis décroissant ». #1463 reste ouvert tant que ce stock
      // n'est pas à ZÉRO : l'inventaire nominatif par concept est au ticket.
      // Cliquet DESCENDU 69 → 66 (#1463 L-gram-1, 2026-09-01) : les TROIS dernières lignes de la
      // famille à deux bornes qui pouvaient sortir sortent — `water-exposure.ts` compose
      // `plageSchema` par la SHAPE, `advancementCosts.ts` compose `plageOuverteSchema` (la bande
      // FINALE sans plafond, LDB 07 l.49/l.70) et `reglesOptionnelles.ts` compose `bornesSchema`,
      // le concept `bornes` recevant enfin son nœud de grammaire (`grammaire/valeurs.ts`). Le scanner
      // ne résolvant pas un spread, le gate est POSITIF : `grammaire/formes-partagees.test.ts` mesure
      // les deux nœuds neufs à la porte réelle `validateDataset`. UNE ligne du concept `plage` reste,
      // refusée AVEC sa mesure — `oups.ts`, dont le refus MOTIVÉ est en tête du stock (#1544).
      // Cliquet DESCENDU 66 → 59 (#1463 L-gram-2, 2026-09-01) : le concept `reference` ne pèse plus
      // AUCUNE ligne ici — `domains.requiresSkill` adopte `refOuSpec('skill')`, `species.preview`
      // devient `previewCareer: ref('career')`, `structures.traits` `ref('trait')` (le `value` jamais
      // posé meurt), `trappings` (racine + `derivedWeapon.qualities`) importe `qualityRefSchema`, et
      // `vehicles.ship.traits` compose `ref('navalTrait', {value})` tandis que le schéma MORT
      // `hull.traits` (0 porteur, 0 lecteur) tombe. 489 références entrent en garde FK.
      // Cliquet DESCENDU 59 → 55 (#1657 geste A) : le MÊME discriminant retire 4 littéraux du concept
      // `test` — `maladies.ts` (le symptôme référencé et son `dailyTest`), `sea-weather.ts › temperatures`
      // (une entrée de table à `id`) et `tavernGames.ts › (racine)` (le concept `sequence` n'existe plus) ;
      // le 5ᵉ, `tavernGames.ts › rows`, change de concept et reste au dénominateur (`plage | max,min+…`,
      // cible — le littéral porte deux bornes numériques et `plage` le classe désormais avant `test`).
      // Cliquet DESCENDU 55 → 52 (#1463 L-gram-3, 2026-09-01) : le concept `prix` reçoit ses NŒUDS
      // (`prixSaisonnierSchema` / `prixTireSchema`, `grammaire/valeurs.ts`) et les deux defs de commerce
      // cessent de retaper l'union — `land-cargo.ts › price` et `sea-cargo.ts › price` sortent, la
      // colonne saisonnière passant par la fabrique `parSaison` (que `avail` compose aussi, sinon la
      // signature à quatre saisons du nœud neuf faisait ENTRER deux lignes — contrefactuel CF1/CF2 en
      // fin de fichier) ; `sea-cargo.ts › offerPrice` sort avec elle, en composant `plageOuverteSchema`.
      // Cliquet DESCENDU 52 → 51 (#1463 L-gram-4, 2026-09-01) : la dernière ligne du concept `source`
      // sort — la bande de schéma de progression cessait de nommer `folio` ce que la grammaire appelle
      // `page` (`sourceRefSchema`, `grammaire/valeurs.ts`), et le def compose désormais sa SHAPE. La
      // correction est au GÉNÉRATEUR (`scripts/data/gen-progression-schemas.py`), l'artefact étant
      // dérivé : `--check` le revalide à l'octet.
      // Cliquet DESCENDU 51 → 44 (#1654 geste A, 2026-09-01) : les 7 lignes `signature: entries` du
      // stock sortent — la charge d'un document est POSÉE par la fabrique (`options.rangee`,
      // `META_CHARGE`), plus aucun def ne la retape. Les 4 sites `die,entries` d'`artillery-misfire`,
      // `incidents-monture`, `problemes-vehicule` et `structure-criticals` meurent du même geste : ils
      // étaient INVISIBLES à ce cliquet (appariement par signature exacte), ils le seraient restés.
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS.length, 44],
      // Cliquets DESCENDUS 165 → 77 et 93 → 91 : même geste. Le dénominateur d'enveloppe a fondu au
      // fil des vagues d'adoption (l'enveloppe étant POSÉE, ses divergences s'éteignent) sans que le
      // plafond suive ; 88 crans libres auraient absorbé en silence la régression de tout un lot.
      // Cliquet DESCENDU 77 → 73 (#1467 L1b V-formeProjet) : les 4 lignes « identité | `id` | clé
      // absente » des projets sont SOLDéES — l'enveloppe aplatie pose `id`/`label` à la RACINE des 4
      // documents. Le cliquet SUIT la baisse.
      // Cliquet DESCENDU 73 → 58 (#1467 L1b V-P7) : les 14 lignes « `nom` | clé divergente » des 4
      // projets sont SOLDÉES (le libellé de scène et de carte prend sa graphie `label`, `schema` 5 → 6),
      // et la 15ᵉ part avec la ligne FORMES ci-dessus. Le cliquet SUIT la baisse.
      // … et 58 → 56 : `title` reçoit son RÔLE PROPRE au lexique (« sous-titre », forme cible), donc
      // `creatures.json` (490) et `gods.json` (40) ne sont plus comptés en graphie divergente du libellé.
      // … et 56 → 52 (L2 #1548) : les 4 lignes `progression-schemas.derived.json` sont SOLDÉES — la
      // marque de niveau nomme sa Caractéristique `characteristic`, graphie de RÉFÉRENCE.
      // … et 52 → 47 (#1552 lot 3) : le rôle `source` déclare son ALTERNATIVE `maison`, comme la
      // grammaire l'exige déjà (`document.ts:402-413` : `source` OU `maison`, jamais ni l'un ni
      // l'autre). Les 4 documents dont TOUTES les entrées portent `maison` sortent du
      // dénominateur — les 3 projets authorés (`arene`, `barge-du-sel`, `loup-et-saumure`) et
      // `axes.json` (9/9 entrées `maison`). AUCUNE donnée n'est touchée : c'est le lexique qui
      // cessait de mesurer une divergence là où le schéma, lui, est satisfait.
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE.length, 47],
      // Cliquet REMONTÉ 91 → 92 (#1467 L1b V-P7) : AUCUNE dérive neuve — c'est le statbloc à `size`
      // d'`arene-projet.json` qui ARRIVE de `STRUCTURES_FORMES` (sa signature gagne `type`, elle ne se
      // confond plus avec les deux autres). La somme des deux stocks est CONSTANTE : 671 + 91 = 670 + 92.
      // Cliquet REMONTÉ 92 → 106 (L2 #1548, commit 3c) : AUCUNE dérive neuve — ce sont 14 lignes qui
      // ARRIVENT de `STRUCTURES_FORMES` (−31 ci-dessus). Un conteneur dont la valeur de `skill` ÉTAIT un
      // id résolvable ouvrait une référence AU CONTENEUR ; la référence étant désormais l'objet EMBOÎTÉ,
      // elle se compte sur LUI (forme CIBLE `{id}`, hors dénominateur) et le conteneur, qui annonce
      // encore une clé réservée sans résoudre lui-même, tombe ici. MÊME objet, autre stock — le
      // dénominateur GLOBAL décroît de 16 lignes (587+92 = 679 → 557+106 = 663).
      // Cliquet DESCENDU 106 → 104 (L2 #1548, commit 3d) : les 2 conteneurs `talents.json ›
      // reverseFailed` sortent — leur clé n'est plus le nom de concept RÉSERVÉ `skill` mais `skills`,
      // la LISTE que le champ porte toujours. Le cliquet SUIT la baisse.
      // Cliquet REMONTÉ 104 → 105 (#717) : l'OUVERTURE cérémonielle du chapitre 1 est une enveloppe
      // EMBARQUÉE qui porte sa `source` (le pitch est un verbatim EDO, règle stricte 5) sans résoudre
      // elle-même — même famille que les blocs sourcés déjà stockés ici. Une ligne de PLUS à éteindre,
      // qui tombera avec le volet #1553 (les sources embarquées), pas une dérive de forme.
      // Cliquet DESCENDU 105 → 97 (#1633) : le plafond était PÉRIMÉ de 7 places (L-monnaie-4 avait fait
      // sortir 7 lignes sans le resserrer), et `diligence-projet.json › ouverture` sort à son tour —
      // le concept `ouverture` la CLASSE, et le classement précède la route orpheline. Un optionnel
      // peuplé (`source`) ne partage donc plus une même porte en deux buckets : la PROJECTION réunit.
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES.length, 97],
      // Cliquet DESCENDU 403 → 400 (L2 #1548, commit 3c) : 5 signatures d'op portant le `spec` FRÈRE
      // s'éteignent (`bonus,op,skill,spec` de spells/tables, `blocked,op,rounds,skill`/`mod,op,rounds,skill`
      // de spells dont le `skill: "all"` disparaît au profit de l'ABSENCE) et 2 se fondent dans des
      // signatures existantes. Le cliquet SUIT la baisse.
      // Cliquet REMONTÉ 400 → 402 (#862) : deux signatures d'op neuves, chacune INSTANCE d'une famille
      // déjà stockée — `removeTrait {op,traitId}` (l'INVERSE de `grantTrait {op,traitId}`) et
      // `grantTrait {durationHours,op,traitId}` (même patron que `condition {durationHours,id,op,value}`).
      // Cliquet REMONTÉ 402 → 404 (#674, 2026-08-31) : deux signatures d'op neuves, portées par le
      // cycle quotidien de la Pneumonie — `aggravateSymptom {disease,op,otherwise,severity,symptomId}`
      // et `grantSymptom {disease,op,symptomId}` (EDOC 08 l.104-108). Chacune est une op AUTHORÉE de
      // `maladies.json`, dataset qui n'en portait qu'une (`diseaseTestMod`).
      // Cliquet DESCENDU 404 → 403 (#1463 L-de-1, 2026-09-01) : la graphie `condition {id, op,
      // sinPlus1Value}` MEURT — le drapeau qui encodait « 1 + (Points de Péché) » sur l'op lui-même
      // (LDB 40 l.71/72/77) devient la `value` que l'op déclarait déjà, à la forme générale
      // `{sum:[1, {sinPoints:true}]}` : ses 3 occurrences rejoignent `condition {id, op, value}`
      // (37 → 40). Le cliquet SUIT la baisse.
      ['STRUCTURES_OPS', STRUCTURES_OPS.length, 403],
    ] as const;
    const gonfles = mesure.filter(([, n, plafond]) => n > plafond).map(([nom, n, plafond]) => `${nom} ${n} > ${plafond}`);
    expect(
      gonfles,
      'stock(s) qui ont GONFLÉ — une structure neuve se pose à la forme CIBLE du lexique, elle ne se stocke pas ; une cible neuve se décide en revue.',
    ).toEqual([]);
  });

  it('chaque ligne du stock porte sa DATE et son LOT d’extinction', () => {
    const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const sansDate = [
      ...STRUCTURES_CIBLES.filter((c) => !dateOk(c.date)).map((c) => `cible ${c.concept} ${c.signature}`),
      ...STRUCTURES_FORMES.filter((f) => !dateOk(f.date)).map(cleForme),
      ...STRUCTURES_DEFAUT.filter((d) => !dateOk(d.date)).map((d) => `défaut ${d.dataset} ${d.cle}`),
      ...STRUCTURES_HOMONYMES.filter((h) => !dateOk(h.date)).map((h) => h.cle),
      ...STRUCTURES_ENVELOPPE.filter((e) => !dateOk(e.date)).map((e) => `${e.role} | ${e.cle} | ${e.document}`),
      ...STRUCTURES_REDECLARATIONS.filter((r) => !dateOk(r.date)).map((r) => r.def),
      ...STRUCTURES_ORPHELINES.filter((o) => !dateOk(o.date)).map(cleOrpheline),
      ...STRUCTURES_OPS.filter((o) => !dateOk(o.date)).map(cleOp),
    ];
    expect(sansDate, 'ligne(s) de stock sans date au format AAAA-MM-JJ').toEqual([]);
    const sansLot = [
      ...STRUCTURES_FORMES.filter((f) => !f.lot?.trim()).map(cleForme),
      ...STRUCTURES_HOMONYMES.filter((h) => !h.lot?.trim()).map((h) => h.cle),
      ...STRUCTURES_ENVELOPPE.filter((e) => !e.lot?.trim()).map((e) => `${e.role} | ${e.cle} | ${e.document} › ${e.chemin}`),
      ...STRUCTURES_REDECLARATIONS.filter((r) => !r.lot?.trim()).map((r) => `${r.def} | ${r.signature}`),
      ...STRUCTURES_ORPHELINES.filter((o) => !o.lot?.trim()).map(cleOrpheline),
      ...STRUCTURES_OPS.filter((o) => !o.lot?.trim()).map(cleOp),
    ];
    expect(
      sansLot,
      'ligne(s) de stock sans LOT d’extinction — un dénominateur sans propriétaire ne se solde jamais (#1465 F3).',
    ).toEqual([]);
  });

  it('chaque ligne porte un LOT CONNU, et les comptes PAR LOT ne font que décroître', () => {
    const parLot = new Map<string, number>();
    const toutes = [
      ...STRUCTURES_FORMES,
      ...STRUCTURES_HOMONYMES,
      ...STRUCTURES_REDECLARATIONS,
      ...STRUCTURES_ENVELOPPE,
      ...STRUCTURES_ORPHELINES,
      ...STRUCTURES_OPS,
    ];
    for (const l of toutes) parLot.set(l.lot, (parLot.get(l.lot) ?? 0) + 1);
    expect(
      [...parLot.keys()].filter((l) => !(LOTS_CONNUS as readonly string[]).includes(l)).sort(),
      `lot(s) inconnu(s) : un dénominateur ne se range que dans l’un des ${LOTS_CONNUS.length} lots d’extinction (\`LOTS_CONNUS\`).`,
    ).toEqual([]);
    // Cliquet PAR LOT BIDIRECTIONNEL (patron `assertRatchet`, `src/ui/ui-ratchets.test.ts`) : un plafond PAR
    // lot connu, réel > plafond = dérive, réel < plafond = plafond PÉRIMÉ à abaisser au réel mesuré.
    // L2 #1548 commit 0 — c'est le LOTISSEMENT qui bouge, pas le terrain (aucun `src/data/**.json`,
    // aucun `src/scenes/**` touché) :
    //   • `L2 #1463` 141 → 57 : 23 lignes `ids-nus` sortent du dénominateur (cible neuve) et 62 lignes
    //     se re-lotissent en L3 — leur concept réel n'est pas la Compétence (règle, carrière, espèce,
    //     tenue, trait, talent, domaine, sous-type d'objet, pion de scène…) : `lotDeForme` les lisait
    //     L2 par COLLISION d'ids (angle mort déclaré). Chacune porte son `motif`.
    //   • `L3 #1463` 389 → 397 : +62 reçues, −53 `ids-nus` sorties, −1 partie en L2
    //     (`tavernGames.json › spec`, SPÉCIALISATION de Compétence — DESIGN v2 : « L2 … + `spec`
    //     pool/ouverte », et le `skill` frère du même document est déjà L2). Ce lot GROSSIT sans
    //     dérive : les lignes viennent d'un autre lot du même stock, la somme des deux baisse de 76.
    const plafonds: Record<string, number> = {
      // L1a #1466 : 23 → 22 (#1463 L-de-1) — le `{sum}` d'`engineFormulaSchema` (`defs/miscast.ts`)
      // cesse d'être « hors lexique » : le concept `formule` le nomme, à sa forme CIBLE. La ligne ne
      // meurt pas, elle change de lot (L4 #1463 la reçoit ci-dessous).
      // … puis 22 → 23 (#1463 L-gram-1) : la MÊME ligne revient — le `{sum}` d'`engineFormulaSchema`
      // est la 10ᵉ branche du schéma dont les 9 sœurs sont lotées ICI (`defs/miscast.ts`) ; le concept
      // `formule` la NOMME, il ne la déplace pas de porteur. Re-lotissement de REVUE (design jugé du
      // 2026-09-01, §0.b) : elle s'éteindra avec les 9 autres, pas avec la vague `grammaire`.
      // … puis 23 → 16 (#1654 geste A, 2026-09-01) : les 7 redéclarations `entries` du lot MEURENT par
      // CONSTRUCTION — `options.rangee` est admissible en TOUTE famille, la fabrique pose
      // `entries` (et `die` sous `deDeTirage`) avec leur méta FR, et la garde de `document()` refuse
      // désormais l'une comme l'autre dans les `champs` d'un def à rangées : `driving-mishap`,
      // `drunkenness`, `montures`, `naval-progression`, `obsessions`, `surincantation`,
      // `vents-tourbillonnants`.
      'L1a #1466': 16,
      'L1b #1467': 0,
      // L1c #1468 : 403 → 400 (commit 3c) — cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      // … puis 400 → 402 (#862) : cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      // … puis 402 → 404 (#674) : cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      // … puis 404 → 403 (#1463 L-de-1) : cf. le cliquet `STRUCTURES_OPS` ci-dessus.
      // … puis 403 → 391 (#1657 B2a) : les 12 lignes de signature d'op d'`aa-criticals.json` FUSIONNENT
      // dans celles de `criticals.json` — un fichier de moins, les mêmes ops (les occurrences se
      // somment, cf. le cliquet `STRUCTURES_OPS` ci-dessus).
      // … puis 391 → 392 (#1657 B3-2b-c) : l'op `fall` NEUVE — les 5 rangées du gréement font tomber
      // (MDG 13 l.678-688), hauteur lue en donnée et non authorée au site.
      // … puis 392 → 393 (#1653 train A, 2026-09-04) : la signature `condition {durationRounds, id, op,
      // perRound, unlessCondition, value}` de « Purifier la chair » (LDB 40 l.75) — INSTANCE des deux
      // signatures d'op déjà stockées de ce dataset (`condition {durationRounds,id,op}` et
      // `condition {id,op,value}`), aucune forme neuve : la cause récurrente porte SA durée.
      // … puis 393 → 394 (#1599, 2026-09-06) : la signature `condition {id, op, resolveWindow}` — les
      // DEUX États portés par un canal passif de `symptoms.json` déclarent désormais SUR L'OP ce qu'un
      // Point de Détermination y fait (fenêtre d'horloge de la Fièvre (Grave), `LDB 20 l.170` ; refus du
      // Malaise, `l.188`), là où deux drapeaux de SYMPTÔME le disaient. Les 2 occurrences quittent
      // `condition {id,op}` (6 → 4) : mêmes op, une ligne de plus, ZÉRO drapeau de porteur en moins.
      // #1612 (2026-09-06) : 394 → 398 — QUATRE signatures d'op NEUVES, posées par Mendier et sa table
      // MAISON, toutes à la forme DÉCLARÉE du moteur : `money {montant, op}` côté `activities.json` (le
      // gain et le sou de consolation) ET côté `tables.json` (l'amende des gardes locaux — `LDB 09 l.97`
      // nomme l'ennui sans le chiffrer, le montant vit en règle optionnelle), `statusMod {amount, op}`
      // (« surpris à mendier », `l.99`) et `condition {id, op}` dans `tables.json`. Les deux autres ops du
      // train rejoignent des signatures DÉJÀ stockées (`rollTable` 12 → 13 ; `wounds` à mitigations
      // déclarées 5 → 6). Cf. `STRUCTURES_OPS` ci-dessus.
      'L1c #1468': 398,
      // L1d #1469 : 62 → 61 (#1552) — « La Diligence » CITE désormais son folio à la racine
      // (`ennemi-dans-l-ombre` 12, la référence que son bloc narratif portait déjà en profondeur) ;
      // sa ligne « source | clé absente » est SOLDÉE.
      // … puis 61 → 57 (#1552 lot 3) : le rôle `source` déclare son alternative `maison` et les 4
      // documents qui la portent sur TOUTES leurs entrées sortent du dénominateur (cf. le cliquet
      // `STRUCTURES_ENVELOPPE` ci-dessus).
      // … puis 59 → 58 (#1463 L-gram-4) : la redéclaration du def `progression-schemas-derived.ts`
      // sort — il compose `sourceRefSchema.shape` et le générateur émet `page`.
      // … puis 58 → 56 (#1657 B2a) : les DEUX lignes « source | clé absente » des racines de
      // `criticals.json` et `aa-criticals.json` sont SOLDÉES — les 8 documents-tables qui les
      // remplacent portent chacun leur `source` (LDB 174 ×4, AA 83/84/85/86).
      // … puis 55 → 53 (#1686 lot 2) : les TROIS lignes « `source` absente » des catalogues de matières
      // (`propMaterials`/`roofMaterials`/`reliefMaterials`) n'en font plus qu'UNE — les trois documents
      // fusionnent en `materials.json`, mêmes 16 entrées, un seul porteur de la divergence.
      'L1d #1469': 53 /* 56→55 : la ligne d'enveloppe « `source` absente » de `props.json` meurt (#1680 ligne 5). PORTÉE EXACTE, à ne pas surestimer : elle s'éteint par `satisfaitAutrement = parCle.has(def.alternative)` (`scripts/docs/lib/structures-scan.mts:1081`) — la divergence est relevée PAR DOCUMENT, et la présence de la clé alternative `maison` sur AU MOINS UNE entrée suffit à l'éteindre pour tout le document. Ce ne sont donc PAS les 123 entrées qui deviennent sourcées : 41 portent `maison` (celles qui portent une RÈGLE — `light`/`cover`/`opaque` — que `affinerEntree` exige désormais), 82 restent muettes et le demeurent légitimement (leur contenu est de l'art). Le +2 antérieur (alsoIn creatures/species posés par e89a836d3 SANS leur ligne de stock, sillage C1 #1457) reste à SOLDER par la vague L1d (#1469) */,
      // L2 #1463 : 57 → 48 (commit 3b) — les 9 lignes de référence de Compétence à graphie `skillId`
      // (donnée + defs) meurent ; ce qui reste du lot est la référence PLATE `skill: "<id>"` des ops.
      // … puis 48 → 18 (commit 3c) : cette référence PLATE MEURT à SON TOUR — 30 lignes s'éteignent avec
      // l'emboîtement `skill: { id, spec? }` (cf. le cliquet `STRUCTURES_FORMES` ci-dessus).
      // … puis 18 → 16 (geste modèle) : les 2 lignes du pseudo-PNJ soigneur quittent le lot — la
      // valeur de Guérison recopiée MEURT (`skill {id,value}`), et la signature de l'effet qui la
      // portait n'annonce plus qu'une entité (elle passe donc en `L3`, +1 ci-dessous : même mécanique
      // de transfert entre lots du MÊME stock, somme des deux en BAISSE 415 → 414).
      // … puis 16 → 10 (commit 4) : les 6 dernières lignes du lot sont les enveloppes `{ref:{…}}` et
      // `{wildcard:{…}}` de l'AVANCEMENT (careerLevels + species) — la référence y est désormais À
      // PLAT, régime de spécialisation compris (`{id}`, `{id, spec}`, `{id, choix}`).
      // … puis 10 → 4 (commit 4bis) : les 6 lignes `skills {id,value}`/`{id,spec,value}` des statblocs
      //     passent CIBLE au site et sortent du dénominateur (cf. le cliquet `STRUCTURES_FORMES`).
      // L2 #1463 : 4 → 6 (#1657 geste A) — les 2 voies de Compétence d'une Activité qui portent leur
      // Difficulté PROPRE (`activities.json › skills`) ENTRENT au dénominateur : `test` les revendiquait
      // par le seul `difficulty`, ce sont des RÉFÉRENCES à charge utile (cible `skills.json`, d'où ce lot).
      // Aucune donnée ne bouge — c'est le même objet, compté sous le concept qui le nomme.
      'L2 #1463': 6,
      'L2 #1548': 0,
      // L3 #1463 : 398 → 385 (commit 4) — le MÊME geste éteint les 14 lignes de graphie du champ
      // d'avancement côté PORTEUR (`skills`/`talents` à signature `ref`/`wildcard`/`choice`, et les
      // `choice>…` de leurs branches) et en pose UNE : `species.json › of {random}`, les 2 tirages
      // qui vivaient en branche de `choice` et vivent maintenant en branche de `pick`. La branche
      // `{random}` NE migre PAS (sa cible `{pick, table}` est le lot L4) : elle reste traçée ici et
      // sur `species.json › talents {random}` (×19).
      // … puis 385 → 387 (#862) : cf. le cliquet `STRUCTURES_FORMES` ci-dessus (les deux graphies de
      // référence de Trait sous `mutations.json › ops`).
      // … puis 387 → 386 (commit 4bis) : la redéclaration `creatures.ts {id,spec,value}` s'éteint —
      // le def compose `refOuSpec('skill', {value})`.
      // … puis 386 → 389 (#674) : les 3 références de la Pneumonie/du Rhume commun — `mutation`
      // (maladie visée), `onFail` et `otherwise` (maladie + symptôme de chaque op). Cf. le cliquet
      // `STRUCTURES_FORMES` ci-dessus.
      // … puis 389 → 392 (#684 L4) : `a`, `b`, `scene` du premier tronçon de carte du chapitre 1 —
      // les trois références de CARTE que les trois autres projets portent déjà, même lot.
      // … puis 392 → 393 (équipage de la Louve grise, 3fe450675) : `barge-du-sel-projet.json › appearance {species, tenue}` — la
      // ligne sœur de `loup-et-saumure`/`arene`/`creatures.json`, même concept, même lot.
      // … puis 393 → 395 (équipage du Grimm et statblocs d'auteur de l'arène, 2026-09-01) :
      // `loup-et-saumure-projet.json › appearance {species, tenue}` et `arene-projet.json › appearance {species}` —
      // les deux dernières lignes sœurs du même concept, même lot.
      // … puis 395 → 393 (L-ref-2, 2026-09-01) : `spells.json › range` et `spells.json › target`
      // `{text+… (résolvable)}` s'éteignent — les 38 occurrences stockées (54 sites migrés — les 16 Mage/Shaman n'entraient pas au stock) qui désignaient le lanceur en
      // toutes lettres portent `{kind:'self'}`. Cf. le cliquet `STRUCTURES_FORMES` ci-dessus.
      // … puis 393 → 392 (L-ref-0 + L-ref-1, 2026-09-01) : `careerLevels.json › trappings` rend ses
      // deux lignes `text (résolvable)` et reçoit `choice>id,spec`. Cf. le cliquet `STRUCTURES_FORMES`
      // ci-dessus.
      // … puis 392 → 391 (L-ref-1bis, 2026-09-01) : `creatures.json › trappings {text (résolvable)}`
      // part avec son unique porteur lié. Cf. le cliquet `STRUCTURES_FORMES` ci-dessus.
      // … puis 391 → 383 (#1463 L-gram-2, 2026-09-01) : les SEPT redéclarations de référence des defs
      // s'éteignent (domains, species, structures, trappings ×2, vehicles ×2) et la forme de donnée
      // `species.json › preview` part avec la migration — le stock des FORMES perd sa ligne, celui des
      // REDÉCLARATIONS ses sept : −8. 489 références entrent en garde FK au passage.
      // … puis 383 → 385 (#1657 geste A) : même mécanique — la 8ᵉ réf de symptôme à Difficulté propre
      // (`maladies › symptoms {difficulty,symptomId}`, sa Difficulté RÉSOUT donc la projection garde les
      // deux clés) et la RÈGLE d'une Activité (`activities › rule {id-nu}`, `augure` → `tableau-augure`,
      // que la classification en `test` empêchait de mesurer). La somme L2+L3+L4 BAISSE : 494 → 485.
      // … puis 385 → 376 (#1657 B2a) : 7 lignes de référence d'`aa-criticals.json` fusionnent dans
      // celles de `criticals.json`, et les 2 lignes `onFail` MEURENT — la conséquence d'un jet vit
      // dans la branche `fail` du nœud `test`, sous `ops` — une seule graphie au lieu de deux.
      // … puis 376 → 374 (#1657 B2b) : les DEUX lignes `onFail` des maladies meurent à leur tour —
      // `symptoms.json › onFail` (2 signatures) fusionne dans `› ops`, et la 8ᵉ réf de symptôme à
      // Difficulté propre (posée au geste A) part : le document déclare désormais sa Difficulté par
      // l'enum de la grammaire, un littéral d'enum n'ouvrant jamais de référence.
      // … puis 374 → 373 (#1657 B2c) : la ligne `river-criticals.json › onFail` MEURT à son tour — la
      // conséquence du coup à l'équipage rejoint `› ops` (4 → 5 occurrences), une seule graphie.
      // … puis 373 → 374 (#1653 train A, 2026-09-04) : `miscast.json › ops` gagne la signature
      // `id,unlessCondition,value+…` — MÊME famille que `id,value+…` déjà stockée (11+31 lignes) :
      // le gate d'État d'une op récurrente désigne un État par son id NU, comme l'`id` frère.
      // Elle s'éteindra avec eux (référence d'État à la forme cible), pas avant.
      // … puis 374 → 376 (#1599, 2026-09-05) : `symptoms.json › severePassive` MEURT (−1) et les passifs
      // s'indexent PAR PALIER — le scan nomme le champ PORTEUR, d'où `› moderee {char+…}` (Convulsions
      // −20, LDB 20 l.157) et `› grave {id+…}` (Fièvre : le seul État *Inconscient*, LDB 20 l.170 — le
      // palier S'AJOUTE, les −10 de base tiennent sans être recopiés) ; `› passive {id+…}` (+1) est
      // l'État *Exténué* du Malaise
      // (l.188), qui cesse d'être un drapeau nommé dans le moteur. MÊMES familles que les lignes voisines
      // (référence de Caractéristique, référence d'État par id NU) : elles s'éteindront avec elles.
      // … puis 376 → 377 (#1599, 2026-09-06) : `symptoms.json › minutes {rule}` — la fenêtre de
      // conscience (`LDB 20 l.170`) lit sa durée au registre des règles optionnelles par le terme
      // `{rule}` d'une `Formula`. MÊME graphie que le gate `variants[].when` de `spells.json` (18) et
      // `talents.json` (12), déjà stockée dans ce lot : elle s'éteindra AVEC eux, d'un seul geste.
      // … puis 377 → 378 (#1690, 2026-09-06) : UNE ligne NEUVE, qui n'est pas une dérive de graphie —
      // `terrains.json › overlayProp` (l'id de décor posé sur chaque tuile, forme CIBLE refinée par
      // `idDe('prop')`) entre au dénominateur avec son document.
      // #1612 (2026-09-06) : 377 → 382 — CINQ lignes de référence NEUVES, posées par Mendier et sa table
      // MAISON : les QUATRE porteurs du terme `{rule}` d'une `Formula` (`cible`/`factor`/`mod` côté
      // `activities.json`, le `times.of` de l'amende des gardes côté `tables.json`) et l'op `condition`
      // de la table MAISON, qui désigne l'État de sa rangée. MÊME graphie que leurs sœurs déjà stockées
      // ici : elles s'éteindront avec elles, d'un seul geste.
      // #1691 (2026-09-07) : 383 → 388 — CINQ lignes de référence NEUVES, posant en DONNÉE la matière
      // que `gameIso/builders/floors.ts` choisissait en dur : `terrains.json › matiere` (les flancs d'un
      // terrain à bloc plein, id nu comme son voisin `overlayProp`) et `<projet> › reliefDefaults` sur
      // les quatre projets de scène (l'enveloppe des quatre parties émises). MÊME graphie que leurs
      // sœurs déjà stockées ici : elles s'éteindront avec elles, d'un seul geste.
      // #1715 volet b (2026-09-09) : 390 → 394 — QUATRE lignes NEUVES, une par projet livré : le record
      // `roofDefaults` que chaque scène porte depuis que la toiture par défaut est en donnée.
      // #1715 (2026-09-09) : 388 → 390 — TROIS lignes de référence NEUVES pour UNE morte, toutes du
      // catalogue de BÂTIMENTS passé en donnée (`buildings.json › roofMaterial` et `› features`,
      // `diligence-projet.json › style` ; `arene-projet.json › style` s'éteint). MÊME graphie que leurs
      // sœurs déjà stockées ici : elles s'éteindront avec elles, d'un seul geste.
      // #1687 lot 3-I (2026-09-11) : 394 → 391 — TROIS lignes MEURENT, aucune ne naît, et ce n'est PAS une
      // migration : les graphies `arene-projet.json › effect` `lodging,type` (1), `phase,type` (2) et
      // `type+…` (1) vivent sous `.scenes[].dialogues[].nodes[].choices[].flow.steps[]` et
      // `.scenes[].triggers[].flow.steps[]` — jamais sous `interact` — et leur donnée n'a pas bougé d'un
      // octet. Cause MESURÉE (quatre scans {defs} × {données}) : ce que `choixDeclares('arene-projet.json')`
      // ATTEINT change — `phase` et `lodging` sont déclarés à HEAD comme ici (`defs-scenes/effets.ts`), mais
      // la marche de l'instrument est mémoïsée et bornée (`PROFONDEUR_MEMO = 12`, borne atteignante :
      // 452 clés à 12 contre 488 à 20), donc le chemin par lequel un nœud est atteint décide s'il est vu —
      // et `interact` (court) cède à `usable → refine → actions[] → flow` (profond). `ouvreReference`
      // (`structures-scan.mts:501`) ne tenant pas un littéral d'enum DÉCLARÉ pour une clé étrangère, ces 4
      // objets cessent d'être des références et passent au dénominateur HORS STRATE (cf.
      // `PLAFOND_HORS_STRATE`, qui porte la mesure chiffrée ; le défaut d'instrument y est nommé).
      'L3 #1463': 391,
      // L4 #1463 : 220 → 219 (commit 3b) — les deux formes de `activities.json › skills` fusionnent en
      // une seule dès que la référence sort de leur signature.
      // … puis 219 → 221 (#674) : le Test quotidien de la Pneumonie compte DEUX fois — sa forme en
      // donnée (`maladies.json › dailyTest`) et sa redéclaration au def (`maladies.ts › dailyTest`).
      // L4 #1463 : 221 → 162 (vague `plage`, 2026-08-31). −61 lignes de FORMES (les rangées de table
      // à fourchette plate passent CIBLE, cf. le cliquet `STRUCTURES_FORMES` ci-dessus) et +2 lignes
      // de REDÉCLARATIONS (`weather.ts`, `advancementCosts.ts` — leurs schémas déclarent désormais le
      // littéral à DEUX bornes, empreinte de la migration P2 ; cf. le cliquet
      // `STRUCTURES_REDECLARATIONS`). Solde net −59.
      // … puis 162 → 152 (vague `plage`, LOT P1-a) : les 10 lignes de REDÉCLARATIONS des rangées de
      // table « critiques & corps » sortent — leurs schémas composent `plageSchema` par la SHAPE, ou
      // l'adoptent nu quand les deux bornes sont toute la charge utile.
      // … puis 152 → 143 (LOT P1-b) : les 9 lignes de REDÉCLARATIONS des rangées de table de magie et
      // des tables générales sortent à leur tour, par composition de `plageSchema`.
      // … puis 143 → 131 (LOT P1-c) : les 12 lignes de REDÉCLARATIONS des rangées de table de mer, de
      // route et de bataille sortent à leur tour, par composition de `plageSchema`.
      // … puis 131 → 130 (L-monnaie-1) : `activities.minInvest` compose `moneyPartialSchema` de la
      // grammaire (`grammaire/valeurs.ts`) au lieu de re-taper `{gold}`.
      // … puis 130 → 121 (L-monnaie-2) : la clé `bronze` meurt (5 lignes de FORMES, 455 montants) et
      // les 4 catalogues composent le `moneySchema` de la grammaire (4 REDÉCLARATIONS).
      // … puis 121 → 113 (L-monnaie-3) : les 8 dernières lignes de FORMES du concept monnaie sortent
      // (53 occurrences) — 44 `giveMoney` enveloppés dans `montant`, et les 9 montants PARTIELS
      // (`activities.minInvest`, coûts de choix d'arène) reconnus CIBLES par le lexique. Le concept
      // monnaie ne pèse plus AUCUNE ligne au stock des formes.
      // … puis 113 → 112 (L-monnaie-4) : l'HOMONYME `cost` sort — le nom ne porte plus que la monnaie
      // (8 tarifs d'arène), les 85 porteurs d'un autre type ayant reçu le nom de ce qu'ils chiffrent.
      // … puis 112 → 111 (#1463 L-de-1) : QUATRE lignes du concept `de` sortent — la forme divergente
      // `miscast.json › dice {n,sides+…}` et les TROIS dés re-tapés dans les defs (`maladies.ts`,
      // `miscast.ts` ×2, qui composent `diceSpecSchema`) —, et TROIS entrent : le constat
      // `sea-cargo` (donnée + def) que le concept `formule` rend mesurable, et le `{sum}`
      // d'`engineFormulaSchema` reçu de `L1a #1466` (−1 là-bas, somme des deux lots INCHANGÉE dessus).
      // … puis 111 → 107 (#1463 L-gram-1) : les TROIS redéclarations à deux bornes qui pouvaient
      // sortir sortent (cf. le cliquet `STRUCTURES_REDECLARATIONS` ci-dessus), et la quatrième ligne
      // rend son lot à `L1a #1466` (le `{sum}` d'`engineFormulaSchema`, ci-dessus) : −3 −1.
      // … puis 107 → 94 (#1657 geste A) : les 10 lignes de FORMES (`test` ×7, `sequence` ×3) et les
      // 4 REDÉCLARATIONS ci-dessus sortent, et `maladies › dailyTest` entre ICI plutôt qu'en L3 —
      // c'est un JET (EDOC 08 l.104) que l'enveloppe `épreuve` de #1657 geste B reprendra, le lot des
      // références ne l'éteindrait jamais : −14 +1.
      // … puis 94 → 90 (#1463 L-gram-3) : les DEUX `price` re-tapés des defs de commerce, la
      // redéclaration `sea-cargo.ts › offerPrice` et la forme `sea-cargo.json › offerPrice {sum+…}`
      // sortent ENSEMBLE (cf. les deux cliquets ci-dessus) : −4.
      // … #1657 B2a : 90 → 85. Les 4 lignes de test d'`aa-criticals.json` fusionnent dans celles de
      // `criticals.json` (amputation, loss, resist ×2), et `resist` devient le nœud `test` PARTAGÉ :
      // deux lignes (`test | difficulty` 38, `test | difficulty,skill` 1) là où il y en avait quatre,
      // plus la redéclaration de def `criticals.ts › resist` qui meurt avec la graphie propriétaire.
      // … #1657 B2b : le plafond TIENT à 85, mesuré — le lot ne décroît pas ici. `symptoms.json ›
      // onTick {difficulty+…}` et sa redéclaration de def (`symptoms.ts › onTick`) meurent avec la
      // graphie propriétaire (−2), et le nœud partagé rend UNE forme par document porteur
      // (`symptoms.json › test {difficulty}` 3, `maladies.json › test {difficulty}` 1, +2) : solde 0.
      // Le terrain gagné est de SIGNATURE, pas de compte — les deux lignes neuves portent l'exacte
      // `difficulty` du `flowTestSchema`, la MÊME que `criticals.json › test` depuis B2a, là où la
      // graphie propriétaire projetait `difficulty+…`. Le décompte L3 (−2), lui, baisse.
      // … #1657 B3-1 : 85 → 84. Les DEUX formes de nœud `test` de `criticals.json` n'en font plus
      // qu'UNE : les 38 rangées qui ne nommaient PAS leur Compétence rejoignent `difficulty,skill`
      // (1 → 39), la seule graphie que la porte sache tester. Ce que le silence coûtait : le moteur
      // recomposait la valeur à la main (Endurance + avances de Résistance), hors `testValue`.
      // … #1657 B3-3 : 84 → 85, cliquet REMONTÉ d'UNE ligne, et c'est une CONVERGENCE, pas une dérive.
      // Les 4 nœuds du cycle de maladie NOMMENT ce qu'ils testent (`LDB 20 l.145/l.212` Résistance,
      // `MSRC 16 l.90` Endurance, `EDOC 08 l.104` Résistance) : la graphie APPAUVRIE `test
      // {difficulty}` — celle qui laissait le moteur recomposer la valeur à la main (#1685) — MEURT
      // dans les deux documents (−2 lignes), et ses occurrences se répartissent sur DEUX graphies déjà
      // au lexique et déjà majoritaires ailleurs : `difficulty,skill` (`criticals`, `spells`,
      // `maneuvers`, `talents`…) ×2+1, `characteristic,difficulty` ×1 (+3 lignes). Le +1 net est
      // mécanique : un document qui distingue Compétence et Caractéristique porte deux lignes là où
      // l'appauvrissement n'en portait qu'une.
      'L4 #1463': 85,
      // #1553 : 92 → 106 (commit 3c) — le lot des ORPHELINES reçoit les 14 conteneurs qui quittent
      // `L2 #1463` (−30 ci-dessus) : mêmes objets, autre stock, somme des deux en BAISSE.
      // … puis 106 → 104 (commit 3d) — `talents.json › reverseFailed` sort du lot : sa clé `skills`
      // n'est plus un nom de concept réservé.
      // … puis 104 → 105 (#717) — l'ouverture du chapitre 1 et sa `source` embarquée (même motif).
      // … puis 105 → 98 (#1463 L-monnaie-4) — 7 lignes sortent : elles n'étaient ORPHELINES que par le
      // NOM `cost`, rendu à son type (naval `install` ×2, `qualities.flow`, `advantageDefenseReaction`,
      // `prosthesisTraining` ×3 ; 29 occurrences).
      // … puis 98 → 97 (#1633) — `diligence-projet.json › ouverture` sort : le concept `ouverture` de
      // la strate `Document` la classe à sa forme CIBLE, elle n'annonce plus rien qu'elle ne résolve.
      '#1553': 97,
    };
    expect(
      Object.keys(plafonds).sort(),
      'les plafonds par lot et `LOTS_CONNUS` sont le MÊME ensemble : un lot sans plafond n’est cliqueté par rien.',
    ).toEqual([...LOTS_CONNUS].sort());
    const reel = (lot: string) => parLot.get(lot) ?? 0;
    expect(
      Object.keys(plafonds).filter((lot) => reel(lot) > plafonds[lot]).map((lot) => `${lot} ${reel(lot)} > ${plafonds[lot]}`),
      'lot(s) qui ont GONFLÉ — une ligne ne change pas de lot sans revue, et un lot ne grossit pas sans dérive.',
    ).toEqual([]);
    expect(
      Object.keys(plafonds).filter((lot) => reel(lot) < plafonds[lot]).map((lot) => `${lot} : plafond PÉRIMÉ ${plafonds[lot]}, abaisser à ${reel(lot)}`),
      'plafond(s) PÉRIMÉ(S) — le terrain gagné se VERROUILLE : abaisser le plafond au réel mesuré.',
    ).toEqual([]);
  });

  /**
   * Le lot d'une ligne se DÉDUIT du concept (`lotDeForme`), et cette déduction lit la colonne
   * `cibles` — qui liste TOUS les datasets atteignables, COLLISIONS d'ids comprises (angle mort
   * déclaré). Une ligne dont le concept réel n'est pas celui que la déduction lui prête se re-lotit
   * en revue ; ce test rend cette divergence NOMMÉE et BIDIRECTIONNELLE : pas de re-lotissement
   * muet, pas de `motif` sur une ligne que rien ne fait diverger.
   */
  it('un LOT qui DIVERGE de la déduction porte son MOTIF — et un MOTIF suppose une divergence', () => {
    const deduit = new Map(scan.formes.map((f) => [siteDeForme(f), lotDeForme(f.concept, f.signature, f.cibles ?? [])]));
    const diverge = (f: { concept: string; dataset: string; champ: string; signature: string } & Trace) =>
      deduit.has(siteDeForme(f)) && f.lot !== deduit.get(siteDeForme(f));
    expect(
      FORMES.filter((f) => diverge(f) && !f.motif?.trim()).map(cleForme),
      'ligne(s) re-loties SANS motif — un lot qui contredit la déduction NOMME le concept réel de la ligne, sinon le lotissement du chantier n’est plus relisible.',
    ).toEqual([]);
    expect(
      FORMES.filter((f) => f.motif?.trim() && !diverge(f)).map(cleForme),
      'ligne(s) portant un `motif` que rien ne fait diverger — un motif justifie une décision de revue, il ne décore pas une ligne que la déduction range déjà là.',
    ).toEqual([]);
  });

  it('les ANGLES MORTS ont UNE source : le lexique, recopié nulle part (test, stock, doc)', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/structuresStock.mjs'), 'utf8');
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    // Les deux copies se LISENT, elles ne se cherchent pas : l'inclusion seule est unidirectionnelle
    // (lexique ⊆ copie) et laisserait passer une ligne SURNUMÉRAIRE — un angle mort que le lexique ne
    // porte pas est un angle mort que personne n'a décidé.
    const listeStock = stock
      .split('ANGLES MORTS — SOURCE UNIQUE')[1]
      .split('\n//\n')[0]
      .split('\n')
      .filter((l) => l.startsWith('//   - '))
      .map((l) => l.slice('//   - '.length));
    const listeDoc = doc
      .split('## Périmètre mesuré et angles morts')[1]
      .split('\n## ')[0]
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2));
    expect(
      lignes(listeStock),
      'l’en-tête de `structuresStock.mjs` a divergé de `ANGLES_MORTS` — une ligne en trop y est un angle mort que le lexique ne déclare pas, une ligne en moins une copie amputée.',
    ).toEqual(lignes([...ANGLES_MORTS]));
    expect(
      lignes(listeDoc),
      'le § « Périmètre mesuré et angles morts » de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS` (le doc est GÉNÉRÉ : le régénérer, ou corriger le lexique).',
    ).toEqual(lignes([...ANGLES_MORTS]));
  });

  it('MUTATION par champ : chaque champ de chaque stock entre dans la clé comparée', () => {
    const mute = (v: unknown) => (typeof v === 'number' ? v + 999 : Array.isArray(v) ? [...v, 'ZZZ'] : `${v}~MUTE`);
    const cleHomonyme = (h: { cle: string; classes: readonly string[]; occurrences: number } & Trace) =>
      `${h.cle} | ${[...h.classes].sort().join('/')} | ${h.occurrences}` + trace(h, LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463');
    const cleEnveloppe = (e: { role: string; cle: string; motif: string; detail: string; document: string; chemin: string; entrees: number } & Trace) =>
      `${e.role} | ${e.cle} | ${e.motif}${e.detail ? `:${e.detail}` : ''} | ${e.document} › ${e.chemin} | ${e.entrees}` +
      trace(e, lotEnveloppe(e));
    const cleRedeclaration = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string; occurrences: number } & Trace) =>
      `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun} | ${r.occurrences}` +
      trace(r, lotDeForme(r.concept, r.signature));
    const stocks: Array<[string, readonly Record<string, unknown>[], (x: never) => string, string[]]> = [
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES, ((c: { concept: string; signature: string; date: string }) => `${c.concept} | ${c.signature} | ${c.date}`) as never, ['concept', 'signature', 'date']],
      ['STRUCTURES_FORMES', STRUCTURES_FORMES, cleForme as never, ['concept', 'dataset', 'champ', 'signature', 'statut', 'strate', 'occurrences', 'lot', 'motif', 'date']],
      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT, ((d: { dataset: string; cle: string; date: string }) => `${d.dataset} | ${d.cle} | ${d.date}`) as never, ['dataset', 'cle', 'date']],
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES, cleHomonyme as never, ['cle', 'classes', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS, cleRedeclaration as never, ['def', 'champ', 'concept', 'signature', 'statut', 'commun', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE, cleEnveloppe as never, ['role', 'cle', 'motif', 'detail', 'document', 'chemin', 'entrees', 'lot', 'date']],
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES, cleOrpheline as never, ['dataset', 'champ', 'signature', 'motif', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_OPS', STRUCTURES_OPS, cleOp as never, ['op', 'signature', 'dataset', 'occurrences', 'lot', 'date']],
    ];
    const aveugles: string[] = [];
    for (const [nom, arr, cle, champs] of stocks) {
      const base = lignes(arr.map(cle as (x: unknown) => string)).join('\n');
      for (const champ of champs) {
        const i = arr.findIndex((x) => x[champ] !== undefined && x[champ] !== '' && x[champ] !== null);
        // Champ qu'AUCUNE ligne ne porte encore (`STRUCTURES_ENVELOPPE.detail` depuis l'extinction du
        // dernier `type divergent`, #1467 L1b V-P3) : le scan le produit toujours
        // (`structures-scan.mts:967`), il doit donc entrer dans la clé LE JOUR où une ligne le
        // portera — on l'INJECTE sur la première ligne, la cécité de la clé restant mesurée pareil.
        const cible = i < 0 ? 0 : i;
        const valeur = i < 0 ? 'PORTE' : mute(arr[cible][champ]);
        const copie = arr.map((x, j) => (j === cible ? { ...x, [champ]: valeur } : x));
        if (lignes(copie.map(cle as (x: unknown) => string)).join('\n') === base) aveugles.push(`${nom}.${champ}`);
      }
    }
    expect(
      aveugles,
      'champ(s) de stock HORS de la clé comparée : les muter laisse la garde verte — le pilotage du chantier reposerait sur un champ non gardé (#1465 F1).',
    ).toEqual([]);
  });

  it('les deux racines de documents sont scannées', () => {
    const racines = new Set(scan.documents.map((d) => d.racine));
    expect([...racines].sort()).toEqual(['src/data', 'src/scenes']);
    expect(scan.documents.filter((d) => d.racine === 'src/scenes').length).toBeGreaterThan(0);
  });
});

describe('la référence est ANCRÉE sur l’index des ids (contrats positifs)', () => {
  const occurrence = (dataset: string, champ: string, sig: string) =>
    scan.formes.find((f) => f.concept === 'reference' && f.dataset === dataset && f.champ === champ && f.signature === sig);

  it.each([
    ['creatures.json', 'skills', 'id,value', 'skills.json'],
    ['careerLevels.json', 'skills', 'id,spec', 'skills.json'],
    ['careerLevels.json', 'skills', 'choix,id', 'skills.json'],
    ['criticals.json', 'ops', 'id,value+…', 'etats.json'],
    ['arene-projet.json', 'members', 'entityId', 'arene-projet.json'],
    ['maladies.json', 'symptoms', 'symptomId', 'symptoms.json'],
    ['activities.json', 'ops', 'tableId+…', 'tables.json'],
  ])('%s › %s {%s} est une occurrence de référence dont la cible résout vers %s', (dataset, champ, sig, cible) => {
    const f = occurrence(dataset, champ, sig);
    expect(f, `aucune occurrence de référence mesurée sous \`${dataset} › ${champ} {${sig}}\` — le champ porteur est MESURÉ, pas déclaré.`).toBeTruthy();
    expect(f!.occurrences).toBeGreaterThan(0);
    expect(f!.cibles, 'la référence ne résout vers aucun document : l’index des ids ne la porte pas.').toContain(cible);
  });

  it('un `{id,label}` de spécialisation n’est JAMAIS un champ de référence (anti-circularité)', () => {
    expect(
      scan.champsDeReference,
      '`specs` est devenu un champ porteur de références : le contre-exemple canonique du lexique (`{id,label}` = un DOCUMENT embarqué) a basculé — c’est la circularité que la passe 4 supprime.',
    ).not.toContain('specs');
    for (const champ of ['skills', 'ops', 'members', 'symptoms'])
      expect(scan.champsDeReference, `le champ \`${champ}\` porte des références mesurées et devrait être vu.`).toContain(champ);
    expect(
      CONCEPTS.filter((c) => 'vocabulaire' in c || 'marqueurs' in c || 'champsPorteurs' in c || 'seuil' in c).map((c) => c.id),
      'un concept redéclare un VOCABULAIRE ou une liste de champs porteurs : c’est le mécanisme circulaire que la passe 4 supprime — un champ porteur se MESURE.',
    ).toEqual([]);
  });

  it('les 452 refs à plat dans les ops sont VUES : aucune n’est orpheline sous un `op`', () => {
    const refsDansOps = scan.formes.filter((f) => f.concept === 'reference' && (f.champ === 'ops' || f.champ === 'onFail'));
    expect(refsDansOps.reduce((a, f) => a + f.occurrences, 0)).toBeGreaterThan(400);
    expect(
      refsDansOps.every((f) => f.statut === 'divergente' || f.statut === 'historique'),
      'une ref à plat dans une op est une DIVERGENCE : la cible L1c est une ref EMBOÎTÉE (`{op, skill: {id}}`).',
    ).toBe(true);
  });

  it('une ENTRÉE DE RACINE n’est jamais orpheline (les 90 faux orphelins de `props.json` sont morts)', () => {
    expect(scan.orphelines.filter((o) => o.champ === '(racine)')).toEqual([]);
  });

  it('la clé d’identité d’un document n’est pas comptée comme une référence à lui-même', () => {
    const auto = scan.formes.filter((f) => f.concept === 'reference' && f.champ === 'id' && f.signature === 'id-nu');
    expect(auto, 'un document se référencerait lui-même par sa propre clé d’identité.').toEqual([]);
  });
});

describe('les concepts de VALEUR sont reconnus à leur noyau (contrats positifs)', () => {
  const sig = (o: object) => signature(Object.keys(o));
  const classement = (o: object, champ = '', dataset = '') => classerValeur(sig(o), Object.keys(o), { dataset, champ });

  it('un montant PARTIEL est une monnaie à la forme cible, comme le montant complet', () => {
    // `moneyPartialSchema` (3 dénominations optionnelles) + `toMoney` : un coût authoré n'écrit que ce
    // qu'il chiffre — les 6 sous-signatures non vides sont CIBLES (#1463 L-monnaie-3).
    expect(classement({ gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ brass: 1, gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ book: 'ldb', page: 12 })).toMatchObject({ concept: 'source', statut: 'cible' });
  });

  it('un coefficient saisonnier sous `price` est un PRIX déclaré, jamais une monnaie à éteindre', () => {
    expect(classement({ printemps: 1, ete: 0.5, automne: 0.25, hiver: 0.5 }, 'price')).toMatchObject({
      concept: 'prix',
      statut: 'declaree',
    });
    expect(
      STRUCTURES_FORMES.filter((f) => f.concept === 'monnaie' && /automne|dice/.test(f.signature)),
      'un multiplicateur saisonnier (ou un prix TIRÉ) était stocké comme « monnaie à éteindre » : ce lot d’extinction est insoldable — une saison ne devient pas une bourse.',
    ).toEqual([]);
  });

  it('`{min,max}` n’est une plage que comme ÉLÉMENT DE TABLEAU à bornes numériques', () => {
    const cles = ['min', 'max'];
    expect(classerValeur('max,min', cles, { dataset: '', champ: 'params', candidats: ['plage'] })).toMatchObject({ concept: 'plage', statut: 'cible' });
    expect(classerValeur('max,min', cles, { dataset: '', champ: 'params' })).toBeNull();
    expect(classerValeur('manannD10,max,min', ['min', 'max', 'manannD10'], { dataset: '', champ: 'impressed' })).toBeNull();
  });

  it('une clé RÉSERVÉE encore homonyme ne force aucun concept (`count`, `cost`, `skill`)', () => {
    expect(classement({ count: 2, id: 'x' }, 'trappings')).toBeNull();
    expect(classement({ cost: 3, weightEnc: 1 }, 'install')).toBeNull();
  });

  /**
   * PRÉMISSE du discriminant `horsDesignation` (`structures-lexique.mts`, concept `test`), prouvée par
   * une marche BRUTE des deux racines — méthode INDÉPENDANTE du scan : elle ne partage ni son
   * parcours, ni sa notion de document, ni son classement ordonné, et ne consulte le lexique que pour
   * les deux prédicats de DÉSIGNATION. Deux sondes du même angle ne se confirment pas.
   * Aucun cardinal n'est écrit ici : les trois assertions sont DÉRIVÉES de la marche.
   */
  it('les porteurs de `difficulty` se PARTITIONNENT en plage / identité / référence / aucune, et « aucune » EST le concept `test`', () => {
    const ID = new Set(CLES_IDENTITE as readonly string[]);
    const porteurs: { site: string; famille: string }[] = [];
    const intersections: Record<string, number> = { 'plage∩identité': 0, 'plage∩référence': 0, 'identité∩référence': 0 };
    const marche = (v: unknown, dataset: string, champ: string): void => {
      if (Array.isArray(v)) { for (const e of v) marche(e, dataset, champ); return; }
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      const cles = Object.keys(o);
      if (cles.includes('difficulty')) {
        const plage = typeof o.min === 'number' && typeof o.max === 'number';
        const identite = cles.some((k) => ID.has(k));
        const reference = cles.some((k) => RX_CLE_REFERENCE.test(k));
        if (plage && identite) intersections['plage∩identité'] += 1;
        if (plage && reference) intersections['plage∩référence'] += 1;
        if (identite && reference) intersections['identité∩référence'] += 1;
        porteurs.push({
          site: dataset + ' › ' + (champ || '(racine)'),
          famille: plage ? 'plage' : identite ? 'identité' : reference ? 'référence' : 'aucune',
        });
      }
      for (const [k, e] of Object.entries(o)) marche(e, dataset, k);
    };
    const jsons = (d: string): string[] =>
      listerArbre(d, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => join(d, rel));
    for (const f of ['src/data', 'src/scenes'].flatMap((r) => jsons(join(ROOT, r)))) {
      let doc: unknown;
      try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
      marche(doc, f.split(/[\\/]/).pop()!, ''); // les deux séparateurs : `join` rend des antislashs sur Windows
    }

    // (a) les trois familles qui DISQUALIFIENT ne se recouvrent pas — sans quoi l'ordre du classement
    //     déciderait à la place du discriminant, et le lexique le tairait.
    expect(
      Object.entries(intersections).filter(([, n]) => n > 0).map(([k, n]) => k + ' ' + n),
      'deux familles de disqualification se RECOUVRENT : le non-recouvrement écrit au lexique est faux.',
    ).toEqual([]);

    // (b) la partition est TOTALE : les quatre familles somment aux porteurs mesurés.
    const parFamille = new Map<string, number>();
    for (const p of porteurs) parFamille.set(p.famille, (parFamille.get(p.famille) ?? 0) + 1);
    expect([...parFamille.values()].reduce((a, b) => a + b, 0), 'la partition PERD des porteurs.').toBe(porteurs.length);
    expect(porteurs.length, 'aucun porteur de `difficulty` : la sonde ne mesure rien.').toBeGreaterThan(0);

    // (c) le bucket « aucune » EST le concept `test` du scan, site par site et compte par compte.
    const parSite = (xs: [string, number][]) => lignes(xs.map(([site, n]) => site + ' | ' + n));
    const brute = new Map<string, number>();
    for (const p of porteurs) if (p.famille === 'aucune') brute.set(p.site, (brute.get(p.site) ?? 0) + 1);
    const mesure = new Map<string, number>();
    for (const f of scan.formes.filter((f) => f.concept === 'test'))
      mesure.set(f.dataset + ' › ' + f.champ, (mesure.get(f.dataset + ' › ' + f.champ) ?? 0) + f.occurrences);
    expect(
      parSite([...brute]),
      'la marche BRUTE et le SCAN ne voient pas le même concept `test` : la prémisse du discriminant (un jet = un porteur de `difficulty` qui ne désigne rien et n’est pas une rangée à bornes) ne tient plus.',
    ).toEqual(parSite([...mesure]));
  });
});

/**
 * Strate DOCUMENT (#1633) — les concepts d'ENVELOPPE. Le DoD interdit le « débordement global
 * silencieux » : ces trois sondes le mesurent au lieu de le supposer.
 */
describe('les concepts d’ENVELOPPE (strate `Document`) se reconnaissent au NOYAU, jamais au CHAMP', () => {
  const documents = CONCEPTS.filter((c) => c.strate === 'Document');

  it('A — aucun concept d’enveloppe n’est keyé par CHAMP : un concept champ-keyé est AVEUGLE à la forme', () => {
    // La preuve tient dans le seul concept champ-keyé du lexique : `prix` revendique TOUTE forme
    // posée sous `price`, jusqu'à la chaîne d'une règle optionnelle qui n'a rien d'un prix.
    expect(
      classerValeur('rule', ['rule'], { dataset: 'talents.json', champ: 'price' }),
      'un concept keyé par CHAMP classe par le NOM du porteur : il rendrait un verdict sur une forme qu’il n’a jamais vue.',
    ).toMatchObject({ concept: 'prix', statut: 'divergente' });
    expect(
      documents.filter((c) => c.champs?.length).map((c) => c.id),
      'un concept d’ENVELOPPE keyé par champ volerait toute forme posée sous ce nom (`talents.json › when {rule}`, une RÉFÉRENCE, tomberait sous `condition`) — le noyau de clés REQUISES est la seule reconnaissance admise.',
    ).toEqual([]);
    expect(documents.every((c) => (c.noyau?.length ?? 0) > 0), 'un concept d’enveloppe sans noyau ne reconnaît rien.').toBe(true);
  });

  it('B — les noyaux d’enveloppe ne DÉBORDENT pas : les sites classés sont exactement ceux-ci', () => {
    const sites = scan.formes
      .filter((f) => f.strate === 'Document')
      .map((f) => `${f.concept} | ${f.dataset} › ${f.champ} | ${f.signature}`);
    expect(
      lignes(sites),
      'un noyau d’enveloppe a mordu ailleurs que sur sa porte (ou l’a lâchée) — un concept qui déborde est le débordement global que le DoD interdit, et il se NOMME ici avant de se déclarer.',
    ).toEqual(
      lignes([
        'narratif | arene-projet.json › narratif | affaires,indices,objets,presetsPnj',
        'narratif | loup-et-saumure-projet.json › narratif | affaires,indices,objets,presetsPnj',
        'narratif | barge-du-sel-projet.json › narratif | affaires,indices,objets,presetsPnj+…',
        'narratif | diligence-projet.json › narratif | affaires,indices,objets,presetsPnj+…',
        'ouverture | barge-du-sel-projet.json › ouverture | pitch,titre+…',
        'ouverture | diligence-projet.json › ouverture | pitch,titre+…',
        'cloture | barge-du-sel-projet.json › cloture | titre,when+…',
        'cloture | diligence-projet.json › cloture | titre,when+…',
        'condition | arene-projet.json › when | expr,kind',
        'condition | barge-du-sel-projet.json › when | expr,kind',
        'condition | diligence-projet.json › when | expr,kind',
        'condition | loup-et-saumure-projet.json › when | expr,kind',
        // SEUL débordement, et il est LÉGITIME : une Condition posée sous `cond` reste une Condition
        // — c'est le noyau qui la reconnaît, pas le nom du champ (cf. sonde A).
        'condition | loup-et-saumure-projet.json › cond | expr,kind',
      ]),
    );
    expect(
      scan.formes.filter((f) => f.strate === 'Document' && f.statut !== 'cible').map((f) => `${f.dataset} › ${f.champ} | ${f.signature}`),
      'une enveloppe classée hors de sa forme CIBLE : sa porte zod déclare ces clés, le lexique doit dire laquelle.',
    ).toEqual([]);
  });

  it('C — `CLES_DE_VALEUR` ignore les noyaux d’ENVELOPPE (sinon `tellsDeDocument` perd ses tells)', () => {
    // `tellsDeDocument` (`structures-scan.mts`) compte les clés de CHARGE UTILE d'un objet, hors
    // graphie de référence, hors `CLES_DE_VALEUR`, hors enveloppe : ≥ 2 = document embarqué. Verser
    // les noyaux d'enveloppe dans ce vocabulaire y retire des clés aussi courantes que `kind`.
    // MESURÉ (sonde jetable, 2026-09-01, sur les 2 racines) : 44 objets changent alors de TELL, tous
    // de la même forme — les PIONS de scène `{id, kind, label, pos, ref}`, dont `kind` cesse de
    // compter comme charge utile. Aucun compte mesuré ne bouge aujourd'hui (le tell ne tranche que
    // face à `siteDeReference`) : cette séparation est un verrou PAR CONSTRUCTION, et c'est
    // précisément pourquoi elle a besoin de cette sonde-ci — aucune égalité de stock ne la couvre.
    const noyauxEnveloppe = [...new Set(CONCEPTS.filter((c) => c.strate === 'Document').flatMap((c) => c.noyau ?? []))];
    expect(noyauxEnveloppe.length, 'la strate `Document` ne déclare plus de noyau : la sonde ne mesure rien.').toBeGreaterThan(0);
    expect(
      noyauxEnveloppe.filter((k) => CLES_DE_VALEUR.has(k)),
      '`CLES_DE_VALEUR` dérive de la STRATE (`Valeur`), jamais du filtre de résolution : une clé d’enveloppe qui y entre est retirée de la charge utile de `tellsDeDocument`.',
    ).toEqual([]);
  });

  /**
   * PILOTE du scan AMPUTÉ, exécuté dans un PROCESSUS SÉPARÉ. `CONCEPTS_CLASSABLES`
   * (`scripts/docs/lib/structures-scan.mts:198`) est dérivé À L’ÉVALUATION du module : retirer un
   * concept après coup n’atteint pas le scan déjà chargé, et le mock de module est INTERDIT tant que
   * la suite partage son graphe (`src/vi-mock-isolate-guard.test.ts`, `isolate: false`). Le
   * sous-processus est donc la seule amputation qui ne laisse RIEN derrière elle : il meurt avec sa
   * mutation. La QUERY sur le second import donne au scan une identité de module neuve — il se
   * ré-évalue et relit `CONCEPTS` amputé.
   */
  const PILOTE_DIFF_STRATE = [
    "import { pathToFileURL } from 'node:url';",
    "import { join } from 'node:path';",
    'const R = process.cwd();',
    "const url = (p) => pathToFileURL(join(R, p)).href;",
    "const SCAN = url('scripts/docs/lib/structures-scan.mjs');",
    "const lexique = await import(url('scripts/docs/lib/structures-lexique.mjs'));",
    "const { defsDeDocument } = await import(url('scripts/docs/lib/slots-registre.mjs'));",
    "const { choixDeclares, introspecterDefs } = await import(url('scripts/docs/lib/zod-introspect.mjs'));",
    'const defs = defsDeDocument();',
    'const familles = new Map(introspecterDefs(defs).map((d) => [d.file, d.famille]));',
    'const choix = choixDeclares(defs);',
    'const avec = (await import(SCAN)).scannerDonnees(R, familles, choix);',
    "const retires = lexique.CONCEPTS.filter((c) => c.strate === 'Document');",
    'for (const c of retires) lexique.CONCEPTS.splice(lexique.CONCEPTS.indexOf(c), 1);',
    "const sans = (await import(SCAN + '?sansDocument')).scannerDonnees(R, familles, choix);",
    "const site = (x) => x.dataset + ' › ' + x.champ;",
    "const kf = (f) => f.concept + ' | ' + site(f) + ' | ' + f.signature + ' | ' + f.occurrences;",
    "const ki = (i) => site(i) + ' | ' + i.signature + ' | ' + i.occurrences;",
    "const ko = (o) => site(o) + ' | ' + o.signature + ' | ' + o.motif + ' | ' + o.occurrences;",
    'const seuls = (a, b, k) => a.filter((x) => !b.some((y) => k(y) === k(x))).map(k).sort();',
    "process.stdout.write('<<<DIFF>>>' + JSON.stringify({",
    '  retires: retires.map((c) => c.id).sort(),',
    '  comptes: { formes: avec.formes.length, invisibles: avec.invisibles.length, orphelines: avec.orphelines.length },',
    '  formesGagnees: seuls(avec.formes, sans.formes, kf),',
    '  formesVolees: seuls(sans.formes, avec.formes, kf),',
    '  invisiblesEteintes: seuls(sans.invisibles, avec.invisibles, ki),',
    '  invisiblesNees: seuls(avec.invisibles, sans.invisibles, ki),',
    '  orphelinesEteintes: seuls(sans.orphelines, avec.orphelines, ko),',
    '  orphelinesNees: seuls(avec.orphelines, sans.orphelines, ko),',
    "}));",
  ].join('\n');

  /**
   * D — le non-débordement se prouve par DIFF, pas par liste. La sonde B verrouille les sites
   * classés `Document` ; elle ne dit RIEN de ce que ces noyaux auraient PRIS aux strates
   * `Valeur`/`Référence` — une forme volée disparaîtrait de son concept d’origine sans qu’aucune
   * égalité de stock ne bouge (les lignes volées seraient simplement absentes des deux côtés).
   * Ici on mesure les DEUX scans et on exige : ce que la strate `Document` gagne, elle le prend à ce
   * qui n’était CLASSÉ PAR PERSONNE (invisibles + orphelines), jamais à un concept existant.
   * COÛT MESURÉ (2026-09-01, cette machine) : ~3 s — démarrage `tsx` ~1,7 s + DEUX scans à ~0,6 s.
   */
  it('D — DIFF avec/sans la strate `Document` : ce qu’elle gagne vient du NON-CLASSÉ, zéro forme VOLÉE', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'structures-strate-'));
    try {
      const pilote = join(dossier, 'diff-strate-document.mjs');
      writeFileSync(pilote, PILOTE_DIFF_STRATE, 'utf8');
      const sortie = execFileSync(process.execPath, ['--import', 'tsx', pilote], { cwd: ROOT, encoding: 'utf8' }).split('<<<DIFF>>>');
      const diff = JSON.parse(sortie[sortie.length - 1]) as {
        retires: string[];
        comptes: { formes: number; invisibles: number; orphelines: number };
        formesGagnees: string[];
        formesVolees: string[];
        invisiblesEteintes: string[];
        invisiblesNees: string[];
        orphelinesEteintes: string[];
        orphelinesNees: string[];
      };

      // Le pilote a bien amputé CE QUE le lexique déclare aujourd'hui, et il a mesuré LE MÊME arbre
      // que le scan en mémoire — sans ces deux ancrages, le diff comparerait deux inconnues.
      expect(diff.retires, 'le pilote n’a pas retiré les concepts d’ENVELOPPE que le lexique déclare.').toEqual(
        lignes(documents.map((c) => c.id)),
      );
      expect(
        diff.comptes,
        'le scan du sous-processus ne mesure pas le même arbre que celui du fichier : le diff ne prouverait rien.',
      ).toEqual({ formes: scan.formes.length, invisibles: scan.invisibles.length, orphelines: scan.orphelines.length });

      expect(
        diff.formesVolees,
        'une forme classée SANS la strate `Document` disparaît AVEC elle : un noyau d’enveloppe a VOLÉ des objets à un concept de `Valeur`/`Référence` — c’est le débordement global que le DoD interdit.',
      ).toEqual([]);
      expect(
        diff.formesGagnees,
        'les formes que la strate `Document` ajoute ne sont pas exactement celles que le scan lui compte.',
      ).toEqual(lignes(scan.formes.filter((f) => f.strate === 'Document').map((f) => `${f.concept} | ${f.dataset} › ${f.champ} | ${f.signature} | ${f.occurrences}`)));

      // La CONTREPARTIE : chaque gain sort du NON-CLASSÉ. 12 lignes d'invisibles s'éteignent (les
      // objets qu'aucun concept ne reconnaissait) et 1 orpheline (`diligence-projet.json › ouverture`,
      // dont la clé `source` déclenchait le motif `clé réservée`) — la projection réunit les deux
      // buckets qu'un optionnel peuplé séparait. Somme = les gains, à l'unité près.
      expect(diff.invisiblesNees, 'la strate `Document` rend un objet INVISIBLE : elle en perd un au lieu d’en classer.').toEqual([]);
      expect(diff.orphelinesNees, 'la strate `Document` fabrique une ORPHELINE : elle en perd une au lieu d’en classer.').toEqual([]);
      expect(
        diff.orphelinesEteintes,
        'l’orpheline soldée par la strate `Document` n’est plus celle que le stock nomme (`structuresStock.mjs`, en-tête des concepts d’enveloppe).',
      ).toEqual(['diligence-projet.json › ouverture | ambiance,chapitre,pitch,source,sousTitre,surtitre,titre | clé réservée | 1']);
      expect(
        diff.invisiblesEteintes.length + diff.orphelinesEteintes.length,
        'le compte ne se referme plus : un gain de la strate `Document` ne vient ni d’un invisible ni d’une orpheline — il vient donc d’ailleurs.',
      ).toBe(diff.formesGagnees.length);
      const sitesDocument = new Set(scan.formes.filter((f) => f.strate === 'Document').map((f) => `${f.dataset} › ${f.champ}`));
      expect(
        lignes(diff.invisiblesEteintes.filter((l) => !sitesDocument.has(l.split(' | ')[0]))),
        'un invisible s’est éteint sur un SITE que la strate `Document` ne classe pas : l’extinction déborde des portes.',
      ).toEqual([]);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe('l’enveloppe : ce qu’un document doit porter (contrats positifs)', () => {
  const cle = (c: string, classe: string, n: number) => ({ cle: c, n, parClasse: [{ classe, n }] });

  it('une ENTRÉE DE RACINE sans `id`/`type`/`label`/`source` sort en divergences ; conforme, elle sort vide', () => {
    const neuf = mesurerEnveloppe([
      { document: 'neuf.json', chemin: '(entrées)', portee: 'racine', famille: 'entité', nbEntrees: 3, cles: [cle('code', 'string', 3), cle('nom', 'string', 3)] },
    ]);
    expect(neuf.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | id | clé absente',
      'identité | nom | clé divergente',
      'libellé | label | clé absente',
      'libellé | nom | clé divergente',
      'source | source | clé absente',
      'type de document | type | clé absente',
    ]);
    const conforme = mesurerEnveloppe([
      {
        document: 'ok.json',
        chemin: '(entrées)',
        portee: 'racine',
        famille: 'entité',
        nbEntrees: 3,
        cles: [cle('id', 'string', 3), cle('type', 'string', 3), cle('label', 'string', 3), cle('desc', 'string', 3), cle('source', 'object', 3)],
      },
    ]);
    expect(conforme).toEqual([]);
  });

  /**
   * La PROVENANCE est une ALTERNATIVE dans la grammaire — `source` OU `maison`, jamais ni l'un ni
   * l'autre (`src/data/schemas/grammaire/document.ts:402-413`). Le lexique la mesure comme telle :
   * un document maison est CONFORME, un document qui ne dit RIEN reste au dénominateur.
   */
  it('le rôle `source` est satisfait par son ALTERNATIVE `maison` — mais rien ne remplace les deux', () => {
    const groupe = (doc: string, provenance: ReturnType<typeof cle>[]) => ({
      document: doc, chemin: '(entrées)', portee: 'racine' as const, famille: 'entité', nbEntrees: 2,
      cles: [cle('id', 'string', 2), cle('type', 'string', 2), cle('label', 'string', 2), ...provenance],
    });
    const provenance = (doc: string, cles: ReturnType<typeof cle>[]) =>
      mesurerEnveloppe([groupe(doc, cles)]).map((e) => `${e.role} | ${e.cle} | ${e.motif}`);

    expect(provenance('folio.json', [cle('source', 'object', 2)]), 'la CIBLE satisfait le rôle.').toEqual([]);
    expect(provenance('maison.json', [cle('maison', 'string', 2)]), 'l’ALTERNATIVE le satisfait aussi.').toEqual([]);
    expect(provenance('muet.json', []), 'ni folio ni arbitrage : le document reste au dénominateur.').toEqual([
      'source | source | clé absente',
    ]);
  });

  /**
   * Le rôle `type de document` est `entiere` : c'est ce qui le rend mesurable SOUS l'entrée de
   * racine. Un document embarqué qui s'annonce (`type: 'scene'`, `type: 'statblock'`) l'annonce sur
   * TOUTES ses entrées — une seule qui ne le porte pas est nommée, portée embarquée comprise.
   */
  it('le `type` d’un document se porte ENTIER : une portée qui l’annonce à moitié est nommée', () => {
    const scenes = (porteuses: number, n: number) => [
      { document: 'projet.json', chemin: 'scenes', portee: 'embarqué' as const, famille: 'entité', nbEntrees: n, cles: [cle('id', 'string', n), cle('label', 'string', n), cle('type', 'string', porteuses)] },
    ];
    expect(
      mesurerEnveloppe(scenes(18, 18)).map((e) => `${e.role} | ${e.cle} | ${e.motif}`),
      'les 18 scènes s’annoncent : rien à mesurer.',
    ).toEqual([]);
    expect(
      mesurerEnveloppe(scenes(17, 18)).map((e) => `${e.role} | ${e.cle} | ${e.motif}:${e.detail} | ${e.entrees}`),
      'une scène qui ne s’annonce plus est NOMMÉE, avec le compte des portées manquantes.',
    ).toEqual(['type de document | type | cible partielle:17/18 | 1']);
    expect(
      mesurerEnveloppe([{ document: 'flow.json', chemin: 'steps', portee: 'embarqué', famille: 'entité', nbEntrees: 4, cles: [cle('id', 'string', 4)] }]),
      'un document embarqué qui n’annonce AUCUN type n’est sommé de rien : `entiere` mesure ce qui est là.',
    ).toEqual([]);
  });

  it('un document EMBARQUÉ n’est sommé de rien : seules ses clés DIVERGENTES comptent', () => {
    const embarque = mesurerEnveloppe([
      { document: 'flow.json', chemin: 'steps[].effect', portee: 'embarqué', famille: 'entité', nbEntrees: 5, cles: [cle('text', 'string', 5), cle('nom', 'string', 5), cle('title', 'string', 5), cle('type', 'string', 5)] },
    ]);
    // `title` est la forme CIBLE de son rôle (sous-titre) : il ne compte pas — seules `text` et `nom`,
    // graphies divergentes de la prose et du libellé, sont relevées.
    expect(embarque.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | nom | clé divergente',
      'libellé | nom | clé divergente',
      'prose | text | clé divergente',
    ]);
  });

  it('le rôle PROSE ne voit que ses divergentes DÉCLARÉES — une graphie hors lexique lui échappe', () => {
    const groupe = (doc: string, c: string) => ({
      document: doc, chemin: '(entrées)', portee: 'racine' as const, famille: 'entité' as const, nbEntrees: 2,
      cles: [cle('id', 'string', 2), cle('label', 'string', 2), cle('source', 'object', 2), cle(c, 'string', 2)],
    });
    const prose = (doc: string, c: string) =>
      mesurerEnveloppe([groupe(doc, c)]).filter((e) => e.role === 'prose').map((e) => `${e.cle} | ${e.motif}`);

    expect(prose('divergente.json', 'text'), 'une divergente DÉCLARÉE est mesurée.').toEqual(['text | clé divergente']);
    expect(prose('cible.json', 'desc'), 'la CIBLE du rôle n’est pas une divergence.').toEqual([]);
    // La mesure ne voit que ses divergentes déclarées — une graphie hors lexique lui échappe.
    // La clé sonde est FORGÉE pour n'entrer JAMAIS au lexique : une graphie plausible (`texte`) ferait
    // rougir cette assertion le jour où elle y entrerait, et l'angle mort disparaîtrait de la mesure.
    expect(prose('inconnue.json', 'proseInconnueSonde')).toEqual([]);
  });

  it('l’enveloppe descend sous l’entrée : un document EMBARQUÉ est mesuré sous son chemin', () => {
    const embarques = scan.groupesEnveloppe.filter((g) => g.portee === 'embarqué');
    expect(embarques.length, 'aucun document embarqué mesuré — la borne de profondeur est revenue.').toBeGreaterThan(0);
    expect(
      scan.groupesEnveloppe.filter((g) => g.portee === 'racine').length,
      'les entrées de racine et les documents embarqués se comptent SÉPARÉMENT.',
    ).toBe(scan.documents.length);
  });

  it('§5 : les Conditions retirées du compte d’ops sont celles qui PORTAIENT un `op`', () => {
    // #862 : +3 ops authorées (re-ciblage `[removeTrait, grantTrait]` de Haine sporadique, État Exténué
    // du réveil du Désespoir).
    // #674 : +2 ops authorées (`aggravateSymptom` + son échelon `grantSymptom`, cycle quotidien de la
    // Pneumonie, EDOC 08 l.104-108).
    // #1657 B2a : +70 ops authorées — la colonne « Blessures » d'Aux Armes (AA 07 l.40) était
    // construite en TypeScript (`{op:'wounds', amount}` fabriqué au vol par l'ancien lecteur AA) ;
    // elle descend en DONNÉE avec sa mitigation écrite. 70 rangées la portent (les 6 autres valent
    // « T » et ne posent aucune op).
    // #1657 B3-2b-a : +6 ops authorées — les 6 rangées MDG dont le Test ne vivait qu'en prose `note`
    // (MDG 13 l.730/734/736/738/751/756) posent chacune l'État À Terre de leur échec ; le coup certain
    // du Gouvernail fluvial (MSRC 07 l.86) troque son `shrapnel: 1` contre une op `wounds`, à somme
    // nulle sur ce compte (l'op naît, l'Indice n'en était pas une).
    // #1657 B3-2b-c : +5 ops `fall` (MDG 13 l.678-688) — les 5 rangées du gréement font TOMBER, et la
    // hauteur se lit dans la table par (Taille de coque × station), jamais authorée au site.
    // #1653 train A : +1 op authorée — la CAUSE récurrente de « Purifier la chair » (LDB 40 l.75) est une
    // seconde op `condition` de la même rangée, pas un champ de plus sur la première.
    // #1661 : +1 op authorée — le 2ᵉ État Hémorragique de Taillade (`AA 08 l.87`), MÊME op `condition`
    // que l'État automatique du Critique, portée par la branche `yes` du choix.
    // #1599 : +2 ops authorées — les États PORTÉS par un canal passif s'écrivent en DONNÉE : l'État
    // *Inconscient* du palier Grave de la Fièvre (LDB 20 l.170) et l'État *Exténué* du Malaise (l.188),
    // qui cessent d'être des drapeaux nommés dans le moteur. Le palier S'AJOUTANT à `passive` au lieu de
    // le remplacer, aucune pénalité n'est recopiée : les 6 charMod de `severePassive` se DÉPLACENT vers
    // `passiveBySeverity.moderee`, le total ne les compte pas deux fois.
    // #1612 (2026-09-06) : 2272 → 2279 — +7 objets à `op`, tous posés par Mendier et sa table MAISON.
    // Côté `activities.json` : 2 `money` (le gain horaire, le sou de consolation), 1 `rollTable` (la
    // bande d'Échec Stupéfiant renvoie aux ennuis), 1 `statusMod` (« surpris à mendier », `l.99`).
    // Côté `tables.json` : 1 `money` (l'AMENDE des gardes locaux — `LDB 09 l.97` nomme l'ennui sans le
    // chiffrer, le montant vit en règle optionnelle `mendier-amende-sous`), 1 `condition` et 1 `wounds`
    // (la rançon des autres mendiants).
    expect(scan.totalConditionsAvecOp + scan.totalOps, 'objets portant un `op` = ops de jeu + Conditions à `op`.').toBe(2279);
    // #684 L4+solde : +2 Conditions sans `op` — le MÊME drapeau de révélation d'Altdorf porté par ses
    // deux axes sur la carte du chapitre 1 : le `when` du LIEU et le `when` de la ROUTE.
    // #717 : +1 Condition sans `op` — le `when` de la CLÔTURE du chapitre 1 (`narratif.cloture`), le
    // MÊME drapeau de révélation d'Altdorf que les deux axes de carte ci-dessus, sur un troisième
    // porteur : le fait de donnée qui dit « le chapitre se ferme ».
    // #684+#717 sur « La Barge du Sel » : +3 Conditions sans `op` — les MÊMES trois porteurs, un
    // chapitre plus loin (le `when` du LIEU de l'îlot et celui de sa ROUTE, sur le drapeau du cap ;
    // le `when` de la CLÔTURE, sur le drapeau d'accostage).
    // #1612 (2026-09-06) : +3 Conditions sans `op` — celles de l'Activité Mendier : le `when`
    // `visiblePassive` de son modificateur d'apparence, et les DEUX nœuds de l'exemption de son dé de
    // monde (`not` + le `status` qu'il enveloppe, `LDB 09 l.99`).
    expect(scan.totalConditionsSansOp, 'des Conditions sans `op` n’ont jamais été comptées en op : elles ne se « retirent » pas.').toBe(194);
  });
});

describe('`{text}` : la forme DÉCLARÉE ne couvre que l’irréductible narratif (#1463 L0, #624)', () => {
  const forme = (source: typeof scan, signature: string) =>
    source.formes.find(
      (f) => f.concept === 'reference' && f.dataset === 'careerLevels.json' && f.champ === 'trappings' && f.signature === signature,
    );

  it('un `{text}` qui nomme une POSSESSION est `text (résolvable)` ; « Sa Honte » et « Assistant » restent `text` declaree (#1463 L-ref-0)', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-text-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const temoin = scannerDonnees(copie, FAMILLES, CHOIX);
      expect(temoin.formes.length, 'la COPIE non mutée ne mesure pas comme l’arbre.').toBe(scan.formes.length);
      expect(forme(temoin, 'text'), 'la forme `text` déclarée a disparu du témoin.').toMatchObject({ statut: 'declaree' });
      expect(
        forme(temoin, 'text (résolvable)'),
        'aucune dotation de `careerLevels` ne doit être résolvable AU REPOS : les 49 qui nommaient une possession sont liées (L-ref-1).',
      ).toBeUndefined();

      const chemin = join(copie, 'src/data/careerLevels.json');
      const niveaux = JSON.parse(readFileSync(chemin, 'utf8')) as Array<Record<string, unknown>>;
      // « Dague » EST le `label` du trapping `dague` — la cible MAJORITAIRE du site. « Sa Honte »
      // n’est le libellé d’aucune entité. « Assistant » est le `label` d’un NIVEAU DE CARRIÈRE
      // (`careerLevels.json`) et de RIEN dans `trappings.json` : ce n’est pas une possession, et
      // c’est le contrôle NÉGATIF de la résolution scopée au site (avant #1463 L-ref-0, il comptait
      // résolvable — la mesure acceptait n’importe quel dataset).
      niveaux[0].trappings = [
        ...(niveaux[0].trappings as unknown[]),
        { text: 'Dague' },
        { text: 'Sa Honte' },
        { text: 'Assistant' },
      ];
      writeFileSync(chemin, JSON.stringify(niveaux), 'utf8');
      const apres = scannerDonnees(copie, FAMILLES, CHOIX);

      expect(
        forme(apres, 'text (résolvable)')?.occurrences,
        '`{text:"Dague"}` sous `trappings` doit être classé `text (résolvable)` : un texte qui résout vers le `label` d’une POSSESSION est une référence à migrer en `{id}` (#624), pas du narratif déclaré.',
      ).toBe(1);
      expect(
        forme(apres, 'text')!.occurrences - forme(temoin, 'text')!.occurrences,
        '`{text:"Sa Honte"}` et `{text:"Assistant"}` doivent rester la forme `text` DECLARÉE : l’irréductible narratif ne se migre pas, et un homonyme d’un AUTRE dataset n’est pas une dotation.',
      ).toBe(2);
      expect(
        forme(apres, 'text (résolvable)')!.cibles,
        'la forme résolvable doit IMPRIMER le dataset où le libellé a été trouvé.',
      ).toEqual(['trappings.json']);
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

describe('contrôle POSITIF côté DONNÉE : le détecteur MORD (#1465 F21)', () => {
  it('trois dérives injectées dans une COPIE de l’arbre sont VUES : forme neuve, orpheline neuve, op neuve', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-contrat-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const temoin = scannerDonnees(copie, FAMILLES, CHOIX);
      const cleF = (f: { concept: string; dataset: string; champ: string; signature: string; statut: string; occurrences: number }) =>
        `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.occurrences}`;
      const cleO = (o: { dataset: string; champ: string; signature: string; motif: string }) =>
        `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif}`;
      const cleOpSonde = (o: { op: string; signature: string; dataset: string }) => `${o.op} | ${o.signature} | ${o.dataset}`;
      expect(
        temoin.formes.length,
        'la COPIE non mutée ne mesure pas comme l’arbre : le contrôle positif ne prouverait rien.',
      ).toBe(scan.formes.length);

      const chemin = join(copie, 'src/data/axes.json');
      const axes = JSON.parse(readFileSync(chemin, 'utf8')) as Array<Record<string, unknown>>;
      axes[0].sondes = [{ skillIdent: 'athletisme', poids: 3 }]; // graphie de référence NEUVE
      axes[0].opsSonde = [{ op: 'sondeJuge', talentId: 'affable', valeur: 1 }]; // op NEUVE à ref à plat
      axes[0].casses = [{ machinId: 'ceci-n-existe-pas' }]; // FK morte : clé …Id qui ne résout vers rien
      writeFileSync(chemin, JSON.stringify(axes), 'utf8');

      const apres = scannerDonnees(copie, FAMILLES, CHOIX);
      const formesNeuves = apres.formes.filter((f) => !temoin.formes.some((g) => cleF(g) === cleF(f))).map(cleF);
      const orphelinesNeuves = apres.orphelines.filter((o) => !temoin.orphelines.some((q) => cleO(q) === cleO(o))).map(cleO);
      const opsNeuves = apres.ops.filter((o) => !temoin.ops.some((q) => cleOpSonde(q) === cleOpSonde(o))).map(cleOpSonde);

      expect(formesNeuves, 'une GRAPHIE de référence neuve (`skillIdent`) n’est pas vue : le stock ne mordrait pas.').toContain(
        'reference | axes.json | sondes | skillIdent+… | divergente | 1',
      );
      expect(orphelinesNeuves, 'une FK morte (`machinId`) n’est pas vue : le motif `clé de référence non résolue` serait inatteignable.').toContain(
        'axes.json | casses | machinId | clé de référence non résolue',
      );
      expect(opsNeuves, 'une op NEUVE à ref à plat n’est pas vue : le dénominateur de la strate Ops serait aveugle.').toContain(
        'sondeJuge | op,talentId,valeur | axes.json',
      );
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

/**
 * MORSURE du régime `valeurs` sur un record ENVELOPPÉ (#1467 L1b V-FLIP-RECORD). Un record porte
 * son enveloppe (`id`/`type`/`label`) et sa carte sous `entries` : le scan doit DESCENDRE
 * dans `entries` pour indexer les vraies clés. Sans cette descente, l'index reçoit `id`/`type`/`label`/
 * `entries` — les clés du record disparaîtraient de l'index des ids, en silence.
 */
describe('régime `valeurs` : le scan descend dans `entries` d’un record ENVELOPPÉ', () => {
  it('une clé d’`entries` entre à l’index (collision avec `teintesJeu.json`) ; l’enveloppe n’y entre pas', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-record-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      // Record ENVELOPPÉ sonde : sa seule clé de charge est celle d'une teinte réelle — le scan doit
      // donc voir une COLLISION d'id entre les deux documents.
      writeFileSync(
        join(copie, 'src/data/sonde-record.json'),
        JSON.stringify({ id: 'sonde-record', type: 'sondeRecord', label: 'Sonde record', entries: { 'zone-marche': '#123456' } }),
        'utf8',
      );
      const famillesSonde = new Map([...FAMILLES, ['sonde-record.json', 'record']]);
      const apres = scannerDonnees(copie, famillesSonde, CHOIX);
      const collision = apres.index.collisions.find((c) => c.id === 'zone-marche');
      expect(collision?.datasets, 'la clé d’`entries` n’est pas indexée : le régime `valeurs` n’est pas descendu sous l’enveloppe.').toEqual([
        'sonde-record.json',
        'teintesJeu.json',
      ]);
      expect(
        apres.index.collisions.filter((c) => ['entries', 'label', 'type'].includes(c.id)).map((c) => c.id),
        'les clés d’ENVELOPPE sont entrées à l’index comme des ids de record.',
      ).toEqual([]);
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

/**
 * LES TROIS CONTREFACTUELS DE REDÉCLARATION — un seul sous-processus, trois verdicts (#1654,
 * #1463 L-gram-3).
 *
 * SOUS-PROCESSUS + racines SÉPARÉES, obligatoires : les caches de parse du scanner (`CACHE_SOURCE`,
 * `CACHE_LITTERAUX`, `scripts/docs/lib/structures-scan.mts`) sont module-level et ne sont JAMAIS
 * invalidés (angle mort déclaré au lexique) — une mutation mesurée dans le processus de la suite,
 * ou sur la MÊME racine, mesurerait le premier état lu et mentirait.
 *
 * Ce qui se BATCHE : le pilote est le même scan, et la racine `avant` est la même copie des defs +
 * de la grammaire pour les trois — trois `tsx` (~1,7 s de démarrage chacun) et trois scans de
 * `avant` rendaient trois fois les mêmes chiffres. Ce qui reste TROIS contrats : les `apres` sont
 * des mutations DISTINCTES (une def de sonde injectée ; `avail` re-tapé ; `price` re-tapé), chacune
 * sur sa racine, et chaque `it` lit SON verdict.
 */
type VerdictRedecl = {
  avant: number; apres: number; litterauxAvant: number; litterauxApres: number; nees: string[]; perdues: string[];
};

/** Le littéral INJECTÉ : une re-déclaration des deux bornes, que `plageSchema` possède déjà. */
const SONDE_DEF = [
  "import { z } from 'zod';",
  'export const sondeMutationSchema = z.strictObject({ min: z.number(), max: z.number() });',
].join('\n');

/** Le littéral à quatre saisons, tel que les deux defs l'écrivaient avant `parSaison`. */
const SAISONS = (valeur: string) =>
  `z.strictObject({ printemps: ${valeur}, ete: ${valeur}, automne: ${valeur}, hiver: ${valeur} })`;

/** Une contrefaçon RE-TAPÉE dans les deux defs de commerce d'une racine (`defs` = son dossier). */
const reTape = (remplace: (source: string) => string) => (defs: string) => {
  for (const def of ['sea-cargo.ts', 'land-cargo.ts']) {
    const chemin = join(defs, def);
    writeFileSync(chemin, remplace(readFileSync(chemin, 'utf8')), 'utf8');
  }
};

/** Les trois mutations, chacune posée sur SA racine `apres`. La clé nomme le verdict. */
const MUTATIONS: Record<string, (defs: string) => void> = {
  sonde: (defs) => writeFileSync(join(defs, 'sonde-mutation.ts'), SONDE_DEF, 'utf8'),
  cfAvail: reTape((source) => source.replace('avail: dispoSaisonniereSchema,', `avail: ${SAISONS('plageSchema')},`)),
  cfPrix: reTape((source) =>
    source.replace(
      'price: z.union([prixSaisonnierSchema, prixTireSchema]),',
      `price: z.union([${SAISONS('z.number()')}, z.strictObject({ dice: diceSpecSchema })]),`,
    ),
  ),
};

const PILOTE_REDECL = [
  "import { pathToFileURL } from 'node:url';",
  "import { join } from 'node:path';",
  'const [avantRoot, ...variantes] = process.argv.slice(2);',
  "const SCAN = pathToFileURL(join(process.cwd(), 'scripts/docs/lib/structures-scan.mjs')).href;",
  'const { scannerRedeclarations } = await import(SCAN);',
  "const cle = (r) => r.def + ' | ' + (r.champ || '(racine)') + ' | ' + r.signature + ' | ' + r.concept + ' | ' + r.statut + ' | ' + r.commun;",
  'const avant = scannerRedeclarations(avantRoot);',
  'const clesAvant = avant.redeclarations.map(cle);',
  'const out = {};',
  'for (const v of variantes) {',
  "  const coupe = v.indexOf('=');",
  '  const apres = scannerRedeclarations(v.slice(coupe + 1));',
  '  const clesApres = apres.redeclarations.map(cle);',
  '  out[v.slice(0, coupe)] = {',
  '    avant: avant.redeclarations.length,',
  '    apres: apres.redeclarations.length,',
  '    litterauxAvant: avant.totalLitteraux,',
  '    litterauxApres: apres.totalLitteraux,',
  '    nees: clesApres.filter((k) => !clesAvant.includes(k)).sort(),',
  '    perdues: clesAvant.filter((k) => !clesApres.includes(k)).sort(),',
  '  };',
  '}',
  "process.stdout.write('<<<DIFF>>>' + JSON.stringify(out));",
].join('\n');

let verdictsRedecl: Record<string, VerdictRedecl> | undefined;
let dossierRedecl: string | undefined;
afterAll(() => {
  if (dossierRedecl) rmSync(dossierRedecl, { recursive: true, force: true });
});

/** Le verdict d'UNE mutation. Le pilote est joué au premier appel, une fois pour le run. */
function verdictRedecl(nom: string): VerdictRedecl {
  if (!verdictsRedecl) {
    const dossier = (dossierRedecl = mkdtempSync(join(tmpdir(), 'structures-redecl-')));
    for (const racine of ['avant', ...Object.keys(MUTATIONS)]) {
      for (const sous of ['defs', 'grammaire']) {
        cpSync(join(ROOT, 'src/data/schemas', sous), join(dossier, racine, 'src/data/schemas', sous), { recursive: true });
      }
    }
    for (const [cle, muter] of Object.entries(MUTATIONS)) muter(join(dossier, cle, 'src/data/schemas/defs'));
    const pilote = join(dossier, 'pilote.mjs');
    writeFileSync(pilote, PILOTE_REDECL, 'utf8');
    const sortie = execFileSync(
      process.execPath,
      ['--import', 'tsx', pilote, join(dossier, 'avant'), ...Object.keys(MUTATIONS).map((cle) => `${cle}=${join(dossier, cle)}`)],
      { cwd: ROOT, encoding: 'utf8' },
    ).split('<<<DIFF>>>');
    verdictsRedecl = JSON.parse(sortie[sortie.length - 1]) as Record<string, VerdictRedecl>;
  }
  return verdictsRedecl[nom]!;
}

/**
 * CONTRÔLE POSITIF du scan AST des redéclarations (#1654) — le détecteur MORD.
 *
 * Le stock `STRUCTURES_REDECLARATIONS` est un dénominateur DÉCROISSANT : à zéro, plus rien ne
 * distinguerait « aucune redéclaration » de « le scanner ne voit plus rien ». Cette sonde INJECTE une
 * redéclaration dans une COPIE de `src/data/schemas/` et exige que le compte passe N → N+1 avec une
 * ligne NOMINATIVE.
 */
describe('scannerRedeclarations — contrôle POSITIF du détecteur (#1654)', () => {
  it('une redéclaration INJECTÉE dans une copie des defs est VUE — N → N+1, ligne nominative', () => {
    const diff = verdictRedecl('sonde');
    // La copie mesure le MÊME arbre que le scan du fichier : sans cet ancrage, le +1 ne prouverait rien.
    expect(diff.avant, 'la copie NON MUTÉE ne mesure pas le même arbre que `scannerRedeclarations(ROOT)`.').toBe(redeclarations.length);
    expect(diff.litterauxApres - diff.litterauxAvant, 'le littéral injecté n’a pas été LU par le scan.').toBe(1);
    expect(diff.apres - diff.avant, 'la redéclaration injectée n’est pas COMPTÉE : le détecteur ne mord plus.').toBe(1);
    expect(diff.nees, 'la ligne née n’est pas celle de la sonde, nominative.').toEqual([
      'sonde-mutation.ts | (racine) | max,min | plage | cible | plageSchema',
    ]);
    expect(diff.perdues, 'la copie a PERDU des redéclarations : la mutation n’est pas isolée.').toEqual([]);
  });
});


/**
 * CONTREFACTUEL du lot #1463 L-gram-3 — `parSaison` n'est pas un contournement de mesure.
 *
 * La décrue d'un stock de redéclarations est toujours suspecte : un nœud de grammaire inventé pour
 * UN porteur ferait DISPARAÎTRE la ligne sans que la structure change (le scan ne résout ni une
 * fabrique ni un spread). Ici c'est l'INVERSE qu'on prouve : si les deux defs de commerce RE-TAPAIENT
 * ce que la grammaire déclare — la colonne à quatre saisons (CF1) ou l'union de prix (CF2) —, le
 * scanner le VERRAIT, nominativement. Le lot a donc rendu 3 lignes parce que les littéraux ont
 * disparu, pas parce que la mesure s'est éteinte.
 */
describe('scannerRedeclarations — CONTREFACTUEL `parSaison` / `prix` (#1463 L-gram-3)', () => {
  it('CF1 — `avail` re-tapé à la place de `parSaison` : DEUX lignes naissent, nominatives', () => {
    const diff = verdictRedecl('cfAvail');
    expect(diff.avant, 'la copie NON MUTÉE ne mesure pas le même arbre que `scannerRedeclarations(ROOT)`.').toBe(redeclarations.length);
    expect(diff.perdues, 'la copie a PERDU des redéclarations : la contrefaçon n’est pas isolée.').toEqual([]);
    expect(diff.nees, 'un `avail` re-tapé n’est PAS vu : `parSaison` masquerait la mesure au lieu de la solder.').toEqual([
      'land-cargo.ts | avail | automne,ete,hiver,printemps |  | hors lexique | parSaison',
      'sea-cargo.ts | avail | automne,ete,hiver,printemps |  | hors lexique | parSaison',
    ]);
  });

  it('CF2 — l’union de `price` re-tapée à la place des deux nœuds de grammaire : les lignes du concept `prix` renaissent', () => {
    const diff = verdictRedecl('cfPrix');
    expect(diff.avant, 'la copie NON MUTÉE ne mesure pas le même arbre que `scannerRedeclarations(ROOT)`.').toBe(redeclarations.length);
    expect(diff.perdues, 'la copie a PERDU des redéclarations : la contrefaçon n’est pas isolée.').toEqual([]);
    expect(diff.nees, 'un `price` re-tapé n’est PAS vu : les deux nœuds `prix` masqueraient la mesure.').toEqual([
      'land-cargo.ts | price | automne,ete,hiver,printemps | prix | declaree | parSaison',
      'land-cargo.ts | price | dice | prix | declaree | prixTireSchema',
      'sea-cargo.ts | price | automne,ete,hiver,printemps | prix | declaree | parSaison',
      'sea-cargo.ts | price | dice | prix | declaree | prixTireSchema',
    ]);
  });
});
