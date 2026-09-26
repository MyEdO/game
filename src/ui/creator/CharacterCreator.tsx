/**
 * Assistant de création de personnage (LDB 04/05 « Personnage ») — OSSATURE 2 ZONES canonique
 * (croquis user 2026-07-15, lot « ossature enforcée » #393), encodée dans `CreatorStepFrame` :
 *
 *   ┌ header : titre + étapes ─────────────────────────────────────────┐
 *   │ CHOIX : bande d'ACTION en tête (Choisir /   │  DESC : fiche de   │
 *   │ Tirer aux dés — slot REQUIS du gabarit),    │  l'élue, puis      │
 *   │ puis grille/contrôles de l'étape            │  FICHE VIVANTE     │
 *   └ footer : précédent / validation / suivant ───────────────────────┘
 *
 * Seule l'étape Présentation garde un gabarit dédié (user 2026-07-15 : « c'est sensé être le même
 * sauf sur le dernier écran »). La logique (tirages figés, bonus de PX, validation, construction)
 * vit dans ./draft.ts (pur).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGame } from '../../state/store';
import { rovingKeyDown } from '../rovingFocus';
import { NumberField } from '../NumberField';
import { rosterAdd, rosterLoad } from '../../state/roster';
import {
  species as allSpecies,
  careersForSpecies,
  classes,
  findCareerById,
  careerLabelFor,
  displayLabelForSex,
  findSpeciesById,
  findClassById,
  findSkill,
  findTalent,
  talentConcrete,
  findTrappingById,
  trappingRefLabel,
  qualityRefLabel,
  findQualityById,
  advancementLabel,
  trappings as allTrappings,
  type TrappingRef,
  levelsForCareer,
  charAbr,
  stars as starsTable,
  celestialHouses,
  indexParId,
  memoParVersion,
  spells as allSpells,
  rigSpeciesId,
  specLabel,
  findBookById,
  skillInstanceLabel,
  speciesSize,
  SpeciesData,
  CareerData,
  StarData,
  fabricationAtouts,
  DEFAULT_FABRICATION_ATOUT,
} from '../../data';
import { SIZE_LABEL } from '../../engine/size';
import type { SourceRef } from '../../data/schemas/grammaire/valeurs';
import { CHAR_KEYS, CharKey, CHAR_LABELS, Characteristics, Combatant } from '../../engine/types';
import { damageString, itemFromTrappingById, itemLabel } from '../../engine/items';
import { skillBaseValue } from '../../engine/skills';
import { effectiveChar } from '../../engine/characteristics';
import { rangeSpecLabel, ammoRangeModLabel } from '../weaponStats';
import { formatSpellRange, formatSpellDuration } from '../../engine/spellRangeFormat';
import { effectiveEntry } from '../../engine/variants';
import { Coins } from '../Coins';
import { makeRNG } from '../../engine/dice';
import { generateName } from '../../engine/names';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { OptionChooser } from '../OptionChooser';
import { MediaSelect, type MediaOption } from '../MediaSelect';
import { ItemIcon } from '../ItemIcon';
import { Tabs } from '../Tabs';
import { AppearancePanel } from '../AppearancePanel';
import { BackgroundFields } from '../BackgroundFields';
import { CodexRef } from '../compendium/CodexRef';
import { Prose, mdToText } from '../Prose';
import { CodexSections } from '../compendium/CodexEntry';
import { EntityRef, EntityChoice, SkillChip, TalentChip } from '../EntityChip';
import { raceSkillSection, raceTalentSection, type CodexSection } from '../compendium/registry';
import { CharStatsGrid } from '../CharStatsGrid';
import { GameOpChips } from '../GameOpChips';
import type { Appearance } from '../../gameIso/rig/appearance';
import { bodyHeight } from '../../gameIso/rig/composeRig';
import { hash32 } from '../../data/hash';
import { previewHero } from './CreatorSummary';
import { CreatorStepFrame, StepHeader, Section, XpBadge, type StepZones } from './CreatorStepFrame';
import { Band } from '../Band';
import { fillDraftDefaults } from './creatorDefaults';
import { QtyStepper } from '../QtyStepper';
import { CreatorDice } from './CreatorDice';
import { useRollFrisson, prefersReducedMotion } from '../useRollFrisson';
import { DiceRoll, DieFace } from '../DiceRoll';
import { d100Faces, d10Face } from '../Dice';
import { CelestialWheel } from './CelestialWheel';
import { DetailFrame } from '../DetailFrame';
import { WaxSeal } from '../WaxSeal';
import { GroupedPickGrid, type PickGridSection } from '../GroupedPickGrid';
import { MetalStatus } from '../MetalStatus';
import { CareerPath } from '../CareerPath';
import { FigTile } from '../FigTile';
import { PlaqueRow, PlaqueGrid } from '../PlaqueRow';
import { NotchGauge } from '../NotchGauge';
import { SearchFilterField, filterByLabel, useFilteredList } from '../SearchFilterField';
import {
  CreatorDraft,
  newDraft,
  draftSpecies,
  draftLevel,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  rollDraftCareer,
  rollDraftChars,
  rollDraftTalents,
  withCoastalSwap,
  coastalSwapAvailable,
  careerRollPool,
  speciesXp,
  careerXp,
  charsXp,
  charRolls,
  charRollPairs,
  draftChars,
  careerCharKeys,
  careerSkillEntries,
  careerAdvTotal,
  evenCareerSkillAdvances,
  careerTalentOptions,
  specOptionsFor,
  pettySpellQuota,
  draftWealth,
  rollDraftWealth,
  rolledDetails,
  validateStep,
  stepIds,
  type StepId,
  starXp,
  rollDraftStar,
  rollDraftAstrology,
  SPECIES_SKILLS_PLUS5,
  SPECIES_SKILLS_PLUS3,
  speciesSkillTier,
  withSpeciesSkillTier,
  speciesSkillStep,
  speciesSkillsDone,
  careerSkillsDone,
  talentsDone,
  skillsSubMessage,
  type SkillsSub,
  speciesTalentFixedEntries,
  speciesTalentChoiceEntries,
  speciesTalentRandomCount,
  speciesTalentRandomDrawn,
  CAREER_SKILL_ADVANCES,
  MAX_ADV_PER_SKILL,
  CAREER_CHAR_ADVANCES,
  buildHero,
  draftFromHero,
  probeHero,
  xpTotal,
  isUnresolvedChoice,
  splitLabel,
  splitTopLevelOu,
} from './draft';
import { XP_CAREER_FIRST, XP_CAREER_TOP3, XP_STAR_ROLLED, parseStatus, speciesAllowed } from '../../engine/creation';
import { PARTY_MAX } from '../../state/combatants';
import { GatedAction } from '../GatedAction';

/** Métadonnées d'étape : libellé FR + ÉCRAN de plein rendu. Les HUIT pas passent par la MÊME porte —
 *  un pas pose ses propres hooks puis compose `CreatorStepFrame` (seule Présentation garde un
 *  gabarit dédié, user 2026-07-15) : le dispatcher `StepBody` n'a donc qu'une branche, sans
 *  assertion. SOURCE UNIQUE du rendu, indexée par `StepId` stable — l'ordre ET la présence des
 *  étapes viennent de `stepIds()` (draft.ts, qui insère « Signe astral » selon la règle optionnelle
 *  ADE II), jamais d'un index positionnel codé. EXPORTÉE pour la garde structurelle
 *  (`creator-ossature.test.tsx`), qui monte chaque étape via `StepBody` et vérifie les slots du
 *  gabarit. */
export const STEP_META: Record<StepId, { label: string; screen: (p: StepProps) => ReactNode }> = {
  species: { label: 'Race', screen: SpeciesRaceScreen },
  career: { label: 'Carrière', screen: CareerScreen },
  chars: { label: 'Caractéristiques', screen: CharScreen },
  star: { label: 'Signe astral', screen: StarScreen },
  skills: { label: 'Compétences & Talents', screen: SkillsScreen },
  trappings: { label: 'Possessions', screen: TrappingsScreen },
  details: { label: 'Détails', screen: DetailsScreen },
  presentation: { label: 'Présentation', screen: PresentationScreen },
};

/** Espèces mises en avant : celles du Livre de base — dérivé des données, les suppléments
 *  apparaissent automatiquement à la suite. */
const especesDuLivreDeBase = memoParVersion('species', () => allSpecies.filter((s) => s.source.book === 'livre-de-base').map((s) => s.label));

/** Choix proposés pour l'emplacement `{wildcard:'arme'}` : toutes les ARMES des données ({id, label}),
 *  hors celles que le catalogue DÉCLARE « Mains nues » (`TrappingData.unarmed`) — on ne choisit pas ses
 *  poings comme équipement de départ. */
const armesChoisissables = memoParVersion('trappings', () => allTrappings
  .filter((t) => (t.categorie === 'melee' || t.categorie === 'ranged') && !t.unarmed)
  .map((t) => ({ id: t.id, label: t.label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr')));
/** Demeure céleste par ID (ADE II 3 l.504-512) — libellé affiché + desc RAW en tooltip du thème astral. */
const demeureParId = indexParId('celestialHouses', celestialHouses);

/** Texte de données (desc Markdown) → extrait lisible pour cartes et infobulles. */
function blurb(md: string | null | undefined, max = 160): string {
  if (!md) return '';
  const txt = mdToText(md);
  return txt.length > max ? `${txt.slice(0, max)}…` : txt;
}
const talentTip = (name: string) => blurb(findTalent(splitLabel(name).name)?.desc, 300);
/** Clé de la Caractéristique liée à une compétence (« Ag »), pour annoter les listes. */
const skillCharKey = (name: string): CharKey | null => findSkill(splitLabel(name).name)?.characteristic ?? null;
/** Id STABLE de la Compétence désignée par une entrée d'avancement (« Corps à corps (Base) ») —
 *  le nom gravé sur la plaque est un déclencheur Codex, comme le `.skillref` de la planche. */
const skillIdOf = (name: string): string | undefined => findSkill(splitLabel(name).name)?.id;

/** Apparence de PRÉ-SÉLECTION (rail/entête, avant tout réglage) d'une espèce par `id` rules —
 *  mêmes briques que le brouillon (`rigSpeciesId`), rendue par la primitive `CharacterPreview`.
 *  CACHE module-scope (entrées finies, objets immuables) : un objet STABLE par (espèce, sexe), sinon
 *  le `React.memo` de CharacterPreview ne prend jamais et les ~25 lignes du rail re-résolvent le rig
 *  à chaque rendu de l'étape. */
const PICK_APPEARANCES = new Map<string, Appearance>();
function pickAppearance(speciesId: string, sex: 'M' | 'F', variantId?: string): Appearance {
  const key = `${speciesId}|${sex}|${variantId ?? ''}`;
  let a = PICK_APPEARANCES.get(key);
  if (!a) {
    a = { species: rigSpeciesId(speciesId), sex, build: 0.5, seed: hash32(speciesId, sex, variantId ?? '') };
    PICK_APPEARANCES.set(key, a);
  }
  return a;
}

export function CharacterCreator() {
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const setScreen = useGame((s) => s.setScreen);
  const addHero = useGame((s) => s.partyAddHero);
  const replaceHero = useGame((s) => s.partyReplaceHero);
  const editingHeroId = useGame((s) => s.editingHeroId);
  const setEditingHero = useGame((s) => s.setEditingHero);

  // MODE ÉDITION : héros déjà dans le groupe (bouton « Modifier ») → on rouvre son brouillon.
  // Round-trip SANS perte si le roster a gardé le `draft` exact ; sinon reconstruction partielle
  // (espèce/carrière/identité/apparence — pas les tirages figés ni les allocations).
  const editing = useMemo(() => {
    if (!editingHeroId) return null;
    const hero = party.find((h) => h.id === editingHeroId);
    if (!hero) return null;
    const saved = rosterLoad().find((e) => e.hero.id === editingHeroId);
    const draft = saved?.draft ?? draftFromHero(hero);
    return { heroId: hero.id, draft, lossless: !!saved?.draft };
  }, [editingHeroId, party]);

  const [d, setD] = useState<CreatorDraft>(() => editing?.draft ?? newDraft());
  const [step, setStep] = useState(0);

  const ids = stepIds();
  const curId = ids[step] ?? ids[ids.length - 1]; // garde-fou si la règle change le nombre d'étapes
  const err = validateStep(d, curId);
  const canNext = err == null;

  // Recette (DEV, #518) : couture __wfrp.fillCreatorDefaults — même patron que __wfrpSetHover
  // (gameIso/stage/useStagePointer.ts) : le composant pose get/set/setStep/fill sur window, le
  // helper devtools (state/devtools.ts) les consomme. SETUP UNIQUEMENT (jamais le flux joueur réel).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as {
      __wfrpCreator?: {
        get: () => CreatorDraft;
        set: (next: CreatorDraft) => void;
        setStep: (id: StepId) => void;
        fill: (upto?: string) => string;
      };
    };
    w.__wfrpCreator = {
      get: () => d,
      set: (next) => setD(next),
      setStep: (id) => {
        const idx = stepIds().indexOf(id);
        if (idx !== -1) setStep(idx);
      },
      fill: (upto) => {
        const ids2 = stepIds();
        const target = (upto && ids2.includes(upto as StepId) ? upto : ids2[ids2.length - 1]) as StepId;
        if (upto && !ids2.includes(upto as StepId)) return `✗ étape « ${upto} » inconnue — ids : ${ids2.join(', ')}`;
        setD((cur) => fillDraftDefaults(cur, target));
        setStep(ids2.indexOf(target));
        return `✓ brouillon rempli jusqu'à « ${target} » (${ids2.indexOf(target) + 1}/${ids2.length})`;
      },
    };
    return () => { delete w.__wfrpCreator; };
  }, [d]);
  const [skillsSub, setSkillsSub] = useState<SkillsSub>('race');
  const skillsSubDone =
    skillsSub === 'race' ? speciesSkillsDone(d) : skillsSub === 'career' ? careerSkillsDone(d) : talentsDone(d);

  const closeCreator = () => {
    setEditingHero(null);
    setScreen('party');
  };

  const create = () => {
    const hero = buildHero(d, editing?.heroId); // édition : on conserve l'id du héros
    const wealth = draftWealth(d);
    rosterAdd({ hero, wealth, draft: d }); // roster persistant + brouillon EXACT (round-trip futur)
    if (editing) {
      // Remplacement EN PLACE (primitive atomique) : préserve l'index/ordre et transfère la
      // possession au même siège — pas de re-crédit de la Richesse (déjà comptée à la création).
      const seat = net.ownership[editing.heroId] ?? net.mySeat ?? 0;
      replaceHero(editing.heroId, hero, seat);
    } else {
      addHero(hero, wealth); // côté invité : intent vers l'hôte (l'état arrive par snapshot)
    }
    closeCreator();
  };

  const stepProps: StepProps = { d, setD, skillsSub, setSkillsSub };

  // Récap de pied VALIDE — étapes Race/Carrière (#393 P2/P4) : le message d'erreur garde toujours
  // la priorité (cf. footer, `err ?? ...`) ; une fois le choix fait, la barre le redit.
  const raceFooterSummary = (): string | null => {
    const sp = draftSpecies(d);
    if (!sp) return null;
    return `Race ${sp.label} — M ${sp.movement} · Destin ${sp.fate.fate} · Résilience ${sp.fate.resilience} · +${sp.fate.extra} à répartir.`;
  };
  const careerFooterSummary = (): string | null => {
    const c = findCareerById(d.careerId);
    if (!c) return null;
    const lvl1 = levelsForCareer(d.careerId).find((l) => l.level === 1);
    const cl = findClassById(c.class);
    return `Classe ${cl?.label ?? c.class} · carrière ${c.label} — départ ${lvl1?.label ?? '—'}, ${lvl1?.status ?? ''}.`;
  };

  // Une réf Codex cliquée ouvre la fiche en MODALE par-dessus l'assistant (cf. CodexOverlay) : le
  // brouillon reste intact (plus de changement d'écran qui le réinitialisait).
  return (
    <div className="screen creator">
      <header className="bar">
        <button className="btn small row-flex" onClick={closeCreator}>
          ← <Icon id="nav/seat-owner" size="sm" /> Groupe ({party.length}/{PARTY_MAX})
        </button>
        <h2>{editing ? 'Modifier le personnage' : 'Créateur de personnage'}</h2>
        <div className="wizard-steps">
          {ids.map((id, i) => (
            <button
              key={id}
              className={`step-chip ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              disabled={i > step}
              onClick={() => setStep(i)}
            >
              {i + 1}. {STEP_META[id].label}
            </button>
          ))}
        </div>
        {/* Mobile : indicateur compact (pas de rangée défilante → pas de scrollbar). */}
        <div className="steps-progress">
          <span>
            Étape <b>{step + 1}</b>/{ids.length} · {STEP_META[curId].label}
          </span>
          <div className="steps-bar">
            <i style={{ width: `${((step + 1) / ids.length) * 100}%` }} />
          </div>
        </div>
      </header>

      {editing && !editing.lossless && (
        <p className="hint warn-text" style={{ margin: '4px 12px' }}>
          <Icon id="ui/warning" size="sm" /> Brouillon d'origine indisponible : race, carrière, identité et apparence sont repris, mais
          les tirages, allocations et Talents sont à revoir étape par étape avant d'enregistrer.
        </p>
      )}

      <StepBody id={curId} step={step} {...stepProps} />

      <footer className="bar">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Précédent
        </button>
        <span className={`hint wizard-hint${(curId === 'skills' ? !skillsSubDone : !!err) ? ' warn-text' : ''}`}>
          {curId === 'skills'
            ? skillsSubMessage(d, skillsSub)
            : err ??
              (curId === 'species'
                ? raceFooterSummary() ?? ''
                : curId === 'career'
                  ? careerFooterSummary() ?? ''
                  : curId === 'presentation'
                    ? 'Relisez votre héros — chaque étape reste modifiable avant l\'engagement.'
                    : '')}
        </span>
        {step < ids.length - 1 ? (
          <button
            className="btn btn-primary"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
          >
            Suivant →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={(!editing && party.length >= PARTY_MAX) || !canNext} onClick={create}>
            {editing ? 'Enregistrer les modifications' : 'Engager ce héros →'}
          </button>
        )}
      </footer>
    </div>
  );
}

type StepProps = {
  d: CreatorDraft;
  setD: (d: CreatorDraft) => void;
  /** Sous-onglet actif de l'étape 5 (a/b/c) — levé jusqu'ici pour que le pied de page (footer,
   *  `CharacterCreator`) reflète le volet ACTIF plutôt que le premier blocage toutes-branches. */
  skillsSub?: SkillsSub;
  setSkillsSub?: (s: SkillsSub) => void;
};

/** Corps d'étape — dispatcher UNIQUE de `STEP_META` (consommé par l'assistant ET la garde
 *  d'ossature `creator-ossature.test.tsx` : même chemin de montage, aucun double dispatch).
 *  `screen` monté en JSX (jamais en appel de fonction nue) : chaque écran-étape pose ses PROPRES
 *  hooks internes (recherche, `useRollFrisson`…) — un appel direct les compterait dans les hooks
 *  du composant appelant, en ordre instable d'une étape à l'autre (violation des Règles des Hooks,
 *  #393 P2 — crashait au passage Race→Carrière). En JSX, React isole chaque écran dans son PROPRE
 *  Fiber (identité = le type de composant) : bascule d'étape = démonte/remonte proprement. */
export function StepBody({ id, ...props }: StepProps & { id: StepId; step: number }) {
  const Screen = STEP_META[id].screen;
  return <Screen {...props} />;
}

/** Titre de la rubrique Talents de l'explorateur de carrière (LDB 05 l.535 : « Vous pouvez choisir un
 *  unique Talent » — un SEUL choix à la création, parmi les 4 du Niveau de DÉPART uniquement). Les
 *  niveaux supérieurs consultés (rangs 2-4, `CareerPath`) restent NEUTRES — de l'évolution future,
 *  jamais un choix de création (bug utilisateur 2026-07-15 : le rang 3 affichait la même note). */
export function careerLevelTalentsTitle(level: number): string {
  return level === 1 ? 'Talents — un au choix' : `Talents — Niveau ${level}`;
}

/** Rendu Markdown des textes de données (descriptions — verbatim de la source, via la primitive Prose). */
function LoreText({ md }: { md: string | null | undefined }) {
  if (!md?.trim()) return null;
  return <div className="lore-text"><Prose md={md} /></div>;
}

// ════ 1) Race (LDB 04 l.87-101) — charte « Atelier du scribe » (#393 P2, correction structurelle
//      du verdict utilisateur 2026-07-14) : ossature `CreatorStepFrame` (bande d'action = recherche
//      + encrier ; choix ~60 % / desc ~40 %) — choix = 7 GRANDES CARTES DE RACE (une par `SpeciesData.family`,
//      figurine généreuse + « N lignées ») ⇄ détail = la LIGNÉE choisie (chips-pills en tête du
//      panneau, une par variante de la famille — Reiklander/Middenheim/…) puis `DetailFrame` de la
//      lignée élue. Le brouillon reste keyé sur `speciesId` (id de LIGNÉE, ex. `humains-reiklander`)
//      — seule la PRÉSENTATION du choix se restructure en race→lignée, jamais la mécanique
//      (`withSpecies`/`rollDraftSpecies` inchangés). Pas de fiche vivante à cette étape (arbitrage
//      2026-07-14).
export function SpeciesRaceScreen({ d, setD }: StepProps): ReactNode {
  const [search, setSearch] = useState('');
  const sp = draftSpecies(d);
  const gridRef = useRef<HTMLDivElement>(null);
  const lineageRef = useRef<HTMLDivElement>(null);

  // Groupes par race (`SpeciesData.family` — donnée, jamais une regex sur le libellé),
  // les races du Livre de base d'abord — l'ordre des familles suit les données ; au sein d'une
  // famille, la 1ʳᵉ lignée des données EST la canonique (ex. Reiklander pour Humains, LDB 04 l.91).
  // Une espèce gatée par une règle optionnelle inactive (`SpeciesData.gatedByRule`) n'apparaît pas
  // dans la grille — MÊME filtre que le Tableau des Races aléatoires (`speciesAllowed`).
  const families: { family: string; list: SpeciesData[] }[] = [];
  for (const s of allSpecies) {
    if (!speciesAllowed(s)) continue;
    const g = families.find((f) => f.family === s.family);
    if (g) g.list.push(s);
    else families.push({ family: s.family, list: [s] });
  }
  const socle = especesDuLivreDeBase();
  families.sort((a, b) => Number(b.list.some((s) => socle.includes(s.label))) - Number(a.list.some((s) => socle.includes(s.label))));
  const totalRaces = families.reduce((n, f) => n + f.list.length, 0);

  /** Apparence de la figurine qui REPRÉSENTE une famille sur sa carte : sa 1ʳᵉ lignée (la canonique
   *  des données) — source UNIQUE du rendu de la tuile ET de la mesure de la toise ci-dessous. */
  const famAppearance = (f: { list: SpeciesData[] }) => pickAppearance(f.list[0].id, d.sex, f.list[0].variant ?? f.list[0].id);
  // TOISE COMMUNE de la grille de RACE (#431, verdict user 2026-07-15 verbatim : « ça ne permet pas
  // de voir les différences de taille ») : une carte de race se compare aux AUTRES races — chaque
  // figurine est donc cadrée à son échelle VRAIE contre la plus HAUTE des familles, au lieu d'être
  // normée à sa propre tuile (où halfling et ogre paraissaient de même taille). La toise est une
  // DONNÉE (hauteur du gabarit de rig, `bodyHeight`), jamais un cas par race. Mesurée sur TOUTES les
  // familles, pas sur les seules visibles : la toise des races ne bouge pas quand la recherche filtre
  // la grille. La normalisation PAR TUILE reste le défaut de `CharacterPreview` — c'est le bon
  // cadrage aux tuiles de CARRIÈRE, qui comparent des figurines de la MÊME race (verdict user, même
  // jour : « OK pour la carrière mais ici c'est un souci »).
  const raceScaleRef = Math.max(...families.map((f) => bodyHeight(famAppearance(f))));

  // La recherche filtre les RACES (nom de famille) ET les LIGNÉES (variantes) — une lignée matchée
  // garde/surligne sa carte de race (le filtre agit au niveau famille, jamais en éclatant la grille).
  const visibleFamilies = filterByLabel(families, (f) => `${f.family} ${f.list.map((s) => s.variant ?? s.label).join(' ')}`, search);
  const activeFamilyIdx = Math.max(0, visibleFamilies.findIndex((f) => f.family === sp?.family));
  const selectFamily = (list: SpeciesData[]) => setD(withSpecies(d, sp && list.some((s) => s.id === sp.id) ? sp.id : list[0].id));
  const onGridKeyDown = rovingKeyDown<HTMLDivElement>({
    containerRef: gridRef,
    selector: '[role="option"]',
    count: visibleFamilies.length,
    activeIndex: activeFamilyIdx,
    onActivate: (idx) => selectFamily(visibleFamilies[idx].list),
    orientation: 'grid',
  });

  // Lignées de la famille COURANTE (chips en tête du panneau détail) — masquées si la famille n'a
  // qu'une lignée (Gnomes/Hauts elfes/Elfes sylvains/Ogres du LDB) : rien à trancher.
  const famList = sp ? families.find((f) => f.family === sp.family)?.list ?? [] : [];
  const onLineageKeyDown = rovingKeyDown<HTMLDivElement>({
    containerRef: lineageRef,
    selector: '[role="radio"]',
    count: famList.length,
    activeIndex: Math.max(0, famList.findIndex((s) => s.id === sp?.id)),
    onActivate: (idx) => setD(withSpecies(d, famList[idx].id)),
    orientation: 'grid',
  });

  // Encrier de tirage RACE (#393 P3, correction structurelle du verdict utilisateur 2026-07-14) :
  // rangée UNIQUE avec la recherche (recherche à gauche, encrier remplit le reste — pas de section
  // « Aux dés » séparée, pas de rangée d'aide flottante : le sous-titre PORTE la règle). Une fois le
  // d100 posé, le mur de boutons meurt : le résultat vit dans l'encrier (rendu laiton) et l'éligibilité
  // se marque sur les surfaces existantes (badge « +20 PX » des chips de lignée, liseré des cartes de
  // famille) — la sélection reste la même mécanique (chips/cartes), le bonus de PX inchangé (`speciesXp`).
  const rolledIds = d.speciesRoll?.ids ?? [];
  const rolledFamilies = new Set(rolledIds.map((id) => findSpeciesById(id)?.family).filter((f): f is string => !!f));
  const rolledFamily = d.speciesRoll ? (sp && rolledIds.includes(sp.id) ? sp.family : findSpeciesById(rolledIds[0])?.family) : undefined;
  const kept = speciesXp(d) > 0;
  const { rolling, landed, trigger, skip } = useRollFrisson(() => setD(rollDraftSpecies(d)));
  const faces = landed && d.speciesRoll ? d100Faces(d.speciesRoll.roll) : null;

  const diceCell = rolling || landed ? (
    <DiceRoll scene landed={landed} faces={faces} onSkip={skip} tone="gold" />
  ) : !d.speciesRoll ? (
    <button type="button" className="dicewell act emph" onClick={() => trigger()}>
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={null} landed tone="gold" /></span>
        <span className="rm-die dicewell-die"><DieFace n={null} landed tone="gold" /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">Tirer aux dés — d100</span>
        <span className="dicewell-sub">sa race au hasard : <b>+20 PX de création</b> (garder le tirage)</span>
      </span>
    </button>
  ) : (
    <div className="dicewell done">
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(d.speciesRoll.roll)[0]} landed tone="gold" /></span>
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(d.speciesRoll.roll)[1]} landed tone="gold" /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">
          Jet : <b>{d.speciesRoll.roll}</b> — borne {rolledFamily} · {kept ? '+20 PX conservé' : '+0 PX (choix libre)'}
        </span>
      </span>
    </div>
  );

  // Bande d'ACTION (slot requis de l'ossature) : recherche + encrier de tirage en rangée unique.
  const action = (
    <div className="creator-pick-toolbar">
      <div className="creator-pick-search">
        <SearchFilterField value={search} onChange={setSearch} icon placeholder="Rechercher une race…" />
      </div>
      {diceCell}
    </div>
  );
  const choice = (
    <>
      {/* Vocabulaire de la planche (`.mini-title` : « 7 familles — 27 races ») — une CARTE est une
          famille, une LIGNÉE est une race. Le compte dit la vérité de la grille RENDUE : sans la
          règle optionnelle « Gnome jouable » (NADJ), le Gnome n'est ni compté ni affiché. */}
      <p className="creator-pick-count">{families.length} familles — {totalRaces} races</p>
      <div ref={gridRef} role="listbox" aria-label="Choix de la race" className="creator-race-grid" onKeyDown={onGridKeyDown}>
        {visibleFamilies.map((f, idx) => {
          const rep = f.list[0];
          const selected = sp?.family === f.family;
          const rolled = !selected && rolledFamilies.has(f.family);
          return (
            <FigTile
              key={f.family}
              preview={{
                appearance: famAppearance(f),
                career: rep.previewCareer?.id,
                // Cadrage par DÉFAUT de la primitive (0.88) : le cadrage large (0.75) était une
                // réponse à la tuile PLEIN CHAMP, où la figurine était la tuile et où le visage
                // touchait le bord (« ça écrase les visages », #431). La boîte-figurine du patron
                // planche est DÉDIÉE (172px, légende DEHORS, padding de tuile au-dessus) : la tête
                // ne touche plus rien, et 0.75 n'y laisserait qu'un quart de boîte d'air mort
                // au-dessus de la plus grande figurine (planche : son ogre remplit la boîte).
                scaleRef: raceScaleRef, // ÉCHELLE VRAIE : toise commune à la grille, pas à la tuile (#431)
              }}
              label={f.family}
              sub={`${f.list.length} lignée${f.list.length > 1 ? 's' : ''}`}
              selected={selected}
              sealed={selected}
              fig="big" // surface PRINCIPALE de l'étape : boîte-figurine pleine zone (patron `.fam-grid.big`)
              tabIndex={idx === activeFamilyIdx ? 0 : -1}
              className={rolled ? 'rolled' : undefined}
              onClick={() => selectFamily(f.list)}
            />
          );
        })}
      </div>
    </>
  );


  const detail = !sp ? (
    <p className="hint">
      Sélectionnez une race dans la liste, ou tirez-la aux dés. Le détail se remplira au fil de vos choix.
    </p>
  ) : (
    <DetailFrame
      topper={
        famList.length > 1 ? (
          <div ref={lineageRef} role="radiogroup" aria-label="Lignée" className="creator-race-lineages" onKeyDown={onLineageKeyDown}>
            {famList.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === sp.id}
                tabIndex={s.id === sp.id ? 0 : -1}
                className={`chip creator-race-lineage${s.id === sp.id ? ' sel' : ''}`}
                onClick={() => setD(withSpecies(d, s.id))}
              >
                {s.variant ?? s.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
      label={<CodexRef category="races" id={sp.id} label={sp.label}>{sp.label}</CodexRef>}
      sub={sourceSub(sp.source)}
      meta={
        <>
          <span className="chip">Mouvement <b>{sp.movement}</b></span>
          <span className="chip">Destin <b>{sp.fate.fate}</b></span>
          <span className="chip">Résilience <b>{sp.fate.resilience}</b></span>
          <span className="chip"><b>+{sp.fate.extra}</b> à répartir</span>
          {speciesSize(sp) !== 'moyenne' && (
            <span className="chip" title="Talent de Taille d'espèce">
              Taille <b>{SIZE_LABEL[speciesSize(sp)]}</b>
            </span>
          )}
        </>
      }
      // Caractéristiques : `CharStatsGrid` (source unique de la plaque .char-stats, #418) avec
      // `sp.baseChar` — plus de rows codex-kv ; le delta vs base humaine (20) passe en `note` (tooltip
      // discret), jamais dans la valeur affichée. Compétences/Talents : mêmes sections que le Codex
      // (source unique `raceSkillSection`/`raceTalentSection`), « ou » en chips SÉPARÉES codex-liées.
      sections={
        <>
          <div>
            <div className="mini-title">Caractéristiques de base</div>
            <CharStatsGrid
              size="md"
              value={(k) => sp.baseChar?.[k] ?? 20}
              note={(k) => {
                const base = sp.baseChar?.[k] ?? 20;
                const diff = base - 20;
                return diff !== 0 ? `Base humaine 20 (${diff > 0 ? '+' : ''}${diff})` : undefined;
              }}
            />
          </div>
          <CodexSections sections={[raceSkillSection(sp), raceTalentSection(sp)].filter((s): s is CodexSection => !!s)} />
        </>
      }
      prose={sp.desc}
      proseSelfLabel={sp.label}
      proseSelfCategory="races"
    />
  );

  return <CreatorStepFrame d={d} step={stepIds().indexOf('species')} label="Choix de la race" zones={{ action, choice, desc: detail }} />;
}

// ════ 2) Carrière (LDB 05 l.204-318) — charte « Atelier du scribe » (#393 P2, MÊME ossature
//      `CreatorStepFrame` que Race) : choix = TOUTES les classes en SECTIONS empilées
//      (`GroupedPickGrid`, une tuile-figurine compacte par carrière — `FigTile`/`CharacterPreview`,
//      ~6-7 par rangée, planche ratifiée du créateur (écran Carrière), corrigé 2026-07-14 : le brief
//      « nominatif sans figurine » venait du croquis initial, la planche RATIFIÉE montre bien de
//      petites figurines) ⇄ détail = la carrière élue (`DetailFrame` — `MetalStatus`+`CareerPath`,
//      1ers consommateurs réels, #412). Mécanique INCHANGÉE (`withCareer`/`rollDraftCareer`,
//      draft.ts) — présentation seule se restructure, patron encrier de Race (rangée toolbar,
//      résultat vit dans l'encrier plutôt qu'un mur de boutons).
export function CareerScreen({ d, setD }: StepProps): ReactNode {
  const [search, setSearch] = useState('');
  const sp = draftSpecies(d);
  // Table EFFECTIVE (#393 P2 correctif utilisateur) : `careersForSpecies` seule renvoie les DEUX
  // portions Riverains/Côtiers quand la colonne d'espèce les porte toutes deux — la grille doit
  // rester en phase avec la bascule `coastalSwap` (MÊME exclusivité que le tirage, `careerRollPool`),
  // sinon la classe désactivée reste visible/sélectionnable quel que soit l'état de la chip.
  const pool = careerRollPool(d);
  const accessible = sp ? careersForSpecies(sp.refCareer, d.ignoreRestrictions).filter((c) => pool.some((p) => p.id === c.id)) : [];
  const career = findCareerById(d.careerId);
  const levels = levelsForCareer(d.careerId);
  const lvl1 = levels.find((l) => l.level === 1);
  const lvlMax = levels.length ? levels.reduce((a, b) => (a.level > b.level ? a : b)) : undefined;

  // Rang CONSULTÉ (exploration en LECTURE du détail, #393 P2 correctif utilisateur) : la chaîne
  // `CareerPath` bascule les rubriques Caractéristiques/Compétences/Talents sur le niveau cliqué —
  // le CHOIX de création reste au niveau 1 (`draft.ts`/`buildHero` ne lisent jamais `exploredLevel`).
  const [exploredLevel, setExploredLevel] = useState(1);
  useEffect(() => setExploredLevel(1), [d.careerId]);
  const lvlExplored = levels.find((l) => l.level === exploredLevel) ?? lvl1;

  const sectionsAll: PickGridSection[] = sp
    ? classes
        .filter((cl) => accessible.some((c) => c.class === cl.id))
        .map((cl) => ({
          id: cl.id,
          label: cl.label,
          items: accessible
            .filter((c) => c.class === cl.id)
            .map((c: CareerData) => ({ id: c.id, label: c.label, preview: { appearance: pickAppearance(sp.id, d.sex, c.id), career: c.id } })),
        }))
    : [];
  const q = search.trim();
  const sections = q
    ? sectionsAll.map((s) => ({ ...s, items: filterByLabel(s.items, (it) => it.label, q) })).filter((s) => s.items.length)
    : sectionsAll;

  // Encrier de tirage CARRIÈRE (#393 P2, même patron que Race #393 P3) : rangée unique recherche +
  // encrier, le résultat vit dans l'encrier rendu (plus de mur de boutons de borne). LDB 05 l.208-212 :
  // 1ᵉʳ jet gardé = +50 PX ; pas convaincu → deux jets de plus (3 bornes au choix) = +25 PX ; au-delà,
  // relances libres = 0 PX (mécanique `rollDraftCareer`/`careerXp`, INCHANGÉE).
  const rolledLast = d.careerRolls[d.careerRolls.length - 1];
  const kept = careerXp(d) > 0;
  const { rolling, landed, trigger, skip } = useRollFrisson(() => setD(rollDraftCareer(d)));
  const faces = landed && rolledLast ? d100Faces(rolledLast.roll) : null;

  const diceCell = rolling || landed ? (
    <DiceRoll scene landed={landed} faces={faces} onSkip={skip} tone="gold" />
  ) : d.careerRolls.length === 0 ? (
    <button type="button" className="dicewell act emph" disabled={!sp} onClick={() => trigger()}>
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={null} landed tone="gold" /></span>
        <span className="rm-die dicewell-die"><DieFace n={null} landed tone="gold" /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">Tirer aux dés — d100</span>
        <span className="dicewell-sub">
          sa carrière au hasard : <b>+{XP_CAREER_FIRST} PX</b> (1ᵉʳ jet) · pas convaincu, deux relances → <b>+{XP_CAREER_TOP3} PX</b>
        </span>
      </span>
    </button>
  ) : (
    <div className="dicewell done">
      <span className="dicewell-tray">
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(rolledLast.roll)[0]} landed tone="gold" /></span>
        <span className="rm-die dicewell-die"><DieFace n={d100Faces(rolledLast.roll)[1]} landed tone="gold" /></span>
      </span>
      <span className="dicewell-copy">
        <span className="dicewell-txt">
          {d.careerRolls.length >= 3 ? (
            <>Jets : <b>{d.careerRolls.map((r) => r.roll).join(' · ')}</b> — 3 choix · {kept ? `+${careerXp(d)} PX conservé` : '+0 PX (choix libre)'}</>
          ) : (
            <>Jet : <b>{rolledLast.roll}</b> — {kept ? `+${careerXp(d)} PX conservé` : '+0 PX (choix libre)'}</>
          )}
        </span>
        {d.careerRolls.length === 1 && (
          <button type="button" className="btn small" style={{ marginTop: 4 }} onClick={() => trigger()}>
            <Icon id="nav/dice" size="sm" /> Pas convaincu : 2 jets de plus (3 choix, +{XP_CAREER_TOP3} PX)
          </button>
        )}
        {d.careerRolls.length >= 3 && (
          <button type="button" className="btn small" style={{ marginTop: 4 }} onClick={() => trigger()}>
            <Icon id="nav/dice" size="sm" /> Continuer à relancer (0 PX)
          </button>
        )}
      </span>
    </div>
  );

  // Bande d'ACTION (slot requis de l'ossature) : recherche + encrier (désactivé tant que la race
  // n'est pas posée — le bouton reste PRÉSENT, croquis « boutons toujours présents »).
  const action = (
    <div className="creator-pick-toolbar">
      <div className="creator-pick-search">
        <SearchFilterField value={search} onChange={setSearch} icon placeholder="Rechercher une carrière…" />
      </div>
      {diceCell}
    </div>
  );
  const choice = !sp ? (
    <p className="hint">Choisissez d'abord une race pour découvrir les carrières accessibles.</p>
  ) : (
    <>
      <div className="row-flex creator-pick-filters">
        <button
          type="button"
          className="chip"
          aria-pressed={d.ignoreRestrictions}
          onClick={() => setD({ ...d, ignoreRestrictions: !d.ignoreRestrictions })}
        >
          Ignorer les restrictions de race
        </button>
        {/* MDG 09 l.9 : choix AVANT le jet — VERROUILLÉE dès qu'un jet existe (`withCoastalSwap` refuse
            déjà le changement côté draft ; l'UI le reflète en désactivant la chip, anti-exploit
            relance gratuite, #393 P2 correctif utilisateur). */}
        {coastalSwapAvailable(d) && (
          <GatedAction
            id="creator-coastal-swap"
            label="Côtiers à la place des Riverains"
            ariaPressed={d.coastalSwap}
            enabled={d.careerRolls.length === 0}
            reason="Se choisit avant de lancer les dés — verrouillé depuis le premier jet de Carrière."
            onClick={() => setD(withCoastalSwap(d, !d.coastalSwap))}
            primary={false}
            bare
            btnClassName="chip"
          />
        )}
        <span className="creator-pick-count">{sectionsAll.length} classes — {accessible.length} carrières</span>
      </div>
      <GroupedPickGrid
        sections={sections}
        selectedId={d.careerId || undefined}
        sealedId={d.careerId || undefined}
        onSelect={(id) => setD(withCareer(d, id))}
        label="Choix de la carrière"
      />
    </>
  );


  const detail = !sp ? (
    <p className="hint">Sélectionnez d'abord une race (étape précédente).</p>
  ) : !career || !lvl1 ? (
    <p className="hint">Sélectionnez une carrière dans la liste, ou tirez-la aux dés.</p>
  ) : (
    <DetailFrame
      label={<CodexRef category="careers" id={career.id} label={career.label ?? d.careerId}>{careerLabelFor({ career: d.careerId, appearance: { sex: d.sex } })}</CodexRef>}
      sub={sourceSub(career.source)}
      meta={
        <>
          {career.class && (
            <span className="chip">
              <CodexRef category="classes" id={career.class} label={findClassById(career.class)?.label ?? career.class}>{findClassById(career.class)?.label ?? career.class}</CodexRef>
            </span>
          )}
          <span className="chip">Départ <b>{lvl1.label}</b></span>
          <MetalStatus status={lvl1.status} size="chip" />
          {lvlMax && lvlMax.status !== lvl1.status && (
            <span className="chip">
              {lvl1.status} → {lvlMax.status}
            </span>
          )}
        </>
      }
      sections={
        <>
          <div>
            <div className="mini-title">Évolution — quatre niveaux <em className="hint">(cliquer un rang pour le consulter)</em></div>
            <CareerPath levels={levels} currentLevel={1} selected={exploredLevel} onSelect={setExploredLevel} />
          </div>
          {lvlExplored && (
            <>
              <div>
                <div className="mini-title">Caractéristiques — Niveau {lvlExplored.level}</div>
                <div className="skill-tags">
                  {lvlExplored.characteristics.map((c) => (
                    <EntityRef key={c} category="characteristics" id={c} label={CHAR_LABELS[c]} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mini-title">Compétences — Niveau {lvlExplored.level}</div>
                <div className="skill-tags">
                  {lvlExplored.skills.map((a) => advancementLabel('skills', a)).map((s) => (
                    <EntityChoice key={s} category="skills" entry={s} />
                  ))}
                </div>
              </div>
              <div>
                {/* Le qualificatif « un au choix » + la note de tranchage n'est vrai QU'AU NIVEAU DE
                    DÉPART (LDB 05 l.535 : « Vous pouvez choisir un unique Talent » — un seul choix à
                    la création, parmi les 4 du Niveau 1 SEUL) ; les niveaux supérieurs consultés ici
                    ne sont que de l'ÉVOLUTION future, jamais un choix de création (bug utilisateur
                    2026-07-15 : le rang 3 affichait la même note « se tranche à l'étape 5 »). */}
                <div className="mini-title">{careerLevelTalentsTitle(lvlExplored.level)}</div>
                <div className="skill-tags">
                  {lvlExplored.talents.map((a) => advancementLabel('talents', a)).map((t) => (
                    <EntityChoice key={t} category="talents" entry={t} />
                  ))}
                  {lvlExplored.level === 1 && <em className="nb">se tranche à l'étape 5</em>}
                </div>
              </div>
            </>
          )}
        </>
      }
      prose={career.desc}
      proseSelfLabel={career.label}
      proseSelfCategory="careers"
    />
  );

  return <CreatorStepFrame d={d} step={stepIds().indexOf('career')} label="Choix de la carrière" zones={{ action, choice, desc: detail }} />;
}

// ════ 3) Caractéristiques (LDB 05 l.319-464) — charte « Atelier du scribe » (#393 P3bis, correctif
//      utilisateur 2026-07-15 : « ni de près, ni de loin, la maquette » sur la composition 3-zones
//      d'origine) : gabarit DEUX ZONES (panneau + fiche vivante, MÊME composition que Race/Carrière/
//      Compétences) — plus de rail séparé, TOUT vit dans le panneau central en BANDES (`Band`, étalon
//      la planche ratifiée du créateur) : La méthode (segmenté) → Le tirage (grille + jauge N/10)
//      → Augmentations gratuites (0ter, la maquette a PERDU ce bloc — transposé ICI, même bandage que
//      Destin & Résilience, jamais supprimé) → Destin & Résilience. Mécanique INCHANGÉE (draft.ts).
/** Cadence de la cérémonie séquentielle des dix 2d10 (#393 agentivité) — chaque rangée roule
 *  ~400 ms avant de figer sa paire (clic sur la rangée qui roule = tout révéler, même impatience
 *  que `useRollFrisson.skip`). */
const CHAR_SEQ_MS = 400;
export function CharScreen({ d, setD }: StepProps): ReactNode {
  const sp = draftSpecies(d);
  const rolls = charRolls(d);
  const pairs = charRollPairs(d);
  const chars = draftChars(d);
  const careerKeys = careerCharKeys(d);
  const allocTotal = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
  const pbTotal = CHAR_KEYS.reduce((a, k) => a + d.pointBuy[k], 0);
  const splitTotal = d.fateSplit.fate + d.fateSplit.resilience;
  // CÉRÉMONIE SÉQUENTIELLE des dix 2d10 (#393 agentivité) : aucun dé à l'écran avant le geste
  // « Tirer aux dés » (caracs à « — ») ; le geste commit le brouillon (`rollDraftChars` — valeurs
  // figées par le seed, découvertes seulement) puis les rangées roulent UNE PAR UNE (`seq` = rangée
  // en cours, jauge N/10) ; chaque rangée fige sa PROPRE paire réelle (`pairs[i]`, `charRollPairs`),
  // jamais une valeur reconstruite depuis la somme. La relance (LDB 05 l.341, bonus perdus) rejoue
  // la MÊME cérémonie. `prefers-reduced-motion` (source unique `prefersReducedMotion`) saute le
  // théâtre : tout se révèle au clic.
  const [seq, setSeq] = useState<number | null>(null);
  useEffect(() => {
    if (seq == null) return;
    if (seq >= CHAR_KEYS.length) { setSeq(null); return; }
    const t = window.setTimeout(() => setSeq(seq + 1), CHAR_SEQ_MS);
    return () => window.clearTimeout(t);
  }, [seq]);
  const startCeremony = (next: CreatorDraft) => {
    setD(next);
    if (!prefersReducedMotion()) setSeq(0);
  };

  // DoD #535 : « la première rangée d'allocation non soldée » se ramène en vue TOUTE SEULE à la
  // FIN du tirage (jamais pendant — la cérémonie séquentielle porte déjà son propre recentrage via
  // `PlaqueRow.rolling`). Détecté au FRONT DESCENDANT de `seq` (numérique → `null`, cérémonie finie),
  // jamais sur le simple `!d.charsRolled` : sinon reviser cette étape (sans re-tirer) redéclencherait
  // le scroll à chaque montage.
  const prevSeqRef = useRef<number | null>(null);
  const [charsAttention, setCharsAttention] = useState<'alloc' | 'fate' | null>(null);
  useEffect(() => {
    const justFinished = prevSeqRef.current != null && seq == null;
    if (justFinished) {
      setCharsAttention(
        allocTotal < CAREER_CHAR_ADVANCES && careerKeys.length > 0 ? 'alloc'
        : sp && splitTotal < sp.fate.extra ? 'fate'
        : null,
      );
    }
    prevSeqRef.current = seq;
    // Ancré volontairement sur `seq` SEUL (front descendant) : lit allocTotal/splitTotal/sp/careerKeys
    // à CET instant plutôt que de les re-suivre en continu — un scroll UNIQUE en fin de cérémonie,
    // jamais un cursor qui recentre à chaque frappe de stepper ensuite.
  }, [seq]);

  const stepIdx = stepIds().indexOf('chars');
  if (!sp) {
    return (
      <CreatorStepFrame
        d={d}
        step={stepIdx}
        label="Caractéristiques"
        zones={{ action: null, choice: <p className="hint">Choisissez d'abord une race pour répartir vos Caractéristiques.</p> }}
      />
    );
  }

  // Jauge HONNÊTE de la cérémonie : 0 avant le geste, N pendant le défilé séquentiel, 10 posé.
  const tiredCount = !d.charsRolled ? 0 : seq == null ? 10 : Math.min(seq, 10);
  // Titre de bande à la planche (`.cu-sechead .ttl` + `small`) : mot-clef en display, suite en
  // petites capitales — même prose qu'avant, seulement scindée.
  const [tirageMain, tirageSub] =
    d.charMode === 'rolled' ? ['Le tirage', '2d10 par caractéristique'] : d.charMode === 'reassigned' ? ['Réassignation', 'des dix jets'] : ['Répartition', 'des points'];

  // Bande d'ACTION (slot requis de l'ossature) : LA MÉTHODE — le choix de la voie (#393 P3bis,
  // sélecteur PERMANENT segmenté, les trois options coexistent toujours) + le GESTE « Tirer aux
  // dés » (carte canonique `CreatorDice`, #393 agentivité — `frisson=false` : le théâtre appartient
  // aux rangées, pas à la carte) ; la relance RAW vit dans son verdict.
  const action = (
    <>
      <StepHeader title="Caractéristiques" sub="Base + 2d10 — le profil se couche sur le registre" />
      {/* LA MÉTHODE en mini-titre (planche : `.mini-title`, pas une barre de MÊME RANG que « Le
          tirage »/« Destin & Résilience ») — Section, même rang que « Aux dés » dessous. */}
      <Section title="La méthode" right={<XpBadge value={charsXp(d)} />}>
        <OptionChooser
          layout="seg"
          options={[
            { key: 'rolled', label: `Aux dés — garder le tirage`, value: undefined, mode: 'rolled' as const, px: d.charRerolls === 0 ? '+50 PX' : '+0 PX' },
            { key: 'reassigned', label: `Aux dés — réorganiser ensuite`, mode: 'reassigned' as const, px: d.charRerolls === 0 ? '+25 PX' : '+0 PX' },
            { key: 'pointBuy', label: 'Répartir 100 points', mode: 'pointBuy' as const, px: '0 PX' },
          ].map(({ key, label, mode, px }) => ({
            key,
            label: <>{label} <em className="hint" style={{ fontStyle: 'normal' }}>{px}</em></>,
            selected: d.charMode === mode,
            onSelect: () => setD({ ...d, charMode: mode }),
          }))}
        />
        <p className="hint" style={{ marginTop: 8 }}>
          Chaque Caractéristique s'écrit base + 2d10. Garder le tirage tel quel rapporte le plus de PX de création.
        </p>
      </Section>
      {d.charMode !== 'pointBuy' && (
        <CreatorDice
          label="Tirer les dix jets — 2d10 par Caractéristique"
          hint={<>Garder le tirage : +50 PX · réorganiser ensuite : +25 PX · relancer : +0 PX.</>}
          rolled={!!d.charsRolled}
          xp={charsXp(d)}
          frisson={false}
          onRoll={() => startCeremony(rollDraftChars(d))}
        >
          <button className="btn small" disabled={seq != null} onClick={() => startCeremony({ ...d, charRerolls: d.charRerolls + 1 })}>
            <Icon id="nav/dice" size="sm" /> Relancer les dix jets (bonus perdus)
          </button>
        </CreatorDice>
      )}
    </>
  );

  const choice = (
    <>
          {/* LE TIRAGE (#393 P3bis + agentivité) : jauge « N/10 tirées » en tête de bande — avant le
              geste rien n'est tiré (0/10, rangées à « — ») ; la cérémonie séquentielle révèle les
              rangées une à une (jauge qui monte), 10/10 posé. */}
          <Band
            title={<>{tirageMain}<small>{tirageSub}</small></>}
            right={
              d.charMode === 'pointBuy' ? (
                <b className={pbTotal === 100 ? 'ok-text' : 'warn-text'}>Points : {pbTotal}/100</b>
              ) : (
                <NotchGauge value={tiredCount} max={10} notches={10} format={(v, m) => `${v}/${m} tirées`} tone={tiredCount === 10 ? 'ok' : 'neutral'} />
              )
            }
          >
            <PlaqueGrid>
              {CHAR_KEYS.map((k, i) => {
                // revealed : la rangée a livré sa paire (cérémonie passée dessus, ou tirage posé).
                const revealed = !!d.charsRolled && (seq == null || i < seq);
                const rowRolling = seq === i;
                return (
                  <PlaqueRow
                    key={k}
                    rolling={rowRolling}
                    prefix={<CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]}>{charAbr(k)}</CodexRef>}
                    content={
                      <>
                        {CHAR_LABELS[k]}
                        {careerKeys.includes(k) && <span className="tag char">carrière</span>}
                      </>
                    }
                    // La base est la RUBRIQUE de la plaque, pas un item de méta : la planche la pose
                    // SOUS le nom (`.ck-cell .id > .rf`, « base 20 »), jamais à sa droite. En méta
                    // (`white-space:nowrap`) elle disputait la largeur au nom — d'où « Initiative »
                    // qui chevauchait « base 20 » dans une colonne de grille à deux.
                    sub={`base ${sp.baseChar[k] ?? 20}`}
                    meta={
                      <>
                        {d.charMode !== 'pointBuy' && rowRolling && (
                          <span className="row-flex">
                            <DiceRoll scene={false} landed={false} faces={null} onSkip={() => setSeq(null)} tone="gold" />
                          </span>
                        )}
                        {d.charMode !== 'pointBuy' && !rowRolling && !revealed && (
                          <span className="row-flex">
                            <span className="rm-die"><DieFace n={null} landed tone="gold" /></span>
                            <span className="rm-die"><DieFace n={null} landed tone="gold" /></span>
                          </span>
                        )}
                        {d.charMode === 'rolled' && revealed && (
                          <span className="row-flex">
                            <span className="rm-die"><DieFace n={pairs[i][0]} landed tone="gold" /></span>
                            <span className="rm-die"><DieFace n={pairs[i][1]} landed tone="gold" /></span>
                          </span>
                        )}
                        {d.charMode === 'reassigned' && revealed && (
                          <select
                            value={d.assignment[k]}
                            onChange={(e) => {
                              const idx = Number(e.target.value);
                              const holder = CHAR_KEYS.find((kk) => d.assignment[kk] === idx)!; // échange → permutation garantie
                              setD({ ...d, assignment: { ...d.assignment, [k]: idx, [holder]: d.assignment[k] } });
                            }}
                          >
                            {rolls.map((r, j) => (
                              <option key={j} value={j}>
                                +{r}
                              </option>
                            ))}
                          </select>
                        )}
                        {d.charMode === 'pointBuy' && (
                          <AllocStepper value={d.pointBuy[k]} min={4} max={18} onChange={(v) => setD({ ...d, pointBuy: { ...d.pointBuy, [k]: v } })} label={CHAR_LABELS[k]} />
                        )}
                      </>
                    }
                    value={d.charMode !== 'pointBuy' && !revealed ? '—' : chars[k]}
                  />
                );
              })}
            </PlaqueGrid>
          </Band>

          {/* AUGMENTATIONS GRATUITES (arbitrage 0ter, 2026-07-15) : la maquette a PERDU ce bloc — la
              MÉCANIQUE (5 Augmentations de carrière) reste, transposée au même bandage que Destin &
              Résilience plutôt qu'un widget recopié de l'ancien créateur. */}
          <Band
            title={<>Augmentations gratuites<small>{CAREER_CHAR_ADVANCES} sur les Caractéristiques de carrière</small></>}
            right={<b className={allocTotal === CAREER_CHAR_ADVANCES ? 'ok-text' : 'warn-text'}>{allocTotal}/{CAREER_CHAR_ADVANCES}</b>}
          >
            <PlaqueGrid>
              {careerKeys.map((k, i) => (
                <PlaqueRow
                  key={k}
                  attention={charsAttention === 'alloc' && i === 0}
                  content={<CodexRef category="characteristics" id={k} label={CHAR_LABELS[k]}>{CHAR_LABELS[k]}</CodexRef>}
                  meta={
                    <AllocStepper
                      value={d.charAdvancesAlloc[k] ?? 0}
                      max={Math.min(CAREER_CHAR_ADVANCES, (d.charAdvancesAlloc[k] ?? 0) + (CAREER_CHAR_ADVANCES - allocTotal))}
                      onChange={(v) => setD({ ...d, charAdvancesAlloc: { ...d.charAdvancesAlloc, [k]: v } })}
                      label={CHAR_LABELS[k]}
                    />
                  }
                />
              ))}
            </PlaqueGrid>
          </Band>

          <Band
            title={<>Destin &amp; Résilience<small>+{sp.fate.extra} à répartir</small></>}
            right={<b className={splitTotal === sp.fate.extra ? 'ok-text' : 'warn-text'}>{splitTotal}/{sp.fate.extra}</b>}
          >
            <p className="hint">
              <Icon id="resource/fate" size="sm" /> Destin : survie & Chance. <Icon id="resource/resilience" size="sm" /> Résilience :
              Détermination (votre Motivation la recharge).
            </p>
            <PlaqueGrid>
              <PlaqueRow
                attention={charsAttention === 'fate'}
                content={<><Icon id="resource/fate" size="sm" /> Points de Destin</>}
                meta={
                  <>
                    <em>race : {sp.fate.fate}</em>
                    <AllocStepper
                      value={d.fateSplit.fate}
                      max={Math.min(sp.fate.extra, d.fateSplit.fate + (sp.fate.extra - splitTotal))}
                      onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, fate: v } })}
                      label="Destin"
                    />
                  </>
                }
              />
              <PlaqueRow
                content={<><Icon id="resource/resilience" size="sm" /> Points de Résilience</>}
                meta={
                  <>
                    <em>race : {sp.fate.resilience}</em>
                    <AllocStepper
                      value={d.fateSplit.resilience}
                      max={Math.min(sp.fate.extra, d.fateSplit.resilience + (sp.fate.extra - splitTotal))}
                      onChange={(v) => setD({ ...d, fateSplit: { ...d.fateSplit, resilience: v } })}
                      label="Résilience"
                    />
                  </>
                }
              />
            </PlaqueGrid>
            {/* NOTE DE PIED de la planche (`.c-note` à `margin-top:auto`, mock2) : la pédagogie du
                profil quitte la bande « Le tirage » pour le pied de la zone de travail. */}
            <p className="hint">
              Vous réglez ici la valeur d'ÉDITION (base d'espèce + tirage/allocation) ; la fiche vivante en montre
              le résultat. Les Caractéristiques <span className="tag char">carrière</span> progressent au coût normal
              en PX et comptent pour la complétion du Niveau ; l'Initiative départage l'ordre du combat.
            </p>
          </Band>
    </>
  );

  return <CreatorStepFrame d={d} step={stepIdx} label="Caractéristiques" zones={{ action, choice }} />;
}

/** Adapte `QtyStepper` (primitive canonique, table `docs/primitives.md`) au vocabulaire LINÉAIRE de l'allocation
 *  du créateur (± 1 entre `min` et `max`) — un décrément/incrément d'UNE unité. Mort du `Stepper`
 *  local du créateur (verdict utilisateur 2026-07-15 : « on créait des primitives ou on fait encore
 *  du code spécifique création ? ») : ce site consomme la MÊME primitive que la table marchande. */
function AllocStepper({ value, min = 0, max, onChange, label }: { value: number; min?: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <QtyStepper
      center={<b>{value}</b>}
      onDec={() => onChange(value - 1)}
      onInc={() => onChange(value + 1)}
      decDisabled={value <= min}
      incDisabled={value >= max}
      decLabel={`${label} : diminuer`}
      incLabel={`${label} : augmenter`}
    />
  );
}

/** Sélecteur de spec pour une entrée « (Au choix) » — bound à specChoices[raw]. La VALEUR stockée est
 *  la spec SEULE (id de Groupe d'arme pour Corps à corps/Projectiles, texte FR sinon) — jamais un
 *  libellé complet reparsé ; l'affichage passe par `specLabel`. */
function SpecSelect({ d, setD, raw }: StepProps & { raw: string }) {
  const { name } = splitLabel(raw);
  const options = specOptionsFor(raw);
  const current = d.specChoices[raw] ?? '';
  const skillId = findSkill(name)?.id ?? name;
  return (
    <select
      value={current}
      onChange={(e) => {
        const specChoices = { ...d.specChoices };
        if (e.target.value) specChoices[raw] = e.target.value;
        else delete specChoices[raw];
        setD({ ...d, specChoices });
      }}
    >
      <option value="">— spécialisation —</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {specLabel('skills', skillId, s)}
        </option>
      ))}
    </select>
  );
}

/** Les POSITIONS de la roue céleste = les VINGT fourchettes d100 de la table RAW (ADE II 3 l.36-56,
 *  « Les 20 signes »), pas les 23 entrées de `stars.json` : L'Étoile du Sorcier (96-00) porte QUATRE
 *  destins (sous-table 1d10, `StarData.sub`) qui partagent sa borne `rand` et se déplient en plaques
 *  une fois l'aiguille posée. Grouper ICI est ce qui rend le cadran lisible — les quatre destins
 *  occupaient quatre positions voisines sous le MÊME nom, d'où le télescopage du pôle nord.
 *  Clé de position = la borne `rand` (donnée RAW stable, jamais un libellé). Dérivée une fois : les
 *  données sont statiques et immuables. */
const STAR_POSITIONS = (() => {
  const byRand = new Map<number, StarData[]>();
  for (const s of [...starsTable].sort((a, b) => a.rand - b.rand)) {
    const at = byRand.get(s.rand) ?? byRand.set(s.rand, []).get(s.rand)!;
    at.push(s);
  }
  let prev = 0;
  return [...byRand.entries()].map(([rand, members]) => {
    const from = prev + 1;
    prev = rand;
    // Plusieurs destins ⇒ ils ne diffèrent que par leur spec entre parenthèses : la position porte
    // le nom NU du signe (« L'Étoile du Sorcier »), les destins leur spec.
    const label = members.length > 1 ? splitLabel(members[0].label).name : members[0].label;
    return { key: String(rand), rand, from, members, label };
  });
})();

/** Tagline SOURCÉE d'une entrée de donnée (« Archives de l'Empire II p. 41 ») — `DetailFrame.sub`
 *  n'accepte rien d'autre qu'une réf de source, et trois étapes la composaient à l'identique. */
function sourceSub(source: SourceRef | undefined): string | undefined {
  if (!source) return undefined;
  return `${findBookById(source.book)?.label ?? source.book} p. ${source.page}`;
}

// ════ 3bis) Signe astral (ADE II 3, optionnel) — ossature `CreatorStepFrame`, étalon planche
//      FINALE mock « 4 — Signe astral » : bande d'ACTION (en-tête + note + encrier d100) ; CHOIX =
//      l'ASTROLABE et, à sa droite, le `DetailFrame` du signe élu ; DESC = fiche vivante (défaut du
//      gabarit). Un ÉCRAN (et non des `zones` nues) parce que le pas pose son propre état d'UI. ════
export function StarScreen({ d, setD }: StepProps) {
  // Position POINTÉE sans destin encore élu (L'Étoile du Sorcier : la roue déplie ses quatre destins,
  // le joueur en choisit un). État d'UI PUR — le brouillon ne connaît que `star`, l'id du destin élu.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const sign = d.star ? starsTable.find((s) => s.id === d.star) : undefined; // d.star = id STABLE
  const selPos = STAR_POSITIONS.find((p) => p.members.some((m) => m.id === d.star)) ?? STAR_POSITIONS.find((p) => p.key === pendingKey);
  // Talent « (Au choix) » octroyé par le signe (ex. Maître artisan) → spec à préciser (réutilise specChoices).
  const grantChoice = sign?.ops?.flatMap((o) => (o.op === 'grantTalent' && isUnresolvedChoice(talentConcrete(o)) ? [talentConcrete(o)] : []))[0];
  const grantOpts = grantChoice ? specOptionsFor(grantChoice) : [];

  const pickPos = (key: string) => {
    const pos = STAR_POSITIONS.find((p) => p.key === key);
    if (!pos) return;
    setPendingKey(key);
    // Un seul destin ⇒ l'élection est immédiate ; plusieurs ⇒ RIEN n'est élu tant que le joueur n'a
    // pas choisi son destin (jamais un destin imposé d'office — agentivité, amendement #393).
    setD({ ...d, star: pos.members.length === 1 ? pos.members[0].id : undefined });
  };

  // Bande d'ACTION (slot requis de l'ossature) : la TOPBAR de la planche — titre+rubrique à gauche,
  // encrier d100 borné à droite (`.fam-topbar` : « Aux dés — d100 / le ciel a rendu 15 — <signe> ») —
  // puis la note. L'encrier ne prend PLUS une section « Aux dés » à lui seul : la carte EST le geste
  // et son verdict, et la place ainsi rendue revient à l'astrolabe.
  const rollLabel = starsTable.find((s) => s.id === d.starRoll)?.label;
  const action = (
    <>
      <StepHeader title="Signe astral" sub={`La roue céleste — ${STAR_POSITIONS.length} signes · Archives de l'Empire II`}>
        <CreatorDice
          bare
          label="Tirer aux dés — d100"
          sub={<>son signe au hasard : <b>+{XP_STAR_ROLLED} PX de création</b> (garder le tirage)</>}
          rolled={!!d.starRoll}
          xp={starXp(d)}
          roll={d.starRollValue}
          verdict={
            <>
              le ciel a rendu <b>{d.starRollValue ?? '—'}</b> — {rollLabel ?? '—'}
              {' · '}
              <b>{starXp(d) > 0 ? `+${XP_STAR_ROLLED} PX conservé` : '+0 PX (choix libre)'}</b>
            </>
          }
          onRoll={() => {
            setPendingKey(null);
            setD(rollDraftStar(d));
          }}
        />
      </StepHeader>
      <p className="hint" style={{ margin: '0 0 8px' }}>
        Tourner la roue à la main choisit librement (+0 PX) ; le d100 s'arrête sur la fourchette du signe tiré, et le
        garder rapporte +{XP_STAR_ROLLED} PX de création (ADE II 3). L'Étoile du Sorcier ouvre quatre destins — la roue
        les déplie si l'aiguille s'y pose.
      </p>
    </>
  );

  // Zone de CHOIX : l'astrolabe à gauche, le sens du signe à droite (planche — description PLEINE
  // hauteur à côté de la roue, jamais sous elle).
  const choice = (
    <div className="appear-panel">
      <div className="star-wheel-col">
        <CelestialWheel
          signs={STAR_POSITIONS.map((p) => ({ key: p.key, label: p.label, roll: p.rand }))}
          selectedKey={selPos?.key}
          onSelect={pickPos}
          placeholder="Tirez ou choisissez votre signe"
          hub={
            selPos && {
              title: selPos.label,
              // La rubrique du moyeu n'est gravée que si la POSITION en porte une seule : les quatre
              // destins de L'Étoile du Sorcier partagent « Signe de la Magie » (elle vaut donc pour
              // la position), là où des destins discordants ne pourraient pas se résumer d'un mot.
              sub: selPos.members.every((m) => m.signe === selPos.members[0].signe) ? selPos.members[0].signe : null,
              note: `d100 : ${selPos.from === selPos.rand ? selPos.rand : `${selPos.from}-${selPos.rand}`}`,
            }
          }
        />
        {/* Astrologie : flavor PUR (ADE II 3 l.502-512, aucun effet de jeu) — sous le cadran, là où
            la roue laisse sa marge, jamais en concurrence avec le sens du signe. */}
        <Section title="Astrologie (pur roleplay)" right={<button className="btn small" onClick={() => setD(rollDraftAstrology(d))}><Icon id="nav/dice" size="sm" /> Thème astral</button>}>
          {d.ascendant || d.dwellings?.length ? (
            <div className="lore-text">
              {d.ascendant && <p style={{ margin: '0 0 6px' }}><b>Ascendant :</b> {d.ascendant}</p>}
              {d.dwellings?.map((h) => (
                <p key={h.house} style={{ margin: '0 0 4px' }} title={mdToText(demeureParId(h.house)?.desc ?? '')}>
                  <b>{demeureParId(h.house)?.label ?? h.house} :</b> {h.sign}
                </p>
              ))}
            </div>
          ) : (
            <p className="hint">Ascendant + {celestialHouses.length} demeures célestes — flavor pur (aucun effet de jeu).</p>
          )}
        </Section>
      </div>
      <div className="appear-controls">
        {selPos && selPos.members.length > 1 && (
          <Section title="Quatre destins — 1d10 (ADE II 3)">
            <PlaqueGrid>
              {selPos.members.map((m) => (
                <PlaqueRow
                  key={m.id}
                  content={splitLabel(m.label).spec ?? m.label}
                  meta={m.sub && <span className="hint">1d10 : {m.sub.min === m.sub.max ? m.sub.min : `${m.sub.min}-${m.sub.max}`}</span>}
                  selected={m.id === d.star}
                  onClick={() => setD({ ...d, star: m.id })}
                />
              ))}
            </PlaqueGrid>
          </Section>
        )}
        {sign ? (
          <DetailFrame
            label={<CodexRef category="stars" id={sign.id} label={sign.label}>{sign.label}</CodexRef>}
            sub={sourceSub(sign.source)}
            /* Rangée de chips à la DISCIPLINE de la planche (mock « 4 » : Dates + les modificateurs,
               rien d'autre) — la colonne ne fait que ~330px : une chip de prose l'éclate en autant de
               lignes qu'elle a de mots. `signe` (« Signe du Roublard ») est DÉJÀ gravé au moyeu de la
               roue, à deux doigts d'ici ; `dieux` (« Ranald, Katya (beauté désarmante (Reikland)) »)
               est de la donnée de RÉFÉRENCE — la fiche du Codex la rend (registry.ts, `fact('Dieu')`),
               à un clic du nom ci-dessus (`CodexRef`). Aucune donnée perdue : elles vivent où on les
               consulte, pas en travers du geste de choix. */
            meta={
              <>
                {sign.dates && <span className="chip">Dates <b>{sign.dates}</b></span>}
                <GameOpChips ops={sign.ops ?? []} />
              </>
            }
            sections={
              <>
                {/* L'« apparence » d'un signe décrit la CONSTELLATION, pas le natif (ADE II 3 :
                    La Grande Croix → « un X ») — texte d'ambiance verbatim, jamais une chip de fait. */}
                {sign.apparence && <p className="star-apparence">Au ciel : {sign.apparence}.</p>}
                {grantChoice && grantOpts.length > 0 && (
                  <label>
                    {splitLabel(grantChoice).name}
                    <select
                      value={d.specChoices[grantChoice] ?? ''}
                      onChange={(e) => {
                        const specChoices = { ...d.specChoices };
                        if (e.target.value) specChoices[grantChoice] = e.target.value; // spec SEULE, jamais un libellé complet
                        else delete specChoices[grantChoice];
                        setD({ ...d, specChoices });
                      }}
                    >
                      <option value="">— au choix —</option>
                      {grantOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                )}
                {d.star && (
                  <button className="btn small" onClick={() => { setPendingKey(null); setD({ ...d, star: undefined }); }}>
                    Aucun signe
                  </button>
                )}
                {/* La rubrique « Description » de la planche, juste au-dessus de l'encadré de prose. */}
                {sign.desc && <div className="mini-title" style={{ margin: 0 }}>Description</div>}
              </>
            }
            prose={sign.desc ?? undefined}
            proseSelfLabel={sign.label}
            proseSelfCategory="stars"
          />
        ) : (
          <p className="hint">
            {selPos && selPos.members.length > 1
              ? 'L’Étoile du Sorcier ouvre quatre destins — choisissez le vôtre ci-dessus.'
              : 'Choisissez ou tirez votre signe astral (ADE II 3) — son sens apparaîtra ici.'}
          </p>
        )}
      </div>
    </div>
  );

  return <CreatorStepFrame d={d} step={stepIds().indexOf('star')} label="Signe astral" zones={{ action, choice }} />;
}

// ════ 4) Compétences & Talents (LDB 05 l.465-541) — charte « Atelier du scribe » (#393 P4, étalons
//      `finale-mock4/5/6-5{a,b,c}`) : TROIS SOUS-ÉCRANS (`Tabs`, dock d'onglets « a/b/c ») — chacun
//      GABARIT DEUX ZONES (panneau de travail + fiche vivante `CreatorSummary`, MÊME composition que
//      Race/Carrière, #393 P2) : plus de rail séparé pour cette étape, l'encrier de sous-tirage/
//      répartition rejoint l'en-tête du panneau. Mécanique INCHANGÉE (draft.ts) — seule la
//      présentation se restructure en sous-écrans ; la fiche vivante RÉSOUT ses chips roadmap EN
//      DIRECT au fil des trois (`speciesSkillsDone`/`careerSkillsDone`/`talentsDone`), au lieu d'un
//      tout-ou-rien à l'arrivée sur l'étape (#417 suite). Talents d'espèce en TROIS lots dérivés de
//      la donnée (LDB 05 l.510, `draft.ts`) : ACQUIS D'OFFICE (fixes) / DE RACE — UN AU CHOIX
//      (« A ou B ») / TIRÉS AU D100 (figés par le seed dès la race choisie, jamais relancés).
export function SkillsScreen({ d, setD, skillsSub, setSkillsSub }: StepProps): ReactNode {
  // Contrôlé par `CharacterCreator` (pied de page par sous-onglet) quand fourni ; sinon état
  // local (tests qui montent l'écran seul, ex. CharacterCreator.test.tsx).
  const [localSub, setLocalSub] = useState<SkillsSub>('race');
  const sub = skillsSub ?? localSub;
  const setSub = setSkillsSub ?? setLocalSub;
  const sp = draftSpecies(d);
  const career = findCareerById(d.careerId);

  const stepIdx = stepIds().indexOf('skills');
  if (!sp || !career) {
    return (
      <CreatorStepFrame
        d={d}
        step={stepIdx}
        label="Compétences & Talents"
        zones={{ action: null, choice: <p className="hint">Choisissez d'abord une race et une carrière.</p> }}
      />
    );
  }

  const tabs = [
    { key: 'race' as const, label: <>a. Compétences de race{speciesSkillsDone(d) ? ' ✓' : ''}</> },
    { key: 'career' as const, label: <>b. de carrière{careerSkillsDone(d) ? ' ✓' : ''}</> },
    { key: 'talents' as const, label: <>c. Talents{talentsDone(d) ? ' ✓' : ''}</> },
  ];

  // DoD #535 (« même comportement pour les volets d'allocation de l'étape 5 ») : à l'ARRIVÉE sur un
  // volet d'allocation (montage, ou bascule de sous-onglet — pas de « cérémonie » ici, contrairement
  // à l'étape 3, donc pas de front descendant de `seq` à guetter), la première rangée NON SOLDÉE se
  // ramène en vue. `talents` n'a pas de rangée d'ALLOCATION (radiogroups « un au choix », #519) :
  // hors périmètre du DoD, aucune cible.
  const [skillsAttentionRaw, setSkillsAttentionRaw] = useState<string | null>(null);
  useEffect(() => {
    if (sub === 'race') {
      setSkillsAttentionRaw(
        speciesSkillsDone(d) ? null : sp.skills.map((a) => advancementLabel('skills', a)).find((raw) => speciesSkillTier(d, raw) === 0) ?? null,
      );
    } else if (sub === 'career') {
      setSkillsAttentionRaw(careerSkillsDone(d) ? null : careerSkillEntries(d).find((raw) => (d.skillAdvances[raw] ?? 0) === 0) ?? null);
    } else {
      setSkillsAttentionRaw(null);
    }
  }, [sub]);

  // Chaque volet livre SES zones (bande d'action + choix) — le gabarit les pose, le volet ne
  // décide pas où son geste atterrit.
  const pane =
    sub === 'race' ? speciesSkillsZones(d, setD, sp, skillsAttentionRaw)
    : sub === 'career' ? careerSkillsZones(d, setD, skillsAttentionRaw)
    : talentsZones(d, setD);

  return (
    <CreatorStepFrame
      d={d}
      step={stepIdx}
      label="Compétences & Talents"
      zones={{
        // Bande d'ACTION : le sous-stepper a/b/c (« sous-stepper au bandeau », planche FINALE) PUIS
        // l'en-tête du volet courant, qui porte son geste (encrier de répartition/de tirage) — la
        // planche pose ces cartes en topbar de la zone de travail, jamais dans un head de volet.
        action: (
          <>
            <Tabs tabs={tabs} active={sub} onChange={setSub} label="Sous-étape Compétences & Talents" className="creator-skills-tabnav" />
            {pane.action}
          </>
        ),
        choice: pane.choice,
      }}
    />
  );
}

/** Valeurs VIVANTES : caractéristique liée + valeur EFFECTIVE du héros prévisualisé (`effectiveChar`,
 *  lecteur canonique #498 — talents +5/Augmentations sont des passifs continus, jamais cuits dans les
 *  caractéristiques brutes du `Combatant`) — partagé par les trois sous-écrans (rubrique `.rf` gravée
 *  sous le nom de la plaque). */
function liveCharOf(d: CreatorDraft) {
  const hero = previewHero(d);
  const fallback: Characteristics = draftChars(d);
  return (raw: string): { k: CharKey | null; v: number } => {
    const k = skillCharKey(raw);
    if (!k) return { k, v: 0 };
    return { k, v: hero ? effectiveChar(hero, k) : fallback[k] };
  };
}

// ── 5a) Compétences de race (LDB 05 l.484) ──
function speciesSkillsZones(d: CreatorDraft, setD: (d: CreatorDraft) => void, sp: SpeciesData, attentionRaw: string | null): StepZones {
  const charOf = liveCharOf(d);
  const done = speciesSkillsDone(d);
  return {
    // Bande d'ACTION (planche mock4 : le `.c-dhead` et sa carte de répartition en topbar).
    action: (
      <StepHeader title="Compétences de race" sub="Un seul geste — l'héritage du sang">
        <button
          type="button"
          className={`dicewell${done ? ' done' : ' act emph'}`}
          onClick={() =>
            setD({
              ...d,
              speciesPlus5: sp.skills.slice(0, SPECIES_SKILLS_PLUS5).map((a) => advancementLabel('skills', a)),
              speciesPlus3: sp.skills.slice(SPECIES_SKILLS_PLUS5, SPECIES_SKILLS_PLUS5 + SPECIES_SKILLS_PLUS3).map((a) => advancementLabel('skills', a)),
            })
          }
        >
          <span className="dicewell-copy">
            <span className="dicewell-txt">Répartition par défaut</span>
            <span className="dicewell-sub">l'atelier répartit pour vous — modifiable ensuite</span>
          </span>
        </button>
      </StepHeader>
    ),
    choice: (
      <>
        <p className="hint">
          Votre sang {sp.label} offre 3 Compétences à +5 et 3 à +3, parmi les {sp.skills.length} du registre. L'allocation
          de métier vient à l'écran suivant — les deux se cumulent sur une même Compétence.
        </p>
        {/* Les quotas comptent DANS la bande titrée (planche `.cu-sechead .gauge` : « toujours au
            même endroit »), plus dans une rangée de jauges flottante sous l'intro. */}
        <Band
          title={<>De race<small>3×+5 · 3×+3 parmi {sp.skills.length}</small></>}
          right={
            <>
              <NotchGauge
                value={d.speciesPlus5.length}
                max={SPECIES_SKILLS_PLUS5}
                notches={SPECIES_SKILLS_PLUS5}
                format={(v, m) => `${v}/${m} à +5`}
                tone={d.speciesPlus5.length === SPECIES_SKILLS_PLUS5 ? 'ok' : 'neutral'}
              />
              <NotchGauge
                value={d.speciesPlus3.length}
                max={SPECIES_SKILLS_PLUS3}
                notches={SPECIES_SKILLS_PLUS3}
                format={(v, m) => `${v}/${m} à +3`}
                tone={d.speciesPlus3.length === SPECIES_SKILLS_PLUS3 ? 'ok' : 'neutral'}
              />
            </>
          }
        >
          <PlaqueGrid>
            {sp.skills.map((a) => advancementLabel('skills', a)).map((raw) => {
              const { k, v } = charOf(raw);
              const tier = speciesSkillTier(d, raw);
              return (
                <PlaqueRow
                  key={raw}
                  selected={tier > 0}
                  attention={raw === attentionRaw}
                  content={<CodexRef category="skills" id={skillIdOf(raw)} label={splitLabel(raw).name}>{raw}</CodexRef>}
                  sub={k ? `${CHAR_LABELS[k]} ${v}${tier ? ` → ${v + tier}` : ''}` : undefined}
                  meta={
                    <>
                      {isUnresolvedChoice(raw) && tier > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
                      {/* Paliers 0/3/5 quota-gérés (LDB 05 l.484) : mode DISCRET de `QtyStepper` — la
                          valeur cible vient de `speciesSkillStep` (source unique), `null` grise le bouton. */}
                      <QtyStepper
                        center={<b>{tier}</b>}
                        onDec={() => setD(withSpeciesSkillTier(d, raw, speciesSkillStep(d, raw, -1) as 0 | 3 | 5))}
                        onInc={() => setD(withSpeciesSkillTier(d, raw, speciesSkillStep(d, raw, 1) as 0 | 3 | 5))}
                        decDisabled={speciesSkillStep(d, raw, -1) == null}
                        incDisabled={speciesSkillStep(d, raw, 1) == null}
                        decLabel={`${raw} : palier inférieur`}
                        incLabel={`${raw} : palier supérieur`}
                      />
                    </>
                  }
                  value={tier > 0 ? `+${tier}` : '—'}
                />
              );
            })}
          </PlaqueGrid>
        </Band>
        <p className="hint">
          Les Compétences qui reviendront au registre de carrière restent DISTINCTES et se cumulent : la valeur
          formée s'ajoute à la Caractéristique liée — la rubrique de chaque plaque en montre le résultat.
        </p>
      </>
    ),
  };
}

// ── 5b) Compétences de carrière (LDB 05 l.535) — « Même gabarit exactement, seule la source
//      change » (planche mock5) : le MÊME meuble qu'en 5a, alimenté par les points de métier. ──
function careerSkillsZones(d: CreatorDraft, setD: (d: CreatorDraft) => void, attentionRaw: string | null): StepZones {
  const charOf = liveCharOf(d);
  const entries = careerSkillEntries(d);
  const total = careerAdvTotal(d);
  const done = careerSkillsDone(d);
  return {
    action: (
      <StepHeader title="Compétences de carrière" sub="Un seul geste — l'école du métier">
        <button type="button" className={`dicewell${done ? ' done' : ' act emph'}`} onClick={() => setD({ ...d, skillAdvances: evenCareerSkillAdvances(d) })}>
          <span className="dicewell-copy">
            <span className="dicewell-txt">+5 sur les huit</span>
            <span className="dicewell-sub">répartition simple, modifiable ensuite</span>
          </span>
        </button>
      </StepHeader>
    ),
    choice: (
      <>
        <p className="hint">
          Votre métier enseigne {CAREER_SKILL_ADVANCES} points, {MAX_ADV_PER_SKILL} au plus par Compétence
          d'un coup. Les +5/+3 de race sont acquis et se CUMULENT — la rangée le rappelle (« +5 de race »).
        </p>
        <Band
          title={<>De carrière<small>{CAREER_SKILL_ADVANCES} points · max {MAX_ADV_PER_SKILL} par Compétence</small></>}
          right={
            <NotchGauge
              value={total}
              max={CAREER_SKILL_ADVANCES}
              format={(v, m) => `${v} / ${m} · reste ${m - v}`}
              tone={done ? 'ok' : 'neutral'}
            />
          }
        >
          <PlaqueGrid>
            {entries.map((raw) => {
              const { k, v } = charOf(raw);
              const adv = d.skillAdvances[raw] ?? 0;
              const raceTier = speciesSkillTier(d, raw);
              return (
                <PlaqueRow
                  key={raw}
                  selected={adv > 0}
                  attention={raw === attentionRaw}
                  content={<CodexRef category="skills" id={skillIdOf(raw)} label={splitLabel(raw).name}>{raw}</CodexRef>}
                  // `.rf` de la planche : « Sociabilité 31 · +5 de race » — le cumul se LIT sur la rangée.
                  sub={
                    [k ? `${CHAR_LABELS[k]} ${v}${adv ? ` → ${v + adv}` : ''}` : '', raceTier > 0 ? `+${raceTier} de race` : '']
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  meta={
                    <>
                      {isUnresolvedChoice(raw) && adv > 0 && <SpecSelect d={d} setD={setD} raw={raw} />}
                      <AllocStepper
                        value={adv}
                        max={Math.min(MAX_ADV_PER_SKILL, adv + (CAREER_SKILL_ADVANCES - total))}
                        onChange={(val) => setD({ ...d, skillAdvances: { ...d.skillAdvances, [raw]: val } })}
                        label={raw}
                      />
                    </>
                  }
                  value={adv > 0 ? `+${adv}` : '—'}
                />
              );
            })}
          </PlaqueGrid>
        </Band>
      </>
    ),
  };
}

// ── 5c) Talents (LDB 05 l.493-510) — de race « un au choix » ⇄ de carrière « un au choix » ⇄
//      tirés au d100 (figés dès la race choisie, listés ici en lecture — jamais une relance). ──
function talentsZones(d: CreatorDraft, setD: (d: CreatorDraft) => void): StepZones {
  const probe = probeHero(d, false);
  const fixed = speciesTalentFixedEntries(d);
  const choiceEntries = speciesTalentChoiceEntries(d);
  const drawn = speciesTalentRandomDrawn(d);
  const randomCount = speciesTalentRandomCount(d);
  const careerChoices = careerTalentOptions(d);
  return {
    // Bande d'ACTION (planche mock6 : « l'encrier à dés […] remonte en topbar de la zone de
    // travail, AU-DESSUS des deux colonnes »). TIRÉS AU D100 (#393 agentivité) : VIDES avant le
    // geste — la carte canonique `CreatorDice` porte le tirage (frisson central, chips au verdict) ;
    // un doublon déjà possédé est relancé D'OFFICE par le résolveur (LDB 05 l.484), RAW n'offre
    // aucune relance au joueur (aucun bouton de relance ici, cf. `rollDraftTalents`).
    action: (
      <>
        <StepHeader title="Talents" sub="Ce que le sort a tranché" />
        {randomCount > 0 && (
          <CreatorDice
            label={`Tirer ${randomCount} Talent${randomCount > 1 ? 's' : ''} — d100`}
            hint={<>Sur le Tableau des Talents aléatoires — un doublon déjà possédé se relance d'office.</>}
            rolled={!!d.talentsRolled}
            xp={0}
            onRoll={() => setD(rollDraftTalents(d))}
          >
            <div className="mini-title" style={{ marginTop: 0 }}>Tirés d'office — d100 — {randomCount} Talent{randomCount > 1 ? 's' : ''} rendu{randomCount > 1 ? 's' : ''}</div>
            <div className="skill-tags">
              {drawn.map((label) => (
                <EntityChoice key={label} category="talents" entry={label} />
              ))}
            </div>
          </CreatorDice>
        )}
      </>
    ),
    choice: (
      <>
        <p className="hint">
          Un seul Talent de carrière au Niveau 1 — les trois autres s'achèteront en PX au fil du jeu.
        </p>
        {/* « Deux colonnes de MÊME RANG » (planche mock6) : la primitive globale `.panel-grid`
            (auto-fit, une seule colonne ≤700px) — jamais une 2e grille 2-colonnes de domaine. */}
        <div className="panel-grid">
          <Band title={<>De race<small>un au choix</small></>} right={<b className={choiceEntries.every((e) => d.speciesTalentChoices[e]) ? 'ok-text' : 'warn-text'}>{choiceEntries.filter((e) => d.speciesTalentChoices[e]).length}/{choiceEntries.length}</b>}>
            {choiceEntries.length === 0 ? (
              <p className="hint">Aucune décision ici — la race ne propose pas de branche « A ou B ».</p>
            ) : (
              <div className="talent-options-grid">
                {choiceEntries.map((entry) => {
                  const options = splitTopLevelOu(entry);
                  const selected = d.speciesTalentChoices[entry] ?? null;
                  const activeOptIdx = Math.max(0, options.findIndex((o) => o === selected));
                  const groupRef: { current: HTMLDivElement | null } = { current: null };
                  const onOptKeyDown = rovingKeyDown<HTMLDivElement>({
                    containerRef: groupRef,
                    selector: '[role="radio"]',
                    count: options.length,
                    activeIndex: activeOptIdx,
                    onActivate: (idx) => setD({ ...d, speciesTalentChoices: { ...d.speciesTalentChoices, [entry]: options[idx] } }),
                    orientation: 'grid',
                  });
                  return (
                    <div key={entry} ref={groupRef} role="radiogroup" aria-label={entry} onKeyDown={onOptKeyDown}>
                      {options.map((opt, i) => {
                        const isSel = selected === opt;
                        return (
                          <span key={opt}>
                            {i > 0 && <span className="talent-option-ou">ou</span>}
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSel}
                              tabIndex={i === activeOptIdx ? 0 : -1}
                              className={`talent-option ${isSel ? 'selected' : ''}`}
                              onClick={() => setD({ ...d, speciesTalentChoices: { ...d.speciesTalentChoices, [entry]: opt } })}
                            >
                              {isSel && <WaxSeal size={26} className="talent-option-seal" />}
                              <b>{opt}</b>
                              <p className="hint talent-desc">{talentTip(opt)}</p>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            {fixed.length > 0 && (
              <>
                <div className="mini-title">Acquis d'office</div>
                <div className="skill-tags">
                  {fixed.map((label) => (
                    <EntityChoice key={label} category="talents" entry={label} />
                  ))}
                </div>
              </>
            )}
          </Band>
          <Band title={<>De carrière<small>un au choix</small></>} right={<b className={d.careerTalent ? 'ok-text' : 'warn-text'}>{d.careerTalent ? 1 : 0}/1</b>}>
            {(() => {
              // Roving tabindex : seules les entrées SÉLECTIONNABLES (`selected` non nul et pas
              // `maxed`) sont focalisables — un bouton `disabled` ne peut de toute façon pas recevoir
              // le focus (`.focus()` y est un no-op), le cursor roving doit donc les ignorer.
              const enabledChoices = careerChoices.filter((c) => c.selected && !c.maxed);
              const activeCareerIdx = Math.max(0, enabledChoices.findIndex((c) => c.selected === d.careerTalent));
              const careerRef: { current: HTMLDivElement | null } = { current: null };
              const onCareerKeyDown = rovingKeyDown<HTMLDivElement>({
                containerRef: careerRef,
                selector: '[role="radio"]:not(:disabled)',
                count: enabledChoices.length,
                activeIndex: activeCareerIdx,
                onActivate: (idx) => setD({ ...d, careerTalent: enabledChoices[idx].selected! }),
                orientation: 'grid',
              });
              return (
                <div ref={careerRef} className="talent-options-grid" role="radiogroup" aria-label="Talent de carrière" onKeyDown={onCareerKeyDown}>
                {careerChoices.map(({ entry, choices, selected, maxed }) => {
                  const isSel = !!selected && d.careerTalent === selected;
                  const enabled = !!selected && !maxed;
                  const enabledIdx = enabled ? enabledChoices.findIndex((c) => c.entry === entry) : -1;
                  return (
                  <div key={entry} className={`talent-option ${isSel ? 'selected' : ''}`}>
                    {isSel && <WaxSeal size={26} className="talent-option-seal" />}
                    {/* Le `<select>` de spécialisation est un contrôle DISTINCT de la carte-bouton (un
                        `<select>` imbriqué dans un `<button>` est du HTML invalide — contenu interactif
                        dans du contenu interactif) : bouton = choisir CE talent, menu = préciser la
                        spécialisation, tous deux dans la même carte. */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      disabled={!selected || maxed}
                      tabIndex={enabled ? (enabledIdx === activeCareerIdx ? 0 : -1) : undefined}
                      className="talent-option-btn"
                      onClick={() => selected && setD({ ...d, careerTalent: selected })}
                    >
                      <b>{entry}</b>
                      {maxed && <em className="hint">Maxi atteint (déjà possédé)</em>}
                      {!maxed && selected && probe.talents.some((t) => talentConcrete(t) === selected) && <em className="hint">déjà possédé via la race → passera ×2</em>}
                      <p className="hint talent-desc">{talentTip(selected ?? entry)}</p>
                    </button>
                    {choices && (
                      <select
                        value={selected ?? ''}
                        onChange={(e) => {
                          const specChoices = { ...d.specChoices, [entry]: e.target.value };
                          const next = { ...d, specChoices };
                          setD(d.careerTalent && d.careerTalent === selected ? { ...next, careerTalent: e.target.value } : next);
                        }}
                      >
                        <option value="">— choisir —</option>
                        {choices.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  );
                })}
                </div>
              );
            })()}
          </Band>
        </div>
        <PettySpellsSection d={d} setD={setD} />
      </>
    ),
  };
}

/** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.714) : le Talent pris → choisir
 *  exactement BFM sorts, mémorisés de façon permanente à la création. */
export function PettySpellsSection({ d, setD }: StepProps) {
  const quota = pettySpellQuota(d);
  if (!quota) return null;
  const minors = allSpells.filter((s) => s.family === 'mineure').map((s) => effectiveEntry(s));
  const toggle = (label: string) => {
    if (d.pettySpells.includes(label)) setD({ ...d, pettySpells: d.pettySpells.filter((x) => x !== label) });
    else if (d.pettySpells.length < quota) setD({ ...d, pettySpells: [...d.pettySpells, label] });
  };
  return (
    <Section
      title="Sorts de Magie mineure (inclus au Talent)"
      right={<b className={d.pettySpells.length === quota ? 'ok-text' : 'warn-text'}>{d.pettySpells.length}/{quota}</b>}
    >
      <div className="talent-options-grid">
        {minors.map((s) => {
          const picked = d.pettySpells.includes(s.label);
          return (
            <div key={s.label} className={`talent-option ${picked ? 'selected' : ''}`}>
              <label className="radio">
                <input type="checkbox" checked={picked} disabled={!picked && d.pettySpells.length >= quota} onChange={() => toggle(s.label)} />
                <b>{s.label}</b>
                <em className="hint">NI {s.cn ?? 0} · {s.range ? formatSpellRange(s.range) : '—'} · {s.duration ? formatSpellDuration(s.duration) : '—'}</em>
              </label>
              <p className="hint talent-desc">{blurb(s.desc, 220)}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Picker d'arme de l'emplacement `{wildcard:'arme'}` — icône + libellé (`MediaSelect`, MÊME rendu
 *  que le Sac/`EquipmentPanel`), filtrable (`SearchFilterField`, 100+ armes). */
function WeaponWildcardPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const { search, setSearch, filtered } = useFilteredList(armesChoisissables(), (w) => w.label);
  const options: MediaOption[] = filtered.map((w) => {
    const item = itemFromTrappingById(w.id);
    return { key: w.id, media: item ? <ItemIcon item={item} size="sm" /> : undefined, label: w.label };
  });
  return (
    <>
      <SearchFilterField value={search} onChange={setSearch} placeholder="Filtrer les armes…" icon />
      <MediaSelect options={options} value={value} onSelect={onChange} placeholder="— choisir —" />
    </>
  );
}

/** Emplacement `{choice}`/`{wildcard}`/`{id,qualityChoice}` d'une dotation (construct de choix
 *  d'équipement, Lot 2/3 #657) — rendu GÉNÉRAL, RÉCURSIF (EN MIROIR de `resolveTrappingChoices`,
 *  MÊME clé `trappingRefLabel`) : `{choice}` → `OptionChooser` (une branche = un bouton, la branche
 *  choisie EST rendue récursivement — une branche `{id,qualityChoice}` déroule son picker d'Atout
 *  NESTED juste dessous) ; `{wildcard:'arme'}` → `WeaponWildcardPicker` (valeur stockée = l'`id`
 *  d'arme) ; `{id,qualityChoice:true}` → un Atout de Fabrication (LDB 60 « X de qualité ») parmi
 *  `fabricationAtouts`, libellé + effet verbatim (`QualityData.desc`) en hint — `raffine` PRÉ-SÉLECTIONNÉ
 *  (défaut du résolveur, `DEFAULT_FABRICATION_ATOUT`) tant qu'aucun choix n'est stocké : ne rien choisir
 *  reste un brouillon VALIDE (l'objet est « de qualité » raffiné par défaut). Une autre catégorie de
 *  joker sans picker dédié affiche un repli explicite (jamais un `<select>` brut recodé). */
export function TrappingChoiceSlot({ slot, choices, onChoicesChange }: {
  slot: TrappingRef;
  choices: Record<string, string>;
  onChoicesChange: (key: string, value: string) => void;
}) {
  const key = trappingRefLabel(slot);
  const value = choices[key];
  if ('choice' in slot) {
    const options = slot.choice.map((branch) => {
      const label = trappingRefLabel(branch);
      return { key: label, label, primary: value === label, onSelect: () => onChoicesChange(key, label) };
    });
    // Branche EFFECTIVE (défaut miroir de `resolveTrappingChoices` : sans choix, la 1re branche) —
    // détermine si le picker d'Atout NESTED se déroule sous la grille de branches.
    const selectedBranch = (value && slot.choice.find((b) => trappingRefLabel(b) === value)) || slot.choice[0];
    return (
      <>
        <OptionChooser layout="grid" options={options} />
        {'id' in selectedBranch && selectedBranch.qualityChoice && (
          <TrappingChoiceSlot slot={selectedBranch} choices={choices} onChoicesChange={onChoicesChange} />
        )}
      </>
    );
  }
  if ('wildcard' in slot) {
    if (slot.wildcard === 'arme') return <WeaponWildcardPicker value={value} onChange={(v) => onChoicesChange(key, v)} />;
    return <p className="hint">Catégorie « {slot.wildcard} » sans picker dédié pour l'instant.</p>;
  }
  if ('id' in slot && slot.qualityChoice) {
    const options = fabricationAtouts().map((atoutId) => {
      const q = findQualityById(atoutId);
      return {
        key: atoutId,
        label: (
          <>
            {q?.label ?? atoutId}
            {q?.desc && <em className="hint" style={{ display: 'block', fontStyle: 'normal', fontWeight: 'normal' }}>{q.desc}</em>}
          </>
        ),
        primary: value ? value === atoutId : atoutId === DEFAULT_FABRICATION_ATOUT,
        onSelect: () => onChoicesChange(key, atoutId),
      };
    });
    return <OptionChooser layout="grid" options={options} />;
  }
  return null;
}

/** Détail d'un objet d'équipement (trappings.json) par `id` : dégâts / PA / encombrement / qualités. */
function trappingMeta(id: string): string {
  const t = findTrappingById(id);
  if (!t) return '';
  const bits: string[] = [];
  if (t.damage) bits.push(`Dégâts ${damageString(t.damage)}`);
  if (t.pa) bits.push(`${t.pa} PA (${t.loc ?? ''})`);
  if (t.reach && t.categorie === 'melee') bits.push(`Allonge ${t.reach}`);
  // Portée : « N m » (fixe) / « BF×k m » (jet) ; sinon le modificateur de la munition (« ×½ »).
  if (t.categorie === 'ranged' || t.categorie === 'ammunition') { const p = rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod); if (p) bits.push(`Portée ${p}`); }
  if (t.enc) bits.push(`Enc. ${t.enc}`);
  if (t.qualities?.length) bits.push(t.qualities.map(qualityRefLabel).join(', '));
  return bits.join(' · ');
}

// ════ 6) Possessions (LDB 05 l.542-583) — charte « Atelier du scribe » (#393 P5, étalon = la
//      planche ratifiée du créateur) : gabarit DEUX ZONES (panneau + fiche vivante, MÊME composition
//      que Caractéristiques/Compétences) — le panneau porte le statut en tête, puis les bandes « De
//      carrière » / « De classe » (chips d'équipement comptées) / « La bourse » (rappel de la formule +
//      montant, jet figé sans dés à rejouer) / « La classe » (prose RAW verbatim). Mécanique INCHANGÉE
//      (draftWealth/trappingChoices, draft.ts) — la fiche vivante RÉSOUT son chip roadmap « dotations » en
//      arrivant sur cette étape (`CreatorSummary`, `pending.possessions`).
/** Faces INDIVIDUELLES du jet de bourse — même graine/ordre RNG que `draftWealth`
 *  (`d.seed ^ 0x901d`, `rollInitialWealth`) : rejoue le MÊME nombre de `rng.int(1,10)` pour figer
 *  les dés à l'écran (mock7 : faces + total) au lieu du seul total texte (retouche juge vision
 *  #393 P5). Bronze N : 2N d10 ; Argent N : N d10 ; Or (aucun dé, CO=Standing) : []. */
function draftWealthDice(d: CreatorDraft): number[] {
  const status = parseStatus(draftLevel(d)?.status ?? 'Bronze 0');
  if (status.standing <= 0 || status.tier === 'Or') return [];
  const n = status.tier === 'Bronze' ? 2 * status.standing : status.standing;
  const rng = makeRNG(d.seed ^ 0x901d);
  return Array.from({ length: n }, () => d10Face(rng.int(1, 10)));
}

export function TrappingsScreen({ d, setD }: StepProps): ReactNode {
  const level = draftLevel(d);
  const career = findCareerById(d.careerId);
  const klass = findClassById(career?.class);
  const wealth = draftWealth(d);
  const { rolling, landed, trigger, skip } = useRollFrisson(() => setD(rollDraftWealth(d)));
  const careerTrappings = level?.trappings ?? []; // TrappingRef[]
  const choiceSlots = careerTrappings.filter(
    (t): t is TrappingRef => 'choice' in t || 'wildcard' in t || ('id' in t && !!t.qualityChoice),
  );

  const stepIdx = stepIds().indexOf('trappings');
  if (!level || !career) {
    return (
      <CreatorStepFrame
        d={d}
        step={stepIdx}
        label="Possessions"
        zones={{ action: null, choice: <p className="hint">Choisissez d'abord une race et une carrière.</p> }}
      />
    );
  }

  const chip = (ref: import('../../data').TrappingRef, key: number) => {
    const label = trappingRefLabel(ref);
    return <EntityRef key={key} category="trappings" id={'id' in ref ? ref.id : undefined} label={splitLabel(label).name} show={label} />;
  };
  const classItems = klass?.trappings ?? [];
  const careerItems = careerTrappings.filter((t) => !('choice' in t || 'wildcard' in t || ('id' in t && !!t.qualityChoice)));
  // Formule de bourse fixée par le TIER du statut (SOURCE UNIQUE : titre de bande, sous-texte du geste
  // et note d'intro la citent tous — planche `finale-mock7`, « 2d10 sous de cuivre » sous « La bourse »).
  const purseFormula = level.status.startsWith('Bronze') ? '2d10 sous de cuivre' : level.status.startsWith('Argent') ? '1d10 pistoles' : "1 couronne d'or";

  // Bande d'ACTION (slot requis de l'ossature) : le GESTE de l'étape — « Tirer aux dés — la
  // bourse » (jet figé, agentivité #393 P5) remonte en tête, avec le statut qui fixe sa formule.
  const action = (
    <>
      <StepHeader title="Possessions" sub="Ce que le départ vous met dans les mains">
        <MetalStatus status={level.status} size="chip" />
      </StepHeader>
      {/* Le TOTAL s'ancre à droite de la barre (motif `.cu-sechead .cnt` de la planche — même rang que
          les « N objets » des dotations) ; les FACES restent sous la barre : la planche n'illustre que
          le cas Bronze 1 (2 dés) quand le RAW en pose jusqu'à 2×Standing (10 pour Bronze 5), qu'un
          plateau ancré à droite (`white-space: nowrap`) ferait déborder. */}
      <Band
        title={<>La bourse<small>statut {level.status} — {purseFormula}</small></>}
        right={d.wealthRoll && !rolling && !landed ? <b><Coins money={wealth} /></b> : null}
      >
        {rolling || landed ? (
          <DiceRoll scene landed={landed} faces={null} onSkip={skip} tone="gold" />
        ) : !d.wealthRoll ? (
          <button type="button" className="dicewell act emph" onClick={() => trigger()}>
            <span className="dicewell-tray">
              <span className="rm-die dicewell-die"><DieFace n={null} landed tone="gold" /></span>
              <span className="rm-die dicewell-die"><DieFace n={null} landed tone="gold" /></span>
            </span>
            <span className="dicewell-copy">
              <span className="dicewell-txt">Tirer aux dés — la bourse</span>
              <span className="dicewell-sub">
                {purseFormula} × Standing — jet figé, aucune relance
              </span>
            </span>
          </button>
        ) : (
          // Faces RÉELLES figées (draftWealthDice, même graine/ordre RNG que draftWealth) — jamais une
          // face fabriquée ; le total est porté par la barre (`right`).
          <>
            {/* `.row-flex` : la bande est une COLONNE flex (ses enfants s'étirent) — le plateau doit
                rester à la taille de ses dés, pas s'allonger en bandeau vide. */}
            <div className="row-flex">
              <span className="dicewell-tray">
                {draftWealthDice(d).map((n, i) => (
                  <span key={i} className="rm-die dicewell-die"><DieFace n={n} landed tone="gold" /></span>
                ))}
              </span>
            </div>
            <p className="hint">Jet figé, aucune relance — la bourse est créditée au groupe à l'engagement.</p>
          </>
        )}
      </Band>
    </>
  );

  const choice = (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        {/* Carrière/niveau entre parenthèses, jamais « du {label} » : le libellé est une DONNÉE (« du
            Agitateur », et toute carrière à initiale vocalique casserait l'élision). */}
        Le statut <b>{level.status}</b> ({career.label} — {level.label}) fixe la bourse de départ ({purseFormula} × Standing) et le
        train de vie entre les aventures. Chaque objet reçu s'ouvre sur sa fiche du Codex — encombrement et qualités comprises.
      </p>

      <Band title={<>De carrière<small>{level.label}</small></>} right={<span className="hint">{careerItems.length} objet{careerItems.length > 1 ? 's' : ''}</span>}>
        <div className="skill-tags">{careerItems.map(chip)}</div>
      </Band>

      <Band title={<>De classe<small>{klass?.label ?? '—'}</small></>} right={<span className="hint">{classItems.length} objet{classItems.length > 1 ? 's' : ''}</span>}>
        <div className="skill-tags">{classItems.map(chip)}</div>
      </Band>

      {choiceSlots.map((slot, i) => {
        const key = trappingRefLabel(slot);
        const value = d.trappingChoices?.[key];
        return (
          <Band key={i} title={key}>
            <TrappingChoiceSlot
              slot={slot}
              choices={d.trappingChoices ?? {}}
              onChoicesChange={(k, v) => setD({ ...d, trappingChoices: { ...d.trappingChoices, [k]: v } })}
            />
            {value && 'wildcard' in slot && <p className="hint">{trappingMeta(value)}</p>}
          </Band>
        );
      })}

      <div className="mini-title">La classe — {klass?.label ?? '—'}</div>
      <LoreText md={klass?.desc} />

      {/* Note de PIED (planche `finale-mock7`, `.c-note` en bas de zone) : où atterrit le butin de départ. */}
      <p className="hint">Tout objet va sur le héros — il se retrouvera dans son inventaire dès l'engagement.</p>
    </>
  );

  return <CreatorStepFrame d={d} step={stepIdx} label="Possessions" zones={{ action, choice }} />;
}

/** Rangée du registre d'état civil — libellé au-dessus, contrôle + bouton d'effacement (`ui/undo`,
 *  mineur/réversible) en fin de rangée (étalon = la planche ratifiée du créateur, écran Détails). */
function IdentityRow({ label, control, onClear }: { label: string; control: ReactNode; onClear: () => void }) {
  return (
    <PlaqueRow
      label={label}
      content={control}
      meta={
        <button type="button" className="btn small" title={`${label} : effacer`} onClick={onClear}>
          <Icon id="ui/undo" size="sm" />
        </button>
      }
    />
  );
}

/** Champ IDENTITÉ TEXTE du registre d'état civil (yeux, cheveux). */
function IdentityField({ label, value, onChange, onClear }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return <IdentityRow label={label} onClear={onClear} control={<input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />} />;
}

/** Champ IDENTITÉ NOMBRE du registre d'état civil (âge, taille) — la grandeur passe par la primitive
 *  partagée, jamais par un `<input type="number">` du site. `details.json` ne chiffre que le TIRAGE
 *  (`ageBase`/`ageRoll`, `heightBase`/`heightRoll`) : aucun plafond n'est authoré, seul le plancher
 *  structurel de la grandeur (un entier strictement positif) est posé. */
function IdentityNumberField({ label, value, onChange, onClear }: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  onClear: () => void;
}) {
  return (
    <IdentityRow
      label={label}
      onClear={onClear}
      control={<NumberField variant="nu" label={label} min={1} vide value={value} onChange={(n) => onChange(n ?? undefined)} />}
    />
  );
}

// ════ 7) Détails (LDB 05 l.584-803) — charte « Atelier du scribe » (#393, lot « ossature enforcée » ;
//      étalon = les VALEURS de la planche ratifiée du créateur, écran 7) : ossature 2 zones (bande
//      d'ACTION à la topbar `.fam-topbar` — titre + plaque « Tirer le nom » + encrier « Aux dés » —
//      puis zone de CHOIX ; fiche vivante à droite). L'état civil COMPOSE la rangée-plaque
//      (`PlaqueGrid`/`PlaqueRow` : `.idf` de la planche = la plaque, colonne de libellé gravée +
//      valeur à la plume sur trait pointillé), puis bande Motivation & Ambitions (`BackgroundFields`,
//      primitive PARTAGÉE avec l'onglet Background de la fiche) et bande Apparence (`AppearancePanel`,
//      personnalisateur INCHANGÉ). Mécanique INCHANGÉE (`rolledDetails`, draft.ts).
export function DetailsScreen({ d, setD }: StepProps): ReactNode {
  const sp = draftSpecies(d);
  const stepIdx = stepIds().indexOf('details');
  if (!sp) {
    return (
      <CreatorStepFrame d={d} step={stepIdx} label="Détails" zones={{ action: null, choice: <p className="hint">Choisissez d'abord une race.</p> }} />
    );
  }
  const appearance: Appearance = { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  const physiqueRolled = !!(d.age || d.height || d.eyes || d.hair);
  const { rolling, landed, trigger, skip } = useRollFrisson(() => {
    const r = rolledDetails(d);
    setD({ ...d, age: r.age, height: r.height, eyes: r.eyes, hair: r.hair });
  });

  // Bande d'ACTION (slot requis de l'ossature) : les GESTES de l'étape, à la topbar de la planche
  // (`.fam-topbar` : `.c-dhead` titre+sous-titre à gauche, plaque d'action + encrier à droite) —
  // tirer le nom au générateur, tirer le physique (âge/taille/yeux/cheveux) d'un coup.
  const action = (
    <StepHeader title="Détails" sub="Le registre d'état civil du héros">
      <PlaqueRow
        onClick={() => { const n = generateName(sp.refChar, d.sex, makeRNG(Math.floor(Math.random() * 1e9))); if (n) setD({ ...d, label: n }); }}
        content="Tirer le nom"
        meta={<em>au générateur</em>}
      />
      {rolling || landed ? (
        <DiceRoll scene landed={landed} faces={null} onSkip={skip} tone="gold" />
      ) : (
        <button type="button" className={`dicewell${physiqueRolled ? ' done' : ' act emph'}`} onClick={() => trigger()}>
          <span className="dicewell-copy">
            <span className="dicewell-txt">{physiqueRolled ? 'Aux dés — tout tiré' : 'Aux dés — tout d\'un coup'}</span>
            <span className="dicewell-sub">âge, taille, yeux, cheveux — modifiables ensuite</span>
          </span>
        </button>
      )}
    </StepHeader>
  );

  const choice = (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Le nom peut se tirer d'un générateur ou s'écrire à la plume ; âge, taille, yeux et cheveux se tirent aux dés
        d'un seul geste, puis se retouchent trait par trait. Motivation et ambitions sont libres — elles guident le jeu
        de rôle, pas les règles ; la Motivation est la donnée qui recharge la Détermination en jeu.
      </p>

      <PlaqueGrid>
        <PlaqueRow
          label="Nom"
          content={<input aria-label="Nom" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="Nom du personnage" />}
        />
        <PlaqueRow
          label="Sexe"
          content={
            <button type="button" className="btn small" onClick={() => setD({ ...d, sex: d.sex === 'M' ? 'F' : 'M' })}>
              <Icon id="ui/branch" size="sm" /> {d.sex === 'F' ? 'Féminin' : 'Masculin'}
            </button>
          }
        />
        <IdentityNumberField label="Âge" value={d.age} onChange={(age) => setD({ ...d, age })} onClear={() => setD({ ...d, age: undefined })} />
        <IdentityNumberField label="Taille (cm)" value={d.height} onChange={(height) => setD({ ...d, height })} onClear={() => setD({ ...d, height: undefined })} />
        <IdentityField label="Yeux" value={d.eyes ?? ''} onChange={(v) => setD({ ...d, eyes: v })} onClear={() => setD({ ...d, eyes: undefined })} />
        <IdentityField label="Cheveux" value={d.hair ?? ''} onChange={(v) => setD({ ...d, hair: v })} onClear={() => setD({ ...d, hair: undefined })} />
      </PlaqueGrid>

      <Band title={<>Motivation &amp; Ambitions<small>recharge la Détermination · guide le rôle</small></>}>
        <BackgroundFields
          values={{ motivation: d.motivation, ambitionShort: d.ambitionShort, ambitionLong: d.ambitionLong }}
          onChange={(patch) => setD({ ...d, ...patch })}
        />
      </Band>

      <Band title={<>Apparence<small>la silhouette prend les teintes</small></>} right="tirées aux dés — retouche libre">
        <AppearancePanel
          value={appearance}
          equip={{ weapons: [], armour: [] }}
          career={d.careerId}
          onChange={(a) => setD({ ...d, sex: a.sex, build: a.build, appSeed: a.seed ?? d.appSeed, colors: a.colors, parts: a.parts })}
        />
      </Band>

      {/* Note de PIED (planche `finale-mock8`, `.c-note` en clôture de zone) : la prose du mock décrit
          SES teintes d'exemple (« la mèche châtain clair ») — la règle de préséance réserve la maquette
          au STYLE, jamais aux données ; c'est donc le lien vivant figurine ⇄ registre qui est dit ici. */}
      <p className="hint">
        Teintes des yeux et des cheveux : la figurine de droite les porte aussitôt — le registre et la silhouette ne
        divergent jamais. Rien n'est figé, tout se retouche jusqu'à l'engagement.
      </p>
    </>
  );

  return <CreatorStepFrame d={d} step={stepIdx} label="Détails" zones={{ action, choice }} />;
}

/** Top-3 des Compétences par valeur de Test effective (Caractéristique + avances, `skillBaseValue`) —
 *  « Les jets qui le définissent » (mock9) : les épreuves où le héros excelle le plus. Composé de
 *  chips CodexRef réels (jamais un libellé de flavor inventé) + la valeur de Test. */
/** RUBRIQUE du registre de présentation — titre + contenu en UN groupe (planche FINALE, mock9 :
 *  `.fin-col > div` = `.mini-title` + son bloc). Le groupe est ce que le `gap` de la colonne sépare :
 *  sans lui, titres et contenus flottent à intervalle égal et plus rien ne dit à quoi se rattache un
 *  titre. Local à l'écran (aucune classe neuve — `.mini-title` est déjà la primitive de titre). */
function Rubrique({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mini-title">{title}</div>
      {children}
    </div>
  );
}

function topSkillTests(hero: Combatant, max = 3): { skillId: string; spec?: string; label: string; value: number }[] {
  return [...hero.skills]
    .filter((s) => s.advances > 0)
    .map((s) => ({ skillId: s.id, spec: s.spec, label: skillInstanceLabel(s), value: skillBaseValue(hero, s.id, s.spec) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

// ════ 8) Présentation (#393 P5, arbitrage README maquettes — renommage « Récapitulatif » →
//      « Présentation » : le personnage se PRÉSENTE) — étalon = la planche ratifiée : mise
//      en scène finale DÉDIÉE (plus le gabarit 3 zones rail/détail/fiche partagé) — TROIS colonnes :
//      registre (Profil/dérivées/Identité/Motivation/Évolution) ⇄ grande figurine + nom ⇄ Compétences/
//      Talents/Possessions/« Les jets qui le définissent ». Aucune mécanique nouvelle — pure mise en
//      page du héros déjà construit (`previewHero`).
export function PresentationScreen({ d }: StepProps): ReactNode {
  const hero = previewHero(d);
  const sp = findSpeciesById(d.speciesId);
  const career = findCareerById(d.careerId);
  const level = draftLevel(d);
  const speciesLabel = sp?.label ?? d.speciesId;
  const careerLabel = career?.label ?? d.careerId;
  const sign = d.star ? starsTable.find((s) => s.id === d.star) : undefined;
  const levels = levelsForCareer(d.careerId);

  if (!hero) {
    return (
      <div className="creator-presentation-screen">
        <p className="hint">Complétez les étapes précédentes pour découvrir la présentation de votre héros.</p>
      </div>
    );
  }

  const jets = topSkillTests(hero);

  return (
    <div className="creator-presentation-screen">
      <div className="presentation-col presentation-left">
        <Rubrique title="Profil">
          <CharStatsGrid size="sm" value={(k) => effectiveChar(hero, k)} />
        </Rubrique>
        <Rubrique title="Valeurs dérivées">
          <div className="creator-derived">
            <span><Icon id="resource/wounds" size="sm" /> Blessures <b>{hero.wounds.max}</b></span>
            <span><Icon id="resource/movement" size="sm" /> Mouvement <b>{hero.movement}</b></span>
            <span><Icon id="resource/fate" size="sm" /> Destin <b>{hero.fate ?? '—'}</b> · Chance <b>{hero.fortune ?? '—'}</b></span>
            <span><Icon id="resource/resilience" size="sm" /> Résilience <b>{hero.resilience ?? '—'}</b> · Dét. <b>{hero.resolve ?? '—'}</b></span>
            <span><Icon id="resource/gold-purse" size="sm" /> Bourse <b><Coins money={draftWealth(d)} /></b></span>
            <span>PX création <b>+{xpTotal(d)}</b></span>
          </div>
        </Rubrique>
        <Rubrique title="Identité">
          <div className="skill-tags">
            {sign && <CodexRef category="stars" id={sign.id} label={sign.label}><span className="chip">{sign.label}</span></CodexRef>}
            <span className="chip">{d.sex === 'F' ? 'Féminin' : 'Masculin'}</span>
            {hero.details?.age != null && <span className="chip">{hero.details.age} ans</span>}
            {hero.details?.height != null && <span className="chip">{hero.details.height} cm</span>}
            {hero.details?.eyes && <span className="chip">Yeux {hero.details.eyes}</span>}
            {hero.details?.hair && <span className="chip">Cheveux {hero.details.hair}</span>}
          </div>
        </Rubrique>
        {(d.motivation || d.ambitionShort || d.ambitionLong) && (
          <Rubrique title={<>Motivation &amp; Ambitions</>}>
            <div className="skill-tags">
              {d.motivation && <span className="chip">Motivation — {d.motivation}</span>}
              {d.ambitionShort && <span className="chip">Court terme — {d.ambitionShort}</span>}
              {d.ambitionLong && <span className="chip">Long terme — {d.ambitionLong}</span>}
            </div>
          </Rubrique>
        )}
      </div>

      {/* La SCÈNE (`.fin-stage` de la planche) : la lampe, la figurine posée sous son halo, puis le nom
          gravé. Aucune ambiance sur `CharacterPreview` — c'est la scène qui porte le halo et le cadre
          (une ambiance de plus y peindrait une seconde boîte par-dessus l'alcôve). */}
      <div className="presentation-stage">
        <div className="presentation-lamp" />
        <div className="presentation-fig">
          <CharacterPreview hero={hero} view="front" size="fill" />
        </div>
        <h2 className="presentation-name">{hero.label}</h2>
        {/* Race · NIVEAU (carrière) · statut MÉTALLISÉ — la planche nomme le niveau de départ
            (« Pamphlétaire (Agitateur) ») là où l'écran ne portait que la carrière, et rend le statut
            en métal (`.st-bronze`) là où il était en texte nu : `MetalStatus` est la primitive. */}
        <p className="presentation-sub">
          <CodexRef category="races" id={d.speciesId} label={speciesLabel}>{speciesLabel}</CodexRef>
          {' · '}
          {level?.label ? `${level.label} (${displayLabelForSex(d.sex, careerLabel, career?.labelF)})` : displayLabelForSex(d.sex, careerLabel, career?.labelF)}
          {level?.status && <> · <MetalStatus status={level.status} size="chip" /></>}
        </p>
        <div className="row-flex">
          {sign && <span className="chip">Signe <CodexRef category="stars" id={sign.id} label={sign.label}>{sign.label}</CodexRef></span>}
          <span className="chip">PX création <b>+{xpTotal(d)}</b></span>
        </div>
      </div>

      <div className="presentation-col presentation-right">
        <Rubrique title="Compétences formées">
          <div className="skill-tags">
            {hero.skills.filter((s) => s.advances > 0).map((s) => <SkillChip key={`${s.id}|${s.spec ?? ''}`} skill={s} />)}
          </div>
        </Rubrique>
        <Rubrique title="Talents">
          <div className="skill-tags">
            {hero.talents.map((t) => <TalentChip key={`${t.talentId}|${t.spec ?? ''}`} talent={t} />)}
          </div>
        </Rubrique>
        <Rubrique title="Possessions">
          <div className="skill-tags">
            {(hero.items ?? []).map((it) => (
              <EntityRef key={it.uid} category="trappings" id={it.trappingId} label={itemLabel(it)} show={`${itemLabel(it)}${it.qty ? ` ×${it.qty}` : ''}`} />
            ))}
          </div>
        </Rubrique>
        {jets.length > 0 && (
          <Rubrique title="Les jets qui le définissent">
            <div className="skill-tags">
              {jets.map((j) => (
                <EntityRef key={`${j.skillId}|${j.spec ?? ''}`} category="skills" id={j.skillId} label={j.label} show={`${j.label} ${j.value}`} />
              ))}
            </div>
          </Rubrique>
        )}
      </div>

      {/* Chemin d'évolution en rangée PLEINE LARGEUR sous les 3 colonnes (`grid-column: 1/-1`, seule
          couture propre à ce spanning — `.presentation-col` réutilisée pour la mise en page verticale) :
          `CareerPath` exige la largeur de ses 4 médaillons (2 lignes de nom, jamais d'ellipse), que la
          seule colonne registre ne peut jamais lui donner (retouche juge vision #393 P5, médaillons
          écrasés « Pamphl étaire »/« Bronz »). */}
      {levels.length > 0 && (
        <div className="presentation-col" style={{ gridColumn: '1 / -1' }}>
          <Rubrique title={<>Évolution — {career?.class ? findClassById(career.class)?.label ?? '' : ''}</>}>
            <CareerPath levels={levels} currentLevel={1} selected={1} />
          </Rubrique>
        </div>
      )}
    </div>
  );
}
