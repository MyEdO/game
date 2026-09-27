import { useState } from 'react';
import { useGame } from '../state/store';
import { canActFirst, freeActFirst } from '../state/turnEconomy';
import { preemptShooterIds } from '../state/targeting';
import { findActionById } from '../data/index';
import { actionGate, runAction } from '../state/actionRegistry';
import { inBattleId } from '../state/combatants';
import type { IconIdInput } from './icons';
import { ciblageEntiteArme } from '../state/targetingModes';
import { MondeDeCampagne } from '../gameIso/stage/MondeDeCampagne';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { Modal } from './Modal';
import { PovControls } from './PovControls';
import { DialogueBox } from './DialogueBox';
import { MerchantPanel } from './MerchantPanel';
import { TavernGameModal } from './TavernGameModal';
import { CombatConsole } from './CombatConsole';
import { PosteSheet } from './ShipSheet';
import { isVehicle } from '../engine/vehicle';
import { isEngin } from '../engine/structures';
import { CombatBanner } from './CombatBanner';
import { ActiveModal } from './ActiveModal'; // arbitre R2 : une seule modale de combat à la fois
import { VictoryScreen } from './VictoryScreen';
import { CampaignOpeningScreen } from './CampaignOpeningScreen';
import { ChapterRecapScreen } from './ChapterRecapScreen';
import { BargainModal } from './BargainModal';
import { AppraiseModal } from './AppraiseModal';
import { LootModal } from './LootModal';
import { DocumentModal } from './DocumentModal';
import { CharacterSheet } from './CharacterSheet';
import { InspectPanel } from './InspectPanel';
import { InitiativeStrip } from './InitiativeStrip';
import { CombatStartSplash } from './CombatStartSplash';
import { PartyDock } from './PartyDock';
import { LogDrawer } from './LogDrawer';
import { Row, Stack } from './Layout';
import { CodexTitre } from './compendium/CodexRef';
import { Icon } from './Icon';
import { GameMenu } from './GameMenu';
import { ObjectiveBannerMount } from './ObjectiveBanner';
import { SaveLoadModal } from './SaveLoadModal';
import { SessionEndModal } from './SessionEndModal';
import { WorldMapView } from './WorldMapView';
import { ExplorationDock } from './ExplorationDock';
import { PortView } from './PortView';
import { ShipDossier } from './ShipDossier';
import { LandMarketView } from './LandMarketView';
import { SeaActivitiesModal } from './SeaActivitiesModal';
import { ManannPriestModal } from './ManannPriestModal';
import { ShoreLeaveModal } from './ShoreLeaveModal';
import { TravelRecapModal } from './TravelRecapModal';
import { VoyageScreen } from './VoyageScreen';
import { CityHubScreen } from './CityHubScreen';
import { CarnetScreen } from './CarnetScreen';
import { DialogueHistoryScreen } from './DialogueHistoryScreen';
import { voyageHubActive, voyageStepPending } from '../state/modalArbiter';
import { placeOfScene, atLocationPlace, placeServices } from '../state/worldMap';
import { restPlacesHere } from '../state/restFlow';
import { hoverClickCommits } from './pointerCaps';
import { controlsActive, controlsCombatant } from '../state/netOwnership';
import { combatantClickActs } from '../state/combatOrParty';
import { useGamepad } from './useGamepad';
import { campaign } from '../scenes/campaign';

export function CampaignView() {
  useGamepad(); // couche manette : dispatche les MÊMES intentions que le clavier (registre partagé)
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const merchant = useGame((s) => s.merchant);
  const sessionEndOpen = useGame((s) => s.sessionEndOpen); // Effet `sessionEnd` (#83) : ouvre la même modale
  const closeSessionEnd = useGame((s) => s.closeSessionEnd);
  const inspectEnabled = useGame((s) => s.inspectEnabled); // option de jeu : inspection des combattants
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  const roundStartPromote = useGame((s) => s.roundStartPromote);
  const gameTime = useGame((s) => s.gameTime);
  const worldMap = useGame((s) => s.worldMap);
  const worldMapOpen = useGame((s) => s.worldMapOpen);
  const openWorldMap = useGame((s) => s.openWorldMap);
  const port = useGame((s) => s.port);
  const landMarket = useGame((s) => s.landMarket);
  const pendingSeaActivities = useGame((s) => s.pendingSeaActivities);
  const pendingManannPriest = useGame((s) => s.pendingManannPriest);
  const pendingShoreLeave = useGame((s) => s.pendingShoreLeave);
  const vessel = useGame((s) => s.vessel);
  const travelPlan = useGame((s) => s.travelPlan);
  const travelRecap = useGame((s) => s.travelRecap);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  /** Sortie de la défaite (ADE II 08 : la bataille de masse continue ; sinon la scène reprend). */
  const sortirDeLaDefaite = () => {
    const g = useGame.getState();
    if (g.massBattle?.combatScene || g.scene) g.dismissDefeat();
    else startScene(campaign[0].scene);
  };
  const partyWiped = useGame((s) => s.partyWiped);
  const party = useGame((s) => s.party);
  const povActive = useGame((s) => s.povActive);
  const battleClickEntity = useGame((s) => s.battleClickEntity);
  const netMode = useGame((s) => s.net.mode);
  const openRest = useGame((s) => s.openRest);
  const partyPos = useGame((s) => s.partyPos);
  // Offre de repos LÀ OÙ SE TIENT le groupe (zone d'auteur > scène > camp ; null = interdit).
  const restHere = mode === 'exploration' && scene ? restPlacesHere({ scene, partyPos } as Parameters<typeof restPlacesHere>[0]) : null;
  // Fiche de personnage/poste : héros au STORE (`sheetId`, patron `inspectId`) — partagé avec
  // PartyScreen pour que la fiche survive au switch de héros entre les deux hôtes.
  const sheetId = useGame((s) => s.sheetId);
  const setSheetId = useGame((s) => s.setSheetId);
  const openPossessionsScreen = useGame((s) => s.openPossessionsScreen);
  const inspectId = useGame((s) => s.inspectId); // statbloc inspecté (store : frise ET token l'ouvrent)
  const setInspectId = useGame((s) => s.setInspectId);
  const setHoverCombatant = useGame((s) => s.setHoverCombatant);
  const hovered = useGame((s) => s.hovered);
  const [saveOpen, setSaveOpen] = useState(false); // modale Sauvegarder/Charger (Jalon 5)
  const [dossierOpen, setDossierOpen] = useState(false); // dossier du navire persistant (#227, EN et HORS combat)
  const [voyageMin, setVoyageMin] = useState(false); // écran-hub de voyage RÉDUIT (#333) — forcé ouvert dès qu'une étape attend
  const [cityHubOpen, setCityHubOpen] = useState(false); // hub de ville (#343) — s'ouvre depuis le bouton du lieu
  const [carnetOpen, setCarnetOpen] = useState(false); // carnet d'enquête (#670) — s'ouvre depuis le bouton dédié
  const [historyOpen, setHistoryOpen] = useState(false); // relecture des conversations (#718 dernier lot) — s'ouvre depuis le tiroir-journal
  const dialogueHistory = useGame((s) => s.dialogueHistory);
  const campaignNarratif = useGame((s) => s.campaignNarratif);
  // Cadre de campagne (#717) : le rideau d'ouverture et le récap de fin de chapitre — montés comme
  // `pendingVictory`, par-dessus la vue, chacun sur son slot de donnée.
  const pendingOuverture = useGame((s) => s.pendingOuverture);
  const pendingChapterRecap = useGame((s) => s.pendingChapterRecap);
  // Hub de ville (#343) : le groupe est À un lieu de la carte → UN écran-lieu remplace les boutons
  // flottants Port/Marché/Dormir. `hubPlace` = le lieu courant (null hors lieu : route, camp sauvage).
  const hubPlace = atLocationPlace({ mode, travelPlan, worldMap, sceneId: scene?.id });
  const hubServices = hubPlace ? placeServices(hubPlace, scene ?? undefined) : [];
  const pendingCascade = useGame((s) => s.pendingCascade);
  const pendingRest = useGame((s) => s.pendingRest);
  // Écran-hub de voyage (#333) : actif tout au long d'un voyage EN COURS (source unique `voyageHubActive`).
  // Réductible pour consulter la scène, mais FORCÉ ouvert dès qu'une étape (cascade OU nuit) attend —
  // sinon l'étape incrustée serait invisible (l'arbitre a déjà supprimé la modale flottante).
  const voyageHub = voyageHubActive({ travelPlan, travelRecap, mode, worldMapOpen, battle });
  const voyageStepUp = voyageStepPending({ pendingCascade, pendingRest, pendingShoreLeave });
  const showVoyage = voyageHub && (!voyageMin || voyageStepUp);
  const [sessionOpen, setSessionOpen] = useState(false); // écran de fin de séance (Ambitions/Détermination)
  const inspected = inspectEnabled && inspectId ? battle?.combatants.find((c) => c.id === inspectId) ?? null : null;
  // Dock : version « vivante » des héros en combat (PB/effets à jour), sinon la party.
  // Le dock (portraits du haut) liste les héros PUIS les navires alliés (couche Mer) : cliquer un navire ouvre SA
  // fiche (état + équipage), comme une fiche héros. Le navire n'apparaît qu'en combat naval (sinon le filtre est vide).
  const dockHeroes = [
    ...party.map((h) => battle?.combatants.find((x) => x.id === h.id) ?? h),
    ...(battle?.combatants.filter((c) => (isVehicle(c) || isEngin(c)) && c.kind === 'hero') ?? []),
  ];
  // LDB 17 l.25.
  const canFirstIds = battle && pendingRoundStart
    ? battle.order.filter((id) => {
        const c = battle.combatants.find((x) => x.id === id);
        return !!c && canActFirst(c, battle) && controlsCombatant(useGame.getState(), c);
      })
    : [];
  // LDB 62 l.298-300.
  const freeFirstIds = canFirstIds.filter((id) => {
    const c = battle?.combatants.find((x) => x.id === id);
    return !!c && freeActFirst(c);
  });
  // LDB 10.
  const preemptAiming = useGame((s) => s.preemptAiming);
  const armPreempt = useGame((s) => s.armPreempt);
  const canPreemptIds = preemptShooterIds(useGame.getState); // source UNIQUE (partagée avec le ciblage clavier)
  // PAUSE AU PROCHAIN ROUND (`raise-hand`) : l'interrupteur du pied de frise. Verdict d'offre et
  // dispatcher viennent du REGISTRE — la vue ne connaît qu'un id d'action, et la bascule repasse par
  // la MÊME porte que la pose (`toggleOff`), ce qui rend l'annulation gratuite et symétrique.
  // La commande n'est DESSINÉE qu'en coop (pertinence de SITE : elle s'adresse aux autres joueurs,
  // comme la rangée de ready-check) ; le gate `coop` du registre reste la politique de l'entrée —
  // aucune surface, dessinée ou non, ne franchit la porte hors coop.
  // « Ma » main est celle de MON siège ; le compte des autres dit ce que la table demande déjà.
  const mySeat = useGame((s) => s.net.mySeat);
  const mainsLevees = battle?.handRaisedBy ?? [];
  const handRaised = mainsLevees.includes(mySeat);
  const autresMains = mainsLevees.filter((s) => s !== mySeat).length;
  const handDef = findActionById('raise-hand')!;
  const handVerdict = battle
    ? actionGate(handDef.id, {
        active: (inBattleId(battle, battle.order[battle.turn]) ?? battle.combatants[0])!,
        battle,
        netMode,
      })
    : { ok: false, reason: '' };
  // #21 : pendant un ciblage d'ENTITÉ, cliquer un PORTRAIT (frise ou dock) cible ce combattant —
  // même validation/portée que cliquer son pion sur le champ. Le « quels ciblages » vient du REGISTRE
  // (`ciblageEntiteArme`, dérivé de `currentTargetingMode`), jamais d'une liste d'ids recopiée ici :
  // le sélecteur relit le mode à chaque changement du store, donc les modes tenus par un `pending*`
  // (Frappe Mortelle, 2ᵉ frappe, Surincantation, pose de zone) comptent comme ceux de `battle.action`.
  // COOP : seulement quand le combattant actif est À SOI (le tour d'un autre joueur est inerte).
  const controls = useGame(controlsActive);
  const cibleDesEntites = useGame((s) => ciblageEntiteArme(() => s));
  const isTargeting = controls && cibleDesEntites;
  // LDB 10.
  const onStripPortrait = (id: string) => {
    const c = battle?.combatants.find((x) => x.id === id);
    // Tir rapide armé : router le clic vers `battleClickEntity` (source UNIQUE carte ⇄ frise) — il déclenche
    // l'interruption sur un adversaire valide, même pendant la pause où il n'y a pas de combattant actif.
    if (preemptAiming) { battleClickEntity(id); return; }
    // MÊME comportement que cliquer le token sur la carte (IsoStage) : action de combat si la cible est
    // actionnable ET qu'on contrôle l'actif (coop : ton tour), sinon inspection (read-only, tout joueur).
    // `combatantClickActs` = condition PARTAGÉE carte ⇄ frise — elles ne peuvent plus diverger.
    if (c && controls && combatantClickActs(useGame.getState, c)) {
      battleClickEntity(id, { confirm: hoverClickCommits() }); // desktop : un clic commet (cf. pointerCaps)
      return;
    }
    if (inspectEnabled) setInspectId(id);
  };
  const onDockPortrait = (id: string) => {
    if (isTargeting) { battleClickEntity(id, { confirm: hoverClickCommits() }); return; }
    setSheetId(id);
  };

  return (
    // #225 : filet de niveau écran — couvre carte du monde, port, marché, modales… (tout ce qui est
    // hors du stage, jusque-là rendu à nu). `onRetry` = simple reprise du rendu (pas de reload : le
    // store n'est pas touché par un crash de render, la session en mémoire survit).
    <SceneErrorBoundary
      className="app-error-boundary"
      message="Une erreur d'affichage est survenue. Votre partie n'est pas perdue."
      retryLabel="Revenir à la scène"
      onRetry={() => {}}
    >
    <div className="screen campaign-view">
      <main className="stage">
        {/* UN SEUL MONDE, DEUX REGARDS (#1385) : l'hôte possède le canevas volumique et ne se démonte
            qu'avec cet écran ; la bascule plateau ⇄ première personne n'y change qu'une surcouche.
            Il porte DEUX filets imbriqués — un pour le CORPS du monde (ses dérivations), un pour la
            surcouche — pour qu'un crash de rendu du stage n'emporte jamais le HUD de cet écran. */}
        <MondeDeCampagne />
        {/* ── Overlays HUD plein-champ (façon BG3, mobile-first) ── */}
        {mode === 'battle' && battle && <CombatStartSplash />}
        {/* Ciblage par carte (Frappe Mortelle / Des deux armes / Surincantation / pose de zone /
            bordée / téléportation) : la console porte le bandeau d'interlude et SA sortie, tirés du
            registre des actions (`surface: 'interlude'`, cf. CombatConsole). */}
        {/* Barre HUD supérieure : le menu ☰, le nom du LIEU et l'OBJECTIF — rien d'autre, en AUCUN
            mode (spec HUD combat § « Zone 11 ») : la date vit au menu ☰ et sur les écrans plein-champ
            (`ScreenMeta`), les ouvreurs d'écrans à l'extrémité droite du pont d'exploration hors
            combat, sur le rail d'outils en combat. Sauvegarder : exploration seulement (refusée en
            combat) et jamais l'invité (la save vit chez l'hôte). */}
        <Row className="hud-topbar" align="start">
        <GameMenu sceneName={scene?.label} time={gameTime} onQuit={() => setScreen('party')} onSaveLoad={mode === 'exploration' && netMode !== 'guest' ? () => setSaveOpen(true) : undefined} onEndSession={mode === 'exploration' && netMode !== 'guest' ? () => setSessionOpen(true) : undefined} />
        {/* Lieu courant : premier étage de la pile — le nom de la scène se lit sur le HUD, sans ouvrir
            le menu. Sans nom authoré, aucune plaque (rien à annoncer). La MATIÈRE du nom est celle du
            chrome de nom (`CodexTitre`), posée sur le halo partagé des textes du monde nu. */}
        {mode === 'exploration' && scene?.label && (
          <strong data-hud="place" className="halo-champ" title={scene.label}><CodexTitre title={scene.label} /></strong>
        )}
        {/* Objectif courant (#238) — dernier étage de la pile de contexte : il occupe sa propre ligne
            sous le lieu (CSS `.hud-topbar > .objective-banner`). Masqué en combat (l'écran tactique
            se réserve le HUD) ; nul si la pile d'objectifs est vide. */}
        {mode === 'exploration' && <ObjectiveBannerMount />}
        </Row>
        {/* PONT D'EXPLORATION (spec § « Zone 11 ») : la bande basse allégée, montée hors combat
            seulement — en combat, le pont est la console (`CombatConsole`). Les conditions
            d'apparition des ouvreurs restent ICI (un rappel absent = pas d'entrée). */}
        {mode === 'exploration' && (
          <ExplorationDock
            onPossessions={() => openPossessionsScreen()}
            /* Carnet d'enquête (#670) : seulement si la campagne embarque une enquête (au moins un
               indice authoré au narratif) — arène/scènes de test n'en ont pas. */
            onCarnet={(campaignNarratif?.indices.length ?? 0) > 0 ? () => setCarnetOpen(true) : undefined}
            onShipDossier={vessel ? () => setDossierOpen(true) : undefined}
            /* Écran-hub de voyage RÉDUIT (#333) : caché tant qu'une étape attend (le hub est alors
               forcé ouvert). */
            onVoyage={voyageHub && voyageMin && !voyageStepUp ? () => setVoyageMin(false) : undefined}
            /* Carte du monde (#T2) : la scène est un lieu connu, ou un voyage interrompu attend. */
            worldMap={worldMap && (placeOfScene(worldMap, scene?.id) || travelPlan) ? { onOpen: openWorldMap, interrupted: !!travelPlan?.interrupted } : undefined}
            /* Hub de ville (#343) : à un lieu offrant au moins un service, ou un couchage sur place. */
            hub={hubPlace && (hubServices.length > 0 || restHere) ? { label: hubPlace.label, icon: hubPlace.icon ?? 'nav/campaign', onOpen: () => setCityHubOpen(true) } : undefined}
            /* Dormir ici HORS lieu (route, camp sauvage) — l'offre vient de la ZONE où se tient le
               groupe, sinon de la scène. À un lieu, le repos vit DANS le hub. */
            rest={!travelPlan && restHere && !hubPlace
              ? {
                  title: restHere.places.auberge ? 'Dormir — auberge ou belle étoile' : restHere.places.maison ? 'Dormir — chez soi' : 'Camper — dormir sur place jusqu’à l’aube',
                  onOpen: () => openRest({ places: restHere.places, quality: restHere.quality }),
                }
              : undefined}
            /* Le tiroir-journal REJOINT la rangée d'ouvreurs : hors combat le pont est la SEULE plaque
               du bas, le rail d'outils ne se rend pas (§1c-ter). */
            journal={<LogDrawer battle={null} journal={journal} onOpenHistory={dialogueHistory.length > 0 ? () => setHistoryOpen(true) : undefined} />}
          />
        )}
        {/* Panneaux du menu ☰ : surfaces SYSTÈME, jamais par-dessus un dialogue PNJ en cours (#376 pt.2)
            — `DialogueBox` ne porte pas de `.modal-overlay` (pas de voile plein écran), donc une
            modale système au-dessus resterait invisible/inatteignable sous elle sans cette garde. */}
        {saveOpen && !dialogue && <SaveLoadModal mode="save" onClose={() => setSaveOpen(false)} />}
        {(sessionOpen || sessionEndOpen) && !dialogue && <SessionEndModal onClose={() => { setSessionOpen(false); closeSessionEnd(); }} />}
        <PartyDock heroes={dockHeroes} targeting={isTargeting} onOpen={onDockPortrait} />
        {/* LA RANGÉE DU MONDE (#1848, `.stage-flot` — hud.css) : tout ce qui s'ancre AU BAS DU CHAMP
            vit ICI, dans la rangée du plateau qui s'arrête au bord haut du pont. Aucune de ces
            surfaces ne connaît plus de hauteur de pont : `bottom: 0` y signifie « juste au-dessus
            du pont », dans les deux modes et à toute forme de console. */}
        <div className="stage-flot">
          {/* La FRISE est une surface de cette rangée comme les autres : elle s'arrête au bord haut du
              pont parce que sa rangée s'y arrête, et la hauteur qui lui reste est celle de la rangée
              (`cqh`, initiative-strip.css) — plus aucune hauteur de pont à relire. */}
          {mode === 'battle' && battle && (
            <InitiativeStrip
              order={battle.order}
              turn={battle.turn}
              round={battle.round}
              combatants={battle.combatants}
              over={battle.over != null}
              canFirstIds={canFirstIds}
              freeFirstIds={freeFirstIds}
              targeting={isTargeting || !!preemptAiming}
              onActivate={onStripPortrait}
              onHover={setHoverCombatant}
              hoveredId={hovered}
              onPromote={roundStartPromote}
              canPreemptIds={canPreemptIds}
              preemptArmedId={preemptAiming}
              onPreempt={armPreempt}
              hand={netMode === 'local' ? undefined : {
                raised: handRaised,
                reason: handVerdict.ok ? undefined : handVerdict.reason,
                label: <><Icon id={handDef.icon as IconIdInput} size="sm" /> {handRaised ? 'Pause demandée' : 'Pause'}{autresMains > 0 ? ` +${autresMains}` : ''}</>,
                ariaLabel: `${handRaised ? `${handDef.label} : retirer ma demande` : handDef.label}${autresMains > 0 ? ` — déjà demandée par ${autresMains} autre${autresMains > 1 ? 's' : ''} joueur${autresMains > 1 ? 's' : ''}` : ''}`,
                onToggle: () => runAction(handDef.id, useGame.getState, { toggleOff: handRaised }),
              }}
            />
          )}
          {mode === 'battle' && battle && <CombatBanner />}{/* fil SOUS la frise (CSS .combat-feed) */}
          {/* RAIL D'OUTILS (épure G) EN COMBAT : UN panneau vertical encadré au bord droit — le journal
              de bataille et l'ouvreur de dossier de navire y sont vissés, plus rien d'épars sur le champ
              ni dans la barre haute. Hors combat, ces commandes vivent sur le pont d'exploration : le
              rail ne se rend plus (la planche ne le veut qu'en tactique). La caméra n'y a plus de plaque :
              elle se pilote au GESTE (glisser, molette, pincer) et au CLAVIER (registre
              `state/keybindings`, remappable à l'écran Options). Aux tranches étroites le rail se dissout
              (`display: contents`) et chaque surface reprend son ancrage mobile propre. */}
          {mode === 'battle' && (
            <Stack className="hud-rail skin-bois" gap="md" pad="md">
              {vessel && (
                <button
                  type="button"
                  className="worldmap-btn skin-tole"
                  data-ton="laiton"
                  onClick={() => setDossierOpen(true)}
                  title="Dossier du navire — état, cargaison, équipage"
                >
                  <Icon id="travel/sail-ship" size="lg" />
                </button>
              )}
              <LogDrawer battle={battle ? { log: battle.log, combatants: battle.combatants } : null} journal={journal} />
            </Stack>
          )}
          {mode === 'exploration' && povActive && <PovControls />}
          {dialogue && <DialogueBox />}
          {/* Arbitre R2 : UNE seule modale de combat à la fois, par priorité (cf. ActiveModal). Il
              vit dans cette rangée parce que sa PUCE d'attente (coop) est une surface basse du champ
              — ses modales, elles, sont des voiles fixes que la grille ne touche pas. */}
          <ActiveModal />
        </div>
        {merchant && <MerchantPanel />}
        {/* Jeux de taverne (NADJ 16) : la modale se rend seule quand `tavernGames` est ouvert
            (Effet `openTavernGames` d'un dialogue d'aubergiste). Nulle sinon — mont inconditionnel. */}
        <TavernGameModal />
        {worldMapOpen && mode === 'exploration' && <WorldMapView />}
        {port && mode === 'exploration' && <PortView />}
        {/* Dossier du navire (#227) : plein-champ, monté EN et HORS combat (persistant). */}
        {dossierOpen && vessel && <ShipDossier onClose={() => setDossierOpen(false)} />}
        {/* Écran-hub de voyage (#333) : plein-champ pendant tout voyage EN COURS ; héberge la cascade
            du jour EN SON CENTRE (l'arbitre supprime la modale flottante). */}
        {showVoyage && <VoyageScreen onClose={() => setVoyageMin(true)} />}
        {/* Hub de ville (#343) : écran-lieu plein-champ. Cédé aux écrans plein-champ qu'il ouvre
            (carte du monde, port, marché) — « Entrer » ferme le hub avant de les ouvrir. Cédé aussi à
            la modale de repos (`pendingRest` → `ActiveModal` clé `rest`) : « Dormir » depuis le panneau
            auberge armait `pendingRest` SANS fermer le hub, qui restait monté DERRIÈRE la modale flottante
            (bouton « Recueillir des informations » écrasé sous son bord, #376 pt.4). */}
        {cityHubOpen && hubPlace && mode === 'exploration' && !worldMapOpen && !port && !landMarket && !pendingRest && (
          <CityHubScreen place={hubPlace} scene={scene ?? undefined} rest={restHere} onClose={() => setCityHubOpen(false)} />
        )}
        {carnetOpen && mode === 'exploration' && <CarnetScreen onClose={() => setCarnetOpen(false)} />}
        {historyOpen && mode === 'exploration' && <DialogueHistoryScreen onClose={() => setHistoryOpen(false)} />}
        {landMarket && mode === 'exploration' && <LandMarketView />}
        {pendingSeaActivities && mode === 'exploration' && <SeaActivitiesModal />}
        {/* Au port ouvert, ces décisions sont surfacées par l'onglet Escale du hub (#228) — pas de double surface. */}
        {pendingManannPriest && mode === 'exploration' && !port && <ManannPriestModal />}
        {/* Relâche à terre : incrustée au CENTRE du hub de voyage quand il est actif (VoyageScreen) ;
            modale flottante seulement HORS hub (arbitrage user 2026-07-11). */}
        {pendingShoreLeave && mode === 'exploration' && !port && !voyageHub && <ShoreLeaveModal />}
        {/* Récapitulatif de voyage (audit M4) : à l'arrivée, ou APRÈS l'embuscade qui a interrompu
            le trajet (jamais par-dessus le combat/un dialogue). */}
        {travelRecap && mode === 'exploration' && !dialogue && !worldMapOpen && <TravelRecapModal />}
        {/* Console de combat + portrait du héros actif EN BAS (cf. CombatConsole). */}
        {mode === 'battle' && battle && <CombatConsole />}
        {/* Défaite : overlay centré (la victoire a son écran plein, VictoryScreen). Dans une Scène de
            combat de bataille de masse (ADE II 08), `dismissDefeat` fait CONTINUER la bataille (repli
            tactique, pas game-over) ; hors bataille de masse, il rend la main à la scène. */}
        {mode === 'battle' && battle?.over === 'defeat' && (
          <Modal
            title={useGame.getState().massBattle?.combatScene ? 'Repoussés…' : 'Défaite…'}
            onClose={sortirDeLaDefaite}
            footer={
              <button className="btn btn-primary" onClick={sortirDeLaDefaite}>
                {useGame.getState().massBattle?.combatScene ? 'Poursuivre la bataille' : 'Reprendre'}
              </button>
            }
          />
        )}
        {/* Anéantissement HORS COMBAT (`checkPartyWiped`) : MÊME écran de défaite que le combat, hors
            bataille (aucun `battle`) — le groupe entier est tombé (faim, exposition, damnation…). */}
        {partyWiped && (
          <Modal
            title="Le groupe a péri…"
            onClose={() => useGame.getState().dismissDefeat()}
            footer={<button className="btn btn-primary" onClick={() => useGame.getState().dismissDefeat()}>Retour au menu</button>}
          />
        )}
      </main>

      <VictoryScreen />{/* écran de fin de combat plein écran (se gate sur battle.over==='victory') */}
      {/* Cadre de campagne (#717) : l'ouverture cérémonielle passe AVANT tout HUD (rideau) ; le récap
          de fin de chapitre attend qu'elle soit acquittée. */}
      {pendingOuverture && <CampaignOpeningScreen />}
      {!pendingOuverture && pendingChapterRecap && <ChapterRecapScreen />}
      {/* Modales HORS combat (contexte exclusif) : restent montées indépendamment.
          LootModal AVANT AppraiseModal : Évaluer/Détecter une ligne s'empile AU-DESSUS de la fenêtre. */}
      <LootModal />
      <BargainModal />
      <AppraiseModal />
      <DocumentModal />
      {sheetId && (() => {
        const c = battle?.combatants.find((x) => x.id === sheetId);
        // Un navire ouvre SA seule coque ; un emplacement de siège ouvre TOUTE la batterie alliée, centrée sur le cliqué.
        if (c && isVehicle(c)) return <PosteSheet combatantIds={[c.id]} onClose={() => setSheetId(null)} />;
        if (c && isEngin(c)) {
          const engins = battle!.combatants.filter((x) => isEngin(x) && x.kind === c.kind).map((x) => x.id);
          return <PosteSheet combatantIds={engins} initialHullId={c.id} onClose={() => setSheetId(null)} />;
        }
        return <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />;
      })()}
      {inspected && <InspectPanel combatant={inspected} onClose={() => setInspectId(null)} />}
    </div>
    </SceneErrorBoundary>
  );
}
