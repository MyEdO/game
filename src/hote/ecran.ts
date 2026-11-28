/**
 * L'ÉCRAN D'UN HÔTE QUI DESSINE LA PARTIE (#2928, #3328), commun aux hôtes qui la montrent au joueur : chaque zone de
 * l'écran et ses éléments (`elements.ts`). La fenêtre qui tient la main (son titre, son étape, son corps : qui agit
 * contre qui, ses jets, le DR net, l'issue ; ses réglages, les options du coup, puis ses gestes), le panneau du
 * combat (le round et le tour, l'ordre du tour, l'actif, ce que la barre et l'aperçu disent, la fin du combat, la barre des offres) et
 * le journal ; en exploration, les gestes du groupe ; chaque héros du groupe en carte, qui ouvre sa fiche ; le panneau que
 * l'hôte tient ouvert : la fiche d'un combattant, en statbloc, ou la création d'un héros (`creation.ts`).
 * À l'écran, ce qui se lit d'un coup d'œil ; le reste au détail d'un élément, montré à la demande.
 * Chaque texte vient du catalogue (`t()`) et des lecteurs du noyau ; l'hôte n'écrit aucun libellé, et le joueur ne lit
 * aucun id.
 */
import {
  ACTIONS,
  DESSINS_DES_PARTS,
  findSpellById,
  formatSpellDuration,
  formatSpellRange,
  formatSpellTarget,
  avecSigne,
  emplacementsRapides,
  etatDeLaBarre,
  batailleEnVue,
  intentionDeRenvoi,
  partieEnCours,
  refusDeRenvoyer,
  fenetreDuJeu,
  cleDuGeste,
  dayIndex,
  formatJourImperial,
  jourImperial,
  libelleDeDistance,
  clockLabel,
  VERBE_DE_CHOIX,
  type AxeDuChoix,
  type FenetreAChoix,
  conditionLabel,
  libelleDuTestAnnonce,
  difficultyText,
  documentEnVue,
  lieuEnVue,
  formatMoney,
  fromBrass,
  faitsDeLEtape,
  tonDuFait,
  fenetreDAttaque,
  fenetreDIncantation,
  fenetreDeDefense,
  fenetreDuSoin,
  enTeteDuPorteur,
  ficheDuPorteur,
  weaponStatParts,
  gestesDeLObjet,
  libelleDuDepot,
  porteurParId,
  locationLabel,
  refLabel,
  TITRE_DE_LA_NUIT,
  toneOf,
  nomEnVue,
  porteurEnVue,
  type CombatEvent,
  type FaitApplique,
  type Equipe,
  type Money,
  type CoutDeLaValeur,
  type EntreeDeLaFiche,
  type IconId,
  type IdDeCouche,
  type LieuDuPlan,
  type PlanDeLaCarte,
  type FicheDuPorteur,
  type GesteAChoix,
  type GesteDuNoyau,
  type GesteFermable,
  type FenetreDAttaque,
  type FenetreDIncantation,
  type Jeu,
  type JetEnVue,
  type LigneDeJet,
  type LigneDuJournal,
  type ModLine,
  type TrajetEnVue,
  type DayPhaseId,
  cibleDuCodex,
  ordreDuRoundSuivant,
  type Renvoyable,
} from '../noyau/index';
import { elision, estUneCle, pluriel, t } from '../i18n';
import { garanti } from '../lib/garanti';
import { ordreEnVue, type Projection } from './projection';
import { CHOIX_EN_BOUTONS, type FenetreADessiner } from './gestes';
import { redigerLEntree } from './journal';
import { redigerLeDocument } from './document';
import { zonesDeLaCreation, type ZonesDeLaCreation } from './creation';
import type { ContenuDUnJeu } from './contenu';
import { zonesDeLaPartie, type ZonesDeLaPartie } from './groupe';
import type { RosterMontre } from './roster';
import {
  elementsDesGestes,
  ligne,
  resume,
  type Bouton,
  type Choix,
  type Element,
  type Entite,
  type FicheOuverte,
  type Formulaire,
  type Icone,
  type Jet,
  type Jeu as JeuDeLHote,
  type Ligne,
  type PanneauDeLHote,
  type Paysage,
  type Plan,
  type Puce,
  type Saisie,
  type Ton,
  type Touche,
  TOUCHES_RAPIDES,
} from './elements';

/**
 * @contrat Vue
 * Chaque zone de l'écran et ses éléments, dans l'ordre où elle les montre, la création comprise (`ZonesDeLaCreation`).
 *
 * Une zone vide n'a rien à montrer : hors combat, les zones `combat.*` ; en combat, `exploration.gestes` ; sans
 * fenêtre, les zones `fenetre.*` ; sans conversation, ou sous une fenêtre, les zones `dialogue.*` ; sans fiche, les
 * zones `fiche.*` ; sans création, les zones `creation.*` ; sans possession choisie, `fiche.objet`.
 *
 * Chaque élément porte son `type` (sa forme de donnée, jamais une fenêtre), son `id`, stable dans sa zone, son `ton`
 * quand il dit un texte (`neutre`, `reussite`, `echec`, `alerte` : une variation du thème de l'hôte) et ses textes,
 * déjà dits en mots du joueur : Godot n'écrit aucun libellé. À l'écran, ce qui se lit d'un coup d'œil ; le `detail`
 * d'un jet ou d'une puce (la composition d'une cible, ce qu'une posture change) et le `refus` d'un geste se disent au
 * survol, dans la bulle du thème.
 *
 * Les gestes sont des éléments : un `bouton` porte l'intention qu'il joue (`jeu` : `{ type, args }`, le verbe et ses
 * arguments, le flux et l'id désigné posés, celui qu'une offre déclare compris, `{ suite }`, les verbes d'un geste
 * d'exploration, `{ fiche }` ou `{ creation }`, l'entrée de la méthode du même nom), `presse`, `focus` (le geste que la
 * fenêtre joue à l'Entrée : le geste `attendu` de son drive s'il prend le focus, une rangée de choix n'en prenant
 * pas, à défaut le premier bouton) et `refus` (pourquoi il ne se joue pas, dit sous lui ; le geste désactivé) ; un
 * `choix` ou une `liste` porte son `refus` et chacune de ses valeurs en bouton, refusée avec lui ; un `formulaire`
 * porte son verbe, son `refus` et ses saisies dans l'ordre de ses paramètres (`fixe`, posée par la fenêtre,
 * `saisieChoix`, `saisieNombre` et ses bornes, `saisieTexte`,
 * `saisieMultiligne` (un texte sur plusieurs lignes), `saisieJson`, `saisieObjet` et ses champs), dont Godot lit les
 * valeurs à l'instant où il se joue ; une saisie optionnelle laissée vide clôt les arguments, une saisie requise
 * laissée vide part `null`. Seuls les gestes `ouvert` de la fenêtre (`fenetreADessiner`, `src/hote/gestes.ts`) se
 * dessinent.
 */
export interface ZonesDeLEcran extends ZonesDeLaCreation, ZonesDeLaPartie {
  /** le titre de la fenêtre qui tient la main. */
  'fenetre.titre': Ligne[];
  /** l'étape de séquence quand elle n'est pas le titre, et le nom de qui tient la main quand aucun jet du corps ne
   *  porte son combattant (`Jet.combattant`). */
  'fenetre.etape': Ligne[];
  /**
   * qui agit contre qui, les jets à lancer ou tombés, le DR net, l'issue ou l'attente ; le texte du document remis
   * (`documentEnVue`, surface du noyau), dont `fenetre.titre` porte le titre ; le Coup Critique qu'une étape révèle :
   * sa localisation, les Blessures perdues et chaque État infligé en puces, au ton du camp de la victime, puis chacun
   * de ses effets, son explication au détail.
   */
  'fenetre.corps': Element[];
  /**
   * les réglages du jet et les gestes qu'une fenêtre lue règle : les options du coup ; un axe de choix dont le corps
   * porte déjà les boutons ne s'y redit pas, `choixPortes`, `src/hote/ecran.ts`.
   */
  'fenetre.reglages': (Bouton | Choix | Formulaire)[];
  /** les pas de sa séquence. */
  'fenetre.gestes': (Bouton | Choix | Formulaire)[];
  /** le round et le tour. */
  'combat.tour': Ligne[];
  /**
   * l'ordre du tour en vue, de haut en bas : la tête de l'ordre du round suivant (`ordreDuRoundSuivant`), un rang
   * `suite/<id>` pour chacun de ses `TETE_DU_ROUND_SUIVANT` premiers à jouer en vue, le premier au plus bas ; la ligne
   * `round`, le round qui commence ; puis l'actif et ceux qui restent à jouer ce round, un rang `ordre/<id>` chacun,
   * l'actif en bas.
   * sous la relance d'Initiative à chaque round, ni rang `suite/<id>` ni ligne `round` : l'ordre n'est pas tiré.
   * chaque rang : le portrait, les Blessures en jauge, un ennemi en `echec` ; l'actif, en rang `ordre/`, en `alerte`.
   * chaque rang porte le bouton qui ouvre la fiche du combattant : `fiche/<id>` en rang `ordre/` (celui de la carte d'un
   * héros hors combat), `fiche/suite/<id>` en rang `suite/`.
   */
  'combat.ordre': (Entite | Ligne)[];
  /**
   * l'actif en entité : son portrait, ses Blessures en jauge, son Avantage en puce, son Action en puce, en `reussite`
   * tant qu'elle reste à jouer, chacun de ses États en puce.
   * son Mouvement en entité `mouvement` : un jeton par case (`jeton/<n>`), en `reussite` tant qu'il reste, puis ce qui
   * reste sur le total en ligne `reste`.
   * aucune quand une fenêtre de jet tient la main : la fenêtre prend sa place.
   * aucune quand le combat est fini : la victoire ou la défaite se pose seule sur son voile.
   */
  'combat.actif': Entite[];
  /**
   * quand aucune fenêtre ne tient la main, la raison d'une barre fermée et la fin du tour qu'un premier geste a armée
   * en laissant l'Action intacte ; la fin du combat.
   */
  'combat.avis': Ligne[];
  /** ce que l'aperçu du premier clic coûte ou vise, que Godot montre au-dessus de sa case. */
  'combat.apercu': Ligne[];
  /**
   * chaque offre de l'actif qui déclare son geste (`gesteDeLOffre`) en bouton, l'armée pressée (`offreArmee`) et
   * désarmée par son bouton, rangée sous la part de l'économie du tour qu'elle prend, un choix qui la nomme une fois,
   * celles qui n'en prennent aucune sous le tour. Seuls l'Action (`economie/action`) et le tour (`economie/aucun`),
   * emplacements fixes, gardent leurs offres fermées, refusées avec leur raison ; toute autre part ne montre que ses
   * offres ouvertes, absente sans elles. Une offre par candidat, le sort, l'arme ou l'attaque de trait, est un choix à
   * elle sous sa part, de son nom court, en liste au-delà de sept candidats ouverts, chaque candidat ouvert un bouton qui le nomme et joue
   * le verbe de son offre, l'armé pressé ; absente sans candidat ouvert.
   * hors de la barre ouverte (un jet, le tour d'un adversaire), un combat en cours ne sert que la fin du tour sous le tour,
   * refusée de la raison de la barre (`combat.barre.raison`), son `jeu` une suite vide.
   */
  'combat.offres': Choix[];
  /**
   * les six emplacements rapides de l'actif d'un siège (`emplacementsRapides`), rang par rang en `rapide/<rang>`,
   * aucun hors de la barre ouverte : hors de son tour, sous une fenêtre qui tient la main.
   * une case pleine en bouton : le nom du sort ou de l'objet, le dessin de son action, le geste de son offre, pressé
   * quand elle est armée, refusé avec sa raison.
   * une case dont rien ne s'offre plus reste à son rang, refusée, son `jeu` une suite vide.
   * une case libre en ligne « Libre ».
   */
  'combat.rapides': (Bouton | Ligne)[];
  /**
   * chaque geste d'exploration de la scène en bouton qui le nomme, sa suite de verbes en `jeu`, refusé avec sa raison,
   * dont l'offre de chaque entité à portée du groupe, « Gustav : Parler », dont celle du décor d'un objet posé au sol,
   * « Dague : Ramasser » (le meneur le reçoit), que le clic sur ce décor joue aussi ; aucun quand une fenêtre tient la
   * main ou pendant une conversation.
   */
  'exploration.gestes': Bouton[];
  /**
   * la conversation en cours, `Projection.conversation`, quand aucune fenêtre ne la suspend : le nom de son
   * interlocuteur.
   */
  'dialogue.orateur': Ligne[];
  /** la réplique du nœud. */
  'dialogue.replique': Ligne[];
  /**
   * chaque réponse visible en bouton qui la choisit : son Test annoncé, son libellé puis son coût, refusée avec sa
   * raison.
   */
  'dialogue.reponses': Bouton[];
  /**
   * en combat, le journal en pastille, son nom et son dessin :
   * elle ouvre la chronique entière ; hors combat, aucune.
   */
  'journal.titre': Entite[];
  /** hors combat, chaque héros du groupe en carte (`herosDuGroupe`) ; en combat, aucune : l'ordre du tour les porte.
   *  Chaque carte : sa carrière, ses Blessures, le bouton qui ouvre sa fiche,
   *  pressé quand elle est ouverte, qui la ferme alors, ses États, chacun pressé qui ouvre le Compendium sur lui (la
   *  puce d'un terme de la fiche, `fiche.porteur`), puis ce que la fenêtre dit de lui : le jet qu'il jette
   *  en route et les gestes qui le désignent, sa nuit à la halte ; avant le lancement, « Renvoyer », dont le `jeu` est
   *  l'intention du noyau qui le renvoie (`intentionDeRenvoi`), refusé avec sa raison (`refusDeRenvoyer`). */
  'groupe.heros': Entite[];
  /**
   * la fiche ouverte (`ficheDuPorteur`, surface du noyau), en statbloc : le combattant en entité : son espèce et sa
   * carrière, chacune en puce, ses Blessures en jauge, ses Points de Destin, de Chance, de Résilience et de
   * Détermination quand il en a, sa bourse s'il est un héros du groupe, chacun de ses États en puces, puis le bouton
   * « Compendium » (`renvoi`) de la créature du bestiaire qu'il désigne. Chaque terme de la fiche qui désigne une entrée
   * du Codex (une puce, ou le bouton « Compendium » d'une entité qui la nomme) a pour `jeu` `{ compendium: { geste:
   * 'suivre', categorie, id, instance? } }`, son nom montré en instance quand il diffère de celui de l'entrée, que
   * l'hôte ouvre au Compendium (`compendium { ouvrir, categorie, id, instance? }`) ; une puce sans entrée, `null`.
   */
  'fiche.porteur': Entite[];
  /** « Fermer ». */
  'fiche.gestes': Bouton[];
  /**
   * une puce par colonne du profil : le Mouvement, chaque Caractéristique par son abréviation, les Blessures
   * maximales ; son nom au détail ; chacune qui ouvre le Compendium sur sa règle.
   */
  'fiche.profil': Puce[];
  /**
   * chaque section non vide en entité, dans l'ordre du statbloc, son nom au bandeau ; chaque terme qui désigne une
   * entrée du Codex l'ouvre au Compendium (`fiche.porteur`) : Attaques, chaque arme en entité,
   * la valeur de son Test, ses Dégâts, son Allonge ou sa Portée, ses Atouts et Défauts, chacun en puce, et le bouton
   * « Compendium » (`renvoi`) de l'arme du catalogue ; Armure, les PA
   * de chaque localisation couverte ; Traits et Mutations, chacun sa description au détail ; Compétences, la valeur de
   * chaque Test, sa Caractéristique et ses Augmentations au détail ; Talents et son niveau, Sorts, Prières, chacun sa
   * description au détail ; Possessions, chaque possession en bouton qui la nomme, son nombre quand il y en a
   * plusieurs, les équipées d'abord (une arme : tenue dans le set actif) ; il la choisit, `{ fiche }` portant son
   * `objet`, la choisie pressée la laisse ; puis une puce par nature de ses mentions (`mention/<nature>`), la nature
   * au libellé, ses mentions et leur nombre en valeur.
   */
  'fiche.sections': Entite[];
  /** le livre et la page du profil dont le combattant est l'instance, en puce qui ouvre le Compendium sur ce livre
   *  (`terme`). */
  'fiche.source': Puce[];
  /**
   * la possession choisie en entité, au ton `reussite` quand elle est équipée : son nombre, son argent et son
   * contenant en puces, le bouton « Compendium » (`renvoi`) de l'objet du catalogue qu'elle instancie, puis chacun de
   * ses gestes, lus du noyau (`gestesDeLObjet`), en bouton ou en liste qui joue son verbe par `jouer`, refusé avec la
   * raison que le verbe applique, en combat celle de l'inventaire : la porter, pressé quand elle l'est ; la tenir en
   * main principale ou secondaire, pressé pour la main qui la tient, qu'il vide ; l'utiliser ; la ranger dans chaque
   * contenant où elle tient, ou l'en sortir ; la donner à chaque porteur à ses côtés ; la poser au sol, à la case du
   * groupe, avec le contenu de son contenant (`poserLObjet`) ; l'évaluer, la détecter.
   */
  'fiche.objet': Entite[];
}

type Combat = NonNullable<Projection['combat']>;

const puce = (id: string, libelle: string, valeur: string | null, detail: string | null = null, ton: Ton = 'neutre'): Puce => ({ type: 'puce', id, ton, libelle, valeur, detail, jeu: null });

/** Les modificateurs de la cible et de DR, chacun une puce. */
const puces = (id: string, mods: readonly ModLine[] | undefined, modsDR?: readonly ModLine[]): Puce[] => [
  ...(mods ?? []).map((m, i) => puce(`${id}/m${i}`, m.label, avecSigne(m.value))),
  ...(modsDR ?? []).map((m, i) => puce(`${id}/mDR${i}`, m.label, `${avecSigne(m.value)} DR`)),
];

type LigneDeTest = Extract<LigneDeJet, { genre: 'test' }>;

const difficulteDuJet = (c: LigneDeTest['composition']): string | null =>
  c?.difficulty ? difficultyText(c.difficulty, c.difficultyCombined) : null;

/** Le détail d'un jet : la composition de sa cible, puis `enPlus` ; `null` sans rien à dire. */
function detailDuJet(l: LigneDeTest, enPlus: readonly string[]): string | null {
  const { composition: c, cible } = l;
  if (cible === null || !c) return null;
  const difficulte = difficulteDuJet(c);
  const lignes = [
    ...(c.base === null ? [] : [t('ecran.jet.base', { base: c.base })]),
    ...(difficulte === null ? [] : [difficulte]),
    ...(c.difficultyParts ?? []).map((m) => t('ecran.jet.part', { libelle: m.label, valeur: avecSigne(m.value) })),
    ...(c.clamped ? [t(c.clamped < 0 ? 'ecran.jet.plafond' : 'ecran.jet.plancher', { cible, ecart: avecSigne(c.clamped) })] : []),
    ...enPlus,
  ];
  return lignes.length ? lignes.join('\n') : null;
}

/** Un jet dont seules les parties de `parties` sont dites. */
const jet = (id: string, parties: Partial<Omit<Jet, 'type' | 'id'>> & { libelle: string }): Jet => ({
  type: 'jet', id, ton: 'neutre', qui: null, combattant: null, cible: null, resultat: null, dr: null, verdict: null, modificateurs: [], detail: null, ...parties,
});

/** Qui jette (`id`, `null` : nul ne jette) : son nom en vue (`nomEnVue`) et son id, `null` hors de vue (`porteurEnVue`). */
const jeteur = (etat: Jeu, id: string | null): Pick<Jet, 'qui' | 'combattant'> =>
  id === null ? { qui: null, combattant: null } : { qui: nomEnVue(etat, id), combattant: porteurEnVue(etat, id) ? id : null };

const verdictDuTest = (reussi: boolean) => ({ verdict: t(reussi ? 'ecran.jet.reussite' : 'ecran.jet.echec'), ton: reussi ? 'reussite' as const : 'echec' as const });

/** Une rangée du duel, avec le détail de la cible quand elle est publiée. */
function jetDuDuel(etat: Jeu, id: string, l: LigneDeTest, enPlus: readonly string[] = []): Jet {
  const element = jetDeLaLigne(etat, id, l);
  if (l.etat === 'masque') return element;
  return {
    ...element,
    modificateurs: puces(id, l.mods, l.modsDR),
    detail: detailDuJet(l, enPlus),
  };
}

/** Le DR net d'un Test opposé tranché. */
const drNet = (id: string, dr: number): Ligne => ligne(id, t('ecran.drNet', { dr: avecSigne(dr) }));

/** Une posture de tir, en lecture seule (son contrôle vit à la console) : son état, ce qu'elle change à la demande. */
const posture = (id: string, p: FenetreDAttaque['tirDansLeTas']): Puce | null =>
  p && puce(id, p.etat, null, p.note, p.sansObjet ? 'alerte' : 'neutre');

/** Le corps de la fenêtre d'attaque : l'arme, la cible, les Dégâts, les postures de tir, la ligne de l'attaquant et
 *  celle de la défense (à jeter ou tombées ; l'issue que l'inversion du dé donnerait au détail de l'attaquant), le DR
 *  net, l'issue ou l'attente d'une Défense. */
function corpsDeLAttaque(etat: Jeu, a: FenetreDAttaque, lecture: JetEnVue | undefined): Element[] {
  const cible = jeteur(etat, a.cibleId);
  const inversion = a.influences.inversion?.apercu ?? null;
  const jetDAttaque = lecture?.lignes.find((l) => l.id === 'attaquant');
  const jetDeDefense = lecture?.lignes.find((l) => l.id === 'defenseur');
  const defense = jetDeDefense?.genre === 'test' ? jetDuDuel(etat, 'defense', jetDeDefense) : null;
  const defenseAnnoncee = defense && jetDeDefense?.genre === 'test' && jetDeDefense.etat === 'aJouer'
    ? { ...defense, detail: difficulteDuJet(jetDeDefense.composition) } : defense;
  const detailDInversion = inversion ? [t('ecran.attaque.inversion', { d100: inversion.roll, dr: avecSigne(inversion.sl), verdict: verdictDuTest(inversion.success).verdict })] : [];
  const issueVisible = lecture?.lignes.every((l) => l.etat === 'revele');
  const elements: (Element | null)[] = [
    ligne('arme', a.arme),
    ligne('cible', t('ecran.attaque.cible', { cible: cible.qui ?? '' })),
    a.sansEquipe === null ? null : ligne('sansEquipe', a.sansEquipe, 'alerte'),
    a.degats === null ? null : puce('degats', t('ecran.degats'), avecSigne(a.degats)),
    posture('tirDansLeTas', a.tirDansLeTas),
    posture('tirImmobile', a.tirImmobile),
    a.bloque === null ? null : ligne('bloque', a.bloque, 'alerte'),
    jetDAttaque?.genre === 'test' ? jetDuDuel(etat, 'jet', jetDAttaque, detailDInversion) : null,
    defenseAnnoncee,
    lecture?.oppose ? drNet('drNet', lecture.oppose.drNet) : null,
    issueVisible && a.issue ? ligne('issue', a.issue.ligne) : null,
    a.attente === null ? null : ligne('attente', a.attente),
  ];
  return elements.filter((e): e is Element => e !== null);
}

/** Le corps de la fenêtre d'incantation (`fenetreDIncantation`) : le NI effectif au-dessus du Sort et de sa cible, la
 *  Zone d'Effet, la ligne du lanceur (à jeter ou tombée), les pas de Surincantation qui restent, les cibles
 *  supplémentaires à désigner sur la carte, l'issue. */
function corpsDeLIncantation(etat: Jeu, f: FenetreDIncantation, l: LigneDeTest | undefined): Element[] {
  const cible = f.surSoi ? t('ecran.incantation.surSoi') : garanti(nomEnVue(etat, f.cibleId), f.cibleId, 'cible de l’incantation');
  const avantLeJet = l?.etat === 'aJouer';
  const revele = l?.etat === 'revele';
  const s = revele ? f.surincantation : null;
  const elements: (Element | null)[] = [
    f.ni === null ? null : ligne('ni', t('ecran.incantation.ni', { ni: f.ni })),
    ligne('sort', t('ecran.incantation.sort', { sort: f.sort, cible })),
    f.zone && (avantLeJet || revele) ? puce('zone', t('ecran.incantation.zone'), t('ecran.incantation.cote', { cote: f.zone.cote }), null, f.zone.aPoser ? 'alerte' : 'neutre') : null,
    l ? {
      ...jetDeLaLigne(etat, 'jet', l),
      libelle: f.priere ? l.test : refLabel('skills', { id: 'langue', spec: 'magick' }),
      modificateurs: puces('jet', l.mods, l.modsDR),
    } : null,
    s ? puce('surincantation', t('ecran.incantation.surincantation'), t('ecran.incantation.pas', { restant: s.restant, budget: s.budget })) : null,
    s?.cibles?.surLaCarte ? ligne('cibles', t('ecran.incantation.cibles', { designees: s.cibles.designees, capacite: s.cibles.capacite })) : null,
    revele && f.issue ? ligne('issue', f.issue) : null,
  ];
  return elements.filter((e): e is Element => e !== null);
}

/** Une ligne de jet d'une fenêtre (`jetsEnVue`) : qui jette, le Test, la table ou le dé, et ce qui est tombé : le dé
 *  et son verdict, ou ce que la table ou le dé lit. */
function jetDeLaLigne(etat: Jeu, id: string, l: LigneDeJet): Jet {
  const qui = l.porteurHorsDeVue ? { qui: t('vision.horsDeVue'), combattant: null } : jeteur(etat, l.qui);
  switch (l.genre) {
    case 'test':
      if (l.etat === 'masque') return jet(id, { ...qui, libelle: l.test, resultat: t('ecran.jet.cache') });
      return jet(id, {
        ...qui, libelle: l.test, cible: l.cible === null ? null : t('ecran.jet.cible', { cible: l.cible }), modificateurs: puces(id, undefined, l.modsDR),
        ...(l.jet ? {
          resultat: String(l.jet.d100),
          dr: l.jet.dr === null || l.seuil ? null : t('ecran.jet.dr', { dr: avecSigne(l.jet.dr) }),
          ...verdictDuTest(l.jet.verdict === 'reussite'),
          ...(l.seuil ? { verdict: l.jet.verdict === 'reussite' ? l.seuil.reussite : l.seuil.echec } : {}),
        } : {}),
      });
    case 'table': return jet(id, { ...qui, libelle: l.table, ...(l.jet ? { resultat: String(l.jet.effectif), verdict: l.jet.ligne } : {}) });
    case 'de': return jet(id, { ...qui, libelle: l.de, ...(l.jet ? { resultat: String(l.jet.total), verdict: l.jet.lecture } : {}) });
  }
}

const elementsDuJet = (etat: Jeu, j: JetEnVue, i: number): Element[] => [
  ...puces(`jets/${i}`, undefined, j.modsDR),
  ...j.lignes.map((l, k) => j.flux === 'defense' && l.genre === 'test' && l.id === 'defenseur' && l.etat === 'aJouer'
    ? jetDuDuel(etat, 'defense/jet', l) : jetDeLaLigne(etat, `jets/${i}/${k}`, l)),
  ...(j.oppose ? [drNet(`jets/${i}/drNet`, j.oppose.drNet)] : []),
];

/** Ce que la fenêtre dit d'un héros du groupe, porté par sa carte (`herosDuGroupe`) plutôt que par son corps : en
 *  route (`Projection.voyage`), chaque jet qu'il jette, sans redire son nom ; à la halte (`Projection.repos`), son couchage et sa
 *  pitance, en listes comme tout choix d'une carte, et ce qui l'attend cette nuit en puces d'alerte. `restants` : les
 *  jets de la fenêtre (`jetsEnVue`) qu'aucune carte ne porte. */
function surLesCartes(etat: Jeu, p: Projection): { restants: Element[]; parHeros: Map<string, Element[]> } {
  const vues = p.jets;
  const jets = vues.flatMap((j, i) => elementsDuJet(etat, j, i));
  const parHeros = new Map<string, Element[]>();
  const poser = (h: string, e: Element) => parHeros.set(h, [...(parHeros.get(h) ?? []), e]);
  for (const d of p.repos?.dormeurs ?? []) {
    [choixDuDormeur('couchage', d.couchage), choixDuDormeur('pitance', d.pitance)].forEach((c) => poser(d.id, { ...c, type: 'liste' }));
    d.alertes.forEach((a, i) => poser(d.id, puce(`alerte/${i}`, texteDeLAlerte(a), null, null, 'alerte')));
  }
  if (!p.voyage) return { restants: jets, parHeros };
  const qui = new Map<string, string | null>(vues.flatMap((j, i) => j.lignes.map((l, k) => [`jets/${i}/${k}`, l.qui] as const)));
  const groupe = new Set(etat.party.map((h) => h.id));
  const restants: Element[] = [];
  for (const e of jets) {
    const h = qui.get(e.id);
    if (h && groupe.has(h)) poser(h, { ...(e as Jet), qui: null });
    else restants.push(e);
  }
  return { restants, parHeros };
}

/** Le corps de la fenêtre qui tient la main : sur l'étape d'attaque de la cascade, la fenêtre d'attaque
 *  (`fenetreDAttaque`) ; sur son étape de Défense, qui attaque qui (`fenetreDeDefense`) et le jet de sa réaction avant
 *  le dé ; puis les jets de la fenêtre (`jetsEnVue`), l'issue de la Défense, ce que l'étape de la cascade révèle ou
 *  annonce, le Sauvetage par le Destin et la victoire en attente ; les éléments propres à la fenêtre ont pour id la clé
 *  qu'en donne le noyau (`fenetreDuJeu`). */
function corpsDeLaFenetre(etat: Jeu, p: Projection, jetsRestants: Element[]): Element[] {
  const { cle } = garanti(fenetreDuJeu(etat), 'fenetre', 'fenêtre qui tient la main');
  const { jets } = p;
  const pc = etat.pendingCascade;
  const jetDeLEtape = pc?.participants[pc.cursor]?.jet;
  const attaque = jetDeLEtape === 'attaque' ? fenetreDAttaque(etat) : null;
  if (attaque) return corpsDeLAttaque(etat, attaque, jets.find((j) => j.flux === 'attaque'));
  const incantation = jetDeLEtape === 'incantation' ? fenetreDIncantation(etat) : null;
  if (incantation) return corpsDeLIncantation(etat, incantation, jets.find((j) => j.flux === 'incantation')?.lignes.find((l) => l.genre === 'test'));
  const defense = jetDeLEtape === 'defense' ? fenetreDeDefense(etat) : null;
  const defenseVisible = jets.find((j) => j.flux === 'defense')?.lignes.every((l) => l.etat === 'revele');
  const nom = (id: string) => garanti(nomEnVue(etat, id), id, 'combattant de la Défense');
  return [
    ...(defense ? [ligne('defense/qui', t('ecran.defense.qui', { attaquant: nom(defense.attaquantId), defenseur: nom(defense.defenseurId), arme: defense.arme }))] : []),
    ...patientDuSoin(etat),
    ...trajetsDeLaCarte(p),
    ...ecranDuLieu(etat, p),
    ...echoppe(p),
    ...marche(p),
    ...voyage(p),
    ...recitDuVoyage(p),
    ...herosDeLInterlude(p),
    ...champDeBataille(etat),
    ...nuitDuRepos(p, cle),
    ...jetsRestants,
    ...(defenseVisible && defense?.issue ? [ligne('defense/issue', defense.issue.ligne)] : []),
    ...revelationDeLEtape(etat),
    ...issueDeLEtape(etat),
    ...destinEnJeu(etat, cle),
    ...victoire(etat, cle),
    ...texteDuDocument(etat),
  ];
}

/** Le départ d'un trajet, un choix (`id` : la route) titré de sa longueur : chacun de ses modes avec ses jours de
 *  route, fermé avec sa raison. Le même élément part du lieu (`ecranDuLieu`) et de la carte (`trajetsDeLaCarte`). */
const departDuTrajet = (tr: TrajetEnVue): Choix => ({
  type: 'choix', id: tr.route, ton: 'neutre', focus: false, refus: null, libelle: libelleDeDistance(tr.distance),
  valeurs: tr.modes.map((m) => boutonDeGeste(m.mode.id, m.jours === null ? m.mode.nom : t('ecran.carte.mode', { mode: m.mode.nom, jours: m.jours }), m.geste, m.refus)),
});

/** Le plan de la carte en élément : chaque lieu à sa place, celui du groupe en `alerte`, chaque route qui part d'ici
 *  en `reussite` ; sous chaque lieu, `sous`. */
export const planDeLaCarte = (id: string, plan: PlanDeLaCarte, sous: (l: LieuDuPlan) => Element[]): Plan => ({
  type: 'plan', id,
  points: plan.lieux.map((l) => ({ type: 'point', id: l.id, nom: l.nom, x: l.x, y: l.y, ton: l.ici ? 'alerte' : 'neutre', elements: sous(l) })),
  traits: plan.routes.map((r) => ({ id: r.route, de: r.de, vers: r.vers, ton: r.depuisIci ? 'reussite' : 'neutre' })),
});

/** La carte du monde ouverte (`Projection.carte`) : son plan (`planDeLaCarte`), sous chaque lieu le départ de chaque trajet
 *  qui y mène (`departDuTrajet`) ; puis la reprise d'un voyage interrompu. */
function trajetsDeLaCarte(p: Projection): Element[] {
  const c = p.carte;
  if (!c) return [];
  return [
    planDeLaCarte('carte/plan', c.plan, (l) => l.trajets.map(departDuTrajet)),
    ...(c.reprendre ? [boutonDeGeste('carte/reprendre', t('ecran.carte.reprendre'), c.reprendre, null)] : []),
  ];
}

/** L'écran du lieu (`lieuEnVue`), dont le nom est le titre de la fenêtre : la date impériale (`lieu/date`), puis sa
 *  description (`lieu/description`), quand il en a une ; le plan de la carte vu d'ici (`lieu/plan`, `planDeLaCarte`, rien sous ses lieux) et le bouton
 *  qui ouvre la carte (`lieu/carte`) ; sous leur titre (`lieu/services`), chacun de ses services en entité, son fond
 *  (`fond`), son icône (`icone`), le boniment de son hôte (`accueil`) et ce qu'on y fait en boutons fermés avec leur raison, chacun des points d'intérêt de son plan et son
 *  entrée ; puis, sous leur titre (`lieu/trajets`), chaque trajet qui en part, sa destination et son départ
 *  (`departDuTrajet`). */
function ecranDuLieu(etat: Jeu, p: Projection): Element[] {
  const l = lieuEnVue(etat);
  if (!l) return [];
  return [
    ligne('lieu/date', jourImperial(p.temps.date)),
    ...(l.prose ? [ligne('lieu/description', l.prose)] : []),
    planDeLaCarte('lieu/plan', l.plan, () => []),
    boutonDeGeste('lieu/carte', l.carte.libelle, l.carte.geste, l.carte.refus),
    ...(l.services.length || l.pointsDInteret.length ? [ligne('lieu/services', t('ecran.lieu.services'))] : []),
    ...l.services.map((svc): Entite => ({
      type: 'entite', id: `service/${svc.id}`, ton: 'neutre', nom: svc.nom,
      elements: [
        ...(svc.fond ? [{ type: 'fond', id: 'fond', fond: svc.fond } as const] : []),
        { type: 'icone', id: 'icone', icone: svc.icone },
        ...(svc.accueil ? [ligne('accueil', svc.accueil)] : []),
        ...svc.gestes.map((g) => boutonDeGeste(g.id, g.libelle, g.geste, g.refus)),
      ],
    })),
    ...l.pointsDInteret.map(({ id, nom, geste: g }): Entite => ({
      type: 'entite', id: `poi/${id}`, ton: 'neutre', nom, elements: [boutonDeGeste(g.id, g.libelle, g.geste, g.refus)],
    })),
    ...(l.trajets.length ? [ligne('lieu/trajets', t('ecran.lieu.trajets'))] : []),
    ...l.trajets.map((tr): Entite => ({ type: 'entite', id: `trajet/${tr.route}`, ton: 'neutre', nom: tr.vers, elements: [departDuTrajet(tr)] })),
  ];
}

/** Un formulaire d'un geste du noyau : chaque argument que le geste pose en saisie fixe, puis `saisies`. */
function formulaireDuNoyau(id: string, libelle: string, f: { geste: { verbe: string; args: unknown[] }; refus: string | null }, saisies: Saisie[]): Formulaire {
  const fixes = f.geste.args.map((valeur, i): Saisie => ({ type: 'fixe', id: `${id}/${i}`, nom: String(i), optionnel: false, valeur }));
  return { type: 'formulaire', id, libelle, verbe: f.geste.verbe, focus: false, refus: f.refus, champs: [...fixes, ...saisies.map((x) => ({ ...x, id: `${id}/${x.id}` }))] };
}

/** Une saisie d'une valeur à choisir parmi des valeurs nommées, chacune fermée par sa raison et pressée si elle est
 *  saisie d'avance. */
const saisieDeValeurs = (nom: string, libelle: string, valeurs: readonly { libelle: string; valeur: string; refus: string | null; presse?: boolean }[]): Saisie =>
  ({ type: 'saisieChoix', id: nom, ton: 'neutre', nom, optionnel: false, libelle, valeurs: valeurs.map((v) => ({ presse: false, ...v })) });

/** Un choix de valeurs en boutons, en liste au-delà de `CHOIX_EN_BOUTONS`. */
const typeDuChoix = (n: number): Choix['type'] => (n > CHOIX_EN_BOUTONS ? 'liste' : 'choix');

/** Un nom dit avec ce qu'il coûte (`null` : rien), en PX ou en prix. */
const avecCout = (nom: string, cout: CoutDeLaValeur | null): string =>
  (cout === null ? nom : t('ecran.aCout', { nom, prix: 'px' in cout ? t('ecran.px', { px: cout.px }) : formatMoney(cout.prix) }));

/** L'interlude ouvert (`Projection.interlude`) : chaque héros en entité, ses Activités restantes, ses PX, sa bourse et
 *  l'Événement de sa période en puces, puis chaque choix de l'Activité qu'il compose, chaque valeur dite avec son coût,
 *  la sienne pressée et chacune fermée avec sa raison, et le bouton qui la pratique ; ses Activités jouées par leur
 *  verbe, un bouton sans cible, un choix de ses cibles sinon, chacune dite avec son prix et fermée avec sa raison ; son
 *  dépôt, chaque genre nommé ; puis les dépôts en banque (`libelleDuDepot`), chacun le bouton de son retrait. */
function herosDeLInterlude(p: Projection): Element[] {
  const itl = p.interlude;
  if (!itl) return [];
  return [
    ligne('repit/semaines', t('ecran.repit.semaines', { semaines: itl.semaines, s: pluriel(itl.semaines) })),
    ...itl.heros.map((h): Entite => ({
      type: 'entite', id: `repit/${h.id}`, ton: h.restantes ? 'neutre' : 'alerte', nom: h.nom,
      elements: [
        puce('restantes', t('ecran.repit.restantes', { restantes: h.restantes, recues: h.recues }), null),
        puce('px', t('ecran.repit.px'), String(h.px)),
        puce('bourse', t('ecran.repit.bourse'), formatMoney(h.bourse)),
        ...(h.evenement ? [puce('evenement', h.evenement.nom, null)] : []),
        ...h.composition.map((c): Choix => ({
          type: typeDuChoix(c.valeurs.length), id: c.axe, ton: 'neutre', libelle: c.libelle, focus: false, refus: null,
          valeurs: c.valeurs.map((v, i) => boutonDeGeste(`${c.axe}/${i}`, avecCout(v.libelle, v.cout), v.geste, v.refus, v.choisie)),
        })),
        ...(h.pratiquer ? [boutonDuNoyau('pratiquer', h.pratiquer)] : []),
        ...h.activites.map((a): Bouton | Choix => (a.cible
          ? { type: typeDuChoix(a.gestes.length), id: a.id, ton: 'neutre', libelle: a.libelle, focus: false, refus: a.refus, valeurs: a.gestes.map((g, i) => boutonDeGeste(`${a.id}/${i}`, avecCout(g.libelle, g.cout), g.geste, g.refus)) }
          : boutonDuNoyau(a.id, a.gestes[0]))),
        formulaireDuNoyau(`depot/${h.id}`, t('ecran.repit.depot'), h.depot, h.depot.refus ? [] : [
          saisieDeValeurs('genre', t('ecran.repit.genre'), h.depot.genres.map((g) => ({ ...g, libelle: t(`interlude.genre.${g.valeur}`) }))),
          { type: 'saisieNombre', id: 'montant', ton: 'neutre', nom: 'montant', optionnel: false, libelle: t('ecran.repit.montant'), valeur: h.depot.pas, min: h.depot.pas, max: h.depot.max, pas: h.depot.pas },
        ]),
      ],
    })),
    ...(itl.depots.length ? [{ type: 'entite', id: 'repit/depots', ton: 'neutre', nom: t('ecran.repit.depots'), elements: itl.depots.map((d, i) => boutonDeGeste(String(i), libelleDuDepot(d), d.geste, d.refus)) } satisfies Entite] : []),
  ];
}

/** Le ton de l'issue d'une bataille, par le camp qui l'emporte. */
const TON_DE_L_ISSUE = { allie: 'reussite', ennemi: 'echec' } as const satisfies Record<Equipe, Ton>;

/** La bataille de masse ouverte (`batailleEnVue`) : son Round, chaque armée en entité, sa Puissance en jauge et le bonus
 *  de ses Tests ce Round, son terrain et sa Menace, puis chaque Scène en entité, son effet (sa description au détail),
 *  sa position, ses postes en choix (chaque PJ libre pressé quand il y est posté) et son engagement fermé avec sa
 *  raison ; l'aléa du Round, ou les gestes qui le tirent ; les gestes du Round ; l'issue. */
function champDeBataille(etat: Jeu): Element[] {
  const b = batailleEnVue(etat);
  if (!b) return [];
  return [
    ...(b.round ? [ligne('bataille/round', b.round)] : []),
    ...b.armees.map((a): Entite => ({
      type: 'entite', id: `armee/${a.camp}`, ton: 'neutre', nom: a.nom,
      elements: [
        { type: 'jauge', id: 'puissance', ton: 'neutre', libelle: t('ecran.bataille.puissance'), courant: a.puissance, max: a.max, texte: t('ecran.bataille.depart', { puissance: a.puissance, depart: a.depart }) },
        ...(a.bonus ? [puce('bonus', t('ecran.bataille.bonus'), avecSigne(a.bonus))] : []),
      ],
    })),
    ...(b.terrain ? [ligne('bataille/terrain', b.terrain)] : []),
    ...(b.menace ? [ligne('bataille/menace', t('ecran.bataille.menace', { penalite: b.menace }), 'alerte')] : []),
    ...b.scenes.map((sc): Entite => ({
      type: 'entite', id: `scene/${sc.id}`, ton: sc.resolue ? 'reussite' : 'neutre', nom: sc.libelle,
      elements: [
        puce('effet', sc.effet, null, sc.desc),
        ...(sc.position ? [puce('position', sc.position, null)] : []),
        ...(sc.postes ? [{
          type: 'choix', id: 'postes', ton: 'neutre', libelle: t('ecran.bataille.postes'), focus: false, refus: null,
          valeurs: sc.postes.map((p, i): Bouton => ({ type: 'bouton', id: String(i), libelle: p.nom, jeu: { type: p.geste.verbe, args: p.geste.args }, presse: p.poste, focus: false, detail: null, touche: null, refus: null })),
        } satisfies Choix] : []),
        boutonDuNoyau('engager', sc.engager),
      ],
    })),
    ...(b.alea ? [ligne('bataille/alea', t('ecran.bataille.alea', { alea: b.alea.libelle }), 'neutre', b.alea.texte)] : []),
    ...(b.tirerAlea ? [boutonDuNoyau('bataille/tirerAlea', b.tirerAlea)] : []),
    ...(b.choisirAlea.length ? [{
      type: 'liste', id: 'bataille/choisirAlea', ton: 'neutre', libelle: t('ecran.bataille.choisirAlea'), focus: false, refus: null,
      valeurs: b.choisirAlea.map((g, i) => boutonDuNoyau(String(i), g)),
    } satisfies Choix] : []),
    ...b.gestes.map((g, i) => boutonDuNoyau(`bataille/geste/${i}`, g)),
    ...(b.issue ? [ligne('bataille/issue', b.issue.texte, b.issue.gagnant ? TON_DE_L_ISSUE[b.issue.gagnant] : 'neutre')] : []),
  ];
}

type Repos = NonNullable<Projection['repos']>;

/** Ce qui attend un dormeur cette nuit, en texte. */
function texteDeLAlerte(a: Repos['dormeurs'][number]['alertes'][number]): string {
  switch (a.genre) {
    case 'refusDeRecuperation': return t(`rest.refus.${a.motif}`);
    case 'ventreVide': return t('rf.ventreVide');
    case 'expositions': return t('rf.expositions', { n: a.n });
  }
}

/** La nuit en tête de la scène : le titre de son toit, son lieu (une route : ses deux extrémités), ses nuits et sa
 *  qualité hors de la normale. */
function momentDuRepos(r: Repos): string {
  const lieu = 'nom' in r.lieu ? r.lieu.nom : t('rf.lieuRoute', { from: r.lieu.route.deNom, to: r.lieu.route.versNom });
  return [`${t(TITRE_DE_LA_NUIT[r.toit])} — ${lieu}`, ...(r.nuits > 1 ? [t('rf.nuits', { n: r.nuits })] : []), ...(r.qualite === 'normale' ? [] : [t(`rf.qualite.${r.qualite}`)])].join(' · ');
}

/** Le temps de la nuit en texte : le Plein air qui en dispense, sinon le mauvais temps et la tente qui en abrite, en
 *  alerte ; rien par temps clément. */
function tempsDuRepos(nuit: Repos['temps']): { texte: string; alerte: boolean } | null {
  if (nuit.pleinAir) return { texte: t('rf.pleinAirDispense'), alerte: false };
  if (nuit.severite === 'clement') return null;
  return { texte: [t(nuit.severite === 'extreme' ? 'rf.tempsDeChien' : 'rf.mauvaisTemps'), ...(nuit.abrite ? [t('rf.tenteAbrite')] : [])].join(' — '), alerte: true };
}

/** Un réglage d'un dormeur en choix : chaque valeur que le lieu lui offre, la sienne pressée, chacune fermée par sa raison. */
const choixDuDormeur = (id: string, c: Repos['dormeurs'][number]['pitance']): Choix => ({
  type: 'choix', id, ton: 'neutre', libelle: c.libelle, focus: false, refus: null,
  valeurs: c.valeurs.map((v, i): Bouton => ({ type: 'bouton', id: String(i), libelle: v.libelle, jeu: { type: v.geste.verbe, args: v.geste.args }, presse: v.choisie, focus: false, detail: null, touche: null, refus: v.refus })),
});

/** La nuit à régler (`Projection.repos`) : la tête de sa scène (`scene` : le paysage de la halte, le temps sous le ciel de
 *  nuit, la nuit et son lieu), le temps qu'il fait (en alerte quand il expose), puis la note, en alerte quand les bourses ne la couvrent
 *  pas ; la nuit de chaque dormeur est sur sa carte (`surLesCartes`). */
function nuitDuRepos(p: Projection, cle: string): Element[] {
  const r = p.repos;
  if (!r) return [];
  const temps = tempsDuRepos(r.temps);
  return [
    ...scene(p.temps, paysageDeLaHalte(r.toit, p.voyage), { ciel: 'arche-nuit', moment: momentDuRepos(r), meteo: null, jourDeRoute: null }),
    ...(temps ? [ligne(`${cle}/temps`, temps.texte, temps.alerte ? 'alerte' : 'neutre')] : []),
    ...(r.note ? [ligne(`${cle}/note`, t('rf.note', { cout: formatMoney(r.note.cout), bourse: formatMoney(r.note.bourse) }), r.note.couverte ? 'neutre' : 'alerte')] : []),
  ];
}

type Recit = NonNullable<Projection['recit']>;

/** Le ton de chaque issue d'un récit de voyage. */
const TON_DU_RECIT = { arrivee: 'reussite', interruption: 'alerte', arret: 'alerte', embuscade: 'echec' } as const satisfies Record<Recit['issue'], Ton>;
const TITRE_DU_RECIT = { arrivee: 'trm.titreArrivee', interruption: 'trm.titreInterrompu', arret: 'trm.titreArret', embuscade: 'trm.titreEmbuscade' } as const satisfies Record<Recit['issue'], string>;
const SUITE_DU_RECIT = { arrivee: null, interruption: 'trm.piedInterrompu', arret: 'trm.piedSurcharge', embuscade: 'trm.piedEmbuscade' } as const satisfies Record<Recit['issue'], string | null>;

/** La route d'un récit : d'où, vers où, sa longueur et son mode, puis hors d'une arrivée ce qui reste, ou les portes
 *  de l'arrivée quand il en reste moins d'une unité. */
function routeDuRecit(r: Recit): string {
  const route = t('trm.route', { de: elision('de', r.de), depart: r.de, vers: r.vers, distance: libelleDeDistance(r.distance), mode: r.mode.nom.toLowerCase() });
  const reste = r.reste && (Math.round(r.reste.valeur) > 0 ? t('trm.restants', { distance: libelleDeDistance(r.reste) }) : t('trm.auxPortes', { lieu: r.vers }));
  return [route, ...(reste ? [reste] : [])].join(t('ecran.separateur'));
}

/** Le récit du trajet que le groupe vient de faire (`Projection.recit`) : son issue au ton de l'issue, la route faite,
 *  puis la durée du voyage arrivé, ou chaque journée en entité (sa longueur, ses heures de route, ses lignes à leur
 *  ton), et ce qui permet de repartir. */
function recitDuVoyage(p: Projection): Element[] {
  const r = p.recit;
  if (!r) return [];
  const duree = r.dureeMin ? clockLabel(r.dureeMin, { exact: true }) : undefined;
  const suite = SUITE_DU_RECIT[r.issue];
  return [
    ligne('recit/issue', t(TITRE_DU_RECIT[r.issue], { lieu: r.vers }), TON_DU_RECIT[r.issue]),
    ligne('recit/route', routeDuRecit(r)),
    ...(duree ? [ligne('recit/duree', t('trm.dureeVoyage', { duree }))] : []),
    ...(r.issue === 'arrivee' ? [] : r.journees.map((j, i): Entite => ({
      type: 'entite', id: `recit/jour/${i}`, ton: 'neutre',
      nom: t('trm.jour', { n: i + 1, distance: libelleDeDistance({ valeur: j.jusqua - j.depuis, unite: r.distance.unite }), heures: Math.round(j.heures) }),
      elements: j.lignes.map((l, k) => ligne(String(k), redigerLEntree(l.entree), l.entree.ton ?? 'neutre')),
    }))),
    ...(suite ? [ligne('recit/suite', t(suite))] : []),
  ];
}

/** L'échoppe ouverte (`Projection.marchand`) : la bourse du groupe ; chaque famille de l'étal en entité, chaque article en
 *  bouton qui en met une unité au panier, son prix au libellé, pressé quand le panier en tient ; le panier, chaque ligne
 *  en bouton qui en ôte une unité, et le paiement de son total ; chaque héros et ses possessions, chacune en bouton qui la
 *  met au lot ou l'en retire, son gain au libellé ; puis la vente du lot. */
function echoppe(p: Projection): Element[] {
  const m = p.marchand;
  if (!m) return [];
  return [
    puce('bourse', t('ecran.bourse'), formatMoney(m.bourse)),
    ...m.etal.map((f): Entite => ({
      type: 'entite', id: `etal/${f.id}`, ton: 'neutre', nom: f.nom,
      elements: f.articles.map((a) => {
        const nom = a.recoursDeGuilde ? t('mf.guildeArticleARechercher', { article: a.nom }) : a.nom;
        return boutonDeGeste(a.id, avecCout(nom, a.prix && { prix: a.prix }), a.ajouter.geste, a.ajouter.refus, a.auPanier > 0);
      }),
    })),
    {
      type: 'entite', id: 'panier', ton: 'neutre', nom: t('ecran.echoppe.panier'),
      elements: [
        ...m.panier.lignes.map((l) => boutonDeGeste(l.id, avecCout(t('ecran.echoppe.ligne', { nom: l.nom, qty: l.qty }), l.sousTotal && { prix: l.sousTotal }), l.oter, null)),
        boutonDeGeste('payer', t('ecran.echoppe.payer', { total: formatMoney(m.panier.total) }), m.panier.payer.geste, m.panier.payer.refus),
      ],
    },
    ...m.vente.heros.map((h): Entite => ({
      type: 'entite', id: `vente/${h.id}`, ton: 'neutre', nom: h.nom,
      elements: h.possessions.map((o) => boutonDeGeste(o.uid, avecCout(o.nom, { prix: o.gain }), o.basculer, o.refus, o.auLot)),
    })),
    boutonDeGeste('vendre', t('ecran.echoppe.vendre', { total: formatMoney(m.vente.total) }), m.vente.vendre.geste, m.vente.vendre.refus),
  ];
}

type Voyage = NonNullable<Projection['voyage']>;

/** La teinte de chaque moment du jour : celle de son ciel (`ciel-…`) et de sa brume (`brume-…`). */
const TEINTE_DU_MOMENT = { aube: 'aube', matin: 'jour', midi: 'jour', apresmidi: 'jour', crepuscule: 'soir', soir: 'nuit', nuit: 'nuit' } as const satisfies Record<DayPhaseId, string>;
type Teinte = (typeof TEINTE_DU_MOMENT)[DayPhaseId];

/** La couche de chaque météo du jour ; `null` : un temps qui ne se voit pas. */
const COUCHE_DE_LA_METEO: Record<NonNullable<Voyage['meteo']>['id'], IdDeCouche | null> = {
  sec: null, beau: null, pluie: 'meteo-pluie', 'pluie-diluvienne': 'meteo-pluie-diluvienne', neige: 'meteo-neige', blizzard: 'meteo-blizzard',
};

/** Le pictogramme de chaque météo du jour. */
const ICONE_DE_LA_METEO: Record<NonNullable<Voyage['meteo']>['id'], IconId> = {
  sec: 'meteo/sec', beau: 'meteo/beau', pluie: 'meteo/pluie', 'pluie-diluvienne': 'meteo/pluie-diluvienne', neige: 'meteo/neige', blizzard: 'meteo/blizzard',
};

/** La lumière des plans de terre à la teinte `t` : leurs couleurs au jour, leurs silhouettes sinon. */
const lumiere = (t: Teinte) => (t === 'jour' ? 'jour' : 'ombre');

/** Le relief de la voie `voie` du plus lointain au plus proche, à la lumière de la teinte `t` et sa brume entre ses
 *  plans : à terre les montagnes, les collines, la lisière et la route ; l'eau sous sa brume basse. */
const reliefDeLaVoie = (voie: Voyage['voie'], t: Teinte): IdDeCouche[] => {
  const l = lumiere(t);
  return voie === 'terrestre'
    ? [`relief-montagnes-${l}`, `brume-haute-${t}`, `relief-collines-${l}`, `brume-basse-${t}`, `relief-lisiere-${l}`, `relief-route-${l}`]
    : [voie === 'fluvial' ? 'relief-fleuve' : 'relief-mer', `brume-basse-${t}`];
};

/** Ce qui ferme un paysage sur la voie `voie` à la teinte `t` : le premier plan à terre, la météo `meteo` du jour, la
 *  vignette. */
const avantDuPaysage = (voie: Voyage['voie'], t: Teinte, meteo: Voyage['meteo'] | undefined): IdDeCouche[] => {
  const couche = meteo && COUCHE_DE_LA_METEO[meteo.id];
  return [...(voie === 'terrestre' ? [`avant-foret-${lumiere(t)}` as const] : []), ...(couche ? [couche] : []), 'voile-coins'];
};

/** L'équipage d'un trajet, qui nomme sa couche (`equipage-…`) et celle de sa lanterne (`lanterne-…`). */
type Equipage = 'pied' | 'monture' | 'attelage' | 'barge' | 'navire';

/** L'équipage du trajet : le navire en mer, la barge au fleuve ; sur la route, les marcheurs, les cavaliers ou l'attelage. */
const equipage = (v: Voyage): Equipage => (v.voie === 'maritime' ? 'navire' : v.voie === 'fluvial' ? 'barge' : v.mode.id === 'pied' ? 'pied' : v.mode.id === 'monture' ? 'monture' : 'attelage');

/** L'objet du temps d'une scène : `ciel`, la couche du ciel de son arche ; `moment`, ce qui se dit du moment ; `meteo`,
 *  le pictogramme de la météo du jour (`null` : sans) ; `jourDeRoute`, le jour du trajet (`null` : hors d'un trajet). */
type Temps = { ciel: IdDeCouche; moment: string; meteo: IconId | null; jourDeRoute: number | null };

/** La tête d'une scène du monde à l'heure `heure` (`Projection.temps`) : son paysage, ses couches de la plus lointaine
 *  à la plus proche ; puis son objet du temps : le ciel du moment dans son arche, le jour de la semaine (hors d'un
 *  intercalaire), la date impériale et le jour de route, le pictogramme de la météo et ce qui se dit du moment. */
function scene(heure: Projection['temps'], couches: IdDeCouche[], temps: Temps): Element[] {
  const semaine = heure.date.semaine?.nom;
  const date = jourImperial(heure.date);
  const route = temps.jourDeRoute === null ? null : temps.jourDeRoute === 1 ? t('ecran.voyage.premierJour') : t('ecran.voyage.jourDeRoute', { jour: temps.jourDeRoute });
  return [
    { type: 'paysage', id: 'scene/paysage', paysage: couches } satisfies Paysage,
    { type: 'paysage', id: 'scene/ciel', paysage: [temps.ciel] } satisfies Paysage,
    ...(semaine ? [ligne('scene/jour', semaine)] : []),
    ligne('scene/date', route ? t('ecran.voyage.date', { date, route }) : date),
    ...(temps.meteo ? [{ type: 'icone', id: 'scene/meteo', icone: temps.meteo } satisfies Icone] : []),
    ligne('scene/moment', temps.moment),
  ];
}

/** Le paysage du trajet au moment `moment` : le ciel du moment, le relief de la voie, l'équipage, sa lanterne quand le jour baisse, puis ce
 *  qui ferme le paysage. */
function paysageDuVoyage(v: Voyage, moment: DayPhaseId): IdDeCouche[] {
  const t = TEINTE_DU_MOMENT[moment];
  const e = equipage(v);
  return [`ciel-${t}`, ...reliefDeLaVoie(v.voie, t), `equipage-${e}`, ...(t === 'soir' || t === 'nuit' ? [`lanterne-${e}` as const] : []), ...avantDuPaysage(v.voie, t, v.meteo)];
}

/** Le paysage d'une halte : la nuit sur son relief, le toit de la nuit (le feu du campement, les fenêtres d'un logis,
 *  le bord et ses lanternes sur l'eau du trajet `v`, la mer hors d'un trajet), puis ce qui ferme le paysage. */
function paysageDeLaHalte(toit: Repos['toit'], v: Voyage | null): IdDeCouche[] {
  const voie = toit === 'bord' ? (v?.voie === 'fluvial' ? 'fluvial' : 'maritime') : 'terrestre';
  const bord = voie === 'fluvial' ? 'barge' : 'navire';
  const halte: IdDeCouche[] = toit === 'bord' ? [`equipage-${bord}`, `lanterne-${bord}`] : [toit === 'campement' ? 'halte-feu' : 'halte-toit'];
  return ['ciel-nuit', ...reliefDeLaVoie(voie, 'nuit'), ...halte, ...avantDuPaysage(voie, 'nuit', v?.meteo)];
}

/** La frise du trajet, en plan d'une seule ligne : le départ nommé, chaque nuit passée en route à sa distance, sans nom,
 *  qui porte le croissant de la nuit passée, là où est le groupe (`ici`, en `reussite`, sans nom), l'arrivée nommée ; la
 *  route faite en `alerte`, celle qui reste en `neutre`. */
function friseDuVoyage(v: Voyage): Plan {
  const point = (id: string, nom: string, km: number, ton: Ton, elements: Element[] = []): Plan['points'][number] => ({ type: 'point', id, nom, x: v.km > 0 ? km / v.km : 1, y: 0, ton, elements });
  const nuit: Icone = { type: 'icone', id: 'nuit', icone: 'voyage/nuit-passee' };
  const faits = [point('depart', v.de, 0, 'neutre'), ...v.journees.map((j, i) => point(`nuit/${i}`, '', j.jusqua, 'neutre', [nuit])), point('ici', '', v.fait, 'reussite')];
  const points = [...faits, point('arrivee', v.vers, v.km, 'neutre')];
  return { type: 'plan', id: 'voyage/frise', points, traits: points.slice(1).map((p, i) => ({ id: p.id, de: points[i].id, vers: p.id, ton: i < faits.length - 1 ? 'alerte' : 'neutre' })) };
}

/** La carte du trajet, en plan : chaque lieu que la carte montre, nommé s'il est le départ ou l'arrivée du trajet,
 *  l'arrivée en `reussite`, chaque route
 *  en `neutre` ; quand elle montre les deux bouts du trajet, là où est le groupe sur sa route (`ici`, en `alerte`) et
 *  la part faite de cette route en `alerte`. */
function carteDuVoyage(v: Voyage): Plan {
  const lieu = (id: string) => v.carte.lieux.find((l) => l.id === id);
  const [de, vers] = [lieu(v.depart), lieu(v.arrivee)];
  const part = v.km > 0 ? v.fait / v.km : 1;
  const point = (id: string, nom: string, x: number, y: number, ton: Ton): Plan['points'][number] => ({ type: 'point', id, nom, x, y, ton, elements: [] });
  const nom = (id: string) => (id === v.depart ? v.de : id === v.arrivee ? v.vers : '');
  const lieux = v.carte.lieux.map((l) => point(`lieu/${l.id}`, nom(l.id), l.x, l.y, l.id === v.arrivee ? 'reussite' : 'neutre'));
  const routes = v.carte.routes.filter((r) => r.route !== v.route).map((r) => ({ id: r.route, de: `lieu/${r.de}`, vers: `lieu/${r.vers}`, ton: 'neutre' as const }));
  if (!de || !vers) return { type: 'plan', id: 'voyage/carte', points: lieux, traits: routes };
  return {
    type: 'plan', id: 'voyage/carte',
    points: [...lieux, point('ici', '', de.x + (vers.x - de.x) * part, de.y + (vers.y - de.y) * part, 'alerte')],
    traits: [...routes, { id: 'reste', de: 'ici', vers: `lieu/${v.arrivee}`, ton: 'neutre' }, { id: 'fait', de: `lieu/${v.depart}`, vers: 'ici', ton: 'alerte' }],
  };
}

/** Le trajet en cours (`Projection.voyage`) : hors d'une halte, qui tient la sienne (`nuitDuRepos`), la tête de sa scène
 *  (`scene` : son paysage, le ciel du moment, le jour de route, la météo et le moment du jour, un jour de route par
 *  nuit passée en route) ; puis le titre de sa carte et sa carte (`carteDuVoyage`), la distance qui reste avant l'arrivée dans son unité,
 *  le choix de sa cadence, celle qu'il joue pressée, et sa frise (`friseDuVoyage`). */
function voyage(p: Projection): Element[] {
  const v = p.voyage;
  if (!v) return [];
  const m = p.temps.moment;
  const moment = v.meteo ? t('ecran.voyage.moment', { moment: m.nom, meteo: v.meteo.nom.toLocaleLowerCase('fr') }) : m.nom;
  const temps: Temps = { ciel: `arche-${m.id}`, moment, meteo: v.meteo && ICONE_DE_LA_METEO[v.meteo.id], jourDeRoute: v.journees.length + 1 };
  return [
    ...(p.repos ? [] : scene(p.temps, paysageDuVoyage(v, m.id), temps)),
    ligne('voyage/titre', t('ecran.voyage.titre', { arrivee: v.vers })),
    carteDuVoyage(v),
    puce('voyage/reste', t(`distance.${v.unite}`), String(Math.round(v.km - v.fait))),
    ...(v.cadences.length ? [{
      type: 'choix', id: 'voyage/cadence', ton: 'neutre', libelle: t('ecran.voyage.cadence'), focus: false, refus: null,
      valeurs: v.cadences.map((c) => boutonDeGeste(c.cadence, t(`ecran.cadence.${c.cadence}`), c.geste, null, c.cadence === v.cadence)),
    } satisfies Choix] : []),
    friseDuVoyage(v),
  ];
}

/** Le marché de cargaison ouvert (`Projection.marche`) : la bourse, chaque offre en entité, son Enc disponible, son prix
 *  par Enc, la qualité de son vin ou son évaluation, puis le bouton qui en compose l'achat, pressé quand il se compose,
 *  et son estimation (le porteur, l'Enc et la conclusion de l'achat en composition sont des réglages de la fenêtre) ;
 *  chaque lot des porteurs du groupe en entité, son porteur et son Enc, son prix de base, sa vente, son bradage, puis
 *  son transfert vers un porteur co-localisé. */
function marche(p: Projection): Element[] {
  const m = p.marche;
  if (!m) return [];
  const enc = (n: number) => t('ecran.marche.enc', { enc: n });
  const parEnc = (prix: Money) => puce('prix', t('ecran.marche.prix'), t('ecran.marche.parEnc', { prix: formatMoney(prix) }));
  return [
    puce('bourse', t('ecran.bourse'), formatMoney(m.bourse)),
    ...m.offres.map((o): Entite => ({
      type: 'entite', id: `offre/${o.id}`, ton: 'neutre', nom: o.nom,
      elements: [
        puce('dispo', t('ecran.marche.dispo'), enc(o.dispo)),
        parEnc(o.prixParEnc),
        ...(o.qualite ? [{ ...puce('qualite', t('ecran.marche.qualite'), o.qualite.fiable ? o.qualite.nom : t('ecran.marche.incertaine', { qualite: o.qualite.nom })), ton: o.qualite.fiable ? 'neutre' : 'alerte' } satisfies Puce] : []),
        ...(o.evaluer ? [boutonDuNoyau('evaluer', { ...o.evaluer, libelle: t('ecran.marche.evaluer') })] : []),
        puce('estimation', t('ecran.marche.estimation'), formatMoney(o.acheter.estimation)),
        boutonDeGeste('acheter', t('ecran.marche.acheter'), o.acheter.geste, o.acheter.refus, o.acheter.compose),
      ],
    })),
    ...m.cargaison.flatMap((c) => c.lots.map((l): Entite => ({
      type: 'entite', id: `lot/${l.uid}`, ton: 'neutre', nom: l.nom,
      elements: [
        puce('porteur', c.nom, enc(l.enc)),
        parEnc(l.prixParEnc),
        boutonDuNoyau('vendre', { ...l.vendre, libelle: t('ecran.marche.vendre') }),
        boutonDuNoyau('brader', { ...l.brader, libelle: t('ecran.marche.brader') }),
        formulaireDuNoyau('deplacer', t('ecran.marche.deplacer'), { geste: { verbe: l.deplacer.geste.verbe, args: [l.uid] }, refus: l.deplacer.refus }, l.deplacer.refus ? [] : [
          saisieDeValeurs('vers', t('ecran.marche.vers'), l.deplacer.vers.map((p, i) => ({ libelle: t('valeur.porteur', { nom: p.nom, libre: p.libre, capacite: p.capacite }), valeur: p.id, refus: null, presse: i === 0 }))),
          { type: 'saisieNombre', id: 'encombrement', ton: 'neutre', nom: 'encombrement', optionnel: false, libelle: t('ecran.marche.aDeplacer'), valeur: l.deplacer.enc, min: 1, max: l.deplacer.max, pas: 1 },
        ]),
      ],
    }))),
  ];
}

/** Les clés des choix de fenêtre (`fenetreChoisir`) que jouent les boutons de `elements`, à toute profondeur : un choix
 *  que le corps porte ne se redessine ni en réglage ni en geste. */
function choixPortes(elements: readonly Element[]): Set<string> {
  const cles = new Set<string>();
  const parcourir = (e: Element | Bouton): void => {
    if (e.type === 'bouton' && 'type' in e.jeu && e.jeu.type === VERBE_DE_CHOIX) cles.add(cleDuGeste({ verbe: VERBE_DE_CHOIX, fenetre: e.jeu.args[0] as FenetreAChoix, axe: e.jeu.args[1] as AxeDuChoix }));
    if (e.type === 'entite') e.elements.forEach(parcourir);
    if (e.type === 'choix' || e.type === 'liste') e.valeurs.forEach(parcourir);
    if (e.type === 'plan') e.points.forEach((p) => p.elements.forEach(parcourir));
  };
  elements.forEach(parcourir);
  return cles;
}

/** Le patient du soin en attente (`fenetreDuSoin`) ; le soigneur est celui qui tient la fenêtre et jette. */
function patientDuSoin(etat: Jeu): Element[] {
  const f = fenetreDuSoin(etat);
  return f ? [ligne('soin', t('ecran.soin.patient', { patient: garanti(nomEnVue(etat, f.patientId), f.patientId, 'patient du soin') }))] : [];
}

/** Le texte du document remis (`documentEnVue`) ; son titre est celui de la fenêtre. */
function texteDuDocument(etat: Jeu): Element[] {
  const doc = documentEnVue(etat);
  return doc ? [ligne('lecture', redigerLeDocument(doc).texte)] : [];
}

/** La victoire en attente : l'Expérience gagnée et l'argent pris en puces, puis chaque adversaire vaincu et chaque
 *  message de la rencontre ; l'équipement s'attribue par les réglages de la fenêtre (`fenetreDuButin`). */
function victoire(etat: Jeu, cle: string): Element[] {
  const v = etat.pendingVictory;
  if (!v) return [];
  const argent = formatMoney(v.gold);
  return [
    ...(v.xp ? [puce(`${cle}/xp`, t('ecran.victoire.xp'), avecSigne(v.xp), null, 'reussite')] : []),
    ...(v.gold.gold || v.gold.silver || v.gold.brass ? [puce(`${cle}/argent`, t('ecran.victoire.argent'), argent, null, 'reussite')] : []),
    ...v.defeated.map((d, i) => ligne(`${cle}/vaincu/${i}`, d.count > 1 ? t('ecran.victoire.vaincus', { nom: d.nom, nombre: d.count }) : d.nom)),
    ...(v.messages ?? []).map((m, i) => ligne(`${cle}/message/${i}`, m)),
  ];
}

/** Le Sauvetage par le Destin en attente : ce qui emporte le héros, sa mort sans sacrifice au détail, et ses Points de
 *  Destin. */
function destinEnJeu(etat: Jeu, cle: string): Element[] {
  const p = etat.pendingFateSave;
  const heros = p && porteurParId(etat, p.heroId);
  if (!heros) return [];
  return [ligne(`${cle}/enjeu`, t(`ecran.destin.${p.source}`), 'alerte', t('ecran.destin.refus')), puce(`${cle}/points`, t('ecran.destin'), String(heros.fate ?? 0))];
}

/** La puce d'un fait que révèle l'étape courante, sous l'espace `cle`, au ton de son fait (`tonDuFait`). */
function puceDuFait(etat: Jeu, cle: string, f: FaitApplique, i: number): Puce {
  const ton = tonDuFait(f);
  switch (f.genre) {
    case 'localisation': return puce(`${cle}/localisation`, t('ecran.critique.localisation'), locationLabel(f.valeur, porteurParId(etat, f.cible)?.bodyShape), null, ton);
    case 'blessures': return puce(`${cle}/blessures/${i}`, t('ecran.jauge.blessures'), avecSigne(f.valeur), null, ton);
    case 'avantage': return puce(`${cle}/avantage/${i}`, t('ecran.avantage'), avecSigne(f.valeur), null, ton);
    case 'etat': return puce(`${cle}/etat/${f.id}/${i}`, conditionLabel(f.id), avecSigne(f.valeur), null, ton);
    case 'corruption': return puce(`${cle}/corruption/${i}`, t('ecran.corruption'), avecSigne(f.valeur), null, ton);
    case 'argent': return puce(`${cle}/argent/${i}`, t('ecran.argent'), `${f.valeur < 0 ? '−' : '+'}${formatMoney(fromBrass(Math.abs(f.valeur)))}`, null, ton);
    case 'prix': return puce(`${cle}/prix/${i}`, t(`ecran.prix.${f.sens}`), t('ecran.prix.pourcent', { variation: avecSigne(f.valeur) }), null, ton);
    case 'objet': return puce(`${cle}/objet/${i}`, 'arme' in f.objet ? t('ecran.objet.arme') : t('ecran.objet.armure', { lieu: locationLabel(f.objet.armure, porteurParId(etat, f.cible)?.bodyShape) }), t(`ecran.objet.${f.issue}`), null, ton);
  }
}

/** Ce que l'étape courante de la cascade révèle (fin de round, entrée de scène, mutation, Coup Critique…) : chacun de
 *  ses faits en puce (`faitsDeLEtape` : appliqués, ou prévus par sa fenêtre), puis ses lignes, qu'aucun fait ne lit, et
 *  chacun de ses effets, son explication au détail. Une Blessure critique ne montre pas ses lignes : son en-tête dit sa
 *  ligne de table, et ses effets disent le reste. */
function revelationDeLEtape(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const etape = pc?.participants[pc.cursor];
  const r = etape?.reveal;
  if (!etape || !r) return [];
  return [
    ...faitsDeLEtape(etat, etape).map((f, i) => puceDuFait(etat, r.kind, f, i)),
    ...(r.kind === 'critique' ? [] : r.lines.map((l, i) => ligne(`revelation/${i}`, l))),
    ...(r.details ?? []).map((d, i) => ligne(`${r.kind}/effet/${i}`, d.text, 'neutre', d.note ?? null)),
  ];
}

/** Ce que l'étape courante de la cascade dit sans le révéler (`outcome` posé par son monteur : un affichage, le contexte
 *  d'un choix), chaque ligne à son ton ; une révélation le dit déjà (`revelationDeLEtape`). */
function issueDeLEtape(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const etape = pc?.participants[pc.cursor];
  if (!etape || etape.reveal) return [];
  return (etape.outcome ?? []).map((l, i) => ligne(`issue/${i}`, redigerLEntree(l.entree), l.entree.ton ?? 'neutre'));
}

/** Une jauge de `courant` sur `max`. */
const jauge = (id: string, libelle: string, [courant, max]: readonly [number, number]): Element => ({ type: 'jauge', id, ton: 'neutre', libelle, courant, max, texte: t('ecran.jauge', { courant, max }) });

/** Le Mouvement de l'actif, `[restant, total]` : un jeton par case, en `reussite` tant qu'il reste, puis ce qui reste. */
const mouvementEnJetons = ([restant, total]: readonly [number, number]): Entite => ({
  type: 'entite', id: 'mouvement', ton: 'neutre', nom: t('ecran.jauge.mouvement'),
  elements: [
    ...Array.from({ length: total }, (_, i) => puce(`jeton/${i}`, t('ecran.jauge', { courant: i + 1, max: total }), null, null, i < restant ? 'reussite' : 'neutre')),
    ligne('reste', t('ecran.jauge', { courant: restant, max: total })),
  ],
});

/** L'actif du combat : son nom, son portrait, ses Blessures en jauge, son Mouvement en jetons (`mouvementEnJetons`),
 *  puis son Avantage, son Action et chacun de ses États en puces. */
const actifDuCombat = (actif: NonNullable<Combat['actif']>): Entite => ({
  type: 'entite', id: actif.id, ton: 'neutre', nom: actif.nom,
  elements: [
    { type: 'portrait', id: 'portrait', combattant: actif.id },
    jauge('blessures', t('ecran.jauge.blessures'), actif.pb),
    mouvementEnJetons(actif.mouvement),
    puce('avantage', t('ecran.avantage'), String(actif.avantage)),
    puce('action', t('ecran.action'), t(`ecran.action.${actif.action}`), null, actif.action === 'libre' ? 'reussite' : 'neutre'),
    ...etatsEnPuces(actif.etats),
  ],
});

/** Ce que l'aperçu du premier clic dit : le Mouvement qu'il coûte, ou la cible qu'il vise (`nomEnVue`). */
function apercuDe(etat: Jeu, c: Combat): string | null {
  const a = c.apercu;
  if (!a) return null;
  if (a.cout !== null) return t('ecran.apercu', { cout: a.cout });
  const cible = a.cible === null ? null : nomEnVue(etat, a.cible);
  return cible ? t('ecran.apercu.cible', { cible }) : null;
}

/** Les parts de l'économie du tour montrées en emplacements fixes : les plaques de l'Action et le coin du tour. */
const EMPLACEMENTS_FIXES: ReadonlySet<string> = new Set(['action', 'aucun']);

/** Le nom court de la pastille de l'offre par candidat d'action `id` : sa clé `ecran.offre.<id>`. */
function nomDePastille(id: string): string {
  const cle = `ecran.offre.${id}`;
  return garanti(estUneCle(cle) ? t(cle) : null, id, 'nom court de l’offre');
}

/** La fiche du sort `id` montrée au survol de ce qui le lance : son nom, puis une ligne « libellé : valeur » par fait
 *  que sa donnée porte, la part de l'économie du tour `cout` qu'il prend d'abord. */
function ficheDuSort(id: string, cout: (typeof ACTIONS)[number]['coutAction']): string {
  const s = garanti(findSpellById(id), id, 'sort de la fiche');
  const faits: [string, string | null][] = [
    [t('codex.fiche.cout2'), t(`ecran.economie.${cout}`)],
    [t('codex.fiche.niveauDIncantation'), s.cn == null ? null : String(s.cn)],
    [t('codex.fiche.portee'), s.range ? formatSpellRange(s.range) : null],
    [t('codex.fiche.cible'), s.target ? formatSpellTarget(s.target) : null],
    [t('codex.fiche.duree'), s.duration ? formatSpellDuration(s.duration) : null],
  ];
  return [s.label, ...faits.flatMap(([libelle, valeur]) => (valeur === null ? [] : [`${libelle} : ${valeur}`]))].join('\n');
}

/** La touche d'une offre de la barre, par l'id de son action ; une autre n'en a pas. */
const TOUCHES_DES_OFFRES: Partial<Record<string, Touche>> = { 'fin-de-tour': 'fin_de_tour' };

/** L'action d'une offre de la barre, par son id. */
const actionDeLOffre = (id: string) => garanti(ACTIONS.find((a) => a.id === id), id, 'action de l’offre');

/** Le choix d'une part de l'économie du tour `e`, de ses boutons, en `alerte` quand l'un est pressé. */
function partDuTour(e: (typeof ACTIONS)[number]['coutAction'], valeurs: Bouton[]): Choix {
  const dessin: IconId | undefined = (DESSINS_DES_PARTS as Partial<Record<string, IconId>>)[e];
  return {
    type: 'choix', id: `economie/${e}`, ton: valeurs.some((b) => b.presse) ? 'alerte' : 'neutre', libelle: t(`ecran.economie.${e}`), focus: false, refus: null, valeurs,
    ...(dessin ? { icone: dessin } : {}),
  };
}

/** La fin du tour d'un combat en cours dont la barre n'est pas ouverte : fermée de la `raison` de la barre, sans suite. */
function finDuTourFermee(raison: string): Choix {
  const fin = actionDeLOffre('fin-de-tour');
  return partDuTour('aucun', [{
    type: 'bouton', id: fin.id, libelle: fin.label, jeu: { suite: [] }, presse: false, focus: false, detail: null, touche: TOUCHES_DES_OFFRES[fin.id] ?? null, refus: raison, icone: fin.icon,
  }]);
}

/** Les offres de l'actif, chacune un bouton qui joue son geste (`Offre.geste`), au dessin de son action, pressée quand
 *  elle est armée ; rangées par la part de l'économie du tour qu'elles prennent, chaque part un choix qui la nomme une
 *  fois, au dessin de sa part (`DESSINS_DES_PARTS`), en `alerte` quand l'une de ses offres est armée, celles qui n'en
 *  prennent aucune (la fin du tour) sous le tour. Les parts aux emplacements fixes (`EMPLACEMENTS_FIXES`) gardent leurs
 *  offres fermées, refusées avec leur raison ; une autre part ne porte que ses offres ouvertes et n'est pas projetée sans
 *  elles. Une offre qui s'offre par candidat (le sort, l'arme, l'attaque de trait) est un choix à elle, au dessin de son
 *  action, de son nom court (`nomDePastille`), en `alerte` quand l'un de ses candidats est armé, sous sa part, en liste au-delà de `CHOIX_EN_BOUTONS`
 *  candidats ouverts : chaque candidat ouvert un bouton qui le nomme et joue son geste ; sans candidat ouvert, elle n'est
 *  pas projetée. Une offre sans geste, dont la case attend un paramètre que seule la console choisit, n'a pas de bouton.
 *  Hors de la barre ouverte, un combat en cours ne porte que la fin du tour fermée (`finDuTourFermee`). */
function offresDuCombat(c: Combat): Choix[] {
  if (c.offres === null) return c.fin === null && c.barre.raison !== null ? [finDuTourFermee(c.barre.raison)] : [];
  const offres = c.offres.liste.filter((o) => o.geste || o.candidats.some((k) => k.geste));
  const action = (o: (typeof offres)[number]) => actionDeLOffre(o.id);
  const jeuDe = (g: GesteDuNoyau): Bouton['jeu'] => ({ type: g.verbe, args: g.args });
  const bouton = (o: (typeof offres)[number]): Bouton => ({
    type: 'bouton', id: o.id, libelle: action(o).label, jeu: jeuDe(garanti(o.geste, o.id, 'geste de l’offre')), presse: o.armee, focus: false, detail: null, touche: TOUCHES_DES_OFFRES[o.id] ?? null, refus: o.refus, icone: action(o).icon,
  });
  const parCandidat = (o: (typeof offres)[number]): Choix[] => {
    const valeurs = o.candidats.flatMap((k): Bouton[] => (k.geste && k.refus === null ? [{
      type: 'bouton', id: `${o.id}/${Object.values(k.ctx).join('/')}`, libelle: k.nom, jeu: jeuDe(k.geste), presse: k.armee, focus: false,
      detail: k.ctx.spellId ? ficheDuSort(k.ctx.spellId, action(o).coutAction) : null, touche: null, refus: null,
    }] : []));
    return valeurs.length ? [{
      type: valeurs.length > CHOIX_EN_BOUTONS ? 'liste' : 'choix', id: `offre/${o.id}`, ton: o.candidats.some((k) => k.armee) ? 'alerte' : 'neutre', libelle: nomDePastille(o.id), focus: false, refus: null, icone: action(o).icon, valeurs,
    }] : [];
  };
  return [...new Set(offres.map((o) => o.economie))].flatMap((e): Choix[] => {
    const part = offres.filter((o) => o.economie === e);
    const uniques = part.filter((o) => !o.candidats.length && o.geste && (EMPLACEMENTS_FIXES.has(e) || o.refus === null));
    return [
      ...(uniques.length ? [partDuTour(e, uniques.map(bouton))] : []),
      ...part.filter((o) => o.candidats.length).flatMap(parCandidat),
    ];
  });
}

/** La touche du rang `i` des emplacements rapides (`TOUCHES_RAPIDES`). */
const toucheDuRang = (i: number): Touche => garanti(TOUCHES_RAPIDES[i], String(i), 'touche du rang');

/** Les emplacements rapides de l'actif d'une barre ouverte (`etatDeLaBarre`, la condition des offres), rang par rang : une
 *  case pleine en bouton qui joue le geste de son offre (une suite vide sans offre), pressé quand elle est armée, refusé
 *  de sa raison, détaillé de la fiche de son sort (`ficheDuSort`), sinon de son nom entier ; une case libre en ligne.
 *  Chaque case porte la touche de son rang (`toucheDuRang`), pas de son contenu. */
function rapidesDuCombat(etat: Jeu): (Bouton | Ligne)[] {
  const barre = etatDeLaBarre(etat);
  if (barre.forme !== 'ouverte') return [];
  return emplacementsRapides(etat, barre.active).map((r, i): Bouton | Ligne => (r
    ? { type: 'bouton', id: `rapide/${i}`, libelle: r.label, jeu: r.geste ? { type: r.geste.verbe, args: r.geste.args } : { suite: [] }, presse: r.armee, focus: false, detail: r.sort ? ficheDuSort(r.sort, garanti(ACTIONS.find((x) => x.id === r.entree.actionId), r.entree.actionId, 'action de la case').coutAction) : r.label, touche: toucheDuRang(i), refus: r.refus, icone: r.icon }
    : { ...ligne(`rapide/${i}`, t('ecran.rapide.libre')), touche: toucheDuRang(i) }));
}

/** Les premiers à jouer du round suivant que la colonne de l'ordre montre en tête : de la mise en page. */
export const TETE_DU_ROUND_SUIVANT = 3;

/** L'ordre du tour en vue (`ordreEnVue`), de haut en bas : la tête de l'ordre du round suivant (`ordreDuRoundSuivant`),
 *  ses `TETE_DU_ROUND_SUIVANT` premiers à jouer en rangs `suite/`, le premier au plus bas, sous eux le round qui
 *  commence (`round`) ; puis ceux qui restent à jouer ce round (à partir de `battle.turn` dans `battle.order`) en rangs
 *  `ordre/`, l'actif en bas, en `alerte`. Sous la relance d'Initiative, l'ordre suivant n'est pas tiré : ni `suite/`
 *  ni `round`. Chaque rang : son portrait, ses Blessures en jauge, un ennemi en `echec`, le bouton qui ouvre sa fiche
 *  (`boutonDeFiche`), pressé quand elle est ouverte (`ouverte`), qui la ferme alors. */
function ordreDuTour(etat: Jeu, c: Combat, ouverte: FicheOuverte | null): (Entite | Ligne)[] {
  const b = garanti(etat.battle, 'ordre', 'combat en cours');
  const enVue = ordreEnVue(etat);
  const rangs = (famille: 'suite' | 'ordre', ids: string[]): Entite[] => ids.flatMap((id): Entite[] => {
    const x = porteurParId(etat, id);
    if (!x) return [];
    const presse = ouverte?.porteur === id;
    const ton: Ton = famille === 'ordre' && id === c.actif?.id ? 'alerte' : x.kind === 'ennemi' ? 'echec' : 'neutre';
    return [{
      type: 'entite', id: `${famille}/${id}`, ton, nom: garanti(nomEnVue(etat, id), id, 'nom du rang de l’ordre'),
      elements: [
        { type: 'portrait', id: 'portrait', combattant: id },
        jauge('blessures', t('ecran.jauge.blessures'), [x.wounds.current, x.wounds.max]),
        boutonDeFiche(famille === 'ordre' ? `fiche/${id}` : `fiche/suite/${id}`, t('ecran.fiche.ouvrir'), presse ? null : { porteur: id }, presse),
      ],
    }];
  }).reverse();
  const suite = ordreDuRoundSuivant(b);
  return [
    ...(suite ? [...rangs('suite', suite.filter((id) => enVue.includes(id)).slice(0, TETE_DU_ROUND_SUIVANT)), ligne('round', t('ecran.round', { round: c.round + 1 }))] : []),
    ...rangs('ordre', enVue.filter((id) => b.order.indexOf(id) >= b.turn)),
  ];
}

/** Le ton de chaque issue du combat. */
const TON_DE_LA_FIN: Record<NonNullable<Combat['fin']>, Ton> = { victoire: 'reussite', defaite: 'echec' };

/** Ce que le panneau du combat dit hors de ses jauges, quand aucune fenêtre ne tient la main : pourquoi la barre est
 *  fermée, la fin du tour armée par un premier geste qui laisserait l'Action intacte (`finDeTourArmee`) ; la fin du
 *  combat. */
function avisDuCombat(c: Combat, fenetreOuverte: boolean): Ligne[] {
  return [
    ...(c.barre.raison === null || fenetreOuverte ? [] : [ligne('raison', c.barre.raison, 'alerte')]),
    ...(c.finDeTourArmee && !fenetreOuverte ? [ligne('finDeTourArmee', t('ecran.finDeTourArmee'), 'alerte')] : []),
    ...(c.fin && !fenetreOuverte ? [ligne('fin', t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }), TON_DE_LA_FIN[c.fin])] : []),
  ];
}

/** Le bouton d'un geste de la fiche : il montre `fiche` (`null` : la ferme), pressé quand il la montre déjà. */
const boutonDeFiche = (id: string, libelle: string, fiche: FicheOuverte | null, presse: boolean): Bouton => ({
  type: 'bouton', id, libelle, jeu: { fiche }, presse, focus: false, detail: null, touche: null, refus: null,
});

/** Les gestes de la fenêtre `gestes` qu'une carte porte : en route (`Projection.voyage`), chaque bouton qui désigne un héros du
 *  groupe, sur la carte de ce héros ; `restants` : les autres. */
function gestesDesCartes(etat: Jeu, p: Projection, gestes: (Bouton | Choix | Formulaire)[]): { restants: (Bouton | Choix | Formulaire)[]; parHeros: Map<string, Bouton[]> } {
  const parHeros = new Map<string, Bouton[]>();
  if (!p.voyage) return { restants: gestes, parHeros };
  const groupe = new Set(etat.party.map((h) => h.id));
  const restants: (Bouton | Choix | Formulaire)[] = [];
  for (const g of gestes) {
    const h = g.type === 'bouton' && 'args' in g.jeu ? g.jeu.args.find((a): a is string => typeof a === 'string' && groupe.has(a)) : undefined;
    if (h && g.type === 'bouton') parHeros.set(h, [...(parHeros.get(h) ?? []), g]);
    else restants.push(g);
  }
  return { restants, parHeros };
}

/** Chaque héros du groupe en carte (`heros/`) : son portrait, son nom, sa carrière en ligne s'il en a une, ses Blessures
 *  en jauge, le bouton qui ouvre sa fiche, pressé quand elle est ouverte, qui la ferme alors, ses États en puces, puis
 *  ce que la fenêtre dit de lui (`surLesCartes`) et les gestes qui le désignent (`gestesDesCartes`), `gestes` ; en `alerte` quand l'un d'eux a le
 *  focus : c'est à lui d'agir ; tant qu'aucune partie n'est en cours (`partieEnCours`), le bouton qui le renvoie,
 *  refusé par `refusDeRenvoyer`. */
function herosDuGroupe(etat: Jeu, ouverte: FicheOuverte | null, gestes: Map<string, Bouton[]>, parHeros: Map<string, Element[]>): Entite[] {
  return etat.party.map((h): Entite => {
    const f = garanti(enTeteDuPorteur(etat, h.id), h.id, 'héros du groupe');
    const presse = ouverte?.porteur === h.id;
    return {
      type: 'entite', id: `heros/${h.id}`, ton: (gestes.get(h.id) ?? []).some((g) => g.focus) ? 'alerte' : 'neutre', nom: f.nom,
      elements: [
        { type: 'portrait', id: 'portrait', combattant: h.id },
        ...(f.carriere === null ? [] : [ligne('carriere', f.carriere.libelle)]),
        jauge('blessures', t('ecran.jauge.blessures'), f.blessures),
        boutonDeFiche(`fiche/${h.id}`, t('ecran.fiche.ouvrir'), presse ? null : { porteur: h.id }, presse),
        ...etatsEnPuces(f.etats),
        ...(parHeros.get(h.id) ?? []),
        ...(gestes.get(h.id) ?? []),
        ...(partieEnCours(etat) ? [] : [{ type: 'bouton', id: `renvoyer/${h.id}`, libelle: t('ecran.groupe.renvoyer'), jeu: intentionDeRenvoi(h.id), presse: false, focus: false, detail: null, touche: null, refus: refusDeRenvoyer(etat, h.id) } satisfies Bouton]),
      ],
    };
  });
}

/** Le geste qui ouvre le Compendium sur l'entrée que désigne le terme `r` de la fiche (`{ compendium }`, le renvoi
 *  suivi), `null` sans entrée au Codex. */
const renvoiDe = (r: Renvoyable): JeuDeLHote | null => (r.renvoi ? { compendium: { geste: 'suivre', ...r.renvoi } } : null);

/** La puce `p` d'un terme `r` de la fiche, pressée : elle ouvre le Compendium sur l'entrée qu'il désigne (`renvoiDe`). */
const terme = (p: Puce, r: Renvoyable): Puce => ({ ...p, jeu: renvoiDe(r) });

/** Le bouton qui ouvre le Compendium sur l'entrée que désigne `r`, s'il en désigne une : celui d'une entité (une arme,
 *  une possession), qui la nomme déjà. */
const boutonDuRenvoi = (r: Renvoyable): Bouton[] => {
  const jeu = renvoiDe(r);
  return jeu ? [{ type: 'bouton', id: 'renvoi', libelle: t('ecran.fiche.compendium'), jeu, presse: false, focus: false, detail: null, touche: null, refus: null }] : [];
};

/** Un nombre d'exemplaires, dit quand il y en a plusieurs. */
const nombre = (n: number): string | null => (n > 1 ? t('ecran.fiche.nombre', { nombre: n }) : null);

/** Chaque État en puce, en `alerte`, qui ouvre le Compendium sur lui (`terme`). */
const etatsEnPuces = (etats: FicheDuPorteur['etats']): Puce[] => etats.map((e) => {
  const libelle = conditionLabel(e.id);
  return terme(puce(`etat/${e.id}`, libelle, String(e.valeur), null, 'alerte'), { libelle, renvoi: cibleDuCodex('etats', e.id) });
});

/** Le porteur de la fiche, la tête de son statbloc : son nom ; son espèce et sa carrière, chacune en puce qui ouvre le
 *  Compendium sur elle (`terme`) ; ses Blessures en jauge ;
 *  ses Points de Destin, de Chance, de Résilience et de Détermination, s'il en a ; sa bourse, s'il est un héros du groupe ; chacun de ses États en puce ;
 *  le bouton qui ouvre le Compendium sur la créature du bestiaire qu'il désigne. */
function porteurDeLaFiche(etat: Jeu, f: FicheDuPorteur): Entite {
  const points = ([['destin', t('ecran.destin'), f.destin], ['chance', t('ecran.fiche.chance'), f.chance], ['resilience', t('ecran.fiche.resilience'), f.resilience], ['determination', t('ecran.fiche.determination'), f.determination]] as const)
    .flatMap(([id, libelle, valeur]) => (valeur === null ? [] : [puce(id, libelle, String(valeur))]));
  return {
    type: 'entite', id: f.id, ton: 'neutre', nom: f.nom,
    elements: [
      ...(f.espece === null ? [] : [terme(puce('espece', f.espece.libelle, null), f.espece)]),
      ...(f.carriere === null ? [] : [terme(puce('carriere', f.carriere.libelle, null), f.carriere)]),
      jauge('blessures', t('ecran.jauge.blessures'), f.blessures),
      ...points,
      ...(etat.party.some((h) => h.id === f.id) ? [puce('bourse', t('ecran.bourse'), formatMoney(f.bourse))] : []),
      ...etatsEnPuces(f.etats),
      ...(f.profil === null ? [] : boutonDuRenvoi(f.profil)),
    ],
  };
}

/** La colonne `id` du profil, d'abréviation `abrege`, de valeur `valeur`, de nom `nom` au détail : elle ouvre le
 *  Compendium sur sa règle, l'entrée `regle` des Caractéristiques (`terme`). */
const colonne = (id: string, abrege: string, valeur: number, nom: string, regle: string): Puce =>
  terme(puce(id, abrege, String(valeur), nom), { libelle: nom, renvoi: cibleDuCodex('characteristics', regle) });

/** Le profil du statbloc de `f`, une puce par colonne, son nom au détail : le Mouvement, chaque Caractéristique par
 *  son abréviation, les Blessures à leur maximum. */
const profilDeLaFiche = (f: FicheDuPorteur): Puce[] => [
  colonne('profil/m', t('ecran.statbloc.m'), f.mouvement, t('ecran.jauge.mouvement'), 'mouvement'),
  ...f.caracteristiques.map((c) => colonne(`carac/${c.cle}`, c.abrege, c.valeur, c.libelle, c.cle)),
  colonne('profil/b', t('ecran.statbloc.b'), f.blessures[1], t('ecran.jauge.blessures'), 'blessure'),
];


/** Les sections du statbloc, dans l'ordre où il les montre (l'Atelier des PNJ, #3678), et la clé du catalogue de
 *  leur bandeau. */
const SECTIONS_DU_STATBLOC = {
  attaques: 'ecran.statbloc.attaques',
  armure: 'ecran.statbloc.armure',
  traits: 'ecran.statbloc.traits',
  mutations: 'ecran.statbloc.mutations',
  competences: 'ecran.statbloc.competences',
  talents: 'ecran.statbloc.talents',
  sorts: 'ecran.statbloc.sorts',
  prieres: 'ecran.statbloc.prieres',
  possessions: 'ecran.statbloc.possessions',
} as const;

/** Une entrée nommée du profil en puce (`terme`), le premier paragraphe de sa description au détail. */
const entrees = (id: string, liste: readonly EntreeDeLaFiche[]): Puce[] => liste.map((x, i) => terme(puce(`${id}/${i}`, x.libelle, null, resume(x.desc)), x));

/** Chaque section du statbloc de `f`, ses termes en éléments, chacun qui désigne une entrée du Codex pressé qui ouvre le
 *  Compendium sur elle (`terme`, `boutonDuRenvoi`) : chaque arme en entité, la valeur de son Test, ses Dégâts et son
 *  Allonge ou sa Portée, ses Atouts et Défauts, chacun en puce, et le bouton de l'arme ; les Points d'Armure de chaque localisation qui en
 *  porte ; ses Traits et ses Mutations ; ses Compétences, la valeur de leur Test, leur Caractéristique et leurs
 *  Augmentations au détail, par nom ; ses Talents et leur niveau ; ses sorts ; ses prières ; chacune de ses
 *  possessions en bouton qui la nomme, les équipées d'abord : il la choisit (`ouverte.objet`) ; la choisie, pressée,
 *  se laisse ; puis ses mentions, une puce par nature. Le premier paragraphe d'une description au détail. */
function sectionsDeLaFiche(f: FicheDuPorteur, ouverte: FicheOuverte): Record<keyof typeof SECTIONS_DU_STATBLOC, (Puce | Bouton | Entite)[]> {
  const carac = new Map(f.caracteristiques.map((c) => [c.cle, c]));
  return {
    attaques: f.armes.map((a, i) => ({
      type: 'entite', id: `arme/${i}`, ton: 'neutre', nom: a.libelle,
      elements: [
        puce('test', t('ecran.statbloc.test'), String(a.valeur)),
        ...weaponStatParts(a.profil).map((x, j) => puce(`stat/${j}`, x, null)),
        ...a.qualites.map((x, j) => terme(puce(`qualite/${j}`, x.libelle, null), x)),
        ...boutonDuRenvoi(a),
      ],
    })),
    armure: f.armure.map((a, i) => puce(`armure/${i}`, a.localisation.nom, String(a.pa))),
    traits: entrees('trait', f.traits),
    mutations: entrees('mutation', f.mutations),
    competences: f.competences
      .map((c, i) => {
        const k = carac.get(c.caracteristique)!;
        return terme(puce(`competence/${i}`, c.libelle, String(c.valeur), t('ecran.fiche.competence', { carac: k.abrege, base: k.valeur, avances: c.avances })), c);
      })
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
    talents: f.talents.map((x, i) => terme(puce(`talent/${i}`, x.libelle, nombre(x.fois), resume(x.desc)), x)),
    sorts: entrees('sort', f.sorts),
    prieres: entrees('priere', f.prieres),
    possessions: [
      ...[...f.possessions]
        .sort((a, b) => Number(b.equipee) - Number(a.equipee))
        .map((p) => {
          const choisie = ouverte.objet === p.uid;
          const libelle = p.nombre > 1 ? t('ecran.fiche.possession', { libelle: p.libelle, nombre: p.nombre }) : p.libelle;
          return boutonDeFiche(`possession/${p.uid}`, libelle, { porteur: f.id, ...(choisie ? {} : { objet: p.uid }) }, choisie);
        }),
      ...f.mentions.map((m) => puce(`mention/${m.nature}`, m.titre, m.mentions.map((x) => (x.nombre > 1 ? t('ecran.fiche.possession', { libelle: x.libelle, nombre: x.nombre }) : x.libelle)).join(', '))),
    ],
  };
}

/** Un geste du noyau (`GesteDuNoyau`) en bouton, pressé quand il dit l'état courant, refusé avec sa raison. */
const boutonDeGeste = (id: string, libelle: string, g: GesteDuNoyau, refus: string | null, presse = false): Bouton => ({
  type: 'bouton', id, libelle, jeu: { type: g.verbe, args: g.args }, presse, focus: false, detail: null, touche: null, refus,
});

/** Un geste du noyau nommé en bouton (`boutonDeGeste`). */
const boutonDuNoyau = (id: string, g: GesteFermable & { libelle: string }): Bouton => boutonDeGeste(id, g.libelle, g.geste, g.refus);

/** Un geste à choix sur un objet : une liste dont chaque choix joue son geste, refusé avec elle. */
const listeDObjet = (id: string, libelle: string, g: GesteAChoix<unknown>): Choix => ({
  type: 'liste', id, ton: 'neutre', libelle, focus: false, refus: g.refus,
  valeurs: g.choix.map((c, i) => boutonDeGeste(`${id}/${i}`, c.libelle, c.geste, g.refus)),
});

/** La possession choisie de la fiche `f` (`FicheOuverte.objet`) en entité : son nom, au ton `reussite` quand elle est
 *  équipée ; son nombre, son argent et le contenant où elle est rangée en puces ; le bouton qui ouvre le Compendium sur
 *  l'objet du catalogue qu'elle instancie ; puis chacun de ses gestes
 *  (`gestesDeLObjet`), refusé avec sa raison : la porter, la tenir dans une main, l'utiliser, la ranger dans un
 *  contenant ou l'en sortir, la donner à un porteur à ses côtés, la poser au sol, l'évaluer, la détecter. */
function objetDeLaFiche(etat: Jeu, f: FicheDuPorteur, ouverte: FicheOuverte): Entite[] {
  const p = f.possessions.find((x) => x.uid === ouverte.objet);
  const g = p && gestesDeLObjet(etat, f.id, p.uid);
  if (!p || !g) return [];
  const simple = (id: 'porter' | 'utiliser' | 'sortir' | 'poser' | 'evaluer' | 'detecter', presse = false): Bouton | null => {
    const x = g[id];
    return x && boutonDeGeste(id, t(`ecran.objet.${id}`), x.geste, x.refus, presse);
  };
  const elements: (Element | null)[] = [
    p.nombre > 1 ? puce('nombre', t('ecran.fiche.nombre', { nombre: p.nombre }), null) : null,
    p.argent === null ? null : puce('argent', formatMoney(p.argent), null),
    p.contenant === null ? null : puce('contenant', t('ecran.objet.contenant', { contenant: p.contenant.nom }), null),
    ...boutonDuRenvoi(p),
    simple('porter', g.porter?.porte),
    ...(g.mains ? (['main', 'secondaire'] as const).map((m) => boutonDeGeste(m, t(`ecran.objet.${m}`), g.mains![m].geste, g.mains![m].refus, g.mains![m].tenue)) : []),
    simple('utiliser'),
    g.ranger && listeDObjet('ranger', t('ecran.objet.ranger'), g.ranger),
    simple('sortir'),
    g.donner && listeDObjet('donner', t('ecran.objet.donner'), g.donner),
    simple('poser'),
    simple('evaluer'),
    simple('detecter'),
  ];
  return [{ type: 'entite', id: p.uid, ton: p.equipee ? 'reussite' : 'neutre', nom: p.libelle, elements: elements.filter((e): e is Element => e !== null) }];
}

/** Les zones de la fiche `ouverte`, le statbloc de son porteur : sa tête, sa fermeture, son profil, chaque section
 *  non vide en entité (son bandeau pour nom), la source de son profil, la possession choisie ; vides sans fiche, sans
 *  son porteur, ou son porteur hors de vue (`porteurEnVue`). */
function zonesDeLaFiche(etat: Jeu, ouverte: FicheOuverte | null): Pick<ZonesDeLEcran, 'fiche.porteur' | 'fiche.gestes' | 'fiche.profil' | 'fiche.sections' | 'fiche.source' | 'fiche.objet'> {
  const f = ouverte && porteurEnVue(etat, ouverte.porteur) && ficheDuPorteur(etat, ouverte.porteur);
  if (!ouverte || !f) return { 'fiche.porteur': [], 'fiche.gestes': [], 'fiche.profil': [], 'fiche.sections': [], 'fiche.source': [], 'fiche.objet': [] };
  const sections = sectionsDeLaFiche(f, ouverte);
  return {
    'fiche.porteur': [porteurDeLaFiche(etat, f)],
    'fiche.gestes': [boutonDeFiche('fermer', t('ecran.fiche.fermer'), null, false)],
    'fiche.profil': profilDeLaFiche(f),
    'fiche.sections': (Object.keys(SECTIONS_DU_STATBLOC) as (keyof typeof SECTIONS_DU_STATBLOC)[]).flatMap((k): Entite[] =>
      sections[k].length ? [{ type: 'entite', id: `section/${k}`, ton: 'neutre', nom: t(SECTIONS_DU_STATBLOC[k]), elements: sections[k] }] : []),
    'fiche.source': f.source === null ? [] : [terme(puce('source', t('ecran.statbloc.source', { source: f.source.libelle }), null), f.source)],
    'fiche.objet': objetDeLaFiche(etat, f, ouverte),
  };
}

/** Les zones de l'écran de la partie `etat`, de sa projection `p`, de la fenêtre qui tient la main `fenetre`, du
 *  panneau que l'hôte tient ouvert `panneau` : la fiche ou la création (`zonesDeLaCreation`), du roster `roster` que
 *  l'hôte montre au groupe à composer et des campagnes `campagnes` que le jeu remet (`zonesDeLaPartie`). */
export function zonesDeLEcran(etat: Jeu, p: Projection, fenetre: FenetreADessiner | null, panneau: PanneauDeLHote, roster: RosterMontre, campagnes: ContenuDUnJeu['campagnes']): ZonesDeLEcran {
  const fiche = panneau && 'fiche' in panneau ? panneau.fiche : null;
  const c = p.combat;
  const clesDesGestes = new Set(p.fenetre?.gestes.map(cleDuGeste));
  const gestesDeLaFenetre = fenetre?.gestes.filter((g) => clesDesGestes.has(g.cle)) ?? [];
  const { restants: gestes, parHeros: gestesSurLesCartes } = gestesDesCartes(etat, p, elementsDesGestes(gestesDeLaFenetre));
  const { restants: jetsRestants, parHeros: jetsSurLesCartes } = surLesCartes(etat, p);
  const corps = fenetre ? corpsDeLaFenetre(etat, p, jetsRestants) : [];
  const portes = choixPortes(corps);
  const reglages = new Set(gestesDeLaFenetre.filter((g) => g.reglage).map((g) => g.cle));
  const proprietaire = fenetreDuJeu(etat)?.proprietaire;
  const ditParSonJet = corps.some((e) => e.type === 'jet' && e.combattant !== null && e.combattant === proprietaire);
  const etape = fenetre ? [fenetre.etape === fenetre.titre ? null : fenetre.etape, fenetre.proprietaire.genre === 'porteur' && !ditParSonJet ? fenetre.proprietaire.nom : null].filter((x): x is string => x !== null) : [];
  return {
    'fenetre.titre': fenetre ? [ligne('titre', fenetre.titre)] : [],
    'fenetre.etape': etape.length ? [ligne('etape', etape.join(t('ecran.separateur')))] : [],
    'fenetre.corps': corps,
    'fenetre.reglages': gestes.filter((g) => reglages.has(g.id) && !portes.has(g.id)),
    'fenetre.gestes': gestes.filter((g) => !reglages.has(g.id) && !portes.has(g.id)),
    'combat.tour': c ? [ligne('tour', c.tour === null ? t('ecran.round', { round: c.round }) : t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }))] : [],
    'combat.ordre': c ? ordreDuTour(etat, c, fiche) : [],
    'combat.actif': c?.actif && !c.fin && !fenetreDuJeu(etat)?.etape?.jet ? [actifDuCombat(c.actif)] : [],
    'combat.avis': c ? avisDuCombat(c, fenetre !== null) : [],
    'combat.apercu': c ? [apercuDe(etat, c)].flatMap((a) => (a === null ? [] : [ligne('apercu', a)])) : [],
    'combat.offres': c ? offresDuCombat(c) : [],
    'combat.rapides': c ? rapidesDuCombat(etat) : [],
    'exploration.gestes': (fenetre ? [] : p.exploration?.gestes.liste ?? []).map((g, i): Bouton => ({
      type: 'bouton', id: `exploration/${i}`, libelle: g.libelle, jeu: { suite: g.gestes.map((x) => ({ type: x.verbe, args: x.args })) }, presse: false, focus: false, detail: null, touche: null, refus: g.refus ?? null,
    })),
    ...zonesDuDialogue(p, fenetre !== null),
    'journal.titre': c ? [{ type: 'entite', id: 'journal', ton: 'neutre', nom: t('ecran.journal'), elements: [{ type: 'icone', id: 'icone', icone: 'navigation/carnet' }] }] : [],
    'groupe.heros': c ? [] : herosDuGroupe(etat, fiche, gestesSurLesCartes, jetsSurLesCartes),
    ...zonesDeLaFiche(etat, fiche),
    ...zonesDeLaCreation(etat, panneau && 'creation' in panneau ? panneau.creation : null),
    ...zonesDeLaPartie(etat, roster, campagnes),
  };
}

/** Les zones de la conversation en cours (`Projection.conversation`), quand aucune fenêtre ne la suspend : son
 *  interlocuteur, sa réplique, et chaque réponse visible en bouton qui la choisit : son Test annoncé
 *  (`libelleDuTestAnnonce`), son libellé, puis son coût, refusée avec sa raison. */
function zonesDuDialogue(p: Projection, fenetreOuverte: boolean): Pick<ZonesDeLEcran, 'dialogue.orateur' | 'dialogue.replique' | 'dialogue.reponses'> {
  const v = fenetreOuverte ? null : p.conversation;
  return {
    'dialogue.orateur': v?.orateur ? [ligne('orateur', v.orateur.nom)] : [],
    'dialogue.replique': v?.replique ? [ligne('replique', v.replique)] : [],
    'dialogue.reponses': (v?.reponses ?? []).map((r): Bouton => ({
      type: 'bouton', id: `reponse/${r.id}`, libelle: [r.test && libelleDuTestAnnonce(r.test), r.label, r.cost && formatMoney(r.cost)].filter(Boolean).join(' '),
      jeu: { type: r.geste.verbe, args: r.geste.args }, presse: false, focus: false, detail: null, touche: null, refus: r.refus ?? null,
    })),
  };
}

/** Les zones qu'une suite remplit, chacune ajoutée à ce que l'écran montre déjà : les lignes du journal. */
export interface ZonesDeLaSuite {
  'journal.lignes': Ligne[];
}

/** Le ton d'un événement du journal de combat : le début d'un round en alerte ; un coup grave (Critique, mort) dit le
 *  camp qu'il frappe, un héros en échec, un adversaire en réussite. */
const tonDeLEvenement = (etat: Jeu, e: CombatEvent): Ton => {
  if (e.kind === 'round') return 'alerte';
  if (toneOf(e.kind) !== 'grave') return 'neutre';
  const frappe = e.targetId ?? e.actorId;
  return frappe && porteurParId(etat, frappe)?.kind === 'heros' ? 'echec' : 'reussite';
};

/** Les lignes que le journal ajoute, numérotées à la suite des `avant` lignes déjà écrites : une par événement, son
 *  ton dit ce qu'il pèse ; les sous-lignes d'un événement (`detail`) vont au détail de la ligne qui les précède dans
 *  l'appel, montré à la demande. Un événement sans texte n'en écrit aucune. Chaque jour de jeu s'ouvre sur sa date, en
 *  alerte, dès qu'une ligne s'écrit un autre jour que `veille` (le jour de la dernière ligne déjà écrite, `null` avant
 *  la première) ; `jour` est celui de la dernière ligne de l'appel. */
export function lignesDuJournal(etat: Jeu, avant: number, journal: readonly LigneDuJournal[], veille: number | null): { lignes: Ligne[]; jour: number | null } {
  let jour = veille;
  const lignes = journal.reduce<Ligne[]>((lignes, l, i) => {
    const texte = redigerLEntree(l.de === 'journal' ? l.entree : l.evenement.entree);
    if (!texte) return lignes;
    const precedente = lignes[lignes.length - 1] as Ligne | undefined;
    if (l.de === 'combat' && l.evenement.kind === 'detail' && precedente) {
      const sous = texte.replace(/^\s*↳\s*/, '');
      return [...lignes.slice(0, -1), { ...precedente, detail: precedente.detail === null ? sous : `${precedente.detail}\n${sous}` }];
    }
    const ce = dayIndex(l.heure);
    const date = ce === jour ? [] : [ligne(`journal/jour/${ce}`, formatJourImperial(l.heure), 'alerte')];
    jour = ce;
    const id = `journal/${avant + i}`;
    return [...lignes, ...date, l.de === 'journal' ? ligne(id, texte) : ligne(id, texte, tonDeLEvenement(etat, l.evenement))];
  }, []);
  return { lignes, jour };
}
