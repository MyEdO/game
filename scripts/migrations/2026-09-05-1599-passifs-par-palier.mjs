/**
 * Migration #1599 — les passifs d'un symptôme s'indexent PAR PALIER, les États PORTÉS par un passif
 * s'écrivent en donnée AVEC leur fenêtre de résolution, et la *Gangrène* retrouve sa prose entière.
 *
 * Entrées : `src/data/symptoms.json` (lu ET écrit) — seul document du périmètre. La migration ne lit
 * aucun autre fichier : les textes RAW qu'elle pose sont des littéraux, chacun cité à sa ligne.
 *
 * QUATRE gestes, tous dictés par LDB 20 :
 *  1. `convulsions.severePassive` (6 ops à −20) → `passiveBySeverity.moderee`, magnitude INCHANGÉE —
 *     l.157 : « Subissez une pénalité de -10 à tous vos Tests Physiques … Si le symptôme est indiqué
 *     (Modéré), cette pénalité passe à -20. » Le palier S'AJOUTE désormais à `passive` au lieu de le
 *     remplacer, et le pool de `effectiveChar` (pire pénalité) retient −20 : la magnitude d'un palier
 *     reste donc ABSOLUE. Le champ `severePassive` s'appliquait dès `severity: 'moderee'` ET s'annonçait
 *     « Grave » : la clé DIT désormais son palier. `convulsions.maison` est posé dans le même geste —
 *     l.157 ne rechiffre pas (Grave), l'instance Grave porte donc les paliers ATTEINTS, soit −20.
 *  2. `fievre` gagne `passiveBySeverity.grave` = le SEUL État *Inconscient*, porteur de sa FENÊTRE de
 *     résolution (`resolveWindow` d'horloge, durée réglée par `maladie-conscience-determination-minutes`)
 *     — l.170 : « Subissez une pénalité de -10 … Si la fièvre dont vous souffrez est indiquée comme
 *     (Grave) […] Gagnez l'État *Inconscient*, même si la dépense de Points de Détermination peut vous
 *     ramener à la conscience pendant quelques minutes. » Les 7 pénalités de base tiennent : le palier
 *     s'y AJOUTE. Aucune capacité nommée n'est écrite : la suspension est ce que dit la FENÊTRE.
 *  3. `malaise` : la capacité `stickyExtenue` cède la place à `passive: [{op:'condition', id:'extenue',
 *     resolveWindow:'none'}]` — l.188 : « Gagnez un État *Exténué* dont vous ne pourrez vous défaire
 *     qu'une fois votre maladie guérie. » L'État se DÉCLARE en donnée, sa matérialisation et sa
 *     persistance sont le socle `syncDerivedConditions` ; `resolveWindow: 'none'` EST le verrou (aucune
 *     fenêtre de résolution), plus un drapeau nommé dans le moteur.
 *  4. `gangrene.desc` est recollée VERBATIM de LDB 20 l.176 : la prose committée avait perdu les quatre
 *     phrases de Localisation et la phrase de rémanence finale (règle 5 — une `desc` est un copié/collé).
 *
 * FORME D'AVANT SEULE, geste par geste : `convulsions` porteur de `severePassive` sans
 * `passiveBySeverity`, `fievre` sans `passiveBySeverity`, `malaise` porteur de la capacité
 * `stickyExtenue`, `gangrene.desc` finissant sur la prose amputée. Un symptôme absent, migré ou révisé
 * depuis, est laissé tel quel ; rejouée sur l'arbre migré, la migration n'écrit rien et sort 0.
 * CARDINAUX ATTENDUS sur les seules entrées à migrer, mesurés sur l'arbre d'avant le train (2026-09-05) :
 * 6 ops de `convulsions.severePassive` et de `convulsions.passive`, 7 ops de `fievre.passive`,
 * `stickyExtenue` seule clé des `capabilities` de `malaise`, 1 ancre de Localisation dans
 * `gangrene.desc`. Un écart fait sortir 1 AVANT toute écriture.
 * FAIL-FAST : un `severePassive` sur un AUTRE symptôme que `convulsions`, un `stickyExtenue` ailleurs
 * que sur `malaise`, un cardinal inattendu, un formatage non canonique → rien n'est écrit.
 * FORMATAGE PRÉSERVÉ : `src/data/symptoms.json` est `JSON.stringify(doc, null, 2)` (sans saut final),
 * vérifié AVANT écriture.
 *
 * `--check` : ne joue AUCUNE écriture, rend 0 si l'arbre est déjà migré, 1 sinon (avec le motif).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-05-1599-passifs-par-palier';
const REL = 'src/data/symptoms.json';
const CHECK = process.argv.includes('--check');

/** Cardinaux des OPS que ce script POSE, chiffrés par la règle elle-même (`LDB 20 l.157` pour la
 *  pénalité de Convulsions et ses paliers) — ce ne sont pas des populations de donnée qui
 *  grandissent, mais la forme de l'effet que la règle décrit (#1812). */
const ATTENDU = { opsConvulsions: 6, opsConvulsionsBase: 6, opsFievre: 7 };

/** `maison` de `convulsions` après migration — l.157 ne chiffre PAS le palier (Grave). */
const MAISON_CONVULSIONS =
  "LDB 20 l.157 chiffre la pénalité de base (-10) et celle de (Modéré) (« cette pénalité passe à -20 » — "
  + "une magnitude qui REMPLACE, d'où la valeur absolue du palier), mais ne rechiffre pas (Grave) : aucun "
  + "palier `grave` n'est déclaré, une instance Grave porte donc les paliers atteints, soit -20. "
  + "L'« état d'incapacité totale » du même passage n'est PAS modélisé (aucun État nommé par la source).";

/** Palier (Grave) de la Fièvre — l.170 ; la fenêtre de résolution PORTE la suspension par Détermination. */
const FIEVRE_GRAVE = [
  {
    op: 'condition',
    id: 'inconscient',
    resolveWindow: { scale: 'clock', minutes: { rule: 'maladie-conscience-determination-minutes' } },
  },
];

/** Passif du Malaise — l.188 ; `resolveWindow: 'none'` = aucune fenêtre de résolution. */
const MALAISE_PASSIF = [{ op: 'condition', id: 'extenue', resolveWindow: 'none' }];

/** LDB 20 l.176 — fin de la phrase qui précède les Localisations perdues (ancre d'insertion). */
const GANGRENE_ANCRE = 'déterminer une Localisation (voir **Combat**). ';
/** LDB 20 l.176 — les quatre phrases de Localisation, verbatim. */
const GANGRENE_LOCALISATIONS =
  "Si vous obtenez Corps, vous avez de la chance, la *Gangrène* ne s'est pas propagée au cours de "
  + "l'infection. Si vous obtenez la Tête, c'est votre nez qui est touché. Si vous obtenez Bras, ce sont "
  + "vos doigts. Si c'est la jambe, c'est votre pied qui est atteint. ";
/** LDB 20 l.176 — la phrase de rémanence finale, verbatim. */
const GANGRENE_REMANENCE =
  " Et cela perdurera même après que vous avez été guéri de la maladie à l'origine de la *Gangrène*.";
/** Fin de la `desc` AVANT recollage — ce que la prose amputée laisse en queue. */
const GANGRENE_QUEUE_AMPUTEE = ' ne sera pas amputé.';

const echec = (m) => {
  console.error(`[${NOM}] ${m}`);
  process.exit(1);
};

const cible = path.join(ROOT, REL);
const brut = fs.readFileSync(cible, 'utf8');
const doc = JSON.parse(brut);
if (brut !== serializeDataset(doc)) echec(`${REL} : formatage non canonique en entrée`);
if (!Array.isArray(doc)) echec(`${REL} : racine non-TABLEAU`);

const parId = new Map(doc.map((e) => [e?.id, e]));
const convulsions = parId.get('convulsions');
const fievre = parId.get('fievre');
const malaise = parId.get('malaise');
const gangrene = parId.get('gangrene');

// ── PORTE DE LECTURE — cardinaux et états admis, avant toute écriture ────────────────────────────
const porteurs = doc.filter((e) => e?.severePassive);
const collants = doc.filter((e) => e?.capabilities?.stickyExtenue);
const horsPerimetre = [
  ...porteurs.filter((e) => e.id !== 'convulsions').map((e) => `severePassive sur \`${e.id}\``),
  ...collants.filter((e) => e.id !== 'malaise').map((e) => `stickyExtenue sur \`${e.id}\``),
];
if (horsPerimetre.length) echec(`porteur hors périmètre : ${horsPerimetre.join(', ')}`);

// Les quatre formes d'avant, une par geste.
const aConvulsions = Array.isArray(convulsions?.severePassive) && convulsions.passiveBySeverity === undefined;
const aFievre = !!fievre && fievre.passiveBySeverity === undefined;
const aMalaise = malaise?.capabilities?.stickyExtenue !== undefined;
const descGangrene = typeof gangrene?.desc === 'string' ? gangrene.desc : '';
const aGangrene = descGangrene.endsWith(GANGRENE_QUEUE_AMPUTEE);

const aFaire = [aConvulsions, aFievre, aMalaise, aGangrene].filter(Boolean).length;
if (aFaire === 0) {
  console.log(`[${NOM}] déjà migrée — rien à écrire`);
  process.exit(0);
}
if (CHECK) {
  echec(
    `NON migrée : ${aFaire} geste(s) à la forme d'avant (convulsions ${aConvulsions}, fievre ${aFievre}, `
    + `malaise ${aMalaise}, gangrene.desc amputée de LDB 20 l.176 ${aGangrene})`,
  );
}

const mesure = {
  ...(aConvulsions ? { opsConvulsions: convulsions.severePassive.length, opsConvulsionsBase: convulsions.passive?.length ?? 0 } : {}),
  ...(aFievre ? { opsFievre: fievre.passive?.length ?? 0 } : {}),
};
for (const [k, n] of Object.entries(mesure)) if (n !== ATTENDU[k]) echec(`${k} : ${n} ≠ ${ATTENDU[k]} attendu(s)`);
const capacitesMalaise = Object.keys(malaise?.capabilities ?? {});
if (aMalaise && capacitesMalaise.join(',') !== 'stickyExtenue') {
  echec(`malaise.capabilities : \`${capacitesMalaise.join('`, `')}\` — \`stickyExtenue\` n'y est pas seule, rien n'est retiré`);
}
const ancres = descGangrene.split(GANGRENE_ANCRE).length - 1;
if (aGangrene && ancres !== 1) echec(`gangrene.desc : ${ancres} occurrence(s) de l'ancre de Localisation (1 attendue)`);
// Le palier Modéré doit couvrir EXACTEMENT les caractéristiques de la base (même ordre, même clé) —
// sinon le déplacement laisserait une carac à −10 quand l.157 la met à −20.
for (const [i, op] of (aConvulsions ? convulsions.severePassive : []).entries()) {
  const base = convulsions.passive[i];
  if (op.op !== 'charMod' || base?.op !== 'charMod' || op.char !== base.char || op.mod !== -20 || base.mod !== -10) {
    echec(`convulsions : palier Modéré / base non appariés à l'index ${i} (${JSON.stringify(op)} vs ${JSON.stringify(base)})`);
  }
}

// ── ÉCRITURE — chaque entrée REBÂTIE clé par clé (l'ordre de sortie est celui de l'entrée) ───────
/** Rebâtit `e` en substituant la clé `de` par `vers`/`valeur` À SA PLACE ; `valeur === undefined` la retire. */
const substitue = (e, de, vers, valeur) =>
  Object.fromEntries(
    Object.entries(e).flatMap(([k, v]) => (k !== de ? [[k, v]] : valeur === undefined ? [] : [[vers, valeur]])),
  );
/** Rebâtit `e` en insérant `cle: valeur` JUSTE APRÈS la clé `apres`. */
const insereApres = (e, apres, cle, valeur) =>
  Object.fromEntries(Object.entries(e).flatMap(([k, v]) => (k === apres ? [[k, v], [cle, valeur]] : [[k, v]])));

const remplace = (id, entree) => {
  doc[doc.findIndex((e) => e?.id === id)] = entree;
};

// 1. Convulsions : la liste −20 EST celle du palier Modéré (l.157), magnitude absolue. `maison` prend
// la place que tiennent les clés d'enveloppe des entrées voisines : juste AVANT `source`.
if (aConvulsions) {
  const convulsionsPalier = substitue(convulsions, 'severePassive', 'passiveBySeverity', {
    moderee: convulsions.severePassive.map((o) => ({ ...o })),
  });
  remplace('convulsions', insereApres(convulsionsPalier, 'passiveBySeverity', 'maison', MAISON_CONVULSIONS));
}

// 2. Fièvre (Grave) : le SEUL État Inconscient, sa fenêtre d'horloge comprise — les pénalités de base
// tiennent (l.170).
if (aFievre) remplace('fievre', insereApres(fievre, 'passive', 'passiveBySeverity', { grave: FIEVRE_GRAVE }));

// 3. Malaise : l'Exténué s'écrit comme un passif, à la place qu'occupait la capacité (l.188).
if (aMalaise) remplace('malaise', substitue(malaise, 'capabilities', 'passive', MALAISE_PASSIF));

// 4. Gangrène : la prose de LDB 20 l.176 recollée — Localisations à leur place, rémanence en queue.
if (aGangrene) {
  remplace(
    'gangrene',
    substitue(
      gangrene,
      'desc',
      'desc',
      `${descGangrene.replace(GANGRENE_ANCRE, `${GANGRENE_ANCRE}${GANGRENE_LOCALISATIONS}`)}${GANGRENE_REMANENCE}`,
    ),
  );
}

fs.writeFileSync(cible, serializeDataset(doc), 'utf8');

// ── PREUVE POST-ÉCRITURE — 0 champ d'origine, 4 gestes posés ────────────────────────────────────
const relu = JSON.parse(fs.readFileSync(cible, 'utf8'));
const apres = new Map(relu.map((e) => [e?.id, e]));
const ecarts = [];
if (aConvulsions) {
  if (apres.get('convulsions')?.severePassive) ecarts.push('convulsions : `severePassive` encore présent');
  if (apres.get('convulsions')?.passiveBySeverity?.moderee?.length !== ATTENDU.opsConvulsions) ecarts.push('convulsions.passiveBySeverity.moderee');
  if (apres.get('convulsions')?.passiveBySeverity?.grave) ecarts.push('convulsions : un palier Grave a été écrit (l.157 ne le chiffre pas)');
}
if (aFievre) {
  if (apres.get('fievre')?.passiveBySeverity?.grave?.length !== 1) ecarts.push('fievre.passiveBySeverity.grave');
  const inconscient = apres.get('fievre')?.passiveBySeverity?.grave?.find((o) => o.op === 'condition' && o.id === 'inconscient');
  if (!inconscient) ecarts.push('fievre : État Inconscient absent');
  else if (inconscient.resolveWindow?.scale !== 'clock' || inconscient.resolveWindow?.minutes?.rule !== 'maladie-conscience-determination-minutes') {
    ecarts.push("fievre : fenêtre d'horloge de l'Inconscient absente ou hors règle");
  }
}
if (aMalaise) {
  const extenue = apres.get('malaise')?.passive?.find((o) => o.op === 'condition' && o.id === 'extenue');
  if (!extenue) ecarts.push('malaise : État Exténué absent');
  else if (extenue.resolveWindow !== 'none') ecarts.push("malaise : l'Exténué porte une fenêtre de résolution");
  if (apres.get('malaise')?.capabilities) ecarts.push('malaise : `capabilities` subsiste');
}
if (aGangrene) {
  if (!apres.get('gangrene')?.desc?.includes(GANGRENE_LOCALISATIONS)) ecarts.push('gangrene : Localisations de l.176 absentes');
  if (!apres.get('gangrene')?.desc?.endsWith(GANGRENE_REMANENCE)) ecarts.push('gangrene : rémanence de l.176 absente');
}
if (ecarts.length) {
  console.error(`[${NOM}] ÉCHEC POST-ÉCRITURE : ${ecarts.join(' ; ')}`);
  process.exit(1);
}

console.log(`[${NOM}] migré — ${aFaire} geste(s) : convulsions ${aConvulsions}, fievre ${aFievre}, malaise ${aMalaise}, gangrene ${aGangrene}`);
