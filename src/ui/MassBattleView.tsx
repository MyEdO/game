import { useState } from 'react';
import { useGame } from '../state/store';
import { Prose } from './Prose';
import { RuleDivider } from './Ornaments';
import { MenuCard } from './MenuCard';
import { ActiveModal } from './ActiveModal';
import { StationSheet } from './StationSheet';
import { AssignRow } from './console/AssignRow';
import { battleScenesToStations, type Station } from '../noyau/stations';
import {
  massBattleThreatPenalty, armyMight, armyStartMight,
  battleSceneById, battleSceneEffectLabel, herosLibres, refusDeRassemblement, refusDeSceneDeBataille,
  type MassBattleState, type MassBattleArmy,
} from '../noyau/massBattleFlow';
import { BATTLE_HAZARDS } from '../engine/massBattle';
import { formatDice } from '../engine/dice';
import { massBattleHazardsDie } from '../data';
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
      <ArmyBar army={mb.allie} side="allie" />
      <ArmyBar army={mb.ennemi} side="ennemi" />
    </Grid>
  );
}

function ArmyBar({ army, side }: { army: MassBattleArmy; side: 'allie' | 'ennemi' }) {
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
  const fenetreChoisir = useGame((s) => s.fenetreChoisir);
  const valider = useGame((s) => s.fenetreValider);
  const scene = useGame((s) => s.scene);
  const partyZ = useGame((s) => s.partyPos.z ?? 0); // le plan suit l'étage du groupe
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(undefined);
  const allyBonus = mb.modificateurAllie + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const threatPen = massBattleThreatPenalty(mb);
  // Stations = les Scènes de la situation posées sur le plan (ancres authorées + affectation E3).
  const battleStations = battleScenesToStations(mb.situation, mb.assignment, scene);
  const refusRally = useGame(refusDeRassemblement);
  return (
    <section className="panel mb-phase">
      {mb.terrain && (
        <div className="mb-terrain">
          <h3>Configuration du terrain</h3>
          <Prose md={mb.terrain} paquet />
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
          Ce Round : {mb.sceneDeltas.map((d) => `${d.label} (${d.side === 'allie' ? 'alliée' : 'ennemie'} ${d.amount >= 0 ? '+' : ''}${d.amount})`).join(', ')}.
        </p>
      )}

      <h3>Aléa de bataille</h3>
      {mb.hazard ? (
        <div className="mb-hazard">
          <strong>{mb.hazard.label}.</strong> <span className="mb-detail">{mb.hazard.text}</span>
        </div>
      ) : (
        <div className="bar mb-actions">
          <button className="btn small" disabled={mb.awaitingNext} onClick={() => fenetreChoisir('batailleDeMasse', 'alea', null)}>{t('mbf.tirerAlea', { die: formatDice(massBattleHazardsDie()) })}</button>
          <select
            className="mb-select"
            defaultValue=""
            disabled={mb.awaitingNext}
            aria-label="Choisir un facteur environnemental"
            onChange={(e) => { if (e.target.value) fenetreChoisir('batailleDeMasse', 'alea', e.target.value); }}
          >
            <option value="">Choisir un facteur…</option>
            {BATTLE_HAZARDS.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
        </div>
      )}

      {mb.awaitingNext ? (
        <div className="bar mb-actions mb-clash-actions">
          <GatedAction id="mb-rally" primary={false} btnClassName="small" label={t('mbf.rallyLabel')}
            enabled={!refusRally} {...raisonSi(refusRally)} onClick={() => fenetreChoisir('batailleDeMasse', 'rallier', true)} />
          <button className="btn btn-primary" onClick={() => valider('batailleDeMasse')}>Round suivant</button>
        </div>
      ) : (
        <div className="bar mb-actions mb-clash-actions">
          <button className="btn btn-primary" onClick={() => fenetreChoisir('batailleDeMasse', 'engager', true)} title="Résoudre l'affrontement des deux armées (Test spectaculaire de Puissance)">
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
 * (max Infinity) : le joueur affecte N PJ, résolus en SOUTIEN (l.153/157). Le Résoudre est fermé par le verdict
 * du verbe (`refusDeSceneDeBataille`).
 */
function SceneStationDetail({ mb, station }: { mb: MassBattleState; station: Station }) {
  const fenetreChoisir = useGame((s) => s.fenetreChoisir);
  const party = useGame((s) => s.party);
  if (station.ref.kind !== 'battleScene') return null;
  const sceneId = station.ref.sceneId;
  const sc = battleSceneById(sceneId);
  if (!sc) return null;
  const resolved = mb.resolvedScenes.includes(sceneId);
  const kindLabel = sc.sceneKind === 'combat' ? 'Combat' : sc.sceneKind === 'threat' ? 'Menace' : sc.sceneKind === 'hold' ? 'Tenue' : 'Compétence';
  const hold = mb.sceneState[sceneId];
  const living = party.filter((h) => !h.dead);
  const available = herosLibres(mb, party);
  // Équipage POSTÉ à cette Scène (Scène MULTI-PJ) — ids résolus en héros vivants, ordre préservé.
  const postedIds = mb.assignment[sceneId] ?? [];
  const posted = postedIds.map((id) => living.find((h) => h.id === id)).filter((h): h is Combatant => !!h);
  const isCombat = sc.sceneKind === 'combat' || sc.sceneKind === 'threat';
  const refus = refusDeSceneDeBataille({ massBattle: mb, party }, sceneId);
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
          onAssign={(id) => fenetreChoisir('batailleDeMasse', 'ajouterAuPoste', sceneId, id)}
          onRemove={(id) => fenetreChoisir('batailleDeMasse', 'retirerDuPoste', sceneId, id)}
          intitule={`${sc.label} : affecter un Personnage`}
          nomRetirer={(c) => `Retirer ${c.label} de ${sc.label}`}
          canPick={!resolved && !mb.awaitingNext}
        />
      )}
      <div className="bar mb-actions">
        <GatedAction
          id={`mb-scene-${sceneId}`}
          label={resolved ? 'Scène résolue' : isCombat ? 'Engager le combat' : 'Résoudre'}
          enabled={!refus}
          {...raisonSi(refus)}
          onClick={() => fenetreChoisir('batailleDeMasse', 'scene', sceneId)}
          btnClassName="small"
        />
      </div>
    </div>
  );
}

function OverPanel({ mb }: { mb: MassBattleState }) {
  const fermer = useGame((s) => s.fenetreFermer);
  const end = () => fermer('batailleDeMasse');
  const outcomeText = mb.outcome === 'allie'
    ? `${mb.allie.label} l'emporte !`
    : mb.outcome === 'ennemi'
      ? `${mb.ennemi.label} l'emporte.`
      : 'Aucun vainqueur clair.';
  return (
    <section className="panel mb-phase">
      <h3>Issue de la bataille</h3>
      <p className="mb-outcome">{outcomeText}</p>
      <p className="mb-detail">
        Puissance finale — {mb.allie.label} : <b>{armyMight(mb.allie)}</b> · {mb.ennemi.label} : <b>{armyMight(mb.ennemi)}</b>.
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
