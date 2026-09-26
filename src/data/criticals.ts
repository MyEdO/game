import type { HitLocation, Difficulty } from '../engine/types';
import type { FlowTestNode } from '../engine/flowCore';
import type { Formula, GameOp } from '../engine/ops';
import type { SourceRef } from './schemas/grammaire/valeurs';
import type { DocumentARangees } from './schemas/grammaire/document';
import criticalsJson from './criticals.json';

/**
 * Tables de Blessures critiques par Localisation — LES DEUX systèmes (#1657 B2a, #1682) : le Livre de
 * base (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07), servie quand la règle
 * facultative `combat-aa-blessures` vaut `aa`.
 *
 * La DONNÉE vit dans `criticals.json` (éditable au Compendium) : 8 documents-tables, un par
 * (`jeu` × `localisation`), chacun avec SON espace de tirage d100. Ce module n'est que le TYPE + le
 * chargement + la projection des Localisations. Ajouter/régler un Critique = éditer le JSON ; ajouter
 * un 9ᵉ tableau = ajouter un document, sans une ligne de moteur.
 *
 * EFFET IMMÉDIAT du coup = `ops: GameOp[]` (PB en ignorant BE+PA via `{op:'wounds', ignoreTB, ignoreAP}`,
 * LDB 18 l.62 ; États via `{op:'condition'}` ; colonne « Blessures » d'AA 07 l.40 en `{op:'wounds'}`),
 * appliqué par `applyOps` — MÊME langue que sorts/traits/maladies. `test` = nœud `test` du Flow,
 * auto-résolu (RNG seedé) : sa branche `fail` porte la conséquence. `lethal` = résultat « Mort »
 * (instantané + sauvetage par Destin — PAS un simple `reduceToZero`). `traumas` = SPEC de Trauma à
 * engendrer. `desc` = texte canon (LONG TERME), verbatim.
 */
export interface CritEntry {
  /** id STABLE (slug) — toute référence passe par l'id, jamais le `label` (affichage). */
  id: string;
  min: number;
  max: number;
  label: string;
  /** Effet IMMÉDIAT du coup (PB + États), appliqué par `applyOps`. Absent = aucun effet immédiat (létal). */
  ops?: GameOp[];
  /** Jet de la rangée (LDB 18 « Réussissez un Test de Résistance… » / AA 07 « sous peine de… ») —
   *  nœud `test` du Flow, la forme UNIQUE du jet en donnée. Auto-résolu (seedé) : l'ÉCHEC applique
   *  les ops de sa branche `fail`. */
  test?: CritTestNode;
  lethal?: boolean;
  /** Amputation (LDB 18 l.237) déclarée STRUCTURELLEMENT, jamais lue par regex sur `desc`. */
  amputation?: Amputation;
  /** Traumatismes ENGENDRÉS (LDB 18) — refs d'id de fiches `traumas.json` ; la localisation vient de la table. */
  traumas?: string[];
  /** Escalade GATÉE d'une Blessure critique : sans soin, la séquelle S'AGGRAVE (ou n'est levée que par
   *  un traitement). `perRound` (« Main ouverte ») : une unité de séquelle de plus par Round de combat
   *  tant que l'Aide Médicale n'est pas reçue. `apresDelai` (« Pied écrasé ») : séquelle posée si la
   *  Chirurgie de la plaie n'intervient pas dans le délai. `medicalAidGate` (« Épaule luxée »/« Genou
   *  démis ») : membre désactivé jusqu'à un Test étendu de Guérison réussi APRÈS Aide Médicale. */
  escalation?: CritEscalation;
  /** Note MAISON (#195) — porte la trace éditable d'une valeur mécanique absente LITTÉRALEMENT du texte
   *  RAW (règle stricte 7 : contextuel/« au MJ » → donnée taguée, jamais un nombre nu silencieux). Ex.
   *  « Orteil contusionné » : le texte dit « jusqu'à la fin du prochain tour », `durationRounds: 2` en est
   *  la traduction en Rounds. Éditable au Compendium ; DISPLAY/DOC only (jamais lu pour de la mécanique). */
  maison?: string;
  /** Texte canon (LONG TERME), DISPLAY-ONLY — jamais parsé pour de la mécanique. */
  desc: string;
  source: SourceRef;
}

/** Le nœud `test` du `Flow` (`engine/flowCore.ts`) tel qu'une rangée de Critique le porte — la forme
 *  UNIQUE du jet en donnée, partagée avec les sorts, les talents et les scènes. Jamais une graphie
 *  propriétaire : l'atelier du Codex l'édite avec le `FlowEditor` commun. */
export type CritTestNode = FlowTestNode;

/** SYSTÈME de règles dont un tableau est tiré — le DISCRIMINANT de la collection (`jeu` du document). */
export type JeuDeCritique = 'ldb' | 'aa';

/** Famille de Localisation d'un tableau : les 4 tables couvrent les 6 `HitLocation` (bras gauche = bras
 *  droit, jambe gauche = jambe droite — LDB 18 : une SEULE table par membre). */
export type CritTableKey = 'tete' | 'bras' | 'corps' | 'jambe';

/** Amputation (LDB 18 l.237) — SOURCE UNIQUE de forme, partagée par les DEUX jeux, résolue par
 *  `noeudAmputation` (`src/engine/critical.ts`), qui en FABRIQUE le/les nœud(s) `test` — le moteur ne
 *  roule pas ce jet, la porte le joue.
 *  - `difficulty` = Test de Résistance de l'Amputation (échec → À Terre ; DR≤−2 → +Sonné ; DR≤−4 → +Inconscient).
 *  - `sequels` = ids de fiches de séquelle PERMANENTE (`traumas.json`), instanciées par `permanentAmputations`.
 *  - `timing: 'postEncounter'` = Test différé à la FIN de la rencontre (« Coupure à l'orteil », l.171 : « Une fois
 *    la rencontre terminée… ») — marqueur `Trauma.pendingAmputation` posé par `resolveCritique`, résolu au foyer
 *    de fin de combat.
 *  - `loss` = la SÉQUELLE est CONDITIONNELLE (sinon : membre tranché → séquelle TOUJOURS). `loss.difficulty`
 *    présent → Test SÉPARÉ dont la RÉUSSITE annule toute l'amputation (« Coupure à l'orteil » : `loss.difficulty`
 *    Intermédiaire, `difficulty` Accessible). Absent → le Test `difficulty` détermine LUI-MÊME la perte (« Pied
 *    écrasé » : un seul Test Accessible). `loss.perDR` → nombre d'orteils = 1 + DR en dessous de 0 (« Pied écrasé »). */
export interface Amputation {
  difficulty: Difficulty;
  sequels: string[];
  /** Unités que CETTE ligne fait perdre à ses séquelles CUMULATIVES (`TraumaFiche.cumul`) — `Formula`,
   *  défaut 1. C'est la LIGNE qui porte la quantité (« Perdez 1d10 dents », LDB 18 tables Tête
   *  `bouche-explosee`/`machoire-mutilee` ; AA 07 `aa-tete-66`/`aa-tete-95`), jamais la séquelle : une
   *  ligne future « perdez 2 dents » s'écrit ici. Une séquelle NON cumulative l'ignore (« perdez votre
   *  langue ET 1d10 dents » : seules les dents comptent). Cumulé avec `loss.perDR`. */
  unites?: Formula;
  timing?: 'postEncounter';
  loss?: { difficulty?: Difficulty; perDR?: boolean };
}

/** Déclaration d'escalade gatée par les soins — partagée par les deux jeux. Instanciée par
 *  `stampCriticalEscalation` (trauma.ts) sur la plaie chirurgicale du critique. */
export interface CritEscalation {
  /** Escalade PÉRIODIQUE tant que l'Aide Médicale n'est pas reçue (« Main ouverte », LDB 18 / AA 07 l.127) :
   *  `unites` (défaut 1) unité(s) de la séquelle `versTraumaId` ajoutée(s) à CHAQUE fin de Round de combat.
   *  L'escalade s'arrête d'elle-même quand le cumul de cette séquelle a franchi SON seuil (`TraumaCumul.escalade`). */
  perRound?: { versTraumaId: string; unites?: number };
  /** Escalade À ÉCHÉANCE si la Chirurgie de la plaie n'intervient pas dans le délai (« Pied écrasé »,
   *  LDB 18 l.180) : `jours` (`Formula`) décomptés à l'entretien, puis pose de la séquelle `versTraumaId`. */
  apresDelai?: { jours: Formula; versTraumaId: string };
  /** « Épaule luxée » (AA 07 l.125 / LDB 18 l.120) / « Genou démis » (AA 07 l.179 / LDB 18 l.179) : le membre est
   *  DÉSACTIVÉ (séquelle portant `disable` en `ops` passives : bras `maxWeaponHands:1` / jambe `moveScale`),
   *  en attente d'Aide Médicale (`awaitingMedicalAid`). Après l'Aide Médicale, un Test ÉTENDU de Guérison
   *  Accessible (+20) de `restoreDR` DR rend l'usage du membre : la séquelle est retirée et `recoveryPenalty`
   *  (charMod −10 / `moveScale` jambe, durée 1d10 jours) est posé à la cible. Instancié par
   *  `stampCriticalEscalation` (nouvelle séquelle, pas une plaie chirurgicale) ; joué à l'Infirmerie (acte
   *  « Guérison », `medicFlow`). */
  medicalAidGate?: { label: string; disable: GameOp[]; restoreDR: number; recoveryPenalty: GameOp[] };
  /** « Réouverture » (LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175) : tant que la plaie n'a
   *  pas été recousue par Chirurgie, chaque nouveau Dégât à la MÊME Localisation octroie `amount` État
   *  Hémorragique. `stampCriticalEscalation` pose une séquelle chirurgicale (`Trauma.bleedOnReinjury`,
   *  `needsSurgery`) que la Chirurgie retire ; le déclencheur est `reinjuryBleed` au point d'application des
   *  Dégâts localisés (`applyAttackResult`/Projectile). `label` = nom de la plaie (liste de Chirurgie). */
  bleedOnReinjury?: { amount: number; label: string };
  /** « Si vous tombez une seconde fois sur cette blessure… » (Blessure majeure à l'oreille, LDB 18 l.71 /
   *  AA 07 l.96) : à la 2e OCCURRENCE de CETTE entrée sur le personnage (compteur `critEntriesSuffered`),
   *  l'effet ALTERNATIF s'applique — `traumas` REMPLACE les séquelles de base (perte auditive partielle →
   *  Surdité totale), `ops` s'AJOUTE à l'effet immédiat de base. Évalué par `resolveCritique`. */
  onRepeat?: { traumas?: string[]; ops?: GameOp[] };
  /** « Si vous recevez une autre Blessure critique à la tête alors que vous êtes Exténué… » (Commotion
   *  cérébrale, LDB 18 l.74) : `stampCriticalEscalation` pose une séquelle porteuse de `Trauma.critTrigger`
   *  (dédupliquée) ; tant que le personnage porte l'État `whileCondition`, tout critique SUBSÉQUENT à
   *  `location` (ou toute Localisation si absente) impose le `test` de sauvegarde, évalué par
   *  `fireCritTriggers` au point unique de résolution. `label` = nom de la séquelle affichée. */
  onNextCritWhileCondition?: {
    label: string;
    location?: HitLocation;
    whileCondition: string;
    test: CritTestNode;
  };
  /** Séquelle POST-guérison (LDB 18 l.61 « Blessure spectaculaire » / l.72 « Nez cassé » : « Une fois que la
   *  blessure est guérie… ») : `stampCriticalEscalation` pose un marqueur `Trauma.onHealGrant` ; la Blessure
   *  critique est réputée GUÉRIE quand tous les États `whenClear` sont retirés (LDB 18 « Guérir les Blessures
   *  critiques » : « pas guéries tant que tous les États associés n'ont pas été retirés ») — `settleHealedCriticals`
   *  (déclenché au retrait d'État, `removeCondition`) octroie alors la cicatrice `scar` (fiche `traumas.json`,
   *  éditable). `scar` = id de fiche de séquelle ; `whenClear` = États dont le retrait signale la guérison. */
  onHealGrant?: { scar: string; whenClear: string[] };
}
export type CritTable = CritEntry[];

/** Un document-table de `criticals.json` : l'ENVELOPPE de la fabrique (identité, `source`…) et ses
 *  rangées (`DocumentARangees`, `grammaire/document.ts`), plus SON jeu et SA Localisation. */
export interface CritDoc extends DocumentARangees<CritEntry> {
  type: 'criticals';
  jeu: JeuDeCritique;
  localisation: CritTableKey;
}

/** Les 8 documents-tables, dans leur ordre authoré (LDB puis Aux Armes). */
export const CRITIQUE_DOCS = criticalsJson as unknown as CritDoc[];

/**
 * Rangées LIVE d'UN document-table, par id de DOCUMENT — FAIL-FAST : un id absent laisserait une
 * catégorie Codex sur un tableau vide, sans un mot (patron `miscastEntries`, `src/data/overrides.ts`).
 */
export function critiqueEntries(docId: string): CritTable {
  const doc = CRITIQUE_DOCS.find((d) => d.id === docId);
  if (!doc) {
    throw new Error(`critiqueEntries : tableau « ${docId} » absent de criticals.json (ids : ${CRITIQUE_DOCS.map((d) => d.id).join(', ')}).`);
  }
  return doc.entries;
}

/** Localisation REPRÉSENTATIVE d'une table de Critiques — inverse de `critTableKeyFor` pour les vues qui
 *  projettent une TABLE et non un coup réel (Codex, contrats). Côté DROIT par la convention DROITIER du
 *  moteur (`permanentAmputations`) : la table « Bras » couvre les deux côtés, la vue en montre un. */
export const CRIT_TABLE_LOCATION: Record<CritTableKey, HitLocation> = { tete: 'tete', bras: 'brasD', corps: 'corps', jambe: 'jambeD' };

/** Table de rattachement d'une Localisation (repli Bras, LDB 76 l.21, pour une loc sans table dédiée) —
 *  SOURCE UNIQUE de la projection loc→clé de table, partagée par `critiqueTable` (les lignes) et par la
 *  déclaration d'étape à table (l'`id` de table tirée). */
export function critTableKeyFor(location: HitLocation): CritTableKey {
  if (location === 'tete' || location === 'corps') return location;
  if (location === 'jambeG' || location === 'jambeD') return 'jambe';
  return 'bras';
}

/**
 * Le document-table d'un (`jeu`, `localisation`) — FAIL-FAST : un jeu ou une famille sans document
 * est une donnée amputée, pas un cas à absorber en silence.
 */
export function critiqueDoc(jeu: JeuDeCritique, key: CritTableKey): CritDoc {
  const doc = CRITIQUE_DOCS.find((d) => d.jeu === jeu && d.localisation === key);
  if (!doc) throw new Error(`critiqueDoc : aucun tableau « ${jeu} » pour la Localisation « ${key} » dans criticals.json.`);
  return doc;
}

/**
 * Table de Critiques d'une Localisation, dans le JEU actif — REPLI sur le Tableau des BRAS pour toute
 * Localisation SANS Tableau dédié (tentacule, queue, aile isolée…), résultat décrit pour la loc réelle
 * touchée (LDB 76 l.21). SOURCE UNIQUE de la résolution loc→table : `resolveCritique` passe TOUJOURS
 * par ici, jamais un cas par-nom dispersé. Aujourd'hui les 6 `HitLocation` sont toutes couvertes par
 * une table dédiée (le repli n'y est jamais exercé) — invariant gardé par `criticals.test.ts`.
 */
export function critiqueTable(jeu: JeuDeCritique, location: HitLocation): CritTable {
  return critiqueDoc(jeu, critTableKeyFor(location)).entries;
}
