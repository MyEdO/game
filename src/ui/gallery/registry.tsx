/**
 * Registre de la galerie design system (#412) — SOURCE UNIQUE lue par `DesignGallery` (rendu) ET
 * par la garde structurelle `gallery-exhaustive.test.ts` (couverture). Extension utilisateur
 * verbatim (2026-07-14) : « Faudrait forcer à ce que la galerie ait toutes les primitives » — chaque
 * primitive de `src/data/primitives.manifest.json` dont le fichier vit sous `src/ui/`
 * (rendu réel, pas un module d'état/moteur pur) reçoit une entrée ICI, `file` reprenant le chemin
 * EXACT du manifeste (le test fait un import + une comparaison de chaîne, pas une heuristique).
 *
 * `render` est une fabrique paresseuse (composant React) pour ne rien monter avant que la galerie
 * ne sélectionne l'entrée. `note` documente une exception explicite (maquette statique plutôt que
 * vivante) — jamais une exclusion silencieuse : la garde compte aussi les entrées notées.
 */
import { tableTotale } from '../../lib/tableTotale';
import { type ComponentType, useRef, useState } from 'react';
import { ScreenMeta } from '../ScreenMeta';
import { Tabs, type TabItem } from '../Tabs';
import { ChoiceButtons, OptionChooser } from '../OptionChooser';
import { EmbeddedShell } from '../RollShell';
import { Modal } from '../Modal';
import { CadrePied, CadreFermer } from '../Cadre';
import { Planche } from '../Planche';
import { ParchmentCard } from '../ParchmentCard';
import { QtyStepper } from '../QtyStepper';
import { PanneauParametre } from '../PanneauParametre';
import { useInfobulle } from '../Infobulle';
import { CodexRef } from '../compendium/CodexRef';
import { BoiteAncree, usePlacementAncre } from '../BoiteAncree';
import { NumberField } from '../NumberField';
import { DescRefField } from '../compendium/DescRefField';
import { SourceRefField } from '../SourceRefField';
import type { DescRef } from '../../data/source/decoupe';
import { GatedAction } from '../GatedAction';
import { ReadyRow } from '../ReadyRow';
import { CoopInvite, CoopCodeInput, SeatList, CoopAssignRow, CoopBanner } from '../CoopPanels';
import { CharFrame } from '../CharFrame';
import { GearAssignList } from '../GearAssignList';
import { RewardRecap } from '../RewardRecap';
import { SceneErrorBoundary } from '../SceneErrorBoundary';
import type { LootGear } from '../../state/pendings';
import { SpectatorChip } from '../SpectatorChip';
import { RigPortrait } from '../RigPortrait';
import { FxChip } from '../FxChip';
import { EffectChips } from '../EffectChips';
import { PortraitTile } from '../PortraitTile';
import { StateChips } from '../StateChips';
import { InitiativeStrip } from '../InitiativeStrip';
import { PartyDock } from '../PartyDock';
import { ObjectiveBanner } from '../ObjectiveBanner';
import { ViewControls } from '../ViewControls';
import { ConsoleArch, ConsoleCell, PhaseBanner } from '../CombatConsole';
import { DrBar } from '../DrBar';
import { Coins } from '../Coins';
import { LifeBar } from '../LifeBar';
import { CharacterPreview } from '../CharacterPreview';
import { MetalStatus } from '../MetalStatus';
import { WaxSeal, SealedPlaque } from '../WaxSeal';
import { CareerPath } from '../CareerPath';
import { FigTile, type ZoneBadgeSpec } from '../FigTile';
import { PlaqueRow, PlaqueGrid } from '../PlaqueRow';
import { DieFace } from '../DiceRoll';
import { CHAR_KEYS, CHAR_LABELS, type ConditionId } from '../../engine/types';
import { effectiveChar } from '../../engine/characteristics';
import { GroupedPickGrid, type PickGridSection } from '../GroupedPickGrid';
import { DetailFrame } from '../DetailFrame';
import { HeroSheet } from '../HeroSheet';
import { InfluenceRow } from '../InfluenceRow';
import { VsHeader } from '../VsHeader';
import { MasterDetail } from '../MasterDetail';
import { SearchFilterField, useFilteredList } from '../SearchFilterField';
import { TradeTable, type TradeColumn, type TradeGroup } from '../TradeTable';
import { ActivityPane } from '../ActivityPane';
import { MenuCard, MenuSection, MenuButton, MenuToggle } from '../MenuCard';
import { CreatorDice } from '../creator/CreatorDice';
import { GameOpEditor } from '../editor/GameOpEditor';
import { ReglagesApparence, MonsterPartsFields } from '../editor/MonsterPartsFields';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import type { GameOp } from '../../engine/ops';
import { species, careers, levelsForCareer, stars, mutations, rigSpeciesId, allAxes, charAbr, spells, etats, memoParVersion, findPsychologyById } from '../../data';
import { makePregens } from '../../data/pregens';
import { toMoney } from '../../engine/money';
import { RoseAxes } from '../RoseAxes';
import { CharStatsGrid } from '../CharStatsGrid';
import { axesProfile } from '../../engine/axes';
import { GameOpChips } from '../GameOpChips';
import { Band } from '../Band';
import { Grid, Row, Split, Stack, pushEnd, spanFull } from '../Layout';
import { Fleuron, OrnateFrame, RuleDivider } from '../Ornaments';
import { NotchGauge } from '../NotchGauge';
import { WindRose } from '../WindRose';
import { CAREER_CHAR_ADVANCES } from '../creator/draft';
import { ItemIcon } from '../ItemIcon';
import { Icon } from '../Icon';
import { RollLine, PendingRollLine, TableRollLine } from '../RollLine';
import { testBreakdown, testPending } from '../breakdown';
import { RollPanel } from '../RollPanel';
import { DiceRoll } from '../DiceRoll';
import { ForcedRollPicker } from '../ForcedRollPicker';
import { RecapLineList } from '../RecapLine';
import { MultiRollList } from '../MultiRollList';
import { RevealBody } from '../RevealBody';
import { TeamSegments } from '../TeamSegments';
import { LogDrawer } from '../LogDrawer';
import { InspectPanel } from '../InspectPanel';
import { EquipmentPanel } from '../EquipmentPanel';
import { MediaSelect } from '../MediaSelect';
import { RefField, refFieldCfg } from '../compendium/RefField';
import { itemFromTrappingById } from '../../engine/items';
import type { ItemInstance } from '../../engine/types';

// ── Données réelles pour les spécimens vivants (aucune donnée inventée), lues VIVANTES (#1692) ──
const especeHumaine = memoParVersion('species', () => species.find((s) => s.id === 'humains-reiklander') ?? species[0]);
export const sectionsDEspeces = memoParVersion('species', (): PickGridSection[] => {
  const parFamille = new Map<string, typeof species>();
  for (const sp of species) {
    const arr = parFamille.get(sp.family) ?? [];
    arr.push(sp);
    parFamille.set(sp.family, arr);
  }
  return [...parFamille.entries()].slice(0, 3).map(([family, list]) => ({
    id: family,
    label: family,
    items: list.slice(0, 3).map((sp) => ({
      id: sp.id,
      label: sp.label,
      preview: { appearance: { species: rigSpeciesId(sp.id), sex: 'M' as const, build: 0.5, seed: 7 } },
    })),
  }));
});
export const carriereExemple = memoParVersion('careers', () => careers.find((c) => c.id === 'agitateur') ?? careers[0]);
export const niveauxDeLaCarriereExemple = memoParVersion(['careers', 'careerLevels'], () => levelsForCareer(carriereExemple().id));
export const signeAstralExemple = memoParVersion('stars', () => stars[0]);
export const herosExemples = memoParVersion('pregens', () => makePregens());
export const herosExemple = () => herosExemples()[0];
export const herosExempleB = () => herosExemples()[1] ?? herosExemples()[0];

function TokenSwatches() {
  const TOKEN_SWATCHES: { label: string; token: string; role: string }[] = [
    { label: '--bg', token: 'var(--bg)', role: 'fond de scène' },
    { label: '--panel', token: 'var(--panel)', role: 'surface de carte' },
    { label: '--panel2', token: 'var(--panel2)', role: 'surface haute / bouton' },
    { label: '--border', token: 'var(--border)', role: 'bordure standard' },
    { label: '--text', token: 'var(--text)', role: 'encre principale' },
    { label: '--muted', token: 'var(--muted)', role: 'encre atténuée' },
    { label: '--gold', token: 'var(--gold)', role: 'or — bordures/focus' },
    { label: '--gold2', token: 'var(--gold2)', role: 'or vif — titres/valeurs' },
    { label: '--accent', token: 'var(--accent)', role: 'rouge sang — primaire' },
    { label: '--accent2', token: 'var(--accent2)', role: 'rouge sang haut' },
    { label: '--danger', token: 'var(--danger)', role: 'alerte' },
    { label: '--ok', token: 'var(--ok)', role: 'succès' },
    { label: '--parchment', token: 'var(--parchment)', role: 'document clair (accent)' },
    { label: '--ink', token: 'var(--ink)', role: 'encre sur parchemin' },
    { label: '--blood', token: 'var(--blood)', role: 'cire profonde' },
  ];
  return (
    <div className="gallery-swatches">
      {TOKEN_SWATCHES.map((s) => (
        <div className="gallery-swatch" key={s.label}>
          <div className="swatch" style={{ background: s.token }} aria-hidden="true" />
          <div className="gallery-swatch-meta"><b>{s.label}</b>{s.role}</div>
        </div>
      ))}
    </div>
  );
}

function Buttons() {
  return (
    <Row>
      <button type="button" className="btn">Neutre</button>
      <button type="button" className="btn btn-primary">Primaire</button>
      <button type="button" className="btn btn-ghost">Discret</button>
      <button type="button" className="btn btn-test">Outil de test</button>
      <button type="button" className="btn" disabled>Désactivé</button>
    </Row>
  );
}

function Chips() {
  return (
    <Row>
      <span className="chip">Chip simple</span>
      <span className="chip"><b>Nom</b> — détail</span>
      <span className="chip">Compteur <span className="count">3</span></span>
    </Row>
  );
}

function Panels() {
  return (
    <Row>
      <div className="panel" style={{ padding: 12 }}>Surface</div>
      <div className="panel sunken" style={{ padding: 12 }}>Creuse</div>
      <div className="panel gold" style={{ padding: 12 }}>Liseré or</div>
    </Row>
  );
}

function TabsDemo() {
  const [active, setActive] = useState<'a' | 'b' | 'c'>('a');
  const tabs: TabItem<'a' | 'b' | 'c'>[] = [
    { key: 'a', label: 'Onglet A' },
    { key: 'b', label: 'Onglet B', count: 2 },
    { key: 'c', label: 'Onglet C' },
  ];
  return (
    <Stack>
      <Tabs tabs={tabs} active={active} onChange={setActive} label="Onglets" />
    </Stack>
  );
}

function OptionChooserDemo() {
  const [choice, setChoice] = useState<'parry' | 'dodge'>('parry');
  return (
    <Stack>
      <OptionChooser
        layout="seg"
        groupLabel="Réaction (seg)"
        options={[
          { key: 'parry', label: 'Parade', selected: choice === 'parry', onSelect: () => setChoice('parry') },
          { key: 'dodge', label: 'Esquive', selected: choice === 'dodge', onSelect: () => setChoice('dodge') },
          // Segment REFUSÉ : la matière du refus (contrôle éteint, raison au survol/focus/tap) se voit
          // ICI une fois pour TOUS les sites qui la composent — fiche (main secondaire), Porte-Bouclier,
          // Contre-sort, adresse de prose. La raison ne s'écrit JAMAIS sous l'option (2026-08-24).
          { key: 'shield', label: 'Bouclier', selected: false, refus: 'Aucun bouclier équipé dans le set actif.' },
        ]}
      />
      <OptionChooser
        layout="grid"
        groupLabel="Menu (grid)"
        options={[
          { key: 'a', label: 'Option A', onSelect: () => {} },
          { key: 'b', label: 'Option B', onSelect: () => {} },
        ]}
      />
      {/* Grille de TABLE d100 : la fourchette (`range`) fait lire une table là où une grille nue
          ne montre qu'un menu — c'est la forme des tirages à choisir (dé forcé, zone touchée). */}
      <OptionChooser
        layout="grid"
        groupLabel="Table d100 (grid + fourchette)"
        options={[
          { key: 'bas', label: 'Le coup porte bas', range: '01-35', onSelect: () => {} },
          { key: 'haut', label: 'Le coup porte haut', range: '36-00', onSelect: () => {} },
        ]}
      />
      <Row gap="sm" justify="end">
        <ChoiceButtons
          options={[
            { key: 'cancel', label: 'Renoncer', ghost: true, onSelect: () => {} },
            { key: 'ok', label: 'Confirmer', primary: true, onSelect: () => {} },
          ]}
        />
      </Row>
    </Stack>
  );
}

/** Objets RÉELS du catalogue (`trappings.json`), instanciés par la fabrique du moteur — jamais un
 *  objet forgé à la main : la galerie montre ce que le jeu rend. */
function objetsExemple(): ItemInstance[] {
  return ['epee-batarde', 'hallebarde', 'arc', 'bouclier', 'justaucorps-de-cuir', 'corde']
    .map((id) => itemFromTrappingById(id))
    .filter((i): i is ItemInstance => i !== null);
}

/** Silhouette de rig pour arme/armure/bouclier, glyphe de catégorie sinon — aux trois tailles nommées. */
function ItemIconDemo() {
  const objets = objetsExemple();
  if (!objets.length) return <p className="hint">Aucun objet du catalogue n'a pu être instancié.</p>;
  return (
    <Stack>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Row key={size} align="center" gap="lg">
          <span className="hint" style={{ width: 32 }}>{size}</span>
          {objets.map((item) => (
            <span key={item.uid} title={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ItemIcon item={item} size={size} />
            </span>
          ))}
        </Row>
      ))}
    </Stack>
  );
}

/** Sélecteur visuel : rangées `média + libellé + détail`, là où un `<select>` natif ne porte pas d'icône. */
function MediaSelectDemo() {
  const objets = objetsExemple();
  const [choix, setChoix] = useState<string | undefined>(objets[0]?.uid);
  if (!objets.length) return <p className="hint">Aucun objet du catalogue n'a pu être instancié.</p>;
  return (
    <MediaSelect
      options={objets.map((item) => ({
        key: item.uid,
        media: <ItemIcon item={item} size="sm" />,
        label: item.label,
        sub: item.kind,
      }))}
      value={choix}
      onSelect={setChoix}
      placeholder="Choisir un objet"
      title="Sélecteur visuel d'objet"
    />
  );
}

/** Picker de référence multilangue-safe : le LIBELLÉ s'affiche, l'`id` est stocké. Deux des quatre
 *  modes, tous deux sur des configs RÉELLES de `REF_FIELD` : `single` (dataset) et `vocab` (champ). */
function RefFieldDemo() {
  const [classe, setClasse] = useState<unknown>(undefined);
  const [carac, setCarac] = useState<unknown>(undefined);
  const cfgClasse = refFieldCfg('careers', 'class');
  const cfgCarac = refFieldCfg('species', 'refChar');
  if (!cfgClasse || !cfgCarac) return <p className="hint">Config de champ-réf introuvable.</p>;
  return (
    <Stack>
      <RefField cfg={cfgClasse} fieldKey="class" label="Classe de la carrière" value={classe} onChange={setClasse} nullable />
      <RefField cfg={cfgCarac} fieldKey="refChar" label="Caractéristique de référence" value={carac} onChange={setCarac} nullable />
      <p className="hint">Stocké : {JSON.stringify({ class: classe, refChar: carac })}</p>
    </Stack>
  );
}

function QtyStepperDemo() {
  const [n, setN] = useState(1);
  return (
    <QtyStepper
      center={n}
      onDec={() => setN((v) => Math.max(0, v - 1))}
      onInc={() => setN((v) => v + 1)}
      decLabel="Diminuer"
      incLabel="Augmenter"
    />
  );
}

function NumberFieldDemo() {
  const [n, setN] = useState(3);
  const [de, setDe] = useState<number | null>(null);
  const [page, setPage] = useState<number | null>(null);
  return (
    <>
      <NumberField
        id="gallery-number-field"
        label="Joueurs autour de la table"
        min={2}
        max={8}
        value={n}
        unit="joueurs"
        onChange={setN}
      />
      {/* `champ` : le compteur et la plage dite ne tiennent pas dans une rangée de jet. Le commit
          DIFFÉRÉ (`geste`) refuse une saisie hors domaine au lieu de la caler. */}
      <div className="rm-die-pick">
        <NumberField
          variant="champ"
          label="Fixer le dé"
          min={1}
          max={100}
          placeholder="d100"
          commit="geste"
          vide
          value={de}
          onChange={setDe}
        />
      </div>
      {/* `nu` : rangée dense de l'atelier du Codex, le libellé appartient à l'appelant et devient le
          nom accessible du champ ; borne absente = valeur libre de donnée, jamais calée. */}
      <label className="dr">
        page
        <NumberField variant="nu" label="page de la source" placeholder="page" width={72} vide value={page} onChange={setPage} />
      </label>
    </>
  );
}

/** Réf de source RÉELLE d'un sort du registre, montrée par le spécimen de `SourceRefField`. */
const sourceDeSort = memoParVersion('spells', () => spells.find((s) => s.source?.note)?.source ?? spells[0].source);

function SourceRefFieldDemo() {
  // Facultative puis exigée, chacune vide / incomplète / complète : un brouillon incomplet reste à
  // l'écran et se dit incomplet, seule une réf complète remonte.
  type Saisie = { book?: string; page?: number; note?: string } | undefined;
  const reelle = sourceDeSort();
  const [vide, setVide] = useState<Saisie>(undefined);
  const [livreSeul, setLivreSeul] = useState<Saisie>({ book: reelle.book });
  const [complete, setComplete] = useState<Saisie>(reelle);
  const [exigeeVide, setExigeeVide] = useState<Saisie>(undefined);
  const [exigeeIncomplete, setExigeeIncomplete] = useState<Saisie>({ book: reelle.book, note: reelle.note });
  const [exigee, setExigee] = useState<Saisie>(reelle);
  return (
    <>
      <SourceRefField identite="facultative-vide" label="Facultative — vide" facultative value={vide} onChange={setVide} />
      <SourceRefField identite="facultative-livre-seul" label="Facultative — livre seul (incomplète)" facultative value={livreSeul} onChange={setLivreSeul} />
      <SourceRefField identite="facultative-complete" label="Facultative — complète" facultative value={complete} onChange={setComplete} />
      <SourceRefField identite="exigee-vide" label="Exigée — vide" value={exigeeVide} onChange={setExigeeVide} />
      <SourceRefField identite="exigee-incomplete" label="Exigée — page manquante (incomplète)" value={exigeeIncomplete} onChange={setExigeeIncomplete} />
      <SourceRefField identite="exigee-complete" label="Exigée — complète" value={exigee} onChange={setExigee} />
    </>
  );
}

function DescRefFieldDemo() {
  // Adresse RÉELLE : celle que porte la Terreur (`psychology.json`). Le chapitre arrive par son
  // adresse-URL (assets émis par `wfrp:prose-source`) — hors serveur, le champ affiche son erreur nommée.
  const [adresse, setAdresse] = useState<DescRef | undefined>(() => findPsychologyById('terreur')?.descRef);
  return <DescRefField label="Adresse de la prose" value={adresse} onChange={setAdresse} />;
}

function GroupedPickGridDemo() {
  const [sel, setSel] = useState<string | undefined>(sectionsDEspeces()[0]?.items[0]?.id);
  return <GroupedPickGrid sections={sectionsDEspeces()} selectedId={sel} onSelect={setSel} label="Choix d'espèce" />;
}

/** Cadre-figurine unique (#430/#431) — patron `.fam-tile` de la planche : rivets d'or, boîte-figurine
 *  à hauteur FIXE sur sa lueur de sol, nom et compte DESSOUS. Les trois états de la tuile `compact`
 *  (repos, élue au liseré doré, scellée) + la variante `big` (grille de race, prop `fig`) — aucun
 *  cadre imbriqué, aucune ambiance : la tuile porte sa propre matière. */
function FigTileDemo() {
  return (
    <Row>
      <div style={{ width: 140 }}>
        <FigTile
          preview={{ appearance: { species: rigSpeciesId(especeHumaine().id), sex: 'M', build: 0.5, seed: 7 } }}
          label={especeHumaine().label}
          sub="Non sélectionné"
          onClick={() => {}}
          tabIndex={0}
        />
      </div>
      <div style={{ width: 140 }}>
        <FigTile
          preview={{ appearance: { species: rigSpeciesId(especeHumaine().id), sex: 'F', build: 0.5, seed: 7 } }}
          label={especeHumaine().label}
          sub="Sélectionné"
          selected
          onClick={() => {}}
          tabIndex={0}
        />
      </div>
      <div style={{ width: 140 }}>
        <FigTile
          preview={{ appearance: { species: rigSpeciesId(especeHumaine().id), sex: 'M', build: 0.5, seed: 9 } }}
          label={especeHumaine().label}
          sub="Scellé"
          sealed
          onClick={() => {}}
          tabIndex={0}
        />
      </div>
      <div style={{ width: 213 }}>
        <FigTile
          preview={{ appearance: { species: rigSpeciesId(especeHumaine().id), sex: 'F', build: 0.5, seed: 11 } }}
          label={especeHumaine().label}
          sub="Variante pleine zone"
          fig="big"
          onClick={() => {}}
          tabIndex={0}
        />
      </div>
      <div style={{ width: 180 }}>
        <FigTile
          preview={{ appearance: { species: rigSpeciesId(especeHumaine().id), sex: 'M', build: 0.5, seed: 13 } }}
          fig="hero"
          zoneBadges={FIG_ZONE_BADGES_PA}
        />
        <p className="hint">Colonne-index (#492) : PA d'armure</p>
      </div>
      <div style={{ width: 180 }}>
        <FigTile
          preview={{ appearance: { species: rigSpeciesId(especeHumaine().id), sex: 'M', build: 0.5, seed: 13 } }}
          fig="hero"
          zoneBadges={FIG_ZONE_BADGES_CRIT}
        />
        <p className="hint">Colonne-index (#492) : critiques/séquelles</p>
      </div>
    </Row>
  );
}

/** Langage PA (onglet Possessions) — 6 Localisations, `dim` vide/`or` chargé/`sang` entamée. */
const FIG_ZONE_BADGES_PA: ZoneBadgeSpec[] = [
  { loc: 'tete', label: 'Tête', value: 1, tone: 'or' },
  { loc: 'brasG', label: 'Bras gauche', value: 0, tone: 'dim' },
  { loc: 'brasD', label: 'Bras droit', value: 1, tone: 'sang' },
  { loc: 'corps', label: 'Corps', value: 2, tone: 'or' },
  { loc: 'jambeG', label: 'Jambe gauche', value: 0, tone: 'dim' },
  { loc: 'jambeD', label: 'Jambe droite', value: 0, tone: 'dim' },
];

/** Langage critiques/séquelles (onglet État) — seules les zones TOUCHÉES, clic = ancre. */
const FIG_ZONE_BADGES_CRIT: ZoneBadgeSpec[] = [
  { loc: 'tete', label: 'Tête', value: 1, tone: 'sang', onClick: () => {} },
  { loc: 'brasG', label: 'Bras gauche', value: 1, tone: 'warn', onClick: () => {} },
];

/** Rangée-plaque à rivets d'or (#393) : rangées de registre aux valeurs RÉELLES du pré-tiré
 *  (repos, roulant à dés compacts) + plaques d'option (élue `.sel` chaude, au repos) + rangée
 *  d'ALLOCATION à rubrique gravée (`sub` = le `.rf` de la planche, étape 5) — les états de la
 *  primitive, aucune rangée recodée. */
function PlaqueRowDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  const ch = tableTotale(CHAR_KEYS, (k) => effectiveChar(herosExemple(), k));
  const [k1, k2, k3] = CHAR_KEYS;
  return (
    <Stack>
      <PlaqueGrid>
        {[k1, k2].map((k) => (
          <PlaqueRow key={k} prefix={charAbr(k)} content={CHAR_LABELS[k]} value={ch[k]} />
        ))}
        <PlaqueRow
          prefix={charAbr(k3)}
          content={CHAR_LABELS[k3]}
          rolling
          meta={
            <Row as="span">
              <span className="rm-die"><DieFace n={5} landed tone="gold" /></span>
              <span className="rm-die"><DieFace n={6} landed tone="gold" /></span>
            </Row>
          }
          value={ch[k3]}
        />
        <PlaqueRow content="Aux dés — garder le tirage" selected meta={<em>+50 PX</em>} />
        <PlaqueRow content="Répartir 100 points" meta={<em>0 PX</em>} />
        {/* Rangée d'ALLOCATION (étape 5) : la rubrique gravée porte la carac liée et son cumul —
            la plaque s'empile alors sur deux lignes, un libellé long ne se tronque jamais. */}
        <PlaqueRow
          content="Corps à corps (Base)"
          sub={`${CHAR_LABELS[k1]} ${ch[k1]} → ${ch[k1] + 5} · +5 de race`}
          selected
          value="+5"
        />
        <PlaqueRow content="Résistance à l'alcool" sub={`${CHAR_LABELS[k2]} ${ch[k2]}`} value="—" />
      </PlaqueGrid>
    </Stack>
  );
}

function MetalStatusDemo() {
  return (
    <Row>
      <MetalStatus status="Bronze 1" />
      <MetalStatus status="Argent 2" />
      <MetalStatus status="Or 3" />
      <MetalStatus status="Or 3" size="plaque" />
    </Row>
  );
}

function CharStatsGridDemo() {
  return (
    <Stack>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size}>
          <span className="hint">size=&quot;{size}&quot;</span>
          <CharStatsGrid size={size} value={(k) => effectiveChar(herosExemple(), k)} />
        </div>
      ))}
    </Stack>
  );
}

function WaxSealDemo() {
  return (
    <Row>
      <WaxSeal size={40} />
      <SealedPlaque title={carriereExemple().label} desc="Carrière élue" selected />
      <SealedPlaque title="Carrière non retenue" desc="Autre proposition" />
    </Row>
  );
}

function DetailFrameDemo() {
  return (
    <DetailFrame
      label={carriereExemple().label}
      meta={<MetalStatus status={niveauxDeLaCarriereExemple()[0]?.status ?? 'Bronze 1'} />}
      prose={carriereExemple().desc}
      porteur={{ type: 'careers', id: carriereExemple().id, chemin: 'desc' }}
    />
  );
}

function HeroSheetDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <Stack>
      <p className="hint">`header` (bande figurine+identité+rose) : composé tel quel par le détail candidat de l'écran d'équipe.</p>
      <HeroSheet hero={herosExemple()} />
      <p className="hint">`header={false}` : composé par la fiche vivante du créateur (alcôve propre à l'appelant).</p>
      <HeroSheet hero={herosExemple()} header={false} />
    </Stack>
  );
}

/** Gabarit d'étape du créateur — MÊME exception que `ScreenShell` : un gabarit PLEIN-CHAMP ne se
 *  monte pas en vignette. Sa grille (`.creator-step`, `minmax(0,1fr) minmax(320px,600px)`) réclame la
 *  largeur d'un écran, et son repli est piloté par des `@media` de VIEWPORT — dans le panneau de la
 *  galerie (~660px, viewport large) la zone de choix serait réduite à un filet, ce qui donnerait à
 *  voir un gabarit CASSÉ plutôt que l'ossature. Il s'observe donc là où il vit, en grandeur réelle. */
function CreatorStepFrameNote() {
  return (
    <p className="hint">
      Gabarit PLEIN-CHAMP non montable en vignette : `CreatorStepFrame` réclame la largeur d'un écran
      (grille `minmax(0,1fr) minmax(320px,600px)`, repli au `@media` de viewport) — s'observe en
      grandeur réelle sur les 7 pas du créateur (Race → Détails), zones estampillées
      `data-testid="creator-slot-(action|choice|desc)"`. La garde `creator-ossature.test.tsx` monte
      les 8 étapes et vérifie ces slots ; les meubles qu'il accueille (`StepHeader`, `PlaqueRow`,
      `CreatorDice`) ont, eux, leur spécimen vivant ici.
    </p>
  );
}

function CreatorDiceDemo() {
  return (
    <Stack>
      <CreatorDice label={`Tirer le Signe astral (d100) — ${signeAstralExemple()?.label ?? ''}`} rolled={false} xp={20} onRoll={() => {}} />
      <CreatorDice rolled xp={20}>
        <p className="hint">Résultat gardé — {signeAstralExemple()?.label}.</p>
      </CreatorDice>
    </Stack>
  );
}

/** Barre de remplissage lisse (#492, arbitrage 2026-07-17) — ton par palier (Blessures, données réelles
 *  du pré-tiré), dépassement explicite (Encombrement, valeur illustrative > max). La variante `overlay`
 *  (portraits compacts) s'observe au spécimen `PortraitTile`, en dessous. `stacked` (arbitrage
 *  2026-07-17, « ça ne va pas être possible » sur deux `row` désalignées) : valeur au-dessus, piste
 *  pleine largeur — l'aside de la fiche l'utilise pour Blessures ET Encombrement, mêmes barres. */
function LifeBarDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <Stack>
      <LifeBar
        label="Blessures"
        value={herosExemple().wounds.current}
        max={herosExemple().wounds.max}
        tone={(v, m) => (m > 0 && v / m <= 0.34 ? 'danger' : m > 0 && v / m <= 0.67 ? 'warn' : 'ok')}
      />
      <LifeBar label="Encombrement — surchargé" value={9} max={6} tone="danger" />
      <LifeBar
        stacked
        label="Blessures (stacked)"
        value={herosExemple().wounds.current}
        max={herosExemple().wounds.max}
        tone={(v, m) => (m > 0 && v / m <= 0.34 ? 'danger' : m > 0 && v / m <= 0.67 ? 'warn' : 'ok')}
      />
      <LifeBar stacked label="Encombrement (stacked) — surchargé" value={9} max={6} tone="danger" />
    </Stack>
  );
}

function PortraitTileDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <Row>
      <PortraitTile c={herosExemple()} ring="var(--gold)" variant="identity" size="md" />
      <PortraitTile c={herosExemple()} ring="var(--gold)" variant="vital" size="md" />
      <PortraitTile c={herosExemple()} ring="var(--gold)" variant="full" size="md" active />
    </Row>
  );
}

function CharacterPreviewDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return <CharacterPreview hero={herosExemple()} size="lg" ambiance="panel" />;
}

function ScreenMetaDemo() {
  return <ScreenMeta meta={{ time: 0, money: toMoney({ gold: 12, silver: 4, brass: 8 }) }} />;
}

/** Le cadre réel, ouvert par un geste : titre, corps qui défile, pied `footer` hors du corps. */
function ModalDemo() {
  const [ouverte, setOuverte] = useState(false);
  const fermer = () => setOuverte(false);
  return (
    <>
      <button className="btn" onClick={() => setOuverte(true)}>Ouvrir la modale</button>
      {ouverte && (
        <Modal
          title="Exemple — Repos"
          onClose={fermer}
          footer={
            <>
              <button className="btn btn-ghost" onClick={fermer}>Annuler</button>
              <button className="btn btn-primary" onClick={fermer}>Confirmer</button>
            </>
          }
        >
          <p>Le corps défile ; le pied reste sous un filet, ferré à la fin.</p>
        </Modal>
      )}
    </>
  );
}

/** La planche réelle, ouverte par un geste : aside permanente, onglets, corps d'onglet. */
function PlancheDemo() {
  const [ouverte, setOuverte] = useState(false);
  const [onglet, setOnglet] = useState<'a' | 'b'>('a');
  return (
    <>
      <button className="btn" onClick={() => setOuverte(true)}>Ouvrir la planche</button>
      {ouverte && (
        <Planche
          nom="Exemple — planche"
          kind="galerie-planche"
          onClose={() => setOuverte(false)}
          aside={<p>Présence permanente.</p>}
          tabs={<Tabs tabs={[{ key: 'a' as const, label: 'Premier' }, { key: 'b' as const, label: 'Second' }]} active={onglet} onChange={setOnglet} />}
        >
          <p>{onglet === 'a' ? 'Le corps d’onglet défile seul.' : 'Second onglet.'}</p>
        </Planche>
      )}
    </>
  );
}

/** Les gestes des trois cadres, hors de tout cadre : la croix, puis le pied (ghost au début,
 *  primaire à la fin). */
function CadreDemo() {
  return (
    <div>
      <CadreFermer onClose={() => {}} />
      <CadrePied>
        <button className="btn btn-ghost">Annuler</button>
        <button className="btn btn-primary">Confirmer</button>
      </CadrePied>
    </div>
  );
}

function GatedActionDemo() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <GatedAction id="gal-gated" label="Entrer" enabled={false} reason="Bourse insuffisante." onClick={() => {}} />
      {/* Variante DENSE : la même action dans une COLONNE étroite (pied de la frise d'initiative). */}
      <div style={{ width: 84 }}>
        <GatedAction id="gal-gated-dense" label="Pause au prochain Round" enabled dense onClick={() => {}} />
      </div>
    </div>
  );
}

/** Rangée de ready-check VIVANTE : les sièges qu'elle montre sont ceux que le dispatcher ATTEND
 *  (`siegesRequis`, lu sur le store réel — hors coop, l'hôte seul). Deux poses : attendu, puis validé. */
function ReadyRowDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ReadyRow ready={{}} />
      <ReadyRow ready={{ 0: true }} />
    </div>
  );
}

/** Le bloc d'invitation de l'hôte : la plaque du code et ses deux gestes de copie. */
function CoopInviteDemo() {
  return <CoopInvite code="AB12CD" onCopierCode={() => {}} onCopierLien={() => {}} />;
}

/** Le champ du code côté invité : ce qu'on frappe remonte en MAJUSCULES, six caractères au plus. */
function CoopCodeInputDemo() {
  const [code, setCode] = useState('ab12');
  return <CoopCodeInput valeur={code} onChange={setCode} placeholder="CODE" />;
}

/** Les trois états d'un siège : l'hôte (c'est moi), un invité connecté, un invité en reconnexion. */
function SeatListDemo() {
  return <SeatList sieges={[
    { seat: 0, nom: 'Hôte', moi: true, absent: false },
    { seat: 1, nom: 'Antoine', moi: false, absent: false },
    { seat: 2, nom: 'Béa', moi: false, absent: true },
  ]} />;
}

/** Deux lignes d'attribution DANS une surface : une personne (portrait + nom) et un RÔLE (sans
 *  portrait). Le panneau est ce qui compte ici — c'est lui qui empilerait ces lignes en colonne si
 *  `label.coop-assign-row` ne renversait pas `.panel label`. */
function CoopAssignRowDemo() {
  const heros = herosExemples()[0];
  const sieges = [{ valeur: 0, libelle: 'Hôte' }, { valeur: 1, libelle: 'Antoine' }];
  return (
    <section className="panel">
      <CoopAssignRow
        portrait={heros ? <CharFrame c={heros} variant="identity" size="xs" /> : undefined}
        libelle={heros?.label ?? 'Héros'}
        valeur={0}
        options={sieges}
        onChange={() => {}}
      />
      <CoopAssignRow
        libelle="Maître du Jeu"
        valeur=""
        options={[{ valeur: '', libelle: 'IA (aucun MJ)' }, ...sieges]}
        onChange={() => {}}
      />
    </section>
  );
}

/** Bandeau de liaison : il se pose en HAUT DU CHAMP (position fixe), au-dessus de l'écran courant. */
function CoopBannerDemo() {
  return <CoopBanner icone="ui/warning">Béa : reconnexion en cours…</CoopBanner>;
}

/** Deux lignes de butin : une lame CATALOGUÉE non identifiée (la révélation est offerte) et un objet
 *  custom déjà identifié. La Détection d'artefact n'apparaît que si un héros DE LA PARTIE porte le
 *  Talent (`bestDetector`) : sans partie en cours, la ligne ne montre qu'Évaluer. */
function GearAssignListDemo() {
  const heros = herosExemples().slice(0, 3);
  if (!heros.length) return <p className="hint">Aucun pregen disponible.</p>;
  const gear: LootGear[] = [
    { label: 'Lame finement ouvragée', magic: true, effect: { type: 'giveTrapping', trappingId: 'arme-simple', qualities: [{ id: 'precise' }], identified: false } },
    { label: 'Clef', magic: false, effect: { type: 'giveTrapping', trappingId: 'clef' } },
  ];
  return <GearAssignList gear={gear} assignable={heros} onAssign={() => {}} onAppraise={() => {}} />;
}

/** Récapitulatif de gain COMPLET : ambiance, PX, or, rubriques titrées — la forme que montrent à
 *  l'identique l'écran de victoire et la fenêtre de butin (le geste de sortie est au pied de leur cadre). */
function RewardRecapDemo() {
  return (
    <div className="gallery-colonne">
      <RewardRecap
        messages={['La foule scande votre nom — l’arène a trouvé son vainqueur.']}
        xp={120}
        gold={{ gold: 5, silver: 12, brass: 8 }}
        sections={[
          {
            id: 'equipement',
            titre: <><Icon id="resource/gold-purse" size="sm" /> Équipement — qui l’emporte&nbsp;?</>,
            enAvant: true,
            children: <Row><span className="chip">Bâton de combat</span><span className="chip">Dague</span></Row>,
          },
          {
            id: 'vaincus',
            titre: 'Ennemis vaincus',
            children: <Row><span className="chip">Mutant ×3</span><span className="chip">Meneur</span></Row>,
          },
        ]}
      />
    </div>
  );
}

/** Limite d'erreur VIVANTE, mais sur GESTE : au repos elle est transparente, le bouton fait lever son
 *  enfant, et la vraie garde de classe rend le panneau de reprise que le joueur verrait. Le crash part
 *  au collecteur DEV (`recordError`) comme en partie — c'est pourquoi il n'est PAS joué au montage : un
 *  spécimen ne remplit pas le bandeau d'erreurs de qui ouvre la galerie. La pose de niveau ÉCRAN
 *  (`app-error-boundary`, `position: fixed`) recouvrirait la galerie : elle s'observe au banc
 *  (`src/ui/SceneErrorBoundary.test.tsx`). */
function SceneErrorBoundaryDemo() {
  const [casse, setCasse] = useState(false);
  const Enfant = () => {
    if (casse) throw new Error('Spécimen de galerie : crash de rendu');
    return <p className="hint">Rendu normal — la limite ne se voit pas tant que rien ne lève.</p>;
  };
  return (
    <Stack gap="sm">
      <button className="btn" onClick={() => setCasse(true)}>Provoquer un crash de rendu</button>
      <SceneErrorBoundary retryLabel="Réessayer" onRetry={() => setCasse(false)}>
        <Enfant />
      </SceneErrorBoundary>
    </Stack>
  );
}

/** Trois Sorts RÉELS du catalogue portant un NI (`cn`) — la matière du panneau « Quel Sort
 *  dissiper ? » de la console, sans rien inventer. */
const sortsADissiper = memoParVersion('spells', () => spells.filter((s) => typeof s.cn === 'number').slice(0, 3));

/** Référence au Codex VIVANTE : un libellé qui ouvre la fiche, un contrôle enveloppé (`wrap`) dont
 *  ↓ épingle l'infobulle et sa porte, un contrôle refusé dont la raison se lit au survol. */
function CodexRefDemo() {
  return (
    <div className="row gap-sm">
      <CodexRef category="talents" id="affable" label="Affable" />
      <CodexRef category="talents" id="affable" label="Affable" wrap>
        <button type="button" className="btn small">Affable ×2</button>
      </CodexRef>
      <CodexRef label="Charger" refus="Vous êtes Engagé." wrap>
        <button type="button" className="btn small" aria-disabled="true">Charger</button>
      </CodexRef>
    </div>
  );
}

/** Couche d'infobulle VIVANTE : un ancrage (un bouton), sa boîte au survol et au focus, ↓ qui
 *  l'épingle et y porte le focus sur son seul contrôle, Échap qui la congédie. Le contenu est celui
 *  du spécimen, jamais une classe d'un consommateur. */
function InfobulleDemo() {
  const bulle = useInfobulle({ atteignable: true, epinglable: true, sourdine: false, auToucher: false });
  const [lu, setLu] = useState(0);
  return (
    <div className="col gap-sm">
      <span {...bulle.ancrage}>
        <button type="button" className="chip">Survoler ou focaliser</button>
      </span>
      <span className="hint">{`Contrôle de la boîte activé ${lu} fois`}</span>
      {bulle.boite(
        <>
          <span>Le texte entier de l’ancrage, lu au survol, au focus, et au doigt.</span>
          <button type="button" className="btn btn-ghost" data-atteignable="" onClick={() => setLu((n) => n + 1)}>Activer</button>
        </>,
      )}
    </div>
  );
}

/** Boîte ancrée VIVANTE : placée contre son bouton, du côté qui a le plus de place. */
function BoiteAncreeDemo() {
  const [bouton, setBouton] = useState<HTMLElement | null>(null);
  const placement = usePlacementAncre(bouton, 280);
  return (
    <div className="col gap-sm">
      <button type="button" className="chip" aria-expanded={!!bouton} onClick={(e) => setBouton(bouton ? null : e.currentTarget)}>
        Boîte ancrée
      </button>
      {placement && <BoiteAncree placement={placement} className="panel">Boîte placée contre son ancrage.</BoiteAncree>}
    </div>
  );
}

/** Panneau-paramètre VIVANT : un déclencheur, le panneau qui en NAÎT (ancré à son rect), un clic qui
 *  commet ET referme, Échap/clic-dehors qui annulent sans rien engager. Le choix retenu s'affiche
 *  sous le bouton — un panneau muet ne montrerait pas que le clic COMMET. */
function PanneauParametreDemo() {
  const declencheur = useRef<HTMLButtonElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(null);
  if (!sortsADissiper().length) return <p className="hint">Aucun Sort à NI dans le catalogue.</p>;
  return (
    <div className="col gap-sm">
      <button ref={declencheur} type="button" className="chip" aria-haspopup="dialog" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
        Dissiper
      </button>
      <span className="hint">{choisi ? `Sort choisi : ${choisi}` : 'Aucun Sort choisi'}</span>
      {ouvert && (
        <PanneauParametre
          anchor={declencheur.current}
          intitule="Quel Sort dissiper ?"
          options={sortsADissiper().map((s) => ({
            key: s.id,
            label: s.label,
            meta: `NI ${s.cn}`,
            onSelect: () => setChoisi(s.label),
          }))}
          onClose={() => setOuvert(false)}
        />
      )}
    </div>
  );
}

function ParchmentCardDemo() {
  return (
    <Stack>
      <ParchmentCard title="Événement" seal={{ label: 'Tirage', roll: 42 }} tone="ok">
        Récit ponctuel adossé à un tirage d100 — texture parcheminée + médaillon du tirage.
      </ParchmentCard>
      <ParchmentCard seal={{ kind: 'cire' }}>
        Texte d’auteur SCELLÉ (#717) — aucun tirage à montrer : le cachet de cire franchit le bord.
      </ParchmentCard>
    </Stack>
  );
}

function InfluenceRowDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  // Jet POSÉ et RATÉ, jamais relancé : la vitrine montre le cycle d'influence AU COMPLET (les
  // fenêtres sont dérivées des prédicats du seam, aucune n'est forcée ici).
  return <InfluenceRow actor={herosExemple()} roll={{ rolled: true, failed: true }} onReroll={() => {}} onBonusSL={() => {}} onDarkPact={() => {}} onForce={() => {}} />;
}

function VsHeaderDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return <VsHeader actor={herosExemple()} target={herosExempleB()} label="Épée · Dégâts 6 + DR" />;
}

function MasterDetailDemo() {
  const [sel, setSel] = useState<'x' | 'y'>('x');
  return (
    <MasterDetail
      listLabel="Exemple de maître-détail"
      list={
        <Stack>
          <button type="button" className="btn gallery-list-item" onClick={() => setSel('x')}>Élément X</button>
          <button type="button" className="btn gallery-list-item" onClick={() => setSel('y')}>Élément Y</button>
        </Stack>
      }
      detail={<p>Détail de l'élément « {sel === 'x' ? 'X' : 'Y'} ».</p>}
    />
  );
}

function SearchFilterFieldDemo() {
  const items = ['Épée', 'Hallebarde', 'Arquebuse', 'Dague'];
  const { search, setSearch, filtered } = useFilteredList(items, (i) => i);
  return (
    <Stack>
      <SearchFilterField value={search} onChange={setSearch} placeholder="Filtrer…" icon />
      <Row>{filtered.map((i) => <span className="chip" key={i}>{i}</span>)}</Row>
    </Stack>
  );
}

function TradeTableDemo() {
  interface Row { id: string; label: string; dmg: string; price: { gold: number; silver: number; brass: number } }
  const rows: Row[] = [
    { id: 'r1', label: 'Exemple — Épée', dmg: '+4', price: toMoney({ silver: 6, brass: 8 }) },
    { id: 'r2', label: 'Exemple — Dague', dmg: '+2', price: toMoney({ silver: 1 }) },
  ];
  const columns: TradeColumn<Row>[] = [{ key: 'dmg', label: 'Dégâts', emph: true, render: (r) => r.dmg }];
  const groups: TradeGroup<Row>[] = [{ key: 'g', rows }];
  return (
    <TradeTable
      columns={columns}
      groups={groups}
      rowKey={(r) => r.id}
      label={(r) => r.label}
      price={(r) => r.price}
      action={() => <button type="button" className="btn small">Acheter</button>}
    />
  );
}

function ActivityPaneDemo() {
  return (
    <ActivityPane id="pane-gallery-demo" icon="nav/activity" title="Exemple d'Activité" desc="*Description verbatim* — rendue via `Prose`." cost="6 sc" actions={<button type="button" className="btn btn-primary">Entreprendre</button>} />
  );
}

function ProseDemo() {
  // La prose sourcée se montre dans son hôte canonique (`DetailFrame`, qui possède `.detail-frame-prose`)
  // plutôt qu'en recopiant sa peau : le spécimen reste celui de `Prose`, monté vivant. Le cadre du
  // `DetailFrame` autour de la démo (galerie DEV, aucun écran joueur) est le contexte
  // réel de lecture de cette prose.
  return (
    <DetailFrame prose={carriereExemple().desc} porteur={{ type: 'careers', id: carriereExemple().id, chemin: 'desc' }} />
  );
}

function MenuCardDemo() {
  const [toggled, setToggled] = useState(false);
  return (
    <MenuCard header={<h3 style={{ margin: 0 }}>Exemple de menu</h3>}>
      <MenuSection rule={false}>
        <MenuButton icon="nav/new-game" tone="primary" onClick={() => {}}>Action primaire</MenuButton>
        <MenuButton icon="nav/rules" onClick={() => {}}>Action secondaire</MenuButton>
      </MenuSection>
      <MenuSection label="Réglages">
        <MenuToggle checked={toggled} onChange={setToggled}>Interrupteur</MenuToggle>
      </MenuSection>
    </MenuCard>
  );
}

function RoseAxesDemo() {
  if (herosExemples().length < 2) return <p className="hint">Aucun pregen disponible.</p>;
  const CORE = allAxes.filter((a) => a.core);
  const heroes = herosExemples().slice(0, 3);
  return (
    <Stack>
      <p className="hint">Scores RÉELS des pré-tirés (`axesProfile`, `src/engine/axes.ts`) sur les axes du socle de base.</p>
      <Row>
        <RoseAxes axes={axesProfile(heroes[0], CORE)} size="glyph" title={`${heroes[0].label} — glyphe`} />
        <RoseAxes axes={axesProfile(heroes[0], CORE)} size="medal" title={`${heroes[0].label} — médaillon`} />
      </Row>
      <RoseAxes axes={axesProfile(heroes[0], CORE)} size="grand" title={`${heroes[0].label} — rendu plein`} />
      <Row>
        {heroes.map((h) => (
          <Stack key={h.id} align="center">
            <RoseAxes axes={axesProfile(h, CORE)} size="medal" title={`${h.label} — médaillon`} />
            <span className="hint">{h.label}</span>
          </Stack>
        ))}
      </Row>
    </Stack>
  );
}

/** Bande titrée de rubrique (#492 Lot 0) — même patron « Augmentations gratuites » que le créateur
 *  (`CharacterCreator.tsx`) : titre + sous-titre, compteur d'allocation à droite, contenu réel
 *  (rangées de caractéristiques de carrière du pré-tiré). */
function BandDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  const careerKeys = CHAR_KEYS.slice(0, 3);
  const alloc = CAREER_CHAR_ADVANCES - 2;
  return (
    <Band
      title={<>Augmentations gratuites<small>{CAREER_CHAR_ADVANCES} sur les Caractéristiques de carrière</small></>}
      right={<b className={alloc === CAREER_CHAR_ADVANCES ? 'ok-text' : 'warn-text'}>{alloc}/{CAREER_CHAR_ADVANCES}</b>}
    >
      <PlaqueGrid>
        {careerKeys.map((k) => (
          <PlaqueRow key={k} prefix={charAbr(k)} content={CHAR_LABELS[k]} value={effectiveChar(herosExemple(), k)} />
        ))}
      </PlaqueGrid>
    </Band>
  );
}

function GameOpEditorDemo() {
  const [ops, setOps] = useState<GameOp[]>([]);
  return <GameOpEditor ops={ops} onChange={setOps} />;
}

function ReglagesApparenceDemo() {
  const [a, setA] = useState<EntityAppearance>({ sex: 'F', build: 0.4 });
  return (
    <div className="ed-field">
      <span>Apparence</span>
      <ReglagesApparence appearance={a} onChange={setA} reglages={['species', 'sex', 'build', 'hairstyle', 'variante']} />
      <MonsterPartsFields appearance={a} onChange={setA} reglages={['monster', 'eyes', 'tenue']} />
    </div>
  );
}

/** Ops RÉELLES (mutations.json) : charMod (ancré Caractéristiques) + grantTalent (ancré Talents) de
 *  « Tête bestiale (Chien) », `ap` (sans ancre Codex → repli `humanizeOp` en phrase) de « Tête pointue ». */
const gameOpChipsDemoOps = (): GameOp[] => [
  ...(mutations.find((m) => m.id === 'tete-bestiale-chien')?.passive ?? []),
  ...(mutations.find((m) => m.id === 'tete-pointue')?.passive?.filter((o) => o.op === 'ap') ?? []),
];

function GameOpChipsDemo() {
  return (
    <Row className="skill-tags">
      <GameOpChips ops={gameOpChipsDemoOps()} />
    </Row>
  );
}

/** RollShell/RollRow : un spécimen VIVANT exigerait un flux de jet monté (store + `makeRollFlow`),
 *  hors de portée d'une vignette de galerie. La coquille se montre dans sa zone EMBARQUÉE
 *  (`EmbeddedShell`, le cadre réel sans voile), la rangée par sa classe canon `.prow`, légendées. */
function RollShellStaticMock() {
  return (
    <EmbeddedShell
      title="Attaque — maquette statique"
      footer={
        <>
          <button type="button" className="btn btn-ghost">Annuler</button>
          <button type="button" className="btn btn-primary">Lancer</button>
        </>
      }
    >
      <p className="hint">États : Lancer → Chance/Pacte → Résilience → Appliquer (pied du cadre, `.rm-influence`).</p>
    </EmbeddedShell>
  );
}
function RollRowStaticMock() {
  return (
    <div className="prow" style={{ position: 'static' }}>
      <p className="hint">Une rangée de `RollShell` (mono = N=1) — maquette statique, cf. entrée « RollShell ».</p>
    </div>
  );
}

function ScreenShellNote() {
  return (
    <p className="hint">
      Maquette d'états non applicable : la coquille `ScreenShell` EST le cadre de CETTE galerie
      (voile, en-tête, corps borné) — s'observe directement en pourtour de cet écran.
    </p>
  );
}

/** COUCHE LAYOUT (#1800) — les quatre concepts de placement, montés sur des données réelles et sans
 *  un seul `style=` : ce que la galerie montre, c'est la GÉOMÉTRIE que l'écran n'a plus à écrire. */
function LayoutDemo() {
  const quatre = herosExemples().slice(0, 4);
  return (
    <Stack gap="xl">
      <Band title="Stack — pile (gap sur l'échelle)">
        <Stack gap="sm">
          {quatre.map((h) => <span key={h.id} className="hint">{h.label}</span>)}
        </Stack>
      </Band>
      <Band title="Row — rangée qui s'enroule (justify / pushEnd)">
        <Row gap="md" justify="between">
          {quatre.map((h) => <span key={h.id} className="chip">{h.label}</span>)}
          <button type="button" className="btn small" {...pushEnd}>Au bout</button>
        </Row>
      </Band>
      <Band title="Grid — grille de cartes (min=sm, spanFull)">
        <Grid min="sm" gap="lg">
          {quatre.map((h) => (
            <Stack className="panel sunken" gap="sm" key={h.id}>
              <strong>{h.label}</strong>
              <span className="hint clamp">{h.career ?? '—'}</span>
            </Stack>
          ))}
          <span className="hint" {...spanFull}>Un enfant `spanFull` occupe toute la largeur.</span>
        </Grid>
      </Band>
      <Band title="Split — colonne bornée + contenu (aside=sm, s'empile sous 700)">
        <Split aside="sm" gap="lg">
          <Stack gap="xs">
            {quatre.map((h) => <button type="button" className="btn small" key={h.id}>{h.label}</button>)}
          </Stack>
          <div className="panel">Le détail prend la place restante, sans largeur écrite à la main.</div>
        </Split>
      </Band>
    </Stack>
  );
}

/** Ornements maison : filet titré, fleuron, cadre. */
function OrnamentsDemo() {
  return (
    <Stack gap="lg">
      <RuleDivider label="Filet titré" />
      <Row gap="md" align="center"><Fleuron /><span className="hint">Fleuron seul (filet sans libellé)</span></Row>
      <OrnateFrame tone="gold"><span className="hint">Cadre ornementé, ton or</span></OrnateFrame>
      <OrnateFrame><span className="hint">Cadre ornementé, ton fer (défaut)</span></OrnateFrame>
    </Stack>
  );
}

/** Jauge à CRANS : domaine, seuils, ton, piste à taille fixe. */
function NotchGaugeDemo() {
  return (
    <Stack gap="lg">
      <NotchGauge label="Coque" value={7} max={10} tone="ok" />
      <NotchGauge label="Moral d'équipage" value={3} max={10} tone="warn" />
      <NotchGauge label="Surcharge" value={118} max={140} notches={14} marks={[100, 120]} />
      <NotchGauge label="Destin" value={2} max={3} cellSize={18} stacked />
    </Stack>
  );
}

/** Rose des vents : provenance, force, cap du navire. */
function WindRoseDemo() {
  return (
    <Row gap="xl" align="start">
      <WindRose dir="NE" force="brise-fraiche" />
      <WindRose dir="S" force="vent-violent" heading="O" />
      <WindRose dir="O" force="calme-plat" size="sm" />
    </Row>
  );
}

// ── Famille JET (#1806 lot 2c) : chaque module de primitive a son spécimen ──────────────────────
/** Ligne de jet : la même brique avant (cible annoncée) et après le dé (verdict + DR). */
function RollLineDemo() {
  return (
    <Stack>
      <PendingRollLine p={testPending('Athlétisme', 45, 45, 'intermediaire')} />
      <RollLine d={testBreakdown('Athlétisme', 45, { roll: 32, target: 45, sl: 1, success: true }, 'intermediaire')} />
      <RollLine d={testBreakdown('Corps à corps', 52, { roll: 88, target: 52, sl: -3, success: false })} />
      <TableRollLine table="Table des Critiques" roll={73} result="Bras — entaille profonde" />
    </Stack>
  );
}

/** Panneau de jet unique : l'issue d'un Test opposé, gagnant accentué. */
function RollPanelDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <RollPanel
      rows={[
        { combatant: herosExemple(), d: testBreakdown('Attaque', 52, { roll: 24, target: 52, sl: 2, success: true }) },
        { combatant: herosExempleB(), d: testBreakdown('Esquive', 41, { roll: 67, target: 41, sl: -2, success: false }) },
      ]}
      winnerIndex={0}
      netSL={4}
    />
  );
}

/** Dés : la rangée inline posée (d100 = dizaines + unités) et la matière dorée de l'Atelier. */
function DiceRollDemo() {
  return (
    <Row gap="xl" align="center">
      <DiceRoll scene={false} landed faces={[7, 3]} />
      <DiceRoll scene={false} landed faces={[0, 9]} tone="gold" />
    </Row>
  );
}

/** Sélecteur de dé d'une rangée : offre pré-jet (champ vide) et dé déjà posé. */
function ForcedRollPickerDemo() {
  const [roll, setRoll] = useState<number | null>(null);
  return (
    <Stack>
      <ForcedRollPicker roll={roll} target={45} onSet={setRoll} rowName="Athlétisme" />
      <ForcedRollPicker roll={11} target={45} onSet={() => {}} fixed marked rowName="Résilience" />
    </Stack>
  );
}

/** Ligne de récap : le trio de tons, et les noms tonés par camp. */
function RecapLineDemo() {
  return (
    <RecapLineList
      lines={[
        { text: 'Gustav franchit le mur (DR +2).', tone: 'ok', icon: 'action/force' },
        { text: 'Grunni rate son embuscade.', tone: 'bad', segments: [{ text: 'Grunni', team: 'enemy' }, { text: ' rate son embuscade.' }] },
        { text: 'La nuit tombe sur le campement.', tone: 'info' },
      ]}
    />
  );
}

/** Bilan multi-jets : une pile de jets d'un même temps (nuit de repos). */
function MultiRollListDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <MultiRollList
      entries={[
        { actorId: herosExemple().id, label: 'Convalescence', d: testBreakdown('Endurance', 42, { roll: 27, target: 42, sl: 1, success: true }), text: '+4 Points de Blessure', tone: 'ok' },
        { actorId: herosExempleB().id, label: 'Cauchemars', d: testBreakdown('Calme', 38, { roll: 71, target: 38, sl: -3, success: false }), text: 'Nuit agitée : aucun Point de Chance récupéré', tone: 'bad' },
      ]}
    />
  );
}

/** Corps de révélation : le Coup Critique tiré sur table, avec ses effets expliqués. */
function RevealBodyDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <RevealBody
      entry={{
        kind: 'critical',
        title: 'Coup Critique',
        dice: 73,
        lines: ['Entaille profonde du bras'],
        weapon: 'Épée',
        crit: { location: 'Bras droit', woundsLost: 5, conditions: [{ id: 'saignement', value: 1 }] },
        details: [{ text: 'Hémorragie 1', note: 'Un Saignement s’ajoute à chaque Round tant qu’il n’est pas soigné.' }],
      }}
      actor={herosExemple()}
      subject={herosExempleB()}
    />
  );
}

/** Segments tonés par camp : les noms cités se colorent, le reste est neutre. */
function TeamSegmentsDemo() {
  return (
    <p>
      <TeamSegments segments={[{ text: 'Gustav', team: 'ally' }, { text: ' frappe ' }, { text: 'le mutant', team: 'enemy' }, { text: ' au bras.' }]} />
    </p>
  );
}

/** Fil d'événements : la ligne NUE posée sur le terrain, aux trois tons du beat. */
function CombatBannerDemo() {
  return (
    <Stack>
      {(['', 'cb-tone-strong', 'cb-tone-grave'] as const).map((ton, i) => (
        <div key={i} className={`cb-ev ${ton}`}>
          <span className="cb-ic"><Icon id="action/attack" size={15} /></span>
          <span className="cb-tx">
            <TeamSegments segments={[{ text: 'Gustav', team: 'ally' }, { text: ' frappe ' }, { text: 'le mutant', team: 'enemy' }]} />
          </span>
        </div>
      ))}
    </Stack>
  );
}

/** Beat d'ouverture : les trois mots du combat, à l'échelle du CHAMP, le ton `menace` réservé à
 *  l'embuscade. Les mots sont posés NUS (sans `.combat-splash-inner`) : la pose plein-champ et
 *  l'animation d'entrée-sortie du composant vivant ne tiennent pas dans une vignette. */
function CombatStartSplashDemo() {
  const MOTS: { mot: string; sub: string; ton?: 'menace' }[] = [
    { mot: 'COMBAT !', sub: '' },
    { mot: 'EMBUSCADE !', sub: 'Vous êtes pris par surprise', ton: 'menace' },
    { mot: 'ASSAUT !', sub: "Vous surprenez l'ennemi" },
  ];
  return (
    <Stack gap="lg">
      {MOTS.map(({ mot, sub, ton }) => (
        <div key={mot}>
          <div className="display-title halo-champ" data-echelle="champ" data-ton={ton}>{mot}</div>
          {sub && <div className="combat-splash-sub halo-champ">{sub}</div>}
        </div>
      ))}
    </Stack>
  );
}

/** Visage d'un combattant : trait PLEIN et anneau d'équipe pour un héros, trait en TIRETS pour un
 *  ennemi (R9 — la forme encode l'équipe autant que la couleur), et la taille en variable. */
function RigPortraitDemo() {
  const h = herosExemple();
  if (!h) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <Row>
      <RigPortrait combatant={h} size={42} />
      <RigPortrait combatant={h} size={64} ring="var(--hud-camp-ally-hi)" />
      <RigPortrait combatant={{ ...h, kind: 'enemy' }} size={64} ring="var(--combat-enemy)" />
    </Row>
  );
}

/** Deux États RÉELS du catalogue — la pastille NE fabrique aucune règle, elle rend ce que la donnée dit. */
const etatsExemples = memoParVersion('etats', () => etats.slice(0, 2).map((e) => ({ id: e.id as ConditionId, value: 1 })));

/** Pastilles : rangée d'États réels (`EffectChips`) et conséquence mécanique nommée (`FxChip`). */
function FxChipDemo() {
  return (
    <Stack gap="sm">
      <EffectChips conditions={etatsExemples()} />
      <Row>
        <FxChip icon="action/attack" label="−1 Activité" />
        <FxChip icon="resource/gold-purse" label="Revenus +20 %" />
      </Row>
    </Stack>
  );
}

/** Puce de siège spectateur, dans ses DEUX poses — la pose d'écran est montrée EN FLUX (un
 *  `position: fixed` s'échapperait de la vignette : c'est justement ce que l'attribut porte). */
function SpectatorChipDemo() {
  return (
    <Stack gap="sm">
      <SpectatorChip label="Ilse" />
      <SpectatorChip label="L’hôte" action="choisit la réponse…" />
    </Stack>
  );
}

/** Colonne d'États : rack d'alvéoles RÉSERVÉES (les cases sont dessinées même vides) contre la
 *  forme libre, qui ne montre que ce qui est porté. */
function StateChipsDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <Row>
      <StateChips c={herosExemple()} max={3} reserve />
      <StateChips c={herosExemple()} max={3} />
    </Row>
  );
}

/** Frise d'initiative : cartouche de Round, entrée courante au trait, entrées passées atténuées. */
function InitiativeStripDemo() {
  const equipe = herosExemples().slice(0, 3);
  if (!equipe.length) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <InitiativeStrip
      order={equipe.map((c) => c.id)}
      turn={1}
      round={2}
      combatants={equipe}
      over={false}
      canFirstIds={[]}
      onActivate={() => {}}
      onPromote={() => {}}
    />
  );
}

/** Bande de groupe : une carte identitaire par héros (portrait, Blessures, États, nom dessous). */
function PartyDockDemo() {
  const equipe = herosExemples().slice(0, 4);
  if (!equipe.length) return <p className="hint">Aucun pregen disponible.</p>;
  return <PartyDock heroes={equipe} onOpen={() => {}} />;
}

/** CONSOLE DE COMBAT — le pont MONTÉ DE SES PROPRES SOUS-COMPOSANTS (`ConsoleCell`, `PhaseBanner`,
 *  `ConsoleArch`, tous à props et sans store) avec des données d'exemple : la vignette ne peut donc
 *  pas diverger du balisage réel. Le composant de tête, lui, ne prend aucune prop et lit le store de
 *  la partie (`useGame`) : la galerie étant un écran de l'application EN COURS (`App.tsx`),
 *  l'amorcer d'ici injecterait un combat factice dans la partie du joueur. Ce qui reste en balisage
 *  de maquette est ce que la console rend EN LIGNE, indissociable du store : la coque, les travées,
 *  la colonne de sets (chaque vignette dispatche `switch-loadout`), le conduit d'Avantage et le coin
 *  de fin de tour (dispatch `end-turn`). Le pont se dimensionne sur la FENÊTRE : la piste positionnée
 *  d'un champ défilant (`.gallery-scene-track`) le montre à la largeur de recette du bureau. */
function CombatConsoleMock() {
  const actif = herosExemple();
  /* Acteur ADVERSE de la forme spectatrice : le même pregen, du camp d'en face — la galerie ne
     fabrique pas de statblock, elle change le CAMP (seule entrée que l'arche lit pour sa teinte). */
  const adverse = { ...actif, id: 'e-demo', label: 'Mutant', kind: 'enemy' as const };
  const rien = () => {};
  return (
    <div className="gallery-scene"><div className="gallery-scene-track">
      <div className="combat-console" data-forme="complete">
        <PhaseBanner label={<><Icon id="ui/wait" size="sm" /> Interlude</>} actions={[]} />
        <div className="cc-dock skin-pont">
          <div className="cc-bay cc-bay-left">
            <div className="cc-bay-body">
              <div className="cc-arsenal">
                <span className="cc-bay-head">ÉPÉE ET BOUCLIER</span>
                <div className="cc-arsenal-body">
                  <div className="cc-sets" role="group" aria-label="Sets d’armes">
                    <button type="button" data-set="s1" data-action="switch-loadout" className="chip cc-set on" aria-label="Épée et bouclier">
                      <i className="cc-set-n">1</i>
                      <Icon id="item/weapon" size="sm" />
                      <span className="cc-key">X</span>
                    </button>
                    <button type="button" data-set="s2" data-action="switch-loadout" className="chip cc-set" aria-label="Arquebuse">
                      <i className="cc-set-n">2</i>
                      <Icon id="item/weapon" size="sm" />
                      <i className="cc-set-load">VIDE</i>
                    </button>
                  </div>
                  <div className="cc-grid cc-grid-left" aria-label="Arsenal">
                    <ConsoleCell cell={{ key: 'attack', id: 'attack', family: 'arme', label: 'Attaquer', icon: <Icon id="action/attack" />, run: rien }} />
                    <ConsoleCell cell={{ key: 'shoot', id: 'shoot', family: 'arme', label: 'Tirer', icon: <Icon id="action/shoot" />, on: true, run: rien }} />
                    <ConsoleCell cell={{ key: 'charge', id: 'charge', family: 'attaque', label: 'Charger', icon: <Icon id="action/attack" />, gate: 'Déjà engagé au contact' }} />
                    <ConsoleCell cell={undefined} />
                  </div>
                </div>
              </div>
              <div className="cc-quick">
                <span className="cc-bay-head">ACCÈS RAPIDE</span>
                <div className="cc-grid cc-grid-quick" aria-label="Accès rapide">
                  <ConsoleCell cell={{ key: 'consume', id: 'consume', family: 'geste', label: 'Potion de soin', icon: <Icon id="action/consume" />, run: rien }} />
                  <ConsoleCell cell={undefined} />
                </div>
              </div>
            </div>
          </div>
          <ConsoleArch
            active={actif}
            ring="var(--gold)"
            move={{ value: 3, max: 4, spend: 1, geste: { key: 'undo-move', id: 'undo-move', family: 'mouvement', label: 'Annuler le déplacement', icon: <Icon id="ui/undo" />, run: rien } }}
            action={{ value: 1, max: 1 }}
          />
          <div className="cc-bay cc-bay-right">
            <div className="cc-conduit" aria-label="Avantage : 2/6">
              <span className="cc-conduit-label">AVANTAGE</span>
              <span className="cc-conduit-rail">
                {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 2 ? 'on' : i < 6 ? 'off' : 'out'} />)}
              </span>
              <span className="cc-conduit-plate">2/6</span>
            </div>
            <div className="cc-grid cc-grid-right" aria-label="Capacités">
              <ConsoleCell hotkey={1} cell={{ key: 'dodge', id: 'dodge', family: 'defense', label: 'Esquiver', icon: <Icon id="action/defend" />, run: rien }} advantage={2} />
              <ConsoleCell hotkey={2} cell={{ key: 'cast', id: 'cast', family: 'magie', label: 'Incanter', icon: <Icon id="action/cast" />, adv: 3, run: rien }} advantage={2} />
              <ConsoleCell hotkey={3} cell={undefined} />
            </div>
          </div>
          <div className="cc-corner">
            <button type="button" data-cell="end-turn" data-action="end-turn" className="chip cc-cell cc-end" aria-label="Finir le tour">
              <span className="cc-ico"><Icon id="ui/turn-end" /></span>
              <span className="cc-lbl">Fin du tour</span>
              <span className="cc-key">F</span>
            </button>
          </div>
        </div>
      </div>
      {/* FORME SPECTATRICE — l'ARCHE SEULE, sans bande (arbitrage utilisateur 2026-09-20) : c'est ce
          que le pont montre au tour d'un adversaire et avant le début du combat. L'ennemi porte la
          teinte d'équipe à ses Blessures et l'anneau en tirets de son camp ; le bandeau de phase se
          centre au-dessus de l'arche. */}
      <div className="combat-console" data-forme="spectatrice">
        <PhaseBanner label={<><Icon id="ui/wait" size="sm" /> Tour de l’ennemi</>} actions={[]} adresse="spectatrice" />
        {/* La BANDE reste montée, comme à l'écran : c'est elle qui tient l'arche immobile d'une forme
            à l'autre, et c'est sur elle que la forme spectatrice éteint la matière. Une vignette qui
            pendrait l'arche à la racine ne montrerait PAS ce que la CSS fait. */}
        <div className="cc-dock skin-pont">
          <ConsoleArch active={adverse} ring="var(--danger)" move={{ value: 4, max: 4 }} action={{ value: 1, max: 1 }} />
        </div>
      </div>
    </div></div>
  );
}

/** Objectif courant : tête seule, puis tête repliable (échéance + compte des précédents). */
function ObjectiveBannerDemo() {
  return (
    <Stack>
      <ObjectiveBanner objectives={[{ id: 'o1', text: 'Retrouver le coche perdu sur la route d’Altdorf' }]} now={0} />
      <ObjectiveBanner
        objectives={[
          { id: 'o1', text: 'Fouiller la grange' },
          { id: 'o2', text: 'Atteindre Bogenhafen avant la nuit', deadline: 60 * 60 * 9 },
        ]}
        now={0}
      />
    </Stack>
  );
}

/** Rangée de caméra : commandes vissées (peau `.skin-tole`), état enfoncé par `aria-pressed`. */
function ViewControlsDemo() {
  const [vue, setVue] = useState<'iso' | 'top'>('iso');
  const [inspection, setInspection] = useState(false);
  return (
    <ViewControls
      zoom={1}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      onZoomReset={() => {}}
      onRotateLeft={() => {}}
      onRotateRight={() => {}}
      view={vue}
      onToggleView={() => setVue((v) => (v === 'iso' ? 'top' : 'iso'))}
      inspectEnabled={inspection}
      onToggleInspect={() => setInspection((v) => !v)}
    />
  );
}

/** Barre de Test ÉTENDU : DR cumulés vers la cible, avec et sans crans lisibles. */
function DrBarDemo() {
  return (
    <Stack>
      <DrBar cum={4} target={6} />
      <DrBar cum={19} target={30} label="DR de rituel" />
    </Stack>
  );
}

/** Montants en monnaie impériale (LDB 57) : notation S/C, sous seuls, et le ton discret. */
function CoinsDemo() {
  return (
    <Stack>
      <span><Coins money={toMoney({ gold: 2, silver: 6, brass: 8 })} /></span>
      <span><Coins money={toMoney({ brass: 9 })} /></span>
      <span>Bourse <Coins money={toMoney({ silver: 12 })} ton="discret" /></span>
    </Stack>
  );
}

/** Tiroir du journal : l'historique complet, ouvert sur ses lignes narrées. */
function LogDrawerDemo() {
  return <LogDrawer battle={null} journal={['La porte cède sous l’épaule de Gustav.', 'Une odeur de suif monte de la cave.']} initialOpen />;
}

/** Panneau d'inspection : identité, badges de camp, statbloc — modale de lecture seule. */
function InspectPanelDemo() {
  const [ouvert, setOuvert] = useState(false);
  if (!herosExempleB()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <>
      <button type="button" className="btn" onClick={() => setOuvert(true)}>Inspecter un combattant</button>
      {ouvert && <InspectPanel combatant={herosExempleB()} onClose={() => setOuvert(false)} />}
    </>
  );
}

/** Panneau d'équipement : cellules par localisation × couche, cartes de set, récap en main. */
function EquipmentPanelDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return <EquipmentPanel hero={herosExemple()} />;
}

export interface GallerySpecimen {
  /** Id STABLE du spécimen (clé de sélection), déclaré — le `label` n'est que l'affichage. */
  id: string;
  /** Nom d'affichage — reprend le `label` de la primitive au manifeste. */
  label: string;
  /** Chemin EXACT déclaré par `src/data/primitives.manifest.json` (comparaison stricte). */
  file: string;
  category: string;
  /** Légende d'exception (ex. maquette statique) — sinon absente (spécimen vivant, données réelles). */
  note?: string;
  render: ComponentType;
}

export const GALLERY_SPECIMENS: GallerySpecimen[] = [
  { id: 'palette-de-tokens', label: 'Palette de tokens', file: 'src/ui/styles/base.css', category: 'Atomes', render: TokenSwatches },
  { id: 'boutons', label: 'Boutons', file: 'src/ui/styles/base.css', category: 'Atomes', render: Buttons },
  { id: 'chips', label: 'Chips', file: 'src/ui/styles/components.css', category: 'Atomes', render: Chips },
  { id: 'panel', label: 'Panel', file: 'src/ui/styles/components.css', category: 'Atomes', render: Panels },
  { id: 'screenshell', label: 'ScreenShell', file: 'src/ui/ScreenShell.tsx', category: 'Écrans & layout', note: 'maquette d’états — la coquille EST cet écran', render: ScreenShellNote },
  { id: 'cadre-modale', label: 'Modal', file: 'src/ui/Modal.tsx', category: 'Écrans & layout', render: ModalDemo },
  { id: 'cadre-gestes', label: 'CadrePied / CadreFermer', file: 'src/ui/Cadre.tsx', category: 'Écrans & layout', render: CadreDemo },
  { id: 'planche', label: 'Planche', file: 'src/ui/Planche.tsx', category: 'Écrans & layout', render: PlancheDemo },
  { id: 'screenmeta', label: 'ScreenMeta', file: 'src/ui/ScreenMeta.tsx', category: 'Écrans & layout', render: ScreenMetaDemo },
  { id: 'masterdetail', label: 'MasterDetail', file: 'src/ui/MasterDetail.tsx', category: 'Écrans & layout', render: MasterDetailDemo },
  { id: 'tabs', label: 'Tabs', file: 'src/ui/Tabs.tsx', category: 'Écrans & layout', render: TabsDemo },
  { id: 'menucard', label: 'MenuCard', file: 'src/ui/MenuCard.tsx', category: 'Écrans & layout', render: MenuCardDemo },
  { id: 'band', label: 'Band', file: 'src/ui/Band.tsx', category: 'Écrans & layout', render: BandDemo },
  { id: 'searchfilterfield', label: 'SearchFilterField', file: 'src/ui/SearchFilterField.tsx', category: 'Écrans & layout', render: SearchFilterFieldDemo },
  { id: 'optionchooser', label: 'OptionChooser', file: 'src/ui/OptionChooser.tsx', category: 'Jets', render: OptionChooserDemo },
  { id: 'panneauparametre', label: 'PanneauParametre', file: 'src/ui/PanneauParametre.tsx', category: 'Écrans & layout', render: PanneauParametreDemo },
  { id: 'infobulle', label: 'useInfobulle', file: 'src/ui/Infobulle.tsx', category: 'Écrans & layout', render: InfobulleDemo },
  { id: 'codex-ref', label: 'CodexRef', file: 'src/ui/compendium/CodexRef.tsx', category: 'Écrans & layout', render: CodexRefDemo },
  { id: 'boite-ancree', label: 'BoiteAncree', file: 'src/ui/BoiteAncree.tsx', category: 'Écrans & layout', render: BoiteAncreeDemo },
  { id: 'influencerow', label: 'InfluenceRow', file: 'src/ui/InfluenceRow.tsx', category: 'Jets', render: InfluenceRowDemo },
  { id: 'vsheader', label: 'VsHeader', file: 'src/ui/VsHeader.tsx', category: 'Jets', render: VsHeaderDemo },
  { id: 'rollshell', label: 'RollShell', file: 'src/ui/RollShell.tsx', category: 'Jets', note: 'maquette statique d’états — un spécimen vivant exigerait un flux de jet monté (store + makeRollFlow), hors de portée d’une vignette de galerie', render: RollShellStaticMock },
  { id: 'rollrow', label: 'RollRow', file: 'src/ui/RollRow.tsx', category: 'Jets', note: 'maquette statique d’états — même raison que RollShell (flux de jet monté hors de portée d’une vignette)', render: RollRowStaticMock },
  { id: 'rollline', label: 'RollLine', file: 'src/ui/RollLine.tsx', category: 'Jets', render: RollLineDemo },
  { id: 'rollpanel', label: 'RollPanel', file: 'src/ui/RollPanel.tsx', category: 'Jets', render: RollPanelDemo },
  { id: 'diceroll', label: 'DiceRoll', file: 'src/ui/DiceRoll.tsx', category: 'Jets', render: DiceRollDemo },
  { id: 'forcedrollpicker', label: 'ForcedRollPicker', file: 'src/ui/ForcedRollPicker.tsx', category: 'Jets', render: ForcedRollPickerDemo },
  { id: 'recapline', label: 'RecapLine', file: 'src/ui/RecapLine.tsx', category: 'Jets', render: RecapLineDemo },
  { id: 'multirolllist', label: 'MultiRollList', file: 'src/ui/MultiRollList.tsx', category: 'Jets', render: MultiRollListDemo },
  { id: 'revealbody', label: 'RevealBody', file: 'src/ui/RevealBody.tsx', category: 'Jets', render: RevealBodyDemo },
  { id: 'teamsegments', label: 'TeamSegments', file: 'src/ui/TeamSegments.tsx', category: 'Texte', render: TeamSegmentsDemo },
  { id: 'combatbanner', label: 'CombatBanner', file: 'src/ui/CombatBanner.tsx', category: 'Combat', note: 'maquette de TONS — le composant vivant projette le beat du combat en cours (store), qu’aucune vignette ne porte', render: CombatBannerDemo },
  { id: 'combatstartsplash', label: 'CombatStartSplash', file: 'src/ui/CombatStartSplash.tsx', category: 'Combat', note: 'les trois MOTS du beat — le composant vivant se pose en plein champ (position fixed) et s’efface tout seul en 2,7 s : une vignette ne peut montrer ni la pose ni l’animation, qui s’observent à l’entrée en combat', render: CombatStartSplashDemo },
  { id: 'logdrawer', label: 'LogDrawer', file: 'src/ui/LogDrawer.tsx', category: 'Combat', render: LogDrawerDemo },
  { id: 'initiativestrip', label: 'InitiativeStrip', file: 'src/ui/InitiativeStrip.tsx', category: 'Combat', render: InitiativeStripDemo },
  { id: 'partydock', label: 'PartyDock', file: 'src/ui/PartyDock.tsx', category: 'Combat', render: PartyDockDemo },
  { id: 'combatconsole', label: 'CombatConsole', file: 'src/ui/CombatConsole.tsx', category: 'Combat', note: 'maquette statique montée des sous-composants réels du pont (ConsoleCell, PhaseBanner, ConsoleArch) sur des données d’exemple — le composant de tête n’a aucune prop et lit le store de la partie ; l’amorcer depuis la galerie, qui est un écran de l’application en cours, y injecterait un combat factice. La vignette montre la composition de BUREAU : le pont se dimensionne sur la fenêtre, sa composition compacte (≤560) s’observe en recette (scripts/recette/console-pont-formes.mjs), pas ici', render: CombatConsoleMock },
  { id: 'viewcontrols', label: 'ViewControls', file: 'src/ui/ViewControls.tsx', category: 'Combat', render: ViewControlsDemo },
  { id: 'objectivebanner', label: 'ObjectiveBanner', file: 'src/ui/ObjectiveBanner.tsx', category: 'Écrans & layout', render: ObjectiveBannerDemo },
  { id: 'statechips', label: 'StateChips', file: 'src/ui/StateChips.tsx', category: 'Personnages', render: StateChipsDemo },
  { id: 'rigportrait', label: 'RigPortrait', file: 'src/ui/RigPortrait.tsx', category: 'Personnages', render: RigPortraitDemo },
  { id: 'fxchip', label: 'FxChip / EffectChips', file: 'src/ui/FxChip.tsx', category: 'Personnages', render: FxChipDemo },
  { id: 'spectatorchip', label: 'SpectatorChip', file: 'src/ui/SpectatorChip.tsx', category: 'Écrans & layout', render: SpectatorChipDemo },
  { id: 'drbar', label: 'DrBar', file: 'src/ui/DrBar.tsx', category: 'Jets', render: DrBarDemo },
  { id: 'coins', label: 'Coins', file: 'src/ui/Coins.tsx', category: 'Négoce & activités', render: CoinsDemo },
  { id: 'inspectpanel', label: 'InspectPanel', file: 'src/ui/InspectPanel.tsx', category: 'Combat', render: InspectPanelDemo },
  { id: 'equipmentpanel', label: 'EquipmentPanel', file: 'src/ui/EquipmentPanel.tsx', category: 'Personnages', render: EquipmentPanelDemo },
  { id: 'portraittile', label: 'PortraitTile', file: 'src/ui/PortraitTile.tsx', category: 'Personnages', render: PortraitTileDemo },
  { id: 'lifebar', label: 'LifeBar', file: 'src/ui/LifeBar.tsx', category: 'Personnages', render: LifeBarDemo },
  { id: 'characterpreview', label: 'CharacterPreview', file: 'src/ui/CharacterPreview.tsx', category: 'Personnages', render: CharacterPreviewDemo },
  { id: 'creatordice', label: 'CreatorDice', file: 'src/ui/creator/CreatorDice.tsx', category: 'Personnages', render: CreatorDiceDemo },
  { id: 'creatorstepframe', label: 'CreatorStepFrame', file: 'src/ui/creator/CreatorStepFrame.tsx', category: 'Personnages', note: 'gabarit plein-champ — s’observe sur les 7 pas du créateur, pas en vignette', render: CreatorStepFrameNote },
  { id: 'roseaxes', label: 'RoseAxes', file: 'src/ui/RoseAxes.tsx', category: 'Personnages', render: RoseAxesDemo },
  { id: 'charstatsgrid', label: 'CharStatsGrid', file: 'src/ui/CharStatsGrid.tsx', category: 'Personnages', render: CharStatsGridDemo },
  { id: 'tradetable', label: 'TradeTable', file: 'src/ui/TradeTable.tsx', category: 'Négoce & activités', render: TradeTableDemo },
  { id: 'activitypane', label: 'ActivityPane', file: 'src/ui/ActivityPane.tsx', category: 'Négoce & activités', render: ActivityPaneDemo },
  { id: 'qtystepper', label: 'QtyStepper', file: 'src/ui/QtyStepper.tsx', category: 'Négoce & activités', render: QtyStepperDemo },
  { id: 'numberfield', label: 'NumberField', file: 'src/ui/NumberField.tsx', category: 'Négoce & activités', render: NumberFieldDemo },
  { id: 'gatedaction', label: 'GatedAction', file: 'src/ui/GatedAction.tsx', category: 'Négoce & activités', render: GatedActionDemo },
  { id: 'parchmentcard', label: 'ParchmentCard', file: 'src/ui/ParchmentCard.tsx', category: 'Négoce & activités', render: ParchmentCardDemo },
  { id: 'prose', label: 'Prose', file: 'src/ui/Prose.tsx', category: 'Texte', render: ProseDemo },
  { id: 'gameopeditor', label: 'GameOpEditor', file: 'src/ui/editor/GameOpEditor.tsx', category: 'Éditeur', render: GameOpEditorDemo },
  { id: 'reglagesapparence', label: 'ReglagesApparence / MonsterPartsFields', file: 'src/ui/editor/MonsterPartsFields.tsx', category: 'Éditeur', render: ReglagesApparenceDemo },
  { id: 'descreffield', label: 'DescRefField', file: 'src/ui/compendium/DescRefField.tsx', category: 'Éditeur', render: DescRefFieldDemo },
  { id: 'sourcereffield', label: 'SourceRefField', file: 'src/ui/SourceRefField.tsx', category: 'Éditeur', render: SourceRefFieldDemo },
  { id: 'gameopchips', label: 'GameOpChips', file: 'src/ui/GameOpChips.tsx', category: 'Texte', render: GameOpChipsDemo },
  { id: 'metalstatus', label: 'MetalStatus', file: 'src/ui/MetalStatus.tsx', category: 'Atelier du scribe', render: MetalStatusDemo },
  { id: 'waxseal-sealedplaque', label: 'WaxSeal / SealedPlaque', file: 'src/ui/WaxSeal.tsx', category: 'Atelier du scribe', render: WaxSealDemo },
  { id: 'careerpath', label: 'CareerPath', file: 'src/ui/CareerPath.tsx', category: 'Atelier du scribe', render: () => <CareerPath levels={niveauxDeLaCarriereExemple()} currentLevel={2} /> },
  { id: 'figtile', label: 'FigTile', file: 'src/ui/FigTile.tsx', category: 'Atelier du scribe', render: FigTileDemo },
  { id: 'plaquerow-plaquegrid', label: 'PlaqueRow / PlaqueGrid', file: 'src/ui/PlaqueRow.tsx', category: 'Atelier du scribe', render: PlaqueRowDemo },
  { id: 'groupedpickgrid', label: 'GroupedPickGrid', file: 'src/ui/GroupedPickGrid.tsx', category: 'Atelier du scribe', render: GroupedPickGridDemo },
  { id: 'detailframe', label: 'DetailFrame', file: 'src/ui/DetailFrame.tsx', category: 'Atelier du scribe', render: DetailFrameDemo },
  { id: 'herosheet', label: 'HeroSheet', file: 'src/ui/HeroSheet.tsx', category: 'Personnages', render: HeroSheetDemo },
  { id: 'readyrow', label: 'ReadyRow', file: 'src/ui/ReadyRow.tsx', category: 'Écrans & layout', render: ReadyRowDemo },
  { id: 'coopinvite', label: 'CoopInvite', file: 'src/ui/CoopPanels.tsx', category: 'Écrans & layout', render: CoopInviteDemo },
  { id: 'coopcodeinput', label: 'CoopCodeInput', file: 'src/ui/CoopPanels.tsx', category: 'Écrans & layout', render: CoopCodeInputDemo },
  { id: 'seatlist', label: 'SeatList', file: 'src/ui/CoopPanels.tsx', category: 'Écrans & layout', render: SeatListDemo },
  { id: 'coopassignrow', label: 'CoopAssignRow', file: 'src/ui/CoopPanels.tsx', category: 'Écrans & layout', render: CoopAssignRowDemo },
  { id: 'coopbanner', label: 'CoopBanner', file: 'src/ui/CoopPanels.tsx', category: 'Écrans & layout', render: CoopBannerDemo },
  { id: 'gearassignlist', label: 'GearAssignList', file: 'src/ui/GearAssignList.tsx', category: 'Négoce & activités', render: GearAssignListDemo },
  { id: 'rewardrecap', label: 'RewardRecap', file: 'src/ui/RewardRecap.tsx', category: 'Négoce & activités', render: RewardRecapDemo },
  { id: 'errorboundary', label: 'SceneErrorBoundary', file: 'src/ui/SceneErrorBoundary.tsx', category: 'Écrans & layout', render: SceneErrorBoundaryDemo },
  { id: 'itemicon', label: 'ItemIcon', file: 'src/ui/ItemIcon.tsx', category: 'Négoce & activités', render: ItemIconDemo },
  { id: 'mediaselect', label: 'MediaSelect', file: 'src/ui/MediaSelect.tsx', category: 'Négoce & activités', render: MediaSelectDemo },
  { id: 'reffield', label: 'RefField', file: 'src/ui/compendium/RefField.tsx', category: 'Éditeur', render: RefFieldDemo },
  { id: 'stack-row-grid-split', label: 'Stack / Row / Grid / Split', file: 'src/ui/Layout.tsx', category: 'Écrans & layout', render: LayoutDemo },
  { id: 'ornements', label: 'Ornements', file: 'src/ui/Ornaments.tsx', category: 'Atelier du scribe', render: OrnamentsDemo },
  { id: 'notchgauge', label: 'NotchGauge', file: 'src/ui/NotchGauge.tsx', category: 'Personnages', render: NotchGaugeDemo },
  { id: 'windrose', label: 'WindRose', file: 'src/ui/WindRose.tsx', category: 'Personnages', render: WindRoseDemo },
];

/** Deux spécimens homonymes d'id seraient indistinguables à la sélection. */
const IDS = new Set(GALLERY_SPECIMENS.map((s) => s.id));
if (IDS.size !== GALLERY_SPECIMENS.length) throw new Error('galerie : deux spécimens portent le même id');

export const GALLERY_CATEGORIES = [...new Set(GALLERY_SPECIMENS.map((s) => s.category))];
