// PRIMITIVE DE CLIQUET : les trois calculs que chaque garde à stock refaisait à la main — l'ÉCART au
// stock (entrées neuves / entrées périmées), les CHAMPS que la clé n'observe pas, les LIGNES sans
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
//   - jamais de MÉMOÏSATION : un cache posé ici survivrait au worker (même raison qu'en tête de
//     `sourceCorpus.mjs` ; la durée de vie utile n'est connue que de l'appelant).

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Longueur minimale d'une RAISON écrite à la main — motif d'un `CLIQUET:`, `raison` d'une entrée du
 *  registre des stocks, raison d'une dérogation au pre-push. Sous ce seuil, c'est un tampon. Un
 *  seuil par site en aurait fait trois qui divergent : la loi du cliquet vit ici. */
export const MOTIF_MIN = 20

/**
 * Écart d'une collection OBSERVÉE à son STOCK, dans les DEUX sens.
 * @template O, S
 * @param {{ observe: Iterable<O>, stock: Iterable<S>, cle: (entree: O | S) => string,
 *   remede?: { neuve?: (cle: string, entree: O) => string, perimee?: (cle: string) => string } }} p
 *   `remede` décore les lignes rendues (défaut : la clé nue).
 * @returns {{ neuves: string[], perimees: string[], taille: number }} `taille` = clés DISTINCTES du
 *   stock — de quoi confronter un plafond, que l'appelant seul détient.
 */
export function ecartsDeStock({ observe, stock, cle, remede = {} }) {
  const vues = new Map();
  for (const e of observe) {
    const k = cle(e);
    if (!vues.has(k)) vues.set(k, e);
  }
  const tenues = new Set();
  for (const e of stock) tenues.add(cle(e));
  const neuves = [...vues]
    .filter(([k]) => !tenues.has(k))
    .map(([k, e]) => (remede.neuve ? remede.neuve(k, e) : k));
  const perimees = [...tenues]
    .filter((k) => !vues.has(k))
    .map((k) => (remede.perimee ? remede.perimee(k) : k));
  return { neuves, perimees, taille: tenues.size };
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
