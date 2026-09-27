import type { ReactNode } from 'react';
import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import { CharacterPreview } from './CharacterPreview';
import { OrnateFrame } from './Ornaments';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { Coins } from './Coins';
import { RoseAxes, type RoseAxisValue } from './RoseAxes';
import { MetalStatus } from './MetalStatus';
import { WaxSeal } from './WaxSeal';
import { EntityRef } from './EntityChip';
import { speciesSingular, findSpeciesById, careerLabelFor, skillInstanceLabel, talentConcrete, allAxes, levelsForCareer, coreAxisIds, type AxisData } from '../data';
import { dominantAxes, axesProfile } from '../engine/axes';
import { t } from '../i18n';
import { GatedAction } from './GatedAction';
import { Row } from './Layout';

/** Sous-titre d'ARCHÉTYPE : « Carrière — Espèce » (la CARRIÈRE en tête, c'est le concept du personnage
 *  en WFRP ; l'espèce suit, atténuée — arbitrage user 2026-07-13). Sans « (niv. N) » (bruit : tous
 *  niveau 1 à la sélection ; le niveau vit dans la fiche). Source unique (cartes siège + candidat +
 *  HeroPresentation + sélecteur). */
export function heroSubtitle(hero: Combatant): string {
  const race = speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species);
  return `${careerLabelFor(hero)} — ${race}`;
}

/** RÔLE dans le groupe — les N axes DOMINANTS EN TOUTES LETTRES (`dominantAxes`, `src/engine/axes.ts`
 *  — SOURCE UNIQUE partagée avec le mini-radar et le rail de composition #417), pas une table en dur
 *  par carrière. Catalogue COMPLET (`allAxes`) : le filtrage aux axes ACTIFS de la campagne arrive
 *  avec le placement en jeu (#417). */
export function heroRoles(hero: Combatant, max = 3): string[] {
  return dominantAxes(hero, allAxes, max).map((a) => a.label);
}

/** ACCROCHE narrative — l'ambition à court terme (évocatrice) ou, à défaut, la motivation. */
export function heroHook(hero: Combatant): string | undefined {
  return hero.details?.ambitionShort || hero.motivation || undefined;
}

/** Statut « Échelon Standing » AFFICHÉ (« Bronze 2 ») — MÊME lookup que `heroStatus`
 *  (`state/interludeFlow.ts`), la forme texte brute pour `MetalStatus` (#417). */
export function heroStatusLabel(hero: Combatant): string {
  const levels = levelsForCareer(hero.career ?? '');
  const lvl = levels[Math.max(0, (hero.careerLevel ?? 1) - 1)];
  return lvl?.status ?? 'Bronze 1';
}

/** Résout des ids d'axes en `AxisData[]`, dans l'ORDRE fourni (ids inconnus écartés). */
export function axisDataFor(ids: string[] = coreAxisIds()): AxisData[] {
  return ids.map((id) => allAxes.find((a) => a.id === id)).filter((a): a is AxisData => !!a);
}

/** Profil « rose des forces » d'un héros pour les axes actifs — SOURCE UNIQUE `axesProfile`
 *  (`engine/axes.ts`), directement consommable par `RoseAxes` (#417). */
export function heroRoseAxes(hero: Combatant, axisIds: string[] = coreAxisIds()): RoseAxisValue[] {
  return axesProfile(hero, axisDataFor(axisIds));
}

/** Glyphe de rose 44/36px posé au coin bas-droit d'une figurine (`.rose-corner`, `rose.css`). */
function RoseGlyphCorner({ hero, axisIds, small }: { hero: Combatant; axisIds?: string[]; small?: boolean }) {
  return (
    <div className={`rose-corner${small ? ' sm' : ''}`}>
      <RoseAxes axes={heroRoseAxes(hero, axisIds)} size="glyph" title={t('party.rose.title', { name: hero.label })} />
    </div>
  );
}

/** Compétences CLÉS (libellé concret avec spec) — présentation lisible, top par avances. */
export function heroKeySkills(hero: Combatant, max = 6): string[] {
  return [...hero.skills]
    .filter((s) => s.advances > 0)
    .sort((a, b) => b.advances - a.advances)
    .slice(0, max)
    .map((s) => skillInstanceLabel(s));
}

/** Talents CLÉS (libellé concret) — présentation lisible. */
export function heroKeyTalents(hero: Combatant, max = 6): string[] {
  return hero.talents.slice(0, max).map((tt) => talentConcrete(tt));
}

/** État de recrutement d'un candidat vis-à-vis du groupe (calculé par l'écran d'équipe). */
export interface RecruitState {
  status: 'available' | 'blocked';
}

/** Identité (nom COMPLET + archétype). La PRÉSENTATION s'ouvre par le bouton loupe `WhoButton`
 *  (`.btn` canon) — pas un `<button>` nu recodé sur le nom (cliquet #373). */
function CardIdentity({ hero }: { hero: Combatant }) {
  return (
    <div className="candidate-id">
      <strong className="candidate-name">{hero.label}</strong>
      <span className="candidate-sub">
        {heroSubtitle(hero)} · <MetalStatus status={heroStatusLabel(hero)} size="chip" />
      </span>
    </div>
  );
}

/** RÔLE + ACCROCHE (forces en toutes lettres + ambition) — le contenu qui aide à CHOISIR. `seat` =
 *  rôle sur UNE ligne (colonne d'équipe étroite : 4 sièges tiennent la hauteur). */
function CardLore({ hero, seat, axisIds }: { hero: Combatant; seat?: boolean; axisIds?: string[] }) {
  const axes = dominantAxes(hero, axisDataFor(axisIds), 3);
  const hook = heroHook(hero);
  return (
    <>
      <div className={`card-roles${seat ? ' card-roles-1line' : ''}`}>
        {axes.length > 0
          ? axes.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ' · '}
                <EntityRef category="axes" id={a.id} label={a.label} />
              </span>
            ))
          : t('party.roles.none')}
      </div>
      {hook && <div className="card-hook">« {hook} »</div>}
    </>
  );
}

/** Poignée de PRÉSENTATION — la figurine + l'identité du personnage forment le contrôle cliquable qui
 *  ouvre son récit (`HeroPresentation`) : l'affordance d'un jeu (on clique le PERSONNAGE), pas un bouton
 *  « loupe » (directive user 2026-07-13). Vrai contrôle a11y (role/aria-label/focusable, Entrée ouvre),
 *  jamais un div sourd ; feedback de survol NON DÉCALANT (`.char-present`, box-shadow/brightness — aucune
 *  dimension ne change). Sans `onPresent`, rend un conteneur inerte (même flux). */
function PresentHandle({ hero, onPresent, className, children }: { hero: Combatant; onPresent?: () => void; className?: string; children: ReactNode }) {
  if (!onPresent) return <div className={className}>{children}</div>;
  return (
    <div
      className={`char-present${className ? ` ${className}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('party.present.aria', { name: hero.label })}
      onClick={onPresent}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPresent();
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * Carte-portrait de CANDIDAT (l'étal) — figure en pied dominante, nom complet, archétype, rôle +
 * accroche. Source unique du vivier : `gallery` (grille de l'écran) ET `remplacement` (plus
 * compacte). Clic figure/nom → PRÉSENTATION (`onPresent`). L'équipe, elle, est rendue par `SeatCard`.
 */
export function CandidateCard({
  hero,
  variant = 'gallery',
  state,
  wealth,
  recruited,
  selected,
  axisIds,
  onRecruit,
  onPresent,
  onExport,
  onDelete,
}: {
  hero: Combatant;
  variant?: 'gallery' | 'remplacement';
  state?: RecruitState;
  wealth?: Money;
  /** Déjà dans le groupe (modale de remplacement) → bouton « Déjà choisi » désactivé. */
  recruited?: boolean;
  /** Candidat déplié dans le détail (bordure or « en lecture », #417). */
  selected?: boolean;
  /** Axes ACTIFS de la campagne pour le glyphe de rose (`coreAxisIds` par défaut). */
  axisIds?: string[];
  onRecruit?: () => void;
  onPresent?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}) {
  const blocked = state?.status === 'blocked';
  return (
    <OrnateFrame className={`candidate-card candidate-${variant}${selected ? ' selected' : ''}`}>
      {/* Le personnage (figurine + identité) EST le contrôle qui ouvre sa présentation (directive
          user 2026-07-13) : aucun bouton « loupe » séparé. */}
      <PresentHandle hero={hero} onPresent={onPresent} className="candidate-present">
        <div className="candidate-fig">
          <CharacterPreview hero={hero} size="fill" ambiance="spotlight" />
          <RoseGlyphCorner hero={hero} axisIds={axisIds} small />
        </div>
        <CardIdentity hero={hero} />
      </PresentHandle>
      <CardLore hero={hero} axisIds={axisIds} />
      {wealth != null && (
        <span className="candidate-wealth hint">{t('picker.hero.purse')} <Coins money={wealth} /></span>
      )}
      <Row className="candidate-actions">
        <GatedAction
          id={`char-recruit-${hero.id}`}
          label={variant === 'remplacement' ? (recruited ? t('picker.hero.inParty') : t('picker.hero.choose')) : t('party.hero.recruit')}
          enabled={variant === 'remplacement' ? !recruited : !blocked}
          reason={variant === 'remplacement' ? t('party.recruit.already') : t('party.recruit.full')}
          onClick={() => onRecruit?.()}
          btnClassName="small"
        />
        {(onExport || onDelete) && (
          <span className="candidate-tools">
            {onExport && (
              <button className="btn small ghost" onClick={onExport} title={t('picker.hero.export.title')} aria-label={t('picker.hero.export')}>
                <Icon id="file/export" size="sm" />
              </button>
            )}
            {onDelete && (
              <button className="btn small ghost danger" onClick={onDelete} title={t('picker.hero.delete')} aria-label={t('picker.hero.delete')}>
                <Icon id="ui/delete" size="sm" />
              </button>
            )}
          </span>
        )}
      </Row>
    </OrnateFrame>
  );
}

/**
 * Carte de SIÈGE (l'équipe — la star) : un ACTE D'ENGAGEMENT scellé — cartouche « Acte N » + figurine
 * sous lampe (ambiance `spotlight`) + identité + sceau de cire au coin (`WaxSeal`, motif du kit
 * « Atelier du scribe », #412), MÊME niveau d'information que la carte de candidat (nom + archétype +
 * rôle + accroche), plus les actions de gestion. Composée dans la grille de sièges de l'écran d'équipe
 * (correction de cap 2026-07-14, transposition fidèle de la planche ratifiée d'équipe).
 */
export function SeatCard({
  hero,
  seatLabel,
  axisIds,
  onPresent,
  actions,
}: {
  hero: Combatant;
  /** Libellé de l'acte (« Acte I »), rendu en cartouche au-dessus du nom. */
  seatLabel?: string;
  /** Axes ACTIFS de la campagne pour le glyphe de rose (`coreAxisIds` par défaut). */
  axisIds?: string[];
  onPresent?: () => void;
  /** Boutons de gestion (Modifier / Remplacer / Retirer) — rendus par l'écran (droits coop). */
  actions?: ReactNode;
}) {
  return (
    <article className="seat-card">
      <WaxSeal size={44} className="seat-card-seal" />
      {/* Figurine + identité = le contrôle de présentation (directive user 2026-07-13). */}
      <PresentHandle hero={hero} onPresent={onPresent} className="seat-card-main">
        <div className="seat-card-fig">
          <CharacterPreview hero={hero} size="fill" ambiance="spotlight" />
          <RoseGlyphCorner hero={hero} axisIds={axisIds} />
        </div>
        <div className="seat-card-body">
          {seatLabel && <span className="seat-card-contract">{seatLabel}</span>}
          <CardIdentity hero={hero} />
          <CardLore hero={hero} seat axisIds={axisIds} />
        </div>
      </PresentHandle>
      {/* Gestion (Modifier/Remplacer/Retirer) TOUJOURS visible : le layout est stable, rien ne se
          décale ni n'apparaît en flux au survol (directive user 2026-07-13). Filet + collée en pied
          (`.acte-actions` du kit, #417 — mort du cadre `OrnateFrame` interne, la carte de siège est
          plate bordée à la `.acte`, pas un cadre-dans-le-cadre). */}
      {actions && <Row className="seat-card-actions">{actions}</Row>}
    </article>
  );
}

/** Carte-action du vivier (même famille visuelle que la carte-portrait) : créer / importer, avec
 *  une ligne d'invite pour ne pas être une icône dans le vide. */
export function ActionCard({ icon, label, invite, onClick, title }: { icon: IconIdInput; label: string; invite?: string; onClick: () => void; title?: string }) {
  return (
    // `btn` (canon) : la carte-action EST un bouton — styles de carte surchargés par `.candidate-action-card`.
    <button type="button" className="btn candidate-action-card" onClick={onClick} title={title}>
      <Icon id={icon} size={38} />
      <span className="candidate-action-label">{label}</span>
      {invite && <span className="candidate-action-invite">{invite}</span>}
    </button>
  );
}
