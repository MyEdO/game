/**
 * LE PONT DE L'HÔTE GODOT (#2928, contrat `CONTRAT.md`) : le transport JSON entre Godot et le noyau. Une méthode reçoit
 * au plus une chaîne JSON et rend toujours une chaîne JSON, `{ ok: true, … }` ou `{ ok: false, erreur }` ; elle ne lève
 * jamais. Le pont ne porte aucune règle : un geste passe par le module commun des hôtes (`src/hote/`), la vue est faite
 * des lecteurs du noyau, les jetons programmés sont tenus par numéro et rejoués quand Godot les rend.
 */
import { CLICS_DU_CHAMP, cataloguesDeComposition, fenetreDAttaque, fenetreDeDefense, lireComposition, plateauDeLaScene, presetDeComposition, type Composition, type FenetreDAttaque, type FenetreDeDefense, type LigneDuJournal, type Programme, type ResultatDeLAppel } from '../../../src/noyau/index';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie, valider, type CategorieDErreur, type PartieOuverte } from '../../../src/hote/partie';
import { envoyerLIntention, gesteDuVerbe, intentionDuGeste, lireGeste, SANS_PISTE } from '../../../src/hote/geste';
import { casesAtteignables, projeter, type BornesDeLaProjection, type CaseAtteignable, type Projection } from '../../../src/hote/projection';
import { estObjet } from '../../../src/hote/formes';
import { modelesDesCombattants, type CouvertureDesModeles } from './equipement';
import { fenetreADessiner, type FenetreADessiner } from '../../../src/hote/gestes';
import { panneauDuCombat, type PanneauDuCombat } from '../../../src/hote/ecran';
import { modelesDeLAtelier, type ModelesDeLAtelier } from './atelier';
import { composerSurLaBase } from './composition';
import { estListeDeChaines } from '../asset/attache';

/** Le service `persisterLeHeros` du pont : il ne persiste aucun héros, l'hôte Godot n'a pas de stockage (#3041). */
const sansRoster = (): void => {};

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

/** La composition `brut` de `methode`, lue par le noyau (`lireComposition`) ; refusée en `validation`, chaque faute à son
 *  chemin. */
function compositionDe(methode: string, brut: unknown): Composition {
  const lu = lireComposition(brut);
  if (lu.ok) return lu.composition;
  throw new ErreurDeGeste('validation', `${methode} : composition, ${lu.fautes.map(({ chemin, message }) => `${chemin.join('.') || '(racine)'} : ${message}`).join(' ; ')}`);
}

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
  /** Les manifestes et les modèles du dernier `modeles`, que `composer` lit. */
  let atelier: { manifestes: Record<string, unknown>; modeles: ModelesDeLAtelier } | null = null;

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
      const o = ouvrirLaPartie(nouvelEntete(e.scenario as string, { graine: e.graine as number | undefined }), sansRoster);
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
    modeles(json) {
      const e = entreeDe('modeles', json, ['manifestes', 'osDesRigides']);
      valider(estObjet(e.manifestes), 'modeles : manifestes, un objet id de modèle → manifeste');
      valider(estObjet(e.osDesRigides) && Object.values(e.osDesRigides).every(estListeDeChaines), 'modeles : osDesRigides, un objet id de modèle → os de ses meshes rigides');
      const manifestes = e.manifestes as Record<string, unknown>;
      atelier = { manifestes, modeles: modelesDeLAtelier(manifestes, e.osDesRigides as Record<string, string[]>) };
      return atelier.modeles;
    },
    composer(json) {
      const e = entreeDe('composer', json, ['base', 'composition']);
      valider(atelier !== null, 'composer : aucun modèle, appeler modeles d’abord');
      const base = atelier!.modeles.bases.find((b) => b.id === e.base);
      valider(base !== undefined, `composer : base, l’id d’une base servie par modeles (${atelier!.modeles.bases.map((b) => b.id).join(', ') || 'aucune'})`);
      return composerSurLaBase(base!, atelier!.manifestes, compositionDe('composer', e.composition));
    },
    catalogues(json) {
      entreeDe('catalogues', json, []);
      return cataloguesDeComposition();
    },
    presetDeComposition(json) {
      const e = entreeDe('presetDeComposition', json, ['composition', 'preset']);
      const composition = compositionDe('presetDeComposition', e.composition);
      valider(e.preset === undefined || typeof e.preset === 'string', 'presetDeComposition : preset, l’id d’un preset de catalogues');
      const rendu = presetDeComposition(composition, e.preset as string | undefined);
      if (!rendu.ok) throw new ErreurDeGeste('validation', `presetDeComposition : preset, l’id d’un preset de catalogues (${rendu.presets.join(', ')})`);
      return rendu;
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
