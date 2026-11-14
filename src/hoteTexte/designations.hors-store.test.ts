/**
 * LES IDS QU'UN VERBE DÉSIGNE (#2898), joués par l'hôte texte (`hote.testkit.ts`) : un id que la table du noyau
 * (`DESIGNATIONS`, src/noyau/designations.ts) ne rend pas se refuse en `validation`, en nommant les ids valides, et rien
 * ne s'écrit ; un id que le refus nomme passe le contrôle. Le verbe d'une offre désigne de même ce que sa case lit.
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
    const t = partie('dome', verbe('fenetreValider', 'debutDuRound'));
    const valides = refuseLId(t, verbe('cliquerLaCase', { x: 7, y: 5 }, 'nobody'), /entite : "nobody" n’est pas un id de combattant ou d’entité de scène \(valides : .*enemy-enc-dome-1/);
    passeLeControle(t, verbe('cliquerLaCase', { x: 7, y: 5 }, valides.find((id) => id.startsWith('enemy'))!));
  });
  it('héros : `creerLaPanoplie`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [heros] = refuseLId(t, verbe('creerLaPanoplie', 'nobody'), /heroId : "nobody" n’est pas un id de héros \(valides : /);
    const r = t.jouer(verbe('creerLaPanoplie', heros));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('point d’intérêt du lieu : le choix `ecranDuLieu.entrer`, aucun hors d’un lieu', { timeout: 120_000 }, () => {
    refuseLId(partie('revisit'), verbe('fenetreChoisir', 'ecranDuLieu', 'entrer', 'test-revisit-couloir'), /valeur : "test-revisit-couloir" n’est pas un id de point d’intérêt du lieu \(valides : aucun ici\)/);
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
    refuseLId(t, verbe('epinglerLIndice', 'ind-rumeur-forgeron', true), /indiceId : "ind-rumeur-forgeron" n’est pas un id d’indice \(valides : aucun ici\)/);
    expect(t.jouer(verbe('cliquerLaCase', { x: 7, y: 6 })).erreur).toBeNull();
    const [indice] = refuseLId(t, verbe('epinglerLIndice', 'nobody', true), /indiceId : "nobody" n’est pas un id d’indice \(valides : ind-rumeur-forgeron\)/);
    refuseLId(t, verbe('marquerLesIndices', [{ id: 'nobody', étapes: 1, statut: 'refute', stadeCourant: 's1' }]), /affiches\[0\]\.id : "nobody" n’est pas un id d’indice/);
    passeLeControle(t, verbe('epinglerLIndice', indice, true));
  });
  it('pré-tiré : `recruterLeHeros`, le noyau bâtit le héros de la donnée', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [pretire] = refuseLId(t, verbe('recruterLeHeros', { pretire: 'nobody' }), /heros\.pretire : "nobody" n’est pas un id de pré-tiré \(valides : /);
    passeLeControle(t, verbe('recruterLeHeros', { pretire }));
  });
  it('objet : `equiperLObjet`, son porteur lu dans l’état', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [objet] = refuseLId(t, verbe('equiperLObjet', 'nobody'), /uid : "nobody" n’est pas un id d’objet \(valides : /);
    const r = t.jouer(verbe('equiperLObjet', objet));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('possession : `renommerLaPossession`, aucune ici', { timeout: 120_000 }, () => {
    refuseLId(partie('revisit'), verbe('renommerLaPossession', 'nobody', 'x'), /possessionUid : "nobody" n’est pas un id de possession \(valides : aucun ici\)/);
  });
  it('un id du catalogue : `menerLActionDeBataille`, un id que l’état du lieu ouvre : `ouvrirLaBoutique`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [heros] = refuseLId(t, verbe('creerLaPanoplie', 'nobody'), /heroId : "nobody" n’est pas un id de héros \(valides : /);
    refuseLId(t, verbe('menerLActionDeBataille', heros, 'nulle'), /activityId : "nulle" n’est pas un id d’Activité \(valides : plein-air, /);
    refuseLId(t, verbe('ouvrirLaBoutique', 'forgeron'), /serviceId : "forgeron" n’est pas un id de service du lieu \(valides : aucun ici\)/);
  });
  it('une rangée de jet : la séquence d’entrée en scène, `jetLancer`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [rangee] = refuseLId(t, verbe('jetLancer', 'cascade', 'nobody'), /pid : "nobody" n’est pas un id de rangée \(valides : cons-entreeEnScene-0, /);
    passeLeControle(t, verbe('jetLancer', 'cascade', rangee));
  });
  it('un id facultatif : `ouvrirLeMedecin`, le patient', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    refuseLId(t, verbe('ouvrirLeMedecin', 'nobody'), /patientId : "nobody" n’est pas un id de héros/);
  });
  it('la signature dit ce que le paramètre désigne', () => {
    const r = table().lire('verbes', { id: 'cliquerLaCase' });
    expect(r.texte).toMatch(/cliquerLaCase\(pt: .*, entite\?: id de combattant ou d’entité de scène, opts\?: /);
  });
});

describe('le verbe d’une offre désigne ce que sa case lit', () => {
  it('un id d’attaque que l’état ne désigne pas se refuse, en nommant les ids valides', { timeout: 120_000 }, () => {
    refuseLId(partie('dome', verbe('fenetreValider', 'debutDuRound')), verbe('armerLAttaque', 'nobody'), /armerLAttaque : attaqueId : "nobody" n’est pas un id d’attaque \(valides : .*arme/);
  });
  it('l’id que le refus nomme passe le contrôle', { timeout: 120_000 }, () => {
    passeLeControle(partie('dome', verbe('fenetreValider', 'debutDuRound')), verbe('armerLAttaque', 'arme'));
  });
});
