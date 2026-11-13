/**
 * LA TABLE DE TEST DU PONT (#2928, `CONTRAT.md`) : le pont appelé comme Godot l'appelle (le nom d'une méthode et une
 * chaîne JSON, une chaîne JSON en retour), les jetons programmés rejoués sur l'horloge virtuelle du module commun
 * (`horlogeVirtuelle`, `src/noyau/horlogeVirtuelle.ts`), là où Godot arme ses minuteurs, et ce qu'il manque à une vue pour que
 * Godot dessine la fenêtre qui tient la main (`fautesDeLaFenetre`).
 */
import { expect } from 'vitest';
import { listage } from '../listage.mjs';
import { DOSSIER_DES_MODELES, recupererModeles } from '../asset/release';
import { tableTotale } from '../../../src/lib/tableTotale';
import type { Stockage } from '../../../src/lib/stockage';
import { stockageEnMemoire } from '../../../src/lib/stockage.testkit';
import { creerPont, type ReseauDuPont, type MondeDuPont, type MorceauxDuPont, type Pont, type Suite, type VueDuPont } from './pont';
import { gestesDessines } from './dessines';
export { enFocus, gestesDessines } from './dessines';
import type { CategorieDuPont } from './pont';
import { cleDuGeste, horlogeVirtuelle, type Effet, type LigneDuJournal } from '../../../src/noyau/index';
import { parametresDuGeste } from '../../../src/hote/gestes';
import type { Bouton, Choix, Element, Formulaire, Jeu, Ligne, Plan, Saisie } from '../../../src/hote/elements';

/** Une réponse décodée. */
export type Reponse = ({ ok: true } & Partial<Suite> & Record<string, unknown>) | { ok: false; erreur: { categorie: CategorieDuPont; message: string } };

/** Un pont neuf sur le stockage `stockage`, en mémoire et vide par défaut, et sur le réseau `reseau`, aucun par
 *  défaut, et ses appels : `entree` passe en JSON, absente sans entrée. */
export function table(stockage: Stockage = stockageEnMemoire(), reseau: ReseauDuPont | null = null) {
  const pont: Pont = creerPont(stockage, reseau);
  const appel = (methode: string, entree?: unknown): Reponse => {
    const brut = pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree));
    expect(typeof brut, 'le pont rend une chaîne JSON').toBe('string');
    return JSON.parse(brut) as Reponse;
  };
  return { pont, appel, stockage };
}

/** Le manifeste du monde de la partie (`monde`). */
export const mondeDe = (appel: ReturnType<typeof table>['appel']): MondeDuPont => appel('monde') as unknown as MondeDuPont;

/** La géométrie de chaque morceau du volume de `manifeste`, demandée à `morceaux` sur la scène de `source`. */
export function morceauxDe(appel: ReturnType<typeof table>['appel'], source: 'partie' | 'edition', manifeste: NonNullable<MondeDuPont['monde']>): MorceauxDuPont['volume'] {
  const r = appel('morceaux', { source, volume: manifeste.morceaux.map(({ cle }) => cle), toits: [], couronnes: [] });
  expect(r.ok, JSON.stringify(r)).toBe(true);
  return (r as unknown as MorceauxDuPont).volume;
}

/** La vue d'une réponse qui en porte une. */
export const vueDe = (r: Reponse): VueDuPont => (r as { vue: VueDuPont }).vue;

/** Le bouton qui ouvre la fiche d'un héros du groupe (`groupe.heros`), sa carte nommée par son nom ou son rang. */
export function ficheDuHeros(vue: VueDuPont, heros: string | number): Bouton {
  const cartes = vue.zones['groupe.heros'];
  const carte = typeof heros === 'number' ? cartes[heros] : cartes.find((c) => c.nom === heros);
  const bouton = carte?.elements.find((e): e is Bouton => e.type === 'bouton' && e.id.startsWith('fiche/'));
  if (!bouton) throw new Error(`aucune carte du groupe pour ${heros}`);
  return bouton;
}

/** Les éléments de la section `id` du statbloc de la fiche ouverte (`fiche.sections`, `section/<id>`), aucun sans
 *  elle. */
export const sectionDeLaFiche = (vue: VueDuPont, id: string): Element[] => vue.zones['fiche.sections'].find((e) => e.id === `section/${id}`)?.elements ?? [];

let commites: Promise<ReturnType<typeof listage>> | undefined;

/** Le listage des modèles commités du projet Godot, tel que `GET modeles/listage.json` le sert, le GLB épinglé de
 *  chacun déposé d'abord (`recupererModeles`) ; lu une fois par graphe de modules. */
export const modelesCommites = () => (commites ??= recupererModeles({ dossier: DOSSIER_DES_MODELES, journal: () => {} }).then(() => listage(DOSSIER_DES_MODELES)));

/** `modeles` par `appel` sur `manifestes`, chacun avec les os de ses meshes rigides au listage commité `commites`. */
export function servirLesModeles(appel: ReturnType<typeof table>['appel'], commites: ReturnType<typeof listage>, manifestes = commites.manifestes): void {
  expect(appel('modeles', { manifestes, osDesRigides: tableTotale(Object.keys(manifestes), (id) => commites.osDesRigides[id] ?? []) })).toMatchObject({ ok: true });
}

/** La suite d'une réponse réussie, ou l'échec qui dit la réponse. */
export function suiteDe(r: Reponse): Suite {
  if (!r.ok || !r.vue || !r.programmes || !r.journal || !r.zones || !r.effets) throw new Error(`réponse sans suite : ${JSON.stringify(r).slice(0, 400)}`);
  return r as unknown as Suite;
}

/** L'erreur d'une réponse refusée : sa catégorie et son message. */
export function erreurDe(r: Reponse): { categorie: CategorieDuPont; message: string } {
  if (r.ok) throw new Error(`réponse acceptée, refus attendu : ${JSON.stringify(r).slice(0, 400)}`);
  return r.erreur;
}

/** Rejoue tous les jetons d'une suite et de leurs reprises sur l'horloge virtuelle du noyau
 *  (`horlogeVirtuelle`), là où Godot arme ses minuteurs : la dernière suite, toutes les lignes de journal, toutes
 *  celles que le journal de l'écran ajoute et tous les effets rendus, ceux de `r` compris. */
export function drainer(appel: ReturnType<typeof table>['appel'], r: Reponse): { suite: Suite; journal: LigneDuJournal[]; lignes: Ligne[]; effets: Effet[] } {
  let suite = suiteDe(r);
  const journal = [...suite.journal];
  const lignes = [...suite.zones['journal.lignes']];
  const effets = [...suite.effets];
  horlogeVirtuelle((jeton) => {
    suite = suiteDe(appel('reprendre', { jeton }));
    journal.push(...suite.journal);
    lignes.push(...suite.zones['journal.lignes']);
    effets.push(...suite.effets);
    return suite.programmes;
  }, suite.programmes).vider();
  return { suite, journal, lignes, effets };
}

/** Ce qu'il manque à une saisie pour se dessiner : son libellé (jamais son nom), chaque valeur d'un choix nommée,
 *  chaque champ d'un objet. */
function fautesDeLaSaisie(ou: string, s: Saisie): string[] {
  if (s.type === 'fixe') return [];
  return [
    ...(!s.libelle || s.libelle === s.nom ? [`${ou} : libellé ${s.libelle}`] : []),
    ...((s.type === 'saisieChoix' || s.type === 'saisieCoches') && (!s.valeurs.length || s.valeurs.some((v) => !v.libelle)) ? [`${ou} : un choix sans valeur nommée`] : []),
    ...(s.type === 'saisieObjet' ? s.champs.flatMap((c) => fautesDeLaSaisie(`${ou}.${c.nom}`, c)) : []),
  ];
}

/** Ce qu'il manque à la vue pour dessiner la fenêtre qui tient la main : son titre (jamais un id), et chaque geste
 *  ouvert en élément d'un de ses verbes (`cleDuGeste`), nommé, qui joue son verbe le flux d'un geste de jet et l'id
 *  désigné posés à leur place parmi ses paramètres (`parametresDuGeste`) ; chaque valeur d'un choix nommée, chaque
 *  saisie d'un formulaire nommée (`fautesDeLaSaisie`). Sans fenêtre, aucune zone de la fenêtre n'a d'élément. */
export function fautesDeLaFenetre(vue: VueDuPont): string[] {
  const f = vue.projection.fenetre;
  const z = vue.zones;
  const dessinee = [z['fenetre.titre'], z['fenetre.etape'], z['fenetre.corps'], z['fenetre.reglages'], z['fenetre.gestes']].some((l) => l.length);
  if (!f) return dessinee ? ['une fenêtre dessinée sans fenêtre qui tient la main'] : [];
  const [titre] = z['fenetre.titre'];
  if (!titre) return [`la fenêtre ${f.cle} n’est pas dessinée`];
  const gestes = new Map(f.gestes.map((g) => [cleDuGeste(g), g]));
  const ids = new Set([f.cle, ...gestes.keys(), ...f.gestes.map((g) => g.verbe)]);
  const fautes = ids.has(titre.texte) ? [`titre ${titre.texte} : un id`] : [];
  for (const e of gestesDessines(vue)) {
    const geste = gestes.get(e.id);
    if (!geste) { fautes.push(`${e.id} : aucun geste de la fenêtre`); continue; }
    if (!e.libelle || ids.has(e.libelle)) fautes.push(`${e.id} : libellé ${e.libelle}`);
    const parametres = parametresDuGeste(geste).map((p) => p.nom);
    const pose = (nom: string) => (nom === 'flux' ? geste.flux : f.pid);
    const fautesDuJeu = (ou: string, jeu: Jeu) => {
      if (!('type' in jeu) || jeu.type !== geste.verbe) return [`${ou} : joue ${JSON.stringify(jeu)}, pas ${geste.verbe}`];
      return parametres.flatMap((p, i) => ((p === 'flux' || p === 'pid') && jeu.args[i] !== pose(p) ? [`${ou}.${p} : posé à ${String(jeu.args[i])}, la fenêtre désigne ${String(pose(p))}`] : []));
    };
    switch (e.type) {
      case 'bouton': fautes.push(...fautesDuJeu(e.id, e.jeu)); break;
      case 'choix':
      case 'liste':
        if (!e.valeurs.length) fautes.push(`${e.id} : un choix sans valeur`);
        for (const v of e.valeurs) fautes.push(...(v.libelle ? [] : [`${v.id} : une valeur sans nom`]), ...fautesDuJeu(v.id, v.jeu));
        break;
      case 'formulaire':
        if (e.verbe !== geste.verbe) fautes.push(`${e.id} : verbe ${e.verbe}, pas ${geste.verbe}`);
        if (e.champs.map((c) => c.nom).join() !== parametres.join()) fautes.push(`${e.id} : saisies ${e.champs.map((c) => c.nom).join()} ≠ paramètres ${parametres.join()}`);
        for (const c of e.champs) {
          if (c.type === 'fixe' && c.valeur !== pose(c.nom)) fautes.push(`${e.id}.${c.nom} : posé à ${String(c.valeur)}, la fenêtre désigne ${String(pose(c.nom))}`);
          fautes.push(...fautesDeLaSaisie(`${e.id}.${c.nom}`, c));
        }
    }
  }
  return fautes;
}


/** Le geste d'identité `cle` (`cleDuGeste`) parmi les gestes dessinés de la fenêtre, ou l'échec qui la dit. */
export function gesteDe(vue: VueDuPont, cle: string): Bouton | Choix | Formulaire {
  const g = gestesDessines(vue).find((x) => x.id === cle);
  if (!g) throw new Error(`aucun geste ${cle} dans ${JSON.stringify(gestesDessines(vue).map((x) => x.id))}`);
  return g;
}

/** L'élément d'id `id` du corps de la fenêtre, `undefined` sans lui. */
export const corpsDe = (vue: VueDuPont, id: string): Element | undefined => vue.zones['fenetre.corps'].find((e) => e.id === id);

/** Le départ du trajet `route` sur la carte ouverte : le choix de ses modes, sous sa destination au plan. */
export function departDeLaCarte(vue: VueDuPont, route: string): Choix {
  const plan = corpsDe(vue, 'carte/plan') as Plan;
  return plan.points.flatMap((p) => p.elements).find((e): e is Choix => e.type === 'choix' && e.id === route)!;
}
