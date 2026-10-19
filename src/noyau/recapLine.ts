/**
 * VOCABULAIRE PARTAGÉ d'une ligne de récap structurée (#349) — remplace le `string` brut des
 * chroniques (récap de voyage, note de cascade). Module LEAF (zéro dépendance) pour éviter tout
 * cycle : `pendings.ts` et `rollSeam.ts` l'importent tous deux.
 *
 * `RecapTone` reprend EXACTEMENT `NightEntry.tone` (state/restFlow.ts, PV de nuit/jour de mer) —
 * pas un second vocabulaire : même trio 'ok'/'bad'/'info', mêmes classes CSS (`.recap-line.ok`
 * partage `--ok-bright`/`--danger-soft` avec `.mrl-row.ok`, styles/hud.css).
 */
export type RecapTone = 'ok' | 'bad' | 'info';

/** Camp d'un SEGMENT de texte — même vocabulaire que la narration de combat (`NarratedSegment.team`,
 *  classes `.nm-ally`/`.nm-foe`) : les noms se colorent par camp, allié / ennemi. */
export type RecapTeam = 'ally' | 'enemy';

/** Un MORCEAU de la ligne : du texte, éventuellement toné par le camp qu'il nomme. Structure, jamais
 *  du JSX — le rendu (RecapLineRow) décide de la mise en forme. */
export interface RecapSegment {
  text: string;
  team?: RecapTeam;
}

export interface RecapLine {
  text: string;
  icon?: string;
  tone?: RecapTone;
  /** Découpe TONÉE du même contenu que `text` (concaténation des `segment.text` = `text`) : porte la
   *  coloration par camp des noms. Absente → la ligne se rend en texte plat. */
  segments?: RecapSegment[];
  /** Phase du jour (clé de `DAY_PHASE_CATALOG`) — posée quand la ligne provient d'une étape de
   *  cascade (`kind` connu) ; absente pour les notes hors-cascade (météo, entretien, soins d'arrivée). */
  phase?: string;
  /** Le texte est une prose de PAQUET (`SITES_PROSE`, `src/ui/liage.ts`) : nommé par les identités en vigueur. */
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
 *  `ParchmentCard` (sceau d100 optionnel) plutôt qu'en ligne. Un jet de routine / une note de météo
 *  RESTE une `RecapLine` — seul un événement qui RACONTE quelque chose (texte d'auteur/de table)
 *  mérite la carte. */
export interface RecapEvent {
  title: string;
  text: string;
  /** Tirage d100 ayant fait sortir l'événement — absent si l'événement est FORCÉ (recette de test)
   *  ou d'auteur (péripétie de route, pas de d100 propre). */
  roll?: number;
  tone?: RecapTone;
}

/** Une PHASE reconnue d'une journée de voyage TERRESTRE (agenda du jour EN COURS, #333 vague 2) —
 *  catalogue GÉNÉRIQUE par PRÉFIXE de `CascadeStep.kind` (aucun id de mode nommé) : ajouter une
 *  phase = une entrée ici, jamais un branchement par mode. Source UNIQUE, partagée par l'agenda du
 *  jour EN COURS (`ui/VoyageScreen.dayAgenda`) ET le sectionnement des jours CLOS (`state/travelFlow`,
 *  via `RecapLine.phase`) — le même catalogue groupe les deux (#349, dette 3).
 */
export interface DayPhaseDef {
  key: string;
  label: string;
  match: (kind: string) => boolean;
}

export const DAY_PHASE_CATALOG: DayPhaseDef[] = [
  { key: 'activites', label: 'Activités', match: (k) => k.startsWith('stagePoste') || k === 'stageAggregate' || k === 'stageExposure' },
  { key: 'rencontre', label: 'Rencontre / Péripéties', match: (k) => k.startsWith('landPeril') },
  { key: 'route', label: 'Route', match: (k) => k.startsWith('landForcedPace') },
];

/** Clé de phase d'un `kind` d'étape de cascade — `undefined` si aucune phase du catalogue ne
 *  matche (étape hors agenda terrestre, ex. cascades mer/fleuve : pas de sectionnement par phase). */
export function phaseOfKind(kind: string): string | undefined {
  return DAY_PHASE_CATALOG.find((p) => p.match(kind))?.key;
}

/** Groupe de lignes de récap PARTAGEANT une phase (rendu sectionné d'un jour CLOS). */
export interface RecapLineGroup {
  key: string;
  /** Absent pour le groupe des lignes HORS agenda (météo, entretien…) — pas de titre de section. */
  label?: string;
  lines: RecapLine[];
}

/** Sectionne les lignes d'un jour CLOS par PHASE (dette 3, #349) — GRATUIT dès que les lignes portent
 *  `phase` (posé à l'émission, `travelFlow.stepRecapLines`) : même catalogue que l'agenda du jour EN
 *  COURS (`DAY_PHASE_CATALOG`), donc le MÊME regroupement, jamais une 2ᵉ mécanique. Les lignes SANS
 *  phase (météo, entretien, soins d'arrivée…) forment un groupe de tête sans titre — un jour mer/fleuve
 *  (aucune ligne phasée) retombe sur UN SEUL groupe, comportement inchangé. */
export function groupRecapLinesByPhase(lines: RecapLine[]): RecapLineGroup[] {
  const byKey = new Map<string, RecapLine[]>();
  for (const l of lines) {
    const key = l.phase ?? '';
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(l);
  }
  const unphased = byKey.get('');
  const phased = DAY_PHASE_CATALOG
    .filter((p) => byKey.has(p.key))
    .map((p): RecapLineGroup => ({ key: p.key, label: p.label, lines: byKey.get(p.key)! }));
  return unphased?.length ? [{ key: '', lines: unphased }, ...phased] : phased;
}
