/**
 * LE COMBAT DU DÔME ÉCRIT (#4411) : ce que les états écrits de la famille combat partagent, dans la forme du contrat
 * (`src/hote/elements.ts`, `src/hote/ecran.ts`) : les combattants du dôme (`src/scenes/test-scenarios/22-dome.ts`), un
 * tour de l'ordre, le journal, la fin du tour et le menu de la partie tels que ses planches figées les servent
 * (`figerLesPlanches`), puis une fenêtre du bas posée dessus. Un état que le jeu fige se capture (`MaquetteCapturee`) ; ce
 * module ne sert que ceux qu'aucune planche ne fige.
 */
import {
  bouton,
  choix,
  ligne,
  type Bouton,
  type Choix,
  type Element,
  type Entite,
  type Jauge,
  type Jet,
  type Puce,
  type Ton,
} from '../../../../../../src/hote/elements';
import type { ZonesDeLEcran } from '../../../../../../src/hote/ecran';
import {
  cleDuGeste,
  NOM_DU_VERBE_DE_JET,
  VERBE_DE_CHOIX,
  VERBE_DE_REGLAGE,
  VERBE_DE_SORTIE,
  type AxeDuChoix,
  type FenetreAChoix,
  type FlowKey,
  type GesteDuJeu,
} from '../../../../../../src/noyau/index';
import { BUSTES_DU_DOME, reponsesDeLEcran, SANS_JEU, type Decor, type Maquette } from './maquette';

/** Une fenêtre qu'un geste nomme, et un réglage de jet (`GesteDuJeu`). */
type Fenetre = NonNullable<GesteDuJeu['fenetre']>;
type Reglage = NonNullable<GesteDuJeu['reglage']>;

/** Les combattants du dôme : nom, Blessures au plus, ennemi ou non ; `chamane`, le lanceur gobelin de la suite du combat. */
const COMBATTANTS: Record<string, { nom: string; max: number; ennemi: boolean }> = {
  sorciere: { nom: 'Ilyanwe la Voilée', max: 17, ennemi: false },
  protegee: { nom: 'Berta', max: 12, ennemi: false },
  'enemy-enc-dome-1': { nom: 'Orc', max: 14, ennemi: true },
  'enemy-enc-dome-0': { nom: 'Tireur gobelin', max: 11, ennemi: true },
  chamane: { nom: 'Chamane gobelin', max: 11, ennemi: true },
};
export const ILYANWE = 'sorciere';
export const BERTA = 'protegee';
export const ORC = 'enemy-enc-dome-1';
export const TIREUR = 'enemy-enc-dome-0';
export const CHAMANE = 'chamane';

/** Les bustes du dôme et du chamane. */
const BUSTES: Decor['bustes'] = { ...BUSTES_DU_DOME, chamane: 'gobelin' };

/** Un combattant de l'ordre et ses Blessures courantes, son maximum par défaut. */
export type Rang = string | [string, number];

export const jauge = (id: string, libelle: string, courant: number, max: number, texte = `${courant} / ${max}`): Jauge => ({ type: 'jauge', id, ton: 'neutre', libelle, courant, max, texte });
export const puce = (id: string, libelle: string, valeur: string | null, ton: Ton = 'neutre'): Puce => ({ type: 'puce', id, ton, libelle, valeur, detail: null, jeu: null });

/** Le rang `r` de l'ordre sous `place` (`suite/` au round suivant, `ordre/` à jouer), au ton `alerte` s'il est l'actif. */
const rang = (place: 'suite/' | 'ordre/', r: Rang, actif: boolean): Entite => {
  const [id, courant] = typeof r === 'string' ? [r, COMBATTANTS[r].max] : r;
  const c = COMBATTANTS[id];
  const cle = place === 'ordre/' ? id : `suite/${id}`;
  return {
    type: 'entite', id: `${place}${id}`, ton: actif ? 'alerte' : c.ennemi ? 'echec' : 'neutre', nom: c.nom,
    elements: [{ type: 'portrait', id: 'portrait', combattant: id }, jauge('blessures', 'Blessures', courant, c.max), bouton(`fiche/${cle}`, 'Fiche', { fiche: { porteur: id } })],
  };
};

/** Le tour du combat : la borne du round, l'ordre (les rangs passés au round suivant, puis ceux à jouer, l'actif en
 *  dernier), les lignes du journal, la plus récente en dernier. */
export interface TourDuDome {
  tour: string;
  suite: Rang[];
  round: string;
  ordre: Rang[];
  journal: string[];
  /** Au début du round, aucun combattant n'a la main. */
  sansActif?: true;
}

/** Le tour d'Ilyanwe au premier round, comme la fenêtre d'attaque du dôme le sert (`attaque`). */
export const TOUR_D_ILYANWE: TourDuDome = {
  tour: 'Round 1 · tour 1 sur 4', suite: [TIREUR, BERTA, ILYANWE], round: 'Round 2', ordre: [ORC, TIREUR, BERTA, ILYANWE],
  journal: ['Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).', 'Ilyanwe la Voilée charge Orc (+1 Avantage).'],
};
/** Le tour de Berta au premier round. */
export const TOUR_DE_BERTA: TourDuDome = {
  tour: 'Round 1 · tour 2 sur 4', suite: [TIREUR, ILYANWE, BERTA], round: 'Round 2', ordre: [ORC, TIREUR, BERTA],
  journal: ['Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).', 'Berta attaque Orc.'],
};
/** Le tour de l'Orc, qui attaque Berta. */
export const TOUR_DE_L_ORC: TourDuDome = {
  tour: 'Round 1 · tour 4 sur 4', suite: [TIREUR, BERTA, ILYANWE], round: 'Round 2', ordre: [ORC],
  journal: ['Tireur gobelin tire sur Berta et la manque.', 'Orc s’avance vers Berta.', 'Orc attaque Berta.'],
};

/** Les zones du combat du tour `t` : borne, ordre, fin du tour fermée par la fenêtre, journal, menu de la partie. */
const zonesDuTour = (t: TourDuDome): Partial<ZonesDeLEcran> => {
  const actif = t.sansActif ? -1 : t.ordre.length - 1;
  return {
    'combat.tour': [ligne('tour', t.tour)],
    'combat.ordre': [...t.suite.map((r) => rang('suite/', r, false)), ligne('round', t.round), ...t.ordre.map((r, k) => rang('ordre/', r, k === actif))],
    'combat.offres': [choix('economie/aucun', 'Tour', [{ ...bouton('fin-de-tour', 'Fin du tour', SANS_JEU, false, 'une fenêtre tient la main'), touche: 'fin_de_tour', icone: 'interface/fin-du-tour' }])],
    'journal.titre': [{ type: 'entite', id: 'journal', ton: 'neutre', nom: 'Chronique', elements: [{ type: 'icone', id: 'icone', icone: 'navigation/carnet' }] }],
    'groupe.gestes': [bouton('creation', 'Nouveau héros', SANS_JEU, false, 'La composition du groupe ne change pas en combat.')],
    'partie.gestes': [bouton('sauvegardes', 'Sauvegardes', SANS_JEU), bouton('reglages', 'Options', SANS_JEU), bouton('salon', 'Jouer en ligne', SANS_JEU), bouton('quitter', 'Quitter la partie', SANS_JEU)],
    'partie.menu': [{ type: 'entite', id: 'menu', ton: 'neutre', nom: 'Menu de la partie', elements: [{ type: 'icone', id: 'icone', icone: 'interface/reglages' }] }],
  };
};

/** Une fenêtre du bas : son titre, son corps, ses réglages, ses gestes, les réserves qu'ils dépensent. */
export interface FenetreDuBas {
  titre: string;
  corps: Element[];
  reglages?: (Choix | Bouton)[];
  gestes: Bouton[];
  reserves?: Puce[];
}

/** L'état `nom` : la fenêtre `f` sur le tour `t` du dôme, sur la cour à l'état `variante` ; sans tour, la fenêtre seule
 *  sur la cour vidée de ses adversaires (`cour-videe`). */
export const fenetreSurLeDome = (nom: string, titre: string, variante: string, t: TourDuDome | null, f: FenetreDuBas): Maquette => ({
  nom, titre, gabarits: t ? ['combat', 'fenetre-du-bas'] : ['fenetre-du-bas'],
  decor: { scene: t ? 'cour' : 'cour-videe', variante, bustes: BUSTES },
  reponses: reponsesDeLEcran({
    disposition: null,
    zones: { ...(t ? zonesDuTour(t) : {}), 'fenetre.titre': [ligne('titre', f.titre)], 'fenetre.corps': f.corps, 'fenetre.reglages': f.reglages ?? [], 'fenetre.gestes': f.gestes, 'fenetre.reserves': f.reserves ?? [] },
    journal: (t?.journal ?? []).map((texte, k) => ligne(`journal/${k}`, texte)),
    projection: { combat: null, exploration: null, fenetre: null },
  }),
});

/** L'issue d'un combat : le titre en toile, sa suite, l'action unique, sur la cour à l'état `variante`. */
export const issueDuDome = (nom: string, titre: string, variante: string, fenetre: Fenetre, suite: string | null, sortie: string): Maquette => ({
  nom, titre, gabarits: ['recit'], decor: { scene: 'cour', variante, bustes: BUSTES },
  reponses: reponsesDeLEcran({
    disposition: fenetre,
    zones: {
      'groupe.gestes': zonesDuTour(TOUR_D_ILYANWE)['groupe.gestes'], 'partie.gestes': zonesDuTour(TOUR_D_ILYANWE)['partie.gestes'], 'partie.menu': zonesDuTour(TOUR_D_ILYANWE)['partie.menu'],
      'fenetre.titre': [ligne('titre', titre)], 'fenetre.corps': suite ? [ligne(`${fenetre}/suite`, suite)] : [],
      'fenetre.gestes': [{ ...bouton(cleDuGeste({ verbe: VERBE_DE_SORTIE, fenetre }), sortie, SANS_JEU), focus: true }],
    },
    journal: [],
    projection: { combat: null, exploration: null, fenetre: null },
  }),
});

/* ───────── les pièces d'une fenêtre ───────── */

/** Le jet du combattant `combattant` : son libellé, son seuil ; tombé, son résultat, son DR, son verdict. */
export const jet = (id: string, combattant: string, libelle: string, cible: string | null, tombe?: { resultat: string; dr: string; reussite: boolean; verdict?: string }, modificateurs: [string, string][] = []): Jet => ({
  type: 'jet', id, ton: tombe ? (tombe.reussite ? 'reussite' : 'echec') : 'neutre', qui: COMBATTANTS[combattant].nom, combattant, libelle, cible,
  resultat: tombe?.resultat ?? null, dr: tombe ? `DR ${tombe.dr}` : null, verdict: tombe ? (tombe.verdict ?? (tombe.reussite ? 'réussite' : 'échec')) : null,
  modificateurs: modificateurs.map(([l, v], k) => puce(`${id}/m${k}`, l, v)), detail: null,
});

/** Le héros d'une fenêtre sans dé : son buste, son nom, ce qui le met en jeu ; `subit`, au ton `echec`. */
export const heros = (combattant: string, lignes: string[], { subit = false, modificateurs = [] as string[] } = {}): Entite => ({
  type: 'entite', id: 'heros', ton: subit ? 'echec' : 'neutre', nom: COMBATTANTS[combattant].nom,
  elements: [{ type: 'portrait', id: 'portrait', combattant }, ...lignes.map((t, k) => ligne(`ligne/${k}`, t)), ...modificateurs.map((m, k) => puce(`modif/${k}`, m, null))],
});

/** Ce que le jet vise sans dé : son buste, son nom, son rôle, ses Blessures. */
export const visee = (combattant: string, role: string): Entite => {
  const c = COMBATTANTS[combattant];
  return { type: 'entite', id: 'visee', ton: c.ennemi ? 'echec' : 'neutre', nom: c.nom, elements: [{ type: 'portrait', id: 'portrait', combattant }, ligne('role', role), jauge('blessures', 'Blessures', c.max, c.max)] };
};

/** Ce que le Test décide : `[issue, effet]` par ligne, la tombée à son rang `tombee`. */
export const enjeu = (nom: string, issues: [string, string][], tombee: number | null = null): Entite => ({
  type: 'entite', id: 'enjeu', ton: 'neutre', nom, elements: issues.map(([l, v], k) => puce(`issue/${k}`, l, v, k === tombee ? 'alerte' : 'neutre')),
});

/** Le cumul d'un Test étendu : `courant` DR sur `max`. */
export const cumul = (courant: number, max: number): Jauge => jauge('cumul', 'Cumul', courant, max, `${courant} DR sur ${max}`);

/** La table à tirer ou tirée : son nom, sa règle ou son effet, et son d100, `null` avant le dé. */
export const tirage = (nom: string, texte: string, table: string, de: string | null): Element[] => [ligne('tirage/nom', nom), puce('tirage/de', de === null ? `${table}\nà tirer au d100` : `${table}\ntirée au d100`, de), ligne('tirage/texte', texte)];

/** Un choix en cartes : `[libellé, détail]` par valeur sous l'id `id/<valeur>`, la pressée au rang `presse`, les
 *  fermées avec leur raison. */
export const cartes = (id: string, libelle: string, valeurs: [unknown, string, string, string?][], presse: number): Choix =>
  choix(id, libelle, valeurs.map(([valeur, l, detail, refus], k) => ({ ...bouton(`${id}/${JSON.stringify(valeur)}`, l, SANS_JEU, k === presse, refus ?? null), detail })));

/** L'offre `id` de la barre en cartes (`offre/<id>`, `offresDuCombat`) : `[id, libellé, détail, refus]` par candidat, sous
 *  l'id que le jeu lui donne, le pressé au rang `presse`. */
export const offre = (id: string, libelle: string, candidats: [string, string, string, string?][], presse: number): Choix =>
  choix(`offre/${id}`, libelle, candidats.map(([v, l, detail, refus], k) => ({ ...bouton(v, l, SANS_JEU, k === presse, refus ?? null), detail })));

/** Un réglage du jet `flux` : `[valeur, libellé]` par valeur, la pressée au rang `presse`. */
export const reglage = (flux: FlowKey, cle: Reglage, libelle: string, valeurs: [unknown, string, string?][], presse: number): Choix => {
  const id = reglageDe(flux, cle);
  return choix(id, libelle, valeurs.map(([v, l, detail], k) => ({ ...bouton(`${id}/${JSON.stringify(v)}`, l, SANS_JEU, k === presse), detail: detail ?? null })));
};

/** Le geste `g` du noyau, sous son identité (`cleDuGeste`), en focus s'il est le principal, fermé de sa raison. */
export const geste = (g: GesteDuJeu, libelle: string, { focus = false, refus = null as string | null } = {}): Bouton => ({ ...bouton(cleDuGeste(g), libelle, SANS_JEU, false, refus), focus });

/** L'identité du choix de l'axe `axe` de la fenêtre `fenetre` (`fenetreChoisir`). */
export const choixDe = (fenetre: FenetreAChoix, axe: AxeDuChoix): string => cleDuGeste({ verbe: VERBE_DE_CHOIX, fenetre, axe });
/** L'identité du réglage `cle` du jet `flux` (`jetRegler`). */
export const reglageDe = (flux: FlowKey, cle: Reglage): string => cleDuGeste({ verbe: VERBE_DE_REGLAGE, flux, reglage: cle });
/** Le verbe de jet `verbe` sur le flux `flux`. */
export const gesteDeJet = (verbe: keyof typeof NOM_DU_VERBE_DE_JET, flux: FlowKey): GesteDuJeu => ({ verbe: NOM_DU_VERBE_DE_JET[verbe], flux });

/** Les raisons de fermeture des gestes d'un jet (`src/i18n/messages/fr.ts:146-149`). */
const FERME = { jetReussi: 'Le jet est réussi.', dejaRelance: 'Ce Test a déjà été relancé.', sansChance: 'Plus de Point de Chance.', sansResilience: 'Plus de Point de Résilience.' };

/** Les gestes d'un jet `flux` avant le dé : « Lancer », « Annuler » quand le flux le permet, « Résilience ». */
export const avantLeDe = (flux: FlowKey, { annuler = false, resilience = 1 } = {}): Bouton[] => [
  geste(gesteDeJet('lancer', flux), 'Lancer', { focus: true }),
  ...(annuler ? [geste(gesteDeJet('annuler', flux), 'Annuler')] : []),
  geste(gesteDeJet('forcerLaReussite', flux), 'Résilience', { refus: resilience > 0 ? null : FERME.sansResilience }),
];

/** Les gestes d'un jet `flux` après le dé : « Appliquer », « Relancer », « Chance : +1 DR », « Pacte », « Résilience »,
 *  fermés sur une réussite, un Test déjà relancé ou une réserve vide (LDB 17 l.23-24, l.68). */
export const apresLeDe = (flux: FlowKey, { reussi = false, relance = false, chance = 1, resilience = 1 } = {}): Bouton[] => [
  geste(gesteDeJet('valider', flux), 'Appliquer', { focus: true }),
  geste(gesteDeJet('relancer', flux), 'Relancer', { refus: relance ? FERME.dejaRelance : reussi ? FERME.jetReussi : chance > 0 ? null : FERME.sansChance }),
  geste(gesteDeJet('ajouterUnDR', flux), 'Chance : +1 DR', { refus: chance > 0 ? null : FERME.sansChance }),
  geste(gesteDeJet('pactiser', flux), 'Pacte'),
  geste(gesteDeJet('forcerLaReussite', flux), 'Résilience', { refus: reussi ? FERME.jetReussi : resilience > 0 ? null : FERME.sansResilience }),
];

/** Les réserves d'un héros : Chance, Résilience, Détermination. */
export const reserves = ({ chance, resilience, determination }: { chance: number; resilience: number; determination: number }): Puce[] =>
  [puce('chance', 'Chance', String(chance)), puce('resilience', 'Résilience', String(resilience)), puce('determination', 'Détermination', String(determination))];
/** Une seule réserve, sous `libelle`. */
export const reserve = (id: string, libelle: string, valeur: number): Puce[] => [puce(id, libelle, String(valeur))];
/** Les réserves des deux héros de la cour (`RESERVES`, `../combat/socle.js`). */
export const RESERVES = { ilyanwe: { chance: 4, resilience: 3, determination: 3 }, berta: { chance: 2, resilience: 1, determination: 1 } };
