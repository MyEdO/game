/**
 * L'ÉCRAN D'UN HÔTE QUI DESSINE LA PARTIE (#2928), commun aux hôtes qui la montrent au joueur : le panneau du combat
 * (le round et le tour, la fiche de l'actif, l'issue du combat, le titre du journal), le libellé de chaque offre de la
 * barre, ce que l'aperçu du premier clic coûte, et le corps de la fenêtre qui tient la main (qui agit contre qui, ses
 * jets, le DR net, l'issue). Chaque texte vient du catalogue (`t()`) et des lecteurs du noyau ; l'hôte n'écrit aucun
 * libellé, et le joueur ne lit aucun id.
 */
import {
  ACTIONS, avecSigne, conditionLabel, fenetreDAttaque, fenetreDeDefense, jetsEnVue, porteurParId, texteDuMod,
  type FenetreDAttaque, type Jeu, type JetEnVue, type LigneDeJet, type ModLine, type RollBreakdown,
} from '../noyau/index';
import { deElide, t } from '../i18n';
import { garanti } from '../lib/garanti';
import type { Projection } from './projection';

/** Le panneau du combat, en lignes prêtes à écrire. `raison` : pourquoi la barre est fermée, `null` quand elle est
 *  ouverte ou qu'une fenêtre tient la main (la fenêtre le dit). `offres` : le libellé de chaque offre, par son id. */
export interface PanneauDuCombat {
  tour: string;
  fiche: string[];
  raison: string | null;
  apercu: string | null;
  fin: string | null;
  journal: string;
  offres: Record<string, string>;
}

type Combat = NonNullable<Projection['combat']>;

/** La fiche de l'actif : son nom, ses Blessures, son Avantage, son Mouvement, son Action, ses États. */
function fiche(actif: NonNullable<Combat['actif']>): string[] {
  const etats = actif.etats.map((e) => t('ecran.etat', { etat: conditionLabel(e.id), n: e.valeur }));
  return [
    actif.nom,
    t('ecran.blessures', { courant: actif.pb[0], max: actif.pb[1] }),
    t('ecran.avantage', { n: actif.avantage }),
    t('ecran.mouvement', { restant: actif.mouvement[0], total: actif.mouvement[1] }),
    t('ecran.action', { etat: t(`ecran.action.${actif.action}`) }),
    t('ecran.etats', { liste: etats.length ? etats.join(', ') : t('ecran.etats.aucun') }),
  ];
}

/** Ce que l'aperçu du premier clic dit : le Mouvement qu'il coûte, ou la cible qu'il vise. */
function apercuDe(c: Combat): string | null {
  const a = c.apercu;
  if (!a) return null;
  if (a.cout !== null) return t('ecran.apercu', { cout: a.cout });
  const cible = [c.actif, ...c.voisins.liste].find((v) => v?.id === a.cible)?.nom;
  return cible ? t('ecran.apercu.cible', { cible }) : null;
}

/** Le libellé de chaque offre, par son id (`ACTIONS`), son coût dit. */
const libellesDesOffres = (offres: NonNullable<Combat['offres']>['liste']): Record<string, string> =>
  Object.fromEntries(offres.map((o) => {
    const libelle = garanti(ACTIONS.find((a) => a.id === o.id)?.label, o.id, 'libellé de l’offre');
    return [o.id, o.cout === null ? libelle : t('ecran.offre', { libelle, cout: o.cout })];
  }));

/** Le panneau du combat de la projection `p` ; `null` hors combat. */
export function panneauDuCombat(p: Projection): PanneauDuCombat | null {
  const c = p.combat;
  if (!c) return null;
  return {
    tour: t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }),
    fiche: c.actif ? fiche(c.actif) : [],
    raison: p.fenetre ? null : c.barre.raison,
    apercu: apercuDe(c),
    fin: c.fin ? t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }) : null,
    journal: t('ecran.journal'),
    offres: libellesDesOffres(c.offres?.liste ?? []),
  };
}

/** Le séparateur des parties d'une ligne du corps : le texte du jet, puis chacun de ses modificateurs. */
const PARTIES = ' · ';

const avecMods = (texte: string, mods: readonly ModLine[] | undefined): string => [texte, ...(mods ?? []).map(texteDuMod)].join(PARTIES);

/** Un jet tombé, tel que la fenêtre le montre : le dé contre la cible, le DR et le verdict ; masqué quand la ligne
 *  l'est (`RollBreakdown.mask`), son seuil pur dit sans DR (`seuil`). */
function jetTombe(d: RollBreakdown): string {
  if (d.mask === 'roll') return t('ecran.jet.masque', { test: d.label });
  const verdict = d.seuil ? (d.success ? d.seuil.reussite : d.seuil.echec) : t(d.success ? 'ecran.jet.reussite' : 'ecran.jet.echec');
  const texte = d.mask === 'value'
    ? t('ecran.jet.tombeSansCible', { test: d.label, jet: d.roll, verdict })
    : d.seuil
      ? t('ecran.jet.seuil', { test: d.label, jet: d.roll, cible: d.target, verdict })
      : t('ecran.jet.tombe', { test: d.label, jet: d.roll, cible: d.target, dr: avecSigne(d.sl), verdict });
  return avecMods(texte, d.mask === 'value' ? [] : d.mods);
}

/** Le corps de la fenêtre d'attaque : qui attaque qui et avec quoi, la ligne de l'attaquant et celle de la défense
 *  (à jeter ou tombées), le DR net, l'issue ou l'attente d'une Défense. */
function corpsDeLAttaque(etat: Jeu, a: FenetreDAttaque): string[] {
  const nom = (id: string) => porteurParId(etat, id)?.label ?? null;
  const jet = a.jet === null ? null : 'd' in a.jet
    ? jetTombe(a.jet.d)
    : avecMods(t('ecran.jet.aJeter', { test: a.jet.pending.label, base: a.jet.pending.base, cible: a.jet.pending.target, difficulte: a.jet.pending.difficulte }), a.jet.pending.mods);
  const defense = a.defense === null ? null : 'd' in a.defense
    ? jetTombe(a.defense.d)
    : avecMods(t('ecran.defense.annoncee', { de: deElide(nom(a.cibleId) ?? ''), test: a.defense.pending.label, difficulte: a.defense.pending.difficulte }), a.defense.pending.mods);
  return [
    a.sousTitre,
    t('ecran.attaque.cible', { cible: nom(a.cibleId) ?? '' }),
    a.enTete,
    a.bloque,
    jet,
    defense,
    a.opposition ? t('ecran.drNet', { dr: avecSigne(a.opposition.drNet) }) : null,
    a.issue?.ligne ?? null,
    a.attente,
  ].filter((l): l is string => l !== null);
}

/** Une ligne de jet d'une fenêtre (`jetsEnVue`) : qui jette, le Test, la table ou le dé, et ce qui est tombé. */
function ligneDeJet(etat: Jeu, l: LigneDeJet): string {
  const texte = l.genre === 'test'
    ? (l.jet
        ? t(l.cible === null ? 'ecran.ligne.testTombeSansCible' : 'ecran.ligne.testTombe', { test: l.test, cible: l.cible ?? 0, jet: l.jet.d100, dr: avecSigne(l.jet.dr), verdict: t(l.jet.reussi ? 'ecran.jet.reussite' : 'ecran.jet.echec') })
        : t(l.cible === null ? 'ecran.ligne.testAJeterSansCible' : 'ecran.ligne.testAJeter', { test: l.test, cible: l.cible ?? 0 }))
    : l.genre === 'table'
      ? (l.jet ? t('ecran.ligne.tableTombee', { table: l.table, ligne: l.jet.ligne }) : t('ecran.ligne.tableATirer', { table: l.table }))
      : (l.jet ? t('ecran.ligne.deTombe', { de: l.de, lecture: l.jet.lecture }) : t('ecran.ligne.deALancer', { de: l.de }));
  const qui = l.qui === null ? null : porteurParId(etat, l.qui)?.label ?? null;
  return qui === null ? texte : t('ecran.ligne.qui', { qui, texte });
}

const lignesDuJet = (etat: Jeu, j: JetEnVue): string[] => [
  ...j.lignes.map((l) => ligneDeJet(etat, l)),
  ...(j.oppose ? [t('ecran.drNet', { dr: avecSigne(j.oppose.drNet) })] : []),
];

/** Le corps de la fenêtre qui tient la main, en lignes prêtes à écrire : la fenêtre d'attaque quand une attaque est en
 *  attente (`fenetreDAttaque`), sinon qui attaque qui quand une Défense l'est (`fenetreDeDefense`), puis les jets de la
 *  fenêtre (`jetsEnVue`). */
export function corpsDeLaFenetre(etat: Jeu): string[] {
  const attaque = fenetreDAttaque(etat);
  if (attaque) return corpsDeLAttaque(etat, attaque);
  const defense = fenetreDeDefense(etat);
  const nom = (id: string) => porteurParId(etat, id)?.label ?? '';
  return [
    ...(defense ? [t('ecran.defense.qui', { attaquant: nom(defense.attaquantId), defenseur: nom(defense.defenseurId), arme: defense.arme }), t('ecran.defense.test', { test: defense.test })] : []),
    ...jetsEnVue(etat).flatMap((j) => lignesDuJet(etat, j)),
  ];
}
