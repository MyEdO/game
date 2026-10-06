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
 *      (`GUEST_INTENTS`, consulté AVANT `intentAllowedFor` par `net/session.ts`) est asserté par flux.
 *
 * La chaîne réparée : un Sort ennemi ouvre son étape en `groupOwner` (`combatFlow.openCastCascade`) →
 * `modalArbiter` rend l'owner `'*'` (pour que cible et contre-lanceurs voient la fenêtre) → sans route
 * par porteur, `intentAllowedFor` acceptait `castForceSuccess` de N'IMPORTE quel siège.
 *
 * LIMITE STRUCTURELLE (consigne de design, #1013) : la fixture `state()` ci-dessous POSE le pending
 * d'après la table elle-même (`[jet.pending]:{[jet.field]:…}`). Elle vérifie donc le ROUTAGE (le
 * porteur déclaré gouverne la dépense), jamais que le couple `pending`/`field` décrit la forme RÉELLE
 * de l'état : inverser `defenderId`↔`attackerId` dans `FLOW_VERBS` laisserait cette garde VERTE
 * (mesuré par mutation). Ce plan-là est couvert par `jet-owner-vs-spec.test.ts` (confrontation
 * table⇄`spec.actor` sur sentinelles distinctes) et par les sondes de flux RÉEL
 * (`jet-owner-real-flows.test.ts`, `attack-intent-ownership.test.ts`,
 * `cast-influence-ownership.test.tsx`). L'INVENTAIRE littéral ci-dessous NOMME les intents routés ET
 * leur surface invité : une ligne de table qui disparaît sort de la boucle par flux SANS échec de
 * structure — seule l'assertion nominative la rattrape.
 */
import { describe, it, expect } from 'vitest';
import { FLOW_VERBS, jetOwnedIntents, participantOwnedIntents, flowActionName, type JetOwnerRef } from './flowVerbs';
import { intentAllowedFor, modalOwnerOf, seatInfluences } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';
import type { GameState } from './store';
import { cascadeDeTest } from './cascadeTestKit';

type Entry = { kind: 'mono' | 'multi'; verbs: readonly string[]; coop?: boolean; jetOwner?: JetOwnerRef; resolution?: readonly string[] };
const ENTRIES = Object.entries(FLOW_VERBS) as [string, Entry][];
const JET_OWNED = ENTRIES.filter(([, w]) => w.kind === 'mono' && !!w.jetOwner);

/**
 * INVENTAIRE NOMINATIF des 28 flux mono (#1015, étendu #1017) — par flux, la liste LITTÉRALE de ses
 * verbes, écrite à la main. Elle est confrontée à DEUX mesures qui, depuis #1017, doivent coïncider :
 *  - `jetOwnedIntents()` : les verbes dont la possession suit le porteur du jet — TOUS, `cancel`
 *    compris (fermer le jet d'autrui par une fenêtre partagée `'*'` était ouvert à tous les sièges) ;
 *  - `GUEST_INTENTS` : les verbes réellement atteignables par un invité — TOUS également, la surface
 *    d'un flux mono étant DÉRIVÉE de sa possession, sans marqueur à poser (règle générale de
 *    possession). Une surface nulle ou partielle est donc désormais un ÉCHEC, pas un état de fait.
 * La liste reste écrite ICI à la main (jamais dérivée de `FLOW_VERBS`) : sinon une ligne de table
 * disparue sortirait de l'itération sans rien casser (leçon #1015).
 */
const INVENTORY: Record<string, readonly string[]> = {
  attack:     ['reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse'],
  defense:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse'],
  cast:       ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  disengage:  ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  auContact:  ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  grapple:    ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  trample:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  battement:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  distraire:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  maneuver:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  run:        ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'],
  reload:     ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  handGate:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  recover:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  focus:      ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  dispel:     ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  frenzy:     ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'],
  approach:   ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'],
  ward:       ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'],
  heal:       ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  surgery:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  corruption: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'],
  test:       ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'determine', 'cancel', 'reverse'],
  steamSave:  ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  activity:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  bargain:    ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  appraise:   ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'],
  shanty:     ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'],
};

/** Actions de RÉSOLUTION manuscrites routées par le porteur (`FlowVerbs.resolution`, #1017) —
 *  littérales elles aussi : leur route est ce qui permet au porteur invité de CLORE son jet, et pas
 *  seulement de l'influencer. Seuls les flux dont la fenêtre vit hors `MODAL_DEFS` et hors combat en
 *  déclarent (le repli `modalOwnerOf` y désigne l'hôte, pas le porteur). */
const RESOLUTION: Record<string, readonly string[]> = {
  bargain: ['bargainConfirm', 'bargainCancel'],
  appraise: ['resolveAppraise', 'appraiseCancel'],
};

const H_HOST = 'h1'; // héros du siège 0 (hôte)
const H_GUEST = 'h2'; // héros du siège 1
const ENEMY = 'e1';

/** Fenêtre du flux `jet` OUVERTE sur `ownerId` (son pending posé selon `jetOwner`), étape de cascade
 *  PARTAGÉE (owner de modale '*'). Le pending est POSÉ PAR LA TABLE : ajouter un `jetOwner` à un flux
 *  l'amène dans la garde sans une ligne de fixture. */
const state = (jet: JetOwnerRef, ownerId: string, over: Partial<GameState> = {}): GameState =>
  ({
    net: { mode: 'host', mySeat: 0, gmSeat: 2, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'MJ' }, ownership: { h2: 1 }, slots: [0, 1, 0, 0] },
    party: [{ id: H_HOST }, { id: H_GUEST }],
    battle: { order: [H_HOST, H_GUEST, ENEMY], turn: 0, combatants: [
      { id: H_HOST, kind: 'hero' }, { id: H_GUEST, kind: 'hero' }, { id: ENEMY, kind: 'enemy' },
    ] },
    pendingCascade: cascadeDeTest([{ id: 's0', kind: 'castJet', jet: 'cast', groupOwner: true }]),
    [jet.pending]: { [jet.field]: ownerId, targetId: H_HOST, spellId: 'drain', result: null },
    ...over,
  }) as unknown as GameState;

const CAST_JET: JetOwnerRef = { pending: 'pendingCast', field: 'casterId' };
const argsOf = (verb: string) => (verb === 'setForcedRoll' ? [42] : []);

describe('#1005/#1015 — flux MONO : la dépense suit le PORTEUR du jet', () => {
  it('la table DÉRIVE bien des intents (sinon la garde ci-dessous ne mesure rien)', () => {
    const map = jetOwnedIntents();
    expect(JET_OWNED.map(([k]) => k), 'aucun flux mono ne déclare `jetOwner`').not.toEqual([]);
    expect(map.castForceSuccess, 'la Résilience du lanceur doit être routée par porteur').toEqual(CAST_JET);
    // INVENTAIRE LITTÉRAL : la boucle par flux ci-dessous se contente en silence de ce que la table
    // déclare (une ligne retirée = un flux qui sort de l'itération, sans échec). Cette liste NOMME les
    // intents attendus → toute ligne `jetOwner` disparue (ou ajoutée sans garde de flux réel) est rouge.
    const inventaire = [
      ...Object.entries(INVENTORY).flatMap(([p, vs]) => vs.map((v) => flowActionName(p, v))),
      ...Object.values(RESOLUTION).flat(),
    ];
    expect(Object.keys(map).sort()).toEqual(inventaire.sort());
    // …et la dérivation reste FIDÈLE à la table (TOUS les verbes, `cancel` compris, plus les actions
    // de `resolution` déclarées, rien d'autre).
    const derives = JET_OWNED.flatMap(([p, w]) => [...w.verbs.map((v) => flowActionName(p, v)), ...(w.resolution ?? [])]);
    expect(Object.keys(map).sort()).toEqual(derives.sort());
    // Les actions de résolution déclarées sont routées par le MÊME porteur que les verbes du flux.
    for (const [prefix, actions] of Object.entries(RESOLUTION)) {
      const jet = (FLOW_VERBS as unknown as Record<string, Entry>)[prefix].jetOwner;
      for (const a of actions) expect(map[a], `${a} routée par le porteur de ${prefix}`).toEqual(jet);
    }
  });

  /**
   * #700 — la CHUTE est un flux MULTI (`MultiPending<TombantParticipant>`) : ses verbes sortent de la
   * route par porteur mono et passent par le TOMBANT de la rangée (`participantOwnedIntents`, 1ᵉʳ arg =
   * son id) ; sa déclaration `fallChoose` suit la même possession (`seatInfluences`). Liste littérale.
   */
  it('#700 — la chute (multi) : ses intents suivent le TOMBANT de la rangée, jamais le porteur mono', () => {
    const verbes = ['fallRoll', 'fallReroll', 'fallBonusSL', 'fallForceSuccess', 'fallSetForcedRoll', 'fallDarkPact'];
    const mono = jetOwnedIntents();
    const parTombant = new Set(participantOwnedIntents());
    for (const i of verbes) {
      expect(mono[i], `${i} hors route mono`).toBeUndefined();
      expect(parTombant.has(i), `${i} routé par le tombant`).toBe(true);
    }
    const s = state(CAST_JET, H_HOST, {
      pendingCascade: null,
      pendingFall: { to: { x: 0, y: 1 }, metres: 4, initiateurId: H_HOST, participants: [
        { id: H_HOST, interactive: true, attempt: true, result: null },
        { id: H_GUEST, interactive: true, attempt: null, result: null },
      ] },
    } as unknown as Partial<GameState>);
    for (const i of verbes) {
      const args = i === 'fallSetForcedRoll' ? [H_GUEST, 42] : [H_GUEST];
      expect(intentAllowedFor(s, 1, i, args), `${i} : le siège du tombant`).toBe(true);
      expect(intentAllowedFor(s, 0, i, args), `${i} : l’initiateur ne joue pas la rangée d’un autre siège`).toBe(false);
    }
    expect(intentAllowedFor(s, 1, 'fallChoose', [H_GUEST, true]), 'le siège du tombant déclare sa rangée').toBe(true);
    expect(intentAllowedFor(s, 0, 'fallChoose', [H_GUEST, true]), 'l’hôte ne déclare pas pour le héros d’un autre siège').toBe(false);
  });

  it('(e) SURFACE RÉSEAU : chaque verbe d’un flux mono est atteignable par un INVITÉ (#1017)', () => {
    // `net/session.ts` consulte `GUEST_INTENTS` AVANT `intentAllowedFor` : un verbe hors allowlist est
    // INATTEIGNABLE par le fil, quel que soit le prédicat de possession — il s'exécuterait EN LOCAL chez
    // l'invité puis serait écrasé au snapshot. La règle générale de possession exige donc la surface
    // PLEINE : le sous-ensemble mesuré est confronté à l'inventaire littéral, flux par flux.
    for (const [prefix, w] of JET_OWNED) {
      const exposed = w.verbs.filter((v) => GUEST_INTENTS.has(flowActionName(prefix, v)));
      expect(exposed, `surface invité de ${prefix}`).toEqual(INVENTORY[prefix].filter((v) => w.verbs.includes(v)));
      // …et les actions qui CLOSENT le jet (Conclure/Appliquer/Annuler) le sont aussi : influencer sans
      // pouvoir clore laisse le geste s'exécuter en local puis mourir au snapshot.
      const closables = (RESOLUTION[prefix] ?? []).filter((a) => GUEST_INTENTS.has(a));
      expect(closables, `actions de clôture atteignables de ${prefix}`).toEqual(RESOLUTION[prefix] ?? []);
    }
  });

  for (const [prefix, w] of JET_OWNED) {
    it(`(a) ${prefix} : porteur HÉROS — seul le siège qui le possède dépense`, () => {
      const s = state(w.jetOwner!, H_GUEST);
      for (const v of w.verbs) {
        const intent = flowActionName(prefix, v);
        expect(intentAllowedFor(s, 1, intent, argsOf(v)), `${intent} siège propriétaire du porteur`).toBe(true);
        expect(intentAllowedFor(s, 0, intent, argsOf(v)), `${intent} hôte NON propriétaire`).toBe(false);
        expect(intentAllowedFor(s, 2, intent, argsOf(v)), `${intent} siège MJ, porteur héros d’un autre`).toBe(false);
      }
    });

    it(`(a) ${prefix} : porteur ENNEMI — seul le siège MJ dépense (jamais les joueurs)`, () => {
      const s = state(w.jetOwner!, ENEMY);
      for (const v of w.verbs) {
        const intent = flowActionName(prefix, v);
        expect(intentAllowedFor(s, 2, intent, argsOf(v)), `${intent} siège MJ (conduit l’ennemi)`).toBe(true);
        expect(intentAllowedFor(s, 0, intent, argsOf(v)), `${intent} hôte : les ressources de l’ennemi ne sont pas les siennes`).toBe(false);
        expect(intentAllowedFor(s, 1, intent, argsOf(v)), `${intent} joueur : dépenserait la Résilience d’un ENNEMI`).toBe(false);
      }
    });

    it(`(d) ${prefix} : porteur ENNEMI SANS siège MJ — PARITÉ avec l'affichage, l'hôte non plus ne dépense`, () => {
      // Le jet est à l'IA : l'affordance est refusée À TOUS par `seatInfluences`. Une garde routée sur
      // `seatOwns` seul retomberait sur `ownership ?? 0` et AUTORISERAIT l'hôte — l'écran dit non, l'hôte
      // dirait oui.
      const s = state(w.jetOwner!, ENEMY, { net: { mode: 'host', mySeat: 0, gmSeat: null, seatNames: {}, ownership: { h2: 1 }, slots: [0, 1, 0, 0] } } as unknown as Partial<GameState>);
      expect(seatInfluences(s, 0, ENEMY), 'précondition : l’affichage refuse l’ennemi sans MJ').toBe(false);
      for (const v of w.verbs) {
        const intent = flowActionName(prefix, v);
        for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, intent, argsOf(v)), `${intent} siège ${seat}, porteur à l’IA`).toBe(false);
      }
    });

    it(`(b) ${prefix} : fenêtre FERMÉE (pending absent) — personne ne dépense`, () => {
      const s = state(w.jetOwner!, H_GUEST, { [w.jetOwner!.pending]: null } as unknown as Partial<GameState>);
      for (const v of w.verbs) {
        const intent = flowActionName(prefix, v);
        for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, intent, argsOf(v)), `${intent} siège ${seat}, jet inconnu`).toBe(false);
      }
    });
  }

  it('(c) NON-RÉGRESSION : dans la MÊME fenêtre, opposition et Contre-sort restent possédés PAR PARTICIPANT', () => {
    const s = state(CAST_JET, ENEMY, {
      pendingCounterspell: { participants: [{ id: H_GUEST, interactive: true, result: null }] },
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [{ id: H_GUEST, interactive: true, result: null }] },
    } as unknown as Partial<GameState>);
    // Le contre-lanceur / la cible du siège 1 jouent LEUR rangée…
    expect(intentAllowedFor(s, 1, 'counterspellRoll', [H_GUEST])).toBe(true);
    expect(intentAllowedFor(s, 1, 'oppositionForceSuccess', [H_GUEST])).toBe(true);
    expect(intentAllowedFor(s, 0, 'counterspellRoll', [H_GUEST]), 'rangée d’un autre siège').toBe(false);
    // …pendant que la rangée du LANCEUR ennemi leur reste fermée.
    expect(intentAllowedFor(s, 1, 'castForceSuccess', []), 'le gate du lanceur ne s’ouvre pas par la fenêtre partagée').toBe(false);
  });

  /**
   * #1017 — l'ANNULATION d'un jet mono suit elle aussi le porteur. Sonde : le Test d'un héros du
   * siège 1 est l'étape COURANTE d'une cascade PARTAGÉE (`groupOwner` → owner de modale `'*'`, et
   * `pendingTest` est un `covers` de cette entrée) ; hors route par porteur, `testCancel` retombait
   * sur le repli `modalOwnerOf` et N'IMPORTE quel siège fermait le jet d'autrui.
   */
  it('(f) `cancel` : sur une fenêtre PARTAGÉE, seul le siège du porteur ferme le jet', () => {
    const s = state({ pending: 'pendingTest', field: 'actorId' }, H_GUEST);
    expect(modalOwnerOf(s), 'précondition : l’étape de cascade est PARTAGÉE').toBe('*');
    expect(intentAllowedFor(s, 1, 'testCancel', []), 'le siège du testeur annule SON Test').toBe(true);
    expect(intentAllowedFor(s, 0, 'testCancel', []), 'l’hôte ne ferme pas le Test d’un autre siège').toBe(false);
    expect(intentAllowedFor(s, 2, 'testCancel', []), 'le MJ ne ferme pas le Test d’un héros joueur').toBe(false);
    // Le même verdict vaut pour l'attaque (2ᵉ flux mono à porter `cancel`).
    const a = state({ pending: 'pendingAttack', field: 'attackerId' }, H_GUEST);
    expect(intentAllowedFor(a, 1, 'attackCancel', [])).toBe(true);
    expect(intentAllowedFor(a, 0, 'attackCancel', [])).toBe(false);
  });

  /**
   * #1017 — le porteur joue son flux ENTIER. Sonde sur le Marchandage : sa fenêtre vit HORS
   * `MODAL_DEFS` et hors combat, donc le repli `modalOwnerOf` rend `null` puis retombe sur le
   * combattant ACTIF (absent) = l'hôte. Sans la route `resolution`, le négociateur invité roulait,
   * relançait, dépensait sa Résilience… et son « Conclure » s'exécutait chez lui avant d'être écrasé
   * au snapshot de l'hôte.
   */
  it('(g) résolution d’un flux HORS registre de modales : Conclure suit le porteur, pas l’hôte', () => {
    const s = state({ pending: 'pendingBargain', field: 'playerId' }, H_GUEST, { pendingCascade: null } as unknown as Partial<GameState>);
    expect(modalOwnerOf(s), 'précondition : aucune modale du registre ne couvre le Marchandage').toBeNull();
    for (const a of ['bargainConfirm', 'bargainCancel']) {
      expect(intentAllowedFor(s, 1, a, []), `${a} : le siège du négociateur clôt SON marchandage`).toBe(true);
      expect(intentAllowedFor(s, 0, a, []), `${a} : l’hôte ne clôt pas le jet d’un autre siège`).toBe(false);
      expect(intentAllowedFor(s, 2, a, []), `${a} : le MJ non plus`).toBe(false);
    }
    // Négociateur du siège HÔTE : le verdict s'inverse — l'hôte clôt, l'invité non (rien n'est ouvert
    // « à tous » par cette route).
    const h = state({ pending: 'pendingBargain', field: 'playerId' }, H_HOST, { pendingCascade: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(h, 0, 'bargainConfirm', [])).toBe(true);
    expect(intentAllowedFor(h, 1, 'bargainConfirm', [])).toBe(false);
    // Évaluation : même contrat (« Appliquer » = `resolveAppraise`, nom hors motif `<prefix><Verbe>`).
    const a = state({ pending: 'pendingAppraise', field: 'actorId' }, H_GUEST, { pendingCascade: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(a, 1, 'resolveAppraise', [])).toBe(true);
    expect(intentAllowedFor(a, 0, 'resolveAppraise', [])).toBe(false);
  });

  it('SOLO (siège unique, aucune attribution) : le joueur garde ses propres dépenses', () => {
    const s = state(CAST_JET, H_HOST, { net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as Partial<GameState>);
    expect(intentAllowedFor(s, 0, 'castForceSuccess', [])).toBe(true);
    expect(intentAllowedFor(s, 0, 'castBonusSL', [])).toBe(true);
  });
});
