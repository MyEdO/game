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
import { type ComponentType, useRef, useState } from 'react';
import { ScreenMeta } from '../ScreenMeta';
import { Tabs, type TabItem } from '../Tabs';
import { OptionChooser } from '../OptionChooser';
import { ParchmentCard } from '../ParchmentCard';
import { QtyStepper } from '../QtyStepper';
import { PanneauParametre } from '../PanneauParametre';
import { NumberField } from '../NumberField';
import { DescRefField } from '../compendium/DescRefField';
import type { DescRef } from '../../data/source/decoupe';
import { GatedAction } from '../GatedAction';
import { ReadyRow } from '../ReadyRow';
import { PortraitTile } from '../PortraitTile';
import { LifeBar } from '../LifeBar';
import { CharacterPreview } from '../CharacterPreview';
import { MetalStatus } from '../MetalStatus';
import { WaxSeal, SealedPlaque } from '../WaxSeal';
import { CareerPath } from '../CareerPath';
import { FigTile, type ZoneBadgeSpec } from '../FigTile';
import { PlaqueRow, PlaqueGrid } from '../PlaqueRow';
import { DieFace } from '../DiceRoll';
import { CHAR_KEYS, CHAR_LABELS } from '../../engine/types';
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
import type { GameOp } from '../../engine/ops';
import { species, careers, levelsForCareer, stars, mutations, rigSpeciesId, allAxes, charAbr, spells, memoParVersion } from '../../data';
import { makePregens } from '../../data/pregens';
import { toMoney } from '../../engine/money';
import { RoseAxes } from '../RoseAxes';
import { CharStatsGrid } from '../CharStatsGrid';
import { axesProfile } from '../../engine/axes';
import { GameOpChips } from '../GameOpChips';
import { Band } from '../Band';
import { CAREER_CHAR_ADVANCES } from '../creator/draft';
import { ItemIcon } from '../ItemIcon';
import { MediaSelect } from '../MediaSelect';
import { RefField, refFieldCfg } from '../compendium/RefField';
import { itemFromTrappingById } from '../../engine/items';
import type { ItemInstance } from '../../engine/types';

// ── Données réelles pour les spécimens vivants (aucune donnée inventée), lues VIVES (#1692) ──
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
    <div className="row-flex">
      <button type="button" className="btn">Neutre</button>
      <button type="button" className="btn btn-primary">Primaire</button>
      <button type="button" className="btn btn-ghost">Discret</button>
      <button type="button" className="btn btn-test">Outil de test</button>
      <button type="button" className="btn" disabled>Désactivé</button>
    </div>
  );
}

function Chips() {
  return (
    <div className="row-flex">
      <span className="chip">Chip simple</span>
      <span className="chip"><b>Nom</b> — détail</span>
      <span className="chip">Compteur <span className="count">3</span></span>
    </div>
  );
}

function Panels() {
  return (
    <div className="row-flex">
      <div className="panel" style={{ padding: 12 }}>Surface</div>
      <div className="panel sunken" style={{ padding: 12 }}>Creuse</div>
      <div className="panel gold" style={{ padding: 12 }}>Liseré or</div>
    </div>
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
    <div className="stack">
      <Tabs tabs={tabs} active={active} onChange={setActive} label="Onglets" />
    </div>
  );
}

function OptionChooserDemo() {
  const [choice, setChoice] = useState<'parry' | 'dodge'>('parry');
  return (
    <div className="stack">
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
      <OptionChooser
        layout="actions"
        options={[
          { key: 'cancel', label: 'Renoncer', ghost: true, onSelect: () => {} },
          { key: 'ok', label: 'Confirmer', primary: true, onSelect: () => {} },
        ]}
      />
    </div>
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
    <div className="stack">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="row-flex" style={{ alignItems: 'center', gap: 12 }}>
          <span className="hint" style={{ width: 32 }}>{size}</span>
          {objets.map((item) => (
            <span key={item.uid} title={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ItemIcon item={item} size={size} />
            </span>
          ))}
        </div>
      ))}
    </div>
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
    <div className="stack">
      <RefField cfg={cfgClasse} fieldKey="class" label="Classe de la carrière" value={classe} onChange={setClasse} nullable />
      <RefField cfg={cfgCarac} fieldKey="refChar" label="Caractéristique de référence" value={carac} onChange={setCarac} nullable />
      <p className="hint">Stocké : {JSON.stringify({ class: classe, refChar: carac })}</p>
    </div>
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

function DescRefFieldDemo() {
  // Adresse RÉELLE : LDB 21 § terreur-indice, premier bloc. Le chapitre arrive par son adresse-URL
  // (assets émis par `wfrp:prose-source`) — hors serveur, le champ affiche son erreur nommée.
  const [adresse, setAdresse] = useState<DescRef | undefined>({
    book: 'livre-de-base',
    ch: '21',
    parts: [{ kind: 'blocs', sec: 'terreur-indice', secOcc: 1, b0: 0, b1: 0, sum: 'a919b4ef91a1dd3c' }],
  });
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
    <div className="row-flex">
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
    </div>
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
  const ch = Object.fromEntries(CHAR_KEYS.map((k) => [k, effectiveChar(herosExemple(), k)])) as Record<(typeof CHAR_KEYS)[number], number>;
  const [k1, k2, k3] = CHAR_KEYS;
  return (
    <div className="stack">
      <PlaqueGrid>
        {[k1, k2].map((k) => (
          <PlaqueRow key={k} prefix={charAbr(k)} content={CHAR_LABELS[k]} value={ch[k]} />
        ))}
        <PlaqueRow
          prefix={charAbr(k3)}
          content={CHAR_LABELS[k3]}
          rolling
          meta={
            <span className="row-flex">
              <span className="rm-die"><DieFace n={5} landed tone="gold" /></span>
              <span className="rm-die"><DieFace n={6} landed tone="gold" /></span>
            </span>
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
    </div>
  );
}

function MetalStatusDemo() {
  return (
    <div className="row-flex">
      <MetalStatus status="Bronze 1" />
      <MetalStatus status="Argent 2" />
      <MetalStatus status="Or 3" />
      <MetalStatus status="Or 3" size="plaque" />
    </div>
  );
}

function CharStatsGridDemo() {
  return (
    <div className="stack">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size}>
          <span className="hint">size=&quot;{size}&quot;</span>
          <CharStatsGrid size={size} value={(k) => effectiveChar(herosExemple(), k)} />
        </div>
      ))}
    </div>
  );
}

function WaxSealDemo() {
  return (
    <div className="row-flex">
      <WaxSeal size={40} />
      <SealedPlaque title={carriereExemple().label} desc="Carrière élue" selected />
      <SealedPlaque title="Carrière non retenue" desc="Autre proposition" />
    </div>
  );
}

function DetailFrameDemo() {
  return (
    <DetailFrame
      label={carriereExemple().label}
      meta={<MetalStatus status={niveauxDeLaCarriereExemple()[0]?.status ?? 'Bronze 1'} />}
      prose={carriereExemple().desc}
      proseSelfLabel={carriereExemple().label}
      proseSelfCategory="career"
    />
  );
}

function HeroSheetDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <div className="stack">
      <p className="hint">`header` (bande figurine+identité+rose) : composé tel quel par le détail candidat de l'écran d'équipe.</p>
      <HeroSheet hero={herosExemple()} />
      <p className="hint">`header={false}` : composé par la fiche vivante du créateur (alcôve propre à l'appelant).</p>
      <HeroSheet hero={herosExemple()} header={false} />
    </div>
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
    <div className="stack">
      <CreatorDice label={`Tirer le Signe astral (d100) — ${signeAstralExemple()?.label ?? ''}`} rolled={false} xp={20} onRoll={() => {}} />
      <CreatorDice rolled xp={20}>
        <p className="hint">Résultat gardé — {signeAstralExemple()?.label}.</p>
      </CreatorDice>
    </div>
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
    <div className="stack">
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
    </div>
  );
}

function PortraitTileDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return (
    <div className="row-flex">
      <PortraitTile c={herosExemple()} ring="var(--gold)" variant="identity" size="md" />
      <PortraitTile c={herosExemple()} ring="var(--gold)" variant="vital" size="md" />
      <PortraitTile c={herosExemple()} ring="var(--gold)" variant="full" size="md" active />
    </div>
  );
}

function CharacterPreviewDemo() {
  if (!herosExemple()) return <p className="hint">Aucun pregen disponible.</p>;
  return <CharacterPreview hero={herosExemple()} size="lg" ambiance="panel" />;
}

function ScreenMetaDemo() {
  return <ScreenMeta meta={{ time: 0, money: toMoney({ gold: 12, silver: 4, brass: 8 }) }} />;
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

/** Trois Sorts RÉELS du catalogue portant un NI (`cn`) — la matière du panneau « Quel Sort
 *  dissiper ? » de la console, sans rien inventer. */
const sortsADissiper = memoParVersion('spells', () => spells.filter((s) => typeof s.cn === 'number').slice(0, 3));

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
    <div className="stack">
      <ParchmentCard title="Événement" seal={{ label: 'Tirage', roll: 42 }} tone="ok">
        Récit ponctuel adossé à un tirage d100 — texture parcheminée + médaillon du tirage.
      </ParchmentCard>
      <ParchmentCard seal={{ kind: 'cire' }}>
        Texte d’auteur SCELLÉ (#717) — aucun tirage à montrer : le cachet de cire franchit le bord.
      </ParchmentCard>
    </div>
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
        <div className="stack">
          <button type="button" className="btn gallery-list-item" onClick={() => setSel('x')}>Élément X</button>
          <button type="button" className="btn gallery-list-item" onClick={() => setSel('y')}>Élément Y</button>
        </div>
      }
      detail={<p>Détail de l'élément « {sel === 'x' ? 'X' : 'Y'} ».</p>}
    />
  );
}

function SearchFilterFieldDemo() {
  const items = ['Épée', 'Hallebarde', 'Arquebuse', 'Dague'];
  const { search, setSearch, filtered } = useFilteredList(items, (i) => i);
  return (
    <div className="stack">
      <SearchFilterField value={search} onChange={setSearch} placeholder="Filtrer…" icon />
      <div className="row-flex">{filtered.map((i) => <span className="chip" key={i}>{i}</span>)}</div>
    </div>
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
  // `DetailFrame` autour de la démo est ASSUMÉ (galerie DEV, aucun écran joueur) : c'est le contexte
  // réel de lecture de cette prose.
  return (
    <DetailFrame prose={carriereExemple().desc} proseSelfLabel={carriereExemple().label} proseSelfCategory="career" />
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
    <div className="stack">
      <p className="hint">Scores RÉELS des pré-tirés (`axesProfile`, `src/engine/axes.ts`) sur les axes du socle de base.</p>
      <div className="row-flex">
        <RoseAxes axes={axesProfile(heroes[0], CORE)} size="glyph" title={`${heroes[0].label} — glyphe`} />
        <RoseAxes axes={axesProfile(heroes[0], CORE)} size="medal" title={`${heroes[0].label} — médaillon`} />
      </div>
      <RoseAxes axes={axesProfile(heroes[0], CORE)} size="grand" title={`${heroes[0].label} — rendu plein`} />
      <div className="row-flex">
        {heroes.map((h) => (
          <div key={h.id} className="stack" style={{ alignItems: 'center' }}>
            <RoseAxes axes={axesProfile(h, CORE)} size="medal" title={`${h.label} — médaillon`} />
            <span className="hint">{h.label}</span>
          </div>
        ))}
      </div>
    </div>
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

/** Ops RÉELLES (mutations.json) : charMod (ancré Caractéristiques) + grantTalent (ancré Talents) de
 *  « Tête bestiale (Chien) », `ap` (sans ancre Codex → repli `humanizeOp` en phrase) de « Tête pointue ». */
const GAMEOP_CHIPS_DEMO_OPS: GameOp[] = [
  ...(mutations.find((m) => m.id === 'tete-bestiale-chien')?.passive ?? []),
  ...(mutations.find((m) => m.id === 'tete-pointue')?.passive?.filter((o) => o.op === 'ap') ?? []),
];

function GameOpChipsDemo() {
  return (
    <div className="row-flex skill-tags">
      <GameOpChips ops={GAMEOP_CHIPS_DEMO_OPS} />
    </div>
  );
}

/** RollShell/RollRow : un spécimen VIVANT exigerait un flux de jet monté (store + `makeRollFlow`),
 *  hors de portée d'une vignette de galerie. Maquette STATIQUE des états, composée des classes canon
 *  du rôle rendu (`.modal`/`.modal-actions` pour la coquille, `.prow` pour la rangée), légendée. */
function RollShellStaticMock() {
  return (
    <div className="modal" style={{ position: 'static', width: 420 }}>
      <h3>Attaque — maquette statique</h3>
      <p className="hint">États : Lancer → Chance/Pacte → Résilience → Appliquer (`.modal-actions`, `.rm-influence`).</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost">Annuler</button>
        <button type="button" className="btn btn-primary">Lancer</button>
      </div>
    </div>
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

export interface GallerySpecimen {
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
  { label: 'Palette de tokens', file: 'src/ui/styles/base.css', category: 'Atomes', render: TokenSwatches },
  { label: 'Boutons', file: 'src/ui/styles/base.css', category: 'Atomes', render: Buttons },
  { label: 'Chips', file: 'src/ui/styles/components.css', category: 'Atomes', render: Chips },
  { label: 'Panel', file: 'src/ui/styles/components.css', category: 'Atomes', render: Panels },
  { label: 'ScreenShell', file: 'src/ui/ScreenShell.tsx', category: 'Écrans & layout', note: 'maquette d’états — la coquille EST cet écran', render: ScreenShellNote },
  { label: 'ScreenMeta', file: 'src/ui/ScreenMeta.tsx', category: 'Écrans & layout', render: ScreenMetaDemo },
  { label: 'MasterDetail', file: 'src/ui/MasterDetail.tsx', category: 'Écrans & layout', render: MasterDetailDemo },
  { label: 'Tabs', file: 'src/ui/Tabs.tsx', category: 'Écrans & layout', render: TabsDemo },
  { label: 'MenuCard', file: 'src/ui/MenuCard.tsx', category: 'Écrans & layout', render: MenuCardDemo },
  { label: 'Band', file: 'src/ui/Band.tsx', category: 'Écrans & layout', render: BandDemo },
  { label: 'SearchFilterField', file: 'src/ui/SearchFilterField.tsx', category: 'Écrans & layout', render: SearchFilterFieldDemo },
  { label: 'OptionChooser', file: 'src/ui/OptionChooser.tsx', category: 'Jets', render: OptionChooserDemo },
  { label: 'PanneauParametre', file: 'src/ui/PanneauParametre.tsx', category: 'Écrans & layout', render: PanneauParametreDemo },
  { label: 'InfluenceRow', file: 'src/ui/InfluenceRow.tsx', category: 'Jets', render: InfluenceRowDemo },
  { label: 'VsHeader', file: 'src/ui/VsHeader.tsx', category: 'Jets', render: VsHeaderDemo },
  { label: 'RollShell', file: 'src/ui/RollShell.tsx', category: 'Jets', note: 'maquette statique d’états — un spécimen vivant exigerait un flux de jet monté (store + makeRollFlow), hors de portée d’une vignette de galerie', render: RollShellStaticMock },
  { label: 'RollRow', file: 'src/ui/RollRow.tsx', category: 'Jets', note: 'maquette statique d’états — même raison que RollShell (flux de jet monté hors de portée d’une vignette)', render: RollRowStaticMock },
  { label: 'PortraitTile', file: 'src/ui/PortraitTile.tsx', category: 'Personnages', render: PortraitTileDemo },
  { label: 'LifeBar', file: 'src/ui/LifeBar.tsx', category: 'Personnages', render: LifeBarDemo },
  { label: 'CharacterPreview', file: 'src/ui/CharacterPreview.tsx', category: 'Personnages', render: CharacterPreviewDemo },
  { label: 'CreatorDice', file: 'src/ui/creator/CreatorDice.tsx', category: 'Personnages', render: CreatorDiceDemo },
  { label: 'CreatorStepFrame', file: 'src/ui/creator/CreatorStepFrame.tsx', category: 'Personnages', note: 'gabarit plein-champ — s’observe sur les 7 pas du créateur, pas en vignette', render: CreatorStepFrameNote },
  { label: 'RoseAxes', file: 'src/ui/RoseAxes.tsx', category: 'Personnages', render: RoseAxesDemo },
  { label: 'CharStatsGrid', file: 'src/ui/CharStatsGrid.tsx', category: 'Personnages', render: CharStatsGridDemo },
  { label: 'TradeTable', file: 'src/ui/TradeTable.tsx', category: 'Négoce & activités', render: TradeTableDemo },
  { label: 'ActivityPane', file: 'src/ui/ActivityPane.tsx', category: 'Négoce & activités', render: ActivityPaneDemo },
  { label: 'QtyStepper', file: 'src/ui/QtyStepper.tsx', category: 'Négoce & activités', render: QtyStepperDemo },
  { label: 'NumberField', file: 'src/ui/NumberField.tsx', category: 'Négoce & activités', render: NumberFieldDemo },
  { label: 'GatedAction', file: 'src/ui/GatedAction.tsx', category: 'Négoce & activités', render: GatedActionDemo },
  { label: 'ParchmentCard', file: 'src/ui/ParchmentCard.tsx', category: 'Négoce & activités', render: ParchmentCardDemo },
  { label: 'Prose', file: 'src/ui/Prose.tsx', category: 'Texte', render: ProseDemo },
  { label: 'GameOpEditor', file: 'src/ui/editor/GameOpEditor.tsx', category: 'Éditeur', render: GameOpEditorDemo },
  { label: 'DescRefField', file: 'src/ui/compendium/DescRefField.tsx', category: 'Éditeur', render: DescRefFieldDemo },
  { label: 'GameOpChips', file: 'src/ui/GameOpChips.tsx', category: 'Texte', render: GameOpChipsDemo },
  { label: 'MetalStatus', file: 'src/ui/MetalStatus.tsx', category: 'Atelier du scribe', render: MetalStatusDemo },
  { label: 'WaxSeal / SealedPlaque', file: 'src/ui/WaxSeal.tsx', category: 'Atelier du scribe', render: WaxSealDemo },
  { label: 'CareerPath', file: 'src/ui/CareerPath.tsx', category: 'Atelier du scribe', render: () => <CareerPath levels={niveauxDeLaCarriereExemple()} currentLevel={2} /> },
  { label: 'FigTile', file: 'src/ui/FigTile.tsx', category: 'Atelier du scribe', render: FigTileDemo },
  { label: 'PlaqueRow / PlaqueGrid', file: 'src/ui/PlaqueRow.tsx', category: 'Atelier du scribe', render: PlaqueRowDemo },
  { label: 'GroupedPickGrid', file: 'src/ui/GroupedPickGrid.tsx', category: 'Atelier du scribe', render: GroupedPickGridDemo },
  { label: 'DetailFrame', file: 'src/ui/DetailFrame.tsx', category: 'Atelier du scribe', render: DetailFrameDemo },
  { label: 'HeroSheet', file: 'src/ui/HeroSheet.tsx', category: 'Personnages', render: HeroSheetDemo },
  { label: 'ReadyRow', file: 'src/ui/ReadyRow.tsx', category: 'Écrans & layout', render: ReadyRowDemo },
  { label: 'ItemIcon', file: 'src/ui/ItemIcon.tsx', category: 'Négoce & activités', render: ItemIconDemo },
  { label: 'MediaSelect', file: 'src/ui/MediaSelect.tsx', category: 'Négoce & activités', render: MediaSelectDemo },
  { label: 'RefField', file: 'src/ui/compendium/RefField.tsx', category: 'Éditeur', render: RefFieldDemo },
];

export const GALLERY_CATEGORIES = [...new Set(GALLERY_SPECIMENS.map((s) => s.category))];
