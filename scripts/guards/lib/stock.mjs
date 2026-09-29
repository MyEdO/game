// PRIMITIVE DE CLIQUET des stocks nominatifs : l'ÉCART au stock (entrées neuves / entrées périmées)
// et son REMÈDE, les CHAMPS que la clé n'observe pas, la COUVERTURE du balayage qui alimente le
// cliquet (gisements muets, entrées de stock hors corpus), les LIGNES sans échéance lisible.
//
// « Stock nominatif » est le terme LARGE : un stock dont chaque entrée NOMME son fichier, ce que la
// porte de plage voit (`stocksNominatifs.mjs`). Un STOCK DE SITES en est l'espèce : ses entrées sont
// des ENTRÉES DE SITE, `EntreeDeSite`, dont ce module déclare, une fois, les champs et tout ce qui en
// dérive : `CHAMPS_DE_GROUPE`, `CHAMP_D_OCCURRENCE`, `CHAMPS_DE_CLE`, `CHAMPS_REQUIS`, les deux
// séparateurs (`SEPARATEUR_DE_CLE` dans la clé, `SEPARATEUR_DE_REMEDE` entre une clé et son remède
// dans un message d'écart), l'ÉCHÉANCE d'une entrée (`CHAMPS_D_ECHEANCE`, type `Echeance`) et le SITE
// OBSERVÉ d'un balayage (`CHAMPS_DE_SITE_OBSERVE`, type `Site`), puis la clé (`cleDeSite`), le groupe
// (`groupeDeSite`), le prédicat (`estEntreeDeSite`) et la traduction des sites en entrées
// (`sitesEnEntrees`). Le chemin d'un fichier se dit `file` dans le site et `fichier` dans l'entrée
// (#2022). Les types de `stock.d.mts` DÉRIVENT des tuples qu'il déclare ; leur concordance avec les
// valeurs d'ici est celle de tout module `.mjs` typé par un `.d.mts` (aucun `allowJs`) : aucun
// outil ne la vérifie.
//
// INJECTIVITÉ. Une `ref` peut contenir le séparateur (les réfs CSS `.hud-clock :: padding :: 0 10px`
// de `cssCouchesAudit.ts`) : la clé reste injective parce que `famille` et `fichier` ne le contiennent
// pas et que l'occurrence, entière, est dernière ; le groupe, parce que la `ref` est son dernier champ.
//
// FRONTIÈRE (la même que `sourceCorpus.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant.
// C'est la garde qui décide ce qui est rouge, avec quel message, et à quel plafond — ici on ne rend
// que des listes et un compte. La régénération d'un stock de sites (formats, politiques, écriture)
// vit dans `stockDeSites.mjs` et `regenStock.mts` ; ce module n'importe rien (#1475).
//
// L'unité mesurée est la COLLECTION, jamais le fichier : un fichier de stock en porte parfois
// plusieurs (`structuresStock.mjs` en porte 8), chacune se mesure pour elle-même. La CLÉ d'un écart
// est une fonction LIBRE de l'appelant : elle seule sait ce que sa garde compare — `slotsStock`
// embarque l'occurrence dans la sienne, `manualDocsStock` compare des chemins nus. Un stock VIDE se
// sert comme les autres, sans court-circuit : un cliquet tenu à zéro est un cliquet, il rend ses
// `neuves`.
//
// INTERDITS gravés — chacun est un trou déjà payé dans ce dépôt :
//   - jamais le PLAFOND. Il vit dans le TEST, jamais dans la lib du stock ni ici
//     (`src/data/entity-orphans.test.ts:18-21`, verbatim : « sans lui, le chemin le plus court pour
//     "solder" une orpheline neuve resterait d'ajouter une ligne au stock, CI verte ») — un plafond
//     servi depuis la lib se relèverait dans le même geste que l'append qu'il doit rendre visible.
//   - jamais le VERDICT : aucun `expect`, aucun `throw`, aucun exit.
//   - jamais le DISQUE : aucune lecture, aucun chemin — l'appelant apporte l'observé.
//   - jamais de MÉMOÏSATION : il n'y a rien de stable à keyer. L'observé et le stock arrivent en
//     `Iterable` (souvent un générateur, consommé une seule fois), et le SENS d'un appel tient à la
//     fonction `cle` fournie par l'appelant — une closure, jamais comparable à une autre. Un mémo
//     ici servirait l'écart d'un AUTRE appel. Ce qui se mémoïse, c'est la LECTURE du disque, et elle
//     vit dans `sourceCorpus.mjs` (`readCorpus`, clé de contenu).

/** Les champs du GROUPE d'une entrée de site : ses homonymes ne se distinguent que par l'occurrence. */
export const CHAMPS_DE_GROUPE = Object.freeze(['famille', 'fichier', 'ref']);
/** Le champ de l'OCCURRENCE d'une entrée de site : l'ordinal du site dans son groupe. */
export const CHAMP_D_OCCURRENCE = 'occurrence';
/** Les champs de la CLÉ d'une entrée de site, dans l'ordre où la clé les joint. */
export const CHAMPS_DE_CLE = Object.freeze([...CHAMPS_DE_GROUPE, CHAMP_D_OCCURRENCE]);
/** Les champs qu'une entrée de site porte toujours : `famille` n'est portée que par les gardes qui
 *  distinguent des familles. */
export const CHAMPS_REQUIS = Object.freeze(CHAMPS_DE_CLE.filter((c) => c !== 'famille'));
/** Le séparateur des champs d'une clé de site. */
export const SEPARATEUR_DE_CLE = ' :: ';
/** Le séparateur qui suit une clé de site dans un message d'écart, avant son remède. */
export const SEPARATEUR_DE_REMEDE = ' — ';
/** L'ÉCHÉANCE d'une entrée : le chantier qui l'éteint, la date de la mesure d'origine. */
export const CHAMPS_D_ECHEANCE = Object.freeze(['lot', 'date']);
/** Les champs du SITE OBSERVÉ d'un balayage, avant `sitesEnEntrees` (#2022). */
export const CHAMPS_DE_SITE_OBSERVE = Object.freeze(['file', 'ref']);

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Écart d'une collection OBSERVÉE à son STOCK, dans les DEUX sens.
 * @template O, S
 * @param {{ observe: Iterable<O>, stock: Iterable<S>, cle: (entree: O | S) => string,
 *   remede?: { neuve?: (cle: string, entree: O) => string, perimee?: (cle: string, entree: S) => string } }} p
 *   `remede` décore les lignes rendues (défaut : la clé nue). Les DEUX remèdes reçoivent l'entrée en
 *   second argument : une clé peut ne rien nommer (tous ses champs vides), et le remède est alors le
 *   seul endroit d'où l'entrée fautive se cite.
 * @returns {{ neuves: string[], perimees: string[], taille: number }} `taille` = clés DISTINCTES du
 *   stock — de quoi confronter un plafond, que l'appelant seul détient.
 */
export function ecartsDeStock({ observe, stock, cle, remede = {} }) {
  const vues = new Map();
  for (const e of observe) {
    const k = cle(e);
    if (!vues.has(k)) vues.set(k, e);
  }
  const tenues = new Map();
  for (const e of stock) { const k = cle(e); if (!tenues.has(k)) tenues.set(k, e); }
  const neuves = [...vues]
    .filter(([k]) => !tenues.has(k))
    .map(([k, e]) => (remede.neuve ? remede.neuve(k, e) : k));
  const perimees = [...tenues]
    .filter(([k]) => !vues.has(k))
    .map(([k, e]) => (remede.perimee ? remede.perimee(k, e) : k));
  return { neuves, perimees, taille: tenues.size };
}

/** La phrase « à la naissance » d'un `quoi` de stock : les comptes par famille, dans l'ordre de `familles`.
 *  SEULE écriture de cette phrase ; `naissanceDu` est sa lecture. PURE. */
export const phraseDeNaissance = (comptes, familles) =>
  `Compte par famille à la naissance : ${familles.map((f) => `${f} ${comptes[f]}`).join(', ')}.`

/** Les comptes « à la naissance » que porte un `quoi` (`phraseDeNaissance`), ou `null` s'il n'en porte
 *  pas pour chaque famille : un stock réécrit garde les siens, l'historique ne se réécrit pas. PURE. */
export function naissanceDu(quoi, familles) {
  const m = /Compte par famille à la naissance : ([^.]*)\./.exec(String(quoi ?? ''))
  if (!m) return null
  const comptes = Object.fromEntries(m[1].split(', ').map((x) => { const i = x.lastIndexOf(' '); return [x.slice(0, i), Number(x.slice(i + 1))] }))
  return familles.every((f) => Number.isInteger(comptes[f])) ? comptes : null
}

/**
 * CLÉ DE SITE d'une entrée : la famille quand la garde en distingue, le fichier, la réf, et
 * l'OCCURRENCE (ordinal du site parmi ses homonymes), joints par `SEPARATEUR_DE_CLE`. Même clé des
 * deux côtés de `ecartsDeStock`. C'est la forme d'entrée de TOUT stock de sites du dépôt — les stocks
 * JSON de `scripts/raw` (lus par `stockDeSites.mjs`) comme les stocks `.mjs` de gardes
 * (`paletteLiteralStock.mjs`).
 * Ce que la clé EXCLUT : la ligne du FICHIER PORTEUR (celle où le site est écrit) — elle dérive à
 * chaque édition du fichier et rendrait la moitié du stock périmée à chaque commit.
 * Ce que la clé INCLUT, sur les volets à RÉF CITÉE (`reanchor-low`, `dead-refs`, `empty-line`,
 * `dead-code-refs`) : la ligne citée dans `Source/` (`LDB 07 l.43`), qui est l'identité même du site
 * et reste stable hors ré-extraction. Une RÉ-EXTRACTION Marker fait dériver ces lignes (CLAUDE.md
 * § Sources VF) — c'est l'événement pour lequel `reanchor.mjs` existe : le stock se renouvelle alors
 * EN BLOC (N périmées + N neuves pour zéro dette de plus) et se déclare comme tel.
 * La clé se CALCULE, elle ne s'ÉCRIT PAS sur le disque : ses séparateurs portent des espaces,
 * qu'aucun motif de chemin de `stocksNominatifs.mjs` n'admet — une clé gravée en littéral serait
 * INVISIBLE à la porte de plage (mesuré le 2026-09-14 : forme `Set` de clés, 0 entrée vue sur 2, `[]`
 * à l'append ; forme entrée de site, 2 vues sur 2 et `net 1`). Ce qu'un stock grave, c'est l'ENTRÉE ;
 * la clé n'en est que la comparaison. `Array.prototype.join` rend `''` pour un champ `undefined` : la
 * famille absente s'y écrit vide.
 * @param {import('./stock.mjs').EntreeDeSite} e
 */
export const cleDeSite = (e) => CHAMPS_DE_CLE.map((c) => e[c]).join(SEPARATEUR_DE_CLE);

/** CLÉ DE GROUPE d'une entrée : sa clé de site sans l'occurrence — les homonymes d'un fichier. PURE.
 *  @param {import('./stock.mjs').EntreeDeSite} e */
export const groupeDeSite = (e) => CHAMPS_DE_GROUPE.map((c) => e[c]).join(SEPARATEUR_DE_CLE);

/** Une ENTRÉE DE SITE : chaque champ de `CHAMPS_REQUIS` présent, l'occurrence entière ≥ 1, les autres
 *  champs requis des chaînes, chaque champ facultatif de la clé absent, `undefined` ou chaîne. PURE. */
export function estEntreeDeSite(e) {
  if (e === null || typeof e !== 'object') return false;
  for (const c of CHAMPS_REQUIS) {
    if (!(c in e)) return false;
    if (c === CHAMP_D_OCCURRENCE ? !(Number.isInteger(e[c]) && e[c] >= 1) : typeof e[c] !== 'string') return false;
  }
  return CHAMPS_DE_CLE.filter((c) => !CHAMPS_REQUIS.includes(c)).every((c) => e[c] === undefined || typeof e[c] === 'string');
}

/**
 * Sites OBSERVÉS → entrées de SITE : la SEULE traduction du site observé (`file`) en entrée
 * (`fichier`) du dépôt (#2022). L'occurrence est l'ordinal du site parmi ceux qui partagent son groupe
 * (`groupeDeSite`), dans l'ordre du balayage. La famille d'une entrée est celle que porte son SITE,
 * présente ou absente. Les champs de clé vont en tête, dans l'ordre de `CHAMPS_DE_CLE` (`famille`
 * seulement quand elle est définie), puis la MESURE du site — tout le reste de ses champs, dans son
 * ordre (le `nombre` d'une réparation partielle, la `line` d'une ancre, le `pdfChars` d'un tri) —
 * passe à l'entrée hors clé.
 * ANGLE MORT DIT : quand un fichier porte DEUX fois la même réf et que la PREMIÈRE se corrige, la
 * seconde descend de l'occurrence 2 à la 1 — l'écart rend alors une périmée ET une neuve pour un seul
 * geste. Le cliquet reste juste (le solde doit se déclarer), sa phrase est seulement plus bavarde.
 * MÊME ANGLE MORT PAR RÉ-ORDINALISATION : l'ordinal suit l'ORDRE DU BALAYAGE, donc insérer un
 * paragraphe AVANT une réf homonyme dans le même fichier échange les ordinaux de deux sites pourtant
 * inchangés — une paire neuve/périmée fantasme un geste qui n'a pas eu lieu. Portée mesurée le
 * 2026-09-12 : latent sur `reanchor-low` (21 entrées, toutes à l'occurrence 1) ; atteignable sur
 * `empty-line-code-refs` (occurrence 2) et `graphy` (jusqu'à 8), qui portent des homonymes.
 * @param {(import('./stock.mjs').Site & { famille?: string })[]} sites
 */
export function sitesEnEntrees(sites) {
  const vus = new Map();
  return sites.map(({ file, ref, famille, ...mesure }) => {
    const cle = { ...(famille === undefined ? {} : { famille }), fichier: file, ref };
    const groupe = groupeDeSite(cle);
    const occurrence = (vus.get(groupe) ?? 0) + 1;
    vus.set(groupe, occurrence);
    return { ...cle, [CHAMP_D_OCCURRENCE]: occurrence, ...mesure };
  });
}

/**
 * CE QUI EST NEUF, seule définition du dépôt : une entrée mesurée sans entrée en place à clé identique
 * (`tenue` absente), ou dont le `nombre` dépasse celui de son entrée en place, les deux définis. Une
 * clé nue n'a pas de `nombre` : seule son absence du stock la rend neuve. Lue par
 * `survieDeLecheance`, `nombresAccrus` et `refusDeCroissance`. PURE.
 */
export const estNeuveOuAccrue = (mesuree, tenue) =>
  tenue === undefined || (mesuree?.nombre != null && tenue?.nombre != null && mesuree.nombre > tenue.nombre);

/**
 * SURVIE d'une ÉCHÉANCE à une RÉGÉNÉRATION de stock — seule définition du dépôt (#1820), consommée par
 * `entreesRegenerees` (`stockDeSites.mjs`) sous toute politique.
 * `ancien` (les entrées en place) fait SURVIVRE, à CLÉ IDENTIQUE et sans croissance
 * (`estNeuveOuAccrue`), ce qu'un humain a posé sur l'entrée : son échéance (`CHAMPS_D_ECHEANCE` — un
 * site inchangé garde la date à laquelle il a été qualifié, une régénération ne rajeunit pas une dette)
 * et sa `preuve` (le site a été tranché au PDF), écrite APRÈS l'échéance. Une entrée neuve ou accrue ne
 * reprend ni l'une ni l'autre : elle prend le `lot` et la `date` du run, écrits seulement quand ils sont
 * donnés — sous une politique qui date (`SOUS_LOT`) ; une valeur absente (`undefined`, `null`) n'est pas
 * une propriété de l'entrée. L'ORDRE rendu est celui de `mesurees`.
 * @template {Record<string, unknown>} E
 * @param {Iterable<E>} mesurees entrées MESURÉES (clé de site posée par `sitesEnEntrees`)
 * @param {Partial<import('./stock.mjs').Echeance> & { ancien?: Iterable<object> }} p
 */
export function survieDeLecheance(mesurees, { lot, date, ancien = [] }) {
  const run = { lot, date };
  const parCle = new Map();
  for (const e of ancien) parCle.set(cleDeSite(e), e);
  return [...mesurees].map((e) => {
    const tenue = parCle.get(cleDeSite(e));
    const vieux = estNeuveOuAccrue(e, tenue) ? undefined : tenue;
    const sortie = { ...e };
    for (const c of CHAMPS_D_ECHEANCE) {
      const v = vieux?.[c] ?? run[c];
      if (v != null) sortie[c] = v;
    }
    if (vieux?.preuve !== undefined) sortie.preuve = vieux.preuve;
    return sortie;
  });
}

/** La clé d'une entrée, ou l'entrée elle-même en JSON compact quand cette clé ne NOMME rien. Une
 *  entrée sans `fichier` ni `ref` (faute de saisie, champ renommé, entrée bidon) rend une clé réduite
 *  à ses séparateurs (` ::  ::  :: `) : le refus désigne alors une entrée que le lecteur ne peut pas
 *  retrouver dans son stock. Le JSON de l'entrée est ce qui la localise. */
const cleOuEntree = (cle, entree) => (entree?.fichier || entree?.ref ? cle : JSON.stringify(entree));

/**
 * VERDICT d'un volet à stock de sites : les deux sens, en phrases prêtes à afficher. Le calcul est
 * celui de `ecartsDeStock` ; ce qui vit ici est le REMÈDE — ce que le lecteur doit faire de chaque
 * ligne. Le PLAFOND n'y est pas : il vit dans le test de la garde.
 * ANGLE MORT DIT, À LA PORTE DE PLAGE : un ÉCHANGE EN PLACE à total constant — réécrire le `fichier`
 * ou la `ref` d'une entrée existante pour couvrir un site neuf pendant qu'un autre est soldé, dans le
 * MÊME commit — rend `[]` à `croissanceDesStocks` : le stock ne peut pas CROÎTRE ainsi, mais ce solde
 * et ce neuf ne se déclarent pas. Cette garde-ci, elle, les voit toujours (la clé a changé des deux
 * côtés) : c'est la SUITE qui tient ce cas, pas la porte de plage.
 * @param {{ sites: import('./stock.mjs').Site[], stock: Iterable<object>, ou?: string }} p
 *   `ou` nomme le fichier de stock dans le remède.
 */
export function ecartDuVolet({ sites, stock, ou }) {
  const observe = sitesEnEntrees(sites);
  const tenues = [...stock];
  const ecart = ecartsDeStock({
    observe,
    stock: tenues,
    cle: cleDeSite,
    remede: {
      neuve: (k) => `${k}${SEPARATEUR_DE_REMEDE}site NEUF : corriger la réf, ou déclarer une entrée dans ${ou} et la porter au message par \`CLIQUET:\`.`,
      perimee: (k, e) => `${cleOuEntree(k, e)}${SEPARATEUR_DE_REMEDE}entrée SOLDÉE : le site a disparu, retirer cette entrée de ${ou}.`,
    },
  });
  return { ...ecart, neuves: [...ecart.neuves, ...nombresAccrus(observe, tenues, ou)] };
}

/**
 * CLIQUET du `nombre` (occurrences d'un site, hors clé) : une entrée en place dont la mesure est
 * ACCRUE (`estNeuveOuAccrue`, entrée en place présente) est une dette qui GRANDIT — une ligne de
 * remède, rendue parmi les neuves. Plus petit : la régénération recale le stock (`entreesRegenerees`
 * garde le nombre mesuré) ; plus grand, la régénération le refuse sous `DECROISSANT` et le date sous
 * `SOUS_LOT` (`stockDeSites.mjs`) ; égal ou sans nombre : rien. PURE.
 * @param {Iterable<object>} observe entrées mesurées @param {Iterable<object>} stock @param {string} [ou]
 * @returns {string[]}
 */
export function nombresAccrus(observe, stock, ou) {
  const tenues = new Map();
  for (const e of stock) if (!tenues.has(cleDeSite(e))) tenues.set(cleDeSite(e), e);
  const out = [];
  for (const e of observe) {
    const tenue = tenues.get(cleDeSite(e));
    if (tenue && estNeuveOuAccrue(e, tenue))
      out.push(`${cleDeSite(e)}${SEPARATEUR_DE_REMEDE}nombre ${e.nombre} > ${tenue.nombre} en stock : la dette GRANDIT, corriger le site (${ou}).`);
  }
  return out;
}

/** Une ligne de remède de `ecartDuVolet` NOMME-t-elle cette clé ? (le remède décore la clé d'une phrase)
 *  @param {readonly string[]} lignes @param {string} cle @returns {boolean} */
export const remedeNomme = (lignes, cle) => lignes.some((l) => l.includes(cle))

/**
 * REFUS de croissance d'une régénération de stock : la phrase à afficher quand une entrée MESURÉE est
 * neuve ou accrue au regard du stock en place (`estNeuveOuAccrue`), `null` sinon. Lu par les deux
 * politiques qui refusent (`DECROISSANT`, `SOUS_LOT`, `stockDeSites.mjs`) : deux lectures divergentes de
 * « ce qui est neuf » laisseraient l'une écrire ce que l'autre refuse.
 * Le critère est l'ÉCART, jamais un TOTAL : à taille constante — une entrée soldée pendant qu'un site
 * neuf apparaît — les deux longueurs restent égales et la régénération entérinerait le site neuf en
 * silence, stock réécrit, garde verte (mesuré le 2026-09-14 sur le corpus réel :
 * `src/gameIso/rig/parts/tenues/defs/Apothicaire.ts :: apothicaire:torse:front :: 1`).
 * Ce n'est PAS un verdict au sens de l'en-tête : aucun `expect`, aucun `throw`, aucun exit — la
 * phrase est rendue, l'appelant décide ce qu'il en fait, comme des lignes de `ecartDuVolet`.
 * La phrase : l'en-tête qui compte les entrées neuves ou accrues et la taille du stock en place, une
 * ligne par entrée rangée par sa clé (une accrue suivie de son `nombre` mesuré et de celui du stock),
 * une ligne vide, puis `motif`.
 * @param {Iterable<*>} mesurees ce que la mesure porte
 * @param {Iterable<*>} stock le stock EN PLACE
 * @param {{ cle?: (entree: *) => string, nom: string, motif: string }} p `cle` défaut `cleDeSite`
 *   (un stock à clé nue fournit la sienne) ; `nom` = la collection nommée dans la phrase ; `motif` =
 *   la dernière phrase — ce que le lecteur doit faire de l'entrée neuve.
 * @returns {string | null}
 */
export function refusDeCroissance(mesurees, stock, { cle = cleDeSite, nom, motif }) {
  const tenues = new Map();
  for (const e of stock) { const k = cle(e); if (!tenues.has(k)) tenues.set(k, e); }
  const lignes = new Map();
  for (const m of mesurees) {
    const k = cle(m);
    const tenue = tenues.get(k);
    if (lignes.has(k) || !estNeuveOuAccrue(m, tenue)) continue;
    lignes.set(k, tenue === undefined ? k : `${k}${SEPARATEUR_DE_REMEDE}nombre ${m.nombre} > ${tenue.nombre} en stock`);
  }
  if (lignes.size === 0) return null;
  const rangees = [...lignes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, l]) => l);
  return `REFUS : ${nom} porte ${lignes.size} entrée(s) NEUVE(S) ou ACCRUE(S) au regard du stock en place (${tenues.size} entrée(s)) :\n`
    + `  ${rangees.join('\n  ')}\n\n${motif}`;
}

/**
 * Champs d'entrée que la CLÉ n'observe pas : les muter laisse le jeu de clés IDENTIQUE, donc la
 * garde verte quoi qu'on écrive dans ces champs. Un stock VIDE n'offre aucune entrée à muter et
 * rend `[]` — mesurer la vacuité appartient à l'appelant.
 * @template {Record<string, unknown>} E
 * @param {Iterable<E>} stock @param {(entree: E) => string} cle @param {readonly (keyof E & string)[]} champs
 * @returns {string[]} les champs AVEUGLES, dans l'ordre demandé.
 */
export function champsAveugles(stock, cle, champs) {
  const entrees = [...stock];
  if (entrees.length === 0) return [];
  const empreinte = (l) => l.map(cle).sort().join('\n');
  const base = empreinte(entrees);
  return champs.filter((champ) => {
    const mutees = entrees.map((e, i) =>
      i === 0 ? { ...e, [champ]: typeof e[champ] === 'number' ? e[champ] + 999 : `${e[champ]}~MUTE` } : e,
    );
    return empreinte(mutees) === base;
  });
}

/**
 * COUVERTURE d'un stock de sites PAR LE BALAYAGE qui l'alimente, en deux listes NOMMÉES — ce que
 * `ecartsDeStock` (et tout cliquet à la main) ne peut pas dire : un écart se calcule sur ce qui est
 * PRÉSENTÉ, et un balayage amputé présente moins d'entrées, donc moins d'écarts, donc un vert. Même
 * trou que le REFUS DU VIDE de `sourceCorpus.mjs`, une marche plus bas : le balayage peut être NON
 * vide et pourtant avoir perdu un GISEMENT entier (un des dossiers que le cliquet prétend juger) ou
 * le fichier même d'une entrée de stock — la moitié RATCHET du stock des dettes de libellé a vécu ainsi,
 * ses entrées `src/ui/**` hors du balayage et le verdict vert (#1723).
 *
 * Non-vacuité par GISEMENT et non sur le total (patron `props-volumiques.test.ts`, `2639287cd`) :
 * sur un total agrégé, une moitié de balayage qui s'évapore reste muette derrière l'autre. Aucun
 * CARDINAL n'est attendu — un dossier peuplé, une entrée de stock présente, rien de plus.
 *
 * Les GISEMENTS attendus sont ceux que LE CLIQUET APPELANT juge, jamais tous les dossiers d'une
 * garde voisine : un volet qui ne balaie que la zone à tolérance zéro n'a pas à exiger la zone
 * ratchet. Hors périmètre par nature, un balayage de contenu STAGÉ (hook pre-commit) : un commit ne
 * touche qu'une partie du corpus, et la porte de vérité d'une couverture est la SUITE.
 *
 * GRAPHIE des `gisements` : le séparateur est exigé (`src/ui` peuple sur `src/ui/…`, jamais sur
 * `src/uix/…`), et la comparaison est littérale — un gisement mal graphié (`'src/ui/'`, séparateur
 * Windows `\`) n'est peuplé par rien et sort ÉTERNELLEMENT muet. Fail-loud : le rouge nomme le
 * dossier, sa correction est sa graphie.
 *
 * ANGLE MORT : cette couverture prouve qu'un fichier a été PRÉSENTÉ au cliquet, jamais qu'il a été LU
 * utilement — un gisement réduit à un fichier non représentatif passe. Neutraliser un détecteur sur
 * un fichier de stock PRÉSENT fait bouger son compte, donc rougir la dérive ; le commit qui
 * neutralise le détecteur ET met le stock à jour reste vert, et c'est au message de commit de le
 * dire (credo, « détecteur modifié dans le même commit »), pas à ce calcul de le voir.
 *
 * @param {{ nom: string, stock: Iterable<string>, balayes: Iterable<string>, gisements: Iterable<string> }} p
 *   `nom` = le stock nommé dans les phrases rendues ; `stock` = ses clés de FICHIER ; `balayes` =
 *   les chemins de TOUS les fichiers balayés (le corpus, pas les seuls porteurs de findings) ;
 *   `gisements` = les dossiers que ce cliquet juge, chacun attendu peuplé.
 * @returns {{ gisementsMuets: string[], entreesDeStockAbsentes: string[] }} phrases prêtes à afficher.
 */
export function couvertureDuBalayage({ nom, stock, balayes, gisements }) {
  const vus = new Set(balayes);
  const dossiers = [...gisements];
  const peuples = new Set();
  for (const rel of vus) for (const dir of dossiers) if (rel.startsWith(`${dir}/`)) peuples.add(dir);
  return {
    gisementsMuets: dossiers
      .filter((dir) => !peuples.has(dir))
      .map((dir) => `${dir} : gisement MUET — aucun fichier balayé, le cliquet ${nom} ne juge plus ce dossier (il rendrait vert par vacuité).`),
    entreesDeStockAbsentes: [...stock]
      .filter((rel) => !vus.has(rel))
      .map((rel) => `${rel} : entrée de ${nom} ABSENTE du balayage — son compte n'est plus mesuré ; brancher le fichier au corpus, ou retirer l'entrée s'il a disparu de l'arbre.`),
  };
}

/**
 * Lignes de stock sans ÉCHÉANCE lisible : lot vide, date absente ou non ISO, ou lot HORS de
 * l'ensemble fermé quand l'appelant en fournit un.
 * @param {Iterable<[string, Partial<import('./stock.mjs').Echeance>]>} stock paires `[nom, qualification]`
 * @param {{ lotsConnus?: Iterable<string> }} [opts]
 * @returns {string[]}
 */
export function lignesMalQualifiees(stock, { lotsConnus } = {}) {
  const connus = lotsConnus ? new Set(lotsConnus) : null;
  const out = [];
  for (const [nom, v] of stock) {
    const lot = typeof v?.lot === 'string' ? v.lot.trim() : '';
    const date = typeof v?.date === 'string' ? v.date : '';
    if (!lot || !DATE_ISO.test(date)) {
      out.push(`${nom} → lot « ${lot} », date « ${date} » — une ligne sans lot de mort NI date est un régime, pas un cliquet.`);
      continue;
    }
    if (connus && !connus.has(lot)) {
      out.push(`${nom} → lot « ${lot} » hors des lots connus (${[...connus].sort().join(', ')}).`);
    }
  }
  return out;
}
