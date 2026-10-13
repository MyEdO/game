import { useState } from 'react';
import { useGame } from '../state/store';
import { Prose } from './Prose';
import { RuleDivider } from './Ornaments';
import { MenuCard } from './MenuCard';
import { ActiveModal } from './ActiveModal';
import { StationSheet } from './StationSheet';
import { AssignRow } from './AssignRow';
import { battleScenesToStations, type Station } from '../state/stations';
import {
  massBattleThreatPenalty, armyMight, armyStartMight,
  battleSceneById, battleSceneEffectLabel, battleActionRefus,
  type MassBattleState, type MassBattleArmy,
} from '../state/massBattleFlow';
import { BATTLE_HAZARDS } from '../engine/massBattle';
import type { Combatant } from '../engine/types';
import { GatedAction, raisonSi } from './GatedAction';
import { Grid } from './Layout';
import { t } from '../i18n';

/**
 * Écran de Combat de masse / Puissance de Bataille (ADE II 08). Il ne gère QUE les Rounds ('round') et
 * l'issue ('over') : la PRÉPARATION (Activités 'bataille') se joue dans le menu d'interlude (« Interlude
 * c'est interlude » — cf. `InterludeScreen`/`interludeCatalog`), pas ici. État des deux armées (Puissance
 * courante vs départ), SITUATION du Round (sous-ensemble de Scènes du moment + menaces imposées), Scènes
 * cinématiques MULTI-PJ (résolues en Soutien, ADE II 8 l.116-118), aléa environnemental, Test
 * spectaculaire, Rassemblement, issue. Responsive.
 */
export function MassBattleView() {
  const mb = useGame((s) => s.massBattle);
  if (!mb) return null;
  return (
    <div className="menu mass-battle">
      <MenuCard
        className="mb-card"
        header={<>
          <h1 className="display-title">Bataille de masse</h1>
          <p className="subtitle">
            {mb.phase === 'over'
              ? 'La bataille est terminée.'
              : `Round de bataille ${mb.round} / ${mb.plannedRounds}`}
          </p>
          <RuleDivider />
        </>}
      >
        <ArmyBars mb={mb} />
        {mb.phase === 'round' && <RoundPanel mb={mb} />}
        {mb.phase === 'over' && <OverPanel mb={mb} />}
        <BattleLog log={mb.log} />
      </MenuCard>
      {/* Jets de bataille = Activités : la modale unifiée (RollShell) est rendue par l'arbitre R2. */}
      <ActiveModal />
    </div>
  );
}

function ArmyBars({ mb }: { mb: MassBattleState }) {
  return (
    <Grid min="md" stackBelow={700} className="mb-armies">
      <ArmyBar army={mb.ally} side="ally" />
      <ArmyBar army={mb.enemy} side="enemy" />
    </Grid>
  );
}

function ArmyBar({ army, side }: { army: MassBattleArmy; side: 'ally' | 'enemy' }) {
  const might = armyMight(army);
  return (
    <div className={`mb-army mb-${side} panel`}>
      <div className="mb-army-head">
        <strong>{army.label}</strong>
        <span className="mb-might">{might}</span>
      </div>
      <div className="mb-meter">
        <div className="mb-meter-fill" style={{ width: `${might}%` }} />
      </div>
      <div className="mb-army-sub">Puissance de départ {armyStartMight(army)}</div>
    </div>
  );
}

function RoundPanel({ mb }: { mb: MassBattleState }) {
  const rollHazard = useGame((s) => s.massBattleHazard);
  const clash = useGame((s) => s.massBattleClash);
  const rally = useGame((s) => s.massBattleRally);
  const advance = useGame((s) => s.massBattleAdvance);
  const scene = useGame((s) => s.scene);
  const partyZ = useGame((s) => s.partyPos.z ?? 0); // le plan suit l'étage du groupe
  const party = useGame((s) => s.party);
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(undefined);
  const allyBonus = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const threatPen = massBattleThreatPenalty(mb);
  // Stations = les Scènes de la situation posées sur le plan (ancres authorées + affectation E3).
  const battleStations = battleScenesToStations(mb.situation, mb.assignment, scene);
  const woundedRally = mb.awaitingNext
    && party.some((h) => !h.dead && !mb.ralliedHeroes.includes(h.id) && h.wounds.current < h.wounds.max);
  return (
    <section className="panel mb-phase">
      {mb.terrain && (
        <div className="mb-terrain">
          <h3>Configuration du terrain</h3>
          <Prose md={mb.terrain} />
        </div>
      )}
      {threatPen !== 0 && (
        <p className="mb-detail mb-clash">
          Menace non vaincue : les Tests des autres Scènes subissent {threatPen} (vainquez-la pour la lever).
        </p>
      )}
      {mb.lastClash && (
        <p className="mb-detail mb-clash">
          Round précédent : les Personnages réduisent l'ennemi de {mb.lastClash.enemyLoss}, l'ennemi
          réduit les Personnages de {mb.lastClash.allyLoss}.
        </p>
      )}

      <StationSheet
        scene={scene}
        z={partyZ}
        stations={battleStations}
        selectedStationId={selectedStationId}
        onSelectStation={(s) => setSelectedStationId(s.id)}
        detailTitle="Scènes du moment"
        renderDetail={(s) => <SceneStationDetail mb={mb} station={s} />}
      />
      {mb.sceneDeltas.length > 0 && (
        <p className="mb-detail mb-good">
          Ce Round : {mb.sceneDeltas.map((d) => `${d.label} (${d.side === 'ally' ? 'alliée' : 'ennemie'} ${d.amount >= 0 ? '+' : ''}${d.amount})`).join(', ')}.
        </p>
      )}

      <h3>Aléa de bataille</h3>
      {mb.hazard ? (
        <div className="mb-hazard">
          <strong>{mb.hazard.label}.</strong> <span className="mb-detail">{mb.hazard.text}</span>
        </div>
      ) : (
        <div className="bar mb-actions">
          <button className="btn small" disabled={mb.awaitingNext} onClick={() => rollHazard()}>Tirer un facteur (1d10)</button>
          <select
            className="mb-select"
            defaultValue=""
            disabled={mb.awaitingNext}
            aria-label="Choisir un facteur environnemental"
            onChange={(e) => { if (e.target.value) rollHazard(Number(e.target.value)); }}
          >
            <option value="">Choisir un facteur…</option>
            {BATTLE_HAZARDS.map((h) => <option key={h.min} value={h.min}>{h.label}</option>)}
          </select>
        </div>
      )}

      {mb.awaitingNext ? (
        <div className="bar mb-actions mb-clash-actions">
          {woundedRally && (
            <button className="btn small" onClick={rally} title="Test de Résistance de guérison (l.122)">{t('mbf.rallyLabel')}</button>
          )}
          <button className="btn btn-primary" onClick={advance}>Round suivant</button>
        </div>
      ) : (
        <div className="bar mb-actions mb-clash-actions">
          <button className="btn btn-primary" onClick={clash} title="Résoudre l'affrontement des deux armées (Test spectaculaire de Puissance)">
            Test spectaculaire de Puissance
          </button>
          {allyBonus !== 0 && <span className="mb-detail">Bonus allié ce Round : {allyBonus > 0 ? '+' : ''}{allyBonus}</span>}
        </div>
      )}
    </section>
  );
}

/**
 * Détail d'une Station de Scène (colonne droite du `StationSheet`) : genre, effet chiffré, état de tenue,
 * description VERBATIM, puis résolution. La CARDINALITÉ suit le RAW : une Scène de combat/menace engage
 * TOUT le groupe (pas d'affectation par PJ) ; une Scène de Compétence/Tenue est MULTI-PJ (ADE II 8
 * l.116-118 : « les Personnages peuvent choisir de participer à l'une des Scènes ») → `AssignRow`
 * (max Infinity) : le joueur affecte N PJ, résolus en SOUTIEN (l.153/157). La désactivation du Résoudre
 * reste IDENTIQUE à l'ancienne liste plate (résolue / Round figé / plus de PJ pour un Test·Tenue / rompue).
 */
function SceneStationDetail({ mb, station }: { mb: MassBattleState; station: Station }) {
  const chooseScene = useGame((s) => s.massBattleScene);
  const setHero = useGame((s) => s.setMassBattleHero);
  const party = useGame((s) => s.party);
  if (station.ref.kind !== 'battleScene') return null;
  const sceneId = station.ref.sceneId;
  const sc = battleSceneById(sceneId);
  if (!sc) return null;
  const resolved = mb.resolvedScenes.includes(sceneId);
  const kindLabel = sc.sceneKind === 'combat' ? 'Combat' : sc.sceneKind === 'threat' ? 'Menace' : sc.sceneKind === 'hold' ? 'Tenue' : 'Compétence';
  const hold = mb.sceneState[sceneId];
  const living = party.filter((h) => !h.dead);
  // PJ encore libres ce Round.
  const available = living.filter((h) => !mb.actedHeroes.includes(h.id));
  const remaining = available.length;
  // Équipage POSTÉ à cette Scène (Scène MULTI-PJ) — ids résolus en héros vivants, ordre préservé.
  const postedIds = mb.assignment[sceneId] ?? [];
  const posted = postedIds.map((id) => living.find((h) => h.id === id)).filter((h): h is Combatant => !!h);
  // Un combat (Scène 'combat'/'threat', incl. le Duel) engage tout le groupe → PAS de garde « plus de PJ libre ».
  const isCombat = sc.sceneKind === 'combat' || sc.sceneKind === 'threat';
  const broken = sc.sceneKind === 'hold' && !!hold?.broken;
  const refusTenter = isCombat ? null : battleActionRefus(mb, available, sc);
  const disabled = resolved || mb.awaitingNext
    || (!isCombat && remaining === 0)
    || broken || !!refusTenter;
  return (
    <div className={`mb-scene${resolved ? ' mb-scene-done' : ''}`}>
      <div className="bar mb-scene-head">
        <span className="mb-scene-kind">{resolved ? 'Résolue' : kindLabel}</span>
        <span className="mb-scene-eff">{battleSceneEffectLabel(sc)}</span>
        {sc.sceneKind === 'hold' && sc.hold && (
          <span className="mb-scene-kind">
            {hold?.broken ? 'Position perdue' : `Point de rupture ${hold?.breakpoint ?? 0}/${sc.hold.breakpoint}`}
          </span>
        )}
      </div>
      {/* Une Scène de Round EST une Activité (`battleSceneById` → `activityById`) : sa desc est le
          champ `desc` de son entrée d'`activities.json`. */}
      {sc.desc && <div className="mb-scene-desc"><Prose md={sc.desc} porteur={{ type: 'activities', id: sc.id, chemin: 'desc' }} /></div>}
      {isCombat ? (
        <p className="mb-detail">Tout le groupe engage le combat.</p>
      ) : (
        // Scène MULTI-PJ (l.116-118) : le joueur affecte N PJ (résolus en Soutien) — ajout/retrait sur la liste.
        <AssignRow
          assigned={posted}
          candidates={available}
          onAssign={(id) => setHero(sceneId, [...postedIds, id])}
          onRemove={(id) => setHero(sceneId, postedIds.filter((x) => x !== id))}
          intitule={`${sc.label} : affecter un Personnage`}
          nomRetirer={(c) => `Retirer ${c.label} de ${sc.label}`}
          canPick={!resolved && !mb.awaitingNext}
        />
      )}
      <div className="bar mb-actions">
        <GatedAction
          id={`mb-scene-${sceneId}`}
          label={resolved ? 'Scène résolue' : isCombat ? 'Engager le combat' : 'Résoudre'}
          enabled={!disabled}
          {...raisonSi(resolved ? 'Cette Scène est déjà résolue.'
            : mb.awaitingNext ? 'Résolvez le Round en cours avant d’engager une Scène.'
            : !isCombat && remaining === 0 ? 'Plus aucun Personnage libre ce Round.'
            : broken ? 'La position est perdue — cette Scène ne se tient plus.'
            : refusTenter)}
          onClick={() => chooseScene(sceneId)}
          btnClassName="small"
        />
      </div>
    </div>
  );
}

function OverPanel({ mb }: { mb: MassBattleState }) {
  const end = useGame((s) => s.endMassBattle);
  const outcomeText = mb.outcome === 'ally'
    ? `${mb.ally.label} l'emporte !`
    : mb.outcome === 'enemy'
      ? `${mb.enemy.label} l'emporte.`
      : 'Aucun vainqueur clair.';
  return (
    <section className="panel mb-phase">
      <h3>Issue de la bataille</h3>
      <p className="mb-outcome">{outcomeText}</p>
      <p className="mb-detail">
        Puissance finale — {mb.ally.label} : <b>{armyMight(mb.ally)}</b> · {mb.enemy.label} : <b>{armyMight(mb.enemy)}</b>.
        L'armée vaincue doit fuir sous peine d'être détruite.
      </p>
      <div className="bar mb-actions">
        <button className="btn btn-primary" onClick={end}>Terminer</button>
      </div>
    </section>
  );
}

function BattleLog({ log }: { log: string[] }) {
  if (!log.length) return null;
  return (
    <section className="panel mb-log">
      <h3>Déroulé</h3>
      <ul className="mb-log-list">
        {log.slice(-12).map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </section>
  );
}
