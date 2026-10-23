/**
 * Kit de TEST pour `cascade.ts` — `spyApplier` mutualise le motif dupliqué des suites de cascade : un
 * applier de fixture (posé par `avecLesTables`) qui PUSH une entrée dérivée de l'étape validée dans un
 * tableau `applied` puis renvoie une conséquence (`journal`/`insert`/…) optionnelle. N'importer que depuis l'outillage de test,
 * suite ou kit au sens d'`estSuiteVitest`/`estKitDeTest` (`scripts/guards/lib/fichierVitest.mjs`) —
 * module de test, pas de périmètre runtime.
 */
import type { CascadeApplier } from '../noyau/cascade';
import type { GameState } from './store';
import type { BatchParticipant, CascadeStep, PendingCascade } from '../noyau/pendings';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';

/** UNE séquence de test, seule fabrique des fixtures de `PendingCascade` : son compteur d'identité
 *  (`seq`, #1508) vaut le nombre d'étapes poussées, comme pour une séquence ouverte par le code. */
export function cascadeDeTest(
  participants: CascadeStep[],
  champs: Partial<Omit<PendingCascade, 'participants' | 'seq'>> = {},
): PendingCascade {
  return { title: 'Test', purpose: 'test', cursor: 0, log: [], ...champs, participants, seq: participants.length };
}

/** Ce qu'il faut porter pour être JUGEABLE par `inexplique` — les quatre grandeurs d'une ligne de jet,
 *  toutes optionnelles. STRUCTUREL, jamais un type de porteur : `CascadeStep`, `BatchParticipant`,
 *  `RollBreakdown`/`PendingRoll` et les `Pending*` du combat les portent chacun à leur façon. */
export interface LigneJugeable { base?: number; mods?: ModLine[]; target?: number; difficulty?: Difficulty; difficultyCombined?: number; clamped?: number }

/**
 * CLIQUET « zéro chip anonyme » (#1117/#1153) : la part de l'écart base→cible qu'une étape n'explique
 * PAS. Tout ce que la ligne SAIT dire s'en retire — la Difficulté (texte de la ligne), ses
 * modificateurs NOMMÉS (`mods` : Soutien, États, passifs, malus RAW) et l'écrêtage MESURÉ (`clamped`,
 * rendu « plafond 99 »). Reste ≠ 0 ⇒ le réconciliateur de `RollLine` avouera une chip « autres » : un
 * fait que personne ne nomme. À asserter `toBe(0)` sur toute étape-jet produite par un flux.
 */
export function inexplique(st: LigneJugeable): number {
  return (st.target ?? 0) - (st.base ?? 0)
    - (st.difficultyCombined ?? (st.difficulty ? DIFFICULTY_MODIFIERS[st.difficulty] : 0))
    - (st.mods ?? []).reduce((sum, m) => sum + m.value, 0)
    - (st.clamped ?? 0);
}

/** LIGNE DE JET d'une étape : la RANGÉE du porteur quand l'étape est une BANDE (#1117 L3 — les jets
 *  de nuit vivent sur les rangées), l'étape elle-même sinon. `heroId` absent ⇒ la 1ʳᵉ rangée. Rendu
 *  STRUCTUREL (`LigneJugeable` + le libellé de Compétence), pour que les cliquets de ligne
 *  (`inexplique`, `soutienDe`) jugent la même chose des deux formes. */
export function jetDe(st: CascadeStep, heroId?: string): LigneJugeable & { label?: string } {
  const rows = st.participants;
  if (!rows?.length) return { ...st, label: st.rollLabel };
  return (heroId ? rows.find((r) => r.id === heroId) : rows[0]) ?? rows[0];
}

/** Le Soutien (LDB 12) porté par une ligne, tel qu'il s'AFFICHE : la ou les lignes de mod identifiées
 *  par leur RÈGLE (`soutienMod` — `ref.id`), jamais par leur libellé. `0` si la ligne n'en porte pas. */
export function soutienDe(st: LigneJugeable): number {
  return (st.mods ?? [])
    .filter((m) => m.ref?.id === RULE_REF.soutien.id)
    .reduce((sum, m) => sum + m.value, 0);
}

/** Dé NATUREL que le banc POSE sur une rangée de Test (étape mono, ou `rangee` d'une bande), sur la TABLE
 *  ou sur le DÉ NU d'une étape (#1508) — par l'option « Dés fixés » (`cascadeSetForcedRoll` /
 *  `cascadeBatchSetForcedRoll` / `cascadeTableSetForcedRoll` / `cascadeDieSetForcedRoll`), le geste d'un
 *  joueur. `undefined` = le dé est lancé ; `null` = le banc REFUSE de lancer le dé de TABLE ou de DÉ NU,
 *  qui ne tombe alors que si le socle le résout lui-même (sur une rangée de Test, `null` vaut `undefined`).
 *  L'étape suffit à dire quel dé : `jetteLeDe` LÈVE sur une étape qui porte à la fois `table` et `de`, si
 *  bien qu'aucune étape à deux porteurs ne se joue en taisant l'un d'eux. */
export type PoseDe = (etape: CascadeStep, rangee?: BatchParticipant) => number | null | undefined;

/** POSE `valeur` sur tout dé de TABLE ou dé NU non tombé ; un dé résolu d'office reste le sien. */
export const poseSurDeNonTombe = (valeur: number): PoseDe => (etape) =>
  ((etape.table && !etape.table.result) || (etape.de && !etape.de.result) ? valeur : undefined);

/** Clé que le banc TRANCHE sur une étape de choix — le geste d'un joueur. `undefined` = le défaut
 *  authoré (`defaultChoice`, sinon la première option). */
export type ChoisitCle = (etape: CascadeStep) => string | undefined;

/** Le dé d'une TABLE ou d'un DÉ NU, jumeaux (#1508) : POSÉ si le banc le fixe (« Dés fixés » — le dé posé
 *  remplace aussi un dé résolu d'office), LAISSÉ si le banc le refuse, LANCÉ sinon s'il n'est pas tombé. */
function jetteLeDe(get: () => GameState, cur: CascadeStep, poser?: PoseDe): void {
  if (cur.table && cur.de) throw new Error(`étape « ${cur.id} » : elle porte à la fois une \`table\` et un \`de\` — le kit ne sait quel dé jouer`);
  const s = get();
  const porteur = cur.table
    ? { tombe: !!cur.table.result, pose: s.cascadeTableSetForcedRoll, lance: s.cascadeTableRoll }
    : cur.de && { tombe: !!cur.de.result, pose: s.cascadeDieSetForcedRoll, lance: s.cascadeDieRoll };
  if (!porteur) return;
  const n = poser?.(cur);
  if (n === null) return;
  if (n !== undefined) porteur.pose(cur.id, n);
  else if (!porteur.tombe) porteur.lance(cur.id);
}

/**
 * JOUE UNE ÉTAPE de la cascade active, comme un joueur : elle est LANCÉE (bande → chaque rangée non
 * roulée ; table ou dé nu → son dé ; jet → son dé — chacun POSÉ par `poser` s'il le fixe), TRANCHÉE
 * (choix → `choisir`, sinon son défaut authoré), puis VALIDÉE. Rend le `kind` de l'étape jouée
 * (`undefined` si aucune cascade active).
 *
 * Pilote CANONIQUE de la cascade en test (#1426) : une copie par fichier dérive, et c'est ainsi qu'un
 * flux refondu se voit reproché SA refonte par un pilote périmé. Les copies qui restent sont MESURÉES
 * par la garde `src/noyau/pilote-cascade.test.ts` (stock `scripts/guards/lib/piloteCascadeStock.mjs`,
 * qui ne fait que décroître).
 *
 * Une table que le socle a résolue lui-même (cadence déférée à un automate, `cascade.poserLeCurseur`)
 * se présente ici en `'affichage'` : rien à lancer, on valide — le kit n'a AUCUNE branche pour la
 * politique du socle, il joue ce que la fenêtre offre.
 */
export function avanceEtapeCascade(get: () => GameState, poser?: PoseDe, choisir?: ChoisitCle): string | undefined {
  const p = get().pendingCascade;
  if (!p) return undefined;
  const cur = p.participants[p.cursor];
  if (cur) {
    // ORDRE de `stepInteraction` (chaîne de PRIORITÉ), jamais un `else if` : une étape porte une table
    // ET un choix (la sévérité d'un Critique se tire DANS la fenêtre de Déviation) — le dé se lance
    // d'abord, le choix se tranche ensuite, sur la MÊME étape. En exclusif, le choix resterait non
    // tranché et `cascadeNext` drainerait à vide.
    if (cur.target != null && !cur.result) {
      get().cascadeRoll(cur.id);
      const n = poser?.(cur);
      if (n != null) get().cascadeSetForcedRoll(cur.id, n);
    }
    if (cur.participants) {
      for (const part of cur.participants) {
        if (part.result) continue;
        get().cascadeBatchRoll(part.id);
        const n = poser?.(cur, part);
        if (n != null) get().cascadeBatchSetForcedRoll(part.id, n);
      }
    }
    jetteLeDe(get, cur, poser);
    const apres = get().pendingCascade?.participants[get().pendingCascade!.cursor];
    if (apres?.options && apres.chosen == null) get().cascadeChoose(apres.id, choisir?.(apres) ?? apres.defaultChoice ?? apres.options[0].key);
  }
  get().cascadeNext();
  return cur?.kind;
}

/** DRAINE la cascade active jusqu'à sa clôture (ou `max` étapes — garde d'emballement), en jouant
 *  chaque étape par `avanceEtapeCascade`. Rend les `kind` rencontrés, dans l'ordre. */
export function draineCascade(get: () => GameState, max = 200, poser?: PoseDe, choisir?: ChoisitCle): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < max && get().pendingCascade; i++) {
    const k = avanceEtapeCascade(get, poser, choisir);
    if (k !== undefined) kinds.push(k);
  }
  return kinds;
}

/**
 * DRAINE la séquence active et RASSEMBLE tout ce que le joueur a LU : LES DEUX SURFACES DE JOURNAL —
 * le `journal` d'exploration ET le `battle.log` (un combat ouvert route là ses conséquences,
 * `combatLog.journaliser` : c'est la surface que le joueur regarde en combat, le journal d'exploration
 * n'y étant pas ouvrable) — ENTIERS (les lignes d'avant la séquence comptent : un flux en écrit avant
 * d'ouvrir), ET celles que portent ses ÉTAPES — conséquences (`outcome`) et charge de révélation
 * (`reveal.lines`). Ce qu'une fenêtre montre ne passe pas par le journal : une révélation
 * porte SES lignes sur SON étape, et les lire au journal ne prouverait rien de ce que le joueur voit.
 *
 * Les étapes sont relues à CHAQUE pas (une étape apparaît en cours de route, une autre reçoit sa
 * conséquence à son commit) et indexées par id — jamais deux fois la même ligne.
 */
export function draineEtLit(get: () => GameState, max = 200): string[] {
  const parEtape = new Map<string, string[]>();
  const capte = () => {
    for (const s of get().pendingCascade?.participants ?? []) {
      // Une révélation porte SES lignes deux fois (charge `reveal` + conséquence rendue) : c'est UN
      // rendu, pas deux — sans quoi « combien de fois le joueur l'a-t-il lu ? » compterait faux.
      const lignes = [...new Set([...(s.outcome ?? []).map((l) => l.text), ...(s.reveal?.lines ?? [])])];
      if (lignes.length) parEtape.set(s.id, lignes);
    }
  };
  capte();
  for (let i = 0; i < max && get().pendingCascade; i++) { avanceEtapeCascade(get); capte(); }
  return [...get().journal, ...(get().battle?.log ?? []).map((e) => e.text), ...[...parEtape.values()].flat()];
}

/**
 * DRAINE une séquence dont la SUITE est DIFFÉRÉE (`enchainerEtape.chainStep` → timer 0) : chaque étape est
 * jouée par `avanceEtapeCascade`, puis l'appelant fait tourner son horloge (`avancerTimers`, typiquement
 * `() => vi.runAllTimers()` sous faux timers) pour que la continuation ouvre l'étape suivante.
 *
 * C'est le pilote des flux où un dé de MONDE commande la suite (vente terrestre : acheteur → mise à
 * prix → Marchandage) : sans l'horloge, le drainage rendrait la main entre deux maillons et le geste
 * du joueur paraîtrait sans effet. Le kit ne POSSÈDE pas l'horloge du test — il la demande.
 */
export function draineCascadeDifferee(get: () => GameState, avancerTimers: () => void, max = 20): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < max && get().pendingCascade; i++) {
    const k = avanceEtapeCascade(get);
    if (k !== undefined) kinds.push(k);
    avancerTimers();
  }
  return kinds;
}

/** Un applier-espion : `mapper(step)` alimente `applied`, `out(step)` (défaut : rien) fournit la
 *  conséquence renvoyée à `commitStep` (`journal`/`consequences`/`insert`). Se pose par `avecLesTables`. */
export function spyApplier<T>(
  applied: T[],
  mapper: (step: CascadeStep) => T,
  out?: (step: CascadeStep) => ReturnType<CascadeApplier>,
): CascadeApplier {
  return (_get, _set, step) => {
    applied.push(mapper(step));
    return out ? out(step) : undefined;
  };
}
