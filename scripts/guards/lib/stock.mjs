// PRIMITIVE DE CLIQUET : les quatre calculs que chaque garde à stock refaisait à la main — l'ÉCART au
// stock (entrées neuves / entrées périmées), les CHAMPS que la clé n'observe pas, la COUVERTURE du
// balayage qui alimente le cliquet (gisements muets, entrées de stock hors corpus), les LIGNES sans
// échéance lisible.
//
// FRONTIÈRE (la même que `sourceCorpus.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant.
// C'est la garde qui décide ce qui est rouge, avec quel message, et à quel plafond — ici on ne rend
// que des listes et un compte.
//
// L'unité mesurée est la COLLECTION, jamais le fichier : un fichier de stock en porte parfois
// plusieurs (`structuresStock.mjs` en porte 8), chacune se mesure pour elle-même. La CLÉ est une
// fonction LIBRE de l'appelant : elle seule sait ce que sa garde compare — `slotsStock` embarque
// l'occurrence dans la sienne, `manualDocsStock` compare des chemins nus. Un stock VIDE se sert
// comme les autres, sans court-circuit : un cliquet tenu à zéro est un cliquet, il rend ses `neuves`.
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
 * CLÉ NOMINATIVE d'une entrée ou d'un site : la famille quand la garde en distingue, le fichier, la
 * réf, et l'OCCURRENCE (ordinal du site parmi ses homonymes). Même clé des deux côtés de
 * `ecartsDeStock`. C'est la forme d'entrée de TOUT stock nominatif du dépôt — les stocks JSON de
 * `scripts/raw` (lus par `stockNominatif.mjs`) comme les stocks `.mjs` de gardes (`paletteLiteralStock.mjs`).
 * Ce que la clé EXCLUT : la ligne du FICHIER PORTEUR (celle où le site est écrit) — elle dérive à
 * chaque édition du fichier et rendrait la moitié du stock périmée à chaque commit.
 * Ce que la clé INCLUT, sur les volets à RÉF CITÉE (`reanchor-low`, `dead-refs`, `empty-line`,
 * `dead-code-refs`) : la ligne citée dans `Source/` (`LDB 07 l.43`), qui est l'identité même du site
 * et reste stable hors ré-extraction. Une RÉ-EXTRACTION Marker fait dériver ces lignes (CLAUDE.md
 * § Sources VF) — c'est l'événement pour lequel `reanchor.mjs` existe : le stock se renouvelle alors
 * EN BLOC (N périmées + N neuves pour zéro dette de plus) et se déclare comme tel.
 * La clé se CALCULE, elle ne s'ÉCRIT PAS sur le disque : ses séparateurs ` :: ` portent des espaces,
 * qu'aucun motif de chemin de `stocksNominatifs.mjs` n'admet — une clé gravée en littéral serait
 * INVISIBLE à la porte de plage (mesuré le 2026-09-14 : forme `Set` de clés, 0 entrée vue sur 2, `[]`
 * à l'append ; forme `{ fichier, ref, occurrence }`, 2 vues sur 2 et `net 1`). Ce qu'un stock grave,
 * c'est l'ENTRÉE ; la clé n'en est que la comparaison.
 * @param {{ famille?: string, fichier: string, ref: string, occurrence: number }} e
 */
export const cleDeSite = (e) => [e.famille ?? '', e.fichier, e.ref, e.occurrence].join(' :: ');

/**
 * Sites OBSERVÉS → entrées NOMINALES. L'occurrence est l'ordinal du site parmi ceux qui partagent la
 * même (famille, fichier, réf), dans l'ordre du balayage.
 * ANGLE MORT DIT : quand un fichier porte DEUX fois la même réf et que la PREMIÈRE se corrige, la
 * seconde descend de l'occurrence 2 à la 1 — l'écart rend alors une périmée ET une neuve pour un seul
 * geste. Le cliquet reste juste (le solde doit se déclarer), sa phrase est seulement plus bavarde.
 * MÊME ANGLE MORT PAR RÉ-ORDINALISATION : l'ordinal suit l'ORDRE DU BALAYAGE, donc insérer un
 * paragraphe AVANT une réf homonyme dans le même fichier échange les ordinaux de deux sites pourtant
 * inchangés — une paire neuve/périmée fantasme un geste qui n'a pas eu lieu. Portée mesurée le
 * 2026-09-12 : latent sur `reanchor-low` (21 entrées, toutes à l'occurrence 1) ; atteignable sur
 * `empty-line-code-refs` (occurrence 2) et `graphy` (jusqu'à 8), qui portent des homonymes.
 * Le `nombre` d'un site (ses occurrences dans le fichier) passe à l'entrée HORS CLÉ (`cleDeSite`).
 * @param {{ file: string, ref: string, nombre?: number }[]} sites @param {{ famille?: string }} [p]
 */
export function sitesEnEntrees(sites, { famille } = {}) {
  const vus = new Map();
  return sites.map(({ file, ref, nombre }) => {
    const k = [famille ?? '', file, ref].join(' :: ');
    const occurrence = (vus.get(k) ?? 0) + 1;
    vus.set(k, occurrence);
    return { famille, fichier: file, ref, occurrence, ...(nombre == null ? {} : { nombre }) };
  });
}

/**
 * SURVIE d'une ÉCHÉANCE à une RÉGÉNÉRATION de stock — seule définition du dépôt (#1820), consommée
 * par les deux régénérateurs datés (`scripts/raw/check-source-tables.mjs`,
 * `scripts/raw/check-source-format.mjs`).
 * `ancien` (les entrées déjà committées) fait SURVIVRE, à CLÉ IDENTIQUE, ce qu'un humain a posé sur
 * l'entrée : son échéance (`lot`, `date` — un site inchangé garde la date à laquelle il a été
 * qualifié, une régénération ne rajeunit pas une dette) et sa `preuve` (le site a été tranché au
 * PDF). Un site NEUF prend le lot et la date du run, et ne porte rien d'autre ; un site dont le
 * `nombre` a GRANDI (`accru`) aussi : sa croissance est une dette neuve, datée par le lot du run.
 * L'ORDRE et la FORME rendus sont ceux de `mesurees` : la survie ne réordonne ni n'ajoute une clé
 * que l'ancienne entrée ne portait pas (une `preuve` absente de `vieux` ne s'écrit pas).
 * @template {Record<string, unknown>} E
 * @param {Iterable<E>} mesurees entrées MESURÉES (clé nominative déjà posée par `sitesEnEntrees`)
 * @param {{ lot: string, date: string, ancien?: Iterable<object> }} p
 * @returns {(E & { lot: string, date: string })[]}
 */
export function survieDeLecheance(mesurees, { lot, date, ancien = [] }) {
  const parCle = new Map();
  for (const e of ancien) parCle.set(cleDeSite(e), e);
  return [...mesurees].map((e) => {
    const tenu = parCle.get(cleDeSite(e));
    const vieux = tenu && !accru(e, tenu) ? tenu : undefined;
    const sortie = { ...e, lot: vieux?.lot ?? lot, date: vieux?.date ?? date };
    if (vieux?.preuve !== undefined) sortie.preuve = vieux.preuve;
    return sortie;
  });
}

/** Le LOT passé en ligne de commande (`--lot <#N …>`), ou `null`. PURE. */
function lotDeLaLigne(args) {
  const i = args.indexOf('--lot');
  const v = i >= 0 ? String(args[i + 1] ?? '').trim() : '';
  return v && !v.startsWith('--') ? v : null;
}

/** Le `nombre` mesuré de `mesure` dépasse-t-il celui de son entrée `tenue` ? Sans nombre : non. PURE. */
const accru = (mesure, tenue) => mesure.nombre != null && tenue.nombre != null && mesure.nombre > tenue.nombre;

/**
 * RÉGÉNÉRATION d'un stock nominatif SOUS LOT — seule définition du dépôt, appelée par les
 * régénérateurs datés (`check-source-format.mjs`, `check-source-puces.mjs`, `check-source-tables.mjs`).
 * Un régénérateur n'étiquette JAMAIS seul : une entrée NEUVE ou ACCRUE (sans lot survivant,
 * `survieDeLecheance`) exige le lot du chantier en argument, `--lot <#N …>` ; sans lui, RIEN n'est
 * écrit et le refus nomme la première. Les entrées existantes gardent le leur. PURE hors `ecrire`,
 * INJECTÉ (le banc n'écrit rien).
 * @param {string[]} args @param {(lot: string | null, date: string) => { entrees: { lot?: string | null }[], texte: string }} rendre
 * @param {(texte: string) => void} ecrire @param {string} ou @param {string} [date]
 * @returns {{ code: 0 | 1, message: string }}
 */
export function ecrireStockSousLot(args, rendre, ecrire, ou, date = new Date().toISOString().slice(0, 10)) {
  const lot = lotDeLaLigne(args);
  const { entrees, texte } = rendre(lot, date);
  const neuves = entrees.filter((e) => !e.lot);
  if (neuves.length) {
    return { code: 1, message: `${ou} : ${neuves.length} entrée(s) NEUVE(s) ou ACCRUE(s) sans lot — passer \`--lot <#N …>\`, rien n'est écrit. Première : ${cleDeSite(neuves[0])}` };
  }
  ecrire(texte);
  return { code: 0, message: `stock écrit : ${ou} — ${entrees.length} entrée(s)` };
}

/** La clé d'une entrée, ou l'entrée elle-même en JSON compact quand cette clé ne NOMME rien. Une
 *  entrée sans `fichier` ni `ref` (faute de saisie, champ renommé, entrée bidon) rend une clé réduite
 *  à ses séparateurs (` ::  ::  :: `) : le refus désigne alors une entrée que le lecteur ne peut pas
 *  retrouver dans son stock. Le JSON de l'entrée est ce qui la localise. */
const cleOuEntree = (cle, entree) => (entree?.fichier || entree?.ref ? cle : JSON.stringify(entree));

/**
 * VERDICT d'un volet à stock nominatif : les deux sens, en phrases prêtes à afficher. Le calcul est
 * celui de `ecartsDeStock` ; ce qui vit ici est le REMÈDE — ce que le lecteur doit faire de chaque
 * ligne. Le PLAFOND n'y est pas : il vit dans le test de la garde.
 * ANGLE MORT DIT, À LA PORTE DE PLAGE : un ÉCHANGE EN PLACE à total constant — réécrire le `fichier`
 * ou la `ref` d'une entrée existante pour couvrir un site neuf pendant qu'un autre est soldé, dans le
 * MÊME commit — rend `[]` à `croissanceDesStocks` : le stock ne peut pas CROÎTRE ainsi, mais ce solde
 * et ce neuf ne se déclarent pas. Cette garde-ci, elle, les voit toujours (la clé a changé des deux
 * côtés) : c'est la SUITE qui tient ce cas, pas la porte de plage.
 * @param {{ sites: {file: string, ref: string}[], stock: Iterable<object>, famille?: string, ou?: string }} p
 *   `ou` nomme le fichier de stock dans le remède.
 */
export function ecartDuVolet({ sites, stock, famille, ou }) {
  const observe = sitesEnEntrees(sites, { famille });
  const tenues = [...stock];
  const ecart = ecartsDeStock({
    observe,
    stock: tenues,
    cle: cleDeSite,
    remede: {
      neuve: (k) => `${k} — site NEUF : corriger la réf, ou déclarer une entrée dans ${ou} et la porter au message par \`CLIQUET:\`.`,
      perimee: (k, e) => `${cleOuEntree(k, e)} — entrée SOLDÉE : le site a disparu, retirer cette entrée de ${ou}.`,
    },
  });
  return { ...ecart, neuves: [...ecart.neuves, ...nombresAccrus(observe, tenues, ou)] };
}

/**
 * CLIQUET du `nombre` (occurrences d'un site, hors clé) : un site dont le nombre MESURÉ dépasse celui
 * de son entrée en stock est une dette qui GRANDIT — une ligne de remède, rendue parmi les neuves.
 * Plus petit : la régénération recale le stock (`survieDeLecheance` garde le nombre mesuré) ; plus
 * grand, elle exige un `--lot` (`ecrireStockSousLot`) ; égal ou sans nombre : rien. PURE.
 * @param {Iterable<object>} observe entrées mesurées @param {Iterable<object>} stock @param {string} [ou]
 * @returns {string[]}
 */
export function nombresAccrus(observe, stock, ou) {
  const tenues = new Map();
  for (const e of stock) if (!tenues.has(cleDeSite(e))) tenues.set(cleDeSite(e), e);
  const out = [];
  for (const e of observe) {
    const tenue = tenues.get(cleDeSite(e));
    if (tenue && accru(e, tenue))
      out.push(`${cleDeSite(e)} — nombre ${e.nombre} > ${tenue.nombre} en stock : la dette GRANDIT, corriger le site (${ou}).`);
  }
  return out;
}

/**
 * REFUS d'un RÉGÉNÉRATEUR de stock : la phrase à afficher quand la MESURE porte un site que le stock
 * en place ne couvre pas, `null` quand elle n'en porte aucun. C'est la BARRIÈRE
 * DÉCROISSANT-SEULEMENT, en UNE lecture pour les quatre régénérateurs (`scripts/rig/regen-*-stock.mts`) :
 * deux lectures divergentes de « ce qui est neuf » laisseraient l'une écrire ce que l'autre refuse.
 * Le critère est l'ÉCART, jamais un TOTAL : à taille constante — une entrée soldée pendant qu'un site
 * neuf apparaît — les deux longueurs restent égales et le régénérateur entérinerait le site neuf en
 * silence, stock réécrit, garde verte (mesuré le 2026-09-14 sur le corpus réel :
 * `src/gameIso/rig/parts/tenues/defs/Apothicaire.ts :: apothicaire:torse:front :: 1`).
 * Ce n'est PAS un verdict au sens de l'en-tête : aucun `expect`, aucun `throw`, aucun exit — la
 * phrase est rendue, l'appelant décide ce qu'il en fait, comme des lignes de `ecartDuVolet`.
 * @param {Iterable<*>} mesurees ce que la mesure porte AUJOURD'HUI
 * @param {Iterable<*>} stock le stock EN PLACE
 * @param {{ cle?: (entree: *) => string, nom: string, motif: string }} p `cle` défaut `cleDeSite`
 *   (un stock à clé nue fournit la sienne) ; `nom` = la collection nommée dans la phrase ; `motif` =
 *   la dernière phrase, propre au volet — ce que le lecteur doit faire du site neuf.
 * @returns {string | null}
 */
export function refusDeCroissance(mesurees, stock, { cle = cleDeSite, nom, motif }) {
  const { neuves, taille } = ecartsDeStock({ observe: mesurees, stock, cle });
  if (neuves.length === 0) return null;
  return `REFUS : ${nom} porte ${neuves.length} site(s) MESURÉ(s) hors du stock en place (${taille} entrée(s)).\n`
    + `Cet outil ne peut qu'écrire un stock PLUS PETIT :\n  ${[...neuves].sort().join('\n  ')}\n\n${motif}`;
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
 * COUVERTURE d'un stock nominatif PAR LE BALAYAGE qui l'alimente, en deux listes NOMMÉES — ce que
 * `ecartsDeStock` (et tout cliquet à la main) ne peut pas dire : un écart se calcule sur ce qui est
 * PRÉSENTÉ, et un balayage amputé présente moins d'entrées, donc moins d'écarts, donc un vert. Même
 * trou que le REFUS DU VIDE de `sourceCorpus.mjs`, une marche plus bas : le balayage peut être NON
 * vide et pourtant avoir perdu un GISEMENT entier (un des dossiers que le cliquet prétend juger) ou
 * le fichier même d'une entrée de stock — la moitié RATCHET de `LABEL_LITERAL_STOCK` a vécu ainsi,
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
 * Windows `\`) n'est peuplé par rien et sort ÉTERNELLEMENT muet. Fail-loud assumé : le rouge nomme le
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
 * @param {Iterable<[string, { lot?: string, date?: string }]>} stock paires `[nom, qualification]`
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
