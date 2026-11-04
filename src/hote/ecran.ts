/**
 * L'ÉCRAN D'UN HÔTE QUI DESSINE LA PARTIE (#2928, #3328), commun aux hôtes qui la montrent au joueur : chaque zone de
 * l'écran et ses éléments (`elements.ts`). La fenêtre qui tient la main (son titre, son étape, son corps : qui agit
 * contre qui, ses jets, le DR net, l'issue ; ses gestes), le panneau du combat (le round et le tour, l'actif, ce que la
 * barre et l'aperçu disent, la fin du combat, la barre des offres) et le journal. Chaque texte vient du catalogue
 * (`t()`) et des lecteurs du noyau ; l'hôte n'écrit aucun libellé, et le joueur ne lit aucun id.
 */
import {
  ACTIONS, avecSigne, conditionLabel, fenetreDAttaque, fenetreDeDefense, jetsEnVue, porteurParId,
  type FenetreDAttaque, type Jeu, type JetEnVue, type LigneDeJet, type LigneDuJournal, type ModLine, type RollBreakdown,
} from '../noyau/index';
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import type { Projection } from './projection';
import type { FenetreADessiner } from './gestes';
import { elementsDesGestes, ligne, type Bouton, type Choix, type Element, type Entite, type Formulaire, type Jet, type Ligne, type Puce, type Ton } from './elements';

/** Chaque zone de l'écran et ses éléments, dans l'ordre où elle les montre. Une zone vide n'a rien à montrer. */
export interface ZonesDeLEcran {
  'fenetre.titre': Ligne[];
  'fenetre.etape': Ligne[];
  'fenetre.corps': Element[];
  'fenetre.gestes': (Bouton | Choix | Formulaire)[];
  'combat.tour': Ligne[];
  'combat.actif': Entite[];
  'combat.avis': Ligne[];
  'combat.offres': Bouton[];
  'journal.titre': Ligne[];
}

type Combat = NonNullable<Projection['combat']>;

/** Les modificateurs `mods` d'un jet, chacun une puce. */
const puces = (id: string, mods: readonly ModLine[] | undefined): Puce[] =>
  (mods ?? []).map((m, i) => ({ type: 'puce', id: `${id}/m${i}`, ton: 'neutre', libelle: m.label, valeur: avecSigne(m.value) }));

/** Un jet dont seules les parties de `parties` sont dites. */
const jet = (id: string, parties: Partial<Omit<Jet, 'type' | 'id'>> & { libelle: string }): Jet => ({
  type: 'jet', id, ton: 'neutre', qui: null, base: null, difficulte: null, cible: null, resultat: null, dr: null, verdict: null, modificateurs: [], ...parties,
});

const verdictDuTest = (reussi: boolean) => ({ verdict: t(reussi ? 'ecran.jet.reussite' : 'ecran.jet.echec'), ton: reussi ? 'reussite' as const : 'echec' as const });

/** Un jet tombé : le dé contre la cible, le DR et le verdict ; masqué quand la ligne l'est (`RollBreakdown.mask`), son
 *  seuil pur dit sans DR (`seuil`). */
function jetTombe(id: string, d: RollBreakdown, qui: string | null): Jet {
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
  });
}

/** Le DR net d'un Test opposé tranché. */
const drNet = (id: string, dr: number): Ligne => ligne(id, t('ecran.drNet', { dr: avecSigne(dr) }));

/** Le corps de la fenêtre d'attaque : qui attaque qui et avec quoi, la ligne de l'attaquant et celle de la défense
 *  (à jeter ou tombées), le DR net, l'issue ou l'attente d'une Défense. */
function corpsDeLAttaque(etat: Jeu, a: FenetreDAttaque): Element[] {
  const nom = (id: string) => porteurParId(etat, id)?.label ?? null;
  const attaquant = nom(a.attaquantId);
  const cible = nom(a.cibleId);
  const elements: (Element | null)[] = [
    ligne('sousTitre', a.sousTitre),
    ligne('cible', t('ecran.attaque.cible', { cible: cible ?? '' })),
    ligne('enTete', a.enTete),
    a.bloque === null ? null : ligne('bloque', a.bloque, 'alerte'),
    a.jet === null ? null : 'd' in a.jet
      ? jetTombe('jet', a.jet.d, attaquant)
      : jet('jet', { qui: attaquant, libelle: a.jet.pending.label, base: t('ecran.jet.base', { base: a.jet.pending.base }), cible: t('ecran.jet.cible', { cible: a.jet.pending.target }), difficulte: a.jet.pending.difficulte, resultat: t('ecran.jet.aLancer'), modificateurs: puces('jet', a.jet.pending.mods) }),
    a.defense === null ? null : 'd' in a.defense
      ? jetTombe('defense', a.defense.d, cible)
      : jet('defense', { qui: cible, libelle: a.defense.pending.label, difficulte: a.defense.pending.difficulte, resultat: t('ecran.jet.aLancer'), modificateurs: puces('defense', a.defense.pending.mods) }),
    a.opposition ? drNet('drNet', a.opposition.drNet) : null,
    a.issue ? ligne('issue', a.issue.ligne) : null,
    a.attente === null ? null : ligne('attente', a.attente),
  ];
  return elements.filter((e): e is Element => e !== null);
}

/** Une ligne de jet d'une fenêtre (`jetsEnVue`) : qui jette, le Test, la table ou le dé, et ce qui est tombé. */
function jetDeLaLigne(etat: Jeu, id: string, l: LigneDeJet): Jet {
  const qui = l.qui === null ? null : porteurParId(etat, l.qui)?.label ?? null;
  switch (l.genre) {
    case 'test': return jet(id, {
      qui, libelle: l.test, cible: l.cible === null ? null : t('ecran.jet.cible', { cible: l.cible }),
      ...(l.jet ? { resultat: String(l.jet.d100), dr: t('ecran.jet.dr', { dr: avecSigne(l.jet.dr) }), ...verdictDuTest(l.jet.reussi) } : { resultat: t('ecran.jet.aLancer') }),
    });
    case 'table': return jet(id, { qui, libelle: l.table, resultat: l.jet ? l.jet.ligne : t('ecran.jet.aTirer') });
    case 'de': return jet(id, { qui, libelle: l.de, resultat: l.jet ? l.jet.lecture : t('ecran.jet.aLancer') });
  }
}

const elementsDuJet = (etat: Jeu, j: JetEnVue, i: number): Element[] => [
  ...j.lignes.map((l, k) => jetDeLaLigne(etat, `jets/${i}/${k}`, l)),
  ...(j.oppose ? [drNet(`jets/${i}/drNet`, j.oppose.drNet)] : []),
];

/** Le corps de la fenêtre qui tient la main : la fenêtre d'attaque quand une attaque est en attente
 *  (`fenetreDAttaque`), sinon qui attaque qui quand une Défense l'est (`fenetreDeDefense`), puis les jets de la
 *  fenêtre (`jetsEnVue`). */
function corpsDeLaFenetre(etat: Jeu): Element[] {
  const attaque = fenetreDAttaque(etat);
  if (attaque) return corpsDeLAttaque(etat, attaque);
  const defense = fenetreDeDefense(etat);
  const nom = (id: string) => garanti(porteurParId(etat, id), id, 'combattant de la Défense').label;
  return [
    ...(defense ? [ligne('defense/qui', t('ecran.defense.qui', { attaquant: nom(defense.attaquantId), defenseur: nom(defense.defenseurId), arme: defense.arme })), ligne('defense/test', t('ecran.defense.test', { test: defense.test }))] : []),
    ...jetsEnVue(etat).flatMap((j, i) => elementsDuJet(etat, j, i)),
  ];
}

/** L'actif du combat : son nom, ses Blessures, son Avantage, son Mouvement, son Action, chacun de ses États. */
const actifDuCombat = (actif: NonNullable<Combat['actif']>): Entite => ({
  type: 'entite', id: actif.id, ton: 'neutre', nom: actif.nom,
  elements: [
    { type: 'jauge', id: 'blessures', ton: 'neutre', libelle: t('ecran.jauge.blessures'), courant: actif.pb[0], max: actif.pb[1], texte: t('ecran.jauge', { courant: actif.pb[0], max: actif.pb[1] }) },
    ligne('avantage', t('ecran.avantage', { n: actif.avantage })),
    { type: 'jauge', id: 'mouvement', ton: 'neutre', libelle: t('ecran.jauge.mouvement'), courant: actif.mouvement[0], max: actif.mouvement[1], texte: t('ecran.jauge', { courant: actif.mouvement[0], max: actif.mouvement[1] }) },
    ligne('action', t('ecran.action', { etat: t(`ecran.action.${actif.action}`) })),
    ...actif.etats.map((e): Puce => ({ type: 'puce', id: `etat/${e.id}`, ton: 'alerte', libelle: conditionLabel(e.id), valeur: String(e.valeur) })),
  ],
});

/** Ce que l'aperçu du premier clic dit : le Mouvement qu'il coûte, ou la cible qu'il vise. */
function apercuDe(c: Combat): string | null {
  const a = c.apercu;
  if (!a) return null;
  if (a.cout !== null) return t('ecran.apercu', { cout: a.cout });
  const cible = [c.actif, ...c.voisins.liste].find((v) => v?.id === a.cible)?.nom;
  return cible ? t('ecran.apercu.cible', { cible }) : null;
}

/** Les offres ouvertes de l'actif, chacune un bouton qui la joue, son coût dit (`ACTIONS`) ; pressée, l'offre que
 *  l'actif vise. */
const offresDuCombat = (c: Combat): Bouton[] =>
  (c.offres?.liste ?? []).map((o) => {
    const libelle = garanti(ACTIONS.find((a) => a.id === o.id)?.label, o.id, 'libellé de l’offre');
    return { type: 'bouton', id: o.id, libelle: o.cout === null ? libelle : t('ecran.offre', { libelle, cout: o.cout }), jeu: { offre: o.id }, presse: c.intention === o.id, focus: false, refus: null };
  });

/** Le ton de chaque issue du combat. */
const TON_DE_LA_FIN: Record<NonNullable<Combat['fin']>, Ton> = { victory: 'reussite', defeat: 'echec' };

/** Ce que le panneau du combat dit hors de ses jauges : pourquoi la barre est fermée (la fenêtre le dit quand elle tient
 *  la main), ce que l'aperçu coûte, la fin du combat. */
function avisDuCombat(c: Combat, fenetreOuverte: boolean): Ligne[] {
  const apercu = apercuDe(c);
  return [
    ...(c.barre.raison === null || fenetreOuverte ? [] : [ligne('raison', c.barre.raison, 'alerte')]),
    ...(apercu === null ? [] : [ligne('apercu', apercu)]),
    ...(c.fin ? [ligne('fin', t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }), TON_DE_LA_FIN[c.fin])] : []),
  ];
}

/** Les zones de l'écran de la partie `etat`, de sa projection `p` et de la fenêtre qui tient la main `fenetre`. */
export function zonesDeLEcran(etat: Jeu, p: Projection, fenetre: FenetreADessiner | null): ZonesDeLEcran {
  const c = p.combat;
  const etape = fenetre ? [fenetre.etape === fenetre.titre ? null : fenetre.etape, fenetre.proprietaire.genre === 'porteur' ? fenetre.proprietaire.nom : null].filter((x): x is string => x !== null) : [];
  return {
    'fenetre.titre': fenetre ? [ligne('titre', fenetre.titre)] : [],
    'fenetre.etape': etape.length ? [ligne('etape', etape.join(t('ecran.separateur')))] : [],
    'fenetre.corps': fenetre ? corpsDeLaFenetre(etat) : [],
    'fenetre.gestes': fenetre ? elementsDesGestes(fenetre.gestes) : [],
    'combat.tour': c ? [ligne('tour', t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }))] : [],
    'combat.actif': c?.actif ? [actifDuCombat(c.actif)] : [],
    'combat.avis': c ? avisDuCombat(c, fenetre !== null) : [],
    'combat.offres': c ? offresDuCombat(c) : [],
    'journal.titre': c ? [ligne('journal', t('ecran.journal'))] : [],
  };
}

/** Les zones qu'une suite remplit, chacune ajoutée à ce que l'écran montre déjà : les lignes du journal. */
export interface ZonesDeLaSuite {
  'journal.lignes': Ligne[];
}

/** Les lignes que le journal ajoute, numérotées à la suite des `avant` lignes déjà écrites ; un événement de combat
 *  sans texte n'en écrit aucune. */
export const lignesDuJournal = (avant: number, journal: readonly LigneDuJournal[]): Ligne[] =>
  journal.flatMap((l, i) => {
    const texte = l.de === 'journal' ? l.texte : l.evenement.text;
    return texte ? [ligne(`journal/${avant + i}`, texte)] : [];
  });
