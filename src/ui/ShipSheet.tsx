import { useRef, useState } from 'react';
import { useGame } from '../state/store';
import { findVehicleById, findNavalTrait } from '../data';
import { moraleBand } from '../engine/crewMorale';
import { exposedCrew } from '../engine/shipCritical';
import { hullNavalTraits } from '../engine/navalTraits';
import { shipMoraleScore } from '../state/shipCrew';
import { Planche } from './Planche';
import { PortraitTile } from './PortraitTile';
import { CharFrame } from './CharFrame';
import { ShipRolesPanel } from './ShipRolesPanel';
import { StationSheet } from './StationSheet';
import { postesToStations } from '../state/stations';
import { posteAnchor } from '../state/shipPostes';
import { isVehicle } from '../engine/vehicle';
import type { Combatant, NavalTraitRef } from '../engine/types';
import type { Dir8 } from '../state/dir8';
import { Icon } from './Icon';
import { Prose } from './Prose';
import { Tabs } from './Tabs';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { rigSchema, posteSideSchema } from '../data/schemas/defs/vehicles';
import { dir8Schema } from '../data/schemas/grammaire/valeurs';
import { itemLabel } from '../engine/items';

/** État du navire (lecture seule, dérivé) — mêmes `stat-chip` que les vitaux d'une fiche héros. PUR. */
export function ShipStateBlock({ ship, cap, morale, crew }: { ship: Combatant; cap?: Dir8; morale: number; crew: Combatant[] }) {
  const band = moraleBand(morale);
  const apte = exposedCrew(crew);
  return (
    <div className="sheet-vitals">
      <div className="stat-chip pv"><span className="sc-label">Coque</span><span className="sc-value">{ship.wounds.current}/{ship.wounds.max}</span></div>
      {cap && <div className="stat-chip"><span className="sc-label">Cap</span><span className="sc-value">{libelleDeValeur(dir8Schema, cap)}</span></div>}
      <div className="stat-chip"><span className="sc-label">Moral</span><span className="sc-value">{morale}{band.crewTestDR ? ` (${band.crewTestDR > 0 ? '+' : ''}${band.crewTestDR})` : ''}</span></div>
      <div className="stat-chip"><span className="sc-label">Effectif</span><span className="sc-value">{apte.length}/{crew.length}</span></div>
    </div>
  );
}

type Poste = NonNullable<Combatant['postes']>[number];

/** Détail du poste SÉLECTIONNÉ (MDG 12) : son bord, son STOCK DE MUNITIONS (l.410-424, sélecteur qui persiste
 *  `ShipPoste.ammoUid`) et son équipage de pièce (PLUSIEURS servants possibles, ch.14 l.9) en portraits. */
export function PosteDetail({ hull, poste, combatants, readOnly }: { hull: Combatant; poste: Poste; combatants: Combatant[]; readOnly?: boolean }) {
  const setPosteAmmo = useGame((s) => s.setPosteAmmo);
  const gun = (poste.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  const stock = (poste.ammo ?? []).filter((a) => (a.qty ?? 0) > 0);
  // Ce qui est CHARGÉ = la munition capturée par le chargement (`loadedAmmoUid`), jamais la sélection du
  // sélecteur (qui, elle, dit « à charger au prochain rechargement »).
  const loadedAmmoItem = poste.loaded !== false ? stock.find((a) => a.uid === poste.loadedAmmoUid) : undefined;
  return (
    <div className="panel sunken">
      <b><Icon id="action/aim" size="sm" /> {poste.side ? libelleDeValeur(posteSideSchema, poste.side) : 'Omni'} · {itemLabel(poste.item)}</b>
      {stock.length > 0 && (readOnly ? (
        // Inspection (#240) : munition chargée VISIBLE mais non modifiable (pas de sélecteur sur la pièce d'autrui).
        <span className="ship-poste-ammo"><span aria-hidden><Icon id="fire/blast" size="sm" /></span> {loadedAmmoItem ? itemLabel(loadedAmmoItem) : 'pièce déchargée'}</span>
      ) : (
        <label className="ship-poste-ammo">
          <span aria-hidden><Icon id="fire/blast" size="sm" /></span>
          {/* La légende est LUE À L'ÉCRAN (pas seulement en infobulle) : le sélecteur dit ce qui sera chargé
              au prochain rechargement, jamais ce qui est dans la pièce (`loadedAmmoUid`, ci-dessus). */}
          <span className="muted">Munition à charger</span>
          <select
            value={poste.ammoUid ?? stock[0].uid}
            onChange={(e) => setPosteAmmo(hull.id, poste.item.uid, e.target.value)}
          >
            {stock.map((a) => <option key={a.uid} value={a.uid}>{itemLabel(a)} × {a.qty ?? 0}</option>)}
          </select>
        </label>
      ))}
      <div className="ship-crew-row">
        {gun.length ? gun.map((c) => <CharFrame key={c.id} c={c} variant="identity" size="xs" nom={c.label} />) : <span className="muted">— sans servant —</span>}
      </div>
    </div>
  );
}

/**
 * INSPECTION en LECTURE d'une coque (alliée OU ennemie, #240) — ce qu'un marin VOIT depuis une autre
 * embarcation : type/gréement, Coque, cap (allure), Effectif apparent, postes servis, et les
 * Traits/Améliorations physiquement apparents (figure de proue dont la Proue-idole de Stromfels #221,
 * bélier, blindage, sabord…). AUCUN contrôle d'édition (`PosteDetail` rendu `readOnly` : ni sélecteur de
 * munition, ni assignation de rôle). Le Moral d'équipage est VOLONTAIREMENT absent : `shipMoraleScore` ne
 * suit que le navire de campagne du joueur → l'afficher pour une coque ennemie serait un mensonge (résolve
 * interne, pas une donnée visible). Corps PUR (props) : testable en rendu statique. Réfs de Traits par id
 * (`NavalTraitRef`), verbatim rendu par `<Prose>` (règle 5). */
export function ShipInspectBody({ hull, crew, cap }: { hull: Combatant; crew: Combatant[]; cap?: Dir8 }) {
  const vd = hull.creatureId ? findVehicleById(hull.creatureId) : undefined;
  const rig = vd?.hull?.rig;
  const refs: NavalTraitRef[] = hullNavalTraits(hull);
  const traits = refs
    .map((ref) => ({ ref, def: findNavalTrait(ref.id) }))
    .filter((t): t is { ref: NavalTraitRef; def: NonNullable<typeof t.def> } => !!t.def);
  const apte = exposedCrew(crew);
  const postes = hull.postes ?? [];
  return (
    <>
      <div className="sheet-vitals">
        {hull.wounds.max > 0 && <div className="stat-chip pv"><span className="sc-label">Coque</span><span className="sc-value">{hull.wounds.current}/{hull.wounds.max}</span></div>}
        {cap && <div className="stat-chip"><span className="sc-label">Cap</span><span className="sc-value">{libelleDeValeur(dir8Schema, cap)}</span></div>}
        {rig && <div className="stat-chip"><span className="sc-label">Gréement</span><span className="sc-value">{libelleDeValeur(rigSchema, rig)}</span></div>}
        {crew.length > 0 && <div className="stat-chip"><span className="sc-label">Effectif</span><span className="sc-value">{apte.length}/{crew.length}</span></div>}
      </div>
      {postes.length > 0 && (
        <div className="ship-section">
          <div className="mini-title">Armes · postes</div>
          {postes.map((p) => <PosteDetail key={p.item.uid} hull={hull} poste={p} combatants={[hull, ...crew]} readOnly />)}
        </div>
      )}
      {traits.length > 0 && (
        <div className="ship-section">
          <div className="mini-title">Traits &amp; améliorations visibles</div>
          {traits.map(({ ref, def }) => (
            <div className="ship-trait" key={ref.id}>
              <span className="ship-trait-name"><b>{def.label}{def.ranked && ref.value ? ` ${ref.value}` : ''}</b></span>
              <div className="ship-trait-desc"><Prose md={def.desc} porteur={{ type: 'navalTraits', id: def.id, chemin: 'desc' }} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * ÉQUIPAGE que le roster de MANŒUVRE doit montrer, pour une coque et son équipage. PUR.
 *
 * Deux retraits, deux raisons :
 *  - les SERVANTS de pièce sont montrés sous « Armes · postes » (un marin tient UN poste) ;
 *  - l'APTITUDE (`exposedCrew`) : `shipDefaultRoles` (`state/shipCrew`) n'enrôle que l'équipage
 *    exposé, donc un mort ou un marin à 0 Blessure ne tient aucun rôle au Test — MÊME épinglé.
 *    L'offrir à l'épinglage promettrait un geste que la résolution ignore.
 */
export function manoeuvreCrew(hull: Combatant, crew: Combatant[]): Combatant[] {
  const posteCrewIds = new Set((hull.postes ?? []).flatMap((p) => p.crewIds ?? []));
  return exposedCrew(crew).filter((c) => !posteCrewIds.has(c.id));
}

/**
 * FICHE D'UN ENSEMBLE DE COQUES À POSTES (couche Mer / siège) — ouverte en cliquant un portrait, comme une fiche héros.
 * KIND-AGNOSTIQUE : un navire (`bodyShape:'vehicule'`, 1 coque à N postes) OU une batterie de siège
 * (`bodyShape:'engin'`, N emplacements séparés à 1 poste chacun). Le corps maître-détail est la surface PARTAGÉE
 * `StationSheet` (plan TOP-DOWN + puces, générique) ; sélectionner une pièce fixe la coque ACTIVE (aside + détail).
 * `Planche` : aside = portrait + ÉTAT de la coque active ; main =
 * MAÎTRE-DÉTAIL piloté par le plan (FTL/RTS) : plan + puces sélectionnent LE MÊME poste, dont le `PosteDetail`
 * (injecté par `renderDetail`) s'affiche seul. Les Rôles de
 * manœuvre passent dans un onglet, UNIQUEMENT pour un navire (la manœuvre est navale). Sélection BIDIRECTIONNELLE :
 * plan ⇄ puces ⇄ détail via `selectedPosteUid`. `initialHullId` = coque d'ouverture (emplacement cliqué).
 */
export function PosteSheet({ combatantIds, initialHullId, onClose }: { combatantIds: string[]; initialHullId?: string; onClose: () => void }) {
  const battle = useGame((s) => s.battle);
  const scene = useGame((s) => s.scene);
  const partyZ = useGame((s) => s.partyPos.z ?? 0); // le plan suit l'étage du groupe
  const setShipRole = useGame((s) => s.setShipRole);
  const facing = useGame((s) => s.facing);
  const [pickedPosteUid, setSelectedPosteUid] = useState<string | null>(null);
  const [tab, setTab] = useState<'postes' | 'manoeuvre'>('postes');
  const defilement = useRef<Partial<Record<'postes' | 'manoeuvre', number>>>({});
  const idSet = new Set(combatantIds);
  // Postes de TOUTES les coques de l'ensemble, ancrés au cap de chacune (posteAnchor). Un poste par pièce d'artillerie.
  const stations = battle && scene
    ? postesToStations(battle.combatants, (h, p) => posteAnchor(h, p, { heading: facing[h.id] })).filter(
        (s) => s.ref.kind === 'poste' && idSet.has(s.ref.hullId),
      )
    : [];
  if (!battle || !scene) return null;
  if (!stations.length) return null;
  // Sélection effective : choix explicite (plan/puces), sinon le 1er poste de la coque d'ouverture, sinon le 1er poste.
  const firstOfInitial = initialHullId
    ? stations.find((s) => s.ref.kind === 'poste' && s.ref.hullId === initialHullId)
    : undefined;
  const selectedPosteUid = pickedPosteUid ?? (firstOfInitial?.ref.kind === 'poste' ? firstOfInitial.ref.posteUid : stations[0].ref.kind === 'poste' ? stations[0].ref.posteUid : null);
  // La coque ACTIVE suit la sélection : celle qui porte le poste sélectionné (constante pour un navire, variable en siège).
  const selectedStation = stations.find((s) => s.ref.kind === 'poste' && s.ref.posteUid === selectedPosteUid) ?? stations[0];
  const activeHullId = selectedStation.ref.kind === 'poste' ? selectedStation.ref.hullId : combatantIds[0];
  const hull = battle.combatants.find((c) => c.id === activeHullId);
  if (!hull) return null;
  const crew = (hull.crewIds ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  const cap = facing[hull.id];
  const maneuverCrew = manoeuvreCrew(hull, crew);
  const vehicle = isVehicle(hull);
  const selectedStationId = selectedPosteUid ? `poste:${hull.id}:${selectedPosteUid}` : undefined;
  const selectedPoste = (hull.postes ?? []).find((p) => p.item.uid === selectedPosteUid);
  return (
    <Planche
      nom={hull.label}
      kind="feuille-postes"
      onClose={onClose}
      memoire={{ cle: tab, lire: () => defilement.current[tab] ?? 0, retenir: (top) => { defilement.current[tab] = top; } }}
      tabs={vehicle && (
        <Tabs
          tabs={[
            { key: 'postes' as const, label: 'Postes' },
            { key: 'manoeuvre' as const, label: 'Manœuvre' },
          ]}
          active={tab}
          onChange={setTab}
        />
      )}
      aside={(
        <>
          <div className="sheet-portrait">
            <PortraitTile c={hull} ring="var(--gold)" variant="full" size="xl" />
            <span className="char-sub">{vehicle ? 'Navire' : 'Emplacement de siège'}{cap ? ` · cap ${libelleDeValeur(dir8Schema, cap)}` : ''}</span>
          </div>
          <ShipStateBlock ship={hull} cap={cap} morale={shipMoraleScore(useGame.getState, hull)} crew={crew} />
        </>
      )}
    >
      {tab === 'postes' || !vehicle ? (
        <StationSheet
          scene={scene}
          z={partyZ}
          stations={stations}
          selectedStationId={selectedStationId}
          onSelectStation={(s) => setSelectedPosteUid(s.ref.kind === 'poste' ? s.ref.posteUid : null)}
          renderDetail={() => (selectedPoste ? <PosteDetail hull={hull} poste={selectedPoste} combatants={battle.combatants} /> : null)}
          subtitleOf={(s) => (s.side ? libelleDeValeur(posteSideSchema, s.side) : 'Omni')}
          detailTitle="Armes · postes"
        />
      ) : (
        /* Le dossier montre l'équipage de la COQUE (PJ et marins PNJ, moins les servants de
           pièce) ; la carte du monde montre le GROUPE. Même roster, même règles, deux
           populations — la primitive les reçoit, elle ne les devine pas. */
        <ShipRolesPanel crew={maneuverCrew} onSet={setShipRole} />
      )}
    </Planche>
  );
}
