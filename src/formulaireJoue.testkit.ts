/**
 * LE JEU DES OFFRES D'UN FORMULAIRE TIRÉ DU SCHÉMA (garde #841, #4020), pour tout porteur : les éléments qu'un hôte
 * en tire (`src/hote/formulaire.ts`) offrent le geste `valeur` ; chaque offre se joue comme le pont la reçoit, son jeu
 * passé en JSON et validé par les zones de son porteur, et chaque écriture devient un `EcritureJouee`, le document relu
 * avant et après, que la garde crédite (`scripts/guards/lib/editabiliteDesChamps.mjs`). Les zones du porteur, leur
 * validation, le jeu d'un geste et la lecture de sa donnée sont son banc (`BancDuFormulaire`), celui de l'éditeur de
 * scène (`src/ecrituresJouees.testkit.ts`).
 */
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import type { Segment } from './noyau/index';
import { estObjet } from './lib/objet.mjs';
import { auChemin } from './noyau/edition/adresseDeProse';
import type { EcritureJouee } from '../scripts/guards/lib/editabiliteDesChamps.mjs';

/** Un élément d'un formulaire tiré du schéma, tel que ses zones le portent. */
type Element = Choix | Ligne | Bouton | Formulaire;

/** Le geste `valeur` d'un porteur : écrire `valeur` au chemin `chemin` de sa donnée (absente : le champ se retire). */
interface GesteDeValeur { geste: 'valeur'; chemin: Segment[]; valeur?: unknown }

/** Ce qu'un porteur donne au jeu de ses offres, de session `S`, de zones `Z`, de gestes `G` :
 *  - `zones`, celles de la session que lit le jeu de ses offres, et `elements`, les éléments de son formulaire ;
 *  - `deballe`, le geste qu'emballe le jeu d'un bouton ; `geste`, celui que valident les zones d'un jeu reçu en JSON ;
 *  - `jouer`, la session après un geste ;
 *  - `porteur`, la clé qui nomme le porteur d'un geste `valeur`, sa donnée et son chemin depuis son document ;
 *    `document`, ce document, que la garde relit avant et après. */
export interface BancDuFormulaire<S, Z, G extends { geste: string }> {
  zones(s: S): Z;
  elements(z: Z): readonly Element[];
  deballe(jeu: Jeu): unknown;
  geste(z: Z, s: S, jeu: Jeu): G | undefined;
  jouer(s: S, g: G): S;
  porteur(s: S, g: Extract<G, GesteDeValeur>): { cle: string; donnee: unknown; chemin: Segment[] } | undefined;
  document(s: S, g: Extract<G, GesteDeValeur>): unknown;
}

/** Ce qu'un élément du formulaire offre de jouer au geste `valeur` : son id, le jeu de l'élément, sa saisie, le chemin
 *  qu'il écrit et la valeur qu'il y pose, s'il emporte des champs (`emporte` : le retrait d'un élément de liste, son
 *  déplacement, le choix d'une autre variante d'union), à jouer après ceux qu'il emporte. Le geste d'un élément de liste à son rang
 *  (`rang` : « Ajouter », « Retirer », « Monter ») écrit la liste qui le porte, au chemin de celle-ci, sa valeur lue après lui. */
interface Offre { id: string; jeu: Jeu; saisie: string; chemin: Segment[]; valeur: unknown; emporte: boolean; rang?: true }

/** Le chemin `chemin` redescend-il dans une clé qu'il a déjà traversée : un schéma récursif (le Trait conféré d'un
 *  Trait), qui se joue à son premier niveau ? */
const recursif = (chemin: readonly Segment[]): boolean => {
  const cles = chemin.filter((p) => typeof p === 'string');
  return new Set(cles).size < cles.length;
};

/** Au plus autant de gestes joués : la boucle se termine même si un formulaire en ouvrait sans fin. */
const GESTES_AU_PLUS = 4000;

/** La valeur à jouer dans la saisie `s` d'un formulaire `valeur` : un nombre autre que le courant, dans ses bornes ; un
 *  texte ; une liste vide pour du JSON. */
function valeurSaisie(s: Formulaire['champs'][number]): unknown {
  switch (s.type) {
    case 'saisieNombre': return s.valeur + s.pas <= s.max ? s.valeur + s.pas : s.valeur - s.pas;
    case 'saisieTexte':
    case 'saisieMultiligne': return 'texte joué';
    default: return [];
  }
}

/** L'élément d'id `id`, qui écrit au chemin `chemin`, est-il « Ajouter » d'une liste, au rang qui suit son dernier
 *  élément (`valeur/<chemin de la liste>/ajouter`, ou l'une de ses valeurs) ? */
const ajoutAuRang = (id: string, chemin: readonly Segment[]): boolean => {
  const ajout = `valeur/${chemin.slice(0, -1).join('/')}/ajouter`;
  return typeof chemin[chemin.length - 1] === 'number' && (id === ajout || id.startsWith(`${ajout}/`));
};

/** Les offres du geste `valeur` des éléments `elements` d'un porteur au banc `banc` : un bouton qui pose une valeur
 *  (« Ajouter »), ou qui ajoute, retire ou monte un élément de liste à son rang (`Offre.rang`) ; la première valeur non pressée
 *  d'un choix, qui emporte des champs si elle choisit une variante (son id n'est pas celui de son chemin) ; un
 *  formulaire, sa saisie remplie (`valeurSaisie`) ; hors d'un chemin récursif (`recursif`). Un retrait (« Retirer »,
 *  « Aucune ») hors d'un élément de liste ne pose aucune valeur et ne s'offre pas. */
function offres<S, Z, G extends { geste: string }>(banc: BancDuFormulaire<S, Z, G>, elements: readonly Element[]): Offre[] {
  return elements.flatMap((e): Offre[] => {
    if (e.type === 'bouton') {
      const g = banc.deballe(e.jeu);
      if (!estObjet(g) || !Array.isArray(g.chemin)) return [];
      const chemin = g.chemin as Segment[];
      const pose = g.geste === 'valeur' && 'valeur' in g;
      if (pose && !ajoutAuRang(e.id, chemin)) return [{ id: e.id, jeu: e.jeu, saisie: 'bouton', chemin, valeur: g.valeur, emporte: false }];
      const auRang = typeof chemin[chemin.length - 1] === 'number' && (g.geste === 'monter' || g.geste === 'valeur');
      return auRang ? [{ id: e.id, jeu: e.jeu, saisie: 'bouton', chemin: chemin.slice(0, -1), valeur: [], emporte: !pose, rang: true }] : [];
    }
    if (e.type === 'choix' || e.type === 'liste') {
      const b = e.valeurs.find((v) => !v.presse && 'type' in v.jeu && v.jeu.type === 'valeur');
      const [ecrit, pose] = (b && 'args' in b.jeu ? b.jeu.args.slice(1) : [[]]) as [Segment[], unknown];
      const rang = ajoutAuRang(e.id, ecrit);
      const [chemin, valeur] = rang ? [ecrit.slice(0, -1), []] : [ecrit, pose];
      return b ? [{ id: e.id, jeu: b.jeu, saisie: 'saisieChoix', chemin, valeur, emporte: e.id !== `valeur/${chemin.join('/')}`, ...(rang ? { rang: true as const } : {}) }] : [];
    }
    if (e.type !== 'formulaire' || e.verbe !== 'valeur') return [];
    const [porteur, chemin, saisie] = e.champs;
    if (porteur.type !== 'fixe' || chemin.type !== 'fixe' || !saisie) return [];
    const valeur = valeurSaisie(saisie);
    return [{ id: e.id, jeu: { type: 'valeur', args: [porteur.valeur, chemin.valeur, valeur] }, saisie: saisie.type, chemin: chemin.valeur as Segment[], valeur, emporte: false }];
  }).filter((o) => !recursif(o.chemin));
}

/** La FORME d'une valeur : ses clés, pour un objet, chacun des `discriminants` avec sa valeur ; sinon son type. */
const forme = (v: unknown, discriminants: ReadonlySet<string>): string =>
  Array.isArray(v) ? '[]' : estObjet(v) ? Object.keys(v).sort().map((k) => (discriminants.has(k) ? `${k}=${JSON.stringify(v[k])}` : k)).join(',') : typeof v;

/** Les empreintes déjà jouées de chaque partie, par son `out`. */
const empreintesJouees = new WeakMap<EcritureJouee[], Set<string>>();

/** Les clés des discriminants des variantes choisies dans chaque partie (`ecrire`), par son `out`. */
const discriminantsJoues = new WeakMap<EcritureJouee[], Set<string>>();

/** L'ensemble de la partie `out` dans `table`, créé vide. */
const deLaPartie = <T>(table: WeakMap<EcritureJouee[], Set<T>>, out: EcritureJouee[]): Set<T> => table.get(out) ?? table.set(out, new Set()).get(out)!;

/** Un chapitre du `Source/` versionné dont la première section à table porte une table titrée : le chapitre 13 du
 *  Livre de base (« Localisation »), où une cellule se désigne avec sa table. */
const CHAPITRE_A_TABLE = { book: 'livre-de-base', ch: '13' } as const;

/** Un chapitre du `Source/` versionné où une section à table revient (`secOcc`) : les « Armures » du chapitre 63 du
 *  Livre de base. */
const CHAPITRE_A_OCCURRENCES = { book: 'livre-de-base', ch: '63', sec: 'armures' } as const;

/** Le fragment `v` est-il une cellule ? */
const estCellule = (v: unknown): boolean => estObjet(v) && v.kind === 'cellule';

/** Le choix d'id `id` des éléments `elements`. */
function choixDes(elements: readonly Element[], id: string): Choix {
  const choix = elements.find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === id);
  if (!choix) throw new Error(`aucun choix ${id} dans le formulaire`);
  return choix;
}

/** Le jeu des offres du formulaire du porteur au banc `banc` :
 *  - `jouerLInspecteur`, la session où chaque offre de son formulaire est jouée une fois, celles qui emportent des
 *    champs après les autres, la plus profonde d'abord, jusqu'à ce qu'aucune ne reste ; le choix d'une autre variante
 *    rouvre les offres de ses champs ; seules jouent les offres dont l'id commence par l'une des `branches` (toutes, par
 *    défaut) ; chaque écriture s'ajoute à `out` (`ecrire`), le discriminant du choix d'une variante à l'id de son choix
 *    (`valeur/<chemin>/<discriminant>`). Une offre dont l'empreinte (`empreinte`, sous son propre discriminant s'il est
 *    une clé de sa valeur) a déjà été jouée dans la partie ne s'y ajoute pas ; elle se joue encore si sa valeur est un
 *    objet ou une liste, qui ouvre les offres de ses champs ;
 *  - `ecrire`, la session où un geste `valeur` est joué, son écriture, avec son chemin depuis le document de son
 *    porteur et la saisie qui l'a portée, ajoutée à `out` : celle du choix d'une variante qui porte le `discriminant`,
 *    marquée de sa `variante`, sur une variante quittée, son discriminant et chaque champ qu'elle pose et que la
 *    variante quittée ne portait pas ; sur un champ absent, la variante entière, qui pose le champ ;
 *  - `jouerLesVariantes`, chaque valeur du choix d'id `id`, choisie depuis la session et consignée sous son
 *    discriminant (`ecrire`), les offres de sa seule branche jouées (`jouerLInspecteur`, l'id du choix sans son dernier
 *    pas) ;
 *  - `choix`, le choix d'id `id` du formulaire de la session ; `gesteDuJeu`, le geste du jeu d'un élément de ses
 *    zones, passé en JSON, et `valeurDuJeu`, ce geste quand il est `valeur` ; `gesteDuChoix`, le geste `valeur` du
 *    choix d'id `id` dont la valeur satisfait `voulue` ;
 *  - `composerLAdresse`, les écritures de l'adresse de prose au préfixe d'id `adresse` de la session, chacune choisie
 *    parmi les valeurs que son formulaire offre (`ecrire`) : sur le `CHAPITRE_A_TABLE`, une cellule neuve, une autre
 *    ligne, une autre colonne, sa table, le genre blocs puis de nouveau cellule (`kind`), puis le reste de ses offres
 *    (`jouerLInspecteur`) ; sur le `CHAPITRE_A_OCCURRENCES`, un fragment neuf de chaque genre porté sur sa section,
 *    puis sur une autre occurrence de celle-ci (`secOcc`). Chaque fragment est scellé par l'écriture. */
export function jeuDuFormulaire<S, Z, G extends { geste: string }>(banc: BancDuFormulaire<S, Z, G>) {
  type Valeur = Extract<G, GesteDeValeur>;
  const estValeur = (g: G | undefined): g is Valeur => g?.geste === 'valeur';

  /** Le geste que joue le jeu `jeu` des zones `zones` de la session `s`, passé en JSON comme le pont le reçoit
   *  (`BancDuFormulaire.geste`) ; `undefined` si les zones ne l'offrent pas. */
  const gesteDuJeu = (zones: Z, s: S, jeu: Jeu): G | undefined => banc.geste(zones, s, JSON.parse(JSON.stringify(jeu)) as Jeu);

  /** Le geste `valeur` du jeu `jeu` de l'offre `offre` des zones `zones` de la session `s` (`gesteDuJeu`) ; lève sans lui. */
  function valeurDuJeu(zones: Z, s: S, jeu: Jeu, offre: string): Valeur {
    const geste = gesteDuJeu(zones, s, jeu);
    if (!estValeur(geste)) throw new Error(`l’offre ${offre} ne joue pas le geste valeur`);
    return geste;
  }

  /** L'EMPREINTE de l'écriture `geste` portée par la saisie `saisie` sur la session `s` : la clé de son porteur, son
   *  chemin aux rangs effacés, la forme du porteur et de chaque objet que le chemin traverse ; et la forme de la valeur
   *  jouée, sous les `discriminants` des variantes déjà choisies dans la partie. Deux écritures de même empreinte
   *  écrivent les mêmes champs de la même variante : la seconde ne s'ajoute à rien. */
  function empreinte(s: S, geste: Valeur, saisie: string, discriminants: ReadonlySet<string>): string {
    const porteur = banc.porteur(s, geste);
    let v: unknown = porteur?.donnee;
    const formes = [forme(v, discriminants)];
    for (const pas of geste.chemin.slice(0, -1)) {
      v = estObjet(v) || Array.isArray(v) ? (v as Record<string | number, unknown>)[pas] : undefined;
      formes.push(forme(v, discriminants));
    }
    return JSON.stringify([porteur?.cle, geste.chemin.map((p) => (typeof p === 'number' ? '#' : p)), saisie, formes, forme(geste.valeur, discriminants)]);
  }

  function ecrire(s: S, geste: Valeur, saisie: string, out: EcritureJouee[], discriminant?: string): S {
    return consigner(s, banc.jouer(s, geste), geste, saisie, out, discriminant);
  }

  /** La session `suite`, jouée depuis `s` par l'écriture `geste`, consignée à `out` (`ecrire`). */
  function consigner(s: S, suite: S, geste: Valeur, saisie: string, out: EcritureJouee[], discriminant?: string): S {
    const avant = banc.document(s, geste);
    const apres = banc.document(suite, geste);
    const porteur = banc.porteur(s, geste)!;
    const quittee = auChemin(porteur.donnee, geste.chemin);
    const variante = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur ? geste.valeur : undefined;
    const ecrits = variante && estObjet(quittee)
      ? Object.keys(variante).filter((cle) => cle === discriminant || !(estObjet(quittee) && cle in quittee)).map((cle) => ({ chemin: [...geste.chemin, cle], valeur: variante[cle] }))
      : [{ chemin: geste.chemin, valeur: geste.valeur }];
    if (variante) deLaPartie(discriminantsJoues, out).add(discriminant!);
    for (const ecrit of ecrits) out.push({ avant, apres, chemin: [...porteur.chemin, ...ecrit.chemin], valeur: ecrit.valeur, saisie, ...(variante ? { variante: discriminant } : {}) });
    return suite;
  }

  function jouerLInspecteur(depart: S, out: EcritureJouee[], branches: readonly string[] = [''], jouees = new Set<string>()): S {
    let s = depart;
    const deja = deLaPartie(empreintesJouees, out);
    for (let n = 0; n < GESTES_AU_PLUS; n++) {
      const zones = banc.zones(s);
      const restantes = offres(banc, banc.elements(zones)).filter((o) => branches.some((b) => o.id.startsWith(b)));
      for (;;) {
        const libres = restantes.filter((o) => !jouees.has(o.id));
        const offre = libres.find((o) => !o.emporte) ?? libres.reduce((a, o) => (o.chemin.length > a.chemin.length ? o : a), libres[0]);
        if (!offre) return s;
        jouees.add(offre.id);
        const choixDeVariante = offre.emporte && offre.saisie === 'saisieChoix';
        const joue = gesteDuJeu(zones, s, offre.jeu);
        if (!joue) throw new Error(`l’offre ${offre.id} n’est pas offerte`);
        // Le geste d'un élément à son rang s'empreint et se consigne en écriture de sa liste (`Offre.rang`).
        const geste = offre.rang ? ({ ...joue, geste: 'valeur', chemin: offre.chemin, valeur: offre.valeur } as Valeur) : valeurDuJeu(zones, s, offre.jeu, offre.id);
        const discriminant = choixDeVariante ? offre.id.slice(`valeur/${geste.chemin.join('/')}/`.length) : undefined;
        const propre = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur;
        const cle = empreinte(s, geste, offre.saisie, propre ? new Set([...deLaPartie(discriminantsJoues, out), discriminant]) : deLaPartie(discriminantsJoues, out));
        const neuve = !deja.has(cle);
        if (!neuve && !estObjet(geste.valeur) && !Array.isArray(geste.valeur)) continue;
        deja.add(cle);
        // Une autre variante choisie rouvre les champs qu'elle porte, homonymes de ceux de la variante quittée.
        if (choixDeVariante) {
          const sous = `valeur/${offre.chemin.join('/')}/`;
          for (const id of jouees) if (id !== offre.id && id.startsWith(sous)) jouees.delete(id);
        }
        const jouee = banc.jouer(s, offre.rang ? joue : geste);
        const ecrite = offre.rang ? ({ ...geste, valeur: auChemin(banc.porteur(jouee, geste)?.donnee, offre.chemin) ?? [] } as Valeur) : geste;
        s = neuve ? consigner(s, jouee, ecrite, offre.saisie, out, discriminant) : jouee;
        break;
      }
    }
    throw new Error(`plus de ${GESTES_AU_PLUS} offres du geste valeur`);
  }

  function jouerLesVariantes(s: S, id: string, out: EcritureJouee[]): void {
    const branche = id.slice(0, id.lastIndexOf('/') + 1);
    const zones = banc.zones(s);
    for (const v of choixDes(banc.elements(zones), id).valeurs) {
      const geste = valeurDuJeu(zones, s, v.jeu, v.id);
      const discriminant = id.slice(`valeur/${geste.chemin.join('/')}/`.length);
      jouerLInspecteur(ecrire(s, geste, 'saisieChoix', out, discriminant), out, [branche]);
    }
  }

  const choix = (s: S, id: string): Choix => choixDes(banc.elements(banc.zones(s)), id);

  function gesteDuChoix(s: S, id: string, voulue: (valeur: unknown) => boolean): Valeur {
    const b = choix(s, id).valeurs.find((v) => 'args' in v.jeu && v.jeu.type === 'valeur' && voulue(v.jeu.args[2]));
    const geste = b && gesteDuJeu(banc.zones(s), s, b.jeu);
    if (!estValeur(geste)) throw new Error(`aucune valeur voulue au choix ${id}`);
    return geste;
  }

  /** Le geste d'une valeur du choix d'id `id` de la session `s` autre que sa valeur pressée. */
  function uneAutreValeur(s: S, id: string): Valeur {
    const pressee = choix(s, id).valeurs.find((v) => v.presse);
    return gesteDuChoix(s, id, (v) => !pressee || !('args' in pressee.jeu) || !Object.is(v, pressee.jeu.args[2]));
  }

  /** La session `s` où l'adresse de prose au préfixe d'id `adresse` (`…/descRef/`) porte le livre et le chapitre de
   *  `chapitre`, chacun choisi à son choix. */
  const surLeChapitre = (s: S, adresse: string, chapitre: { book: string; ch: string }): S =>
    (['book', 'ch'] as const).reduce((x, cle) => banc.jouer(x, gesteDuChoix(x, `${adresse}${cle}`, (v) => v === chapitre[cle])), s);

  function composerLAdresse(s: S, adresse: string, out: EcritureJouee[]): void {
    const parts = `${adresse}parts/`;
    const neuf = (x: S, genre: (v: unknown) => boolean): [S, string] => {
      const ajout = gesteDuChoix(x, `${parts}ajouter`, genre);
      return [ecrire(x, ajout, 'saisieChoix', out), `${parts}${ajout.chemin[ajout.chemin.length - 1]}/`];
    };
    const [cellule, fragment] = neuf(surLeChapitre(s, adresse, CHAPITRE_A_TABLE), estCellule);
    const genre = (kind: string) => (x: S) => ecrire(x, gesteDuChoix(x, `${fragment}kind`, (v) => estObjet(v) && v.kind === kind), 'saisieChoix', out, 'kind');
    const composee = ['row', 'col', 'table'].reduce((x, cle) => ecrire(x, uneAutreValeur(x, `${fragment}${cle}`), 'saisieChoix', out), cellule);
    jouerLInspecteur(genre('cellule')(genre('blocs')(composee)), out, [parts]);
    const occurrences = surLeChapitre(s, adresse, CHAPITRE_A_OCCURRENCES);
    for (const genreNeuf of [estCellule, (v: unknown) => !estCellule(v)]) {
      const [x, f] = neuf(occurrences, genreNeuf);
      const surLaSection = ecrire(x, gesteDuChoix(x, `${f}sec`, (v) => v === CHAPITRE_A_OCCURRENCES.sec), 'saisieChoix', out);
      ecrire(surLaSection, uneAutreValeur(surLaSection, `${f}secOcc`), 'saisieChoix', out);
    }
  }

  return { jouerLInspecteur, ecrire, jouerLesVariantes, choix, gesteDuJeu, valeurDuJeu, gesteDuChoix, composerLAdresse };
}
