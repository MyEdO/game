/**
 * LES VUES FIGÉES DE L'ÉCRAN (#3328) : ce que la recette native de l'écran (`projet/recettes/ecran.gd`) montre, figé par
 * la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. Un tour de `dome` joué par le pont comme
 * Godot le joue (le début du round, la barre de l'actif, la charge armée, la fenêtre d'attaque avant puis après le
 * jet, chaque fois le geste en focus pressé), puis le combat poursuivi en joueur pressé (chaque fenêtre par son geste en
 * focus ou sa première valeur ouverte, chaque tour une charge ou une attaque sur la première cible, sinon la fin du tour) jusqu'au premier Coup
 * Critique, la fiche du premier héros ouverte par son bouton, son statbloc, sa première possession choisie (ses gestes
 * refusés en combat), la fiche de la cible de la charge, le combat poursuivi de même jusqu'à sa fin (la fenêtre de sa
 * fin, sa sortie en focus), puis, chacun sur un pont neuf, le premier document de la liasse de `documents-edo` lu, et
 * dans `magie` la Fléchette choisie parmi les sorts de l'actif, la fiche du lanceur, sa fenêtre d'incantation avant puis après le jet et un pas
 * de Surincantation alloué, la création d'un héros ouverte dans `marche-equipement` (la race avant puis après son d100,
 * la carrière tirée, les Caractéristiques en 100 points, chacune en liste), la carte du monde, la journée de route arrêtée aux jets des héros puis ces jets tombés, et le récit d'une arrivée dans `voyage`, puis dans `bataille-de-masse` l'entre-deux-aventures
 * (un onglet par héros), les Scènes du premier Round de la bataille et l'entre-deux-Rounds, dans
 * `entre-deux-aventures` les formulaires d'ouvrage et de dépôt du forgeron, et un formulaire de chaque saisie près d'un geste refusé (`elementsDesGestes`), d'une rangée
 * de cases et d'un curseur. Chaque vue porte
 * ses zones, les lignes que le combat du dôme a ajoutées au journal sous `journal.lignes` (où le routeur `combat.gd` les range),
 * et l'intention que chaque formulaire joue pressé tel qu'il est dessiné (`attendus`). Chaque vue qu'une partie montre
 * a sa planche (`Planche`, #3935), que `etalons.mjs --enregistrer` écrit sous `hotes/godot/etalons/`.
 */
/**
 * La recette native `projet/recettes/ecran.gd` montre les vues que la sonde fige (`hotes/godot/recettes/ecran.ts`, sous
 * `recettes/vues/ecran.json` de sa copie) : chaque source a sa zone et chaque zone sa source, chaque élément son
 * composant dans l'ordre, chaque texte qu'il dit se lit à l'écran, chaque geste pressé joue son intention, celui d'une
 * entité compris, chaque liste montre choisie sa valeur pressée et aucune sans elle, un curseur glissé ou réglé par sa
 * boîte à nombre joue sa valeur, le geste en focus le prend, une vue remontrée garde ses nœuds et ne joue rien. Chaque
 * vue se montre dans la disposition qu'elle nomme : chaque élément y a une zone, et chaque disposition dédiée de
 * `projet/ecrans/` est montrée par une vue.
 * @contrat L'écran de Godot
 */
import { clicDuCombattant, creerPont, type MondeDuPont, type Suite } from '../pont/pont';
import { enFocus, gestesDessines } from '../pont/dessines';
import { CLIC_DU_CHAMP, horlogeVirtuelle } from '../../../src/noyau/index';
import type { ZonesDeLaSuite, ZonesDeLEcran } from '../../../src/hote/ecran';
import { elementsDesGestes, ligne, type Bouton, type Choix, type Curseur, type Element, type Entite, type Formulaire, type Jeu, type Ligne, type Plan, type Saisie } from '../../../src/hote/elements';
import type { ArgumentDuGeste, GesteDeLaFenetre } from '../../../src/hote/gestes';
import type { Listage } from './atelier';

/** Une vue de l'écran figée : son nom, sa disposition, ses zones, et l'intention de chaque formulaire par son id. */
export interface VueFigee {
  nom: string;
  disposition: string | null;
  zones: ZonesDeLEcran & ZonesDeLaSuite;
  attendus: Record<string, Jeu>;
}

/**
 * Une planche (#3935) : un état de partie tel que le pont le rend, que le jeu montre sans le jouer
 * (`projet/scripts/pont_de_planche.gd`). `nom` la nomme dans l'adresse (`?planche=<nom>`) et dans son fichier
 * (`hotes/godot/etalons/planches/<nom>.json`), `titre` dit ce qu'elle montre, `parametres` porte le scénario de sa
 * partie, que l'adresse d'une partie nomme (`?scenario=`), `demarrer`, `retrait` et `aretes` les réponses du pont à ces
 * trois méthodes : la suite de l'état, sans effet ni jeton, le journal de la partie entier sous `journal.lignes`, le
 * masque du regard et les arêtes de sa scène ; `monde`, le monde de sa scène (`MondeDeLaPlanche`).
 */
export interface Planche {
  nom: string;
  titre: string;
  parametres: { scenario: string };
  demarrer: { ok: true } & Suite;
  monde: MondeDeLaPlanche;
  retrait: unknown;
  aretes: unknown;
}

/** Le monde d'une planche, que `pont_de_planche.gd` sert : la réponse de `monde` et celle de `morceaux` à toutes ses
 *  clés (`toutesLesCles`). */
export interface MondeDeLaPlanche {
  monde: unknown;
  morceaux: unknown;
}

/** L'entrée de `morceaux` qui demande à la partie chaque clé du manifeste `monde` (la réponse de `monde`). */
export const toutesLesCles = ({ monde, toits, couronnes }: MondeDuPont) => ({
  source: 'partie',
  volume: (monde?.morceaux ?? []).map(({ cle }) => cle),
  toits: toits.map(({ cle }) => cle),
  couronnes: couronnes.map(({ cle }) => cle),
});

/** Un argument saisi du formulaire de recette. */
const argument = (nom: string, saisie: ArgumentDuGeste['saisie'], partie: Partial<ArgumentDuGeste>): ArgumentDuGeste => ({
  nom, optionnel: false, saisie, libelle: `Saisie ${nom}`, valeur: null, valeurs: null, bornes: null, note: null, champs: null, ...partie,
});

/** Un geste en formulaire, une saisie de chaque sorte, et les arguments qu'il joue pressé tel qu'il est dessiné. */
const FORMULAIRE: GesteDeLaFenetre = {
  cle: 'formulaire', verbe: 'verbeDeRecette', libelle: 'Jouer le formulaire', rendu: 'formulaire', aChoisir: null, attendu: true, ouvert: true, raison: null, reglage: false,
  arguments: [
    argument('pid', 'fixe', { libelle: null, valeur: 'designe' }),
    argument('choix', 'choix', { valeur: 'b', valeurs: [{ valeur: 'a', libelle: 'Valeur A', refus: null }, { valeur: 'b', libelle: 'Valeur B', refus: null }, { valeur: 'c', libelle: 'Valeur C', refus: 'Refusée' }] }),
    argument('nombre', 'nombre', { valeur: 3, bornes: { min: 0, max: 10, pas: 1 } }),
    argument('texte', 'texte', { valeur: 'mot' }),
    argument('multiligne', 'multiligne', { valeur: 'deux\nlignes' }),
    argument('json', 'json', { valeur: { a: 1 } }),
    argument('objet', 'objet', { champs: [argument('x', 'nombre', { valeur: 2 }), argument('y', 'texte', { valeur: 'z' })] }),
  ],
};
const ARGUMENTS_DU_FORMULAIRE = ['designe', 'b', 3, 'mot', 'deux\nlignes', { a: 1 }, { x: 2, y: 'z' }];

/** Un formulaire d'une rangée de cases, une case cochée, une libre, une refusée : il joue la liste des cochées. */
const CASES: Formulaire = {
  type: 'formulaire', id: 'cases', libelle: 'Jouer les cases', verbe: 'verbeDeRecette', focus: false, refus: null,
  champs: [{
    type: 'saisieCoches', id: 'cases/c', ton: 'neutre', nom: 'c', optionnel: false, libelle: 'Saisie c',
    valeurs: [{ libelle: 'Case A', valeur: 'a', presse: true, refus: null }, { libelle: 'Case B', valeur: 'b', presse: false, refus: null }, { libelle: 'Case C', valeur: 'c', presse: false, refus: 'Refusée' }],
  }],
};

/** Un curseur réglable, à des bornes qu'une glissière neuve n'a pas : il joue son verbe, ses arguments et la valeur
 *  donnée. */
const CURSEUR: Curseur = { type: 'curseur', id: 'curseur', ton: 'neutre', libelle: 'Curseur de recette', valeur: 4, min: 2, max: 10, pas: 2, verbe: 'verbeDeRecette', arguments: ['designe'], refus: null };

/** Un geste ouvert que sa fermeture refuse, sa raison dite. */
const REFUSE: GesteDeLaFenetre = { cle: 'refuse', verbe: 'verbeDeRecette', libelle: 'Geste refusé', arguments: [], rendu: 'bouton', aChoisir: null, attendu: false, ouvert: true, raison: 'Fermé par le jet', reglage: false };

/** Ce que la saisie `c` dit dessinée, comme Godot la lit (`Saisie.lire`, `saisie.gd`) : `[]` rien de saisi, sinon sa
 *  valeur posée ou pressée, la liste des valeurs pressées d'une rangée de cases, l'objet de ses champs. */
function lueDessinee(c: Saisie): unknown[] {
  switch (c.type) {
    case 'fixe': return [c.valeur];
    case 'saisieChoix': return c.valeurs.filter((v) => v.presse).map((v) => v.valeur);
    case 'saisieCoches': return [c.valeurs.filter((v) => v.presse).map((v) => v.valeur)];
    case 'saisieNombre': return [c.valeur];
    case 'saisieTexte':
    case 'saisieMultiligne': return c.valeur ? [c.valeur] : [];
    case 'saisieJson': return c.valeur ? [JSON.parse(c.valeur)] : [];
    case 'saisieObjet': return [Object.fromEntries(c.champs.flatMap((x) => {
      const lue = lueDessinee(x);
      return !lue.length && x.optionnel ? [] : [[x.nom, lue.length ? lue[0] : null]];
    }))];
  }
}

/** L'intention que le formulaire `f` joue pressé tel qu'il est dessiné (`Saisie.arguments`) : un champ optionnel vide
 *  clôt les arguments, un champ requis vide part `null`. */
function telQueDessine(f: Formulaire): Jeu {
  const args: unknown[] = [];
  for (const c of f.champs) {
    const lue = lueDessinee(c);
    if (!lue.length && c.optionnel) break;
    args.push(lue.length ? lue[0] : null);
  }
  return { type: f.verbe, args };
}

/** Chaque formulaire de `elements` et des entités qu'ils portent. */
const formulaires = (elements: readonly Element[]): Formulaire[] =>
  elements.flatMap((e) => (e.type === 'formulaire' ? [e] : e.type === 'entite' ? formulaires(e.elements) : []));

/** Les vues figées de l'écran, et la planche de chacune de celles qu'une partie montre ; avec `listage`, chaque pont
 *  indexe d'abord ses modèles (`modeles`), et chaque planche porte les corps de ses combattants (`vue.corps`). */
function figerLEcran(listage: Listage | null): { vues: VueFigee[]; planches: Planche[] } {
  const lignes: Ligne[] = [];
  const vues: VueFigee[] = [];
  const planches: Planche[] = [];
  /** Un pont neuf et ses appels ; `jouer` rejoue les jetons de chaque suite sur l'horloge virtuelle et verse les lignes
   *  de chaque suite à `journal`. L'écran de la recette ne fait qu'ajouter à son journal et les ids d'une ligne
   *  repartent de zéro à chaque partie : seul le combat du dôme verse au journal des vues. `planche` rend la planche
   *  de la suite `s` de sa partie. */
  const unPont = (journal: Ligne[]) => {
    const pont = creerPont(null, null);
    let scenario = '';
    const appeler = (methode: string, entree: unknown): Suite => {
      const r = JSON.parse(pont.appeler(methode, JSON.stringify(entree))) as { ok: boolean } & Suite;
      if (!r.ok) throw new Error(`${methode} ${JSON.stringify(entree)} : ${JSON.stringify(r)}`);
      if (methode === 'demarrer') scenario = (entree as { scenario: string }).scenario;
      return r;
    };
    if (listage) appeler('modeles', { manifestes: listage.manifestes, osDesRigides: listage.osDesRigides });
    const mondeDeLaPlanche = (): MondeDeLaPlanche => {
      const monde = JSON.parse(pont.appeler('monde', null)) as MondeDuPont;
      return { monde, morceaux: JSON.parse(pont.appeler('morceaux', JSON.stringify(toutesLesCles(monde)))) };
    };
    const planche = (nom: string, titre: string, s: Suite): Planche => ({
      nom, titre,
      parametres: { scenario },
      demarrer: { ok: true, vue: s.vue, programmes: [], journal: [], zones: { 'journal.lignes': [...journal] }, effets: [] },
      monde: mondeDeLaPlanche(),
      retrait: JSON.parse(pont.appeler('retrait', null)),
      aretes: JSON.parse(pont.appeler('aretes', null)),
    });
    const jouer = (methode: string, entree: unknown): Suite => {
      let s = appeler(methode, entree);
      journal.push(...s.zones['journal.lignes']);
      horlogeVirtuelle((jeton) => {
        s = appeler('reprendre', { jeton });
        journal.push(...s.zones['journal.lignes']);
        return s.programmes;
      }, s.programmes).vider();
      return s;
    };
    return { appeler, jouer, planche, fermer: (): void => void appeler('quitter', {}) };
  };
  /** La suite `s` de la partie de `p` figée : sa vue, nommée `titre`, et sa planche, nommée `nom`. */
  const figer = (p: ReturnType<typeof unPont>, nom: string, titre: string, s: Suite) => {
    vues.push({
      nom: titre, disposition: s.vue.disposition, zones: { ...s.vue.zones, 'journal.lignes': [...lignes] },
      attendus: Object.fromEntries(Object.values(s.vue.zones).flatMap((z) => formulaires(z)).map((f) => [f.id, telQueDessine(f)])),
    });
    planches.push(p.planche(nom, titre, s));
  };
  const focus = (s: Suite): Jeu => {
    const b = enFocus(s.vue);
    if (!b) throw new Error(`aucun bouton que l’Entrée joue dans ${JSON.stringify(gestesDessines(s.vue).map((g) => g.id))}`);
    return b.jeu;
  };
  /** Le geste que l'offre `id` de la barre déclare, tel que l'hôte le dessine. */
  const offre = (s: Suite, id: string): Jeu => s.vue.zones['combat.offres'].flatMap((x) => x.valeurs).find((b) => b.id === id)!.jeu;

  const dome = unPont(lignes);
  const { appeler, jouer, fermer } = dome;
  let s = jouer('demarrer', { scenario: 'dome', graine: 7 });
  figer(dome, 'combat-debut-du-round', 'début du round', s);
  s = jouer('jouer', focus(s));
  figer(dome, 'combat-barre-de-l-actif', 'barre de l’actif', s);
  s = jouer('jouer', offre(s, 'charge'));
  figer(dome, 'combat-charge-armee', 'charge armée', s);
  const [cible] = s.vue.projection.combat!.cibles.liste;
  s = jouer('jouer', clicDuCombattant(s.vue, cible)!);
  figer(dome, 'attaque', 'fenêtre d’attaque', s);
  s = jouer('jouer', focus(s));
  figer(dome, 'attaque-jet-tombe', 'jet d’attaque tombé', s);
  s = jouer('jouer', focus(s));
  for (let tours = 0; s.vue.projection.fenetre?.etape?.genre !== 'jetDeDefense'; tours++) {
    if (tours > 4) throw new Error(`aucune Défense après ${tours} fins de tour : ${JSON.stringify(s.vue.projection.fenetre)}`);
    s = jouer('jouer', offre(s, 'fin-de-tour'));
    if (s.vue.projection.combat!.finDeTourArmee) s = jouer('jouer', offre(s, 'fin-de-tour'));
  }
  figer(dome, 'defense', 'Défense', s);
  s = jouer('jouer', focus(s));
  figer(dome, 'defense-jet-tombe', 'jet de Défense tombé', s);
  /** Le geste du joueur pressé : dans une fenêtre, son geste en focus, sinon sa première valeur ouverte ; sinon, une
   *  charge ou une attaque sur la première cible, ou la fin du tour. */
  const presse = (s: Suite): Jeu => {
    const c = s.vue.projection.combat!;
    if (s.vue.projection.fenetre) {
      return enFocus(s.vue)?.jeu ?? gestesDessines(s.vue).flatMap((x) => (x.type === 'choix' ? x.valeurs : [])).find((b) => !b.refus)!.jeu;
    }
    const offres = s.vue.zones['combat.offres'].flatMap((x) => x.valeurs).filter((b) => !b.refus);
    return c.intention && c.cibles.liste.length ? clicDuCombattant(s.vue, c.cibles.liste[0])!
      : (offres.find((o) => !c.intention && (o.id === 'charge' || o.id === 'attaque')) ?? offres.find((o) => o.id === 'fin-de-tour')!).jeu;
  };
  for (let pas = 0; s.vue.projection.fenetre?.etape?.genre !== 'critique'; pas++) {
    const c = s.vue.projection.combat!;
    if (pas > 300 || c.fin) throw new Error(`aucun Coup Critique après ${pas} gestes : combat ${c.fin ?? 'en cours'}`);
    s = jouer('jouer', presse(s));
  }
  figer(dome, 'coup-critique', 'Coup Critique', s);
  s = appeler('fiche', s.vue.zones['groupe.heros'][0].elements.find((e): e is Bouton => e.type === 'bouton' && e.id.startsWith('fiche/'))!.jeu);
  figer(dome, 'fiche-du-heros', 'fiche du héros, son statbloc', s);
  const possessions = s.vue.zones['fiche.sections'].find((e) => e.id === 'section/possessions')!.elements;
  s = appeler('fiche', possessions.find((e): e is Bouton => e.type === 'bouton')!.jeu);
  figer(dome, 'fiche-possession', 'fiche du héros, une possession choisie', s);
  s = appeler('fiche', { fiche: { porteur: cible } });
  figer(dome, 'fiche-adversaire', 'fiche d’un adversaire, son statbloc', s);
  s = appeler('fiche', s.vue.zones['fiche.gestes'][0].jeu);
  const fini = (s: Suite) => !!s.vue.projection.combat?.fin && !!s.vue.projection.fenetre && !s.vue.projection.fenetre.etape;
  for (let pas = 0; !fini(s); pas++) {
    if (pas > 600) throw new Error(`aucune fin du combat après ${pas} gestes`);
    s = jouer('jouer', presse(s));
  }
  figer(dome, 'fin-du-combat', `fin du combat, ${s.vue.zones['fenetre.titre'][0]?.texte ?? 'sans fenêtre'}`, s);
  fermer();

  /** Une fenêtre après l'autre, chacune par son geste pressé, tant qu'une tient la main. */
  const viderLesFenetres = (j: ReturnType<typeof unPont>['jouer'], s: Suite): Suite => {
    for (let pas = 0; s.vue.projection.fenetre; pas++) {
      if (pas > 20) throw new Error(`fenêtres sans fin : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
      s = j('jouer', presse(s));
    }
    return s;
  };

  const liasse = unPont([]);
  s = viderLesFenetres(liasse.jouer, liasse.jouer('demarrer', { scenario: 'documents-edo', graine: 7 }));
  s = liasse.jouer('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 2, y: 2 }] });
  s = liasse.jouer('jouer', s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Liasse de documents : Parcourir la liasse')!.jeu);
  const reponse = (debut: string) => s.vue.zones['dialogue.reponses'].find((b) => b.libelle.startsWith(debut))!.jeu;
  s = liasse.jouer('jouer', reponse('Chapitre 1'));
  s = liasse.jouer('jouer', reponse('Lire'));
  figer(liasse, 'document', 'pièce remise, la première de la liasse', s);
  liasse.fermer();

  const magie = unPont([]);
  s = viderLesFenetres(magie.jouer, magie.jouer('demarrer', { scenario: 'magie', graine: 7 }));
  s = viderLesFenetres(magie.jouer, magie.jouer('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 16, y: 11 }] }));
  const sorts = s.vue.zones['combat.offres'].find((c): c is Choix => c.id === 'offre/incantation')!;
  s = magie.jouer('jouer', sorts.valeurs.find((b) => b.libelle === 'Fléchette')!.jeu);
  figer(magie, 'sort-choisi', 'sort choisi parmi ceux de l’actif', s);
  figer(magie, 'fiche-du-lanceur', 'fiche du lanceur, son statbloc et ses sorts', magie.appeler('fiche', { fiche: { porteur: s.vue.projection.combat!.actif!.id } }));
  s = magie.appeler('fiche', { fiche: null });
  s = magie.jouer('jouer', clicDuCombattant(s.vue, s.vue.projection.combat!.cibles.liste[0])!);
  figer(magie, 'incantation', 'fenêtre d’incantation', s);
  s = magie.jouer('jouer', focus(s));
  figer(magie, 'incantation-jet-tombe', 'jet d’incantation tombé', s);
  s = magie.jouer('jouer', (s.vue.zones['fenetre.reglages'][0] as Choix).valeurs[1].jeu);
  figer(magie, 'surincantation', 'un pas de Surincantation alloué', s);
  magie.fermer();

  const voyage = unPont([]);
  s = viderLesFenetres(voyage.jouer, voyage.jouer('demarrer', { scenario: 'voyage', graine: 7 }));
  s = voyage.jouer('jouer', s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
  figer(voyage, 'carte-du-monde', 'carte du monde', s);
  const plan = s.vue.zones['fenetre.corps'].find((e): e is Plan => e.type === 'plan')!;
  s = voyage.jouer('jouer', plan.points.flatMap((p) => p.elements).find((e): e is Choix => e.id === 'r-grandroute')!.valeurs[0].jeu);
  figer(voyage, 'voyage-jets', 'voyage : la journée arrêtée aux jets des héros', s);
  for (let pas = 0; !s.vue.zones['fenetre.corps'].some((e) => e.id === 'recit/issue'); pas++) {
    if (pas > 80) throw new Error(`aucun récit de voyage après ${pas} gestes : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
    if (pas === 4) figer(voyage, 'voyage-jets-tombes', 'voyage : les jets des héros tombés, la Chance à saisir', s);
    if (s.vue.disposition === 'repos') figer(voyage, 'repos', 'repos, la nuit à régler', s);
    s = voyage.jouer('jouer', presse(s));
  }
  figer(voyage, 'recit-d-arrivee', 'récit de voyage, arrivée', s);
  s = voyage.jouer('jouer', focus(s));
  figer(voyage, 'lieu', 'écran du lieu, ses services et ses trajets', s);
  const forgeron = s.vue.zones['fenetre.corps'].find((e): e is Entite => e.id === 'service/forgeron')!;
  s = voyage.jouer('jouer', forgeron.elements.find((e): e is Bouton => e.type === 'bouton')!.jeu);
  figer(voyage, 'echoppe', 'échoppe : l’étal et ses prix, le panier vide, les possessions à vendre', s);
  const article = s.vue.zones['fenetre.corps'].filter((e): e is Entite => e.id.startsWith('etal/')).flatMap((f) => f.elements as Bouton[]).find((b) => !b.refus)!;
  s = voyage.jouer('jouer', article.jeu);
  figer(voyage, 'echoppe-panier', 'échoppe : un article au panier, son total à payer', s);
  voyage.fermer();

  const repit = unPont([]);
  s = repit.jouer('demarrer', { scenario: 'bataille-de-masse', graine: 7 });
  for (let pas = 0; !s.vue.zones['fenetre.corps'].some((e) => e.id === 'repit/semaines'); pas++) {
    if (pas > 12) throw new Error(`aucun répit entre deux aventures après ${pas} gestes : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
    s = repit.jouer('jouer', focus(s));
  }
  figer(repit, 'repit', 'entre deux aventures, un onglet par héros', s);
  s = repit.jouer('jouer', focus(s));
  const geste = (s: Suite, id: string): Jeu => {
    const b = s.vue.zones['fenetre.corps'].find((e): e is Bouton => e.type === 'bouton' && e.id === id);
    if (!b) throw new Error(`aucun geste ${id} dans ${JSON.stringify(s.vue.zones['fenetre.corps'].map((e) => e.id))}`);
    return b.jeu;
  };
  figer(repit, 'bataille-scenes', 'bataille de masse, les Scènes du Round', s);
  s = repit.jouer('jouer', geste(s, 'bataille/geste/0'));
  figer(repit, 'bataille-entre-rounds', 'bataille de masse, entre deux Rounds', s);
  repit.fermer();

  const forge = unPont([]);
  s = forge.jouer('demarrer', { scenario: 'entre-deux-aventures', graine: 7 });
  for (let pas = 0; !s.vue.zones['fenetre.corps'].some((e) => e.id === 'repit/semaines'); pas++) {
    if (pas > 8) throw new Error(`aucun répit entre deux aventures après ${pas} gestes : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
    s = forge.jouer('jouer', focus(s));
  }
  figer(forge, 'repit-ouvrage', 'entre deux aventures, l’ouvrage et le dépôt du forgeron', s);
  forge.fermer();

  /** Le marché du scénario `scenario`, entré par le seul service de son lieu ; ses dés tombés, il montre la bourse. */
  const auMarche = (scenario: string) => {
    const p = unPont([]);
    let m = viderLesFenetres(p.jouer, p.jouer('demarrer', { scenario, graine: 7 }));
    m = p.jouer('jouer', m.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Le lieu')!.jeu);
    m = p.jouer('jouer', m.vue.zones['fenetre.corps'].find((e): e is Entite => e.id.startsWith('service/'))!.elements.find((e): e is Bouton => e.type === 'bouton')!.jeu);
    for (let pas = 0; !m.vue.zones['fenetre.corps'].some((e) => e.id === 'bourse'); pas++) {
      if (pas > 12) throw new Error(`aucun marché après ${pas} gestes : ${JSON.stringify(m.vue.zones['fenetre.titre'])}`);
      m = p.jouer('jouer', presse(m));
    }
    return { p, m };
  };
  const halle = auMarche('commerce-fluvial');
  figer(halle.p, 'halle', 'halle : chaque offre, son prix par Enc et son achat', halle.m);
  const achat = halle.m.vue.zones['fenetre.corps'].flatMap((e) => (e.type === 'entite' ? e.elements : [])).find((x): x is Bouton => x.id === 'acheter')!;
  const compose = halle.p.jouer('jouer', achat.jeu);
  figer(halle.p, 'halle-achat', 'halle : l’achat en composition, son porteur, son Enc', compose);
  const conclure = compose.vue.zones['fenetre.reglages'].find((x): x is Choix => x.type === 'choix' && x.id.endsWith('#acheter'))!.valeurs[0];
  figer(halle.p, 'halle-lot', 'halle : un lot acheté, sa vente, son bradage, son transfert', halle.p.jouer('jouer', conclure.jeu));
  halle.p.fermer();
  const port = auMarche('voyage-maritime');
  figer(port.p, 'port', 'escale maritime : la bourse et la cale du navire', port.m);
  port.p.fermer();

  const vides: ZonesDeLEcran = {
    'fenetre.titre': [], 'fenetre.etape': [], 'fenetre.corps': [], 'fenetre.reglages': [], 'fenetre.gestes': [],
    'combat.tour': [], 'combat.ordre': [], 'combat.actif': [], 'combat.avis': [], 'combat.apercu': [], 'combat.offres': [], 'exploration.gestes': [], 'dialogue.orateur': [], 'dialogue.replique': [], 'dialogue.reponses': [], 'journal.titre': [],
    'groupe.heros': [], 'fiche.porteur': [], 'fiche.gestes': [], 'fiche.profil': [], 'fiche.sections': [], 'fiche.source': [], 'fiche.objet': [],
    'groupe.gestes': [], 'creation.titre': [], 'creation.corps': [], 'creation.gestes': [], 'groupe.pretires': [], 'groupe.roster': [], 'groupe.import': [], 'groupe.avis': [], 'groupe.campagnes': [], 'partie.gestes': [],
  };
  const atelier = unPont([]);
  s = viderLesFenetres(atelier.jouer, atelier.jouer('demarrer', { scenario: 'marche-equipement', graine: 7 }));
  /** Le geste de la création que l'élément `id` de `zone` offre, ou celle de ses valeurs que dit `valeur`. */
  const deLaCreation = (zone: 'groupe.gestes' | 'creation.corps' | 'creation.gestes', id: string, valeur?: string): Jeu => {
    const e = s.vue.zones[zone].find((x) => x.id === id)!;
    return (e.type === 'choix' ? e.valeurs.find((v) => v.libelle === valeur)! : e as Bouton).jeu;
  };
  s = atelier.appeler('creation', deLaCreation('groupe.gestes', 'creation'));
  figer(atelier, 'creation-race', 'création, la race avant le d100', s);
  s = atelier.appeler('creation', deLaCreation('creation.corps', 'tirage'));
  figer(atelier, 'creation-race-tiree', 'création, la race tirée', s);
  s = atelier.appeler('creation', deLaCreation('creation.gestes', 'suivante'));
  s = atelier.appeler('creation', deLaCreation('creation.corps', 'tirage'));
  figer(atelier, 'creation-carriere', 'création, la carrière tirée', s);
  s = atelier.appeler('creation', deLaCreation('creation.gestes', 'suivante'));
  s = atelier.appeler('creation', deLaCreation('creation.corps', 'methode', 'Répartir 100 points'));
  figer(atelier, 'creation-caracteristiques', 'création, les Caractéristiques en 100 points', s);
  atelier.fermer();

  vues.push({
    nom: 'formulaire de chaque saisie',
    disposition: null,
    zones: { ...vides, 'fenetre.titre': [ligne('titre', 'Formulaire de recette')], 'fenetre.corps': [CURSEUR], 'fenetre.gestes': [...elementsDesGestes([FORMULAIRE, REFUSE]), CASES], 'journal.lignes': [...lignes] },
    attendus: { [FORMULAIRE.cle]: { type: FORMULAIRE.verbe, args: ARGUMENTS_DU_FORMULAIRE }, [CASES.id]: { type: CASES.verbe, args: [['a']] } },
  });
  return { vues, planches };
}

export const figerVuesDeLEcran = (): VueFigee[] => figerLEcran(null).vues;
/** Les planches de l'écran, leurs corps composés sur les modèles de `listage`. */
export const figerLesPlanches = (listage: Listage): Planche[] => figerLEcran(listage).planches;
