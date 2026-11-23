import type { Equipe } from '../engine/relations';
import type { IconId } from '../data/icons';
import type { FaitApplique } from '../engine/faits';
/**
 * VOCABULAIRE PARTAGÉ d'une ligne de récap structurée (#349) — remplace le `string` brut des
 * chroniques (récap de voyage, note de cascade). Module LEAF (aucune dépendance de valeur) pour éviter tout
 * cycle : `pendings.ts` et `rollSeam.ts` l'importent tous deux.
 *
 * `RecapTone` reprend EXACTEMENT `NightEntry.tone` (noyau/restFlow.ts, PV de nuit/jour de mer) —
 * pas un second vocabulaire : même trio 'reussite'/'echec'/'neutre', et les tons d'un hôte (`Ton`,
 * src/hote/elements.ts).
 */
export type RecapTone = 'reussite' | 'echec' | 'neutre';

/** Le sens du fait pour sa cible : gain (Blessures et Avantage regagnés, État retiré, Corruption retirée ou
 *  écartée, argent reçu, prix d'achat baissé ou de vente monté), perte (dont la Localisation qu'une Blessure critique
 *  frappe, l'objet entamé, brisé ou lâché), ou `null` pour un fait sans variation hors Corruption écartée. */
function sensPourLaCible(f: FaitApplique): 'gain' | 'perte' | null {
  if (f.genre === 'localisation') return 'perte';
  if (f.genre === 'objet') return f.valeur < 0 || f.issue === 'lachee' ? 'perte' : null;
  if (f.genre === 'corruption' && 'contre' in f) return 'gain';
  if (f.valeur === 0) return null;
  const gain = f.genre === 'etat' || f.genre === 'corruption' || (f.genre === 'prix' && f.sens === 'achat') ? f.valeur < 0 : f.valeur > 0;
  return gain ? 'gain' : 'perte';
}

/** LE ton d'un fait appliqué, d'après le camp de sa cible (#4574) : un gain du groupe ou une perte d'un hostile est
 *  une `reussite`, l'inverse un `echec` ; un fait sans variation ou sur un neutre est `neutre`. Seule dérivation,
 *  lue par `resultLines` et par la projection des conséquences. */
export function tonDuFait(f: FaitApplique): RecapTone {
  const sens = sensPourLaCible(f);
  if (sens == null || f.camp === 'neutre') return 'neutre';
  return (sens === 'gain') === (f.camp === 'groupe') ? 'reussite' : 'echec';
}

/** Un MORCEAU de la ligne : du texte, éventuellement toné par le camp qu'il nomme (même vocabulaire que la
 *  narration de combat, `NarratedSegment.team`). L'hôte décide de la mise en forme. */
export interface RecapSegment {
  text: string;
  team?: Equipe;
}

export interface RecapLine {
  text: string;
  icon?: IconId;
  tone?: RecapTone;
  /** Découpe TONÉE du même contenu que `text` (concaténation des `segment.text` = `text`) : porte la
   *  coloration par camp des noms. Absente → la ligne se rend en texte plat. */
  segments?: RecapSegment[];
  /** Phase du jour (clé de `DAY_PHASE_CATALOG`) — posée quand la ligne provient d'une étape de
   *  cascade (`kind` connu) ; absente pour les notes hors-cascade (météo, entretien, soins d'arrivée). */
  phase?: string;
  /** Le texte est une prose de PAQUET : nommé par les identités en vigueur. */
  paquet?: true;
}

/** Enveloppe des textes SIMPLES en `RecapLine[]` — repli neutre (ni icône ni ton), pour les
 *  accumulateurs narratifs sans structure fine (fatigue, marche forcée,
 *  soins d'arrivée…). Filtre les entrées vides. */
export function toRecapLines(texts: string[]): RecapLine[] {
  return texts.filter((s) => s.length > 0).map((text) => ({ text }));
}

/** Un ÉVÉNEMENT RACONTÉ du jour (#371, #4574) : un récit (titre et texte verbatim de l'entrée tirée, règle 5
 *  d'AGENTS.md), distinct d'une `RecapLine` de routine ; `source` : la table et l'id de son entrée ; `jet` : le dé
 *  naturel et le dé effectif du tirage (`CascadeTableResult.roll`, `.die`), absent d'un événement forcé. */
export interface RecapEvent {
  source: { table: string; id: string };
  title: string;
  text: string;
  jet?: { naturel: number; effectif: number };
  tone?: RecapTone;
}

/** Une PHASE reconnue d'une journée de voyage TERRESTRE (#333) — catalogue GÉNÉRIQUE par PRÉFIXE de
 *  `CascadeStep.kind` (aucun id de mode nommé) : ajouter une phase = une entrée ici, jamais un branchement par
 *  mode. Lu par le sectionnement des jours CLOS (`noyau/travelFlow`, via `RecapLine.phase`, #349). */
interface DayPhaseDef {
  key: string;
  match: (kind: string) => boolean;
}

const DAY_PHASE_CATALOG: DayPhaseDef[] = [
  { key: 'activites', match: (k) => k.startsWith('etapePoste') || k === 'etapeBilan' || k === 'etapeExposition' },
  { key: 'rencontre', match: (k) => k.startsWith('perilATerre') },
  { key: 'route', match: (k) => k.startsWith('rythmeForceATerre') },
];

/** Clé de phase d'un `kind` d'étape de cascade — `undefined` si aucune phase du catalogue ne
 *  matche (étape hors agenda terrestre, ex. cascades mer/fleuve : pas de sectionnement par phase). */
export function phaseOfKind(kind: string): string | undefined {
  return DAY_PHASE_CATALOG.find((p) => p.match(kind))?.key;
}
