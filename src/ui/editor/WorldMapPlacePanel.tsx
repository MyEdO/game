/**
 * Panneau LIEU de l'éditeur de carte du monde (#419) — extrait du monolithe `WorldMapEditor.tsx`
 * (règle 4 AGENTS.md : 5 sections à plat → 3 onglets `Tabs`). « Lieu » (identité + services),
 * « Commerce » (Marché terrestre + Port maritime, même famille négoce), « Plan du hub » (POI, déjà
 * un sous-écran de fait). Zéro logique métier déplacée : découpage JSX pur, coutures runtime intactes.
 */
import { useState } from 'react';
import { Tabs } from '../composites/Tabs';
import { Icon, IconG } from '../Icon';
import { Prose } from '../Prose';
import { NumberField } from '../NumberField';
import { MapCanvas } from '../MapCanvas';
import { planChrome } from '../PlanChrome';
import { VB_W, VB_H } from '../worldMapViewport';
import { Scene } from '../../noyau/monde/scene';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { type MapPlace, type MarcheDAuteur, type PlacePoi, resolvePortRef, placeServices, poiIcon, nomDuPoi } from '../../noyau/worldMap';
import { landMarketProfileSchema, LIBELLES_DE_TAILLE, mapPlaceSchema } from '../../data/schemas/defs-scenes/worldmap';
import { signalDuPortSchema, type SignalDuPort } from '../../data/schemas/defs/naval-ports';
import { optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import {
  etablissementAjoute,
  etablissementRetire,
  marcheNeuf,
  portNeuf,
  refusDeRetirerLEtablissement,
  typesDEtablissement,
  type PatchDeLieu,
} from '../../noyau/worldMapEdit';
import { LAND_RICHESSE_ROWS, VOIE_TERRESTRE } from '../../engine/landCargo';
import { VOIE_MARITIME, type PortProfile } from '../../engine/seaVoyage';
import { CARGO_ENTRIES, isEchangeable, marchandisesDe, type Voie } from '../../engine/cargo';
import { navalPorts, findNavalPortById } from '../../data';
import { IconField, BackdropField, RefSelect } from './worldMapPickers';
import { WhenEditor } from './ConditionEditor';
import { CouvreField } from './CouvreField';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/grammaire/campagne';
import { idDEntropie } from '../../hote/entropie';

/** Options d'un indice de Taille (`LIBELLES_DE_TAILLE`). MSRC 13 l.44-50 */
const optionsDeTaille = () => Object.entries(LIBELLES_DE_TAILLE).map(([n, label]) => <option key={n} value={n}>{n} — {label}</option>);
/** Options de la colonne Produits/Production : TOUT le vocabulaire de la voie au catalogue (marchandises
 *  ET marqueurs). Un marqueur porte son qualificatif `hint` EN DONNÉE (« plaque tournante » / « rien à
 *  échanger ») — l'écran le rend entre parenthèses, il ne l'écrit pas. */
const produitOptions = (voie: Voie): { id: string; label: string }[] =>
  CARGO_ENTRIES.filter((c) => c.voie === voie).map((c) => ({ id: c.id, label: !isEchangeable(c) && c.hint ? `${c.label} (${c.hint})` : c.label }));

export function WorldMapPlacePanel({ place, scenes, narratif, updPlace }: {
  place: MapPlace;
  /** Toutes les scènes du projet (active + réserve) — pour lier lieux/POI. */
  scenes: Scene[];
  /** Narratif du projet — les états de campagne qu'un `when` de lieu peut lire. */
  narratif: NarratifBlock;
  updPlace: (id: string, patch: PatchDeLieu) => void;
}) {
  const [placeTab, setPlaceTab] = useState<'lieu' | 'commerce' | 'plan'>('lieu');
  const [poiSel, setPoiSel] = useState<string | null>(null);
  const [refusDeRetrait, setRefusDeRetrait] = useState<{ lieu: string; texte: string } | null>(null);

  return (
    <>
      <Tabs
        tabs={[{ key: 'lieu', label: 'Lieu' }, { key: 'commerce', label: 'Commerce' }, { key: 'plan', label: 'Plan du hub' }]}
        active={placeTab}
        onChange={setPlaceTab}
        label="Onglets du lieu"
      />
      {placeTab === 'lieu' && (
        <>
          <div className="mini-title">Lieu</div>
          <label className="ed-field">Nom
            <input value={place.label} onChange={(e) => updPlace(place.id, { label: e.target.value })} />
          </label>
          <IconField label="Icône" value={place.icon} onChange={(icon) => updPlace(place.id, { icon })} />
          <BackdropField label="Fond d'ambiance" value={place.backdrop?.id} onChange={(id) => {
            const fond = mapPlaceSchema.shape.backdrop.safeParse(id === undefined ? undefined : { id });
            if (fond.success) updPlace(place.id, { backdrop: fond.data });
          }} />
          <ProseField label="Description" value={place.prose ?? ''} onChange={(prose) => updPlace(place.id, prose.trim() ? { prose } : { prose: undefined, source: undefined, adapteDe: undefined })} />
          {place.prose && <ProvenanceDuTexte copie identite={`${place.id}/description`} sujet="de la description du lieu" value={place} onChange={(patch) => updPlace(place.id, patch)} />}
          <RefSelect
            label="Scène liée"
            options={scenes}
            getId={(s) => s.id}
            getLabel={(s) => `${s.label} (${s.id})`}
            value={place.scene.id}
            onChange={(v) => updPlace(place.id, { scene: { id: v } })}
          />
          {/* Cible = un point nommé des `entryPoints` de la scène liée (sinon heroStart). */}
          <label className="ed-field">Point d'entrée (optionnel)
            <input value={place.entry ?? ''} onChange={(e) => updPlace(place.id, { entry: e.target.value || undefined })} />
          </label>
          <CouvreField value={place.couvre} sujet="du lieu" onChange={(couvre) => updPlace(place.id, { couvre })} />
          {/* Un lieu à port tient sa taille de son port (`tailleDuLieu`). */}
          {!place.port && (
            <label className="ed-field">Taille de la communauté (l.44-50)
              <select value={place.taille ?? ''} onChange={(e) => updPlace(place.id, { taille: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">— aucune (hors agglomération) —</option>
                {optionsDeTaille()}
              </select>
            </label>
          )}

          <div className="mini-title" title="Le lieu n'existe sur la carte qu'une fois la condition vraie : ni médaillon, ni route, ni voyage vers lui. « Toujours » = lieu toujours visible.">Visible si</div>
          <WhenEditor when={place.when} kinds={CONDITION_KINDS_CARTE} narratif={narratif} onChange={(when) => updPlace(place.id, { when })} />

          {/* ── Services du lieu (auberge/temple/forgeron/guilde…, catalogue lieux-services.json #343) ── */}
          <div className="mini-title">Services du lieu</div>
          {typesDEtablissement().map((sv) => {
            const deCeType = (place.services ?? []).filter((s) => s.kind.id === sv.id);
            const has = deCeType.length > 0;
            return (
              <label
                key={sv.id}
                className="ed-check"
                title={sv.editorNote}
              >
                <input
                  type="checkbox"
                  checked={has}
                  onChange={() => {
                    setRefusDeRetrait(null);
                    if (!has) return updPlace(place.id, etablissementAjoute(place, sv.id));
                    const refus = deCeType.map((e) => refusDeRetirerLEtablissement(place, e.id)).find((r) => r !== undefined);
                    if (refus) return setRefusDeRetrait({ lieu: place.id, texte: refus });
                    const retire = deCeType.reduce<MapPlace | undefined>((lieu, e) => {
                      const patch = lieu && etablissementRetire(lieu, e.id);
                      return patch && { ...lieu, ...patch };
                    }, place);
                    if (retire) updPlace(place.id, { services: retire.services });
                  }}
                />
                {sv.icon && <Icon id={sv.icon} size="sm" />} {sv.label}
              </label>
            );
          })}
          {refusDeRetrait?.lieu === place.id && <p className="hint" role="alert">{refusDeRetrait.texte}</p>}
        </>
      )}
      {placeTab === 'commerce' && (
        <>
          {/* ── Marché de cargaison (Mort sur le Reik Compagnon ch.11) : Taille + Richesse + Produits ── */}
          <div className="mini-title">Marché</div>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={!!place.market}
              onChange={(e) => updPlace(place.id, { market: e.target.checked ? marcheNeuf() : undefined })}
            />
            <Icon id="marchand/panier" size="sm" /> Lieu de commerce (achat/vente de cargaison)
          </label>
          {place.market && (() => {
            const mk = place.market;
            const updMarket = (patch: Partial<MarcheDAuteur>) => updPlace(place.id, { market: { ...mk, ...patch } });
            return (
              <>
                <label className="ed-field">Indice de richesse — Mise à prix (l.52-60, l.150-156)
                  <select value={mk.richesse} onChange={(e) => updMarket({ richesse: Number(e.target.value) })}>
                    {LAND_RICHESSE_ROWS.map((r) => (
                      <option key={r.min} value={r.min}>{r.min} — {r.label} ({r.pct >= 0 ? '+' : ''}{r.pct} %)</option>
                    ))}
                  </select>
                </label>
                <div className="mini-title">Produits (colonne Produits, l.24-28)</div>
                {produitOptions(VOIE_TERRESTRE).map((p) => {
                  const id = landMarketProfileSchema.shape.produits.element.parse(p.id);
                  const choisi = mk.produits.includes(id);
                  return (
                    <label key={id} className="ed-check">
                      <input type="checkbox" checked={choisi} onChange={() => updMarket({
                        produits: choisi ? mk.produits.filter((x) => x !== id) : [...mk.produits, id],
                      })} />
                      {p.label}
                    </label>
                  );
                })}
                <label className="ed-field">Vin supérieur : bonus de qualité (échelons, l.95 — Kemperbad : 2)
                  <NumberField
                    variant="nu" label="Vin supérieur : bonus de qualité (échelons)" min={0} max={5} placeholder="0"
                    vide value={mk.wineBonusEchelons}
                    onChange={(n) => updMarket({ wineBonusEchelons: n ?? undefined })}
                  />
                </label>
              </>
            );
          })()}

          {/* ── Port maritime (Index des ports, MDG 15) : Taille + Richesse + Production/Surplus/Demande ── */}
          <div className="mini-title">Port maritime</div>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={!!place.port}
              onChange={(e) => updPlace(place.id, e.target.checked ? { port: portNeuf(), taille: undefined } : { port: undefined })}
            />
            <Icon id="voyage/ancre" size="sm" /> Port maritime (accostage, commerce, chantier)
          </label>
          {place.port && (() => {
            const pt = place.port;
            const updPort = (patch: Partial<PortProfile>) =>
              updPlace(place.id, { port: { ...pt, ...patch } });
            // Bascule d'une clé d'un Record<id, indice> (Surplus/Demande) : cocher = indice 1, décocher = retirer la clé.
            const toggleTable = (key: 'surplus' | 'demande', id: string) => {
              const tbl = { ...(pt[key] ?? {}) };
              if (id in tbl) delete tbl[id]; else tbl[id] = 1;
              updPort({ [key]: Object.keys(tbl).length ? tbl : undefined });
            };
            const setTableLevel = (key: 'surplus' | 'demande', id: string, lvl: number) =>
              updPort({ [key]: { ...(pt[key] ?? {}), [id]: Math.max(1, lvl) } });
            return (
              <>
                <RefSelect
                  label="Port du catalogue (Index des ports, #217 — optionnel)"
                  options={navalPorts}
                  getId={(p) => p.id}
                  getLabel={(p) => `${p.label} (${p.region})`}
                  value={pt.ref ?? ''}
                  nullableLabel="— aucun (port d'auteur) —"
                  onChange={(ref) => {
                    if (!ref) { updPlace(place.id, { port: { ...pt, ref: undefined } }); return; }
                    // Choisir une réf REMPLACE le profil par celui du catalogue — pas les défauts
                    // d'auteur pré-résolution (#217).
                    const resolved = resolvePortRef({ ref });
                    updPlace(place.id, { port: resolved });
                  }}
                />
                {pt.ref && (() => {
                  const def = findNavalPortById(pt.ref);
                  return def ? (
                    <div className="ed-hint">
                      Résolu du catalogue : Taille {def.taille}, Richesse {def.richesse}
                      {def.dirigeant ? ` — ${def.dirigeant}` : ''}
                      {def.desc ? <> — <Prose md={def.desc} porteur={{ type: 'navalPorts', id: def.id, chemin: 'desc' }} /></> : null}
                    </div>
                  ) : null;
                })()}
                <label className="ed-field">Taille du port (1-4, l.439-506)
                  <select value={pt.taille} onChange={(e) => updPort({ taille: Number(e.target.value) })}>
                    {optionsDeTaille()}
                  </select>
                </label>
                <label className="ed-field">Richesse du port
                  <select value={pt.richesse} onChange={(e) => updPort({ richesse: Number(e.target.value) })}>
                    {LAND_RICHESSE_ROWS.map((r) => (
                      <option key={r.min} value={r.min}>{r.min} — {r.label}</option>
                    ))}
                  </select>
                </label>
                <label className="ed-check">
                  <input type="checkbox" checked={!!pt.cosmopolite} onChange={(e) => updPort({ cosmopolite: e.target.checked || undefined })} />
                  <Icon id="voyage/cosmopolite" size="sm" /> Grand port cosmopolite (Marienburg/Lothern, l.343 — marchands supérieurs)
                </label>
                <label className="ed-field"><Icon id="voyage/phare" size="sm" /> Signal du port (repérage à l'atterrage, MDG 13 l.333-351)
                  <select value={pt.signal ?? ''} onChange={(e) => updPort({ signal: e.target.value ? e.target.value as SignalDuPort : undefined })}>
                    <option value="">— aucun —</option>
                    {optionsDuNoeud(signalDuPortSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <div className="mini-title">Production (colonne Produits de l'Index)</div>
                {produitOptions(VOIE_MARITIME).map((p) => (
                  <label key={p.id} className="ed-check">
                    <input
                      type="checkbox"
                      checked={pt.production.includes(p.id)}
                      onChange={() => updPort({ production: pt.production.includes(p.id) ? pt.production.filter((x) => x !== p.id) : [...pt.production, p.id] })}
                    />
                    {p.label}
                  </label>
                ))}
                <div className="mini-title">Surplus (le port en regorge → vente locale facilitée)</div>
                {marchandisesDe(VOIE_MARITIME).map((c) => (
                  <label key={c.id} className="ed-check">
                    <input type="checkbox" checked={c.id in (pt.surplus ?? {})} onChange={() => toggleTable('surplus', c.id)} />
                    {c.label}
                    {c.id in (pt.surplus ?? {}) && (
                      <NumberField
                        variant="nu" label={`Surplus — ${c.label} (niveau)`} min={1} max={3} width="3.2em"
                        value={pt.surplus![c.id]}
                        onChange={(n) => setTableLevel('surplus', c.id, n)}
                      />
                    )}
                  </label>
                ))}
                <div className="mini-title">Demande (le port en manque → meilleur prix d'offre)</div>
                {marchandisesDe(VOIE_MARITIME).map((c) => (
                  <label key={c.id} className="ed-check">
                    <input type="checkbox" checked={c.id in (pt.demande ?? {})} onChange={() => toggleTable('demande', c.id)} />
                    {c.label}
                    {c.id in (pt.demande ?? {}) && (
                      <NumberField
                        variant="nu" label={`Demande — ${c.label} (niveau)`} min={1} max={3} width="3.2em"
                        value={pt.demande![c.id]}
                        onChange={(n) => setTableLevel('demande', c.id, n)}
                      />
                    )}
                  </label>
                ))}
              </>
            );
          })()}
        </>
      )}
      {placeTab === 'plan' && (
        <>
          {/* ── POI du plan de ce lieu (onglet Plan du hub, #345 phase 5) ── */}
          <div className="mini-title">Points d'intérêt du plan (onglet Plan du hub)</div>
          {(() => {
            const poiList = place.poi ?? [];
            const activePoiId = poiList.some((p) => p.id === poiSel) ? poiSel : null;
            const services = placeServices(place);
            const updPoi = (id: string, f: (x: PlacePoi) => PlacePoi) =>
              updPlace(place.id, { poi: poiList.map((x) => (x.id === id ? f(x) : x)) });
            return (
              <>
                {poiList.map((poi) => (
                  <div key={poi.id} className={`wme-poi${activePoiId === poi.id ? ' active' : ''}`}>
                    {poi.sceneId != null && (
                      <label className="ed-field">Libellé
                        <input value={poi.label} onChange={(e) => updPoi(poi.id, (x) => (x.sceneId ? { ...x, label: e.target.value } : x))} />
                      </label>
                    )}
                    <IconField label="Icône" value={poi.icon} onChange={(icon) => updPoi(poi.id, (x) => ({ ...x, icon }))} />
                    <label className="ed-field">Cible (scène OU service, exclusif)
                      <select
                        value={poi.sceneId != null ? 'scene' : 'service'}
                        onChange={(e) => {
                          const { id, pos, icon } = poi;
                          if (e.target.value === 'scene') updPoi(poi.id, (x) => ({ id, pos, icon, label: nomDuPoi(x, services), sceneId: { id: scenes[0]?.id ?? '' } }));
                          else updPoi(poi.id, () => ({ id, pos, icon, service: { id: services[0]?.id ?? '' } }));
                        }}
                      >
                        <option value="scene">Scène du projet</option>
                        <option value="service">Service du lieu</option>
                      </select>
                    </label>
                    {poi.sceneId != null && (
                      <RefSelect
                        label="Scène"
                        options={scenes}
                        getId={(s) => s.id}
                        getLabel={(s) => `${s.label} (${s.id})`}
                        value={poi.sceneId.id}
                        onChange={(v) => updPoi(poi.id, (x) => (x.sceneId ? { ...x, sceneId: { id: v } } : x))}
                      />
                    )}
                    {poi.service != null && (
                      <RefSelect
                        label="Service"
                        options={services}
                        getId={(sv) => sv.id}
                        getLabel={(sv) => sv.label}
                        value={poi.service.id}
                        onChange={(v) => updPoi(poi.id, (x) => (x.service ? { ...x, service: { id: v } } : x))}
                      />
                    )}
                    <div className="bar">
                      <button
                        type="button"
                        className="btn small"
                        aria-pressed={activePoiId === poi.id}
                        onClick={() => setPoiSel(activePoiId === poi.id ? null : poi.id)}
                      >
                        {activePoiId === poi.id ? 'Cliquez le plan pour placer…' : 'Placer sur le plan'}
                      </button>
                      <button type="button" className="btn small" onClick={() => { const next = poiList.filter((x) => x.id !== poi.id); updPlace(place.id, { poi: next.length ? next : undefined }); if (activePoiId === poi.id) setPoiSel(null); }}>
                        <Icon id="interface/supprimer" size="sm" /> Retirer ce POI
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    const id = idDEntropie('poi');
                    const p: PlacePoi = { id, label: 'Nouveau point', pos: { x: 50, y: 50 }, sceneId: { id: scenes[0]?.id ?? '' } };
                    updPlace(place.id, { poi: [...poiList, p] });
                    setPoiSel(id);
                  }}
                >
                  + Point d'intérêt
                </button>
                <div className="wme-poi-plan">
                  <MapCanvas
                    ariaLabel="Aperçu de placement des POI"
                    computeFit={() => ({ z: 1, panX: 0, panY: 0 })}
                    chrome={planChrome(place.label)}
                    markers={poiList.map((poi) => ({
                      id: poi.id,
                      x: poi.pos.x,
                      y: poi.pos.y * (VB_H / 100),
                      selected: activePoiId === poi.id,
                      cursor: 'default',
                      children: (
                        <>
                          <circle r="1.5" fill="var(--wm-badge-bg)" stroke="var(--wm-age-spot)" strokeWidth="0.22" />
                          <g style={{ color: 'var(--wm-marker-icon)' }}>
                            {/* Aperçu TRUTHFUL : même résolution d'icône par cible que le hub joueur (#371). */}
                            <IconG id={poiIcon(poi, services)} x={-1.05} y={-1.05} size={2.1} />
                          </g>
                        </>
                      ),
                    }))}
                    onBackgroundClick={activePoiId ? (p) => {
                      const pos = { x: Math.round((p.x / VB_W) * 100), y: Math.round((p.y / VB_H) * 100) };
                      updPoi(activePoiId, (x) => ({ ...x, pos }));
                    } : undefined}
                  />
                  <p className="hint">{activePoiId ? 'Cliquez le plan pour placer le POI sélectionné.' : 'Sélectionnez « Placer sur le plan » sur un POI, puis cliquez ce plan.'}</p>
                </div>
              </>
            );
          })()}
        </>
      )}
    </>
  );
}
