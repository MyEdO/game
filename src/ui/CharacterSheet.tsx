import { useEffect, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { TAB_LABELS, type SheetTab } from '../i18n/ongletsDeLaFiche';
import { objetDuNarratif } from '../noyau/monde/resolveursDuNarratif';
import { Planche } from './Planche';
import { ramenerEnVue } from './useRamenerEnVue';
import { Tabs } from './composites/Tabs';
import { isWeaponActive, maxEncumbrance, totalEncumbrance, apparencesCandidates, choisirApparenceDObjet } from '../engine/items';
import { apparencesAdmissiblesDObjet } from '../data/apparencesObjets';
import { OptionChooser } from './OptionChooser';
import { ItemInstance, Combatant, LOCALISATIONS_DE_COUP, avecSigne } from '../engine/types';
import { forceDuPorteur } from '../engine/characteristics';
import { baseWithTalents } from '../engine/talentEffects';
import { refKey, parseRefKey } from '../engine/careerSlots';
import { buildAdvancementView } from '../noyau/monde/advancement';
import { isMagicMissile, isArcaneSpell, castBlockedBy, castInfoIsPrayer } from '../engine/magic';
import { effectiveSpellOf } from '../noyau/combatFlow';
import { GatedAction, raisonSi } from './GatedAction';
import { refusAchatDeComposant, coutDuComposant, composantsOfferts } from '../noyau/partyFlow';
import type { GestesDeLObjet } from '../noyau/gestesDeLObjet';
import { libelleAvecSpec } from '../noyau/depenseDePx';
import { refusDeSoins } from '../noyau/medicFlow';
import { refusDuLanceurDeFiche } from '../noyau/verrousDeFiche';
import { t } from '../i18n';
import { actorHasSkill, skillBaseValue } from '../engine/skills';
import { nextProsthesisTier } from '../engine/trauma';
import { dispellableSpellsOn } from '../engine/dispel';
import { rule } from '../engine/policy';
import { bourseOf } from '../engine/bourse';
import { learnableSpells, canCastFromGrimoire, carriedGrimoire, estLanceur } from '../engine/grimoire';
import { spellSupportOf } from '../engine/spellspec';
import {
  careers,
  findSpellById,
  findStarById,
  spells as allSpells,
  speciesSingular,
  findSpeciesById,
  findCareerById,
  careerLabelFor,
  libelleDeClasse,
  libelleOuAbsence,
} from '../data';
import { heroStatusLabel } from './CharCard';
import { MetalStatus } from './MetalStatus';
import { CodexRef } from './compendium/CodexRef';
import { CharValue } from './CharValue';
import { HeroSheet, annotationsDeCaracteristiques } from './HeroSheet';
import { Coins } from './Coins';
import { EquipmentPanel } from './EquipmentPanel';
import { PossessionsRegistry } from './PossessionsRegistry';
import { CharFrame } from './CharFrame';
import { ItemIcon } from './ItemIcon';
import { MediaSelect } from './MediaSelect';
import { useVersionDesDatasets } from './useVersionDesDatasets';
import { BackgroundPanel } from './BackgroundPanel';
import { Icon } from './Icon';
import { EffectChips } from './EffectChips';
import { combatantFlags } from '../gameIso/effectIcons';
import { atterritSurEtat, empreinteDeFiche } from '../noyau/alarmesDeFiche';
import { nomDIndividu } from '../noyau/monde/sceneNpc';
import { EtatPanel, zoneAnchor, zoneAfflictions } from './EtatPanel';
import { FigZoneBadges, type ZoneBadgeSpec } from './FigTile';
import { LifeBar } from './LifeBar';
import { woundsTone, encumbranceTone } from './gaugeTones';
import { corruptionThresholdExceeded } from '../engine/corruption';
import { locationLabel, penaliteDeMainSecondaire } from '../engine/combat';
import { CarrierInventory } from './CarrierInventory';
import { Row } from './Layout';

/** Badges de zone de l'onglet Possessions (lot « corps-index », #492) : PA cumulé des 6 Localisations
 *  RÉELLES (`hero.armour`, couches rigide+Flexible+mutations déjà cumulées) — `sang` si une pièce
 *  portée à cette zone est ENTAMÉE (`damageTaken > 0`), `or` si PA > 0, `dim` sinon (vide). */
function possessionsZoneBadges(hero: Combatant): ZoneBadgeSpec[] {
  return LOCALISATIONS_DE_COUP.map((loc) => {
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

export function CharacterSheet({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  // EN COMBAT, lire la copie de bataille (qui porte les effets actifs vivants — buffs, métamorphose,
  // dégâts…) plutôt que l'original du groupe ; hors combat, le groupe. → la fiche reflète l'état réel.
  const hero = useGame((s) => s.battle?.combatants.find((h) => h.id === heroId) ?? s.party.find((h) => h.id === heroId));
  const party = useGame((s) => s.party);
  const tab = useGame((s) => s.sheetTab) ?? 'competences';
  const setSheetTab = useGame((s) => s.setSheetTab);
  const setSheetScroll = useGame((s) => s.setSheetScroll);
  const setSheetAlarmsSeen = useGame((s) => s.setSheetAlarmsSeen);
  const ouvrirLeMedecin = useGame((s) => s.ouvrirLeMedecin);
  const battle = useGame((s) => s.battle);

  // Règle d'atterrissage (§3.2) : force l'onglet État seulement à la PREMIÈRE ouverture depuis une
  // alarme NOUVELLE (empreinte jamais vue pour ce héros) — jamais au switch de héros (deps VIDES :
  // ne capture que le héros du 1er rendu ; `heroId`/`sheetId` changent ensuite sans remonter la fiche,
  // cf. `CampaignView.tsx`/`PartyScreen.tsx` qui ne posent pas de `key`).
  useEffect(() => {
    if (!hero) return;
    const s = useGame.getState();
    if (atterritSurEtat(hero, s.sheetAlarmsSeen[hero.id], nomDIndividu(s))) setSheetTab('etat');
  }, []);

  // Enregistre l'empreinte VUE dès que l'onglet État est affiché (atterrissage forcé OU visite
  // manuelle) — les prochaines ouvertures sans alarme nouvelle laissent le dernier onglet consulté.
  useEffect(() => {
    if (!hero || tab !== 'etat') return;
    const fp = empreinteDeFiche(hero, nomDIndividu(useGame.getState()));
    if (useGame.getState().sheetAlarmsSeen[hero.id] !== fp) setSheetAlarmsSeen(hero.id, fp);
  }, [tab, hero?.id, setSheetAlarmsSeen]); // `hero` change lu via getState() (pas de re-render en boucle sur son objet muté)

  if (!hero) return null;

  // Bourse PERSONNELLE du héros (Lot 3 T-bourse #531) : affichée en permanence dans la
  // colonne d'identité (visible sur TOUS les onglets), pas seulement au canAfford des sorts.
  const bourse = bourseOf(hero);

  // Guérison hors-combat : un soigneur du groupe peut panser ce héros (sans avancer le temps, pour
  // stopper une hémorragie AVANT que l'horloge ne la fasse ticker — LDB 09-Compétences).
  const refusSoins = refusDeSoins({ battle, party }, hero.id);

  const tabs: SheetTab[] = ['competences', 'etat', 'possessions', ...(estLanceur(hero) ? ['magie' as const] : []), 'avancement', 'histoire'];

  // Gangrène du cadre (§6, #492) : l'or du bandeau/liseré se ternit progressivement de violet-noir
  // selon la Corruption — `none` (aucune) / `ronge` (sous le seuil) / `seuil` (seuil de Corruption
  // dépassé, LDB 80). `corruptionThresholdExceeded` = SOURCE UNIQUE du seuil (moteur, `engine/corruption.ts`).
  const corruption = hero.corruption ?? 0;
  const gangrene = corruption <= 0 ? undefined : corruptionThresholdExceeded(hero) ? 'seuil' : 'ronge';

  // Annotation par Caractéristique (base+talents vs effective — buffs/malus actifs) pour la table de
  // Compétences & Talents : composée par `HeroSheet` (`statAnnotations`, data-driven), calculée ICI
  // (l'appelant fournit ses propres classes/notes, jamais un branchement dans la primitive).
  const statAnnotations = annotationsDeCaracteristiques(hero, (k) => baseWithTalents(hero, k), { gain: 'de modificateurs actifs', perte: 'de modificateurs actifs' });

  return (
    <Planche
      nom={hero.label}
      kind="fiche-perso"
      gangrene={gangrene}
      onClose={onClose}
      tabs={
        <Tabs
          tabs={tabs.map((onglet) => ({ key: onglet, label: t(TAB_LABELS[onglet]) }))}
          active={tab}
          onChange={setSheetTab}
        />
      }
      // Un onglet reprend où on l'a laissé. Lecture SANS abonnement (`getState`) : `retenir` écrit
      // `sheetScroll` à chaque tick, s'y abonner re-rendrait toute la fiche pendant le défilement.
      memoire={{ cle: tab, lire: () => useGame.getState().sheetScroll[tab] ?? 0, retenir: (top) => setSheetScroll(tab, top) }}
      aside={(
        <>
          {/* #492 */}
          <div className="sheet-portrait">
            <CharFrame c={hero} variant="identity" size="xl" decoratif />
            <FigZoneBadges badges={tab === 'possessions' ? possessionsZoneBadges(hero) : tab === 'etat' ? etatZoneBadges(hero) : []} />
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
                  <CodexRef category="races" id={hero.species} label={libelleOuAbsence(findSpeciesById(hero.species), 'race', String(hero.species))}>{speciesSingular(hero.species)}</CodexRef>
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
          {/* Verdict du noyau (`refusDeSoins`), celui que rend `ouvrirLeMedecin` : refusé, le bouton dit pourquoi. */}
          <Row>
            <GatedAction
              id="sheet-soins"
              label={<><Icon id="journal/soin" size="sm" /> Soins</>}
              enabled={!refusSoins}
              {...raisonSi(refusSoins)}
              descOfferte="Soins du groupe (Tests de Guérison) — ouvre l'infirmerie sur ce héros"
              onClick={() => ouvrirLeMedecin(hero.id)}
              primary={false}
              btnClassName="small"
            />
          </Row>
        </>
      )}
    >
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
        // identité reste dans l'aside de la fiche, patron CreatorSummary.tsx) plutôt
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
    </Planche>
  );
}

/** Grimoire/livre de prières — incantation HORS COMBAT (couture D). Un héros lanceur cible self/allié.
 *  Les Projectiles magiques (offensifs) sont marqués « en combat » : ils exigent une cible ennemie. */
function SpellbookSection({ hero }: { hero: Combatant }) {
  const party = useGame((s) => s.party);
  // Pendant un combat, le lancement passe par la console : verdict du noyau (`refusDuLanceurDeFiche`).
  const battle = useGame((s) => s.battle);
  const refusLanceur = refusDuLanceurDeFiche({ battle });
  const incanterLeSort = useGame((s) => s.incanterLeSort);
  const focaliserLeSort = useGame((s) => s.focaliserLeSort);
  const dissiperLeSort = useGame((s) => s.dissiperLeSort);
  const acheterLaComposante = useGame((s) => s.acheterLaComposante);
  const retirerLaComposante = useGame((s) => s.retirerLaComposante);
  const [targetId, setTargetId] = useState(hero.id);
  const spells = (hero.spells ?? [])
    .map((x) => findSpellById(x)) // hero.spells = ids de sort (runtime)
    .filter((s): s is NonNullable<ReturnType<typeof findSpellById>> => !!s);
  // Lecture au grimoire (LDB 47 l.21, `VDM 12 l.646-647`). Le catalogue est ramené à sa forme
  // EFFECTIVE par `findSpellById` (variante réglée) et le NI de lecture vient de `effectiveSpellOf`
  // — le MÊME couple que la résolution (`incanterLeSort(…, true)`), jamais un facteur recopié ici.
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
          <Icon id="interface/balance" size="sm" /> <CodexRef category="characteristics" id="peche" label="Péché">Péché : {hero.sinPoints}</CodexRef>
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
          const support = spellSupportOf(sp);
          const refusDeLancer = refusLanceur ?? castBlockedBy(hero, castInfoIsPrayer(sp) ? 'priere' : 'langue');
          return (
            <div className="spell-row" key={sp.label} title={support !== 'mecanique' ? 'Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé (cf. docs/sorts-implementation.md).' : undefined}>
              <span className="spell-name">
                <CodexRef category="spells" id={sp.id} label={sp.label}>{sp.label}</CodexRef>
                {sp.cn != null ? ` · NI ${sp.cn}` : ''}
                {support === 'narratif' ? (<> <Icon id="navigation/regles-maison" size="sm" /></>) : support === 'partiel' ? (<> <Icon id="interface/partiel" size="sm" /></>) : ''}
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
                        label={<><Icon id="drapeau/focalisation" size="sm" /> Focaliser</>}
                        enabled={!(refusLanceur ?? castBlockedBy(hero, 'focalisation'))}
                        {...raisonSi(refusLanceur ?? castBlockedBy(hero, 'focalisation'))}
                        primary={false}
                        btnClassName="small"
                        onClick={() => focaliserLeSort(hero.id, sp.id)}
                      />
                      <CodexRef category="regles" id="focalisation-etendue" label="Test de Focalisation (étendu)" className="ab-codex-info"><Icon id="journal/information" size="sm" /></CodexRef>
                    </>
                  )}
                  <GatedAction
                    id={`sheet-cast-${hero.id}-${sp.id}`}
                    label={<><Icon id="navigation/des" size="sm" /> Lancer</>}
                    enabled={!refusDeLancer}
                    {...raisonSi(refusDeLancer)}
                    primary={false}
                    btnClassName="small"
                    onClick={() => incanterLeSort(hero.id, sp.id, targetId)}
                  />
                </Row>
              )}
            </div>
          );
        })}
        {grimoireSpells.map(({ sp, grimoireCn }) => (
          <div className="spell-row" key={`g-${sp.label}`} title="Lecture au grimoire : sort non mémorisé de votre Domaine — deux mains, au NI de lecture indiqué.">
            <span className="spell-name">
              <Icon id="navigation/compendium" size="sm" /> <CodexRef category="spells" id={sp.id} label={sp.label}>{sp.label}</CodexRef>
              {sp.cn != null && grimoireCn != null ? ` · NI ${sp.cn}→${grimoireCn}` : ''}
            </span>
            {isMagicMissile(sp) ? (
              <span className="muted">{' '}en combat</span>
            ) : (
              <Row className="spell-actions">
                <GatedAction
                  id={`sheet-cast-grimoire-${hero.id}-${sp.id}`}
                  label={<><Icon id="navigation/compendium" size="sm" /> Lancer (grimoire)</>}
                  enabled={!(refusLanceur ?? castBlockedBy(hero, castInfoIsPrayer(sp) ? 'priere' : 'langue'))}
                  {...raisonSi(refusLanceur ?? castBlockedBy(hero, castInfoIsPrayer(sp) ? 'priere' : 'langue'))}
                  primary={false}
                  btnClassName="small"
                  onClick={() => incanterLeSort(hero.id, sp.id, targetId, true)}
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
        if (!actorHasSkill(hero, { id: 'langue', spec: 'magick' })) return null;
        const dispellable = dispellableSpellsOn(party);
        if (!dispellable.length) return null;
        return (
          <div className="sc-block">
            <span className="mini-title">
              <Icon id="action/dissiper" size="sm" /> Dissipation — sorts permanents actifs
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
                      <button className="btn small" onClick={() => dissiperLeSort(hero.id, d.spellId, d.casterId)}>
                        <Icon id="action/dissiper" size="sm" /> Dissiper
                      </button>
                    </Row>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {rule('magie-composant') === true && (() => {
        // Composants d'incantation (LDB 46 l.107-113) : achetés PAR Sort d'Arcane/Domaine connu,
        // coût = NI pistoles d'argent ; absorbent le contrecoup (Imparfaite Majeure→Mineure,
        // Mineure→annulée) puis sont consumés à l'incantation. Visible seulement règle ON.
        const arcane = composantsOfferts(hero);
        if (!arcane.length) return null;
        const owned = hero.componentSpells ?? [];
        const countOf = (id: string) => owned.filter((x) => x === id).length;
        return (
          <div className="spell-components">
            <span className="mini-title">
              <Icon id="magie/composante" size="sm" /> Composants d'incantation
            </span>
            <div className="spell-list">
              {arcane.map((sp) => {
                const n = countOf(sp.id);
                const cost = coutDuComposant(sp);
                const refusAchat = refusAchatDeComposant(hero, sp.id);
                return (
                  <div className="spell-row" key={`comp-${sp.id}`}>
                    <span className="spell-name">
                      <CodexRef category="spells" id={sp.id} label={sp.label}>{sp.label}</CodexRef>
                      {n > 0 ? <span className="muted"> · ×{n}</span> : null}
                    </span>
                    <Row className="spell-actions">
                      {n > 0 && (
                        <button className="btn small" title="Jeter un composant (pas de remboursement)" onClick={() => retirerLaComposante(hero.id, sp.id)}>
                          −
                        </button>
                      )}
                      <GatedAction
                        id={`spell-comp-buy-${sp.id}`}
                        label={<>+ <Coins money={cost} /></>}
                        ariaLabel={`Acheter un composant pour ${sp.label}`}
                        enabled={!refusAchat}
                        {...raisonSi(refusAchat)}
                        onClick={() => acheterLaComposante(hero.id, sp.id)}
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
 *  Main principale ou secondaire du set ACTIF. Réutilise OptionChooser (seg). La pénalité affichée est
 *  `penaliteDeMainSecondaire`, l'éligibilité `refusEmplacementDeMain`. Cliquer l'option déjà active la
 *  retire. LDB 14 l.78, l.138 */
function HandPicker({ hero, it, mains }: { hero: Combatant; it: ItemInstance; mains: NonNullable<GestesDeLObjet['mains']> }) {
  const garnirLaPanoplie = useGame((s) => s.garnirLaPanoplie);
  const { set: loId, main: { tenue: isMain, refus: refusMain }, secondaire: { tenue: isOff, refus: refusOff } } = mains;
  const malus = avecSigne(penaliteDeMainSecondaire(hero));
  return (
    <div className="ir-hand" title="Régler la main qui tient cette arme (set actif)">
    <OptionChooser
      layout="seg"
      options={[
        {
          key: 'main',
          label: 'Principale',
          selected: isMain,
          title: refusMain ? undefined : 'Tenir dans la main principale',
          refus: refusMain ?? undefined,
          onSelect: () => garnirLaPanoplie(hero.id, loId, 'main', isMain ? null : it.uid),
        },
        {
          key: 'secondaire',
          label: <>2nde <em className="off-malus">{malus}</em></>,
          selected: isOff,
          // La RAISON du refus se lit au survol/focus/tap dans l'infobulle partagée (`refus`), jamais
          // par un `disabled` muet ; le `title` ne reste que pour l'option OFFERTE.
          title: refusOff ? undefined : `Main secondaire : ${malus} aux attaques de cette main`,
          refus: refusOff ?? undefined,
          onSelect: () => garnirLaPanoplie(hero.id, loId, 'secondaire', isOff ? null : it.uid),
        },
      ]}
    />
    </div>
  );
}

/** #2948 */
function ApparencePicker({ it }: { it: ItemInstance }) {
  useVersionDesDatasets();
  const narratif = useGame((s) => s.campaignNarratif);
  const resolveTrapping = objetDuNarratif(narratif);
  const poserLApparence = useGame((s) => s.poserLApparence);
  const choices = apparencesAdmissiblesDObjet(it, resolveTrapping);
  if (choices.length < 2) return null;
  return (
    <div className="ir-form" title="Apparence">
      <MediaSelect
        value={apparencesCandidates(it)[0]}
        title="Apparence"
        options={choices.map((a) => {
          const apercu = { ...it };
          choisirApparenceDObjet(apercu, a.id, resolveTrapping);
          return { key: a.id, media: <ItemIcon item={apercu} size="sm" />, label: a.label };
        })}
        onSelect={(id) => poserLApparence(it.uid, id)}
      />
    </div>
  );
}

function FicheBody({ hero, section }: { hero: Combatant; section: 'possessions' }) {
  const utiliserLObjet = useGame((s) => s.utiliserLObjet);
  const evaluerLObjet = useGame((s) => s.evaluerLObjet);
  const items = hero.items ?? [];

  return (
    <>
      {section === 'possessions' && <EquipmentPanel hero={hero} />}

      {section === 'possessions' && <PossessionsRegistry hero={hero} />}

      {section === 'possessions' && (
        <CarrierInventory
          carrierId={hero.id}
          items={items}
          force={forceDuPorteur(hero)}
          weaponHighlighted={(it) => isWeaponActive(hero, it.uid)}
          weaponHandLabel={(it) => {
            // E1 : état « en main » SANS jargon « set » (les sets = fonction avancée, cf. onglet Combat) —
            // on NOMME l'arme du set ACTIF Main principale / secondaire ; les autres armes n'affichent rien.
            const activeLo = (hero.loadouts ?? []).find((l) => l.id === hero.activeLoadoutId) ?? hero.loadouts?.[0];
            return activeLo?.main === it.uid ? 'Main principale' : activeLo?.secondaire === it.uid ? 'Main secondaire' : null;
          }}
          rowExtra={(it, gestes) => (
              <>
                {gestes.evaluer && (
                  <GatedAction
                    id={`sheet-eval-${it.uid}`}
                    label="Évaluer"
                    enabled={!gestes.evaluer.refus}
                    {...raisonSi(gestes.evaluer.refus)}
                    descOfferte="Évaluation (Int) : révèle les qualités cachées et estime le prix — un échec verrouille jusqu'à demain"
                    onClick={() => evaluerLObjet(it.uid)}
                    primary={false}
                    btnClassName="small"
                  />
                )}
                {gestes.detecter && (
                  <GatedAction
                    id={`sheet-detect-${it.uid}`}
                    label="Détecter"
                    enabled={!gestes.detecter.refus}
                    {...raisonSi(gestes.detecter.refus)}
                    descOfferte="Détection d'artefact (Intuition, au toucher) : sentir l'aura magique — une seule tentative par objet"
                    onClick={() => evaluerLObjet(it.uid, 'detection')}
                    primary={false}
                    btnClassName="small"
                  />
                )}
                <ApparencePicker it={it} />
                {gestes.mains && <HandPicker hero={hero} it={it} mains={gestes.mains} />}
                {gestes.utiliser && (
                  <GatedAction
                    id={`sheet-use-${it.uid}`}
                    label="Utiliser"
                    enabled={!gestes.utiliser.refus}
                    {...raisonSi(gestes.utiliser.refus)}
                    onClick={() => utiliserLObjet(it.uid)}
                    primary={false}
                    btnClassName="small"
                  />
                )}
              </>
          )}
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
  refusSansChoix,
  onPick,
}: {
  entry: string;
  /** `cost` : coût propre de l'option (sinon `acquireCost`) ; `maxReached` : affichage ; `refus` : refus de
   *  l'ACQUISITION rendu par la vue du noyau — la désignation d'une option possédée n'est pas une dépense. */
  options: { key: string; display?: string; owned: boolean; hint?: string; cost?: number; maxReached?: boolean; refus: string | null }[];
  acquireCost: number;
  /** Refus de toute dépense tant qu'aucune option n'est choisie (`AdvancementView.refus`). */
  refusSansChoix: string | null;
  onPick: (key: string, owned: boolean) => void;
}) {
  const [choice, setChoice] = useState('');
  const opt = options.find((o) => o.key === choice);
  const optCost = opt?.cost ?? acquireCost;
  const refus = !opt ? refusSansChoix : opt.owned ? null : opt.refus;
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
            {o.maxReached ? ' (Maxi atteint)' : ''}
          </option>
        ))}
      </select>
      <GatedAction
        id={`adv-slot-${entry}`}
        primary={false}
        btnClassName="small"
        enabled={!!opt && !refus}
        {...raisonSi(refus)}
        onClick={() => opt && onPick(opt.key, opt.owned)}
        label={opt?.owned ? 'Désigner · 0 PX' : `Acquérir · ${optCost} PX`}
      />
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
  const acheterLaCaracteristique = useGame((s) => s.acheterLaCaracteristique);
  const acheterLaCompetence = useGame((s) => s.acheterLaCompetence);
  const acheterLeTalent = useGame((s) => s.acheterLeTalent);
  const designerLeCreneau = useGame((s) => s.designerLeCreneau);
  const acheterLeSort = useGame((s) => s.acheterLeSort);
  const changerDeCarriere = useGame((s) => s.changerDeCarriere);
  const entrainerLaProthese = useGame((s) => s.entrainerLaProthese);
  const [target, setTarget] = useState('');
  const battle = useGame((s) => s.battle);
  const flags = useGame((s) => s.flags);

  // Verdicts du noyau (`buildAdvancementView`) : chaque Caractéristique, Compétence, Talent (emplacements
  // compris) et cible de Carrière porte le refus que son geste rend ; sorts et prothèses lisent `refusPx`
  // (combat, PX).
  const v = buildAdvancementView({ battle, flags }, hero);
  const { refus, refusPx } = v;
  const refusChangement = target ? v.refusChangementVers(target) : refus;
  const pill = (inC: boolean) => <span className={`career-pill ${inC ? 'in' : 'out'}`}>{inC ? 'carrière' : '×2'}</span>;

  return (
    <div className="adv-panel">
      {/* Total PX en tête, collant — toujours visible en scrollant les catégories.
          Pas de bouton « Octroyer +PX » : les PX viennent du JEU (Effet `giveXp`). */}
      <div className="adv-px-bar">
        <span>Points d'Expérience disponibles</span>
        <b>{v.xp}</b>
      </div>
      {refus && <p className="muted" role="status">{refus}</p>}

      <AdvSection title="Caractéristiques" count={v.chars.length}>
      <div className="adv-grid">
        {v.chars.map((c) => (
          <div className="adv-row" key={c.key}>
            <span className="adv-name">
              <CharValue charKey={c.key} value={c.value} size="sm" /> {pill(c.inCareer)}
            </span>
            <span className="adv-meta">×{c.advances}</span>
            <GatedAction
              id={`adv-car-${c.key}`} primary={false} btnClassName="small"
              enabled={!c.refus} {...raisonSi(c.refus)}
              onClick={() => acheterLaCaracteristique(hero.id, c.key)}
              label={`+1 · ${c.nextCost} PX`}
            />
          </div>
        ))}
      </div>
      </AdvSection>

      <AdvSection title="Compétences" count={v.skills.length + v.skillSlotsOpen.length}>
      <div className="adv-grid">
        {v.skills.map((s) => (
          <div className={`adv-row ${s.known ? '' : 'acquire'}`} key={`${s.skill.id}|${s.skill.spec ?? ''}`}>
            <span className="adv-name">
              {libelleAvecSpec(s.label, s.skill.spec)} <em>{skillBaseValue(hero, { skill: s.skill })}</em> {pill(s.inCareer)}
              {s.known ? '' : <span className="acquire-tag">à apprendre</span>}
            </span>
            <span className="adv-meta">+{s.advances}</span>
            <GatedAction
              id={`adv-comp-${s.skill.id}-${s.skill.spec ?? ''}`} primary={false} btnClassName="small"
              enabled={!s.refus} {...raisonSi(s.refus)}
              onClick={() => acheterLaCompetence(hero.id, s.skill)}
              label={`${s.known ? '+1' : 'Apprendre'} · ${s.nextCost} PX`}
            />
          </div>
        ))}
        {/* Emplacements de Compétence « (Au choix) » non désignés (LDB 09 l.38) */}
        {v.skillSlotsOpen.map((slot) => (
          <SlotChoiceRow
            key={slot.slotKey}
            entry={slot.entry}
            acquireCost={slot.nextCost}
            refusSansChoix={refus}
            options={slot.options.map((o) => ({
              key: refKey(slot.groupId, o.spec), // clé de câblage OPAQUE (id+spec), jamais affichée
              display: `${slot.group} (${o.display})`,
              owned: o.ownedAdvances > 0,
              hint: o.ownedAdvances > 0 ? `+${o.ownedAdvances}` : undefined,
              refus: o.refus,
            }))}
            onPick={(key, owned) => {
              const ref = parseRefKey(key);
              if (owned) designerLeCreneau(hero.id, slot.slotKey, ref);
              // Acheter la 1re Augmentation désigne l'emplacement (LDB 09 l.38).
              else acheterLaCompetence(hero.id, ref);
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
              <GatedAction
                id={`adv-talent-${t.slotKey}`} primary={false} btnClassName="small"
                enabled={!t.refus} {...raisonSi(t.refus)}
                onClick={() => acheterLeTalent(hero.id, { id: t.talentId!, spec: t.spec })}
                label={`${t.times > 0 ? '+1' : 'Acquérir'} · ${t.nextCost} PX`}
              />
            </div>
          ) : (
            <SlotChoiceRow
              key={t.slotKey}
              entry={t.entry}
              acquireCost={t.nextCost}
              refusSansChoix={refus}
              options={(t.options ?? []).map((o) => ({ key: o.refKey, display: o.display, owned: o.owned, cost: o.nextCost, maxReached: o.maxReached, refus: o.refus }))}
              onPick={(key, owned) => {
                const ref = parseRefKey(key);
                if (owned) designerLeCreneau(hero.id, t.slotKey, ref);
                else acheterLeTalent(hero.id, ref);
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
                const support = spellSupportOf(spell);
                return (
                <div className="adv-row acquire" key={spell.label} title={support !== 'mecanique' ? 'Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé.' : undefined}>
                  <span className="adv-name">
                    <CodexRef category="spells" id={spell.id} label={spell.label}>{spell.label}</CodexRef>{support === 'narratif' ? (<> <Icon id="navigation/regles-maison" size="sm" /></>) : support === 'partiel' ? (<> <Icon id="interface/partiel" size="sm" /></>) : ''}
                    <span className="muted"> · {spell.ecole}{spell.subType ? ` (${spell.subType})` : ''}{spell.cn != null ? ` · NI ${spell.cn}` : ''}</span>
                  </span>
                  <span className="adv-meta" />
                  <GatedAction
                    id={`adv-sort-${spell.id}`} primary={false} btnClassName="small"
                    enabled={!refusPx(cost)} {...raisonSi(refusPx(cost))}
                    onClick={() => acheterLeSort(hero.id, spell.id)}
                    label={`${cost > 0 ? `Mémoriser · ${cost} PX` : 'Inclus au Talent'}${spell.family === 'chaos' ? ' · +1 Corruption' : ''}`}
                  />
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
            onBuy: () => entrainerLaProthese(it.uid),
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
                  <GatedAction
                    id={`adv-prothese-${r.key}`} primary={false} btnClassName="small"
                    enabled={!refusPx(r.cost)} {...raisonSi(refusPx(r.cost))}
                    onClick={r.onBuy}
                    label={`Entraîner · ${r.cost} PX`}
                  />
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
            enabled={!t.refus}
            {...raisonSi(t.refus)}
            onClick={() => changerDeCarriere(hero.id, t.career, t.level)}
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
                  {c.label} ({libelleDeClasse(c.class.id)}) · {v.changeCostFor(c.id)} PX
                </option>
              ))}
          </select>
          <GatedAction
            id="adv-changer-carriere" primary={false} btnClassName="small"
            enabled={!!target && !refusChangement}
            {...raisonSi(refusChangement)}
            onClick={() => {
              if (target) changerDeCarriere(hero.id, target, 1);
              setTarget('');
            }}
            label={`Changer${target ? ` · ${v.changeCostFor(target)} PX` : ''}`}
          />
        </div>
      </div>
      </AdvSection>
    </div>
  );
}
