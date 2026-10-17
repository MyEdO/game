/**
 * Panneau ROUTE de l'éditeur de carte du monde (#419) — extrait du monolithe `WorldMapEditor.tsx`
 * (règle 4 CLAUDE.md : 4 sections à plat → 2 onglets `Tabs`). « Trajet » (distance/sens/modes/prix/
 * vitesse + maritime), « Péripéties » (embuscade + péripéties d'auteur via EffectList).
 */
import { useState } from 'react';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { Tabs } from '../Tabs';
import { Icon } from '../Icon';
import { NumberField } from '../NumberField';
import { useClesDeRangees } from '../useClesDeRangees';
import { Scene } from '../../state/scene';
import { type WorldMap, type MapRoute, type MapRouteTrace, type Praticabilite, placeById, libelleDeRoute } from '../../state/worldMap';
import { type TravelMode, TRAVEL_DEFAULTS, travelVehicles, travelModeLabels, travelModeIcon } from '../../engine/travel';
import { EffectList, type Ctx } from './EffectList';
import { RefSelect } from './worldMapPickers';
import { WhenEditor } from './ConditionEditor';
import { CouvreField } from './CouvreField';
import { ChipDeRefus } from '../ChipDeRefus';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/defs-scenes/worldmap';
import { SourceRefField } from '../SourceRefField';
import { billetImplicite, parcoursDuBillet } from '../../engine/travel';
import { routesCouvertes } from '../../state/billetFlow';
import type { RouteBillet } from '../../state/worldMap';
import type { VehicleData } from '../../engine/types';
import { fromBrass } from '../../engine/money';
import { Coins } from '../Coins';

/** Prix par classe, la classe vidée en sort (une classe absente n'est pas offerte). */
function avecPrix(prix: Record<string, number>, classeId: string, n: number | null | undefined): Record<string, number> {
  const { [classeId]: _retire, ...reste } = prix;
  return n == null ? reste : { ...reste, [classeId]: n };
}

/** Prix saisi en SOUS, sa valeur en monnaie impériale à côté (`Coins`) : 48 se lit « 4/– ». */
function PrixEnSous({ label, value, onChange }: { label: string; value: number | undefined; onChange: (n: number | null | undefined) => void }) {
  return (
    <>
      <NumberField variant="nu" label={label} min={0} vide value={value} onChange={onChange} />
      {value != null && <Coins money={fromBrass(value)} />}
    </>
  );
}

/** BILLET d'auteur d'un véhicule sur la route (`MapRoute.billets`, EDO 01 l.142) : prix par classe, routes
 *  suivantes (offertes contiguës seulement, `parcoursDuBillet`), départ d'une route à double sens, vendeur
 *  et paliers de Marchandage, provenance. Route couverte par le billet d'une AUTRE route : lecture seule. */
function BilletDeRoute({ route, map, vehicule, presets, updRoute }: {
  route: MapRoute;
  map: WorldMap;
  vehicule: VehicleData;
  presets: readonly { id: string; profil?: { label?: string } }[];
  updRoute: (id: string, patch: Partial<MapRouteTrace>) => void;
}) {
  const v = vehicule.id;
  const billet = route.billets?.[v];
  const classes = vehicule.travel!.classes;
  const porteur = routesCouvertes(map).get(route.id);
  const ecrire = (b: RouteBillet | undefined) => updRoute(route.id, { billets: { ...route.billets, [v]: b } });
  const maj = (patch: Partial<RouteBillet>) => billet && ecrire({ ...billet, ...patch });
  if (!billet) {
    const implicite = billetImplicite(route.km, v);
    return (
      <div className="ed-field">
        {porteur
          ? <span>{vehicule.label} — couverte par le billet de « {libelleDeRoute(map, porteur)} »</span>
          : implicite && (
            <button className="btn small" onClick={() => ecrire({ prix: { ...implicite.prix } })}>
              + Billet de passage ({vehicule.label})
            </button>
          )}
      </div>
    );
  }
  const depart = route.from ?? billet.depuis;
  const suite = billet.suite ?? [];
  const parcours = parcoursDuBillet(map.routes, route, depart, suite, v);
  const arrivee = parcours.ok ? parcours.arrivee : undefined;
  const suivantes = parcours.ok ? map.routes.filter((r) => parcoursDuBillet(map.routes, route, depart, [...suite, r.id], v).ok) : [];
  const paliers = billet.paliers ?? [];
  return (
    <div className="panel sunken">
      <div className="mini-title">{vehicule.label} — billet de passage (forfait par passager, en sous)</div>
      {classes.map((c) => (
        <label key={c.id} className="ed-field">{c.label}
          <PrixEnSous label={`${vehicule.label} — ${c.label} (sous)`} value={billet.prix[c.id]}
            onChange={(n) => maj({ prix: avecPrix(billet.prix, c.id, n) })} />
        </label>
      ))}
      {route.from == null && (
        <RefSelect label="Départ du billet (route à double sens)" options={[route.a, route.b]} getId={(id) => id} getLabel={(id) => placeById(map, id)?.label ?? id}
          value={billet.depuis ?? ''} nullableLabel="— choisir —" onChange={(id) => maj({ depuis: id || undefined })} />
      )}
      <div className="mini-title">Routes suivantes couvertes{arrivee ? ` (arrivée : ${placeById(map, arrivee)?.label ?? arrivee})` : ''}</div>
      {suite.map((id, i) => (
        <div key={id} className="ed-field">{libelleDeRoute(map, id)}
          <button className="btn small" onClick={() => maj({ suite: suite.slice(0, i) })}><Icon id="ui/delete" size="sm" /> Retirer (et les suivantes)</button>
        </div>
      ))}
      {suivantes.length > 0 && (
        <RefSelect label="Ajouter la route suivante" options={suivantes} getId={(r) => r.id} getLabel={(r) => libelleDeRoute(map, r.id)} value="" nullableLabel="— aucune —"
          onChange={(id) => id && maj({ suite: [...suite, id] })} />
      )}
      <RefSelect label="Vendeur (Marchandage, PNJ précomposé)" options={presets} getId={(p) => p.id} getLabel={(p) => p.profil?.label ?? p.id}
        value={billet.presetId ?? ''} nullableLabel="— prix fixe —"
        onChange={(id) => maj(id ? { presetId: id } : { presetId: undefined, paliers: undefined })} />
      {billet.presetId && (
        <>
          {paliers.map((pal, i) => (
            <div key={i} className="panel">
              <div className="mini-title">Palier : DR net ≥ {pal.drMin}</div>
              <label className="ed-field">DR net minimal
                <NumberField variant="nu" label={`Palier ${i + 1} : DR net minimal`} min={0} value={pal.drMin}
                  onChange={(drMin) => maj({ paliers: paliers.map((x, j) => (j === i ? { ...x, drMin } : x)) })} />
              </label>
              {classes.map((c) => (
                <label key={c.id} className="ed-field">{c.label}
                  <PrixEnSous label={`Palier ${i + 1} : ${c.label} (sous)`} value={pal.prix[c.id]}
                    onChange={(n) => maj({ paliers: paliers.map((x, j) => (j === i ? { ...x, prix: avecPrix(x.prix, c.id, n) } : x)) })} />
                </label>
              ))}
              <button className="btn small" onClick={() => { const reste = paliers.filter((_, j) => j !== i); maj({ paliers: reste.length ? reste : undefined }); }}><Icon id="ui/delete" size="sm" /> Retirer ce palier</button>
            </div>
          ))}
          <button className="btn small" onClick={() => maj({ paliers: [...paliers, { drMin: 0, prix: { ...billet.prix } }] })}>
            + Palier
          </button>
          {paliers.length === 0 && <div className="ed-hint">Sans palier, un Marchandage gagné applique la remise de Marchandage.</div>}
        </>
      )}
      <SourceRefField identite={`${route.id}/billets/${v}/source`} label="Source du billet" facultative value={billet.source}
        onChange={(source) => maj({ source, ...(source ? { maison: undefined } : {}) })} />
      {!billet.source && (
        <label className="ed-field">Raison maison (sans source)
          <input value={billet.maison ?? ''} onChange={(e) => maj({ maison: e.target.value || undefined })} />
        </label>
      )}
      {!billet.source && !billet.maison && <ChipDeRefus fixe refus={{ message: 'Provenance exigée : une source, ou la raison maison du billet.' }} />}
      {!parcours.ok && <ChipDeRefus fixe refus={{ message: parcours.raison }} />}
      <button className="btn small" onClick={() => ecrire(undefined)}><Icon id="ui/delete" size="sm" /> Retirer le billet</button>
    </div>
  );
}

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
            Route : {libelleDeRoute(map, route.id)}
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
              <BilletDeRoute route={route} map={map} vehicule={v} presets={effCtx.narratif?.presetsPnj ?? []} updRoute={updRoute} />
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
