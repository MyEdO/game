/**
 * Garde STRUCTURELLE de la possession par PORTEUR DU JET (#1005, étendue à TOUS les flux mono par
 * #1015) : pour CHAQUE flux `kind:'mono'` de `FLOW_VERBS` — énumération de la table, jamais une liste
 * locale —
 *  (a) l'hôte n'accepte ses verbes que du siège qui POSSÈDE le porteur du jet : jet d'un héros du
 *      siège 1 → seul le siège 1 dépense ; jet d'un ENNEMI sous siège MJ → seul le siège MJ ;
 *  (b) sans le pending correspondant (fenêtre fermée), personne ne dépense ;
 *  (c) NON-RÉGRESSION : dans le MÊME état, les rangées MULTI de la fenêtre (opposition de cible,
 *      Contre-sort) gardent leur possession PAR PARTICIPANT — le gate du lanceur ne les ferme pas ;
 *  (e) SURFACE RÉSEAU : le sous-ensemble de verbes réellement atteignable par un invité
 *      (`GUEST_INTENTS`, consulté AVANT `intentAllowedFor` par `hote/coop/session.ts`) est asserté par flux.
 *
 * La chaîne réparée : un Sort ennemi ouvre son étape en `groupOwner` (`combatFlow.openCastCascade`) →
 * `modalArbiter` rend l'owner `'*'` (pour que cible et contre-lanceurs voient la fenêtre) → sans route
 * par porteur, `intentAllowedFor` acceptait `jetForceSuccess('cast')` de N'IMPORTE quel siège.
 *
 * LIMITE STRUCTURELLE (consigne de design, #1013) : la fixture `state()` ci-dessous POSE le pending
 * d'après la table elle-même (`[jet.pending]:{[jet.field]:…}`). Elle vérifie donc le ROUTAGE (le
 * porteur déclaré gouverne la dépense), jamais que le couple `pending`/`field` décrit la forme RÉELLE
 * de l'état : inverser `defenderId`↔`attackerId` dans `FLOW_VERBS` laisserait cette garde VERTE. Ce plan-là est couvert par `jet-owner-vs-spec.test.ts` (confrontation
 * table⇄`spec.actor` sur sentinelles distinctes) et par les sondes de flux RÉEL
 * (`jet-owner-real-flows.hors-store.test.ts`, `attack-intent-ownership.hors-store.test.ts`,
 * `cast-influence-ownership.test.tsx`). L'INVENTAIRE littéral ci-dessous NOMME les gestes routés ET
 * leur surface invité : une ligne de table qui disparaît sort de la boucle par flux SANS échec de
 * structure — seule l'assertion nominative la rattrape.
 */
import { describe, it, expect } from 'vitest';
import { estVerbeDeFenetre, FLOW_VERBS, NOM_DU_VERBE_DE_JET, type JetOwnerRef, type RollVerb } from './flowVerbs';
import { intentAllowedFor, seatInfluences } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { GUEST_INTENTS } from './intentionsDeSiege';
import type { Jeu } from './etat';
import { cascadeDeTest } from './cascade.testkit';
import { PENDING_BY_JET, type HostJet } from './slotsDeJet';
import { testDeRegle } from '../engine/reglesChiffrees';
import { cleDeFixture } from './noyau.testkit';
import { REGLAGES_DU_JET, type DeclarationDuReglage } from './reglagesDuJet';

type Entry = { kind: 'mono' | 'multi'; verbs: readonly RollVerb[]; jetOwner?: JetOwnerRef };
const ENTRIES = Object.entries(FLOW_VERBS) as [string, Entry][];
const JET_OWNED = ENTRIES.filter(([, w]) => w.kind === 'mono' && !!w.jetOwner);

/**
 * INVENTAIRE NOMINATIF des 27 flux mono (#1015, étendu #1017) — par flux, la liste LITTÉRALE de ses
 * verbes, écrite à la main. Elle est confrontée à DEUX mesures qui, depuis #1017, doivent coïncider :
 *  - `FLOW_VERBS` : les verbes que le flux accepte, dont la possession suit le porteur du jet (`jetOwner`) — TOUS,
 *    `cancel` compris (fermer le jet d'autrui par une fenêtre partagée `'*'` était ouvert à tous les sièges) ;
 *  - `GUEST_INTENTS` : les gestes réellement atteignables par un invité — TOUS également, la surface étant
 *    DÉRIVÉE de la possession, sans marqueur à poser (règle générale de possession). Une surface nulle ou
 *    partielle est donc un ÉCHEC, pas un état de fait.
 * La liste reste écrite ICI à la main (jamais dérivée de `FLOW_VERBS`) : sinon une ligne de table
 * disparue sortirait de l'itération sans rien casser (leçon #1015).
 */
const INVENTORY: Record<string, readonly RollVerb[]> = {
  attack:     ['roll', 'reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse', 'confirm'],
  defense:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'confirm'],
  cast:       ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  disengage:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  auContact:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  grapple:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  battement:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel', 'confirm'],
  distraire:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  maneuver:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  run:        ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'],
  reload:     ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  handGate:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  recover:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  focus:      ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  dispel:     ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  frenzy:     ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'],
  approach:   ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'reverse', 'cancel', 'confirm'],
  ward:       ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'],
  heal:       ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel', 'confirm'],
  surgery:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  corruption: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'confirm'],
  test:       ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'determine', 'cancel', 'reverse', 'confirm'],
  steamSave:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'confirm'],
  activity:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'reverse', 'confirm'],
  bargain:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  appraise:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'],
  shanty:     ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'],
};

const H_HOST = 'h1'; // héros du siège 0 (hôte)
const H_GUEST = 'h2'; // héros du siège 1
const ENEMY = 'e1';

/** L'étape-hôte qui rend le jet porté par `pending` (`PENDING_BY_JET`) : une cascade PARTAGÉE dont le
 *  corps est ce slot. Un pending hors cascade garde l'étape d'incantation. */
const jetHote = (pending: string): HostJet =>
  (Object.entries(PENDING_BY_JET) as [HostJet, string | null][]).find(([, slot]) => slot === pending)?.[0] ?? 'cast';
/** Fenêtre du flux `jet` OUVERTE sur `ownerId` (son pending posé selon `jetOwner`), étape de cascade
 *  PARTAGÉE (owner de modale '*'). Le pending est POSÉ PAR LA TABLE : ajouter un `jetOwner` à un flux
 *  l'amène dans la garde sans une ligne de fixture. */
const state = (jet: JetOwnerRef, ownerId: string, over: Partial<Jeu> = {}): Jeu =>
  ({
    net: { mode: 'host', mySeat: 0, gmSeat: 2, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'MJ' }, ownership: { h2: 1 }, slots: [0, 1, 0, 0] },
    party: [{ id: H_HOST }, { id: H_GUEST }],
    battle: { order: [H_HOST, H_GUEST, ENEMY], turn: 0, combatants: [
      { id: H_HOST, kind: 'hero' }, { id: H_GUEST, kind: 'hero' }, { id: ENEMY, kind: 'enemy' },
    ] },
    pendingCascade: cascadeDeTest([{ id: 's0', kind: cleDeFixture(`${jetHote(jet.pending)}Jet`), jet: jetHote(jet.pending), groupOwner: true }]),
    [jet.pending]: { [jet.field]: ownerId, targetId: H_HOST, spellId: 'drain', result: null },
    ...over,
  }) as unknown as Jeu;

const CAST_JET: JetOwnerRef = { pending: 'pendingCast', field: 'casterId' };
/** Le verbe de jet `v` sur `flux` et ses arguments (`VerbesDeJet`), la rangée `pid` posée sur un flux multi. */
const geste = (flux: string, v: RollVerb, pid?: string): [string, unknown[]] =>
  [NOM_DU_VERBE_DE_JET[v], [flux, ...(v === 'setForcedRoll' ? [42] : []), ...(pid ? [pid] : [])]];

describe('#1005/#1015 — flux MONO : la dépense suit le PORTEUR du jet', () => {
  it('la table porte bien les porteurs (sinon la garde ci-dessous ne mesure rien)', () => {
    expect(JET_OWNED.map(([k]) => k), 'aucun flux mono ne déclare `jetOwner`').not.toEqual([]);
    expect(FLOW_VERBS.cast.jetOwner, 'la Résilience du lanceur doit être routée par porteur').toEqual(CAST_JET);
    // INVENTAIRE LITTÉRAL : la boucle par flux ci-dessous se contente en silence de ce que la table
    // déclare (une ligne retirée = un flux qui sort de l'itération, sans échec). Cette liste NOMME les
    // verbes attendus → toute ligne `jetOwner` disparue (ou ajoutée sans garde de flux réel) est rouge.
    expect(Object.fromEntries(JET_OWNED.map(([p, w]) => [p, [...w.verbs].sort()]))).toEqual(Object.fromEntries(Object.entries(INVENTORY).map(([p, vs]) => [p, [...vs].sort()])));
  });

  /**
   * #700 — la CHUTE est un flux MULTI (`MultiPending<TombantParticipant>`) : ses gestes sortent de la
   * route par porteur mono et passent par le TOMBANT de la rangée (`pid` = son id) ; sa déclaration
   * `fallChoose` suit la même possession (`seatInfluences`). Liste littérale.
   */
  it('#700 — la chute (multi) : ses intents suivent le TOMBANT de la rangée, jamais le porteur mono', () => {
    const verbes: RollVerb[] = ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'];
    expect([...FLOW_VERBS.fall.verbs].filter((v) => !estVerbeDeFenetre(v)).sort()).toEqual([...verbes].sort());
    const s = state(CAST_JET, H_HOST, {
      pendingCascade: null,
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: H_HOST, participants: [
        { id: H_HOST, interactive: true, attempt: true, result: null },
        { id: H_GUEST, interactive: true, attempt: null, result: null },
      ] },
    } as unknown as Partial<Jeu>);
    for (const v of verbes) {
      expect(intentAllowedFor(s, 1, ...geste('fall', v, H_GUEST)), `${v} : le siège du tombant`).toBe(true);
      expect(intentAllowedFor(s, 0, ...geste('fall', v, H_GUEST)), `${v} : l’initiateur ne joue pas la rangée d’un autre siège`).toBe(false);
    }
    expect(intentAllowedFor(s, 1, 'fallChoose', [H_GUEST, true]), 'le siège du tombant déclare sa rangée').toBe(true);
    expect(intentAllowedFor(s, 0, 'fallChoose', [H_GUEST, true]), 'l’hôte ne déclare pas pour le héros d’un autre siège').toBe(false);
  });

  it('(e) SURFACE RÉSEAU : chaque geste d’un flux mono est atteignable par un INVITÉ (#1017)', () => {
    // `hote/coop/session.ts` consulte `GUEST_INTENTS` AVANT `intentAllowedFor` : un verbe hors allowlist est
    // INATTEIGNABLE par le fil, quel que soit le prédicat de possession — il s'exécuterait EN LOCAL chez
    // l'invité puis serait écrasé au snapshot. La règle générale de possession exige donc la surface
    // PLEINE : le sous-ensemble mesuré est confronté à l'inventaire littéral, flux par flux.
    for (const [prefix, w] of JET_OWNED) {
      const exposed = w.verbs.filter((v) => GUEST_INTENTS.has(NOM_DU_VERBE_DE_JET[v]));
      expect(exposed, `surface invité de ${prefix}`).toEqual(INVENTORY[prefix].filter((v) => w.verbs.includes(v)));
    }
  });

  for (const [prefix, w] of JET_OWNED) {
    it(`(a) ${prefix} : porteur HÉROS — seul le siège qui le possède dépense`, () => {
      const s = state(w.jetOwner!, H_GUEST);
      for (const v of w.verbs) {
        const [intent, args] = geste(prefix, v);
        expect(intentAllowedFor(s, 1, intent, args), `${intent} siège propriétaire du porteur`).toBe(true);
        expect(intentAllowedFor(s, 0, intent, args), `${intent} hôte NON propriétaire`).toBe(false);
        expect(intentAllowedFor(s, 2, intent, args), `${intent} siège MJ, porteur héros d’un autre`).toBe(false);
      }
    });

    it(`(a) ${prefix} : porteur ENNEMI — seul le siège MJ dépense (jamais les joueurs)`, () => {
      const s = state(w.jetOwner!, ENEMY);
      for (const v of w.verbs) {
        const [intent, args] = geste(prefix, v);
        expect(intentAllowedFor(s, 2, intent, args), `${intent} siège MJ (conduit l’ennemi)`).toBe(true);
        expect(intentAllowedFor(s, 0, intent, args), `${intent} hôte : les ressources de l’ennemi ne sont pas les siennes`).toBe(false);
        expect(intentAllowedFor(s, 1, intent, args), `${intent} joueur : dépenserait la Résilience d’un ENNEMI`).toBe(false);
      }
    });

    it(`(d) ${prefix} : porteur ENNEMI SANS siège MJ — PARITÉ avec l'affichage, l'hôte non plus ne dépense`, () => {
      // Le jet est à l'IA : l'affordance est refusée À TOUS par `seatInfluences`. Une garde routée sur
      // `seatOwns` seul retomberait sur `ownership ?? 0` et AUTORISERAIT l'hôte — l'écran dit non, l'hôte
      // dirait oui.
      const s = state(w.jetOwner!, ENEMY, { net: { mode: 'host', mySeat: 0, gmSeat: null, seatNames: {}, ownership: { h2: 1 }, slots: [0, 1, 0, 0] } } as unknown as Partial<Jeu>);
      expect(seatInfluences(s, 0, ENEMY), 'précondition : l’affichage refuse l’ennemi sans MJ').toBe(false);
      for (const v of w.verbs) {
        const [intent, args] = geste(prefix, v);
        for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, intent, args), `${intent} siège ${seat}, porteur à l’IA`).toBe(false);
      }
    });

    it(`(b) ${prefix} : fenêtre FERMÉE (pending absent) — personne ne dépense`, () => {
      const s = state(w.jetOwner!, H_GUEST, { [w.jetOwner!.pending]: null } as unknown as Partial<Jeu>);
      for (const v of w.verbs) {
        const [intent, args] = geste(prefix, v);
        for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, intent, args), `${intent} siège ${seat}, jet inconnu`).toBe(false);
      }
    });
  }

  it('(c) NON-RÉGRESSION : dans la MÊME fenêtre, opposition et Contre-sort restent possédés PAR PARTICIPANT', () => {
    const s = state(CAST_JET, ENEMY, {
      pendingCounterspell: { participants: [{ id: H_GUEST, interactive: true, result: null }] },
      pendingCastOpposition: { test: { char: 'force-mentale' }, participants: [{ id: H_GUEST, interactive: true, result: null }] },
    } as unknown as Partial<Jeu>);
    // Le contre-lanceur / la cible du siège 1 jouent LEUR rangée…
    expect(intentAllowedFor(s, 1, ...geste('counterspell', 'roll', H_GUEST))).toBe(true);
    expect(intentAllowedFor(s, 1, ...geste('opposition', 'forceSuccess', H_GUEST))).toBe(true);
    expect(intentAllowedFor(s, 0, ...geste('counterspell', 'roll', H_GUEST)), 'rangée d’un autre siège').toBe(false);
    // …pendant que la rangée du LANCEUR ennemi leur reste fermée.
    expect(intentAllowedFor(s, 1, ...geste('cast', 'forceSuccess')), 'le gate du lanceur ne s’ouvre pas par la fenêtre partagée').toBe(false);
  });

  /**
   * #1017 — l'ANNULATION d'un jet mono suit elle aussi le porteur. Sonde : le Test d'un héros du
   * siège 1 est l'étape COURANTE d'une cascade PARTAGÉE (`groupOwner` → owner de modale `'*'`, et
   * `pendingTest` est un `covers` de cette entrée) ; hors route par porteur, `jetCancel('test')` retombait
   * sur le repli `modalOwnerOf` et N'IMPORTE quel siège fermait le jet d'autrui.
   */
  it('(f) `cancel` : sur une fenêtre PARTAGÉE, seul le siège du porteur ferme le jet', () => {
    const s = state({ pending: 'pendingTest', field: 'actorId' }, H_GUEST);
    expect(modalOwnerOf(s), 'précondition : l’étape de cascade est PARTAGÉE').toBe('*');
    expect(intentAllowedFor(s, 1, ...geste('test', 'cancel')), 'le siège du testeur annule SON Test').toBe(true);
    expect(intentAllowedFor(s, 0, ...geste('test', 'cancel')), 'l’hôte ne ferme pas le Test d’un autre siège').toBe(false);
    expect(intentAllowedFor(s, 2, ...geste('test', 'cancel')), 'le MJ ne ferme pas le Test d’un héros joueur').toBe(false);
    // Le même verdict vaut pour l'attaque (2ᵉ flux mono à porter `cancel`).
    const a = state({ pending: 'pendingAttack', field: 'attackerId' }, H_GUEST);
    expect(intentAllowedFor(a, 1, ...geste('attack', 'cancel'))).toBe(true);
    expect(intentAllowedFor(a, 0, ...geste('attack', 'cancel'))).toBe(false);
  });

  /**
   * #1017 — le porteur joue son flux ENTIER. Sonde sur le Marchandage : sa fenêtre vit HORS
   * `MODAL_DEFS` et hors combat, donc le repli `modalOwnerOf` rend `null` puis retombe sur le
   * combattant ACTIF (absent) = l'hôte. Sans la route par porteur de sa clôture, le négociateur invité roulait,
   * relançait, dépensait sa Résilience… et son « Conclure » s'exécutait chez lui avant d'être écrasé
   * au snapshot de l'hôte.
   */
  it('(g) résolution d’un flux HORS registre de modales : Conclure suit le porteur, pas l’hôte', () => {
    const s = state({ pending: 'pendingBargain', field: 'playerId' }, H_GUEST, { pendingCascade: null } as unknown as Partial<Jeu>);
    expect(modalOwnerOf(s), 'précondition : aucune modale du registre ne couvre le Marchandage').toBeNull();
    for (const [a, args] of [geste('bargain', 'confirm'), geste('bargain', 'cancel')] as const) {
      expect(intentAllowedFor(s, 1, a, [...args]), `${a} : le siège du négociateur clôt SON marchandage`).toBe(true);
      expect(intentAllowedFor(s, 0, a, [...args]), `${a} : l’hôte ne clôt pas le jet d’un autre siège`).toBe(false);
      expect(intentAllowedFor(s, 2, a, [...args]), `${a} : le MJ non plus`).toBe(false);
    }
    // Négociateur du siège HÔTE : le verdict s'inverse — l'hôte clôt, l'invité non (rien n'est ouvert
    // « à tous » par cette route).
    const h = state({ pending: 'pendingBargain', field: 'playerId' }, H_HOST, { pendingCascade: null } as unknown as Partial<Jeu>);
    expect(intentAllowedFor(h, 0, 'jetConfirm', ['bargain'])).toBe(true);
    expect(intentAllowedFor(h, 1, 'jetConfirm', ['bargain'])).toBe(false);
    // Évaluation : même contrat.
    const a = state({ pending: 'pendingAppraise', field: 'actorId' }, H_GUEST, { pendingCascade: null } as unknown as Partial<Jeu>);
    expect(intentAllowedFor(a, 1, 'jetConfirm', ['appraise'])).toBe(true);
    expect(intentAllowedFor(a, 0, 'jetConfirm', ['appraise'])).toBe(false);
  });

  it('SOLO (siège unique, aucune attribution) : le joueur garde ses propres dépenses', () => {
    const s = state(CAST_JET, H_HOST, { net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as Partial<Jeu>);
    expect(intentAllowedFor(s, 0, ...geste('cast', 'forceSuccess'))).toBe(true);
    expect(intentAllowedFor(s, 0, ...geste('cast', 'bonusSL'))).toBe(true);
  });
});

/** Les réglages de la fenêtre entière d'un flux mono à porteur (`REGLAGES_DU_JET`), hors ceux dont la valeur désigne
 *  le siège qui les joue (`porteurDeLaValeur`). */
const REGLAGES_PORTES = Object.entries(REGLAGES_DU_JET).flatMap(([flux, reglages]) => {
  const w = FLOW_VERBS[flux as keyof typeof FLOW_VERBS] as Entry;
  return w.kind === 'mono' && w.jetOwner
    ? Object.entries(reglages as Record<string, DeclarationDuReglage>).filter(([, d]) => d.portee === 'fenetre' && !d.porteurDeLaValeur).map(([r]) => [flux, r, w.jetOwner!] as const)
    : [];
});

describe('#3368 — un réglage du jet (`jetRegler`) suit le PORTEUR du jet', () => {
  it('témoin : les réglages des flux mono, et le verbe atteignable par un invité', () => {
    expect(REGLAGES_PORTES.length).toBeGreaterThan(25);
    expect(GUEST_INTENTS.has('jetRegler')).toBe(true);
  });

  it.each(REGLAGES_PORTES)('%s.%s : le siège du porteur héros règle, aucun autre', (flux, reglage, jet) => {
    const s = state(jet, H_GUEST);
    expect([0, 1, 2].map((siege) => intentAllowedFor(s, siege, 'jetRegler', [flux, reglage, null]))).toEqual([false, true, false]);
  });

  it.each(REGLAGES_PORTES)('%s.%s : le jet d’un ennemi se règle du siège MJ seul', (flux, reglage, jet) => {
    const s = state(jet, ENEMY);
    expect([0, 1, 2].map((siege) => intentAllowedFor(s, siege, 'jetRegler', [flux, reglage, null]))).toEqual([false, false, true]);
  });

  it('correction déclarée : le Sort d’un ennemi, à fenêtre partagée (`*`), ne se règle plus de tout siège', () => {
    const s = state(CAST_JET, ENEMY);
    expect(modalOwnerOf(s), 'précondition : la fenêtre du Sort ennemi est à tous les sièges').toBe('*');
    expect([0, 1, 2].map((siege) => intentAllowedFor(s, siege, 'jetRegler', ['cast', 'effetCritique', 'puissance']))).toEqual([false, false, true]);
    const sansMJ = state(CAST_JET, ENEMY, { net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 1, 0, 0] } } as unknown as Partial<Jeu>);
    expect([0, 1].map((siege) => intentAllowedFor(sansMJ, siege, 'jetRegler', ['cast', 'surincantationDuree', 1])), 'sans siège MJ, aucun invité ne règle le Sort ennemi').toEqual([false, false]);
  });

  it('un réglage que son flux ne déclare pas ne se route à aucun siège', () => {
    const s = state(CAST_JET, H_GUEST);
    expect([0, 1, 2].map((siege) => intentAllowedFor(s, siege, 'jetRegler', ['cast', 'localisation', null]))).toEqual([false, false, false]);
  });
});
