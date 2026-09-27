/**
 * PANNEAU LOGIQUE — dock bas repliable/redimensionnable remplaçant les 3 modales du POC
 * (Triggers / Dialogues / Rencontres) + l'onglet Validation. MASTER-DÉTAIL : liste à gauche,
 * détail de l'élément sélectionné à droite. Édition LIVE via `setScene` → un seul historique
 * d'undo (fini le modèle copie locale + Annuler/Appliquer).
 */
import { useRef } from 'react';
import { Scene, Trigger, EncounterDef, Dialogue, WallSide } from '../../state/scene';
import { wallSideSchema } from '../../data/schemas/defs-scenes/communs';
import type { WorldMap } from '../../state/worldMap';
import type { ThreatTier } from '../../engine/advantagePool';
import { EMPTY_FLOW } from '../../state/flow';
import type { Warning } from '../../state/validateScene';
import { nextEntityId } from '../../state/entityId';
import { removeMember, patchMember, flowEffectCount } from './editorState';
import { LayerChip, sceneLayerZs } from './LayerField';
import { effectCtxOf, Ctx } from './EffectList';
import { FlowEditor } from './FlowEditor';
import { WhenEditor, condSummary } from './ConditionEditor';
import { DialogueDetail } from './DialogueDetail';
import { ValidationPanel } from './ValidationPanel';
import { Icon } from '../Icon';
import { Tabs } from '../Tabs';
import { ListRow } from '../ListRow';
import { NumberField } from '../NumberField';
import { Row } from '../Layout';
import { AjoutRangee } from '../AjoutRangee';

export type LogicTab = 'triggers' | 'dialogues' | 'encounters' | 'validation';

export function LogicDock({
  scene,
  otherScenes,
  worldMap,
  setScene,
  warnings,
  onSelectWarning,
  tab,
  setTab,
  height,
  setHeight,
  trigSel,
  setTrigSel,
  dlgSel,
  setDlgSel,
  encSel,
  setEncSel,
  onSelectEntity,
  currentLayer,
}: {
  scene: Scene;
  otherScenes: Scene[];
  /** Carte du monde du projet (id + label des lieux) pour `openPort` — absente ⇒ fallback texte. */
  worldMap: WorldMap | null;
  setScene: (s: Scene) => void;
  warnings: Warning[];
  onSelectWarning: (w: Warning) => void;
  /** Sélectionne une entité sur la carte (chip de membre → inspecteur). */
  onSelectEntity: (id: string) => void;
  /** Onglet DÉPLIÉ, ou `null` = dock replié — un seul état : l'ouverture EST le choix d'onglet. */
  tab: LogicTab | null;
  setTab: (t: LogicTab | null) => void;
  height: number;
  setHeight: (h: number) => void;
  /** Trigger sélectionné = la sélection CANVAS (synchro carte ⇄ dock). */
  trigSel: string | null;
  setTrigSel: (id: string | null) => void;
  dlgSel: string | null;
  setDlgSel: (id: string | null) => void;
  encSel: string | null;
  setEncSel: (id: string | null) => void;
  /** Couche (z) en cours d'édition — toute logique créée depuis le dock s'y pose. */
  currentLayer: number;
}) {
  const ctx: Ctx = { encounters: scene.encounters, dialogues: scene.dialogues, ...effectCtxOf(scene, otherScenes, worldMap ?? undefined) };
  const dragRef = useRef<{ sy: number; sh: number } | null>(null);

  const errors = warnings.filter((w) => w.level === 'error').length;
  const tabs: { key: LogicTab; label: string | JSX.Element; count: number; alert?: boolean }[] = [
    { key: 'triggers', label: <><Icon id="map-tool/zone" size="sm" /> Triggers</>, count: scene.triggers.length },
    { key: 'dialogues', label: <><Icon id="merchant/haggle" size="sm" /> Dialogues</>, count: scene.dialogues.length },
    { key: 'encounters', label: <><Icon id="action/attack" size="sm" /> Rencontres</>, count: scene.encounters.length },
    { key: 'validation', label: <><Icon id="ui/warning" size="sm" /> Validation</>, count: warnings.length, alert: errors > 0 },
  ];
  /** Cliquer l'onglet DÉPLIÉ le replie — c'est le seul geste de repli, il n'en existe pas d'autre. */
  const clickTab = (t: LogicTab) => setTab(t === tab ? null : t);

  return (
    <div className={`logic-dock${tab ? ' open' : ''}`} style={tab ? { height } : undefined}>
      <div
        className="logic-resize"
        title="Glisser pour redimensionner"
        onPointerDown={(e) => {
          if (!tab) return;
          dragRef.current = { sy: e.clientY, sh: height };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          setHeight(Math.max(160, Math.min(window.innerHeight * 0.75, dragRef.current.sh + (dragRef.current.sy - e.clientY))));
        }}
        onPointerUp={() => (dragRef.current = null)}
      />
      <Tabs tabs={tabs} active={tab} onChange={clickTab} />

      {tab && (
        <div className="logic-body">
          {tab === 'triggers' && (
            <TriggersTab scene={scene} setScene={setScene} ctx={ctx} sel={trigSel} setSel={setTrigSel} currentLayer={currentLayer} />
          )}
          {tab === 'dialogues' && (
            <DialoguesTab scene={scene} setScene={setScene} ctx={ctx} sel={dlgSel} setSel={setDlgSel} />
          )}
          {tab === 'encounters' && (
            <EncountersTab scene={scene} setScene={setScene} ctx={ctx} sel={encSel} setSel={setEncSel} onSelectEntity={onSelectEntity} />
          )}
          {tab === 'validation' && (
            <div className="logic-validation">
              <ValidationPanel warnings={warnings} onSelect={onSelectWarning} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TriggersTab({
  scene,
  setScene,
  ctx,
  sel,
  setSel,
  currentLayer,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  ctx: Ctx;
  sel: string | null;
  setSel: (id: string | null) => void;
  currentLayer: number;
}) {
  const t = scene.triggers.find((x) => x.id === sel) ?? null;
  const upd = (patch: Partial<Trigger>) => setScene({ ...scene, triggers: scene.triggers.map((x) => (t && x.id === t.id ? { ...x, ...patch } : x)) });
  return (
    <div className="logic-split">
      <div className="logic-list">
        {scene.triggers.map((x) => (
          <ListRow
            key={x.id}
            selected={x.id === sel}
            onClick={() => setSel(x.id)}
            label={<><b>{x.id}</b> ({x.rect.x},{x.rect.y}) {x.rect.w}×{x.rect.h}{condSummary(x.when) ? ` · si ${condSummary(x.when)}` : ''}</>}
          >
            <LayerChip z={x.rect.z} layers={sceneLayerZs(scene)} />
            <span className="count">{flowEffectCount(x.flow)}</span>
          </ListRow>
        ))}
        <AjoutRangee libelle="Nouveau trigger" onAjout={() => {
            const id = nextEntityId('trig', scene.triggers.map((x) => x.id));
            setScene({ ...scene, triggers: [...scene.triggers, { id, rect: { x: 0, y: 0, w: 2, h: 2, ...(currentLayer ? { z: currentLayer } : {}) }, once: true, flow: EMPTY_FLOW }] });
            setSel(id);
          }} />
        <p className="hint">Astuce : outil <Icon id="map-tool/zone" size="sm" /> → glisser sur la carte pour dessiner la zone directement.</p>
      </div>
      {t ? (
        <div className="logic-detail">
          <Row>
            <label className="ed-field">
              Id
              <input
                value={t.id}
                onChange={(e) => {
                  upd({ id: e.target.value });
                  setSel(e.target.value);
                }}
              />
            </label>
            <label className="ed-check">
              <input type="checkbox" checked={!!t.once} onChange={(e) => upd({ once: e.target.checked })} /> une fois
            </label>
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, triggers: scene.triggers.filter((x) => x.id !== t.id) });
                setSel(null);
              }}
            >
              Supprimer
            </button>
          </Row>
          <div className="mini-title" title="Le trigger ne se déclenche qu'en entrant dans la zone si la condition est vraie (flag, créneau horaire, ET/OU/NON).">Condition de déclenchement</div>
          <WhenEditor when={t.when} onChange={(when) => upd({ when })} />
          <div className="mini-title">Au déclenchement (effets · conditions · tests)</div>
          <FlowEditor flow={t.flow} onChange={(flow) => upd({ flow })} ctx={ctx} />
        </div>
      ) : (
        <div className="logic-detail hint">Sélectionnez un trigger (liste ou carte) pour éditer ses effets.</div>
      )}
    </div>
  );
}

function DialoguesTab({
  scene,
  setScene,
  ctx,
  sel,
  setSel,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  ctx: Ctx;
  sel: string | null;
  setSel: (id: string | null) => void;
}) {
  const d = scene.dialogues.find((x) => x.id === sel) ?? null;
  return (
    <div className="logic-split">
      <div className="logic-list">
        {scene.dialogues.map((x) => (
          <ListRow key={x.id} selected={x.id === sel} onClick={() => setSel(x.id)} label={<b>{x.id}</b>}>
            <span className="count">{x.nodes.length} nœud(s)</span>
          </ListRow>
        ))}
        <AjoutRangee libelle="Nouveau dialogue" onAjout={() => {
            const id = nextEntityId('dlg', scene.dialogues.map((x) => x.id));
            setScene({ ...scene, dialogues: [...scene.dialogues, { id, start: 'n1', nodes: [{ id: 'n1', desc: '', choices: [] }] }] });
            setSel(id);
          }} />
      </div>
      {d ? (
        <div className="logic-detail">
          <Row className="logic-detail-bar">
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, dialogues: scene.dialogues.filter((x) => x.id !== d.id) });
                setSel(null);
              }}
            >
              Supprimer le dialogue
            </button>
          </Row>
          <DialogueDetail
            key={d.id}
            dialogue={d}
            ctx={ctx}
            onChange={(nd: Dialogue) => {
              setScene({ ...scene, dialogues: scene.dialogues.map((x) => (x.id === d.id ? nd : x)) });
              if (nd.id !== d.id) setSel(nd.id);
            }}
          />
        </div>
      ) : (
        <div className="logic-detail hint">Un dialogue = des nœuds (répliques) ; chaque choix mène à un autre nœud et/ou déclenche des effets. Attachez-le à un PNJ via l'inspecteur.</div>
      )}
    </div>
  );
}

function EncountersTab({
  scene,
  setScene,
  ctx,
  sel,
  setSel,
  onSelectEntity,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  ctx: Ctx;
  sel: string | null;
  setSel: (id: string | null) => void;
  onSelectEntity: (id: string) => void;
}) {
  const enc = scene.encounters.find((x) => x.id === sel) ?? null;
  const upd = (patch: Partial<EncounterDef>) =>
    setScene({ ...scene, encounters: scene.encounters.map((x) => (enc && x.id === enc.id ? { ...x, ...patch } : x)) });
  const byId = new Map(scene.entities.map((e) => [e.id, e]));
  const members = enc?.members ?? [];
  return (
    <div className="logic-split">
      <div className="logic-list">
        {scene.encounters.map((x) => (
          <ListRow
            key={x.id}
            selected={x.id === sel}
            onClick={() => setSel(x.id)}
            label={<><b>{x.id}</b>{x.surprise ? ' · embuscade' : ''}</>}
          >
            <span className="count">{(x.members ?? []).length} membre(s)</span>
          </ListRow>
        ))}
        <AjoutRangee libelle="Nouvelle rencontre" onAjout={() => {
            const id = nextEntityId('enc', scene.encounters.map((x) => x.id));
            setScene({ ...scene, encounters: [...scene.encounters, { id, members: [] }] });
            setSel(id);
          }} />
        <p className="hint">Astuce : outil <Icon id="action/attack" size="sm" /> pour poser les combattants directement sur la carte.</p>
      </div>
      {enc ? (
        <div className="logic-detail">
          <Row>
            <label className="ed-field">
              Id (référencé par « Démarrer un combat »)
              <input
                value={enc.id}
                onChange={(e) => {
                  upd({ id: e.target.value });
                  setSel(e.target.value);
                }}
              />
            </label>
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, encounters: scene.encounters.filter((x) => x.id !== enc.id) });
                setSel(null);
              }}
            >
              Supprimer
            </button>
          </Row>
          <div className="mini-title">Combattants (membres)</div>
          <div className="enemy-list">
            {members.map((m) => {
              const e = byId.get(m.entityId);
              const mounts = members.filter((mm) => mm.entityId !== m.entityId && (mm.mount || m.ridesEntityId === mm.entityId));
              return (
                <div key={m.entityId}>
                  <div className="enemy-row">
                    <ListRow
                      onClick={() => onSelectEntity(m.entityId)}
                      title="Sélectionner sur la carte → éditer le profil/apparence dans l'inspecteur"
                      label={e ? `${e.label ?? e.ref ?? m.entityId} · (${e.pos.x},${e.pos.y})` : <><Icon id="ui/warning" size="sm" /> {m.entityId} (entité manquante)</>}
                    />
                    <button className="btn small danger" onClick={() => setScene(removeMember(scene, enc.id, m.entityId))} title="Retirer de la rencontre (l'entité reste sur la carte)">
                      ✕
                    </button>
                  </div>
                  <div className="enemy-mount">
                    <label title="Cette créature est une monture rideable (peut être enfourchée — LDB 14).">
                      <input type="checkbox" checked={!!m.mount} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { mount: e2.target.checked || undefined }))} /> <Icon id="travel/mount" size="sm" /> Monture
                    </label>
                    <label title="Monture (de cette rencontre) que cet acteur chevauche au spawn (référence stable par entité).">
                      Chevauche{' '}
                      <select value={m.ridesEntityId ?? ''} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { ridesEntityId: e2.target.value || undefined }))}>
                        <option value="">— aucune —</option>
                        {mounts.map((mm) => (
                          <option key={mm.entityId} value={mm.entityId}>
                            {byId.get(mm.entityId)?.label ?? byId.get(mm.entityId)?.ref ?? mm.entityId}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label title="Camp au spawn : « Allié » place la créature du côté du groupe (monture libre prêtable). Défaut : Ennemi.">
                      Camp{' '}
                      <select value={m.side ?? 'enemy'} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { side: e2.target.value === 'ally' ? 'ally' : undefined }))}>
                        <option value="enemy">Ennemi</option>
                        <option value="ally">Allié</option>
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
            <p className="hint">
              Un combattant se pose SUR LA CARTE, à la case voulue : outil <Icon id="action/attack" size="sm" /> de
              la palette, rencontre cible = <b>{enc.id}</b>.
            </p>
          </div>
          <div className="mini-title">Surprise (embuscade, LDB 13)</div>
          <select
            value={enc.surprise ?? ''}
            onChange={(e) => upd({ surprise: (e.target.value || undefined) as 'party' | 'enemies' | undefined })}
            title="Camp pris en embuscade au début du combat : Test opposé Perception vs Discrétion ; les vaincus gagnent l'État Surpris."
          >
            <option value="">Aucune surprise</option>
            <option value="enemies">Les ennemis sont surpris (le groupe embusque)</option>
            <option value="party">Le groupe est surpris (les ennemis embusquent)</option>
          </select>
          <div className="mini-title">Avantage initial — Manœuvrabilité / Menace / Terrain (AA 11 l.53-65)</div>
          <div className="enemy-mount">
            <label title="Un camp possède un avantage de mouvement (monté, terrain arboricole/aérien favorable…) : +2 à sa réserve d'Avantage.">
              Manœuvrabilité{' '}
              <select
                value={enc.maneuverability ?? ''}
                onChange={(e) => upd({ maneuverability: (e.target.value || undefined) as 'party' | 'enemies' | undefined })}
              >
                <option value="">Aucune</option>
                <option value="party">Le groupe</option>
                <option value="enemies">Les ennemis</option>
              </select>
            </label>
          </div>
          <div className="enemy-mount">
            <label title="Un camp affronte une menace notoire (ogre, manticore, dragon…) : +1/+3/+5 à sa réserve selon le palier.">
              Menace{' '}
              <select
                value={enc.threat?.camp ?? ''}
                onChange={(e) => {
                  const camp = e.target.value as 'party' | 'enemies' | '';
                  upd({ threat: camp ? { camp, tier: enc.threat?.tier ?? 'dangereuse' } : undefined });
                }}
              >
                <option value="">Aucune</option>
                <option value="party">Le groupe</option>
                <option value="enemies">Les ennemis</option>
              </select>
            </label>
            {enc.threat && (
              <label>
                Palier{' '}
                <select value={enc.threat.tier} onChange={(e) => upd({ threat: { ...enc.threat!, tier: e.target.value as ThreatTier } })}>
                  <option value="dangereuse">Dangereuse (+1)</option>
                  <option value="tresDangereuse">Très dangereuse (+3)</option>
                  <option value="extreme">Extrême (+5)</option>
                </select>
              </label>
            )}
          </div>
          <div className="enemy-mount">
            <label title="Un camp tient une position avantageuse (fortifications, couvert, hauteur, pont…) : +1 (léger) ou +2 (lourd) à sa réserve.">
              Terrain{' '}
              <select
                value={enc.terrain?.camp ?? ''}
                onChange={(e) => {
                  const camp = e.target.value as 'party' | 'enemies' | '';
                  upd({ terrain: camp ? { camp, heavy: enc.terrain?.heavy } : undefined });
                }}
              >
                <option value="">Aucun</option>
                <option value="party">Le groupe</option>
                <option value="enemies">Les ennemis</option>
              </select>
            </label>
            {enc.terrain && (
              <label>
                <input type="checkbox" checked={!!enc.terrain.heavy} onChange={(e) => upd({ terrain: { ...enc.terrain!, heavy: e.target.checked || undefined } })} />{' '}
                Couvert lourd / position décisive (+2 au lieu de +1)
              </label>
            )}
          </div>
          <div className="mini-title">Objectif de victoire</div>
          <div className="enemy-mount">
            <label title="Comment le combat se GAGNE. Défaut : tous les ennemis hors d'action (comportement historique).">
              Type{' '}
              <select
                value={enc.victoryCondition?.type ?? 'allEnemiesDead'}
                onChange={(e) => {
                  const t = e.target.value;
                  if (t === 'allEnemiesDead') upd({ victoryCondition: undefined });
                  else if (t === 'destroyStructure') upd({ victoryCondition: { type: 'destroyStructure', edge: { x: 0, y: 0, side: 'N' } } });
                  else if (t === 'surviveRounds') upd({ victoryCondition: { type: 'surviveRounds', rounds: 3 } });
                  else if (t === 'reachZone') upd({ victoryCondition: { type: 'reachZone', rect: { x: 0, y: 0, w: 1, h: 1 } } });
                  else if (t === 'woundsThreshold') upd({ victoryCondition: { type: 'woundsThreshold', targetId: members[0]?.entityId ?? '', belowPercent: 50 } });
                  else if (t === 'firstBlood') upd({ victoryCondition: { type: 'firstBlood', threshold: 3 } });
                }}
              >
                <option value="allEnemiesDead">Tous les ennemis hors d'action</option>
                <option value="destroyStructure">Détruire une structure (brèche)</option>
                <option value="surviveRounds">Survivre N Rounds</option>
                <option value="reachZone">Atteindre une zone</option>
                <option value="woundsThreshold">Reddition à seuil de dommage</option>
                <option value="firstBlood">Duel judiciaire — premier sang</option>
              </select>
            </label>
          </div>
          {enc.victoryCondition?.type === 'destroyStructure' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label>X <NumberField variant="nu" label="Structure à détruire — X" value={vc.edge.x} onChange={(x) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, x } } })} /></label>
                <label>Y <NumberField variant="nu" label="Structure à détruire — Y" value={vc.edge.y} onChange={(y) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, y } } })} /></label>
                <label>
                  Arête{' '}
                  <select
                    value={vc.edge.side}
                    onChange={(e) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, side: e.target.value as WallSide } } })}
                  >
                    {wallSideSchema.options.map((side) => (
                      <option key={side} value={side}>{side}</option>
                    ))}
                  </select>
                </label>
                <label>Z <NumberField variant="nu" label="Structure à détruire — Z (étage)" value={vc.edge.z ?? 0} onChange={(z) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, z: z || undefined } } })} /></label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'surviveRounds' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label>Rounds à tenir <NumberField variant="nu" label="Rounds à tenir" min={1} value={vc.rounds} onChange={(rounds) => upd({ victoryCondition: { type: 'surviveRounds', rounds } })} /></label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'reachZone' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label>X <NumberField variant="nu" label="Zone à atteindre — X" value={vc.rect.x} onChange={(x) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, x } } })} /></label>
                <label>Y <NumberField variant="nu" label="Zone à atteindre — Y" value={vc.rect.y} onChange={(y) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, y } } })} /></label>
                <label>L <NumberField variant="nu" label="Zone à atteindre — largeur" min={1} value={vc.rect.w} onChange={(w) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, w } } })} /></label>
                <label>H <NumberField variant="nu" label="Zone à atteindre — hauteur" min={1} value={vc.rect.h} onChange={(h) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, h } } })} /></label>
                <label>
                  Camp{' '}
                  <select
                    value={vc.camp ?? 'party'}
                    onChange={(e) => upd({ victoryCondition: { type: 'reachZone', rect: vc.rect, camp: e.target.value as 'party' | 'enemies' } })}
                  >
                    <option value="party">Le groupe</option>
                    <option value="enemies">Les ennemis</option>
                  </select>
                </label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'woundsThreshold' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label title="Cible dont les Blessures sont surveillées : sous le seuil, elle amène son pavillon et sort du combat (reddition, #215).">
                  Cible{' '}
                  <select value={vc.targetId} onChange={(e) => upd({ victoryCondition: { type: 'woundsThreshold', targetId: e.target.value, belowPercent: vc.belowPercent } })}>
                    <option value="">— aucune —</option>
                    {members.map((m) => (
                      <option key={m.entityId} value={m.entityId}>
                        {byId.get(m.entityId)?.label ?? byId.get(m.entityId)?.ref ?? m.entityId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sous{' '}
                  <NumberField
                    variant="nu" label="Seuil de Blessures (%)" min={1} max={99} value={vc.belowPercent}
                    onChange={(belowPercent) => upd({ victoryCondition: { type: 'woundsThreshold', targetId: vc.targetId, belowPercent } })}
                  />
                  % de ses Blessures
                </label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'firstBlood' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label title="Le premier coup qui cause une perte de plus de ce nombre de Blessures met fin au duel (NADJ 06 l.175-177). Défaut 3 Blessures (seule valeur chiffrée par le RAW).">
                  Seuil{' '}
                  <NumberField
                    variant="nu" label="Seuil de premier sang" min={1} value={vc.threshold ?? 3}
                    onChange={(threshold) => upd({ victoryCondition: { type: 'firstBlood', threshold } })}
                  />
                  {' '}Blessures en un coup
                </label>
              </div>
            );
          })()}
          {(() => {
            // Défaut effectif (#471 défaut 1, `banRangedActive` de combatFlow.ts) : « la plupart » des
            // duels judiciaires interdisent les projectiles PAR DÉFAUT — champ absent + firstBlood =
            // coché. Décocher pose `banRanged: false` (dérogation explicite, PAS un simple undefined,
            // sinon il retomberait sur le défaut interdit) ; re-cocher efface (retour au défaut).
            const isDuel = enc.victoryCondition?.type === 'firstBlood';
            const effective = enc.banRanged ?? isDuel;
            return (
              <div className="enemy-mount">
                <label title="Duel judiciaire (NADJ 06 l.181) : « la plupart des lois locales interdisent de faire appel à des projectiles ». Dérogeable (variante locale) — champ indépendant de l'objectif de victoire.">
                  <input
                    type="checkbox"
                    checked={effective}
                    onChange={(e) => upd({ banRanged: isDuel ? (e.target.checked ? undefined : false) : (e.target.checked || undefined) })}
                  />{' '}
                  Armes à distance interdites
                </label>
              </div>
            );
          })()}
          <div className="enemy-mount">
            <label title="Rencontre de siège : l'IA ennemie peut prendre les structures destructibles de la scène (porte, mur) pour cible. Décoché = elle ne vise que les personnages. Aucun défaut dérivé : un objectif « Détruire une structure » ne coche pas cette case.">
              <input
                type="checkbox"
                checked={enc.siege === true}
                onChange={(e) => upd({ siege: e.target.checked || undefined })}
              />{' '}
              Rencontre de siège — l’IA peut prendre les structures pour cible
            </label>
          </div>
          <div className="mini-title">À la victoire (récompenses : PX, butin, flag…)</div>
          <FlowEditor flow={enc.onVictory ?? EMPTY_FLOW} onChange={(flow) => upd({ onVictory: flow })} ctx={ctx} />
        </div>
      ) : (
        <div className="logic-detail hint">Une rencontre = des ennemis du bestiaire placés sur la grille. Référencée par un effet « Démarrer un combat ».</div>
      )}
    </div>
  );
}
