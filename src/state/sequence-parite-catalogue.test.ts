/**
 * GARDE DE MIGRATION du texte joueur passé au catalogue (#1318 V8b + V8c₀) — la PARITÉ À L'OCTET.
 *
 * Ce que la vague a fait : remplacer des gabarits FR écrits au flux par des sorties de catalogue
 * (`t()` et les fabriques t()-backed de `rollSeam`). Une migration de ce genre ne se prouve pas par
 * « ça compile » : elle se prouve en montrant que la phrase RENDUE n'a pas bougé d'un octet. Les
 * cliquets de la vague comptent des littéraux ; AUCUN ne compare des phrases — c'est le trou que ce
 * fichier ferme.
 *
 * Le côté « avant » est le littéral tel qu'il était écrit au site (relu au diff de migration), gardé
 * ICI comme oracle figé ; le côté « après » monte le CATALOGUE RÉEL (`fr.ts`) par les mêmes appels que
 * la production. Retoucher une de ces entrées de catalogue sans le vouloir rougit donc ici, à la
 * phrase près — y compris sur un tiret cadratin, une espace ou un exposant.
 *
 * Ce test ne dit RIEN de la 2ᵉ langue : il verrouille la locale FR (la seule montée en v1). Une
 * locale ajoutée ne le fait pas mentir — elle ne passe simplement pas par lui.
 */
import { describe, it, expect } from 'vitest';
import { t } from '../i18n';
import { stepDetail, stepFraction, stepPrecision } from './rollSeam';
import { dataLabel } from '../data';
import { riverForceLabel } from '../engine/riverNavigation';
import { locationLabel } from '../engine/types';
import { shipLocationLabel } from '../engine/shipCritical';
import { riverLocLabel } from './riverVoyageFlow';
import { diseaseLabel, refLabel, findCareerById } from '../data';
import type { PlayerText } from '../i18n/playerText';
import { ammoFamilyLabel } from '../engine/items';
import { spellMoney } from '../engine/money';
import { qualityClassLabel } from '../engine/qualities/craftEconomy';
import { structureCollapseLog } from '../engine/structureCritical';
import { traitArgSkeleton } from '../engine/traits/dispatch';
import { validateCareerChange } from '../engine/advancement';
import { talentMaxLabel } from '../engine/careerSlots';
import { KEYBINDINGS, bindingLabel, keySectionLabel, keyLabel } from './keybindings';
import type { Combatant } from '../engine/types';

/** Un site migré : ce que le flux écrivait AVANT, ce que le catalogue rend APRÈS. */
interface Site {
  /** `fichier:ligne` du site de production migré. */
  site: string;
  /** La phrase telle que le gabarit inline la produisait (oracle figé, relu au diff). */
  avant: string;
  /** La MÊME phrase, montée depuis le catalogue par les appels de la production. */
  apres: string;
}

/* ── V8b : les positions NOMMÉES du contrat de séquence (`state/sequenceContract.ts`) ────────────*/

const MANCHE = 3, DIST = { distance: 4, escapeAt: 10 };
const distanceDite = (p: { distance: number; escapeAt: number }): PlayerText =>
  t('pursuit.titreDistance', { distance: p.distance, evasion: p.escapeAt });

/* Libellés de DONNÉE des fixtures (nom de jeu, nom de héros, nom de camp) : ils passent par des
 * CONSTANTES, jamais en littéral à l'appel de `dataLabel` — le minteur du texte authored n'accepte
 * aucune prose écrite au call-site (cliquet 3, `player-text-ratchet.test.ts`), et un test ne s'exempte
 * pas d'une règle qu'il sert. */
const JEU_OPTION = 'Bras de fer', HEROS = 'Sigrid', ADVERSAIRE = 'Brandt';
const CAMP_MIEN = 'les Assiégeants', CAMP_SIEN = 'les Assiégés';

const SEQUENCE: Site[] = [
  {
    site: 'pursuitFlow.ts:268 — SequenceRound.title (manche de course)',
    avant: `Poursuite — manche ${MANCHE} (Distance ${DIST.distance}/${DIST.escapeAt})`,
    apres: stepPrecision(t('pursuit.titreManche', { n: MANCHE }), distanceDite(DIST)),
  },
  {
    site: 'pursuitFlow.ts:278 — SequenceRound.title (rattrapés)',
    avant: `Poursuite — rattrapés ! (Distance ${0}/${10})`,
    apres: stepPrecision(t('pursuit.titreRattrapes'), distanceDite({ distance: 0, escapeAt: 10 })),
  },
  {
    site: 'pursuitFlow.ts:168 — repli du libellé de rangée (ligne de journal)',
    avant: 'Mouvement',
    apres: t('step.pursuitMouvement'),
  },
  {
    site: 'tavernFlow.ts:542 — SequenceRound.title (choix d’option)',
    avant: `${JEU_OPTION} — ${t('tavern.optionTitre')}`,
    apres: stepDetail(dataLabel(JEU_OPTION), t('tavern.optionTitre')),
  },
  {
    site: 'tavernFlow.ts:716 — SequenceRound.title (volée de lancers)',
    avant: `Torchon trempé — lancer ${2}/${5}`,
    apres: t('tavern.volleyLancer', { jeu: 'Torchon trempé', n: 2, total: 5 }),
  },
  {
    site: 'tavernFlow.ts:818 — SequenceRound.title (mi-temps)',
    avant: `Middenball — ${2}ᵉ mi-temps, tour ${1}/${3}`,
    apres: t('tavern.miTempsTitre', { jeu: 'Middenball', phase: 2, n: 1, total: 3 }),
  },
  {
    site: 'tavernFlow.ts:1740 — SequenceBoardCamp.label (camps asymétriques, mien)',
    avant: `${HEROS} (${CAMP_MIEN})`,
    apres: stepPrecision(dataLabel(HEROS), dataLabel(CAMP_MIEN)),
  },
  {
    site: 'tavernFlow.ts:1741 — SequenceBoardCamp.label (camps asymétriques, sien)',
    avant: `${ADVERSAIRE} (${CAMP_SIEN})`,
    apres: stepPrecision(dataLabel(ADVERSAIRE), dataLabel(CAMP_SIEN)),
  },
];

/* ── V8b₂ : les positions rougies par le MARQUAGE `PlayerText` du contrat (8 positions) ──────────
 * Le lot précédent avait migré ces textes par relecture ; celui-ci les rend IMPOSSIBLES à réécrire au
 * flux (le type les refuse). Ce que le type ne dit pas, c'est que la phrase n'a pas bougé — d'où ces
 * entrées, au même standard que les précédentes. */

const JEU_EQUIPE = 'Middenball', HEROS2 = 'Kurt', ADVERSAIRE2 = 'Otto';
const TOUR = { n: 2, mien: 27, sien: 14 };

const MARQUAGE: Site[] = [
  {
    site: 'tavernFlow.ts:877 — SequenceRound.title (manche ordinaire, les deux camps)',
    avant: `${JEU_OPTION} — ${HEROS2} contre ${ADVERSAIRE2}`,
    apres: stepDetail(dataLabel(JEU_OPTION), t('tavern.contre', { who: HEROS2, adversaire: ADVERSAIRE2 })),
  },
  {
    site: 'tavernFlow.ts:1083 — ligne de journal d’un tour d’équipe (sans but)',
    avant: `${JEU_EQUIPE} — tour ${TOUR.n} : ${TOUR.mien} DR contre ${TOUR.sien}`,
    apres: t('tavern.equipeTour', { jeu: JEU_EQUIPE, ...TOUR }),
  },
  {
    site: 'tavernFlow.ts:1082 — ligne de journal d’un tour d’équipe (but du GROUPE)',
    avant: `${JEU_EQUIPE} — tour ${TOUR.n} : ${TOUR.mien} DR contre ${TOUR.sien} — BUT pour votre équipe !`,
    apres: t('tavern.equipeTourBut', { jeu: JEU_EQUIPE, ...TOUR, qui: t('tavern.equipeQui') }),
  },
  {
    site: 'tavernFlow.ts:1082 — ligne de journal d’un tour d’équipe (but de l’ADVERSAIRE)',
    avant: `${JEU_EQUIPE} — tour ${TOUR.n} : ${TOUR.mien} DR contre ${TOUR.sien} — BUT pour ${ADVERSAIRE2} !`,
    apres: t('tavern.equipeTourBut', { jeu: JEU_EQUIPE, ...TOUR, qui: ADVERSAIRE2 }),
  },
  {
    site: 'tavernFlow.ts:1699 — SequenceBoard.phase (fraction PUREMENT numérique)',
    avant: `${2}/${2}`,
    apres: stepFraction(2, 2),
  },
  {
    site: 'SequencePanel.tsx:29 — compteur, partie OUVERTE (aucun total prévu)',
    avant: `Manche ${4}`,
    apres: t('seqPanel.manche', { n: 4 }),
  },
  {
    site: 'SequencePanel.tsx:28 — compteur, total prévu et pas de phase',
    avant: `Manche ${3}/${6}`,
    apres: t('seqPanel.manche', { n: stepFraction(3, 6) }),
  },
  {
    site: 'SequencePanel.tsx:27 — compteur, total prévu ET phase',
    avant: `Manche ${3}/${6} · phase ${'1/2'}`,
    apres: t('seqPanel.manchePhase', { n: stepFraction(3, 6), phase: stepFraction(1, 2) }),
  },
  {
    site: 'SequencePanel.tsx:48 — format de jauge : fraction du seam + repli d’unité (des DR)',
    avant: `${3}/${10} DR`,
    apres: `${stepFraction(3, 10)} ${t('seqPanel.uniteDr')}`,
  },
];

/* ── Le DR d'une rangée de poursuite : le SIGNE est porté par l'appelant, jamais par le gabarit ──*/

const drAvant = (sl: number): string => `${sl >= 0 ? '+' : ''}${sl} DR`;
const drApres = (sl: number): string => t('pursuit.dr', { dr: `${sl >= 0 ? '+' : ''}${sl}` });

const SIGNES: Site[] = [3, 0, -2].map((sl) => ({
  site: `pursuitFlow.ts:369 — issue de jet, DR ${sl}`,
  avant: drAvant(sl),
  apres: drApres(sl),
}));

/* ── V8c₀ : la narration de combat rendue au catalogue (`state/combatFlow.ts`, invariant ZÉRO) ───*/

const COMBAT: Site[] = [
  {
    site: 'combatFlow.ts:1862 — chute de passerelle',
    avant: `Gustav chute de la passerelle qui s'effondre.`,
    apres: t('cf.gangwayCollapse', { name: 'Gustav' }),
  },
  {
    site: 'combatFlow.ts:2461 — mise hors de combat',
    avant: `Gustav est mis hors de combat !`,
    apres: t('cf.outOfAction', { name: 'Gustav' }),
  },
  {
    site: 'combatFlow.ts:4014 — sort introuvable',
    avant: `Sort « Dard de feu » introuvable.`,
    apres: t('cf.spellNotFound', { spell: 'Dard de feu' }),
  },
  {
    site: 'combatFlow.ts:4020 — incantation bloquée',
    avant: `Gustav ne peut pas incanter : Propos ésotériques.`,
    apres: t('cf.cannotCast', { name: 'Gustav', reason: 'Propos ésotériques' }),
  },
  {
    site: 'combatFlow.ts:4399 — prière bloquée',
    avant: `Gustav ne peut pas prier : Vous abusez de ma patience.`,
    apres: t('cf.cannotPray', { name: 'Gustav', reason: 'Vous abusez de ma patience' }),
  },
  {
    site: 'combatFlow.ts:4051 — pas de ligne de vue',
    avant: `Dard de feu : pas de ligne de vue.`,
    apres: t('cf.noLineOfSight', { spell: 'Dard de feu' }),
  },
  {
    // `effet` = le `label` de la ligne d'`oups.json` (ponctuation comprise) — la donnée, telle quelle.
    site: 'combatFlow.ts:2656 — en-tête du Tableau des Oups !',
    avant: `Gustav — Maladresse ! Arme abîmée (1 Dégât) ; vous agirez en dernier au prochain Round.`,
    apres: t('cf.oups', { name: 'Gustav', effet: 'Arme abîmée (1 Dégât) ; vous agirez en dernier au prochain Round.' }),
  },
];

/* ── V8c₁ : les trois plus gros flux hors combat rendus au catalogue (invariant ZÉRO) ────────────
 * `interludeFlow` (`if.*`), `massBattleFlow` (`mbf.*`), `merchantFlow` (`mf.*`). Échantillons pris
 * sur les formes qui se cassent le plus vite : pluriel porté par une variable, composition de deux
 * clés, ponctuation typographique (« », —, ≤, −), fragments optionnels. */

const HEROS3 = 'Sigrid', OBJET = 'Épée runique', ARGENT = '12 CO', ACTIVITE = 'Artisanat';

/* eslint-disable no-constant-condition -- les fixtures REPRODUISENT le call-site à valeur figée :
   `${3} semaine${3 > 1 ? 's' : ''}` est la forme de l'expression mesurée, pas une condition de code. */
const V8C1: Site[] = [
  {
    site: 'interludeFlow.ts:195 — bandeau d’ouverture (pluriel porté par la variable)',
    avant: `— Entre deux aventures : ${3} semaine${3 > 1 ? 's' : ''} —`,
    apres: t('if.openBanner', { n: 3, s: 3 > 1 ? 's' : '' }),
  },
  {
    site: 'interludeFlow.ts:240 — ligne d’Événement du héros',
    avant: `${HEROS3} — Événement (${47}) : Un vieil ami. Vous croisez une connaissance.`,
    apres: t('if.eventLine', { name: HEROS3, roll: 47, label: 'Un vieil ami', text: 'Vous croisez une connaissance.' }),
  },
  {
    site: 'interludeFlow.ts:832 — ouvrage achevé (fragments Atouts/Défauts optionnels)',
    avant: `${HEROS3} achève son ouvrage : ${OBJET}${' (Fiable)'}${''} !`,
    apres: t('if.craftDone', { name: HEROS3, label: OBJET, atouts: ' (Fiable)', defauts: '' }),
  },
  {
    site: 'interludeFlow.ts:1316 — dépôt investi (la même variable rendue trois fois)',
    avant: `${HEROS3} investit ${ARGENT} (Indice d'intérêts ${4} — ${4} % de gains, faillite sur ≤ ${4}).`,
    apres: t('if.bankInvest', { name: HEROS3, money: ARGENT, rate: 4 }),
  },
  {
    site: 'interludeFlow.ts:1366 — dépôt perdu (issue composée d’une 2ᵉ clé)',
    avant: `${HEROS3} — ${3} ≤ ${4} : ${'la banque a fait faillite'} — ${ARGENT} perdus !`,
    apres: t('if.bankLost', { name: HEROS3, roll: 3, threshold: 4, what: t('if.bankFailBank'), money: ARGENT }),
  },
  {
    site: 'massBattleFlow.ts:696 — libellé d’issue chiffrée (camp composé, signe porté par l’appelant)',
    avant: `Puissance ${'ennemie'} ${''}${-3}`,
    apres: t('mbf.outMight', { side: t('mbf.sideEnemy'), amount: `${''}${-3}` }),
  },
  {
    site: 'massBattleFlow.ts:727 — « Tenez votre position » tenue (signe MOINS typographique)',
    avant: `Tenez votre position : la position tient (Point de rupture ${2}/${5}) — Puissance ennemie −2. L'ennemi redoublera d'efforts (opposition +${10} au prochain Round).`,
    apres: t('mbf.holdHeld', { bp: 2, max: 5, bonus: 10 }),
  },
  {
    site: 'massBattleFlow.ts:870 — Test spectaculaire de Puissance du Round',
    avant: `Round ${2}/${4} — Test spectaculaire de Puissance : les Personnages réduisent l'ennemi de ${7}, l'ennemi réduit les Personnages de ${5}.`,
    apres: t('mbf.clash', { n: 2, total: 4, enemyLoss: 7, allyLoss: 5 }),
  },
  {
    site: 'merchantFlow.ts:553 — panier payé (pluriel porté par la variable)',
    avant: `Payé : ${ARGENT} (${1} article${1 > 1 ? 's' : ''}).`,
    apres: t('mf.paid', { total: ARGENT, count: 1, s: 1 > 1 ? 's' : '' }),
  },
  {
    site: 'merchantFlow.ts:710 — troc conclu (ratio recomposé au call-site)',
    avant: `Troc : ${2} × ${'Corde'} contre ${1} × ${'Torche'} (${'commun'} ${2}:${1} ${'rare'}).`,
    apres: t('mf.barterDone', { giveCount: 2, giveLabel: 'Corde', getCount: 1, getLabel: 'Torche', giveAv: 'commun', ratio: `${2}:${1}`, getAv: 'rare' }),
  },
  {
    site: 'merchantFlow.ts:466 — achat GRATUIT « Tenir les comptes » (branche VRAIE du ternaire)',
    avant: `Achat : ${OBJET} (dans les moyens du Statut du groupe — Tenir les comptes).`,
    apres: t('mf.buyFree', { label: OBJET }),
  },
  {
    site: 'merchantFlow.ts:466 — achat payé (branche FAUSSE du même ternaire)',
    avant: `Achat : ${OBJET}.`,
    apres: t('mf.buy', { label: OBJET }),
  },
  {
    site: 'merchantFlow.ts:986 — fourchette d’estimation (le séparateur est de la typographie, pas du code)',
    avant: `${'2 CO'} – ${'3 CO'}`,
    apres: t('mf.estimateRange', { min: '2 CO', max: '3 CO' }),
  },
  {
    site: 'interludeFlow.ts:1230 — MALADRESSE d’Activité (jumeau de `cf.oups`, V8c₀)',
    avant: `${HEROS3} — MALADRESSE (${99}) !`,
    apres: t('if.fumble', { name: HEROS3, roll: String(99) }),
  },
  {
    site: 'interludeFlow.ts:937 — fausses Particularités CITÉES (jointure au catalogue)',
    avant: `${HEROS3} confond ${OBJET} avec un objet similaire et le croit doté de « ${['Fiable', 'Précise'].join(' » et « ')} » — certitude(s) erronée(s).`,
    apres: t('if.identifyFakes', { name: HEROS3, item: OBJET, fakes: ['Fiable', 'Précise'].join(t('if.fakesJoin')) }),
  },
  {
    site: 'interludeFlow.ts:622 — libellé d’Activité composé (la fabrique remplace le gabarit inline)',
    avant: `${ACTIVITE} — ${OBJET}`,
    apres: stepDetail(dataLabel(ACTIVITE), dataLabel(OBJET)),
  },
  {
    site: 'merchantFlow.ts:369 — recherche active (sujet + détail par `stepDetail`)',
    avant: `${HEROS3} — recherche active (Ragot ${31}) : une journée aux marchés porte ses fruits (Disponibilité +10 %, LDB 59 l.50).`,
    apres: stepDetail(dataLabel(HEROS3), t('mf.searchOk', { roll: 31 })),
  },
];

/* ── V8c₂ : les cinq fichiers de la tranche 2 rendus au catalogue (invariant ZÉRO) ────────────────
 * `combatEffects` (`eff.*`), `store` (`store.*`), `travelFlow` (`tf.*`), `riverVoyageFlow` (`rv.*`),
 * `engine/disease` (`dz.*`). Échantillons pris sur les formes qui se cassent le plus vite : signe
 * porté par l'appelant, pluriels multiples dans UNE phrase, fragments optionnels concaténés, unités
 * accolées, ponctuation typographique (≤, −, ÷, —, …), et les compositions à DEUX clés. */

const MALADIE = 'Peste noire', BETE = 'Cheval de trait', NAVIRE = 'La Sirène';

const V8C2: Site[] = [
  {
    site: 'disease.ts:473 — déclaration des symptômes (guillemets français)',
    avant: `${HEROS3} : les symptômes de « ${MALADIE} » se déclarent.`,
    apres: t('dz.symptomsOnset', { name: HEROS3, disease: MALADIE }),
  },
  {
    site: 'disease.ts:550 — maladie prolongée (+1d10 jours)',
    avant: `${HEROS3} : ${MALADIE} persiste (+${7} jours).`,
    apres: t('dz.persists', { name: HEROS3, disease: MALADIE, days: 7 }),
  },
  {
    site: 'disease.ts:513 — Gangrène qui progresse (« échec(s) » invariable)',
    avant: `${HEROS3} : la Gangrène progresse (${2} échec(s)).`,
    apres: t('dz.gangreneProgress', { name: HEROS3, fails: 2 }),
  },
  {
    site: 'disease.ts:63 — restant d’une instance à l’échelle du jour (unité accolée)',
    avant: `${3} j`,
    apres: t('dz.remainDays', { n: 3 }),
  },
  {
    site: 'disease.ts:501 — libellé d’étape du Test de cycle (symptôme + maladie, clé `step.*` partagée)',
    avant: `${'Fièvre'} (${MALADIE})`,
    apres: t('step.sujetPrecision', { sujet: 'Fièvre', precision: MALADIE }),
  },
  {
    site: 'combatEffects.ts:950 — Petite Prière exaucée (≤ typographique + apostrophe)',
    avant: `${HEROS3} prie sur le site sacré (${1} ≤ ${3}) — et les dieux l'entendent !`,
    apres: t('eff.petitePriereOk', { name: HEROS3, roll: 1, threshold: 3 }),
  },
  {
    site: 'combatEffects.ts:1450 — Humeur de Manann (le SIGNE est porté par l’appelant)',
    avant: `Humeur de Manann : ${-3 >= 0 ? '+' : ''}${-3} (${'Tempête essuyée'}).`,
    apres: t('eff.manannFactor', { delta: `${-3 >= 0 ? '+' : ''}${-3}`, factor: 'Tempête essuyée' }),
  },
  {
    site: 'combatEffects.ts:1484 — ajustement du navire (fragments joints par l’appelant)',
    avant: `Ajustement du navire : ${['nom « La Sirène »', 'moral 5'].join(', ')}.`,
    apres: t('eff.vesselDone', { parts: [t('eff.vesselName', { label: NAVIRE }), t('eff.vesselMorale', { n: 5 })].join(', ') }),
  },
  {
    site: 'combatEffects.ts:1153 — protection magique contre l’exposition (fragment de 2ᵉ clé)',
    avant: `${HEROS3} ignore ${'le froid et les intempéries'} (protection magique).`,
    apres: t('eff.weatherWarded', { name: HEROS3, what: t('eff.wardFroid') }),
  },
  {
    site: 'combatEffects.ts:239 — titre du Flow de récolte (fabrique `stepDetail`)',
    avant: `Récolter — ${BETE}`,
    apres: stepDetail(t('eff.harvest'), dataLabel(BETE)),
  },
  {
    site: 'store.ts:1673 — avance de coque (pluriel porté par la variable)',
    avant: `${NAVIRE} avance de ${2} case${2 > 1 ? 's' : ''} (cap ${'NE'}).`,
    apres: t('store.shipAdvance', { ship: NAVIRE, n: 2, s: 2 > 1 ? 's' : '', dir: 'NE' }),
  },
  {
    site: 'store.ts:2265 — vol terrestre (issue + fragment « porteurs » optionnels)',
    avant: `Vol terrestre — ${'le convoi fuit'} : ${12} Enc de cargaison pillée (${30} %${2 > 1 ? `, ${2} porteurs` : ''}).`,
    apres: t('store.cargoRaid', { issue: t('store.cargoRaidFled'), enc: 12, pct: 30, porteurs: t('store.fragCargoPorters', { n: 2 }) }),
  },
  {
    site: 'store.ts:2434 — la porte tient (DEUX pluriels dans la même phrase)',
    avant: `${'Porte de chêne'} : ${3} dégât${3 > 1 ? 's' : ''}, reste ${1} Blessure${1 > 1 ? 's' : ''}.`,
    apres: t('store.doorHolds', { label: 'Porte de chêne', n: 3, s: 3 > 1 ? 's' : '', left: 1, sB: 1 > 1 ? 's' : '' }),
  },
  {
    site: 'store.ts:2391 — dissipation (clé `cs.*` REPRISE, fragment optionnel)',
    avant: `${'Dard de feu'} est dissipé${3 > 1 ? ` (${3} cibles libérées)` : ''}.`,
    apres: t('cs.dispelDone', { spell: 'Dard de feu', extra: t('cs.fragDispelFreed', { n: 3 }) }),
  },
  {
    site: 'travelFlow.ts:385 — départ (fragment d’allure optionnel, minuscules du LABEL de donnée)',
    avant: `— En route vers ${'Altdorf'} (${42} km, ${'à pied'}${`, ${'galop'}`}) —`,
    apres: t('tf.depart', { to: 'Altdorf', km: 42, mode: 'à pied', allure: t('tf.fragAllure', { allure: 'galop' }) }),
  },
  {
    site: 'travelFlow.ts:982 — attelage forcé en échec (fragment « STUPÉFIANT » soudé au mot ÉCHEC)',
    avant: `${HEROS3} — Conduite d'attelage (allure forcée) : ÉCHEC${true ? ' STUPÉFIANT' : ''}, l'attelage repasse au pas.`,
    apres: t('tf.forcedFail', { name: HEROS3, stupefiant: t('tf.fragStupefiant') }),
  },
  {
    // L'apostrophe de « à l'étape » est DROITE au site (U+0027) : le catalogue la reprend telle quelle.
    site: 'travelFlow.ts:1216 — soin de monture à l’étape (propriétaire optionnel + issue en 2ᵉ clé)',
    avant: `${BETE}${` (${HEROS3})`} est ${'soignée'} à l'étape.`,
    apres: t('tf.mountCared', { mount: BETE, owner: t('tf.fragMountOwner', { name: HEROS3 }), soin: t('tf.mountHealed') }),
  },
  {
    site: 'travelFlow.ts:795 — péripétie de la table d10 (trois champs de donnée)',
    avant: `Péripétie de voyage (${4}) — ${'Averse'} : ${'La pluie détrempe la route.'}`,
    apres: t('tf.perilTable', { roll: 4, label: 'Averse', text: 'La pluie détrempe la route.' }),
  },
  {
    site: 'riverVoyageFlow.ts:424 — progression du jour (branche DÉRIVE, tiret cadratin + %)',
    avant: `Progression du jour : ${18} km${' (dérive — 25 % de la vitesse).'}`,
    apres: t('rv.progress', { km: 18, note: t('rv.fragDrift') }),
  },
  {
    site: 'riverVoyageFlow.ts:962 — échouage + renflouage (suite optionnelle à trois clés imbriquées)',
    avant: `Le bateau s'échoue (coque −${12} Dégâts, l.99)${` — renflouage (Force ${'Difficile (−20)'}${' (malus −24 Enc : 20 bateau + 4 cargaison, l.99)'}) : ${55}/${40} → ${"il faudra s'y reprendre."}`}`,
    apres: t('rv.grounded', { dmg: 12, suite: t('rv.fragRefloat', {
      diff: 'Difficile (−20)', enc: t('rv.encMalus', { total: 24, boat: 20, cargo: 4 }),
      roll: 55, target: 40, issue: t('rv.refloatKo'),
    }) }),
  },
  {
    // CORRIGÉ (#1318 V8c₂, micro-passe) : la FORCE était l'id capitalisé à la main (« Modere », sans
    // accent) — elle vient désormais de la donnée (`riverForceLabel`), qui dit « Modéré ».
    site: 'riverVoyageFlow.ts:293 — vent du jour (force lue à la DONNÉE + direction en 2ᵉ clé)',
    avant: `Vent du jour : ${'Modéré'}, ${'vent contraire'} (MSRC 7 l.21).`,
    apres: t('rv.windOfDay', { force: riverForceLabel('modere'), dir: t('rv.windContraire') }),
  },
  {
    site: 'riverVoyageFlow.ts:935 — détection sans jet (le tiret cadratin TIENT LIEU de valeur)',
    avant: `${'Rochers'} — détection (Agilité +0) : ${'—'} → ${'impact !'}`,
    apres: t('rv.detectLine', { peril: 'Rochers', roll: t('rv.fragNoRoll'), issue: t('rv.detectKo') }),
  },
];

/* ── V8c₃ : les cinq fichiers de la tranche 3 rendus au catalogue (invariant ZÉRO) ────────────────
 * `seaVoyageFlow` (`sv.*`), `engine/healing` (`heal.*`), `engine/rest` (`rest.*`), `state/restFlow`
 * (`rf.*`), `state/shipCrew` (`crew.*`), plus `engine/trauma` (`tra.*`, ramené à son seul id de type).
 * Trois oracles portent le TEXTE CORRIGÉ, pas le texte d'avant : la LOCALISATION d'impact, la MALADIE
 * citée et l'ASPECT du vent étaient rendus en ID brut (« la déchirure (jambeG) », « la durée de
 * « peste-noire » », « vent arriere ») — la parité avec un bug n'est pas un abri (précédent V8c₂). */

const MALADIE3 = 'Peste Noire', CHANSON = 'Le Roi des mers';

const V8C3: Site[] = [
  {
    // CORRIGÉ : `${t.location}` rendait l'id d'impact. La localisation vient de `locationLabel`.
    site: 'trauma.ts:148 — déchirure en rémission partielle (LOCALISATION lue au catalogue, U+2212)',
    avant: 'la déchirure (Jambe gauche) entre en rémission partielle (−10).',
    apres: t('tra.tornRemission', { loc: locationLabel('jambeG') }),
  },
  {
    site: 'trauma.ts:158 — LIBELLÉ de la séquelle de fracture (porté par le Combattant, vu en fiche)',
    avant: 'Fracture mal ressoudée (Tête)',
    apres: t('tra.fractureSequelaLabel', { loc: locationLabel('tete') }),
  },
  {
    // La FORME DU CORPS traverse jusqu'ici : une jument opérée ne parle pas de « bras droit ».
    site: 'trauma.ts:619 — chirurgie réussie (localisation par FORME DE CORPS)',
    avant: `${HEROS3} : ${'Fracture (Majeure)'} (Membre antérieur droit) réparée par chirurgie.`,
    apres: t('tra.surgeryDone', { name: HEROS3, label: 'Fracture (Majeure)', loc: locationLabel('brasD', 'quadrupede') }),
  },
  {
    site: 'trauma.ts:656 — diagnostic de déchirure (localisation + jours restants)',
    avant: `${HEROS3} : la Guérison diagnostique la déchirure (Jambe droite) — ${12} jour(s) avant de pouvoir réutiliser ce membre.`,
    apres: t('tra.tornDiagnosed', { name: HEROS3, loc: locationLabel('jambeD'), days: 12 }),
  },
  {
    site: 'healing.ts:157 — PB rendus (fraction courante/max)',
    avant: `${HEROS3} : +${3} PB (${7}/${10}).`,
    apres: t('heal.gain', { name: HEROS3, n: 3, cur: 7, max: 10 }),
  },
  {
    // L'apostrophe est DROITE au site (U+0027) : le catalogue la reprend telle quelle.
    site: "healing.ts:170 — hémorragie qui ne cède pas (apostrophe droite)",
    avant: `${HEROS3} : l'hémorragie ne cède pas.`,
    apres: t('heal.bleedResists', { name: HEROS3 }),
  },
  {
    // CORRIGÉ : `${dz.id}` citait l'id de maladie entre guillemets français.
    site: 'rest.ts:112 — durée de maladie raccourcie (MALADIE lue à la donnée, « », pluriel)',
    avant: `${HEROS3} : la durée de « ${MALADIE3} » est réduite de ${2} jour${2 > 1 ? 's' : ''} (reste ${5} j).`,
    apres: t('rest.diseaseShortened', { name: HEROS3, disease: diseaseLabel('peste-noire'), days: 2, s: 2 > 1 ? 's' : '', left: 5 }),
  },
  {
    site: 'rest.ts:108 — aucune maladie à soulager (DEUX fragments optionnels enchaînés)',
    avant: `${HEROS3} : aucune maladie active à soulager${' (ciblée)'}${' (ou déjà bénie)'}.`,
    apres: t('rest.noDiseaseToBless', { name: HEROS3, ciblee: t('rest.fragTargeted'), benie: t('rest.fragAlreadyBlessed') }),
  },
  {
    site: 'rest.ts:215 — privation (ternaire à TROIS branches, esperluette)',
    avant: `${HEROS3} est ${'affamé et assoiffé'} — pas de récupération naturelle (Faim & Soif).`,
    apres: t('rest.deprived', { name: HEROS3, etat: t('rest.deprivedBoth') }),
  },
  {
    site: 'restFlow.ts:198 — titre de nuit (apostrophes TYPOGRAPHIQUES U+2019, tirets cadratins)',
    avant: '— Le groupe dort jusqu’à l’aube —',
    apres: t('rf.titleNight'),
  },
  {
    site: 'restFlow.ts:547 — Compétence de l’abri lue à la DONNÉE (jamais un littéral au call-site)',
    avant: 'Survie en extérieur',
    apres: refLabel('skills', { id: 'survie-en-exterieur' }),
  },
  {
    site: 'shipCrew.ts:192 — chanson de marin entonnée (guillemets français + minutes calculées)',
    avant: `${HEROS3} entonne « ${CHANSON} » (${3 + Math.max(0, 2)} min).`,
    apres: t('crew.shantyStart', { name: HEROS3, shanty: CHANSON, min: 3 + Math.max(0, 2) }),
  },
  {
    site: 'shipCrew.ts:456 — delta d’effectif (le SIGNE − U+2212 est porté par l’appelant)',
    avant: `Équipage : ${'−'}${3} membre(s) (reste ${17}/${20}).`,
    apres: t('crew.crewDelta', { delta: `${'−'}${3}`, left: 17, nominal: 20 }),
  },
  {
    // CORRIGÉ : `windAspect` rend un id — le flux écrivait « vent arriere », sans accent.
    site: 'seaVoyageFlow.ts:439 — ASPECT du vent (id de `windAspect` rendu à l’écran)',
    avant: 'vent arrière',
    apres: t('sv.windArriere'),
  },
  {
    // CORRIGÉ (micro-passe) : la clé rendait « babord » ; MDG 13 l.322 écrit « bâbord ».
    site: 'seaVoyageFlow.ts:1739 — changement de cap (CÔTÉ de dérive lu au catalogue, MDG 13 l.322)',
    avant: `Changement de cap (d10 ${3}, dérive ${'bâbord'}) : ${'Le navire pique vers la côte.'}`,
    apres: t('sv.courseChange', { roll: 3, side: t('sv.sideBabord'), desc: 'Le navire pique vers la côte.' }),
  },
  {
    site: 'seaVoyageFlow.ts:789 — Encalminé (suite optionnelle : dérive chiffrée)',
    avant: `Encalminé — le bateau ne peut pas se déplacer grâce à ses voiles (MDG 13 l.296).${` Le courant l'entraîne (${3} milles).`}`,
    apres: t('sv.becalmedLine', { suite: t('sv.fragDrift', { drift: 3 }) }),
  },
  {
    site: 'seaVoyageFlow.ts:313 — vivres d’équipage (U+2212 + pluriel porté par la variable)',
    avant: `Vivres d'équipage : −${4} (reste ${12} jour${12 > 1 ? 's' : ''}-homme).`,
    apres: t('sv.crewFoodLeft', { need: 4, left: 12, s: 12 > 1 ? 's' : '' }),
  },
  {
    site: 'seaVoyageFlow.ts:2539 — carénage (fragment de coût optionnel, deux valeurs)',
    avant: `Coque raclée en cale sèche${` (${12} CO — ${25} % du coût de base, ch.13 l.152)`}.`,
    apres: t('sv.careened', { cost: t('sv.fragCareenCost', { cost: 12, pct: 25 }) }),
  },
  {
    site: 'seaVoyageFlow.ts:866 — résumé DR d’un Test d’équipage (signe + issue en 2ᵉ clé)',
    avant: `${'Rude épreuve'} : DR ${`+${2}`} → ${'succès'} (MDG 14 l.13).`,
    apres: t('sv.crewTestSummary', { label: 'Rude épreuve', dr: `+${2}`, issue: t('sv.success') }),
  },
];

/* ── V8c₄ : les quatorze fichiers de la LONGUE TRAÎNE rendus au catalogue (invariant ZÉRO) ─────────
 * `provisions` (`prov.*`), `suffocation` (`suff.*`), `exposure` (`exp.*`), `mountTravel` (`mt.*`),
 * `shipCritical` (`shipCrit.*`/`shipLoc.*`), `spellRangeFormat` (`spellFmt.*`), `upkeep`, `medicFlow`
 * (`medic.*`), `netFlow` (`coop.*`), `travelPostes` (`tp.*`), `corruptionFlow` (`cor.*`),
 * `seaActivities` (`sact.*`), `portFlow` (`port.*`), `partyFlow` (`pf.*`). DEUX oracles portent le
 * texte CORRIGÉ, pas celui d'avant : la LOCALISATION de Critique de navire et la CARRIÈRE d'arrivée
 * étaient rendues en ID brut (« Critique navire (greement) », « carrière → chasseur-de-primes ») —
 * la parité avec un bug n'est pas un abri (précédent V8c₂/V8c₃). */

const BETE4 = 'Jument de trait';

const V8C4: Site[] = [
  {
    site: 'provisions.ts:177 — dépérissement de Faim (apostrophe DROITE au site, U+2212)',
    avant: `${HEROS3} dépérit : −10 à toutes les autres Caractéristiques, ${3} Blessure(s) (la faim ignore l'armure).`,
    apres: t('prov.wasting', { name: HEROS3, dmg: 3 }),
  },
  {
    // La Compétence lancée vient de `skills.json` : le gabarit ne la bake plus (règle de `mt.testOf`).
    site: 'provisions.ts:241 — libellé du Test de Faim (Compétence lue à la donnée, malus OPTIONNEL, U+2212)',
    avant: `Faim : Test de Résistance${3 > 1 ? ` (−${(3 - 1) * 10})` : ''}`,
    apres: t('prov.testLabel', { kind: t('prov.faim'), skill: refLabel('skills', { id: 'resistance' }), malus: t('prov.fragTestMalus', { n: 20 }) }),
  },
  {
    site: 'provisions.ts:317 — le MÊME gabarit sert la Soif (une phrase, deux Tests)',
    avant: 'Soif : Test de Résistance',
    apres: t('prov.testLabel', { kind: t('prov.soif'), skill: refLabel('skills', { id: 'resistance' }), malus: '' }),
  },
  {
    // DIVERGENCE PAR LIVRE PRÉSERVÉE : la barque fluviale a des « rames » (MSRC 7 l.56), le navire
    // de mer des « avirons » (MDG 13 l.575-582). Le foyer commun sert les deux, la variante surcharge.
    site: 'riverVoyageFlow.ts:84 — Localisation FLUVIALE « avirons » → « rames » (MSRC 7 l.56)',
    avant: 'rames',
    apres: riverLocLabel('avirons'),
  },
  {
    site: 'shipCritical.ts:34 — la MÊME Localisation en MER reste « avirons » (MDG 13 l.575-582)',
    avant: 'avirons',
    apres: shipLocationLabel('avirons'),
  },
  {
    site: 'suffocation.ts:104 — souffle retenu (secondes + apostrophe droite)',
    avant: `${HEROS3} retient son souffle (${18} s d'air).`,
    apres: t('suff.holding', { name: HEROS3, s: 18 }),
  },
  {
    site: 'exposure.ts:175 — Blessures d’Exposition (le VOLET est un fragment, froid/chaleur)',
    avant: `${HEROS3} souffre ${'du froid'} : ${4} Blessure(s) (ignore les PA).`,
    apres: t('exp.wounds', { name: HEROS3, what: t('exp.fromCold'), dmg: 4 }),
  },
  {
    site: "exposure.ts:217 — sans manteau ni cape (pénalité maison lue à la policy)",
    avant: `${HEROS3} n'a ni manteau ni cape — le froid mord (−${10} aux Tests d'Exposition).`,
    apres: t('exp.noCoat', { name: HEROS3, pen: 10 }),
  },
  {
    // CORRIGÉ : `${location}` rendait l'id de table. La Localisation vient de `shipLocationLabel`.
    site: 'shipCritical.ts:73 — ligne de Critique de navire (LOCALISATION + DEUX fragments optionnels)',
    avant: `Critique navire (${'gréement'}) : ${'Voilure déchirée'}${` — Éclats ${2}`}${` — ${3} Critique(s) de Coque`}.`,
    apres: t('shipCrit.line', {
      loc: shipLocationLabel('greement'), label: 'Voilure déchirée',
      eclats: t('shipCrit.fragShrapnel', { n: 2 }), extra: t('shipCrit.fragExtraHull', { n: 3 }),
    }),
  },
  {
    site: 'mountTravel.ts:281 — Test d’effondrement d’une monture (Compétence lue à `skills.json`)',
    avant: `Résistance (${BETE4}, effondrement)`,
    apres: t('mt.testCollapseOf', { skill: refLabel('skills', { id: 'resistance' }), mount: BETE4 }),
  },
  {
    site: 'spellRangeFormat.ts:42 — cible en CÔNE (deux mesures, « x » minuscule au site)',
    avant: `Cône Longueur (${6} mètres) x Largeur (${3} mètres)`,
    apres: t('spellFmt.cone', { length: 6, width: 3 }),
  },
  {
    site: 'upkeep.ts:220 — privation de sommeil (pluriel porté par la variable, deux-points final)',
    avant: `${HEROS3} — privation de sommeil (${2} nuit${2 > 1 ? 's' : ''} sans dormir) :`,
    apres: t('upkeep.sleepDeprived', { name: HEROS3, n: 2, s: 2 > 1 ? 's' : '' }),
  },
  {
    site: 'medicFlow.ts:236 — passe de Chirurgie (signe du DR + suite conditionnelle)',
    avant: `${HEROS3} ${'opère'} ${'Kurt'} — passe : DR ${'+2'} (total ${5}/${10})${`, ${4} PB + 1 Hémorragie.`}`,
    apres: t('medic.pass', {
      healer: HEROS3, verb: t('medic.verbSurgery'), patient: 'Kurt', dr: '+2', cum: 5, target: 10,
      suite: t('medic.fragPassHarm', { harm: 4 }),
    }),
  },
  {
    site: 'corruptionFlow.ts:275 — mutation (la NATURE et le MOT de nature en deux clés)',
    avant: `${HEROS3} MUTE : ${'Peau écailleuse'} — Corruption ${'physique'} (${37} → ${'corps'}).`,
    apres: t('cor.mutates', { name: HEROS3, label: 'Peau écailleuse', kind: t('cor.kindPhysique'), roll: 37, what: t('cor.body') }),
  },
  {
    site: 'travelPostes.ts:416 — Exposition de fin d’Étape (météo lue au meta)',
    avant: `${HEROS3} — Exposition de fin d'Étape (${'Neige'}) : transi par le froid.`,
    apres: t('tp.exposureLine', { name: HEROS3, weather: 'Neige' }),
  },
  {
    site: 'seaActivities.ts:276 — Planque de Cartographie (≤ typographique, monnaie formatée)',
    avant: `${HEROS3} — Planque (MDG 15 l.292) : ${'12 CO'} cachés sur la carte — retrait libre, découverte sur ≤ 50.`,
    apres: t('sact.stash', { name: HEROS3, money: '12 CO' }),
  },
  {
    site: 'portFlow.ts:239 — Marchandage d’ACHAT (DR du vendeur optionnel + issue en 2ᵉ clé)',
    avant: `${HEROS3} — Marchandage (${34} vs ${58}${`, vendeur +${2} DR`}) : ${`remise de ${10} %`}.`,
    apres: t('port.bargainLine', {
      name: HEROS3, roll: 34, opp: 58, seller: t('port.fragSellerDR', { dr: 2 }),
      issue: t('port.discount', { pct: 10 }),
    }),
  },
  {
    site: 'partyFlow.ts:548 — sort mémorisé (remise universitaire en fragment, U+2212)',
    avant: `${HEROS3} mémorise ${'Dard de feu'} (−${100} PX${`, remise de ${100} PX — Recherche universitaire`}).`,
    apres: t('pf.spellLearned', { name: HEROS3, spell: 'Dard de feu', cost: 100, remise: t('pf.fragSpellDiscount', { n: 100 }) }),
  },
  {
    // CORRIGÉ : `${newCareer}` rendait l'ID de carrière (« carrière → chasseur-de-primes »).
    site: 'partyFlow.ts:710 — changement de carrière (CARRIÈRE lue à la donnée, U+2212)',
    avant: `${HEROS3} : carrière → ${'Chasseur de primes'} (niv. ${2}, −${100} PX).`,
    apres: t('pf.careerChanged', { name: HEROS3, career: dataLabel(findCareerById('chasseur-de-primes')!.label), level: 2, cost: 100 }),
  },
];

/* ── V8c₅ : la TRANCHE FINALE — les dix-huit derniers fichiers gelés, plus les deux nommés aux limites
 * du garde (`advancement`/`careerSlots`, dont les `reason` remontent à l'écran par `pf.refused`). Les
 * oracles montent la PRODUCTION partout où elle est appelable (`ammoFamilyLabel`, `spellMoney`,
 * `qualityClassLabel`, `structureCollapseLog`, `traitArgSkeleton`, `talentMaxLabel`, `keyLabel`,
 * `bindingLabel`, `keySectionLabel`), sinon le gabarit exact du site. UN oracle porte le texte CORRIGÉ :
 * `keyLabel('NumpadEnter')` rendait « Pavé Enter » (l'entrée nommée « Entrée (pavé) » était
 * inatteignable derrière le préfixe `Numpad`) — la parité avec un bug n'est pas un abri. */

const HEROS5 = 'Sigrid';

const V8C5: Site[] = [
  {
    site: 'drunkenness.ts:91 — échec de Résistance à l’alcool (plafond en fragment, U+2212)',
    avant: `${HEROS5} tient mal l'alcool (échec ${3}) : −10 aux CC/CT/Ag/Dex/Int${' (plafond −30)'}.`,
    apres: t('drunk.failedTest', { name: HEROS5, n: 3, cap: t('drunk.fragCap') }),
  },
  {
    site: 'drunkenness.ts:146 — gueule de bois (2ᵉ Test du dessoûlage)',
    avant: `${HEROS5} a la gueule de bois : 1 Exténué pendant ${4} h.`,
    apres: t('drunk.hangover', { name: HEROS5, h: 4 }),
  },
  {
    site: 'items.ts:959 — munition d’une pièce d’artillerie (fonction de PRODUCTION)',
    avant: 'Boulet et poudre',
    apres: ammoFamilyLabel('armes-de-siege'),
  },
  {
    site: 'money.ts:93-96 — épellation d’un montant mixte (PRODUCTION, pluriels portés par la valeur)',
    avant: "2 couronnes d'or, 1 pistole d'argent, 5 sous de cuivre",
    apres: spellMoney({ gold: 2, silver: 1, brass: 5 }),
  },
  {
    site: 'craftEconomy.ts:62 — classe de qualité (l’id est la logique, le libellé une clé)',
    avant: 'Haute Qualité',
    apres: qualityClassLabel('haute'),
  },
  {
    site: 'social.ts:127 — modificateur de Statut en mendicité (LDB 08 l.63)',
    avant: `Statut (${'mendicité '}${'Bronze<Argent'}) ${'+'}${10}`,
    apres: t('social.statusMod', { beg: t('social.fragBegging'), side: 'Bronze<Argent', sign: '+', mod: 10 }),
  },
  {
    site: 'structureCritical.ts:47 — Critique de Structure (Blessures supplémentaires en fragment)',
    avant: `Critique de Structure : ${'Mur lézardé'}${` — ${2} Blessure(s)`}${''}.`,
    apres: t('structCrit.line', { label: 'Mur lézardé', suite: t('structCrit.fragWounds', { n: 2 }), collapse: '' }),
  },
  {
    site: 'structureCritical.ts:57 — Effondrement → brèche (fonction de PRODUCTION)',
    avant: "La palissade s'effondre — une brèche s'ouvre.",
    apres: structureCollapseLog('La palissade'),
  },
  {
    site: 'tavernGame.ts:248 — manche `opposed` perdue (l’issue est une clé, le jeu vient de la donnée)',
    avant: `${'Bras de fer'} : ${2} DR contre ${4} → ${'perdu'}.`,
    apres: t('tavern.opposedLog', { jeu: 'Bras de fer', mien: 2, sien: 4, issue: t('tavern.issueLost') }),
  },
  {
    site: 'tavernGame.ts:253 — partie `extended` (pluriel de manches porté par la valeur)',
    avant: `${'Bras de fer'} : ${7} DR cumulés contre ${5} en ${3} manche${'s'}.`,
    apres: t('tavern.extendedLog', { jeu: 'Bras de fer', mien: 7, sien: 5, rounds: 3, s: 's' }),
  },
  {
    site: 'traits/dispatch.ts:136 — squelette d’argument d’un Trait (fonction de PRODUCTION)',
    avant: '(Indice) (Type de dégâts) (Portée)',
    apres: traitArgSkeleton({ indice: { label: 'Indice' }, specsSource: 'damageTypes', range: true })!,
  },
  {
    // La Compétence lancée vient de `skills.json` : le gabarit ne la bake plus (règle de `mt.testOf`).
    site: 'travel.ts:199 — libellé du Test de marche forcée (Compétence lue à la donnée)',
    avant: 'marche forcée : Test de Résistance',
    apres: t('trv.forcedMarchLabel', { skill: refLabel('skills', { id: 'resistance' }) }),
  },
  {
    site: 'travel.ts:186 — échec de marche forcée, porteur SURCHARGÉ (fragment)',
    avant: `${HEROS5} — marche forcée : ÉCHEC, +${2} Exténué${' (surchargé)'}.`,
    apres: t('trv.forcedMarchFail', { name: HEROS5, n: 2, over: t('trv.fragOverloaded') }),
  },
  {
    site: 'combat/roundHooks.ts:325 — « Se fatiguer » (LDB 16 l.97, apostrophe DROITE au site)',
    avant: `${HEROS5} s'épuise (effort soutenu) : Exténué.`,
    apres: t('turn.exhausted', { name: HEROS5 }),
  },
  {
    site: 'keybindings.ts:213 — libellé d’un raccourci à l’écran Options (PRODUCTION)',
    avant: 'Curseur : valider',
    apres: bindingLabel(KEYBINDINGS.find((b) => b.id === 'cursor-commit')!),
  },
  {
    site: 'keybindings.ts:234 — libellé PARAMÉTRÉ d’un slot de barre d’action (PRODUCTION)',
    avant: 'Capacité 3 de la barre d’action',
    apres: bindingLabel(KEYBINDINGS.find((b) => b.id === 'hotbar-3')!),
  },
  {
    site: 'keybindings.ts:29 — section « Barre d’action » de l’écran Options (PRODUCTION)',
    avant: "Barre d'action",
    apres: keySectionLabel('hotbar'),
  },
  {
    site: 'keybindings.ts:294 — touche du pavé numérique (PRODUCTION)',
    avant: 'Pavé 5',
    apres: keyLabel('Numpad5'),
  },
  {
    // CORRIGÉ : le préfixe `Numpad` était testé AVANT la table nommée → « Pavé Enter » à l'écran.
    site: 'keybindings.ts:256 — Entrée du pavé numérique (entrée nommée redevenue atteignable)',
    avant: 'Entrée (pavé)',
    apres: keyLabel('NumpadEnter'),
  },
  {
    site: 'mount.ts:251 — monture hors de combat : le cavalier est désarçonné (LDB 14 l.182)',
    avant: `${HEROS5} est désarçonné — sa monture (${'Destrier'}) est hors de combat.`,
    apres: t('mount.unhorsed', { rider: HEROS5, mount: 'Destrier' }),
  },
  {
    site: 'rollFlowFactory.ts:430 — relance OFFERTE (repli sur « Bénédiction de Chance »)',
    avant: `${HEROS5} relance sans dépenser de Chance (${'Bénédiction de Chance'}).`,
    apres: t('roll.freeReroll', { name: HEROS5, src: t('roll.blessingFallback') }),
  },
  {
    site: 'shipManeuver.ts:239 — manœuvre ratée sans barreur nommé (repli « L’équipage »)',
    avant: `${"L'équipage"} rate la manœuvre de ${'La Mouette'} (DR ${-2}) — le cap tient.`,
    apres: t('shipManv.failLine', { helmsman: t('shipManv.crewFallback'), ship: 'La Mouette', dr: -2 }),
  },
  {
    site: 'shipwreck.ts:84 — la coque coule corps et biens (MDG 13 l.674)',
    avant: `${'La Mouette'} sombre corps et biens (MDG 13 l.674).`,
    apres: t('wreck.sinks', { ship: 'La Mouette' }),
  },
  {
    // La Compétence (Natation) vient de `skills.json`, la difficulté de la policy : le gabarit ne bake ni l'une ni l'autre.
    site: 'shipwreck.ts:208 — issue de Natation d’un naufragé (applier de cascade)',
    avant: `${HEROS5} — Natation (${'Complexe (−10)'}) : ${'emporté par les flots (noyé, LDB 18 l.344)'}.`,
    apres: t('wreck.applierLine', {
      name: HEROS5,
      test: t('step.sujetPrecision', { sujet: refLabel('skills', { id: 'natation' }), precision: t('difficulty.complexe') }),
      issue: t('wreck.issueDrowns'),
    }),
  },
  {
    site: 'summonFlow.ts:111 — invocation HOSTILE (le tag est un fragment)',
    avant: `${HEROS5} invoque ${2} × ${'Démon'}${' — hostile, hors de son contrôle !'}.`,
    apres: t('summon.summons', { name: HEROS5, n: 2, label: 'Démon', tag: t('summon.fragHostile') }),
  },
  {
    site: 'advancement.ts:61 — refus d’Augmentation faute de PX (remonte par `pf.refused`)',
    avant: 'PX insuffisants',
    apres: t('adv.notEnoughXp'),
  },
  {
    site: 'advancement.ts:209 — refus de changement de carrière (PRODUCTION)',
    avant: 'nouvelle carrière : 1er niveau uniquement',
    apres: validateCareerChange(
      { career: 'roturier', careerLevel: 1, xp: 1000 } as Combatant,
      'chasseur-de-primes', 3,
      { completed: true, targetLevelExists: true, sameClass: false, gmJump: false },
    ).reason!,
  },
  {
    site: 'careerSlots.ts:331 — Maxi d’un Talent « Bonus de X » (PRODUCTION)',
    avant: 'Bonus de Force',
    apres: talentMaxLabel({ bonusOf: 'force' }),
  },
  {
    site: 'careerSlots.ts:389 — Domaine précédent pas assez maîtrisé (LDB 46 l.177)',
    avant: `Domaine précédent (${'Feu'}) pas assez maîtrisé : ${12}/20 Améliorations Focalisation, ${3}/8 Sorts`,
    apres: t('slot.prevDomain', { domain: 'Feu', advances: 12, known: 3 }),
  },
];

/* eslint-enable no-constant-condition */

const TOUS: Site[] = [...SEQUENCE, ...MARQUAGE, ...SIGNES, ...COMBAT, ...V8C1, ...V8C2, ...V8C3, ...V8C4, ...V8C5];

describe('#1318 V8b/V8b₂/V8c₀/V8c₁/V8c₂ — la migration au catalogue est à PARITÉ D’OCTET', () => {
  it.each(TOUS)('$site', ({ avant, apres }) => {
    expect(apres).toBe(avant);
  });

  it('le recensement couvre les TROIS lots et les trois signes de DR — un site migré s’y ajoute', () => {
    expect(SEQUENCE.length, 'les 8 positions de séquence migrées (V8b)').toBe(8);
    expect(MARQUAGE.length, 'les sites rougis par le MARQUAGE du contrat (V8b₂), panneau compris').toBe(9);
    expect(SIGNES.length, 'DR positif, nul, négatif — le signe ne vit pas dans le gabarit').toBe(3);
    expect(COMBAT.length, 'les littéraux de combatFlow rendus au catalogue (V8c₀)').toBe(6 + 1);
    expect(V8C1.length, 'échantillons des trois flux passés MIGRÉS par V8c₁ (interlude / bataille de masse / marchand)').toBe(17);
    // 23 → 22 (#1657 B3-2) : le site « éclats du Critique » de `riverVoyageFlow` est MORT — le coup à
    // l'équipage passe par la porte, sa ligne est celle du dériveur de jet, plus une phrase de flux.
    expect(V8C2.length, 'échantillons des cinq fichiers passés MIGRÉS par V8c₂ (effets / store / voyage terrestre / fluvial / maladies)').toBe(22);
    expect(V8C3.length, 'échantillons des fichiers passés MIGRÉS par V8c₃ (mer / guérison / repos / nuit / équipage / séquelles)').toBe(19);
    expect(V8C4.length, 'échantillons des QUATORZE fichiers de la longue traîne passés MIGRÉS par V8c₄').toBe(19);
    expect(V8C5.length, 'échantillons de la TRANCHE FINALE (18 fichiers gelés + advancement/careerSlots)').toBe(29);
    expect(TOUS.length).toBe(133); // 134 → 133 (#1657 B3-2, même site mort que V8c₂)
  });

  it('MUTATION : l’oracle est SENSIBLE — un tiret cadratin changé en tiret court diverge', () => {
    // Ce que le test attraperait si une édition du catalogue rabotait la ponctuation.
    expect(stepPrecision(t('pursuit.titreManche', { n: 3 }), distanceDite(DIST)))
      .not.toBe('Poursuite - manche 3 (Distance 4/10)');
  });

  /**
   * FUITE D'ID — sonde promue en garde (#1318 V8c₂, micro-passe du juge). Deux lignes de la navigation
   * fluviale rendaient du MOTEUR-SPEAK à l'œil du joueur : l'id d'État (« gagne l'État empetre », là où
   * la branche jumelle passait par `conditionLabel`) et l'id de table de Critique (« Critique au
   * greement »). Ce ne sont pas des fautes de frappe : c'est un id qui traverse la couche d'affichage.
   *
   * V8c₄ l'étend de DEUX ids de plus, vus fuir sur d'autres surfaces : `greement` à nouveau (mais par
   * `engine/shipCritical.ts` cette fois — « Critique navire (greement) », un SECOND site pour le MÊME
   * id, ce que la sonde déjà en place n'empêchait pas puisqu'elle ne lit que les oracles) et l'id de
   * CARRIÈRE (« carrière → chasseur-de-primes », `state/partyFlow.ts`).
   *
   * La garde balaie TOUS les oracles du fichier — un futur cas qui recopierait un id se ferait prendre
   * ici, pas à la recette. Elle ne mesure QUE les ids déjà vus fuir : elle ne certifie pas le zéro.
   */
  it('FUITE D’ID : aucun oracle ne rend un id de donnée à l’écran (empetre / greement / chasseur-de-primes…)', () => {
    const IDS_INTERDITS = /\b(empetre|greement|coque_|tres-fort|modere|construction-de-bateaux|charpentier|brasG|brasD|jambeG|jambeD|tete|arriere|lateral|peste-noire|ingenieur|chasseur-de-primes|infection-mineure)\b/;
    const fuites = TOUS.filter((s) => IDS_INTERDITS.test(s.avant) || IDS_INTERDITS.test(s.apres))
      .map((s) => `${s.site} → « ${s.apres} »`);
    expect(fuites, 'un id de donnée s’affiche : passer par son libellé (conditionLabel / specLabel / shipLocationLabel / findCareerById)').toEqual([]);
  });

  it('CONTRE-PREUVE : la sonde de fuite d’id MORD (elle n’est pas vide-et-verte)', () => {
    const IDS_INTERDITS = /\b(empetre|greement|coque_|tres-fort|modere|construction-de-bateaux|charpentier|brasG|brasD|jambeG|jambeD|tete|arriere|lateral|peste-noire|ingenieur|chasseur-de-primes|infection-mineure)\b/;
    // Le texte EXACT que la production rendait avant le fix — il doit être refusé.
    expect(IDS_INTERDITS.test("Critique au greement — Sigrid subit 5 Dégâts d'éclats et gagne l'État empetre.")).toBe(true);
    // …et le texte corrigé passe.
    expect(IDS_INTERDITS.test("Critique au gréement — Sigrid subit 5 Dégâts d'éclats et gagne l'État Empêtré.")).toBe(false);
    // #1318 V8c₃ — les trois ids que CE lot a vus fuir, avant / après.
    expect(IDS_INTERDITS.test('la déchirure (jambeG) entre en rémission partielle (−10).')).toBe(true);
    expect(IDS_INTERDITS.test('vent arriere')).toBe(true);
    expect(IDS_INTERDITS.test('Sigrid : la durée de « peste-noire » est réduite de 2 jours (reste 5 j).')).toBe(true);
    expect(IDS_INTERDITS.test('la déchirure (Jambe gauche) entre en rémission partielle (−10).')).toBe(false);
    // #1318 V8c₄ — les deux ids que CE lot a vus fuir, avant / après.
    expect(IDS_INTERDITS.test('Critique navire (greement) : Voilure déchirée.')).toBe(true);
    expect(IDS_INTERDITS.test('Sigrid : carrière → chasseur-de-primes (niv. 2, −100 PX).')).toBe(true);
    expect(IDS_INTERDITS.test('Critique navire (gréement) : Voilure déchirée.')).toBe(false);
    expect(IDS_INTERDITS.test('Sigrid : carrière → Chasseur de primes (niv. 2, −100 PX).')).toBe(false);
  });
});
