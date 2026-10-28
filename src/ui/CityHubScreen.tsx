import { useState, useMemo } from 'react';
import { useGame } from '../state/store';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { placeServices, produitsDuProfil, lieuAUnPlan, placeServiceMerchantId, serviceIcon, poiIcon, type ResolvedPlaceService, type MapPlace } from '../noyau/worldMap';
import type { Scene } from '../noyau/monde/scene';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { sceneWeatherSchema } from '../data/schemas/defs-scenes/scene';
import { restServicePrice, type RestPlaces } from '../noyau/restFlow';
import { libelleOuAbsence } from '../data';
import { findLandCargoById } from '../engine/landCargo';
import { innGatherInfoMinutes } from '../noyau/innFlow';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Tabs, type TabItem } from './composites/Tabs';
import { Listbox } from './composites/GroupesDeChoix';
import { MapCanvas, type MapMarker } from './MapCanvas';
import { planChrome } from './PlanChrome';
import { VB_H } from './worldMapViewport';
import { Coins } from './Coins';
import { Icon, IconG } from './Icon';
import { SpeakerBanner } from './SpeakerBanner';
import { ActivityPane } from './ActivityPane';
import { GatedAction, raisonSi } from './GatedAction';
import { refusDEntrerAuPort } from '../noyau/portFlow';

/**
 * HUB DE VILLE (#343) — l'écran UNIQUE d'un LIEU de la carte : on n'empile plus des boutons flottants
 * (Port/Marché/Dormir), on ENTRE dans le lieu. Coquille plein-champ (`ScreenShell`) + `MasterDetail` :
 * GAUCHE la liste des SERVICES du lieu (`placeServices` — port, marché, auberge, services de catalogue),
 * CENTRE le service sélectionné. Assemblage PUR de primitives ; les payloads métier (port/marché/repos)
 * RÉFÉRENCENT la donnée du lieu, jamais recopiée.
 *
 * Port/Marché ont leur propre écran plein-champ (`PortView`/`LandMarketView`) : leur carte de synthèse
 * porte une action « Entrer » qui FERME le hub puis ouvre cet écran (on n'incruste pas un ScreenShell
 * dans un ScreenShell). L'auberge est le panneau RICHE : prix RÉELS du catalogue (source unique
 * `restServicePrice`), action Dormir (flux de repos existant), rumeurs déjà glanées.
 */

/** Carte de synthèse d'un profil commercial (port/marché) : Taille/Richesse + colonne Produits. */
function ProfileSynth({ taille, richesse, production }: { taille: number; richesse: number; production?: string[] }) {
  const { plaque, marchandises } = produitsDuProfil(production);
  return (
    <ul className="city-hub-synth">
      <li><span className="city-hub-synth-k">Taille</span><span className="city-hub-synth-v">{taille}</span></li>
      <li><span className="city-hub-synth-k">Richesse</span><span className="city-hub-synth-v">{richesse}</span></li>
      {(marchandises.length > 0 || plaque) && (
        <li>
          <span className="city-hub-synth-k">Produits</span>
          <span className="city-hub-synth-v">{[plaque, ...marchandises].filter(Boolean).join(', ')}</span>
        </li>
      )}
    </ul>
  );
}

/** Coquille store-connectée : lit le lieu courant, liste ses services et rend le service sélectionné.
 *  `rest` = offre de couchage À LA POSITION du groupe (`restPlacesHere`) : sert le panneau d'auberge, et
 *  fonde un service « Repos » de repli si le lieu offre un couchage sans auberge déclarée (camp/maison).
 *  `onClose` = fermer le hub (rendu par `CampaignView`). */
export function CityHubScreen({
  place, scene, rest, onClose,
}: {
  place: MapPlace;
  scene?: Scene;
  rest?: { places: RestPlaces; quality: 'normale' | 'pietre' } | null;
  onClose: () => void;
}) {
  const party = useGame((s) => s.party);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]); // somme des bourses du groupe (affichage d'en-tête)
  const gameTime = useGame((s) => s.gameTime);
  const worldMap = useGame((s) => s.worldMap);
  const tradeRumours = useGame((s) => s.tradeRumours);
  const openRest = useGame((s) => s.openRest);
  const openPort = useGame((s) => s.openPort);
  const vessel = useGame((s) => s.vessel);
  const openLandMarket = useGame((s) => s.openLandMarket);
  const openPlaceMerchant = useGame((s) => s.openPlaceMerchant);
  const gatherInnInfo = useGame((s) => s.gatherInnInfo);
  const transitionTo = useGame((s) => s.transitionTo);

  const services = placeServices(place, scene, rest?.places);
  const [selId, setSelId] = useState<string | null>(services[0]?.id ?? null);
  const sel = services.find((s) => s.id === selId) ?? services[0];

  const poi = place.poi ?? [];
  const [screenTab, setScreenTab] = useState<'services' | 'plan'>('services');
  const [poiSelId, setPoiSelId] = useState<string | null>(null);
  const poiSel = poi.find((p) => p.id === poiSelId) ?? poi[0];

  // « Entrer » un écran plein-champ existant : on FERME le hub d'abord (pas de ScreenShell imbriqué).
  const enter = (open: () => void) => { onClose(); open(); };
  const refusPort = refusDEntrerAuPort({ vessel });

  /** OUVREURS par écran DÉCLARÉ (`ResolvedPlaceService.opensScreen`) : la valeur du catalogue choisit
   *  l'ouvreur ET sa garde. Table TOTALE de l'union — un écran de plus ne compile pas sans sa ligne. */
  const SCREEN_ROUTES: Record<NonNullable<ResolvedPlaceService['opensScreen']>, { open: () => void; refus: () => string | null }> = {
    port: { open: openPort, refus: () => refusPort },
  };

  /** Panneau de détail d'un SERVICE résolu — source UNIQUE, appelée pour la sélection de l'onglet
   *  Services ET pour un POI de plan ciblant un `serviceKind` (#345 : zéro copie du renderer). */
  const renderServiceDetail = (svc: ResolvedPlaceService | undefined): React.ReactNode => {
    if (!svc) return <p className="city-hub-empty">Ce lieu n’offre encore aucun service.</p>;
    // `svc.desc` vient TOUJOURS du catalogue `lieux-services.json` (`placeServices`,
    // `noyau/worldMap.ts:317-348` : `desc: def?.desc`), où `svc.id` EST l'id de l'entrée.
    const porteurSvc = { type: 'lieux-services', id: svc.id, chemin: 'desc' };
    if (svc.category === 'auberge') {
      return (
        <ActivityPane
          id={`pane-svc-${svc.id}`}
          icon={serviceIcon(svc)}
          title={svc.label}
          lead={<SpeakerBanner label="L’aubergiste" variant="boniment">{svc.hostLine}</SpeakerBanner>}
          desc={svc.desc}
          porteur={porteurSvc}
          actions={
            <>
              {svc.rest && <button type="button" className="btn btn-primary" onClick={() => openRest({ places: svc.rest, lieu: libelleOuAbsence(place, 'lieu', place.id), quality: rest?.quality })}>Dormir</button>}
              <button type="button" className="btn btn-primary" onClick={gatherInnInfo}>
                Recueillir des informations (≈{Math.round(innGatherInfoMinutes() / 60)} h)
              </button>
            </>
          }
        >
          {/* Jamais une promesse d'action impossible (cf. `refusDEntrerAuPort`) : sans offre de
              couchage effective (`svc.rest`), les prix de chambre/repas ne s'affichent pas — ils ne
              mènent nulle part ici (recette 2026-07-12). */}
          {svc.rest
            ? (
              <ul className="city-hub-prices">
                <li><span>Chambre privée / nuit</span><b><Coins money={restServicePrice('privee')} /></b></li>
                <li><span>Chambre commune / nuit</span><b><Coins money={restServicePrice('commune')} /></b></li>
                <li><span>Repas</span><b><Coins money={restServicePrice('repas')} /></b></li>
              </ul>
            )
            : <p className="city-hub-empty">Aucun couchage proposé ici pour l’instant.</p>}
          <section className="city-hub-rumours">
            <h4>Rumeurs déjà glanées</h4>
            {tradeRumours.length === 0
              ? <p className="city-hub-empty">Aucune rumeur pour l’instant.</p>
              : <ul className="city-hub-hint">{tradeRumours.map((r, i) => {
                  const target = worldMap?.places.find((p) => p.id === r.placeId)?.label ?? r.placeId;
                  const biens = r.biens.map((id) => findLandCargoById(id)?.label ?? id).join(', ');
                  return <li key={i}>{biens} — recherchés à {target}.</li>;
                })}</ul>}
          </section>
        </ActivityPane>
      );
    }
    if (svc.category === 'port' && svc.port) {
      return (
        <ActivityPane
          id={`pane-svc-${svc.id}`}
          icon={serviceIcon(svc)}
          title={svc.label}
          actions={
            <GatedAction
              id="city-hub-port-enter"
              label="Entrer au port"
              enabled={refusPort == null}
              {...raisonSi(refusPort)}
              onClick={() => enter(openPort)}
            />
          }
        >
          <ProfileSynth taille={svc.port.taille} richesse={svc.port.richesse} production={svc.port.production} />
        </ActivityPane>
      );
    }
    if (svc.category === 'marche' && svc.market) {
      return (
        <ActivityPane
          id={`pane-svc-${svc.id}`}
          icon={serviceIcon(svc)}
          title={svc.label}
          actions={<button type="button" className="btn btn-primary" onClick={() => enter(openLandMarket)}>Entrer au marché</button>}
        >
          <ProfileSynth taille={svc.market.taille} richesse={svc.market.richesse} production={svc.market.produits} />
        </ActivityPane>
      );
    }
    // Forgeron (#369) : porte vers le système marchand EXISTANT (archétype Armurier) — zéro système neuf.
    if (svc.merchantArchetype) {
      return (
        <ActivityPane
          id={`pane-svc-${svc.id}`}
          icon={serviceIcon(svc)}
          title={svc.label}
          desc={svc.desc}
          porteur={porteurSvc}
          actions={
            <button
              type="button" className="btn btn-primary"
              onClick={() => enter(() => openPlaceMerchant(placeServiceMerchantId(place.id, svc.id), svc.merchantArchetype!, svc.backdrop))}
            >
              Entrer chez le forgeron
            </button>
          }
        />
      );
    }
    // Service qui PORTE vers un écran plein-champ existant (#369) : l'écran est celui que le catalogue
    // DÉCLARE (`opensScreen`), résolu par la table ci-dessus — le chantier naval entre par l'écran de
    // port (onglet Chantier, défaut de PortView), sous la garde de cet écran.
    const route = svc.opensScreen ? SCREEN_ROUTES[svc.opensScreen] : undefined;
    if (route) {
      return (
        <ActivityPane
          id={`pane-svc-${svc.id}`}
          icon={serviceIcon(svc)}
          title={svc.label}
          desc={svc.desc}
          porteur={porteurSvc}
          actions={
            <GatedAction
              id={`city-hub-${svc.id}-enter`}
              label={svc.enterLabel ?? `Entrer : ${svc.label}`}
              enabled={route.refus() == null}
              {...raisonSi(route.refus())}
              onClick={() => enter(route.open)}
            />
          }
        />
      );
    }
    // Service de catalogue sans écran dédié (temple/guilde) : desc si le catalogue la porte (état HONNÊTE,
    // pas de promesse ni de roadmap-speak, #375), sinon un constat FACTUEL (règle 1/7).
    return (
      <ActivityPane id={`pane-svc-${svc.id}`} icon={serviceIcon(svc)} title={svc.label} desc={svc.desc} porteur={porteurSvc}>
        {!svc.desc && <p className="city-hub-empty">Ce service n’a pas encore d’écran dédié.</p>}
      </ActivityPane>
    );
  };

  const detail = renderServiceDetail(sel);

  // Tailles de marqueur du plan : hit-circle ≥44px de cible tactile (le plan rend le viewBox 100×64 sur
  // ~320-340px à 360 → r=6 en unités écran-constantes ≈ 41-44px de diamètre, pointer coarse #360).
  // Cartouche du libellé au patron worldmap (`wm-cartouche-bg`/`fg`) mais TOUJOURS visible (pas
  // seulement au survol : un plan de ville dense reste petit, ses POI restent peu nombreux).
  const poiMarkers: MapMarker[] = poi.map((p) => {
    const w = Math.max(9, p.label.length * 1.3 + 3.4);
    return {
      id: p.id,
      x: p.pos.x,
      y: p.pos.y * (VB_H / 100),
      selected: poiSel?.id === p.id,
      onClick: () => setPoiSelId(p.id),
      cursor: 'pointer',
      label: p.label,
      children: (
        <>
          <circle r="6" fill="transparent" />
          {/* Sélection = anneau OR (charte-ui : `--gold` réservé aux bordures/focus, jamais `--accent`,
              action primaire) — langage UNIQUE partagé avec la carte du monde (`WorldMapView`, #362). */}
          {poiSel?.id === p.id && <circle r="3" fill="none" stroke="var(--gold)" strokeWidth="0.45" opacity="0.95" />}
          <circle r="2.2" fill="var(--wm-badge-bg)" stroke="var(--wm-age-spot)" strokeWidth="0.28" />
          <g style={{ color: 'var(--wm-marker-icon)' }}>
            <IconG id={poiIcon(p, services)} x={-1.4} y={-1.4} size={2.8} />
          </g>
          <g transform="translate(0 4.7)">
            <rect x={-w / 2} y="-2.1" width={w} height="3.4" rx="1.6" fill="var(--wm-cartouche-bg)" opacity="0.9" />
            <text y="0.25" textAnchor="middle" fontSize="2.3" fontWeight={poiSel?.id === p.id ? 700 : 500} fill="var(--wm-cartouche-fg)">{p.label}</text>
          </g>
        </>
      ),
    };
  });

  const poiServiceTarget = poiSel?.serviceKind ? services.find((s) => s.id === poiSel.serviceKind) : undefined;
  let poiDetail: React.ReactNode;
  if (!poiSel) {
    poiDetail = <p className="city-hub-empty">Ce lieu n’a aucun point d’intérêt.</p>;
  } else if (poiSel.sceneId) {
    poiDetail = (
      <ActivityPane
        id={`pane-poi-${poiSel.id}`}
        icon={poiIcon(poiSel, services)}
        title={poiSel.label}
        desc="Ce point mène à un autre endroit."
        actions={<button type="button" className="btn btn-primary" onClick={() => enter(() => transitionTo(poiSel.sceneId!))}>Entrer</button>}
      />
    );
  } else {
    poiDetail = renderServiceDetail(poiServiceTarget);
  }

  const screenTabs: TabItem<'services' | 'plan'>[] = [
    { key: 'services', label: 'Services' },
    ...(lieuAUnPlan(place) ? [{ key: 'plan' as const, label: 'Plan' }] : []),
  ];

  return (
    <ScreenShell
      className="city-hub"
      title={<><Icon id={place.icon ?? 'nav/entry-point'} size="sm" /> {place.label}</>}
      onClose={onClose}
      meta={{ time: gameTime, money }}
      actions={scene?.weather && <span className="city-hub-weather">· {libelleDeValeur(sceneWeatherSchema, scene.weather)}</span>}
      tabs={screenTabs.length > 1 ? <Tabs tabs={screenTabs} active={screenTab} onChange={setScreenTab} label={`Onglets de ${place.label}`} /> : undefined}
      backdrop={place.backdrop ?? sel?.backdrop}
      body="centered"
    >
      <div className="city-hub-body">
        {screenTab === 'plan' && poi.length > 0 ? (
          <MasterDetail
            className="city-hub-master city-hub-plan"
            aside="lg"
            listLabel={`Plan de ${place.label}`}
            list={
              <div className="worldmap-canvas city-hub-plan-canvas">
                <MapCanvas
                  ariaLabel={`Plan de ${place.label}`}
                  computeFit={() => ({ z: 1, panX: 0, panY: 0 })}
                  chrome={planChrome(place.label)}
                  markers={poiMarkers}
                />
              </div>
            }
            detail={
              <div className="city-hub-detail panel">
                {poiDetail}
              </div>
            }
          />
        ) : (
          <MasterDetail
            className="city-hub-master"
            listLabel="Services du lieu"
            list={
              <Listbox
                className="city-hub-services panel flush"
                label="Services du lieu"
                count={services.length}
                activeIndex={Math.max(0, services.findIndex((s) => s.id === sel?.id))}
                onActivate={(i) => setSelId(services[i].id)}
              >
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={sel?.id === s.id}
                    tabIndex={sel?.id === s.id ? 0 : -1}
                    className={`city-hub-service${sel?.id === s.id ? ' active' : ''}`}
                    onClick={() => setSelId(s.id)}
                  >
                    <Icon id={serviceIcon(s)} size="sm" />
                    <span className="city-hub-service-label">{s.label}</span>
                  </button>
                ))}
              </Listbox>
            }
            detail={
              <div className="city-hub-detail panel">
                {detail}
              </div>
            }
          />
        )}
      </div>
    </ScreenShell>
  );
}
