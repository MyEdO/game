// FICHE DE DOSSIER DE CHAPITRE (#2290) — définition UNIQUE, pour l'app (`src/data/schemas/`, champ
// `couvre` du paquet de campagne) comme pour l'outillage (`scripts/raw/lib/dossiers.mjs`, chargeur des
// fiches commitées `docs/dossiers/<ABBR>/<NN>.json`).
//
// Module PUR, sans entrée/sortie : chargé tel quel par Node nu (retrait de types natif) comme par
// vitest et le navigateur. Le chemin de la fiche porte le livre et le chapitre : aucun champ ne les
// répète, ni rien de ce qui s'en dérive.
import { z } from 'zod';
import '../../lib/zodEnFrancais.ts';
import { tableTotale } from '../../lib/tableTotale.ts';

const MEDIAS = ['scene-jouee', 'dialogue', 'interlude', 'resume', 'coupe'] as const;
const TYPES_POINT_AU_MJ = ['veracite-rumeur', 'consequence-ouverte', 'rythme-deblocage', 'variante-pnj', 'encart-optionnel'] as const;
export const STATUTS_DE_BEAT = ['obligatoire', 'optionnel', 'non-qualifie'] as const;
const NATURES_DE_TEXTE = ['document-verbatim', 'motivation-a-authorer', 'narration-a-reformuler'] as const;
const SENS_D_ETAT = ['produit', 'lu'] as const;
const PORTEES_D_ETAT = ['chapitre', 'campagne'] as const;

// `.meta` porte dans la projection `z.toJSONSchema` (`famillesDeLaFiche`, `scripts/raw/workflow-args.mjs`) ce
// qu'un `.trim()` ou un `.refine` n'y projette pas : un texte blanc n'est pas un texte, un média ne se double pas.
const texte = z.string().trim().min(1).meta({ pattern: '\\S' });
/** Réfs NUES au livre, une par élément ; leur graphie se juge au chargement des fiches commitées
 *  (`scripts/raw/lib/dossiers.mjs`), leurs bornes aux scanners CITANTS (`scripts/raw/lib/fichiersCitants.mjs`). */
const refs = z.array(texte).min(1).describe('Réfs NUES au livre, une par élément : `<ABBR> <NN> l.<ligne>`, ligne lue sur le fichier Source/.');

/** Les familles de la fiche, dans l'ordre de rendu, chacune avec le préfixe de ses `id` et les
 *  attributs d'une entrée (hors `id` et `ref`, communs à toutes). Chaque attribut porte sa définition
 *  (`.describe`), projetée avec sa forme dans le schéma de l'agent qui le remplit. */
const FAMILLES = {
  imperatifs: { prefixe: 'imp', attributs: { texte: texte.describe('Ce que le livre rend indispensable : élément clé, indice à trouver, « doit absolument », contrainte posée pour la suite de la campagne.') } },
  beats: {
    prefixe: 'b',
    attributs: {
      titre: texte.describe("Une scène du chapitre, dans l'ordre du livre."),
      statut: z.enum(STATUTS_DE_BEAT).describe('Le statut TEL QUE LE LIVRE LE DIT : `obligatoire` ou `optionnel` quand un passage le qualifie, `non-qualifie` quand aucun ne le fait.'),
      preuveDuStatut: texte.describe("Le passage qui qualifie le beat ; pour `non-qualifie`, le constat qu'aucun ne le fait."),
      mediasCandidats: z.array(z.enum(MEDIAS)).min(1).refine((m) => new Set(m).size === m.length, 'médias en double').meta({ uniqueItems: true })
        .describe('TOUS les médias plausibles pour jouer ce beat, chacun une fois : on liste, on ne tranche pas.'),
    },
  },
  pointsAuMJ: {
    prefixe: 'mj',
    attributs: {
      texte: texte.describe('Un passage que le livre laisse à la décision du MJ (« à vous de décider », « si vous le désirez », alternatives, encarts).'),
      type: z.enum(TYPES_POINT_AU_MJ).describe(
        "Ce que le livre laisse au MJ : `veracite-rumeur` = la vérité d'une rumeur ou d'une information ; `consequence-ouverte` = l'issue d'un acte des PJ ; "
        + "`rythme-deblocage` = le moment, l'ordre ou la relance d'un élément ; `variante-pnj` = le comportement ou l'identité d'un PNJ ; "
        + '`encart-optionnel` = un encart ou une scène que le MJ joue ou non. Exemples : « heure d’arrivée modifiable, adapter les informations » '
        + 'est `rythme-deblocage`, le livre laisse le MOMENT et non l’issue ; « PNJ capturé : procès long, relâché sauf bonne raison » est '
        + '`consequence-ouverte`, l’ISSUE d’un acte des PJ reste au MJ.',
      ),
    },
  },
  indices: { prefixe: 'ind', attributs: { texte: texte.describe('Ce que les joueurs peuvent trouver et qui mène à un secret.') } },
  secrets: { prefixe: 'sec', attributs: { texte: texte.describe('Ce que le MJ sait et que les joueurs peuvent découvrir.') } },
  declencheurs: {
    prefixe: 'd',
    attributs: {
      evenement: texte.describe("Ce qui arrive à l'INITIATIVE d'un PNJ ou du monde, sans action des joueurs."),
      condition: texte.describe("La condition ou le délai TEL QUE LE LIVRE L'ÉCRIT (« s'ils l'ignorent, au bout d'une demi-heure »)."),
    },
  },
  pnj: {
    prefixe: 'pnj',
    attributs: {
      nom: texte.describe('Le nom du PNJ, ou sa description quand le livre ne le nomme pas.'),
      role: texte.describe('Son rôle dans le chapitre.'),
      motivation: texte.describe('Sa motivation telle que le livre la donne.'),
    },
  },
  lieux: { prefixe: 'lieu', attributs: { texte: texte.describe('Un lieu où une scène peut se jouer.') } },
  textes: {
    prefixe: 'txt',
    attributs: {
      texte: texte.describe('Un texte que le jeu devra montrer.'),
      nature: z.enum(NATURES_DE_TEXTE).describe(
        '`document-verbatim` = le livre en donne le texte (lettre, affiche, aide de jeu), il se recopie tel quel ; '
        + "`motivation-a-authorer` = le livre ne donne qu'une intention ou une motivation de PNJ, la réplique s'authore ; "
        + '`narration-a-reformuler` = une description ou une narration destinée au MJ, que le jeu reformule en texte lu à l’écran.',
      ),
    },
  },
  tests: {
    prefixe: 'test',
    attributs: {
      texte: texte.describe('Un Test que le livre demande ou propose.'),
      competence: texte.describe('La compétence ou la caractéristique testée.'),
      difficulte: texte.describe("La difficulté TELLE QUE LE LIVRE L'ÉCRIT."),
    },
  },
  rencontres: { prefixe: 'renc', attributs: { texte: texte.describe('Un combat ou une opposition : adversaires et effectifs.') } },
  recompenses: { prefixe: 'rec', attributs: { texte: texte.describe("Points d'expérience, argent, objets ou relations gagnés.") } },
  etats: {
    prefixe: 'etat',
    attributs: {
      texte: texte.describe('Une décision, une fin ou un drapeau que le chapitre produit ou lit.'),
      sens: z.enum(SENS_D_ETAT).describe("`produit` = le chapitre pose l'état ; `lu` = il l'hérite d'un chapitre ou d'un tome antérieur."),
      portee: z.enum(PORTEES_D_ETAT).describe("`chapitre` = l'état ne vit que dans ce chapitre ; `campagne` = la suite de la campagne le lit."),
    },
  },
  dureeEtDifficulte: { prefixe: 'dur', attributs: { texte: texte.describe('Ce que le livre dit de la durée et de la difficulté visées : séances, jours de jeu, dangerosité.') } },
  matiereCompagnons: {
    prefixe: 'comp',
    attributs: {
      texte: texte.describe("Une matière d'un chapitre de compagnon que ce chapitre-ci peut puiser."),
      categorie: texte.describe('Un mot : peage, pnj, scenario-annexe, lieu, regle, rencontre…'),
      pourCeChapitre: texte.describe("Où elle s'insère dans le chapitre : beat, lieu ou réf du chapitre."),
    },
  },
} as const;

type FamilleDeDossier = keyof typeof FAMILLES;
export const FAMILLES_DE_DOSSIER = Object.keys(FAMILLES) as FamilleDeDossier[];
export const PREFIXES_D_ID: Readonly<Record<FamilleDeDossier, string>> = tableTotale(FAMILLES_DE_DOSSIER, (f) => FAMILLES[f].prefixe);

/** Une entrée de la famille d'attributs `A` : `id` au préfixe de sa famille, ses attributs, `ref`. Les
 *  attributs passent en paramètre : étalés depuis une famille GÉNÉRIQUE, ils s'inféreraient comme l'union
 *  des attributs de toutes les familles. */
const entree = <A extends z.core.$ZodLooseShape>(famille: FamilleDeDossier, attributs: A) =>
  z.strictObject({
    id: z.string().regex(new RegExp(`^${FAMILLES[famille].prefixe}[1-9]\\d*$`), `id de ${famille} : « ${FAMILLES[famille].prefixe}<n> »`),
    ...attributs,
    ref: refs,
  });

/** Le tableau des entrées de `famille`, ses attributs lus dans `FAMILLES`. */
const tableau = <F extends FamilleDeDossier>(famille: F) => z.array(entree(famille, FAMILLES[famille].attributs as (typeof FAMILLES)[F]['attributs']));

const familles = {
  imperatifs: tableau('imperatifs'),
  beats: tableau('beats').min(1),
  pointsAuMJ: tableau('pointsAuMJ'),
  indices: tableau('indices'),
  secrets: tableau('secrets'),
  declencheurs: tableau('declencheurs'),
  pnj: tableau('pnj'),
  lieux: tableau('lieux'),
  textes: tableau('textes'),
  tests: tableau('tests'),
  rencontres: tableau('rencontres'),
  recompenses: tableau('recompenses'),
  etats: tableau('etats'),
  dureeEtDifficulte: tableau('dureeEtDifficulte'),
  matiereCompagnons: tableau('matiereCompagnons'),
} satisfies Record<FamilleDeDossier, z.ZodType>;

/** La fiche : provenance de la lecture, puis les quinze familles. Un `id` est unique dans la fiche. */
export const ficheDeDossier = z
  .strictObject({
    lecture: z.strictObject({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ'),
      commit: z.string().regex(/^[0-9a-f]{40}$/, 'commit : empreinte git complète'),
    }),
    ...familles,
  })
  .superRefine((fiche, ctx) => {
    const vus = new Set<string>();
    for (const famille of FAMILLES_DE_DOSSIER) {
      fiche[famille].forEach((e, i) => {
        if (vus.has(e.id)) ctx.addIssue({ code: 'custom', path: [famille, i, 'id'], message: `id « ${e.id} » en double dans la fiche` });
        vus.add(e.id);
      });
    }
  });

type FicheDeDossier = z.infer<typeof ficheDeDossier>;
/** Une entrée de la famille `F`. */
type EntreeDe<F extends FamilleDeDossier> = FicheDeDossier[F][number];

/** Nom d'affichage de chaque famille. */
export const LIBELLES_DE_FAMILLE: Readonly<Record<FamilleDeDossier, string>> = {
  imperatifs: 'Impératifs',
  beats: 'Beats',
  pointsAuMJ: 'Points au MJ',
  indices: 'Indices',
  secrets: 'Secrets',
  declencheurs: 'Déclencheurs',
  pnj: 'PNJ',
  lieux: 'Lieux',
  textes: 'Textes',
  tests: 'Tests',
  rencontres: 'Rencontres',
  recompenses: 'Récompenses',
  etats: 'États',
  dureeEtDifficulte: 'Durée et difficulté',
  matiereCompagnons: 'Matière des compagnons',
};

/** L'attribut qui NOMME une entrée, par famille. */
const LIBELLE_D_ENTREE: { readonly [F in FamilleDeDossier]: (e: EntreeDe<F>) => string } = {
  imperatifs: (e) => e.texte,
  beats: (e) => e.titre,
  pointsAuMJ: (e) => e.texte,
  indices: (e) => e.texte,
  secrets: (e) => e.texte,
  declencheurs: (e) => e.evenement,
  pnj: (e) => e.nom,
  lieux: (e) => e.texte,
  textes: (e) => e.texte,
  tests: (e) => e.texte,
  rencontres: (e) => e.texte,
  recompenses: (e) => e.texte,
  etats: (e) => e.texte,
  dureeEtDifficulte: (e) => e.texte,
  matiereCompagnons: (e) => e.texte,
};

/** Le libellé d'une entrée de la famille `famille`, entier (l'affichage le coupe). */
const libelleDEntree = <F extends FamilleDeDossier>(famille: F, e: EntreeDe<F>): string => LIBELLE_D_ENTREE[famille](e);

/** Les entrées de la famille `famille`, typées par famille. */
const entreesDe = <F extends FamilleDeDossier>(fiche: FicheDeDossier, famille: F): readonly EntreeDe<F>[] =>
  fiche[famille] as readonly EntreeDe<F>[];

/** Identifiant GLOBAL d'une entrée : `<ABBR>-<NN>#<id>` (ex. `EDO-01#b3`). */
export const ID_D_ENTREE = /^([^#]+)-(\d+)#([a-z]+[1-9]\d*)$/;

/** Nom d'une fiche : `<ABBR>-<NN>` (ex. `EDO-01`), préfixe de l'identifiant global de ses entrées. */
export const nomDeFiche = (abbr: string, nn: string): string => `${abbr}-${nn}`;

export const idDEntree = (abbr: string, nn: string, id: string): string => `${nomDeFiche(abbr, nn)}#${id}`;

/** Une entrée d'une fiche, nommée : famille, identifiant GLOBAL, libellé entier. */
export interface EntreeNommee {
  famille: FamilleDeDossier;
  id: string;
  libelle: string;
}

const nommer = <F extends FamilleDeDossier>(abbr: string, nn: string, fiche: FicheDeDossier, famille: F): EntreeNommee[] =>
  entreesDe(fiche, famille).map((e) => ({ famille, id: idDEntree(abbr, nn, e.id), libelle: libelleDEntree(famille, e) }));

/** Les entrées d'une fiche, nommées, dans l'ordre des familles. */
export const entreesDeLaFiche = (abbr: string, nn: string, fiche: FicheDeDossier): EntreeNommee[] =>
  FAMILLES_DE_DOSSIER.flatMap((f) => nommer(abbr, nn, fiche, f));

/** Les identifiants globaux des entrées d'une fiche, dans l'ordre des familles. */
const idsDeLaFiche = (abbr: string, nn: string, fiche: FicheDeDossier): string[] =>
  entreesDeLaFiche(abbr, nn, fiche).map((e) => e.id);

/** Chemin d'une fiche RELATIF à la racine des dossiers (`docs/dossiers`), séparateur `/` : `<ABBR>/<NN>.json`. */
const CHEMIN_DE_FICHE = /^([^/]+)\/(\d+)\.json$/;

/** Une fiche commitée, lue : `chemin` (affichage), livre et chapitre tirés du chemin, fiche validée,
 *  identifiants globaux de ses entrées. */
export interface FicheLue {
  chemin: string;
  abbr: string;
  nn: string;
  fiche: FicheDeDossier;
  ids: string[];
}

/** LA lecture d'une fiche, pour tout chargeur (`src/data/dossiers.ts` côté app, `scripts/raw/lib/dossiers.mjs`
 *  côté Node) : `rel` = chemin relatif à la racine des dossiers, `chemin` = chemin affiché dans les fautes.
 *  LÈVE sur un chemin hors de `<ABBR>/<NN>.json` ou une fiche hors schéma. */
export function lireFicheDeDossier(chemin: string, rel: string, json: unknown): FicheLue {
  const m = CHEMIN_DE_FICHE.exec(rel);
  if (!m) throw new Error(`${chemin} : une fiche de dossier vit en docs/dossiers/<ABBR>/<NN>.json`);
  const [, abbr, nn] = m;
  const lu = ficheDeDossier.safeParse(json);
  if (!lu.success) {
    const fautes = lu.error.issues.map((i) => `  ${i.path.join('.')} : ${i.message}`).join('\n');
    throw new Error(`${chemin} : fiche hors schéma (ficheDeDossier, src/data/source/dossier.ts)\n${fautes}`);
  }
  return { chemin, abbr, nn, fiche: lu.data, ids: idsDeLaFiche(abbr, nn, lu.data) };
}
