import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGame, type SheetTab } from '../state/store';
import { bestDetector } from '../state/merchantFlow';
import { MINUTES_PER_DAY } from '../engine/clock';
import { useModalA11y } from './Modal';
import { ramenerEnVue } from './useRamenerEnVue';
import { Tabs } from './Tabs';
import { isWeaponActive, weaponHands, isOffHandEligible, maxEncumbrance, totalEncumbrance } from '../engine/items';
import { OptionChooser } from './OptionChooser';
import { ItemInstance, Combatant, CharKey, CHAR_KEYS } from '../engine/types';
import { effectiveChar, bonus } from '../engine/characteristics';
import { baseWithTalents } from '../engine/talentEffects';
import { refKey, parseRefKey } from '../engine/careerSlots';
import { buildAdvancementView } from '../state/advancement';
import { hasHealSkill, isHealable } from '../engine/healing';
import { isConsumable } from '../engine/consumables';
import { isMagicMissile, isArcaneSpell, castBlockedBy, castInfoIsPrayer } from '../engine/magic';
import { effectiveSpellOf } from '../state/combatFlow';
import { GatedAction, raisonSi } from './GatedAction';
import { actorHasSkill } from '../engine/skills';
import { nextProsthesisTier } from '../engine/trauma';
import { dispellableSpellsOn } from '../engine/dispel';
import { rule } from '../engine/policy';
import { canAfford, toMoney, formatMoney } from '../engine/money';
import { bourseOf } from '../state/bourseFlow';
import { learnableSpells, canCastFromGrimoire, carriedGrimoire, casterTalents } from '../engine/grimoire';
import { spellSupport } from '../engine/spellspec';
import { spellEffectOps } from '../state/flow';
import { careers, findSpellById, findStarById, spells as allSpells, speciesSingular, findSpeciesById, findCareerById, careerLabelFor, findClassById, findTrappingById, libelleOuAbsence } from '../data';
import { heroStatusLabel } from './CharCard';
import { MetalStatus } from './MetalStatus';
import { weaponFormLabel } from '../gameIso/rig/parts/weaponForms';
import { CodexRef } from './compendium/CodexRef';
import { CharValue } from './CharValue';
import { HeroSheet } from './HeroSheet';
import { Coins } from './Coins';
import { EquipmentPanel } from './EquipmentPanel';
import { PossessionsRegistry } from './PossessionsRegistry';
import { CharFrame } from './CharFrame';
import { ItemIcon } from './ItemIcon';
import { MediaSelect } from './MediaSelect';
import { BackgroundPanel } from './BackgroundPanel';
import { Icon } from './Icon';
import { EffectChips } from './EffectChips';
import { combatantFlags } from '../gameIso/effectIcons';
import { sheetAlarms, alarmsFingerprint } from './sheetAlarms';
import { EtatPanel, ZONE_ORDER, zoneAnchor, zoneAfflictions } from './EtatPanel';
import { FigTile, type ZoneBadgeSpec } from './FigTile';
import { LifeBar } from './LifeBar';
import { woundsTone, encumbranceTone } from './gaugeTones';
import { corruptionThresholdExceeded } from '../engine/corruption';
import { locationLabel } from '../engine/combat';
import { CarrierInventory } from './CarrierInventory';
import { Row } from './Layout';

/** Badges de zone de l'onglet Possessions (lot « corps-index », #492) : PA cumulé des 6 Localisations
 *  RÉELLES (`hero.armour`, couches rigide+Flexible+mutations déjà cumulées) — `sang` si une pièce
 *  portée à cette zone est ENTAMÉE (`damageTaken > 0`), `or` si PA > 0, `dim` sinon (vide). */
function possessionsZoneBadges(hero: Combatant): ZoneBadgeSpec[] {
  return ZONE_ORDER.map((loc) => {
    const pa = hero.armour[loc] ?? 0;
    const entamee = (hero.items ?? []).some((it) => it.kind === 'armor' && it.equipped && (it.locs ?? []).includes(loc) && (it.damageTaken ?? 0) > 0);
    return {
      loc,
      label: locationLabel(loc, hero.bodyShape),
      value: pa,
      tone: entamee ? 'sang' : pa > 0 ? 'or' : 'dim',
    };
  });
}

/** Badges de zone de l'onglet État (lot « corps-index », #492) : compte de critiques/séquelles par
 *  Localisation TOUCHÉE (`zoneAfflictions`, `EtatPanel.tsx` — source unique du calcul), clic = ramène
 *  la première rangée concernée du registre en vue. */
function etatZoneBadges(hero: Combatant): ZoneBadgeSpec[] {
  return zoneAfflictions(hero).map(({ loc, crit, trauma }) => ({
    loc,
    label: locationLabel(loc, hero.bodyShape),
    value: crit + trauma,
    tone: crit > 0 ? 'sang' : 'warn',
    onClick: () => ramenerEnVue(document.getElementById(zoneAnchor(loc))),
  }));
}

/** Rangée d'EFFETS ACTIFS de la colonne aside (directive user 2026-07-17 : « dans les alertes je ne
 *  veux que les états et les buffs, comme sur les portraits ») — MÊME primitive que les portraits
 *  (`EffectChips`/`summarizeEffects`) : États/malus en rouge, buffs en vert + durée. Ce sont les EFFETS
 *  ACTIFS du personnage, à ne pas confondre avec le Statut SOCIAL (rangée d'identité). Les afflictions
 *  et seuils (critiques, corruption, mutations, séquelles, maladies, psycho, surcharge) vivent dans le
 *  tableau de bord de l'onglet État — plus jamais dupliqués ici. Rien rendu si aucun effet actif. */
function SheetActiveEffects({ hero }: { hero: Combatant }) {
  return <EffectChips conditions={hero.conditions} effects={hero.activeEffects} flags={combatantFlags(hero)} />;
}

const TAB_LABELS: Record<SheetTab, string> = {
  etat: 'État',
  possessions: 'Possessions',
  competences: 'Compétences & Talents',
  magie: 'Magie & Foi',
  avancement: 'Avancement',
  histoire: 'Histoire',
};

export function CharacterSheet({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  // EN COMBAT, lire la copie de bataille (qui porte les effets actifs vivants — buffs, métamorphose,
  // dégâts…) plutôt que l'original du groupe ; hors combat, le groupe. → la fiche reflète l'état réel.
  const hero = useGame((s) => s.battle?.combatants.find((h) => h.id === heroId) ?? s.party.find((h) => h.id === heroId));
  const party = useGame((s) => s.party);
  const tab = useGame((s) => s.sheetTab) ?? 'competences';
  const setSheetTab = useGame((s) => s.setSheetTab);
  const setSheetScroll = useGame((s) => s.setSheetScroll);
  const setSheetAlarmsSeen = useGame((s) => s.setSheetAlarmsSeen);
  const openMedic = useGame((s) => s.openMedic);
  const inBattle = useGame((s) => !!s.battle);
  const boxRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Dialogue au markup spécifique (header à onglets) → hook a11y partagé. `actif` = la condition de
  // l'early-return `if (!hero) return null` : sans héros, la fiche ne rend rien et n'empile rien.
  useModalA11y(boxRef, onClose, { kind: 'fiche-perso', actif: !!hero });

  // Restaure le scroll mémorisé de CET onglet à chaque affichage (patron ActivityPane : corps
  // scrollable, un onglet reprend où on l'a laissé plutôt que de rouvrir en haut). Lecture SANS
  // abonnement (`getState`) : `onScroll` écrit `sheetScroll` à chaque tick — s'y abonner re-rendrait
  // toute la fiche en boucle pendant le scroll.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = useGame.getState().sheetScroll[tab] ?? 0;
  }, [tab]);

  // Règle d'atterrissage (§3.2) : force l'onglet État seulement à la PREMIÈRE ouverture depuis une
  // alarme NOUVELLE (empreinte jamais vue pour ce héros) — jamais au switch de héros (deps VIDES :
  // ne capture que le héros du 1er rendu ; `heroId`/`sheetId` changent ensuite sans remonter la fiche,
  // cf. `CampaignView.tsx`/`PartyScreen.tsx` qui ne posent pas de `key`).
  useEffect(() => {
    if (!hero) return;
    const alarms = sheetAlarms(hero);
    if (alarms.length > 0 && alarmsFingerprint(alarms) !== useGame.getState().sheetAlarmsSeen[hero.id]) setSheetTab('etat');
  }, []);

  // Enregistre l'empreinte VUE dès que l'onglet État est affiché (atterrissage forcé OU visite
  // manuelle) — les prochaines ouvertures sans alarme nouvelle laissent le dernier onglet consulté.
  useEffect(() => {
    if (!hero || tab !== 'etat') return;
    const fp = alarmsFingerprint(sheetAlarms(hero));
    if (useGame.getState().sheetAlarmsSeen[hero.id] !== fp) setSheetAlarmsSeen(hero.id, fp);
  }, [tab, hero?.id, setSheetAlarmsSeen]); // `hero` change lu via getState() (pas de re-render en boucle sur son objet muté)

  if (!hero) return null;

  // Bourse PERSONNELLE du héros (Lot 3 T-bourse #531) : affichée en permanence dans la
  // colonne d'identité (visible sur TOUS les onglets), pas seulement au canAfford des sorts.
  const bourse = bourseOf(hero);

  // Guérison hors-combat : un soigneur du groupe peut panser ce héros (sans avancer le temps, pour
  // stopper une hémorragie AVANT que l'horloge ne la fasse ticker — LDB 09-Compétences).
  const canSoigner = !inBattle && isHealable(hero) && party.some(hasHealSkill);

  // GATE CORRIGÉ (#492 bug 2) : un lanceur de Bénédictions sans sort mémorisé encore (Bienheureux
  // avant sa 1re Bénédiction) garde son onglet Magie & Foi — `spells.length` seul le privait à tort.
  const isCaster = (hero.spells?.length ?? 0) > 0 || casterTalents(hero).length > 0;
  const tabs: SheetTab[] = ['competences', 'etat', 'possessions', ...(isCaster ? ['magie' as const] : []), 'avancement', 'histoire'];

  // Gangrène du cadre (§6, #492) : l'or du bandeau/liseré se ternit progressivement de violet-noir
  // selon la Corruption — `none` (aucune) / `ronge` (sous le seuil) / `seuil` (seuil de Corruption
  // dépassé, LDB 80). `corruptionThresholdExceeded` = SOURCE UNIQUE du seuil (moteur, `engine/corruption.ts`).
  const corruption = hero.corruption ?? 0;
  const dataCorruption = corruption <= 0 ? 'none' : corruptionThresholdExceeded(hero) ? 'seuil' : 'ronge';

  // Annotation par Caractéristique (base+talents vs effective — buffs/malus actifs) pour la table de
  // Compétences & Talents : composée par `HeroSheet` (`statAnnotations`, data-driven), calculée ICI
  // (l'appelant fournit ses propres classes/notes, jamais un branchement dans la primitive).
  const statAnnotations: Partial<Record<CharKey, { valClass?: string; note?: string }>> = {};
  for (const k of CHAR_KEYS) {
    const b = baseWithTalents(hero, k), e = effectiveChar(hero, k);
    statAnnotations[k] = {
      valClass: e > b ? 'ok-text' : e < b ? 'warn-text' : undefined,
      note: e !== b ? `Base ${b} (${e > b ? '+' : ''}${e - b} de modificateurs actifs)` : undefined,
    };
  }

  return (
    <div className="modal-overlay sheet-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal sheet-modal" data-corruption={dataCorruption} onClick={(e) => e.stopPropagation()}>
        <button className="btn small sheet-close" onClick={onClose} aria-label="Fermer">✕</button>

        {/* L'ESSENTIEL à gauche : la colonne est LA PRÉSENCE (figurine en pied + identité + Blessures +
            alarmes), zéro scroll — arbitrage user 2026-07-17 (« arrête de polluer l'écran de gauche »).
            Le switch de héros passe par le PartyDock (HUD, au-dessus de cet overlay) ; le détail vit
            dans les onglets à droite. */}
        <div className="sheet-layout">
          <aside className="sheet-aside">
            <div className="sheet-portrait">
              <h3>{hero.label}</h3>
              <FigTile
                preview={{ hero }}
                fig="hero"
                zoneBadges={tab === 'possessions' ? possessionsZoneBadges(hero) : tab === 'etat' ? etatZoneBadges(hero) : undefined}
              />
              <LifeBar stacked label="Blessures" value={hero.wounds.current} max={hero.wounds.max} tone={woundsTone} />
              {/* Encombrement : ton PAR PALIER (`encumbranceTone`, juge vision 2026-07-17) — le palier de
                  Surcharge lui-même vit dans le tableau de bord de l'onglet État (`EtatPanel.tsx`), jamais dupliqué ici.
                  Le dépassement (Enc > max) est porté par l'état DÉPASSEMENT générique de `LifeBar`.
                  `stacked` (arbitrage 2026-07-17) : valeur au-dessus, piste pleine largeur — les deux
                  barres de l'aside s'alignent par construction, quelle que soit la longueur du libellé/valeur. */}
              <LifeBar stacked label="Encombrement" value={totalEncumbrance(hero)} max={maxEncumbrance(hero)} tone={encumbranceTone} />
              <div className="sheet-idrows">
                <div className="sheet-idrow">
                  <span className="sheet-idrow-label">Race</span>
                  <span className="sheet-idrow-value">
                    <CodexRef category="races" id={hero.species} label={libelleOuAbsence(findSpeciesById(hero.species), 'race', String(hero.species))}>{speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species)}</CodexRef>
                  </span>
                </div>
                <div className="sheet-idrow">
                  <span className="sheet-idrow-label">Carrière</span>
                  <span className="sheet-idrow-value">
                    <CodexRef category="careers" id={hero.career} label={libelleOuAbsence(findCareerById(hero.career), 'carriere', String(hero.career))}>{careerLabelFor(hero)}</CodexRef>
                    {hero.careerLevel ? ` (niv. ${hero.careerLevel})` : ''}
                  </span>
                </div>
                <div className="sheet-idrow">
                  <span className="sheet-idrow-label">Statut</span>
                  <span className="sheet-idrow-value"><MetalStatus status={heroStatusLabel(hero)} /></span>
                </div>
                <div className="sheet-idrow">
                  <span className="sheet-idrow-label">Bourse</span>
                  <span className="sheet-idrow-value"><Coins money={bourse} /></span>
                </div>
              </div>
            </div>
            <SheetActiveEffects hero={hero} />
            {canSoigner && (
              <Row>
                <button className="btn small" onClick={() => openMedic({ patientId: hero.id })}
                  title="Soins du groupe (Tests de Guérison) — ouvre l'infirmerie sur ce héros (provisoire — maison PartyDock au lot 6)">
                  <Icon id="journal/heal" size="sm" /> Soins
                </button>
              </Row>
            )}
          </aside>
          <div className="sheet-main">
            <Tabs
              className="sheet-tabnav"
              tabs={tabs.map((t) => ({ key: t, label: TAB_LABELS[t] }))}
              active={tab}
              onChange={setSheetTab}
            />
            <div className="sheet-tabbody" ref={bodyRef} onScroll={(e) => setSheetScroll(tab, e.currentTarget.scrollTop)}>
              {tab === 'avancement' ? (
                <AdvancementPanel hero={hero} />
              ) : tab === 'magie' ? (
                <SpellbookSection hero={hero} />
              ) : tab === 'etat' ? (
                <EtatPanel hero={hero} />
              ) : tab === 'histoire' ? (
                <>
                  <BackgroundPanel hero={hero} />
                  {hero.star && (() => {
                    const s = findStarById(hero.star); // `hero.star` = id STABLE → libellé à l'affichage
                    const label = s?.label ?? hero.star;
                    return (
                      <span className="char-sub star-sub">
                        ★ <CodexRef category="stars" id={hero.star} label={label}>{label}</CodexRef>
                        {s?.signe ? ` — ${s.signe}` : ''}
                      </span>
                    );
                  })()}
                </>
              ) : tab === 'competences' ? (
                // Onglet Compétences & Talents : compose la primitive `HeroSheet` (`header={false}` —
                // figurine/identité restent dans l'aside de la fiche, patron CreatorSummary.tsx) plutôt
                // que de réassembler son patron à la main (arbitrage 2026-07-17). Table à VALEURS (deux colonnes,
                // `skillInstanceLabel` codex-lié) — les Talents restent en chips dans les deux variantes.
                <HeroSheet
                  hero={hero}
                  header={false}
                  sections={['stats', 'derived', 'traits', 'skills', 'talents']}
                  // Blessures déjà portées par la barre de vie de l'aside (`LifeBar`, #492) — la
                  // rubrique dérivée de CETTE composition n'en remontre pas le chiffre en double.
                  derivedFields={['movement', 'fate', 'resilience']}
                  skillsVariant="valeurs"
                  statAnnotations={statAnnotations}
                />
              ) : (
                <FicheBody hero={hero} section={tab} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Grimoire/livre de prières — incantation HORS COMBAT (couture D). Un héros lanceur cible self/allié.
 *  Les Projectiles magiques (offensifs) sont marqués « en combat » : ils exigent une cible ennemie. */
/** Raison UNIQUE du refus des lanceurs de la fiche pendant un combat — le geste existe, il vit ailleurs. */
const RAISON_HORS_COMBAT = 'En combat, les sorts se lancent depuis la console.';

function SpellbookSection({ hero }: { hero: Combatant }) {
  const party = useGame((s) => s.party);
  // Les verbes `ooc*` sont des lanceurs HORS COMBAT : pendant un combat, le lancement passe par la
  // console (le sort y consomme l'Action, ouvre son Test et sa cible). La fiche cesse donc d'offrir
  // un bouton qui ne ferait RIEN, et dit pourquoi au survol plutôt que de disparaître.
  const enCombat = useGame((s) => !!s.battle);
  const oocCastSpell = useGame((s) => s.oocCastSpell);
  const oocFocusSpell = useGame((s) => s.oocFocusSpell);
  const oocDispelSpell = useGame((s) => s.oocDispelSpell);
  const buySpellComponent = useGame((s) => s.buySpellComponent);
  const removeSpellComponent = useGame((s) => s.removeSpellComponent);
  // Bourse PERSONNELLE de l'incantateur : c'est SA Bourse qui paie le composant (débit solo).
  const bourse = useGame((s) => bourseOf(s.party.find((h) => h.id === hero.id) ?? hero));
  const [targetId, setTargetId] = useState(hero.id);
  const spells = (hero.spells ?? [])
    .map((x) => findSpellById(x)) // hero.spells = ids de sort (runtime)
    .filter((s): s is NonNullable<ReturnType<typeof findSpellById>> => !!s);
  // Lecture au grimoire (LDB 47 l.21, `VDM 12 l.646-647`). Le catalogue est ramené à sa forme
  // EFFECTIVE par `findSpellById` (variante réglée) et le NI de lecture vient de `effectiveSpellOf`
  // — le MÊME couple que la résolution (`oocCastSpell(…, true)`), jamais un facteur recopié ici.
  const grimoireSpells = carriedGrimoire(hero)
    ? allSpells
        .map((s0) => findSpellById(s0.id))
        .filter((s): s is NonNullable<ReturnType<typeof findSpellById>> => !!s && canCastFromGrimoire(hero, s))
        .map((s) => ({ sp: s, grimoireCn: effectiveSpellOf({ spellId: s.id, grimoire: true })?.cn ?? null }))
    : [];
  if (!spells.length && !grimoireSpells.length) return null;
  return (
    <div className="sc-block sheet-spells">
      <span className="mini-title">Sorts — incantation hors combat</span>
      {(hero.sinPoints ?? 0) > 0 && (
        <span className="muted">
          <Icon id="ui/balance" size="sm" /> <CodexRef category="characteristics" id="peche" label="Péché">Péché : {hero.sinPoints}</CodexRef>
        </span>
      )}
      <div className="spell-target">
        Cible :{' '}
        <Row inline gap="sm" align="start">
          {party.map((m) => (
            <CharFrame
              key={m.id}
              c={m}
              variant="vital"
              size="xs"
              selected={m.id === targetId}
              onClick={() => setTargetId(m.id)}
              nom={m.id === hero.id ? `${m.label} (soi)` : m.label}
            />
          ))}
        </Row>
      </div>
      <div className="spell-list">
        {spells.map((sp) => {
          const offensive = isMagicMissile(sp);
          const support = spellSupport(spellEffectOps(sp.effects), sp, offensive);
          const castBlocked = enCombat ? RAISON_HORS_COMBAT : castBlockedBy(hero, castInfoIsPrayer(sp) ? 'priere' : 'langue');
          return (
            <div className="spell-row" key={sp.label} title={support !== 'mecanique' ? 'Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé (cf. docs/sorts-implementation.md).' : undefined}>
              <span className="spell-name">
                <CodexRef category="spells" id={sp.id} label={sp.label}>{sp.label}</CodexRef>
                {sp.cn != null ? ` · NI ${sp.cn}` : ''}
                {support === 'narratif' ? (<> <Icon id="nav/rules" size="sm" /></>) : support === 'partiel' ? (<> <Icon id="ui/partial" size="sm" /></>) : ''}
              </span>
              {offensive ? (
                <span className="muted" title="Projectile magique : nécessite une cible ennemie (en combat)">
                  {' '}en combat
                </span>
              ) : (
                <Row className="spell-actions">
                  {isArcaneSpell(sp) && (
                    <>
                      <GatedAction
                        id={`sheet-focus-${hero.id}-${sp.id}`}
                        label={<><Icon id="flag/focus" size="sm" /> Focaliser</>}
                        enabled={!(enCombat ? RAISON_HORS_COMBAT : castBlockedBy(hero, 'focalisation'))}
                        {...raisonSi(enCombat ? RAISON_HORS_COMBAT : castBlockedBy(hero, 'focalisation'))}
                        primary={false}
                        btnClassName="small"
                        onClick={() => oocFocusSpell(hero.id, sp.id)}
                      />
                      <CodexRef category="regles" id="focalisation-etendue" label="Test de Focalisation (étendu)" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
                    </>
                  )}
                  <GatedAction
                    id={`sheet-cast-${hero.id}-${sp.id}`}
                    label={<><Icon id="nav/dice" size="sm" /> Lancer</>}
                    enabled={!castBlocked}
                    {...raisonSi(castBlocked)}
                    primary={false}
                    btnClassName="small"
                    onClick={() => oocCastSpell(hero.id, sp.id, targetId)}
                  />
                </Row>
              )}
            </div>
          );
        })}
        {grimoireSpells.map(({ sp, grimoireCn }) => (
          <div className="spell-row" key={`g-${sp.label}`} title="Lecture au grimoire : sort non mémorisé de votre Domaine — deux mains, au NI de lecture indiqué.">
            <span className="spell-name">
              <Icon id="nav/compendium" size="sm" /> <CodexRef category="spells" id={sp.id} label={sp.label}>{sp.label}</CodexRef>
              {sp.cn != null && grimoireCn != null ? ` · NI ${sp.cn}→${grimoireCn}` : ''}
            </span>
            {isMagicMissile(sp) ? (
              <span className="muted">{' '}en combat</span>
            ) : (
              <Row className="spell-actions">
                <GatedAction
                  id={`sheet-cast-grimoire-${hero.id}-${sp.id}`}
                  label={<><Icon id="nav/compendium" size="sm" /> Lancer (grimoire)</>}
                  enabled={!(enCombat ? RAISON_HORS_COMBAT : castBlockedBy(hero, castInfoIsPrayer(sp) ? 'priere' : 'langue'))}
                  {...raisonSi(enCombat ? RAISON_HORS_COMBAT : castBlockedBy(hero, castInfoIsPrayer(sp) ? 'priere' : 'langue'))}
                  primary={false}
                  btnClassName="small"
                  onClick={() => oocCastSpell(hero.id, sp.id, targetId, true)}
                />
              </Row>
            )}
          </div>
        ))}
      </div>
      {(() => {
        // Dissipation de sorts permanents HORS COMBAT (LDB 46 l.160-162, #461) : « pour votre
        // Action » — n'est pas bornée au combat. Visible seulement si le héros a Langue (Magick)
        // ET qu'au moins un sort permanent est actif dans le groupe (calque le patron de la console
        // EN combat : `canDispel && dispellable.length > 0`).
        if (!actorHasSkill(hero, 'langue', 'magick')) return null;
        const dispellable = dispellableSpellsOn(party);
        if (!dispellable.length) return null;
        return (
          <div className="sc-block">
            <span className="mini-title">
              <Icon id="action/dispel" size="sm" /> Dissipation — sorts permanents actifs
            </span>
            <div className="spell-list">
              {dispellable.map((d) => {
                const prog = hero.dispel?.spellId === d.spellId && hero.dispel.spellCasterId === d.casterId ? hero.dispel.total : 0;
                return (
                  <div className="spell-row" key={`dispel-${d.spellId}@${d.casterId}`}>
                    <span className="spell-name">
                      {d.label} · NI {d.ni} ({prog}/{d.ni})
                    </span>
                    <Row className="spell-actions">
                      <button className="btn small" onClick={() => oocDispelSpell(hero.id, d.spellId, d.casterId)}>
                        <Icon id="action/dispel" size="sm" /> Dissiper
                      </button>
                    </Row>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {rule('magic-composant') === true && (() => {
        // Composants d'incantation (LDB 46 l.107-113) : achetés PAR Sort d'Arcane/Domaine connu,
        // coût = NI pistoles d'argent ; absorbent le contrecoup (Imparfaite Majeure→Mineure,
        // Mineure→annulée) puis sont consumés à l'incantation. Visible seulement règle ON.
        const arcane = spells.filter((sp) => isArcaneSpell(sp) && sp.cn != null);
        if (!arcane.length) return null;
        const owned = hero.componentSpells ?? [];
        const countOf = (id: string) => owned.filter((x) => x === id).length;
        return (
          <div className="spell-components">
            <span className="mini-title">
              <Icon id="magic/component" size="sm" /> Composants d'incantation
            </span>
            <div className="spell-list">
              {arcane.map((sp) => {
                const n = countOf(sp.id);
                const cost = toMoney({ silver: sp.cn! });
                const afford = canAfford(bourse, cost);
                return (
                  <div className="spell-row" key={`comp-${sp.id}`}>
                    <span className="spell-name">
                      <CodexRef category="spells" id={sp.id} label={sp.label}>{sp.label}</CodexRef>
                      {n > 0 ? <span className="muted"> · ×{n}</span> : null}
                    </span>
                    <Row className="spell-actions">
                      {n > 0 && (
                        <button className="btn small" title="Jeter un composant (pas de remboursement)" onClick={() => removeSpellComponent(hero.id, sp.id)}>
                          −
                        </button>
                      )}
                      <GatedAction
                        id={`spell-comp-buy-${sp.id}`}
                        label={<>+ <Coins money={cost} /></>}
                        ariaLabel={`Acheter un composant pour ${sp.label}`}
                        enabled={afford}
                        reason={`Bourse insuffisante (${formatMoney(cost)}).`}
                        onClick={() => buySpellComponent(hero.id, sp.id)}
                        primary={false}
                        btnClassName="small"
                      />
                    </Row>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/** Contrôle compact « En main » d'une arme du Sac (façon Dragon Age / Pillars) : assigne l'arme à la
 *  Main principale ou secondaire du set ACTIF. Réutilise OptionChooser (seg). La main secondaire impose
 *  −20 (LDB 14 l.139) et n'accepte qu'une arme de mêlée à une main ou un pistolet (LDB 14 l.138). Cliquer
 *  l'option déjà active la retire. (Verrouillé en combat : la bascule de set passe par la barre d'action.) */
function HandPicker({ hero, it }: { hero: Combatant; it: ItemInstance }) {
  const setLoadoutSlot = useGame((s) => s.setLoadoutSlot);
  const lo = (hero.loadouts ?? []).find((l) => l.id === hero.activeLoadoutId) ?? hero.loadouts?.[0];
  if (!lo) return null;
  const isMain = lo.main === it.uid;
  const isOff = lo.off === it.uid;
  const mainItem = lo.main ? (hero.items ?? []).find((i) => i.uid === lo.main) : undefined;
  const mainTwoH = mainItem ? weaponHands(mainItem) === 2 : false;
  const offOk = isOffHandEligible(it) && !mainTwoH;
  return (
    <div className="ir-hand" title="Régler la main qui tient cette arme (set actif)">
    <OptionChooser
      layout="seg"
      options={[
        {
          key: 'main',
          label: 'Principale',
          selected: isMain,
          title: 'Tenir dans la main principale',
          onSelect: () => setLoadoutSlot(hero.id, lo.id, 'main', isMain ? null : it.uid),
        },
        {
          key: 'off',
          label: <>2nde <em className="off-malus">−20</em></>,
          selected: isOff,
          // La RAISON du refus se lit au survol/focus/tap dans l'infobulle partagée (`refus`), jamais
          // par un `disabled` muet ; le `title` ne reste que pour l'option OFFERTE.
          title: offOk ? 'Main secondaire : −20 aux attaques de cette main' : undefined,
          refus: offOk
            ? undefined
            : mainTwoH
              ? 'Main principale à deux mains — pas de seconde main'
              : 'Inéligible : seules une arme de mêlée à une main ou un pistolet vont en seconde main',
          onSelect: () => setLoadoutSlot(hero.id, lo.id, 'off', isOff ? null : it.uid),
        },
      ]}
    />
    </div>
  );
}

/** Sélecteur visuel de FORME d'une arme ABSTRAITE (« Arme simple » → épée/hache/masse/marteau de
 *  guerre/demi-lance) : pose `ItemInstance.shape` parmi les `formChoices` du trapping. Option courante =
 *  `item.shape ?? trapping.shape` ; chaque option = la silhouette (ItemIcon par shape) + le libellé du
 *  WeaponDef. Cosmétique RAW (stats identiques) — verrouillé en combat (le token rendu vient de la
 *  copie de bataille, pas du groupe muté). Réutilise la primitive `MediaSelect`. */
function FormPicker({ hero, it }: { hero: Combatant; it: ItemInstance }) {
  const setItemShape = useGame((s) => s.setItemShape);
  const trapping = it.trappingId ? findTrappingById(it.trappingId) : undefined;
  const choices = trapping?.formChoices;
  if (!choices || choices.length < 2) return null;
  const current = it.shape ?? trapping?.shape ?? choices[0];
  return (
    <div className="ir-form" title="Forme de l’arme (silhouette)">
      <MediaSelect
        value={current}
        title="Choisir la forme de l’arme"
        options={choices.map((slug) => ({
          key: slug,
          media: <ItemIcon item={{ ...it, shape: slug }} size="sm" />,
          label: weaponFormLabel(slug),
        }))}
        onSelect={(slug) => setItemShape(hero.id, it.uid, slug)}
      />
    </div>
  );
}

function FicheBody({ hero, section }: { hero: Combatant; section: 'possessions' }) {
  const usePartyItem = useGame((s) => s.usePartyItem);
  const appraiseItem = useGame((s) => s.appraiseItem);
  const items = hero.items ?? [];
  const party = useGame((s) => s.party);
  // Détection d'artefact (LDB 10) : visible seulement si un héros du groupe possède le Talent.
  const canDetect = !!bestDetector(party);
  // Verrou d'Évaluation : un échec bloque la re-tentative jusqu'au lendemain (LDB 12 l.94).
  const today = useGame((s) => Math.floor(s.gameTime / MINUTES_PER_DAY));

  return (
    <>
      {section === 'possessions' && <EquipmentPanel hero={hero} />}

      {section === 'possessions' && <PossessionsRegistry hero={hero} />}

      {section === 'possessions' && (
        <CarrierInventory
          carrierId={hero.id}
          items={items}
          party={party}
          forceBonus={bonus(effectiveChar(hero, 'force'))}
          weaponHighlighted={(it) => isWeaponActive(hero, it.uid)}
          weaponHandLabel={(it) => {
            // E1 : état « en main » SANS jargon « set » (les sets = fonction avancée, cf. onglet Combat) —
            // on NOMME l'arme du set ACTIF Main principale / secondaire ; les autres armes n'affichent rien.
            const activeLo = (hero.loadouts ?? []).find((l) => l.id === hero.activeLoadoutId) ?? hero.loadouts?.[0];
            return activeLo?.main === it.uid ? 'Main principale' : activeLo?.off === it.uid ? 'Main secondaire' : null;
          }}
          rowExtra={(it, { inBattleNow: locked, handLabel }) => {
            const isWeaponItem = it.kind === 'melee' || it.kind === 'ranged';
            const consumable = isConsumable(it);
            return (
              <>
                {it.identified === false && !locked && (
                  <>
                    {it.appraiseTriedDay !== today && (
                      <button className="btn small" title="Évaluation (Int) : révèle les qualités cachées et estime le prix — un échec verrouille jusqu'à demain" onClick={() => appraiseItem(it.uid, hero.id)}>Évaluer</button>
                    )}
                    {canDetect && !it.detectTried && (
                      <button className="btn small" title="Détection d'artefact (Intuition, au toucher) : sentir l'aura magique — une seule tentative par objet" onClick={() => appraiseItem(it.uid, hero.id, 'detect')}>Détecter</button>
                    )}
                  </>
                )}
                {isWeaponItem && !locked && <FormPicker hero={hero} it={it} />}
                {isWeaponItem && (
                  locked ? (
                    handLabel && (
                      <span className="chip" title="Arme en main (verrouillé en combat — changez de set depuis la barre d’action)">
                        <Icon id="item/weapon" size="sm" /> {handLabel}
                      </span>
                    )
                  ) : (
                    <HandPicker hero={hero} it={it} />
                  )
                )}
                {consumable && (
                  <GatedAction
                    id={`sheet-use-${it.uid}`}
                    label="Utiliser"
                    enabled={!locked}
                    reason="En combat, utilisez l’objet depuis la barre d’action (coûte l’Action)."
                    onClick={() => usePartyItem(hero.id, it.uid)}
                    primary={false}
                    btnClassName="small"
                  />
                )}
              </>
            );
          }}
        />
      )}
    </>
  );
}

/** Ligne d'un emplacement à choix (compétence ou talent) : sélecteur d'option + Désigner/Acquérir.
 *  Une option DÉJÀ possédée (via l'espèce…) se DÉSIGNE gratuitement — elle devient le choix de
 *  carrière de l'emplacement et donc montable en PX ; une nouvelle option s'achète. */
/** `key` = clé de câblage OPAQUE (id+spec via `refKey`, ré-utilisée telle quelle par `onPick` puis
 *  `parseRefKey` — jamais affichée) ; `display` = texte affiché (une spec de Groupe d'arme est un id,
 *  `display` porte son libellé résolu via `specLabel` — l'id ne doit jamais s'afficher brut). */
function SlotChoiceRow({
  entry,
  options,
  acquireCost,
  afford,
  onPick,
}: {
  entry: string;
  options: { key: string; display?: string; owned: boolean; hint?: string }[];
  acquireCost: number;
  afford: (c: number) => boolean;
  onPick: (key: string, owned: boolean) => void;
}) {
  const [choice, setChoice] = useState('');
  const opt = options.find((o) => o.key === choice);
  const cost = opt?.owned ? 0 : acquireCost;
  return (
    <div className="adv-row acquire">
      <span className="adv-name">
        {entry} <span className="acquire-tag">au choix</span>
      </span>
      <select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">— choisir —</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.display ?? o.key}
            {o.hint ? ` ${o.hint}` : ''}
            {o.owned ? ' (possédé)' : ''}
          </option>
        ))}
      </select>
      <button className="btn small" disabled={!opt || !afford(cost)} onClick={() => opt && onPick(opt.key, opt.owned)}>
        {opt?.owned ? 'Désigner · 0 PX' : `Acquérir · ${acquireCost} PX`}
      </button>
    </div>
  );
}

/** Catégorie repliable de l'Avancement : compose la primitive `.fold` (section repliable). */
function AdvSection({ title, count, badge, children }: { title: string; count?: number; badge?: ReactNode; children: ReactNode }) {
  return (
    <details className="fold" open>
      <summary>
        <span className="fold-title">{title}</span>
        {count != null && <span className="count">{count}</span>}
        {badge}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

export function AdvancementPanel({ hero }: { hero: Combatant }) {
  const buyCharAdvance = useGame((s) => s.buyCharAdvance);
  const buySkillAdvance = useGame((s) => s.buySkillAdvance);
  const buyTalent = useGame((s) => s.buyTalent);
  const designateCareerSlot = useGame((s) => s.designateCareerSlot);
  const buySpell = useGame((s) => s.buySpell);
  const changeCareer = useGame((s) => s.changeCareer);
  const trainProsthesis = useGame((s) => s.trainProsthesis);
  const [target, setTarget] = useState('');

  const v = buildAdvancementView(hero);
  const afford = (c: number) => v.xp >= c;
  const pill = (inC: boolean) => <span className={`career-pill ${inC ? 'in' : 'out'}`}>{inC ? 'carrière' : '×2'}</span>;
  const skillLabel = (name: string, spec?: string) => (spec ? `${name} (${spec})` : name);

  return (
    <div className="adv-panel">
      {/* Total PX en tête, collant — toujours visible en scrollant les catégories.
          Pas de bouton « Octroyer +PX » : les PX viennent du JEU (Effet `giveXp`). */}
      <div className="adv-px-bar">
        <span>Points d'Expérience disponibles</span>
        <b>{v.xp}</b>
      </div>

      <AdvSection title="Caractéristiques" count={v.chars.length}>
      <div className="adv-grid">
        {v.chars.map((c) => (
          <div className="adv-row" key={c.key}>
            <span className="adv-name">
              <CharValue charKey={c.key} value={c.value} size="sm" /> {pill(c.inCareer)}
            </span>
            <span className="adv-meta">×{c.advances}</span>
            <button className="btn small" disabled={!afford(c.nextCost)} onClick={() => buyCharAdvance(hero.id, c.key)}>
              +1 · {c.nextCost} PX
            </button>
          </div>
        ))}
      </div>
      </AdvSection>

      <AdvSection title="Compétences" count={v.skills.length + v.skillSlotsOpen.length}>
      <div className="adv-grid">
        {v.skills.map((s) => (
          <div className={`adv-row ${s.known ? '' : 'acquire'}`} key={`${s.skillId}|${s.spec ?? ''}`}>
            <span className="adv-name">
              {skillLabel(s.label, s.spec)} <em>{baseWithTalents(hero, s.characteristic) + s.advances}</em> {pill(s.inCareer)}
              {s.known ? '' : <span className="acquire-tag">à apprendre</span>}
            </span>
            <span className="adv-meta">+{s.advances}</span>
            <button className="btn small" disabled={!afford(s.nextCost)} onClick={() => buySkillAdvance(hero.id, s.skillId, s.spec)}>
              {s.known ? '+1' : 'Apprendre'} · {s.nextCost} PX
            </button>
          </div>
        ))}
        {/* Emplacements de Compétence « (Au choix) » non désignés (LDB 09 l.38) */}
        {v.skillSlotsOpen.map((slot) => (
          <SlotChoiceRow
            key={slot.slotKey}
            entry={slot.entry}
            acquireCost={slot.nextCost}
            afford={afford}
            options={slot.options.map((o) => ({
              key: refKey(slot.groupId, o.spec), // clé de câblage OPAQUE (id+spec), jamais affichée
              display: `${slot.group} (${o.display})`,
              owned: o.ownedAdvances > 0,
              hint: o.ownedAdvances > 0 ? `+${o.ownedAdvances}` : undefined,
            }))}
            onPick={(key, owned) => {
              const { id, spec } = parseRefKey(key);
              if (owned) designateCareerSlot(hero.id, slot.slotKey, id, spec);
              // Acheter la 1re Augmentation désigne l'emplacement (LDB 09 l.38).
              else buySkillAdvance(hero.id, id, spec);
            }}
          />
        ))}
      </div>
      </AdvSection>

      <AdvSection title={`Talents du niveau ${v.careerLevel}`} count={v.talents.length}>
      <div className="adv-grid">
        {v.talents.length === 0 && <span className="muted">Aucun Talent de carrière disponible.</span>}
        {v.talents.map((t) =>
          t.talentId ? (
            <div className={`adv-row ${t.times > 0 ? '' : 'acquire'}`} key={t.slotKey}>
              <span className="adv-name">
                {t.label}
                {t.times > 0 ? ` ×${t.times}` : ''} {pill(true)}
              </span>
              <span className="adv-meta">{t.maxReached ? 'Maxi atteint' : ''}</span>
              <button className="btn small" disabled={t.maxReached || !afford(t.nextCost)} onClick={() => buyTalent(hero.id, t.talentId!, t.spec)}>
                {t.times > 0 ? '+1' : 'Acquérir'} · {t.nextCost} PX
              </button>
            </div>
          ) : (
            <SlotChoiceRow
              key={t.slotKey}
              entry={t.entry}
              acquireCost={t.nextCost}
              afford={afford}
              options={(t.options ?? []).map((o) => ({ key: o.refKey, display: o.display, owned: o.owned }))}
              onPick={(key, owned) => {
                const { id, spec } = parseRefKey(key);
                if (owned) designateCareerSlot(hero.id, t.slotKey, id, spec);
                else buyTalent(hero.id, id, spec);
              }}
            />
          ),
        )}
      </div>
      </AdvSection>

      {(() => {
        // Sorts apprenables (LDB 46 « Mémoriser des Sorts » + Talents LDB 10) : visibles dès
        // qu'un Talent de lanceur est possédé. Bénédictions du culte = incluses (0 PX) ;
        // un sort du Chaos coûte AUSSI 1 Point de Corruption (l'achat l'applique).
        const learnable = learnableSpells(hero);
        if (!learnable.length) return null;
        return (
          <AdvSection title="Sorts — mémorisation" count={learnable.length}>
            <div className="adv-grid">
              {learnable.map(({ spell, cost }) => {
                const support = spellSupport(spellEffectOps(spell.effects), spell, isMagicMissile(spell));
                return (
                <div className="adv-row acquire" key={spell.label} title={support !== 'mecanique' ? 'Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé.' : undefined}>
                  <span className="adv-name">
                    <CodexRef category="spells" id={spell.id} label={spell.label}>{spell.label}</CodexRef>{support === 'narratif' ? (<> <Icon id="nav/rules" size="sm" /></>) : support === 'partiel' ? (<> <Icon id="ui/partial" size="sm" /></>) : ''}
                    <span className="muted"> · {spell.ecole}{spell.subType ? ` (${spell.subType})` : ''}{spell.cn != null ? ` · NI ${spell.cn}` : ''}</span>
                  </span>
                  <span className="adv-meta" />
                  <button className="btn small" disabled={cost > 0 && !afford(cost)} onClick={() => buySpell(hero.id, spell.id)}>
                    {cost > 0 ? `Mémoriser · ${cost} PX` : 'Inclus au Talent'}
                    {spell.family === 'chaos' ? ' · +1 Corruption' : ''}
                  </button>
                </div>
                );
              })}
            </div>
          </AdvSection>
        );
      })()}

      {(() => {
        // Entraînement aux prothèses (LDB 73, #492 lot POSSESSIONS B) : achats PX qui vivaient dans
        // la barre d'actions du Sac (bouton par prothèse portée) — un ACHAT d'Avancement, pas une
        // action de possession, rejoint donc ce panneau (patron `AdvSection` déjà tenu ici).
        // Le PALIER achetable est DÉCLARÉ sur l'entrée de prothèse (`TrappingData.prosthesisTraining`,
        // LDB 73) et résolu par `nextProsthesisTier` — cet écran ne nomme aucune prothèse.
        const prostheses = (hero.items ?? []).filter((it) => it.subType === 'protheses' && it.equipped);
        const rows: { key: string; label: string; cost: number; onBuy: () => void }[] = [];
        for (const it of prostheses) {
          const tier = nextProsthesisTier(it);
          if (!tier) continue;
          rows.push({
            key: `${it.uid}-${it.prosthesisReduced ?? 0}-${tier.grants ?? 'palier'}`,
            label: `${it.label} — ${tier.label}`, // libellé du palier : DONNÉE éditable, jamais un texte d'écran
            cost: tier.px,
            onBuy: () => trainProsthesis(hero.id, it.uid),
          });
        }
        if (!rows.length) return null;
        return (
          <AdvSection title="Prothèses" count={rows.length}>
            <div className="adv-grid">
              {rows.map((r) => (
                <div className="adv-row acquire" key={r.key}>
                  <span className="adv-name">{r.label}</span>
                  <span className="adv-meta" />
                  <button className="btn small" disabled={!afford(r.cost)} onClick={r.onBuy}>
                    Entraîner · {r.cost} PX
                  </button>
                </div>
              ))}
            </div>
          </AdvSection>
        );
      })()}

      <AdvSection title="Carrière">
      <div className="adv-career">
        <div className="adv-career-cur">
          <b>{v.levelLabel}</b> <span className="muted">niv. {v.careerLevel} · {v.status}</span>
          <span className={`career-status ${v.completed ? 'done' : ''}`}>{v.completed ? '✓ niveau complété' : 'niveau en cours'}</span>
        </div>
        {v.targets.map((t) => (
          <GatedAction
            key={t.level}
            id={`career-target-${t.level}`}
            label={`${t.level > v.careerLevel ? 'Monter' : 'Redescendre'} : ${t.label} (niv. ${t.level}) · ${t.cost} PX`}
            enabled={t.ok && afford(t.cost)}
            reason={!t.ok ? (t.reason ?? 'Ce changement de Carrière n’est pas ouvert.') : `PX insuffisants — ${t.cost} PX requis.`}
            onClick={() => changeCareer(hero.id, t.career, t.level)}
            primary={false}
            btnClassName="small"
          />
        ))}
        <div className="adv-change">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— changer de carrière (niv. 1) —</option>
            {careers
              .filter((c) => c.id !== v.career)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({findClassById(c.class)?.label ?? c.class}) · {v.changeCostFor(c.id)} PX
                </option>
              ))}
          </select>
          <button
            className="btn small"
            disabled={!target || !afford(target ? v.changeCostFor(target) : v.changeCost)}
            onClick={() => {
              if (target) changeCareer(hero.id, target, 1);
              setTarget('');
            }}
          >
            Changer{target ? ` · ${v.changeCostFor(target)} PX` : ''}
          </button>
        </div>
      </div>
      </AdvSection>
    </div>
  );
}
