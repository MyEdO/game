/**
 * INVENTAIRE DE LA DETTE QUE LA DONNÉE RÉVÈLE (#3021, #2995) : les formes historiques ou divergentes, les orphelines,
 * les homonymes, les divergences d'enveloppe hors `source` absente (celle-ci est le volet `DETTE_ENVELOPPE`), les
 * couples de référence sans slot et les clés déclarées jamais portées, mesurés sur la donnée des deux racines
 * (`scanDuCorpus`, `scripts/docs/lib/structures-scan.mts`). HORS DE LA PORTE : ni stock commis, ni règle de plage, ni
 * refus — ajouter ou retirer une donnée change l'inventaire, jamais le verdict d'une garde. La dette qu'un changement de
 * CODE fait naître est jugée sous la porte (`SOUS_LA_PORTE`, `occurrencesStock.mjs`) ; un chemin de schéma `idDe` qui
 * cesse de l'être l'est par le plancher `FEUILLES_D_ID`.
 *
 * Une ligne : sa collection, son site, la cible qui la solde, son lot (déduit par `lotDeForme` ou `LOT_CLE_RESERVEE`,
 * `scripts/docs/lib/structures-lexique.mts`, par rôle pour l'enveloppe, `—` sans déduction) et ses occurrences
 * (indicatives). Le total par collection se rend dans le résumé du job CI (`comptes:plage`,
 * `scripts/guards/comptes-plage.mts`), dans `docs/structures-donnees.md` §7 et dans le rapport daté de chaque audit de
 * dette (`docs/plans/`).
 *
 * ANGLES MORTS (`ANGLES_MORTS_DE_L_INVENTAIRE`), fermés par le lot L4 de #1463 : un champ NEUF en chaîne nue rempli
 * d'ids ; une forme historique que la donnée cesse d'utiliser alors que son nœud l'admet encore.
 */
import { scanDuCorpus } from '../../docs/lib/structures-scan.mjs';
import { champsSansSlot, slotsDuParse } from '../../docs/lib/slots-registre.mjs';
import { LOT_CLE_RESERVEE, ciblesDuSite, lotDeForme } from '../../docs/lib/structures-lexique.mjs';
import { CLES_ENVELOPPE } from '../../../src/data/schemas/grammaire/document';
import { parUnitesDeCode } from './lister.mjs';

/** Ce que l'inventaire lit d'un scan du corpus (`scanDuCorpus`). */
export type CorpusDInventaire = Pick<ReturnType<typeof scanDuCorpus>, 'scan' | 'defs' | 'declares'>;

/** Une ligne de l'inventaire ; `occurrences` vaut `null` pour une collection qui ne compte pas. */
export type LigneDInventaire = {
  readonly collection: string;
  readonly site: string;
  readonly cible: string;
  readonly lot: string;
  readonly occurrences: number | null;
};

/** Le lot d'une ligne sans déduction. */
export const SANS_LOT = '—';

/** Les angles morts de l'inventaire, déclarés en tête de son rendu. */
export const ANGLES_MORTS_DE_L_INVENTAIRE: readonly string[] = [
  'Un champ NEUF en chaîne nue rempli d’ids ne refuse aucune plage : il entre à l’inventaire (`STRUCTURES_FORMES`, `SLOTS_SANS_DECLARATION`) sans qu’aucune garde ne rougisse, la dette naît au code sans être jugée (L4 #1463, resserrement par construction).',
  'Une forme HISTORIQUE que la donnée cesse d’utiliser sort de l’inventaire alors que son nœud de schéma l’admet encore : la dette du schéma reste sans site, et la donnée peut la réintroduire sans qu’aucune garde ne rougisse (L4 #1463, table concept → nœuds cibles).',
];

/**
 * Les clés que `document()` pose sur tout document sans qu'un def les demande (`CLES_ENVELOPPE`), hors `variants`, que
 * la fabrique ne pose qu'à la demande du def (`options.variantes`, `document.ts`).
 */
export const CLES_POSEES_INCONDITIONNELLEMENT: readonly string[] = (CLES_ENVELOPPE as readonly string[]).filter((k) => k !== 'variants');

/** Les clés DÉCLARÉES par le schéma d'un document et portées par aucune de ses entrées (`clesPortees`), hors `exclues`. */
export function clesDeclareesJamaisPortees(
  { scan, declares }: Pick<CorpusDInventaire, 'scan' | 'declares'>,
  exclues: readonly string[] = CLES_POSEES_INCONDITIONNELLEMENT,
): { dataset: string; cle: string }[] {
  const parFichier = new Map(declares.map((d) => [d.file, d]));
  return scan.documents.flatMap((d) => {
    const dec = parFichier.get(d.nom);
    const vues = scan.clesPortees.get(d.nom);
    if (!dec || !vues) return [];
    return Object.keys(dec.cles).filter((k) => !vues.has(k) && !exclues.includes(k)).sort().map((cle) => ({ dataset: d.nom, cle }));
  });
}

const cibleDeForme = (f: { concept: string; dataset: string; champ: string }): string => {
  const cibles = ciblesDuSite(f.concept, f.dataset, f.champ);
  return cibles.length
    ? `Migrer ce site vers une forme CIBLE du lexique (${cibles.map((c) => `\`${c}\``).join(', ')} ; scripts/docs/lib/structures-lexique.mts).`
    : 'Aucune cible déclarée à ce site : décider la cible (lexique + `STRUCTURES_CIBLES`) ou bloquer le lot sur sa migration.';
};

type CollectionDInventaire = { readonly nom: string; readonly mesure: (corpus: CorpusDInventaire) => Omit<LigneDInventaire, 'collection'>[] };

/** Les collections de l'inventaire, dans leur ordre de rendu. */
export const INVENTAIRE: readonly CollectionDInventaire[] = [
  {
    nom: 'STRUCTURES_FORMES',
    mesure: ({ scan }) => scan.formes.filter((f) => f.statut === 'historique' || f.statut === 'divergente').map((f) => ({
      site: `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature}`,
      cible: cibleDeForme(f),
      lot: lotDeForme(f.concept, f.signature, f.cibles),
      occurrences: f.occurrences,
    })),
  },
  {
    nom: 'STRUCTURES_ORPHELINES',
    mesure: ({ scan }) => scan.orphelines.map((o) => ({
      site: `${o.dataset} | ${o.champ} | ${o.signature}`,
      cible: `${o.motif} : la clé qui annonce une référence porte une référence qui résout, ou change de nom (#1463 S2).`,
      lot: o.motif === 'clé de référence non résolue' ? 'L1a #1466' : '#1553',
      occurrences: o.occurrences,
    })),
  },
  {
    nom: 'STRUCTURES_HOMONYMES',
    mesure: ({ scan }) => scan.homonymes.map((h) => ({
      site: h.cle,
      cible: `Réserver \`${h.cle}\` à son type (classes observées : ${h.classes.join(', ')}) : la valeur hors concept change de clé (#1463 S2).`,
      lot: LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463',
      occurrences: h.total,
    })),
  },
  {
    nom: 'STRUCTURES_ENVELOPPE',
    mesure: ({ scan }) => scan.enveloppe.filter((e) => !(e.role === 'source' && e.motif === 'clé absente')).map((e) => ({
      site: `${e.role} | ${e.cle} | ${e.motif}${e.motif === 'type divergent' ? ` (${e.detail})` : ''} | ${e.document} › ${e.chemin}`,
      cible: `Porter le rôle \`${e.role}\` sous sa clé cible \`${e.cle}\`, de son type, sur chaque entrée (\`ROLES_ENVELOPPE\`, \`mesurerEnveloppe\`).`,
      lot: e.role === 'source' ? 'L1d #1469' : 'L1b #1467',
      occurrences: e.entrees,
    })),
  },
  {
    nom: 'SLOTS_SANS_DECLARATION',
    mesure: ({ scan, defs }) => champsSansSlot(scan, slotsDuParse(scan, defs)).map((c) => ({
      site: `${c.dataset} | ${c.champ}`,
      cible: `Adopter la fabrique \`ref\`/\`refs\`/\`specRef\`/\`pick\` (\`idDe\`) sur le schéma du champ (${c.atteintes}/${c.occurrences} atteintes).`,
      lot: SANS_LOT,
      occurrences: c.occurrences,
    })),
  },
  {
    nom: 'STRUCTURES_DEFAUT',
    mesure: (corpus) => clesDeclareesJamaisPortees(corpus).map((d) => ({
      site: `${d.dataset} | ${d.cle}`,
      cible: 'Retirer le champ du schéma, ou écrire la donnée qui le porte ; un déclaré-avant-posé assumé porte un lot de peuplement (`LOTS_DE_PEUPLEMENT`).',
      lot: SANS_LOT,
      occurrences: null,
    })),
  },
];

/** L'inventaire d'un corpus : chaque collection de `INVENTAIRE`, ses lignes triées par site. */
export const inventaireDe = (corpus: CorpusDInventaire): LigneDInventaire[] =>
  INVENTAIRE.flatMap((c) => c.mesure(corpus).map((l) => ({ collection: c.nom, ...l })).sort((a, b) => parUnitesDeCode(a.site, b.site)));

/** L'inventaire de la racine `root`. */
export function inventaireDeLaRacine(root: string): LigneDInventaire[] {
  const { scan, defs, declares } = scanDuCorpus(root);
  return inventaireDe({ scan, defs, declares });
}

/** Le total de chaque collection de `INVENTAIRE` : ses sites et ses occurrences (`null` quand elle ne compte pas). */
export const totauxDeLInventaire = (lignes: readonly LigneDInventaire[]): { collection: string; sites: number; occurrences: number | null }[] =>
  INVENTAIRE.map(({ nom }) => {
    const siens = lignes.filter((l) => l.collection === nom);
    return {
      collection: nom,
      sites: siens.length,
      occurrences: siens.some((l) => l.occurrences === null) ? null : siens.reduce((a, l) => a + (l.occurrences ?? 0), 0),
    };
  });

const echappe = (s: string): string => s.replace(/\|/g, '\\|');

/** L'inventaire en Markdown : ses angles morts, ses totaux par collection, puis, avec `detail`, une table par collection. */
export function rendreInventaire(lignes: readonly LigneDInventaire[], { detail = true }: { detail?: boolean } = {}): string {
  let out = 'Inventaire hors de la porte (#3021) : la donnée y entre et en sort sans faire rougir aucune garde.\n\n';
  out += 'Angles morts déclarés :\n\n' + ANGLES_MORTS_DE_L_INVENTAIRE.map((a) => `- ${a}`).join('\n') + '\n\n';
  out += '| Collection | Sites | Occurrences |\n|---|---|---|\n';
  for (const t of totauxDeLInventaire(lignes)) out += `| \`${t.collection}\` | ${t.sites} | ${t.occurrences ?? '—'} |\n`;
  if (!detail) return out;
  for (const { nom } of INVENTAIRE) {
    const siens = lignes.filter((l) => l.collection === nom);
    if (!siens.length) continue;
    out += `\n### \`${nom}\`\n\n| Site | Lot | Occurrences | Cible |\n|---|---|---|---|\n`;
    for (const l of siens) out += `| \`${echappe(l.site)}\` | ${echappe(l.lot)} | ${l.occurrences ?? '—'} | ${echappe(l.cible)} |\n`;
  }
  return out;
}
