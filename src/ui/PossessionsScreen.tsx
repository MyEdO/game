/**
 * Écran POSSESSIONS (#620), composition PURE de primitives existantes : `ScreenShell` + `MasterDetail`
 * (liste des possessions du groupe groupées PAR PROPRIÉTAIRE puis par nature, patron
 * `PossessionsRegistry` #649) + `Tabs` (Aperçu/Inventaire, Soute pour toute possession non bête à
 * capacité, charrette comprise, Voyage pour une bête à profil d'allures) + `CarrierInventory` (sac de la
 * possession) + `GatedAction`
 * (Laisser/Reprendre/Débarquer/Abandonner, raison visible reflétant l'état RÉEL) + `MediaSelect` (choix
 * du navire de destination pour Embarquer — même patron que le menu « Donner » de `CarrierInventory`).
 *
 * Libellé de la LISTE maître : texte SIMPLE (pas de `CodexRef` cliquable) — une rangée `PlaqueRow`
 * cliquable dont le libellé serait AUSSI un déclencheur (`role=button` imbriqué, `position:relative`)
 * double l'action au clic (sélection + ouverture Codex) ET fait déborder visuellement son contenu par-
 * dessus le badge de localisation voisin dans la colonne étroite du rail (#620).
 * Le `CodexRef` reste légitime dans l'onglet Aperçu (`DetailFrame`, pas de conflit de sélection).
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useGame } from '../state/store';
import type { Combatant } from '../engine/types';
import type { Possession } from '../engine/possession';
import { possessionLabel, possessionCapacity, possessionLoadEnc, embarkedEnc } from '../engine/possession';
import { cargoTotalEnc } from '../engine/cargo';
import { findCargoById } from '../engine/seaVoyage';
import {
  mountProfileForCreature, ALLURES, allureLabel, ALLURE_KMH_PER_M, allureEnduranceHours,
} from '../engine/mountTravel';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { refusGestePossession, ciblesDEmbarquement, type EtatDesPossessions } from '../noyau/possessionsFlow';
import { bulkCarriers } from '../noyau/carriers';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Tabs, type TabItem } from './composites/Tabs';
import { PlaqueRow } from './PlaqueRow';
import { DetailFrame } from './DetailFrame';
import { GatedAction, raisonSi } from './GatedAction';
import { ChoiceButtons } from './OptionChooser';
import { LifeBar } from './LifeBar';
import { NotchGauge } from './NotchGauge';
import { CargoTransferPanel } from './CargoTransferPanel';
import { CarrierInventory } from './CarrierInventory';
import { MediaSelect } from './MediaSelect';
import { SearchFilterField, filterByLabel } from './SearchFilterField';
import { TraitChips } from './EntityChip';
import { ShipPreview } from './ShipPreview';
import { CreaturePreview } from './compendium/CreaturePreview';
import { findCreatureById } from '../data';
import { woundsTone, encumbranceTone } from './gaugeTones';
import {
  NATURE_ORDER, NATURE_TITLE, prefixOf, labelOf, locationBadge, MOUNT_INJURY_LABEL,
} from './PossessionsRegistry';
import { Band } from './Band';

interface OwnedRow { hero: Combatant; p: Possession }

type DetailTab = 'apercu' | 'inventaire' | 'soute' | 'voyage';

/** Ton de la valeur d'Enc (réutilise `encumbranceTone`, SOURCE UNIQUE avec la fiche héros/le Registre
 *  #649) — `undefined` = sans capacité bornée, aucun ton (texte neutre). */
function encStyle(load: number, capacity: number | undefined): CSSProperties | undefined {
  if (capacity == null) return undefined;
  const tone = encumbranceTone(load, capacity);
  if (tone === 'danger') return { color: 'var(--danger)', fontWeight: 700 };
  if (tone === 'warn') return { color: 'var(--gold2)' };
  return undefined;
}

/** Affichage Enc « X/capacité » d'une possession — charge PORTÉE (`possessionLoadEnc`, EXCLUT le
 *  poids propre : une bête vide affiche 0, pas son corps, #620 Lot 2 bug utilisateur). */
function EncValue({ p, all }: { p: Possession; all: Possession[] }) {
  const capacity = possessionCapacity(p);
  const load = possessionLoadEnc(p, all);
  return <span style={encStyle(load, capacity)}>Enc {load}{capacity != null ? `/${capacity}` : ''}</span>;
}

export function PossessionsScreen({ onClose, initialUid = null }: { onClose: () => void; initialUid?: string | null }) {
  const party = useGame((s) => s.party);
  const possessions = useGame((s) => s.possessions);
  const worldMap = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const gameTime = useGame((s) => s.gameTime);
  const renamePossession = useGame((s) => s.renamePossession);
  const stablePossession = useGame((s) => s.stablePossession);
  const retrievePossession = useGame((s) => s.retrievePossession);
  const embark = useGame((s) => s.embark);
  const disembark = useGame((s) => s.disembark);
  const abandonPossession = useGame((s) => s.abandonPossession);
  const vessel = useGame((s) => s.vessel);
  const moveCargo = useGame((s) => s.moveCargo);
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);
  const carriers = useMemo(
    () => bulkCarriers({ party, vessel, possessions }),
    [party, vessel, possessions],
  );

  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(initialUid);
  const [tab, setTab] = useState<DetailTab>('apercu');
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);

  const rows: OwnedRow[] = useMemo(
    () => party.flatMap((hero) => possessions.filter((p) => p.ownerId === hero.id && !p.destroyed).map((p) => ({ hero, p }))),
    [party, possessions],
  );
  const filteredRows = filterByLabel(rows, (r) => possessionLabel(r.p), search);

  const selected = selectedUid != null ? possessions.find((p) => p.uid === selectedUid && !p.destroyed) : undefined;
  const selectedOwner = selected ? party.find((h) => h.id === selected.ownerId) : undefined;

  // Onglets conditionnels (#620) : Soute pour une CALE (navire/véhicule avec capacité) — le bât d'une bête
  // relève de son Inventaire/Enc (Aperçu), pas d'une cale ; Voyage pour une bête au profil d'allures EDOC.
  const selectedCapacity = selected ? possessionCapacity(selected) : undefined;
  const selectedCreatureId = selected && selected.nature === 'bete' && 'creatureId' in selected.ref ? selected.ref.creatureId : undefined;
  const mountProfile = selectedCreatureId ? mountProfileForCreature(selectedCreatureId) : undefined;

  // Verdicts du noyau (`refusGestePossession`), ceux que les gestes appliquent au clic ; navires qui
  // accueillent `selected` MAINTENANT (#620 Lot 2c — le joueur CHOISIT sa cale de destination).
  const etat: EtatDesPossessions = { party, possessions, worldMap, scene };
  const refusDe = (kind: 'laisser' | 'reprendre' | 'debarquer' | 'abandonner') => (selected ? refusGestePossession(etat, selected.uid, { kind }) : null);
  const embarquement = selected ? ciblesDEmbarquement(etat, selected.uid) : { cibles: [], refus: null };

  const select = (uid: string) => {
    setSelectedUid(uid);
    setTab('apercu');
    setConfirmingAbandon(false);
  };

  const tabs: TabItem<DetailTab>[] = [
    { key: 'apercu', label: 'Aperçu' },
    { key: 'inventaire', label: 'Inventaire', count: selected?.items.length || undefined },
    ...(selectedCapacity != null && selected?.nature !== 'bete' ? [{ key: 'soute' as const, label: 'Soute' }] : []),
    ...(mountProfile ? [{ key: 'voyage' as const, label: 'Voyage' }] : []),
  ];

  const refusLaisser = refusDe('laisser');
  const refusReprendre = refusDe('reprendre');
  const refusDebarquer = refusDe('debarquer');
  const refusAbandonner = refusDe('abandonner');

  // Aperçu visuel de la possession (#620 DoD) — `CreaturePreview` (Codex, `CodexEntry.tsx:140`) route
  // vers le BON gabarit (bipède/quadrupède/ailé…) via `resolveRender` : jamais `CharacterPreview`
  // (squelette bipède FIXE, faux pour une bête à 4 pattes). Statbloc custom sans apparence exploitable
  // (`CustomStatblock` n'en porte aucune, `src/engine/statblock.ts`) → pas de topper, aucun crash.
  const livingPreview = !selected || (selected.nature !== 'bete' && selected.nature !== 'serviteur')
    ? undefined
    : 'creatureId' in selected.ref
      ? { label: selected.ref.creatureId, appearance: findCreatureById(selected.ref.creatureId)?.appearance }
      : undefined;

  const list = (
    <>
      <SearchFilterField value={search} onChange={setSearch} placeholder="Filtrer les possessions…" icon />
      {filteredRows.length === 0 ? (
        <p className="muted">Aucune possession.</p>
      ) : (
        party.map((hero) => {
          const heroRows = filteredRows.filter((r) => r.hero.id === hero.id);
          if (heroRows.length === 0) return null;
          return NATURE_ORDER.map((nature) => {
            const natureRows = heroRows.filter((r) => r.p.nature === nature);
            if (natureRows.length === 0) return null;
            return (
              <Band key={`${hero.id}-${nature}`} title={`${hero.label} · ${NATURE_TITLE[nature]}`} right={<b>{natureRows.length}</b>}>
                {natureRows.map(({ p }) => (
                  <PlaqueRow
                    key={p.uid}
                    valueMuted
                    prefix={prefixOf(p)}
                    content={possessionLabel(p)}
                    meta={locationBadge(p, worldMap)}
                    value={<EncValue p={p} all={possessions} />}
                    selected={selectedUid === p.uid}
                    onClick={() => select(p.uid)}
                  />
                ))}
              </Band>
            );
          });
        })
      )}
    </>
  );

  const detail = !selected ? (
    <p className="muted">Choisissez une possession dans la liste.</p>
  ) : (
    <>
      <div className="bar">
        <GatedAction id="pos-laisser" label="Laisser" enabled={!refusLaisser} {...raisonSi(refusLaisser)}
          onClick={() => stablePossession(selected.uid)} primary={false} />
        <GatedAction id="pos-reprendre" label="Reprendre" enabled={!refusReprendre} {...raisonSi(refusReprendre)}
          onClick={() => retrievePossession(selected.uid)} primary={false} />
        <GatedAction id="pos-debarquer" label="Débarquer" enabled={!refusDebarquer} {...raisonSi(refusDebarquer)}
          onClick={() => disembark(selected.uid)} primary={false} />
        {embarquement.cibles.length > 0 ? (
          <MediaSelect
            align="left"
            triggerClassName="btn small"
            title="Choisir le navire de destination"
            trigger="Embarquer"
            options={embarquement.cibles.map((navire) => ({
              key: navire.uid,
              label: possessionLabel(navire),
              sub: `Cale ${embarkedEnc(navire.uid, possessions)}/${possessionCapacity(navire) ?? '∞'}`,
            }))}
            onSelect={(navireUid) => embark(selected.uid, navireUid)}
          />
        ) : (
          <GatedAction id="pos-embarquer" label="Embarquer" enabled={false} {...raisonSi(embarquement.refus)}
            onClick={() => {}} primary={false} />
        )}
        {confirmingAbandon ? (
          <ChoiceButtons options={[
            { key: 'cancel', label: 'Annuler', ghost: true, onSelect: () => setConfirmingAbandon(false) },
            {
              key: 'confirm', label: 'Confirmer l’abandon', primary: true, disabled: !!refusAbandonner,
              onSelect: () => { abandonPossession(selected.uid); setSelectedUid(null); setConfirmingAbandon(false); },
            },
          ]} />
        ) : (
          <GatedAction id="pos-abandonner" label="Abandonner" enabled={!refusAbandonner} {...raisonSi(refusAbandonner)}
            onClick={() => setConfirmingAbandon(true)} primary={false} btnClassName="danger" />
        )}
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Détail de la possession" />
      {tab === 'apercu' ? (
        <DetailFrame
          topper={
            livingPreview ? (
              <CreaturePreview label={livingPreview.label} appearance={livingPreview.appearance} />
            ) : selected.nature === 'navire' ? (
              // `ShipPreview` (gabarit `navire`, réutilisé de ShipDossier — chemin prouvé) : coques navigantes.
              // Un VÉHICULE (chariot terrestre OU barge à profil `ship`) n'a pas de rig fiable ici — `ShipPreview`
              // force le plan `navire` et produit une texture manquante hors coque → pas de topper (#726).
              <ShipPreview vehicleId={selected.vehicleId} label={possessionLabel(selected)} sunk={selected.destroyed} />
            ) : undefined
          }
          label={labelOf(selected)}
          sub={selectedOwner ? `Possession de ${selectedOwner.label}` : undefined}
          meta={
            <>
              <span className="chip">{NATURE_TITLE[selected.nature]}</span>
              {locationBadge(selected, worldMap)}
              {selected.nature === 'bete' && selected.mountInjury && (
                <span className="chip tone-warn">{MOUNT_INJURY_LABEL[selected.mountInjury]}</span>
              )}
            </>
          }
          sections={
            <>
              <PlaqueRow
                label="Nom"
                content={
                  <label className="field">
                    <input
                      aria-label="Renommer"
                      value={selected.label ?? ''}
                      placeholder={possessionLabel(selected)}
                      onChange={(e) => renamePossession(selected.uid, e.target.value)}
                    />
                  </label>
                }
              />
              {'wounds' in selected && selected.wounds && (
                <LifeBar value={selected.wounds.current} max={selected.wounds.max} tone={woundsTone} label="Blessures" />
              )}
              <PlaqueRow
                valueMuted
                label="Charge"
                content={possessionCapacity(selected) != null ? 'Contenance' : 'Poids porté'}
                value={<EncValue p={selected} all={possessions} />}
              />
              {(selected.nature === 'bete' || selected.nature === 'serviteur') && 'creatureId' in selected.ref && (
                <TraitChips traits={findCreatureById(selected.ref.creatureId)?.traits ?? []} />
              )}
            </>
          }
        />
      ) : tab === 'inventaire' ? (
        <CarrierInventory carrierId={selected.uid} items={selected.items} party={party} />
      ) : tab === 'soute' ? (
        <>
          <NotchGauge label="Cale" value={cargoTotalEnc(selected.cargo ?? [])} max={selectedCapacity!} stacked />
          <CargoTransferPanel
            carriers={carriers}
            onMove={moveCargo}
            labelOf={(id) => findCargoById(id)?.label ?? id}
          />
        </>
      ) : mountProfile ? (
        <Band title="Allures" right={<b>{mountProfile.m} M</b>}>
          <PlaqueRow valueMuted label="Charge portée" content="Capacité de bât" value={`${mountProfile.encPortee} Enc`} />
          {ALLURES.map((allure) => {
            const noTrot = allure === 'trot' && !mountProfile.trot;
            return (
              <PlaqueRow
                key={allure}
                valueMuted
                label={allureLabel(allure)}
                content={noTrot ? '—' : `${(ALLURE_KMH_PER_M[allure] * mountProfile.m).toFixed(1)} km/h`}
                value={noTrot ? 'ne trotte pas' : `${allureEnduranceHours(mountProfile, allure)} h`}
              />
            );
          })}
        </Band>
      ) : null}
    </>
  );

  return (
    <ScreenShell title="Possessions" onClose={onClose} meta={{ time: gameTime, money }} body="centered">
      <MasterDetail list={list} detail={detail} listLabel="Possessions du groupe" />
    </ScreenShell>
  );
}
