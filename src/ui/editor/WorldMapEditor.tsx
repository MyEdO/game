import { useRef, useState } from 'react';
import { Scene } from '../../state/scene';
import { CIBLES_PAR_RACINE } from '../../state/combatEffects';
import { WorldMap, MapPlace, MapRoute, emptyWorldMap, placeById } from '../../state/worldMap';
import { TravelMode, TRAVEL_DEFAULTS } from '../../engine/travel';
import { allAxes, coreAxisIds } from '../../data';
import { Icon, IconG } from '../Icon';
import { ICON_DEFS } from '../icons';
import { ScreenShell } from '../ScreenShell';
import { planChrome } from '../PlanChrome';
import { NumberField } from '../NumberField';
import { WorldMapPlacePanel } from './WorldMapPlacePanel';
import { WorldMapRoutePanel } from './WorldMapRoutePanel';

/**
 * Éditeur de la CARTE DU MONDE (#T2 Voyage) — overlay plein écran de l'éditeur de niveau.
 * Tout le voyage y est PARAMÉTRABLE (exigence) : lieux (position par glisser, scène liée, entrée,
 * icône), routes (km, modes, prix par mode, vitesse d'auteur, seuil d10 de péripétie, péripéties
 * d'auteur via EffectList, cible d'embuscade), paramètres de carte (heures/jour, marche forcée,
 * seuil d10 par défaut). Défauts = valeurs RAW citées dans `engine/travel.ts`. Panneaux Lieu/Route
 * découpés en `WorldMapPlacePanel`/`WorldMapRoutePanel` (#419 — règle 4 : onglets, jamais 5 sections
 * empilées).
 */
export function WorldMapEditor({ map, setMap, scenes, onClose, activeAxes, setActiveAxes }: {
  map: WorldMap | null;
  setMap: (m: WorldMap | null) => void;
  /** Toutes les scènes du projet (active + réserve) — pour lier lieux/embuscades. */
  scenes: Scene[];
  onClose: () => void;
  /** Axes de forces/faiblesses ACTIFS du PROJET (#409, `ProjectDoc.activeAxes`) — `undefined` =
   *  socle de base (`coreAxisIds`). Propriété PROJET réglée ici, dans l'éditeur de carte du monde
   *  (la surface d'authoring de la campagne). */
  activeAxes?: string[];
  setActiveAxes?: (ids: string[] | undefined) => void;
}) {
  const m: WorldMap = map ?? emptyWorldMap();
  const [sel, setSel] = useState<{ kind: 'place' | 'route'; id: string } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<string | null>(null); // lieu en cours de glisser (ref : voir « Pièges connus »)
  // Nom réellement authoré ? Un `map` déjà présent au montage (chargé, donc déjà nommé) OU une
  // saisie faite dans le champ Nom CETTE session valent nommage — jamais une comparaison au texte
  // par défaut (« Carte du monde », #142) : un auteur qui choisirait littéralement ce nom ne serait
  // plus confondu avec une carte jamais renommée.
  const [named, setNamed] = useState(() => map !== null);

  const upd = (patch: Partial<WorldMap>) => setMap({ ...m, ...patch });
  const updPlace = (id: string, patch: Partial<MapPlace>) =>
    upd({ places: m.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const updRoute = (id: string, patch: Partial<MapRoute>) =>
    upd({ routes: m.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  /** Point écran → coordonnées carte (0-100 sur les deux axes ; rendu y × 0,64). */
  const toMapPos = (ev: React.PointerEvent | React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.max(4, Math.min(96, ((ev.clientY - r.top) / r.height) * 100));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const addPlace = (pos: { x: number; y: number }) => {
    // Décale les ajouts successifs au même point (bouton « + Lieu ») pour qu'ils restent saisissables.
    while (m.places.some((x) => Math.abs(x.pos.x - pos.x) < 4 && Math.abs(x.pos.y - pos.y) < 4)) {
      pos = { x: Math.min(96, pos.x + 8), y: pos.y };
    }
    const p: MapPlace = {
      id: `lieu-${Date.now().toString(36)}`,
      label: 'Nouveau lieu',
      pos,
      scene: scenes[0]?.id ?? '',
    };
    upd({ places: [...m.places, p] });
    setSel({ kind: 'place', id: p.id });
  };

  const clickPlace = (id: string) => {
    if (linkFrom && linkFrom !== id) {
      // Mode liaison : 2ᵉ lieu cliqué → route (si elle n'existe pas déjà).
      const exists = m.routes.some((r) => (r.a === linkFrom && r.b === id) || (r.a === id && r.b === linkFrom));
      if (!exists) {
        const route: MapRoute = { id: `route-${Date.now().toString(36)}`, a: linkFrom, b: id, km: 10, modes: ['pied'] };
        upd({ routes: [...m.routes, route] });
        setSel({ kind: 'route', id: route.id });
      }
      setLinkFrom(null);
      return;
    }
    setSel({ kind: 'place', id });
  };

  const deleteSelected = () => {
    if (!sel) return;
    if (sel.kind === 'place') {
      upd({
        places: m.places.filter((p) => p.id !== sel.id),
        routes: m.routes.filter((r) => r.a !== sel.id && r.b !== sel.id),
      });
    } else {
      upd({ routes: m.routes.filter((r) => r.id !== sel.id) });
    }
    setSel(null);
  };

  const selPlace = sel?.kind === 'place' ? m.places.find((p) => p.id === sel.id) : undefined;
  const selRoute = sel?.kind === 'route' ? m.routes.find((r) => r.id === sel.id) : undefined;
  // Contexte des effets de péripétie : rencontres/dialogues de TOUTES les scènes du projet.
  const effCtx = {
    encounters: scenes.flatMap((s) => s.encounters),
    dialogues: scenes.flatMap((s) => s.dialogues),
    // Selects guidés (M9) : transitions de péripétie vers les scènes du projet (le marchand,
    // lié à la scène COURANTE au moment du voyage, reste un id libre ici).
    scenes: scenes.map((sc) => ({ id: sc.id, nom: sc.label, entries: Object.keys(sc.entryPoints ?? {}) })),
    cibles: CIBLES_PAR_RACINE.scene,
  };

  const toggleMode = (r: MapRoute, mode: TravelMode) => {
    const modes = r.modes.includes(mode) ? r.modes.filter((x) => x !== mode) : [...r.modes, mode];
    updRoute(r.id, { modes: modes.length ? modes : ['pied'] });
  };

  return (
    <ScreenShell
      title={<><Icon id="nav/campaign" size="sm" /> {named ? <>Carte du monde — {m.label}</> : m.label}</>}
      onClose={() => { setMap(m); onClose(); }}
      className="wme-shell"
      actions={
        <>
          <button className="btn small" onClick={() => addPlace({ x: 50, y: 50 })}>+ Lieu</button>
          <button
            className={`btn small ${linkFrom ? 'btn-primary' : ''}`}
            onClick={() => setLinkFrom(linkFrom ? null : selPlace?.id ?? m.places[0]?.id ?? null)}
            disabled={m.places.length < 2}
            title="Cliquez un 1ᵉʳ lieu (sélection), activez, puis cliquez le 2ᵉ lieu"
          >
            {linkFrom ? `Lier depuis « ${placeById(m, linkFrom)?.label} »… (cliquer le 2ᵉ lieu)` : <><Icon id="coop/invite" size="sm" /> Lier deux lieux</>}
          </button>
          <button className="btn small" onClick={deleteSelected} disabled={!sel}><Icon id="ui/delete" size="sm" /> Supprimer la sélection</button>
          <button className="btn small" onClick={() => { setMap(null); onClose(); }} title="Le projet n'offrira plus de voyage">
            Retirer la carte du projet
          </button>
        </>
      }
    >
      <div className="wme-body">
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
              const a = placeById(m, r.a);
              const b = placeById(m, r.b);
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
                    src/ui/icons (le champ « Icône » ci-dessous n'invite plus l'emoji, #361). Une valeur
                    hors catalogue (un emoji brut) reste affichée en repli, jamais silencieuse. */}
                <circle r="1.5" fill="url(#wme-medal)" stroke="var(--wm-age-spot)" strokeWidth="0.22" filter="url(#wme-drop)" />
                {p.icon && ICON_DEFS[p.icon] ? (
                  <g style={{ color: 'var(--wm-marker-icon)' }}><IconG id={p.icon} x={-1.05} y={-1.05} size={2.1} /></g>
                ) : p.icon ? (
                  <text y="0.75" textAnchor="middle" fontSize="2.2" fill="var(--wm-marker-icon)">{p.icon}</text>
                ) : (
                  <g style={{ color: 'var(--wm-marker-icon)' }}><IconG id="map-tool/pin" x={-1.05} y={-1.05} size={2.1} /></g>
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

          {selPlace && <WorldMapPlacePanel place={selPlace} scenes={scenes} updPlace={updPlace} />}
          {selRoute && (
            <WorldMapRoutePanel route={selRoute} map={m} scenes={scenes} updRoute={updRoute} effCtx={effCtx} toggleMode={toggleMode} />
          )}
        </aside>
      </div>
    </ScreenShell>
  );
}
