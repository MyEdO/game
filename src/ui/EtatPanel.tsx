/**
 * Onglet ÉTAT — TABLEAU DE BORD toujours utile (arbitrage user 2026-07-17). L'en-tête de CAPACITÉ est
 * TOUJOURS visible, même héros sain : la bande UNIQUE `ReservesSeuilsBand` empile RÉSERVES (Chance,
 * Détermination — tone ressource) puis SEUILS avant inaptitude (Critiques actives, Mutations
 * physiques, Mutations mentales, Corruption) + indicateur DAMNÉ.
 * Les États actifs sont des CHIPS codex-liées compactes (`.chip` + `CodexRef`, s'enroulent) juste sous
 * la bande Réserves & seuils. Les AFFLICTIONS lourdes (Blessures critiques, Séquelles, Maladies, Mutations,
 * Psychologie, Surcharge, Effets) restent conditionnelles à leur présence, en `PlaqueRow` (nom
 * `CodexRef` — survol = aperçu popover, CLIC = ouverture de la fiche Codex ; la `PlaqueRow` hôte reste
 * NON cliquable pour ne pas nicher deux actions —, chips d'effet net en `fx` SOUS le nom via
 * `GameOpChips`, valeur DISCRÈTE — `sheet.css`) ; AUCUNE prose inline. Bandes de section
 * ancrées (`ETAT_ANCHOR_*`, `sheetAlarms.ts`) — une bande SANS contenu N'EXISTE PAS. Grammaire de
 * carte (liseré de gravité `data-tone`, icône, sous-ligne petites capitales) affinée au lot #492
 * « chevet » — les tokens/primitives existants restent l'autorité.
 *
 * La bande de zones EN TÊTE du registre (`ZoneBand`, pt.4) est MORTE (lot « corps-index », arbitrage
 * user 2026-07-17) — doublon d'index : le CORPS de la colonne (`FigTile.zoneBadges`, composé par
 * `CharacterSheet.tsx`) porte ce résumé par Localisation. `zoneAfflictions`/`zoneAnchor`/
 * `ZONE_ORDER` restent exportés d'ICI (source unique du calcul) et alimentent ce badge ; l'ancre de
 * la PREMIÈRE rangée Critiques/Séquelles par Localisation (posée dans le registre, `zoneAnchorFor`)
 * reste la cible de clic du badge. Liserés de gravité (sang/ambre/violet, pt.5) posés en attribut
 * `data-tone` sur la bande de section (`Section`) — jamais une classe par ton.
 */
import type { ReactNode } from 'react';
import { garanti } from '../state/combatants';
import type { Combatant, HitLocation } from '../engine/types';
import { roundsLabel, clockLabel, type Duration } from '../engine/duration';
import { locationLabel } from '../engine/combat';
import { bonus, effectiveChar } from '../engine/characteristics';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { encumbrancePenalties } from '../engine/encumbrance';
import { findCritEntrySuffered, critEntryCodexCategory, type CritTableKey } from '../engine/critical';
import { corruptionThreshold } from '../engine/corruption';
import { formatRemaining } from '../engine/disease';
import { CHAR_LABELS, type ConditionInstance } from '../engine/types';
import { chipNom, summarizeEffects } from '../gameIso/effectIcons';
import { fortuneMax, resolveMax } from '../engine/talentEffects';
import { diseaseLabel, findPsychologyById, symptomLabel, symptomInstanceLabel, mutationLabel } from '../data';
import { datasetArray } from '../data/overrides';
import { isPsychAfflictionActive, ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT } from './sheetAlarms';
import { useGame } from '../state/store';
import { CodexRef } from './compendium/CodexRef';
import { EntityRef } from './EntityChip';
import { GameOpChips } from './GameOpChips';
import { NotchGauge, type GaugeTone } from './NotchGauge';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { PlaqueRow } from './PlaqueRow';
import { Band } from './Band';

/** Icône de repli quand aucune icône du registre ne porte la famille (jamais d'emoji), à l'égal de
 *  `sheetAlarms.ts`. */
const FALLBACK_ICON: IconIdInput = 'ui/warning';

/** Taille FIXE d'un cran (px) des jauges à PEU de crans du registre (Seuils, Corruption) — `NotchGauge`
 *  `cellSize`, voir sa doc pour la justification du mode fixe. */
const GAUGE_CELL_PX = 16;

/** Tonalité de gravité d'une bande (pt.5, #492) : sang = critiques/états, ambre = séquelles/maladies,
 *  violet = corruption/mutations — posée en attribut, jamais en classe par ton. */
type GravityTone = 'sang' | 'ambre' | 'violet';

/** Bande de section ancrée : titre + compte en badge sobre (`Band`, primitive partagée). L'appelant
 *  filtre déjà les rubriques vides — une bande SANS contenu n'apparaît jamais dans l'arbre. Les
 *  compteurs de SEUILS (Critiques actives/Mutations vs BE/BFM, Corruption) vivent dans `ReservesSeuilsBand`,
 *  la synthèse en tête de registre (arbitrage user 2026-07-17). */
function Section({
  anchor,
  title,
  count,
  tone,
  children,
  codexCategory,
}: {
  anchor: string;
  title: string;
  count?: number;
  tone?: GravityTone;
  children: ReactNode;
  /** Catégorie Compendium de la bande (arbitrage user 2026-07-17, LOT L pt.2) — le titre devient
   *  cliquable, ouvre le Codex sur SA catégorie (la LISTE : ces bandes sont des COLLECTIONS
   *  d'entrées). Omis pour les bandes SANS catégorie unique (Effets en cours : mélange hétérogène
   *  Trait/Talent/enchantement — cf. commentaire du call-site). */
  codexCategory?: string;
}) {
  const openCodex = useGame((s) => s.openCodex);
  return (
    <div id={anchor} data-tone={tone}>
      <Band
        title={title}
        right={count != null ? <b>{count}</b> : undefined}
        onTitleClick={codexCategory ? () => openCodex({ category: codexCategory, id: '' }) : undefined}
        titleAriaLabel={codexCategory ? 'Ouvrir cette catégorie au Codex' : undefined}
      >
        {children}
      </Band>
    </div>
  );
}

/** Ton d'un compteur de SEUIL (pt.4, #492) : `neutral` loin du seuil, `warn` à seuil−1,
 *  `danger` au seuil ATTEINT ou FRANCHI — vocabulaire `GaugeTone` de `NotchGauge` (pas de couleur
 *  littérale, pas de 4e famille de ton parallèle). */
function seuilTone(value: number, limit: number): GaugeTone {
  return value >= limit ? 'danger' : value === limit - 1 ? 'warn' : 'neutral';
}

/** Bande « Réserves & seuils » (titre AFFICHÉ, arbitrage user 2026-07-18 — « Constitution c'est
 *  moche ») — en-tête de capacité UNIQUE du tableau de bord (fusion Réserves + Seuils,
 *  directive user 2026-07-17), en GRILLE 2 colonnes (`.reserves-seuils-grid`, → 1 colonne ≤700px).
 *  Réserves en 2×2 : Destin et Résilience = l'Indice PERMANENT (valeur simple affichée telle quelle),
 *  Chance et Détermination = la réserve courante (`NotchGauge` tone `resource`, plafond RÉEL
 *  `fortuneMax`/`resolveMax` = Indice + talents/effets — Chanceux/Obstiné compris, JAMAIS l'Indice
 *  seul). Puis les 4 seuils avant inaptitude, 2 par ligne (Critiques actives ≤ BE, Mutations physiques
 *  ≤ BE, Mutations mentales ≤ BFM, Corruption vers son seuil). Réf réserves : `LDB 17 l.4-9`,
 *  `LDB 17 l.12-17`, `LDB 17 l.21-25`. Bloc réserves masqué si Destin ET Résilience valent 0
 *  (`LDB 05 l.366-367`). DAMNÉ (`LDB 19 l.87`) : indicateur du slot droit. Aucune réf livre à l'écran. */
function ReservesSeuilsBand({ hero, activeCriticals, be, physMutations, mentMutations, bfm, corruption, corruptionMax }: { hero: Combatant; activeCriticals: number; be: number; physMutations: number; mentMutations: number; bfm: number; corruption: number; corruptionMax: number }) {
  const fate = hero.fate ?? 0;
  const resilience = hero.resilience ?? 0;
  const showReserves = fate > 0 || resilience > 0;
  const fMax = fortuneMax(hero);
  const rMax = resolveMax(hero);
  return (
    <Band title="Réserves & seuils" right={hero.damned ? <span className="chip tone-danger">DAMNÉ</span> : undefined}>
      <div className="reserves-seuils-grid">
        <div className="notch-gauge-stack">
          {showReserves && (
            <>
              <div className="sheet-idrow"><span className="sheet-idrow-label">Destin</span><span className="sheet-idrow-value">{fate}</span></div>
              <NotchGauge label="Chance" value={hero.fortune ?? 0} max={fMax} notches={fMax} tone="resource" cellSize={GAUGE_CELL_PX} />
            </>
          )}
          <NotchGauge label="Critiques actives" value={activeCriticals} max={be} notches={be} tone={seuilTone(activeCriticals, be)} cellSize={GAUGE_CELL_PX} />
          <NotchGauge label="Mutations physiques" value={physMutations} max={be} notches={be} tone={seuilTone(physMutations, be)} cellSize={GAUGE_CELL_PX} />
        </div>
        <div className="notch-gauge-stack">
          {showReserves && (
            <>
              <div className="sheet-idrow"><span className="sheet-idrow-label">Résilience</span><span className="sheet-idrow-value">{resilience}</span></div>
              <NotchGauge label="Détermination" value={hero.resolve ?? 0} max={rMax} notches={rMax} tone="resource" cellSize={GAUGE_CELL_PX} />
            </>
          )}
          <NotchGauge label="Corruption" value={corruption} max={corruptionMax} notches={corruptionMax} tone="corruption" cellSize={GAUGE_CELL_PX} />
          <NotchGauge label="Mutations mentales" value={mentMutations} max={bfm} notches={bfm} tone={seuilTone(mentMutations, bfm)} cellSize={GAUGE_CELL_PX} />
        </div>
      </div>
    </Band>
  );
}

/** Localisation d'un critique suffered (les tables RAW ne distinguent pas le côté — repli G, comme
 *  la ligne de détail existante du registre). */
function critLocation(table: CritTableKey): HitLocation {
  return table === 'bras' ? 'brasG' : table === 'jambe' ? 'jambeG' : table;
}

/** Ordre canonique des 6 Localisations (`HitLocation`, `engine/types.ts`) — tête → bras → corps →
 *  jambes. Exporté : source unique de l'ordre, réutilisé par `CharacterSheet.tsx` (badges de la
 *  colonne). */
export const ZONE_ORDER: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

/** Ancre de la PREMIÈRE rangée Critiques/Séquelles d'une Localisation dans le registre — cible de
 *  clic du badge de zone de la colonne (`FigTile.zoneBadges`, `CharacterSheet.tsx`). */
export function zoneAnchor(loc: HitLocation): string {
  return `etat-zone-${loc}`;
}

/** Critiques subis, dédupliqués/comptés (source unique — alimente le registre ET `zoneAfflictions`). */
function criticalEntriesOf(hero: Combatant) {
  const critIds = hero.critEntriesSuffered ?? [];
  const critCounts = new Map<string, number>();
  for (const id of critIds) critCounts.set(id, (critCounts.get(id) ?? 0) + 1);
  return [...critCounts.entries()]
    .map(([id, count]) => {
      const found = findCritEntrySuffered(id);
      return found ? { id, count, ...found } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

/** Localisations TOUCHÉES (pt.4, #492) — ≥1 critique ou séquelle, comptées par famille. Alimente le
 *  badge de zone de la colonne (`FigTile.zoneBadges`) : une zone intacte n'est jamais retournée. */
export function zoneAfflictions(hero: Combatant): { loc: HitLocation; crit: number; trauma: number }[] {
  const critByLoc = new Map<HitLocation, number>();
  for (const c of criticalEntriesOf(hero)) critByLoc.set(critLocation(c.table), (critByLoc.get(critLocation(c.table)) ?? 0) + c.count);
  const traumaByLoc = new Map<HitLocation, number>();
  for (const t of hero.traumas ?? []) traumaByLoc.set(t.location, (traumaByLoc.get(t.location) ?? 0) + (t.count ?? 1));
  return ZONE_ORDER.filter((l) => (critByLoc.get(l) ?? 0) > 0 || (traumaByLoc.get(l) ?? 0) > 0).map((loc) => ({
    loc,
    crit: critByLoc.get(loc) ?? 0,
    trauma: traumaByLoc.get(loc) ?? 0,
  }));
}

/** Durée compacte d'un effet actif/contrecoup, pour la valeur de sa `PlaqueRow`. Une échéance
 *  d'HORLOGE se dit en TEMPS RESTANT (`clockLabel`, même vocabulaire unique que `roundsLabel` pour
 *  l'échelle tactique) : « durée » ne disait ni combien ni de quoi. */
function effectDuration(e: { duration?: Duration; roundsLeft?: number; untilTime?: number }, now: number): string {
  const horloge = (until: number): string => { const l = clockLabel(until - now); return l ? ` · ${l}` : ''; };
  if (e.duration) return e.duration.scale === 'rounds' ? ` · ${roundsLabel(e.duration.left)}` : e.duration.scale === 'clock' ? horloge(e.duration.until) : '';
  return e.roundsLeft != null ? ` · ${roundsLabel(e.roundsLeft)}` : e.untilTime != null ? horloge(e.untilTime) : '';
}

/** Valeur de la `PlaqueRow` d'un État actif : cumul de pions (`ConditionInstance.value`, ex. 10
 *  Hémorragique) + durée d'instance temporisée (`roundsLeft`/`untilTime` — État posé par un Sort,
 *  ex. Sonné « N Rounds ») — MÊME vocabulaire que `effectDuration` (`roundsLabel` / `clockLabel`), sans
 *  quoi ces données d'instance restent invisibles hors popover Codex (qui ne porte que la règle
 *  générique, pas l'état vécu du Personnage). `undefined` si l'instance est nue (1 pion, permanente). */
function conditionValue(cond: ConditionInstance, now: number): string | undefined {
  const parts: string[] = [];
  if (cond.value > 1) parts.push(`×${cond.value}`);
  if (cond.roundsLeft != null) parts.push(roundsLabel(cond.roundsLeft));
  else if (cond.untilTime != null) { const l = clockLabel(cond.untilTime - now); if (l) parts.push(l); }
  return parts.length ? parts.join(' · ') : undefined;
}

export function EtatPanel({ hero }: { hero: Combatant }) {
  const criticalEntries = criticalEntriesOf(hero);
  // Horloge de campagne : une échéance `clock` est ABSOLUE — le RESTE se lit contre l'heure courante.
  const gameTime = useGame((s) => s.gameTime);

  // Compteurs de SEUILS (pt.4, #492) : ACTIF (décompté au soin) — pas l'historique `critEntriesSuffered`
  // (`sheetAlarms.ts` porte déjà ce distinguo pour la bande d'alarmes). Mort si actives > BE quand
  // Inconscient + 0 PB (`inDeathCondition`, engine/conditions.ts:595-605, LDB 18 l.34).
  const activeCriticals = hero.criticalWounds ?? 0;
  const be = bonus(effectiveChar(hero, 'endurance'));
  // Damné si mutations physiques > BE OU mentales > BFM (`mutationLimitExceeded`,
  // engine/corruption.ts:139-142, LDB 19 l.87) — mêmes filtres par `kind` ici.
  const bfm = bonus(effectiveChar(hero, 'force-mentale'));
  const physMutations = (hero.mutations ?? []).filter((m) => m.kind === 'physique').length;
  const mentMutations = (hero.mutations ?? []).filter((m) => m.kind === 'mentale').length;

  const conditions = hero.conditions ?? [];
  const corruption = hero.corruption ?? 0;
  const corruptionMax = Math.max(corruptionThreshold(hero), corruption);
  const diseases = hero.diseases ?? [];
  const mutations = hero.mutations ?? [];
  const traumas = hero.traumas ?? [];
  const activePsych = (hero.psychState ?? []).filter(isPsychAfflictionActive);
  const overEnc = totalEncumbrance(hero) > maxEncumbrance(hero);
  // Palier de Surcharge (0 sans signal ici, puisque `overEnc` filtre déjà) — l'id/label CODEX (#422)
  // vit dans `encumbranceTiers.json`, résolu par `tier` (le moteur n'expose que la valeur numérique).
  const encTier = overEnc ? garanti(datasetArray('encumbranceTiers').find((t) => t.tier === encumbrancePenalties(hero).tier), encumbrancePenalties(hero).tier, 'palier d’encombrement') : undefined;

  // Ancre la PREMIÈRE rangée Critiques/Séquelles de chaque Localisation (une seule fois, dans l'ordre
  // de rendu du registre) — cible de clic du badge de zone de la colonne (`FigTile.zoneBadges`, pt.4).
  // Pas de coût CSS : un `id`, pas de classe.
  const seenZoneAnchor = new Set<HitLocation>();
  const zoneAnchorFor = (loc: HitLocation): string | undefined => {
    if (seenZoneAnchor.has(loc)) return undefined;
    seenZoneAnchor.add(loc);
    return zoneAnchor(loc);
  };

  return (
    <div className="sheet-etat">
      <ReservesSeuilsBand hero={hero} activeCriticals={activeCriticals} be={be} physMutations={physMutations} mentMutations={mentMutations} bfm={bfm} corruption={corruption} corruptionMax={corruptionMax} />

      {(conditions.length > 0 || (hero.activeEffects?.length ?? 0) > 0 || (hero.castPenalties?.length ?? 0) > 0) && (() => {
        // « Effets actifs » (retour recette 2026-07-17) : États/malus ET buffs de sorts sont des effets
        // actifs de MÊME nature → une seule section de chips codex-liées (`.etat-chips`). Source unique
        // de « ce qui est actif » : `summarizeEffects(conditions, activeEffects)` (la fonction des
        // portraits/`EffectChips`), SANS les états-drapeaux psy (leur section Psychologie les porte).
        // Ordre : malus (par gravité) puis buffs ; les contrecoups d'incantation ferment la liste.
        const active = summarizeEffects(conditions, hero.activeEffects ?? []).visible;
        const castPen = hero.castPenalties ?? [];
        const buffs = hero.activeEffects ?? [];
        const condByName = new Map(conditions.map((c) => [c.id, c]));
        let buffIdx = 0;
        return (
          <Section anchor="etat-etats" title="Effets actifs" count={active.length + castPen.length} tone="sang">
            <div className="etat-chips">
              {active.map((chip) => {
                if (chip.kind === 'malus') {
                  const cond = chip.condId ? condByName.get(chip.condId) : undefined;
                  const clock = cond ? conditionValue(cond, gameTime) : undefined;
                  return (
                    // Le NOM de la chip est celui du rack du portrait (`chipNom`) : il dit l'État ET
                    // l'entité qui le porte quand il est dérivé (`derivedFrom.src`), là où le texte
                    // visible garde le seul libellé de l'État.
                    <CodexRef key={chip.key} category="etats" id={chip.condId} label={chip.label} ariaLabel={chipNom(chip)} className="chip">
                      <Icon id={chip.icon as IconIdInput} size="sm" />
                      {chip.label}
                      {clock ? <em className="entity-badge">{clock}</em> : null}
                    </CodexRef>
                  );
                }
                // Buff de sort : chip VERTE (`.tone-ok`, même famille que `.tone-warn`/`.tone-danger`,
                // `components.css`), liée à SON sort source si résolvable (`sourceSpellId` -> Codex
                // Sorts) ; hors catalogue, le MÊME popover par le `fallback` de CodexRef.
                const eff = buffs[buffIdx++];
                const meta: string[] = [];
                if (chip.char != null) meta.push(`${(chip.bonus ?? 0) >= 0 ? '+' : ''}${chip.bonus ?? 0} ${CHAR_LABELS[chip.char]}`);
                const dur = eff ? effectDuration(eff, gameTime).replace(/^ · /, '') : '';
                if (dur) meta.push(dur);
                const metaNode = meta.length ? <em className="entity-badge">{meta.join(' · ')}</em> : null;
                return (
                  <CodexRef
                    key={chip.key}
                    category="spells"
                    id={eff?.sourceSpellId}
                    label={chip.label}
                    fallback={{ body: meta.join(' · ') || undefined }}
                    className="chip tone-ok"
                  >
                    <Icon id={chip.icon as IconIdInput} size="sm" />
                    {chip.label}
                    {metaNode}
                  </CodexRef>
                );
              })}
              {castPen.map((p, i) => {
                const val = p.blocked ? 'Incantation bloquée' : p.maxZeroDR ? 'Prière plafonnée à 0 DR' : p.mod != null ? `${p.mod}` : '';
                const dur = effectDuration(p, gameTime).replace(/^ · /, '');
                const parts = [val, dur].filter(Boolean).join(' · ');
                return (
                  <CodexRef
                    key={`cp${i}`}
                    category="spells"
                    label={p.label}
                    fallback={{ body: parts || undefined }}
                    className="chip tone-warn"
                  >
                    <Icon id="ui/warning" size="sm" />
                    {p.label}
                    {parts ? <em className="entity-badge">{parts}</em> : null}
                  </CodexRef>
                );
              })}
            </div>
          </Section>
        );
      })()}

      {criticalEntries.length > 0 && (
        <Section
          anchor={ETAT_ANCHOR_CRITIQUES}
          title="Blessures critiques"
          tone="sang"
          count={criticalEntries.length}
          // Pas de catégorie UNIQUE (chaque ligne a la SIENNE, `critEntryCodexCategory` par
          // table×jeu — cf. `PlaqueRow` ci-dessous) : le titre de bande pointe vers la catégorie
          // de la PREMIÈRE entrée listée, la plus « juste » approximation d'un lien de groupe
          // (arbitrage LOT L pt.2 — aucune catégorie fédératrice n'existe au Compendium).
          codexCategory={critEntryCodexCategory(criticalEntries[0].table, criticalEntries[0].jeu)}
        >
          {criticalEntries.map((c) => {
            const row = (
              <PlaqueRow valueMuted
                key={c.id}
                prefix={<Icon id="medical/scalpel" size="sm" />}
                content={<CodexRef category={critEntryCodexCategory(c.table, c.jeu)} id={c.id} label={c.entry.label}>{c.entry.label}</CodexRef>}
                sub={locationLabel(critLocation(c.table), hero.bodyShape)}
                fx={(c.entry.ops?.length ?? 0) > 0 ? <GameOpChips ops={c.entry.ops!} /> : undefined}
                value={c.count > 1 ? `×${c.count}` : undefined}
              />
            );
            const anchorId = zoneAnchorFor(critLocation(c.table));
            return anchorId ? <div key={c.id} id={anchorId}>{row}</div> : row;
          })}
        </Section>
      )}

      {traumas.length > 0 && (
        <Section anchor={ETAT_ANCHOR_TRAUMAS} title="Séquelles" count={traumas.length} tone="ambre" codexCategory="traumas">
          {traumas.map((t, i) => {
            const row = (
              <PlaqueRow valueMuted
                key={i}
                prefix={<Icon id="medical/crutch" size="sm" />}
                content={<CodexRef category="traumas" id={t.traumaId} label={t.label}>{t.label}</CodexRef>}
                sub={t.location ? locationLabel(t.location, hero.bodyShape) : undefined}
                fx={(t.ops?.length ?? 0) > 0 ? <GameOpChips ops={t.ops!} /> : undefined}
                value={`${t.recoveryDays != null ? `${t.recoveryDays} j` : t.needsSurgery ? 'Chirurgie requise' : 'Permanent'}${t.count != null && t.count > 1 ? ` · ×${t.count}` : ''}`}
              />
            );
            const anchorId = zoneAnchorFor(t.location);
            return anchorId ? <div key={i} id={anchorId}>{row}</div> : row;
          })}
        </Section>
      )}

      {diseases.length > 0 && (
        <Section anchor={ETAT_ANCHOR_MALADIES} title="Maladies" count={diseases.length} tone="ambre" codexCategory="maladies">
          {diseases.map((d, i) => (
            <PlaqueRow valueMuted
              key={i}
              prefix={<Icon id="medical/infection" size="sm" />}
              content={<CodexRef category="maladies" id={d.id} label={diseaseLabel(d.id)}>{diseaseLabel(d.id)}</CodexRef>}
              fx={d.symptoms.length > 0 ? (
                <>
                  {d.symptoms.map((s, si) => (
                    <EntityRef key={si} category="symptoms" id={s.symptomId} label={symptomLabel(s.symptomId)} show={symptomInstanceLabel(s)} />
                  ))}
                </>
              ) : undefined}
              value={d.phase === 'incubation' ? `Incubation · ${formatRemaining(d.minutesLeft)}` : formatRemaining(d.minutesLeft)}
            />
          ))}
        </Section>
      )}

      {mutations.length > 0 && (
        <Section
          anchor={ETAT_ANCHOR_MUTATIONS}
          title="Mutations"
          count={mutations.length}
          tone="violet"
          codexCategory="mutations"
        >
          {mutations.map((m, i) => {
            const label = mutationLabel(m.id);
            return (
              <PlaqueRow valueMuted
                key={i}
                prefix={<Icon id="nav/mutation" size="sm" />}
                content={<CodexRef category="mutations" id={m.id} label={label}>{label}</CodexRef>}
                sub={m.kind === 'physique' ? 'Mutation physique' : 'Mutation mentale'}
                fx={(m.passive?.length ?? 0) > 0 ? <GameOpChips ops={m.passive!} /> : undefined}
              />
            );
          })}
        </Section>
      )}

      {activePsych.length > 0 && (
        <Section anchor={ETAT_ANCHOR_PSYCHOLOGIE} title="Psychologie" count={activePsych.length} codexCategory="psychologies">
          {activePsych.map((p, i) => {
            const def = findPsychologyById(p.type);
            return (
              <PlaqueRow valueMuted
                key={i}
                prefix={<Icon id={(def?.icon as IconIdInput | undefined) ?? FALLBACK_ICON} size="sm" />}
                content={<CodexRef category="psychologies" id={p.type} label={def?.label ?? p.type}>{def?.label ?? p.type}</CodexRef>}
                fx={def?.passive?.length ? <GameOpChips ops={def.passive} /> : undefined}
              />
            );
          })}
        </Section>
      )}

      {encTier && (
        <Section anchor={ETAT_ANCHOR_ENCOMBREMENT} title="Surcharge" codexCategory="encumbranceTiers">
          <PlaqueRow valueMuted
            prefix={<Icon id={FALLBACK_ICON} size="sm" />}
            // Palier RÉEL (`encumbrancePenalties`, LDB 61) — le moteur applique déjà ces paliers
            // (Mouvement/Agilité, `engine/encumbrance.ts`), la ligne ne peut pas en montrer moins.
            content={<CodexRef category="encumbranceTiers" id={encTier.id} label={encTier.label}>Surchargé</CodexRef>}
            value={`${encTier.label} · ${totalEncumbrance(hero)}/${maxEncumbrance(hero)}`}
          />
        </Section>
      )}

    </div>
  );
}
