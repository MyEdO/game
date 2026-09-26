import type { ReactNode } from 'react';
import type { Combatant, CharKey } from '../engine/types';
import type { Money } from '../engine/money';
import { dominantAxes } from '../engine/axes';
import { effectiveChar } from '../engine/characteristics';
import { effectiveTalents } from '../engine/talentEffects';
import { itemLabel } from '../engine/items';
import { castInfoIsPrayer } from '../engine/magic';
import { coreAxisIds, findSpellById, byId, skillInstanceLabel } from '../data';
import { Coins } from './Coins';
import { Icon } from './Icon';
import { CharacterPreview } from './CharacterPreview';
import { CharStatsGrid } from './CharStatsGrid';
import { DetailIdentity } from './DetailFrame';
import { MetalStatus } from './MetalStatus';
import { RoseAxes } from './RoseAxes';
import { SkillChip, TalentChip, TraitChips, EntityRef } from './EntityChip';
import { CodexRef } from './compendium/CodexRef';
import { axisDataFor, heroRoseAxes, heroStatusLabel, heroSubtitle } from './CharCard';
import { t } from '../i18n';
import { Row } from './Layout';

/** Rubriques du corps `HeroSheet`, dans l'ordre canonique du détail candidat (#417). Toutes par
 *  défaut — un appelant restreint via `sections` (ex. l'onglet Compétences & Talents de la fiche,
 *  qui porte déjà sa propre bande d'en-tête/Blessures dans son aside, arbitrage 2026-07-17). */
export const HERO_SHEET_SECTIONS = ['stats', 'derived', 'forces', 'traits', 'skills', 'talents', 'spells', 'possessions'] as const;
export type HeroSheetSection = (typeof HERO_SHEET_SECTIONS)[number];

/** Champs de la rubrique `derived` — TOUS par défaut (rétro-compatible). Un appelant qui porte déjà
 *  l'un d'eux ailleurs (ex. la fiche : Blessures dans la barre de vie de l'aside, arbitrage
 *  2026-07-17) l'omet plutôt que de dupliquer le chiffre, sans devoir dupliquer tout le markup. */
export const HERO_SHEET_DERIVED_FIELDS = ['wounds', 'movement', 'fate', 'resilience'] as const;
export type HeroSheetDerivedField = (typeof HERO_SHEET_DERIVED_FIELDS)[number];

/**
 * HeroSheet — corps de FICHE HÉROS, consécration de la duplication entre la fiche vivante du
 * créateur (`creator/CreatorSummary.tsx`) et le détail candidat de l'écran d'équipe
 * (`PartyScreen.tsx`, `CandidateDetailPane`) — constat utilisateur fondateur : « La fiche vivante ce
 * n'est pas une primitive ? » (2026-07-15). Rubriques (ordre du détail candidat, source la plus
 * riche) : bande d'en-tête (figurine+identité+statut+rose, `header` désactivable) → Caractéristiques
 * pleine largeur → dérivées 2 colonnes → Forces (axes qualifiés) → Compétences → Talents →
 * Sorts/Miracles → Possessions. Scroll interne natif (`overflow-y:auto`+`min-height:0`) VERROUILLÉ
 * ici — pas à chaque appelant.
 */
export function HeroSheet({
  hero,
  axisIds = coreAxisIds(),
  header = true,
  wealth,
  pending,
  statAnnotations,
  sections = HERO_SHEET_SECTIONS,
  derivedFields = HERO_SHEET_DERIVED_FIELDS,
  skillsVariant = 'chips',
  className,
}: {
  hero: Combatant;
  /** Axes ACTIFS de la campagne (rose + Forces) — `coreAxisIds` par défaut. */
  axisIds?: string[];
  /** Bande d'en-tête figurine+identité+statut+rose — `false` quand l'appelant porte déjà sa propre
   *  alcôve (fiche vivante du créateur, alcôve grande à part). */
  header?: boolean;
  /** Bourse — chip dans la bande d'en-tête (ignoré si `header={false}`). */
  wealth?: Money;
  /** Roadmap PROSPECTIVE par rubrique (chips pointillées `RoadmapChip`, étapes ULTÉRIEURES du
   *  créateur) : Compétences/Possessions REMPLACENT le contenu vif quand elles sont fournies (masque
   *  un défaut moteur prématuré) ; Talents s'AJOUTE après les talents déjà réels (les talents
   *  d'espèce sont résolus dès l'espèce choisie, indépendamment de l'étape Compétences/Talents —
   *  cf. `CreatorSummary`, seul appelant à ce jour). */
  pending?: { skills?: ReactNode; talents?: ReactNode; possessions?: ReactNode };
  /** Annotation PAR CARACTÉRISTIQUE de la grille (`CharStatsGrid` `valClass`/`note`) — data-driven,
   *  aucun branchement créateur ICI : l'appelant (ex. `CreatorSummary`, augmentations/talents)
   *  calcule ses propres classes/notes et les fournit. */
  statAnnotations?: Partial<Record<CharKey, { valClass?: string; note?: string }>>;
  /** Rubriques rendues — TOUTES par défaut (rétro-compatible). Un appelant qui porte déjà une partie
   *  du corps ailleurs (ex. la fiche : Blessures dans l'aside) restreint la liste plutôt que de
   *  dupliquer le markup à la main (arbitrage 2026-07-17). */
  sections?: readonly HeroSheetSection[];
  /** Champs de la rubrique `derived` — TOUS par défaut ; un appelant qui porte déjà l'un d'eux
   *  ailleurs (ex. Blessures dans la barre de vie de l'aside de la fiche) l'omet ICI. */
  derivedFields?: readonly HeroSheetDerivedField[];
  /** Rendu de la rubrique Compétences — `'chips'` (défaut, présentation candidate/créateur) ou
   *  `'valeurs'` (table à deux colonnes nom/valeur+avances, onglet Compétences & Talents de la fiche
   *  vivante — arbitrage 2026-07-17). Les Talents restent en chips dans les DEUX variantes. */
  skillsVariant?: 'chips' | 'valeurs';
  className?: string;
}) {
  const has = (s: HeroSheetSection) => sections.includes(s);
  const axes = dominantAxes(hero, axisDataFor(axisIds), 3);
  // TOUTES les Compétences avancées (correctif utilisateur 2026-07-15 : « faut virer Compétence clé
  // et mettre toutes les compétences ayant des points dedans ») — aucun écrémage top-N ici, le plafond
  // ne survit que sur les CARTES compactes (tuile candidat/carte de contrat, `CharCard.tsx`).
  const skills = [...hero.skills].filter((s) => s.advances > 0).sort((a, b) => b.advances - a.advances || a.id.localeCompare(b.id));
  const talents = effectiveTalents(hero);
  const possessions = (hero.items ?? []).slice(0, 12);
  const spellRefs = (hero.spells ?? []).map((id) => ({ id, data: findSpellById(id) }));
  const hasSpell = spellRefs.some((s) => s.data && !castInfoIsPrayer(s.data));
  const hasPrayer = spellRefs.some((s) => s.data && castInfoIsPrayer(s.data));
  const spellsTitle = hasSpell && hasPrayer ? t('present.spells.both') : hasPrayer ? t('present.spells.prayers') : t('present.spells.spells');

  return (
    <div className={['hero-sheet', className].filter(Boolean).join(' ')}>
      {header && (
        <Row className="hero-sheet-head">
          <CharacterPreview hero={hero} size="md" ambiance="panel" className="hero-sheet-fig" />
          <div className="hero-sheet-id">
            <DetailIdentity
              band={false}
              label={hero.label}
              sub={heroSubtitle(hero)}
              meta={<>
                <MetalStatus status={heroStatusLabel(hero)} size="chip" />
                {wealth != null && <span className="chip">{t('picker.hero.purse')} <Coins money={wealth} /></span>}
              </>}
            />
          </div>
          <RoseAxes axes={heroRoseAxes(hero, axisIds)} size="medal" title={t('party.rose.title', { name: hero.label })} />
        </Row>
      )}

      {has('stats') && (
        <CharStatsGrid
          size="sm"
          value={(k) => effectiveChar(hero, k)}
          valClass={(k) => statAnnotations?.[k]?.valClass}
          note={(k) => statAnnotations?.[k]?.note}
          className="hero-sheet-stats"
        />
      )}

      {has('derived') && (
        <div className="hero-sheet-derived">
          {derivedFields.includes('wounds') && <span><Icon id="resource/wounds" size="sm" /> Blessures <b>{hero.wounds.max}</b></span>}
          {derivedFields.includes('movement') && <span><Icon id="resource/movement" size="sm" /> Mouvement <b>{hero.movement}</b></span>}
          {derivedFields.includes('fate') && <span><Icon id="resource/fate" size="sm" /> Destin <b>{hero.fate ?? '—'}</b> · Chance <b>{hero.fortune ?? '—'}</b></span>}
          {derivedFields.includes('resilience') && <span><Icon id="resource/resilience" size="sm" /> Résilience <b>{hero.resilience ?? '—'}</b> · Détermination <b>{hero.resolve ?? '—'}</b></span>}
        </div>
      )}

      {has('forces') && (
        <section className="hero-present-sec">
          <h4>{t('present.forces')}</h4>
          <div className="skill-tags">
            {axes.length ? axes.map((a) => <EntityRef key={a.id} category="axes" id={a.id} label={a.label} />) : <span className="hint">{t('party.roles.none')}</span>}
          </div>
        </section>
      )}

      {has('traits') && (hero.traits ?? []).length > 0 && (
        <section className="hero-present-sec">
          <h4>{t('present.traits')}</h4>
          <div className="skill-tags">
            <TraitChips traits={hero.traits!} />
          </div>
        </section>
      )}

      {has('skills') && (skillsVariant === 'valeurs' ? (
        <>
          <div className="mini-title">Compétences</div>
          <div className="skill-grid">
            {hero.skills.length === 0 && <span className="muted">Aucune.</span>}
            {hero.skills.map((s, i) => {
              const val = effectiveChar(hero, s.characteristic) + s.advances;
              return (
                <div className="skill-line" key={i} title={`${s.characteristic} ${effectiveChar(hero, s.characteristic)} + ${s.advances}`}>
                  <span className="sk-name">
                    <CodexRef category="skills" id={s.id} label={byId('skill', s.id)?.label ?? s.id}>
                      {skillInstanceLabel(s)}
                    </CodexRef>
                  </span>
                  <span className="sk-val">{val}</span>
                  <span className="sk-adv">+{s.advances}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <section className="hero-present-sec">
          <h4>{t('present.skills')}</h4>
          <div className="skill-tags">
            {pending?.skills ?? (skills.length ? skills.map((s) => <SkillChip key={`${s.id}|${s.spec ?? ''}`} skill={s} />) : <span className="hint">—</span>)}
          </div>
        </section>
      ))}

      {has('talents') && (
        <section className="hero-present-sec">
          <h4>{t('present.talents')}</h4>
          <div className="skill-tags">
            {talents.length ? talents.map((tt) => <TalentChip key={`${tt.talentId}|${tt.spec ?? ''}`} talent={{ id: tt.talentId, spec: tt.spec }} times={tt.times} />) : <span className="hint">—</span>}
            {pending?.talents}
          </div>
        </section>
      )}

      {has('spells') && spellRefs.length > 0 && (
        <section className="hero-present-sec">
          <h4>{spellsTitle}</h4>
          <div className="skill-tags">
            {spellRefs.map(({ id, data }) => <EntityRef key={id} category="spells" id={id} label={data?.label ?? id} />)}
          </div>
        </section>
      )}

      {has('possessions') && (
        <section className="hero-present-sec">
          <h4>{t('present.possessions')}</h4>
          <div className="skill-tags">
            {pending?.possessions ?? (possessions.length
              ? possessions.map((it) => <EntityRef key={it.uid} category="trappings" id={it.trappingId} label={itemLabel(it)} />)
              : <span className="hint">—</span>)}
          </div>
        </section>
      )}
    </div>
  );
}

/** Chip prospective pointillée — rubrique renseignée à une étape ULTÉRIEURE du créateur (#417
 *  suite). Écrite ICI (vocabulaire de chip de la fiche) pour être composée aussi HORS `HeroSheet`
 *  (identité du créateur : `CreatorSummary` compose ce chip directement, hors mandat de la primitive
 *  qui n'entre qu'un `Combatant`). */
export function RoadmapChip({ children }: { children: ReactNode }) {
  return <span className="chip chip-roadmap">{children}</span>;
}
