/**
 * LES IDS QU'UN VERBE DÉSIGNE (#2898), joués par l'hôte texte (`hote.testkit.ts`) : un id que la table du noyau
 * (`DESIGNATIONS`, src/noyau/designations.ts) ne rend pas se refuse en `validation`, en nommant les ids valides, et rien
 * ne s'écrit ; un id que le refus nomme passe le contrôle. Un champ du contexte d'une offre que ni l'offre ni ses
 * candidats ne lisent se refuse de même.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { fermerLaTable, partie, table, verbe, type table as Table } from './hote.testkit';
import type { GesteDeLAgent } from './serveur';

afterEach(fermerLaTable);

/** Le geste est refusé en `validation`, le fichier intact ; rend les ids valides que le refus nomme. */
function refuseLId(t: ReturnType<typeof Table>, geste: GesteDeLAgent, message: RegExp): string[] {
  const avant = t.fichier();
  const r = t.jouer(geste);
  const texte = r.texte.split('\n  ').join(' ');
  expect(r.erreur, texte).toBe('validation');
  expect(texte).toMatch(message);
  expect(t.fichier(), 'un geste refusé a été écrit au fichier').toBe(avant);
  return /\(valides : ([^)]*)\)/.exec(texte)![1].replace(/ \+\d+$/, '').split(', ');
}

/** Le geste passe le contrôle des arguments : appliqué, ou refusé par le jeu lui-même. */
function passeLeControle(t: ReturnType<typeof Table>, geste: GesteDeLAgent): void {
  const r = t.jouer(geste);
  expect(r.erreur, r.texte).not.toBe('validation');
}

describe('un id inconnu se refuse en `validation`, un id valide passe', () => {
  it('ce que le clic désigne, en combat un combattant : `cliquerLaCase`', { timeout: 120_000 }, () => {
    const t = partie('dome', verbe('fenetreValider', 'roundStart'));
    const valides = refuseLId(t, verbe('cliquerLaCase', { x: 7, y: 5 }, 'nobody'), /entite : "nobody" n’est pas un id de combattant ou d’entité de scène \(valides : .*enemy-enc-dome-1/);
    passeLeControle(t, verbe('cliquerLaCase', { x: 7, y: 5 }, valides.find((id) => id.startsWith('enemy'))!));
  });
  it('héros : `creerLaPanoplie`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [heros] = refuseLId(t, verbe('creerLaPanoplie', 'nobody'), /heroId : "nobody" n’est pas un id de héros \(valides : /);
    const r = t.jouer(verbe('creerLaPanoplie', heros));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('scène : `quitterLaScene`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const valides = refuseLId(t, verbe('quitterLaScene', 'nulle-part'), /sceneId : "nulle-part" n’est pas un id de scène \(valides : .*test-revisit-couloir/);
    const r = t.jouer(verbe('quitterLaScene', valides.find((id) => id === 'test-revisit-couloir')!));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('entité de scène : `cliquerLaCase`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [entite] = refuseLId(t, verbe('cliquerLaCase', { x: 0, y: 0 }, 'nobody'), /entite : "nobody" n’est pas un id de combattant ou d’entité de scène \(valides : /);
    passeLeControle(t, verbe('cliquerLaCase', { x: 0, y: 0 }, entite));
  });
  it('porte : `actionnerLaPorte`', { timeout: 120_000 }, () => {
    const t = partie('fenetre-ecuries');
    const [porte] = refuseLId(t, verbe('actionnerLaPorte', 'nobody'), /porte : "nobody" n’est pas un id de porte \(valides : /);
    passeLeControle(t, verbe('actionnerLaPorte', porte));
  });
  it('indice : `epinglerLIndice`, et chaque indice affiché de `marquerLesIndices`', { timeout: 120_000 }, () => {
    const t = partie('enquete-carnet');
    refuseLId(t, verbe('epinglerLIndice', 'ind-rumeur-forgeron'), /indiceId : "ind-rumeur-forgeron" n’est pas un id d’indice \(valides : aucun ici\)/);
    expect(t.jouer(verbe('cliquerLaCase', { x: 7, y: 6 })).erreur).toBeNull();
    const [indice] = refuseLId(t, verbe('epinglerLIndice', 'nobody'), /indiceId : "nobody" n’est pas un id d’indice \(valides : ind-rumeur-forgeron\)/);
    refuseLId(t, verbe('marquerLesIndices', [{ id: 'nobody', étapes: 1, statut: 'réfuté', stadeCourant: 's1' }]), /affichés\[0\]\.id : "nobody" n’est pas un id d’indice/);
    passeLeControle(t, verbe('epinglerLIndice', indice));
  });
  it('pré-tiré : `recruterLeHeros`, le noyau bâtit le héros de la donnée', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [pretire] = refuseLId(t, verbe('recruterLeHeros', { pretire: 'nobody' }), /heros\.pretire : "nobody" n’est pas un id de pré-tiré \(valides : /);
    passeLeControle(t, verbe('recruterLeHeros', { pretire }));
  });
  it('porteur et objet : `equiperLObjet`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [heros] = refuseLId(t, verbe('equiperLObjet', 'nobody', 'x'), /heroId : "nobody" n’est pas un id de porteur \(valides : /);
    const [objet] = refuseLId(t, verbe('equiperLObjet', heros, 'nobody'), /uid : "nobody" n’est pas un id d’objet \(valides : /);
    const r = t.jouer(verbe('equiperLObjet', heros, objet));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('possession : `renommerLaPossession`, aucune ici', { timeout: 120_000 }, () => {
    refuseLId(partie('revisit'), verbe('renommerLaPossession', 'nobody', 'x'), /uid : "nobody" n’est pas un id de possession \(valides : aucun ici\)/);
  });
  it('un id dans un tableau : `affecterLeHeros`', { timeout: 120_000 }, () => {
    refuseLId(partie('revisit'), verbe('affecterLeHeros', 'motivation', ['nobody']), /heroIds\[0\] : "nobody" n’est pas un id de héros/);
  });
  it('un id du catalogue : `affecterLeHeros`, un id que l’état du lieu ouvre : `ouvrirLaBoutique`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    refuseLId(t, verbe('affecterLeHeros', 'nulle', []), /activityId : "nulle" n’est pas un id d’Activité \(valides : plein-air, /);
    refuseLId(t, verbe('ouvrirLaBoutique', 'forgeron'), /serviceId : "forgeron" n’est pas un id de service du lieu \(valides : aucun ici\)/);
  });
  it('la signature dit ce que le paramètre désigne', () => {
    const r = table().lire('verbes', { id: 'cliquerLaCase' });
    expect(r.texte).toMatch(/cliquerLaCase\(pt: .*, entite\?: id de combattant ou d’entité de scène, opts\?: /);
  });
});

describe('un champ du contexte d’une offre que rien ne lit se refuse en `validation`', () => {
  it('`charge` ne lit pas `targetId` : la cible se choisit après l’offre', { timeout: 120_000 }, () => {
    const t = partie('dome', verbe('fenetreValider', 'roundStart'));
    const avant = t.fichier();
    const r = t.jouer({ offre: 'charge', ctx: { targetId: 'enemy-enc-dome-1' } });
    const texte = r.texte.split('\n  ').join(' ');
    expect(r.erreur, texte).toBe('validation');
    expect(texte).toMatch(/charge ne lit pas targetId du contexte \(champs acceptés : aucun\) ; la cible de cette offre se choisit après elle, par le clic de son combattant/);
    expect(t.fichier()).toBe(avant);
  });
  it('un champ que la porte de l’offre lit passe le contrôle', { timeout: 120_000 }, () => {
    passeLeControle(partie('dome', verbe('fenetreValider', 'roundStart')), { offre: 'attaque', ctx: { attackId: 'arme' } });
  });
});
