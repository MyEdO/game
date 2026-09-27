/**
 * `StakeNote` — PRIMITIVE de la zone Z3b (l'ENJEU d'un jet, #1117) : la PHRASE, et elle seule.
 *
 * Elle ne reçoit QU'UNE `StakeRef` (clé de donnée + valeurs calculées) : le texte est RÉSOLU ici par
 * la porte unique `resolveStake` — aucun appelant ne peut écrire l'enjeu. Classe PROPRIÉTAIRE
 * `.rm-stake` : Z3b a besoin d'un propriétaire distinguable (`.rm-note` est la note générique de
 * 6 sites, et son ton `menace` porte un AUTRE sens — la menace SUBIE, fond rouge). Ton NEUTRE : un enjeu
 * ANNONCE, il ne menace pas.
 *
 * Le RENVOI vers la fiche de règle n'est PAS ici (arbitrage user 2026-08-06 : « "la régle" ? C'est
 * moche. Je pensais que tu allais mettre un "i" a coté de "Cauchemars" ») : il vit en affordance
 * compacte sur la LIGNE DE TITRE de la fenêtre (`CascadeBody.titleNode`, `CascadeModal`), qui porte le
 * libellé du pas COURANT ; dérivé de la MÊME entrée d'enjeu.
 */
import { isValidElement, type ReactNode } from 'react';
import { resolveStake, refLabel, type StakeRef } from '../data';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';
import { Prose } from './Prose';
import { GameOpChips } from './GameOpChips';
import { EntityRef } from './EntityChip';
import type { GameOp } from '../engine/ops';

export function StakeNote({ stake }: { stake: StakeRef }) {
  // Entrée d'enjeu SANS gabarit (#1117) : la donnée porte seulement son foyer de règle — le jet dit
  // ce qu'il met en jeu par ses CHIPS d'ops (`OutcomeNote`), et le verbatim reste au ⓘ du titre.
  const { text } = resolveStake(stake);
  if (!text) return null;
  return (
    <div className="rm-stake">
      <Icon id="nav/dice" size="sm" />
      <div>
        <Prose md={text} />
      </div>
    </div>
  );
}

/**
 * `OutcomeNote` — l'encadré « Réussite / Échec » d'un jet, en régime CALCULÉ (#1117, arbitrage user
 * verbatim au ticket : « l'encadré "Réussite/Echec" se calcule plutot qu'écrit a la main, surtout
 * qu'avec les régles optionnelles qui veulent rentrer en jeu et modifier le comportement »).
 *
 * Il ne reçoit AUCUN texte : uniquement les `GameOp` CERTAINES de chaque branche (`certainFlowOps`),
 * humanisées par la source unique `GameOpChips`/`opRows` — donc une règle optionnelle qui change les
 * ops change l'encadré, par construction. Une branche INCERTAINE (`undefined` : seuil de DR, `compare`
 * mutable, choix joueur) n'est PAS rendue : promettre ce qui dépend d'une Condition serait pire que se
 * taire. Une branche vide se dit (« rien »), c'est une réponse.
 *
 * `onSuccessBy`/`onFailBy` — l'OBJET MÉCANIQUE qui prend la main sur une branche incertaine (arbitrage
 * user 2026-08-07, « Chip du talent ») : quand l'incertitude a un responsable IDENTIFIABLE (un `if`
 * d'appartenance qui rend la main à un second jet — `branchBlockingEntity`), la branche rend SA CHIP
 * plutôt qu'un silence. La chip est la même primitive que partout (`EntityRef`, popover + Codex) : sa
 * fiche dit le Test qu'elle ouvre. Zéro phrase, et le silence reste le défaut sans responsable nommé.
 *
 * `realized` — la branche que le jet A TRANCHÉE : l'encadré se FILTRE alors à elle seule et devient le
 * VERDICT (mêmes ops, même rendu, aucune seconde surface à synchroniser). Absent = avant le jet, les
 * deux issues sont annoncées.
 *
 * `sl` — le DR de CE jet, versé avec `realized` : une quantité à échelle par DR (Terreur : « Indice +
 * DR d'échec ») s'affiche au nombre RÉELLEMENT appliqué, celui-là même que le journal énonce. Avant le
 * jet il n'existe pas, et la chip annonce alors la règle entière (base + échelle).
 */
export function OutcomeNote({ onSuccess, onFail, onSuccessBy, onFailBy, realized, sl }: {
  onSuccess?: GameOp[];
  onFail?: GameOp[];
  onSuccessBy?: { category: string; id: string };
  onFailBy?: { category: string; id: string };
  realized?: 'success' | 'fail';
  sl?: number;
}) {
  const succ = realized === 'fail' ? undefined : onSuccess;
  const fail = realized === 'success' ? undefined : onFail;
  const succBy = realized === 'fail' ? undefined : onSuccessBy;
  const failBy = realized === 'success' ? undefined : onFailBy;
  if (!succ && !fail && !succBy && !failBy) return null;
  const ligne = (ops: GameOp[] | undefined, by: { category: string; id: string } | undefined) =>
    ops ? (ops.length ? <GameOpChips ops={ops} {...(sl != null ? { sl } : {})} /> : 'rien.')
      : <EntityRef category={by!.category} id={by!.id} label={refLabel(by!.category, { id: by!.id })} />;
  return (
    <div className="rm-stake">
      <Icon id="journal/info" size="sm" />
      <div>
        {succ || succBy ? <p><b>Réussite :</b> {ligne(succ, succBy)}</p> : null}
        {fail || failBy ? <p><b>Échec :</b> {ligne(fail, failBy)}</p> : null}
      </div>
    </div>
  );
}

/**
 * `StakeRule` — la PORTE du renvoi de règle, en affordance COMPACTE accolée au titre de l'étape ou
 * de la fenêtre (arbitrage user 2026-08-06). SOURCE UNIQUE du déclencheur : `CascadeBody.titleNode`
 * la compose pour les cascades, `RollShell` l'accole LUI-MÊME au titre de toute modale de jet qui pose
 * un `stake` (Z3b′ tenue par le SOCLE, plus par discipline au site). Rien quand aucun foyer n'est
 * déclaré, ou quand la fiche est inconnue du Codex (`hideIfUnknown`).
 * Le NOM ACCESSIBLE nomme la FICHE VISÉE, jamais le pas qui l'accueille : `CodexRef` le dérive de
 * l'entrée du Codex et lui préfixe le rôle (`ariaPrefix`). Aucun appelant ne prête plus son titre —
 * une bande « Initiative » dont l'enjeu est le chavirage s'annonçait « Règle : Initiative » pendant
 * que le lien menait à « Navigation — Chavirage et redressement ».
 */
export function StakeRule({ rule }: { rule?: { category: string; id: string } }) {
  if (!rule) return null;
  return (
    <CodexRef
      category={rule.category}
      id={rule.id}
      label=""
      ariaPrefix="Règle"
      className="ab-codex-info"
      hideIfUnknown
    >
      <Icon id="journal/info" size="sm" />
    </CodexRef>
  );
}

/** Le nœud porte-t-il DÉJÀ un `StakeRule` ? Reconnaissance par IDENTITÉ de composant (pas une
 *  heuristique de classe ou de texte) : `RollShell` s'en sert pour ne pas doubler le renvoi quand un
 *  site l'a composé lui-même dans son titre. */
export function hasStakeRule(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasStakeRule);
  if (!isValidElement(node)) return false;
  if (node.type === StakeRule) return true;
  return hasStakeRule((node.props as { children?: ReactNode }).children);
}

/** Foyer de règle DÉRIVÉ d'une référence d'enjeu — le producteur ne nomme jamais la fiche. */
export function stakeRuleOf(stake: StakeRef) {
  return resolveStake(stake).rule;
}

/** Égalité STRUCTURELLE de deux valeurs pur-donnée (op, formule imbriquée, tableau) — comparaison par
 *  CLÉS (ordre des propriétés indifférent) et par POSITION dans un tableau (l'ordre des ops d'une
 *  branche est celui de sa lecture, il porte du sens). Aucune sérialisation : un `JSON.stringify`
 *  rendrait le verdict dépendant de l'ordre d'écriture des clés. PURE. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameData(x, b[i]));
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return ka.length === kb.length
    && ka.every((k) => k in (b as object) && sameData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Deux rangées ANNONCENT-elles la même chose ? Compare les ops CERTAINES d'une branche par leur
 *  STRUCTURE (refs et valeurs), jamais par leur rendu : c'est ce qui autorise une fenêtre MULTI à
 *  n'énoncer qu'UNE fois une promesse commune (« à la table, le MJ l'annonce une fois »). Une branche
 *  INDÉCIDABLE (`undefined` — un second jet décide) n'est PAS la même chose qu'une branche vide
 *  (`[]` = « rien ») : la divergence par SILENCE reste une divergence. PURE. */
export function sameCertainOps(a: GameOp[] | undefined, b: GameOp[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return sameData(a, b);
}

/** Deux rangées désignent-elles le MÊME objet mécanique comme responsable de leur incertitude ? Deux
 *  guetteurs bloqués par des Talents DIFFÉRENTS n'annoncent pas la même chose : leur promesse ne se
 *  mutualise pas. PURE. */
export function sameEntityRef(a: { category: string; id: string } | undefined, b: { category: string; id: string } | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.category === b.category && a.id === b.id;
}
