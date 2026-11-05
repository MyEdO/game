/**
 * LE PONT DE L'HÔTE GODOT (#2928, contrat `CONTRAT.md`) : le transport JSON entre Godot et le noyau. Une méthode reçoit
 * au plus une chaîne JSON et rend toujours une chaîne JSON, `{ ok: true, … }` ou `{ ok: false, erreur }` ; elle ne lève
 * jamais. Le pont ne porte aucune règle : un geste passe par le module commun des hôtes (`src/hote/`), la vue est faite
 * des lecteurs du noyau, les jetons programmés sont tenus par numéro et rejoués quand Godot les rend. La fiche que
 * l'écran montre est un état du pont, que la méthode `fiche` pose, jamais de la partie.
 */
import { CLICS_DE_L_EXPLORATION, CLICS_DU_CHAMP, cataloguesDeComposition, lireComposition, lireSurchargesDEmblemes, plateauDeLaScene, presetDeComposition, type Composition, type LectureAuSchema, type LigneDuJournal, type Programme, type ResultatDeLAppel } from '../../../src/noyau/index';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie, valider, type CategorieDErreur, type PartieOuverte } from '../../../src/hote/partie';
import { envoyerLIntention, gesteDuVerbe, intentionDuGeste, lireGeste, SANS_PISTE } from '../../../src/hote/geste';
import { casesAtteignables, projeter, type BornesDeLaProjection, type CaseAtteignable, type Projection } from '../../../src/hote/projection';
import { estObjet } from '../../../src/hote/formes';
import { modelesDesCombattants, type CouvertureDesModeles } from './equipement';
import { fenetreADessiner } from '../../../src/hote/gestes';
import { lignesDuJournal, zonesDeLEcran, type ZonesDeLaSuite, type ZonesDeLEcran } from '../../../src/hote/ecran';
import { modelesDeLAtelier, type ModelesDeLAtelier } from './atelier';
import { composerSurLaBase } from './composition';
import { estListeDeChaines } from '../asset/attache';
import { ONGLETS_DE_LA_FICHE, type FicheOuverte } from '../../../src/hote/elements';

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

/** La vue : la projection commune (`projeter`), la disposition de la fenêtre qui tient la main
 *  (`FenetreADessiner.disposition`, `null` sans fenêtre), chaque zone de l'écran et ses éléments (`zonesDeLEcran`, la
 *  fiche posée par `fiche` comprise), les cases
 *  atteignables au tour de l'actif (`casesAtteignables`), le plateau de la scène (`plateauDeLaScene`), les clics du
 *  champ par ce qu'ils désignent (`CLICS_DU_CHAMP` la barre de l'actif ouverte, `CLICS_DE_L_EXPLORATION` en exploration
 *  quand rien ne tient la main ; `null` sinon), et l'id du
 *  combattant que chaque case porte, par `"x,y"`. */
export interface VueDuPont extends CouvertureDesModeles {
  projection: Projection;
  disposition: string | null;
  zones: ZonesDeLEcran;
  cases: CaseAtteignable[];
  plateau: ReturnType<typeof plateauDeLaScene> | null;
  champ: typeof CLICS_DU_CHAMP | typeof CLICS_DE_L_EXPLORATION | null;
  occupants: Record<string, string>;
}

/** Ce qu'un appel qui touche la partie rend : la vue d'après, les jetons qu'il a programmés, ses lignes de journal
 *  (`journal`, que le plateau anime) et ce qu'il ajoute à l'écran (`zones` : les lignes du journal, `lignesDuJournal`). */
export interface Suite {
  vue: VueDuPont;
  programmes: Programme[];
  journal: LigneDuJournal[];
  zones: ZonesDeLaSuite;
}

/** Godot dessine tout : aucune liste de la projection n'est bornée. */
const SANS_BORNE: BornesDeLaProjection = { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity };

/** Les clés de l'entrée d'un geste : celles d'une offre, ou celles d'un verbe (`Geste`). */
const clesDuGeste = (e: Record<string, unknown>): readonly string[] => ('offre' in e ? ['offre', 'ctx'] : 'suite' in e ? ['suite'] : ['type', 'args', 'siege']);

/** La valeur de `lu`, le champ `champ` de l'entrée de `methode` lu par le noyau ; refusée en `validation`, chaque faute à
 *  son chemin. */
function valeurLue<T>(methode: string, champ: string, lu: LectureAuSchema<T>): T {
  if (lu.ok) return lu.valeur;
  throw new ErreurDeGeste('validation', `${methode} : ${champ}, ${lu.fautes.map(({ chemin, message }) => `${chemin.join('.') || '(racine)'} : ${message}`).join(' ; ')}`);
}

/** La composition `brut` de `methode`, lue par le noyau (`lireComposition`). */
const compositionDe = (methode: string, brut: unknown): Composition => valeurLue(methode, 'composition', lireComposition(brut));

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
  let ouverte: (PartieOuverte & { pas: number; lignes: number; fiche: FicheOuverte | null }) | null = null;
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
    const combat = projection.combat;
    const fenetre = fenetreADessiner(etat);
    return {
      projection,
      ...modelesDesCombattants(combat?.voisins.liste ?? projection.exploration?.heros ?? []),
      disposition: fenetre?.disposition ?? null,
      zones: zonesDeLEcran(etat, projection, fenetre, o.fiche),
      cases: casesAtteignables(etat),
      plateau: etat.scene ? plateauDeLaScene(etat.scene) : null,
      champ: combat ? (combat.barre.forme === 'ouverte' ? CLICS_DU_CHAMP : null) : projection.exploration && !fenetre ? CLICS_DE_L_EXPLORATION : null,
      occupants: Object.fromEntries((combat?.voisins.liste ?? []).flatMap((c) => (c.pos && !c.horsCombat ? [[`${c.pos[0]},${c.pos[1]}`, c.id]] : []))),
    };
  };

  const suite = (o: NonNullable<typeof ouverte>, resultat: ResultatDeLAppel): Suite => {
    const programmes = o.jetons.programmes(resultat);
    const zones = { 'journal.lignes': lignesDuJournal(o.partie.etat(), o.lignes, resultat.journal) };
    o.lignes += resultat.journal.length;
    return { vue: vueDe(o), programmes, journal: resultat.journal, zones };
  };

  /** Un geste joué : une offre de l'actif, ou un verbe et ses arguments. */
  const jouerUnGeste = (o: NonNullable<typeof ouverte>, e: Record<string, unknown>): ResultatDeLAppel => {
    const etat = o.partie.etat();
    const geste = 'offre' in e ? lireGeste(e) : gesteDuVerbe(etat, e as { type: unknown }, SANS_PISTE);
    const resultat = envoyerLIntention(o.partie, intentionDuGeste(etat, geste, SANS_PISTE));
    o.pas++;
    return resultat;
  };

  const methodes: Record<string, (json?: string | null) => object> = {
    demarrer(json) {
      const e = entreeDe('demarrer', json, ['scenario', 'graine']);
      valider(!ouverte, 'demarrer : une partie par page, déjà démarrée ; recharger la page pour en commencer une autre');
      valider(typeof e.scenario === 'string', 'demarrer : scenario, l’id d’un scénario de test');
      const o = ouvrirLaPartie(nouvelEntete(e.scenario as string, { graine: e.graine as number | undefined }), sansRoster);
      ouverte = { ...o, pas: 0, lignes: 0, fiche: null };
      return suite(ouverte, o.lancement);
    },
    vue(json) {
      entreeDe('vue', json, []);
      return { vue: vueDe(demarree()) };
    },
    jouer(json) {
      const o = demarree();
      const e = entreeDe('jouer', json, clesDuGeste);
      if (!('suite' in e)) return suite(o, jouerUnGeste(o, e));
      valider(Array.isArray(e.suite) && e.suite.length > 0 && e.suite.every(estObjet), 'jouer : suite, une liste non vide de verbes { type, args }');
      const [premier, ...reste] = e.suite as Record<string, unknown>[];
      const resultats = [jouerUnGeste(o, premier)];
      for (const g of reste) {
        if (fenetreADessiner(o.partie.etat())) break;
        resultats.push(jouerUnGeste(o, g));
      }
      return suite(o, { issue: resultats[resultats.length - 1].issue, evenements: resultats.flatMap((r) => r.evenements), journal: resultats.flatMap((r) => r.journal) });
    },
    fiche(json) {
      const o = demarree();
      const e = entreeDe('fiche', json, ['fiche']);
      const f = e.fiche as Record<string, unknown> | null | undefined;
      const heros = o.partie.etat().party.map((h) => h.id);
      valider(f === null || (estObjet(f) && Object.keys(f).every((k) => k === 'heros' || k === 'onglet') && heros.includes(f.heros as string) && ONGLETS_DE_LA_FICHE.includes(f.onglet as FicheOuverte['onglet'])),
        `fiche : fiche, null ou { heros, onglet } : l’id d’un héros du groupe (${heros.join(', ')}) et un onglet (${ONGLETS_DE_LA_FICHE.join(', ')})`);
      o.fiche = f === null ? null : { heros: f!.heros as string, onglet: f!.onglet as FicheOuverte['onglet'] };
      return { vue: vueDe(o), programmes: [], journal: [], zones: { 'journal.lignes': [] } } satisfies Suite;
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
      const e = entreeDe('composer', json, ['base', 'composition', 'emblemes']);
      valider(atelier !== null, 'composer : aucun modèle, appeler modeles d’abord');
      const base = atelier!.modeles.bases.find((b) => b.id === e.base);
      valider(base !== undefined, `composer : base, l’id d’une base servie par modeles (${atelier!.modeles.bases.map((b) => b.id).join(', ') || 'aucune'})`);
      const emblemes = valeurLue('composer', 'emblemes', lireSurchargesDEmblemes(e.emblemes === undefined ? {} : e.emblemes));
      return composerSurLaBase(base!, atelier!.manifestes, compositionDe('composer', e.composition), emblemes);
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
