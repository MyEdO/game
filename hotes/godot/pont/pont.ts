/**
 * LE PONT DE L'HÔTE GODOT (#2928, contrat `CONTRAT.md`) : le transport JSON entre Godot et le noyau. Une méthode reçoit
 * au plus une chaîne JSON et rend toujours une chaîne JSON, `{ ok: true, … }` ou `{ ok: false, erreur }` ; elle ne lève
 * jamais. Le pont ne porte aucune règle : un geste passe par le module commun des hôtes (`src/hote/`), la vue est faite
 * des lecteurs du noyau, les jetons programmés sont tenus par numéro et rejoués quand Godot les rend.
 */
import { CLICS_DU_CHAMP, fenetreDAttaque, fenetreDeDefense, plateauDeLaScene, type FenetreDAttaque, type FenetreDeDefense, type LigneDuJournal, type ResultatDeLAppel } from '../../../src/noyau/index';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie, valider, type CategorieDErreur, type PartieOuverte, type Programme } from '../../../src/hote/partie';
import { envoyerLIntention, gesteDuVerbe, intentionDuGeste, lireGeste, SANS_PISTE } from '../../../src/hote/geste';
import { casesAtteignables, projeter, type BornesDeLaProjection, type CaseAtteignable, type Projection } from '../../../src/hote/projection';
import { estObjet } from '../../../src/hote/formes';
import { modelesDesCombattants, type CouvertureDesModeles } from './equipement';
import { fenetreADessiner, type FenetreADessiner } from '../../../src/hote/gestes';
import { panneauDuCombat, type PanneauDuCombat } from '../../../src/hote/ecran';

/** La catégorie d'une erreur du pont : celle d'un geste, ou `interne` pour une levée qu'aucun contrôle n'attendait. */
export type CategorieDuPont = CategorieDErreur | 'interne';

/** Une réponse du pont, avant sa mise en JSON. */
type Reponse = ({ ok: true } & Record<string, unknown>) | { ok: false; erreur: { categorie: CategorieDuPont; message: string } };

/** Une erreur de la page (`error`, `unhandledrejection`), relevée entre deux appels de `erreursGlobales`. */
interface ErreurGlobale {
  message: string;
  source: string | null;
}

/** La vue : la projection commune (`projeter`), la fenêtre qui tient la main prête à dessiner (`fenetreADessiner` : son
 *  titre, chacun de ses verbes et de ses arguments), la fenêtre d'attaque et celle de la Défense en données
 *  (`fenetreDAttaque`, `fenetreDeDefense`), le panneau du combat en mots du joueur (`panneauDuCombat` : le tour, la
 *  fiche de l'actif, l'aperçu, le libellé de chaque offre), les cases atteignables au tour de l'actif
 *  (`casesAtteignables`), le plateau de la scène (`plateauDeLaScene`), et les clics du champ par ce qu'ils désignent
 *  (`CLICS_DU_CHAMP`). */
export interface VueDuPont extends CouvertureDesModeles {
  projection: Projection;
  fenetre: FenetreADessiner | null;
  attaque: FenetreDAttaque | null;
  defense: FenetreDeDefense | null;
  panneau: PanneauDuCombat | null;
  cases: CaseAtteignable[];
  plateau: ReturnType<typeof plateauDeLaScene> | null;
  champ: typeof CLICS_DU_CHAMP;
}

/** Ce qu'un appel qui touche la partie rend : la vue d'après, les jetons qu'il a programmés, ses lignes de journal. */
export interface Suite {
  vue: VueDuPont;
  programmes: Programme[];
  journal: LigneDuJournal[];
}

/** Godot dessine tout : aucune liste de la projection n'est bornée. */
const SANS_BORNE: BornesDeLaProjection = { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity };

/** Les clés de l'entrée d'un geste : celles d'une offre, ou celles d'un verbe (`Geste`). */
const clesDuGeste = (e: Record<string, unknown>): readonly string[] => ('offre' in e ? ['offre', 'ctx'] : ['type', 'args', 'siege']);

/** L'entrée d'une méthode : l'objet JSON de `json` (aucune entrée, ou `null` : `{}`), dont chaque clé est l'une de ses
 *  `cles`. */
function entreeDe(methode: string, json: string | null | undefined, cles: readonly string[] | ((e: Record<string, unknown>) => readonly string[])): Record<string, unknown> {
  if (json == null) return {};
  let entree: unknown;
  try {
    entree = JSON.parse(json);
  } catch {
    throw new ErreurDeGeste('validation', `${methode} : entrée JSON illisible`);
  }
  valider(estObjet(entree), `${methode} : l’entrée est un objet JSON`);
  const e = entree as Record<string, unknown>;
  const admises = typeof cles === 'function' ? cles(e) : cles;
  const enTrop = Object.keys(e).filter((k) => !admises.includes(k));
  valider(!enTrop.length, `${methode} : ${enTrop.join(', ')} hors de l’entrée (${admises.length ? `clés : ${admises.join(', ')}` : 'aucune clé'})`);
  return e;
}

/** Le pont : ses méthodes, chacune appelée par `appeler`. */
export function creerPont() {
  let ouverte: (PartieOuverte & { pas: number; lignes: number }) | null = null;
  const erreurs: ErreurGlobale[] = [];

  const demarree = () => {
    if (!ouverte) throw new ErreurDeGeste('validation', 'aucune partie : demarrer d’abord');
    return ouverte;
  };

  const vueDe = (o: NonNullable<typeof ouverte>): VueDuPont => {
    const etat = o.partie.etat();
    const projection = projeter(etat, o.pas, o.lignes, SANS_BORNE);
    return {
      projection,
      ...modelesDesCombattants(projection.combat?.voisins.liste ?? []),
      fenetre: fenetreADessiner(etat),
      attaque: fenetreDAttaque(etat),
      defense: fenetreDeDefense(etat),
      panneau: panneauDuCombat(projection),
      cases: casesAtteignables(etat),
      plateau: etat.scene ? plateauDeLaScene(etat.scene) : null,
      champ: CLICS_DU_CHAMP,
    };
  };

  const suite = (o: NonNullable<typeof ouverte>, resultat: ResultatDeLAppel): Suite => {
    const programmes = o.jetons.programmes(resultat);
    o.lignes += resultat.journal.length;
    return { vue: vueDe(o), programmes, journal: resultat.journal };
  };

  const methodes: Record<string, (json?: string | null) => object> = {
    demarrer(json) {
      const e = entreeDe('demarrer', json, ['scenario', 'graine']);
      valider(!ouverte, 'demarrer : une partie par page, déjà démarrée ; recharger la page pour en commencer une autre');
      valider(typeof e.scenario === 'string', 'demarrer : scenario, l’id d’un scénario de test');
      const o = ouvrirLaPartie(nouvelEntete(e.scenario as string, { graine: e.graine as number | undefined }));
      ouverte = { ...o, pas: 0, lignes: 0 };
      return suite(ouverte, o.lancement);
    },
    vue(json) {
      entreeDe('vue', json, []);
      return { vue: vueDe(demarree()) };
    },
    jouer(json) {
      const o = demarree();
      const e = entreeDe('jouer', json, clesDuGeste);
      const etat = o.partie.etat();
      const geste = 'offre' in e ? lireGeste(e) : gesteDuVerbe(etat, e as { type: unknown }, SANS_PISTE);
      const resultat = envoyerLIntention(o.partie, intentionDuGeste(etat, geste, SANS_PISTE));
      o.pas++;
      return suite(o, resultat);
    },
    reprendre(json) {
      const o = demarree();
      const e = entreeDe('reprendre', json, ['jeton']);
      valider(Number.isInteger(e.jeton), 'reprendre : jeton, le numéro d’un jeton programmé');
      return suite(o, o.jetons.reprendre(e.jeton as number));
    },
    erreursGlobales(json) {
      entreeDe('erreursGlobales', json, []);
      return { erreurs: erreurs.splice(0) };
    },
  };

  const page = globalThis as { addEventListener?: (type: string, ecouteur: (ev: unknown) => void) => void };
  page.addEventListener?.('error', (ev) => {
    const e = ev as { message?: string; filename?: string; lineno?: number };
    erreurs.push({ message: e.message ?? String(ev), source: e.filename ? `${e.filename}:${e.lineno ?? 0}` : null });
  });
  page.addEventListener?.('unhandledrejection', (ev) => {
    const raison = (ev as { reason?: unknown }).reason;
    erreurs.push({ message: raison instanceof Error ? raison.message : String(raison), source: 'unhandledrejection' });
  });

  /** Appelle la méthode `methode` sur l'entrée `json` : la réponse en JSON, jamais une levée. */
  function appeler(methode: string, json?: string | null): string {
    try {
      const faire = Object.prototype.hasOwnProperty.call(methodes, methode) ? methodes[methode] : null;
      if (!faire) throw new ErreurDeGeste('validation', `méthode inconnue : ${String(methode)} (méthodes : ${Object.keys(methodes).join(', ')})`);
      return JSON.stringify({ ok: true, ...faire(json) } satisfies Reponse);
    } catch (erreur) {
      const reponse: Reponse = erreur instanceof ErreurDeGeste
        ? { ok: false, erreur: { categorie: erreur.categorie, message: erreur.message } }
        : { ok: false, erreur: { categorie: 'interne', message: erreur instanceof Error ? erreur.message : String(erreur) } };
      return JSON.stringify(reponse);
    }
  }

  return { appeler };
}

/** Le pont que la page expose à Godot. */
export type Pont = ReturnType<typeof creerPont>;
