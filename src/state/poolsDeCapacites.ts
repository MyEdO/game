/**
 * LES TROIS POOLS DE CAPACITÉS D'UN PORTEUR — producteur UNIQUE, hors de tout écran.
 *
 * Un pool est l'OFFRE COMPLÈTE d'une zone adressable de la console (`dispositionConsole.ts`) :
 * `arsenal` (ce que le set au poing et la situation du porteur ouvrent), `accesRapide` (le
 * nécessaire — consommables, Soin, aspersion), `capacites` (la grille du personnage : mouvement,
 * défense, Avantage, attaques de trait, sorts, manœuvres). Chaque entrée est un DESCRIPTEUR PUR :
 * l'id d'action du registre, la clé déclarée de sa case (son ADRESSE), le verdict d'offre avec sa
 * raison de refus, les paramètres du dispatcher, et de quoi l'habiller (id d'icône, ou l'OBJET dont
 * l'art fait l'icône). Aucun ReactNode ici : la console et l'écran de capacités habillent le même
 * descripteur, et rendent donc rigoureusement la même offre.
 *
 * La PERTINENCE (quel geste existe pour ce porteur, dans cette situation) est manuscrite ICI, à un
 * seul endroit : c'est elle qui décide qu'une case naît. Le registre (`src/data/actions.json`) dit
 * ce que la case EST (libellé, icône, foyer de règle, verdict, dispatcher) ; ce module dit QUAND
 * elle est offerte. Les deux lectures ne se recopient jamais l'une l'autre.
 */
import type { CharKey, Combatant, ItemInstance, Weapon } from '../engine/types';
import type { CodexTarget } from '../engine/ruleRefs';
import { useGame, type BattleState, type ShootingStanceKey } from './store';
import type { LocalIntent } from './localIntent';
import { availableAttacks, selfManeuversOf, selfManeuverApplicable, STANCE_BLOCK } from './combatFlow';
import { findSpellById, findSkillById, findActionById, ACTIONS, type ActionDef } from '../data/index';
import { actionGate, runAction, ACTION_CANDIDATES, ACTION_GATES, GATE_ETAT_PORTE, type ActionRunCtx } from './actionRegistry';
import { offresDuRegistre } from './registreOffres';
import { isConsumable } from '../engine/consumables';
import { attackWeapon } from '../engine/combat';
import { activeLoadout, isUnarmed } from '../engine/items';
import { weaponLoaded, reloadProgressOf } from '../engine/weaponLoad';
import { canPushback } from '../engine/qualities/dispatch';
import { hasBattement, hasDistraire, knownShanties } from '../engine/combatFeatures/dispatch';
import { dispellableSpellsOn } from '../engine/dispel';
import { actorHasSkill } from '../engine/skills';
import { hasHealSkill, healableTargets } from '../engine/healing';
import { canTakeAction, isActionLocked, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzied, isFrenzyCapable } from '../engine/psychology';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { canAidTeam } from './commandTeam';
import { shipOfCrew } from './shipPostes';
import { quartIndex } from './shipCrew';
import { isVehicle } from '../engine/vehicle';
import { inBattleId } from './combatants';
import { t } from '../i18n';

/** FAMILLE d'une case — porte l'accent de l'alvéole (filet de tête) et, à gauche, sa MATIÈRE :
 *  ce qu'on fait AVEC L'ARME est de l'acier, le geste et l'objet sont du laiton chaud (spécimen C).
 *  Attribut de données, jamais une classe par écran. C'est aussi la SECTION de l'écran de capacités. */
export type CellFamily = 'arme' | 'geste' | 'mouvement' | 'defense' | 'avantage' | 'attaque' | 'magie';

/** UNE CASE offerte : une ENTRÉE du registre des actions habillée du contenu réel du store.
 *  `run` absent = case dessinée non branchée (action `blocked`, ou console en lecture). */
export type CaseDeCapacite = {
  /** ADRESSE de la case dans une zone : identité de MODÈLE (`sort-<spellId>`, `q-objet-<trappingId>`),
   *  jamais un uid d'instance — consommer une potion ne déplace pas la case où le joueur l'a posée. */
  key: string;
  /** ID D'ACTION du registre — l'IDENTITÉ de la case : rendue en `data-action`, publiée au pont
   *  clavier, exécutée par `runAction`. Jamais une closure anonyme (spec HUD « Zone 12 »). */
  id: string;
  label: string;
  family: CellFamily;
  /** Icône du registre, ou celle que le site substitue (Compétence d'Avantage, attaque de trait). */
  iconId: string;
  /** OBJET dont l'ART fait l'icône (arme du set, consommable) : c'est le consommateur qui le rend
   *  (`ItemIcon`) — le descripteur ne connaît aucun ReactNode. */
  item?: ItemInstance | Weapon;
  /** CARACTÉRISTIQUE dont l'icône se déduit (une Compétence d'Avantage porte le glyphe de SA carac) :
   *  la table de glyphes est de l'AFFICHAGE, elle est lue par l'habillage (`ui/CaseIcone`). */
  iconChar?: CharKey;
  /** Coût en crans d'Avantage, adossé au conduit. */
  adv?: number;
  on?: boolean;
  /** Le MODE de la case est ARMÉ (intention locale ou `battle.action`) : le re-clic le dissout. */
  arme?: boolean;
  disabled?: boolean;
  /** La case OUVRE son panneau-paramètre au lieu de dispatcher : le geste est décidé, il lui manque
   *  un paramètre que la situation borne (quelle arme recharger). L'ouverture n'engage rien. */
  ouvrePanneau?: boolean;
  /** FOYER de règle de la case (`{category, id}` du Codex) : c'est LUI qui porte le texte de règle,
   *  en VERBATIM, dans le popover `CodexRef`. Aucune prose de règle n'est écrite ici. */
  rule?: CodexTarget;
  /** RAISON d'inéligibilité, quand la case se DESSINE quoi qu'il arrive mais que la situation en
   *  interdit l'usage. Elle se lit AU SURVOL et AU FOCUS (`CodexRef refus`), jamais gravée sous le
   *  nom de la capacité (arbitrage user 2026-08-24). */
  gate?: string;
  /** GESTES SECONDAIRES portés par CETTE case (entrées `surface: 'geste-secondaire'` du registre
   *  dont l'`hote` est l'entrée de la case et dont la population couvre son candidat). */
  secondaires?: CaseDeCapacite[];
  args?: ActionRunCtx;
  run?: () => void;
};

/** CONTEXTE d'un porteur : ce qu'aucun descripteur ne peut déduire de `battle` seul — la vie de la
 *  console (`live`), l'intention LOCALE armée, la possession de l'acteur, et l'heure de jeu (le
 *  QUART borne la chanson de marin, MDG 09 l.40). */
export type CtxPools = {
  active: Combatant;
  battle: BattleState;
  netMode?: string;
  /** Console VIVANTE : sous un bandeau de phase, les cases se dessinent mais ne dispatchent pas. */
  live: boolean;
  /** Ce siège TIENT l'acteur (`controlsCombatant`) — la barre d'un navire n'est servie que par là. */
  controlled: boolean;
  localIntent: LocalIntent | null;
  gameTime: number;
};

/** UN CANDIDAT de panneau-paramètre : ce que la primitive `PanneauParametre` sait rendre, sans rien
 *  connaître de React — le consommateur l'habille (`ParamOption`). */
export type CandidatParametre = {
  key: string;
  label: string;
  meta?: string;
  selected?: boolean;
  disabled: boolean;
  run?: () => void;
};

/** L'HABILLAGE des candidats d'un panneau, par le SÉLECTEUR que l'entrée DÉCLARE (`candidates` de
 *  `actions.json`) — MÊME clé que `ACTION_CANDIDATES`, donc le vocabulaire du registre et jamais un
 *  test d'identité d'action : une entrée qui borne son paramètre par le même sélecteur hérite du
 *  même panneau sans une ligne de plus. La console (alvéole) et l'écran des capacités ouvrent DONC
 *  la même liste, avec le même verdict par candidat. */
const PANNEAUX: Record<string, (ctx: CtxPools) => { intitule: string; options: CandidatParametre[] }> = {
  'armes-a-distance': (ctx) => ({ intitule: t('capacites.panneauRecharge'), options: candidatsDeRecharge(ctx) }),
};

/** Le panneau qu'une case OUVRE au lieu de dispatcher (`ouvrePanneau`), ou `undefined`. */
export function panneauDeCase(ctx: CtxPools, c: CaseDeCapacite): { intitule: string; options: CandidatParametre[] } | undefined {
  const selecteur = c.ouvrePanneau ? findActionById(c.id)?.candidates : undefined;
  return selecteur ? PANNEAUX[selecteur]?.(ctx) : undefined;
}

/** CANDIDATS du panneau « quelle arme recharger ? » : liste BORNÉE aux armes à Recharge du porteur.
 *  Chaque candidat EST l'entrée `reload` avec SON `weaponUid` — même verdict d'offre, même
 *  dispatcher (`battleReload`) que la case à une seule arme. Une arme DÉJÀ CHARGÉE est un candidat
 *  INERTE, avec son état dit : c'est exactement ce que mesure le dispatcher pour refuser. */
export function candidatsDeRecharge(ctx: CtxPools): CandidatParametre[] {
  const cellFor = fabriqueCase(ctx);
  const heldSet = activeLoadout(ctx.active);
  return armesRechargeables(ctx).map((w) => {
    const c = cellFor('reload', 'arme', { key: `recharge-${w.uid}`, label: w.label, args: { weaponUid: w.uid } });
    const chargee = weaponLoaded(ctx.active, w);
    const prog = reloadProgressOf(ctx.active, w);
    return {
      key: `recharge-${w.uid}`,
      label: w.label,
      // Deux pistolets portent le MÊME libellé : la MAIN du set les distingue (le set dit ce qui est
      // tenu), et l'état de charge dit lequel a besoin du geste.
      meta: [
        heldSet?.main === w.uid ? t('capacites.mainDirectrice') : heldSet?.off === w.uid ? t('capacites.mainGauche') : undefined,
        chargee ? t('capacites.armeChargee') : t('capacites.armeARecharger', { prog: prog ? ` ${prog}/${w.reload}` : '' }),
      ].filter(Boolean).join(' · '),
      disabled: chargee || !c?.run || !!c.disabled,
      run: c?.run,
    };
  });
}

/** ARMES À RECHARGE du porteur — lecture PARTAGÉE (pool de l'arsenal, en-tête et panneau de la
 *  console) : le SÉLECTEUR DU REGISTRE (`armes-a-distance`, déclaré par l'entrée `reload`), jamais un
 *  filtre recopié — deux pistolets sont DEUX armes, chacune avec son cycle de charge. */
export function armesADistance(ctx: CtxPools): Weapon[] {
  return ACTION_CANDIDATES['armes-a-distance']({ active: ctx.active, battle: ctx.battle, netMode: ctx.netMode }) as Weapon[];
}
export function armesRechargeables(ctx: CtxPools): Weapon[] {
  return armesADistance(ctx).filter((w) => (w.reload ?? 0) > 0);
}

/** Surcharges de SITE d'une case (ce que le porteur y met de réel). */
export type SurchargeCase = {
  key?: string;
  label?: string;
  iconId?: string;
  item?: ItemInstance | Weapon;
  iconChar?: CharKey;
  rule?: CodexTarget;
  on?: boolean;
  /** Restriction de SITE qui s'ajoute au verdict du registre (jamais qui l'annule) : la RAISON
   *  elle-même, jamais un booléen — une case grisée sans raison est MUETTE au survol, et le joueur
   *  n'a aucun moyen de savoir ce qui manque (le refus se LIT, arbitrage 2026-08-24).
   *  `undefined` = aucune restriction de site. */
  off?: string;
  adv?: number;
  args?: ActionRunCtx;
  /** PROGRESSION du Test étendu en cours sur le candidat de la case, portée par le libellé du geste
   *  secondaire qui l'alimente. */
  progres?: string;
  ouvrePanneau?: boolean;
};

/**
 * FABRIQUE de cases pour UN porteur : `cellFor(actionId, family, over)`.
 *
 * UNE CASE = UNE ENTRÉE de `src/data/actions.json` : libellé, icône, foyer de règle Codex, verdict
 * d'offre (`actionGate` → raison VISIBLE) et dispatcher (`runAction`) viennent tous de l'action. Le
 * site ne décide QUE de la pertinence, de la MATIÈRE (famille) et de l'habillage porté par le contenu
 * réel. Une action sans dispatcher (`blocked`) rend une case DESSINÉE mais inerte : le registre le
 * dit, elle ne feint pas.
 */
/** CE MODE-LÀ est-il armé ? Le mode qu'une case arme est une donnée de SON entrée (`armed`,
 *  `actions.json`) : on compare `battle.action` à ce que le REGISTRE déclare, aucune valeur d'état
 *  n'est recopiée. Une entrée rendue N FOIS (un sort par case) n'allume que la case du candidat ÉLU
 *  (`selectedSpellId`) : le mode seul ne distingue pas deux sorts. */
export function modeArmeDe(battle: BattleState, def?: ActionDef, args?: ActionRunCtx): boolean {
  return !!def?.armed && battle.action === def.armed && (!args?.spellId || battle.selectedSpellId === args.spellId);
}

export function fabriqueCase(ctx: CtxPools) {
  const { active, battle, netMode, live, localIntent } = ctx;
  const gateCtx = { active, battle, netMode };
  const modeArme = (def?: ActionDef, args?: ActionRunCtx) => modeArmeDe(battle, def, args);
  /** CANDIDATS portés par une case : les valeurs d'identité de ses ARGS. Aucun nom d'argument n'est
   *  cité ici — la case dit CE qu'elle paramètre, le registre dit qui le couvre. */
  const candidatsDe = (args?: ActionRunCtx): string[] =>
    Object.values(args ?? {}).filter((v): v is string => typeof v === 'string');
  /** LES OFFRES de la surface des gestes secondaires, par PORTEUR — socle PARTAGÉ avec les pastilles
   *  du champ (`state/registreOffres`) : l'enveloppe de sélecteur du registre DÉCLARE l'identité d'un
   *  candidat, une case n'a plus qu'à se reconnaître dans ses propres paramètres. */
  const offres2e = offresDuRegistre('geste-secondaire', { active, battle, netMode });

  const cellFor = (actionId: string, family: CellFamily, over: SurchargeCase = {}): CaseDeCapacite | undefined => {
    const def = findActionById(actionId);
    if (!def) return undefined;
    // Le verdict porte sur CETTE case, donc sur SES paramètres (`args`) : une entrée rendue N fois —
    // une par Compétence d'Avantage — s'ouvre ou se ferme par candidat, sur la même mesure que le
    // dispatcher. Les gates de règle pure les ignorent.
    const verdict = actionGate(def.id, { ...gateCtx, args: over.args });
    // Une action à INTENTION (spec zone 4) : sa case s'allume quand SON mode est armé, et le re-clic
    // le dissout — même patron, MÊME CODE, que les modes armés de `battle.action`.
    const armedIntent = !!def.intent && localIntent?.actionId === def.id;
    const arme = armedIntent || modeArme(def, over.args);
    return {
      key: over.key ?? def.keys?.[0] ?? def.id,
      id: def.id,
      family,
      iconId: over.iconId ?? (def.icon as string),
      item: over.item,
      iconChar: over.iconChar,
      label: over.label ?? def.label,
      rule: over.rule ?? (def.rule && def.ruleCategory ? ({ category: def.ruleCategory, id: def.rule } as CodexTarget) : undefined),
      // Le refus de SITE emprunte le MÊME canal que le verdict du registre : la case se ferme ET dit
      // pourquoi. Le verdict du registre PRIME (c'est la règle ; le site n'ajoute qu'une situation).
      gate: verdict.ok ? over.off : verdict.reason,
      secondaires: gestes2e(def, family, over.args, over.progres),
      on: over.on ?? (arme || undefined),
      arme: arme || undefined,
      adv: over.adv,
      args: over.args,
      ouvrePanneau: over.ouvrePanneau,
      disabled: !live || !verdict.ok || !!over.off,
      run: live && (def.run || def.intent)
        ? () => runAction(def.id, useGame.getState, { ...(over.args ?? {}), ...(arme ? { toggleOff: true } : null) })
        : undefined,
    };
  };

  /** GESTES SECONDAIRES d'une case — RENDEUR UNIQUE (aucun id d'action ici), appelé pour TOUTE case :
   *  les entrées `surface: 'geste-secondaire'` dont l'`hote` est l'entrée de la case et dont la
   *  population couvre l'un de ses candidats. Chacune EST une entrée du registre habillée par
   *  `cellFor` : même verdict d'offre, même dispatcher, même foyer de règle qu'une case. Un geste de
   *  plus = une ligne de JSON. Un geste secondaire n'en porte pas lui-même (le registre le refuse). */
  function gestes2e(def: ActionDef, family: CellFamily, args?: ActionRunCtx, progres?: string): CaseDeCapacite[] {
    if (def.surface === 'geste-secondaire') return [];
    const candidats = candidatsDe(args);
    if (!candidats.length) return [];
    const couvertes = new Set(
      offres2e.filter((p) => candidats.includes(p.porteurId)).flatMap((p) => p.offres.map((o) => o.actionId)),
    );
    return ACTIONS.filter((a) => a.surface === 'geste-secondaire' && a.hote === def.id && couvertes.has(a.id))
      .map((a) => cellFor(a.id, family, { key: `${a.id}-${candidats.join('-')}`, args, label: progres ? `${a.label} (${progres})` : undefined }))
      .filter((c): c is CaseDeCapacite => !!c);
  }

  return cellFor;
}

/**
 * LES TROIS POOLS du porteur — l'offre COMPLÈTE de chaque zone adressable, dans l'ordre du
 * pré-remplissage par défaut. Ce que la console place (`resoudreDisposition`) et ce que l'écran de
 * capacités montre sont LE MÊME retour : une capacité qui n'est pas ici n'existe nulle part.
 */
export function poolsDuPorteur(ctx: CtxPools): { arsenal: CaseDeCapacite[]; accesRapide: CaseDeCapacite[]; capacites: CaseDeCapacite[] } {
  const { active, battle, netMode, controlled, gameTime } = ctx;
  const cellFor = fabriqueCase(ctx);
  const vehicule = isVehicle(active);
  // RAISONS DE SITE — une restriction qui grise une case DIT ce qui manque : le canal est celui du
  // verdict du registre (`off`), jamais un booléen muet. Première raison vraie = celle qui s'affiche.
  const premiere = (...raisons: (string | false | undefined)[]) => raisons.find((r): r is string => !!r);
  const frenzied = isFrenzied(active) ? t('agate.frenzyOnly') : undefined;
  const stunned = !canTakeAction(active);
  // VERROU d'Action porté par un État (Brisé, LDB 16 l.52) : prédicat de DONNÉE
  // (`restrictsAction` → `isActionLocked`, source unique partagée avec l'IA), jamais un nom d'État.
  const broken = isActionLocked(active) ? t('agate.actionLocked') : undefined;
  /** Le porteur est-il EMPÊCHÉ, et par quoi ? Trois causes, une raison chacune — la case grisée la
   *  porte au survol. (Le registre refuse déjà la plupart de ces cas ; son verdict prime, celui-ci
   *  couvre les gestes GRATUITS que nul gate ne ferme.) */
  const busy = premiere(battle.acted && t('agate.actionSpent'), stunned && t('agate.unableToAct'), broken);

  // ── Travée GAUCHE : l'arsenal du set au poing + le nécessaire ──────────────────────────────
  const rangedWs = armesADistance(ctx);
  const heldSet = activeLoadout(active);
  // G1 porte l'arme DU SET, lue par `uid` — jamais la première arme de `c.weapons`, dont l'ordre ne dit
  // rien de ce qui est TENU. Sans set (statbloc de créature) : l'arme que le moteur ferait parler à
  // distance (`attackWeapon`, source unique du choix d'arme).
  const heldMainW = heldSet?.main ? active.weapons.find((w) => w.uid === heldSet.main) : undefined;
  const setWeapon = heldMainW ?? attackWeapon(active.weapons, false);
  // RECHARGE — le cycle de charge appartient à CHAQUE arme (`weaponLoad.ts`, registre par `uid`). La
  // case s'allume dès qu'UNE arme est à recharger ; la progression du Test étendu ne s'imprime sur
  // la case que s'il n'y a qu'un cycle à montrer — à deux armes, elle se lit au panneau, par arme.
  const rechargeables = rangedWs.filter((w) => (w.reload ?? 0) > 0);
  const aRecharger = rechargeables.filter((w) => !weaponLoaded(active, w));
  const needsReload = aRecharger.length > 0;
  const reloadProg = rechargeables.length === 1 ? reloadProgressOf(active, rechargeables[0]) : 0;
  // Deux armes à Recharge ou plus : la case OUVRE un panneau-paramètre borné (quelle arme ?) au lieu
  // de dispatcher — la géométrie de la travée ne bouge pas (arbitrage HUD 2026-08-16 : une case,
  // jamais un bouton-liste). Une seule arme : dispatch direct sur SON `uid`.
  const rechargeChoisissable = rechargeables.length >= 2;
  const canPush = active.weapons.some((w) => w.type === 'melee' && canPushback(w));
  // G5 — postures de tir ARMÉES : elles ne s'allument que tant qu'elles ont un effet (le MÊME prédicat
  // que le gate de la case et que le versement dans le `PendingAttack`) — une posture périmée ne se
  // peint pas. La case, elle, reste TOUJOURS dessinée : elle se grise et dit pourquoi.
  const posture = (key: ShootingStanceKey) => !!battle.stances?.[active.id]?.[key] && !STANCE_BLOCK[key](battle, active);
  // Armes DU SET au poing, lues par `uid` : c'est le set qui dit ce qui est TENU (arbitrage #1348
  // « ARBITRAGE SET STRICT »). Sans set (statbloc de créature), le set est l'arsenal réel de la bête,
  // Mains nues écartées par le prédicat canonique `isUnarmed` (`items.ts:178`, marqueur `builtinId`).
  const setWeapons = heldSet
    ? [heldSet.main, heldSet.off].filter((u): u is string => !!u).map((uid) => active.weapons.find((w) => w.uid === uid)).filter((w): w is Weapon => !!w)
    : active.weapons.filter((w) => !isUnarmed(w));
  // G2 Charge — `LDB 15 l.35-37` / `LDB 13 l.90` (fiche `regles/charger`) : elle ne se DÉDUIT que
  // d'un set qui ouvre un corps à corps — arme de mêlée DU set, ou set MAINS NUES. Un set de tir pur
  // ne la déduit pas. AUCUNE PERTE DE DROIT : ce prédicat ne règle que le REMPLISSAGE par défaut de
  // la travée ; la Charge reste un geste par défaut de la grille de capacités.
  const chargeDeduite = setWeapons.length === 0 || setWeapons.some((w) => w.type === 'melee');
  // Barre d'un navire : le porteur sert-il un poste de gouverne ? (source unique `shipOfCrew`)
  const atHelm = controlled ? shipOfCrew(battle.combatants, active.id) : undefined;
  // Tâches d'équipage PARALLÈLES de la coque (elles ne dépensent pas l'Action du navire, donc aucun
  // gate du registre ne les ferme) : le SITE dit si elles ont un objet — un chanteur apte dont le
  // quart n'a pas eu sa chanson (MDG 09 l.32-40), une pièce déchargée dont le chef reste libre.
  const shipCrew = vehicule
    ? (active.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c)
    : [];
  const canSing =
    active.lastShantyQuart !== quartIndex(gameTime) &&
    shipCrew.some((c) => !isOutOfAction(c) && knownShanties(c).length > 0 && !c.singingShanty);
  const reloadable = vehicule
    ? (active.postes ?? []).find((p) => p.loaded === false && p.crewIds?.[0] && !(battle.crewActed?.[active.id] ?? []).includes(p.crewIds[0]))
    : undefined;

  // Gestes DÉDUITS du set au poing (spec §1a, G1-G6bis). Chaque case EST une entrée du registre,
  // habillée du contenu réel (art de l'arme tenue, progression de charge).
  // ORDRE : l'arme d'abord, puis son cycle de charge (une arme à Recharge doit rester rechargeable
  // quel que soit le set), puis la Charge, la visée, le geste d'arme, la posture, l'état du porteur.
  const arsenal: (CaseDeCapacite | undefined)[] = [
    // G1 — attaque de l'arme du set (entrée `attaque`). L'icône et le nom suivent l'ARME réelle et le
    // foyer de règle est la POSSESSION. Une COQUE n'a ni arme tenue ni poing (`isVehicle`) : la case
    // d'attaque du set ne lui est pas pertinente — ce que le navire offre, ce sont ses Tests
    // d'équipage (plus bas).
    vehicule
      ? undefined
      : setWeapon
        ? cellFor('attaque', 'arme', { item: setWeapon, label: setWeapon.label, rule: setWeapon.trappingId ? { category: 'trappings', id: setWeapon.trappingId } : undefined, args: { attackId: 'arme' } })
        : cellFor('attaque', 'arme', { iconId: 'melee/grapple', label: 'Mains nues', rule: { category: 'trappings', id: 'mains-nues' }, args: { attackId: 'arme' } }),
    // G4 — Recharger : le porteur de l'état est l'ARME (progression du Test étendu), et c'est ELLE
    // que le dispatcher reçoit.
    rechargeables.length > 0
      ? cellFor('reload', 'arme', {
          label: `Recharger${reloadProg ? ` ${reloadProg}/${rechargeables[0].reload}` : ''}`,
          on: needsReload,
          off: premiere(busy, !needsReload && t('agate.weaponAlreadyLoaded'), frenzied),
          args: { weaponUid: rechargeables[0].uid },
          ouvrePanneau: rechargeChoisissable,
        })
      : undefined,
    // G2 — Charge (bouton d'intention : portée M×2 visible avant le clic). Le verdict d'offre vient
    // du registre (`charge-possible`), le verbatim du popover de sa fiche.
    chargeDeduite && !vehicule ? cellFor('charge', 'geste') : undefined,
    // G3 — Viser
    rangedWs.length > 0 ? cellFor('aim', 'arme', { label: active.aiming ? 'En joue' : 'Viser', on: !!active.aiming, off: premiere(busy, active.aiming && t('agate.alreadyAiming'), frenzied) }) : undefined,
    // G6 — geste d'ARME : la jauge est l'ARSENAL tenu (`canPushback`). L'Empoignade n'en est PAS un
    // (LDB 14 l.155, l.159) : elle reste à la modale d'attaque à mains nues.
    canPush ? cellFor('pushback', 'geste', { on: !!active.pushbackMode }) : undefined,
    // G5 — postures de tir PRÉ-ARMÉES (`battle.stances`, spec §1a G5) : les cases portent le choix, la
    // fenêtre de jet n'en garde que l'affichage. Bascule (re-clic = désarmer), gate en texte visible.
    // Les DEUX cases existent dès qu'une arme de tir est au poing — « Dans le tas » se grise hors
    // contexte (aucun groupe serré), elle ne disparaît pas. Géométrie de la travée : arbitrage #1434.
    rangedWs.length > 0 ? cellFor('posture-tir', 'arme', { on: posture('heldGround'), off: busy }) : undefined,
    rangedWs.length > 0 ? cellFor('posture-tas', 'arme', { on: posture('intoCrowd'), off: busy }) : undefined,
    // G6bis — gestes d'ÉTAT du porteur (surface `geste-d-etat` du registre, spec §1a) : ce que sa
    // SITUATION ouvre — en selle, à une pièce servie, à la barre — jamais ce que son arme offre.
    active.mountId ? cellFor('dismount', 'geste', { off: broken }) : undefined,
    active.mannedPoste ? cellFor('leave-poste', 'geste', { off: busy }) : undefined,
    // La barre : le BARREUR la tient (`atHelm`), et la COQUE elle-même quand c'est SON tour — même
    // case, mêmes arguments (`battleShipManeuver` accepte l'un ou l'autre, `combatSlice.ts:1362`).
    atHelm || vehicule ? cellFor('maneuver-ship', 'geste', { off: busy, args: { crewId: active.id } }) : undefined,
    // NAVIRE (échelle Mer) : au tour de la coque, ses Tests d'équipage sont les gestes de la travée —
    // les MÊMES cases du registre, pas une 2ᵉ barre. Bordée et Rude épreuve dépensent l'Action du
    // navire (gate `navire-action`) ; chant et recharge sont des tâches parallèles (gate `toujours`),
    // donc leur disponibilité RÉELLE est une restriction de SITE.
    vehicule ? cellFor('battery', 'attaque', { off: (active.postes ?? []).length === 0 ? t('agate.noGunPoste') : undefined }) : undefined,
    vehicule ? cellFor('crew-test-rude-epreuve', 'geste', { args: { shipId: active.id, crewTestId: 'rude-epreuve' } }) : undefined,
    vehicule ? cellFor('sing-shanty', 'geste', { off: canSing ? undefined : t('agate.noShantyToSing'), args: { shipId: active.id } }) : undefined,
    vehicule ? cellFor('ship-reload', 'geste', { off: reloadable ? undefined : t('agate.noPosteToReload'), args: { shipId: active.id, posteUid: reloadable?.item.uid } }) : undefined,
  ];

  // ── ACCÈS RAPIDE (2×2) : le nécessaire du héros — consommables à compteur, Soin, aspersion ──────
  const consumables = (active.items ?? []).filter(isConsumable);
  // Consommables GROUPÉS par MODÈLE — plusieurs potions identiques = une case à compteur ×N. La clé de
  // regroupement est l'id STABLE de catalogue (`trappingId`), jamais le libellé (doctrine CLAUDE.md :
  // « on ne manipule que des IDs ») ; un objet CUSTOM n'en a pas — son `uid` le distingue alors, et
  // deux customs homonymes restent deux cases. Le libellé du groupe reste celui du 1ᵉʳ objet.
  const consumableGroups = Object.values(
    consumables.reduce<Record<string, { key: string; label: string; uids: string[] }>>((acc, it) => {
      const cle = it.trappingId ?? it.uid;
      (acc[cle] ??= { key: cle, label: it.label, uids: [] }).uids.push(it.uid);
      return acc;
    }, {}),
  );
  const healTargets = hasHealSkill(active)
    ? healableTargets(active, battle.combatants.filter((c) => c.kind === active.kind), { adjacency: true })
    : [];
  // Aspersion d'eau (`water`) : le contenant est au sac, les cibles sont les alliés qui suffoquent.
  const waterTargets = hasWaterContainer(active)
    ? waterSprayCandidates(active, battle.combatants.filter((c) => c.kind === active.kind))
    : [];

  const accesRapide: (CaseDeCapacite | undefined)[] = [
    ...consumableGroups.map((g) => {
      const it = consumables.find((i) => i.uid === g.uids[0])!;
      return cellFor('use-item', 'geste', {
        key: `q-objet-${g.key}`,
        item: it,
        label: `${g.label}${g.uids.length > 1 ? ` ×${g.uids.length}` : ''}`,
        rule: it.trappingId ? { category: 'trappings', id: it.trappingId } : undefined,
        off: premiere(busy, frenzied),
        args: { itemUid: g.uids[0] },
      });
    }),
    healTargets.length > 0 ? cellFor('heal', 'geste', { key: 'q-soigner', off: premiere(busy, frenzied) }) : undefined,
    waterTargets.length > 0 ? cellFor('water', 'geste', { off: premiere(busy, frenzied) }) : undefined,
  ];

  // ── Travée DROITE : la grille de capacités (compte FIXE, remplissage par défaut mesuré) ─────
  // Compétences d'Avantage : le SÉLECTEUR DU REGISTRE (`competences-avantage`), pas une 2ᵉ lecture.
  // Il ne filtre PLUS le plafond : une méthode au plafond garde sa case, DESSINÉE FERMÉE avec sa
  // raison visible (gate `avantage-sous-plafond`) — le refus se voit, il ne fait pas disparaître
  // l'affordance (spec HUD § ARBITRAGE 2026-08-19).
  const advSkills = ACTION_CANDIDATES['competences-avantage']({ active, battle, netMode }) as { skillId: string; cap: number }[];
  // Les REMÈDES dont l'État est effectivement porté : le verdict est celui du registre, appelé sur
  // l'entrée elle-même — la pertinence et l'offre sont la MÊME mesure, prise une fois.
  const remedes = ACTIONS.filter(
    (a) => [a.gate].flat().includes(GATE_ETAT_PORTE) && ACTION_GATES[GATE_ETAT_PORTE]({ active, battle, netMode, def: a }).ok,
  );
  const canDispel = actorHasSkill(active, 'langue', 'magick');
  const dispellable = canDispel ? dispellableSpellsOn(battle.combatants) : [];
  // Test étendu EN COURS : le DR déjà cumulé et le NI à atteindre. Le NI se relit au Sort ENCORE
  // ACTIF (`dispellable`) — jamais une copie stockée.
  const dispelCible = active.dispel && dispellable.find((d) => d.spellId === active.dispel!.spellId && d.casterId === active.dispel!.spellCasterId);
  const dispelProg = dispelCible ? { total: active.dispel!.total, ni: dispelCible.ni } : null;
  // L'attaque d'ARME n'a rien à faire dans la grille de capacités : elle EST le geste du conduit
  // (travée gauche). Le tri se lit au DISCRIMINANT `kind` de `AttackOption`, jamais à l'id.
  const attacks = availableAttacks(active, battle).filter((a) => a.kind !== 'arme');
  const spells = (active.spells ?? []).map((id) => findSpellById(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const selfManeuvers = selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m));

  const capacites: (CaseDeCapacite | undefined)[] = [
    cellFor('course', 'mouvement'),
    cellFor('mouvement', 'mouvement'),
    isEngaged(active) ? cellFor('disengage', 'mouvement') : undefined,
    cellFor('defend', 'defense', { off: busy }),
    // Une Compétence porte l'icône de SA caractéristique (source unique `charIcon`) : six cases
    // d'Avantage ne partagent plus le même glyphe. UNE entrée de registre (`gain-advantage`), N cases.
    ...advSkills.map((s) =>
      cellFor('gain-advantage', 'avantage', {
        key: `advantage-${s.skillId}`,
        iconChar: findSkillById(s.skillId)?.characteristic,
        label: findSkillById(s.skillId)?.label ?? s.skillId,
        rule: { category: 'skills', id: s.skillId },
        off: busy,
        args: { skillId: s.skillId },
      }),
    ),
    hasBattement(active) ? cellFor('battement', 'avantage', { off: busy }) : undefined,
    hasDistraire(active) ? cellFor('distraire', 'avantage', { off: busy }) : undefined,
    // REMÈDES D'ÉTAT (Se relever, Se rouler, Se libérer) : la case naît de l'État PORTÉ — mesuré par
    // le gate que l'entrée DÉCLARE (`etat-porte` : elle dit l'État qu'elle traite, `rule` +
    // `ruleCategory: 'etats'`). Aucun id d'État ni d'action ici : un remède de plus est une ligne de
    // JSON. La famille (`mouvement` pour un relevé, `geste` sinon) se lit au COÛT déclaré.
    // ORDRE de pré-remplissage : celui de leur DÉCLARATION dans `actions.json` — c'est la donnée qui
    // range l'offre, plus la main qui les listait ici.
    ...remedes.map((def) =>
      cellFor(def.id, def.cost === 'mouvement' ? 'mouvement' : 'geste', { args: { stateId: def.rule } }),
    ),
    isFrenzyCapable(active) && !isFrenzied(active) ? cellFor('frenzy', 'geste') : undefined,
    canAidTeam(active, battle.combatants) ? cellFor('aid-team', 'geste', { off: busy }) : undefined,
    // DÉTERMINATION — deux des trois dépenses (LDB 17 l.59-60) sont des cases, comme toute action :
    // leurs dispatchers sont DIRECTS (le point part au clic), il n'y a donc rien à ARMER. La 3ᵉ
    // (« Retirez un État », l.61) vit sur la PASTILLE de l'État qu'elle retire. Le chiffre entre
    // parenthèses est la RÉSERVE restante.
    cellFor('resolve-psych-immune', 'defense', { label: `${findActionById('resolve-psych-immune')!.label} (${active.resolve ?? 0})` }),
    cellFor('resolve-ignore-crit', 'defense', { label: `${findActionById('resolve-ignore-crit')!.label} (${active.resolve ?? 0})` }),
    // DISSIPER (LDB 46 l.158-162) : la case ARME le mode, le clic-token élit le PORTEUR, et le SORT se
    // choisit au panneau-paramètre. La PROGRESSION du Test étendu se lit sur la case : c'est le seul
    // endroit où le joueur voit qu'un Sort est déjà entamé — et par combien.
    dispellable.length > 0
      ? cellFor('dispel', 'magie', {
          label: `${findActionById('dispel')!.label}${dispelProg ? ` ${dispelProg.total}/${dispelProg.ni}` : ''}`,
          off: premiere(busy, frenzied),
        })
      : undefined,
    ...selfManeuvers.map((m) =>
      cellFor('self-maneuver', 'geste', { key: `self-${m.id}`, label: m.label, rule: { category: 'maneuvers', id: m.id }, off: busy, args: { maneuverId: m.id } }),
    ),
    // Attaques de trait : adossées au conduit (elles se paient en crans d'Avantage). Une attaque de
    // ZONE immédiate (Hurlement) part par `maneuver-area` ; les autres ARMENT le clic (`select-attack`).
    ...attacks.map((a) => {
      const habillage = { key: `attaque-${a.id}`, iconId: a.icon as string, label: a.label, rule: { category: 'traits', id: a.id } as CodexTarget, adv: a.cost?.advantage ?? 0, off: busy };
      return a.targeting === 'zone'
        ? cellFor('maneuver-area', 'attaque', { ...habillage, args: { attackKind: a.kind } })
        : cellFor('select-attack', 'attaque', { ...habillage, args: { attackId: a.id } });
    }),
    // La case d'un SORT arme l'incantation de CE sort (entrée `cast-spell`, `armed: 'cast'`) et porte
    // ses GESTES SECONDAIRES (Focaliser). La progression de la Focalisation en cours se lit sur le
    // geste, comme le cumul de Dissipation sur la sienne : `active.focus` ne vaut que pour le sort
    // qu'il NOMME.
    ...spells.map((sp) => {
      const dr = active.focus?.spell === sp.id ? active.focus.dr : null;
      const progres = dr != null && sp.cn ? `DR ${dr}/${sp.cn}` : undefined;
      return cellFor('cast-spell', 'magie', {
        key: `sort-${sp.id}`, iconId: 'magic/power', label: sp.label, rule: { category: 'spells', id: sp.id },
        off: premiere(busy, frenzied), args: { spellId: sp.id }, progres,
      });
    }),
  ];

  const vivantes = (l: (CaseDeCapacite | undefined)[]) => l.filter((c): c is CaseDeCapacite => !!c);
  return { arsenal: vivantes(arsenal), accesRapide: vivantes(accesRapide), capacites: vivantes(capacites) };
}
