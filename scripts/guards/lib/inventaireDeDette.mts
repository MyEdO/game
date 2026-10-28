/**
 * INVENTAIRE DE LA DETTE QUE LA DONNÉE RÉVÈLE (#3021, #2995) : les cases de référence en forme non cible ou sans slot
 * (une ligne par case), les formes de valeur historiques ou divergentes, les orphelines, les homonymes, les divergences
 * d'enveloppe hors `source` absente (celle-ci est le volet `DETTE_ENVELOPPE`) et les clés déclarées jamais portées,
 * mesurés sur la donnée des deux racines (`scanDuCorpus`, `scripts/docs/lib/structures-scan.mts`). HORS DE LA PORTE :
 * ni stock commis, ni règle de plage, ni refus — ajouter ou retirer une donnée change l'inventaire, jamais le verdict
 * d'une garde. La dette qu'un changement de CODE fait naître est jugée sous la porte (`SOUS_LA_PORTE`,
 * `occurrencesStock.mjs`) ; un chemin de schéma `idDe` qui cesse de l'être l'est par le plancher `FEUILLES_D_ID`.
 *
 * Une ligne : sa collection, son site, la cible qui la solde, son lot (déduit par `lotDeForme` ou `LOT_CLE_RESERVEE`,
 * `scripts/docs/lib/structures-lexique.mts`, par rôle pour l'enveloppe, `—` sans déduction) et ses occurrences, comptées
 * dans l'unité que sa collection déclare (`unite`) et rendue avec elle. Le total par collection se rend dans le résumé du job CI (`comptes:plage`,
 * `scripts/guards/comptes-plage.mts`), dans `docs/structures-donnees.md` §7 et dans le rapport daté de chaque audit de
 * dette (`docs/plans/`). Angles morts : `ANGLES_MORTS_DE_L_INVENTAIRE`.
 */
import { scanDuCorpus, type FormeObservee } from '../../docs/lib/structures-scan.mjs';
import { occurrencesNonAtteintes, slotsDuParse } from '../../docs/lib/slots-registre.mjs';
import { LOTS_CONNUS, LOT_CLE_RESERVEE, ciblesDuSite, lotDeForme } from '../../docs/lib/structures-lexique.mjs';
import { CLES_ENVELOPPE } from '../../../src/data/schemas/grammaire/document';
import { parUnitesDeCode } from './lister.mjs';

/** Ce que l'inventaire lit d'un scan du corpus (`scanDuCorpus`). */
export type CorpusDInventaire = Pick<ReturnType<typeof scanDuCorpus>, 'scan' | 'defs' | 'declares'>;

/** Une ligne de l'inventaire ; `occurrences` se compte dans l'`unite` de sa collection, et vaut `null` pour une collection qui ne compte pas. */
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
  'Un champ NEUF en chaîne nue rempli d’ids ne refuse aucune plage : il entre à l’inventaire (`CASES_DE_REFERENCE`) sans qu’aucune garde ne rougisse, la dette naît au code sans être jugée (L4 #1463, resserrement par construction).',
  'Une forme HISTORIQUE que la donnée cesse d’utiliser sort de l’inventaire alors que son nœud de schéma l’admet encore : la dette du schéma reste sans site, et la donnée peut la réintroduire sans qu’aucune garde ne rougisse (L4 #1463, table concept → nœuds cibles).',
  'Une CASE de `CASES_DE_REFERENCE` est un couple (dataset, champ) : `champ` est la clé qui porte la référence, pas son chemin de schéma, et deux positions de schéma de même clé dans un document partagent une ligne (L3 #1463, site par nœud de schéma).',
  'Une occurrence de référence SANS CASE (`{random:N}`, `{choice:[…]}`) n’entre à `CASES_DE_REFERENCE` que par sa forme : aucun slot ne peut l’atteindre (`ANGLES_MORTS_SLOTS`, `scripts/docs/lib/structures-lexique.mts`).',
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

/** Une forme que l'inventaire porte : ni `cible`, ni `declaree`. */
const enDette = (statut: FormeObservee['statut']): boolean => statut === 'historique' || statut === 'divergente';

const cleDeCase = (c: { dataset: string; champ: string }): string => `${c.dataset} | ${c.champ}`;

/** Le remède d'un site de formes à migrer, sans point final. */
const remedeDeForme = (formes: readonly FormeObservee[]): string => {
  const { dataset, champ } = formes[0];
  const cibles = [...new Set(formes.flatMap((f) => ciblesDuSite(f.concept, dataset, champ)))];
  return cibles.length
    ? `Migrer ce site vers une forme CIBLE du lexique (${cibles.map((c) => `\`${c}\``).join(', ')} ; scripts/docs/lib/structures-lexique.mts)`
    : 'Aucune cible déclarée à ce site : décider la cible (lexique + `STRUCTURES_CIBLES`) ou bloquer le lot sur sa migration';
};

/** Le lot qui éteint une case : le dernier, dans l'ordre de `LOTS_CONNUS`, de ceux que `lotDeForme` déduit de `formes`. */
const lotDeCase = (formes: readonly FormeObservee[]): string => {
  const rang = (l: string) => (LOTS_CONNUS as readonly string[]).indexOf(l);
  return formes.map((f) => lotDeForme(f.concept, f.signature, f.cibles)).sort((a, b) => rang(b) - rang(a))[0] ?? SANS_LOT;
};

type CollectionDInventaire = {
  readonly nom: string;
  /** Ce que compte `occurrences` d'une ligne, rendu avec le total. */
  readonly unite: string;
  readonly mesure: (corpus: CorpusDInventaire) => Omit<LigneDInventaire, 'collection'>[];
};

/** Les collections de l'inventaire, dans leur ordre de rendu. */
export const INVENTAIRE: readonly CollectionDInventaire[] = [
  {
    nom: 'CASES_DE_REFERENCE',
    unite: 'occurrence en forme non cible ou non atteinte, comptée une fois',
    mesure: ({ scan, defs }) => {
      const { avecCase, manquees } = occurrencesNonAtteintes(scan, slotsDuParse(scan, defs));
      const formes = new Map<string, FormeObservee[]>();
      for (const f of scan.formes) if (f.strate === 'Référence') formes.set(cleDeCase(f), [...(formes.get(cleDeCase(f)) ?? []), f]);
      const cases = new Map<string, { dette: number; aCase: number; atteintes: number }>();
      for (const o of scan.occurrencesDeReference) {
        const c = cases.get(cleDeCase(o)) ?? { dette: 0, aCase: 0, atteintes: 0 };
        cases.set(cleDeCase(o), c);
        if (enDette(o.statut) || manquees.has(o)) c.dette += 1;
        if (avecCase.has(o)) c.aCase += 1;
        if (avecCase.has(o) && !manquees.has(o)) c.atteintes += 1;
      }
      return [...cases].filter(([, c]) => c.dette > 0).map(([site, c]) => {
        const siennes = formes.get(site)!;
        const aMigrer = siennes.filter((f) => enDette(f.statut));
        const sansSlot = c.atteintes < c.aCase;
        const remedes = [
          ...(aMigrer.length ? [`${remedeDeForme(aMigrer)} : ${aMigrer.map((f) => `\`${f.signature}\` ${f.statut} ×${f.occurrences}`).join(', ')}.`] : []),
          ...(sansSlot ? [`Adopter la fabrique \`ref\`/\`refs\`/\`specRef\`/\`pick\` (\`idDe\`) sur le schéma du champ (${c.atteintes}/${c.aCase} atteintes).`] : []),
        ];
        return { site, cible: remedes.join(' '), lot: lotDeCase(sansSlot ? siennes : aMigrer), occurrences: c.dette };
      });
    },
  },
  {
    nom: 'STRUCTURES_FORMES',
    unite: 'occurrence de la forme',
    mesure: ({ scan }) => scan.formes.filter((f) => f.strate !== 'Référence' && enDette(f.statut)).map((f) => ({
      site: `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature}`,
      cible: `${remedeDeForme([f])}.`,
      lot: lotDeForme(f.concept, f.signature, f.cibles),
      occurrences: f.occurrences,
    })),
  },
  {
    nom: 'STRUCTURES_ORPHELINES',
    unite: 'occurrence de la signature',
    mesure: ({ scan }) => scan.orphelines.map((o) => ({
      site: `${o.dataset} | ${o.champ} | ${o.signature}`,
      cible: `${o.motif} : la clé qui annonce une référence porte une référence qui résout, ou change de nom (#1463 S2).`,
      lot: o.motif === 'clé de référence non résolue' ? 'L1a #1466' : '#1553',
      occurrences: o.occurrences,
    })),
  },
  {
    nom: 'STRUCTURES_HOMONYMES',
    unite: 'occurrence de la clé, toutes classes',
    mesure: ({ scan }) => scan.homonymes.map((h) => ({
      site: h.cle,
      cible: `Réserver \`${h.cle}\` à son type (classes observées : ${h.classes.join(', ')}) : la valeur hors concept change de clé (#1463 S2).`,
      lot: LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463',
      occurrences: h.total,
    })),
  },
  {
    nom: 'STRUCTURES_ENVELOPPE',
    unite: 'entrée du document',
    mesure: ({ scan }) => scan.enveloppe.filter((e) => !(e.role === 'source' && e.motif === 'clé absente')).map((e) => ({
      site: `${e.role} | ${e.cle} | ${e.motif}${e.motif === 'type divergent' ? ` (${e.detail})` : ''} | ${e.document} › ${e.chemin}`,
      cible: `Porter le rôle \`${e.role}\` sous sa clé cible \`${e.cle}\`, de son type, sur chaque entrée (\`ROLES_ENVELOPPE\`, \`mesurerEnveloppe\`).`,
      lot: e.role === 'source' ? 'L1d #1469' : 'L1b #1467',
      occurrences: e.entrees,
    })),
  },
  {
    nom: 'STRUCTURES_DEFAUT',
    unite: '— (ne compte pas)',
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

/** Le total de chaque collection de `INVENTAIRE` : ses sites et ses occurrences dans son `unite` (`null` quand elle ne compte pas). */
export const totauxDeLInventaire = (
  lignes: readonly LigneDInventaire[],
): { collection: string; sites: number; occurrences: number | null; unite: string }[] =>
  INVENTAIRE.map(({ nom, unite }) => {
    const siens = lignes.filter((l) => l.collection === nom);
    return {
      collection: nom,
      unite,
      sites: siens.length,
      occurrences: siens.some((l) => l.occurrences === null) ? null : siens.reduce((a, l) => a + (l.occurrences ?? 0), 0),
    };
  });

const echappe = (s: string): string => s.replace(/\|/g, '\\|');

/** L'inventaire en Markdown : ses angles morts, ses totaux par collection, puis, avec `detail`, une table par collection. */
export function rendreInventaire(lignes: readonly LigneDInventaire[], { detail = true }: { detail?: boolean } = {}): string {
  let out = 'Inventaire hors de la porte (#3021) : la donnée y entre et en sort sans faire rougir aucune garde.\n\n';
  out += 'Angles morts déclarés :\n\n' + ANGLES_MORTS_DE_L_INVENTAIRE.map((a) => `- ${a}`).join('\n') + '\n\n';
  out += '| Collection | Sites | Occurrences | Unité des occurrences |\n|---|---|---|---|\n';
  for (const t of totauxDeLInventaire(lignes)) out += `| \`${t.collection}\` | ${t.sites} | ${t.occurrences ?? '—'} | ${t.unite} |\n`;
  if (!detail) return out;
  for (const { nom, unite } of INVENTAIRE) {
    const siens = lignes.filter((l) => l.collection === nom);
    if (!siens.length) continue;
    out += `\n### \`${nom}\`\n\nOccurrences : ${unite}.\n\n| Site | Lot | Occurrences | Cible |\n|---|---|---|---|\n`;
    for (const l of siens) out += `| \`${echappe(l.site)}\` | ${echappe(l.lot)} | ${l.occurrences ?? '—'} | ${echappe(l.cible)} |\n`;
  }
  return out;
}
