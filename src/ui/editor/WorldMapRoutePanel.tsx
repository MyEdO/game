/**
 * Panneau ROUTE de l'éditeur de carte du monde (#419) — extrait du monolithe `WorldMapEditor.tsx`
 * (règle 4 CLAUDE.md : 4 sections à plat → 2 onglets `Tabs`). « Trajet » (distance/sens/modes/prix/
 * vitesse + maritime), « Péripéties » (embuscade + péripéties d'auteur via EffectList). Zéro logique
 * métier déplacée : découpage JSX pur, coutures runtime intactes.
 */
import { useState } from 'react';
import { Tabs } from '../Tabs';
import { Icon } from '../Icon';
import { NumberField } from '../NumberField';
import { useClesDeRangees } from '../useClesDeRangees';
import { Scene } from '../../state/scene';
import { type WorldMap, type MapRoute, type MapRouteTrace, type Praticabilite, placeById } from '../../state/worldMap';
import { type TravelMode, TRAVEL_DEFAULTS, travelVehicles, travelModeLabels, travelModeIcon } from '../../engine/travel';
import { EffectList, type Ctx } from './EffectList';
import { RefSelect } from './worldMapPickers';
import { WhenEditor } from './ConditionEditor';
import { CouvreField } from './CouvreField';
import { ChipDeRefus } from '../ChipDeRefus';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/defs-scenes/worldmap';

export function WorldMapRoutePanel({ route, map, scenes, updRoute, effCtx, toggleMode }: {
  route: MapRoute;
  map: WorldMap;
  /** Toutes les scènes du projet (active + réserve) — pour lier embuscades/péripéties. */
  scenes: Scene[];
  updRoute: (id: string, patch: Partial<MapRouteTrace> | Praticabilite) => void;
  effCtx: Ctx;
  toggleMode: (r: MapRoute, mode: TravelMode) => void;
}) {
  const [routeTab, setRouteTab] = useState<'trajet' | 'peripeties'>('trajet');
  const ambushScene = route.ambush?.scene ? scenes.find((s) => s.id === route.ambush!.scene) : undefined;
  const clesDesPeripeties = useClesDeRangees(route.perils);

  return (
    <>
      <Tabs
        tabs={[{ key: 'trajet', label: 'Trajet' }, { key: 'peripeties', label: 'Péripéties' }]}
        active={routeTab}
        onChange={setRouteTab}
        label="Onglets de la route"
      />
      {routeTab === 'trajet' && (
        <>
          <div className="mini-title">
            Route : {placeById(map, route.a)?.label} ↔ {placeById(map, route.b)?.label}
          </div>
          <label className="ed-field">Distance (km)
            <NumberField variant="nu" label="Distance (km)" min={1} value={route.km} onChange={(km) => updRoute(route.id, { km })} />
          </label>
          <label className="ed-field">Sens (route à sens unique : n'est offerte que depuis ce lieu ; le retour passe par une autre route)
            <select
              value={route.from ?? ''}
              onChange={(e) => updRoute(route.id, { from: e.target.value || undefined })}
            >
              <option value="">— les deux sens —</option>
              <option value={route.a}>Depuis {placeById(map, route.a)?.label ?? route.a}</option>
              <option value={route.b}>Depuis {placeById(map, route.b)?.label ?? route.b}</option>
            </select>
          </label>
          <CouvreField value={route.couvre} sujet="de la route" onChange={(couvre) => updRoute(route.id, { couvre })} />
          <div className="mini-title" title="Le trajet n'est proposé que si la condition est vraie ; sinon il reste à l'écran, refusé, avec sa raison.">Praticable si</div>
          {/* Retirer la condition retire la raison AVEC elle : `refus` n'a pas d'objet sans `when`. */}
          <WhenEditor
            when={route.when}
            kinds={CONDITION_KINDS_CARTE}
            onChange={(when) => updRoute(route.id, when ? { when, refus: route.refus ?? '' } : { when: undefined, refus: undefined })}
          />
          {route.when && (
            <>
              <label className="ed-field">Raison du refus (montrée au joueur quand la condition est fausse)
                <input
                  value={route.refus}
                  placeholder="ex. Le pont est coupé par la crue."
                  onChange={(e) => updRoute(route.id, { when: route.when, refus: e.target.value })}
                />
              </label>
              {!route.refus.trim() && (
                <ChipDeRefus fixe refus={{ message: 'Raison du refus exigée dès qu’une condition est posée : sans elle le projet est refusé au chargement.' }} />
              )}
            </>
          )}
          <div className="mini-title">Modes de voyage</div>
          {(['pied', ...travelVehicles().map((v) => v.id)] as TravelMode[]).map((mode) => (
            <label key={mode} className="ed-check">
              <input type="checkbox" checked={route.modes.includes(mode)} onChange={() => toggleMode(route, mode)} />
              <Icon id={travelModeIcon(mode)} /> {travelModeLabels()[mode] ?? mode}
            </label>
          ))}
          {travelVehicles().filter((v) => route.modes.includes(v.id)).map((v) => (
            <div key={v.id}>
              <label className="ed-field">{v.label} — prix (sous/km/passager, RAW : {v.travel!.classes.map((c) => `${c.label} ${c.brassPerKm}`).join(' / ')})
                <NumberField
                  variant="nu" label={`${v.label} — prix (sous/km/passager)`} min={0} placeholder="défaut RAW par classe"
                  vide value={route.prices?.[v.id]}
                  onChange={(n) => updRoute(route.id, { prices: { ...route.prices, [v.id]: n ?? undefined } })}
                />
              </label>
              <label className="ed-field">{v.label} — Déplacement (km/h, RAW : {v.travel!.movement} ; ±1 modèle rapide/lent)
                <NumberField
                  variant="nu" label={`${v.label} — Déplacement (km/h)`} min={1} placeholder={String(v.travel!.movement)}
                  vide value={route.speed?.[v.id]}
                  onChange={(n) => updRoute(route.id, { speed: { ...route.speed, [v.id]: n ?? undefined } })}
                />
              </label>
            </div>
          ))}
          <label className="ed-field">Péripétie : seuil du d10 (vide = défaut carte ; 0 = désactivé)
            <NumberField
              variant="nu" label="Péripétie : seuil du d10 de la route" min={0} max={10} placeholder={String(map.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie)}
              vide value={route.perilDie}
              onChange={(n) => updRoute(route.id, { perilDie: n ?? undefined })}
            />
          </label>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={route.inns ?? false}
              onChange={(e) => updRoute(route.id, { inns: e.target.checked || undefined })}
            />
            <Icon id="rest/bed" size="sm" /> Relais d'auberges (la halte de nuit propose l'auberge)
          </label>
          {/* ── Route MARITIME (MDG 13-15) : se voyage sur le navire de campagne (mode « mer »), km en milles ── */}
          <label className="ed-check">
            <input
              type="checkbox"
              checked={route.sea ?? false}
              onChange={(e) => updRoute(route.id, e.target.checked
                ? { sea: true, modes: ['mer'], seaHeading: route.seaHeading ?? 'est' }
                : { sea: undefined, seaHeading: undefined, modes: route.modes.filter((x) => x !== 'mer').length ? route.modes.filter((x) => x !== 'mer') : ['pied'] })}
            />
            <Icon id="travel/anchor" size="sm" /> Route maritime (navire de campagne ; distance en milles)
          </label>
          {route.sea && (
            <label className="ed-field">Cap dominant (aspect du vent, MDG 13 l.262-270)
              <select
                value={route.seaHeading ?? 'est'}
                onChange={(e) => updRoute(route.id, { seaHeading: e.target.value as MapRoute['seaHeading'] })}
              >
                {(['nord', 'sud', 'est', 'ouest'] as const).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {routeTab === 'peripeties' && (
        <>
          <div className="mini-title">Embuscade (« Attaqués ! » de la table d10)</div>
          <RefSelect
            label="Scène d'embuscade (vide = narratif seul)"
            options={scenes}
            getId={(s) => s.id}
            getLabel={(s) => `${s.label} (${s.id})`}
            value={route.ambush?.scene ?? ''}
            nullableLabel="— aucune —"
            onChange={(v) => updRoute(route.id, {
              ambush: v ? { scene: v, encounter: route.ambush?.encounter ?? '' } : undefined,
            })}
          />
          {route.ambush && (
            <>
              <RefSelect
                label="Rencontre déclenchée"
                options={ambushScene?.encounters ?? []}
                getId={(enc) => enc.id}
                getLabel={(enc) => enc.id}
                value={route.ambush.encounter}
                nullableLabel="— choisir —"
                onChange={(v) => updRoute(route.id, { ambush: { ...route.ambush!, encounter: v } })}
              />
              <label className="ed-field">Point d'entrée (optionnel)
                <input
                  value={route.ambush.entry ?? ''}
                  onChange={(e) => updRoute(route.id, { ambush: { ...route.ambush!, entry: e.target.value || undefined } })}
                />
              </label>
              {route.sea && (
                <label className="ed-field">Ancrage en mer (% de la route, défaut 50 %)
                  <NumberField
                    variant="nu" label="Ancrage en mer (% de la route)" min={0} max={100}
                    value={Math.round((route.ambush.at ?? 0.5) * 100)}
                    onChange={(pct) => updRoute(route.id, { ambush: { ...route.ambush!, at: pct / 100 } })}
                  />
                </label>
              )}
            </>
          )}

          <div className="mini-title">Péripéties d'auteur (tirées chaque jour de voyage)</div>
          {(route.perils ?? []).map((peril, i) => (
            <div key={clesDesPeripeties[i]} className="wme-peril">
              <label className="ed-field">Libellé
                <input
                  value={peril.label}
                  onChange={(e) => updRoute(route.id, { perils: route.perils!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                />
              </label>
              <label className="ed-field">Probabilité par jour (%)
                <NumberField
                  variant="nu" label="Probabilité par jour (%)" min={0} max={100} value={peril.chancePct}
                  onChange={(chancePct) => updRoute(route.id, { perils: route.perils!.map((x, j) => (j === i ? { ...x, chancePct } : x)) })}
                />
              </label>
              <EffectList
                effects={peril.effects}
                ctx={effCtx}
                onChange={(effects) => updRoute(route.id, { perils: route.perils!.map((x, j) => (j === i ? { ...x, effects } : x)) })}
              />
              <button className="btn small" onClick={() => updRoute(route.id, { perils: route.perils!.filter((_, j) => j !== i) })}>
                <Icon id="ui/delete" size="sm" /> Retirer cette péripétie
              </button>
            </div>
          ))}
          <button
            className="btn small"
            onClick={() => updRoute(route.id, { perils: [...(route.perils ?? []), { label: 'Péripétie', chancePct: 10, effects: [] }] })}
          >
            + Péripétie d'auteur
          </button>
        </>
      )}
    </>
  );
}
