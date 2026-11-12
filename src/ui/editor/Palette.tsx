/**
 * Palette v2 : un RAIL d'outils à icônes + le contenu CONTEXTUEL de l'outil actif (un seul
 * affiché à la fois — fini la pile infinie du POC). Pose DIRECTE depuis les catalogues
 * recherchables (décors `decorsDuCatalogue`, fiches du bestiaire, bâtiments par catégorie).
 * Composant de PRÉSENTATION : l'état (outil, pinceau, rencontre cible) vit dans Editor.
 *
 * APERÇU AU CAP D'IDENTITÉ : ce que la palette annonce d'un décor — sa chip d'empreinte — se lit au
 * `CAP_IDENTITE_PROP`, le seul cap qu'un catalogue connaisse : un TYPE n'a pas d'orientation, seule
 * une instance en porte une. L'empreinte d'un décor à recette TOURNE avec le cap (#1509) : c'est
 * l'INSPECTEUR, qui tient une instance, qui l'annonce au cap RÉEL (`Inspector.tsx`).
 */
import { useState, type ReactNode } from 'react';
import { DEFAULT_TERRAIN, sceneMetresPerTile, type Scene } from '../../noyau/monde/scene';
import type { Terrain } from '../../data/schemas/defs-scenes/scene';
import { CAP_IDENTITE_PROP, empreinteDuProp } from '../../data/props.types';
import { Icon } from '../Icon';
import { OptionChooser } from '../OptionChooser';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import { terrainIds, terrainLabel } from '../../noyau/monde/terrain';
import { terrainDef } from '../../noyau/monde/volume/matieres';
import { decorsDuCatalogue } from '../../gameIso/catalog/decor';
import { premierOffert, profilsStandard } from '../../data';
import { GatedAction } from '../GatedAction';
import type { Pt } from '../../noyau/sceneEdit';
import { HAUTEURS, PINCEAUX } from '../../noyau/edition/session';
import { t } from '../../i18n';
import { fichesDePersonnage, structuresCrenelables, structuresDeLArete, type Tool, type WallPaint, type ZoneVariant } from '../../noyau/sceneEditLecture';
import { planStairFlight } from '../../noyau/stairFlight';
import { libelleDAuteur, siegeEngines } from '../../data';
import { LayerField, layerLabel } from './LayerField';
import { Stack } from '../Layout';

type Family = Exclude<Tool['mode'], 'entite'> | Extract<Tool, { mode: 'entite' }>['kind'] | 'architecture';

const RAIL: { key: Family; icon: ReactNode; label: string }[] = [
  { key: 'selection', icon: '↖', label: 'Sélection / déplacer — clic = sélectionner, glisser = déplacer' },
  { key: 'architecture', icon: <Icon id="repos/chez-soi" />, label: 'Architecture' },
  { key: 'terrain', icon: <Icon id="outil-de-carte/peindre" />, label: 'Peindre le terrain' },
  { key: 'arete', icon: <Icon id="outil-de-carte/mur" />, label: 'Murs — cloison ou porte sur une arête, diagonale au centre de la case' },
  { key: 'hauteur', icon: <Icon id="outil-de-carte/hauteur" />, label: 'Hauteur — surface surélevée / fosse (peindre une hauteur en mètres ; la traversée verticale s’auto-dérive)' },
  { key: 'escalier', icon: '↗', label: 'Volée — tracer une file de cases entre deux surfaces cotées : les cotes s’interpolent par crans franchissables (aucun décor posé)' },
  { key: 'crenelage', icon: <Icon id="outil-de-carte/crenelage" />, label: 'Crénelage — marque un parapet crénelé sur les cases peintes (décoration de rendu)' },
  { key: 'personnage', icon: <Icon id="outil-de-carte/personnage" />, label: 'Poser un personnage' },
  { key: 'prop', icon: <Icon id="outil-de-carte/decor" />, label: 'Poser un décor' },
  { key: 'heroStart', icon: <Icon id="outil-de-carte/depart" />, label: 'Départ des héros (case d’arrivée du groupe)' },
  { key: 'zone', icon: <Icon id="outil-de-carte/zone" />, label: 'Dessiner une zone — pièce, trigger, zone de repos ou piège' },
  { key: 'entree', icon: <Icon id="navigation/point-d-entree" />, label: 'Poser un point d’entrée (cible des transitions)' },
  { key: 'rencontre', icon: <Icon id="action/attaquer" size="sm" />, label: 'Placer des ennemis (rencontre de combat)' },
  { key: 'emplacement', icon: <Icon id="scenario/siege" size="sm" />, label: 'Emplacement de siège — poser une pièce d’artillerie (baliste, catapulte, canon…) servie par un équipage' },
  { key: 'gomme', icon: <Icon id="outil-de-carte/gomme" />, label: 'Gomme — efface les entités cliquées' },
];

/** Sous-modes de l'outil murs (rail contextuel). */
const WALL_PAINTS: { paint: WallPaint; icon: ReactNode; label: string }[] = [
  { paint: 'wall', icon: '▮', label: 'Cloison' },
  { paint: 'door', icon: <Icon id="outil-de-carte/porte" />, label: 'Porte' },
  { paint: 'diagBack', icon: '◣', label: 'Diagonale ＼' },
  { paint: 'diagFwd', icon: '◢', label: 'Diagonale ／' },
];

/** Ce qui reste à faire APRÈS le glissé, par variante de zone — dit où la suite s'édite. */
const ZONE_HINT: Record<ZoneVariant, string> = {
  room: 'La pièce naît sans mécanique : renommez-la dans l’inspecteur, et reliez-la à une façade pour ses accès.',
  trigger: 'Les effets s’éditent ensuite dans le panneau Logique.',
  rest: 'Lieux et qualité du repos s’éditent ensuite dans l’inspecteur.',
  effect: 'Effets et déclencheur s’éditent ensuite dans l’inspecteur.',
};

/** Famille du rail correspondant à l'outil actif. */
function familyOf(tool: Tool): Family {
  if (tool.mode === 'entite') return tool.kind === 'prop' ? 'prop' : tool.kind === 'personnage' ? 'personnage' : 'heroStart';
  return tool.mode;
}

export function Palette({
  scene,
  tool,
  setTool,
  brush,
  setBrush,
  terrainRect,
  setTerrainRect,
  encTarget,
  setEncTarget,
  encRef,
  setEncRef,
  enemyCreatures,
  currentLayer,
  stairRun,
  onStairApply,
  onStairClear,
  architectureMode,
  architectureBodyId,
  architectureStoreyId,
  architectureAction,
  onArchitectureMode,
  onArchitectureBody,
  onArchitectureStorey,
  onAddArchitectureBody,
  onAddArchitecturePart,
  onAddArchitectureStorey,
  onAddRoofSection,
  onArmFacade,
}: {
  scene: Scene;
  tool: Tool;
  setTool: (t: Tool) => void;
  brush: number;
  setBrush: (n: number) => void;
  terrainRect: boolean;
  setTerrainRect: (b: boolean) => void;
  encTarget: string;
  setEncTarget: (s: string) => void;
  encRef: string;
  setEncRef: (s: string) => void;
  enemyCreatures: { id: string; label: string }[];
  /** Couche en cours d'édition — la volée se trace dessus et rejoint le plancher de `tool.toZ`. */
  currentLayer: number;
  /** Cases de la volée tracées sur le canvas (outil Volée). */
  stairRun: readonly Pt[];
  /** Pose la volée planifiée (cotes seules) et vide le tracé. */
  onStairApply: () => void;
  /** Vide le tracé sans rien écrire. */
  onStairClear: () => void;
  architectureMode: boolean;
  architectureBodyId: string | null;
  architectureStoreyId: string | null;
  architectureAction: 'selection' | 'facade';
  onArchitectureMode: () => void;
  onArchitectureBody: (id: string) => void;
  onArchitectureStorey: (id: string) => void;
  onAddArchitectureBody: () => void;
  onAddArchitecturePart: () => void;
  onAddArchitectureStorey: () => void;
  onAddRoofSection: () => void;
  onArmFacade: () => void;
}) {
  const family = architectureMode ? 'architecture' : familyOf(tool);
  const architectureBody = scene.architecture?.find((body) => body.id === architectureBodyId) ?? scene.architecture?.[0] ?? null;
  const architectureStorey = architectureBody?.storeys.find((storey) => storey.id === architectureStoreyId) ?? architectureBody?.storeys[0] ?? null;
  const [search, setSearch] = useState(''); // filtre partagé des catalogues (réinitialisé au changement d'outil)
  // Derniers choix par famille → re-cliquer l'icône retrouve l'outil précis.
  const [lastTerrain, setLastTerrain] = useState<Terrain>(DEFAULT_TERRAIN);
  const [lastProp, setLastProp] = useState(() => premierOffert(decorsDuCatalogue(), 'Décor'));
  const [lastEngine, setLastEngine] = useState(() => premierOffert(siegeEngines(), 'Engin de siège'));
  const standard = new Set(profilsStandard());
  const fiches = fichesDePersonnage();
  const [lastFiche, setLastFiche] = useState<string | undefined>(undefined);
  // Matériau MÉMORISÉ par sous-mode (Cloison/Porte) — l'outil porte son matériau comme un pinceau porte
  // sa couleur : la palette ne montre que ce qui est POSABLE sur une arête pour ce sous-mode (#830).
  const [lastWallStructure, setLastWallStructure] = useState<string | undefined>(undefined);
  // Structures posables au Crénelage : celles qui portent un PARAPET (`structuresCrenelables`) — une
  // structure sans parapet n'a rien à dessiner sur le pourtour (#841 FU-H).
  const crenelStructures = structuresCrenelables();
  const [lastCrenelStructure, setLastCrenelStructure] = useState<string | undefined>(crenelStructures[0]?.id);
  const [lastDoorStructure, setLastDoorStructure] = useState<string | undefined>(undefined);
  // Étages disponibles pour la VOLÉE : la première couche au-dessus de celle qu'on édite est la cible
  // naturelle (monter d'un niveau) ; l'auteur peut viser une autre couche, le plan tranche.
  const layerZs = scene.layers.map((l) => l.z).sort((a, b) => a - b);
  const stairDefaultToZ = layerZs.find((z) => z > currentLayer) ?? currentLayer;
  const stairPlan = tool.mode === 'escalier' ? planStairFlight(scene, stairRun, currentLayer, tool.toZ) : null;

  const pick = (f: Family) => {
    setSearch('');
    switch (f) {
      case 'selection': return setTool({ mode: 'selection' });
      case 'architecture': return onArchitectureMode();
      case 'terrain': return setTool({ mode: 'terrain', terrain: lastTerrain });
      case 'arete': return setTool({ mode: 'arete', paint: 'wall', structure: lastWallStructure });
      case 'hauteur': return setTool({ mode: 'hauteur', metres: 2 });
      case 'escalier': return setTool({ mode: 'escalier', toZ: stairDefaultToZ });
      case 'crenelage': return setTool({ mode: 'crenelage', structure: lastCrenelStructure ?? null });
      case 'personnage': return setTool({ mode: 'entite', kind: 'personnage', ref: lastFiche ?? premierOffert(fiches, 'Fiche de personnage') });
      case 'prop': return setTool({ mode: 'entite', kind: 'prop', ref: lastProp });
      case 'heroStart': return setTool({ mode: 'entite', kind: 'heroStart' });
      case 'zone': return setTool({ mode: 'zone', zone: 'room' });
      case 'entree': return setTool({ mode: 'entree' });
      case 'rencontre': return setTool({ mode: 'rencontre' });
      case 'emplacement': return setTool({ mode: 'emplacement', trappingId: lastEngine });
      case 'gomme': return setTool({ mode: 'gomme' });
    }
  };

  const searchBox = (placeholder: string) => (
    <SearchFilterField icon className="pal-search" placeholder={placeholder} value={search} onChange={setSearch} />
  );

  return (
    <aside className="editor-palette">
      <div className="pal-rail" role="toolbar" aria-label="Outils">
        {RAIL.map((r) => (
          <button
            key={r.key}
            className={`pal-tool${family === r.key ? ' active' : ''}`}
            title={r.label}
            aria-label={r.label}
            aria-pressed={family === r.key}
            onClick={() => pick(r.key)}
          >
            {r.icon}
          </button>
        ))}
      </div>

      <div className="pal-content">
        {family === 'selection' && (
          <p className="hint">Cliquez un élément de la carte pour l'éditer dans l'inspecteur ; glissez pour le déplacer. Suppr = supprimer, flèches = décaler, Ctrl+C/V/D = copier/coller/dupliquer.</p>
        )}

        {family === 'architecture' && (
          <>
            <div className="mini-title">Cible</div>
            {architectureBody ? (
              <>
                {/* DÉSIGNER, c'est SÉLECTIONNER : toucher la cible la pose dans l'inspecteur, même
                    quand c'est la cible déjà active (un `change` ne se produit pas alors, et le
                    corps redevenait inatteignable dès qu'un clic carte avait porté la sélection
                    ailleurs). Le `click` couvre la souris, le `change` couvre le clavier. */}
                <label className="ed-field">
                  Corps actif
                  <select
                    value={architectureBody.id}
                    onClick={() => onArchitectureBody(architectureBody.id)}
                    onChange={(event) => onArchitectureBody(event.target.value)}
                  >
                    {(scene.architecture ?? []).map((body, index) => (
                      <option key={`${body.id}:${index}`} value={body.id}>{body.label ?? body.id}</option>
                    ))}
                  </select>
                </label>
                {architectureStorey && (
                  <label className="ed-field">
                    Étage actif
                    <select
                      value={architectureStorey.id}
                      onClick={() => onArchitectureStorey(architectureStorey.id)}
                      onChange={(event) => onArchitectureStorey(event.target.value)}
                    >
                      {architectureBody.storeys.map((storey, index) => <option key={`${storey.id}:${index}`} value={storey.id}>{layerLabel(storey.z)}</option>)}
                    </select>
                  </label>
                )}
              </>
            ) : <p className="hint">Aucun corps — créez-en un ci-dessous.</p>}

            <div className="mini-title">Ajouter</div>
            <Stack>
              <button className="btn small btn-primary" onClick={onAddArchitectureBody}>Nouveau corps</button>
              <button
                className="btn small"
                disabled={!architectureStorey}
                title="Ajoute un étage au corps actif, à la couche juste au-dessus du plus haut étage existant"
                onClick={onAddArchitectureStorey}
              >
                Nouvel étage
              </button>
              <button className="btn small" disabled={!architectureStorey} onClick={onAddArchitecturePart}>Nouvelle partie</button>
              <button
                className="btn small"
                disabled={!architectureBody}
                aria-pressed={architectureAction === 'facade'}
                onClick={onArmFacade}
              >
                Section de façade
              </button>
              <button className="btn small" disabled={!architectureBody} onClick={onAddRoofSection}>Section de toiture</button>
            </Stack>
            <p className="hint">
              « Section de façade » s’arme puis se pose au clic sur une arête du plan (une façade existante
              est sélectionnée avant toute création). Tout le reste — libellé, style, toiture du corps,
              pièces révélées — s’édite dans l’inspecteur, sur l’élément SÉLECTIONNÉ.
            </p>
          </>
        )}

        {family === 'terrain' && tool.mode === 'terrain' && (
          <>
            <div className="mini-title">Pinceau</div>
            <OptionChooser
              layout="seg"
              options={[
                ...PINCEAUX.map((n) => ({
                  key: String(n),
                  label: `${n}×${n}`,
                  selected: brush === n && !terrainRect,
                  onSelect: () => { setBrush(n); setTerrainRect(false); },
                })),
                { key: 'rect', label: '▭ Rect', title: 'Glisser pour remplir un rectangle', selected: terrainRect, onSelect: () => setTerrainRect(!terrainRect) },
              ]}
            />
            <div className="mini-title">Terrains</div>
            <div className="terrain-palette">
              {terrainIds().map((t) => (
                <button
                  key={t}
                  className={`terrain-swatch ${tool.terrain === t ? 'active' : ''}`}
                  style={{ background: terrainDef(t).swatch }}
                  onClick={() => {
                    setLastTerrain(t as Terrain);
                    setTool({ mode: 'terrain', terrain: t as Terrain });
                  }}
                  title={terrainLabel(t)}
                >
                  {terrainLabel(t)}
                </button>
              ))}
            </div>
          </>
        )}

        {family === 'arete' && tool.mode === 'arete' && (
          <>
            <div className="mini-title">Type de cloison</div>
            <OptionChooser
              layout="seg"
              options={WALL_PAINTS.map((wp) => ({
                key: wp.paint,
                label: <>{wp.icon} {wp.label}</>,
                title: wp.label,
                selected: tool.paint === wp.paint,
                onSelect: () => setTool({
                  mode: 'arete',
                  paint: wp.paint,
                  structure: wp.paint === 'door' ? lastDoorStructure : wp.paint === 'wall' ? lastWallStructure : undefined,
                }),
              }))}
            />
            <p className="hint">
              {tool.paint === 'wall' || tool.paint === 'door'
                ? 'Cliquez PRÈS d’une arête de case : l’arête surlignée prend la cloison/porte. Re-cliquer l’efface.'
                : 'Cliquez une case : la diagonale se pose en travers (éventail / paroi courbe). Re-cliquer l’efface.'}
            </p>
            {(tool.paint === 'wall' || tool.paint === 'door') && (
              <>
                <div className="mini-title">Matériau du mur</div>
                {searchBox('matériau…')}
                <div className="pal-list">
                  {filterByLabel(structuresDeLArete(tool.paint), (s) => s.label, search).map((s) => (
                    <button
                      key={s.id}
                      className={`pal-item${tool.structure === s.id ? ' active' : ''}`}
                      onClick={() => {
                        if (tool.paint === 'door') setLastDoorStructure(s.id); else setLastWallStructure(s.id);
                        setTool({ mode: 'arete', paint: tool.paint, structure: s.id });
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="hint">Le matériau CHOISI est porté par l'outil : chaque cloison/porte posée ensuite le reçoit directement (plus besoin de repasser par l'inspecteur).</p>
              </>
            )}
          </>
        )}

        {family === 'hauteur' && tool.mode === 'hauteur' && (
          <>
            <div className="mini-title">Pinceau</div>
            <OptionChooser
              layout="seg"
              options={PINCEAUX.map((n) => ({ key: String(n), label: `${n}×${n}`, selected: brush === n, onSelect: () => setBrush(n) }))}
            />
            <div className="mini-title">Hauteur (mètres)</div>
            <OptionChooser
              layout="seg"
              options={HAUTEURS.map((p) => ({
                key: p.cle,
                label: <>{t(`ecran.editeur.hauteur.${p.cle}`)} <span className="chip">{p.metres > 0 ? '+' : ''}{p.metres} m</span></>,
                selected: tool.metres === p.metres,
                onSelect: () => setTool({ mode: 'hauteur', metres: p.metres }),
              }))}
            />
            <label className="mini-title" style={{ display: 'block' }}>
              Sur mesure
              <input type="number" step={0.5} value={tool.metres} onChange={(e) => setTool({ mode: 'hauteur', metres: Number(e.target.value) })} style={{ width: '5rem', marginLeft: '0.5rem' }} />
            </label>
            <p className="hint">Peignez la hauteur RÉELLE des cases en mètres (surface surélevée, fosse d’orchestre). « Plat » remet à 0 ; la traversée à pied / en chute s’en déduit (cf. relief).</p>
          </>
        )}

        {family === 'escalier' && tool.mode === 'escalier' && (
          <>
            <LayerField label="Étage rejoint" z={tool.toZ} layers={layerZs} onChange={(toZ) => setTool({ mode: 'escalier', toZ })} />
            <p className="hint">Glissez sur la carte pour tracer la file de cases de la volée ({layerLabel(currentLayer)}) ; re-passer sur une case la retire du tracé. Les cotes s’interpolent entre la surface d’appui du bas et le plancher rejoint — aucun décor n’est posé.</p>
            <div className="mini-title">Tracé : {stairRun.length} case{stairRun.length > 1 ? 's' : ''}</div>
            {stairPlan?.ok && (
              <p className="hint">
                {stairPlan.from} m → {stairPlan.to} m · cotes {stairPlan.steps.map((s) => Math.round(s.height * 100) / 100).join(' · ')} m
              </p>
            )}
            {/* DIAGNOSTIC D'AUTHORING : la raison reste EN CLAIR (`raisonInline`) — l'auteur corrige sa
                file d'après ce texte, il ne le découvre pas au survol. */}
            <GatedAction
              id="ed-stair-apply"
              raisonInline
              label="Poser la volée"
              enabled={!!stairPlan?.ok}
              reason={stairPlan && !stairPlan.ok ? stairPlan.reason : ''}
              onClick={onStairApply}
              btnClassName="small"
            />
            <button className="btn small" disabled={!stairRun.length} onClick={onStairClear}>Effacer le tracé</button>
          </>
        )}

        {family === 'crenelage' && tool.mode === 'crenelage' && (
          <>
            <div className="mini-title">Pinceau</div>
            <OptionChooser
              layout="seg"
              options={PINCEAUX.map((n) => ({ key: String(n), label: `${n}×${n}`, selected: brush === n, onSelect: () => setBrush(n) }))}
            />
            <div className="mini-title">Structure du parapet</div>
            <OptionChooser
              layout="grid"
              options={[
                ...crenelStructures.map((s) => ({
                  key: s.id,
                  label: s.label,
                  selected: tool.structure === s.id,
                  onSelect: () => {
                    setLastCrenelStructure(s.id);
                    setTool({ mode: 'crenelage', structure: s.id });
                  },
                })),
                { key: '__erase', label: 'Gomme (effacer la marque)', selected: tool.structure === null, onSelect: () => setTool({ mode: 'crenelage', structure: null }) },
              ]}
            />
            <p className="hint">Peint la case comme portant un PARAPET crénelé — décoration de rendu (merlons de périmètre) : n'affecte ni passabilité ni ligne de vue. Combinez-le à l'outil <Icon id="outil-de-carte/hauteur" size="sm" /> Hauteur pour un rempart complet.</p>
          </>
        )}

        {tool.mode === 'entite' && tool.kind === 'personnage' && (
          <>
            <div className="mini-title">Fiche du personnage à poser</div>
            {searchBox('fiche…')}
            <div className="pal-list">
              {filterByLabel(fiches, (c) => c.label, search).map((c) => (
                <button
                  key={c.id}
                  className={`pal-item${tool.ref === c.id ? ' active' : ''}`}
                  onClick={() => {
                    setLastFiche(c.id);
                    setTool({ mode: 'entite', kind: 'personnage', ref: c.id });
                  }}
                >
                  {c.label}
                  {standard.has(c.id) ? <span className="chip" title="LDB 77 l.7">Profil standard</span> : null}
                </button>
              ))}
            </div>
            <p className="hint">Cliquez la carte pour poser. L'apparence dérive de la fiche ; apparence, dialogue et rôle de marchand s'éditent ensuite dans l'inspecteur.</p>
          </>
        )}

        {tool.mode === 'entite' && tool.kind === 'prop' && (
          <>
            <div className="mini-title">Décor à poser</div>
            {searchBox('décor…')}
            <div className="pal-list">
              {filterByLabel(decorsDuCatalogue(), (p) => p.label, search).map((p) => {
                // L'empreinte que la PALETTE annonce est celle que la scène posera : dérivée du corps
                // (#1509) au cap d'IDENTITÉ, le seul que la palette connaît (l'instance choisira le
                // sien), et à l'échelle de la scène ÉDITÉE : la même recette ne couvre pas les mêmes
                // cases à 2 et à 4 m/case. Sa chip ne dit quelque chose que s'il dépasse UNE case.
                const effective = empreinteDuProp(p, CAP_IDENTITE_PROP, sceneMetresPerTile(scene));
                const empreinte = effective.w > 1 || effective.h > 1 ? effective : undefined;
                return (
                <button
                  key={p.id}
                  className={`pal-item${tool.ref === p.id ? ' active' : ''}`}
                  onClick={() => {
                    setLastProp(p.id);
                    setTool({ mode: 'entite', kind: 'prop', ref: p.id });
                  }}
                >
                  {p.label}
                  {empreinte ? <span className="chip">{empreinte.w}×{empreinte.h}</span> : null}
                </button>
                );
              })}
            </div>
          </>
        )}

        {family === 'heroStart' && (
          <p className="hint">Cliquez la carte pour poser la case de DÉPART du groupe (une seule utile — la première trouvée est utilisée).</p>
        )}

        {family === 'zone' && tool.mode === 'zone' && (
          <>
            <div className="mini-title">Type de zone</div>
            <OptionChooser
              layout="seg"
              options={[
                { key: 'room', label: <><Icon id="repos/chez-soi" size="sm" /> Pièce — intérieur d'un bâtiment (toitures, enveloppe, accès en dérivent)</>, selected: tool.zone === 'room', onSelect: () => setTool({ mode: 'zone', zone: 'room' }) },
                { key: 'trigger', label: <><Icon id="outil-de-carte/zone" size="sm" /> Trigger — déclenche des effets quand le groupe y entre</>, selected: tool.zone === 'trigger', onSelect: () => setTool({ mode: 'zone', zone: 'trigger' }) },
                { key: 'rest', label: <><Icon id="repos/campement" size="sm" /> Zone de repos — offre de repos locale (auberge/maison/camp)</>, selected: tool.zone === 'rest', onSelect: () => setTool({ mode: 'zone', zone: 'rest' }) },
                { key: 'effect', label: <><Icon id="interface/attention" size="sm" /> Piège / hasard — Dégâts ou États à la traversée / au stationnement</>, selected: tool.zone === 'effect', onSelect: () => setTool({ mode: 'zone', zone: 'effect' }) },
              ]}
            />
            <p className="hint">Glissez sur la carte pour dessiner le rectangle. {ZONE_HINT[tool.zone]}</p>
          </>
        )}

        {family === 'entree' && (
          <p className="hint">Cliquez la carte pour poser un point d'entrée nommé (cible des transitions d'une autre scène et des arrivées de voyage). Renommez-le dans l'inspecteur.</p>
        )}

        {family === 'rencontre' && (
          <>
            <div className="mini-title">Rencontre cible</div>
            <select value={encTarget} onChange={(e) => setEncTarget(e.target.value)}>
              <option value="">Nouvelle rencontre…</option>
              {scene.encounters.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} ({(e.members ?? []).length})
                </option>
              ))}
            </select>
            <div className="mini-title">Fiche à placer</div>
            {searchBox('fiche…')}
            <div className="pal-list">
              {filterByLabel(enemyCreatures, (c) => c.label, search).map((c) => (
                <button key={c.id} className={`pal-item${encRef === c.id ? ' active' : ''}`} onClick={() => setEncRef(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="hint">Chaque clic sur la carte ajoute la fiche à la rencontre cible. Traits, sorts et apparence du spawn s'éditent dans l'inspecteur.</p>
          </>
        )}

        {family === 'emplacement' && tool.mode === 'emplacement' && (
          <>
            <div className="mini-title">Pièce d'artillerie à poser</div>
            {searchBox('engin de siège…')}
            <div className="pal-list">
              {filterByLabel(siegeEngines(), (t) => t.label, search).map((t) => (
                <button
                  key={t.id}
                  className={`pal-item${tool.trappingId === t.id ? ' active' : ''}`}
                  onClick={() => {
                    setLastEngine(t.id);
                    setTool({ mode: 'emplacement', trappingId: t.id });
                  }}
                >
                  {libelleDAuteur(t)}
                </button>
              ))}
            </div>
            <p className="hint">Cliquez la carte pour poser l'emplacement. Orientation du créneau et équipage s'éditent dans l'inspecteur ; enrôlez-le dans une rencontre (fold <Icon id="action/attaquer" size="sm" /> Combat) pour qu'il entre en jeu.</p>
          </>
        )}

        {family === 'gomme' && <p className="hint">Cliquez (ou glissez sur) les entités à effacer. Zones, bâtiments et spawns se suppriment via leur sélection (Suppr).</p>}
      </div>
    </aside>
  );
}
