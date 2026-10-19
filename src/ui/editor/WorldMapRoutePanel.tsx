/**
 * Panneau ROUTE de l'éditeur de carte du monde (#419) — extrait du monolithe `WorldMapEditor.tsx`
 * (règle 4 AGENTS.md : 4 sections à plat → 2 onglets `Tabs`). « Trajet » (distance/sens/modes/billet/
 * vitesse + maritime), « Péripéties » (embuscade + péripéties d'auteur via EffectList).
 */
import { useState } from 'react';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { Tabs } from '../composites/Tabs';
import { Icon } from '../Icon';
import { NumberField } from '../NumberField';
import { useClesDeRangees } from '../useClesDeRangees';
import { Scene } from '../../state/scene';
import { type WorldMap, type MapRoute, type MapRouteTrace, type Praticabilite, type RouteBillet, placeById } from '../../state/worldMap';
import type { PresetPnj } from '../../state/campaignNarratif';
import type { VehicleData } from '../../engine/types';
import { SourceRefField } from '../SourceRefField';
import { type TravelMode, TRAVEL_DEFAULTS, travelVehicles, travelModeLabels, travelModeIcon } from '../../engine/travel';
import { EffectList, type Ctx } from './EffectList';
import { RefSelect } from './worldMapPickers';
import { WhenEditor } from './ConditionEditor';
import { CouvreField } from './CouvreField';
import { Row } from '../Layout';
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
            narratif={effCtx.narratif}
            onChange={(when) => updRoute(route.id, when ? { when, refus: route.refus ?? { texte: '' } } : { when: undefined, refus: undefined })}
          />
          {route.when && (
            <>
              <ProseField label="Raison du refus" value={route.refus.texte} onChange={(texte) => updRoute(route.id, { when: route.when, refus: { ...route.refus, texte } })} />
              <ProvenanceDuTexte copie identite={`${route.id}/refus`} sujet="du refus de route" value={route.refus} onChange={(patch) => updRoute(route.id, { when: route.when, refus: { ...route.refus, ...patch } })} />
              {!route.refus.texte.trim() && (
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
              <BilletDuVehicule route={route} map={map} vehicule={v} presets={effCtx.narratif?.presetsPnj ?? []} updRoute={updRoute} />
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
            <label className="ed-field">Cap dominant (fixe le vent relatif, MDG 13 l.262-270)
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

/** La route dont le billet en `vehicule` couvre `couverte` dans sa suite — DÉRIVÉE, jamais stockée. */
function routeQuiCouvre(map: WorldMap, couverte: MapRoute, vehicule: string): MapRoute | undefined {
  return map.routes.find((r) => r.billets?.[vehicule]?.suite?.includes(couverte.id));
}

/** Billet d'auteur d'un véhicule sur la route (`RouteBillet`, EDO 01 l.142) : prix par place de chaque
 *  classe, départ, suite, vendeur et paliers du Marchandage, provenance. */
function BilletDuVehicule({ route, map, vehicule, presets, updRoute }: {
  route: MapRoute;
  map: WorldMap;
  vehicule: VehicleData;
  presets: readonly PresetPnj[];
  updRoute: (id: string, patch: Partial<MapRouteTrace>) => void;
}) {
  const v = vehicule.id;
  const classes = vehicule.travel!.classes;
  const billet = route.billets?.[v];
  const couvreuse = routeQuiCouvre(map, route, v);
  const nomDe = (r: MapRoute) => `${placeById(map, r.a)?.label ?? r.a} → ${placeById(map, r.b)?.label ?? r.b}`;
  const poser = (b: RouteBillet | undefined) => updRoute(route.id, { billets: { ...route.billets, [v]: b } });
  const patch = (p: Partial<RouteBillet>) => poser({ ...billet!, ...p });
  const prixDe = (prix: RouteBillet['prix'], onPrix: (prix: RouteBillet['prix']) => void, sujet: string) => classes.map((c) => (
    <label key={c.id} className="ed-field">{vehicule.label} — {c.label} {sujet} (sous par place ; RAW : {c.brassPerKm} sou(s)/km)
      <NumberField
        variant="nu" label={`${vehicule.label} — ${c.label} ${sujet} (sous par place)`} min={0} vide value={prix[c.id]}
        onChange={(n) => onPrix({ ...prix, [c.id]: n ?? undefined })}
      />
    </label>
  ));
  const paliers = billet?.marchandage?.paliers ?? [];
  const clesDesPaliers = useClesDeRangees(billet?.marchandage?.paliers);
  const poserPaliers = (ps: NonNullable<NonNullable<RouteBillet['marchandage']>['paliers']>) =>
    patch({ marchandage: { ...billet!.marchandage!, paliers: ps.length ? ps : undefined } });
  return (
    <>
      {couvreuse && <p className="mini-title">{vehicule.label} : couverte par le billet de {nomDe(couvreuse)}</p>}
      {/* Couverte par la suite d'un autre billet : lecture seule pour ce véhicule (`worldMapSchema` refuse le chevauchement). */}
      {(!couvreuse || billet) && (
        <label className="ed-check">
          <input type="checkbox" checked={!!billet} onChange={(e) => poser(e.target.checked ? { prix: {} } : undefined)} />
          {vehicule.label} — billet d'auteur (sinon : tarif RAW au km)
        </label>
      )}
      {billet && (
        <div className="wme-peril">
          {prixDe(billet.prix, (prix) => patch({ prix }), 'billet')}
          {route.from == null && (
            <label className="ed-field">{vehicule.label} — billet au départ de
              <select value={billet.depuis ?? ''} onChange={(e) => patch({ depuis: e.target.value || undefined })}>
                <option value="">— choisir —</option>
                <option value={route.a}>{placeById(map, route.a)?.label ?? route.a}</option>
                <option value={route.b}>{placeById(map, route.b)?.label ?? route.b}</option>
              </select>
            </label>
          )}
          <div className="mini-title">Routes suivantes couvertes par le billet</div>
          {(billet.suite ?? []).map((id, i) => {
            const r = map.routes.find((x) => x.id === id);
            return (
              <Row key={id} justify="start">
                <span>{r ? nomDe(r) : id}</span>
                <button className="btn small" onClick={() => { const suite = billet.suite!.filter((_, j) => j !== i); patch({ suite: suite.length ? suite : undefined }); }}>
                  <Icon id="ui/delete" size="sm" /> Retirer
                </button>
              </Row>
            );
          })}
          <RefSelect
            label={`${vehicule.label} — ajouter une route à la suite du billet`}
            options={map.routes.filter((r) => r.id !== route.id && !billet.suite?.includes(r.id) && r.modes.includes(v))}
            getId={(r) => r.id}
            getLabel={nomDe}
            value=""
            nullableLabel="— aucune —"
            onChange={(id) => id && patch({ suite: [...(billet.suite ?? []), id] })}
          />
          <RefSelect
            label={`${vehicule.label} — vendeur du billet (Marchandage)`}
            options={presets}
            getId={(p) => p.id}
            getLabel={(p) => p.profil?.label ?? p.id}
            value={billet.marchandage?.presetId ?? ''}
            nullableLabel="— non marchandable —"
            onChange={(presetId) => patch({ marchandage: presetId ? { ...billet.marchandage, presetId } : undefined })}
          />
          {billet.marchandage && (
            <>
              <div className="mini-title">Paliers du Marchandage gagné (sinon : remise RAW)</div>
              {paliers.map((pa, i) => (
                <div key={clesDesPaliers[i]} className="wme-peril">
                  <label className="ed-field">Palier {i + 1} — DR net minimal
                    <NumberField
                      variant="nu" label={`${vehicule.label} — palier ${i + 1}, DR net minimal`} min={0} value={pa.drMin}
                      onChange={(drMin) => poserPaliers(paliers.map((x, j) => (j === i ? { ...x, drMin } : x)))}
                    />
                  </label>
                  {prixDe(pa.prix, (prix) => poserPaliers(paliers.map((x, j) => (j === i ? { ...x, prix } : x))), `palier ${i + 1}`)}
                  <button className="btn small" onClick={() => poserPaliers(paliers.filter((_, j) => j !== i))}>
                    <Icon id="ui/delete" size="sm" /> Retirer ce palier
                  </button>
                </div>
              ))}
              <button className="btn small" onClick={() => poserPaliers([...paliers, { drMin: 0, prix: {} }])}>+ Palier</button>
            </>
          )}
          <SourceRefField
            identite={`${route.id}/billets/${v}/source`} label="Source du billet" facultative sujet={`du billet ${vehicule.label}`}
            value={billet.source} onChange={(source) => patch({ source })}
          />
          <label className="ed-field">{vehicule.label} — raison maison du billet (sans source)
            <input value={billet.maison ?? ''} onChange={(e) => patch({ maison: e.target.value || undefined })} />
          </label>
          {!billet.source && !billet.maison && (
            <ChipDeRefus fixe refus={{ message: 'Provenance exigée : la source du billet, ou sa raison maison ; sans elle le projet est refusé au chargement.' }} />
          )}
        </div>
      )}
    </>
  );
}
