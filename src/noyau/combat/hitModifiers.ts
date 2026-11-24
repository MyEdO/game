/**
 * MODIFICATEURS DE TOUCHE ORDONNÉS (`HitModifier`, `TablesDuJeu.modificateursDeTouche`) — couture
 * d'extension calquée sur `roundHooks`/`turnHooks`, déclarée ici. Les sauvegardes SYNCHRONES « après la
 * touche » vivent ICI, chacune étant un modifier ordonné par `order` qui TESTE
 * une condition et TRANSFORME `res` (l'`AttackResult`). SITE UNIQUE des deux chemins de touche :
 * le coup physique (`applyAttackResult`) et le Projectile magique (`applyCast`/`appliquerTouchePourCible`),
 * qui n'a pas d'arme — la nature du coup se lit sur `ctx.attaque`, jamais sur `weapon.type`.
 *
 * N'importe RIEN de combatFlow → pas de cycle. Les helpers propres aux sauvegardes (`martyrGuardOf`,
 * `wardedAgainst`, `organicProjectile`) vivent ici.
 *
 * SÉMANTIQUE DE CHAÎNAGE : `runHitModifiers` enchaîne les modifiers dans l'ordre `order`, chacun
 * RE-TESTANT le `res` COURANT (`toucher`) puis écrivant ce qu'il a réécrit (`ecrire`) avant que le suivant
 * lise (un modifier qui annule déjà les Dégâts fait court-circuiter les suivants via leur propre garde
 * `res.woundsLost`). Renvoie le `res` final ; `toucheAuJet` rend le même sans rien écrire. Aucun modifier ne SUSPEND (pas de `pushCombatStep`/pending) : autoKill et l'offre de
 * Déviation Critique restent INLINE dans `applyAttackResult`, APRÈS cette chaîne.
 *
 * ORDRE (encodé par `order`, figé par `hitSaves.golden.hors-store.test`) :
 *   5 Réveil d'un dormeur → 8 Bouclier anti-flèches (le projectile est détruit AVANT d'être un coup
 *   reçu) → 10 sauvegarde « 1d10 ≥ Indice » (traits propres + Trait octroyé par un Dôme) → 40 Martyr
 *   → 50 Perturbante.
 */
import type { Jeu } from '../etat';
import type { Get } from '../flowTypes';
import type { Combatant, Weapon } from '../../engine/types';
import type { TraitList } from '../../engine/statEntry';
import { toucheAvecPrise, type AttackResult } from '../../engine/combat';
import type { SeuilDeSauvegarde } from '../pendings';
import { wardSaves, traitCapability } from '../../engine/traits/dispatch';
import { tablesPosees } from '../tablesPosees';
import { canPushback } from '../../engine/qualities/dispatch';
import { isOutOfAction, loseWounds, isMagicallyAsleep, wakeSleeper } from '../../engine/conditions';
import type { Applique } from '../../engine/faits';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { woundsFromHit } from '../../engine/woundsCalc';
import { distanceDeCombat } from '../monde/footprint';
import { porteeEnCases } from '../monde/combatGeometry';
import { reculPerturbant, poserLeRecul } from '../combatPlacement';
import { sceneMetresPerTile, type Scene } from '../monde/scene';
import { actorIn } from '../monde/combatants';
import { t } from '../../i18n';
import type { FragmentDeTables } from '../tablesPosees';
import { nomDe } from '../../engine/nom';

// ── Helpers propres aux sauvegardes ──

/** Martyr (LDB 43 l.99) : le prêtre (vivant, présent) qui encaisse à la place de `target`, ou null. */
export function martyrGuardOf(etat: Jeu, target: Combatant): Combatant | null {
  const id = (target.activeEffects ?? []).find((e) => e.martyrGuard)?.martyrGuard;
  if (!id || id === target.id) return null;
  const priest = actorIn(etat, id);
  return priest && !isOutOfAction(priest) && !priest.dead ? priest : null;
}

/** LES AURAS PORTÉES qui COUVRENT la cible (L11 — Bouclier anti-flèches / Dôme) : celles d'un porteur
 *  vivant dont le rayon contient la CIBLE et PAS l'attaquant (« provenant de l'extérieur » /
 *  « s'ils entrent dans la Zone d'Effet »). SITE UNIQUE de cette géométrie — les deux lectures
 *  (présence, charge de l'aura) en dérivent. */
function aurasCouvrant<T extends { radiusMeters: number }>(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  scene: Scene | null,
  lire: (e: NonNullable<Combatant['activeEffects']>[number]) => T | undefined,
): T[] {
  const out: T[] = [];
  for (const w of combatants) {
    if (isOutOfAction(w) || !w.pos) continue;
    for (const e of w.activeEffects ?? []) {
      const aura = lire(e);
      if (!aura) continue;
      const r = porteeEnCases(aura.radiusMeters, sceneMetresPerTile(scene));
      if (distanceDeCombat(scene, w, target) <= r && distanceDeCombat(scene, w, attacker) > r) out.push(aura);
    }
  }
  return out;
}

/** PRÉSENCE d'une aura couvrante — la lecture booléenne d'`aurasCouvrant`. */
export function wardedAgainst(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  field: 'arrowWard' | 'domeWard',
  scene: Scene | null,
): boolean {
  return aurasCouvrant(combatants, attacker, target, scene, (e) => e[field]).length > 0;
}

/** Les Traits que les Dômes couvrant la cible lui OCTROIENT (LDB 47 l.410) — la charge de l'aura est
 *  de la DONNÉE (`domeWard.ward`, posé par l'op du sort), lue par le MÊME collecteur de sauvegardes
 *  que les traits propres du porteur (`engine/traits/dispatch.wardSaves`). */
export function domeWardTraits(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  scene: Scene | null,
): TraitList {
  return aurasCouvrant(combatants, attacker, target, scene, (e) => e.domeWard).map((a) => a.ward);
}

/** LES SAUVEGARDES « 1d10 ≥ Indice » offertes à la cible CONTRE CE COUP : celles de ses propres Traits
 *  (Démoniaque `LDB 85 l.98`, Protection `LDB 85 l.278`) et celles qu'une zone lui octroie
 *  (Dôme `LDB 47 l.410` — branche `attaque === 'melee'` ci-dessous). UN SEUL collecteur d'Indices
 *  (`engine/traits/dispatch.wardSaves`) pour les deux provenances. Le TRAIT voyage avec son seuil : le
 *  journal nomme celui qui a réellement sauvé, et `dome` dit d'où il vient. */
export function seuilsDeSauvegarde(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  attaque: TypeDAttaque,
  scene: Scene | null,
): { thr: number; trait: TraitList[number]; dome: boolean }[] {
  const octroyes = attaque === 'melee' ? [] : domeWardTraits(combatants, attacker, target, scene);
  // CHOIX D'IMPLÉMENTATION non sourcé — le RAW (LDB 47 l.410) OCTROIE le Trait et reste MUET sur le
  // cumul : ici un Trait ne se possède qu'UNE fois, donc deux dômes couvrants (ou un dôme sur un porteur
  // qui a déjà le Trait) n'offrent pas deux dés : UN seul par id de Trait, au meilleur Indice, la
  // PROVENANCE restant celle de la première source vue. Deux Traits DISTINCTS (Démoniaque + Protection)
  // restent deux sauvegardes.
  const meilleur = new Map<string, { thr: number; trait: TraitList[number]; dome: boolean }>();
  for (const { t, dome } of [
    ...(target.traits ?? []).map((t) => ({ t, dome: false })),
    ...octroyes.map((t) => ({ t, dome: true })),
  ]) {
    const thr = wardSaves([t])[0];
    if (thr == null) continue;
    const vu = meilleur.get(t.id);
    if (!vu) meilleur.set(t.id, { thr, trait: t, dome });
    else if (thr < vu.thr) meilleur.set(t.id, { thr, trait: t, dome: vu.dome });
  }
  return [...meilleur.values()];
}

/**
 * CE QUE SAUVER FAIT À UNE TOUCHE — « le coup est ignoré, même s'il s'agit d'un critique » (LDB 85
 * l.98, LDB 85 l.278). ÉCRITURE UNIQUE lue par TOUS les sites qui jugent la touche : les modificateurs à la
 * ré-entrée, les effets d'une attaque gratuite, la reprise d'un maillon de balayage. PURE.
 *
 * CE QUI EST IGNORÉ est ce que le livre nomme : les Dégâts, les Blessures, le Critique, les effets de
 * touche (`toucheNonIgnoree`) — et le coup de grâce d'un Inconscient (LDB 16 l.113), qui est lui aussi
 * « un coup reçu ».
 *
 * CE QUI RESTE VRAI : la touche a bien EU LIEU (`hit`). Le livre lie le gain d'Avantage au Test, pas
 * aux Blessures — « Si vous remportez le Test, vous touchez votre adversaire et gagnez +1 Avantage »
 * (LDB 13 l.123), « Sur un succès, vous touchez votre adversaire et gagnez +1 Avantage » (LDB 13
 * l.125) : un coup sauvé garde donc son Avantage, son Engagement et sa ligne de journal.
 */
export function toucheSauvee(res: AttackResult): AttackResult {
  return { ...res, woundsLost: 0, damage: 0, autoKill: false, sansPrise: 'sauvegarde' };
}

/** Projectile « constitué de matière organique » (Bouclier anti-flèches, LDB 47) — flag maison
 *  éditable, keyé par id (`Weapon.organicProjectile`). */
export function organicProjectile(w: Weapon): boolean {
  return !!w.organicProjectile;
}

// ── Registre ──────────────────────────────────────────────────────────────────────────────────────

/** Contexte de l'application de la chaîne : la lecture de l'état, les protagonistes et le `res` COURANT ; les
 *  lignes d'un modifier vont dans `res.ajouts`. */
export interface HitModifierCtx {
  get: Get;
  attacker: Combatant;
  target: Combatant;
  /** L'ARME du coup — absente quand la touche n'en a pas (Projectile magique) : les modifiers qui la
   *  lisent (Bouclier anti-flèches, Perturbante) sont alors hors de leur cas. */
  weapon?: Weapon;
  /** NATURE de l'attaque, la seule que les modifiers interrogent : une règle qui vise les attaques
   *  magiques ou à distance (LDB 47 l.410) ne se lit pas sur `weapon.type`, qu'un Projectile magique
   *  n'a pas. */
  attaque: TypeDAttaque;
  res: AttackResult;
  /** LA PORTE des dés d'une SAUVEGARDE (#1508) : un modifier ne ROULE pas, il DÉCLARE ses seuils et la
   *  touche telle qu'il la voit — l'appelant pousse l'étape de dé (`pousserSauvegarde`) et SUSPEND sa
   *  résolution avant toute mutation. Canal REQUIS : c'est la seule façon d'obtenir un dé ici. */
  ouvrirSauvegarde: (seuils: SeuilDeSauvegarde[], res: AttackResult) => void;
  /** Un TIERS a encaissé à la place de la cible (Martyr) — l'appelant en tire ce qui ne relève pas des
   *  modificateurs (l'interruption de Focalisation vit dans `combatFlow`, que ce module n'importe pas). */
  encaisse?: (c: Combatant, pb: number) => void;
}

/** Les natures d'attaque qu'une sauvegarde peut distinguer — union FERMÉE : le corps à corps, le tir,
 *  et le Projectile magique (LDB 46), qui n'est porté par aucune arme. */
export type TypeDAttaque = 'melee' | 'distance' | 'magique';

/** Ce qu'un modifier lit d'une touche, sans rien écrire : l'état, les protagonistes, l'arme, la nature de l'attaque et
 *  le `res` COURANT. */
export type LectureDeTouche = Pick<HitModifierCtx, 'attacker' | 'target' | 'weapon' | 'attaque' | 'res'> & { etat: Jeu };

/** Ce qu'un modifier fait d'une touche : le `res` réécrit ; les seuils d'une sauvegarde à DÉCLARER (la chaîne s'arrête
 *  là) ; le tiers qui encaisse à la place de la cible (Martyr) ; l'écriture que l'application joue, et ses lignes. */
export interface IssueDuModifier {
  res: AttackResult;
  seuils?: SeuilDeSauvegarde[];
  encaisse?: { porteur: Combatant; pb: number };
  ecrire?: () => string[];
}

/** Un modifier de touche = une sauvegarde NOMMÉE qui TRANSFORME `res`. `order` fixe sa position dans la séquence
 *  (l'ordre RAW est encodé par `order`). `toucher` RE-TESTE `res` et le réécrit, PUR : l'application (`runHitModifiers`)
 *  joue son écriture, la prévision (`toucheAuJet`) ne la joue pas. Un modifier ne suspend RIEN : quand il lui faut un
 *  dé, il en rend les seuils. */
export interface HitModifier {
  id: string;
  order: number;
  toucher(l: LectureDeTouche): IssueDuModifier;
}

/** Les modifiers posés, triés par `order` croissant (tri STABLE), une fois par table posée. */
const tries = new WeakMap<readonly HitModifier[], readonly HitModifier[]>();
function modifiersPoses(): readonly HitModifier[] {
  const poses = tablesPosees().modificateursDeTouche;
  let liste = tries.get(poses);
  if (!liste) {
    liste = [...poses].sort((a, b) => a.order - b.order);
    tries.set(poses, liste);
  }
  return liste;
}

/**
 * CE QUE LA CHAÎNE REND : la touche threadée, et le fait qu'un dé ait été DÉCLARÉ — auquel cas la
 * chaîne s'est ARRÊTÉE là. Champ de RETOUR, jamais un drapeau sur `AttackResult` : la suspension est
 * un fait de FLUX, pas une propriété de la touche — posé sur `res`, il voyagerait dans la charge
 * sérialisée de l'étape et reviendrait VRAI à la ré-entrée. Le type oblige chaque appelant à le voir.
 */
export interface ToucheApresModifiers {
  res: AttackResult;
  suspendu: boolean;
}

/** Enchaîne les modifiers dans l'ordre `order`, chacun lisant le `res` laissé par le précédent ; `surIssue` reçoit
 *  chaque issue sans seuils et rend le `res` que lit le suivant. Un seuil rendu ARRÊTE la chaîne et la rend suspendue. */
function enchainer(lire: () => Jeu, l: Omit<LectureDeTouche, 'etat'>, surIssue: (issue: IssueDuModifier) => AttackResult): ToucheApresModifiers & { seuils?: SeuilDeSauvegarde[] } {
  let res = l.res;
  for (const h of modifiersPoses()) {
    const issue = h.toucher({ ...l, etat: lire(), res });
    if (issue.seuils) return { res, suspendu: true, seuils: issue.seuils };
    res = surIssue(issue);
  }
  return { res, suspendu: false };
}

/** L'APPLICATION de la chaîne : chaque modifier écrit ce qu'il a réécrit, avant que le suivant lise.
 *
 *  UN DÉ DÉCLARÉ ARRÊTE LA CHAÎNE (#1508) : tant que la sauvegarde n'est pas tombée, la touche n'est
 *  pas connue — un modifier d'ordre supérieur qui muterait l'état (Martyr `loseWounds`, Perturbante
 *  `poserLeRecul`) le ferait AVANT le dé, puis une SECONDE fois à la ré-entrée. L'arrêt vit ICI, dans
 *  le socle : aucun appelant ne peut l'oublier.
 *  À la ré-entrée (`res.sauvegarde` posée), `ward-saves` est TRAVERSANT et la chaîne tourne UNE fois. */
export function runHitModifiers(ctx: HitModifierCtx): ToucheApresModifiers {
  const fin = enchainer(ctx.get, ctx, (issue) => {
    const lignes = issue.ecrire?.() ?? [];
    if (issue.encaisse) ctx.encaisse?.(issue.encaisse.porteur, issue.encaisse.pb);
    return lignes.length ? { ...issue.res, ajouts: [...(issue.res.ajouts ?? []), ...lignes] } : issue.res;
  });
  if (fin.seuils) ctx.ouvrirSauvegarde(fin.seuils, fin.res);
  return { res: fin.res, suspendu: fin.suspendu };
}

/** LA PRÉVISION de la chaîne (#4574) : la touche que l'application rendra, et les tiers qui encaisseront, lus de l'état
 *  `etat` sans rien écrire ; `suspendu` quand un dé de sauvegarde reste à tirer. PUR. */
export function toucheAuJet(etat: Jeu, l: Omit<LectureDeTouche, 'etat'>): ToucheApresModifiers & { encaisses: { porteur: Combatant; pb: number }[] } {
  const encaisses: { porteur: Combatant; pb: number }[] = [];
  const fin = enchainer(() => etat, l, (issue) => {
    if (issue.encaisse) encaisses.push(issue.encaisse);
    return issue.res;
  });
  return { res: fin.res, suspendu: fin.suspendu, encaisses };
}

/** Modifiers posés (diagnostic / garde-fou de test). */
export function hitModifiers(): readonly HitModifier[] {
  return modifiersPoses();
}

// ── Sauvegardes post-touche ────────────────────────────────────────────────────────────

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  modificateursDeTouche: [
    {
      // Sommeil (Magie mineure) / Belladone : un dormeur MAGIQUE (Inconscient À DURÉE, PB > 0) se RÉVEILLE
      // quand on l'attaque (LDB 47 l.277). Le dormeur n'est PAS achevé (≠ coup de grâce d'un Inconscient
      // à 0 PB, LDB 16 l.113 → `autoKill` annulé) : il encaisse une attaque normale et se relève. EXCEPTION :
      // Salive analgésique (capability `wakelessBite`) — la morsure INDOLORE s'accroche à la proie sans la réveiller.
      id: 'wake-sleeper',
      order: 5,
      toucher: ({ attacker, target, res }) => {
        if (!res.hit || !isMagicallyAsleep(target) || traitCapability(attacker.traits, 'wakelessBite')) return { res };
        return {
          res: { ...res, autoKill: false, ajouts: [...(res.ajouts ?? []), t('cf.reveilDuDormeur', { name: nomDe(attacker), foe: nomDe(target) })] },
          ecrire: () => { wakeSleeper(target); return []; },
        };
      },
    },
    {
      // SITE UNIQUE de la sauvegarde « 1d10 ≥ Indice » (Démoniaque LDB 85 l.98, Protection LDB 85 l.278,
      // et le Trait qu'un Dôme octroie, LDB 47 l.410) : un seul collecteur d'Indices, quelle que soit la
      // provenance. Ce modifier ne ROULE RIEN (#1508) : il DÉCLARE ses seuils à la porte, qui pousse l'étape
      // de dé pour TOUT porteur (`combatFlow.pousserSauvegarde`) ; la touche revient ici avec sa sauvegarde
      // DÉCIDÉE (`res.sauvegarde`), et c'est ce champ qui interdit un second dé quand le même coup repasse
      // par les modificateurs après une autre fenêtre (Déviation Critique).
      id: 'ward-saves',
      order: 10,
      toucher: ({ etat, attacker, target, attaque, res }) => {
        if (!toucheAvecPrise(res)) return { res }; // LDB 85 l.98, l.278 : « après chaque coup reçu »
        // Sauvegarde déjà tombée : on APPLIQUE son issue. « le coup est ignoré, même s'il s'agit d'un
        // critique » (LDB 85 l.98) — la ligne du dé, elle, est écrite par la porte (`cascade.lireEnSeuil`).
        if (res.sauvegarde) return { res: res.sauvegarde.sauve ? toucheSauvee(res) : res };
        const seuils = seuilsDeSauvegarde(etat.battle?.combatants ?? [], attacker, target, attaque, etat.scene)
          .map(({ thr, trait, dome }) => ({ indice: thr, source: { kind: 'trait' as const, id: trait.id }, dome }));
        // GRAPPE DÉPENDANTE : les seuils partent ENSEMBLE à la porte, qui n'en ouvre qu'UN à la fois — le
        // suivant n'existe que si le précédent a raté, aucun dé n'est minté d'avance.
        return seuils.length ? { res, seuils } : { res };
      },
    },
    {
      // Bouclier anti-flèches (LDB 47 — L11) : projectile ORGANIQUE entrant dans la zone → détruit,
      // « n'infligeant aucun Dégât à leur cible ». Le tir et la munition sont consommés normalement.
      // AVANT les sauvegardes : un projectile détruit en vol n'est pas un coup reçu (LDB 85 l.98), il n'y a
      // donc aucun dé de sauvegarde à jeter contre lui.
      id: 'arrow-ward',
      order: 8,
      toucher: ({ etat, attacker, target, weapon, attaque, res }) => {
        if (res.hit && attaque === 'distance' && weapon && organicProjectile(weapon)
          && wardedAgainst(etat.battle?.combatants ?? [], attacker, target, 'arrowWard', etat.scene)) {
          return { res: { ...res, woundsLost: 0, damage: 0, sansPrise: 'bouclier-anti-fleches', touche: undefined, log: t('cf.bouclierAntiFlechesDesagrege', { name: nomDe(target) }) } };
        }
        return { res };
      },
    },
    {
      // Martyr : LDB 43 l.107 ; le Critique reste sur la cible (LDB 14 l.3, LDB 13 l.159).
      id: 'martyr',
      order: 40,
      toucher: ({ etat, attacker, target, weapon, res }) => {
        const raw = res.damage ?? res.woundsLost;
        const priest = res.hit && !res.degatsTransferes && raw ? martyrGuardOf(etat, target) : null;
        if (!priest || !raw) return { res };
        // LDB 13 l.159, LDB 43 l.107.
        const taken = woundsFromHit(weapon, priest, res.location ?? 'corps', raw - bonus(effectiveChar(priest, 'endurance')), 0, 1, attacker.size);
        return {
          res: { ...res, woundsLost: 0, degatsTransferes: true, ajouts: [...(res.ajouts ?? []), t('cf.martyrEncaisse', { priest: nomDe(priest), name: nomDe(target), taken })] },
          encaisse: { porteur: priest, pb: taken },
          ecrire: () => {
            const consequences: Applique = { lignes: [], faits: [] };
            loseWounds(priest, taken, consequences);
            return consequences.lignes;
          },
        };
      },
    },
    {
      // Perturbante (LDB 62 l.272-274) : mode « Repousser » armé → l'attaque réussie ne cause PAS de
      // Dégâts, l'adversaire recule d'1 m par DR du Test opposé, en cases à l'échelle de la scène (LDB 15 l.12).
      id: 'pushback',
      order: 50,
      toucher: ({ etat, attacker, target, weapon, attaque, res }) => {
        if (!attacker.pushbackMode || attaque !== 'melee' || !weapon || !canPushback(weapon)) return { res };
        const consommer = (): string[] => { attacker.pushbackMode = false; return []; }; // consommé par cette attaque (réussie ou non)
        if (!res.hit) return { res, ecrire: consommer };
        const meters = Math.max(0, res.netSL);
        const wanted = Math.floor(meters / sceneMetresPerTile(etat.scene));
        const recul = reculPerturbant(etat, attacker, target, wanted);
        const moved = recul?.moved ?? 0;
        return {
          res: {
            ...res, woundsLost: 0, damage: 0, touche: undefined, // #1595 c.6221792068 Q2 : le Coup Critique demeure
            log: t('cf.repoussement', { name: nomDe(attacker), foe: nomDe(target), meters, bloque: moved < wanted ? t('cf.repoussementBloque') : '' }),
          },
          ecrire: () => {
            const lignes = consommer();
            if (recul && etat.scene) poserLeRecul(etat.scene, target, recul.pos);
            return lignes;
          },
        };
      },
    },
  ],
} satisfies FragmentDeTables;
