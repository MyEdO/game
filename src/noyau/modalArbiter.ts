/**
 * REGISTRE des modales de combat (R2 + coop) — une entrée par modale, l'ORDRE du tableau est la
 * priorité d'affichage. Chaque entrée déclare :
 *  - `when`  : le pending qui l'active ;
 *  - `owner` : le combattant CONCERNÉ (gating coop « chacun voit SES modales » + validation des
 *              intents côté hôte) — `'*'` = tout le monde (sort ennemi : Contre-sort multi),
 *              `undefined` = aucun acteur joueur → l'HÔTE seul.
 *  - `auto`  : POLITIQUE d'automatisation « Cadence de combat » (cf. `combatAuto.ts`) — REQUISE :
 *              ajouter une modale FORCE à déclarer comment elle s'auto-résout (le commit ne compile
 *              pas sinon → exhaustivité garantie). `self` = jet propre (drive = actions à enchaîner),
 *              `choice` = vrai choix joueur (Rapide laisse ; l'IA tranche en Auto-combat), `partial` =
 *              pilote dédié (cascade pas-à-pas, révélation auto-acquittée), `hostOnly` = hors-combat / jamais auto.
 *
 * AJOUTER UNE MODALE = UNE entrée ici (+ son composant dans `ui/ActiveModal.COMPONENT`).
 * `pickActiveModalKey` et `modalOwnerOf` sont DÉRIVÉS du registre — rien d'autre à toucher.
 */
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FlowKey } from './flowVerbs';
import type { ReglageDuJet } from './reglagesDuJet';
import type { AxeDuChoix, FenetreAChoix } from './choixDesFenetres';
import { WORLD_STEP_OWNER } from './pendings';
import type { PendingKey } from './stateFields';
import { PORTEURS_D_ETAPE, sansCorps } from './slotsDeJet';
import { rangeesDuesDeChute } from './fallMove';
import { porteurParId } from './monde/combatants';
import type { FermetureDuJet } from './rollFlowFactory';

/** État partiel accepté par l'arbitre (les tests passent des objets minces). */
export type ArbiterState = Partial<Jeu>;

/** Verbes qu'un joueur JOUE dans une fenêtre (jet, choix, confirmation, refus) : des actions de la partie. */
export type VerbesDeFenetre = readonly (keyof ActionsDuNoyau)[];

/** La déclaration EXPLICITE d'une fenêtre sans verbe de joueur à elle (pur affichage, ou geste de l'hôte seul) :
 *  une liste vide anonyme ne la vaut pas (`fenetres-nomment-leurs-verbes.hors-store.test.ts`). */
export const AUCUN_VERBE_DE_JOUEUR: readonly never[] = Object.freeze([]);

/** Un geste d'une fenêtre : un verbe de la partie ; un verbe de jet (`NomDeVerbeDeJet`) nomme le flux qu'il vise, et
 *  `toutes` quand il joue sa rangée omise sur un flux à plusieurs jets (« Tout résoudre » : `jetLancer('cascade')`) ; le
 *  réglage d'un jet (`jetRegler`) son flux et son réglage, `toutes` sur sa rangée omise (« Tout déclarer »), et la
 *  valeur que la fenêtre y pose (`valeur`) ; le choix d'une fenêtre (`fenetreChoisir`) sa fenêtre et son axe, la validation
 *  (`fenetreValider`) ou la sortie (`fenetreFermer`) d'une fenêtre la fenêtre qu'elle valide ou ferme. */
export interface GesteDuJeu { verbe: keyof ActionsDuNoyau; flux?: FlowKey; toutes?: true; reglage?: ReglageDuJet; valeur?: string; fenetre?: FenetreQuiSeFerme | FenetreAValider | FenetreAChoix; axe?: AxeDuChoix }

/** L'identité d'un geste dans sa fenêtre : son verbe, et le flux d'un verbe de jet (`jetLancer@attaque`, `jetLancer@cascade*`
 *  pour sa rangée omise), le flux et le réglage d'un réglage (`jetRegler@attaque#arme`), la fenêtre et l'axe d'un choix
 *  (`fenetreChoisir@destin#issue`) ou la fenêtre d'une validation ou d'une sortie (`fenetreFermer@conseil`). */
export const cleDuGeste = (g: GesteDuJeu): string => {
  const cible = g.flux ?? g.fenetre;
  const axe = g.reglage ?? g.axe;
  return `${g.verbe}${cible ? `@${cible}` : ''}${g.toutes ? '*' : ''}${axe ? `#${axe}` : ''}`;
};

/** Qui ferme une fenêtre (`fenetreFermer`) : le siège de son propriétaire (`owner`), l'hôte seul, ou le quorum
 *  (`quorum` : l'appel d'un siège le marque prêt dans le `readyBySeat` de son pending, et la fenêtre se ferme quand les
 *  sièges requis le sont, `quorumAtteint`). */
export type QuiFermeLaFenetre = 'hote' | 'proprietaire' | 'quorum';

/** Qui valide une fenêtre (`fenetreValider`) : comme qui la ferme, ou l'hôte au quorum (`hoteAuQuorum` : l'appel d'un
 *  siège le marque prêt, l'appel de l'hôte valide la fenêtre une fois le quorum atteint). */
export type QuiValideLaFenetre = QuiFermeLaFenetre | 'hoteAuQuorum';

/** Une rangée d'une fenêtre à plusieurs jets : l'id que ses verbes désignent (`pid`). */
export interface RangeeDeFenetre { id: string; interactive?: boolean; result?: unknown }

/** Un soin est-il en cours à l'infirmerie : un soin lancé, une passe d'opération ou une opération armée ? Ferme la
 *  sortie de l'infirmerie et verrouille son patient (`OUVERTS_DU_CHOIX.infirmerie.patient`). */
export const soinEnCours = (s: Partial<Pick<Jeu, 'pendingHeal' | 'pendingSurgery' | 'medic'>>): boolean =>
  s.pendingHeal?.roll != null || !!s.pendingSurgery || !!s.medic?.surgery;

/** Le DÉCIDEUR du soin lancé ou de la passe à l'infirmerie : le soigneur s'il est un combattant, sinon le patient (un
 *  PNJ soigneur n'a pas de siège) ; tous (`'*'`) tant qu'aucun jet n'est lancé. */
function decideurDuSoin(s: Partial<Jeu>): string {
  const jet = s.pendingHeal?.roll != null ? s.pendingHeal : s.pendingSurgery;
  if (!jet) return '*';
  return porteurParId(s as Jeu, jet.healerId) ? jet.healerId : jet.targetId; // le soin existe à l'infirmerie : `party` est posé
}

/**
 * Politique d'auto-résolution d'une modale (Cadence Rapide/Auto). Les gestes de `drive` sont des
 * résolveurs RÉELS du noyau (`GesteDuJeu`, vérifiés par `modalAuto.hors-store.test.ts`), joués sans autre argument que
 * leur flux — jamais une dérivation (le mapping clé→action n'est PAS 1:1 : `recuperation`→`recover`,
 * `corruption`→`jetValider('corruption')`…). Les jets de COMBAT (attaque/défense/cast/…) sont des étapes de la
 * `cascade` (`partial`), pilotées via `JET_AUTO` dans `combatAuto`.
 */
export type AutoPolicy =
  | { mode: 'self'; drive: readonly GesteDuJeu[] }                    // jet propre : enchaîner roll → confirm
  | { mode: 'choice'; autoDrive?: readonly GesteDuJeu[] }             // vrai choix : Rapide LAISSE (joueur) ;
                                                                            // Auto-combat tranche — `autoDrive` = actions à
                                                                            // enchaîner si l'IA doit le résoudre (ex. cast)
  | { mode: 'partial' }                                                    // cascade / révélation : pilote dédié (combatAuto)
  | { mode: 'hostOnly' };                                                  // hors-combat / hôte : jamais auto-résolu

export interface ModalDef<K extends string = string> {
  key: K;
  /** Le pending de cette modale est-il posé ? (condition d'ÉLECTION : la fenêtre à RENDRE) */
  when: (s: ArbiterState) => boolean;
  /** La situation TIENT-ELLE LA MAIN, même sans fenêtre rendue ? Défaut : `when`. Une modale peut
   *  déléguer son geste à la CARTE (désignation de cibles d'un sort) : plus de fenêtre à élire, mais
   *  les gestes qui ENGAGENT ou QUITTENT le tour restent fermés (#1852) — la situation, elle, dure.
   *  Lu par `modalHolds` (gardes clavier/manette), jamais par le rendu. */
  tientLaMain?: (s: ArbiterState) => boolean;
  /** Combattant concerné ('*' = tous ; undefined = hôte seul). */
  owner: (s: ArbiterState) => string | undefined | '*';
  /** Politique d'automatisation (Cadence de combat) — REQUISE. */
  auto: AutoPolicy;
  /** Clé(s) `pending*` que CETTE modale possède/rend — REQUISE (patron `auto` ci-dessus, #284). Une
   *  entrée normale porte SA seule clé (`'destin'` → `['pendingFateSave']`) ; `cascade`/`infirmerie`
   *  couvrent en plus les pendings COEXISTANTS qu'elles rendent (porteurs de données d'une étape —
   *  `pendingAttack`/`pendingCast`/… sont rendus par elles, cf. commentaires ci-dessous). Preuve
   *  exhaustive AU COMPILATEUR : `_pendingOwnerCoverageCheck` (fin de fichier) exige que l'union
   *  `covers` + `HORS_MODAL` reproduise EXACTEMENT `PendingKey` — un `pending*` oublié ne compile pas. */
  covers: readonly PendingKey[];
  /** Les flux de jet (`FLOW_VERBS`) que la fenêtre rend : leurs verbes et leurs clôtures sont les siens. */
  flux?: readonly FlowKey[];
  /** Les verbes du joueur que ni `auto`, ni `flux`, ni ses choix (`ChoixDesFenetres`) ne nomment. La fenêtre nomme ce
   *  qu'on y joue (`fenetreDuJeu`, `gestesDeLaFenetre`). */
  verbes?: VerbesDeFenetre;
  /** Les rangées que ses verbes désignent par leur id (`pid`) — REQUISES quand un de ses `flux` est multi : la fenêtre
   *  rend l'id de la rangée due (`fenetreDuJeu`). */
  rangees?: (s: ArbiterState) => readonly RangeeDeFenetre[] | undefined;
  /** La fenêtre se ferme (`fenetreFermer`), par le siège que ce champ nomme. */
  sortie?: QuiFermeLaFenetre;
  /** Ce qui ferme sa sortie maintenant ; absent : ouverte tant que la fenêtre l'est (`when`). */
  sortieFermee?: (s: ArbiterState) => FermetureDuJet | null;
  /** La fenêtre se valide (`fenetreValider`), par le siège que ce champ nomme ; ce qui ferme sa validation se lit à
   *  `FERMETURES_DE_LA_VALIDATION` (`validationDeFenetre.ts`). */
  validation?: QuiValideLaFenetre;
}

export const MODAL_DEFS = [
  { key: 'destin', when: (s) => !!s.pendingFateSave, owner: (s) => s.pendingFateSave?.heroId, auto: { mode: 'choice' }, covers: ['pendingFateSave'] },
  // (La Maladresse est une étape `jet:'maladresse'` de la cascade `combat`, rendue par `cascade` ci-dessous
  //  (CascadeModal → useFumbleJetProps). La donnée (arme/résultat) vit SUR l'étape (`step.maladresse`), source
  //  unique lue par `jetLancer('maladresse')` ; `jetValider('maladresse')` applique les Oups ! et enchaîne le curseur.)
  // (Le Renversement (Déstabilisante) n'ouvre AUCUNE modale et ne pose aucun `pending*` : il se résout
  //  dans l'attribution d'Avantage de `applyAttackResult` (`reversalStealOne`, `combat/advantagePool.ts`).)
  // LOT DE DÉS d'un étal (#1426) : aucun personnage n'est concerné — c'est le MONDE qui tire. Owner =
  // le sentinel `WORLD_STEP_OWNER` (siège MJ s'il existe, hôte sinon), comme toute étape de monde.
  { key: 'etalLot', when: (s) => !!s.pendingEtalLot, owner: () => WORLD_STEP_OWNER, auto: { mode: 'self', drive: [{ verbe: 'jetValider', flux: 'etalLot' }] }, covers: ['pendingEtalLot'], flux: ['etalLot'], rangees: (s) => s.pendingEtalLot?.participants },
  // DÉSIGNATION d'un héros pour un état de campagne (EDO 02 l.91) : décision de GROUPE, au siège du
  // MONDE (`WORLD_STEP_OWNER` — celui de `ownsGroupDecision`, comme le dialogue) ; jamais auto-résolue. Elle se
  // clôt sans choix une fois aucun héros vivant à désigner.
  { key: 'designationHeros', when: (s) => !!s.pendingDesignationHeros, owner: () => WORLD_STEP_OWNER, auto: { mode: 'hostOnly' }, covers: ['pendingDesignationHeros'], sortie: 'proprietaire', sortieFermee: (s) => (s.party?.some((h) => !h.dead) ? 'herosADesigner' : null) },
  { key: 'renier', when: (s) => !!s.pendingRenounce, owner: (s) => s.pendingRenounce?.heroId, auto: { mode: 'choice' }, covers: ['pendingRenounce'] },
  // Battement (LDB 10 l.103) : jet PROPRE de CC (non opposé) → 'self' (Lancer puis Appliquer).
  { key: 'battement', when: (s) => !!s.pendingBattement, owner: (s) => s.pendingBattement?.attackerId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'battement' }, { verbe: 'jetValider', flux: 'battement' }] }, covers: ['pendingBattement'], flux: ['battement'] },
  // Distraire (LDB 10 l.364) : jet PROPRE d'Athlétisme opposé au Calme figé du foe → 'self' (le mover pilote son jet).
  { key: 'distraire', when: (s) => !!s.pendingDistraire, owner: (s) => s.pendingDistraire?.moverId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'distraire' }, { verbe: 'jetValider', flux: 'distraire' }] }, covers: ['pendingDistraire'], flux: ['distraire'] },
  { key: 'manoeuvre', when: (s) => !!s.pendingManeuver, owner: (s) => s.pendingManeuver?.attackerId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'manoeuvre' }, { verbe: 'jetValider', flux: 'manoeuvre' }] }, covers: ['pendingManeuver'], flux: ['manoeuvre'] },
  // (Une RÉVÉLATION — jet subi / sur table / d'entretien — est une ÉTAPE d'AFFICHAGE de la cascade
  //  (`CascadeStep.reveal`), rendue par l'entrée `cascade` ci-dessous : son owner est celui de l'étape
  //  courante (`actorId` = le concerné), comme tout pas de séquence.)
  // (La Défense est une étape `jet:'defense'` de la cascade `combat`, rendue par `cascade` ci-dessous
  //  (CascadeModal → useDefenseJetProps) — `pendingDefense` coexiste comme porteur de données. La défense
  //  ET son Critique/Maladresse vivent dans UNE seule fenêtre. Owner = `actorId` (le défenseur) de l'étape.)
  // (La Psychologie, EN COMBAT comme À LA RENCONTRE, est une cascade à N étapes — une par héros — rendue
  //  par `cascade`. Combat : passes de Round `openRoundStartPsych` / `openRoundEndCascade` (LDB 21 l.9,
  //  l.25). Rencontre : `openEncounterPsych` à l'entrée de scène.)
  // (Le Désengagement est une étape `jet:'desengagement'` de la cascade, rendue par `cascade` ci-dessous
  //  (`DisengageModal` bespoke) — `pendingDisengage` coexiste comme porteur de données/phases.)
  // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps PUIS choix du vainqueur → vrai CHOIX
  // (mode 'choice', comme `renier`/`cibleDeMonture`). Initiée par le joueur (jamais par l'IA) → aucun
  // auto-drive : en Rapide la modale reste au joueur, l'IA ne la déclenche pas (pas de hang).
  { key: 'auContact', when: (s) => !!s.pendingAuContact, owner: (s) => s.pendingAuContact?.moverId, auto: { mode: 'choice' }, covers: ['pendingAuContact'], flux: ['auContact'] },
  // Empoignade (LDB 14 l.161) : Test opposé de Force OU « Briser » PUIS choix du vainqueur → vrai CHOIX
  // (mode 'choice', comme `auContact`). Initiée par le joueur (jamais par l'IA) → pas d'auto-drive.
  { key: 'empoignade', when: (s) => !!s.pendingGrapple, owner: (s) => s.pendingGrapple?.actorId, auto: { mode: 'choice' }, covers: ['pendingGrapple'], flux: ['empoignade'] },
  { key: 'cibleDeMonture', when: (s) => !!s.pendingMountTarget, owner: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined), auto: { mode: 'choice' }, covers: ['pendingMountTarget'], sortie: 'proprietaire' }, // l'attaquant actif qui a cliqué le couple
  { key: 'frenesie', when: (s) => !!s.pendingFrenzy, owner: (s) => s.pendingFrenzy?.combatantId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'frenesie' }, { verbe: 'jetValider', flux: 'frenesie' }] }, covers: ['pendingFrenzy'], flux: ['frenesie'] },
  { key: 'approche', when: (s) => !!s.pendingApproach, owner: (s) => s.pendingApproach?.combatantId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'approche' }, { verbe: 'jetValider', flux: 'approche' }] }, covers: ['pendingApproach'], flux: ['approche'] },
  { key: 'protection', when: (s) => !!s.pendingWard, owner: (s) => s.pendingWard?.attackerId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'protection' }, { verbe: 'jetValider', flux: 'protection' }] }, covers: ['pendingWard'], flux: ['protection'] },
  { key: 'course', when: (s) => !!s.pendingRun, owner: (s) => s.pendingRun?.combatantId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'course' }, { verbe: 'jetValider', flux: 'course' }] }, covers: ['pendingRun'], flux: ['course'] },
  // Chute VOLONTAIRE (LDB 15 l.82) : initiée par le JOUEUR (clic sur une arête de capacité `chute`, jamais l'IA, cf. `franchirLArete`)
  // → vrai CHOIX (mode 'choice', comme `auContact`/`empoignade`) : Rapide/Auto-combat ne la déclenchent jamais.
  { key: 'chute', when: (s) => !!s.pendingFall, owner: (s) => s.pendingFall?.initiateurId, auto: { mode: 'choice' }, covers: ['pendingFall'], flux: ['chute'], rangees: (s) => (s.pendingFall ? rangeesDuesDeChute(s.pendingFall) : undefined) },
  { key: 'manoeuvreDuNavire', when: (s) => !!s.pendingShipManeuver, owner: (s) => s.pendingShipManeuver?.shipId, auto: { mode: 'choice' }, covers: ['pendingShipManeuver'], flux: ['manoeuvreDuNavire'], rangees: (s) => s.pendingShipManeuver?.participants }, // Test d'équipage MULTI : chaque PJ pilote SON jet (cf. RollRow), pas d'auto-drive mono
  { key: 'tirDeBatterie', when: (s) => !!s.pendingShipBattery, owner: (s) => s.pendingShipBattery?.shipId, auto: { mode: 'choice' }, covers: ['pendingShipBattery'], flux: ['tirDeBatterie'], rangees: (s) => s.pendingShipBattery?.participants }, // Tir de batterie MULTI (Artilleurs) — idem manœuvre
  { key: 'chansonDeMarin', when: (s) => !!s.pendingShanty, owner: (s) => s.pendingShanty?.singerId, auto: { mode: 'choice' }, covers: ['pendingShanty'], flux: ['chansonDeMarin'] }, // Chanson de marin : CHOIX de la chanson (pré-jet) — jamais auto-résolue
  { key: 'focalisation', when: (s) => !!s.pendingFocus, owner: (s) => s.pendingFocus?.casterId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'focalisation' }, { verbe: 'jetValider', flux: 'focalisation' }] }, covers: ['pendingFocus'], flux: ['focalisation'] },
  { key: 'dissipation', when: (s) => !!s.pendingDispel, owner: (s) => s.pendingDispel?.casterId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'dissipation' }, { verbe: 'jetValider', flux: 'dissipation' }] }, covers: ['pendingDispel'], flux: ['dissipation'] },
  // Infirmerie OUVERTE : c'est ELLE qui rend les jets EMBARQUÉS (soin OU passe de Chirurgie) — la modale
  // autonome `soins` (entrée ci-dessous) ne sert qu'au combat, et la Chirurgie est toujours hors combat.
  // Owner : le décideur du soin lancé ou de la passe (`decideurDuSoin`), sinon tous. `pendingSurgery` vit
  // DANS l'infirmerie (rendu par MedicModal), comme `pendingHeal` ici.
  // L'infirmerie CÈDE le devant à une CASCADE en cours (`!s.pendingCascade`) — le Test d'infection
  // post-opératoire (LDB 10 l.184) est un jet INFLUENÇABLE qui doit passer AU-DESSUS du panneau ; à sa
  // clôture l'infirmerie RÉAPPARAÎT (même patron que `soins` cédant à `infirmerie`).
  { key: 'infirmerie', when: (s) => !!s.medic && !s.pendingCascade, owner: decideurDuSoin, auto: { mode: 'hostOnly' }, covers: ['pendingSurgery'], flux: ['soins', 'chirurgie'], sortie: 'proprietaire', sortieFermee: (s) => (soinEnCours(s) ? 'soinEnCours' : null) }, // pendingHeal COUVERT par 'heal' ci-dessous (l'infirmerie le lit aussi, mais n'en est pas l'unique propriétaire)
  // Repos (nuit) : chacun règle SES héros et se dit prêt, l'hôte dort au quorum — modale chez tous.
  { key: 'repos', when: (s) => !!s.pendingRest, owner: () => '*', auto: { mode: 'hostOnly' }, covers: ['pendingRest'], validation: 'hoteAuQuorum', sortie: 'hote', sortieFermee: (s) => (s.pendingRest?.travelHalt ? 'halteDeVoyage' : null) },
  // Conseil de bord (paie hebdomadaire + Moral, #229) : décision de bourse PARTAGÉE → l'hôte seul (comme
  // les autres actions à l'argent du groupe, `CHOIX_DES_FENETRES.conseil`) ; hors-combat, jamais auto (la cadence
  // auto ne l'ouvre pas).
  { key: 'conseil', when: (s) => !!s.pendingCouncil, owner: () => undefined, auto: { mode: 'hostOnly' }, covers: ['pendingCouncil'], sortie: 'hote', sortieFermee: (s) => (s.pendingCouncil?.phase === 'bilan' ? null : 'paieDue') },
  { key: 'soins', when: (s) => !!s.pendingHeal && !s.medic, owner: (s) => s.pendingHeal?.healerId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'soins' }, { verbe: 'jetValider', flux: 'soins' }] }, covers: ['pendingHeal'], flux: ['soins'] },
  // (Le Contre-sort (Dissipation) est une RÉACTION au Sort figé dans `pendingCast`, rendue DANS la
  //  modale `cast` ci-dessous : une rangée `RollRow` par contre-lanceur (`pendingCounterspell
  //  .participants`), comme l'opposition de cible. « Le contre-sort, c'est le lancement d'un sort qui
  //  peut être opposé → pas une modale différente. » L'owner du Sort ennemi est déjà '*' (cf. `cast`).)
  // (L'enfoncement de porte est une étape `jet:'enfoncerLaPorte'` (groupOwner) de la cascade, rendue par
  //  `cascade` ci-dessous (`ForceDoorModal` bespoke) — `pendingForceDoor` coexiste comme porteur de
  //  données/participants ; chacun ne pilote que ses héros (gating per-participant côté UI).)
  // (Le Test étendu est une cascade `jet:'testEtendu'` rendue par `cascade` ci-dessous (CascadeModal →
  //  useExtendedTestJetProps) — `pendingExtendedTest` coexiste comme porteur de données, comme `pendingAttack`.)
  // CASCADE séquentielle (jets de nuit/voyage) : l'étape COURANTE a son héros → modale chez son
  // propriétaire (coop : chaque contrôleur influence ses propres jets, l'un après l'autre).
  // Le CIBLAGE CARTE d'une incantation (`pickingTargets` / pose de zone) EFFACE la fenêtre : la carte
  // prend la main, le joueur y désigne ses cibles. C'est une condition d'ÉLECTION (#1852) : l'arbitre
  // n'élit jamais une modale dont le corps serait vide. La cascade reste OUVERTE (le curseur ne bouge
  // pas) et la SITUATION tient toujours la main (`tientLaMain` ci-dessous, gardes clavier) : la
  // fenêtre revient dès la pose faite.
  { key: 'cascade', when: (s) => {
    if (!s.pendingCascade) return false;
    const cur = s.pendingCascade.participants[s.pendingCascade.cursor];
    if (sansCorps(s, cur)) return false;
    if (cur?.jet !== 'incantation') return true;
    return !s.pendingCast?.pickingTargets && !s.pendingCast?.zone?.placing;
  }, tientLaMain: (s) => !!s.pendingCascade, owner: (s) => {
    // Étape de GROUPE (enfoncer une porte) → '*' (chacun pilote ses héros) ; étape MONDE sans acteur
    // (`worldOwner`, seam #275 Décision 3 — désertion/Moral) → sentinel routé au siège MJ par
    // `sieges.seatOwns` ; sinon le héros de l'étape.
    const cur = s.pendingCascade?.participants[s.pendingCascade.cursor];
    if (cur?.groupOwner) return '*';
    if (!cur?.actorId && cur?.worldOwner) return WORLD_STEP_OWNER;
    return cur?.actorId;
  }, auto: { mode: 'partial' },
  // La sortie de la séquence est son bilan : le curseur passé la dernière étape.
  sortie: 'proprietaire', sortieFermee: (s) => (s.pendingCascade && s.pendingCascade.cursor < s.pendingCascade.participants.length ? 'etapesDues' : null),
  covers: [
    'pendingCascade',
    // Porteurs de données des étapes-jet (cf. `CascadeStep.jet`), rendues par CETTE entrée :
    ...PORTEURS_D_ETAPE,
    // Coexistent DANS l'étape `jet:'incantation'` (Contre-sort/opposition de cible, rendus par CastModal) :
    'pendingCounterspell', 'pendingCastOpposition',
  ] },
  // (L'incantation — la situation « lancer un sort » : jet → opposition de cible → Contre-sort →
  //  Surincantation/pose de zone → Critique → effets — est une étape `jet:'incantation'` de la cascade, rendue
  //  par `cascade` ci-dessus (`CastModal` bespoke). `pendingCast` coexiste comme porteur de données ; ses
  //  résolveurs ferment LES DEUX. OWNER équivalent : un Sort ENNEMI ouvre la cascade avec `groupOwner:true`
  //  → l'entrée `cascade` met l'owner à '*' (moment partagé + Contre-sort multi en coop) ; un Sort de HÉROS
  //  sans `groupOwner` → owner = `actorId` (le lanceur). Le ciblage CARTE (pickingTargets / pose de zone)
  //  efface la modale via le `return null` du renderer `cast` dans CascadeModal.)
  { key: 'rechargement', when: (s) => !!s.pendingReload, owner: (s) => s.pendingReload?.actorId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'rechargement' }, { verbe: 'jetValider', flux: 'rechargement' }] }, covers: ['pendingReload'], flux: ['rechargement'] },
  // Main ensanglantée (AA 07 l.117) : Test de Dextérité PAR ACTION — jet PROPRE de l'attaquant (`self`) ;
  // en cadence Rapide/Auto le driver le résout (Lancer → Appliquer), comme `reload`.
  { key: 'mainEnsanglantee', when: (s) => !!s.pendingHandGate, owner: (s) => s.pendingHandGate?.attackerId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'mainEnsanglantee' }, { verbe: 'jetValider', flux: 'mainEnsanglantee' }] }, covers: ['pendingHandGate'], flux: ['mainEnsanglantee'] },
  { key: 'recuperation', when: (s) => !!s.pendingStateRecovery, owner: (s) => s.pendingStateRecovery?.actorId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'recuperation' }, { verbe: 'jetValider', flux: 'recuperation' }] }, covers: ['pendingStateRecovery'], flux: ['recuperation'] },
  // Sauvegarde d'Initiative « Fuite de vapeur » (MDG 12 l.326-328) : jet PROPRE de la personne au moteur.
  { key: 'fuiteDeVapeur', when: (s) => !!s.pendingSteamSave, owner: (s) => s.pendingSteamSave?.actorId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'fuiteDeVapeur' }, { verbe: 'jetValider', flux: 'fuiteDeVapeur' }] }, covers: ['pendingSteamSave'], flux: ['fuiteDeVapeur'] },
  // (L'attaque est une étape `jet:'attaque'` de la cascade `combat`, rendue par `cascade` ci-dessus
  //  (CascadeModal → useAttackJetProps) — `pendingAttack` coexiste comme porteur de données. TOUS les
  //  chemins d'attaque (Charge / normale / gratuite + balayage/dual qui réutilisent) ouvrent une cascade.
  //  L'auto-résolution passe donc par `JET_AUTO['attack']` (combatAuto).)
  // (Le Test de scène est une cascade `jet:'test'` rendue par `cascade` ci-dessus (CascadeModal →
  //  useTestJetProps) — `pendingTest` coexiste comme porteur de données, comme `pendingAttack` pour l'attaque.)
  // Jet d'Activité d'interlude (LDB 23) — hors combat, même règle coop qu'en combat : le PROPRIÉTAIRE
  // du héros joue, les autres voient « X joue… ».
  { key: 'activite', when: (s) => !!s.pendingActivity, owner: (s) => s.pendingActivity?.heroId, auto: { mode: 'hostOnly' }, covers: ['pendingActivity'], flux: ['activite'] },
  { key: 'corruption', when: (s) => !!s.pendingCorruption, owner: (s) => s.pendingCorruption?.heroId, auto: { mode: 'self', drive: [{ verbe: 'jetLancer', flux: 'corruption' }, { verbe: 'jetValider', flux: 'corruption' }] }, covers: ['pendingCorruption'], flux: ['corruption'] },
] as const satisfies readonly ModalDef[];

export type ModalKey = (typeof MODAL_DEFS)[number]['key'];

/** PURE : la définition de la modale ACTIVE (1ʳᵉ entrée active du registre). `undefined` = aucune. */
export const modaleActive = (s: ArbiterState): ModalDef<ModalKey> | undefined => (MODAL_DEFS as readonly ModalDef<ModalKey>[]).find((d) => d.when(s));

/** PURE : la modale à afficher MAINTENANT (`modaleActive`). `null` = aucune.
 *  Frappe Mortelle / 2ᵉ frappe / Surincantation « +Cible » = ciblages CARTE (pas de modale). */
export function pickActiveModalKey(s: ArbiterState): ModalKey | null {
  return (modaleActive(s)?.key as ModalKey | undefined) ?? null;
}

/** Combattant concerné par la MODALE ACTIVE (ou '*' / undefined). null = aucune modale. */
export function modalOwnerOf(s: ArbiterState): string | undefined | '*' | null {
  const def = modaleActive(s);
  return def ? def.owner(s) : null;
}

/** Politique d'auto-résolution de la modale ACTIVE (cf. `combatAuto.ts`). null = aucune modale. */
export function autoPolicyOf(s: ArbiterState): AutoPolicy | null {
  return modaleActive(s)?.auto ?? null;
}

/** Une modale du registre tient-elle la MAIN ? — verdict des gardes de PILOTAGE (fin de tour, barre
 *  d'action, menu système), DISTINCT de l'élection d'une fenêtre (`pickActiveModalKey`) : une modale
 *  qui a délégué son geste à la CARTE n'a plus de fenêtre à rendre et tient pourtant la main
 *  (`tientLaMain`). (Le verdict « la carte est-elle inerte ? » y ajoute l'exception des interludes
 *  pilotés par la carte : `state/mapHover.ts`.) */
export function modalHolds(s: ArbiterState): boolean {
  return (MODAL_DEFS as readonly ModalDef[]).some((d) => (d.tientLaMain ?? d.when)(s));
}

/**
 * L'écran-hub de VOYAGE (`VoyageScreen`, #333) est-il la surface active ? Un voyage EN COURS (non
 * interrompu, hors recap d'arrivée), en exploration, carte fermée, hors combat → le hub plein-champ
 * HÉBERGE la cascade du jour (rendue EN SON CENTRE, `CascadeBody embedded`) au lieu d'une modale
 * flottante (le geste anti-tunnel). `ActiveModal` supprime alors la cascade flottante ; la porte de
 * consultation (Dossier navire, fiches) reste ouvrable par-dessus (règle GÉNÉRALE, pas par-écran). */
export function voyageHubActive(s: ArbiterState): boolean {
  return !!s.travelPlan && !s.travelPlan.interrupted && !s.travelRecap
    && s.mode === 'exploration' && !s.worldMapOpen && !s.battle;
}

/** Une ÉTAPE du hub de voyage attend (cascade du jour, nuit de halte OU relâche à terre d'accostage) —
 *  SOURCE UNIQUE pour forcer le hub ouvert (`CampaignView`) et choisir ce qu'incruster en son centre
 *  (`VoyageScreen`). La relâche (MDG 15) est une décision d'ACCOSTAGE intégrée au journal de voyage
 *  (arbitrage user 2026-07-11), plus une modale flottante quand le hub est actif. */
export function voyageStepPending(s: ArbiterState): boolean {
  return !!s.pendingCascade || !!s.pendingRest || !!s.pendingShoreLeave;
}

/**
 * Registre des pendings HORS-modale (#284) : pas d'entrée `MODAL_DEFS`, rendus par un ÉCRAN dédié
 * (`ScreenShell`/panneau de jeu) plutôt qu'une modale de combat — marché/butin/victoire/campagne/
 * ciblage carte… Chaque entrée déclare son OWNER coop, MÊME VOCABULAIRE que `ModalDef.owner`
 * ('*' = tous les sièges voient/agissent, `undefined` = hôte seul).
 */
export interface HorsModalDef<K extends string = string> {
  key: K;
  pendingKey: PendingKey;
  owner: (s: ArbiterState) => string | undefined | '*';
  /** Ce pending, posé, TIENT-IL LA MAIN (`surfaceTientLaMain`) ? REQUIS (patron `auto`) : chaque
   *  fenêtre se classe à sa déclaration. `false` = un pending SANS surface devant le joueur — un
   *  geste armé qui attend son arrivée, une file que le système draine, une commande en souffrance. */
  tientLaMain: boolean;
  /** Les flux de jet (`FLOW_VERBS`) que la fenêtre rend, comme `ModalDef.flux`. */
  flux?: readonly FlowKey[];
  /** Verbes du joueur que ni `flux` ni ses choix (`ChoixDesFenetres`) ne nomment — ce qu'un hôte nomme au joueur (`fenetreDuJeu`,
   *  #2898). Leur routage reste celui de `netOwnership`. Une fenêtre qui ne tient pas la main n'en a pas :
   *  `fenetreDuJeu` ne la rend jamais. */
  verbes?: VerbesDeFenetre;
  /** La fenêtre se ferme (`fenetreFermer`), par le siège que ce champ nomme, comme `ModalDef.sortie`. */
  sortie?: QuiFermeLaFenetre;
  /** La fenêtre se valide (`fenetreValider`), par le siège que ce champ nomme, comme `ModalDef.validation`. */
  validation?: QuiValideLaFenetre;
}

export const HORS_MODAL = [
  { key: 'marchandage', pendingKey: 'pendingBargain', tientLaMain: true, owner: (s) => s.pendingBargain?.playerId, flux: ['marchandage'] }, // Marchandage (écran Marché, billet de la carte du monde)
  { key: 'evaluation', pendingKey: 'pendingAppraise', tientLaMain: true, owner: (s) => s.pendingAppraise?.actorId, flux: ['evaluation'] }, // Évaluation/Détection (écran Marché/Compendium)
  { key: 'butin', pendingKey: 'pendingLoot', tientLaMain: true, owner: () => '*', verbes: ['evaluerLObjet'], sortie: 'hote' }, // Butin hors victoire : chacun voit qui l'emporte
  { key: 'victoire', pendingKey: 'pendingVictory', tientLaMain: true, owner: () => '*', verbes: ['evaluerLObjet'], sortie: 'quorum' }, // Écran de victoire : chaque siège se dit prêt, le quorum le ferme
  { key: 'viseeDeSiege', pendingKey: 'pendingSiegeAim', tientLaMain: true, owner: (s) => s.pendingSiegeAim?.gunnerId, verbes: ['cliquerLaCase'], sortie: 'proprietaire' }, // Placeur de case (ciblage carte, pas de modale) : le clic de case dépose l'impact
  { key: 'interaction', pendingKey: 'pendingInteract', tientLaMain: false, owner: () => undefined }, // Interaction de décor : hôte (pas de héros structuré porté par le pending)
  { key: 'debutDuRound', pendingKey: 'pendingRoundStart', tientLaMain: true, owner: () => '*', verbes: ['cliquerLaCase'], validation: 'quorum' }, // Pause de début de Round (fenêtre Chance) : chaque siège se dit prêt, le quorum lance le Round ; le clic du combattant tire la visée armée (Tir rapide)
  { key: 'activitesEnMer', pendingKey: 'pendingSeaActivities', tientLaMain: true, owner: () => '*', validation: 'hote' }, // Activités hebdomadaires en mer : chaque siège choisit pour ses héros, l'hôte valide la semaine
  { key: 'relacheATerre', pendingKey: 'pendingShoreLeave', tientLaMain: true, owner: () => '*' }, // Relâche à terre (MDG 15) : décision de groupe
  { key: 'campagne', pendingKey: 'pendingCampaign', tientLaMain: false, owner: () => undefined }, // Campagne choisie au menu : un écran de l'hôte avant tout siège, que « Lancer » charge
  { key: 'commandes', pendingKey: 'pendingOrders', tientLaMain: false, owner: () => undefined }, // Commandes d'interlude : dépense de bourse de groupe, hôte
  // Balayage / 2ᵉ frappe : ciblage carte (TargetPrompt), pas de modale — leurs gestes (enchaîner par le clic du
  // combattant, terminer, renoncer) sont ceux de l'ATTAQUANT qui les tient (#1016).
  { key: 'frappeMortelle', pendingKey: 'pendingCleave', tientLaMain: true, owner: (s) => s.pendingCleave?.attackerId, verbes: ['cliquerLaCase'], sortie: 'proprietaire' },
  { key: 'secondeFrappe', pendingKey: 'pendingDualStrike', tientLaMain: true, owner: (s) => s.pendingDualStrike?.attackerId, verbes: ['cliquerLaCase'], sortie: 'proprietaire' },
  { key: 'fileDuJournal', pendingKey: 'pendingLogQueue', tientLaMain: false, owner: () => undefined }, // File de journal DIFFÉRÉE : système, drainée automatiquement (pas d'acteur)
  // Cadre de campagne (#717) : rideau d'ouverture et récap de fin de chapitre — des ÉCRANS
  // (`ScreenShell`), pas des modales de combat, et des gestes d'HÔTE (l'ouverture est un rideau, la
  // clôture de séance vit déjà chez l'hôte) : aucun ready-check, l'hôte les valide.
  { key: 'ouverture', pendingKey: 'pendingOuverture', tientLaMain: true, owner: () => undefined, validation: 'hote' },
  { key: 'finDeChapitre', pendingKey: 'pendingChapterRecap', tientLaMain: true, owner: () => undefined, validation: 'hote', sortie: 'hote' },
  { key: 'depart', pendingKey: 'pendingDeparture', tientLaMain: true, owner: () => undefined, validation: 'hote', sortie: 'hote' }, // Porte de départ de nuit (carte du monde) : l'hôte attend l'aube, ou reste (#340)
] as const satisfies readonly HorsModalDef[];

/** Les mêmes fenêtres indexées par leur `pending*` (#1016) — `netOwnership` y prend l'owner du CLIC
 *  DE CARTE quand `targetingHolder` désigne le pending qui DÉTIENT le ciblage (balayage, 2ᵉ frappe,
 *  pilonnage indirect) : le clic appartient au porteur du geste, pas à la modale prioritaire. */
export function horsModalByPending(): Record<string, HorsModalDef> {
  const out: Record<string, HorsModalDef> = {};
  for (const d of HORS_MODAL as readonly HorsModalDef[]) out[d.pendingKey] = d;
  return out;
}

/** Surface PARTAGÉE qui NE vit PAS dans un `pending*` : un état de PARTIE que l'hôte arbitre et que
 *  tous les sièges ont sous les yeux, et qui couvre la scène. Déclarée ICI, à l'arbitre, à côté des deux
 *  registres de fenêtres. Une surface PAR SIÈGE (fiche, menu système, fenêtre Codex `codexOverlay`,
 *  inspection) n'y entre JAMAIS : elle vit dans la pile des couches de SON client (`dismissStack`), et
 *  l'écran de l'hôte ne doit pas refuser le geste d'un invité. L'ÉCRAN plein (`screen`, dont l'écran
 *  `compendium`) est, lui, PARTAGÉ : le snapshot de l'hôte écrase `screen` chez chaque invité
 *  (`coop.appliquerLInstantane`). */
export interface SurfaceHorsPendingDef<K extends string = string> {
  key: K;
  tientLaMain: (s: ArbiterState) => boolean;
  /** La surface est ouverte sans tenir la main (la conversation, que la scène porte) ; sans elle : `tientLaMain`. */
  ouverte?: (s: ArbiterState) => boolean;
  /** Qui la possède, pour un choix de son propriétaire ; sans lui : aucun siège. */
  owner?: (s: ArbiterState) => string | undefined;
  /** La surface se ferme (`fenetreFermer`), par l'hôte : aucun siège ne la possède. */
  sortie?: 'hote';
  /** Ce qui ferme sa sortie maintenant, comme `ModalDef.sortieFermee`. */
  sortieFermee?: (s: ArbiterState) => FermetureDuJet | null;
  /** La surface se valide (`fenetreValider`), par l'hôte. */
  validation?: 'hote';
}

/** La fin de séance du récap de chapitre se joue par lui (`fenetreValider('finDeChapitre')`, `fenetreFermer('finDeChapitre')`). */
export const seanceDuChapitre = (s: ArbiterState): FermetureDuJet | null => (s.pendingChapterRecap ? 'seanceDuChapitre' : null);

/** Un combat perdu tient l'écran. */
const defaiteDuCombat = (s: ArbiterState): boolean => s.mode === 'battle' && s.battle?.over === 'defaite';

export const SURFACES_HORS_PENDING = [
  // L'échoppe se valide par la répartition des achats entre les héros.
  { key: 'marchand', tientLaMain: (s) => !!s.merchant, validation: 'hote', sortie: 'hote' },
  { key: 'jeuxDeTaverne', tientLaMain: (s) => !!s.tavernGames, sortie: 'hote' },
  { key: 'document', tientLaMain: (s) => !!s.document, sortie: 'hote' },
  // Montées en EXPLORATION seulement (`ui/CampaignView`) : hors de ce mode, le slot n'a pas d'écran.
  { key: 'carteDuMonde', tientLaMain: (s) => !!s.worldMapOpen && s.mode === 'exploration', sortie: 'hote' },
  { key: 'port', tientLaMain: (s) => !!s.port && s.mode === 'exploration', sortie: 'hote' },
  { key: 'marcheDeTerre', tientLaMain: (s) => !!s.landMarket && s.mode === 'exploration', sortie: 'hote' },
  // Le récit de voyage attend la conversation et la carte (`ui/CampaignView`) ; la fin de séance, la conversation, et
  // celle du récap de chapitre se termine avec lui (`seanceDuChapitre`).
  { key: 'recitDeVoyage', tientLaMain: (s) => !!s.travelRecap && s.mode === 'exploration' && !s.dialogue && !s.worldMapOpen, sortie: 'hote' },
  { key: 'finDeSeance', tientLaMain: (s) => !!s.finDeSeance && !s.dialogue, validation: 'hote', sortie: 'hote', sortieFermee: seanceDuChapitre },
  // L'écran du lieu où se tient le groupe, sous les écrans de ses services, la carte et le récit de l'arrivée ; sa
  // sortie, « Explorer », entre dans la scène du lieu.
  { key: 'ecranDuLieu', tientLaMain: (s) => !!s.lieuOuvert && s.mode === 'exploration' && !s.travelPlan && !s.dialogue, sortie: 'hote' },
  // La conversation (#1262) : la scène la porte, elle ne tient pas la main ; sa réponse est une décision de groupe, au
  // siège du MONDE (`ownsGroupDecision`).
  { key: 'dialogue', tientLaMain: () => false, ouverte: (s) => !!s.dialogue, owner: () => WORLD_STEP_OWNER },
  // L'anéantissement du groupe hors combat (`partyWiped`) ; la défaite d'un combat, repli dans le combat d'une
  // bataille de masse (ADE II 08), sinon défaite.
  { key: 'aneantissement', tientLaMain: (s) => !!s.partyWiped, sortie: 'hote' },
  { key: 'repli', tientLaMain: (s) => defaiteDuCombat(s) && !!s.massBattle?.combatScene, sortie: 'hote' },
  { key: 'defaite', tientLaMain: (s) => defaiteDuCombat(s) && !s.massBattle?.combatScene, sortie: 'hote' },
  // La bataille de masse tient la main sur son écran ; elle est ouverte aussi pendant sa préparation, que joue l'interlude
  // (ADE II 08 l.65), et ne s'y termine pas.
  {
    key: 'batailleDeMasse', tientLaMain: (s) => !!s.massBattle && s.screen === 'massBattle',
    ouverte: (s) => !!s.massBattle && (s.screen === 'massBattle' || s.massBattle.phase === 'prep'),
    validation: 'hote', sortie: 'hote', sortieFermee: (s) => (s.screen === 'massBattle' ? null : 'preparationDeBataille'),
  },
  // L'interlude (LDB 22-23) : l'hôte le clôt.
  { key: 'interlude', tientLaMain: (s) => !!s.interlude, validation: 'hote' },
  // Un ÉCRAN plein autre que celui du jeu (groupe, interlude, `compendium`…) : la scène n'est pas à l'écran.
  { key: 'ecranPlein', tientLaMain: (s) => s.screen !== 'campaign' },
] as const satisfies readonly SurfaceHorsPendingDef[];

/** Un pending est OUVERT s'il porte quelque chose : une collection vide est un slot au repos. */
export const pendingOuvert = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : !!v);

/** La clé d'une entrée de registre qui déclare sa `sortie`. */
type CleASortie<D> = D extends { key: infer K; sortie: QuiFermeLaFenetre } ? K : never;
/** Les fenêtres qui se ferment (`fenetreFermer`) : les entrées des trois registres qui déclarent leur `sortie`. */
export type FenetreQuiSeFerme =
  | CleASortie<(typeof MODAL_DEFS)[number]>
  | CleASortie<(typeof HORS_MODAL)[number]>
  | CleASortie<(typeof SURFACES_HORS_PENDING)[number]>;

/** La clé d'une entrée de registre qui déclare sa `validation`. */
type CleAValidation<D> = D extends { key: infer K; validation: QuiValideLaFenetre } ? K : never;
/** Les fenêtres qui se valident (`fenetreValider`) : les entrées des trois registres qui déclarent leur `validation`. */
export type FenetreAValider =
  | CleAValidation<(typeof MODAL_DEFS)[number]>
  | CleAValidation<(typeof HORS_MODAL)[number]>
  | CleAValidation<(typeof SURFACES_HORS_PENDING)[number]>;

/** Les clés des trois registres de fenêtres : les modales, les situations hors modale, les surfaces partagées. */
export type CleDeRegistre = ModalKey | (typeof HORS_MODAL)[number]['key'] | (typeof SURFACES_HORS_PENDING)[number]['key'];

/** Une fenêtre lue dans son registre : si elle est ouverte, son propriétaire, et le pending dont le `readyBySeat` porte
 *  les sièges prêts (une fenêtre à quorum). */
export interface FenetreDuRegistre {
  ouverte: (s: ArbiterState) => boolean;
  proprietaire: (s: ArbiterState) => string | undefined | '*';
  marques?: PendingKey;
}

/** Un geste de fenêtre (sa validation, sa sortie ou un choix), lu dans son registre : qui le joue, et sa fenêtre. */
export interface GesteDeFenetreDeclare<Q extends QuiValideLaFenetre> extends FenetreDuRegistre {
  qui: Q;
}
/** Une sortie, et ce qui la ferme maintenant (`sortieFermee` ; `null` : ouverte). */
export interface SortieDeLaFenetre extends GesteDeFenetreDeclare<QuiFermeLaFenetre> {
  fermee: (s: ArbiterState) => FermetureDuJet | null;
}
export type ValidationDeLaFenetre = GesteDeFenetreDeclare<QuiValideLaFenetre>;

/** Chaque entrée des trois registres, et sa fenêtre. */
const ENTREES_DES_REGISTRES: readonly (readonly [{ key: string; sortie?: QuiFermeLaFenetre; validation?: QuiValideLaFenetre }, FenetreDuRegistre])[] = [
  ...(MODAL_DEFS as readonly ModalDef[]).map((d) => [d, { ouverte: d.when, proprietaire: d.owner, marques: d.covers[0] }] as const),
  ...(HORS_MODAL as readonly HorsModalDef[]).map((d) => [d, { ouverte: (s: ArbiterState) => pendingOuvert((s as Record<string, unknown>)[d.pendingKey]), proprietaire: d.owner, marques: d.pendingKey }] as const),
  ...(SURFACES_HORS_PENDING as readonly SurfaceHorsPendingDef[]).map((d) => [d, { ouverte: d.ouverte ?? d.tientLaMain, proprietaire: d.owner ?? (() => undefined) }] as const),
];
const FENETRES_DU_REGISTRE: ReadonlyMap<string, FenetreDuRegistre> = new Map(ENTREES_DES_REGISTRES.map(([d, f]) => [d.key, f]));

/** La fenêtre `cle` telle que son registre la déclare ; `undefined` : aucun registre ne la porte. */
export const fenetreDuRegistre = (cle: unknown): FenetreDuRegistre | undefined => (typeof cle === 'string' ? FENETRES_DU_REGISTRE.get(cle) : undefined);

/** Les gestes `champ` (la validation ou la sortie) que déclarent les trois registres, par clé de fenêtre. */
function gestesDeclares<Q extends QuiValideLaFenetre>(champ: (d: { sortie?: QuiFermeLaFenetre; validation?: QuiValideLaFenetre }) => Q | undefined): ReadonlyMap<string, GesteDeFenetreDeclare<Q>> {
  const out = new Map<string, GesteDeFenetreDeclare<Q>>();
  for (const [d, fenetre] of ENTREES_DES_REGISTRES) {
    const qui = champ(d);
    if (qui) out.set(d.key, { ...fenetre, qui });
  }
  return out;
}
const ouverteSansVerdict = (): null => null;
const FERMETURES_DES_SORTIES: ReadonlyMap<string, SortieDeLaFenetre['fermee']> = new Map([...(MODAL_DEFS as readonly ModalDef[]), ...(SURFACES_HORS_PENDING as readonly SurfaceHorsPendingDef[])].flatMap((d) => (d.sortieFermee ? [[d.key, d.sortieFermee] as const] : [])));
const SORTIES_DECLAREES: ReadonlyMap<string, SortieDeLaFenetre> = new Map([...gestesDeclares((d) => d.sortie)].map(([cle, g]) => [cle, { ...g, fermee: FERMETURES_DES_SORTIES.get(cle) ?? ouverteSansVerdict }]));
const VALIDATIONS_DECLAREES = gestesDeclares((d) => d.validation);

/** La sortie de la fenêtre `cle`, telle que son registre la déclare ; `undefined` : aucune fenêtre de ce nom ne se ferme. */
export const sortieDeLaFenetre = (cle: unknown): SortieDeLaFenetre | undefined => (typeof cle === 'string' ? SORTIES_DECLAREES.get(cle) : undefined);
/** La clé `cle` (une donnée de frontière) est-elle celle d'une fenêtre qui se ferme ? */
export const estFenetreQuiSeFerme = (cle: unknown): cle is FenetreQuiSeFerme => sortieDeLaFenetre(cle) !== undefined;

/** La validation de la fenêtre `cle`, telle que son registre la déclare ; `undefined` : aucune fenêtre de ce nom ne se
 *  valide. Ce qui ferme sa validation maintenant se lit à `FERMETURES_DE_LA_VALIDATION`. */
export const validationDeLaFenetre = (cle: unknown): ValidationDeLaFenetre | undefined => (typeof cle === 'string' ? VALIDATIONS_DECLAREES.get(cle) : undefined);
/** La clé `cle` (une donnée de frontière) est-elle celle d'une fenêtre qui se valide ? */
export const estFenetreAValider = (cle: unknown): cle is FenetreAValider => validationDeLaFenetre(cle) !== undefined;

/**
 * UNE SURFACE PARTAGÉE TIENT-ELLE LA MAIN ? Verdict UNIQUE de « ce que TOUS les sièges ont sous les
 * yeux n'est pas la scène » : une modale du registre (`modalHolds`), une fenêtre HORS-modale ouverte
 * qui se déclare `tientLaMain`, ou une surface partagée hors `pending*` (`SURFACES_HORS_PENDING`).
 * Il garde le VERBE, là où il s'exécute (chez l'hôte) ; les surfaces PAR SIÈGE sont la pile des
 * couches du client (`dismissStack`). Dérivé des trois registres : une fenêtre neuve se classe à sa
 * déclaration, jamais dans une liste de consommateur.
 */
export function surfaceTientLaMain(s: ArbiterState): boolean {
  if (modalHolds(s)) return true;
  const etat = s as Record<string, unknown>;
  if ((HORS_MODAL as readonly HorsModalDef[]).some((d) => d.tientLaMain && pendingOuvert(etat[d.pendingKey]))) return true;
  return (SURFACES_HORS_PENDING as readonly SurfaceHorsPendingDef[]).some((d) => d.tientLaMain(s));
}

/** Toutes les clés `pending*` couvertes par `MODAL_DEFS` (owner MODALE, direct + coexistants). */
type ModalCoveredKey = (typeof MODAL_DEFS)[number]['covers'][number];
/** Toutes les clés `pending*` couvertes par `HORS_MODAL` (owner HORS-modale). */
export type HorsModalCoveredKey = (typeof HORS_MODAL)[number]['pendingKey'];

/**
 * VERROU DE COMPILATION (#284) : tout `pending*` de `Jeu` (`PendingKey`, dérivé — cf.
 * `stateFields.ts`) doit être couvert par `MODAL_DEFS.covers` OU `HORS_MODAL` — le TIERS n'existe
 * pas. Un `pending*` ajouté sans classer son owner coop casse tsc ICI : `_pendingOwnerCoverage`
 * n'accepte que `never` en 2ᵉ position ; toute clé manquante s'y affiche en litige (patron AutoPolicy).
 */
type _MissingPendingOwner = Exclude<PendingKey, ModalCoveredKey | HorsModalCoveredKey>;
type _pendingOwnerCoverage = [manquant: _MissingPendingOwner] extends [never] ? true : ['pending* sans owner coop déclaré (MODAL_DEFS.covers ni HORS_MODAL)', _MissingPendingOwner];
const _pendingOwnerCoverageCheck: _pendingOwnerCoverage = true;
void _pendingOwnerCoverageCheck;
