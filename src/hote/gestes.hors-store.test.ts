/**
 * CHAQUE ARGUMENT D'UN VERBE DE FENÊTRE SE DESSINE EN MOTS DU JOUEUR (#2928) : pour chaque verbe que `fenetreDuJeu`
 * peut offrir (`VERBES_DES_FENETRES`), chacun de ses paramètres (`VERBES`), et chaque champ d'un objet, a son libellé
 * (`libelleDuParametre`), hormis ce que la fenêtre pose (`argumentsPosesDuGeste` : `pid`, `flux`, `fenetre`) ; chaque valeur littérale que sa forme énumère a le
 * sien (`libelleDuLitteral`) ; chaque désignation qu'elle cite est une désignation du noyau (`DESIGNATIONS`), qui
 * nomme ses éléments. La valeur d'un réglage de jet (`jetRegler`, `REGLAGES`) se dit par son réglage
 * (`libelleDuReglage`), celle d'un choix de fenêtre (`fenetreChoisir`, `CHOIX`) par son choix (`libelleDuChoix`), ses
 * valeurs littérales par le nom de l'axe. `fenetreADessiner` dessine ainsi, sans id à
 * l'écran, toute fenêtre ouverte.
 */
import { describe, it, expect } from 'vitest';
import { DESIGNATIONS, VERBE_DE_CHOIX, VERBE_DE_REGLAGE, libelleDuChoix, libelleDuLitteral, libelleDuParametre, libelleDuReglage } from '../noyau/index';
import { VERBES_DES_FENETRES } from '../noyau/fenetres.testkit';
import type { Forme } from './formes';
import { CHOIX, FORMES, REGLAGES, VERBES } from './verbes.generated';
import { GUEST_INTENTS } from '../noyau/intentionsDeSiege';
import type { FlowKey } from '../noyau/index';

/** Les paramètres que la fenêtre pose d'office (`argumentsPosesDuGeste`) : aucun ne se saisit. */
const POSES = new Set(['pid', 'flux', 'fenetre']);

/** Ce qui manque aux valeurs de la forme `f` de l'argument `ou`, dont les littéraux se nomment par `nom`, pour se
 *  dessiner ; une `ref` se lit une fois par chemin (`vus`). */
function fautesDesValeurs(verbe: string, nom: string, f: Forme, ou: string, vus: ReadonlySet<string> = new Set()): string[] {
  switch (f.genre) {
    case 'litteral': return libelleDuLitteral(f.valeur, nom) === null ? [`${ou} : valeur ${JSON.stringify(f.valeur)} sans \`valeur.${nom}.<v>\` ni \`valeur.<v>\``] : [];
    case 'chaine': return f.designe && !(f.designe.cle in DESIGNATIONS) ? [`${ou} : désignation ${f.designe.cle} hors de DESIGNATIONS`] : [];
    case 'tableau': return fautesDesValeurs(verbe, nom, f.element, ou, vus);
    case 'tuple': return f.elements.flatMap((e, i) => fautesDesValeurs(verbe, nom, e, `${ou}[${i}]`, vus));
    case 'union': return f.membres.filter((m) => m.genre !== 'objet').flatMap((m) => fautesDesValeurs(verbe, nom, m, ou, vus));
    case 'objet': return f.champs.flatMap((c) => fautes(verbe, c.nom, c.forme, `${ou}.${c.nom}`));
    case 'dictionnaire': return [
      ...fautesDesValeurs(verbe, nom, f.cle, `${ou}[clé]`, vus),
      ...fautesDesValeurs(verbe, nom, f.valeur, `${ou}[…]`, vus),
      ...(f.champs ?? []).flatMap((c) => fautes(verbe, c.nom, c.forme, `${ou}.${c.nom}`)),
    ];
    case 'ref': return vus.has(f.type) ? [] : fautesDesValeurs(verbe, nom, FORMES[f.type], ou, new Set(vus).add(f.type));
    case 'nombre': case 'booleen': case 'null': case 'absent': return [];
  }
}

/** Ce qui manque à la forme `f` de l'argument `ou` du verbe `verbe` pour se dessiner. */
function fautes(verbe: string, nom: string, f: Forme, ou: string): string[] {
  if (POSES.has(nom)) return [];
  return [
    ...(libelleDuParametre(verbe, nom) === null ? [`${ou} : ni \`parametre.${verbe}.${nom}\` ni \`parametre.${nom}\``] : []),
    ...fautesDesValeurs(verbe, nom, f, ou),
  ];
}

describe('chaque argument d’un verbe de fenêtre se dessine en mots du joueur', () => {
  it('le relevé couvre les verbes des fenêtres', () => {
    expect(VERBES_DES_FENETRES.size, 'témoin : les verbes des fenêtres, les réglages des jets en un seul (#3368), les validations et sorties des fenêtres en deux, leurs choix en un seul (#3369), les axes des flux en réglages (#3369 lot 3), les deux clics du champ en un seul (#3371 lot 3), butin, échoppe et repos en choix (#3371 lot 4), l’infirmerie sans verbe propre (#3612 L1), l’évaluation en un verbe général et le dépeçage en choix (#3612 L2), la pause de Round en choix (#3612 L3)').toBeGreaterThan(16);
    expect([...VERBES_DES_FENETRES].filter((v) => !(v in VERBES)), 'verbe de fenêtre hors de VERBES').toEqual([]);
  });

  it.each([...VERBES_DES_FENETRES].filter((v) => v !== VERBE_DE_REGLAGE && v !== VERBE_DE_CHOIX && VERBES[v]?.length).map((v) => [v] as const))('%s', (verbe) => {
    expect(VERBES[verbe].flatMap((p) => fautes(verbe, p.nom, p.forme, `${verbe}.${p.nom}`))).toEqual([]);
  });

  it.each(Object.entries(REGLAGES).flatMap(([flux, formes]) => Object.entries(formes).map(([reglage, forme]) => [`${flux}.${reglage}`, flux, reglage, forme] as const)))('réglage %s', (_ou, flux, reglage, forme) => {
    expect(libelleDuReglage(flux as FlowKey, reglage)).toBeTruthy();
    expect(fautesDesValeurs(VERBE_DE_REGLAGE, reglage, forme, `${flux}.${reglage}`)).toEqual([]);
  });

  it.each(Object.entries(CHOIX).flatMap(([fenetre, formes]) => Object.entries(formes).map(([axe, forme]) => [`${fenetre}.${axe}`, fenetre, axe, forme] as const)))('choix %s', (_ou, fenetre, axe, forme) => {
    expect(libelleDuChoix(fenetre as never, axe as never)).toBeTruthy();
    expect(fautesDesValeurs(VERBE_DE_CHOIX, axe, forme, `${fenetre}.${axe}`)).toEqual([]);
  });
});

describe('un argument qui désigne un élément de l’état se choisit parmi ses éléments nommés (#2937)', () => {
  it.each([
    // Une union de désignations : chacune garde la sienne (`verbesDeLaPartie.mjs`, `designee`).
    ['evaluerLObjet', 'aEvaluer', 'IdDObjet,IdDeLigneDeButin'],
  ])('%s.%s désigne %s', (verbe, nom, cles) => {
    const p = VERBES[verbe].find((x) => x.nom === nom)!;
    const membres = p.forme.genre === 'union' ? p.forme.membres : [p.forme];
    expect(membres.flatMap((m) => (m.genre === 'chaine' && m.designe ? [m.designe.cle] : []))).toEqual(cles.split(','));
  });

  it.each([
    // Le champ d'une référence générique se lit à l'argument de type qui le déclare (`verbesDeLaPartie.mjs`, `substitutions`).
    ['acheterLeTalent', 'talent', 'IdDeTalent'],
    ['designerLeCreneau', 'option', 'IdDeCompetenceOuDeTalent'],
    ['acheterLaCompetence', 'skill', 'IdDeCompetence'],
  ])('%s.%s : son `id` désigne %s, sa `spec` est un texte libre', (verbe, nom, cle) => {
    const f = VERBES[verbe].find((x) => x.nom === nom)!.forme;
    const champs = f.genre === 'objet' ? f.champs : [];
    expect(champs.map((c) => [c.nom, c.optionnel, c.forme.genre === 'chaine' ? c.forme.designe?.cle ?? null : c.forme.genre])).toEqual([['id', false, cle], ['spec', true, null]]);
  });

  it.each([
    ['chansonDeMarin', 'chanson', 'IdDeChanson'],
    ['incantation', 'formeConjuree', 'IdDeFormeConjuree'],
    ['soins', 'bandages', 'IdDeHeros'],
    ['test', 'testeur', 'IdDeCombattant'],
    ['enfoncerLaPorte', 'arme', 'IdDObjet'],
  ])('réglage %s.%s désigne %s', (flux, reglage, cle) => {
    const f = REGLAGES[flux][reglage];
    const membres = f.genre === 'union' ? f.membres : [f];
    expect(membres.flatMap((m) => (m.genre === 'chaine' && m.designe ? [m.designe.cle] : []))).toEqual([cle]);
  });

  it.each([
    ['conseil', 'paie', 'IdDeChoixDePaie'],
    ['cibleDeMonture', 'cible', 'IdDuCoupleMonte'],
    ['infirmerie', 'patient', 'IdDeHeros'],
    ['victoire', 'depecer', 'IdDeCreatureADepecer'],
    ['debutDuRound', 'promouvoir', 'IdDeCombattantPromouvable'],
    ['debutDuRound', 'viser', 'IdDeTireurRapide'],
  ])('choix %s.%s désigne %s', (fenetre, axe, cle) => {
    const f = CHOIX[fenetre][axe];
    const membres = f.genre === 'union' ? f.membres : [f];
    expect(membres.flatMap((m) => (m.genre === 'chaine' && m.designe ? [m.designe.cle] : []))).toEqual([cle]);
  });

});

describe('aucun intent invité ne prend de siège en argument : le siège vient du transport (`decidingSeat`, #2439)', () => {
  it('chaque verbe de `GUEST_INTENTS` a sa signature, sans paramètre de siège', () => {
    const intents = [...GUEST_INTENTS];
    expect(intents.filter((v) => !(v in VERBES)), 'un intent invité sans signature échappe à la garde').toEqual([]);
    expect(intents.flatMap((v) => VERBES[v].filter((p) => /seat|si[eè]ge/i.test(p.nom)).map((p) => `${v}.${p.nom}`))).toEqual([]);
  });
});
