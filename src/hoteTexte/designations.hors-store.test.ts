/**
 * LES IDS QU'UN VERBE DÉSIGNE (#2898), joués par l'hôte texte (`hote.testkit.ts`) : un id que la table du noyau
 * (`DESIGNATIONS`, src/noyau/designations.ts) ne rend pas se refuse en `validation`, en nommant les ids valides, et rien
 * ne s'écrit ; un id que le refus nomme passe le contrôle. Un champ du contexte d'une offre que ni l'offre ni ses
 * candidats ne lisent se refuse de même.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DESIGNATIONS } from '../noyau/index';
import { VERBES } from './verbes.generated';
import { fermerLaTable, partie, table, verbe, type table as Table } from './hote.testkit';
import type { Forme } from './formes';
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
  it('combattant : `battleClickEntity`', { timeout: 120_000 }, () => {
    const t = partie('dome', verbe('confirmRoundStart'));
    const valides = refuseLId(t, verbe('battleClickEntity', 'nobody'), /id : "nobody" n’est pas un id de combattant \(valides : .*enemy-enc-dome-1/);
    passeLeControle(t, verbe('battleClickEntity', valides.find((id) => id.startsWith('enemy'))!));
  });
  it('héros : `grantXp`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [heros] = refuseLId(t, verbe('grantXp', 'nobody', 10), /heroId : "nobody" n’est pas un id de héros \(valides : /);
    const r = t.jouer(verbe('grantXp', heros, 10));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('scène : `transitionTo`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const valides = refuseLId(t, verbe('transitionTo', 'nulle-part'), /sceneId : "nulle-part" n’est pas un id de scène \(valides : .*test-revisit-couloir/);
    const r = t.jouer(verbe('transitionTo', valides.find((id) => id === 'test-revisit-couloir')!));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('entité de scène : `interactEntity`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [entite] = refuseLId(t, verbe('interactEntity', 'nobody'), /entityId : "nobody" n’est pas un id d’entité de scène \(valides : /);
    passeLeControle(t, verbe('interactEntity', entite));
  });
  it('porte : `actionnerLaPorte`', { timeout: 120_000 }, () => {
    const t = partie('fenetre-ecuries');
    const [porte] = refuseLId(t, verbe('actionnerLaPorte', 'nobody'), /portail : "nobody" n’est pas un id de porte \(valides : /);
    passeLeControle(t, verbe('actionnerLaPorte', porte));
  });
  it('étape de cascade : `cascadeChoose`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [etape] = refuseLId(t, verbe('cascadeChoose', 'nobody', 'x'), /pid : "nobody" n’est pas un id d’étape de cascade \(valides : /);
    passeLeControle(t, verbe('cascadeChoose', etape, 'x'));
  });
  it('porteur et objet : `toggleEquip`', { timeout: 120_000 }, () => {
    const t = partie('revisit');
    const [heros] = refuseLId(t, verbe('toggleEquip', 'nobody', 'x'), /heroId : "nobody" n’est pas un id de porteur \(valides : /);
    const [objet] = refuseLId(t, verbe('toggleEquip', heros, 'nobody'), /uid : "nobody" n’est pas un id d’objet \(valides : /);
    const r = t.jouer(verbe('toggleEquip', heros, objet));
    expect(r.erreur, r.texte).toBeNull();
  });
  it('possession : `renamePossession`, aucune ici', { timeout: 120_000 }, () => {
    refuseLId(partie('revisit'), verbe('renamePossession', 'nobody', 'x'), /uid : "nobody" n’est pas un id de possession \(valides : aucun ici\)/);
  });
  it('un id dans un tableau : `setMassBattleHero`', { timeout: 120_000 }, () => {
    refuseLId(partie('revisit'), verbe('setMassBattleHero', 'a', ['nobody']), /heroIds\[0\] : "nobody" n’est pas un id de héros/);
  });
  it('la signature dit ce que le paramètre désigne', () => {
    const r = table().lire('verbes', { id: 'battleClickEntity' });
    expect(r.texte).toMatch(/battleClickEntity\(id: id de combattant, opts\?: /);
  });
});

/** Les désignations que les formes d'une liste de paramètres portent. */
function designationsDe(f: Forme): string[] {
  switch (f.genre) {
    case 'chaine': return f.designe ? [f.designe.cle] : [];
    case 'objet': return [...(f.designe ? [f.designe.cle] : []), ...(f.champs ?? []).flatMap((c) => designationsDe(c.forme))];
    case 'union': return f.membres.flatMap(designationsDe);
    case 'tableau': return designationsDe(f.element);
    default: return [];
  }
}

describe('la table du noyau est la seule source des désignations', () => {
  it('chaque désignation de la table est portée par un paramètre de verbe, et aucune autre', () => {
    const portees = new Set(Object.values(VERBES).flatMap((ps) => ps.flatMap((p) => designationsDe(p.forme))));
    expect([...portees].sort()).toEqual(Object.keys(DESIGNATIONS).sort());
  });
});

describe('un champ du contexte d’une offre que rien ne lit se refuse en `validation`', () => {
  it('`charge` ne lit pas `targetId` : la cible se choisit après l’offre', { timeout: 120_000 }, () => {
    const t = partie('dome', verbe('confirmRoundStart'));
    const avant = t.fichier();
    const r = t.jouer({ offre: 'charge', ctx: { targetId: 'enemy-enc-dome-1' } });
    const texte = r.texte.split('\n  ').join(' ');
    expect(r.erreur, texte).toBe('validation');
    expect(texte).toMatch(/charge ne lit pas targetId du contexte \(champs acceptés : toggleOff\) ; la cible de cette offre se choisit après elle, par le clic de son combattant/);
    expect(t.fichier()).toBe(avant);
  });
  it('un champ que la porte de l’offre lit passe le contrôle', { timeout: 120_000 }, () => {
    passeLeControle(partie('dome', verbe('confirmRoundStart')), { offre: 'attaque', ctx: { attackId: 'arme' } });
  });
});
