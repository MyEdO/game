/**
 * L'ÉCRAN D'UN HÔTE QUI DESSINE LA PARTIE (#2928, #3328), commun aux hôtes qui la montrent au joueur : chaque zone de
 * l'écran et ses éléments (`elements.ts`). La fenêtre qui tient la main (son titre, son étape, son corps : qui agit
 * contre qui, ses jets, le DR net, l'issue ; ses réglages, les options du coup, puis ses gestes), le panneau du
 * combat (le round et le tour, l'ordre du tour, l'actif, ce que la barre et l'aperçu disent, la fin du combat, la barre des offres) et
 * le journal ; en exploration, les gestes du groupe ; chaque héros du groupe, qui ouvre sa fiche, et la fiche ouverte ;
 * la création d'un héros (`creation.ts`).
 * À l'écran, ce qui se lit d'un coup d'œil ; le reste au détail d'un élément, montré à la demande.
 * Chaque texte vient du catalogue (`t()`) et des lecteurs du noyau ; l'hôte n'écrit aucun libellé, et le joueur ne lit
 * aucun id.
 */
import {
  ACTIONS, avecSigne, batailleEnVue, carteEnVue, cleDuGeste, dayIndex, formatImperial, formatJourImperial, marchandEnVue, marcheEnVue, voyageEnVue, VERBE_DE_CHOIX, type AxeDuChoix, type FenetreAChoix, conditionLabel, conversationEnVue, difficultyText, documentEnVue, lieuEnVue, formatMoney, fenetreDAttaque, fenetreDIncantation, fenetreDeDefense, fenetreDuSoin, ficheDuPorteur, gestesDeLObjet, interludeEnVue, jetsEnVue, porteurParId, recitEnVue, reposEnVue, toneOf,
  type CombatEvent, type FicheDuPorteur, type GesteAChoix, type GesteDuNoyau, type GesteFermable, type FenetreDAttaque, type FenetreDIncantation, type Jeu, type JetEnVue, type LigneDeJet, type LigneDuJournal, type ModLine, type RecapTone, type RollBreakdown, type TrajetEnVue,
} from '../noyau/index';
import { pluriel, t } from '../i18n';
import { garanti } from '../lib/garanti';
import type { Projection } from './projection';
import { CHOIX_EN_BOUTONS, type FenetreADessiner } from './gestes';
import { zonesDeLaCreation, type ZonesDeLaCreation } from './creation';
import { elementsDesGestes, ligne, ONGLETS_DE_LA_FICHE, resume, type Bouton, type Choix, type CreationOuverte, type Element, type Entite, type FicheOuverte, type Formulaire, type Jet, type Ligne, type Puce, type Saisie, type Ton } from './elements';

/** Chaque zone de l'écran et ses éléments, dans l'ordre où elle les montre, la création comprise. Une zone vide n'a
 *  rien à montrer. */
export interface ZonesDeLEcran extends ZonesDeLaCreation {
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
  'exploration.gestes': Bouton[];
  'dialogue.orateur': Ligne[];
  'dialogue.replique': Ligne[];
  'dialogue.reponses': Bouton[];
  'journal.titre': Ligne[];
  'groupe.heros': Bouton[];
  'fiche.heros': Entite[];
  'fiche.gestes': Bouton[];
  'fiche.corps': (Puce | Bouton)[];
  'fiche.objet': Entite[];
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

/** Le corps de la fenêtre d'incantation (`fenetreDIncantation`) : le Sort et sa cible, son NI et sa Zone d'Effet, la
 *  ligne du lanceur (à jeter ou tombée), les pas de Surincantation qui restent, les cibles supplémentaires à désigner
 *  sur la carte, l'issue. */
function corpsDeLIncantation(etat: Jeu, f: FenetreDIncantation): Element[] {
  const lanceur = garanti(porteurParId(etat, f.lanceurId), f.lanceurId, 'lanceur de l’incantation').label;
  const cible = f.surSoi ? t('ecran.incantation.surSoi') : garanti(porteurParId(etat, f.cibleId), f.cibleId, 'cible de l’incantation').label;
  const l = f.ligne;
  const s = f.surincantation;
  const elements: (Element | null)[] = [
    ligne('sort', t('ecran.incantation.sort', { sort: f.sort, cible })),
    f.zone ? puce('zone', t('ecran.incantation.zone'), t('ecran.incantation.cote', { cote: f.zone.cote }), null, f.zone.aPoser ? 'alerte' : 'neutre') : null,
    jet('jet', {
      qui: lanceur, libelle: l.label, cible: t('ecran.jet.cible', { cible: l.jet?.target ?? l.target }), modificateurs: puces('jet', l.mods),
      ...(l.jet ? { resultat: String(l.jet.roll), dr: t('ecran.jet.dr', { dr: avecSigne(l.jet.sl) }), ...verdictDuTest(l.jet.success) } : {}),
    }),
    s ? puce('surincantation', t('ecran.incantation.surincantation'), t('ecran.incantation.pas', { restant: s.restant, budget: s.budget })) : null,
    s?.cibles?.surLaCarte ? ligne('cibles', t('ecran.incantation.cibles', { designees: s.cibles.designees, capacite: s.cibles.capacite })) : null,
    f.issue ? ligne('issue', f.issue) : null,
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

/** Le corps de la fenêtre qui tient la main : sur l'étape d'attaque de la cascade, la fenêtre d'attaque
 *  (`fenetreDAttaque`) ; sur son étape de Défense, qui attaque qui (`fenetreDeDefense`) et le jet de sa réaction avant
 *  le dé ; puis les jets de la fenêtre (`jetsEnVue`), l'issue de la Défense, ce que l'étape de la cascade révèle ou
 *  annonce, le Sauvetage par le Destin et la victoire en attente. */
function corpsDeLaFenetre(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const jetDeLEtape = pc?.participants[pc.cursor]?.jet;
  const attaque = jetDeLEtape === 'attack' ? fenetreDAttaque(etat) : null;
  if (attaque) return corpsDeLAttaque(etat, attaque);
  const incantation = jetDeLEtape === 'cast' ? fenetreDIncantation(etat) : null;
  if (incantation) return corpsDeLIncantation(etat, incantation);
  const defense = jetDeLEtape === 'defense' ? fenetreDeDefense(etat) : null;
  const nom = (id: string) => garanti(porteurParId(etat, id), id, 'combattant de la Défense').label;
  return [
    ...(defense ? [ligne('defense/qui', t('ecran.defense.qui', { attaquant: nom(defense.attaquantId), defenseur: nom(defense.defenseurId), arme: defense.arme }))] : []),
    ...(defense?.jet ? [jet('defense/jet', {
      qui: nom(defense.defenseurId), libelle: defense.test, cible: t('ecran.jet.cible', { cible: defense.jet.target }), modificateurs: puces('defense/jet', defense.jet.mods),
      detail: detailDuJet({ ...defense.jet, paliers: defense.jet.difficultyParts }),
    })] : []),
    ...patientDuSoin(etat),
    ...trajetsDeLaCarte(etat),
    ...ecranDuLieu(etat),
    ...echoppe(etat),
    ...marche(etat),
    ...voyage(etat),
    ...recitDuVoyage(etat),
    ...herosDeLInterlude(etat),
    ...champDeBataille(etat),
    ...nuitDuRepos(etat),
    ...jetsEnVue(etat).flatMap((j, i) => elementsDuJet(etat, j, i)),
    ...(defense?.issue ? [ligne('defense/issue', defense.issue.ligne)] : []),
    ...revelationDeLEtape(etat),
    ...issueDeLEtape(etat),
    ...destinEnJeu(etat),
    ...victoire(etat),
    ...texteDuDocument(etat),
  ];
}

/** Les modes de voyage d'un trajet en choix, titré de sa longueur : chacun avec ses jours de route, fermé avec sa
 *  raison. Le même élément part du lieu (`ecranDuLieu`) et de la carte (`trajetsDeLaCarte`). */
const departDuTrajet = (tr: TrajetEnVue): Choix => ({
  type: 'choix', id: tr.route, ton: 'neutre', libelle: tr.distance, focus: false, refus: null,
  valeurs: tr.modes.map((m) => boutonDeGeste(m.mode, m.jours === null ? m.libelle : t('ecran.carte.mode', { mode: m.libelle, jours: m.jours }), m.geste, m.refus)),
});

/** La carte du monde ouverte (`carteEnVue`) : son plan, chaque lieu à sa place, celui du groupe en `alerte`, avec
 *  le départ de chaque trajet qui y mène (`departDuTrajet`), chaque route qui part d'ici en `reussite` ; puis la reprise
 *  d'un voyage interrompu. */
function trajetsDeLaCarte(etat: Jeu): Element[] {
  const c = carteEnVue(etat);
  if (!c) return [];
  return [
    {
      type: 'plan', id: 'carte/plan',
      points: c.plan.lieux.map((l) => ({ type: 'point', id: l.id, nom: l.nom, x: l.x, y: l.y, ton: l.ici ? 'alerte' : 'neutre', elements: l.trajets.map(departDuTrajet) })),
      traits: c.plan.routes.map((r) => ({ id: r.route, de: r.de, vers: r.vers, ton: r.depuisIci ? 'reussite' : 'neutre' })),
    },
    ...(c.reprendre ? [boutonDeGeste('carte/reprendre', t('ecran.carte.reprendre'), c.reprendre, null)] : []),
  ];
}

/** L'écran du lieu (`lieuEnVue`), dont le nom est le titre de la fenêtre : chacun de ses services en entité, ce qu'on y
 *  fait en boutons fermés avec leur raison, chacun des points d'intérêt de son plan et son entrée, puis chaque trajet qui
 *  en part, sa destination et son départ (`departDuTrajet`). */
function ecranDuLieu(etat: Jeu): Element[] {
  const l = lieuEnVue(etat);
  if (!l) return [];
  return [
    ...l.services.map((svc): Entite => ({
      type: 'entite', id: `service/${svc.id}`, ton: 'neutre', nom: svc.nom,
      elements: svc.gestes.map((g) => boutonDeGeste(g.id, g.libelle, g.geste, g.refus)),
    })),
    ...l.pointsDInteret.map(({ id, nom, geste: g }): Entite => ({
      type: 'entite', id: `poi/${id}`, ton: 'neutre', nom, elements: [boutonDeGeste(g.id, g.libelle, g.geste, g.refus)],
    })),
    ...l.trajets.map((tr): Entite => ({ type: 'entite', id: `trajet/${tr.route}`, ton: 'neutre', nom: tr.vers, elements: [departDuTrajet(tr)] })),
  ];
}

/** Un formulaire d'un geste du noyau : chaque argument que le geste pose en saisie fixe, puis `saisies`. */
function formulaireDuNoyau(id: string, libelle: string, f: { geste: { verbe: string; args: unknown[] }; refus: string | null }, saisies: Saisie[]): Formulaire {
  const fixes = f.geste.args.map((valeur, i): Saisie => ({ type: 'fixe', id: `${id}/${i}`, nom: String(i), optionnel: false, valeur }));
  return { type: 'formulaire', id, libelle, verbe: f.geste.verbe, focus: false, refus: f.refus, champs: [...fixes, ...saisies.map((x) => ({ ...x, id: `${id}/${x.id}` }))] };
}

/** Une saisie de valeurs nommées, chacune fermée par sa raison et pressée si elle est saisie d'avance : à cocher, ou
 *  à choisir une seule. */
const saisieDeValeurs = (nom: string, libelle: string, valeurs: readonly { libelle: string; valeur: string; refus: string | null; presse?: boolean }[], type: 'saisieCoches' | 'saisieChoix' = 'saisieCoches'): Saisie =>
  ({ type, id: nom, ton: 'neutre', nom, optionnel: false, libelle, valeurs: valeurs.map((v) => ({ presse: false, ...v })) });

/** L'interlude ouvert (`interludeEnVue`) : chaque héros en entité, ses Activités restantes, ses PX, sa bourse et
 *  l'Événement de sa période en puces, puis chacune de ses Activités, un bouton sans cible, un choix de ses cibles sinon (en liste au-delà de
 *  `CHOIX_EN_BOUTONS`), fermée avec sa raison ; puis les dépôts en banque, chacun le bouton de son retrait. */
function herosDeLInterlude(etat: Jeu): Element[] {
  const itl = interludeEnVue(etat);
  if (!itl) return [];
  return [
    ligne('repit/semaines', t('ecran.repit.semaines', { semaines: itl.semaines, s: pluriel(itl.semaines) })),
    ...itl.heros.map((h): Entite => ({
      type: 'entite', id: `repit/${h.id}`, ton: h.restantes ? 'neutre' : 'alerte', nom: h.nom,
      elements: [
        puce('restantes', t('ecran.repit.restantes', { restantes: h.restantes, recues: h.recues }), null),
        puce('px', t('ecran.repit.px'), String(h.px)),
        puce('bourse', t('ecran.repit.bourse'), h.bourse),
        ...(h.evenement ? [puce('evenement', h.evenement, null)] : []),
        ...h.activites.map((a): Bouton | Choix => (a.cible
          ? { type: a.gestes.length > CHOIX_EN_BOUTONS ? 'liste' : 'choix', id: a.id, ton: 'neutre', libelle: a.libelle, focus: false, refus: a.refus, valeurs: a.gestes.map((g, i) => boutonDuNoyau(`${a.id}/${i}`, g)) }
          : boutonDuNoyau(a.id, a.gestes[0]))),
        ...(h.ouvrage ? [formulaireDuNoyau(`ouvrage/${h.id}`, t('ecran.repit.ouvrage'), h.ouvrage, h.ouvrage.refus ? [] : [
          saisieDeValeurs('trappingId', t('ecran.repit.ouvrages'), h.ouvrage.ouvrages, 'saisieChoix'),
          saisieDeValeurs('atouts', t('ecran.repit.atouts'), h.ouvrage.atouts),
          saisieDeValeurs('defauts', t('ecran.repit.defauts'), h.ouvrage.defauts),
        ])] : []),
        formulaireDuNoyau(`depot/${h.id}`, t('ecran.repit.depot'), h.depot, h.depot.refus ? [] : [
          saisieDeValeurs('kind', t('ecran.repit.genre'), h.depot.genres, 'saisieChoix'),
          { type: 'saisieNombre', id: 'amountBrass', ton: 'neutre', nom: 'amountBrass', optionnel: false, libelle: t('ecran.repit.montant'), valeur: h.depot.pas, min: h.depot.pas, max: h.depot.max, pas: h.depot.pas },
        ]),
      ],
    })),
    ...(itl.depots.length ? [{ type: 'entite', id: 'repit/depots', ton: 'neutre', nom: t('ecran.repit.depots'), elements: itl.depots.map((d, i) => boutonDuNoyau(String(i), d)) } satisfies Entite] : []),
  ];
}

/** Le ton de l'issue d'une bataille, par le camp qui l'emporte. */
const TON_DE_L_ISSUE = { ally: 'reussite', enemy: 'echec' } as const satisfies Record<'ally' | 'enemy', Ton>;

/** La bataille de masse ouverte (`batailleEnVue`) : son Round, chaque armée en entité, sa Puissance en jauge et le bonus
 *  de ses Tests ce Round, son terrain et sa Menace, puis chaque Scène en entité, son effet (sa description au détail),
 *  sa position, ses postes en choix (chaque PJ libre pressé quand il y est posté) et son engagement fermé avec sa
 *  raison ; l'aléa du Round, ou les gestes qui le tirent ; les gestes du Round ; l'issue. */
function champDeBataille(etat: Jeu): Element[] {
  const b = batailleEnVue(etat);
  if (!b) return [];
  return [
    ...(b.round ? [ligne('bataille/round', b.round)] : []),
    ...b.armees.map((a): Entite => ({
      type: 'entite', id: `armee/${a.camp}`, ton: 'neutre', nom: a.nom,
      elements: [
        { type: 'jauge', id: 'puissance', ton: 'neutre', libelle: t('ecran.bataille.puissance'), courant: a.puissance, max: a.max, texte: t('ecran.bataille.depart', { puissance: a.puissance, depart: a.depart }) },
        ...(a.bonus ? [puce('bonus', t('ecran.bataille.bonus'), avecSigne(a.bonus))] : []),
      ],
    })),
    ...(b.terrain ? [ligne('bataille/terrain', b.terrain)] : []),
    ...(b.menace ? [ligne('bataille/menace', t('ecran.bataille.menace', { penalite: b.menace }), 'alerte')] : []),
    ...b.scenes.map((sc): Entite => ({
      type: 'entite', id: `scene/${sc.id}`, ton: sc.resolue ? 'reussite' : 'neutre', nom: sc.libelle,
      elements: [
        puce('effet', sc.effet, null, sc.desc),
        ...(sc.position ? [puce('position', sc.position, null)] : []),
        ...(sc.postes ? [{
          type: 'choix', id: 'postes', ton: 'neutre', libelle: t('ecran.bataille.postes'), focus: false, refus: null,
          valeurs: sc.postes.map((p, i): Bouton => ({ type: 'bouton', id: String(i), libelle: p.nom, jeu: { type: p.geste.verbe, args: p.geste.args }, presse: p.poste, focus: false, refus: null })),
        } satisfies Choix] : []),
        boutonDuNoyau('engager', sc.engager),
      ],
    })),
    ...(b.alea ? [ligne('bataille/alea', t('ecran.bataille.alea', { alea: b.alea.libelle }), 'neutre', b.alea.texte)] : []),
    ...(b.tirerAlea ? [boutonDuNoyau('bataille/tirerAlea', b.tirerAlea)] : []),
    ...(b.choisirAlea.length ? [{
      type: 'liste', id: 'bataille/choisirAlea', ton: 'neutre', libelle: t('ecran.bataille.choisirAlea'), focus: false, refus: null,
      valeurs: b.choisirAlea.map((g, i) => boutonDuNoyau(String(i), g)),
    } satisfies Choix] : []),
    ...b.gestes.map((g, i) => boutonDuNoyau(`bataille/geste/${i}`, g)),
    ...(b.issue ? [ligne('bataille/issue', b.issue.texte, b.issue.gagnant ? TON_DE_L_ISSUE[b.issue.gagnant] : 'neutre')] : []),
  ];
}

type Repos = NonNullable<ReturnType<typeof reposEnVue>>;

/** Un réglage d'un dormeur en choix : chaque valeur que le lieu lui offre, la sienne pressée. */
const choixDuDormeur = (id: string, c: Repos['dormeurs'][number]['couchage']): Choix => ({
  type: 'choix', id, ton: 'neutre', libelle: c.libelle, focus: false, refus: null,
  valeurs: c.valeurs.map((v, i): Bouton => ({ type: 'bouton', id: String(i), libelle: v.libelle, jeu: { type: v.geste.verbe, args: v.geste.args }, presse: v.choisie, focus: false, refus: null })),
});

/** La nuit à régler (`reposEnVue`) : la nuit, le temps qu'il fait (en alerte quand il expose), puis chaque dormeur en
 *  entité, son couchage et sa pitance en choix et ce qui l'attend cette nuit en puces d'alerte ; la note, en alerte
 *  quand les bourses ne la couvrent pas. */
function nuitDuRepos(etat: Jeu): Element[] {
  const r = reposEnVue(etat);
  if (!r) return [];
  return [
    ligne('repos/nuit', r.nuit),
    ...(r.temps ? [ligne('repos/temps', r.temps.texte, r.temps.alerte ? 'alerte' : 'neutre')] : []),
    ...r.dormeurs.map((d): Entite => ({
      type: 'entite', id: `repos/${d.id}`, ton: 'neutre', nom: d.nom,
      elements: [choixDuDormeur('couchage', d.couchage), choixDuDormeur('pitance', d.pitance), ...d.alertes.map((a, i) => puce(`alerte/${i}`, a, null, null, 'alerte'))],
    })),
    ...(r.note ? [ligne('repos/note', r.note.texte, r.note.couverte ? 'neutre' : 'alerte')] : []),
  ];
}

/** Le ton de chaque issue d'un récit de voyage. */
const TON_DU_RECIT = { arrivee: 'reussite', interruption: 'alerte', arret: 'alerte', embuscade: 'echec' } as const satisfies Record<NonNullable<ReturnType<typeof recitEnVue>>['issue'], Ton>;

/** Le récit du trajet que le groupe vient de faire (`recitEnVue`) : son issue au ton de l'issue, la route faite, puis la
 *  durée du voyage arrivé, ou chaque journée en entité avec ce qui s'y est passé, et ce qui permet de repartir. */
function recitDuVoyage(etat: Jeu): Element[] {
  const r = recitEnVue(etat);
  if (!r) return [];
  return [
    ligne('recit/issue', r.titre, TON_DU_RECIT[r.issue]),
    ligne('recit/route', r.route),
    ...(r.duree ? [ligne('recit/duree', r.duree)] : []),
    ...r.journees.map((j, i): Entite => ({ type: 'entite', id: `recit/jour/${i}`, ton: 'neutre', nom: j.libelle, elements: j.lignes.map((l, k) => ligne(String(k), l)) })),
    ...(r.suite ? [ligne('recit/suite', r.suite)] : []),
  ];
}

/** L'échoppe ouverte (`marchandEnVue`) : la bourse du groupe ; chaque famille de l'étal en entité, chaque article en
 *  bouton qui en met une unité au panier, son prix au libellé, pressé quand le panier en tient ; le panier, chaque ligne
 *  en bouton qui en ôte une unité, et le paiement de son total ; chaque héros et ses possessions, chacune en bouton qui la
 *  met au lot ou l'en retire, son gain au libellé ; puis la vente du lot. */
function echoppe(etat: Jeu): Element[] {
  const m = marchandEnVue(etat);
  if (!m) return [];
  const avecPrix = (nom: string, prix: string | null) => (prix === null ? nom : t('ecran.echoppe.article', { nom, prix }));
  return [
    puce('bourse', t('ecran.bourse'), m.bourse),
    ...m.etal.map((f): Entite => ({
      type: 'entite', id: `etal/${f.id}`, ton: 'neutre', nom: f.nom,
      elements: f.articles.map((a) => boutonDeGeste(a.id, avecPrix(a.nom, a.prix), a.ajouter.geste, a.ajouter.refus, a.auPanier > 0)),
    })),
    {
      type: 'entite', id: 'panier', ton: 'neutre', nom: t('ecran.echoppe.panier'),
      elements: [
        ...m.panier.lignes.map((l) => boutonDeGeste(l.id, avecPrix(t('ecran.echoppe.ligne', { nom: l.nom, qty: l.qty }), l.sousTotal), l.oter, null)),
        boutonDeGeste('payer', t('ecran.echoppe.payer', { total: m.panier.total }), m.panier.payer.geste, m.panier.payer.refus),
      ],
    },
    ...m.vente.heros.map((h): Entite => ({
      type: 'entite', id: `vente/${h.id}`, ton: 'neutre', nom: h.nom,
      elements: h.possessions.map((p) => boutonDeGeste(p.uid, avecPrix(p.nom, p.gain), p.basculer, p.refus, p.auLot)),
    })),
    boutonDeGeste('vendre', t('ecran.echoppe.vendre', { total: m.vente.total }), m.vente.vendre.geste, m.vente.vendre.refus),
  ];
}

/** Le trajet en cours (`voyageEnVue`) : l'heure de jeu et la météo du jour, les km faits sur ceux du trajet par son
 *  moyen, puis sa frise : le départ, chaque nuit passée en route et son km, l'arrivée. */
function voyage(etat: Jeu): Element[] {
  const v = voyageEnVue(etat);
  if (!v) return [];
  const km = (n: number) => t('ecran.voyage.km', { km: n });
  return [
    ligne('voyage/heure', formatImperial(v.heure)),
    ...(v.meteo ? [ligne('voyage/meteo', v.meteo)] : []),
    jauge('voyage/route', t('ecran.voyage.route', { moyen: v.moyen }), [v.fait, v.km]),
    puce('voyage/etape/depart', v.de, km(0)),
    ...v.nuits.map((n, i) => puce(`voyage/etape/nuit/${i}`, t('ecran.voyage.nuit', { nuit: i + 1 }), km(n))),
    puce('voyage/etape/arrivee', v.vers, km(v.km)),
  ];
}

/** Le marché de cargaison ouvert (`marcheEnVue`) : la bourse, chaque offre en entité, son Enc disponible, son prix
 *  par Enc, la qualité de son vin ou son évaluation, puis son achat (le porteur qui le charge, l'Enc), fermé avec sa
 *  raison ; chaque lot des porteurs du groupe en entité, son porteur et son Enc, son prix de base, sa vente, son
 *  bradage, puis son transfert vers un porteur co-localisé. */
function marche(etat: Jeu): Element[] {
  const m = marcheEnVue(etat);
  if (!m) return [];
  const enc = (n: number) => t('ecran.marche.enc', { enc: n });
  const parEnc = (prix: string) => puce('prix', t('ecran.marche.prix'), t('ecran.marche.parEnc', { prix }));
  const nombre = (libelle: string, valeur: number, max: number): Saisie =>
    ({ type: 'saisieNombre', id: 'enc', ton: 'neutre', nom: 'enc', optionnel: false, libelle, valeur, min: 1, max, pas: 1 });
  /** Les porteurs `liste` à choisir, le premier saisi d'avance. */
  const porteurs = (nom: string, libelle: string, liste: readonly { id: string; nom: string; libre: number; capacite: number }[]) =>
    saisieDeValeurs(nom, libelle, liste.map((p, i) => ({ libelle: t('ecran.marche.place', { nom: p.nom, libre: p.libre, capacite: p.capacite }), valeur: p.id, refus: null, presse: i === 0 })), 'saisieChoix');
  return [
    puce('bourse', t('ecran.bourse'), m.bourse),
    ...m.offres.map((o): Entite => ({
      type: 'entite', id: `offre/${o.id}`, ton: 'neutre', nom: o.nom,
      elements: [
        puce('dispo', t('ecran.marche.dispo'), enc(o.dispo)),
        parEnc(o.prix),
        ...(o.qualite ? [{ ...puce('qualite', t('ecran.marche.qualite'), o.qualite.fiable ? o.qualite.texte : t('ecran.marche.incertaine', { qualite: o.qualite.texte })), ton: o.qualite.fiable ? 'neutre' : 'alerte' } satisfies Puce] : []),
        ...(o.evaluer ? [boutonDuNoyau('evaluer', { ...o.evaluer, libelle: t('ecran.marche.evaluer') })] : []),
        formulaireDuNoyau('acheter', t('ecran.marche.acheter'), { geste: { verbe: o.acheter.geste.verbe, args: [] }, refus: o.acheter.refus }, o.acheter.refus ? [] : [
          porteurs('porteur', t('ecran.marche.porteur'), o.acheter.porteurs),
          { type: 'fixe', id: 'offre', nom: 'offre', optionnel: false, valeur: o.id },
          nombre(t('ecran.marche.aAcheter'), o.acheter.enc, o.acheter.max),
        ]),
      ],
    })),
    ...m.cargaison.flatMap((c) => c.lots.map((l): Entite => ({
      type: 'entite', id: `lot/${l.uid}`, ton: 'neutre', nom: l.nom,
      elements: [
        puce('porteur', c.nom, enc(l.enc)),
        parEnc(l.prix),
        boutonDuNoyau('vendre', { ...l.vendre, libelle: t('ecran.marche.vendre') }),
        boutonDuNoyau('brader', { ...l.brader, libelle: t('ecran.marche.brader') }),
        formulaireDuNoyau('deplacer', t('ecran.marche.deplacer'), { geste: { verbe: l.deplacer.geste.verbe, args: [l.uid] }, refus: l.deplacer.refus }, l.deplacer.refus ? [] : [
          porteurs('vers', t('ecran.marche.vers'), l.deplacer.vers),
          nombre(t('ecran.marche.aDeplacer'), l.deplacer.enc, l.deplacer.max),
        ]),
      ],
    }))),
  ];
}

/** Les clés des choix de fenêtre (`fenetreChoisir`) que jouent les boutons de `elements`, à toute profondeur : un choix
 *  que le corps porte ne se redessine pas en réglage. */
function choixPortes(elements: readonly Element[]): Set<string> {
  const cles = new Set<string>();
  const parcourir = (e: Element | Bouton): void => {
    if (e.type === 'bouton' && 'type' in e.jeu && e.jeu.type === VERBE_DE_CHOIX) cles.add(cleDuGeste({ verbe: VERBE_DE_CHOIX, fenetre: e.jeu.args[0] as FenetreAChoix, axe: e.jeu.args[1] as AxeDuChoix }));
    if (e.type === 'entite') e.elements.forEach(parcourir);
    if (e.type === 'choix' || e.type === 'liste') e.valeurs.forEach(parcourir);
    if (e.type === 'plan') e.points.forEach((p) => p.elements.forEach(parcourir));
  };
  elements.forEach(parcourir);
  return cles;
}

/** Le patient du soin en attente (`fenetreDuSoin`) ; le soigneur est celui qui tient la fenêtre et jette. */
function patientDuSoin(etat: Jeu): Element[] {
  const f = fenetreDuSoin(etat);
  return f ? [ligne('soin', t('ecran.soin.patient', { patient: garanti(porteurParId(etat, f.patientId), f.patientId, 'patient du soin').label }))] : [];
}

/** Le texte du document remis (`documentEnVue`) ; son titre est celui de la fenêtre. */
function texteDuDocument(etat: Jeu): Element[] {
  const doc = documentEnVue(etat);
  return doc ? [ligne('lecture', doc.texte)] : [];
}

/** La victoire en attente : l'Expérience gagnée et l'argent pris en puces, puis chaque adversaire vaincu et chaque
 *  message de la rencontre ; l'équipement s'attribue par les réglages de la fenêtre (`fenetreDuButin`). */
function victoire(etat: Jeu): Element[] {
  const v = etat.pendingVictory;
  if (!v) return [];
  const argent = formatMoney(v.gold);
  return [
    ...(v.xp ? [puce('victoire/xp', t('ecran.victoire.xp'), avecSigne(v.xp), null, 'reussite')] : []),
    ...(v.gold.gold || v.gold.silver || v.gold.brass ? [puce('victoire/argent', t('ecran.victoire.argent'), argent, null, 'reussite')] : []),
    ...v.defeated.map((d, i) => ligne(`victoire/vaincu/${i}`, d.count > 1 ? t('ecran.victoire.vaincus', { nom: d.label, nombre: d.count }) : d.label)),
    ...(v.messages ?? []).map((m, i) => ligne(`victoire/message/${i}`, m)),
  ];
}

/** Le Sauvetage par le Destin en attente : ce qui emporte le héros, sa mort sans sacrifice au détail, et ses Points de
 *  Destin. */
function destinEnJeu(etat: Jeu): Element[] {
  const p = etat.pendingFateSave;
  const heros = p && porteurParId(etat, p.heroId);
  if (!heros) return [];
  return [ligne('destin/enjeu', t(`ecran.destin.${p.source}`), 'alerte', t('ecran.destin.refus')), puce('destin/points', t('ecran.destin'), String(heros.fate ?? 0))];
}

/** Ce que l'étape courante de la cascade révèle (fin de round, entrée de scène, mutation, Coup Critique…). Un Coup
 *  Critique dit sa localisation, les Blessures perdues s'il en coûte et chaque État infligé en puces, sur un héros en
 *  `echec`, sur un adversaire en `reussite` ; toute autre révélation, chacune de ses lignes. Puis chacun de ses effets,
 *  son explication au détail. Ses lignes vont aussi au journal, où ses effets ne se lisent qu'au survol. */
function revelationDeLEtape(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const r = pc?.participants[pc.cursor]?.reveal;
  if (!r) return [];
  const crit = r.kind === 'critical' ? r.crit : undefined;
  const ton: Ton = r.subjectId && porteurParId(etat, r.subjectId)?.kind === 'hero' ? 'echec' : 'reussite';
  const prefixe = crit ? 'critique' : 'revelation';
  return [
    ...(crit ? [
      puce('critique/localisation', t('ecran.critique.localisation'), crit.location, null, ton),
      ...(crit.woundsLost ? [puce('critique/blessures', t('ecran.jauge.blessures'), avecSigne(-crit.woundsLost), null, ton)] : []),
      ...(crit.conditions ?? []).map((c) => puce(`critique/etat/${c.id}`, conditionLabel(c.id), String(c.value), null, ton)),
    ] : r.lines.map((l, i) => ligne(`revelation/${i}`, l))),
    ...(r.details ?? []).map((d, i) => ligne(`${prefixe}/effet/${i}`, d.text, 'neutre', d.note ?? null)),
  ];
}

/** Le ton d'une ligne d'issue du noyau (`RecapTone`). */
const TON_DE_LA_LIGNE: Record<RecapTone, Ton> = { ok: 'reussite', bad: 'echec', info: 'neutre' };

/** Ce que l'étape courante de la cascade dit sans le révéler (`outcome` posé par son monteur : un affichage, le contexte
 *  d'un choix), chaque ligne à son ton ; une révélation le dit déjà (`revelationDeLEtape`). */
function issueDeLEtape(etat: Jeu): Element[] {
  const pc = etat.pendingCascade;
  const etape = pc?.participants[pc.cursor];
  if (!etape || etape.reveal) return [];
  return (etape.outcome ?? []).map((l, i) => ligne(`issue/${i}`, l.text, l.tone ? TON_DE_LA_LIGNE[l.tone] : 'neutre'));
}

/** Une jauge de `courant` sur `max`. */
const jauge = (id: string, libelle: string, [courant, max]: readonly [number, number]): Element => ({ type: 'jauge', id, ton: 'neutre', libelle, courant, max, texte: t('ecran.jauge', { courant, max }) });

/** L'actif du combat : son nom, ses Blessures et son Mouvement en jauges, puis son Avantage, son Action et chacun de
 *  ses États en puces. */
const actifDuCombat = (actif: NonNullable<Combat['actif']>): Entite => ({
  type: 'entite', id: actif.id, ton: 'neutre', nom: actif.nom,
  elements: [
    jauge('blessures', t('ecran.jauge.blessures'), actif.pb),
    jauge('mouvement', t('ecran.jauge.mouvement'), actif.mouvement),
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

/** Les offres de l'actif, chacune un bouton qui joue son geste (`Offre.geste`), pressée quand elle est armée, refusée
 *  avec sa raison quand elle est fermée ; rangées par la part de l'économie du tour qu'elles prennent, chaque part un
 *  choix qui la nomme une fois, celles qui n'en prennent aucune (la fin du tour) sous le tour. Une offre qui s'offre par
 *  candidat (le sort, l'arme, l'attaque de trait) est un choix à elle, sous sa part, en liste au-delà de
 *  `CHOIX_EN_BOUTONS` candidats : chaque candidat un bouton qui le nomme et joue son geste. Une offre sans geste, dont la
 *  case attend un paramètre que seule la console choisit, n'a pas de bouton : fermée, elle reste un choix sans valeur,
 *  refusé avec sa raison. */
function offresDuCombat(c: Combat): Choix[] {
  const offres = (c.offres?.liste ?? []).filter((o) => o.geste || o.candidats.some((k) => k.geste) || o.refus !== null);
  const libelle = (o: (typeof offres)[number]): string => garanti(ACTIONS.find((a) => a.id === o.id)?.label, o.id, 'libellé de l’offre');
  const jeuDe = (g: GesteDuNoyau): Bouton['jeu'] => ({ type: g.verbe, args: g.args });
  const bouton = (o: (typeof offres)[number]): Bouton => ({
    type: 'bouton', id: o.id, libelle: libelle(o), jeu: jeuDe(garanti(o.geste, o.id, 'geste de l’offre')), presse: o.armee, focus: false, refus: o.refus,
  });
  const parCandidat = (o: (typeof offres)[number]): Choix => ({
    type: o.candidats.length > CHOIX_EN_BOUTONS ? 'liste' : 'choix', id: `offre/${o.id}`, ton: 'neutre', libelle: libelle(o), focus: false, refus: o.refus,
    valeurs: o.candidats.flatMap((k): Bouton[] => (k.geste ? [{
      type: 'bouton', id: `${o.id}/${Object.values(k.ctx).join('/')}`, libelle: k.nom, jeu: jeuDe(k.geste), presse: k.armee, focus: false, refus: k.refus,
    }] : [])),
  });
  return [...new Set(offres.map((o) => o.economie))].flatMap((e): Choix[] => {
    const part = offres.filter((o) => o.economie === e);
    const uniques = part.filter((o) => !o.candidats.length && o.geste);
    return [
      ...(uniques.length ? [{ type: 'choix' as const, id: `economie/${e}`, ton: 'neutre' as const, libelle: t(`ecran.economie.${e}`), focus: false, refus: null, valeurs: uniques.map(bouton) }] : []),
      ...part.filter((o) => o.candidats.length || !o.geste).map(parCandidat),
    ];
  });
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

/** Ce que le panneau du combat dit hors de ses jauges, quand aucune fenêtre ne tient la main : pourquoi la barre est
 *  fermée, la fin du tour armée par un premier geste qui laisserait l'Action intacte (`finDeTourArmee`) ; la fin du
 *  combat. */
function avisDuCombat(c: Combat, fenetreOuverte: boolean): Ligne[] {
  return [
    ...(c.barre.raison === null || fenetreOuverte ? [] : [ligne('raison', c.barre.raison, 'alerte')]),
    ...(c.finDeTourArmee && !fenetreOuverte ? [ligne('finDeTourArmee', t('ecran.finDeTourArmee'), 'alerte')] : []),
    ...(c.fin ? [ligne('fin', t('ecran.fin', { issue: t(`ecran.fin.${c.fin}`) }), TON_DE_LA_FIN[c.fin])] : []),
  ];
}

/** Le bouton d'un geste de la fiche : il montre `fiche` (`null` : la ferme), pressé quand il la montre déjà. */
const boutonDeFiche = (id: string, libelle: string, fiche: FicheOuverte | null, presse: boolean): Bouton => ({
  type: 'bouton', id, libelle, jeu: { fiche }, presse, focus: false, refus: null,
});

/** Chaque héros du groupe en bouton qui ouvre sa fiche, à l'onglet de la fiche ouverte ; celui dont la fiche est
 *  ouverte, pressé, la ferme. */
const herosDuGroupe = (etat: Jeu, ouverte: FicheOuverte | null): Bouton[] =>
  etat.party.map((h) => {
    const presse = ouverte?.heros === h.id;
    return boutonDeFiche(`fiche/${h.id}`, h.label, presse ? null : { heros: h.id, onglet: ouverte?.onglet ?? ONGLETS_DE_LA_FICHE[0] }, presse);
  });

/** Le héros de la fiche : son nom, ses Blessures en jauge, ses Points de Destin, de Chance, de Résilience et de
 *  Détermination, puis chacun de ses États en puces. */
const herosDeLaFiche = (f: FicheDuPorteur): Entite => ({
  type: 'entite', id: f.id, ton: 'neutre', nom: f.nom,
  elements: [
    jauge('blessures', t('ecran.jauge.blessures'), f.blessures),
    puce('destin', t('ecran.destin'), String(f.destin)),
    puce('chance', t('ecran.fiche.chance'), String(f.chance)),
    puce('resilience', t('ecran.fiche.resilience'), String(f.resilience)),
    puce('determination', t('ecran.fiche.determination'), String(f.determination)),
    ...f.etats.map((e) => puce(`etat/${e.id}`, conditionLabel(e.id), String(e.valeur), null, 'alerte')),
  ],
});

/** Un nombre d'exemplaires, dit quand il y en a plusieurs. */
const nombre = (n: number): string | null => (n > 1 ? t('ecran.fiche.nombre', { nombre: n }) : null);

/** L'onglet ouvert de la fiche `f`, chaque entrée en puce : une Caractéristique par son abréviation, son nom au
 *  détail ; une Compétence et la valeur de son Test, sa Caractéristique et ses Augmentations au détail, par nom ; un
 *  Talent et son niveau, le premier paragraphe de sa description au détail. Chaque possession en bouton qui la nomme,
 *  son nombre s'il y en a plusieurs, les équipées d'abord : il la choisit ; la choisie, pressée, se laisse. */
function corpsDeLaFiche(f: FicheDuPorteur, ouverte: FicheOuverte): (Puce | Bouton)[] {
  switch (ouverte.onglet) {
    case 'caracteristiques': return f.caracteristiques.map((c) => puce(`carac/${c.cle}`, c.abrege, String(c.valeur), c.libelle));
    case 'competences': {
      const carac = new Map(f.caracteristiques.map((c) => [c.cle, c]));
      return f.competences
        .map((c, i) => {
          const k = carac.get(c.caracteristique)!;
          return puce(`competence/${i}`, c.libelle, String(c.valeur), t('ecran.fiche.competence', { carac: k.abrege, base: k.valeur, avances: c.avances }));
        })
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
    }
    case 'talents': return f.talents.map((x, i) => puce(`talent/${i}`, x.libelle, nombre(x.fois), resume(x.desc)));
    case 'possessions': return [...f.possessions]
      .sort((a, b) => Number(b.equipee) - Number(a.equipee))
      .map((p) => {
        const choisie = ouverte.objet === p.uid;
        const libelle = p.nombre > 1 ? t('ecran.fiche.possession', { libelle: p.libelle, nombre: p.nombre }) : p.libelle;
        return boutonDeFiche(`possession/${p.uid}`, libelle, { heros: f.id, onglet: 'possessions', ...(choisie ? {} : { objet: p.uid }) }, choisie);
      });
  }
}

/** Un geste du noyau (`GesteDuNoyau`) en bouton, pressé quand il dit l'état courant, refusé avec sa raison. */
const boutonDeGeste = (id: string, libelle: string, g: GesteDuNoyau, refus: string | null, presse = false): Bouton => ({
  type: 'bouton', id, libelle, jeu: { type: g.verbe, args: g.args }, presse, focus: false, refus,
});

/** Un geste du noyau nommé en bouton (`boutonDeGeste`). */
const boutonDuNoyau = (id: string, g: GesteFermable & { libelle: string }): Bouton => boutonDeGeste(id, g.libelle, g.geste, g.refus);

/** Un geste à choix sur un objet : une liste dont chaque choix joue son geste, refusé avec elle. */
const listeDObjet = (id: string, libelle: string, g: GesteAChoix<unknown>): Choix => ({
  type: 'liste', id, ton: 'neutre', libelle, focus: false, refus: g.refus,
  valeurs: g.choix.map((c, i) => boutonDeGeste(`${id}/${i}`, c.libelle, c.geste, g.refus)),
});

/** La possession choisie de la fiche `f` (`FicheOuverte.objet`) en entité : son nom, au ton `reussite` quand elle est
 *  équipée ; son nombre, son argent et le contenant où elle est rangée en puces ; puis chacun de ses gestes
 *  (`gestesDeLObjet`), refusé avec sa raison : la porter, la tenir dans une main, l'utiliser, la ranger dans un
 *  contenant ou l'en sortir, la donner à un porteur à ses côtés, l'évaluer, la détecter. */
function objetDeLaFiche(etat: Jeu, f: FicheDuPorteur, ouverte: FicheOuverte): Entite[] {
  const p = ouverte.onglet === 'possessions' ? f.possessions.find((x) => x.uid === ouverte.objet) : undefined;
  const g = p && gestesDeLObjet(etat, f.id, p.uid);
  if (!p || !g) return [];
  const simple = (id: 'porter' | 'utiliser' | 'sortir' | 'evaluer' | 'detecter', presse = false): Bouton | null => {
    const x = g[id];
    return x && boutonDeGeste(id, t(`ecran.objet.${id}`), x.geste, x.refus, presse);
  };
  const elements: (Element | null)[] = [
    p.nombre > 1 ? puce('nombre', t('ecran.fiche.nombre', { nombre: p.nombre }), null) : null,
    p.argent === null ? null : puce('argent', p.argent, null),
    p.contenant === null ? null : puce('contenant', t('ecran.objet.contenant', { contenant: p.contenant }), null),
    simple('porter', g.porter?.porte),
    ...(g.mains ? (['main', 'off'] as const).map((m) => boutonDeGeste(m, t(`ecran.objet.${m}`), g.mains![m].geste, g.mains![m].refus, g.mains![m].tenue)) : []),
    simple('utiliser'),
    g.ranger && listeDObjet('ranger', t('ecran.objet.ranger'), g.ranger),
    simple('sortir'),
    g.donner && listeDObjet('donner', t('ecran.objet.donner'), g.donner),
    simple('evaluer'),
    simple('detecter'),
  ];
  return [{ type: 'entite', id: p.uid, ton: p.equipee ? 'reussite' : 'neutre', nom: p.libelle, elements: elements.filter((e): e is Element => e !== null) }];
}

/** Les zones de la fiche `ouverte` : son héros, ses onglets et sa fermeture, l'onglet ouvert, la possession choisie ;
 *  vides sans fiche ou sans son héros. */
function zonesDeLaFiche(etat: Jeu, ouverte: FicheOuverte | null): Pick<ZonesDeLEcran, 'fiche.heros' | 'fiche.gestes' | 'fiche.corps' | 'fiche.objet'> {
  const f = ouverte && ficheDuPorteur(etat, ouverte.heros);
  if (!ouverte || !f) return { 'fiche.heros': [], 'fiche.gestes': [], 'fiche.corps': [], 'fiche.objet': [] };
  return {
    'fiche.heros': [herosDeLaFiche(f)],
    'fiche.gestes': [
      ...ONGLETS_DE_LA_FICHE.map((o) => boutonDeFiche(`onglet/${o}`, t(`ecran.fiche.onglet.${o}`), { heros: f.id, onglet: o }, o === ouverte.onglet)),
      boutonDeFiche('fermer', t('ecran.fiche.fermer'), null, false),
    ],
    'fiche.corps': corpsDeLaFiche(f, ouverte),
    'fiche.objet': objetDeLaFiche(etat, f, ouverte),
  };
}

/** Les zones de l'écran de la partie `etat`, de sa projection `p`, de la fenêtre qui tient la main `fenetre`, de la
 *  fiche que l'hôte montre `fiche` et de la création qu'il tient `creation` (`zonesDeLaCreation`). */
export function zonesDeLEcran(etat: Jeu, p: Projection, fenetre: FenetreADessiner | null, fiche: FicheOuverte | null, creation: CreationOuverte | null): ZonesDeLEcran {
  const c = p.combat;
  const gestes = fenetre ? elementsDesGestes(fenetre.gestes) : [];
  const corps = fenetre ? corpsDeLaFenetre(etat) : [];
  const portes = choixPortes(corps);
  const reglages = new Set(fenetre?.gestes.filter((g) => g.reglage).map((g) => g.cle));
  const etape = fenetre ? [fenetre.etape === fenetre.titre ? null : fenetre.etape, fenetre.proprietaire.genre === 'porteur' ? fenetre.proprietaire.nom : null].filter((x): x is string => x !== null) : [];
  return {
    'fenetre.titre': fenetre ? [ligne('titre', fenetre.titre)] : [],
    'fenetre.etape': etape.length ? [ligne('etape', etape.join(t('ecran.separateur')))] : [],
    'fenetre.corps': corps,
    'fenetre.reglages': gestes.filter((g) => reglages.has(g.id) && !portes.has(g.id)),
    'fenetre.gestes': gestes.filter((g) => !reglages.has(g.id)),
    'combat.tour': c ? [ligne('tour', c.tour === null ? t('ecran.round', { round: c.round }) : t('ecran.tour', { round: c.round, tour: c.tour, tours: c.tours }))] : [],
    'combat.ordre': c ? ordreDuTour(etat, c) : [],
    'combat.actif': c?.actif ? [actifDuCombat(c.actif)] : [],
    'combat.avis': c ? avisDuCombat(c, fenetre !== null) : [],
    'combat.apercu': c ? [apercuDe(c)].flatMap((a) => (a === null ? [] : [ligne('apercu', a)])) : [],
    'combat.offres': c ? offresDuCombat(c) : [],
    'exploration.gestes': (fenetre ? [] : p.exploration?.gestes.liste ?? []).map((g, i): Bouton => ({
      type: 'bouton', id: `exploration/${i}`, libelle: g.libelle, jeu: { suite: g.gestes.map((x) => ({ type: x.verbe, args: x.args })) }, presse: false, focus: false, refus: g.refus ?? null,
    })),
    ...zonesDuDialogue(etat, fenetre !== null),
    'journal.titre': c ? [ligne('journal', t('ecran.journal'))] : [],
    'groupe.heros': herosDuGroupe(etat, fiche),
    ...zonesDeLaFiche(etat, fiche),
    ...zonesDeLaCreation(etat, creation),
  };
}

/** Les zones de la conversation en cours (`conversationEnVue`), quand aucune fenêtre ne la suspend : son
 *  interlocuteur, sa réplique, et chaque réponse visible en bouton qui la choisit, ce qu'elle annonce (son Test, son
 *  coût) avant son libellé, refusée avec sa raison. */
function zonesDuDialogue(etat: Jeu, fenetreOuverte: boolean): Pick<ZonesDeLEcran, 'dialogue.orateur' | 'dialogue.replique' | 'dialogue.reponses'> {
  const v = fenetreOuverte ? null : conversationEnVue(etat);
  return {
    'dialogue.orateur': v?.orateur ? [ligne('orateur', v.orateur)] : [],
    'dialogue.replique': v?.replique ? [ligne('replique', v.replique)] : [],
    'dialogue.reponses': (v?.reponses ?? []).map((r): Bouton => ({
      type: 'bouton', id: `reponse/${r.id}`, libelle: [r.annonce, r.label, r.cost && formatMoney(r.cost)].filter(Boolean).join(' '),
      jeu: { type: r.geste.verbe, args: r.geste.args }, presse: false, focus: false, refus: r.refus ?? null,
    })),
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
 *  l'appel, montré à la demande. Un événement sans texte n'en écrit aucune. Chaque jour de jeu s'ouvre sur sa date, en
 *  alerte, dès qu'une ligne s'écrit un autre jour que `veille` (le jour de la dernière ligne déjà écrite, `null` avant
 *  la première) ; `jour` est celui de la dernière ligne de l'appel. */
export function lignesDuJournal(etat: Jeu, avant: number, journal: readonly LigneDuJournal[], veille: number | null): { lignes: Ligne[]; jour: number | null } {
  let jour = veille;
  const lignes = journal.reduce<Ligne[]>((lignes, l, i) => {
    const texte = l.de === 'journal' ? l.texte : l.evenement.text;
    if (!texte) return lignes;
    const precedente = lignes[lignes.length - 1] as Ligne | undefined;
    if (l.de === 'combat' && l.evenement.kind === 'detail' && precedente) {
      const sous = texte.replace(/^\s*↳\s*/, '');
      return [...lignes.slice(0, -1), { ...precedente, detail: precedente.detail === null ? sous : `${precedente.detail}\n${sous}` }];
    }
    const ce = dayIndex(l.heure);
    const date = ce === jour ? [] : [ligne(`journal/jour/${ce}`, formatJourImperial(l.heure), 'alerte')];
    jour = ce;
    const id = `journal/${avant + i}`;
    return [...lignes, ...date, l.de === 'journal' ? ligne(id, texte) : ligne(id, texte, tonDeLEvenement(etat, l.evenement))];
  }, []);
  return { lignes, jour };
}
