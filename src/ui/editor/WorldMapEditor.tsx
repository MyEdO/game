import { useRef, useState } from 'react';
import { Scene } from '../../noyau/monde/scene';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { effectCtxOf } from './EffectList';
import { WorldMap, emptyWorldMap, placeById } from '../../noyau/worldMap';
import { ajouterLieu, basculerMode, lierLieux, majCarte, majLieu, majRoute, supprimerLieu, supprimerRoute, type PatchDeCarte, type PatchDeLieu, type PatchDeRoute } from '../../noyau/worldMapEdit';
import { TravelMode, TRAVEL_DEFAULTS } from '../../engine/travel';
import { allAxes, coreAxisIds } from '../../data';
import { Icon, IconG } from '../Icon';
import { ICON_DEFS } from '../../data/icons';
import { ScreenShell } from '../ScreenShell';
import { planChrome } from '../PlanChrome';
import { NumberField } from '../NumberField';
import { WorldMapPlacePanel } from './WorldMapPlacePanel';
import { WorldMapRoutePanel } from './WorldMapRoutePanel';
import { idDEntropie } from '../../hote/entropie';

/**
 * Éditeur de la CARTE DU MONDE (#T2 Voyage) — overlay plein écran de l'éditeur de niveau.
 * Tout le voyage y est PARAMÉTRABLE (exigence) : lieux (position par glisser, scène liée, entrée,
 * icône), routes (km, modes, prix par mode, vitesse d'auteur, seuil d10 de péripétie, péripéties
 * d'auteur via EffectList, cible d'embuscade), paramètres de carte (heures/jour, marche forcée,
 * seuil d10 par défaut). Défauts = valeurs RAW citées dans `engine/travel.ts`. Panneaux Lieu/Route
 * découpés en `WorldMapPlacePanel`/`WorldMapRoutePanel` (#419 — règle 4 : onglets, jamais 5 sections
 * empilées).
 */
export function WorldMapEditor({ map, setMap, scenes, narratif, onClose, activeAxes, setActiveAxes }: {
  map: WorldMap | null;
  setMap: (m: WorldMap | null) => void;
  /** Toutes les scènes du projet (active + réserve) — pour lier lieux/embuscades. */
  scenes: Scene[];
  /** Narratif du projet — ce que désignent les références narratives des péripéties (`Ctx.narratif`). */
  narratif: NarratifBlock;
  onClose: () => void;
  /** Axes de forces/faiblesses ACTIFS du PROJET (#409, `ProjectDoc.activeAxes`) — `undefined` =
   *  socle de base (`coreAxisIds`). Propriété PROJET réglée ici, dans l'éditeur de carte du monde
   *  (la surface d'authoring de la campagne). */
  activeAxes?: string[];
  setActiveAxes?: (ids: string[] | undefined) => void;
}) {
  const [carteNeuve] = useState(() => emptyWorldMap(idDEntropie('carte')));
  const m: WorldMap = map ?? carteNeuve;
  const [sel, setSel] = useState<{ kind: 'place' | 'route'; id: string } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<string | null>(null); // lieu en cours de glisser (ref : voir « Pièges connus »)
  // Nom réellement authoré ? Un `map` déjà présent au montage (chargé, donc déjà nommé) OU une
  // saisie faite dans le champ Nom CETTE session valent nommage — jamais une comparaison au texte
  // par défaut (« Carte du monde », #142) : un auteur qui choisirait littéralement ce nom ne serait
  // plus confondu avec une carte jamais renommée.
  const [named, setNamed] = useState(() => map !== null);

  const upd = (patch: PatchDeCarte) => setMap(majCarte(m, patch));
  const updPlace = (id: string, patch: PatchDeLieu) => setMap(majLieu(m, id, patch));
  const updRoute = (id: string, patch: PatchDeRoute) => setMap(majRoute(m, id, patch));

  /** Point écran → coordonnées carte en % du canvas (rendu y × 0,64) ; l'écrivain les borne. */
  const toMapPos = (ev: React.PointerEvent | React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 };
  };

  const addPlace = (pos: { x: number; y: number }) => {
    const id = idDEntropie('lieu');
    setMap(ajouterLieu(m, id, pos, scenes));
    setSel({ kind: 'place', id });
  };

  const clickPlace = (id: string) => {
    if (linkFrom && linkFrom !== id) {
      // Mode liaison : 2ᵉ lieu cliqué → route, sauf refus de l'écrivain.
      const routeId = idDEntropie('trajet');
      const next = lierLieux(m, routeId, linkFrom, id);
      if (next !== m) {
        setMap(next);
        setSel({ kind: 'route', id: routeId });
      }
      setLinkFrom(null);
      return;
    }
    setSel({ kind: 'place', id });
  };

  const deleteSelected = () => {
    if (!sel) return;
    setMap(sel.kind === 'place' ? supprimerLieu(m, sel.id) : supprimerRoute(m, sel.id));
    setSel(null);
  };

  const selPlace = sel?.kind === 'place' ? m.places.find((p) => p.id === sel.id) : undefined;
  const selRoute = sel?.kind === 'route' ? m.routes.find((r) => r.id === sel.id) : undefined;
  // Contexte des effets de péripétie : racine de projet SANS scène éditée (le marchand, lié à la scène
  // COURANTE au moment du voyage, reste un id libre).
  const effCtx = effectCtxOf({ scenes, worldMap: m, narratif });

  const toggleMode = (routeId: string, mode: TravelMode) => setMap(basculerMode(m, routeId, mode));

  return (
    <ScreenShell
      title={<><Icon id="navigation/campagne" size="sm" /> {named ? <>Carte du monde — {m.label}</> : m.label}</>}
      onClose={() => { setMap(m); onClose(); }}
      actions={
        <>
          <button className="btn small" onClick={() => addPlace({ x: 50, y: 50 })}>+ Lieu</button>
          <button
            className="btn small"
            aria-pressed={!!linkFrom}
            onClick={() => setLinkFrom(linkFrom ? null : selPlace?.id ?? m.places[0]?.id ?? null)}
            disabled={m.places.length < 2}
            title="Cliquez un 1ᵉʳ lieu (sélection), activez, puis cliquez le 2ᵉ lieu"
          >
            {linkFrom ? `Lier depuis « ${placeById(m, linkFrom)?.label} »… (cliquer le 2ᵉ lieu)` : <><Icon id="coop/invitation" size="sm" /> Lier deux lieux</>}
          </button>
          <button className="btn small" onClick={deleteSelected} disabled={!sel}><Icon id="interface/supprimer" size="sm" /> Supprimer la sélection</button>
          <button className="btn small" onClick={() => { setMap(null); onClose(); }} title="Le projet n'offrira plus de voyage">
            Retirer la carte du projet
          </button>
        </>
      }
    >
      <div className="screen-scroll wme-body">
        <div className="wme-canvas">
          <svg
            ref={svgRef}
            viewBox="0 0 100 64"
            preserveAspectRatio="xMidYMid meet"
            onDoubleClick={(ev) => addPlace(toMapPos(ev))}
            onPointerMove={(ev) => {
              if (dragRef.current) updPlace(dragRef.current, { pos: toMapPos(ev) });
            }}
            onPointerUp={() => { dragRef.current = null; }}
          >
            <title>Double-clic : ajouter un lieu</title>
            <defs>
              {/* Médaillon des lieux — MÊME langage que le rendu joueur (`WorldMapView`, tokens --wm-*). */}
              <radialGradient id="wme-medal" cx="50%" cy="38%" r="70%">
                <stop offset="0%" stopColor="#f4e8c6" />
                <stop offset="100%" stopColor="#d2b87e" />
              </radialGradient>
              <filter id="wme-drop" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodColor="#000" floodOpacity="0.35" />
              </filter>
            </defs>
            {planChrome()}
            {m.routes.map((r) => {
              const a = placeById(m, r.a.id);
              const b = placeById(m, r.b.id);
              if (!a || !b) return null;
              return (
                <g key={r.id} onClick={() => setSel({ kind: 'route', id: r.id })} style={{ cursor: 'pointer' }}>
                  <title>Clic : éditer la route</title>
                  {/* zone de clic large + trait visible */}
                  <line x1={a.pos.x} y1={a.pos.y * 0.64} x2={b.pos.x} y2={b.pos.y * 0.64} stroke="transparent" strokeWidth="3" />
                  <line
                    x1={a.pos.x} y1={a.pos.y * 0.64} x2={b.pos.x} y2={b.pos.y * 0.64}
                    stroke={sel?.kind === 'route' && sel.id === r.id ? 'var(--accent)' : 'var(--wm-frame-dark)'}
                    strokeWidth={sel?.kind === 'route' && sel.id === r.id ? 1.2 : 0.7}
                    strokeDasharray="1.6 1.1"
                  />
                  <text x={(a.pos.x + b.pos.x) / 2} y={(a.pos.y + b.pos.y) / 2 * 0.64 - 1} textAnchor="middle" fontSize="2.6" fill="var(--wm-ink)">
                    {r.km} km
                  </text>
                </g>
              );
            })}
            {m.places.map((p) => (
              <g
                key={p.id}
                transform={`translate(${p.pos.x} ${p.pos.y * 0.64})`}
                style={{ cursor: 'grab' }}
                onPointerDown={(ev) => { ev.stopPropagation(); dragRef.current = p.id; clickPlace(p.id); }}
              >
                <title>Glisser : déplacer</title>
                {sel?.kind === 'place' && sel.id === p.id && <circle r="2.1" fill="none" stroke="var(--accent)" strokeWidth="0.4" />}
                {linkFrom === p.id && <circle r="2.1" fill="none" stroke="var(--gold2)" strokeWidth="0.3" strokeDasharray="0.7 0.55" />}
                {/* Médaillon — MÊME langage que le rendu joueur (`WorldMapView`) : `p.icon` = id du registre
                    src/data/icons (le champ « Icône » ci-dessous n'invite plus l'emoji, #361). Une valeur
                    hors catalogue (un emoji brut) reste affichée en repli, jamais silencieuse. */}
                <circle r="1.5" fill="url(#wme-medal)" stroke="var(--wm-age-spot)" strokeWidth="0.22" filter="url(#wme-drop)" />
                {p.icon && ICON_DEFS[p.icon] ? (
                  <g style={{ color: 'var(--wm-marker-icon)' }}><IconG id={p.icon} x={-1.05} y={-1.05} size={2.1} /></g>
                ) : p.icon ? (
                  <text y="0.75" textAnchor="middle" fontSize="2.2" fill="var(--wm-marker-icon)">{p.icon}</text>
                ) : (
                  <g style={{ color: 'var(--wm-marker-icon)' }}><IconG id="outil-de-carte/epingle" x={-1.05} y={-1.05} size={2.1} /></g>
                )}
                <text y="3.6" textAnchor="middle" fontSize="2.6" fill="var(--wm-ink)">{p.label}</text>
              </g>
            ))}
          </svg>
        </div>

        <aside className="wme-inspector">
          {/* ── Paramètres de carte (défauts RAW, tout paramétrable) ── */}
          {!sel && (
            <>
              <div className="mini-title">Carte</div>
              <label className="ed-field">Nom
                <input value={m.label} onChange={(e) => { setNamed(true); upd({ label: e.target.value }); }} />
              </label>
              <label className="ed-field">Image de fond — vraie carte (URL, chemin d'asset public, ou data URI)
                <input
                  value={m.background ?? ''}
                  placeholder="vide = parchemin + déchevauchement ; renseigné = vraie carte, lieux à leurs positions exactes"
                  onChange={(e) => upd({ background: e.target.value.trim() || undefined })}
                />
              </label>
              {m.background && (
                <img src={m.background} alt="Aperçu du fond de carte" style={{ maxWidth: '100%', maxHeight: 96, borderRadius: 6, border: '1px solid var(--border)', margin: '2px 0 6px' }} />
              )}
              <label className="ed-field">Heures de voyage/jour sans Test (RAW : 6)
                <NumberField
                  variant="nu" label="Heures de voyage par jour sans Test" min={1} max={24} vide
                  value={m.params?.hoursPerDay ?? TRAVEL_DEFAULTS.hoursPerDay}
                  onChange={(n) => upd({ params: { ...m.params, hoursPerDay: n ?? TRAVEL_DEFAULTS.hoursPerDay } })}
                />
              </label>
              <label className="ed-field">Plafond de marche forcée (h/jour)
                <NumberField
                  variant="nu" label="Plafond de marche forcée (h/jour)" min={1} max={24} vide
                  value={m.params?.forcedMaxHours ?? TRAVEL_DEFAULTS.forcedMaxHours}
                  onChange={(n) => upd({ params: { ...m.params, forcedMaxHours: n ?? TRAVEL_DEFAULTS.forcedMaxHours } })}
                />
              </label>
              <label className="ed-field">Péripétie : seuil du d10 quotidien (RAW : 8 ; 0 = désactivé)
                <NumberField
                  variant="nu" label="Péripétie : seuil du d10 quotidien" min={0} max={10}
                  value={m.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie}
                  onChange={(perilDie) => upd({ params: { ...m.params, perilDie } })}
                />
              </label>
              {setActiveAxes && (
                <>
                  <div className="mini-title">Axes actifs (#409) — vide = socle de base</div>
                  {allAxes.map((a) => (
                    <label key={a.id} className="ed-check" title={a.desc}>
                      <input
                        type="checkbox"
                        checked={(activeAxes ?? coreAxisIds()).includes(a.id)}
                        onChange={(e) => {
                          const base = activeAxes ?? coreAxisIds();
                          const next = e.target.checked ? [...base, a.id] : base.filter((id) => id !== a.id);
                          setActiveAxes(next.length ? next : undefined);
                        }}
                      />
                      {a.label}
                    </label>
                  ))}
                </>
              )}
            </>
          )}

          {selPlace && <WorldMapPlacePanel place={selPlace} scenes={scenes} narratif={narratif} updPlace={updPlace} />}
          {selRoute && (
            <WorldMapRoutePanel route={selRoute} map={m} scenes={scenes} updRoute={updRoute} effCtx={effCtx} toggleMode={toggleMode} />
          )}
        </aside>
      </div>
    </ScreenShell>
  );
}
