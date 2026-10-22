/**
 * L'HÔTE TEXTE SERVI EN MCP (#2898 lot D) : ce que font les trois outils (`outils.ts`), sans le protocole. Le lanceur
 * (`scripts/hote-texte.mjs`) inscrit chaque outil auprès du serveur MCP et lui passe ses entrées validées ; l'hôte rend le
 * texte borné et la catégorie de son erreur. La partie ouverte vit en mémoire, une à la
 * fois (une partie par contexte JS, `branchement.ts`), tenue par ce serveur seul (`Disque.prendre`). Le fichier reste la
 * vérité : chaque geste appliqué s'y ajoute ; un fichier changé hors de l'hôte, ou une mémoire qu'un geste refusé a
 * touchée, se rejoue. Doc généré : `npm run docs:hote-texte`.
 */
import { empreinte, jouerUnGeste, ligneDuFichier, lireLeFichier, rejouer, PISTES_DU_TEXTE, type LigneNumerotee, type PartieRejouee } from './partieTexte';
import { ErreurDeGeste, nouvelEntete, type CategorieDErreur } from '../hote/partie';
import { gesteDuVerbe, lireGeste, offresDeLaBarre, type Geste } from '../hote/geste';
import { VERBES } from '../hote/verbes.generated';
import { appelEcrit, type Lecture } from './outils';
import { casesAtteignables } from '../hote/projection';
import { borner, enSuspens, projeter, rendreLaCarte, rendreLaFiche, rendreLaSuite, rendreLaVue, rendreLeJournal, rendreLesCases, rendreLesGestes, rendreLesOffres, rendreLesVerbes, replier } from './vue';
import { etatDeLaBarre, gestesDExploration } from '../noyau/index';

/** Le disque que le lanceur prête, par NOM de partie : lire son fichier (`null` s'il n'existe pas), l'écrire, y ajouter ;
 *  la prendre pour ce serveur (`null`, ou qui la tient déjà) et la rendre. */
export interface Disque {
  lire: (nom: string) => string | null;
  ecrire: (nom: string, texte: string) => void;
  ajouter: (nom: string, texte: string) => void;
  prendre: (nom: string) => string | null;
  rendre: (nom: string) => void;
}

/** Ce qu'un appel d'outil rend : le texte borné, et la catégorie de son erreur (`isError` du protocole), `null` sans
 *  erreur. Le texte seul porte la réponse : un client MCP qui reçoit des données structurées les montre à l'agent à la
 *  place du texte, hors de ses bornes. */
export interface Reponse {
  texte: string;
  erreur: CategorieDErreur | null;
}

/** Les entrées de chaque outil, validées par le schéma de `outils` avant l'hôte. */
export interface EntreesDeNouvelle {
  partie: string;
  scenario: string;
  graine?: number;
  cadence?: string;
  desFixes?: boolean;
  regles?: Record<string, unknown>;
}
export interface EntreesDeLire {
  quoi: Lecture;
  partie?: string;
  id?: string;
  depuis?: number;
  ligne?: number;
  toutes?: boolean;
}
export type GesteDeLAgent = { offre: string; ctx?: Record<string, unknown> } | { verbe: string; args?: unknown[]; siege?: number };
export interface EntreesDeJouer {
  gestes: GesteDeLAgent[];
  partie?: string;
}

/** Le geste du fichier d'un geste de l'agent : une offre lue telle quelle, un verbe contrôlé contre son type
 *  (`gesteDuVerbe`). */
const gesteControle = (r: PartieRejouee, g: GesteDeLAgent): Geste =>
  'offre' in g ? lireGeste(g) : gesteDuVerbe(r.partie.etat(), { type: g.verbe, args: g.args, siege: g.siege }, PISTES_DU_TEXTE);

/** Le nom d'un geste dans une réponse. */
const nomDuGeste = (g: Geste): string => ('offre' in g ? `offre ${g.offre}` : g.type);

/** Une erreur structurée, rendue : son texte borné et sa catégorie. */
const reponseDErreur = (e: ErreurDeGeste): Reponse => ({
  texte: borner(replier(`erreur ${e.categorie} : ${e.message}`), 'erreur').join('\n'),
  erreur: e.categorie,
});

/** L'hôte : la partie ouverte et les trois outils. */
export function creerHote(disque: Disque) {
  let ouverte: { nom: string; texte: string; r: PartieRejouee } | null = null;

  /** Ferme la partie ouverte et la rend. */
  const fermer = (): void => {
    if (!ouverte) return;
    const { nom, r } = ouverte;
    ouverte = null;
    try {
      r.partie.fermer();
    } finally {
      disque.rendre(nom);
    }
  };

  /** Ouvre la partie `nom` pour ce serveur, sur le texte de son fichier rejoué. */
  function ouvrir(nom: string, texte: string, r: () => PartieRejouee): PartieRejouee {
    fermer();
    const tenue = disque.prendre(nom);
    if (tenue) throw new ErreurDeGeste('permission', `la partie ${nom} est tenue par ${tenue} ; une autre partie, ou ce serveur fermé`);
    try {
      ouverte = { nom, texte, r: r() };
      return ouverte.r;
    } catch (erreur) {
      disque.rendre(nom);
      throw erreur;
    }
  }

  /** La partie `nom` (la dernière ouverte par défaut) : celle en mémoire tant que son fichier n'a pas changé hors de
   *  l'hôte, sinon le fichier rejoué. */
  function partie(nom = ouverte?.nom): { nom: string; r: PartieRejouee } {
    if (!nom) throw new ErreurDeGeste('validation', `aucune partie ouverte : ${appelEcrit('nouvelle')} d’abord, ou \`partie\``);
    const texte = disque.lire(nom);
    if (texte === null) throw new ErreurDeGeste('validation', `aucune partie ${nom} : ${appelEcrit('nouvelle')} d’abord`);
    if (ouverte?.nom === nom && ouverte.texte === texte) return ouverte;
    const { entete, gestes } = lireLeFichier(texte);
    return { nom, r: ouvrir(nom, texte, () => rejouer(entete, gestes)) };
  }

  const projection = (r: PartieRejouee) => projeter(r.partie.etat(), r.gestes.length, r.journal.length);

  function nouvelle(e: EntreesDeNouvelle): Reponse {
    const entete = nouvelEntete(e.scenario, e);
    const texte = ligneDuFichier(entete);
    const r = ouvrir(e.partie, texte, () => rejouer(entete, []));
    disque.ecrire(e.partie, texte);
    const p = projection(r);
    return { texte: borner([`partie neuve ${e.partie} : ${e.scenario}, graine ${entete.graine}, cadence ${entete.cadence}`, ...rendreLaVue(p)], 'nouvelle').join('\n'), erreur: null };
  }

  function lire(e: EntreesDeLire): Reponse {
    const { quoi, id, depuis } = e;
    const rendu = (lignes: string[]): Reponse => ({ texte: lignes.join('\n'), erreur: null });
    if (quoi === 'verbes') return rendu(rendreLesVerbes(VERBES, id, depuis));
    const { r } = partie(e.partie);
    const etat = r.partie.etat();
    switch (quoi) {
      case 'vue':
        return rendu(rendreLaVue(projection(r)));
      case 'fiche': {
        const fiche = id ? rendreLaFiche(etat, id) : null;
        if (!fiche) throw new ErreurDeGeste('validation', `fiche : aucun combattant ${id ?? '(`id` attendu)'} (${appelEcrit('lire', { quoi: 'carte' })})`);
        return rendu(fiche);
      }
      case 'carte':
        return rendu(rendreLaCarte(etat, projection(r), depuis));
      case 'cases':
        return rendu(rendreLesCases(casesAtteignables(etat), depuis));
      case 'journal':
        return rendu(rendreLeJournal(r.journal, depuis, e.ligne ?? 0));
      case 'offres': {
        if (etat.mode === 'exploration') return rendu(rendreLesGestes(gestesDExploration(etat), depuis));
        const barre = etatDeLaBarre(etat);
        if (barre.forme !== 'ouverte') return rendu([`aucune offre : ${barre.raison}`]);
        return rendu(rendreLesOffres(etat, offresDeLaBarre(etat, PISTES_DU_TEXTE), { id, toutes: e.toutes ?? false, depuis }));
      }
    }
  }

  function jouer(e: EntreesDeJouer): Reponse {
    const lue = partie(e.partie);
    const nom = lue.nom;
    let r = lue.r;
    const refusAvant = r.partie.etat().refus?.nonce;
    const appliques: string[] = [];
    const lignes: LigneNumerotee[] = [];
    let jetons = 0;
    let refus: ErreurDeGeste | null = null;
    const leves: string[] = [];
    for (const brut of e.gestes) {
      const avant = empreinte(r.partie.etat());
      const suspendus = enSuspens(r.partie.etat());
      try {
        const geste = gesteControle(r, brut);
        lignes.push(...jouerUnGeste(r, geste));
        const ligne = ligneDuFichier(geste);
        disque.ajouter(nom, ligne);
        ouverte!.texte += ligne;
        jetons += r.reprises[r.gestes.length];
        appliques.push(nomDuGeste(geste));
        const restent = enSuspens(r.partie.etat());
        leves.push(...suspendus.filter((x) => !restent.includes(x)));
      } catch (erreur) {
        if (!(erreur instanceof ErreurDeGeste)) throw erreur;
        refus = erreur;
        // Un geste refusé après son envoi a pu toucher l'état (son refus, une mutation en place) : la mémoire se rejoue
        // depuis le fichier, qui ne l'a pas écrit.
        if (empreinte(r.partie.etat()) !== avant) {
          fermer();
          r = partie(nom).r;
        }
        break;
      }
    }
    const etat = r.partie.etat();
    const p = projection(r);
    const total = e.gestes.length;
    const refusNeuf = etat.refus && etat.refus.nonce !== refusAvant ? ` · refus : ${etat.refus.texte}` : '';
    const issue = appliques.length
      ? [`${appliques.length === total ? '' : `${appliques.length}/${total} `}appliqué${appliques.length > 1 ? 's' : ''} : ${appliques.join(' · ')}${jetons ? ` · ${jetons} jeton${jetons > 1 ? 's' : ''} repris` : ''}${leves.length ? ` · levé : ${leves.join(', ')}` : ''}${refusNeuf}`]
      : [];
    const refuse = refus ? replier(`geste ${appliques.length + 1}/${total} refusé, rien de lui ne s’écrit : erreur ${refus.categorie} : ${refus.message}`) : [];
    return { texte: rendreLaSuite([...issue, ...refuse], lignes, rendreLaVue(p)).join('\n'), erreur: refus?.categorie ?? null };
  }

  /** Un appel d'outil : son rendu, ou l'erreur structurée qui le refuse. Une faute interne ferme la partie, que l'appel
   *  suivant rejoue depuis son fichier. */
  const appel = <E>(faire: (e: E) => Reponse) => (e: E): Reponse => {
    try {
      return faire(e);
    } catch (erreur) {
      if (erreur instanceof ErreurDeGeste) return reponseDErreur(erreur);
      fermer();
      throw erreur;
    }
  };

  return { nouvelle: appel(nouvelle), lire: appel(lire), jouer: appel(jouer), fermer };
}
