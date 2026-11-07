/**
 * Allowlist des actions du noyau qu'un INVITÉ peut demander (intents) — périmètre : LE COMBAT
 * (portée V1 : seule la partie combat est jouée côté invité ; l'exploration est un miroir de
 * l'hôte, hors le CARNET D'ENQUÊTE : épingle de groupe et nouveauté vue par siège, #670) + la
 * COMPOSITION DU GROUPE (chaque joueur remplit les emplacements que l'hôte lui a attribués) + les
 * ACTIVITÉS D'INTERLUDE de SES héros (audit POC→produit M7 : « Entre deux aventures » est par
 * nature individuel — chaque joueur mène les Activités de ses personnages ; ouvrir/CLORE l'interlude
 * reste l'hôte) + TOUT FLUX DE JET MONO à porteur (#1017) : dès que le porteur d'un jet peut être
 * le héros d'un autre siège, ses verbes d'influence lui sont ouverts, qu'il roule en combat, en
 * voyage, à l'auberge ou chez le marchand — c'est la POSSESSION qui tranche la dépense
 * (`netOwnership.intentAllowedFor`), jamais la liste. Tout le reste (sauvegarde, voyage, ÉCRANS
 * marchand/éditeur, persistance) est refusé par l'hôte.
 *
 * TOUTE action du store a sa classe coop (#2724) :
 *  - les verbes de jet (`jet<Verbe>`, le flux en argument, clôture `jetValider` comprise) : classe
 *    dérivée de `FLOW_VERBS` (`coopFlowIntents`) — un flux ajouté à la table n'a AUCUNE ligne à écrire ici ;
 *  - tout autre verbe : une entrée de `CLASSE_DES_ACTIONS_DU_NOYAU` (verbes de `ActionsDuNoyau`) ou de la
 *    table de l'adaptateur (`state/intents.ts`, ses actions d'interface), tables TOTALES sur
 *    `ActionManuscrite` — une action ajoutée sans classe ne compile pas.
 * `invité` = l'invité la DEMANDE à l'hôte (`netFlow` l'enrobe) ; `hôte` = écran ou décision pilotés
 * par l'hôte ; `local` = état d'écran du client, jamais un intent. La machinerie (`MachinerieDuNoyau`) n'est pas un
 * verbe et n'a pas de classe (#3370). Chez l'invité, une action
 * hors allowlist s'exécute dans son store (`netFlow` n'enrobe que l'allowlist) ; chez l'hôte, toute
 * intention d'un siège passe par `appliquerLIntentionDUnSiege`.
 */
import { coopFlowIntents, type FLOW_VERBS, type NomDeVerbeDeJet } from './flowVerbs';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { LOCALES_AU_CLIENT } from './coop';
import type { Get } from './flowTypes';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { t } from '../i18n';

export type ClasseCoop = 'invité' | 'hôte' | 'local';

type Table = typeof FLOW_VERBS;
/** Actions d'un état de store `S` dont la classe coop s'ÉCRIT (hors surface dérivée `coopFlowIntents` : les verbes de jet). */
export type ActionManuscrite<S = ActionsDuNoyau> = Exclude<
  { [K in keyof S]-?: NonNullable<S[K]> extends (...args: never[]) => unknown ? K : never }[keyof S],
  NomDeVerbeDeJet
>;

export type Majuscule = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q'
  | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
type Minuscule = Lowercase<Majuscule>;
/** Site qui pose un flux sans action de store : `<module>.<fonction>`. */
export type SiteInterne = `${string}${Minuscule}.${Minuscule}${string}`;

/**
 * Élections LOCALES d'écran (`targetingModes.TargetingMode.electionLocale`) : l'action n'écrit que le
 * champ nommé, hors instantané (`coop.instantaneDeLaCoop`) ; le COMMIT qui suit est exposé.
 */
const ELECTIONS_LOCALES = { designerLeSupport: 'dispelCarrierId' } as const satisfies { [A in ActionManuscrite]?: (typeof LOCALES_AU_CLIENT)[number] };

/** Classe qu'une action manuscrite peut prendre. */
type ClasseAdmise<A> = A extends OuvreurParHote ? 'hôte' : A extends keyof typeof ELECTIONS_LOCALES ? 'local' : ClasseCoop;

/** Table TOTALE des classes coop d'un état de store `S`. */
export type TableDesClasses<S = ActionsDuNoyau> = { [A in ActionManuscrite<S>]: ClasseAdmise<A> };

/** Classe coop de chaque action manuscrite du noyau. */
export const CLASSE_DES_ACTIONS_DU_NOYAU = {
  // ═══ invité : COMBAT (le clic du champ, l'offre du registre, les OUVREURS de flux) ═══
  // Le clic du champ (`cliquerLaCase`) : en combat, routé par ce qu'il désigne ; hors combat, le geste du siège du monde
  // (`netOwnership.ROUTES`).
  cliquerLaCase: 'invité', effacerLApercu: 'invité',
  // L'offre du registre (`jouerLOffre`) : son corps se joue chez l'hôte, routé par le lieu de l'offre
  // (`lieuDeLOffre`, `netOwnership.ROUTES`) ; un relais ou une pure intention se joue chez l'émetteur.
  jouerLOffre: 'invité', desarmerLeMode: 'invité',
  // Les gestes d'un lanceur et d'un porteur, en combat comme hors combat : routés par le siège du lanceur ou du porteur
  // (1ᵉʳ argument, `netOwnership.ROUTES`).
  incanterLeSort: 'invité', focaliserLeSort: 'invité', dissiperLeSort: 'invité', utiliserLObjet: 'invité',
  prendreLaPanoplie: 'invité', depenserLaDetermination: 'invité',
  // Le franchissement d'une arête (escalade, chute volontaire, enjambement d'une croisée #700) : la possession de l'actif
  // (repli universel) ; la DÉCLARATION de rangée d'une chute est routée par le siège du tombant (`netOwnership`).
  franchirLArete: 'invité',
  // Le réglage d'un jet en attente (`jetRegler`, `REGLAGES_DU_JET`) : routé par le porteur de son jet, ou par celui de
  // sa rangée ou de sa valeur quand le réglage le déclare, `netOwnership.ROUTES`.
  jetRegler: 'invité',
  // La sortie d'une fenêtre (`fenetreFermer`) : routée sur la fenêtre de son 1ᵉʳ argument, par le siège que son
  // registre déclare (`sortie` : son propriétaire, ou l'hôte seul), `netOwnership.ROUTES`.
  fenetreFermer: 'invité',
  // La validation d'une fenêtre (`fenetreValider`) : routée sur la fenêtre de son 1ᵉʳ argument, par le siège que son
  // registre déclare (`validation` : l'hôte seul, ou chaque siège à quorum), `netOwnership.ROUTES`.
  fenetreValider: 'invité',
  // Le choix d'une fenêtre (`fenetreChoisir`) : routé sur la fenêtre de son 1ᵉʳ argument, par le siège que son choix
  // déclare (`CHOIX_DES_FENETRES`) ; le choix de l'hôte se refuse dans l'état d'un invité (`refusDuChoix`).
  fenetreChoisir: 'invité',
  // Infirmerie (hors combat) : patients / actes / chirurgie — l'hôte valide.
  // Chirurgie : ouvrirLaChirurgie POSE la passe, les verbes de jet sur `surgery` l'influencent,
  // `jetValider('surgery')` applique, `jetAnnuler('surgery')` annule la passe, `fenetreChoisir('medic', 'abandon', true)`
  // l'opération.
  soignerLePatient: 'invité', ouvrirLaChirurgie: 'invité',
  // (Psychologie de COMBAT et à la rencontre : passent par les verbes de jet de la cascade.)
  promouvoirLeCombattant: 'invité',
  // Tir rapide (Talent « Tir rapide ») pendant la pause de début de Round : ARMER la visée depuis la
  // frise, routé sur le TIREUR : pendant la pause il n'y a AUCUN combattant actif (`turn: -1`), donc le
  // repli universel le refusait à tout siège invité. Le tir est le clic du combattant (`cliquerLaCase`).
  armerLeTirPreventif: 'invité',
  // Demande de pause au prochain Round : POSER et RETIRER passent par le même verbe (interrupteur
  // de la frise) — une bascule dont un seul sens serait répliqué laisserait la table bloquée.
  leverLaMain: 'invité',
  // ═══ invité : GROUPE — composition (chaque siège SES emplacements, tranchée par `ROUTES`) et carnet
  // d'enquête (#670, `TOUJOURS` : épingle de groupe, nouveauté vue par siège). ═══
  recruterLeHeros: 'invité', renvoyerLeHeros: 'invité', remplacerLeHeros: 'invité', epinglerLIndice: 'invité',
  marquerLesIndices: 'invité',
  // ═══ invité : INTERLUDE (LDB 23) — chaque Activité vise un héros (1er argument ou pending/dépôt),
  // possession validée par `intentAllowedFor`. ═══
  // `pratiquerLActivite` = chemin UNIQUE de toutes les Activités à jet (Revenus/Artisanat/Apprentissage/
  // Identification + catalogue) ; `fabriquerLObjet` engage l'ouvrage (setup, sans jet).
  pratiquerLActivite: 'invité', fabriquerLObjet: 'invité', commanderLObjet: 'invité',
  deposerALaBanque: 'invité', retirerDeLaBanque: 'invité', suivreLEntrainement: 'invité', solderLaFaveur: 'invité',
  // Préparation de bataille : le héros MENEUR est le 2e argument ; l'affectation de l'armée
  // (`affecterLeHeros`), partagée, reste à l'hôte.
  menerLActionDeBataille: 'invité',
  // ═══ hôte / local : émis par un écran ═══
  // Élection LOCALE d'écran, hors réseau PAR CONSTRUCTION (même famille que `localIntent`) : le clic
  // qui élit le porteur du mode Dissiper n'engage rien — il ouvre le choix du Sort CHEZ CE JOUEUR.
  // `netFlow.emettreIntentInvite` le joue dans le store de l'émetteur et n'envoie aucun intent ; le
  // COMMIT, lui (`dissiperLeSort`), est exposé. Voyager le ferait naître chez l'HÔTE.
  designerLeSupport: 'local',
  // ── Exploration (miroir V1) ───────────────────────────────────────────────────────────────────
  ouvrirLaCarte: 'hôte', ouvrirLeLieu: 'hôte', partirEnVoyage: 'hôte',
  marchanderLeBillet: 'hôte', reprendreLeVoyage: 'hôte',
  fixerLaCadence: 'hôte', quitterLaScene: 'hôte', fouillerLaPiece: 'hôte',
  // Le groupe en exploration : offre d'une entité (pastille), porte, pas et pivot du regard.
  jouerAction: 'hôte', actionnerLaPorte: 'hôte', avancerDUnPas: 'hôte', pivoterLeGroupe: 'hôte',
  // ── Fiche de personnage : progression (PX), équipement, sorts hors combat ─────────────────────
  acheterLaCaracteristique: 'hôte', acheterLaCompetence: 'hôte', acheterLeTalent: 'hôte', acheterLeSort: 'hôte',
  changerDeCarriere: 'hôte', designerLeCreneau: 'hôte', entrainerLaProthese: 'hôte', acheterLaComposante: 'hôte',
  retirerLaComposante: 'hôte', ecrireLHistorique: 'hôte', rompreLaFaveur: 'hôte',
  ouvrirLeMedecin: 'hôte', evaluerLObjet: 'hôte', evaluerLeButin: 'hôte',
  // ── Possessions / inventaire / équipement (lot coop non ouvert) ───────────────────────────────
  equiperLObjet: 'hôte', rangerLObjet: 'hôte', transmettreLObjet: 'hôte', poserLApparence: 'hôte',
  garnirLaPanoplie: 'hôte', creerLaPanoplie: 'hôte', supprimerLaPanoplie: 'hôte',
  cederLaPossession: 'hôte', renommerLaPossession: 'hôte', recupererLaPossession: 'hôte',
  remiserLaPossession: 'hôte', embarquer: 'hôte', debarquer: 'hôte',
  // ── Bourse du groupe : marché terrestre, marchand, port ───────────────────────────────────────
  payerLesAchats: 'hôte', vendreLeLot: 'hôte',
  troquerLesObjets: 'hôte', reparerLObjet: 'hôte', chercherLaDisponibilite: 'hôte', marchanderLePrix: 'hôte',
  refuserLeMarche: 'hôte', ouvrirLaBoutique: 'hôte', ouvrirLeMarche: 'hôte',
  acheterLaCargaison: 'hôte', vendreLaCargaison: 'hôte', jeterLaCargaison: 'hôte',
  evaluerLeVin: 'hôte', deplacerLaCargaison: 'hôte', ouvrirLePort: 'hôte', reparerLeNavire: 'hôte', carenerLeNavire: 'hôte',
  installerLAmelioration: 'hôte', recruterLEquipage: 'hôte', renvoyerLEquipage: 'hôte', recueillirLesRumeurs: 'hôte',
  // ── Navire / rôles / conseil de bord ──────────────────────────────────────────────────────────
  attribuerLeRoleABord: 'hôte', affecterALaStation: 'hôte', attribuerLeRoleDeMarche: 'hôte', approvisionnerLaPiece: 'hôte',
  // ── Décisions de GROUPE (taverne, poursuite) ──────────────────────────────────────────────────
  jouerALaTaverne: 'hôte', ouvrirLesJeux: 'hôte',
  // ── Interlude : bataille de masse ─────────────────────────────────────────────────────────────
  affecterLeHeros: 'hôte', avancerLaBataille: 'hôte', engagerLaMelee: 'hôte',
  affronterLePeril: 'hôte', rallierLesTroupes: 'hôte', jouerLaScene: 'hôte',
  // ── Repos / butin / victoire / défaite ────────────────────────────────────────────────────────
  ouvrirLeRepos: 'hôte', depecerLaCreature: 'hôte',
  // ── La Chance regagnée (règle optionnelle), la fin de séance ──
  restaurerLaFortune: 'hôte', ouvrirLaFinDeSeance: 'hôte',
  // Armement d'intention au clavier (registre `state/clavier/keybindings.ts`) : n'écrit que `localIntent`.
  armerLIntention: 'local',
} as const satisfies TableDesClasses;

type Classes = typeof CLASSE_DES_ACTIONS_DU_NOYAU;
/** Actions manuscrites d'une classe donnée. */
export type ActionDeClasse<C extends ClasseCoop> = { [K in keyof Classes]: Classes[K] extends C ? K : never }[keyof Classes];

const INVITEES = (Object.keys(CLASSE_DES_ACTIONS_DU_NOYAU) as (keyof Classes)[]).filter((a) => CLASSE_DES_ACTIONS_DU_NOYAU[a] === 'invité');

/** Groupe : composition et carnet d'enquête. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set<ActionDeClasse<'invité'>>([
  'recruterLeHeros', 'renvoyerLeHeros', 'remplacerLeHeros', 'epinglerLIndice', 'marquerLesIndices',
]);

/** Activités d'interlude. `startInterlude` est `hôte`, et la clôture se valide par l'hôte (`fenetreValider('interlude')`) :
 *  l'hôte seul ouvre et clôt la période. */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set<ActionDeClasse<'invité'>>([
  'pratiquerLActivite', 'fabriquerLObjet', 'commanderLObjet', 'deposerALaBanque', 'retirerDeLaBanque',
  'suivreLEntrainement', 'solderLaFaveur', 'menerLActionDeBataille',
]);

/** Intents manuscrits du COMBAT : la classe `invité` hors groupe et interlude. */
export const MANUAL_COMBAT_INTENTS: readonly string[] = INVITEES.filter((a) => !PARTY_INTENTS.has(a) && !INTERLUDE_INTENTS.has(a));

export const COMBAT_INTENTS: ReadonlySet<string> = new Set([...MANUAL_COMBAT_INTENTS, ...coopFlowIntents()]);

/** Allowlist complète côté hôte / interception côté invité. */
export const GUEST_INTENTS: ReadonlySet<string> = new Set([...COMBAT_INTENTS, ...PARTY_INTENTS, ...INTERLUDE_INTENTS]);

type FluxMono = { [K in keyof Table]: Table[K] extends { kind: 'mono' } ? K : never }[keyof Table];
type Ouvreurs<C extends ClasseCoop> = readonly [ActionDeClasse<C>, ...ActionDeClasse<C>[]];
/**
 * OUVERTURE de chaque flux mono — total sur `FluxMono` : sans ouvreur atteignable, ses verbes exposés
 * sont une surface MORTE.
 *  - `parInvite` : ouvreurs qu'un invité doit pouvoir demander (classe `invité`) ;
 *  - `parHote` : ouvreurs d'un ÉCRAN piloté par l'hôte (classe `hôte`) — le jet, une fois ouvert, est
 *    joué ENTIER par le siège de son porteur (verbes de jet, clôture comprise, routes de `netOwnership`) ;
 *  - `interne` : aucune action de store n'ouvre ce flux — la valeur NOMME le site qui le pose.
 * Ses ouvreurs `parHote` fixent leur classe dans `TableDesClasses` : la table n'est donc vérifiée
 * qu'après sa déclaration (`_ouvertureTotale`).
 */
export type Ouverture = { parInvite: Ouvreurs<'invité'>; interne?: SiteInterne } | { parHote: Ouvreurs<'hôte'> } | { interne: SiteInterne };
const OUVERTURE_DES_FLUX = {
  attack: { parInvite: ['cliquerLaCase', 'jouerLOffre'] },
  defense: { interne: 'réaction : combatFlow.maybeOpenDefense / openSurfacedDefense' },
  cast: { parInvite: ['jouerLOffre', 'cliquerLaCase', 'incanterLeSort'] },
  disengage: { parInvite: ['jouerLOffre'] },
  auContact: { parInvite: ['cliquerLaCase'] }, // ciblage (targetingModes.attackClickCommit)
  grapple: { parInvite: ['cliquerLaCase'] }, // ciblage (targetingModes.attackClickCommit)
  battement: { parInvite: ['jouerLOffre'] },
  distraire: { parInvite: ['jouerLOffre'] },
  maneuver: { parInvite: ['cliquerLaCase'] }, // manœuvre de créature : ciblage (targetingModes.attackClickCommit)
  run: { parInvite: ['cliquerLaCase'] }, // course armée (combatSlice.cliquerLaCaseDuCombat)
  reload: { parInvite: ['jouerLOffre'] },
  // Main ensanglantée (AA 07 l.117) : posé par l'ouverture d'attaque (interne) ET par la 2ᵉ frappe à
  // deux armes, que joue le clic du combattant.
  handGate: { parInvite: ['cliquerLaCase'], interne: 'combatFlow.openAttackCascade (Test par Action)' },
  recover: { parInvite: ['jouerLOffre'] },
  focus: { parInvite: ['jouerLOffre', 'focaliserLeSort'] },
  dispel: { parInvite: ['jouerLOffre', 'dissiperLeSort'] },
  frenzy: { parInvite: ['jouerLOffre'] },
  approach: { parInvite: ['cliquerLaCase'] }, // gate de Peur (combatSlice.fearGateBlocks)
  ward: { parInvite: ['cliquerLaCase'] }, // ciblage (targetingModes.attackClickCommit)
  heal: { parInvite: ['cliquerLaCase', 'soignerLePatient'] }, // ciblage (targetingModes) ; infirmerie
  surgery: { parInvite: ['ouvrirLaChirurgie'] },
  corruption: { interne: 'exposition/seuil : combatEffects (Effect) et corruptionFlow.gainCorruption' },
  test: { interne: 'combatEffects.openSkillTest (Effet de scène, dialogue, consommable)' },
  steamSave: { interne: 'panne de vapeur : seaVoyageFlow.openSteamSave' },
  activity: { parInvite: ['pratiquerLActivite'] },
  bargain: { parHote: ['marchanderLePrix'] },
  appraise: { parHote: ['evaluerLObjet', 'evaluerLeButin'] },
  shanty: { parInvite: ['jouerLOffre'] },
} as const;
type FluxOuverts = keyof typeof OUVERTURE_DES_FLUX;
const _ouvertureTotale: Record<FluxMono, Ouverture> & Record<Exclude<FluxOuverts, FluxMono>, never> = OUVERTURE_DES_FLUX;
void _ouvertureTotale;
type OuvreurParHote = { [K in FluxOuverts]: (typeof OUVERTURE_DES_FLUX)[K] extends { parHote: readonly (infer A)[] } ? A : never }[FluxOuverts];

/** Sort d'une intention de siège : ignorée hors allowlist, refusée hors possession, sinon appliquée. */
export type IssueDIntention = 'hors-allowlist' | 'refusee' | 'appliquee';

/**
 * Intention d'un SIÈGE appliquée dans l'état du propriétaire (spec coop §4bis, #1017). Ordre :
 *  1. allowlist `GUEST_INTENTS` : hors liste, rien, ni effet ni journal ;
 *  2. possession `intentAllowedFor` : refus au journal ;
 *  3. l'action AU NOM du siège (`withActingSeat`), seul canal du siège (`decidingSeat`) : les gardes « ce siège possède-t-il ce combattant ? »
 *     (`controlsCombatant`) jugent l'émetteur, et l'intention armée du propriétaire ne s'y lit pas
 *     (`localIntent.intentionDuProprietaire`) : seul compte le verdict joint aux args.
 */
export function appliquerLIntentionDUnSiege(get: Get, siege: number, action: string, args: readonly unknown[]): IssueDIntention {
  if (!GUEST_INTENTS.has(action)) return 'hors-allowlist';
  if (!intentAllowedFor(get(), siege, action, [...args])) {
    get().log(t('coop.intentRefused'));
    return 'refusee';
  }
  const fn = (get() as unknown as Record<string, unknown>)[action];
  if (typeof fn === 'function') withActingSeat(siege, () => (fn as (...a: readonly unknown[]) => void)(...args));
  return 'appliquee';
}
