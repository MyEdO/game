/**
 * Schéma de `criticals.json` — Blessures critiques par Localisation, LES DEUX systèmes réunis
 * (#1657 B2a, #1682). Le fichier porte une LISTE de 8 documents-tables, un par (jeu × Localisation) :
 * le Livre de base (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07), activée
 * par la règle facultative `combat-aa-blessures = 'aa'`.
 *
 * DISCRIMINANT `jeu` — jamais `type`, qui est le type de DOCUMENT posé par la fabrique
 * (`grammaire/document.ts`, `enveloppe`).
 * Chaque document porte SON identité, SA charge et SON espace de tirage d100 : les fourchettes des
 * deux jeux se recouvrent (80/80 mesurées), une table = un espace, le lecteur ne filtre rien.
 *
 * PROVENANCE : chaque RANGÉE et chaque document-table porte son `source: {book, page, note}` (168/168) :
 * `note` cite SA ligne (`LDB 18 l.<n>`, `AA 07 l.<n>` : fourchette et libellé pour une rangée, titre
 * pour une table), `page` est le folio IMPRIMÉ de l'ancre `data-folio` qui gouverne cette ligne. Le
 * folio est jugé contre la ligne par `src/data/folio-line-align.test.ts`, la ligne contre l'entrée par
 * `src/data/criticals-folio.test.ts`.
 *
 * MODÉLISATION (réfs nues) : `ops` = effet IMMÉDIAT (PB en ignorant BE+PA — LDB 18 l.53 —, États,
 * et la colonne « Blessures » d'AA 07 l.40, absorbée en `{op:'wounds'}`). `test` = nœud `test` du
 * Flow (`noeudTest`), la forme UNIQUE du jet en donnée : sa branche `fail` porte la conséquence.
 * `lethal` = « Mort ». La TRIVIALITÉ d'AA 07 l.79 (« T ») n'est pas authorée : elle se DÉDUIT
 * (`critiqueTriviale`, `engine/critical.ts`) — une rangée non létale qui ne fait perdre aucune
 * Blessure. `desc` = texte canon VERBATIM (règle 5).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, enumNomme, hitLocationSchema, plageSchema, sourceRefSchema, formulaSchema } from '../grammaire/valeurs';
import { gameOpSchema, flowSchema, noeudTest } from '../grammaire/mecanique';

/** FAMILLE de Localisation d'un tableau de Critiques (`CritTableKey`, `src/engine/critical.ts`) — les 4
 *  tables couvrent les 6 `HitLocation`. Le libellé nomme la table à l'écran (baril de jet, Codex). */
export const critTableSchema = enumNomme({ tete: 'Tête', bras: 'Bras', corps: 'Corps', jambe: 'Jambe' });

export const file = 'criticals.json';
// Un FICHIER, 8 DOCUMENTS-tables : famille `entite` + charge `options.rangee` (patron `miscast.ts`).
export const famille = 'entite';

/** Le nœud de jet des Blessures critiques : `difficulty` RESSERRÉE (39/39 la portent, aucune n'est
 *  une épreuve sans Difficulté). Partagé par la rangée et par l'escalade `onNextCritWhileCondition`. */
const noeudCritique = noeudTest(flowSchema, { difficulteRequise: true });

/** Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du membre sans
 *  Chirurgie sous 1d10 jours) — reflet de `CritEscalation` (`src/data/criticals.ts`). Partagée AA/LDB. */
export const critEscalationSchema = z.strictObject({
  // Escalade PÉRIODIQUE sans Aide Médicale (« Main ouverte ») et escalade À ÉCHÉANCE sans Chirurgie
  // (« Pied écrasé ») — deux AXES paramétrés (séquelle visée + cadence/délai), cf. `CritEscalation`.
  perRound: z.strictObject({ versTraumaId: z.string(), unites: z.number().optional() }).optional(),
  apresDelai: z.strictObject({ jours: formulaSchema, versTraumaId: z.string() }).optional(),
  // « Épaule luxée »/« Genou démis » : membre désactivé jusqu'à un Test étendu de Guérison réussi (DR
  // `restoreDR`) APRÈS Aide Médicale, puis pénalité 1d10 jours (`recoveryPenalty`). Cf. `CritEscalation`.
  medicalAidGate: z
    .strictObject({
      label: z.string(),
      disable: z.array(gameOpSchema),
      restoreDR: z.number(),
      recoveryPenalty: z.array(gameOpSchema),
    })
    .optional(),
  // « Réouverture » (LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175) : tant que la plaie
  // n'a pas été recousue par Chirurgie, chaque nouveau Dégât à la MÊME Localisation octroie `amount` État
  // Hémorragique. Stampé par `stampCriticalEscalation` en séquelle chirurgicale (`bleedOnReinjury` + `needsSurgery`).
  bleedOnReinjury: z.strictObject({ amount: z.number(), label: z.string() }).optional(),
  // « Si vous tombez une seconde fois sur cette blessure… » (Blessure majeure à l'oreille, LDB 18 l.71 / AA
  // 07 l.96) : effet ALTERNATIF à la 2e occurrence de l'entrée (`onRepeat.traumas` remplace les séquelles de
  // base, `onRepeat.ops` s'ajoute à l'effet immédiat). Évalué par `resolveCritique`.
  onRepeat: z
    .strictObject({
      traumas: z.array(z.string()).optional(),
      ops: z.array(gameOpSchema).optional(),
    })
    .optional(),
  // « Si vous recevez une autre Blessure critique à la tête alors que vous êtes Exténué… » (Commotion
  // cérébrale, LDB 18 l.74) : séquelle porteuse d'un `critTrigger` — tant que `whileCondition` tient, tout
  // critique subséquent à `location` impose le `test`. Stampé par `stampCriticalEscalation`.
  onNextCritWhileCondition: z
    .strictObject({
      label: z.string(),
      location: hitLocationSchema.optional(),
      whileCondition: z.string(),
      test: noeudCritique,
    })
    .optional(),
  // « Une fois que la blessure est guérie… » (Blessure spectaculaire l.61 / Nez cassé l.72) : marqueur de
  // guérison (`Trauma.onHealGrant`) → cicatrice `scar` (fiche traumas.json) une fois tous les États `whenClear`
  // retirés (LDB 18 l.304). Octroyée par `settleHealedCriticals` au retrait d'État.
  onHealGrant: z.strictObject({ scar: z.string(), whenClear: z.array(z.string()) }).optional(),
});

/** Amputation (LDB 18 l.237) — reflet de `Amputation` (`src/data/criticals.ts`), SOURCE UNIQUE de forme
 *  partagée par les deux jeux (mêmes textes « Une fois la rencontre terminée… »/« un orteil par DR »).
 *  Le/les Test(s) qu'elle impose sont fabriqués par `noeudAmputation` (`src/engine/critical.ts`). */
export const amputationSchema = z.strictObject({
  difficulty: difficultySchema,
  sequels: z.array(z.string()),
  // Nombre d'UNITÉS que CETTE ligne fait perdre à ses séquelles cumulatives (« Perdez 1d10 dents »,
  // criticals.json:bouche-explosee/machoire-mutilee) — `Formula`, défaut 1. Cf. `Amputation.unites`.
  unites: formulaSchema.optional(),
  // Test différé à la fin de la rencontre (« Coupure à l'orteil », LDB 18 l.171 / AA 07 l.171) — marqueur `pendingAmputation`.
  timing: z.literal('postEncounter').optional(),
  // Séquelle CONDITIONNELLE : `difficulty` = Test gate SÉPARÉ (réussite → pas d'amputation) ; absent = le
  // Test de Résistance `difficulty` détermine lui-même la perte. `perDR` = orteils 1 + DR en dessous de 0.
  loss: z.strictObject({ difficulty: difficultySchema.optional(), perDR: z.boolean().optional() }).optional(),
});

const critEntrySchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  ops: z.array(gameOpSchema).optional(),
  test: noeudCritique.optional(),
  lethal: z.boolean().optional(),
  amputation: amputationSchema.optional(),
  traumas: z.array(z.string()).optional(),
  escalation: critEscalationSchema.optional(),
  // Note MAISON (#195) : trace éditable d'une valeur mécanique absente littéralement du texte RAW (règle stricte 7).
  maison: z.string().optional(),
  desc: z.string(),
  source: sourceRefSchema,
});

/** Catégorie Codex de chaque document-table, dans l'ordre de la donnée (LDB puis Aux Armes). */
const CATEGORIES = [
  'criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe',
  'aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe',
] as const;

const doc = document(
  'criticals',
  famille,
  {
    /** SYSTÈME de règles dont ce tableau est tiré — le DISCRIMINANT de la collection. `ldb` = LDB 18
     *  « Traumatisme » (défaut) ; `aa` = l'approche alternative d'AA 07, servie quand la règle
     *  optionnelle `combat-aa-blessures` vaut `aa`. */
    jeu: z.enum(['ldb', 'aa']),
    /** Famille de Localisation du tableau — les 4 tables couvrent les 6 `HitLocation` (bras gauche =
     *  bras droit, jambe gauche = jambe droite ; repli Bras pour une loc sans table, LDB 76 l.21). */
    localisation: critTableSchema,
  },
  {
    jeu: { label: 'Système de règles', hint: 'ldb = Traumatisme (LDB 18) ; aa = approche alternative (AA 07)' },
    localisation: { label: 'Localisation', hint: 'Famille de Localisation couverte par ce tableau' },
  },
  {
    codex: { keys: [...CATEGORIES] },
    edit: { niche: { categories: [...CATEGORIES] } },
  },
  { rangee: critEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
