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
  ACTIONS, avecSigne, batailleEnVue, intentionDeRenvoi, partieEnCours, refusDeRenvoyer, fenetreDuJeu, carteEnVue, cleDuGeste, dayIndex, formatJourImperial, marchandEnVue, marcheEnVue, voyageEnVue, VERBE_DE_CHOIX, type AxeDuChoix, type FenetreAChoix, conditionLabel, conversationEnVue, difficultyText, documentEnVue, lieuEnVue, formatMoney, fenetreDAttaque, fenetreDIncantation, fenetreDeDefense, fenetreDuSoin, ficheDuPorteur, gestesDeLObjet, interludeEnVue, jetsEnVue, porteurParId, recitEnVue, reposEnVue, toneOf, nomEnVue, porteurEnVue,
  type CombatEvent, type Equipe, type EntreeDeLaFiche, type IdDeCouche, type LieuDuPlan, type PlanDeLaCarte, type FicheDuPorteur, type GesteAChoix, type GesteDuNoyau, type GesteFermable, type FenetreDAttaque, type FenetreDIncantation, type Jeu, type JetEnVue, type LigneDeJet, type LigneDuJournal, type ModLine, type RollBreakdown, type TrajetEnVue,
} from '../noyau/index';
import { pluriel, t } from '../i18n';
import { garanti } from '../lib/garanti';
import { ordreEnVue, type Projection } from './projection';
import { CHOIX_EN_BOUTONS, type FenetreADessiner } from './gestes';
import { zonesDeLaCreation, type ZonesDeLaCreation } from './creation';
import { zonesDeLaPartie, type ZonesDeLaPartie } from './groupe';
import type { RosterMontre } from './roster';
import { elementsDesGestes, ligne, resume, type Bouton, type Choix, type Element, type Entite, type FicheOuverte, type Formulaire, type Jet, type Ligne, type PanneauDeLHote, type Paysage, type Plan, type Puce, type Saisie, type Ton } from './elements';

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
 * fenêtre joue à l'Entrée : le geste `attendu` de sa politique s'il prend le focus, une rangée de choix n'en prenant
 * pas, à défaut le premier bouton) et `refus` (pourquoi il ne se joue pas, dit sous lui ; le geste désactivé) ; un
 * `choix` ou une `liste` porte son `refus` et chacune de ses valeurs en bouton, refusée avec lui ; un `formulaire`
 * porte son verbe, son `refus` et ses saisies dans l'ordre de ses paramètres (`fixe`, posée par la fenêtre,
 * `saisieChoix`, `saisieCoches` et la liste de ses valeurs cochées, `saisieNombre` et ses bornes, `saisieTexte`,
 * `saisieMultiligne` (un texte sur plusieurs lignes), `saisieJson`, `saisieObjet` et ses champs), dont Godot lit les
 * valeurs à l'instant où il se joue ; une saisie optionnelle laissée vide clôt les arguments, une saisie requise
 * laissée vide part `null`. Seuls les gestes `ouvert` de la fenêtre (`fenetreADessiner`, `src/hote/gestes.ts`) se
 * dessinent.
 */
export interface ZonesDeLEcran extends ZonesDeLaCreation, ZonesDeLaPartie {
  /** le titre de la fenêtre qui tient la main. */
  'fenetre.titre': Ligne[];
  /** l'étape de séquence et le nom de qui tient la main. */
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
   * chaque combattant dans l'ordre du tour en puce : ses Blessures, celui qui joue en `alerte`, un ennemi en `echec`.
   */
  'combat.ordre': Puce[];
  /**
   * l'actif en entité : ses Blessures et son Mouvement en jauges, son Avantage, son Action, chacun de ses États en
   * puce.
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
   * désarmée par son bouton, fermée refusée avec sa raison, rangée sous la part de l'économie du tour qu'elle prend, un
   * choix qui la nomme une fois, celles qui n'en prennent aucune sous le tour ; une offre par candidat, le sort, l'arme
   * ou l'attaque de trait, est un choix à elle sous sa part, en liste au-delà de sept candidats, chaque candidat un
   * bouton qui le nomme et joue le verbe de son offre, l'armé pressé.
   */
  'combat.offres': Choix[];
  /**
   * chaque geste d'exploration de la scène en bouton qui le nomme, sa suite de verbes en `jeu`, refusé avec sa raison,
   * dont l'offre de chaque entité à portée du groupe, « Gustav : Parler », dont celle du décor d'un objet posé au sol,
   * « Dague : Ramasser » (le meneur le reçoit), que le clic sur ce décor joue aussi ; aucun quand une fenêtre tient la
   * main ou pendant une conversation.
   */
  'exploration.gestes': Bouton[];
  /**
   * la conversation en cours, `conversationEnVue`, surface du noyau, quand aucune fenêtre ne la suspend : le nom de son
   * interlocuteur.
   */
  'dialogue.orateur': Ligne[];
  /** la réplique du nœud. */
  'dialogue.replique': Ligne[];
  /**
   * chaque réponse visible en bouton qui la choisit, ce qu'elle annonce (son Test, son coût) avant son libellé, refusée
   * avec sa raison.
   */
  'dialogue.reponses': Bouton[];
  /** le titre du journal. */
  'journal.titre': Ligne[];
  /** chaque héros du groupe en carte (`herosDuGroupe`) : ses Blessures, sa bourse, le bouton qui ouvre sa fiche,
   *  pressé quand elle est ouverte, qui la ferme alors, ses États, puis ce que la fenêtre dit de lui : le jet qu'il jette
   *  en route et les gestes qui le désignent, sa nuit à la halte ; avant le lancement, « Renvoyer », dont le `jeu` est
   *  l'intention du noyau qui le renvoie (`intentionDeRenvoi`), refusé avec sa raison (`refusDeRenvoyer`). */
  'groupe.heros': Entite[];
  /**
   * la fiche ouverte (`ficheDuPorteur`, surface du noyau), en statbloc : le combattant en entité : son espèce et sa
   * carrière, chacune en ligne, ses Blessures en jauge, ses Points de Destin, de Chance, de Résilience et de
   * Détermination quand il en a, chacun de ses États en puces.
   */
  'fiche.porteur': Entite[];
  /** « Fermer ». */
  'fiche.gestes': Bouton[];
  /**
   * une puce par colonne du profil : le Mouvement, chaque Caractéristique par son abréviation, les Blessures
   * maximales ; son nom au détail.
   */
  'fiche.profil': Puce[];
  /**
   * chaque section non vide en entité, dans l'ordre du statbloc, son nom au bandeau : Attaques, chaque arme en entité,
   * la valeur de son Test, ses Dégâts, son Allonge ou sa Portée, ses Atouts et Défauts, chacun en puce ; Armure, les PA
   * de chaque localisation couverte ; Traits et Mutations, chacun sa description au détail ; Compétences, la valeur de
   * chaque Test, sa Caractéristique et ses Augmentations au détail ; Talents et son niveau, Sorts, Prières, chacun sa
   * description au détail ; Possessions, chaque possession en bouton qui la nomme, son nombre quand il y en a
   * plusieurs, les équipées d'abord (une arme : tenue dans le set actif) ; il la choisit, `{ fiche }` portant son
   * `objet`, la choisie pressée la laisse ; puis une puce par nature de ses mentions (`mention/<nature>`), la nature
   * au libellé, ses mentions et leur nombre en valeur.
   */
  'fiche.sections': Entite[];
  /** le livre et la page du profil dont le combattant est l'instance. */
  'fiche.source': Ligne[];
  /**
   * la possession choisie en entité, au ton `reussite` quand elle est équipée : son nombre, son argent et son contenant
   * en puces, puis chacun de ses gestes, lus du noyau (`gestesDeLObjet`), en bouton ou en liste qui joue son verbe par
   * `jouer`, refusé avec la raison que le verbe applique, en combat celle de l'inventaire : la porter, pressé quand
   * elle l'est ; la tenir en main principale ou secondaire, pressé pour la main qui la tient, qu'il vide ; l'utiliser ;
   * la ranger dans chaque contenant où elle tient, ou l'en sortir ; la donner à chaque porteur à ses côtés ; la poser
   * au sol, à la case du groupe, avec le contenu de son contenant (`poserLObjet`) ; l'évaluer, la détecter.
   */
  'fiche.objet': Entite[];
}

type Combat = NonNullable<Projection['combat']>;

const puce = (id: string, libelle: string, valeur: string | null, detail: string | null = null, ton: Ton = 'neutre'): Puce => ({ type: 'puce', id, ton, libelle, valeur, detail });

/** Les modificateurs `mods` d'un jet, chacun une puce. */
const puces = (id: string, mods: readonly ModLine[] | undefined): Puce[] =>
  (mods ?? []).map((m, i) => puce(`${id}/m${i}`, m.label, avecSigne(m.value)));

/** Ce dont une cible est faite, une ligne par part : sa base, sa Difficulté et les paliers qui la composent
 *  (LDB 14 l.91-96), puis son écrêtage MESURÉ (`clamped`, `engine/tests.ts` : négatif au plafond, positif au plancher). */
interface CompositionDeLaCible { base: number | null; difficulte: string | null; paliers?: readonly ModLine[]; target: number | null; clamped?: number }

/** Le détail d'un jet : la composition de sa cible, puis `enPlus` ; `null` sans rien à dire. */
function detailDuJet(c: CompositionDeLaCible, enPlus: readonly string[] = []): string | null {
  const lignes = [
    ...(c.base === null ? [] : [t('ecran.jet.base', { base: c.base })]),
    ...(c.difficulte === null ? [] : [c.difficulte]),
    ...(c.paliers ?? []).map((m) => t('ecran.jet.part', { libelle: m.label, valeur: avecSigne(m.value) })),
    ...(c.clamped && c.target !== null ? [t(c.clamped < 0 ? 'ecran.jet.plafond' : 'ecran.jet.plancher', { cible: c.target, ecart: avecSigne(c.clamped) })] : []),
    ...enPlus,
  ];
  return lignes.length ? lignes.join('\n') : null;
}

/** Un jet dont seules les parties de `parties` sont dites. */
const jet = (id: string, parties: Partial<Omit<Jet, 'type' | 'id'>> & { libelle: string }): Jet => ({
  type: 'jet', id, ton: 'neutre', qui: null, cible: null, resultat: null, dr: null, verdict: null, modificateurs: [], detail: null, ...parties,
});

const verdictDuTest = (reussi: boolean) => ({ verdict: t(reussi ? 'ecran.jet.reussite' : 'ecran.jet.echec'), ton: reussi ? 'reussite' as const : 'echec' as const });

/** Un jet tombé : le dé contre la cible, le DR et le verdict ; masqué quand la ligne l'est (`RollBreakdown.mask`), son
 *  seuil pur dit sans DR (`seuil`). `enPlus` : ce que son détail ajoute à la composition de sa cible. */
function jetTombe(id: string, d: RollBreakdown, qui: string | null, enPlus: readonly string[] = []): Jet {
  if (d.mask === 'roll') return jet(id, { qui, libelle: d.label, resultat: t('ecran.jet.cache') });
  const verdict = d.seuil
    ? { verdict: d.success ? d.seuil.reussite : d.seuil.echec, ton: d.success ? 'reussite' as const : 'echec' as const }
    : verdictDuTest(d.success);
  const cache = d.mask === 'value';
  return jet(id, {
    qui, libelle: d.label, resultat: String(d.roll), ...verdict,
    cible: cache ? null : t('ecran.jet.cible', { cible: d.target }),
    dr: cache || d.seuil ? null : t('ecran.jet.dr', { dr: avecSigne(d.sl) }),
    modificateurs: cache ? [] : puces(id, d.mods),
    detail: cache ? null : detailDuJet({
      base: d.base, difficulte: d.difficulty ? difficultyText(d.difficulty, d.difficultyCombined) : null, paliers: d.difficultyParts, target: d.target, clamped: d.clamped,
    }, enPlus),
  });
}

/** Le DR net d'un Test opposé tranché. */
const drNet = (id: string, dr: number): Ligne => ligne(id, t('ecran.drNet', { dr: avecSigne(dr) }));

/** Une posture de tir, en lecture seule (son contrôle vit à la console) : son état, ce qu'elle change à la demande. */
const posture = (id: string, p: FenetreDAttaque['tirDansLeTas']): Puce | null =>
  p && puce(id, p.etat, null, p.note, p.sansObjet ? 'alerte' : 'neutre');

/** Le corps de la fenêtre d'attaque : la cible, l'arme et ses Dégâts, les postures de tir, la ligne de l'attaquant et
 *  celle de la défense (à jeter ou tombées ; l'issue que l'inversion du dé donnerait au détail de l'attaquant), le DR
 *  net, l'issue ou l'attente d'une Défense. */
function corpsDeLAttaque(etat: Jeu, a: FenetreDAttaque): Element[] {
  const attaquant = nomEnVue(etat, a.attaquantId);
  const cible = nomEnVue(etat, a.cibleId);
  const inversion = a.influences.inversion?.apercu ?? null;
  const elements: (Element | null)[] = [
    ligne('cible', t('ecran.attaque.cible', { cible: cible ?? '' })),
    ligne('arme', a.arme),
    a.degats === null ? null : puce('degats', t('ecran.degats'), avecSigne(a.degats)),
    posture('tirDansLeTas', a.tirDansLeTas),
    posture('tirImmobile', a.tirImmobile),
    a.bloque === null ? null : ligne('bloque', a.bloque, 'alerte'),
    a.jet === null ? null : 'd' in a.jet
      ? jetTombe('jet', a.jet.d, attaquant, inversion ? [t('ecran.attaque.inversion', { d100: inversion.roll, dr: avecSigne(inversion.sl), verdict: verdictDuTest(inversion.success).verdict })] : [])
      : jet('jet', {
          qui: attaquant, libelle: a.jet.pending.label, cible: t('ecran.jet.cible', { cible: a.jet.pending.target }), modificateurs: puces('jet', a.jet.pending.mods),
          detail: detailDuJet({ ...a.jet.pending, paliers: a.jet.pending.difficultyParts }),
        }),
    a.defense === null ? null : 'd' in a.defense
      ? jetTombe('defense', a.defense.d, cible)
      : jet('defense', { qui: cible, libelle: a.defense.pending.label, modificateurs: puces('defense', a.defense.pending.mods), detail: detailDuJet({ base: null, difficulte: a.defense.pending.difficulte, target: null }) }),
    a.opposition ? drNet('drNet', a.opposition.drNet) : null,
    a.issue ? ligne('issue', a.issue.ligne) : null,
    a.attente === null ? null : ligne('attente', a.attente),
  ];
  return elements.filter((e): e is Element => e !== null);
}

/** Le corps de la fenêtre d'incantation (`fenetreDIncantation`) : le Sort et sa cible, son NI et sa Zone d'Effet, la
 *  ligne du lanceur (à jeter ou tombée), les pas de Surincantation qui restent, les cibles supplémentaires à désigner
 *  sur la carte, l'issue. */
function corpsDeLIncantation(etat: Jeu, f: FenetreDIncantation): Element[] {
  const lanceur = garanti(nomEnVue(etat, f.lanceurId), f.lanceurId, 'lanceur de l’incantation');
  const cible = f.surSoi ? t('ecran.incantation.surSoi') : garanti(nomEnVue(etat, f.cibleId), f.cibleId, 'cible de l’incantation');
  const l = f.ligne;
  const s = f.surincantation;
  const elements: (Element | null)[] = [
    ligne('sort', t('ecran.incantation.sort', { sort: f.sort, cible })),
    f.zone ? puce('zone', t('ecran.incantation.zone'), t('ecran.incantation.cote', { cote: f.zone.cote }), null, f.zone.aPoser ? 'alerte' : 'neutre') : null,
    jet('jet', {
      qui: lanceur, libelle: l.label, cible: t('ecran.jet.cible', { cible: l.jet?.target ?? l.target }), modificateurs: puces('jet', l.mods),
      ...(l.jet ? { resultat: String(l.jet.roll), dr: t('ecran.jet.dr', { dr: avecSigne(l.jet.sl) }), ...verdictDuTest(l.jet.success) } : {}),
    }),
    s ? puce('surincantation', t('ecran.incantation.surincantation'), t('ecran.incantation.pas', { restant: s.restant, budget: s.budget })) : null,
    s?.cibles?.surLaCarte ? ligne('cibles', t('ecran.incantation.cibles', { designees: s.cibles.designees, capacite: s.cibles.capacite })) : null,
    f.issue ? ligne('issue', f.issue) : null,
  ];
  return elements.filter((e): e is Element => e !== null);
}

/** Une ligne de jet d'une fenêtre (`jetsEnVue`) : qui jette, le Test, la table ou le dé, et ce qui est tombé : le dé
 *  et son verdict, ou ce que la table ou le dé lit. */
function jetDeLaLigne(etat: Jeu, id: string, l: LigneDeJet): Jet {
  const qui = l.qui === null ? null : nomEnVue(etat, l.qui);
  switch (l.genre) {
    case 'test': return jet(id, {
      qui, libelle: l.test, cible: l.cible === null ? null : t('ecran.jet.cible', { cible: l.cible }),
      ...(l.jet ? { resultat: String(l.jet.d100), dr: t('ecran.jet.dr', { dr: avecSigne(l.jet.dr) }), ...verdictDuTest(l.jet.reussi) } : {}),
    });
    case 'table': return jet(id, { qui, libelle: l.table, ...(l.jet ? { resultat: String(l.jet.effectif), verdict: l.jet.ligne } : {}) });
    case 'de': return jet(id, { qui, libelle: l.de, ...(l.jet ? { resultat: String(l.jet.total), verdict: l.jet.lecture } : {}) });
  }
}

const elementsDuJet = (etat: Jeu, j: JetEnVue, i: number): Element[] => [
  ...j.lignes.map((l, k) => jetDeLaLigne(etat, `jets/${i}/${k}`, l)),
  ...(j.oppose ? [drNet(`jets/${i}/drNet`, j.oppose.drNet)] : []),
];

/** Ce que la fenêtre dit d'un héros du groupe, porté par sa carte (`herosDuGroupe`) plutôt que par son corps : en
 *  route (`voyageEnVue`), chaque jet qu'il jette, sans redire son nom ; à la halte (`reposEnVue`), son couchage et sa
 *  pitance, en listes comme tout choix d'une carte, et ce qui l'attend cette nuit en puces d'alerte. `restants` : les
 *  jets de la fenêtre (`jetsEnVue`) qu'aucune carte ne porte. */
function surLesCartes(etat: Jeu): { restants: Element[]; parHeros: Map<string, Element[]> } {
  const vues = jetsEnVue(etat);
  const jets = vues.flatMap((j, i) => elementsDuJet(etat, j, i));
  const parHeros = new Map<string, Element[]>();
  const poser = (h: string, e: Element) => parHeros.set(h, [...(parHeros.get(h) ?? []), e]);
  for (const d of reposEnVue(etat)?.dormeurs ?? []) {
    [choixDuDormeur('couchage', d.couchage), choixDuDormeur('pitance', d.pitance)].forEach((c) => poser(d.id, { ...c, type: 'liste' }));
    d.alertes.forEach((a, i) => poser(d.id, puce(`alerte/${i}`, a, null, null, 'alerte')));
  }
  if (!voyageEnVue(etat)) return { restants: jets, parHeros };
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
function corpsDeLaFenetre(etat: Jeu): Element[] {
  const { cle } = garanti(fenetreDuJeu(etat), 'fenetre', 'fenêtre qui tient la main');
  const pc = etat.pendingCascade;
  const jetDeLEtape = pc?.participants[pc.cursor]?.jet;
  const attaque = jetDeLEtape === 'attaque' ? fenetreDAttaque(etat) : null;
  if (attaque) return corpsDeLAttaque(etat, attaque);
  const incantation = jetDeLEtape === 'incantation' ? fenetreDIncantation(etat) : null;
  if (incantation) return corpsDeLIncantation(etat, incantation);
  const defense = jetDeLEtape === 'defense' ? fenetreDeDefense(etat) : null;
  const nom = (id: string) => garanti(nomEnVue(etat, id), id, 'combattant de la Défense');
  return [
    ...(defense ? [ligne('defense/qui', t('ecran.defense.qui', { attaquant: nom(defense.attaquantId), defenseur: nom(defense.defenseurId), arme: defense.arme }))] : []),
    ...(defense?.jet ? [jet('defense/jet', {
      qui: nom(defense.defenseurId), libelle: defense.test, cible: t('ecran.jet.cible', { cible: defense.jet.target }), modificateurs: puces('defense/jet', defense.jet.mods),
      detail: detailDuJet({ ...defense.jet, paliers: defense.jet.difficultyParts }),
    })] : []),
    ...patientDuSoin(etat),
    ...trajetsDeLaCarte(etat),
    ...ecranDuLieu(etat),
    ...echoppe(etat),
    ...marche(etat),
    ...voyage(etat),
    ...recitDuVoyage(etat),
    ...herosDeLInterlude(etat),
    ...champDeBataille(etat),
    ...nuitDuRepos(etat, cle),
    ...surLesCartes(etat).restants,
    ...(defense?.issue ? [ligne('defense/issue', defense.issue.ligne)] : []),
    ...revelationDeLEtape(etat),
    ...issueDeLEtape(etat),
    ...destinEnJeu(etat, cle),
    ...victoire(etat, cle),
    ...texteDuDocument(etat),
  ];
}

/** Les modes de voyage d'un trajet en choix, titré de sa longueur : chacun avec ses jours de route, fermé avec sa
 *  raison. Le même élément part du lieu (`ecranDuLieu`) et de la carte (`trajetsDeLaCarte`). */
const departDuTrajet = (tr: TrajetEnVue): Choix => ({
  type: 'choix', id: tr.route, ton: 'neutre', libelle: tr.distance, focus: false, refus: null,
  valeurs: tr.modes.map((m) => boutonDeGeste(m.mode, m.jours === null ? m.libelle : t('ecran.carte.mode', { mode: m.libelle, jours: m.jours }), m.geste, m.refus)),
});

/** Le plan de la carte en élément : chaque lieu à sa place, celui du groupe en `alerte`, chaque route qui part d'ici
 *  en `reussite` ; sous chaque lieu, `sous`. */
const planDeLaCarte = (id: string, plan: PlanDeLaCarte, sous: (l: LieuDuPlan) => Element[]): Plan => ({
  type: 'plan', id,
  points: plan.lieux.map((l) => ({ type: 'point', id: l.id, nom: l.nom, x: l.x, y: l.y, ton: l.ici ? 'alerte' : 'neutre', elements: sous(l) })),
  traits: plan.routes.map((r) => ({ id: r.route, de: r.de, vers: r.vers, ton: r.depuisIci ? 'reussite' : 'neutre' })),
});

/** La carte du monde ouverte (`carteEnVue`) : son plan (`planDeLaCarte`), sous chaque lieu le départ de chaque trajet
 *  qui y mène (`departDuTrajet`) ; puis la reprise d'un voyage interrompu. */
function trajetsDeLaCarte(etat: Jeu): Element[] {
  const c = carteEnVue(etat);
  if (!c) return [];
  return [
    planDeLaCarte('carte/plan', c.plan, (l) => l.trajets.map(departDuTrajet)),
    ...(c.reprendre ? [boutonDeGeste('carte/reprendre', t('ecran.carte.reprendre'), c.reprendre, null)] : []),
  ];
}

/** L'écran du lieu (`lieuEnVue`), dont le nom est le titre de la fenêtre : sa description (`lieu/description`),
 *  quand il en a une ; le plan de la carte vu d'ici (`lieu/plan`, `planDeLaCarte`, rien sous ses lieux) et le bouton
 *  qui ouvre la carte (`lieu/carte`) ; sous leur titre (`lieu/services`), chacun de ses services en entité, son fond
 *  (`fond`), son icône (`icone`), le boniment de son hôte (`accueil`) et ce qu'on y fait en boutons fermés avec leur raison, chacun des points d'intérêt de son plan et son
 *  entrée ; puis, sous leur titre (`lieu/trajets`), chaque trajet qui en part, sa destination et son départ
 *  (`departDuTrajet`). */
function ecranDuLieu(etat: Jeu): Element[] {
  const l = lieuEnVue(etat);
  if (!l) return [];
  return [
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

/** L'interlude ouvert (`interludeEnVue`) : chaque héros en entité, ses Activités restantes, ses PX, sa bourse et
 *  l'Événement de sa période en puces, puis chaque choix de l'Activité qu'il compose, la sienne pressée et chacune
 *  fermée avec sa raison, et le bouton qui la pratique ; ses Activités jouées par leur verbe, un bouton sans cible, un
 *  choix de ses cibles sinon, fermée avec sa raison ; son dépôt ; puis les dépôts en banque, chacun le bouton de son
 *  retrait. */
function herosDeLInterlude(etat: Jeu): Element[] {
  const itl = interludeEnVue(etat);
  if (!itl) return [];
  return [
    ligne('repit/semaines', t('ecran.repit.semaines', { semaines: itl.semaines, s: pluriel(itl.semaines) })),
    ...itl.heros.map((h): Entite => ({
      type: 'entite', id: `repit/${h.id}`, ton: h.restantes ? 'neutre' : 'alerte', nom: h.nom,
      elements: [
        puce('restantes', t('ecran.repit.restantes', { restantes: h.restantes, recues: h.recues }), null),
        puce('px', t('ecran.repit.px'), String(h.px)),
        puce('bourse', t('ecran.repit.bourse'), h.bourse),
        ...(h.evenement ? [puce('evenement', h.evenement, null)] : []),
        ...h.composition.map((c): Choix => ({
          type: typeDuChoix(c.valeurs.length), id: c.axe, ton: 'neutre', libelle: c.libelle, focus: false, refus: null,
          valeurs: c.valeurs.map((v, i) => boutonDeGeste(`${c.axe}/${i}`, v.libelle, v.geste, v.refus, v.choisie)),
        })),
        ...(h.pratiquer ? [boutonDuNoyau('pratiquer', h.pratiquer)] : []),
        ...h.activites.map((a): Bouton | Choix => (a.cible
          ? { type: typeDuChoix(a.gestes.length), id: a.id, ton: 'neutre', libelle: a.libelle, focus: false, refus: a.refus, valeurs: a.gestes.map((g, i) => boutonDuNoyau(`${a.id}/${i}`, g)) }
          : boutonDuNoyau(a.id, a.gestes[0]))),
        formulaireDuNoyau(`depot/${h.id}`, t('ecran.repit.depot'), h.depot, h.depot.refus ? [] : [
          saisieDeValeurs('genre', t('ecran.repit.genre'), h.depot.genres),
          { type: 'saisieNombre', id: 'montant', ton: 'neutre', nom: 'montant', optionnel: false, libelle: t('ecran.repit.montant'), valeur: h.depot.pas, min: h.depot.pas, max: h.depot.max, pas: h.depot.pas },
        ]),
      ],
    })),
    ...(itl.depots.length ? [{ type: 'entite', id: 'repit/depots', ton: 'neutre', nom: t('ecran.repit.depots'), elements: itl.depots.map((d, i) => boutonDuNoyau(String(i), d)) } satisfies Entite] : []),
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
          valeurs: sc.postes.map((p, i): Bouton => ({ type: 'bouton', id: String(i), libelle: p.nom, jeu: { type: p.geste.verbe, args: p.geste.args }, presse: p.poste, focus: false, refus: null })),
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

type Repos = NonNullable<ReturnType<typeof reposEnVue>>;

/** Un réglage d'un dormeur en choix : chaque valeur que le lieu lui offre, la sienne pressée. */
const choixDuDormeur = (id: string, c: Repos['dormeurs'][number]['couchage']): Choix => ({
  type: 'choix', id, ton: 'neutre', libelle: c.libelle, focus: false, refus: null,
  valeurs: c.valeurs.map((v, i): Bouton => ({ type: 'bouton', id: String(i), libelle: v.libelle, jeu: { type: v.geste.verbe, args: v.geste.args }, presse: v.choisie, focus: false, refus: null })),
});

/** La nuit à régler (`reposEnVue`) : la tête de sa scène (`scene` : le paysage de la halte, le jour, la nuit et son
 *  lieu), le temps qu'il fait (en alerte quand il expose), puis la note, en alerte quand les bourses ne la couvrent
 *  pas ; la nuit de chaque dormeur est sur sa carte (`surLesCartes`). */
function nuitDuRepos(etat: Jeu, cle: string): Element[] {
  const r = reposEnVue(etat);
  if (!r) return [];
  return [
    ...scene(etat, paysageDeLaHalte(r.toit, voyageEnVue(etat)), r.nuit),
    ...(r.temps ? [ligne(`${cle}/temps`, r.temps.texte, r.temps.alerte ? 'alerte' : 'neutre')] : []),
    ...(r.note ? [ligne(`${cle}/note`, r.note.texte, r.note.couverte ? 'neutre' : 'alerte')] : []),
  ];
}

/** Le ton de chaque issue d'un récit de voyage. */
const TON_DU_RECIT = { arrivee: 'reussite', interruption: 'alerte', arret: 'alerte', embuscade: 'echec' } as const satisfies Record<NonNullable<ReturnType<typeof recitEnVue>>['issue'], Ton>;

/** Le récit du trajet que le groupe vient de faire (`recitEnVue`) : son issue au ton de l'issue, la route faite, puis la
 *  durée du voyage arrivé, ou chaque journée en entité avec ce qui s'y est passé, et ce qui permet de repartir. */
function recitDuVoyage(etat: Jeu): Element[] {
  const r = recitEnVue(etat);
  if (!r) return [];
  return [
    ligne('recit/issue', r.titre, TON_DU_RECIT[r.issue]),
    ligne('recit/route', r.route),
    ...(r.duree ? [ligne('recit/duree', r.duree)] : []),
    ...r.journees.map((j, i): Entite => ({ type: 'entite', id: `recit/jour/${i}`, ton: 'neutre', nom: j.libelle, elements: j.lignes.map((l, k) => ligne(String(k), l)) })),
    ...(r.suite ? [ligne('recit/suite', r.suite)] : []),
  ];
}

/** L'échoppe ouverte (`marchandEnVue`) : la bourse du groupe ; chaque famille de l'étal en entité, chaque article en
 *  bouton qui en met une unité au panier, son prix au libellé, pressé quand le panier en tient ; le panier, chaque ligne
 *  en bouton qui en ôte une unité, et le paiement de son total ; chaque héros et ses possessions, chacune en bouton qui la
 *  met au lot ou l'en retire, son gain au libellé ; puis la vente du lot. */
function echoppe(etat: Jeu): Element[] {
  const m = marchandEnVue(etat);
  if (!m) return [];
  const avecPrix = (nom: string, prix: string | null) => (prix === null ? nom : t('ecran.echoppe.article', { nom, prix }));
  return [
    puce('bourse', t('ecran.bourse'), m.bourse),
    ...m.etal.map((f): Entite => ({
      type: 'entite', id: `etal/${f.id}`, ton: 'neutre', nom: f.nom,
      elements: f.articles.map((a) => boutonDeGeste(a.id, avecPrix(a.nom, a.prix), a.ajouter.geste, a.ajouter.refus, a.auPanier > 0)),
    })),
    {
      type: 'entite', id: 'panier', ton: 'neutre', nom: t('ecran.echoppe.panier'),
      elements: [
        ...m.panier.lignes.map((l) => boutonDeGeste(l.id, avecPrix(t('ecran.echoppe.ligne', { nom: l.nom, qty: l.qty }), l.sousTotal), l.oter, null)),
        boutonDeGeste('payer', t('ecran.echoppe.payer', { total: m.panier.total }), m.panier.payer.geste, m.panier.payer.refus),
      ],
    },
    ...m.vente.heros.map((h): Entite => ({
      type: 'entite', id: `vente/${h.id}`, ton: 'neutre', nom: h.nom,
      elements: h.possessions.map((p) => boutonDeGeste(p.uid, avecPrix(p.nom, p.gain), p.basculer, p.refus, p.auLot)),
    })),
    boutonDeGeste('vendre', t('ecran.echoppe.vendre', { total: m.vente.total }), m.vente.vendre.geste, m.vente.vendre.refus),
  ];
}

type Voyage = NonNullable<ReturnType<typeof voyageEnVue>>;

/** Le ciel de chaque moment du jour, et le voile qu'il pose sur le relief. */
const CIEL_DU_MOMENT: Record<Voyage['moment']['id'], readonly IdDeCouche[]> = {
  aube: ['ciel-aube', 'voile-aube'], matin: ['ciel-jour'], midi: ['ciel-jour'], apresmidi: ['ciel-jour'],
  crepuscule: ['ciel-soir', 'voile-soir'], soir: ['ciel-nuit', 'voile-nuit'], nuit: ['ciel-nuit', 'voile-nuit'],
};

/** La couche de chaque météo du jour ; `null` : un temps qui ne se voit pas. */
const COUCHE_DE_LA_METEO: Record<NonNullable<Voyage['meteo']>['id'], IdDeCouche | null> = {
  sec: null, beau: null, pluie: 'meteo-pluie', 'pluie-diluvienne': 'meteo-pluie-diluvienne', neige: 'meteo-neige', blizzard: 'meteo-blizzard',
};

/** Le relief de chaque voie. */
const RELIEF_DE_LA_VOIE: Record<Voyage['voie'], IdDeCouche> = { terrestre: 'relief-terre', fluvial: 'relief-fleuve', maritime: 'relief-mer' };

/** L'équipage d'un trajet, qui nomme sa couche (`equipage-…`) et celle de sa lanterne (`lanterne-…`). */
type Equipage = 'pied' | 'monture' | 'attelage' | 'barge' | 'navire';

/** L'équipage du trajet : le navire en mer, la barge au fleuve ; sur la route, les marcheurs, les cavaliers ou l'attelage. */
const equipage = (v: Voyage): Equipage => (v.voie === 'maritime' ? 'navire' : v.voie === 'fluvial' ? 'barge' : v.mode === 'pied' ? 'pied' : v.mode === 'monture' ? 'monture' : 'attelage');

/** La tête d'une scène du monde : son paysage, ses couches de la plus lointaine à la plus proche, le jour de jeu,
 *  puis ce qui se dit du moment. */
const scene = (etat: Jeu, couches: IdDeCouche[], moment: string): Element[] => [
  { type: 'paysage', id: 'scene/paysage', paysage: couches } satisfies Paysage,
  ligne('scene/jour', formatJourImperial(etat.gameTime)),
  ligne('scene/moment', moment),
];

/** Le paysage du trajet : le ciel du moment, le relief de la voie, le voile du moment, l'équipage, sa lanterne quand
 *  le moment pose un voile, puis la météo du jour. */
function paysageDuVoyage(v: Voyage): IdDeCouche[] {
  const [ciel, ...voile] = CIEL_DU_MOMENT[v.moment.id];
  const meteo = v.meteo && COUCHE_DE_LA_METEO[v.meteo.id];
  const e = equipage(v);
  return [ciel, RELIEF_DE_LA_VOIE[v.voie], ...voile, `equipage-${e}`, ...(voile.length > 0 ? [`lanterne-${e}` as const] : []), ...(meteo ? [meteo] : [])];
}

/** Le paysage d'une halte : la nuit sur son relief, le toit de la nuit (le feu du campement, les fenêtres d'un logis,
 *  le bord et ses lanternes sur l'eau du trajet `v`, la mer hors d'un trajet), puis la météo du jour. */
function paysageDeLaHalte(toit: NonNullable<ReturnType<typeof reposEnVue>>['toit'], v: Voyage | null): IdDeCouche[] {
  const meteo = v?.meteo && COUCHE_DE_LA_METEO[v.meteo.id];
  const bord = v?.voie === 'fluvial' ? 'barge' : 'navire';
  const halte: IdDeCouche[] = toit === 'bord' ? [`equipage-${bord}`, `lanterne-${bord}`] : [toit === 'campement' ? 'halte-feu' : 'halte-toit'];
  return ['ciel-nuit', toit === 'bord' ? RELIEF_DE_LA_VOIE[v?.voie === 'fluvial' ? 'fluvial' : 'maritime'] : 'relief-terre', 'voile-nuit', ...halte, ...(meteo ? [meteo] : [])];
}

/** La frise du trajet, en plan d'une seule ligne : le départ, chaque nuit passée en route à son km, là où est le
 *  groupe (`ici`, en `reussite`, sans nom), l'arrivée ; la route faite en `alerte`, celle qui reste en `neutre`. */
function friseDuVoyage(v: Voyage): Plan {
  const point = (id: string, nom: string, km: number, ton: Ton): Plan['points'][number] => ({ type: 'point', id, nom, x: v.km > 0 ? km / v.km : 1, y: 0, ton, elements: [] });
  const faits = [point('depart', v.de, 0, 'alerte'), ...v.nuits.map((n, i) => point(`nuit/${i}`, t('ecran.voyage.nuit', { nuit: i + 1 }), n, 'alerte')), point('ici', '', v.fait, 'reussite')];
  const points = [...faits, point('arrivee', v.vers, v.km, 'neutre')];
  return { type: 'plan', id: 'voyage/frise', points, traits: points.slice(1).map((p, i) => ({ id: p.id, de: points[i].id, vers: p.id, ton: i < faits.length - 1 ? 'alerte' : 'neutre' })) };
}

/** La carte du trajet, en plan : chaque lieu que la carte montre, sans son nom, l'arrivée en `reussite`, chaque route
 *  en `neutre` ; quand elle montre les deux bouts du trajet, là où est le groupe sur sa route (`ici`, en `alerte`) et
 *  la part faite de cette route en `alerte`. */
function carteDuVoyage(v: Voyage): Plan {
  const lieu = (id: string) => v.carte.lieux.find((l) => l.id === id);
  const [de, vers] = [lieu(v.depart), lieu(v.arrivee)];
  const part = v.km > 0 ? v.fait / v.km : 1;
  const point = (id: string, x: number, y: number, ton: Ton): Plan['points'][number] => ({ type: 'point', id, nom: '', x, y, ton, elements: [] });
  const lieux = v.carte.lieux.map((l) => point(`lieu/${l.id}`, l.x, l.y, l.id === v.arrivee ? 'reussite' : 'neutre'));
  const routes = v.carte.routes.filter((r) => r.route !== v.route).map((r) => ({ id: r.route, de: `lieu/${r.de}`, vers: `lieu/${r.vers}`, ton: 'neutre' as const }));
  if (!de || !vers) return { type: 'plan', id: 'voyage/carte', points: lieux, traits: routes };
  return {
    type: 'plan', id: 'voyage/carte',
    points: [...lieux, point('ici', de.x + (vers.x - de.x) * part, de.y + (vers.y - de.y) * part, 'alerte')],
    traits: [...routes, { id: 'reste', de: 'ici', vers: `lieu/${v.arrivee}`, ton: 'neutre' }, { id: 'fait', de: `lieu/${v.depart}`, vers: 'ici', ton: 'alerte' }],
  };
}

/** Le trajet en cours (`voyageEnVue`) : hors d'une halte, qui tient la sienne (`nuitDuRepos`), la tête de sa scène
 *  (`scene` : son paysage, le jour, le moment du jour et la météo) ; puis sa carte (`carteDuVoyage`), les km faits sur
 *  ceux du trajet par son moyen, et sa frise (`friseDuVoyage`). */
function voyage(etat: Jeu): Element[] {
  const v = voyageEnVue(etat);
  if (!v) return [];
  const moment = v.meteo ? t('ecran.voyage.moment', { moment: v.moment.nom, meteo: v.meteo.nom.toLocaleLowerCase('fr') }) : v.moment.nom;
  return [
    ...(reposEnVue(etat) ? [] : scene(etat, paysageDuVoyage(v), moment)),
    carteDuVoyage(v),
    ligne('voyage/route', t('ecran.voyage.route', { moyen: v.moyen, fait: v.fait, km: v.km })),
    friseDuVoyage(v),
  ];
}

/** Le marché de cargaison ouvert (`marcheEnVue`) : la bourse, chaque offre en entité, son Enc disponible, son prix
 *  par Enc, la qualité de son vin ou son évaluation, puis le bouton qui en compose l'achat, pressé quand il se compose,
 *  et son estimation (le porteur, l'Enc et la conclusion de l'achat en composition sont des réglages de la fenêtre) ;
 *  chaque lot des porteurs du groupe en entité, son porteur et son Enc, son prix de base, sa vente, son bradage, puis
 *  son transfert vers un porteur co-localisé. */
function marche(etat: Jeu): Element[] {
  const m = marcheEnVue(etat);
  if (!m) return [];
  const enc = (n: number) => t('ecran.marche.enc', { enc: n });
  const parEnc = (prix: string) => puce('prix', t('ecran.marche.prix'), t('ecran.marche.parEnc', { prix }));
  return [
    puce('bourse', t('ecran.bourse'), m.bourse),
    ...m.offres.map((o): Entite => ({
      type: 'entite', id: `offre/${o.id}`, ton: 'neutre', nom: o.nom,
      elements: [
        puce('dispo', t('ecran.marche.dispo'), enc(o.dispo)),
        parEnc(o.prix),
        ...(o.qualite ? [{ ...puce('qualite', t('ecran.marche.qualite'), o.qualite.fiable ? o.qualite.texte : t('ecran.marche.incertaine', { qualite: o.qualite.texte })), ton: o.qualite.fiable ? 'neutre' : 'alerte' } satisfies Puce] : []),
        ...(o.evaluer ? [boutonDuNoyau('evaluer', { ...o.evaluer, libelle: t('ecran.marche.evaluer') })] : []),
        puce('estimation', t('ecran.marche.estimation'), o.acheter.estimation),
        boutonDeGeste('acheter', t('ecran.marche.acheter'), o.acheter.geste, o.acheter.refus, o.acheter.compose),
      ],
    })),
    ...m.cargaison.flatMap((c) => c.lots.map((l): Entite => ({
      type: 'entite', id: `lot/${l.uid}`, ton: 'neutre', nom: l.nom,
      elements: [
        puce('porteur', c.nom, enc(l.enc)),
        parEnc(l.prix),
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
  return doc ? [ligne('lecture', doc.texte)] : [];
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
    ...v.defeated.map((d, i) => ligne(`${cle}/vaincu/${i}`, d.count > 1 ? t('ecran.victoire.vaincus', { nom: d.label, nombre: d.count }) : d.label)),
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

/** Ce que l'étape courante de la cascade révèle (fin de round, entrée de scène, mutation, Coup Critique…). Un Coup
 *  Critique dit sa localisation, les Blessures perdues s'il en coûte et chaque État infligé en puces, sur un héros en
 *  `echec`, sur un adversaire en `reussite` ; toute autre révélation, chacune de ses lignes. Puis chacun de ses effets,
 *  son explication au détail. Ses lignes vont aussi au journal, où ses effets ne se lisent qu'au survol. */
function revelationDeLEtape(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const r = pc?.participants[pc.cursor]?.reveal;
  if (!r) return [];
  const crit = r.kind === 'critique' ? r.crit : undefined;
  const ton: Ton = r.subjectId && porteurParId(etat, r.subjectId)?.kind === 'heros' ? 'echec' : 'reussite';
  const prefixe = crit ? 'critique' : 'revelation';
  return [
    ...(crit ? [
      puce('critique/localisation', t('ecran.critique.localisation'), crit.location, null, ton),
      ...(crit.woundsLost ? [puce('critique/blessures', t('ecran.jauge.blessures'), avecSigne(-crit.woundsLost), null, ton)] : []),
      ...(crit.conditions ?? []).map((c) => puce(`critique/etat/${c.id}`, conditionLabel(c.id), String(c.value), null, ton)),
    ] : r.lines.map((l, i) => ligne(`revelation/${i}`, l))),
    ...(r.details ?? []).map((d, i) => ligne(`${prefixe}/effet/${i}`, d.text, 'neutre', d.note ?? null)),
  ];
}

/** Ce que l'étape courante de la cascade dit sans le révéler (`outcome` posé par son monteur : un affichage, le contexte
 *  d'un choix), chaque ligne à son ton ; une révélation le dit déjà (`revelationDeLEtape`). */
function issueDeLEtape(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const etape = pc?.participants[pc.cursor];
  if (!etape || etape.reveal) return [];
  return (etape.outcome ?? []).map((l, i) => ligne(`issue/${i}`, l.text, l.tone ?? 'neutre'));
}

/** Une jauge de `courant` sur `max`. */
const jauge = (id: string, libelle: string, [courant, max]: readonly [number, number]): Element => ({ type: 'jauge', id, ton: 'neutre', libelle, courant, max, texte: t('ecran.jauge', { courant, max }) });

/** L'actif du combat : son nom, ses Blessures et son Mouvement en jauges, puis son Avantage, son Action et chacun de
 *  ses États en puces. */
const actifDuCombat = (actif: NonNullable<Combat['actif']>): Entite => ({
  type: 'entite', id: actif.id, ton: 'neutre', nom: actif.nom,
  elements: [
    jauge('blessures', t('ecran.jauge.blessures'), actif.pb),
    jauge('mouvement', t('ecran.jauge.mouvement'), actif.mouvement),
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

/** Les offres de l'actif, chacune un bouton qui joue son geste (`Offre.geste`), pressée quand elle est armée, refusée
 *  avec sa raison quand elle est fermée ; rangées par la part de l'économie du tour qu'elles prennent, chaque part un
 *  choix qui la nomme une fois, celles qui n'en prennent aucune (la fin du tour) sous le tour. Une offre qui s'offre par
 *  candidat (le sort, l'arme, l'attaque de trait) est un choix à elle, sous sa part, en liste au-delà de
 *  `CHOIX_EN_BOUTONS` candidats : chaque candidat un bouton qui le nomme et joue son geste. Une offre sans geste, dont la
 *  case attend un paramètre que seule la console choisit, n'a pas de bouton : fermée, elle reste un choix sans valeur,
 *  refusé avec sa raison. */
function offresDuCombat(c: Combat): Choix[] {
  const offres = (c.offres?.liste ?? []).filter((o) => o.geste || o.candidats.some((k) => k.geste) || o.refus !== null);
  const libelle = (o: (typeof offres)[number]): string => garanti(ACTIONS.find((a) => a.id === o.id)?.label, o.id, 'libellé de l’offre');
  const jeuDe = (g: GesteDuNoyau): Bouton['jeu'] => ({ type: g.verbe, args: g.args });
  const bouton = (o: (typeof offres)[number]): Bouton => ({
    type: 'bouton', id: o.id, libelle: libelle(o), jeu: jeuDe(garanti(o.geste, o.id, 'geste de l’offre')), presse: o.armee, focus: false, refus: o.refus,
  });
  const parCandidat = (o: (typeof offres)[number]): Choix => ({
    type: o.candidats.length > CHOIX_EN_BOUTONS ? 'liste' : 'choix', id: `offre/${o.id}`, ton: 'neutre', libelle: libelle(o), focus: false, refus: o.refus,
    valeurs: o.candidats.flatMap((k): Bouton[] => (k.geste ? [{
      type: 'bouton', id: `${o.id}/${Object.values(k.ctx).join('/')}`, libelle: k.nom, jeu: jeuDe(k.geste), presse: k.armee, focus: false, refus: k.refus,
    }] : [])),
  });
  return [...new Set(offres.map((o) => o.economie))].flatMap((e): Choix[] => {
    const part = offres.filter((o) => o.economie === e);
    const uniques = part.filter((o) => !o.candidats.length && o.geste);
    return [
      ...(uniques.length ? [{ type: 'choix' as const, id: `economie/${e}`, ton: 'neutre' as const, libelle: t(`ecran.economie.${e}`), focus: false, refus: null, valeurs: uniques.map(bouton) }] : []),
      ...part.filter((o) => o.candidats.length || !o.geste).map(parCandidat),
    ];
  });
}

/** L'ordre du tour en vue (`ordreEnVue`) : chaque combattant en puce, ses Blessures pour valeur ; celui qui joue en
 *  alerte, un ennemi en échec. */
const ordreDuTour = (etat: Jeu, c: Combat): Puce[] =>
  ordreEnVue(etat).flatMap((id) => {
    const x = porteurParId(etat, id);
    if (!x) return [];
    return [puce(`ordre/${id}`, x.label, t('ecran.jauge', { courant: x.wounds.current, max: x.wounds.max }), null, id === c.actif?.id ? 'alerte' : x.kind === 'ennemi' ? 'echec' : 'neutre')];
  });

/** Le ton de chaque issue du combat. */
const TON_DE_LA_FIN: Record<NonNullable<Combat['fin']>, Ton> = { victoire: 'reussite', defaite: 'echec' };

/** Ce que le panneau du combat dit hors de ses jauges, quand aucune fenêtre ne tient la main : pourquoi la barre est
 *  fermée, la fin du tour armée par un premier geste qui laisserait l'Action intacte (`finDeTourArmee`) ; la fin du
 *  combat. */
function avisDuCombat(c: Combat, fenetreOuverte: boolean): Ligne[] {
  return [
    ...(c.barre.raison === null || fenetreOuverte ? [] : [ligne('raison', c.barre.raison, 'alerte')]),
    ...(c.finDeTourArmee && !fenetreOuverte ? [ligne('finDeTourArmee', t('ecran.finDeTourArmee'), 'alerte')] : []),
    ...(c.fin ? [ligne('fin', t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }), TON_DE_LA_FIN[c.fin])] : []),
  ];
}

/** Le bouton d'un geste de la fiche : il montre `fiche` (`null` : la ferme), pressé quand il la montre déjà. */
const boutonDeFiche = (id: string, libelle: string, fiche: FicheOuverte | null, presse: boolean): Bouton => ({
  type: 'bouton', id, libelle, jeu: { fiche }, presse, focus: false, refus: null,
});

/** Les gestes de la fenêtre `gestes` qu'une carte porte : en route (`voyageEnVue`), chaque bouton qui désigne un héros du
 *  groupe, sur la carte de ce héros ; `restants` : les autres. */
function gestesDesCartes(etat: Jeu, gestes: (Bouton | Choix | Formulaire)[]): { restants: (Bouton | Choix | Formulaire)[]; parHeros: Map<string, Bouton[]> } {
  const parHeros = new Map<string, Bouton[]>();
  if (!voyageEnVue(etat)) return { restants: gestes, parHeros };
  const groupe = new Set(etat.party.map((h) => h.id));
  const restants: (Bouton | Choix | Formulaire)[] = [];
  for (const g of gestes) {
    const h = g.type === 'bouton' && 'args' in g.jeu ? g.jeu.args.find((a): a is string => typeof a === 'string' && groupe.has(a)) : undefined;
    if (h && g.type === 'bouton') parHeros.set(h, [...(parHeros.get(h) ?? []), g]);
    else restants.push(g);
  }
  return { restants, parHeros };
}

/** Chaque héros du groupe en carte (`heros/`) : son portrait, son nom, ses Blessures en jauge, sa bourse, le bouton qui ouvre sa
 *  fiche, pressé quand elle est ouverte, qui la ferme alors, ses États en puces, puis ce que la fenêtre dit de lui
 *  (`surLesCartes`) et les gestes qui le désignent (`gestesDesCartes`), `gestes` ; en `alerte` quand l'un d'eux a le
 *  focus : c'est à lui d'agir ; tant qu'aucune partie n'est en cours (`partieEnCours`), le bouton qui le renvoie,
 *  refusé par `refusDeRenvoyer`. */
function herosDuGroupe(etat: Jeu, ouverte: FicheOuverte | null, gestes: Map<string, Bouton[]>): Entite[] {
  const { parHeros } = surLesCartes(etat);
  return etat.party.map((h): Entite => {
    const f = garanti(ficheDuPorteur(etat, h.id), h.id, 'héros du groupe');
    const presse = ouverte?.porteur === h.id;
    return {
      type: 'entite', id: `heros/${h.id}`, ton: (gestes.get(h.id) ?? []).some((g) => g.focus) ? 'alerte' : 'neutre', nom: f.nom,
      elements: [
        { type: 'portrait', id: 'portrait', combattant: h.id },
        jauge('blessures', t('ecran.jauge.blessures'), f.blessures),
        puce('bourse', t('ecran.bourse'), f.bourse),
        boutonDeFiche(`fiche/${h.id}`, t('ecran.fiche.ouvrir'), presse ? null : { porteur: h.id }, presse),
        ...etatsEnPuces(f.etats),
        ...(parHeros.get(h.id) ?? []),
        ...(gestes.get(h.id) ?? []),
        ...(partieEnCours(etat) ? [] : [{ type: 'bouton', id: `renvoyer/${h.id}`, libelle: t('ecran.groupe.renvoyer'), jeu: intentionDeRenvoi(h.id), presse: false, focus: false, refus: refusDeRenvoyer(etat, h.id) } satisfies Bouton]),
      ],
    };
  });
}

/** Un nombre d'exemplaires, dit quand il y en a plusieurs. */
const nombre = (n: number): string | null => (n > 1 ? t('ecran.fiche.nombre', { nombre: n }) : null);

/** Chaque État en puce, en `alerte`. */
const etatsEnPuces = (etats: FicheDuPorteur['etats']): Puce[] => etats.map((e) => puce(`etat/${e.id}`, conditionLabel(e.id), String(e.valeur), null, 'alerte'));

/** Le porteur de la fiche, la tête de son statbloc : son nom ; son espèce et sa carrière, chacune en ligne ; ses Blessures en jauge ;
 *  ses Points de Destin, de Chance, de Résilience et de Détermination, s'il en a ; chacun de ses États en puce. */
function porteurDeLaFiche(f: FicheDuPorteur): Entite {
  const points = ([['destin', t('ecran.destin'), f.destin], ['chance', t('ecran.fiche.chance'), f.chance], ['resilience', t('ecran.fiche.resilience'), f.resilience], ['determination', t('ecran.fiche.determination'), f.determination]] as const)
    .flatMap(([id, libelle, valeur]) => (valeur === null ? [] : [puce(id, libelle, String(valeur))]));
  return {
    type: 'entite', id: f.id, ton: 'neutre', nom: f.nom,
    elements: [
      ...(f.espece === null ? [] : [ligne('espece', f.espece)]),
      ...(f.carriere === null ? [] : [ligne('carriere', f.carriere)]),
      jauge('blessures', t('ecran.jauge.blessures'), f.blessures),
      ...points,
      ...etatsEnPuces(f.etats),
    ],
  };
}

/** Le profil du statbloc de `f`, une puce par colonne, son nom au détail : le Mouvement, chaque Caractéristique par
 *  son abréviation, les Blessures à leur maximum. */
const profilDeLaFiche = (f: FicheDuPorteur): Puce[] => [
  puce('profil/m', t('ecran.statbloc.m'), String(f.mouvement), t('ecran.jauge.mouvement')),
  ...f.caracteristiques.map((c) => puce(`carac/${c.cle}`, c.abrege, String(c.valeur), c.libelle)),
  puce('profil/b', t('ecran.statbloc.b'), String(f.blessures[1]), t('ecran.jauge.blessures')),
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

/** Une entrée nommée du profil en puce, le premier paragraphe de sa description au détail. */
const entrees = (id: string, liste: readonly EntreeDeLaFiche[]): Puce[] => liste.map((x, i) => puce(`${id}/${i}`, x.libelle, null, resume(x.desc)));

/** Chaque section du statbloc de `f`, ses termes en éléments : chaque arme en entité, la valeur de son Test, ses Dégâts et
 *  son Allonge ou sa Portée, ses Atouts et Défauts, chacun en puce ; les Points d'Armure de chaque localisation qui en
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
        ...a.stats.map((x, j) => puce(`stat/${j}`, x, null)),
        ...a.qualites.map((x, j) => puce(`qualite/${j}`, x, null)),
      ],
    })),
    armure: f.armure.map((a, i) => puce(`armure/${i}`, a.localisation, String(a.pa))),
    traits: entrees('trait', f.traits),
    mutations: entrees('mutation', f.mutations),
    competences: f.competences
      .map((c, i) => {
        const k = carac.get(c.caracteristique)!;
        return puce(`competence/${i}`, c.libelle, String(c.valeur), t('ecran.fiche.competence', { carac: k.abrege, base: k.valeur, avances: c.avances }));
      })
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
    talents: f.talents.map((x, i) => puce(`talent/${i}`, x.libelle, nombre(x.fois), resume(x.desc))),
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
  type: 'bouton', id, libelle, jeu: { type: g.verbe, args: g.args }, presse, focus: false, refus,
});

/** Un geste du noyau nommé en bouton (`boutonDeGeste`). */
const boutonDuNoyau = (id: string, g: GesteFermable & { libelle: string }): Bouton => boutonDeGeste(id, g.libelle, g.geste, g.refus);

/** Un geste à choix sur un objet : une liste dont chaque choix joue son geste, refusé avec elle. */
const listeDObjet = (id: string, libelle: string, g: GesteAChoix<unknown>): Choix => ({
  type: 'liste', id, ton: 'neutre', libelle, focus: false, refus: g.refus,
  valeurs: g.choix.map((c, i) => boutonDeGeste(`${id}/${i}`, c.libelle, c.geste, g.refus)),
});

/** La possession choisie de la fiche `f` (`FicheOuverte.objet`) en entité : son nom, au ton `reussite` quand elle est
 *  équipée ; son nombre, son argent et le contenant où elle est rangée en puces ; puis chacun de ses gestes
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
    p.argent === null ? null : puce('argent', p.argent, null),
    p.contenant === null ? null : puce('contenant', t('ecran.objet.contenant', { contenant: p.contenant }), null),
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
    'fiche.porteur': [porteurDeLaFiche(f)],
    'fiche.gestes': [boutonDeFiche('fermer', t('ecran.fiche.fermer'), null, false)],
    'fiche.profil': profilDeLaFiche(f),
    'fiche.sections': (Object.keys(SECTIONS_DU_STATBLOC) as (keyof typeof SECTIONS_DU_STATBLOC)[]).flatMap((k): Entite[] =>
      sections[k].length ? [{ type: 'entite', id: `section/${k}`, ton: 'neutre', nom: t(SECTIONS_DU_STATBLOC[k]), elements: sections[k] }] : []),
    'fiche.source': f.source === null ? [] : [ligne('source', t('ecran.statbloc.source', { source: f.source }))],
    'fiche.objet': objetDeLaFiche(etat, f, ouverte),
  };
}

/** Les zones de l'écran de la partie `etat`, de sa projection `p`, de la fenêtre qui tient la main `fenetre`, du
 *  panneau que l'hôte tient ouvert `panneau` : la fiche ou la création (`zonesDeLaCreation`), et du roster `roster` que
 *  l'hôte montre au groupe à composer (`zonesDeLaPartie`). */
export function zonesDeLEcran(etat: Jeu, p: Projection, fenetre: FenetreADessiner | null, panneau: PanneauDeLHote, roster: RosterMontre): ZonesDeLEcran {
  const fiche = panneau && 'fiche' in panneau ? panneau.fiche : null;
  const c = p.combat;
  const { restants: gestes, parHeros: gestesSurLesCartes } = gestesDesCartes(etat, fenetre ? elementsDesGestes(fenetre.gestes) : []);
  const corps = fenetre ? corpsDeLaFenetre(etat) : [];
  const portes = choixPortes(corps);
  const reglages = new Set(fenetre?.gestes.filter((g) => g.reglage).map((g) => g.cle));
  const etape = fenetre ? [fenetre.etape === fenetre.titre ? null : fenetre.etape, fenetre.proprietaire.genre === 'porteur' ? fenetre.proprietaire.nom : null].filter((x): x is string => x !== null) : [];
  return {
    'fenetre.titre': fenetre ? [ligne('titre', fenetre.titre)] : [],
    'fenetre.etape': etape.length ? [ligne('etape', etape.join(t('ecran.separateur')))] : [],
    'fenetre.corps': corps,
    'fenetre.reglages': gestes.filter((g) => reglages.has(g.id) && !portes.has(g.id)),
    'fenetre.gestes': gestes.filter((g) => !reglages.has(g.id) && !portes.has(g.id)),
    'combat.tour': c ? [ligne('tour', c.tour === null ? t('ecran.round', { round: c.round }) : t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }))] : [],
    'combat.ordre': c ? ordreDuTour(etat, c) : [],
    'combat.actif': c?.actif ? [actifDuCombat(c.actif)] : [],
    'combat.avis': c ? avisDuCombat(c, fenetre !== null) : [],
    'combat.apercu': c ? [apercuDe(etat, c)].flatMap((a) => (a === null ? [] : [ligne('apercu', a)])) : [],
    'combat.offres': c ? offresDuCombat(c) : [],
    'exploration.gestes': (fenetre ? [] : p.exploration?.gestes.liste ?? []).map((g, i): Bouton => ({
      type: 'bouton', id: `exploration/${i}`, libelle: g.libelle, jeu: { suite: g.gestes.map((x) => ({ type: x.verbe, args: x.args })) }, presse: false, focus: false, refus: g.refus ?? null,
    })),
    ...zonesDuDialogue(etat, fenetre !== null),
    'journal.titre': c ? [ligne('journal', t('ecran.journal'))] : [],
    'groupe.heros': herosDuGroupe(etat, fiche, gestesSurLesCartes),
    ...zonesDeLaFiche(etat, fiche),
    ...zonesDeLaCreation(etat, panneau && 'creation' in panneau ? panneau.creation : null),
    ...zonesDeLaPartie(etat, roster),
  };
}

/** Les zones de la conversation en cours (`conversationEnVue`), quand aucune fenêtre ne la suspend : son
 *  interlocuteur, sa réplique, et chaque réponse visible en bouton qui la choisit, ce qu'elle annonce (son Test, son
 *  coût) avant son libellé, refusée avec sa raison. */
function zonesDuDialogue(etat: Jeu, fenetreOuverte: boolean): Pick<ZonesDeLEcran, 'dialogue.orateur' | 'dialogue.replique' | 'dialogue.reponses'> {
  const v = fenetreOuverte ? null : conversationEnVue(etat);
  return {
    'dialogue.orateur': v?.orateur ? [ligne('orateur', v.orateur)] : [],
    'dialogue.replique': v?.replique ? [ligne('replique', v.replique)] : [],
    'dialogue.reponses': (v?.reponses ?? []).map((r): Bouton => ({
      type: 'bouton', id: `reponse/${r.id}`, libelle: [r.annonce, r.label, r.cost && formatMoney(r.cost)].filter(Boolean).join(' '),
      jeu: { type: r.geste.verbe, args: r.geste.args }, presse: false, focus: false, refus: r.refus ?? null,
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
    const texte = l.de === 'journal' ? l.texte : l.evenement.text;
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
