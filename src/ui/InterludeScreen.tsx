import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { nomDuSiege } from '../noyau/sieges';
import { useGame } from '../state/store';
import { interludeEventDie, interludeEventFor } from '../data/interludeEvents';
import { formatDice } from '../engine/dice';
import { formatMoney, formuleDeRevenus, libelleDEchelon, fromBrass, toBrass, PA_PER_SC, type Money, type Status } from '../engine/money';
import { bourseOf } from '../engine/bourse';
import { actorStatus } from '../engine/social';
import { interludeCatalog, type InterludeState, type InterludeHeroState, type BankDeposit } from '../noyau/interludeFlow';
import {
  blocageDeRevenus, ciblesDActivite, desEnAttente, devisDeCloture, effetBloquantLesRevenus, effetsDeLaPeriode, devisDeDepot, interludeDrawPending, refusDAcquitterUneFaveur, refusDActivite,
  refusDArtisanat, refusDeCommande, refusDEntrainement, refusDeRetrait, refusDOuvertureDActivite, refusDuTirage, preJetDActivite,
  brouillonDe, refusDeLaValeur, type AxeDuBrouillon, type CompositionDActivite, type DevisDeDepot, type EtatDeCloture, type EtatDeDepot, type EtatDeFaveur, type EtatDInterlude, type PreJetDActivite,
} from '../noyau/verdictsDInterlude';
import { totalDesBourses } from '../noyau/bourseFlow';
import { refusDeLaValidationNommee } from '../noyau/validationDeFenetre';
import { refusDOuvrirLaTaverne } from '../noyau/tavernFlow';
import { favorRequiredActivities, type Favor } from '../engine/favor';
import { armyMight, noteDeSoutien, preJetDePreparation, refusDePrepaDeBataille, type MassBattleState } from '../noyau/massBattleFlow';
import {
  cleDEntrainement, craftCatalog, craftTarget, qualitesDArtisanat, learnableTalents, orderCatalog, bankPayout, seuilDePerteBancaire, entrainementOptions, entrainementTutorRange,
  activityById, testsDeLActivite,
  type ActivityDef, type ActivityResolver, type CraftOption, type GenreDeDepot, type LearnOption,
} from '../engine/activities';
import { nomDeSource } from '../engine/ops';
import { DIFFICULTY_LABELS, CHAR_LABELS } from '../engine/types';
import { describeQuality } from '../engine/qualities/describe';
import type { TestDesigne } from '../engine/skills';
import { findTalentById, skillInstanceLabel, findTrappingById, refLabel, activityStakeRef, hasActivityStake, libelleDeClasse, libelleOuAbsence } from '../data';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { favorLevelSchema } from '../data/schemas/defs-scenes/effets';
import { trappingCategorieSchema } from '../data/schemas/defs/trappings';
import type { Combatant, ConditionId } from '../engine/types';
import { rule } from '../engine/policy';
import { effectiveEntry } from '../engine/variants';
import { ownsLocalNet } from './ownership';
import { libelleDePsy } from '../engine/psych/ciblage';
import { ActiveModal } from './ActiveModal';
import { TavernGameModal } from './TavernGameModal';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { EffectChips } from './EffectChips';
import { EntityRef } from './EntityChip';
import { FxChip } from './FxChip';
import { ParchmentCard } from './ParchmentCard';
import { RuleDivider, OrnateFrame } from './Ornaments';
import { GameDate } from './GameDate';
import { Icon } from './Icon';
import { NumberField } from './NumberField';
import type { IconId } from '../data/icons';
import { type PendingRoll } from './RollLine';
import { testPending } from './breakdown';
import { cibleMesuree } from '../engine/tests';
import { mdToText } from './Prose';
import { ActivityPane, idBlocage } from './ActivityPane';
import type { Porteur } from '../noyau/codex/porteur';
import { SearchFilterField, useFilteredList } from './SearchFilterField';
import { MasterDetail } from './MasterDetail';
import { Tabs } from './composites/Tabs';
import { t } from '../i18n';
import { GatedAction, lieeA, raisonSi, type PropsDeRaison } from './GatedAction';

/** Repli NOMMÉ d'une Activité fermée. Jamais une chaîne VIDE : `GatedAction` ne tient `aria-disabled`
 *  que s'il a une raison à faire atteindre — sans texte il rendrait un `disabled` natif, donc un
 *  refus muet au clavier, à la manette et au doigt. */
const RAISON_ACTIVITE_FERMEE = 'Cette Activité n’est pas ouverte pour ce héros.';

/**
 * Raison d'un bouton de volet, dite UNE FOIS. Le volet qui affiche déjà sa bannière `blocked` porte la
 * raison STRUCTURANTE, en tête et non sous le nom du bouton (arbitrage user 2026-08-24) : l'action s'y
 * LIE par `reasonId`, sans bulle qui redirait le même texte au survol. Sans bannière, l'action porte
 * sa propre bulle. Même composition sur les onze volets.
 */
const refusDuVolet = (paneId: string, banniere: ReactNode, raison: string | undefined): PropsDeRaison =>
  (banniere ? { reasonId: idBlocage(paneId) } : { reason: raison ?? RAISON_ACTIVITE_FERMEE });

/** Libellé + desc d'une qualité d'artisanat par id (registre via `describeQuality`). */
const craftQual = (id: string) => describeQuality({ id }) ?? { label: id, desc: undefined };

/** Montant en TEXTE (attributs `title`, contenu d'`<option>` — HTML texte seul) ; tout AFFICHAGE
 *  passe par `<Coins>` (source visuelle unique des montants, LOT 5). */
const fmt = (brass: number) => formatMoney(fromBrass(brass));
/** Montant AFFICHÉ : le rendu coloré unique. */
const CoinsB = ({ brass }: { brass: number }) => <Coins money={fromBrass(brass)} />;

/** L'Activité `activite` que compose le héros `heroId`, ou `undefined` : il en compose une autre, ou aucune. */
const compositionDe = (etat: EtatDInterlude, heroId: string, activite: string): CompositionDActivite | undefined => {
  const c = etat.interlude?.perHero[heroId]?.composition;
  return c?.activite === activite ? c : undefined;
};

/** Le refus de chaque valeur de l'axe `axe` offerte au brouillon de l'Activité `activite` du héros, celui que le choix
 *  de la fenêtre lui donne (`refusDeLaValeur`) : l'option refusée se grise avec sa raison. */
const refusDesValeurs = (etat: EtatDeDepot, heroId: string, activite: string, axe: AxeDuBrouillon) => {
  const brouillon = brouillonDe(etat.interlude?.perHero[heroId]?.composition, activite);
  return (valeur: string): string | undefined => refusDeLaValeur(etat, heroId, brouillon, axe, valeur) ?? undefined;
};

/** Compose l'Activité `activite` du héros (`fenetreChoisir('interlude', …)`) : la choisit s'il en compose une autre,
 *  puis règle ce que `regler` choisit. */
function useComposer(hero: Combatant, activite: string, composition: CompositionDActivite | undefined) {
  const choisir = useGame((s) => s.fenetreChoisir);
  return {
    choisir,
    composer: (regler: () => void) => {
      if (!composition) choisir('interlude', 'activite', activite, hero.id);
      regler();
    },
  };
}

/** Chip de compétence du Codex (popover desc + source) par id (+ spécialisation affichée). */
const SkillChip = ({ skillId, show }: { skillId: string; show?: string }) => (
  <EntityRef category="skills" id={skillId} label={refLabel('skills', { id: skillId })} show={show} />
);

/** Vue réseau minimale pour la possession (audit M7) — sous-ensemble de `GameState['net']`. */
export interface InterludeNet {
  mode: 'local' | 'hote' | 'invite';
  mySeat: number;
  ownership: Record<string, number>;
  seatNames: Record<number, string>;
}

/** Seam de test (rendu statique : le store SSR sert l'état initial — cf. WorldMapView). */
export interface InterludeSeam {
  interlude: InterludeState;
  party: Combatant[];
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trappingId: string }[];
  /** Faveurs dues (LDB 23, #509) — en jeu, dérivé du store ; en SSR, fourni par le seam. */
  favors?: Favor[];
  /** Phase d'ouverture forcée ('activities' saute l'intro Événements). */
  phase?: 'events' | 'activities' | 'closing';
  /** Volet OUVERT forcé (tests SSR du gabarit : pied pré-jet visible), et l'objet à commander qu'il choisit d'abord
   *  (`choix`) ; les autres volets lisent l'Activité que compose le héros (`InterludeHeroState.composition`). */
  openPane?: { heroId: string; pane: string; choix?: string };
  /** Catalogue d'Activités data-driven proposables ICI (contexte 'interlude' + gate `where`) —
   *  en jeu, dérivé du store (`interludeCatalog`) ; en SSR, fourni par le seam (le store SSR sert
   *  l'état initial, comme les autres lectures). */
  catalog?: ActivityDef[];
  /** Le lieu courant que lisent les verdicts d'Activité — en SSR, fourni par le seam. */
  lieu?: Pick<EtatDeDepot, 'lieu'>;
  net?: InterludeNet;
  /** L'heure de jeu dont part la clôture — en SSR, fournie par le seam. */
  gameTime?: number;
  /** Bataille de masse en attente de préparation (ADE II 8) — bandeau d'info + Activités de prépa
   *  dans les volets par-héros. `null`/absent = pas de bataille pendante. */
  massBattle?: MassBattleState | null;
}

/**
 * Écran « Entre deux aventures » (LDB 22-23) — refonte UX LOT 6, puis maître-détail #330 :
 * 1. SYNTHÈSE persistante (bandeau sticky, les 3 phases) : une vignette par héros — portrait +
 *    États actifs (CharFrame `full`), Activités restantes (●○), propriétaire coop — + bourse du
 *    groupe. Les conséquences des Événements s'y reflètent immédiatement (lecture du store).
 * 2. UN héros à la fois (`Tabs` sélectionne) : les Activités du héros ACTIF se posent en
 *    `MasterDetail` — GAUCHE la liste des Activités (icône + nom), CENTRE le détail au gabarit
 *    unique `ActivityPane` (description `<Prose>` verbatim, pré-jet du noyau rendu par `testPending`,
 *    coût `<Coins>`, PIED FIXE avec « Entreprendre » jamais caché par le scroll).
 * 3. Clôture RÉCAPITULATIVE confirmée (audit M3).
 *
 * Les lectures de DONNÉES restent dans ce composant racine (props descendantes) ; les enfants
 * ne tirent du store que des ACTIONS — testable en SSR via `seam`.
 */
export function InterludeScreen({ seam }: { seam?: InterludeSeam } = {}) {
  const storeInterlude = useGame((s) => s.interlude);
  const storeParty = useGame((s) => s.party);
  const storeBank = useGame((s) => s.bank);
  const storeOrders = useGame((s) => s.pendingOrders);
  const storeFavors = useGame((s) => s.favors);
  const storeNet = useGame((s) => s.net);
  const storeGameTime = useGame((s) => s.gameTime);
  const interlude = seam?.interlude ?? storeInterlude;
  const party = seam?.party ?? storeParty;
  // Somme des bourses PERSONNELLES du groupe (#531), lue par le bandeau de synthèse.
  const money = totalDesBourses(party);
  const bank = seam?.bank ?? storeBank;
  const pendingOrders = seam?.pendingOrders ?? storeOrders;
  const favors = seam?.favors ?? storeFavors ?? [];
  const net: InterludeNet = seam?.net ?? storeNet;
  const gameTime = seam?.gameTime ?? storeGameTime;
  // Catalogue d'Activités data-driven (`activities.json`) : contexte 'interlude' + gate `where`
  // résolu contre le lieu où se tient le groupe (`lieu`).
  const storeLieu = useGame((s) => s.lieu);
  const lieu = seam?.lieu ? seam.lieu.lieu : storeLieu;
  const storeMassBattle = useGame((s) => s.massBattle);
  const massBattle = seam?.massBattle ?? storeMassBattle;
  // Le catalogue inclut les Activités de PRÉPARATION de bataille quand une bataille est en attente de prépa
  // (`interludeCatalog` lit `massBattle`) — « Interlude c'est interlude » : pas d'écran à part.
  const catalog = useMemo(
    () => seam?.catalog ?? interludeCatalog({ lieu, massBattle }),
    [seam?.catalog, lieu, massBattle],
  );
  const [phase, setPhase] = useState<'events' | 'activities' | 'closing'>(seam?.phase ?? 'events');
  // Héros ACTIF (les onglets sélectionnent — un seul volet d'Activités rendu à la fois, #330) +
  // Activité ouverte de ce héros (maître-détail : liste GAUCHE, détail CENTRE).
  const [activeHeroId, setActiveHeroId] = useState<string | null>(seam?.openPane?.heroId ?? null);
  const [pane, setPane] = useState<string | null>(seam?.openPane?.pane ?? null);
  if (!interlude) return null;
  const heroes = party.filter((h) => !h.dead && interlude.perHero[h.id]);
  const activeHero = heroes.find((h) => h.id === activeHeroId) ?? heroes[0];
  const mecenat = catalog.find((d) => d.resolver === 'mecenat');
  // Possession coop (audit M7) : chaque joueur mène les Activités de SES héros ; l'hôte clôt. Porte
  // UI UNIQUE (#1262) : le siège se lit par le routage d'état, jamais par une comparaison recopiée.
  const ownsHero = (id: string) => ownsLocalNet(net, id);
  const ownerName = (id: string) => nomDuSiege(net, net.ownership[id] ?? 0);
  // La validation de l'interlude se juge sur l'état de la partie, l'interlude et le siège que le seam lui donne.
  const etatDuJeu = useGame.getState();
  const refusClore = refusDeLaValidationNommee({ ...etatDuJeu, interlude, net: { ...etatDuJeu.net, ...net } }, 'interlude');
  const etat: EtatDeDepot & EtatDeFaveur = { interlude, party, bank, lieu, favors };
  return (
    <div className="interlude-shell tx-ink">
      <div className="interlude-column">
        <OrnateFrame tone="or" className="interlude-masthead">
          <h1 className="display-title">{t('interlude.title')}</h1>
          <p className="subtitle">
            {interlude.weeks} semaine{interlude.weeks > 1 ? 's' : ''} de répit avant la prochaine aventure
          </p>
        </OrnateFrame>
        <SynthBar
          heroes={heroes}
          interlude={interlude}
          money={money}
          activeId={phase === 'activities' ? activeHero?.id ?? null : null}
          ownsHero={ownsHero}
          ownerName={ownerName}
        />
        <RuleDivider label={phase === 'events' ? 'Les nouvelles de la période' : 'Les Activités du groupe'} />
        {phase === 'events' ? (
          <EventsIntro heroes={heroes} etat={etat} onDone={() => setPhase('activities')} />
        ) : (
          <>
            {massBattle?.phase === 'prep' && <BattleBanner mb={massBattle} />}
            <div className="interlude-heroes">
              {heroes.length > 1 && (
                <Tabs
                  tabs={heroes.map((h) => ({ key: h.id, label: h.label }))}
                  active={activeHero?.id ?? null}
                  onChange={(id) => { setActiveHeroId(id); setPane(null); }}
                  label="Héros"
                />
              )}
              {activeHero && (
                <HeroCard
                  etat={etat}
                  hero={activeHero}
                  st={interlude.perHero[activeHero.id]}
                  catalog={catalog}
                  mecenat={mecenat}
                  favors={favors.filter((f) => f.heroId === activeHero.id)}
                  massBattle={massBattle ?? null}
                  canDrive={ownsHero(activeHero.id)}
                  ownerName={ownsHero(activeHero.id) ? undefined : ownerName(activeHero.id)}
                  pane={pane}
                  onPane={setPane}
                  choix={seam?.openPane?.choix}
                />
              )}
            </div>
            {bank.length > 0 && (
              <section className="interlude-hero panel">
                <h3><Icon id="ressource/bourse" size="sm" /> Dépôts en cours</h3>
                <BankList etat={etat} canDrive={ownsHero} />
              </section>
            )}
            {/* Jeux de taverne (NADJ 16) — délassement entre deux aventures ; affordance montrée
                seulement si l'option `jeux-de-taverne` est active. Ne consomme pas d'Activité. */}
            {rule('jeux-de-taverne') && <TavernGamesEntry />}
            <div className="interlude-close">
              <p className="interlude-warning" title={t('interlude.close.warning.title')}>
                <Icon id="ressource/bourse" size="sm" /> {t('interlude.close.warning')}
              </p>
              {massBattle?.phase === 'prep'
                /* Bataille en attente : la clôture ENGAGE la bataille (`fenetreValider('interlude')` → engagerLaBataille, C2b) —
                   le bouton de clôture porte alors ce libellé, une SEULE porte de sortie (pas de 2e écran). */
                ? <GatedAction id="interlude-close" label={<><Icon id="action/attaquer" size="sm" /> {t('interlude.close.bataille')}</>}
                    descOfferte={t('interlude.close.bataille.desc')} enabled={!refusClore} {...raisonSi(refusClore)} onClick={() => setPhase('closing')} />
                : <GatedAction id="interlude-close" label={t('interlude.close.btn')} enabled={!refusClore} {...raisonSi(refusClore)} onClick={() => setPhase('closing')} />}
            </div>
          </>
        )}
      </div>
      {/* Arbitre partagé (audit M8) : la modale de jet d'Activité s'affiche chez le PROPRIÉTAIRE
          du héros, les autres voient « X joue… ». */}
      <ActiveModal />
      <TavernGameModal />
      {phase === 'closing' && (
        <CloseRecap etat={{ interlude, party, bank, pendingOrders, gameTime }} onCancel={() => setPhase('activities')} />
      )}
    </div>
  );
}

/** Pips d'Activités restantes (●○) d'un héros — partagés entre le bandeau et les tooltips. */
function ActivityPips({ st }: { st: InterludeHeroState }) {
  return (
    <span className="interlude-pips" title={`${st.left} Activité${st.left > 1 ? 's' : ''} restante${st.left > 1 ? 's' : ''}`}>
      {'●'.repeat(st.left)}{'○'.repeat(Math.max(0, st.granted - st.left))}
    </span>
  );
}

/** Bandeau de SYNTHÈSE persistant (sticky, les 3 phases) : une vignette par héros — portrait +
 *  jauge + États actifs (CharFrame `full`), Activités restantes, propriétaire coop, Revenus déjà
 *  gagnés — plus la bourse du GROUPE (les pertes d'Événements s'y lisent immédiatement). Le héros
 *  dont on regarde le volet est mis en évidence. */
function SynthBar({ heroes, interlude, money, activeId, ownsHero, ownerName }: {
  heroes: Combatant[];
  interlude: InterludeState;
  money: Money;
  activeId: string | null;
  ownsHero: (id: string) => boolean;
  ownerName: (id: string) => string;
}) {
  return (
    <div className="interlude-synth">
      {heroes.map((h) => {
        const st = interlude.perHero[h.id]!;
        return (
          <div key={h.id} className={`interlude-synth-hero${h.id === activeId ? ' active' : ''}`}>
            <CharFrame c={h} variant="full" size="sm" maxStates={3} />
            <div className="interlude-synth-meta">
              <ActivityPips st={st} />
              {!ownsHero(h.id) && (
                <span className="interlude-owner"><Icon id="navigation/proprietaire-du-siege" size="sm" /> {ownerName(h.id)}</span>
              )}
              {st.revenueBrass > 0 && (
                <span className="interlude-synth-rev" title="Revenus de la période — crédités à la reprise"><CoinsB brass={st.revenueBrass} /></span>
              )}
            </div>
          </div>
        );
      })}
      <div className="interlude-synth-purse" title={t('interlude.close.warning.title')}>
        <Icon id="ressource/bourse" />
        <Coins money={money} />
      </div>
    </div>
  );
}

/** Bandeau d'INFO bataille (non-cliquable, ADE II 8) : une bataille est imminente — les deux camps et
 *  leur Puissance. Les Activités de préparation (Discours, Planification, Repérage, Sabotage…) figurent DANS
 *  les volets par-héros, comme toute Activité (budget UNIQUE d'interlude, l.65). Pas d'écran à part. */
function BattleBanner({ mb }: { mb: MassBattleState }) {
  return (
    <section className="interlude-battle-banner panel">
      <h3><Icon id="action/attaquer" size="sm" /> Bataille imminente</h3>
      <p className="interlude-detail">
        <b>{mb.allie.label}</b> (Puissance {armyMight(mb.allie)}) contre <b>{mb.ennemi.label}</b> (Puissance {armyMight(mb.ennemi)}).
        Préparez-la depuis vos Activités <em>Entre deux aventures</em> : Discours, Planification, Repérage,
        Sabotage… (max 3). « Engager la bataille » clôt l'interlude et lance les Rounds.
      </p>
    </section>
  );
}

/** Entrée « Jeux de taverne » (NADJ 16) : ouvre la modale de jeu (choix jeu + adversaire). */
function TavernGamesEntry() {
  const open = useGame((s) => s.ouvrirLesJeux);
  const refus = useGame(refusDOuvrirLaTaverne);
  return (
    <section className="interlude-hero panel">
      <h3><Icon id="navigation/des" size="sm" /> Jeux de taverne</h3>
      <p className="interlude-detail">Un moment de détente : dés, boules, bras de fer… (Nuits agitées, ch.16).</p>
      <GatedAction id="interlude-tavern-open" label="Proposer une partie" enabled={!refus} {...raisonSi(refus)} onClick={() => open()} btnClassName="small" />
    </section>
  );
}

/** Libellés des Classes `ids`, joints pour une puce. */
const libellesDeClasses = (ids: readonly string[]): string => ids.map(libelleDeClasse).join(', ');

/** Conséquences mécaniques des Événements de la période (`effetsDeLaPeriode`), STRUCTURÉES (LDB 22) : les
 *  effets sont de la donnée, ceci est un RENDU — chaque conséquence porte son icône du registre
 *  (`<FxChip>`), aucun parsing. */
function fxChips(etat: EtatDInterlude, st: InterludeHeroState, hero: Combatant): { icon: IconId; label: string }[] {
  const chips: { icon: IconId; label: string }[] = [];
  const bloquant = effetBloquantLesRevenus(etat, hero.id);
  for (const effet of effetsDeLaPeriode(etat, hero.id)) {
    const { fx } = effet;
    if (fx.moneyPct) chips.push({ icon: 'ressource/bourse', label: t(fx.partyWide ? 'interlude.fx.bourses' : 'interlude.fx.bourse', { pct: fx.moneyPct }) });
    if (fx.loseActivity) chips.push({ icon: 'navigation/activite', label: t('interlude.fx.moinsUneActivite') });
    if (fx.fortuneMaxDelta) chips.push({ icon: 'ressource/chance', label: t('interlude.fx.chance', { n: fx.fortuneMaxDelta, s: fx.fortuneMaxDelta > 1 ? 's' : '' }) });
    if (fx.revenuePct) {
      const pct = { sign: fx.revenuePct > 0 ? '+' : '', pct: fx.revenuePct };
      chips.push({ icon: 'ressource/bourse', label: fx.revenueClasses ? t('interlude.fx.revenusPour', { ...pct, classes: libellesDeClasses(fx.revenueClasses) }) : t('interlude.fx.revenus', pct) });
    }
    if (fx.revenueBlockedClasses) {
      chips.push({ icon: 'ressource/bourse', label: (bloquant?.id === effet.id ? blocageDeRevenus(etat, hero.id) : null) ?? t('interlude.fx.revenusBloquesPour', { classes: libellesDeClasses(fx.revenueBlockedClasses) }) });
    }
    if (fx.bankPct) chips.push({ icon: 'ressource/bourse', label: t('interlude.fx.banque', { pct: fx.bankPct }) });
    if (fx.stashRaided) chips.push({ icon: 'interface/attention', label: t('interlude.fx.planqueDevalisee') });
    if (fx.bankCrashCheck) chips.push({ icon: 'interface/attention', label: t('interlude.fx.faillite') });
  }
  // Devoir elfique : conséquence APPLIQUÉE par le flow (règle optionnelle comprise) — jamais re-dérivée ici.
  if (st.elfDuty) chips.push({ icon: 'navigation/activite', label: t('interlude.fx.devoirElfique') });
  return chips;
}

/** Phase 1 — les événements d100 de la période, racontés héros par héros (audit M1). L'impact
 *  mécanique se lit en chips ET dans le bandeau de synthèse (déjà appliqué au store). */
function EventsIntro({ heroes, etat, onDone }: { heroes: Combatant[]; etat: EtatDInterlude; onDone: () => void }) {
  // Dés d'Événement encore à poser (#942 L7, phase 'tirage') : la pose se fait dans la fenêtre de
  // séquence (`CascadeModal`), jamais ici — la chronique ATTEND, elle n'affiche pas un dé qui
  // n'existe pas, et les Activités ne s'ouvrent pas avant le dénouement du tirage.
  const interlude = etat.interlude!;
  const tirage = interludeDrawPending(etat);
  const enAttente = desEnAttente(etat);
  return (
    <>
      <p className="interlude-phase-hint">
        {t('interlude.events.hint', { die: formatDice(interludeEventDie()) })}
      </p>
      <div className="interlude-chronicle">
        {heroes.map((h) => {
          const st = interlude.perHero[h.id];
          if (st.eventRoll == null) {
            return (
              <ParchmentCard key={h.id} title="Le dé n’est pas encore tombé">
                <header className="interlude-chronicle-head">
                  <CharFrame c={h} variant="identity" size="sm" />
                </header>
                <p className="interlude-event">Son Événement de la période reste à tirer.</p>
              </ParchmentCard>
            );
          }
          const ev = interludeEventFor(st.eventRoll);
          const chips = fxChips(etat, st, h);
          return (
            <ParchmentCard key={h.id} seal={{ label: formatDice(interludeEventDie()), roll: st.eventRoll }} title={ev.label}>
              <header className="interlude-chronicle-head">
                <CharFrame c={h} variant="identity" size="sm" />
              </header>
              <p className="interlude-event">{ev.desc}</p>
              {chips.length > 0 && (
                <div className="interlude-fx">
                  {chips.map((c) => <FxChip key={c.label} icon={c.icon} label={c.label} />)}
                </div>
              )}
            </ParchmentCard>
          );
        })}
      </div>
      <div className="interlude-phase-actions">
        {tirage && (
          <p className="hint" id="interlude-draw-pending">
            {enAttente.length > 0
              ? t('interlude.events.pending', { n: enAttente.length, s: enAttente.length > 1 ? 's' : '', names: enAttente.map((h) => h.label).join(', ') })
              : t('interlude.events.groupPending')}
          </p>
        )}
        {/* La raison est DÉJÀ à l'écran (le rappel des dés en attente) : l'action s'y LIE au lieu
            d'ouvrir une bulle qui la redirait — forme `reasonId`, `aria-disabled` + clic inerte. */}
        <GatedAction
          id="interlude-events-next"
          {...lieeA(tirage ? 'interlude-draw-pending' : undefined)}
          label={t('interlude.events.next')}
          enabled={!tirage}
          onClick={onDone}
        />
      </div>
    </>
  );
}

/** ENJEU (Z3b, #1117 L3) posé sur la ligne de pré-jet d'un volet d'Activité : la RÉFÉRENCE de donnée
 *  (`ActivityDef.stake`, éditable au Codex) via la porte unique — jamais un texte écrit ici. Une
 *  Activité sans enjeu authoré (donc sans Test) traverse inchangée : pas de zone muette. */
const withStake = (p: PendingRoll, activityId: string): PendingRoll =>
  (hasActivityStake(activityId) ? { ...p, stake: activityStakeRef(activityId) } : p);

/** Puce du Test que retient un pré-jet : sa Compétence (Spé comprise), ou sa Caractéristique. */
function PuceDuTest({ test }: { test: TestDesigne }) {
  return test.skill
    ? <SkillChip skillId={test.skill.id} show={test.skill.spec ? skillInstanceLabel(test.skill) : undefined} />
    : <b>{CHAR_LABELS[test.characteristic]}</b>;
}

/** Pré-jet d'une Activité monté dans son volet : la ligne du Test que pose son geste (`preJetDActivite`). */
const prejetDuVolet = (pj: PreJetDActivite | undefined, activityId: string): PendingRoll | undefined =>
  (pj ? withStake(testPending(<PuceDuTest test={pj.test} />, pj.ligne.base, cibleMesuree(pj.ligne), pj.ligne.difficulty, pj.ligne.mods), activityId) : undefined);

/** Résolveurs des Activités du catalogue qui ont un VOLET DÉDIÉ (UX riche : formule de Revenus,
 *  flux 2 étapes de l'Artisanat, sélecteur de Talent, sélecteur d'artefact) ou vivent ailleurs
 *  (`mecenat` = dans la banque). Exclus de la liste GÉNÉRIQUE du catalogue pour ne pas les doubler. */
const CORE_RESOLVERS = new Set<ActivityResolver>(['income', 'craftExtended', 'learnTalent', 'identify', 'mecenat', 'entrainement']);
const hasCoreResolver = (r?: ActivityResolver): boolean => !!r && CORE_RESOLVERS.has(r);

/** Icônes des Activités à volet dédié — les Activités du catalogue générique portent la leur
 *  en DONNÉE (`ActivityDef.icon`). */
const PANE_ICON = {
  revenus: 'ressource/bourse',
  craft: 'objet/divers',
  learn: 'navigation/compendium',
  order: 'scenario/marche',
  bank: 'ressource/bourse',
  identify: 'navigation/identifier',
  entrainement: 'navigation/compendium',
} as const;

function HeroCard({ etat, hero, st, catalog, mecenat, favors, massBattle, canDrive, ownerName, pane, onPane, choix }: {
  /** L'état que lisent les verdicts d'interlude (`noyau/verdictsDInterlude.ts`). */
  etat: EtatDeDepot & EtatDeFaveur;
  hero: Combatant; st: InterludeHeroState;
  /** Faveurs dues par CE héros (LDB 23, #509) — gate l'affordance « Acquitter une Faveur ». */
  favors: Favor[];
  /** Activités du catalogue data-driven proposables ICI (contexte + gate `where`) — inclut les Activités de
   *  PRÉPARATION de bataille (contexte 'bataille') quand une bataille est en attente de prépa. */
  catalog: ActivityDef[];
  /** Activité de Mécénat (variante d'Opération bancaire) si proposable ici. */
  mecenat?: ActivityDef;
  /** Bataille en attente de préparation (état de blocage/anti-répétition des Activités de prépa). */
  massBattle: MassBattleState | null;
  /** Possession coop (audit M7) : false = ce héros est mené par un autre joueur (lecture seule). */
  canDrive: boolean;
  ownerName?: string;
  /** Volet ouvert de CE héros (état remonté à l'écran — un seul volet ouvert à la fois). */
  pane: string | null;
  onPane: (pane: string | null) => void;
  /** L'objet à commander que choisit d'abord le volet ouvert (`InterludeSeam.openPane.choix`). */
  choix?: string;
}) {
  // Le dé peut manquer (phase 'tirage', #942 L7) : la rangée d'événement dit alors l'attente.
  const ev = st.eventRoll != null ? interludeEventFor(st.eventRoll) : null;
  const status = actorStatus(hero);
  // Raisons NOMMÉES de la fermeture des Activités de ce héros, portées par chaque volet jusqu'à son
  // action : le verdict du noyau (`refusDActivite` pour une Activité, celui du geste même —
  // `refusDOuvertureDActivite` — pour les Revenus et l'ouvrage en cours, `refusDuTirage` pour engager un
  // Artisanat, qui n'en consomme pas), ou la possession coop.
  const mene = canDrive ? undefined : t('interlude.drivenElsewhere');
  const refusAct = mene ?? refusDActivite(etat, hero.id) ?? undefined;
  const refusEngagement = mene ?? refusDuTirage(etat, hero.id) ?? undefined;
  const refusRevenus = mene ?? refusDOuvertureDActivite(etat, hero.id, activityById('revenus')!) ?? undefined;
  const refusOuvrage = mene ?? refusDOuvertureDActivite(etat, hero.id, activityById('craft')!) ?? undefined;
  const refusDe = (key: string): string | undefined =>
    (key === 'craft' ? (hero.craft ? refusOuvrage : refusEngagement) : key === 'revenus' ? refusRevenus : refusAct);
  // Chaque volet payant lit SON verdict d'abordabilité (`noyau/verdictsDInterlude.ts`) sur la bourse
  // PERSONNELLE du héros (#531) ; `mene` reste la seule raison propre à l'écran (possession coop).
  // Volet du catalogue GÉNÉRIQUE : les 4 activités socle (Revenus/Artisanat/Apprentissage/
  // Identification) ont leur volet dédié ci-dessous — CatalogPane ne sert que les AUTRES.
  const def = pane ? catalog.find((d) => d.id === pane && !hasCoreResolver(d.resolver)) : undefined;
  // Description VERBATIM d'une Activité socle (`activities.json`, id = clé de volet) — la donnée
  // EXISTE (revenus/craft/learn/identify), passée au gabarit `ActivityPane` de chaque volet dédié.
  const coreDesc = (id: string) => catalog.find((d) => d.id === id)?.desc;
  /** … et son PORTEUR : cette desc EST le champ `desc` de l'entrée d'Activité de même id. */
  const corePorteur = (id: string): Porteur => ({ type: 'activities', id, chemin: 'desc' });
  const detail =
    pane === 'revenus' ? <RevenusPane hero={hero} etat={etat} status={status} refus={refusRevenus} desc={coreDesc('revenus')} porteur={corePorteur('revenus')} />
    : pane === 'craft' ? (hero.craft
        ? <CraftProgressPane hero={hero} etat={etat} craft={hero.craft} refus={refusOuvrage} desc={coreDesc('craft')} porteur={corePorteur('craft')} />
        : <CraftPane hero={hero} etat={etat} mene={mene} desc={coreDesc('craft')} porteur={corePorteur('craft')} />)
    : pane === 'learn' ? <LearnPane hero={hero} etat={etat} mene={mene} desc={coreDesc('learn')} porteur={corePorteur('learn')} />
    : pane === 'order' ? <OrderPane hero={hero} etat={etat} mene={mene} choix={choix} />
    : pane === 'bank' ? <BankPane hero={hero} etat={etat} mene={mene} money={bourseOf(hero)} mecenat={mecenat} />
    : pane === 'identify' ? <IdentifyPane hero={hero} etat={etat} mene={mene} desc={coreDesc('identify')} porteur={corePorteur('identify')} />
    : pane === 'entrainement' ? <EntrainementPane hero={hero} etat={etat} mene={mene} desc={coreDesc('entrainement')} porteur={corePorteur('entrainement')} />
    : pane === 'favor-settle' && favors.length ? <FavorSettlePane hero={hero} etat={etat} mene={mene} favors={favors} />
    : def ? (def.contexts.includes('bataille')
        ? <BattlePrepPane hero={hero} etat={etat} def={def} refus={refusAct} massBattle={massBattle} />
        : <CatalogPane hero={hero} def={def} etat={etat} mene={mene} />)
    : <p className="interlude-detail interlude-master-empty">{t('interlude.choisir.activite')}</p>;
  return (
    <section className={`interlude-hero panel${pane ? ' active' : ''}`}>
      <h3>
        <CharFrame c={hero} variant="identity" size="sm" />
        <span className="interlude-left">
          {!canDrive && <span className="interlude-owner"><Icon id="navigation/proprietaire-du-siege" size="sm" /> {ownerName ?? 'autre joueur'} · </span>}
          {t('interlude.statut', { echelon: libelleDEchelon(status.tier), standing: status.standing })}
        </span>
      </h3>
      {ev
        ? <p className="interlude-event" title={ev.desc}><Icon id="navigation/des" size="sm" /> {st.eventRoll} — {ev.label}</p>
        : <p className="interlude-event"><Icon id="navigation/des" size="sm" /> Événement de la période : dé à poser.</p>}
      <MasterDetail
        className="interlude-master"
        listLabel={`Activités de ${hero.label}`}
        list={
          <ActivityList hero={hero} catalog={catalog} favors={favors} pane={pane} onPane={onPane} canDrive={canDrive} refusDe={refusDe} ownerName={ownerName} />
        }
        detail={detail}
      />
    </section>
  );
}

/** Slot GAUCHE du maître-détail (`MasterDetail`) : liste des Activités du héros — les 6 activités
 *  « socle » (LDB/ADE II, volets dédiés) + les Activités du catalogue SANS volet dédié (Mécénat
 *  exclu : variante du volet Banque). Filtre si la liste est longue (`SearchFilterField`). */
function ActivityList({ hero, catalog, favors, pane, onPane, canDrive, refusDe, ownerName }: {
  hero: Combatant; catalog: ActivityDef[];
  /** Faveurs dues par ce héros (LDB 23, #509) — l'entrée « Acquitter une Faveur » n'apparaît que si non-vide. */
  favors: Favor[];
  pane: string | null; onPane: (pane: string | null) => void;
  canDrive: boolean;
  /** Refus de l'entrée `key` (verdict du noyau), ou `undefined` : une entrée refusée reste refermable. */
  refusDe: (key: string) => string | undefined;
  ownerName?: string;
}) {
  const item = (key: string, label: ReactNode, textLabel: string) => ({
    id: key,
    textLabel,
    node: (
      <GatedAction
        key={key}
        id={`interlude-act-${key}`}
        label={label}
        ariaLabel={textLabel}
        enabled={canDrive && (!refusDe(key) || pane === key)}
        {...raisonSi(canDrive ? refusDe(key) : t('interlude.drivenBy', { owner: ownerName ?? t('interlude.otherPlayer') }))}
        onClick={() => onPane(pane === key ? null : key)}
        primary={false}
        ariaPressed={pane === key}
        btnClassName="small interlude-activity-btn"
      />
    ),
  });
  const core = [
    item('revenus', <><Icon id={PANE_ICON.revenus} size="sm" /> Revenus</>, 'Revenus'),
    item('craft', hero.craft
      ? <><Icon id={PANE_ICON.craft} size="sm" /> Artisanat — {findTrappingById(hero.craft.trappingId)?.label ?? hero.craft.trappingId} ({hero.craft.drDone}/{hero.craft.drTarget})</>
      : <><Icon id={PANE_ICON.craft} size="sm" /> Artisanat</>, 'Artisanat'),
    item('learn', <><Icon id={PANE_ICON.learn} size="sm" /> Apprentissage</>, 'Apprentissage'),
    item('order', <><Icon id={PANE_ICON.order} size="sm" /> Commande</>, 'Commande'),
    item('bank', <><Icon id={PANE_ICON.bank} size="sm" /> Banque</>, 'Banque'),
    item('identify', <><Icon id={PANE_ICON.identify} size="sm" /> Identifier</>, 'Identifier'),
    item('entrainement', <><Icon id={PANE_ICON.entrainement} size="sm" /> Entraînement</>, 'Entraînement'),
    // « Acquitter une Faveur » (LDB 23 l.147/149, #509) — visible seulement si une Faveur est en cours.
    ...(favors.length ? [item('favor-settle', <><Icon id="interface/balance" size="sm" /> Acquitter une Faveur</>, 'Acquitter une Faveur')] : []),
  ];
  // Activités du catalogue SANS volet dédié : les 4 activités « socle » (Revenus/Artisanat/
  // Apprentissage/Identification, volets riches ci-dessus) et Mécénat (dans la banque) sont
  // exclues pour ne pas les doubler — leur résolveur les identifie en DONNÉE.
  const catalogItems = catalog.filter((d) => !hasCoreResolver(d.resolver)).map((d) =>
    item(d.id, <><Icon id={d.icon} size="sm" /> {d.label}</>, d.label));
  const items = [...core, ...catalogItems];
  const { search, setSearch, filtered } = useFilteredList(items, (o) => o.textLabel);
  return (
    <>
      {items.length > 6 && (
        <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer les activités…" ariaLabel="Filtrer les activités" />
      )}
      {filtered.map((o) => o.node)}
    </>
  );
}

/** Revenus : la formule ET le pré-jet sont lisibles AVANT d'entreprendre. LDB 08 l.105-120 */
function RevenusPane({ hero, etat, status, refus, desc, porteur }: { hero: Combatant; etat: EtatDInterlude; status: Status; refus?: string; desc?: string; porteur?: Porteur }) {
  const { choisir, composer } = useComposer(hero, 'revenus', compositionDe(etat, hero.id, 'revenus'));
  return (
    <ActivityPane
      id="pane-revenus"
      icon={PANE_ICON.revenus}
      title="Revenus — une semaine de travail"
      desc={desc}
      porteur={porteur}
      prejet={prejetDuVolet(preJetDActivite(etat, hero.id, activityById('revenus')!), 'revenus')}
      note={t('interlude.revenus.note', { formule: formuleDeRevenus(status.tier, status.standing) })}
      actions={
        <GatedAction
          id="interlude-revenus-go"
          label="Entreprendre"
          enabled={!refus}
          {...refusDuVolet('pane-revenus', undefined, refus)}
          onClick={() => composer(() => choisir('interlude', 'pratiquer', true, hero.id))}
          btnClassName="small"
        />
      }
    />
  );
}

/** Lancer d'un ouvrage EN COURS — « Chaque Activité […] vous permet d'effectuer un lancer pour
 *  votre Test étendu » (LDB 23 l.102). */
function CraftProgressPane({ hero, etat, craft, refus, desc, porteur }: {
  hero: Combatant; etat: EtatDInterlude; craft: NonNullable<Combatant['craft']>; refus?: string; desc?: string; porteur?: Porteur;
}) {
  const { choisir, composer } = useComposer(hero, 'craft', compositionDe(etat, hero.id, 'craft'));
  const label = findTrappingById(craft.trappingId)?.label ?? craft.trappingId;
  return (
    <ActivityPane
      id="pane-craft"
      icon={PANE_ICON.craft}
      title={`Artisanat — ${label}`}
      desc={desc}
      porteur={porteur}
      prejet={prejetDuVolet(preJetDActivite(etat, hero.id, activityById('craft')!), 'craft')}
      note={<>Test étendu : <b>{craft.drDone}/{craft.drTarget} DR</b> (1 lancer par Activité — le travail inachevé se conserve).</>}
      actions={
        <GatedAction
          id="interlude-craft-go"
          label="Entreprendre"
          ariaLabel={`Avancer l'ouvrage — ${craft.drDone}/${craft.drTarget} DR (${DIFFICULTY_LABELS[craft.difficulty]})`}
          enabled={!refus}
          {...refusDuVolet('pane-craft', undefined, refus)}
          onClick={() => composer(() => choisir('interlude', 'pratiquer', true, hero.id))}
          btnClassName="small"
        />
      }
    />
  );
}

/** Sélecteur d'équipement groupé par famille + recherche (audit B1/B3). `value`/`onChange` = `id`. */
function TrappingSelect({ options, value, onChange, detail, disabled, refus }: {
  options: { id: string; label: string; categorie: string; priceBrass: number }[];
  value: string;
  onChange: (v: string) => void;
  detail?: (id: string) => string;
  /** Le choix appartient à un autre siège. */
  disabled?: boolean;
  /** La raison qui grise un équipement (`refusDesValeurs`). */
  refus?: (id: string) => string | undefined;
}) {
  const { search, setSearch, filtered } = useFilteredList(options, (o) => o.label);
  const families = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const o of filtered) {
      const f = (o.categorie ? libelleDeValeur(trappingCategorieSchema, o.categorie) : '') || 'Équipement';
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(o);
    }
    return [...m.entries()];
  }, [filtered]);
  return (
    <>
      <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer le catalogue…" ariaLabel="Filtrer le catalogue" />
      <select className="interlude-select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} size={Math.min(8, Math.max(3, filtered.length))}>
        {families.map(([fam, list]) => (
          <optgroup key={fam} label={fam}>
            {list.map((o) => (
              <option key={o.id} value={o.id} disabled={!!refus?.(o.id)} title={refus?.(o.id)}>
                {o.label} — {fmt(o.priceBrass)}{detail ? ` · ${detail(o.id)}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </>
  );
}

/** Engager un Artisanat (LDB 23 l.76) : catalogue + Atouts/Défauts visés (LDB 23 l.95) ; matériaux ¼ du prix. L'ouvrage
 *  se compose dans l'Activité du héros (`fenetreChoisir('interlude', …)`). */
function CraftPane({ hero, etat, mene, desc, porteur }: { hero: Combatant; etat: EtatDeDepot; mene?: string; desc?: string; porteur?: Porteur }) {
  const composition = compositionDe(etat, hero.id, 'craft');
  const { choisir, composer } = useComposer(hero, 'craft', composition);
  const catalog = useMemo(() => craftCatalog(), []);
  const id = composition?.ouvrage ?? '';
  const atouts = composition?.atouts ?? [];
  const defauts = composition?.defauts ?? [];
  const sel: CraftOption | undefined = catalog.find((o) => o.id === id);
  const target = sel ? craftTarget(sel.tier, sel.avail, atouts.length, defauts.length) : null;
  const verdict = refusDArtisanat(etat, hero.id, sel?.id) ?? undefined;
  const banniere = mene ? undefined : verdict;
  // Une case cochée retire la qualité visée, une case vide l'ajoute.
  const viser = (visee: boolean, q: string) => composer(() => choisir('interlude', visee ? 'retirerLaQualite' : 'ajouterLaQualite', q, hero.id));
  return (
    <ActivityPane
      id="pane-craft-start"
      icon={PANE_ICON.craft}
      title="Artisanat — engager un ouvrage"
      desc={desc}
      porteur={porteur}
      blocked={banniere}
      prejet={target ? prejetDuVolet(preJetDActivite(etat, hero.id, activityById('craft')!, {}, { ouvrage: target }), 'craft') : undefined}
      cost={sel ? <CoinsB brass={sel.materialsBrass} /> : undefined}
      note={sel && target
        ? <>matériaux ¼ du prix, payés à l'engagement · Test étendu : <b>{target.dr} DR</b> à cumuler (1 lancer par Activité).</>
        : <>Choisir un équipement du catalogue — matériaux ¼ du prix, Test étendu de Métier.</>}
      actions={
        <GatedAction
          id="interlude-craft-start"
          label="Entreprendre"
          enabled={!mene && !verdict && !!sel}
          {...refusDuVolet('pane-craft-start', banniere, mene ?? t('interlude.choisir.ouvrage'))}
          onClick={() => composer(() => choisir('interlude', 'pratiquer', true, hero.id))}
          btnClassName="small"
        />
      }
    >
      <TrappingSelect options={catalog} value={id} onChange={(v) => composer(() => choisir('interlude', 'ouvrage', v, hero.id))} disabled={!!mene} refus={refusDesValeurs(etat, hero.id, 'craft', 'ouvrage')} />
      <div className="interlude-craft-q">
        {qualitesDArtisanat().atouts.map((q) => (
          <label key={q} title={mdToText(craftQual(q).desc ?? '')}>
            <input type="checkbox" checked={atouts.includes(q)} disabled={!!mene} onChange={() => viser(atouts.includes(q), q)} /> {craftQual(q).label}
          </label>
        ))}
        {qualitesDArtisanat().defauts.map((q) => (
          <label key={q} title={mdToText(craftQual(q).desc ?? '')}>
            <input type="checkbox" checked={defauts.includes(q)} disabled={!!mene} onChange={() => viser(defauts.includes(q), q)} /> {craftQual(q).label} (défaut)
          </label>
        ))}
      </div>
    </ActivityPane>
  );
}

/** Apprentissage particulier : Talent hors carrière, PX et tuteur lus sur `learnableTalents`. LDB 23 l.66-72 */
function LearnPane({ hero, etat, mene, desc, porteur }: { hero: Combatant; etat: EtatDeDepot; mene?: string; desc?: string; porteur?: Porteur }) {
  const composition = compositionDe(etat, hero.id, 'learn');
  const { choisir, composer } = useComposer(hero, 'learn', composition);
  const options = useMemo(() => learnableTalents(hero), [hero]);
  const refusDuTalent = refusDesValeurs(etat, hero.id, 'learn', 'talent');
  const id = composition?.cibles.talentId ?? '';
  const { search, setSearch, filtered } = useFilteredList(options, (o) => o.label);
  const sel: LearnOption | undefined = options.find((o) => o.id === id);
  const xp = hero.xp ?? 0;
  // La bannière du volet EST la raison : le bouton s'y LIE au lieu de la redire au survol.
  const verdict = (sel ? refusDOuvertureDActivite(etat, hero.id, activityById('learn')!, { talentId: sel.id }) : refusDActivite(etat, hero.id)) ?? undefined;
  const banniere = mene ? undefined : verdict;
  const prejet = sel ? prejetDuVolet(preJetDActivite(etat, hero.id, activityById('learn')!, { talentId: sel.id }), 'learn') : undefined;
  return (
    <ActivityPane
      id="pane-learn"
      icon={PANE_ICON.learn}
      title="Apprentissage particulier"
      desc={desc}
      porteur={porteur}
      blocked={banniere}
      prejet={prejet}
      cost={sel ? <>{sel.xpCost} PX (il vous en reste {xp}) + tuteur <CoinsB brass={sel.tutorMinBrass} /> à <CoinsB brass={sel.tutorMaxBrass} /></> : undefined}
      note={sel
        ? <><EntityRef category="talents" id={sel.id} label={sel.label} /> — {t('interlude.learn.perteSurEchec')}</>
        : t('interlude.learn.choisir')}
      actions={
        <GatedAction
          id="interlude-learn-go"
          label="Entreprendre"
          enabled={!mene && !verdict && !!sel}
          {...refusDuVolet('pane-learn', banniere, mene ?? t('interlude.choisir.talent'))}
          onClick={() => composer(() => choisir('interlude', 'pratiquer', true, hero.id))}
          btnClassName="small"
        />
      }
    >
      <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer les talents…" ariaLabel="Filtrer les talents" />
      <select className="interlude-select" value={id} disabled={!!mene} onChange={(e) => composer(() => choisir('interlude', 'talent', e.target.value, hero.id))} size={Math.min(8, Math.max(3, filtered.length))}>
        {filtered.map((o) => (
          <option key={o.id} value={o.id} disabled={!!refusDuTalent(o.id)} title={refusDuTalent(o.id) ?? mdToText(effectiveEntry(findTalentById(o.id))?.desc ?? '')}>
            {t('interlude.option', { label: o.label, px: o.xpCost, min: fmt(o.tutorMinBrass), max: fmt(o.tutorMaxBrass) })}
          </option>
        ))}
      </select>
    </ActivityPane>
  );
}

/** Entraînement : Compétence ou Caractéristique hors carrière, sans jet, PX et tuteur lus sur
 *  `entrainementOptions`. LDB 23 l.132-136 */
function EntrainementPane({ hero, etat, mene, desc, porteur }: { hero: Combatant; etat: EtatDeDepot; mene?: string; desc?: string; porteur?: Porteur }) {
  const composition = compositionDe(etat, hero.id, 'entrainement');
  const { choisir, composer } = useComposer(hero, 'entrainement', composition);
  const options = useMemo(() => entrainementOptions(hero), [hero]);
  const refusDeLOption = refusDesValeurs(etat, hero.id, 'entrainement', 'entrainement');
  const key = composition?.entrainement ?? '';
  const { search, setSearch, filtered } = useFilteredList(options, (o) => o.label);
  const sel = options.find((o) => cleDEntrainement(o) === key);
  const xp = hero.xp ?? 0;
  // La bannière du volet EST la raison : le bouton s'y LIE au lieu de la redire au survol.
  const verdict = (sel ? refusDEntrainement(etat, hero.id, key) : refusDActivite(etat, hero.id)) ?? undefined;
  const banniere = mene ? undefined : verdict;
  return (
    <ActivityPane
      id="pane-entrainement"
      icon={PANE_ICON.entrainement}
      title="Entraînement"
      desc={desc}
      porteur={porteur}
      blocked={banniere}
      cost={sel ? <>{sel.xpCost} PX (il vous en reste {xp}) + tuteur <CoinsB brass={sel.tutorMinBrass} /> à <CoinsB brass={sel.tutorMaxBrass} /></> : undefined}
      note={sel
        ? <>{sel.kind === 'competence' ? <SkillChip skillId={sel.id} show={sel.label} /> : sel.label} {t(sel.advanced ? 'interlude.entrainement.avancee' : 'interlude.entrainement.base', { min: fmt(sel.tutorMinBrass), max: fmt(sel.tutorMaxBrass) })}</>
        : t('interlude.entrainement.choisir', {
            min: fmt(entrainementTutorRange(false).minBrass), max: fmt(entrainementTutorRange(false).maxBrass),
            minAvancee: fmt(entrainementTutorRange(true).minBrass), maxAvancee: fmt(entrainementTutorRange(true).maxBrass),
          })}
      actions={
        <GatedAction
          id="interlude-entrainement-go"
          label="Entreprendre"
          enabled={!mene && !verdict && !!sel}
          {...refusDuVolet('pane-entrainement', banniere, mene ?? t('interlude.choisir.entrainement'))}
          onClick={() => composer(() => choisir('interlude', 'pratiquer', true, hero.id))}
          btnClassName="small"
        />
      }
    >
      <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer les Compétences/Caractéristiques…" ariaLabel="Filtrer les Compétences et Caractéristiques" />
      <select className="interlude-select" value={key} disabled={!!mene} onChange={(e) => composer(() => choisir('interlude', 'entrainement', e.target.value, hero.id))} size={Math.min(8, Math.max(3, filtered.length))}>
        {filtered.map((o) => (
          <option key={cleDEntrainement(o)} value={cleDEntrainement(o)} disabled={!!refusDeLOption(cleDEntrainement(o))} title={refusDeLOption(cleDEntrainement(o))}>
            {t(o.advanced ? 'interlude.optionAvancee' : 'interlude.option', { label: o.label, px: o.xpCost, min: fmt(o.tutorMinBrass), max: fmt(o.tutorMaxBrass) })}
          </option>
        ))}
      </select>
    </ActivityPane>
  );
}

/** « Acquitter une Faveur » : consacre l'Activité à la progression d'une Faveur en cours, sans jet ; le
 *  volet lit le verdict `refusDAcquitterUneFaveur`. Rupture de la chaîne : `resetInterruptedFavorProgress`
 *  (noyau/favorFlow, #1040 [entériné 2026-08-03]). LDB 23 l.147-151, #509 */
function FavorSettlePane({ hero, etat, mene, favors }: { hero: Combatant; etat: EtatDeFaveur; mene?: string; favors: Favor[] }) {
  const settle = useGame((s) => s.solderLaFaveur);
  const [id, setId] = useState(favors[0]?.id ?? '');
  const sel = favors.find((f) => f.id === id) ?? favors[0];
  const required = sel ? favorRequiredActivities(sel.level) : null;
  const verdict = (sel ? refusDAcquitterUneFaveur(etat, hero.id, sel.id) : refusDActivite(etat, hero.id)) ?? undefined;
  const banniereFaveur = mene ? undefined : verdict;
  return (
    <ActivityPane
      id="pane-favor"
      icon="interface/balance"
      title="Acquitter une Faveur"
      blocked={banniereFaveur}
      note={sel
        ? <>{libelleDeValeur(favorLevelSchema, sel.level)} envers {sel.owedTo}{sel.desc ? ` — ${sel.desc}` : ''}{required != null ? ` (${sel.progress}/${required} Activité${required > 1 ? 's' : ''} consécutive${required > 1 ? 's' : ''})` : ''}</>
        : undefined}
      actions={
        <GatedAction
          id="interlude-favor-settle"
          label="Entreprendre"
          enabled={!mene && !verdict && !!sel}
          {...refusDuVolet('pane-favor', banniereFaveur, mene)}
          onClick={() => sel && settle(hero.id, sel.id)}
          btnClassName="small"
        />
      }
    >
      {favors.length > 1 && (
        <select className="interlude-select" value={id} onChange={(e) => setId(e.target.value)}>
          {favors.map((f) => (
            <option key={f.id} value={f.id}>{libelleDeValeur(favorLevelSchema, f.level)} envers {f.owedTo}</option>
          ))}
        </select>
      )}
    </ActivityPane>
  );
}

/** Passer commande (LDB 23 l.178-184) : objet Exotique payé MAINTENANT, livré au prochain interlude.
 *  Pas de jet — le pied porte le coût et la formule. */
function OrderPane({ hero, etat, mene, choix }: { hero: Combatant; etat: EtatDInterlude; mene?: string; choix?: string }) {
  const order = useGame((s) => s.commanderLObjet);
  const catalog = useMemo(() => orderCatalog(), []);
  const [id, setId] = useState(choix ?? '');
  const sel = catalog.find((o) => o.id === id);
  const verdict = (sel ? refusDeCommande(etat, hero.id, sel.id) : refusDActivite(etat, hero.id)) ?? undefined;
  const banniereOrdre = mene ? undefined : verdict;
  return (
    <ActivityPane
      id="pane-order"
      icon={PANE_ICON.order}
      title="Passer commande"
      blocked={banniereOrdre}
      cost={sel ? <CoinsB brass={sel.priceBrass} /> : undefined}
      note={<>payé maintenant — « l'objet sera achevé après votre prochaine aventure » (livré à l'ouverture du prochain interlude). Sans jet : 1 objet par Activité.</>}
      actions={
        <GatedAction
          id="interlude-order-go"
          label="Entreprendre"
          enabled={!mene && !verdict && !!sel}
          {...refusDuVolet('pane-order', banniereOrdre, mene ?? t('interlude.choisir.objet'))}
          onClick={() => sel && order(hero.id, sel.id)}
          btnClassName="small"
        />
      }
    >
      <TrappingSelect options={catalog} value={id} onChange={setId} />
    </ActivityPane>
  );
}

/** Opérations bancaires (LDB 23 l.164-176) + Mécénat (ACE 12 l.45-49) : dépôt sans jet — le pied porte
 *  les formules (Indice d'intérêts, découverte de planque) et les trois dépôts possibles. */
function BankPane({ hero, etat, mene, money, mecenat }: { hero: Combatant; etat: EtatDeDepot; mene?: string; money: Money; mecenat?: ActivityDef }) {
  const bankDeposit = useGame((s) => s.deposerALaBanque);
  const [amountPa, setAmountPa] = useState(10);
  const purseBrass = toBrass(money);
  const pa = Math.max(1, Math.floor(amountPa));
  const amountBrass = pa * PA_PER_SC;
  const quick = (frac: number) => setAmountPa(Math.max(1, Math.floor(purseBrass * frac / PA_PER_SC)));
  const devis = (kind: GenreDeDepot) => devisDeDepot(etat, hero.id, kind, amountBrass);
  const investir = devis('investir');
  const planquer = devis('planque');
  const mecene = devis('mecenat');
  // La planque n'a que les refus communs aux trois dépôts (Activité, bourse) : ils font la bannière.
  const banniereBourse = mene ? undefined : planquer.refus ?? undefined;
  // Chaque dépôt dit SON refus : lié à la bannière s'il est le sien, sinon porté par le bouton.
  const raisonDuDepot = (d: DevisDeDepot) => refusDuVolet('pane-bank', d.refus && d.refus === banniereBourse ? banniereBourse : undefined, mene ?? d.refus ?? undefined);
  return (
    <ActivityPane
      id="pane-bank"
      icon={PANE_ICON.bank}
      title="Opérations bancaires"
      blocked={banniereBourse}
      cost={<CoinsB brass={amountBrass} />}
      note={<>
        Sans jet · Investir : intérêts de l'Indice (1-10) %, faillite au retrait sur d100 ≤ Indice
        (retirer coûte 1 Activité) · Planquer : aucun intérêt, retrait libre, découverte sur d100 ≤ 10.
      </>}
      actions={<>
        <GatedAction
          id="interlude-bank-invest"
          label={<><Icon id="ressource/bourse" size="sm" /> Investir</>}
          ariaLabel="Investir"
          enabled={!mene && !investir.refus}
          {...raisonDuDepot(investir)}
          onClick={() => bankDeposit(hero.id, 'investir', amountBrass)}
          btnClassName="small"
        />
        <GatedAction
          id="interlude-bank-stash"
          label={<><Icon id="objet/divers" size="sm" /> Planquer</>}
          ariaLabel="Planquer"
          enabled={!mene && !planquer.refus}
          {...raisonDuDepot(planquer)}
          onClick={() => bankDeposit(hero.id, 'planque', amountBrass)}
          btnClassName="small"
        />
        {mecenat && (
          <GatedAction
            id="interlude-bank-mecenat"
            label={<><Icon id="scenario/opera" size="sm" /> Mécénat</>}
            ariaLabel="Mécénat"
            enabled={!mene && !mecene.refus}
            {...raisonDuDepot(mecene)}
            onClick={() => bankDeposit(hero.id, 'mecenat', amountBrass)}
            btnClassName="small"
          />
        )}
      </>}
    >
      <div className="interlude-actions">
        <label className="ed-field interlude-amount">
          Montant (pistoles d'argent)
          <NumberField variant="nu" label="Montant (pistoles d'argent)" min={1} value={amountPa} onChange={setAmountPa} />
        </label>
        <button className="btn small" onClick={() => quick(0.25)} title="Un quart de la bourse">¼</button>
        <button className="btn small" onClick={() => quick(0.5)} title="La moitié de la bourse">½</button>
        <button className="btn small" onClick={() => quick(1)} title="Toute la bourse">Tout</button>
      </div>
      <p className="interlude-detail">
        Votre bourse : <b><Coins money={money} /></b> · dépôt prévu : <b><CoinsB brass={planquer.depose} /></b>
      </p>
    </ActivityPane>
  );
}

/** Identifier un artefact : choisir un objet NON identifié du sac. ADE II 4 l.41 */
function IdentifyPane({ hero, etat, mene, desc, porteur }: { hero: Combatant; etat: EtatDeDepot; mene?: string; desc?: string; porteur?: Porteur }) {
  const def = activityById('identify')!;
  const composition = compositionDe(etat, hero.id, def.id);
  const { choisir, composer } = useComposer(hero, def.id, composition);
  const items = ciblesDActivite(hero, def).artefacts;
  const refusDeLObjet = refusDesValeurs(etat, hero.id, def.id, 'objet');
  const uid = composition?.cibles.itemUid || items[0]?.uid || '';
  const verdict = refusDOuvertureDActivite(etat, hero.id, def, { itemUid: uid }) ?? undefined;
  const blocked = mene ? undefined : verdict;
  return (
    <ActivityPane
      id="pane-identify"
      icon={PANE_ICON.identify}
      title="Identifier un artefact"
      desc={desc}
      porteur={porteur}
      blocked={blocked}
      prejet={prejetDuVolet(preJetDActivite(etat, hero.id, def, { itemUid: uid }), 'identify')}
      note={<>Une semaine d'étude · un grand succès révèle les Particularités ; une lourde méprise ancre de <b>fausses</b> certitudes.</>}
      actions={
        <GatedAction
          id="interlude-identify-go"
          label="Entreprendre"
          enabled={!mene && !verdict}
          {...refusDuVolet('pane-identify', blocked, mene)}
          onClick={() => composer(() => { choisir('interlude', 'objet', uid, hero.id); choisir('interlude', 'pratiquer', true, hero.id); })}
          btnClassName="small"
        />
      }
    >
      {items.length > 0 && (
        <select className="interlude-select" value={uid} disabled={!!mene} onChange={(e) => composer(() => choisir('interlude', 'objet', e.target.value, hero.id))} aria-label="Artefact à étudier">
          {items.map((i) => (
            <option key={i.uid} value={i.uid} disabled={!!refusDeLObjet(i.uid)} title={refusDeLObjet(i.uid)}>
              {i.label}{i.magicKnown ? ' ★' : ''}{i.suspectedQualities?.length ? ' (certitudes douteuses)' : ''}
            </option>
          ))}
        </select>
      )}
    </ActivityPane>
  );
}

/** Volet d'une Activité du CATALOGUE data-driven : description VERBATIM (`<Prose>`) ; pré-jet, cibles et
 *  refus lus au noyau (`preJetDActivite`, `ciblesDActivite`, `refusDOuvertureDActivite`). */
function CatalogPane({ hero, def, etat, mene }: { hero: Combatant; def: ActivityDef; etat: EtatDeDepot; mene?: string }) {
  const composition = compositionDe(etat, hero.id, def.id);
  const { choisir, composer } = useComposer(hero, def.id, composition);
  const { armes: weapons, artefacts, sorts: spellOptions, traitsPsy } = ciblesDActivite(hero, def);
  const refusDeLObjet = refusDesValeurs(etat, hero.id, def.id, 'objet');
  const refusDuTrait = refusDesValeurs(etat, hero.id, def.id, 'traitPsychologique');
  const refusDuSort = refusDesValeurs(etat, hero.id, def.id, 'sort');
  const uid = composition?.cibles.itemUid || weapons[0]?.uid || artefacts[0]?.uid || '';
  const spell = composition?.cibles.spellId || spellOptions[0]?.spell.id || '';
  const traitPsy = composition?.cibles.traitPsy || traitsPsy[0]?.cle || '';
  const choisirLObjet = (v: string) => composer(() => choisir('interlude', 'objet', v, hero.id));
  const cible = { ...(uid ? { itemUid: uid } : {}), ...(spell ? { spellId: spell } : {}), ...(traitPsy ? { traitPsy } : {}) };
  const verdict = refusDOuvertureDActivite(etat, hero.id, def, cible) ?? undefined;
  const blocked = mene ? undefined : verdict;
  const prejet = prejetDuVolet(preJetDActivite(etat, hero.id, def, cible), def.id);
  return (
    <ActivityPane
      id={`pane-catalog-${def.id}`}
      icon={def.icon}
      title={def.label}
      desc={def.desc}
      porteur={{ type: 'activities', id: def.id, chemin: 'desc' }}
      blocked={blocked}
      prejet={prejet}
      note={<>1 Activité — consommée au jet.</>}
      actions={
        <GatedAction
          id={`interlude-catalog-${def.id}`}
          label="Entreprendre"
          ariaLabel={`Entreprendre ${def.label}`}
          enabled={!mene && !verdict}
          {...refusDuVolet(`pane-catalog-${def.id}`, blocked, mene)}
          onClick={() => composer(() => {
            if (uid) choisir('interlude', 'objet', uid, hero.id);
            if (spell) choisir('interlude', 'sort', spell, hero.id);
            if (traitPsy) choisir('interlude', 'traitPsychologique', traitPsy, hero.id);
            choisir('interlude', 'pratiquer', true, hero.id);
          })}
          btnClassName="small"
        />
      }
    >
      {weapons.length > 0 && (
        <select className="interlude-select" value={uid} disabled={!!mene} onChange={(e) => choisirLObjet(e.target.value)} aria-label="Arme à maîtriser">
          {weapons.map((i) => <option key={i.uid} value={i.uid} disabled={!!refusDeLObjet(i.uid)} title={refusDeLObjet(i.uid)}>{i.label}</option>)}
        </select>
      )}
      {artefacts.length > 0 && (
        <select className="interlude-select" value={uid} disabled={!!mene} onChange={(e) => choisirLObjet(e.target.value)} aria-label="Objet magique à tester">
          {artefacts.map((i) => <option key={i.uid} value={i.uid} disabled={!!refusDeLObjet(i.uid)} title={refusDeLObjet(i.uid)}>{i.label}{i.magicKnown ? ' ★' : ''}</option>)}
        </select>
      )}
      {traitsPsy.length > 0 && (
        <select className="interlude-select" value={traitPsy} disabled={!!mene} onChange={(e) => composer(() => choisir('interlude', 'traitPsychologique', e.target.value, hero.id))} aria-label="Trait psychologique à éliminer">
          {traitsPsy.map((x) => <option key={x.cle} value={x.cle} disabled={!!refusDuTrait(x.cle)} title={refusDuTrait(x.cle)}>{libelleDePsy(x.trait.type, x.trait.cible)}</option>)}
        </select>
      )}
      {spellOptions.length > 0 && (
        <select className="interlude-select" value={spell} disabled={!!mene} onChange={(e) => composer(() => choisir('interlude', 'sort', e.target.value, hero.id))} aria-label="Sort à mémoriser">
          {spellOptions.map((x) => <option key={x.spell.id} value={x.spell.id} disabled={!!refusDuSort(x.spell.id)} title={refusDuSort(x.spell.id)}>{x.spell.label} — {x.cost} PX</option>)}
        </select>
      )}
    </ActivityPane>
  );
}

/** Volet d'une Activité de PRÉPARATION de bataille (ADE II 8), rendu DANS le menu d'interlude par le
 *  gabarit `ActivityPane` (comme toute Activité). « Entreprendre » ouvre le jet MENÉ par ce héros par le
 *  canal UNIQUE de bataille (`menerLActionDeBataille`) — l'issue porte sur l'ARMÉE,
 *  le budget d'Activité consommé est celui, UNIQUE, de l'interlude. Le pré-jet rend la ligne du Test que
 *  monte le geste (`preJetDePreparation`). */
function BattlePrepPane({ hero, etat, def, refus, massBattle: mb }: {
  hero: Combatant; etat: EtatDInterlude; def: ActivityDef; refus?: string;
  /** La bataille en attente de préparation : son verdict `refusDePrepaDeBataille`. */
  massBattle: MassBattleState | null;
}) {
  const battleActivity = useGame((s) => s.menerLActionDeBataille);
  // Pré-jet : les lignes du Test que monte le geste (`preJetDePreparation`) — Soutien, Test combiné,
  // Caractéristique déclarée et réservoir de modificateur compris.
  const test = mb ? preJetDePreparation(etat, mb, hero, def) : null;
  let prejet: PendingRoll | undefined;
  if (test) {
    const chips = testsDeLActivite(def).map((test, i) => (
      <Fragment key={i}>
        {i > 0 && (def.combined ? ' + ' : ' ou ')}
        <PuceDuTest test={test} />
      </Fragment>
    ));
    const { pending: pa, ligne2 } = test;
    const { ligne } = pa;
    const second = ligne2 && pa.skill2 ? { label: pa.skill2, base: ligne2.base, target: ligne2.target, difficulty: ligne2.difficulty } : undefined;
    prejet = withStake(testPending(<>{chips}</>, ligne.base, cibleMesuree(ligne), ligne.difficulty, ligne.mods, undefined, second), def.id);
  }
  const blocked = mb ? refusDePrepaDeBataille(mb, hero, def) : null;
  const soutien = noteDeSoutien(def);
  const undertake = () => battleActivity(hero.id, def.id);
  return (
    <ActivityPane
      id={`pane-prep-${def.id}`}
      icon={def.icon}
      title={def.label}
      desc={def.desc}
      porteur={{ type: 'activities', id: def.id, chemin: 'desc' }}
      blocked={blocked}
      prejet={prejet}
      note={<>1 Activité d'interlude — l'issue porte sur l'armée.{soutien ? ` ${soutien}` : ''}</>}
      actions={
        <GatedAction
          id={`interlude-prep-${def.id}`}
          label="Entreprendre"
          ariaLabel={`Entreprendre ${def.label}`}
          enabled={!refus && !blocked}
          {...refusDuVolet(`pane-prep-${def.id}`, blocked, refus)}
          onClick={undertake}
          btnClassName="small"
        />
      }
    />
  );
}

function BankList({ etat, canDrive }: {
  etat: EtatDeDepot;
  canDrive: (heroId: string) => boolean;
}) {
  const withdraw = useGame((s) => s.retirerDeLaBanque);
  return (
    <div className="interlude-actions">
      {etat.bank.map((b, i) => {
        const owner = etat.party.find((h) => h.id === b.heroId);
        const refus = canDrive(b.heroId) ? refusDeRetrait(etat, b.uid) : t('interlude.depositForeign');
        return (
          <GatedAction
            key={i}
            id={`interlude-bank-withdraw-${i}`}
            label={<>
              <Icon id={b.kind === 'investir' ? 'ressource/bourse' : b.kind === 'mecenat' ? 'scenario/opera' : 'objet/divers'} size="sm" />
              {' '}{libelleOuAbsence(owner, 'heros', b.heroId)} : <CoinsB brass={b.brass} />
              {b.kind === 'investir' && <> → <CoinsB brass={bankPayout('investir', b.brass, b.rate)} /> (Indice {b.rate})</>} — Retirer
            </>}
            ariaLabel={`Retirer le dépôt de ${libelleOuAbsence(owner, 'heros', b.heroId)}`}
            enabled={!refus}
            {...raisonSi(refus)}
            descOfferte={b.kind === 'investir'
              ? `Retirer (1 Activité) : ${fmt(bankPayout('investir', b.brass, b.rate))} si la banque tient (faillite sur d100 ≤ ${seuilDePerteBancaire('investir', b.rate)})`
              // ACE 12 l.49/57-65
              : b.kind === 'mecenat'
                ? 'Retirer le mécénat (1 Activité) : Test d’Évaluation Intermédiaire (+0) — rendu de 120 % à la perte totale'
                : `Retirer la planque (libre) : ${fmt(b.brass)} — découverte sur d100 ≤ ${seuilDePerteBancaire('planque', b.rate)}`}
            onClick={() => withdraw(b.uid)}
            primary={false}
            btnClassName="small"
          />
        );
      })}
    </div>
  );
}

/** Clôture confirmée : le devis de clôture (`devisDeCloture`), ce que sa validation (`fenetreValider('interlude')`) appliquera (audit M3). */
function CloseRecap({ etat, onCancel }: { etat: EtatDeCloture; onCancel: () => void }) {
  const valider = useGame((s) => s.fenetreValider);
  const devis = devisDeCloture(etat);
  if (!devis) return null;
  const nom = (heroId: string) => libelleOuAbsence(etat.party.find((h) => h.id === heroId), 'heros', heroId);
  const objet = (trappingId: string) => findTrappingById(trappingId)?.label ?? trappingId;
  return (
    <Modal title={t('interlude.recap.title')} onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>{t('interlude.recap.cancel')}</button>
          <button className="btn btn-primary" onClick={() => valider('interlude')}>{t('interlude.recap.confirm')}</button>
        </>
      }
    >
      <ul className="interlude-recap-list">
        <li>
          <Icon id="ressource/bourse" size="sm" /> {devis.gaspille > 0
            ? <><b><CoinsB brass={devis.gaspille} /></b> {t('interlude.recap.gaspille')}</>
            : t('interlude.recap.bourseVide')}
        </li>
        <li><Icon id="ressource/bourse" size="sm" /> {t('interlude.recap.revenus')} <b>{devis.revenu > 0 ? <CoinsB brass={devis.revenu} /> : t('interlude.recap.aucun')}</b>.</li>
        {devis.conserve > 0 && <li><Icon id="ressource/bourse" size="sm" /> {t('interlude.recap.conserve')} <b><CoinsB brass={devis.conserve} /></b>.</li>}
        {devis.commandes.length > 0 && (
          <li><Icon id="scenario/marche" size="sm" /> {t('interlude.recap.commandes', { liste: devis.commandes.map(objet).join(', ') })}</li>
        )}
        {devis.ouvrages.length > 0 && (
          <li><Icon id="objet/divers" size="sm" /> {t('interlude.recap.ouvrages', { liste: devis.ouvrages.map((o) => `${nom(o.heroId)} (${objet(o.trappingId)})`).join(', ') })}</li>
        )}
        {devis.retrogradations.map((r) => (
          <li key={r.heroId} className="interlude-blocked">
            <Icon id="interface/attention" size="sm" /> {t('interlude.recap.retrograde', { name: nom(r.heroId), level: r.niveau })}
          </li>
        ))}
        {devis.lots.flatMap(({ heroId, lots }) => lots.map((lot, i) => {
          // Les ÉTATS de clôture passent par la primitive partagée (chips + popover Codex), le Standing par sa
          // ligne, nommée par la source du lot.
          const conds = lot.ops.filter((o) => o.op === 'condition').map((o) => ({ id: o.id.id as ConditionId, value: typeof o.value === 'number' ? o.value : 1 }));
          const standing = lot.ops.reduce((n, o) => n + (o.op === 'statusMod' && typeof o.amount === 'number' ? o.amount : 0), 0);
          return (
            <Fragment key={`close-${heroId}-${i}`}>
              {conds.length > 0 && (
                <li className="interlude-blocked">
                  {nom(heroId)} : <EffectChips conditions={conds} /> {t('interlude.recap.premierJour')}
                </li>
              )}
              {standing !== 0 && <li>{t('interlude.close.standing', { name: nom(heroId), delta: `${standing > 0 ? '+' : ''}${standing}`, source: nomDeSource(lot.ctx) })}</li>}
            </Fragment>
          );
        }))}
        <li>
          <Icon id="temps/nuit" size="sm" /> {t('interlude.recap.temps', { n: devis.jours })} <GameDate time={devis.reprise} />.
        </li>
      </ul>
    </Modal>
  );
}
