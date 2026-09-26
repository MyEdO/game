import { Fragment, useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import { nomDuSiege } from '../state/netFlow';
import { useGame, activeCombatant, movementRemaining, type BattleState, type ShootingStanceKey } from '../state/store';
import type { Combatant, Weapon, WeaponLoadout } from '../engine/types';
import { hasMeaningfulOption } from '../state/turnEconomy';
import { wastesAction, endTurnArmed } from '../state/endTurnGuard';
import { advantageCapFor } from '../engine/advantage';
import { attackWeapon } from '../engine/combat';
import { availableAttacks, selfManeuversOf, selfManeuverApplicable, previewResourceDelta, STANCE_BLOCK } from '../state/combatFlow';
import { findSpellById, byId, findActionById, ACTIONS, type ActionDef } from '../data/index';
import { type CodexTarget } from '../engine/ruleRefs';
import { actionGate, runAction, currentInterludeAction, ACTION_CANDIDATES, remedesPertinents, type ActionCtx, type ActionRunCtx } from '../state/actionRegistry';
import { offresDuRegistre } from '../state/registreOffres';
import { targetingModeLabel, dispellableOnCarrier } from '../state/targetingModes';
import { CodexRef } from './compendium/CodexRef';
import { isConsumable } from '../engine/consumables';
import { t } from '../i18n';
import { loadedAmmo, compatibleAmmo, loadoutLabel, activeLoadout, weaponFromItem, isUnarmed } from '../engine/items';
import { weaponLoaded, reloadProgressOf } from '../engine/weaponLoad';
import { canPushback } from '../engine/qualities/dispatch';
import { hasBattement, hasDistraire, knownShanties } from '../engine/combatFeatures/dispatch';
import { dispellableSpellsOn } from '../engine/dispel';
import { PanneauParametre, type ParamOption } from './PanneauParametre';
import { useLongPress } from './useLongPress';
import { ReadyRow } from './ReadyRow';
import { SpectatorChip } from './SpectatorChip';
import { spectatorSeatOfModal } from './ownership';
import { actorHasSkill } from '../engine/skills';
import { hasHealSkill, healableTargets } from '../engine/healing';
import { canTakeAction, isActionLocked, isOutOfAction, raisonRefusDetermination } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzied, isFrenzyCapable } from '../engine/psychology';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { canAidTeam } from '../state/commandTeam';
import { shipOfCrew } from '../state/shipPostes';
import { quartIndex } from '../state/shipCrew';
import { isVehicle } from '../engine/vehicle';
import { controlsCombatant } from '../state/netOwnership';
import { inBattleId } from '../state/combatants';
import { combatDistance } from '../state/footprint';
import { hotbar } from '../state/hotbarBridge';
import { TAILLE_ZONE, TOUCHES_IMPRIMEES, cleEntree, dispositionDeduite, resoudreDisposition, type EntreeBarre, type ZoneBarre } from '../state/dispositionConsole';
import { charIcon, type EffectChip } from '../gameIso/effectIcons';
import { HERO_RING, ENEMY_RING, ENEMY_TINT, hpColor } from '../gameIso/teamColors';
import { PortraitTile } from './PortraitTile';
import { StateChips } from './StateChips';
import { LifeBar } from './LifeBar';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import type { IconIdInput } from './icons';

/** Nombre de cases de chaque travée — GÉOMÉTRIE IMMUABLE (arbitrage utilisateur 2026-08-16 :
 *  « je ne veux pas que la taille de l'interface ou les boutons bougent »). Le contenu varie,
 *  le compte de cases JAMAIS : une case sans contenu se DESSINE vide. Les trois zones ADRESSABLES
 *  tiennent leur taille de `TAILLE_ZONE` : c'est la même mesure qui borne la disposition du porteur. */
const LEFT_CELLS = TAILLE_ZONE.arsenal; // travée gauche : 2×3 — les gestes déduits du set (§1a) puis les cases LIBRES
const QUICK_CELLS = TAILLE_ZONE.accesRapide; // rubrique ACCÈS RAPIDE : 2×2 (consommables groupés + Soin)
const SET_SLOTS = 3; // colonne latérale de SETS : vignettes toujours dessinées (planche 2026-08-17)
const RIGHT_CELLS = TAILLE_ZONE.capacites; // grille de capacités : 2×6
const ADVANTAGE_COLLARS = 10; // conduit d'Avantage (LDB 14 l.198)
const ARCH_STATE_CELLS = 4; // niche d'États de l'arche : alvéoles réservées (spec §1c-bis)
const PRINTED_KEYS = TOUCHES_IMPRIMEES; // touches imprimées dans les cases de la grille (spec zone 8 : 1-8)

/** FAMILLE d'une alvéole — porte l'accent de la case (filet de tête) et, à gauche, sa MATIÈRE :
 *  ce qu'on fait AVEC L'ARME est de l'acier, le geste et l'objet sont du laiton chaud (spécimen C).
 *  Attribut de données, jamais une classe par écran. */
type CellFamily = 'arme' | 'geste' | 'mouvement' | 'defense' | 'avantage' | 'attaque' | 'magie';

/** Une alvéole : une ENTRÉE du registre des actions (`src/data/actions.json`) habillée du contenu réel
 *  du store. `run` absent = case dessinée non branchée (action `blocked`, ou console en lecture). */
type Cell = {
  key: string;
  /** ID D'ACTION du registre — l'IDENTITÉ de la case : rendue en `data-action`, publiée au pont
   *  clavier, exécutée par `runAction`. Jamais une closure anonyme (spec HUD « Zone 12 »). */
  id: string;
  icon: ReactNode;
  label: string;
  family: CellFamily;
  /** Coût en crans d'Avantage, adossé au conduit. */
  adv?: number;
  on?: boolean;
  disabled?: boolean;
  /** FOYER de règle de la case (`{category, id}` du Codex, `RULE_REF`/registre de données) : c'est LUI
   *  qui porte le texte de règle, en VERBATIM, dans le popover `CodexRef`. Aucune prose de règle n'est
   *  écrite ici (CLAUDE.md règles 5 & 6) — la case NOMME, la donnée EXPLIQUE. */
  rule?: CodexTarget;
  /** RAISON d'inéligibilité, quand la case se DESSINE quoi qu'il arrive mais que la situation en
   *  interdit l'usage (Charger alors qu'on est Engagé — `regles/charger`). Elle se lit AU SURVOL et AU
   *  FOCUS (souris, clavier, manette) dans l'infobulle partagée (`CodexRef refus`), et reste liée par
   *  `aria-describedby` à sa copie hors écran — jamais gravée sous le nom de la capacité (arbitrage
   *  user 2026-08-24). Le compte de cases ne bouge jamais. */
  gate?: string;
  /** GESTES SECONDAIRES portés par CETTE alvéole (entrées `surface: 'geste-secondaire'` du registre
   *  dont l'`hote` est l'entrée de la case et dont la population couvre son candidat) : ils naissent
   *  du clic droit, de l'appui long, de la touche Menu ou de RB à la manette — jamais d'une case de
   *  plus (la géométrie de la console ne bouge pas). Un seul geste = dispatch direct s'il est offert,
   *  refus LU À LA CASE s'il est fermé ; à partir de deux = panneau-paramètre ancré à l'alvéole. */
  secondaires?: Cell[];
  run?: () => void;
};

/** L'alvéole vide est un CREUX MUET, dans les DEUX travées : sa matière (verre sombre, cadre, ombre
 *  interne) dit qu'elle est offerte au placement du joueur — aucun mot ne s'y grave (arbitrage user
 *  2026-08-24 : « Et je ne connais aucune interface, même pas Rogue Trader, qui dans les emplacement
 *  de capacité met "Libre" »). Seul un lecteur d'écran l'entend nommer, par son texte hors écran.
 *
 *  ZÉRO `title` : l'infobulle native est proscrite (charte + grief du juge vision « la raison n'est
 *  qu'en title »). Ce que la case doit dire passe par TROIS véhicules VISIBLES ou accessibles :
 *  le libellé (+ `aria-label` pour le libellé entier quand l'ellipse le tronque), la copie hors écran
 *  de la RAISON de gate liée par `aria-describedby`, et le popover `CodexRef` (mode `wrap` : le bouton
 *  EST l'affordance de sa règle, sans ⓘ voisin — #1078) qui porte, au survol comme au focus, CETTE
 *  raison (`refus`) puis le verbatim de la donnée.
 *
 *  `ciblageArme` MET CE POPOVER EN SOURDINE (`suppressPopover`) : tant qu'on VISE — intention locale
 *  qui peint sa portée sur le terrain (spec zone 4) ou mode de ciblage armé au registre
 *  (`battle.action`) — le survol sert à désigner une cible, pas à lire une règle, et la boîte —
 *  ouverte par le focus que le clic vient de donner au bouton — recouvrait exactement ce que le
 *  joueur a demandé à voir (sonde du juge vision : le pavé de règle sur la bandelette de refus de
 *  Dissiper). Le ciblage dissous, la règle revient. */
export function ConsoleCell({ cell, hotkey, advantage = 0, ciblageArme = false, cellRef, onGeste2e }: { cell?: Cell; hotkey?: number; advantage?: number; ciblageArme?: boolean;
  /** ANCRE de l'alvéole, quand un panneau-paramètre doit NAÎTRE d'elle (`PanneauParametre`, spec
   *  zone 10) : le panneau se pose sur le rect de CE bouton, il ne flotte pas au centre de l'écran. */
  cellRef?: Ref<HTMLButtonElement>;
  /** GESTE SECONDAIRE de l'alvéole : QUATRE surfaces pour un seul chemin — clic droit, appui long,
   *  touche Menu (ou Maj+F10) sur l'alvéole focalisée, RB à la manette. L'alvéole n'en décide rien :
   *  la console dit ce que le geste FAIT (dispatch direct ou panneau), la case ne fait que l'appeler. */
  onGeste2e?: () => void;
}) {
  // Une case FERMÉE (verdict refusé, restriction de site, console en lecture) ne porte AUCUN geste
  // secondaire ATTEIGNABLE : `<button disabled>` ne reçoit ni `contextmenu` ni `pointerdown` dans un
  // vrai navigateur. Les quatre surfaces se taisent donc avec elle — et le glyphe qui les annonce
  // aussi, sinon il promet un geste que rien ne peut prendre.
  const atteignable = !!cell && !cell.disabled && !!cell.run;
  const secondaires = atteignable ? cell!.secondaires ?? [] : [];
  // N=1 REFUSÉ : à un seul geste fermé, rien ne s'ouvre — un panneau à un item désactivé n'est pas un
  // paramètre. Le refus se lit À LA CASE (infobulle de survol/focus + nom accessible), comme tout gate.
  const refus2e = secondaires.length === 1 && !(secondaires[0].run && !secondaires[0].disabled) ? secondaires[0] : undefined;
  const geste2e = secondaires.length > 0 && !refus2e ? onGeste2e : undefined;
  // L'appui long AVALE la salve qu'il précède (`consomme`, lu par `click` ET `contextmenu`) : sans
  // quoi le doigt lèverait le geste secondaire PUIS l'action primaire de la case.
  const appuiLong = useLongPress(geste2e);
  if (!cell) {
    // Une case VIDE garde son RANG et sa touche imprimée : c'est l'adresse qui s'apprend, pas le
    // contenu du moment (spec zone 8 — la touche suit la CASE). Elle attend le placement du joueur.
    return (
      <span className="chip cc-cell cc-empty" data-hotkey={hotkey ? '' : undefined}>
        {hotkey ? <span className="cc-key">{hotkey}</span> : null}
        <span className="hors-ecran">{t('cc.caseVide')}</span>
      </span>
    );
  }
  const inert = !cell.run;
  // UNE raison par alvéole (une seule infobulle par ancrage) : celle de la CASE, sinon
  // celle de son geste secondaire unique refusé, qui se NOMME (« Focaliser : … »).
  const raison2e = refus2e?.gate;
  const raison = cell.gate ?? (raison2e ? `${refus2e!.label} : ${raison2e}` : undefined);
  const gateId = raison ? `cc-gate-${cell.key}` : undefined;
  // FERMETURE de l'alvéole : `disabled` HTML tant qu'elle n'a RIEN à dire (maquette non branchée), mais
  // `aria-disabled` dès qu'elle PORTE UNE RAISON — l'attribut HTML la retirerait de l'ordre de
  // tabulation, du filtre de la manette (`visibleFocusables`) et de tout événement de pointeur : sa
  // raison, qui vit au survol/focus, ne serait lisible qu'à la souris. Le clic reste INERTE.
  const ferme = !!cell.disabled || inert;
  const fermeParlante = ferme && !!raison;
  const nom = secondaires.length === 0
    ? cell.label
    : refus2e && raison2e
      ? `${cell.label} — ${t('cc.geste2eIndisponible', { geste: refus2e.label, raison: raison2e })}`
      : `${cell.label} — ${t('cc.geste2eSurfaces', { gestes: secondaires.map((g) => g.label).join(', ') })}`;
  // La touche est celle de l'ADRESSE : elle s'imprime sur la case vide comme sur la case pleine, et
  // ne se déplace jamais d'un rang. Seule une case REFUSÉE l'éteint (gate du registre, ou situation
  // qui la ferme) : son badge ne promet pas une touche qui ne fera rien, et ne mord pas la raison.
  const touche = hotkey && !cell.disabled ? hotkey : undefined;
  const button = (
    <button
      ref={cellRef}
      type="button"
      data-cell={cell.key}
      data-action={cell.id}
      data-family={cell.family}
      data-gated={raison ? '' : undefined}
      /* La case qui IMPRIME sa touche lui RÉSERVE sa bande au pied (même patron que la bande de
         raison) : sur un libellé long, le chiffre passait sous les mots (grief du juge vision,
         « Immunité Psychologie (2) »). La géométrie de la case, elle, ne bouge pas. */
      data-hotkey={touche ? '' : undefined}
      aria-disabled={fermeParlante || undefined}
      /* Les gestes SECONDAIRES de l'alvéole, nommés en structure : le geste est un CHEMIN, pas une
         case — c'est le seul marqueur par lequel une sonde (ou la garde de surface) le mesure. */
      data-geste-2e={cell.secondaires?.length ? cell.secondaires.map((g) => g.id).join(' ') : undefined}
      className={`chip cc-cell${cell.on ? ' on' : ''}${inert ? ' cc-inert' : ''}`}
      disabled={ferme && !fermeParlante}
      /* Le geste secondaire se DIT dans le nom accessible : un glyphe de coin ne se lit pas au
         lecteur d'écran, et l'infobulle native est proscrite (charte). */
      aria-label={nom}
      aria-describedby={gateId}
      /* `data-gated` dit qu'une raison est portée ; ce marqueur-ci dit LAQUELLE : celle du geste
         secondaire refusé, sur une case qui reste OFFERTE — elle ne s'éteint donc pas. */
      data-refus-2e={raison2e && !cell.gate ? '' : undefined}
      onClick={() => { if (appuiLong.consomme() || ferme) return; cell.run?.(); }}
      /* Un `contextmenu` qui SUIT un appui long déjà déclenché (le navigateur le dérive de l'appui au
         doigt) est avalé : sans quoi le geste partirait deux fois — et se rebasculerait à N≥2. */
      onContextMenu={geste2e ? (e) => { e.preventDefault(); if (appuiLong.consomme()) return; geste2e(); } : undefined}
      /* Touche MENU (et Maj+F10) : le geste secondaire au clavier, sur l'alvéole focalisée. Le
         `preventDefault` empêche le navigateur d'en dériver son propre `contextmenu` (double chemin). */
      onKeyDown={geste2e ? (e) => {
        if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return;
        e.preventDefault();
        geste2e();
      } : undefined}
      {...(geste2e ? appuiLong.handlers : null)}
    >
      {touche ? <span className="cc-key">{touche}</span> : null}
      {/* Le geste secondaire SE VOIT : son glyphe gravé au coin de l'alvéole (marqueur structurel,
          comme la bande de touche — aucune classe de plus). */}
      {secondaires.length ? <span data-glyphe-2e="" aria-hidden="true">{secondaires.length > 1 ? `+${secondaires.length}` : secondaires[0].icon}</span> : null}
      <span className="cc-ico">{cell.icon}</span>
      <span className="cc-lbl">{cell.label}</span>
      {/* RAISON d'indisponibilité : lue au SURVOL/FOCUS dans l'infobulle partagée (`CodexRef refus`,
          plus bas) ; ce qui reste ICI est sa copie HORS ÉCRAN, cible de l'`aria-describedby`. */}
      {raison ? <span className="hors-ecran" data-gate="" data-gate-2e={cell.gate ? undefined : ''} id={gateId}>{raison}</span> : null}
      {cell.adv ? (
        <span className="cc-cost" aria-label={`Coût : ${cell.adv} Avantage (${Math.min(advantage, cell.adv)} couvert${Math.min(advantage, cell.adv) > 1 ? 's' : ''})`}>
          {Array.from({ length: cell.adv }, (_, i) => (
            <i key={i} className={i < advantage ? 'on' : undefined} />
          ))}
        </span>
      ) : null}
    </button>
  );
  // Le FOYER de règle enveloppe le bouton sans rien lui prendre (`wrap` : ni clic, ni rôle, ni
  // tabindex) — c'est l'idiome des boutons de dépense (`ChanceButtons`, `DeterminationButton`). C'est
  // la MÊME enveloppe qui porte la RAISON du refus : une seule infobulle par alvéole, jamais deux
  // boîtes concurrentes sur le même ancrage — et une case gatée sans foyer de règle l'ouvre à elle
  // seule (`refus` suffit à faire naître le popover).
  return cell.rule || raison
    ? (
      <CodexRef category={cell.rule?.category} id={cell.rule?.id} label={cell.label} refus={raison} wrap suppressPopover={ciblageArme}>
        {button}
      </CodexRef>
    )
    : button;
}

function icon(id: IconIdInput) {
  return <Icon id={id} />;
}

/** Le MENU NATIF du navigateur n'a rien à faire en plein HUD : le clic droit est le geste secondaire
 *  de la console, même là où l'alvéole n'en porte aucun (elle ne répond alors rien). Avalé UNE fois,
 *  à la racine du pont — jamais case par case. */
const avalerMenuNatif = (e: { preventDefault: () => void }) => e.preventDefault();

/** Le BANDEAU DE PHASE (`.cc-phase`, superposé au parapet) : ce que le pont dit quand le tour n'est
 *  pas ordinaire — pause de Round, interlude de ciblage par la carte, tour d'un autre. Ses actions
 *  sont des ENTRÉES DU REGISTRE (ou le geste de pause), jamais des closures anonymes. */
type PhaseAction = { key: string; label: string; icon: ReactNode; primary: boolean; disabled?: boolean; run: () => void };
/** `ready` = état du READY-CHECK de la phase (coop) : la bande porte alors la rangée des sièges
 *  REQUIS (`ReadyRow`, même quorum que le dispatcher) au-dessus de son geste. */
export type PhaseBanner = { label: ReactNode; actions: PhaseAction[]; ready?: Record<number, boolean> };

/** Proéminence DÉDUITE du RÔLE de la sortie — même doctrine que `RollShell` (rôle → style DANS la
 *  coquille) : l'entrée du registre déclare ce que le joueur FAIT en la prenant (`role`, gaté par le
 *  schéma d'`actions.json`), la console en déduit l'accent. Sont discrètes les sorties qui renoncent
 *  ou reviennent en arrière ; celles qui valident portent l'accent. Restyler un rôle se fait ICI. */
const bandeauDiscret = (def: ActionDef) => def.role === 'renonce';

/** Entrée de registre de la DISSIPATION : la case qui arme le mode et qui DÉCLARE (champ `panneau`)
 *  faire naître le panneau du Sort à dissiper. Le panneau relit SON ancre par cet id — l'ancre, elle,
 *  est posée génériquement sur toute case dont la def porte `panneau`. */
const ACTION_DISSIPER = 'dispel';

/** Entrée de registre du RECHARGEMENT : la case qui déclare (champ `panneau`) faire naître le panneau
 *  des armes à recharger, et qui déclare la liste d'armes à distance (`candidates`) lue par l'en-tête.
 *  Les sites `cellFor` gardent l'id LITÉRAL : c'est lui que lit la garde d'atteignabilité du registre
 *  (`action-atteignabilite.test.ts:66`). */
const ACTION_RECHARGER = 'reload';

/** Le bandeau de phase, à ses DEUX adresses (arbitrage utilisateur 2026-08-24) : sur le parapet du
 *  pont (pauses de round, interlude de ciblage) ou, à l'OUVERTURE d'un combat, CENTRÉ EN HAUT DE LA
 *  CARTE comme la référence Rogue Trader le pose. Une seule boîte, une seule matière — l'adresse est
 *  un ATTRIBUT (`data-phase`), jamais un second composant ni une classe de plus. La MATIÈRE est la peau partagée
 *  `.skin-bois` (components.css), celle de la plaque du rail d'outils. */
export function PhaseBanner({ label, actions, ready, adresse = 'pont' }: PhaseBanner & {
  /** OÙ le bandeau se pose — une ADRESSE, jamais une classe de plus (cliquet xii) : sur le parapet
   *  du pont (`pont`), en haut de la carte à l'ouverture du combat (`ouverture`), ou centré au-dessus
   *  de l'arche quand le pont n'a plus de bande à sa gauche (`spectatrice`). */
  adresse?: 'pont' | 'ouverture' | 'spectatrice';
}) {
  return (
    <div className="cc-phase skin-bois" data-phase={adresse}>
      <span className="cc-phase-label">{label}</span>
      {ready && <ReadyRow ready={ready} />}
      {actions.map((a) => (
        <button key={a.key} type="button" data-action={a.key} className={`btn ${a.primary ? 'btn-primary' : 'btn-ghost'}`} disabled={a.disabled} onClick={a.run}>
          {a.icon} {a.label}
        </button>
      ))}
    </div>
  );
}

/** Un SET porte-t-il une arme à distance qui n'est pas prête à tirer ? L'état de charge vit sur
 *  l'ARME (registre `engine/weaponLoad`), pas sur le porteur : chaque objet du set est projeté par la
 *  dérivation UNIQUE `weaponFromItem` (l'`uid` survit, donc `loadRegister` retombe sur l'objet
 *  possédé) — c'est ainsi qu'un set NON ACTIF, dont les armes ne sont pas dans `c.weapons`, dit son
 *  état. PUR. */
function loadoutUnloaded(c: Combatant, lo: WeaponLoadout): boolean {
  const items = c.items ?? [];
  for (const uid of [lo.main, lo.off]) {
    const it = uid ? items.find((i) => i.uid === uid) : undefined;
    if (!it || it.kind !== 'ranged') continue;
    const w = weaponFromItem(it);
    if ((w.reload ?? 0) > 0 && !weaponLoaded(c, w)) return true;
  }
  return false;
}

/** GOUTTIÈRE de l'arche : une ressource du tour en crans verticaux (longueur constante, N segments
 *  égaux) + son SOCLE au pied — VALEUR COURANTE seule, `short` gravé dessous (planche 2026-08-17 :
 *  « 3 / MOUV. », « 1 / ACTION »). Le MAXIMUM se lit aux crans du rail, jamais deux fois.
 *  `spend` = crans qui vont partir au commit du geste en cours.
 *  Propre à la console : l'arche ne rend QUE portrait/nom/gouttières/Blessures/États (spec §1c-bis).
 *  Une gouttière à 0 cran RESTE DESSINÉE, rail vide et socle « 0 » : la géométrie de l'arche ne
 *  dépend d'aucune ressource (héros Empêtré = Mouvement 0).
 *
 *  `geste` = l'ENTRÉE DU REGISTRE adossée à CETTE ressource (spec §1c : l'annulation du déplacement
 *  vit sur la jauge de Mouvement). Elle se dessine en plaque jumelle du socle — et SEULEMENT quand
 *  son verdict d'offre passe : une ressource qui n'a rien à défaire ne peint pas un refus permanent.
 *  Sa PLACE, elle, est RÉSERVÉE dans TOUTE gouttière (`[data-geste]`, hauteur fixe en CSS) : le
 *  socle a les mêmes voisins et le même rang qu'un geste soit offert ou non — la venue du geste ne
 *  pousse plus le compteur (sonde du juge vision : boîte du compteur remontée de 13px). */
export function ArchGutter({ kind, value, max, label, short, unit, spend = 0, geste }: { kind: 'action' | 'move'; value: number; max: number; label: string; short: string; unit?: string; spend?: number; geste?: Cell }) {
  const spendFrom = Math.max(0, value - spend);
  // Le CHIFFRE et les crans sont à l'écran (socle + rail) : le nom accessible suffit à les nommer pour
  // un lecteur d'écran — aucune infobulle native (proscrite, cf. `ConsoleCell`).
  const nom = `${label} : ${value}/${max}${unit ? ` ${unit}` : ''}`;
  const offert = geste?.run && !geste.disabled ? geste : undefined;
  return (
    <span className={`cc-gutter cc-gutter-${kind}`} aria-label={nom}>
      <span className="cc-gutter-rail">
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < spendFrom ? 'on' : i < value ? 'on spend' : 'off'} />
        ))}
      </span>
      <b className="cc-socle">
        {value}
        <i>{short}</i>
      </b>
      <span data-geste="">
        {offert ? (
          <button
            type="button"
            className="chip cc-socle"
            data-cell={offert.key}
            data-action={offert.id}
            aria-label={offert.label}
            onClick={offert.run}
          >
            {offert.icon}
            {/* Le geste DIT ce qu'il fait : un glyphe seul de 26px n'était ni nommé à l'écran ni
                atteignable au doigt (sonde du juge vision). Mot court sous l'icône, à la grammaire du
                socle ; le libellé ENTIER de l'entrée du registre reste le nom accessible. */}
            <i>ANNULER</i>
          </button>
        ) : null}
      </span>
    </span>
  );
}

/** ARCHE du pont (spec §1c-bis, planche 2026-08-17) : gouttière MOUVEMENT à GAUCHE, portrait,
 *  gouttière ACTION à DROITE (socles : valeur courante + libellé dessous), NICHE D'ÉTATS
 *  (rack de 4 alvéoles réservées) au flanc droit, BARRE DE BLESSURES chiffrée pleine
 *  largeur sous le corps, NOM gravé au pied. RIEN d'autre — l'Avantage vit au conduit.
 *  La STRUCTURE est la même pour TOUT acteur actif (héros, PNJ, ennemi) : seule
 *  l'interactivité des cases est réservée au héros (spec zone 7).
 *  Composant à PROPS, qui ne lit aucun store : ressources du Tour, états de situation et geste
 *  d'annulation lui arrivent de la console — c'est ce qui rend l'arche montrable en galerie. */
export function ConsoleArch({ active, ring, move, action, etats, retraitDEtat }: {
  active: Combatant;
  ring: string;
  /** MOUVEMENT : crans du rail, socle chiffré, crans qui partiront au commit, et l'ENTRÉE DU
   *  REGISTRE adossée à CETTE ressource (spec §1c : l'annulation du déplacement vit sur la jauge de
   *  Mouvement — elle ne paraît que quand le gate `deplacement-annulable` passe). */
  move: { value: number; max: number; spend?: number; geste?: Cell };
  action: { value: number; max: number; spend?: number };
  /** États de la SITUATION, qui entrent dans le rack avec les États portés (`actorStateChips`). */
  etats?: EffectChip[];
  retraitDEtat?: ComponentProps<typeof StateChips>['action'];
}) {
  return (
    <div className="cc-arch skin-pont">
      <div className="cc-arch-body">
        <ArchGutter kind="move" value={move.value} max={move.max} label="Mouvement" short="MOUV." unit={`case${move.max > 1 ? 's' : ''}`} spend={move.spend} geste={move.geste} />
        {/* Portrait NU (`identity`) : les Blessures se lisent à la barre pleine largeur dessous —
            la jauge superposée de la tuile en aurait fait la 2ᵉ écriture de la même donnée.
            Le camp se lit au `kind` du combattant, jamais au contrôle joueur (un allié piloté par
            un autre client reste un allié). */}
        <PortraitTile c={active} ring={ring} variant="identity" size="lg" team={active.kind === 'enemy' ? 'enemy' : 'ally'} />
        <ArchGutter kind="action" value={action.value} max={action.max} label="Action" short="ACTION" spend={action.spend} />
        {/* NICHE D'ÉTATS : même primitive que la tuile du bandeau (`StateChips reserve`), icône +
            INDICE chiffré par État, alvéoles vides toujours dessinées. */}
        <StateChips c={active} max={ARCH_STATE_CELLS} reserve extra={etats} action={retraitDEtat} />
      </div>
      {/* BLESSURES : barre pleine largeur de l'arche, valeur NOMMÉE sur la piste. Le MOT est un
          enfant à part : à 360 la ligne d'arche ne peut pas le porter (texte mesuré 236px pour
          292px d'arche), la composition compacte le retire — le CHIFFRE (`9 / 9`) et la teinte de la
          piste restent à l'écran, et le `role="meter"` de la primitive porte la valeur à l'a11y. */}
      {/* Blessures d'un ADVERSAIRE : la teinte d'équipe du jeu (`ENEMY_TINT`), jamais l'échelle de
          santé des héros — la barre dit le CAMP avant de dire l'état (même loi que l'anneau de la
          tuile). L'arche étant la même dans les deux formes, la règle vit ICI, une seule fois. */}
      <LifeBar
        value={active.wounds.current}
        max={active.wounds.max}
        color={active.kind === 'enemy' ? ENEMY_TINT : hpColor(active.wounds.max > 0 ? Math.max(0, Math.min(1, active.wounds.current / active.wounds.max)) : 0)}
        overlay
        format={(v, m) => (
          <>
            {v} / {m}
            <i> BLESSURES</i>
          </>
        )}
      />
      {/* Le NOM du porteur, gravé au pied de l'arche (spécimen D) : la console dit en entier
          qui agit — la frise ne le dit qu'à la position et à la taille. */}
      <span className="cc-arch-name">{active.label}</span>
    </div>
  );
}

/** États du porteur qui ne vivent PAS sur le Combatant mais sur la SITUATION (`battle`) : ils entrent
 *  dans le même rack d'alvéoles que les États portés (spec §1c-bis, chrome d'état de l'arche §1c) —
 *  Assailli ×N (ennemis vivants au contact, `combatDistance` z-aware), Cloué (`battle.fearGate`),
 *  Renfort de pièce (servant qui n'est pas le chef, `crewIds[0]`). Pur.
 *  Vaut pour TOUT acteur actif : les trois données sont celles du Tour en cours (`battle.fearGate`,
 *  `movementUsed`… sont per-Tour) et se lisent pour un ennemi comme pour un héros (spec zone 7 :
 *  hors du tour du joueur la console reste en LECTURE, mêmes cases). */
function actorStateChips(active: Combatant, battle: BattleState): EffectChip[] {
  const out: EffectChip[] = [];
  const assailliN = active.pos
    ? battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos && combatDistance(active, c) <= 1).length
    : 0;
  if (assailliN >= 2) out.push({ key: 'a-assailli', icon: 'action/attack', label: `Assailli par ${assailliN} ennemis au contact`, kind: 'state', severity: 58, indice: assailliN });
  if (battle.fearGate === 'failed') out.push({ key: 'a-cloue', flagId: 'calmeApproche', icon: 'flag/fear', label: 'Cloué', kind: 'state', severity: 64 });
  if (active.mannedPoste && active.mannedPoste.crewIds?.[0] !== active.id) {
    out.push({ key: 'a-renfort', icon: 'action/serve-engine', label: 'Renfort de pièce (le chef fait feu)', kind: 'state', severity: 40 });
  }
  return out;
}

/**
 * CONSOLE DE COMBAT — UN SEUL OBJET (spec §1c-ter) : `.combat-console` est LE PONT, une bande de
 * bord à bord qui PORTE ses quatre régions (travée gauche, arche, travée droite, coin de sortie).
 * Aucune n'est une boîte soeur flottante : entre deux régions, on voit le pont, jamais le terrain.
 * L'arche en est le FRONTON — elle s'élève au-dessus du liseré, de la même matière et sans couture.
 *
 * Contenu : arche = portrait + gouttières + Blessures + niche d'États ; grille de capacités à compte
 * FIXE, conduit d'Avantage branché sur la grille, coin de fin de tour ISOLÉ. Aucune liste
 * déroulante : une capacité vit dans sa case, l'exhaustif vit à l'écran de capacités.
 *
 * Travée GAUCHE = ce que le matériel tenu offre (gestes de l'arme du set, munition, objets) ;
 * travée DROITE = la grille de capacités du personnage ; hors du tour du joueur la console reste
 * en LECTURE (mêmes cases, inertes) sous un bandeau de phase SUPERPOSÉ (le pont ne bouge pas).
 */
/** COMBATTANT du pont à l'OUVERTURE d'un combat (pause de Round : personne n'agit encore). Le pont est
 *  celui du JOUEUR : il montre d'abord un combattant VIVANT qu'il pilote (`controlsCombatant` +
 *  `isOutOfAction` — un héros KO ou mort à l'ouverture ne porte pas le pont, il n'agira pas), à défaut
 *  un héros vivant du groupe (partie entièrement conduite par l'IA), et seulement en dernier recours la
 *  tête de l'initiative — qui, sur une embuscade, est un ENNEMI. */
function pontDOuverture(battle: BattleState): Combatant | undefined {
  const s = useGame.getState();
  const ordonnes = battle.order.map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
  const debout = ordonnes.filter((c) => !isOutOfAction(c));
  return debout.find((c) => controlsCombatant(s, c))
    ?? debout.find((c) => c.kind === 'hero')
    ?? ordonnes.find((c) => controlsCombatant(s, c))
    ?? inBattleId(battle, battle.order[0]);
}

export function CombatConsole() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  // Heure de jeu : le QUART courant borne la chanson de marin (une par quart, MDG 09 l.40).
  const gameTime = useGame((s) => s.gameTime);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  // Intention LOCALE armée (spec zone 4) : elle allume SA case. Jamais un intent réseau — c'est un
  // mode d'écran, le geste qu'il commet part, lui, par les chemins de clic habituels.
  const localIntent = useGame((s) => s.localIntent);
  // PORTEUR élu du mode Dissiper (clic-token, `DISPEL_MODE`) : c'est LUI qui fait naître le
  // panneau-paramètre de l'alvéole Dissiper — le SORT reste à choisir (spec §1d).
  const dispelCarrierId = useGame((s) => s.dispelCarrierId);
  const dispelSelectCarrier = useGame((s) => s.dispelSelectCarrier);
  // ANCRES des panneaux-paramètres : un panneau naît de SON déclencheur, donc du rect de l'alvéole
  // qui l'ouvre. QUELLE alvéole en ouvre un est une donnée du REGISTRE (`panneau` de l'entrée) — la
  // console ne teste aucun id : elle pose une ancre sur toute case dont la def le déclare, et le
  // panneau la relit par l'id de son action. Une 2ᵉ action qui déclarerait `panneau` marcherait sans
  // une ligne de plus ici.
  const ancresPanneau = useRef(new Map<string, HTMLButtonElement>());
  // … et l'ancre des GESTES SECONDAIRES est celle de l'ALVÉOLE, pas de l'action : une entrée rendue N
  // fois (un sort par case) a N ancres. La clé est donc celle de la case.
  const ancres2e = useRef(new Map<string, HTMLButtonElement>());
  const ancreDePanneau = (c?: Cell): Ref<HTMLButtonElement> | undefined => {
    if (!c) return undefined;
    const parAction = !!findActionById(c.id)?.panneau;
    const parAlveole = (c.secondaires?.length ?? 0) > 0;
    if (!parAction && !parAlveole) return undefined;
    const id = c.id;
    const cle = c.key;
    return (el: HTMLButtonElement | null) => {
      if (el) {
        if (parAction) ancresPanneau.current.set(id, el);
        if (parAlveole) ancres2e.current.set(cle, el);
      } else {
        if (parAction) ancresPanneau.current.delete(id);
        if (parAlveole) ancres2e.current.delete(cle);
      }
    };
  };
  // INTERLUDE de ciblage en cours : l'ID de son action de sortie, lu au registre depuis le mode de
  // ciblage courant. La console ne nomme aucun état de flux — elle ne connaît que des ids d'action ;
  // et le sélecteur rend une CHAÎNE, donc il ne re-rend que quand l'interlude change.
  const interludeId = useGame((s) => currentInterludeAction(() => s)?.id);
  // AUCUN dispatcher n'est capté ici : toute exécution passe par `runAction` (registre des actions).
  // SIÈGE nommé par l'arbitre de modales (`spectatorSeatOfModal`) : lu par un SÉLECTEUR ABONNÉ — une
  // modale distante qui s'ouvre APRÈS le montage doit faire taire la bande d'attente, sinon deux puces
  // coexistent à l'écran. Le sélecteur rend un nombre ou `null` : référentiellement stable.
  const siegeModale = useGame(spectatorSeatOfModal);
  // PANNEAUX-PARAMÈTRES de la travée gauche : la MUNITION (déclencheur = le chip d'en-tête de CETTE
  // arme — deux pistolets, deux chips, deux ancres) et l'ARME À RECHARGER (déclencheur = l'alvéole
  // `reload`, ancre posée génériquement par `ancreDePanneau`). L'ouverture est un état d'ÉCRAN (rien
  // n'est engagé tant qu'aucun candidat n'est cliqué) — elle se referme au tour suivant comme le
  // garde-fou de fin de tour. L'état porte l'`uid` de l'arme dont le panneau est ouvert.
  const ammoChipRefs = useRef(new Map<string, HTMLButtonElement>());
  const [ammoOuvert, setAmmoOuvert] = useState<string | null>(null);
  const [rechargeOuverte, setRechargeOuverte] = useState(false);
  // … et le panneau des GESTES SECONDAIRES d'une alvéole, porté par la CLÉ de cette alvéole.
  const [geste2eOuvert, setGeste2eOuvert] = useState<string | null>(null);
  useEffect(() => { setAmmoOuvert(null); setRechargeOuverte(false); setGeste2eOuvert(null); }, [battle?.turn, battle?.round]);
  // …et il appartient à l'ARME qui l'a ouvert : commuter de set change l'arme au poing (`uid` refait
  // par `recomputeLoadout`), donc le chip déclencheur disparaît. Sans cette remise à zéro le panneau
  // survivait à son ancre (panneau fantôme) et gardait le popover de règle en sourdine
  // (`suppressPopover`, plus bas), sans plus aucun moyen de le refermer.
  const armeDuPanneau = useGame((s) => {
    const b = s.battle;
    const a = b ? activeCombatant(b) : undefined;
    return a ? `${activeLoadout(a)?.id ?? ''}|${a.weapons.filter((w) => w.type === 'ranged').map((w) => w.uid).join(',')}` : '';
  });
  useEffect(() => { setAmmoOuvert(null); setRechargeOuverte(false); setGeste2eOuvert(null); }, [armeDuPanneau]);

  if (!battle || battle.over) return null;
  // LE BANDEAU DE PHASE, source unique : la pause de Round, ou l'INTERLUDE de ciblage par la carte
  // (l'action `surface: 'interlude'` du mode courant, § registre). Un interlude sans bandeau serait un
  // ciblage SANS SORTIE — le joueur aurait seulement le clic-carte pour en sortir.
  const interlude = interludeId ? findActionById(interludeId) : undefined;
  // PAUSE DE ROUND : le geste est l'ENTRÉE `round-start` du registre — la MÊME porte que la touche
  // (`keybindings.round-start`), donc le même arbitrage solo/coop. En réseau, le bouton ne lance rien :
  // il marque CE siège prêt, et la bande montre les sièges REQUIS et leur état (`ReadyRow`).
  const roundStartDef = pendingRoundStart ? findActionById('round-start') : undefined;
  const enReseau = net.mode !== 'local';
  const dejaPret = !!pendingRoundStart?.readyBySeat?.[net.mySeat];
  const phase: PhaseBanner | null = pendingRoundStart && roundStartDef
    ? {
        label: pendingRoundStart.round <= 1 ? 'Ouverture du combat' : `Début du Round ${pendingRoundStart.round}`,
        ready: enReseau ? (pendingRoundStart.readyBySeat ?? {}) : undefined,
        actions: [{
          key: roundStartDef.id,
          label: enReseau
            ? (dejaPret ? 'En attente des autres…' : 'Prêt')
            : pendingRoundStart.round <= 1 ? 'Commencer le combat' : `Commencer le round ${pendingRoundStart.round}`,
          icon: <Icon id={roundStartDef.icon as IconIdInput} size="sm" />,
          primary: true,
          disabled: enReseau && dejaPret,
          run: () => runAction(roundStartDef.id, useGame.getState),
        }],
      }
    : interlude
      ? {
          label: (interlude.mode && targetingModeLabel(interlude.mode)) ?? interlude.label,
          actions: [{
            key: interlude.id,
            label: interlude.label,
            icon: <Icon id={interlude.icon as IconIdInput} size="sm" />,
            primary: !bandeauDiscret(interlude),
            run: () => runAction(interlude.id, useGame.getState),
          }],
        }
      : null;
  // Pendant la PAUSE de Round, `battle.turn` vaut -1 : personne n'agit encore. La console ne
  // DISPARAÎT pas pour autant (loi 1 : la géométrie ne bouge jamais) — elle passe en LECTURE, sous le
  // bandeau de phase (spec zone 7), sur un combattant que le JOUEUR CONTRÔLE. Elle montrait la tête de
  // l'INITIATIVE : sur une embuscade, un ENNEMI (Knud) portait portrait, stats et arsenal dans le
  // cadre du joueur. Le pont est celui du joueur — le premier contrôlé, sinon le premier héros du
  // groupe (partie entièrement en Auto-combat), sinon seulement la tête d'ordre.
  /** OUVERTURE d'un combat (arbitrage utilisateur 2026-08-24, référence RT « round 0 », capture
   *  archivée) : le bandeau de phase et son bouton quittent le coin du pont pour le HAUT DE LA
   *  CARTE, centrés. Les pauses de round SUIVANTES gardent leur bandeau sur le parapet du pont —
   *  l'arbitrage ne porte que sur l'ouverture. */
  const ouverture = !!pendingRoundStart && pendingRoundStart.round <= 1;
  const active = activeCombatant(battle) ?? (phase ? pontDOuverture(battle) : undefined);
  if (!active) {
    return phase ? (
      <>
        {ouverture && <PhaseBanner {...phase} adresse="ouverture" />}
        <div className="combat-console" data-forme="spectatrice" onContextMenu={avalerMenuNatif}>{!ouverture && <PhaseBanner {...phase} adresse="spectatrice" />}</div>
      </>
    ) : null;
  }

  // POSSESSION de l'acteur actif — prédicat UNIQUE des affordances de tour (`controlsCombatant`, déjà
  // siège-aware : héros d'un autre siège, Auto-combat, ennemi conduit par le MJ). Il n'y a donc AUCUNE
  // clause de mode de partie ici : en coop, celui qui tient l'actif voit sa console VIVRE, les autres la
  // lisent. Et un VÉHICULE contrôlé (coque, échelle Mer) est un acteur comme un autre : ses cases sont
  // les cases navales du registre, dans la MÊME travée.
  const controlled = controlsCombatant(useGame.getState(), active);
  const vehicule = isVehicle(active);
  /** FORME SPECTATRICE (arbitrage utilisateur 2026-08-24, verbatim : « D'ailleurs même au tour de
   *  l'adversaire, pourquoi je vois son pont entier ? Même RT ne fait pas ca ») — tout tour NON tenu
   *  par ce siège (ennemi, IA, autre siège coop, auto-combat) ET toute pause de Round : la bande
   *  garde sa géométrie, mais son CONTENU devient un médaillon. Aucune case n'est grisée : il n'y a
   *  plus de case. Le prédicat de possession est l'unique `controlsCombatant` — aucun cas de kind. */
  const spectatrice = !controlled || !!pendingRoundStart;
  // LECTURE : les cases de la forme complète sont inertes sous un bandeau d'interlude (spec zone 7).
  const live = !phase;
  // ON VISE — source UNIQUE de la mise en sourdine des popovers de règle de la console (`ConsoleCell`,
  // chip de munition, vignettes de set) : intention LOCALE armée (spec zone 4) OU mode de ciblage
  // armé, quel qu'il soit (`battle.action` — Soigner, Dissiper, Bordée…). Aucun cas nommé ici.
  const ciblageArme = !!localIntent || battle.action !== null;

  // SIÈGE DISTANT qui tient le tour (coop) : la console le NOMME dans sa bande d'attente, par la
  // puce de spectateur partagée — c'est la seule surface qui dise « qui joue » depuis la mort de la
  // barre v7 (e4bf4d73). UNE puce à l'écran : quand l'arbitre de modales en pose une (il dit ce que
  // le siège FAIT, information plus précise), la bande lui laisse la parole (`spectatorSeatOfModal`).
  const siegeDistant =
    net.mode !== 'local' && active.kind === 'hero' && siegeModale === null
      ? net.ownership[active.id] ?? 0
      : null;

  const frenzied = isFrenzied(active);
  // Ressources du Tour EN COURS : `movementRemaining`/`battle.movementUsed`/`battle.acted` portent
  // l'acteur actif quel qu'il soit — l'arche affiche donc la valeur réelle du moteur pour un ennemi
  // comme pour un héros (spec zone 7 : mêmes cases, inertes).
  const moveLeft = movementRemaining(battle, active);
  const moveMax = moveLeft + battle.movementUsed;
  const actMax = 1 + (isFrenzied(active) ? 1 : 0);
  const actAvail = battle.acted ? 0 : 1;
  const heroIdx = party.findIndex((h) => h.id === active.id);
  const ring = heroIdx >= 0 ? HERO_RING[heroIdx % HERO_RING.length] : ENEMY_RING;
  const previewDelta = previewResourceDelta(battle);
  const stunned = !canTakeAction(active);
  // ÉTAT qui VERROUILLE l'Action (Brisé, `LDB 16 l.52`) : lu au drapeau `restrictsAction` de la donnée
  // (`isActionLocked`), jamais par id — tout État qui le déclare ferme les mêmes cases.
  const actionVerrouillee = isActionLocked(active);
  const busy = battle.acted || stunned || actionVerrouillee;

  // ── LA CONSOLE CONSOMME LE REGISTRE DES ACTIONS ────────────────────────────────────────────────
  // Contexte d'offre commun à toutes les cases (prédicats `ACTION_GATES`, spec HUD « Zone 12 »).
  const gateCtx: ActionCtx = { active, battle, netMode: net.mode };
  /** CE MODE-LÀ est-il armé ? Le mode qu'une case arme est une donnée de SON entrée (`armed`,
   *  `actions.json`) : la console compare `battle.action` à ce que le REGISTRE déclare, elle ne recopie
   *  aucune valeur d'état. Une entrée sans `armed` n'arme rien — elle ne s'allume donc jamais par ici. */
  /*  Une entrée rendue N FOIS (une par candidat — un sort par alvéole) n'allume que l'alvéole du
   *  candidat ÉLU : le mode seul ne distingue pas deux sorts, la SÉLECTION du combat le fait
   *  (`selectedSpellId`, écrite par le dispatcher qui arme le mode). Une case sans candidat en args
   *  s'allume sur le mode, comme avant. */
  const modeArme = (def?: ActionDef, args?: ActionRunCtx) =>
    !!def?.armed && battle.action === def.armed && (!args?.spellId || battle.selectedSpellId === args.spellId);
  /** CANDIDATS portés par une alvéole : les valeurs d'identité de ses ARGS (`spellId`, `weaponUid`,
   *  `stateId`…). Aucun nom d'argument n'est cité ici — la case dit CE qu'elle paramètre, le registre
   *  dit qui le couvre. */
  const candidatsDe = (args?: ActionRunCtx): string[] =>
    Object.values(args ?? {}).filter((v): v is string => typeof v === 'string');
  /** LES OFFRES de la surface des gestes secondaires, par PORTEUR — socle PARTAGÉ avec les pastilles
   *  du champ (`state/registreOffres`). L'identité d'un candidat n'est plus DEVINÉE ici (`id ?? uid`) :
   *  l'enveloppe de sélecteur du registre la DÉCLARE, et une alvéole a seulement à se reconnaître dans
   *  ses propres paramètres. */
  const offres2e = offresDuRegistre('geste-secondaire', { active, battle, netMode: net.mode });
  /** GESTES SECONDAIRES d'une alvéole — RENDEUR UNIQUE (aucun id d'action ici), appelé pour TOUTE
   *  case : les entrées `surface: 'geste-secondaire'` dont l'`hote` est l'entrée de la case et dont la
   *  population couvre l'un de ses candidats. Chacune EST une entrée du registre habillée par
   *  `cellFor` : même verdict d'offre, même dispatcher, même foyer de règle qu'une alvéole. Un geste
   *  de plus = une ligne de JSON. Un geste secondaire n'en porte pas lui-même (le registre le refuse
   *  déjà : `hote` d'un geste secondaire, schéma `actions.ts`).
   *  `progres` = la progression du Test étendu EN COURS sur ce candidat, portée par le libellé du
   *  geste qui l'alimente (même patron que l'alvéole Dissiper, qui porte la sienne). */
  const gestes2e = (def: ActionDef, family: CellFamily, args?: ActionRunCtx, progres?: string): Cell[] => {
    if (def.surface === 'geste-secondaire') return [];
    const candidats = candidatsDe(args);
    if (!candidats.length) return [];
    const couvertes = new Set(
      offres2e.filter((p) => candidats.includes(p.porteurId)).flatMap((p) => p.offres.map((o) => o.actionId)),
    );
    return ACTIONS.filter((a) => a.surface === 'geste-secondaire' && a.hote === def.id && couvertes.has(a.id))
      .map((a) => cellFor(a.id, family, { key: `${a.id}-${candidats.join('-')}`, args, label: progres ? `${a.label} (${progres})` : undefined }))
      .filter((c): c is Cell => !!c);
  };

  /** UNE CASE = UNE ENTRÉE de `src/data/actions.json` : libellé, icône, foyer de règle Codex, verdict
   *  d'offre (`actionGate` → raison VISIBLE) et dispatcher (`runAction`) viennent tous de l'action.
   *  La console ne décide QUE de la pertinence (le site dit quand la case existe), de sa MATIÈRE
   *  (famille) et de l'habillage porté par le contenu réel (art de l'objet, compteurs). Une action
   *  sans dispatcher (`blocked`) rend une case DESSINÉE mais inerte : le registre le dit, elle ne feint pas.
   *  `off` = restriction de SITE qui s'ajoute au verdict (jamais qui l'annule). */
  const cellFor = (
    actionId: string,
    family: CellFamily,
    over: { key?: string; label?: string; icon?: ReactNode; rule?: CodexTarget; on?: boolean; off?: boolean; adv?: number; args?: ActionRunCtx;
      /** PROGRESSION du Test étendu en cours sur le candidat de la case, portée par le libellé du
       *  geste secondaire qui l'alimente. */
      progres?: string;
      /** La case OUVRE son panneau-paramètre au lieu de dispatcher : le geste est décidé, il lui
       *  manque un paramètre que la situation borne (quelle arme recharger). L'ouverture n'engage
       *  rien — le commit reste le dispatcher du registre, appelé par le candidat élu. */
      ouvre?: () => void } = {},
  ): Cell | undefined => {
    const def = findActionById(actionId);
    if (!def) return undefined;
    // Le verdict porte sur CETTE case, donc sur SES paramètres (`args`) : une entrée rendue N fois —
    // une par Compétence d'Avantage — s'ouvre ou se ferme par candidat, sur la même mesure que le
    // dispatcher. Les gates de règle pure les ignorent.
    const verdict = actionGate(def.id, { ...gateCtx, args: over.args });
    // Une action à INTENTION (spec zone 4) : sa case s'allume quand SON mode est armé, et le re-clic
    // le dissout — même patron, MÊME CODE, que les modes armés de `battle.action` (Soigner, Dissiper,
    // Bordée) : les deux armements se lisent à la déclaration de l'entrée (`intent` / `armed`).
    const armedIntent = !!def.intent && localIntent?.actionId === def.id;
    const arme = armedIntent || modeArme(def, over.args);
    return {
      key: over.key ?? def.keys?.[0] ?? def.id,
      id: def.id,
      family,
      icon: over.icon ?? icon(def.icon as IconIdInput),
      label: over.label ?? def.label,
      rule: over.rule ?? (def.rule && def.ruleCategory ? ({ category: def.ruleCategory, id: def.rule } as CodexTarget) : undefined),
      gate: verdict.ok ? undefined : verdict.reason,
      secondaires: gestes2e(def, family, over.args, over.progres),
      on: over.on ?? (arme || undefined),
      adv: over.adv,
      disabled: !live || !verdict.ok || !!over.off,
      run: live && (def.run || def.intent)
        ? over.ouvre ?? (() => runAction(def.id, useGame.getState, { ...(over.args ?? {}), ...(arme ? { toggleOff: true } : null) }))
        : undefined,
    };
  };

  // ── Travée GAUCHE : l'arsenal du set au poing + le nécessaire ──────────────────────────────
  const loadouts = active.loadouts ?? [];
  // ARMES À DISTANCE du porteur — le SÉLECTEUR DU REGISTRE (`armes-a-distance`, déclaré par l'entrée
  // `reload`), jamais un filtre recopié : deux pistolets sont DEUX armes, chacune avec son cycle de
  // charge (`weaponLoad.ts`, registre par `uid`) et sa munition — ce que les dispatchers mesurent déjà
  // (`combatSlice.ts:1928` `battleReload`, `:2139` `battleSelectAmmo`, tous deux paramétrés par l'arme).
  const rangedWs = ACTION_CANDIDATES['armes-a-distance']({ active, battle, netMode: net.mode }) as Weapon[];
  const heldSet = activeLoadout(active);
  // G1 porte l'arme DU SET, lue par `uid` — jamais la première arme de `c.weapons`, dont l'ordre ne dit
  // rien de ce qui est TENU. Sans set (statbloc de créature) : l'arme que le moteur ferait parler à
  // distance (`attackWeapon`, source unique du choix d'arme).
  const heldMainW = heldSet?.main ? active.weapons.find((w) => w.uid === heldSet.main) : undefined;
  const setWeapon = heldMainW ?? attackWeapon(active.weapons, false);
  // En-tête de travée = le SET AU POING, libellé DÉRIVÉ de son contenu (`loadoutLabel`) ; un acteur
  // sans set (statbloc de créature) porte le nom de son arme tenue.
  const setLabel = heldSet ? loadoutLabel(heldSet, active) : (setWeapon?.label ?? 'Mains nues');
  // RECHARGE — le cycle de charge appartient à CHAQUE arme (`weaponLoad.ts`, registre par `uid`). La
  // case s'allume dès qu'UNE arme est à recharger ; la progression du Test étendu ne s'imprime sur
  // l'alvéole que s'il n'y a qu'un cycle à montrer — à deux armes, elle se lit au panneau, par arme.
  const rechargeables = rangedWs.filter((w) => (w.reload ?? 0) > 0);
  const aRecharger = rechargeables.filter((w) => !weaponLoaded(active, w));
  const needsReload = aRecharger.length > 0;
  const reloadProg = rechargeables.length === 1 ? reloadProgressOf(active, rechargeables[0]) : 0;
  // Deux armes à Recharge ou plus : l'alvéole OUVRE un panneau-paramètre borné (quelle arme ?) au lieu
  // de dispatcher — la géométrie de la travée ne bouge pas (arbitrage HUD 2026-08-16 : une case, jamais
  // un bouton-liste). Une seule arme : dispatch direct sur SON `uid`.
  const rechargeChoisissable = rechargeables.length >= 2;
  // MUNITION par ARME : celle qui est RÉELLEMENT dans l'arme (`loadedAmmo` → `loadRegister`,
  // `items.ts:1005`), jamais la première compatible du sac. Elle vit dans l'EN-TÊTE de travée, à côté
  // du nom du set (arbitrage #1348, spec § « BUDGET DE HAUTEUR » complément a) — et l'en-tête n'est pas
  // la grille : deux pistolets y portent DEUX chips, chacune déclenchant SON panneau.
  // Le CHOIX est borné aux munitions compatibles de CETTE arme (`compatibleAmmo`, source unique :
  // besace du porteur ∪ coffre de la pièce servie). Deux candidats ou plus = le chip devient le
  // DÉCLENCHEUR d'un panneau-paramètre ; un seul (ou aucun) = il reste informatif, un panneau à une
  // valeur ne choisit rien.
  const munitions = rangedWs.flatMap((w) => {
    const ammo = loadedAmmo(active, w);
    if (!ammo) return [];
    const choix = compatibleAmmo(active, w);
    const choisissable = live && !frenzied && choix.length >= 2;
    // Chambre PLEINE : c'est ce que MESURE le dispatcher pour décider s'il décharge (`combatSlice.ts:2136`,
    // mêmes prédicats) — donc ce que le panneau doit annoncer au candidat qui n'est pas celui en chambre.
    const chargee = (w.reload ?? 0) > 0 && weaponLoaded(active, w);
    const options: ParamOption[] = choisissable
      ? choix.map((a) => {
          const cell = cellFor('select-ammo', 'arme', {
            key: `munition-${w.uid}-${a.uid}`,
            label: a.label,
            args: { ammoUid: a.uid, weaponUid: w.uid },
          });
          const enChambre = ammo.uid === a.uid;
          return {
            key: `munition-${w.uid}-${a.uid}`,
            label: a.label,
            meta: `×${a.qty ?? 0}`,
            // La CONSÉQUENCE est RENDUE sur le candidat (jamais un `title`) : elle se mesure aux mêmes
            // prédicats que le dispatcher, et ne s'affiche donc que là où il déchargera vraiment.
            consequence: chargee && !enChambre ? 'décharge — rechargement à refaire' : undefined,
            selected: enChambre,
            disabled: !cell?.run || !!cell.disabled,
            onSelect: cell?.run,
          };
        })
      : [];
    // FRÉNÉSIE : le refus est VISIBLE, avec la raison du registre (`agate.frenzyOnly`) — un choix qui
    // disparaît est une perte muette.
    const raison = live && frenzied && choix.length >= 2 ? t('agate.frenzyOnly') : undefined;
    return [{ w, ammo, choix, choisissable, raison, options }];
  });
  const canPush = active.weapons.some((w) => w.type === 'melee' && canPushback(w));
  // G5 — postures de tir ARMÉES : elles ne s'allument que tant qu'elles ont un effet (le MÊME prédicat
  // que le gate de la case et que le versement dans le `PendingAttack`) — une posture périmée ne se
  // peint pas. La case, elle, reste TOUJOURS dessinée : elle se grise et dit pourquoi.
  const posture = (key: ShootingStanceKey) => !!battle.stances?.[active.id]?.[key] && !STANCE_BLOCK[key](battle, active);
  // Armes DU SET au poing, lues par `uid` : c'est le set qui dit ce qui est TENU (arbitrage #1348
  // « ARBITRAGE SET STRICT », `docs/plans/2026-08-16-spec-hud-combat.md` ; dérivation `recomputeLoadout`,
  // `engine/items.ts`). Sans set (statbloc de créature), le set est l'arsenal réel de la bête, Mains nues
  // écartées par le prédicat canonique `isUnarmed` (`items.ts:178`, marqueur `builtinId`).
  const setWeapons = heldSet
    ? [heldSet.main, heldSet.off].filter((u): u is string => !!u).map((uid) => active.weapons.find((w) => w.uid === uid)).filter((w): w is Weapon => !!w)
    : active.weapons.filter((w) => !isUnarmed(w));
  // G2 Charge — `LDB 15 l.35-37` / `LDB 13 l.90` (fiche `regles/charger`) : elle ne se DÉDUIT que
  // d'un set qui ouvre un corps à corps — arme de mêlée DU set, ou set MAINS NUES (aucune arme portée).
  // Un set de tir pur ne la déduit pas. AUCUNE PERTE DE DROIT : ce prédicat ne règle que le REMPLISSAGE
  // par défaut de la travée ; la Charge reste un geste par défaut de la grille de capacités et sera
  // posable en case libre (lot placement).
  const chargeDeduite = setWeapons.length === 0 || setWeapons.some((w) => w.type === 'melee');
  const consumables = (active.items ?? []).filter(isConsumable);
  // Consommables GROUPÉS par MODÈLE — plusieurs potions identiques = une case à compteur ×N. La clé de
  // regroupement est l'id STABLE de catalogue (`trappingId`, `items.ts:240`), jamais le libellé
  // (doctrine CLAUDE.md : « on ne manipule que des IDs », le `label` est de l'AFFICHAGE) ; un objet
  // CUSTOM n'en a pas — son `uid` le distingue alors, et deux customs homonymes restent deux cases.
  // Le libellé du groupe reste celui du 1ᵉʳ objet : c'est l'affichage.
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
  // Barre d'un navire : le porteur sert-il un poste de gouverne ? (source unique `shipOfCrew`)
  const atHelm = controlled ? shipOfCrew(battle.combatants, active.id) : undefined;
  // Tâches d'équipage PARALLÈLES de la coque (elles ne dépensent pas l'Action du navire, donc aucun gate
  // du registre ne les ferme) : le SITE dit si elles ont un objet — un chanteur apte dont le quart n'a pas
  // eu sa chanson (MDG 09 l.32-40), une pièce déchargée dont le chef reste libre ce Round.
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
  // habillée du contenu réel (art de l'arme tenue, progression de charge). Une case non pertinente
  // pour ce set n'est pas rendue ; le débord garnit la rangée LIBRE (voir `left`), aucun geste ne tombe.
  // ORDRE : l'arme d'abord, puis son cycle de charge (une arme à Recharge doit rester rechargeable
  // quel que soit le set), puis la Charge, la visée, le geste d'arme, la posture, l'état du porteur.
  const deduced: (Cell | undefined)[] = [
    // G1 — attaque de l'arme du set (entrée `attaque`). L'icône et le nom suivent l'ARME réelle
    // (`ItemIcon`, même routage d'art que la vignette de set) et le foyer de règle est la POSSESSION.
    // Une COQUE n'a ni arme tenue ni poing (`isVehicle`, `engine/vehicle.ts:22`) : la case d'attaque du
    // set ne lui est pas pertinente — ce que le navire offre, ce sont ses Tests d'équipage (plus bas).
    vehicule
      ? undefined
      : setWeapon
        ? cellFor('attaque', 'arme', { icon: <ItemIcon item={setWeapon} />, label: setWeapon.label, rule: setWeapon.trappingId ? { category: 'trappings', id: setWeapon.trappingId } : undefined, args: { attackId: 'arme' } })
        : cellFor('attaque', 'arme', { icon: icon('melee/grapple'), label: 'Mains nues', rule: { category: 'trappings', id: 'mains-nues' }, args: { attackId: 'arme' } }),
    // G4 — Recharger : le porteur de l'état est l'ARME (progression du Test étendu), et c'est ELLE
    // que le dispatcher reçoit.
    rechargeables.length > 0
      ? cellFor('reload', 'arme', {
          label: `Recharger${reloadProg ? ` ${reloadProg}/${rechargeables[0].reload}` : ''}`,
          on: needsReload,
          off: busy || !needsReload || frenzied,
          args: { weaponUid: rechargeables[0].uid },
          ouvre: rechargeChoisissable ? () => setRechargeOuverte((v) => !v) : undefined,
        })
      : undefined,
    // G2 — Charge (bouton d'intention : portée M×2 visible avant le clic). Le verdict d'offre vient
    // du registre (`charge-possible`), le verbatim du popover de sa fiche.
    chargeDeduite && !vehicule ? cellFor('charge', 'geste') : undefined,
    // G3 — Viser
    rangedWs.length > 0 ? cellFor('aim', 'arme', { label: active.aiming ? 'En joue' : 'Viser', on: !!active.aiming, off: busy || !!active.aiming || frenzied }) : undefined,
    // G6 — geste d'ARME : la jauge est l'ARSENAL tenu (`canPushback`). L'Empoignade n'en est PAS un
    // (LDB 14 l.155, l.159) : elle reste à la modale d'attaque à mains nues (`useAttackJetProps.tsx:96`).
    canPush ? cellFor('pushback', 'geste', { on: !!active.pushbackMode }) : undefined,
    // G5 — postures de tir PRÉ-ARMÉES (`battle.stances`, spec §1a G5) : les cases portent le choix, la
    // fenêtre de jet n'en garde que l'affichage. Bascule (re-clic = désarmer), gate en texte visible.
    // Les DEUX cases existent dès qu'une arme de tir est au poing — « Dans le tas » se grise hors
    // contexte (aucun groupe serré), elle ne disparaît pas. Géométrie de la travée : arbitrage #1434.
    rangedWs.length > 0 ? cellFor('posture-tir', 'arme', { on: posture('heldGround'), off: busy }) : undefined,
    rangedWs.length > 0 ? cellFor('posture-tas', 'arme', { on: posture('intoCrowd'), off: busy }) : undefined,
    // G6bis — gestes d'ÉTAT du porteur (surface `geste-d-etat` du registre, spec §1a) : ce que sa
    // SITUATION ouvre — en selle, à une pièce servie, à la barre — jamais ce que son arme offre.
    active.mountId ? cellFor('dismount', 'geste', { off: actionVerrouillee }) : undefined,
    active.mannedPoste ? cellFor('leave-poste', 'geste', { off: busy }) : undefined,
    // La barre : le BARREUR la tient (`atHelm`), et la COQUE elle-même quand c'est SON tour — même case,
    // mêmes arguments (`battleShipManeuver` accepte l'un ou l'autre, `combatSlice.ts:1362`).
    atHelm || vehicule ? cellFor('maneuver-ship', 'geste', { off: busy, args: { crewId: active.id } }) : undefined,
    // NAVIRE (échelle Mer) : au tour de la coque, ses Tests d'équipage sont les gestes de la travée —
    // les MÊMES cases du registre, pas une 2ᵉ barre. Bordée et Rude épreuve dépensent l'Action du navire
    // (gate `navire-action`) ; chant et recharge sont des tâches parallèles (gate `toujours`), donc leur
    // disponibilité RÉELLE est une restriction de SITE : sans chanteur / sans pièce déchargée, case inerte.
    vehicule ? cellFor('battery', 'attaque', { off: (active.postes ?? []).length === 0 }) : undefined,
    vehicule ? cellFor('crew-test-rude-epreuve', 'geste', { args: { shipId: active.id, crewTestId: 'rude-epreuve' } }) : undefined,
    vehicule ? cellFor('sing-shanty', 'geste', { off: !canSing, args: { shipId: active.id } }) : undefined,
    vehicule ? cellFor('ship-reload', 'geste', { off: !reloadable, args: { shipId: active.id, posteUid: reloadable?.item.uid } }) : undefined,
  ];
  // ADRESSE FIXE — chaque case d'une zone rend ce que le PORTEUR y a posé (`active.barre`), et à
  // défaut le pré-remplissage déduit (`dispositionDeduite`). Une case laissée vide RESTE à sa place :
  // rien ne remonte d'un rang, la position s'apprend. Le pool est l'offre COMPLÈTE de la zone — une
  // capacité posée au-delà du pré-remplissage s'y retrouve. Deux cases de même id (deux potions, deux
  // sorts) se consomment dans l'ordre du pool, qui est l'ordre de lecture.
  const placer = (zone: ZoneBarre, pool: Cell[], setId?: string): (Cell | undefined)[] => {
    // L'ADRESSE de la case = son action ET sa CLÉ DÉCLARÉE (`cellFor`) : une identité de MODÈLE
    // (`sort-<spellId>`, `q-objet-<trappingId>`…), jamais un uid d'instance — consommer une potion
    // ne déplace pas la case où le joueur l'a posée.
    const entreeDe = (c: Cell): EntreeBarre => ({ actionId: c.id, cle: c.key });
    const parCle = new Map(pool.map((c) => [cleEntree(entreeDe(c)), c]));
    const deduite = dispositionDeduite(zone, pool.map(entreeDe));
    return resoudreDisposition(active.barre, zone, deduite, setId).map((e) => (e ? parCle.get(cleEntree(e)) : undefined));
  };

  // La rangée BASSE est LIBRE (placement joueur — spec §1c-bis) et son remplissage PAR DÉFAUT est le
  // DÉBORD des gestes déduits (spec §1b), borné à `LEFT_CELLS` : au-delà, le geste déduit ne paraît
  // pas (mesuré : jusqu'à 10 déduits pour 6 slots). Arbitrage de géométrie de la travée : #1434.
  // Le placement de la travée gauche est PAR SET (spec zone 6) : commuter le set change la disposition.
  const left: (Cell | undefined)[] = placer('arsenal', deduced.filter((c): c is Cell => !!c), heldSet?.id);

  // ── ACCÈS RAPIDE (2×2) : le nécessaire du héros — consommables à compteur, Soin, aspersion ──────
  const rapides: (Cell | undefined)[] = [
    ...consumableGroups.map((g) => {
      const it = consumables.find((i) => i.uid === g.uids[0])!;
      return cellFor('use-item', 'geste', {
        key: `q-objet-${g.key}`,
        icon: <ItemIcon item={it} />,
        label: `${g.label}${g.uids.length > 1 ? ` ×${g.uids.length}` : ''}`,
        rule: it.trappingId ? { category: 'trappings', id: it.trappingId } : undefined,
        off: busy || frenzied,
        args: { itemUid: g.uids[0] },
      });
    }),
    healTargets.length > 0
      ? cellFor('heal', 'geste', { key: 'q-soigner', off: busy || frenzied })
      : undefined,
    waterTargets.length > 0 ? cellFor('water', 'geste', { off: busy || frenzied }) : undefined,
  ];
  const quick = placer('accesRapide', rapides.filter((c): c is Cell => !!c));

  // ── Travée DROITE : la grille de capacités (compte FIXE, remplissage par défaut mesuré) ─────
  // Compétences d'Avantage : le SÉLECTEUR DU REGISTRE (`competences-avantage`), pas une 2ᵉ lecture.
  // Il ne filtre PLUS le plafond : une méthode au plafond garde sa case, DESSINÉE FERMÉE avec sa
  // raison visible (gate `avantage-sous-plafond`, `actionRegistry.ts`) — le refus se voit, il ne
  // fait pas disparaître l'affordance (spec HUD § ARBITRAGE 2026-08-19).
  const advSkills = ACTION_CANDIDATES['competences-avantage']({ active, battle, netMode: net.mode }) as { skillId: string; cap: number }[];
  const canDispel = actorHasSkill(active, 'langue', 'magick');
  const dispellable = canDispel ? dispellableSpellsOn(battle.combatants) : [];
  // Test étendu EN COURS : le DR déjà cumulé et le NI à atteindre. Le NI se relit au Sort ENCORE
  // ACTIF (`dispellable`) — jamais une copie stockée : un Sort qui s'est éteint entre-temps n'a plus
  // de progression à montrer.
  const dispelCible = active.dispel && dispellable.find((d) => d.spellId === active.dispel!.spellId && d.casterId === active.dispel!.spellCasterId);
  const dispelProg = dispelCible ? { total: active.dispel!.total, ni: dispelCible.ni } : null;
  // L'attaque d'ARME n'a rien à faire dans la grille de capacités : elle EST le geste du conduit (travée
  // gauche). Le tri se lit au DISCRIMINANT `kind` de `AttackOption` (union `AttackKind`), jamais à l'id.
  const attacks = availableAttacks(active, battle).filter((a) => a.kind !== 'arme');
  const spells = (active.spells ?? []).map((id) => findSpellById(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const selfManeuvers = selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m));
  // Les REMÈDES dont l'État est porté — lecture du registre (`remedesPertinents`).
  const remedes = remedesPertinents(gateCtx);

  const candidates: Cell[] = [
    cellFor('course', 'mouvement'),
    cellFor('mouvement', 'mouvement'),
    isEngaged(active) ? cellFor('disengage', 'mouvement') : undefined,
    cellFor('defend', 'defense', { off: busy }),
    // Une Compétence porte l'icône de SA caractéristique (source unique `charIcon`) : six alvéoles
    // d'Avantage ne partagent plus le même glyphe. UNE entrée de registre (`gain-advantage`), N cases.
    ...advSkills.map((s) =>
      cellFor('gain-advantage', 'avantage', {
        key: `advantage-${s.skillId}`,
        icon: icon(charIcon(byId('skill', s.skillId)?.characteristic)),
        label: byId('skill', s.skillId)?.label ?? s.skillId,
        rule: { category: 'skills', id: s.skillId },
        off: busy,
        args: { skillId: s.skillId },
      }),
    ),
    hasBattement(active) ? cellFor('battement', 'avantage', { off: busy }) : undefined,
    hasDistraire(active) ? cellFor('distraire', 'avantage', { off: busy }) : undefined,
    // REMÈDES D'ÉTAT — une case par entrée de remède dont l'État est porté ; la famille se lit au COÛT
    // déclaré, l'ordre est celui de la donnée. Un remède hors d'atteinte garde sa case, fermée, avec sa
    // raison (verrou de l'État — `LDB 18 l.15`).
    ...remedes.map((def) => cellFor(def.id, def.coutAction === 'mouvement' ? 'mouvement' : 'geste')),
    isFrenzyCapable(active) && !isFrenzied(active) ? cellFor('frenzy', 'geste') : undefined,
    canAidTeam(active, battle.combatants) ? cellFor('aid-team', 'geste', { off: busy }) : undefined,
    // DÉTERMINATION — deux des trois dépenses (LDB 17 l.59-60) sont des alvéoles, comme toute action :
    // leurs dispatchers sont DIRECTS (`battleResolvePsychImmune`/`battleResolveIgnoreCrit` dépensent le
    // point au clic), il n'y a donc plus rien à ARMER. La 3ᵉ (« Retirez un État », l.61) vit sur la
    // PASTILLE de l'État qu'elle retire (plus bas, `retraitDEtat`). Le chiffre entre parenthèses est la
    // RÉSERVE restante — l'ancienne case d'armement la portait seule.
    cellFor('resolve-psych-immune', 'defense', { label: `${findActionById('resolve-psych-immune')!.label} (${active.resolve ?? 0})` }),
    cellFor('resolve-ignore-crit', 'defense', { label: `${findActionById('resolve-ignore-crit')!.label} (${active.resolve ?? 0})` }),
    // DISSIPER (LDB 46 l.158-162) : la case ARME le mode, le clic-token élit le PORTEUR, et le SORT
    // se choisit au panneau-paramètre ci-dessous. La PROGRESSION du Test étendu (le cumul de DR vers
    // le NI, `active.dispel.total`) se lit sur l'alvéole : c'est le seul endroit où le joueur voit
    // qu'un Sort est déjà entamé — et par combien.
    dispellable.length > 0
      ? cellFor('dispel', 'magie', {
          label: `${findActionById(ACTION_DISSIPER)!.label}${dispelProg ? ` ${dispelProg.total}/${dispelProg.ni}` : ''}`,
          off: busy || frenzied,
        })
      : undefined,
    ...selfManeuvers.map((m) =>
      cellFor('self-maneuver', 'geste', { key: `self-${m.id}`, label: m.label, rule: { category: 'maneuvers', id: m.id }, off: busy, args: { maneuverId: m.id } }),
    ),
    // Attaques de trait : adossées au conduit (elles se paient en crans d'Avantage). Une attaque de
    // ZONE immédiate (Hurlement) part par `maneuver-area` ; les autres ARMENT le clic (`select-attack`).
    ...attacks.map((a) => {
      const habillage = { key: `attaque-${a.id}`, icon: icon(a.icon), label: a.label, rule: { category: 'traits', id: a.id } as CodexTarget, adv: a.cost?.advantage ?? 0, off: busy };
      return a.targeting === 'zone'
        ? cellFor('maneuver-area', 'attaque', { ...habillage, args: { attackKind: a.kind } })
        : cellFor('select-attack', 'attaque', { ...habillage, args: { attackId: a.id } });
    }),
    // L'alvéole d'un SORT arme l'incantation de CE sort (entrée `cast-spell`, `armed: 'cast'`) et
    // porte ses GESTES SECONDAIRES (Focaliser : clic droit / appui long / touche Menu / RB). La
    // progression de la Focalisation en cours se lit sur le geste, comme le cumul de Dissipation sur
    // la sienne : `active.focus` ne vaut que pour le sort qu'il NOMME.
    ...spells.map((sp) => {
      const dr = active.focus?.spell === sp.id ? active.focus.dr : null;
      const progres = dr != null && sp.cn ? `DR ${dr}/${sp.cn}` : undefined;
      return cellFor('cast-spell', 'magie', {
        key: `sort-${sp.id}`, icon: icon('magic/power'), label: sp.label, rule: { category: 'spells', id: sp.id },
        off: busy || frenzied, args: { spellId: sp.id }, progres,
      });
    }),
  ].filter((c): c is Cell => !!c);
  const right = placer('capacites', candidates);
  // PONT CLAVIER de la console (`keybindings.ts`, section hotbar) : on publie chaque zone PAR ADRESSE,
  // trous compris — le rang d'une case ne dépend pas de ce que ses voisines contiennent. Les touches
  // 1-8 se lient aux 8 premiers rangs de la GRILLE (spec zone 8 : « la touche suit la CASE […] 1-8 =
  // cases de la grille visible ») ; les rangs 9-12, la travée gauche et l'accès rapide restent
  // atteignables au focus, leurs touches se règlent au volet clavier.
  // … et le pont ne publie QUE ce qu'il RÉALISE : en forme spectatrice il n'a plus une seule case à
  // l'écran, il ne publie donc plus un seul rang. Une touche qui tirerait sur une case absente est
  // une affordance invisible — le contrat du pont clavier est « les cases VISIBLES ».
  hotbar.capacites = spectatrice
    ? []
    : right.map((c) => (c ? { actionId: c.id, run: c.run, disabled: !!c.disabled } : null));
  // Le badge imprimé EST le rang de l'adresse dans la grille — jamais le rang d'une liste filtrée.
  // Il ne paraît que sur une console VIVANTE : sous un bandeau de phase, la case pleine s'éteint,
  // la case vide doit s'éteindre avec elle (une seule condition de vie pour les deux).
  const hotkeyDeRang = (i: number) => (spectatrice || !live || i >= PRINTED_KEYS ? undefined : i + 1);

  // ── GESTE SECONDAIRE d'une alvéole (spec §1d + zone 10) ────────────────────────────────────────
  // N=1 : JAMAIS de panneau. Un seul geste OFFERT = dispatch direct (demander « lequel ? » quand il
  // n'y a qu'une réponse est un menu, pas un paramètre) ; un seul geste REFUSÉ = rien ne s'ouvre, sa
  // raison se lit déjà À LA CASE (`ConsoleCell`). Le panneau-paramètre ancré à l'alvéole naît à partir
  // de DEUX gestes : annulation gratuite, rien n'est engagé.
  const declencher2e = (c: Cell) => {
    const gestes = c.secondaires ?? [];
    if (gestes.length <= 1) {
      const seul = gestes[0];
      if (seul?.run && !seul.disabled) seul.run();
      return;
    }
    setGeste2eOuvert((v) => (v === c.key ? null : c.key));
  };
  const alveole2e = geste2eOuvert
    ? [...left, ...quick, ...right].find((c) => c?.key === geste2eOuvert)
    : undefined;
  // Chaque candidat EST l'entrée de registre du geste : son verdict d'offre porte SA raison, RENDUE
  // (jamais un candidat qui disparaît, jamais un clic muet).
  const options2e: ParamOption[] = (alveole2e?.secondaires ?? []).map((g) => ({
    key: g.key,
    label: g.label,
    meta: g.gate,
    disabled: !g.run || !!g.disabled,
    onSelect: g.run,
  }));

  const advCap = advantageCapFor(active);
  const meaningfulLeft = hasMeaningfulOption(active, battle);
  // Garde-fou « tour gâché » (spec §1c-bis COIN) : finir avec l'Action NON DÉPENSÉE demande deux gestes.
  // La POLITIQUE est celle de l'entrée de registre `end-turn` (`battleEndTurn` arme puis finit) : la
  // plaque ne décide rien, elle passe par `runAction` comme la touche et LIT l'armement du combat.
  const wastingAction = wastesAction(active, battle);
  const arme = endTurnArmed(battle);
  const onEndTurn = () => runAction('end-turn', useGame.getState);
  // 3ᵉ ligne de la plaque de sortie : elle dit l'état VRAI du tour — l'armement du 2ᵉ geste, sinon
  // l'avertissement « Action non dépensée », sinon « Tour fini », sinon SA touche (Espace,
  // `keybindings.ts` `end-turn`). Un héros Sonné n'a rien à dépenser : il lit la touche, pas un reproche.
  const endNote = arme ? 'Finir quand même ?' : wastingAction ? 'Action non dépensée' : battle.acted ? 'Tour fini' : 'ESPACE';

  /** « Retirez un État » (LDB 17 l.61) — la 3ᵉ dépense de Détermination est le geste de L'ÉTAT, porté
   *  par SA pastille (arbitrage HUD 2026-08-16 : « Réactions d'État sur la PASTILLE »), jamais une
   *  case de plus dans la grille. C'est une ENTRÉE DU REGISTRE comme les autres — `cellFor` en rend le
   *  verdict, le dispatcher et le foyer de règle ; seule l'alvéole d'accueil change.
   *  Le nom accessible dit l'État par son LIBELLÉ (`chip.label`, résolu par `conditionLabel`) : l'id
   *  reste en logique (`conditionId`), il ne s'affiche jamais.
   *  Un effet SANS `condId` (buff, état-drapeau, pastille de situation) n'ouvre aucun geste : la
   *  pastille y reste purement informative. */
  const retraitDEtat = (chip: EffectChip) => {
    if (!chip.condId) return undefined;
    const geste = cellFor('resolve-remove-condition', 'geste', {
      key: `etat-${chip.condId}`,
      label: `${findActionById('resolve-remove-condition')!.label} : ${chip.label} (1 Détermination)`,
      args: { conditionId: chip.condId },
    });
    // Un refus qui vient de L'ÉTAT LUI-MÊME (source unique `raisonRefusDetermination` — LDB 20 l.188)
    // laisse un CONTRÔLE : sa raison se lit au survol/focus/tap (`CodexRef refus` porté par la
    // pastille) et dans son nom accessible, jamais en texte inline dans un rack de 15px (arbitrage
    // user 2026-08-24). Une indisponibilité qui ne parle PAS de l'État (réserve vide, hors tour) ne
    // fait rien dire à la pastille : elle redevient informative.
    const run = geste?.run;
    if (!run) return undefined;
    const refus = raisonRefusDetermination(active, chip.condId);
    if (refus) return { label: geste!.label, run, refus };
    return geste!.disabled ? undefined : { label: geste!.label, run };
  };

  // ── PANNEAU-PARAMÈTRE de la Dissipation (spec §1d + zone 10) ───────────────────────────────────
  // Le porteur est élu (clic-token), il ne manque QUE le Sort : liste BORNÉE à ce que CE porteur
  // porte, jamais le catalogue des sorts. Chaque candidat EST une entrée du registre (`dispel-spell`) :
  // même verdict d'offre, même dispatcher, même foyer de règle que n'importe quelle alvéole — le
  // panneau n'est qu'un lieu d'accueil.
  const dispelCarrier = modeArme(findActionById(ACTION_DISSIPER)) && dispelCarrierId ? inBattleId(battle, dispelCarrierId) : undefined;
  const dispelOptions: ParamOption[] = dispelCarrier
    ? dispellableOnCarrier(useGame.getState, dispelCarrier.id).map((d) => {
        const cell = cellFor('dispel-spell', 'magie', {
          key: `dispel-${d.spellId}@${d.casterId}`,
          label: d.label,
          args: { spellId: d.spellId, casterId: d.casterId },
        });
        const prog = active.dispel?.spellId === d.spellId && active.dispel.spellCasterId === d.casterId ? active.dispel.total : 0;
        return {
          key: `dispel-${d.spellId}@${d.casterId}`,
          label: d.label,
          meta: `NI ${d.ni}${prog ? ` · DR ${prog}/${d.ni}` : ''}`,
          disabled: !cell?.run || !!cell.disabled,
          onSelect: cell?.run,
        };
      })
    : [];

  // ── PANNEAU-PARAMÈTRE de l'ARME À RECHARGER (spec §1a + zone 10) ───────────────────────────────
  // Le geste est décidé (recharger), il ne manque QUE l'arme : liste BORNÉE aux armes à Recharge du
  // porteur. Chaque candidat EST l'entrée de registre `reload` avec SON `weaponUid` — même verdict
  // d'offre, même dispatcher (`battleReload`) que l'alvéole à une seule arme.
  // Une arme DÉJÀ CHARGÉE est un candidat INERTE, avec son état dit : c'est exactement ce que mesure
  // le dispatcher pour refuser (`combatSlice.ts:1936`, prédicat `reloadable`).
  const rechargeOptions: ParamOption[] = rechargeChoisissable
    ? rechargeables.map((w) => {
        const cell = cellFor('reload', 'arme', { key: `recharge-${w.uid}`, label: w.label, args: { weaponUid: w.uid } });
        const chargee = weaponLoaded(active, w);
        const prog = reloadProgressOf(active, w);
        return {
          key: `recharge-${w.uid}`,
          label: w.label,
          // Deux pistolets portent le MÊME libellé : la MAIN du set les distingue (le set dit ce qui est
          // tenu, `heldSet`), et l'état de charge dit lequel a besoin du geste.
          meta: [
            heldSet?.main === w.uid ? 'main directrice' : heldSet?.off === w.uid ? 'main gauche' : undefined,
            chargee ? 'chargée' : `à recharger${prog ? ` ${prog}/${w.reload}` : ''}`,
          ].filter(Boolean).join(' · '),
          disabled: chargee || !cell?.run || !!cell.disabled,
          onSelect: cell?.run,
        };
      })
    : [];

  return (
    <>
    {/* BANDEAU D'OUVERTURE : enfant du CHAMP (`.stage`), jamais du pont — à l'ouverture il se pose
        CENTRÉ EN HAUT de la carte (référence RT « round 0 »), au-dessus du terrain. */}
    {ouverture && phase && <PhaseBanner {...phase} adresse="ouverture" />}
    {/* LE PONT : la bande porteuse, à HAUTEUR FIXE. La racine est l'EMPREINTE du pont — la bande
        PLUS la saillie du fronton — et ne peint rien : la MATIÈRE de bande (peau `.skin-pont`) est
        portée par la bande elle-même, `.cc-dock`. Le bandeau de phase est le seul enfant HORS FLUX
        de la racine (superposé au parapet, `.cc-phase`) — une phase qui va et vient ne déplace
        aucune case. */}
    <div className="combat-console" data-forme={spectatrice ? 'spectatrice' : 'complete'} onContextMenu={avalerMenuNatif}>
      {phase && !ouverture && <PhaseBanner {...phase} adresse={spectatrice ? 'spectatrice' : 'pont'} />}
      {!phase && !controlled && (
        <div className="cc-phase skin-bois" data-phase={spectatrice ? 'spectatrice' : 'pont'}>
          {siegeDistant !== null ? (
            <SpectatorChip label={nomDuSiege(net, siegeDistant)} action={`joue ${active.label}…`} />
          ) : (
            <span className="cc-phase-label">
              <Icon id="ui/wait" size="sm" /> {active.kind === 'enemy' ? 'Tour de l’ennemi' : `Tour de ${active.label}`}
            </span>
          )}
        </div>
      )}

      {/* LES DEUX FORMES du pont (arbitrage utilisateur 2026-08-24, référence RT : « rond = on
          regarde, carré = on peut cliquer ; rien ne se grise, rien ne se désactive — la console
          cesse d'être une console » ; précisé le 2026-09-20, verbatim : « moi je voulais que cela
          n'affiche que cette partie sans les barres gauche et droite pour les ennemies et avant le
          début du combat ») :
          · COMPLÈTE — la BANDE de bord à bord et ses quatre régions (travée gauche · arche · travée
            droite · coin), quand ce siège tient le tour ;
          · SPECTATRICE — l'ARCHE SEULE : le portrait dans son arche, ses jauges, son rack d'États,
            ses Blessures et son nom. Ni travée, ni set, ni accès rapide, ni grille, ni fin de tour —
            et plus aucune BARRE de part et d'autre : la bande garde sa BOÎTE (c'est ce qui rend
            l'arche immobile d'une forme à l'autre, au pixel) mais sa MATIÈRE s'éteint, nappe,
            liseré et ombre comprises (combat-console.css).
          L'arche est le MÊME composant dans les deux formes (aucune matière parallèle) : elle perd
          seulement ce qui appartient au tour joué — le geste d'annulation et le retrait d'État. */}
      <div className="cc-dock skin-pont">
      {spectatrice ? (
        <ConsoleArch
          active={active}
          ring={ring}
          move={{ value: moveLeft, max: moveMax }}
          action={{ value: actAvail, max: actMax }}
          etats={actorStateChips(active, battle)}
        />
      ) : (
      <>
        {/* Travée GAUCHE (planche 2026-08-17) : COLONNE DE SETS · 2×3 cases (haute déduite du set,
            basse LIBRE) · rubrique ACCÈS RAPIDE 2×2. Le commutateur de sets N'EST PLUS une rangée
            sous la travée : il EST la colonne (chaque vignette commute son set, la touche X les fait
            tourner). La munition non plus : elle est dans l'EN-TÊTE, à côté du nom du set. */}
        <div className="cc-bay cc-bay-left">
          <div className="cc-bay-body">
            <div className="cc-arsenal">
              {/* En-tête de travée = le set AU POING (jamais un littéral) ET, pour CHAQUE arme à
                  distance qui consomme des munitions, celle qui est CHARGÉE avec sa réserve —
                  « PISTOLETS · Balle ×6 · Balle bénie ×2 ». Deux pistolets = DEUX chips : l'en-tête
                  n'est pas la grille, la géométrie des alvéoles ne bouge pas (arbitrage HUD 2026-08-16).
                  Chaque chip porte sa fiche (popover `CodexRef`), comme toute possession de la console,
                  et devient le DÉCLENCHEUR du choix dès que SON arme accepte plus d'une munition :
                  bouton (affordance visible, cible ≥44px au doigt) d'où NAÎT le panneau-paramètre. À un
                  seul candidat il redevient un chip informatif — même adresse, même matière : la
                  distinction actionnable/informatif se lit, elle ne se devine pas. */}
              <span className="cc-bay-head">
                {setLabel}
                {munitions.map((m) => (
                  <Fragment key={m.w.uid}>
                    {' · '}
                    <CodexRef category="trappings" id={m.ammo.trappingId ?? ''} label={m.ammo.label} refus={m.raison} wrap suppressPopover={ciblageArme || ammoOuvert === m.w.uid}>
                      {m.choisissable || m.raison ? (
                        <button
                          ref={(el) => { if (el) ammoChipRefs.current.set(m.w.uid!, el); else ammoChipRefs.current.delete(m.w.uid!); }}
                          type="button"
                          className="chip"
                          data-ammo={m.w.uid}
                          data-gated={m.raison ? '' : undefined}
                          aria-haspopup="dialog"
                          aria-expanded={ammoOuvert === m.w.uid}
                          aria-label={`Munition de ${m.w.label} : ${m.ammo.label} — choisir parmi ${m.choix.length}`}
                          aria-describedby={m.raison ? `cc-ammo-gate-${m.w.uid}` : undefined}
                          aria-disabled={m.raison ? true : undefined}
                          onClick={() => { if (m.raison) return; setAmmoOuvert((v) => (v === m.w.uid ? null : m.w.uid!)); }}
                        >
                          {m.ammo.label}{m.ammo.qty ? ` ×${m.ammo.qty}` : ''}
                        </button>
                      ) : (
                        <span data-ammo={m.w.uid}>{m.ammo.label}{m.ammo.qty ? ` ×${m.ammo.qty}` : ''}</span>
                      )}
                    </CodexRef>
                    {/* RAISON du refus : au SURVOL/FOCUS du chip (`CodexRef refus`) ; ici, sa copie
                        HORS ÉCRAN, cible de l'`aria-describedby` du bouton. */}
                    {m.raison ? <i className="hors-ecran" data-gate="" id={`cc-ammo-gate-${m.w.uid}`}>{m.raison}</i> : null}
                  </Fragment>
                ))}
              </span>
              <div className="cc-arsenal-body">
                {/* COLONNE DE SETS : SET_SLOTS vignettes, toujours dessinées (un set absent est une
                    vignette vide) — set au poing en relief, état de charge de l'arme mentionné. */}
                {/* … et cette colonne est TOUJOURS dessinée dans la forme complète : celle-ci n'existe
                    que pour le combattant que ce siège TIENT, dont la géométrie ne doit pas battre au
                    fil de son équipement (un set absent est une vignette vide). Un porteur sans set —
                    créature, ennemi — n'a plus de travée du tout : il a la forme spectatrice. */}
                <div className="cc-sets" role="group" aria-label="Sets d’armes">
                  {Array.from({ length: SET_SLOTS }, (_, i) => {
                    const lo = loadouts[i];
                    if (!lo) {
                      return (
                        <span key={i} className="chip cc-set cc-empty">
                          <i className="cc-set-n">{i + 1}</i>
                        </span>
                      );
                    }
                    const mainItem = lo.main ? active.items?.find((it) => it.uid === lo.main) : undefined;
                    const held = heldSet?.id === lo.id;
                    const unloaded = loadoutUnloaded(active, lo);
                    // La VIGNETTE porte sa fiche : le popover `CodexRef` (mode `wrap`) montre l'arme du
                    // set — profil, Atouts/Défauts, source — là où un `title` cachait le libellé du set.
                    // Le nom accessible reste sur le bouton (le libellé ne tient pas dans 39px).
                    const vignette = (
                      <button
                        key={lo.id}
                        type="button"
                        data-set={lo.id}
                        data-action="switch-loadout"
                        className={`chip cc-set${held ? ' on' : ''}`}
                        disabled={!live || (!!battle.loadoutSwapped && !held)}
                        aria-label={loadoutLabel(lo, active)}
                        onClick={() => runAction('switch-loadout', useGame.getState, { loadoutId: lo.id })}
                      >
                        <i className="cc-set-n">{i + 1}</i>
                        {mainItem ? <ItemIcon item={mainItem} /> : <Icon id="item/weapon" size="sm" />}
                        {/* L'état de charge se DIT à l'ÉCRAN (jamais la couleur seule — grief vision a11y,
                            jamais un `title` — grief du juge vision), en MOT ENTIER lisible. */}
                        {unloaded ? <i className="cc-set-load">VIDE</i> : null}
                        {/* La touche s'imprime sur la case qui l'exécute : X commute le set au poing. */}
                        {held && live && loadouts.length >= 2 ? <span className="cc-key">X</span> : null}
                      </button>
                    );
                    return mainItem?.trappingId
                      ? <CodexRef key={lo.id} category="trappings" id={mainItem.trappingId} label={loadoutLabel(lo, active)} wrap suppressPopover={ciblageArme}>{vignette}</CodexRef>
                      : vignette;
                  })}
                </div>
                <div className="cc-grid cc-grid-left" aria-label="Arsenal">
                  {Array.from({ length: LEFT_CELLS }, (_, i) => (
                    <ConsoleCell key={i} cell={left[i]} ciblageArme={ciblageArme} cellRef={ancreDePanneau(left[i])} onGeste2e={left[i] ? () => declencher2e(left[i]!) : undefined} />
                  ))}
                </div>
              </div>
            </div>
            {/* Rubrique ACCÈS RAPIDE : le nécessaire (consommables à compteur, Soin), cases libres
                dessinées comme dans la travée. */}
            <div className="cc-quick">
              <span className="cc-bay-head">ACCÈS RAPIDE</span>
              <div className="cc-grid cc-grid-quick" aria-label="Accès rapide">
                {Array.from({ length: QUICK_CELLS }, (_, i) => (
                  <ConsoleCell key={i} cell={quick[i]} ciblageArme={ciblageArme} cellRef={ancreDePanneau(quick[i])} onGeste2e={quick[i] ? () => declencher2e(quick[i]!) : undefined} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Le geste d'ANNULATION est adossé à SA ressource (spec §1c) : il ne paraît que quand le
            gate du registre (`deplacement-annulable`, MIROIR de la garde de `cancelMove`) passe. */}
        <ConsoleArch
          active={active}
          ring={ring}
          move={{ value: moveLeft, max: moveMax, spend: previewDelta.move, geste: cellFor('undo-move', 'mouvement') }}
          action={{ value: actAvail, max: actMax, spend: previewDelta.action }}
          etats={actorStateChips(active, battle)}
          retraitDEtat={retraitDEtat}
        />

        {/* Travée DROITE : conduit d'Avantage BRANCHÉ sur la grille de capacités. */}
        <div className="cc-bay cc-bay-right">
          <div className="cc-conduit" aria-label={`Avantage : ${active.advantage}/${advCap}`}>
            <span className="cc-conduit-label">AVANTAGE</span>
            <span className="cc-conduit-rail">
              {Array.from({ length: ADVANTAGE_COLLARS }, (_, i) => (
                <i key={i} className={i < active.advantage ? 'on' : i < advCap ? 'off' : 'out'} />
              ))}
            </span>
            <span className="cc-conduit-plate">
              {active.advantage}/{advCap}
            </span>
          </div>
          <div className="cc-grid cc-grid-right" aria-label="Capacités">
            {Array.from({ length: RIGHT_CELLS }, (_, i) => (
              <ConsoleCell
                key={i}
                cell={right[i]}
                hotkey={hotkeyDeRang(i)}
                advantage={active.advantage}
                ciblageArme={ciblageArme}
                cellRef={ancreDePanneau(right[i])}
                onGeste2e={right[i] ? () => declencher2e(right[i]!) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Coin de fin de tour : ISOLÉ des deux travées. */}
        <div className="cc-corner">
          <button
            type="button"
            data-cell="end-turn"
            data-action="end-turn"
            data-armed={arme ? '' : undefined}
            className={`chip cc-cell cc-end${!meaningfulLeft ? ' pulse' : ''}`}
            disabled={!live}
            aria-label={arme ? 'Finir le tour quand même' : 'Finir le tour'}
            onClick={onEndTurn}
          >
            <span className="cc-ico">
              <Icon id={arme ? 'ui/warning' : 'ui/turn-end'} />
            </span>
            <span className="cc-lbl">{arme ? 'Finir quand même' : 'Fin du tour'}</span>
            <span className="cc-key">{endNote}</span>
          </button>
        </div>
      </>
      )}
      </div>

      {/* Le panneau-paramètre du Sort à dissiper NAÎT de l'alvéole qui l'a DÉCLARÉ (`ancresPanneau`,
          champ `panneau` du registre) et se referme au premier clic ; Échap ou un clic dehors
          l'annulent sans rien engager. */}
      {dispelCarrier && (
        <PanneauParametre
          anchor={ancresPanneau.current.get(ACTION_DISSIPER) ?? null}
          intitule={`Quel Sort dissiper sur ${dispelCarrier.label} ?`}
          options={dispelOptions}
          onClose={() => dispelSelectCarrier(null)}
        />
      )}

      {/* … celui de la MUNITION naît du chip de SON arme (`ammoChipRefs`, une ancre par arme à
          distance) : même primitive, même annulation gratuite. Le clic COMMET `select-ammo` et referme. */}
      {munitions.filter((m) => ammoOuvert === m.w.uid).map((m) => (
        <PanneauParametre
          key={m.w.uid}
          anchor={ammoChipRefs.current.get(m.w.uid!) ?? null}
          intitule={`Quelle munition pour ${m.w.label} ?`}
          options={m.options}
          onClose={() => setAmmoOuvert(null)}
        />
      ))}
      {/* … et celui de l'ARME À RECHARGER naît de l'alvéole `reload` elle-même (ancre posée par
          `ancreDePanneau`, champ `panneau` du registre) : une seule case, deux pistolets. */}
      {rechargeOuverte && (
        <PanneauParametre
          anchor={ancresPanneau.current.get(ACTION_RECHARGER) ?? null}
          intitule="Quelle arme recharger ?"
          options={rechargeOptions}
          onClose={() => setRechargeOuverte(false)}
        />
      )}
      {/* … et celui des GESTES SECONDAIRES naît de l'alvéole qui les porte (`ancres2e`, une par
          case) : il n'a lieu d'être qu'à partir de DEUX gestes. */}
      {alveole2e && (
        <PanneauParametre
          anchor={ancres2e.current.get(alveole2e.key) ?? null}
          intitule={`Autres gestes : ${alveole2e.label}`}
          options={options2e}
          onClose={() => setGeste2eOuvert(null)}
        />
      )}
    </div>
    </>
  );
}
