/**
 * Garde STRUCTURELLE de la SURFACE RÉSEAU d'un flux de jet (#1017, élargie aux MULTI #1050) : exposer
 * un flux, ce n'est pas seulement ses VERBES d'influence (dérivés de `FLOW_VERBS`) — ce sont aussi SES
 * ACTIONS de store (ouverture de fenêtre, paramètres pré-jet, résolution/annulation métier). Une action
 * absente de `GUEST_INTENTS` n'est pas REFUSÉE côté invité : `netFlow` n'enrobe que les noms de
 * l'allowlist, donc l'appel s'exécute EN LOCAL chez lui puis disparaît au premier snapshot de l'hôte —
 * un geste qui « marche » une demi-seconde puis se défait, sans message.
 *
 * La garde énumère, pour CHAQUE flux (mono ET multi), les actions du store nommées `<prefix><Maj>…`
 * et exige que chacune soit exposée, OU portée nominativement par `HORS_SURFACE` avec sa raison.
 * Une orpheline nouvelle (action ajoutée à un flux exposé) échoue ici, jamais chez un joueur.
 */
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { FLOW_VERBS, flowActionName, jetOwnedIntents, type FlowVerbs, type JetOwnerRef } from './flowVerbs';
import { GUEST_INTENTS } from '../net/intents';
import { HORS_MODAL } from './modalArbiter';

/**
 * Actions `<prefix><Maj>…` VOLONTAIREMENT hors surface invité — une entrée, une raison. DEUX classes
 * seulement peuvent y figurer :
 *  - une action d'OUVERTURE depuis un écran piloté par l'hôte : le jet, une fois ouvert, est joué
 *    ENTIER par le siège de son porteur (verbes ET `resolution`, routes `jetOwnedIntents`) ;
 *  - un CHOIX D'ÉCRAN qui ne commet rien au jeu et se joue chez l'ÉMETTEUR par construction
 *    (`targetingModes.INTENT_ELECTION_LOCALE` / `netFlow.emettreIntentInvite`) : son état vit hors
 *    snapshot, donc il n'a rien à demander à l'hôte — et le COMMIT qui suit, lui, est exposé.
 */
const HORS_SURFACE: Record<string, string> = {
  appraiseItem: 'OUVRE une Évaluation depuis l’inventaire — écran hôte (ouverture coop : lot #284)',
  appraiseGear: 'OUVRE une Évaluation sur une ligne de butin — fenêtre de butin hôte (lot #284)',
  dispelSelectCarrier:
    'ÉLECTION locale d’écran (porteur du mode Dissiper) — jouée chez l’ÉMETTEUR, hors réseau par ' +
    'construction (`dispelCarrierId` hors snapshot) ; le COMMIT `battleDispelSpell` est exposé',
};

/** Extraction PURE de la détection d'orphelines, pour qu'elle soit elle-même éprouvable (cas simulé
 *  plus bas) : une garde qui ne se prouve que sur l'arbre RÉEL ne dit pas si elle sait mordre. */
export function orphelinesDe(
  noms: readonly string[],
  flux: readonly (readonly [string, { verbs: readonly string[]; resolution?: readonly string[] }])[],
  exposees: ReadonlySet<string>,
  horsSurface: Readonly<Record<string, string>>,
): string[] {
  const out: string[] = [];
  for (const [prefix, w] of flux) {
    const connues = new Set([...w.verbs.map((v) => flowActionName(prefix, v)), ...(w.resolution ?? [])]);
    for (const n of noms.filter((x) => new RegExp(`^${prefix}[A-Z]`).test(x))) {
      if (connues.has(n) || exposees.has(n) || n in horsSurface) continue;
      out.push(n);
    }
  }
  return out;
}

/** Vue élargie de la branche MONO (le `satisfies` de la table narrowit chaque entrée). */
type Mono = { kind: 'mono'; verbs: readonly string[]; jetOwner: JetOwnerRef; resolution?: readonly string[] };
const MONO = (Object.entries(FLOW_VERBS) as [string, FlowVerbs][])
  .filter(([, w]) => w.kind === 'mono') as [string, Mono][];
/** Vue élargie de la branche MULTI — même confrontation (#1050) : le filtre `kind === 'mono'` était LE
 *  trou structurel, il laissait `oppositionConfirm` hors surface sans qu'aucune garde ne le voie. */
type Multi = { kind: 'multi'; verbs: readonly string[]; coop?: boolean; resolution: readonly string[] };
const MULTI = (Object.entries(FLOW_VERBS) as [string, FlowVerbs][])
  .filter(([, w]) => w.kind === 'multi') as [string, Multi][];
/** Les DEUX branches, telles que la détection d'orphelines les consomme (verbes + résolution). */
const FLUX: [string, { verbs: readonly string[]; resolution?: readonly string[] }][] = [...MONO, ...MULTI];
const storeActions = (): string[] => {
  const s = useGame.getState() as unknown as Record<string, unknown>;
  return Object.keys(s).filter((k) => typeof s[k] === 'function');
};

describe('#1017 — surface réseau d’un flux MONO : verbes dérivés ET actions de résolution', () => {
  it('précondition : la table porte bien des flux mono (sinon la garde ne mesure rien)', () => {
    expect(MONO.map(([k]) => k)).not.toEqual([]);
  });

  it('tout verbe d’un flux mono est un intent invité (surface DÉRIVÉE, zéro ligne à écrire)', () => {
    const manquants = MONO.flatMap(([prefix, w]) =>
      w.verbs.map((v) => flowActionName(prefix, v)).filter((n) => !GUEST_INTENTS.has(n)));
    expect(manquants, 'verbe de flux mono hors GUEST_INTENTS — la dérivation `coopFlowIntents` a été rompue').toEqual([]);
  });

  it('les actions de `resolution` d’un flux mono sont EXPOSÉES et ROUTÉES par son porteur', () => {
    const noms = new Set(storeActions());
    const routees = jetOwnedIntents();
    for (const [prefix, w] of MONO) {
      for (const a of w.resolution ?? []) {
        expect(noms.has(a), `${prefix} : l’action de résolution ${a} n’existe pas dans le store`).toBe(true);
        expect(GUEST_INTENTS.has(a), `${prefix} : ${a} non exposée — le porteur invité joue son jet sans pouvoir le CLORE`).toBe(true);
        expect(routees[a], `${prefix} : ${a} non routée par le porteur`).toEqual(w.jetOwner);
      }
    }
  });

  /**
   * CONTRAINTE STRUCTURELLE (le 30ᵉ flux est forcé) : un flux mono dont le `pending` est déclaré
   * HORS_MODAL (`modalArbiter`) n'a AUCUNE modale du registre pour le couvrir — le repli
   * `modalOwnerOf` n'y désigne donc jamais son porteur, et ses actions de clôture manuscrites doivent
   * être routées par `resolution`. La confrontation se fait sur les DEUX tables, jamais sur une liste
   * de flux recopiée.
   */
  it('tout flux mono à fenêtre HORS_MODAL déclare sa `resolution` (sinon son porteur ne peut pas clore)', () => {
    const horsModal = new Set(HORS_MODAL.map((d) => d.pendingKey as string));
    const concernes = MONO.filter(([, w]) => horsModal.has(w.jetOwner.pending));
    expect(concernes.map(([k]) => k), 'précondition : au moins un flux mono vit hors du registre de modales').not.toEqual([]);
    const muets = concernes.filter(([, w]) => !(w.resolution ?? []).length).map(([k]) => k);
    expect(muets, 'flux mono HORS_MODAL sans `resolution` : son « Conclure/Appliquer » s’exécutera chez l’invité puis sera écrasé').toEqual([]);
  });

  it('aucune action `<prefix><Maj>` orpheline (MONO **et** MULTI) : exposée, ou nommée dans HORS_SURFACE', () => {
    const orphelines = orphelinesDe(storeActions(), FLUX, GUEST_INTENTS, HORS_SURFACE);
    expect(orphelines, 'action d’un flux ni exposée ni justifiée : chez l’invité elle s’exécute EN LOCAL puis est écrasée au snapshot').toEqual([]);
  });

  it('les actions de `resolution` d’un flux MULTI coop sont EXPOSÉES et EXISTENT (#1050)', () => {
    const noms = new Set(storeActions());
    const coops = MULTI.filter(([, w]) => w.coop);
    expect(coops.map(([k]) => k), 'précondition : au moins un flux multi coop').not.toEqual([]);
    for (const [prefix, w] of coops) {
      for (const a of w.resolution) {
        expect(noms.has(a), `${prefix} : l’action de résolution ${a} n’existe pas dans le store`).toBe(true);
        expect(GUEST_INTENTS.has(a), `${prefix} : ${a} non exposée — le participant invité joue sa rangée sans pouvoir CLORE`).toBe(true);
      }
    }
  });

  /** La garde ci-dessus ne dit RIEN si son détecteur ne mord pas : on lui donne un flux SIMULÉ dont
   *  aucune action n'est exposée — elle doit toutes les dénoncer, et se taire dès qu'elles le sont. */
  it('le détecteur d’orphelines MORD (flux simulé, surface vide → toutes dénoncées)', () => {
    const noms = ['fauxRoll', 'fauxConfirm', 'fauxCancel', 'fauxSetMode', 'autreConfirm'];
    const flux = [['faux', { verbs: ['roll'], resolution: ['fauxConfirm'] }]] as const;
    expect(orphelinesDe(noms, flux, new Set(), {})).toEqual(['fauxCancel', 'fauxSetMode']);
    expect(orphelinesDe(noms, flux, new Set(['fauxCancel']), { fauxSetMode: 'raison' })).toEqual([]);
  });

  it('HORS_SURFACE ne porte que des actions RÉELLES et RÉELLEMENT fermées (aucune entrée morte)', () => {
    const noms = new Set(storeActions());
    const inconnues = Object.keys(HORS_SURFACE).filter((n) => !noms.has(n));
    expect(inconnues, 'exclusion sur une action inexistante — la retirer').toEqual([]);
    const exposees = Object.keys(HORS_SURFACE).filter((n) => GUEST_INTENTS.has(n));
    expect(exposees, 'exclusion sur une action pourtant exposée — la retirer de HORS_SURFACE').toEqual([]);
    const sansRaison = Object.entries(HORS_SURFACE).filter(([, why]) => why.trim().length < 20).map(([n]) => n);
    expect(sansRaison, 'exclusion sans raison lisible').toEqual([]);
  });

  /**
   * OUVERTURE de CHAQUE flux mono — sans ouvreur atteignable, les verbes exposés sont une surface
   * MORTE. Le nom d'un ouvreur n'est pas dérivable (`battleSingShanty`, `fallAcross`,
   * `battleClickEntity`…) : la table est écrite et VÉRIFIÉE à la main, flux par flux, et le contrôle
   * INVERSE ci-dessous la rend OBLIGATOIRE — le 30ᵉ flux mono ne passe pas sans déclarer son ouverture.
   *  - `parInvite` : ouvreurs qu'un invité doit pouvoir demander → exposés ;
   *  - `parHote` : ouvreurs d'un ÉCRAN piloté par l'hôte → NON exposés (le jet, lui, est joué entier
   *    par le siège de son porteur) ;
   *  - `interne` : aucune action de store n'ouvre ce flux — la raison NOMME le site qui le pose.
   */
  const OUVERTURE: Record<string, { parInvite?: readonly string[]; parHote?: readonly string[]; interne?: string }> = {
    attack: { parInvite: ['battleClickEntity', 'battleSelectAction'] },
    defense: { interne: 'réaction : combatFlow.maybeOpenDefense / openSurfacedDefense' },
    cast: { parInvite: ['battleSelectSpell', 'battleClickEntity'] },
    disengage: { parInvite: ['battleDisengage'] },
    auContact: { parInvite: ['battleAuContact'] },
    grapple: { parInvite: ['battleGrapple'] },
    battement: { parInvite: ['battleBattement'] },
    distraire: { parInvite: ['battleDistraire'] },
    maneuver: { parInvite: ['battleClickEntity'] }, // manœuvre de créature : ciblage (targetingModes.attackClickCommit)
    run: { parInvite: ['battleRun'] },
    fall: { parInvite: ['fallAcross'] },
    reload: { parInvite: ['battleReload'] },
    // Main ensanglantée (AA 07 l.117) : Test par ACTION — posé par l'ouverture d'attaque (interne) ET
    // par la 2ᵉ frappe à deux armes, qui est UNE action de store exposée.
    handGate: { parInvite: ['dualStrikeAttack'], interne: 'combatFlow.openAttackCascade (Test par Action)' },
    recover: { parInvite: ['battleRecoverState'] },
    focus: { parInvite: ['battleFocusSpell'] },
    dispel: { parInvite: ['battleDispelSpell'] },
    frenzy: { parInvite: ['battleFrenzy'] },
    approach: { parInvite: ['battleClickTile', 'battleClickEntity'] }, // gate de Peur (combatSlice.fearGateBlocks)
    ward: { parInvite: ['battleClickEntity'] }, // ciblage (targetingModes.attackClickCommit)
    heal: { parInvite: ['battleHeal', 'medicAct'] },
    surgery: { parInvite: ['openSurgeryPass'] },
    corruption: { interne: 'exposition/seuil : combatEffects (Effect) et corruptionFlow.gainCorruption' },
    test: { interne: 'combatEffects.openSkillTest (Effet de scène, dialogue, consommable)' },
    steamSave: { interne: 'panne de vapeur : boucle de voyage maritime (seaVoyageFlow)' },
    activity: { parInvite: ['interludeActivity'] },
    bargain: { parHote: ['startBargain'] },
    appraise: { parHote: ['appraiseItem', 'appraiseGear'] },
    shanty: { parInvite: ['battleSingShanty'] },
  };

  it('CHAQUE flux mono déclare son ouverture (contrôle inverse — le 30ᵉ flux ne passe pas sans)', () => {
    const sansEntree = MONO.map(([k]) => k).filter((k) => !(k in OUVERTURE));
    expect(sansEntree, 'flux mono sans entrée OUVERTURE — nommer son ouvreur (ou son ouverture interne)').toEqual([]);
    const inconnus = Object.keys(OUVERTURE).filter((k) => !(k in FLOW_VERBS));
    expect(inconnus, 'entrée OUVERTURE sur un flux inconnu de la table').toEqual([]);
    const vides = Object.entries(OUVERTURE)
      .filter(([, o]) => !o.parInvite?.length && !o.parHote?.length && !(o.interne && o.interne.length > 15))
      .map(([k]) => k);
    expect(vides, 'entrée OUVERTURE muette : nommer l’ouvreur ou le site d’ouverture interne').toEqual([]);
  });

  it('les ouvreurs déclarés EXISTENT, et leur exposition suit qui doit ouvrir', () => {
    const noms = new Set(storeActions());
    for (const [flux, o] of Object.entries(OUVERTURE)) {
      for (const n of o.parInvite ?? []) {
        expect(noms.has(n), `${flux} : l’ouvreur ${n} n’existe pas dans le store`).toBe(true);
        expect(GUEST_INTENTS.has(n), `${flux} : ouvreur ${n} NON exposé — surface de jet morte chez l’invité`).toBe(true);
      }
      for (const n of o.parHote ?? []) {
        expect(noms.has(n), `${flux} : l’ouvreur ${n} n’existe pas dans le store`).toBe(true);
        expect(GUEST_INTENTS.has(n), `${flux} : ouvreur d’écran hôte ${n} exposé — le déclarer parInvite ou le retirer`).toBe(false);
      }
    }
  });
});
