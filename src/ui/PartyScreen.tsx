import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { nomDuSiege } from '../state/netFlow';
import { useGame, type GameState } from '../state/store';
import type { NetState } from '../state/netFlow';
import { ownsLocalNet } from './ownership';
import { makePregensWithWealth } from '../data/pregens';
import { rosterLoad, rosterRemove, rosterAdd, rosterExport, rosterImport } from '../state/roster';
import { PARTY_MAX } from '../state/combatants';
import { downloadText, fileSlug } from '../state/fileIo';
import { campaign, builtinCampaigns, campagneDuJeu } from '../scenes/campaign';
import { publishedProjects, campagneDeLEntree, playerEntryError, type SavedProject } from '../state/projectLibrary';
import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import { axisScore, AXIS_QUALIFY_MIN } from '../engine/axes';
import { CandidateCard, SeatCard, ActionCard, axisDataFor, type RecruitState } from './CharCard';
import { CharacterSheet } from './CharacterSheet';
import { ActiveModal } from './ActiveModal';
import { HeroPresentation } from './HeroPresentation';
import { Modal } from './Modal';
import { ScreenShell } from './ScreenShell';
import { GatedAction } from './GatedAction';
import { RoseAxes } from './RoseAxes';
import { DetailFrame } from './DetailFrame';
import { HeroSheet } from './HeroSheet';
import { MasterDetail } from './MasterDetail';
import { Icon } from './Icon';
import { Tabs } from './Tabs';
import { coreAxisIds } from '../data';
import { resolveActiveAxes } from '../state/worldMap';
import { t } from '../i18n';
import { Row } from './Layout';

/**
 * Écran d'équipe — solo ET coop. En coop, l'hôte attribue chaque SIÈGE (`net.slots`) ; chaque joueur
 * remplit LES SIENS (créer / roster local / pré-tiré) via `partyAddHero` — enveloppé en intent côté
 * invité, l'hôte reste autoritaire.
 *
 * STRUCTURE (arbitrage user 2026-07-13) : l'écran de groupe = LA COMPAGNIE SEULE (aucune galerie de
 * candidats inline — c'est un écran à part). Une grille de sièges : occupé = carte RICHE (portrait +
 * archétype + rôle + accroche, personnage cliquable → présentation) ; vide = placeholder sobre avec
 * deux actions « Créer » (créateur) / « Choisir » (sélecteur dédié). Le sélecteur (`HeroSelector`,
 * plein-champ `ScreenShell`) porte les onglets Mes personnages / Pré-tirés, les grandes cartes-portraits
 * et l'import — c'est LÀ qu'on recrute ou remplace. La compagnie a toujours toute la place (le problème
 * « 3/4 d'écran figé sur des candidats » disparaît).
 *
 * C'est AUSSI ici que se choisit la campagne (cartouche Campagne + « Changer ») — solo comme coop
 * (hôte seul ; les invités voient le nom via le snapshot). Le choix par défaut est l'Arène.
 */

/** Nav clavier des sièges (roving tabindex) : flèches Haut/Bas (colonne d'équipe) — ⇄ tolérées —
 *  vers le siège voisin (bouclé), Enter/Espace = présentation du héros assis (aucune action sur un
 *  siège vide — le recrutement se joue au sélecteur). Pur. */
export function slotKeyNav(key: string, idx: number, count: number): { focus: number } | 'primary' | null {
  const prev = key === 'ArrowUp' || key === 'ArrowLeft';
  const next = key === 'ArrowDown' || key === 'ArrowRight';
  if (prev || next) return { focus: (idx + (prev ? -1 : 1) + count) % count };
  return key === 'Enter' || key === ' ' ? 'primary' : null;
}

/** Appariement sièges → héros : le k-ième siège attribué au joueur S affiche le k-ième héros possédé
 *  par S (ordre de `party`). Les héros orphelins sont reversés dans les sièges vides restants. */
function slotViews(party: Combatant[], slots: number[], ownership: Record<string, number>) {
  const queues = new Map<number, Combatant[]>();
  for (const h of party) {
    const seat = ownership[h.id] ?? 0;
    queues.set(seat, [...(queues.get(seat) ?? []), h]);
  }
  const views = [0, 1, 2, 3].map((i) => {
    const seat = slots[i] ?? 0;
    return { seat, hero: queues.get(seat)?.shift() };
  });
  const leftovers = [...queues.values()].flat();
  for (const v of views) if (!v.hero && leftovers.length) v.hero = leftovers.shift();
  return views;
}

export function PartyScreen() {
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const loadProject = useGame((s) => s.loadProject);
  const pendingCampaign = useGame((s) => s.pendingCampaign);
  const sceneInProgress = useGame((s) => s.scene != null);
  const addHero = useGame((s) => s.partyAddHero);
  const removeHero = useGame((s) => s.partyRemoveHero);
  const replaceHero = useGame((s) => s.partyReplaceHero);
  const setEditingHero = useGame((s) => s.setEditingHero);
  const assignSlot = useGame((s) => s.netAssignSlot);
  const leave = useGame((s) => s.netLeave);
  const openPossessionsScreen = useGame((s) => s.openPossessionsScreen);
  const [campaignPick, setCampaignPick] = useState(false);

  const startCampaign = () => {
    if (pendingCampaign) {
      loadProject(pendingCampaign.scenes, pendingCampaign.startSceneId, pendingCampaign.worldMap ?? null, pendingCampaign.narratif);
    } else {
      startScene(campaign[0].scene);
    }
    setScreen('campaign');
  };

  const inProgress = sceneInProgress && !pendingCampaign;
  // Le choix de campagne appartient à l'hôte (ou au solo), hors partie en cours (« Reprendre »).
  const canPickCampaign = net.mode !== 'guest' && !inProgress;
  // Axes ACTIFS de la campagne (#409/#417) : `resolveActiveAxes` lit `activeAxes` sur
  // `pendingCampaign` (`ProjectDoc`, `state/worldMap.ts`) et retombe sur le socle `coreAxisIds`
  // si absent — SOURCE UNIQUE de ce défaut, jamais un `?? []` dispersé côté écran.
  const axisIds = resolveActiveAxes(pendingCampaign ?? {});

  return (
    <>
      <PartyScreenView
        party={party}
        net={net}
        axisIds={axisIds}
        title={t('party.title')}
        campaignName={pendingCampaign ? pendingCampaign.label : t('campaign.builtin')}
        onChangeCampaign={canPickCampaign ? () => setCampaignPick(true) : undefined}
        inProgress={inProgress}
        onMenu={() => setScreen('menu')}
        onPossessions={() => openPossessionsScreen()}
        onQuitCoop={() => { leave(); setScreen('menu'); }}
        onCreate={() => { setEditingHero(null); setScreen('creator'); }}
        onEditHero={(id) => { setEditingHero(id); setScreen('creator'); }}
        onAddHero={addHero}
        onRemoveHero={removeHero}
        onReplaceHero={(oldId, hero) => {
          // Le remplaçant prend le siège qui possédait l'ancien (solo : hôte, siège 0).
          const seat = net.ownership[oldId] ?? net.mySeat ?? 0;
          replaceHero(oldId, hero, seat);
        }}
        onAssignSlot={assignSlot}
        onStart={startCampaign}
        onResume={() => setScreen('campaign')}
      />
      {campaignPick && (
        <CampaignSelect
          currentId={pendingCampaign === null ? 'arene' : pendingCampaign.id}
          onClose={() => setCampaignPick(false)}
        />
      )}
    </>
  );
}

/** Modale de choix de la campagne : l'Arène (intégrée) + les projets PUBLIÉS de l'éditeur.
 *  `currentId` = id de la campagne active (`'arene'` pour l'intégrée, `undefined` si une vieille
 *  save persistée sans id — aucun surlignage, pas de crash, #608 Lot B). */
function CampaignSelect({ currentId, onClose }: { currentId: string | undefined; onClose: () => void }) {
  const setPendingCampaign = useGame((s) => s.setPendingCampaign);
  const published = useState(() => publishedProjects())[0];
  const [refusEntree, setRefusEntree] = useState<string | null>(null);
  const pick = (pc: GameState['pendingCampaign']) => {
    setPendingCampaign(pc);
    onClose();
  };
  const pickEntree = (p: SavedProject) => {
    setRefusEntree(null);
    let lancee: ReturnType<typeof campagneDeLEntree>;
    try {
      lancee = campagneDeLEntree(p);
    } catch (err) {
      setRefusEntree(playerEntryError(err, 'jouer'));
      return;
    }
    pick(lancee);
  };
  return (
    <Modal variant="plain" className="picker-modal" title={t('party.campaign.pick.title')} onClose={onClose} backdropClose>
        {refusEntree && <p className="chip tone-danger" role="alert">{refusEntree}</p>}
        <div className="pregen-list">
          <div className="pregen-row">
            <span className="campaign-row-name"><Icon id="scenario/arena" size="sm" /> {t('campaign.builtin')}</span>
            <button className="btn small btn-primary" disabled={currentId === 'arene'} onClick={() => pick(null)}>
              {currentId === 'arene' ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
            </button>
          </div>
          {builtinCampaigns.map((c) => (
            <div key={c.id} className="pregen-row">
              <span className="campaign-row-name"><Icon id={c.icon} size="sm" /> {c.label}</span>
              <button
                className="btn small btn-primary"
                disabled={currentId === c.id}
                onClick={() => pick(campagneDuJeu(c))}
              >
                {currentId === c.id ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
              </button>
            </div>
          ))}
          {published.map((p) => (
            <div key={p.id} className="pregen-row">
              <span className="campaign-row-name"><Icon id="nav/campaign" size="sm" /> {p.label}</span>
              <button
                className="btn small btn-primary"
                disabled={currentId === p.id}
                onClick={() => pickEntree(p)}
              >
                {currentId === p.id ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
              </button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={onClose}>
          {t('party.campaign.pick.close')}
        </button>
    </Modal>
  );
}

/** Cible ouverte dans le sélecteur dédié : recruter un siège vide, ou remplacer un héros en place. */
type SelectorTarget = { mode: 'recruit' } | { mode: 'replace'; heroId: string };

/** Couverture de GROUPE par axe + PORTEUR (le meilleur score) — même seuil `AXIS_QUALIFY_MIN` que le
 *  jumeau moteur `partyCoverage` (`engine/axes.ts`), réutilisé pour retrouver QUI porte la meilleure
 *  valeur QUALIFIÉE, ce que `partyCoverage` seul (agrégat nu, sans porteur) ne donne pas (#417 rail
 *  de composition). Sous le seuil : `value` ramené à 0 ET `heroName` omis — « à pourvoir », jamais une
 *  fausse couverture par Caractéristique nue (réfutation utilisateur 2026-07-15, le rail affichait
 *  Sigmund sur Discrétion à 0.31 < 0.45 alors que la carte de siège l'écartait déjà). */
function partyCoverageWithHero(party: Combatant[], axisIds: string[]): { id: string; label: string; value: number; heroName?: string }[] {
  return axisDataFor(axisIds).map((axis) => {
    let best = 0;
    let heroName: string | undefined;
    for (const h of party) {
      const v = axisScore(h, axis);
      if (v > best) { best = v; heroName = h.label; }
    }
    return best >= AXIS_QUALIFY_MIN ? { id: axis.id, label: axis.label, value: best, heroName } : { id: axis.id, label: axis.label, value: 0 };
  });
}

/** Numéraux romains des 4 sièges (« Contrat I »…« Contrat IV ») — habillage cérémoniel de la
 *  grille (planche ratifiée d'équipe, #417 correction de cap 2026-07-14 ; mot « acte » de la
 *  maquette remplacé par « contrat » [entériné 2026-07-14], moins ambigu). */
const ACT_ROMAN = ['I', 'II', 'III', 'IV'];
/** Nombre en toutes lettres (0-4, le format d'un mot dans le sous-titre « quatre sièges — deux
 *  scellés » — jamais un chiffre nu dans ce libellé cérémoniel). */
const NUM_WORDS_FR = ['zéro', 'un', 'deux', 'trois', 'quatre'];

/** Énumération « à la française » (Oxford comma absent, dernier élément lié par « et »). Pur. */
function joinFr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Phrase de synthèse du pied d'écran — composée depuis `partyCoverageWithHero` (axes ACTIFS à
 *  pourvoir), textes du patron de la planche ratifiée d'équipe (#417 correction de cap
 *  2026-07-14). */
function partySummaryText(party: Combatant[], axisIds: string[]): string {
  const n = party.length;
  const engaged = n === 0
    ? t('party.acts.summary.engaged.zero')
    : n === 1
      ? t('party.acts.summary.engaged.one')
      : t('party.acts.summary.engaged.many', { n });
  const ready = n > 0 ? t('party.acts.summary.ready') : t('party.acts.summary.notReady');
  const vierges = PARTY_MAX - n;
  const missingAxes = partyCoverageWithHero(party, axisIds).filter((c) => c.value === 0).map((c) => c.label);
  const viergePart = vierges === 0
    ? t('party.acts.summary.vierge.zero')
    : missingAxes.length === 0
      ? t(vierges === 1 ? 'party.acts.summary.vierge.one.plain' : 'party.acts.summary.vierge.many.plain', { n: vierges })
      : t(vierges === 1 ? 'party.acts.summary.vierge.one' : 'party.acts.summary.vierge.many', { n: vierges, axes: joinFr(missingAxes) });
  return `${engaged} — ${ready} ; ${viergePart}.`;
}

/** Rail du REGISTRE de compagnie : cartouche de campagne + rose de COMPOSITION (médaillon agrégé) +
 *  rangées d'axes (alvéole allumée = couverte + porteur, pointillés = à pourvoir). AIDE, jamais un
 *  blocage — le rail ne gate rien (#417, planche ratifiée d'équipe §A). */
function CompanyRail({ party, axisIds, campaignName, onChangeCampaign }: {
  party: Combatant[];
  axisIds: string[];
  campaignName?: string;
  onChangeCampaign?: () => void;
}) {
  const coverage = partyCoverageWithHero(party, axisIds);
  return (
    <aside className="party-rail">
      {campaignName && (
        <div className="camp-plate">
          <span className="camp-plate-eyebrow">{t('party.campaign.label')}</span>
          <span className="camp-plate-name">{campaignName}</span>
          {onChangeCampaign && (
            <button className="btn small" onClick={onChangeCampaign}>{t('party.campaign.change')}</button>
          )}
        </div>
      )}
      <div className="mini-title">{t('party.rail.composition')}</div>
      <div className="party-rail-rose">
        <RoseAxes
          axes={coverage.map((c) => ({ id: c.id, label: c.label, value: c.value > 0 ? c.value : null }))}
          size="medal"
          title={t('party.rose.company.title')}
        />
      </div>
      <div className="compo">
        {coverage.map((c) => (
          <div className={`compo-row${c.value > 0 ? '' : ' miss'}`} key={c.id}>
            <span className={`socket${c.value > 0 ? ' lit' : ''}`} aria-hidden="true" />
            <span className="compo-ax">{c.label}</span>
            <span className="compo-who">{c.heroName ?? t('party.rail.missing')}</span>
          </div>
        ))}
      </div>
      <p className="c-note party-rail-hint">{t('party.rail.hint')}</p>
    </aside>
  );
}

/** Vue pure de l'écran d'équipe (testable sans store — le rendu statique des tests lit
 *  l'état INITIAL de zustand, pas l'état muté). */
export function PartyScreenView({
  party,
  net,
  title,
  campaignName,
  onChangeCampaign,
  axisIds = coreAxisIds(),
  inProgress,
  onMenu,
  onPossessions,
  onQuitCoop,
  onCreate,
  onEditHero,
  onAddHero,
  onRemoveHero,
  onReplaceHero,
  onAssignSlot,
  onStart,
  onResume,
}: {
  party: Combatant[];
  net: NetState;
  title: string;
  /** Campagne sélectionnée (cartouche du rail). Absent = cartouche masqué (vue partielle/tests). */
  campaignName?: string;
  /** Axes ACTIFS de la campagne (rose des forces, rail de composition, #417). `coreAxisIds` par défaut. */
  axisIds?: string[];
  /** Ouvre le choix de campagne — absent = lecture seule (invité coop, partie en cours). */
  onChangeCampaign?: () => void;
  /** Une partie est en cours (scène vivante, hors lancement explicite de campagne) :
   *  « Reprendre » prend la primauté, « Commencer » resterait sinon le seul chemin et
   *  écraserait silencieusement la progression (chargement d'une save coop inclus). */
  inProgress?: boolean;
  onMenu: () => void;
  /** Ouvre l'écran Possessions (bêtes/serviteurs/véhicules/navires du groupe, #620 Lot 2). */
  onPossessions?: () => void;
  onQuitCoop: () => void;
  onCreate: () => void;
  /** Ouvre le créateur en MODIFICATION pour ce héros (bouton « Modifier »). Absent = non éditable. */
  onEditHero?: (heroId: string) => void;
  onAddHero: (h: Combatant, wealth?: Money) => void;
  onRemoveHero: (heroId: string) => void;
  /** Remplace EN PLACE le héros `oldId` par celui choisi dans le sélecteur (bouton « Remplacer »).
   *  Absent = pas de bouton « Remplacer ». La bourse (`wealth`) est ignorée (pas un recrutement). */
  onReplaceHero?: (oldId: string, hero: Combatant, wealth?: Money) => void;
  onAssignSlot: (slot: number, seat: number) => void;
  onStart: () => void;
  onResume?: () => void;
}) {
  // Sélecteur dédié ouvert (recrutement d'un siège vide OU remplacement ciblé).
  const [selector, setSelector] = useState<SelectorTarget | null>(null);
  // Roving tabindex : UN seul siège tabbable ; flèches haut/bas entre sièges, Enter/Espace = présentation
  // du héros assis. Cf. `slotKeyNav` (pur).
  const [focusSlot, setFocusSlot] = useState(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Cliquer le portrait/nom d'un héros ouvre sa PRÉSENTATION (récit) ; « Fiche complète » y mène ensuite
  // à CharacterSheet (chiffres) pour un membre du groupe.
  // Héros au STORE (`sheetId`, patron `inspectId`) — partagé avec CampaignView pour que la fiche
  // survive au switch de héros entre les deux hôtes.
  const sheetId = useGame((s) => s.sheetId);
  const setSheetId = useGame((s) => s.setSheetId);
  const [presentHero, setPresentHero] = useState<Combatant | null>(null);
  // Solo : carte siège→héros STABLE — le siège d'un héros retiré RESTE en place (le trou ne file plus
  // à droite). Réconciliée avec `party`. En coop, on garde `slotViews` (sièges attribués).
  const [slotMap, setSlotMap] = useState<(string | null)[]>(() => {
    const m: (string | null)[] = Array.from({ length: PARTY_MAX }, () => null);
    party.forEach((h, i) => { if (i < PARTY_MAX) m[i] = h.id; });
    return m;
  });
  useEffect(() => {
    setSlotMap((prev) => {
      const ids = new Set(party.map((h) => h.id));
      const next = prev.map((id) => (id && ids.has(id) ? id : null));
      const placed = new Set(next.filter((x): x is string => !!x));
      for (const h of party) {
        if (placed.has(h.id)) continue;
        const e = next.indexOf(null);
        if (e >= 0) { next[e] = h.id; placed.add(h.id); }
      }
      return next.every((v, i) => v === prev[i]) ? prev : next;
    });
  }, [party]);

  const coop = net.mode !== 'local';
  const isHost = net.mode !== 'guest';
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const seatName = (seat: number) => nomDuSiege(net, seat);
  const views = coop
    ? slotViews(party, net.slots ?? [0, 0, 0, 0], net.ownership)
    : slotMap.map((id) => ({ seat: 0, hero: id ? party.find((h) => h.id === id) : undefined }));
  // Porte UI UNIQUE (#1262) : le siège se lit par le routage d'état, jamais par une comparaison recopiée.
  const ownsHero = (id: string) => ownsLocalNet(net, id);
  /** Un siège attribué à un invité n'est pas rempli → l'hôte ne peut pas lancer. */
  const guestPending = views.some((v) => v.seat !== 0 && !v.hero);

  // Recrutement / remplacement : un seul chemin, le SÉLECTEUR dédié.
  const onSelectorPick = (h: Combatant, wealth?: Money) => {
    if (!selector) return;
    if (selector.mode === 'replace') {
      onReplaceHero?.(selector.heroId, h, wealth);
    } else if (party.length < PARTY_MAX && !party.some((p) => p.id === h.id)) {
      onAddHero(h, wealth);
    }
    setSelector(null);
  };
  const selectorReplaceName =
    selector?.mode === 'replace' ? party.find((h) => h.id === selector.heroId)?.label : undefined;
  const inParty = (id: string) => party.some((p) => p.id === id);

  return (
    <div className="screen party-screen">
      <header className="bar">
        {net.mode === 'guest' ? (
          <button className="btn small" onClick={onQuitCoop}>
            {t('party.back.quit')}
          </button>
        ) : (
          <button className="btn small" onClick={onMenu}>
            {t('party.back.menu')}
          </button>
        )}
        <h2>{title} ({party.length}/{PARTY_MAX})</h2>
        {onPossessions && (
          <button className="btn small" onClick={onPossessions}>
            <Icon id="travel/mount" size="sm" /> Possessions
          </button>
        )}
        {net.mode === 'guest' && (
          <span className="hint"><Icon id="ui/wait" size="sm" /> {t('party.guest.waiting')}</span>
        )}
      </header>
      {isHost && guestPending && (
        <p className="hint party-coop-hint"><Icon id="ui/wait" size="sm" /> {t('party.coop.pending')}</p>
      )}

      {/* L'écran de groupe = LA COMPAGNIE SEULE (grille de sièges, 2×2, généreuse) + le RAIL du
          registre (campagne + composition, #417). Aucune galerie ici. */}
      <div className="party-main">
      <CompanyRail party={party} axisIds={axisIds} campaignName={campaignName} onChangeCampaign={onChangeCampaign} />
      <div className="party-company">
        <Row className="party-acts-header">
          <h3 className="party-acts-title">{t('party.acts.title')}</h3>
          <span className="party-acts-subtitle">
            {t(party.length <= 1 ? 'party.acts.subtitle.one' : 'party.acts.subtitle', { seats: NUM_WORDS_FR[PARTY_MAX], sealed: NUM_WORDS_FR[Math.min(party.length, PARTY_MAX)] })}
          </span>
        </Row>
        <div className="party-roster" aria-label={t('party.acts.title')}>
          {views.map(({ seat, hero: h }, i) => {
            const mine = !coop || seat === net.mySeat;
            return (
              <div
                className={`seat-slot ${h ? 'filled' : 'empty'}`}
                key={i}
                ref={(el) => { slotRefs.current[i] = el; }}
                style={{ '--i': i } as CSSProperties}
                role="group"
                aria-label={t('party.slot.adventurer', { n: i + 1 })}
                tabIndex={i === focusSlot ? 0 : -1}
                onFocus={(e) => { if (e.target === e.currentTarget) setFocusSlot(i); }}
                onKeyDown={(e) => {
                  const nav = slotKeyNav(e.key, i, views.length);
                  if (!nav) return;
                  if (nav === 'primary') {
                    if (e.target !== e.currentTarget) return; // contrôle interne (select…) = lui, pas le siège
                    if (!h) return;
                    e.preventDefault();
                    setPresentHero(h);
                  } else {
                    e.preventDefault();
                    setFocusSlot(nav.focus);
                    slotRefs.current[nav.focus]?.focus();
                  }
                }}
              >
                {coop && (net.mode === 'host' && !h ? (
                  <label className="slot-owner">
                    <span>{t('party.slot.player')}</span>
                    <select value={seat} onChange={(e) => onAssignSlot(i, Number(e.target.value))}>
                      {seats.map(({ seat: s, name: n }) => (
                        <option key={s} value={s}>{s === 0 ? `${n} (hôte)` : n}</option>
                      ))}
                    </select>
                  </label>
                ) : h ? (
                  <div className="slot-owner hint"><Icon id="nav/seat-owner" size="sm" /> {seatName(seat)}{seat === net.mySeat ? t('party.slot.you') : ''}</div>
                ) : null)}
                {h ? (
                  <SeatCard
                    hero={h}
                    seatLabel={t('party.acts.badge', { n: ACT_ROMAN[i] })}
                    axisIds={axisIds}
                    onPresent={() => setPresentHero(h)}
                    actions={ownsHero(h.id) && (
                      <>
                        {onEditHero && (
                          <button className="btn small ghost" onClick={() => onEditHero(h.id)}>{t('party.hero.edit')}</button>
                        )}
                        {onReplaceHero && (
                          <button className="btn small ghost" onClick={() => setSelector({ mode: 'replace', heroId: h.id })}>{t('party.hero.replace')}</button>
                        )}
                        <button className="btn small ghost danger" onClick={() => onRemoveHero(h.id)}>{t('party.hero.remove')}</button>
                      </>
                    )}
                  />
                ) : (
                  <div className="seat-empty">
                    <span className="seat-contract-badge">{t('party.acts.badge', { n: ACT_ROMAN[i] })}</span>
                    <span className="seat-empty-title">{t('party.acts.empty.title')}</span>
                    <span className="hint seat-invite">
                      {mine ? t('party.slot.invite') : <><Icon id="ui/wait" size="sm" /> {t('party.slot.waiting', { name: seatName(seat) })}</>}
                    </span>
                    {mine && (
                      <Row className="seat-empty-actions">
                        <button className="btn small" onClick={onCreate}>{t('party.seat.create')}</button>
                        <button className="btn small btn-primary" onClick={() => setSelector({ mode: 'recruit' })}>{t('party.seat.choose')}</button>
                      </Row>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {net.mode !== 'guest' && (
        <Row as="footer" className="party-actions">
          <p className="party-actions-summary">{partySummaryText(party, axisIds)}</p>
          <Row className="party-actions-buttons">
            {inProgress && (
              <button className="btn btn-primary" onClick={onResume}>
                {t('party.action.resume')}
              </button>
            )}
            {/* « Commencer » gaté : raison EN CLAIR (`raisonInline`) — en coop, c'est le SEUL signal que
                la table attend un invité ; personne ne survole un bouton pour savoir pourquoi on n'a pas
                encore commencé (exception nommée à l'arbitrage user 2026-08-24, qui vise les CASES). */}
            <GatedAction
              id="party-start"
              raisonInline
              className="party-start"
              label={t('party.action.start')}
              enabled={party.length > 0 && !guestPending}
              reason={guestPending ? t('party.action.start.guestPending') : t('party.action.start.empty')}
              primary={!inProgress}
              onClick={onStart}
            />
          </Row>
        </Row>
      )}

      {selector && (selector.mode === 'recruit' || onReplaceHero) && (
        <HeroSelector
          party={party}
          mode={selector.mode}
          axisIds={axisIds}
          replaceName={selectorReplaceName}
          onPick={onSelectorPick}
          onCreate={onCreate}
          onClose={() => setSelector(null)}
        />
      )}
      {presentHero && (
        <HeroPresentation
          hero={presentHero}
          onFullSheet={inParty(presentHero.id) ? () => { setSheetId(presentHero.id); setPresentHero(null); } : undefined}
          onClose={() => setPresentHero(null)}
        />
      )}
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
      {/* Arbitre R2 : CharacterSheet ouvre AUSSI des modales de combat/dissipation (Dissiper, #461)
          depuis cet écran — même patron que CampaignView/InterludeScreen/MassBattleView. */}
      <ActiveModal />
    </div>
  );
}

/** Sélecteur d'aventurier DÉDIÉ (« un écran différent et adapté », arbitrage user 2026-07-13) : écran
 *  plein-champ `ScreenShell` portant les onglets Mes personnages / Pré-tirés, les grandes cartes-portraits
 *  et l'import. Recrute un siège vide (`recruit`, les déjà-recrutés quittent l'étal) ou remplace un héros
 *  en place (`replace`, les membres restent grisés « Déjà choisi »). Source unique de la carte-portrait
 *  = `CandidatePool`/`CandidateCard`. */
export function HeroSelector({
  party,
  mode,
  axisIds = coreAxisIds(),
  replaceName,
  onPick,
  onClose,
  onCreate,
}: {
  party: Combatant[];
  mode: 'recruit' | 'replace';
  /** Axes ACTIFS de la campagne (glyphes de rose des candidats, #417). `coreAxisIds` par défaut. */
  axisIds?: string[];
  /** Nom du héros remplacé (titre du mode `replace`). */
  replaceName?: string;
  onPick: (h: Combatant, wealth?: Money) => void;
  onClose: () => void;
  /** Ouvre le créateur (carte-action « Créer un personnage »). */
  onCreate?: () => void;
}) {
  const replace = mode === 'replace';
  return (
    <ScreenShell
      title={replace ? t('picker.title.replace', { name: replaceName ?? '' }) : t('party.select.title')}
      onClose={onClose}
      body="centered-wide"
      className="hero-selector"
    >
      <CandidatePool
        party={party}
        variant={replace ? 'modal' : 'gallery'}
        axisIds={axisIds}
        onPick={onPick}
        hideInParty={!replace}
        onCreate={onCreate}
      />
    </ScreenShell>
  );
}

/** Vivier de candidats — personnages sauvegardés (roster localStorage LOCAL du joueur) + pré-tirés,
 *  onglets Mes personnages / Pré-tirés, cartes-action créer/importer. Rendu DANS le sélecteur dédié
 *  (`HeroSelector`) : source unique de la carte-portrait `CandidateCard`, en mode `gallery` (recrutement,
 *  grandes cartes) ou `modal` (remplacement — les membres restent grisés « Déjà choisi »). */
export function CandidatePool({
  party,
  onPick,
  variant = 'gallery',
  canRecruit = true,
  hideInParty = false,
  axisIds = coreAxisIds(),
  onCreate,
}: {
  party: Combatant[];
  onPick: (h: Combatant, wealth?: Money) => void;
  /** `gallery` = recrutement (les recrutés quittent l'étal) ; `modal` = remplacement (membres grisés). */
  variant?: 'gallery' | 'modal';
  /** Un siège reste-t-il à pourvoir ? Sinon « Recruter » est grisé (groupe complet). */
  canRecruit?: boolean;
  /** Écarte du vivier les personnages DÉJÀ dans le groupe (recrutement) : un recruté quitte l'étal. Le
   *  mode remplacement (`false`) les garde, grisés « Déjà choisi ». */
  hideInParty?: boolean;
  /** Axes ACTIFS de la campagne (glyphe + médaillon de rose, #417). `coreAxisIds` par défaut. */
  axisIds?: string[];
  /** Ouvre le créateur (carte-action « Créer un personnage »). */
  onCreate?: () => void;
}) {
  const allPregens = useState(() => makePregensWithWealth())[0];
  const [roster, setRoster] = useState(() => rosterLoad());
  const [tab, setTab] = useState<'roster' | 'pregens'>(roster.length ? 'roster' : 'pregens');
  const [importErr, setImportErr] = useState<string | null>(null);
  // Candidat ÉLU (déplié dans l'ACTE DE PRÉSENTATION, `DetailFrame`) — plus de modale (#417,
  // planche ratifiée d'équipe §B « la présentation intégrée au sélecteur »).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setScreen = useGame((s) => s.setScreen);
  const setEditingHero = useGame((s) => s.setEditingHero);

  const inParty = (id: string) => party.some((p) => p.id === id);
  const shownPregens = hideInParty ? allPregens.filter((e) => !inParty(e.hero.id)) : allPregens;
  const shownRoster = hideInParty ? roster.filter((e) => !inParty(e.hero.id)) : roster;
  const state: RecruitState = { status: canRecruit ? 'available' : 'blocked' };
  const shownList: { hero: Combatant; wealth?: Money }[] =
    tab === 'roster' ? shownRoster.map(({ hero, wealth }) => ({ hero, wealth })) : shownPregens.map(({ hero, wealth }) => ({ hero, wealth }));
  const selected = shownList.find((e) => e.hero.id === selectedId) ?? shownList[0] ?? null;

  const removeSaved = (id: string) => {
    rosterRemove(id);
    setRoster(rosterLoad());
  };
  const exportHero = (entry: { hero: Combatant; wealth: Money }) =>
    downloadText(`wfrp4-perso-${fileSlug(entry.hero.label)}.json`, rosterExport(entry));
  const startCreate = () => {
    if (onCreate) return onCreate();
    setEditingHero(null);
    setScreen('creator');
  };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const result = rosterImport(await file.text());
    if (!result.entry) {
      setImportErr(result.error);
      return;
    }
    rosterAdd(result.entry);
    setRoster(rosterLoad());
    setImportErr(null);
    setTab('roster');
  };

  return (
    <>
      <Tabs
        className="sheet-tabnav"
        tabs={[
          { key: 'roster' as const, label: t('picker.tab.roster') },
          { key: 'pregens' as const, label: t('picker.tab.pregens') },
        ]}
        active={tab}
        onChange={setTab}
      />

      <MasterDetail
        className="candidate-master-detail"
        listLabel={t('party.select.title')}
        list={
          <div className="candidate-grid">
            {tab === 'roster'
              ? shownRoster.map(({ hero, wealth }) => (
                  <CandidateCard
                    key={hero.id}
                    hero={hero}
                    variant={variant}
                    state={state}
                    recruited={inParty(hero.id)}
                    wealth={wealth}
                    axisIds={axisIds}
                    selected={selected?.hero.id === hero.id}
                    onRecruit={() => onPick(hero, wealth)}
                    onPresent={() => setSelectedId(hero.id)}
                    onExport={() => exportHero({ hero, wealth })}
                    onDelete={() => removeSaved(hero.id)}
                  />
                ))
              : shownPregens.map(({ hero: h, wealth }) => (
                  <CandidateCard
                    key={h.id}
                    hero={h}
                    variant={variant}
                    state={state}
                    recruited={inParty(h.id)}
                    wealth={wealth}
                    axisIds={axisIds}
                    selected={selected?.hero.id === h.id}
                    onRecruit={() => onPick(h, wealth)}
                    onPresent={() => setSelectedId(h.id)}
                  />
                ))}
            {/* Cartes-action (même famille visuelle) : UNE carte « Créer un personnage » ; « Importer » à
                côté, dans l'onglet Mes personnages. */}
            <ActionCard icon="nav/new-game" label={t('picker.roster.create')} invite={t('party.create.invite')} onClick={startCreate} />
            {tab === 'roster' && (
              <ActionCard icon="file/import" label={t('picker.import.btn')} invite={t('party.import.invite')} title={t('picker.import.btn.title')} onClick={() => fileRef.current?.click()} />
            )}
          </div>
        }
        detail={
          selected ? <CandidateDetailPane hero={selected.hero} wealth={selected.wealth} axisIds={axisIds} /> : <p className="hint">{t('picker.detail.empty')}</p>
        }
      />
      {importErr && <p className="hint danger candidate-import-err">{importErr}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => { void onImportFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </>
  );
}

/** ACTE DE PRÉSENTATION du candidat élu — `DetailFrame` (prose sourcée) enveloppant `HeroSheet`
 *  (#417 → consécration primitive, constat utilisateur 2026-07-15 « La fiche vivante ce n'est pas
 *  une primitive ? »). Un candidat EST un `Combatant` complet (pregen) : `HeroSheet` porte SA bande
 *  d'en-tête (figurine+identité+rose) — pas de `topper` `DetailFrame` en double. Aucun bouton dédié :
 *  le recrutement reste sur la carte de la liste (`CandidateCard`), jamais dupliqué ici. */
function CandidateDetailPane({ hero, wealth, axisIds }: { hero: Combatant; wealth?: Money; axisIds: string[] }) {
  const proseParts: string[] = [];
  if (hero.motivation) proseParts.push(`**${t('present.motivation')} :** ${hero.motivation}`);
  if (hero.details?.ambitionShort) proseParts.push(`« ${hero.details.ambitionShort} »`);
  if (hero.details?.ambitionLong) proseParts.push(`${t('present.ambitionLong')} : ${hero.details.ambitionLong}`);
  const prose = proseParts.length > 0 ? proseParts.join('\n\n') : t('present.noStory');

  return (
    <div className="candidate-detail-pane">
      <DetailFrame
        sections={<HeroSheet hero={hero} axisIds={axisIds} wealth={wealth} />}
        prose={prose}
      />
    </div>
  );
}
