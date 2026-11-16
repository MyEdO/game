/**
 * UN TOUR COMPLET JOUÉ PAR LE PONT (#2928, `CONTRAT.md`, plan critère 4) sur le combat de l'hôte texte (`dome`) : le
 * round ouvert, l'attaque d'un héros, le déplacement d'un second héros vers une case de la vue et son chemin (#3822), puis, ses jetons
 * repris, l'attaque adverse que joue le noyau et la Défense du héros. Chaque geste se joue comme Godot le joue : par
 * l'intention que porte l'élément qu'il presse (`vue.zones`, `src/hote/elements.ts`), une offre, un geste de la fenêtre
 * ou une valeur de son choix. À chaque réponse, la fenêtre ouverte se dessine (`fautesDeLaFenetre`) ; le test ne
 * calcule rien.
 */
import { describe, it, expect } from 'vitest';
import { corpsDe, drainer, fautesDeLaFenetre, gesteDe, gestesDessines, table, type Reponse } from './pont.testkit';
import { clicDuCombattant, type Suite } from './pont';
import { ACTIONS, CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton, Choix, Entite, Jet, Ligne, Puce } from '../../../src/hote/elements';
import { t } from '../../../src/i18n';

const { appel: appelNu } = table();

/** Les fenêtres vues au fil du tour, par leur clé et l'étape de séquence qu'elles tiennent. */
const vues = new Set<string>();

/** L'appel du pont, chaque vue rendue contrôlée : la fenêtre ouverte se dessine verbe par verbe. */
const appel = (methode: string, entree?: unknown): Reponse => {
  const r = appelNu(methode, entree);
  if (r.ok && r.vue) {
    const f = r.vue.projection.fenetre;
    expect(fautesDeLaFenetre(r.vue), `la fenêtre ${f?.cle ?? 'aucune'} se dessine verbe par verbe`).toEqual([]);
    if (f) vues.add(f.etape ? `${f.cle}:${f.etape.genre}` : f.cle);
  }
  return r;
};

/** Le geste joué, ses jetons repris : la dernière suite, toutes les lignes de journal et celles de l'écran. */
const jouer = (geste: object) => drainer(appel, appel('jouer', geste));

/** Le bouton pressé : l'intention qu'il porte, jouée. */
const presser = (b: Bouton) => jouer(b.jeu);

/** Le bouton du geste d'identité `cle`. */
const bouton = (s: Suite, cle: string): Bouton => {
  const g = gesteDe(s.vue, cle);
  if (g.type !== 'bouton') throw new Error(`${cle} : ${g.type}, pas un bouton`);
  return g;
};

/** L'identité du geste qui a le focus : celui que la fenêtre joue à l'Entrée. */
const attendu = (s: Suite): string => {
  const g = gestesDessines(s.vue).filter((x) => 'focus' in x && x.focus);
  expect(g.length, `un seul geste en focus dans ${JSON.stringify(gestesDessines(s.vue).map((x) => x.id))}`).toBe(1);
  return g[0].id;
};

/** La valeur que le bouton `b` d'un choix pose : son dernier argument. */
const valeurDe = (b: Bouton): unknown => ('args' in b.jeu ? b.jeu.args[b.jeu.args.length - 1] : undefined);

const actifDe = (s: Suite) => s.vue.projection.combat!.actif!;

/** La fin du tour par le verbe de son offre, confirmée par le même verbe quand la vue la dit armée (`finDeTourArmee`). */
function finirLeTour(): ReturnType<typeof jouer> {
  const arme = jouer({ type: 'terminerLeTour', args: [] });
  if (!arme.suite.vue.projection.combat!.finDeTourArmee) return arme;
  const fin = jouer({ type: 'terminerLeTour', args: [] });
  return { suite: fin.suite, journal: [...arme.journal, ...fin.journal], lignes: [...arme.lignes, ...fin.lignes], effets: [...arme.effets, ...fin.effets] };
}

/** Le meuble de l'actif de `s` (`combat.actif`) : son portrait, chaque élément de son Mouvement à son ton, le ton de son
 *  Action. */
function meubleDe(s: Suite) {
  const [actif] = s.vue.zones['combat.actif'];
  const mouvement = actif.elements.find((e): e is Entite => e.type === 'entite' && e.id === 'mouvement');
  return {
    portrait: actif.elements.find((e) => e.type === 'portrait'),
    jetons: (mouvement?.elements ?? []).map((e) => [e.id, 'ton' in e ? e.ton : null]),
    action: actif.elements.find((e): e is Puce => e.id === 'action' && e.type === 'puce')?.ton,
  };
}

/** Le Mouvement de l'actif de `s` tel que la projection le compte (`mouvement`, `[restant, total]`) : un jeton par case,
 *  plein (`reussite`) tant qu'il reste, puis ce qui reste. */
function jetonsAttendus(s: Suite): (string | null)[][] {
  const [restant, total] = s.vue.projection.combat!.actif!.mouvement;
  return [...Array.from({ length: total }, (_, i) => [`jeton/${i}`, i < restant ? 'reussite' : 'neutre']), ['reste', 'neutre']];
}

describe('un tour complet par le pont', () => {
  it('attaque d’un héros par ses gestes, déplacement, attaque adverse jouée par le noyau, Défense', { timeout: 240_000 }, () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(gesteDe(suite.vue, 'fenetreValider@debutDuRound'), 'l’ouverture du round : un bouton nommé, que l’Entrée joue plutôt qu’un réglage').toMatchObject({ libelle: 'Commencer le round', type: 'bouton', focus: true });
    expect(suite.vue.champ, 'la barre fermée, le champ ne se clique pas').toBeNull();
    ({ suite } = presser(bouton(suite, 'fenetreValider@debutDuRound')));

    const heros = actifDe(suite);
    expect(heros.camp).toBe('heros');
    expect(suite.vue.projection.combat!.barre).toEqual({ forme: 'ouverte', raison: null });
    expect(suite.vue.champ, 'la barre ouverte, le champ se clique en combat').toBe(CLIC_DU_CHAMP);
    const economie = (id: string) => suite.vue.zones['combat.offres'].find((o): o is Choix => o.type === 'choix' && o.valeurs.some((v) => v.id === id));
    expect(economie('charge'), 'la Charge se range sous le Mouvement qu’elle prend, nommé une fois').toMatchObject({ libelle: 'Mouvement' });
    expect(economie('charge')!.valeurs.find((v) => v.id === 'charge')?.libelle, 'chaque offre de la barre a son libellé, sans son coût').toBe('Charger');
    expect(economie('fin-de-tour'), 'la fin du tour, qui ne prend rien, se range sous le tour').toMatchObject({ libelle: 'Tour' });
    const action = economie('attaque')!.valeurs;
    expect(action.map((v) => [v.id, v.icone]), 'chaque offre de l’Action porte le dessin de son action en donnée').toEqual(action.map((v) => [v.id, ACTIONS.find((a) => a.id === v.id)!.icon]));
    expect(action.every((v) => typeof v.icone === 'string'), 'chaque offre de l’Action a un dessin').toBe(true);
    expect(suite.vue.zones['combat.actif'][0]?.nom, 'le panneau nomme l’actif').toBe(heros.nom);
    expect(meubleDe(suite), 'le meuble de l’actif : son portrait, son Mouvement en jetons, pleins tant qu’il en reste, son Action entière').toEqual({
      portrait: { type: 'portrait', id: 'portrait', combattant: heros.id }, jetons: jetonsAttendus(suite), action: 'reussite',
    });
    const ordre = suite.vue.zones['combat.ordre'];
    expect(ordre.filter((r) => r.ton === 'alerte').map((r) => r.nom), 'l’ordre met en avant celui qui joue, lui seul').toEqual([heros.nom]);
    expect(ordre[ordre.length - 1]?.id, 'celui qui joue, en bas de la colonne').toBe(`ordre/${heros.id}`);
    expect(ordre[ordre.length - 1]?.elements.slice(0, 2), 'son rang : son portrait, puis ses Blessures en jauge').toEqual([
      { type: 'portrait', id: 'portrait', combattant: heros.id },
      expect.objectContaining({ type: 'jauge', id: 'blessures', courant: expect.any(Number), max: expect.any(Number) }),
    ]);
    ({ suite } = jouer({ type: 'armerLIntention', args: ['charge'] }));
    expect(suite.vue.projection.combat!.intention, 'l’offre arme son intention').toBe('charge');
    expect(suite.vue.zones['combat.offres'].flatMap((o) => o.valeurs).find((o) => o.presse)?.id, 'l’offre armée est pressée').toBe('charge');
    const [cible] = suite.vue.projection.combat!.cibles.liste; // les cibles que le clic accepte, la Charge armée
    const nomDe = (id: string) => suite.vue.projection.combat!.voisins.liste.find((v) => v.id === id)!.nom;
    const nomDeLaCible = nomDe(cible);
    ({ suite } = jouer(clicDuCombattant(suite.vue, cible)!));
    expect(suite.vue.projection.fenetre, 'la charge ouvre la fenêtre d’attaque').toMatchObject({ cle: 'cascade', etape: { genre: 'jetDAttaque' } });
    expect(suite.vue.disposition, 'la fenêtre d’attaque se dispose par sa clé et son jet').toBe('cascade/attaque');
    expect(suite.vue.zones['fenetre.reglages'].map((g) => g.id), 'la Localisation est une option du coup').toContain('jetRegler@attaque#localisation');
    expect(suite.vue.zones['fenetre.gestes'].map((g) => g.id), 'le jet est un pas de la séquence').toContain('jetLancer@attaque');
    expect(corpsDe(suite.vue, 'degats'), 'les Dégâts de l’arme, à part').toMatchObject({ type: 'puce', valeur: expect.stringMatching(/^\+\d+$/) });
    expect(corpsDe(suite.vue, 'cible'), 'la fenêtre nomme la cible').toMatchObject({ type: 'ligne', texte: expect.stringContaining(nomDeLaCible) });
    expect(corpsDe(suite.vue, 'jet'), 'le jet de l’attaquant, à lancer').toMatchObject({ type: 'jet', qui: heros.nom, cible: expect.stringMatching(/\d+$/), resultat: null, verdict: null, detail: expect.stringMatching(/^base \d+/) });
    expect(attendu(suite), 'avant le jet, le jet est attendu').toBe('jetLancer@attaque');

    const localiser = () => {
      const g = gesteDe(suite.vue, 'jetRegler@attaque#localisation');
      if (g.type !== 'choix' && g.type !== 'liste') throw new Error(`la Localisation : ${g.type}, pas un choix`);
      return g.valeurs;
    };
    const lieu = localiser().find((v) => valeurDe(v) !== null)!;
    ({ suite } = presser(lieu));
    expect(localiser().find((v) => v.presse)?.id, 'le choix dit la Localisation retenue').toBe(lieu.id);
    const auHasard = localiser().find((v) => valeurDe(v) === null)!;
    ({ suite } = presser(auHasard));
    expect(localiser().find((v) => v.presse)?.id, 'au hasard').toBe(auHasard.id);
    ({ suite } = presser(bouton(suite, attendu(suite))));
    expect(corpsDe(suite.vue, 'jet'), 'le jet tombé dit son verdict').toMatchObject({ type: 'jet', verdict: expect.any(String) });
    const issue = corpsDe(suite.vue, 'issue');
    expect(issue, 'le jet tombé dit son issue').toMatchObject({ type: 'ligne' });
    expect(attendu(suite), 'le jet tombé, la confirmation est attendue').toBe('jetValider@attaque');
    const confirmee = presser(bouton(suite, attendu(suite)));
    suite = confirmee.suite;
    expect(suite.vue.projection.fenetre?.etape?.genre, 'confirmée, la fenêtre d’attaque se ferme').not.toBe('jetDAttaque');
    expect(meubleDe(suite), 'la charge jouée : ses cases de Mouvement vidées, son Action jouée').toEqual({ ...meubleDe(suite), jetons: jetonsAttendus(suite), action: 'neutre' });
    expect(meubleDe(suite).jetons.filter(([, ton]) => ton === 'reussite').length, 'la charge a vidé des cases').toBeLessThan(meubleDe(suite).jetons.length - 1);
    expect(confirmee.lignes.map((l) => l.texte), 'l’issue confirmée entre au journal de l’écran').toContain((issue as Ligne).texte);
    const barre = suite.vue.zones['combat.offres'];
    const fermees = suite.vue.projection.combat!.offres!.liste.filter((o) => o.refus !== null);
    const fixe = (o: (typeof fermees)[number]) => !o.candidats.length && o.geste !== null && (o.economie === 'action' || o.economie === 'aucun');
    expect(fermees.filter(fixe).length, 'l’Action jouée, des plaques se ferment').toBeGreaterThan(0);
    expect(fermees.filter((o) => !fixe(o)).length, 'l’Action jouée, des offres hors emplacement fixe se ferment').toBeGreaterThan(0);
    expect(fermees.filter(fixe).map((o) => barre.find((c) => c.id === `economie/${o.economie}`)?.valeurs.find((b) => b.id === o.id)?.refus), 'une offre fermée d’un emplacement fixe reste, refusée avec sa raison').toEqual(fermees.filter(fixe).map((o) => o.refus));
    const montres = [...barre.map((c) => c.id), ...barre.flatMap((c) => c.valeurs.map((b) => b.id))];
    expect(fermees.filter((o) => !fixe(o)).filter((o) => montres.includes(o.id) || montres.includes(`offre/${o.id}`)).map((o) => o.id), 'une offre fermée hors emplacement fixe quitte la barre').toEqual([]);
    expect(barre.filter((c) => c.id !== 'economie/action' && c.id !== 'economie/aucun').flatMap((c) => [c, ...c.valeurs]).filter((x) => x.refus !== null).map((x) => x.id), 'une liste ouverte ne porte que des valeurs ouvertes').toEqual([]);
    expect(barre.filter((c) => !c.valeurs.length).map((c) => c.id), 'aucun choix sans valeur').toEqual([]);
    ({ suite } = finirLeTour());

    const second = actifDe(suite);
    expect(second.id).not.toBe(heros.id);
    const rangs = suite.vue.zones['combat.ordre'].map((r) => r.id);
    expect(rangs[rangs.length - 1], 'le suivant joue, en bas de la colonne').toBe(`ordre/${second.id}`);
    expect(rangs.indexOf(`ordre/${heros.id}`), 'qui a joué remonte au round suivant, au-dessus de qui reste à jouer').toBeLessThan(rangs.indexOf(`ordre/${second.id}`));
    const debuts = suite.vue.zones['combat.ordre'].flatMap((r) => r.elements.filter((e): e is Ligne => e.id === 'round').map((e) => [r.id, e.texte]));
    expect(debuts, 'un seul rang porte le round suivant, lui en tête des rangs qui ont joué').toHaveLength(1);
    expect(debuts[0][1], 'le round suivant, nommé').toBe(t('ecran.round', { round: suite.vue.projection.combat!.round + 1 }));
    expect(rangs.indexOf(debuts[0][0]), 'le round suivant commence au-dessus de qui reste à jouer, sous ceux qui ont joué').toBeGreaterThanOrEqual(rangs.indexOf(`ordre/${heros.id}`));
    const vers = suite.vue.cases.find((c) => c.zone === 'marche' && c.cout === 1)!.case;
    ({ suite } = jouer({ type: CLIC_DU_CHAMP, args: [vers] }));
    expect(suite.vue.projection.combat!.apercu, 'le premier clic montre l’aperçu').toMatchObject({ genre: 'deplacement', cible: null, case: [vers.x, vers.y, vers.z ?? 0] });
    expect(suite.vue.zones['combat.apercu'].map((l) => l.id), 'l’aperçu dit ce qu’il coûte').toEqual(['apercu']);
    const [x, y, z] = second.pos!;
    const deplace = jouer({ type: CLIC_DU_CHAMP, args: [vers] });
    suite = deplace.suite;
    expect(actifDe(suite).pos, 'le second clic déplace le héros').toEqual([vers.x, vers.y, vers.z ?? 0]);
    expect(deplace.effets.find((e) => e.quoi === 'deplacement'), 'il parcourt son chemin, de sa case à celle où la vue le pose (#3822)').toEqual({ quoi: 'deplacement', qui: second.id, cases: [{ x, y, z, metres: 0 }, { x: vers.x, y: vers.y, z: vers.z ?? 0, metres: expect.any(Number) }] });
    expect(suite.vue.occupants[`${vers.x},${vers.y},${vers.z ?? 0}`], 'la case porte son occupant').toBe(second.id);

    let journal: ReturnType<typeof jouer>['journal'];
    ({ suite, journal } = finirLeTour());
    const adversaire = actifDe(suite);
    expect(adversaire.camp, 'les jetons repris, le noyau joue l’adversaire').toBe('ennemi');
    const defense = suite.vue.projection.fenetre!;
    expect(defense, 'la fenêtre de la Défense : l’étape du jet de Défense de la cascade').toMatchObject({ cle: 'cascade', etape: { genre: 'jetDeDefense' } });
    expect(corpsDe(suite.vue, 'defense/qui'), 'la Défense dit qui attaque').toMatchObject({ type: 'ligne', texte: expect.stringContaining(adversaire.nom) });
    const etape = suite.vue.zones['fenetre.etape'][0]?.texte;
    expect(suite.vue.disposition, 'la Défense se dispose par sa clé et son jet').toBe('cascade/defense');
    const reaction = corpsDe(suite.vue, 'defense/jet');
    expect(reaction, 'avant le dé, la réaction dit son score à atteindre').toMatchObject({ type: 'jet', cible: expect.stringMatching(/\d+$/), resultat: null, detail: expect.stringMatching(/^base \d+/) });
    expect(attendu(suite), 'avant le jet de Défense, le jet est attendu').toBe('jetLancer@defense');
    const evenements = [...journal];
    ({ suite, journal } = presser(bouton(suite, attendu(suite))));
    evenements.push(...journal);
    expect(attendu(suite), 'le jet de Défense tombé, sa confirmation est attendue').toBe('jetValider@defense');
    expect(corpsDe(suite.vue, 'defense/jet'), 'le dé tombé, la ligne avant le dé s’efface').toBeUndefined();
    expect(corpsDe(suite.vue, 'defense/issue'), 'le dé tombé, la Défense dit son issue').toMatchObject({ type: 'ligne', texte: expect.stringMatching(/\S/) });
    expect(suite.vue.zones['fenetre.corps'].find((e) => e.type === 'jet' && e.libelle === (reaction as Jet).libelle), 'le jet tombé vise le score annoncé avant le dé').toMatchObject({ cible: (reaction as Jet).cible });
    ({ suite, journal } = presser(bouton(suite, attendu(suite))));
    evenements.push(...journal);
    expect(corpsDe(suite.vue, 'defense/qui'), 'la Défense confirmée, sa fenêtre se ferme').toBeUndefined();
    const attaque = evenements.find((l) => l.de === 'combat' && l.evenement.actorId === adversaire.id && l.evenement.targetId);
    expect(attaque, 'l’attaque adverse entre au journal, sa cible nommée').toBeDefined();
    const vise = suite.vue.projection.combat!.voisins.liste.find((v) => attaque!.de === 'combat' && v.id === attaque!.evenement.targetId)!;
    expect(vise.camp, 'l’adversaire vise un héros').toBe('heros');
    expect(defense.proprietaire, 'la Défense est au héros attaqué').toEqual({ genre: 'porteur', nom: vise.nom });
    expect(etape, 'l’étape nomme le héros qui se défend').toContain(vise.nom);
    expect([...vues], 'les fenêtres du tour, chacune dessinée verbe par verbe').toEqual(expect.arrayContaining(['debutDuRound', 'cascade:jetDAttaque', 'cascade:jetDeDefense']));
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [] });
  });
});
