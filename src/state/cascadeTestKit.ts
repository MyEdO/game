/**
 * Kit de TEST pour `cascade.ts` — `spyApplier` mutualise le motif dupliqué (~13 sites,
 * `cascade.test.ts`/`rollSeam.test.ts`/`cadence-rapide.test.ts`) : un `registerCascadeApplier` qui
 * PUSH une entrée dérivée de l'étape validée dans un tableau `applied` puis renvoie une conséquence
 * (`journal`/`insert`/…) optionnelle. N'importer que depuis des `*.test.ts` — module de test, pas de
 * périmètre runtime.
 */
import { registerCascadeApplier, type CascadeApplier } from './cascade';
import type { GameState } from './store';
import type { BatchParticipant, CascadeStep } from './pendings';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';

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

/** Dé NATUREL que le banc POSE sur une rangée de Test (étape mono, ou `rangee` d'une bande) — par l'option
 *  « Dés fixés » (`cascadeSetForcedRoll` / `cascadeBatchSetForcedRoll`), le geste d'un joueur. `undefined`
 *  = le dé lancé reste. */
export type PoseDe = (etape: CascadeStep, rangee?: BatchParticipant) => number | undefined;

/**
 * JOUE UNE ÉTAPE de la cascade active, comme un joueur : elle est TRANCHÉE (choix → son défaut
 * authoré), LANCÉE (bande → chaque rangée non roulée ; table non tirée → son dé ; jet → son dé), puis
 * VALIDÉE. Rend le `kind` de l'étape jouée (`undefined` si aucune cascade active).
 *
 * SOURCE UNIQUE du pilotage de cascade en test (#1426) — `travel-flow`, `sea-voyage-flow`, `voyage`,
 * `14-voyage-maritime` et les sondes jouent tous CE pilote : une copie par fichier dérive, et c'est
 * ainsi qu'un flux refondu se voit reproché SA refonte par un pilote périmé.
 *
 * Une table que le socle a résolue lui-même (cadence déférée à un automate, `cascade.poserLeCurseur`)
 * se présente ici en `'affichage'` : rien à lancer, on valide — le kit n'a AUCUNE branche pour la
 * politique du socle, il joue ce que la fenêtre offre.
 */
export function avanceEtapeCascade(get: () => GameState, poser?: PoseDe): string | undefined {
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
    if (cur.table && !cur.table.result) get().cascadeTableRoll(cur.id);
    if (cur.de && !cur.de.result) get().cascadeDieRoll(cur.id); // DÉ NU (#1508) : jumeau de la table — sans lui, le kit drainerait à vide sur une étape jamais prête
    const apres = get().pendingCascade?.participants[get().pendingCascade!.cursor];
    if (apres?.options && apres.chosen == null) get().cascadeChoose(apres.id, apres.defaultChoice ?? apres.options[0].key);
  }
  get().cascadeNext();
  return cur?.kind;
}

/** DRAINE la cascade active jusqu'à sa clôture (ou `max` étapes — garde d'emballement), en jouant
 *  chaque étape par `avanceEtapeCascade`. Rend les `kind` rencontrés, dans l'ordre. */
export function draineCascade(get: () => GameState, max = 200, poser?: PoseDe): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < max && get().pendingCascade; i++) {
    const k = avanceEtapeCascade(get, poser);
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
 * DRAINE une séquence dont la SUITE est DIFFÉRÉE (`cascade.chainStep` → timer 0) : chaque étape est
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

/** Enregistre un applier-espion `kind` : `mapper(step)` alimente `applied`, `out(step)` (défaut : rien)
 *  fournit la conséquence renvoyée à `commitStep` (`journal`/`consequences`/`insert`). */
export function spyApplier<T>(
  kind: string,
  applied: T[],
  mapper: (step: CascadeStep) => T,
  out?: (step: CascadeStep) => ReturnType<CascadeApplier>,
): void {
  registerCascadeApplier(kind, (_get, _set, step) => {
    applied.push(mapper(step));
    return out ? out(step) : undefined;
  });
}
