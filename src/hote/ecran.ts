/**
 * L'ÉCRAN D'UN HÔTE QUI DESSINE LA PARTIE (#2928, #3328), commun aux hôtes qui la montrent au joueur : chaque zone de
 * l'écran et ses éléments (`elements.ts`). La fenêtre qui tient la main (son titre, son étape, son corps : qui agit
 * contre qui, ses jets, le DR net, l'issue ; ses réglages, les options du coup, puis ses gestes), le panneau du
 * combat (le round et le tour, l'ordre du tour, l'actif, ce que la barre et l'aperçu disent, la fin du combat, la barre des offres) et
 * le journal. À l'écran, ce qui se lit d'un coup d'œil ; le reste au détail d'un élément, montré à la demande.
 * Chaque texte vient du catalogue (`t()`) et des lecteurs du noyau ; l'hôte n'écrit aucun libellé, et le joueur ne lit
 * aucun id.
 */
import {
  ACTIONS, avecSigne, conditionLabel, difficultyText, fenetreDAttaque, fenetreDeDefense, jetsEnVue, porteurParId, toneOf,
  type CombatEvent, type FenetreDAttaque, type Jeu, type JetEnVue, type LigneDeJet, type LigneDuJournal, type ModLine, type RollBreakdown,
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
  'fenetre.reglages': (Bouton | Choix | Formulaire)[];
  'fenetre.gestes': (Bouton | Choix | Formulaire)[];
  'combat.tour': Ligne[];
  'combat.ordre': Puce[];
  'combat.actif': Entite[];
  'combat.avis': Ligne[];
  'combat.apercu': Ligne[];
  'combat.offres': Choix[];
  'journal.titre': Ligne[];
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
  const nom = (id: string) => porteurParId(etat, id)?.label ?? null;
  const attaquant = nom(a.attaquantId);
  const cible = nom(a.cibleId);
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

/** Une ligne de jet d'une fenêtre (`jetsEnVue`) : qui jette, le Test, la table ou le dé, et ce qui est tombé : le dé
 *  et son verdict, ou ce que la table ou le dé lit. */
function jetDeLaLigne(etat: Jeu, id: string, l: LigneDeJet): Jet {
  const qui = l.qui === null ? null : porteurParId(etat, l.qui)?.label ?? null;
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

/** Le corps de la fenêtre qui tient la main : la fenêtre d'attaque quand une attaque est en attente
 *  (`fenetreDAttaque`), sinon qui attaque qui quand une Défense l'est (`fenetreDeDefense`) et le jet de sa réaction
 *  avant le dé, puis les jets de la fenêtre (`jetsEnVue`) et l'issue de la Défense. */
function corpsDeLaFenetre(etat: Jeu): Element[] {
  const attaque = fenetreDAttaque(etat);
  if (attaque) return corpsDeLAttaque(etat, attaque);
  const defense = fenetreDeDefense(etat);
  const nom = (id: string) => garanti(porteurParId(etat, id), id, 'combattant de la Défense').label;
  return [
    ...(defense ? [ligne('defense/qui', t('ecran.defense.qui', { attaquant: nom(defense.attaquantId), defenseur: nom(defense.defenseurId), arme: defense.arme }))] : []),
    ...(defense?.jet ? [jet('defense/jet', {
      qui: nom(defense.defenseurId), libelle: defense.test, cible: t('ecran.jet.cible', { cible: defense.jet.target }), modificateurs: puces('defense/jet', defense.jet.mods),
      detail: detailDuJet({ ...defense.jet, paliers: defense.jet.difficultyParts }),
    })] : []),
    ...jetsEnVue(etat).flatMap((j, i) => elementsDuJet(etat, j, i)),
    ...(defense?.issue ? [ligne('defense/issue', defense.issue.ligne)] : []),
  ];
}

/** L'actif du combat : son nom, ses Blessures et son Mouvement en jauges, puis son Avantage, son Action et chacun de
 *  ses États en puces. */
const actifDuCombat = (actif: NonNullable<Combat['actif']>): Entite => ({
  type: 'entite', id: actif.id, ton: 'neutre', nom: actif.nom,
  elements: [
    { type: 'jauge', id: 'blessures', ton: 'neutre', libelle: t('ecran.jauge.blessures'), courant: actif.pb[0], max: actif.pb[1], texte: t('ecran.jauge', { courant: actif.pb[0], max: actif.pb[1] }) },
    { type: 'jauge', id: 'mouvement', ton: 'neutre', libelle: t('ecran.jauge.mouvement'), courant: actif.mouvement[0], max: actif.mouvement[1], texte: t('ecran.jauge', { courant: actif.mouvement[0], max: actif.mouvement[1] }) },
    puce('avantage', t('ecran.avantage'), String(actif.avantage)),
    puce('action', t('ecran.action'), t(`ecran.action.${actif.action}`), null, actif.action === 'libre' ? 'reussite' : 'neutre'),
    ...actif.etats.map((e) => puce(`etat/${e.id}`, conditionLabel(e.id), String(e.valeur), null, 'alerte')),
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

/** Les offres de l'actif, chacune un bouton qui la joue (`ACTIONS`), pressée quand l'actif la vise, refusée avec sa
 *  raison quand elle est fermée ; rangées par la part de l'économie du tour qu'elles prennent, chaque part un choix qui
 *  la nomme une fois, celles qui n'en prennent aucune (la fin du tour) sous le tour. */
function offresDuCombat(c: Combat): Choix[] {
  const offres = c.offres?.liste ?? [];
  const bouton = (o: (typeof offres)[number]): Bouton => ({
    type: 'bouton', id: o.id, libelle: garanti(ACTIONS.find((a) => a.id === o.id)?.label, o.id, 'libellé de l’offre'), jeu: { offre: o.id }, presse: c.intention === o.id, focus: false, refus: o.refus,
  });
  return [...new Set(offres.map((o) => o.economie))].map((e): Choix => ({
    type: 'choix', id: `economie/${e}`, ton: 'neutre', libelle: t(`ecran.economie.${e}`), focus: false, refus: null, valeurs: offres.filter((o) => o.economie === e).map(bouton),
  }));
}

/** L'ordre du tour (`battle.order`) : chaque combattant en puce, ses Blessures pour valeur ; celui qui joue en alerte,
 *  un ennemi en échec. */
const ordreDuTour = (etat: Jeu, c: Combat): Puce[] =>
  (etat.battle?.order ?? []).flatMap((id) => {
    const x = porteurParId(etat, id);
    if (!x) return [];
    return [puce(`ordre/${id}`, x.label, t('ecran.jauge', { courant: x.wounds.current, max: x.wounds.max }), null, id === c.actif?.id ? 'alerte' : x.kind === 'enemy' ? 'echec' : 'neutre')];
  });

/** Le ton de chaque issue du combat. */
const TON_DE_LA_FIN: Record<NonNullable<Combat['fin']>, Ton> = { victory: 'reussite', defeat: 'echec' };

/** Ce que le panneau du combat dit hors de ses jauges : pourquoi la barre est fermée (la fenêtre le dit quand elle tient
 *  la main), la fin du combat. */
function avisDuCombat(c: Combat, fenetreOuverte: boolean): Ligne[] {
  return [
    ...(c.barre.raison === null || fenetreOuverte ? [] : [ligne('raison', c.barre.raison, 'alerte')]),
    ...(c.fin ? [ligne('fin', t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }), TON_DE_LA_FIN[c.fin])] : []),
  ];
}

/** Les zones de l'écran de la partie `etat`, de sa projection `p` et de la fenêtre qui tient la main `fenetre`. */
export function zonesDeLEcran(etat: Jeu, p: Projection, fenetre: FenetreADessiner | null): ZonesDeLEcran {
  const c = p.combat;
  const gestes = fenetre ? elementsDesGestes(fenetre.gestes) : [];
  const reglages = new Set(fenetre?.gestes.filter((g) => g.reglage).map((g) => g.cle));
  const etape = fenetre ? [fenetre.etape === fenetre.titre ? null : fenetre.etape, fenetre.proprietaire.genre === 'porteur' ? fenetre.proprietaire.nom : null].filter((x): x is string => x !== null) : [];
  return {
    'fenetre.titre': fenetre ? [ligne('titre', fenetre.titre)] : [],
    'fenetre.etape': etape.length ? [ligne('etape', etape.join(t('ecran.separateur')))] : [],
    'fenetre.corps': fenetre ? corpsDeLaFenetre(etat) : [],
    'fenetre.reglages': gestes.filter((g) => reglages.has(g.id)),
    'fenetre.gestes': gestes.filter((g) => !reglages.has(g.id)),
    'combat.tour': c ? [ligne('tour', c.tour === null ? t('ecran.round', { round: c.round }) : t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }))] : [],
    'combat.ordre': c ? ordreDuTour(etat, c) : [],
    'combat.actif': c?.actif ? [actifDuCombat(c.actif)] : [],
    'combat.avis': c ? avisDuCombat(c, fenetre !== null) : [],
    'combat.apercu': c ? [apercuDe(c)].flatMap((a) => (a === null ? [] : [ligne('apercu', a)])) : [],
    'combat.offres': c ? offresDuCombat(c) : [],
    'journal.titre': c ? [ligne('journal', t('ecran.journal'))] : [],
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
  return frappe && porteurParId(etat, frappe)?.kind === 'hero' ? 'echec' : 'reussite';
};

/** Les lignes que le journal ajoute, numérotées à la suite des `avant` lignes déjà écrites : une par événement, son
 *  ton dit ce qu'il pèse ; les sous-lignes d'un événement (`detail`) vont au détail de la ligne qui les précède dans
 *  l'appel, montré à la demande. Un événement sans texte n'en écrit aucune. */
export const lignesDuJournal = (etat: Jeu, avant: number, journal: readonly LigneDuJournal[]): Ligne[] =>
  journal.reduce<Ligne[]>((lignes, l, i) => {
    const texte = l.de === 'journal' ? l.texte : l.evenement.text;
    if (!texte) return lignes;
    const id = `journal/${avant + i}`;
    if (l.de === 'journal') return [...lignes, ligne(id, texte)];
    const precedente = lignes[lignes.length - 1] as Ligne | undefined;
    if (l.evenement.kind === 'detail' && precedente) {
      const sous = texte.replace(/^\s*↳\s*/, '');
      return [...lignes.slice(0, -1), { ...precedente, detail: precedente.detail === null ? sous : `${precedente.detail}\n${sous}` }];
    }
    return [...lignes, ligne(id, texte, tonDeLEvenement(etat, l.evenement))];
  }, []);
