import type { Equipe } from '../engine/relations';
import type { IconId } from '../data/icons';
import type { FaitApplique } from '../engine/faits';
/**
 * VOCABULAIRE PARTAGÉ d'une ligne de récap structurée (#349) — remplace le `string` brut des
 * chroniques (récap de voyage, note de cascade). Module LEAF (aucune dépendance de valeur) pour éviter tout
 * cycle : `pendings.ts` et `rollSeam.ts` l'importent tous deux.
 *
 * `RecapTone` reprend EXACTEMENT `NightEntry.tone` (noyau/restFlow.ts, PV de nuit/jour de mer) —
 * pas un second vocabulaire : même trio 'reussite'/'echec'/'neutre', mêmes classes CSS (`.recap-line.reussite`
 * partage `--ok-bright`/`--danger-soft` avec `.mrl-row.reussite`, styles/hud.css), et les tons d'un hôte (`Ton`,
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

/** Camp d'un SEGMENT de texte — même vocabulaire que la narration de combat (`NarratedSegment.team`,
 *  classes `.nm-ally`/`.nm-foe`) : les noms se colorent par camp, allié / ennemi. */


/** Un MORCEAU de la ligne : du texte, éventuellement toné par le camp qu'il nomme. Structure, jamais
 *  du JSX — le rendu (RecapLineRow) décide de la mise en forme. */
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
 *  accumulateurs narratifs qui ne portent pas encore de structure fine (fatigue, marche forcée,
 *  soins d'arrivée…). Filtre les entrées vides. */
export function toRecapLines(texts: string[]): RecapLine[] {
  return texts.filter((s) => s.length > 0).map((text) => ({ text }));
}

/** Un ÉVÉNEMENT RACONTÉ du jour (#371 LOT « moisson n°4 ») — distinct d'une `RecapLine` : porte un
 *  RÉCIT (titre + texte verbatim de la source), pas une simple ligne de journal, et se rend en
 *  `ParchmentCard` (sceau du dé optionnel) plutôt qu'en ligne. Un jet de routine / une note de météo
 *  RESTE une `RecapLine` — seul un événement qui RACONTE quelque chose (texte d'auteur/de table)
 *  mérite la carte. */
export interface RecapEvent {
  title: string;
  text: string;
  /** Tirage ayant fait sortir l'événement — absent si l'événement est FORCÉ (recette de test)
   *  ou d'auteur (péripétie de route, pas de tirage propre). */
  roll?: number;
  tone?: RecapTone;
}

/** Une PHASE reconnue d'une journée de voyage TERRESTRE (agenda du jour EN COURS, #333 vague 2) —
 *  catalogue GÉNÉRIQUE par PRÉFIXE de `CascadeStep.kind` (aucun id de mode nommé) : ajouter une
 *  phase = une entrée ici, jamais un branchement par mode. Source UNIQUE, partagée par l'agenda du
 *  jour EN COURS (`dayAgenda`) ET le sectionnement des jours CLOS (`noyau/travelFlow`,
 *  via `RecapLine.phase`) — le même catalogue groupe les deux (#349, dette 3).
 */
export interface DayPhaseDef {
  key: string;
  label: string;
  match: (kind: string) => boolean;
}

export const DAY_PHASE_CATALOG: DayPhaseDef[] = [
  { key: 'activites', label: 'Activités', match: (k) => k.startsWith('etapePoste') || k === 'etapeBilan' || k === 'etapeExposition' },
  { key: 'rencontre', label: 'Rencontre / Péripéties', match: (k) => k.startsWith('perilATerre') },
  { key: 'route', label: 'Route', match: (k) => k.startsWith('rythmeForceATerre') },
];

/** Clé de phase d'un `kind` d'étape de cascade — `undefined` si aucune phase du catalogue ne
 *  matche (étape hors agenda terrestre, ex. cascades mer/fleuve : pas de sectionnement par phase). */
export function phaseOfKind(kind: string): string | undefined {
  return DAY_PHASE_CATALOG.find((p) => p.match(kind))?.key;
}
