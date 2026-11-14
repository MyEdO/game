/**
 * #2907 L2 : les ids du monde viennent du compteur de l'état (`prochainId`, `forgerUnId`). Un id forgé après un
 * chargement, ou chez l'hôte après un instantané coop, n'est aucun de ceux qu'ils portaient ; un scénario lancé garde le
 * compteur que son groupe a consommé ; deux rejeux d'un même fichier forgent les mêmes ids. Un uid du monde n'a qu'un
 * porteur, et la désignation d'objet ne masque pas un doublon.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { describe, expect, it } from 'vitest';
import { chargerLaSave, creerPartie, etatInitialDuJeu, exporterLaSauvegarde, lireSave, snapshotSave, type EtatDeJeu, type SaveGame } from './index';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import { itemFromTrappingById } from '../engine/items';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { ouvrirLaPartie, nouvelEntete } from '../hote/partie';
import { empreinte, jouerUnGeste, lireLeFichier, rejouer } from '../hoteTexte/partieTexte';
import { ouvrirLeBanc } from './banc.testkit';
import { groupeVitrineDeScenario } from '../scenes/test-scenarios/_heros';
import { pregens } from '../data';
import { fabriqueLocale } from '../engine/fabriqueDId';
import { testScenarios } from '../scenes/test-scenarios';
import { DESIGNATIONS } from './designations';

const ENTREES = { graine: 3, cadence: 'manuel' as const, desFixes: true, persisterLeHeros: () => {}, reglesMaison: {} };
const HEROS = { id: 'h', label: 'H', kind: 'heros', conditions: [], items: [] } as unknown as Combatant;
/** Les ids du monde que porte `texte` (`<genre>-<n>`, préfixés ou non d'une dérivation). */
const idsDuMonde = (texte: string): Set<string> => new Set(texte.match(/(?:it|hero|pos|favor)-\d+/g) ?? []);

describe('un id forgé après un chargement n’est aucun de ceux de la save (#2907)', () => {
  it('objet, puis héros, après `chargerLaSave` et `creerPartie`', () => {
    const p1 = creerPartie({ ...etatInitialDuJeu(), party: [HEROS] }, ENTREES);
    const idNeuf = p1.etat().forgerUnId;
    const objets = [itemFromTrappingById('lance', idNeuf)!, itemFromTrappingById('baton-de-combat', idNeuf)!];
    const avant: EtatDeJeu = { ...p1.etat(), party: [{ ...HEROS, items: objets }] };
    const texte = exporterLaSauvegarde(snapshotSave(avant, '2026-11-08T00:00:00.000Z'));
    p1.fermer();
    const deLaSave = idsDuMonde(texte);
    expect(deLaSave.size).toBe(2);

    const p2 = creerPartie(chargerLaSave(lireSave(texte) as SaveGame).etat, ENTREES);
    try {
      const neuf = itemFromTrappingById('hallebarde', p2.etat().forgerUnId)!;
      expect(deLaSave.has(neuf.uid)).toBe(false);
      const heros = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Recrue', seed: 5, idNeuf: p2.etat().forgerUnId });
      expect(deLaSave.has(heros.id)).toBe(false);
      for (const it of heros.items ?? []) expect(deLaSave.has(it.uid)).toBe(false);
    } finally {
      p2.fermer();
    }
  });
});

describe('le compteur voyage dans l’instantané coop (#2907)', () => {
  it('l’invité adopte le compteur de l’hôte ; un objet que l’hôte crée ensuite ne reprend aucun id de l’instantané', () => {
    const hote = creerPartie({ ...etatInitialDuJeu(), party: [HEROS] }, ENTREES);
    try {
      const idNeuf = hote.etat().forgerUnId;
      const objets = [itemFromTrappingById('dague', idNeuf)!, itemFromTrappingById('lance', idNeuf)!];
      const etat: EtatDeJeu = { ...hote.etat(), party: [{ ...HEROS, items: objets }] };
      const instantane = instantaneDeLaCoop(etat);
      const invite = appliquerLInstantane(instantane, etatInitialDuJeu()).etat;
      expect(invite.prochainId).toBe(hote.etat().prochainId);
      const neuf = itemFromTrappingById('hallebarde', idNeuf)!;
      const portes = idsDuMonde(JSON.stringify(instantane));
      expect(portes.size).toBe(2);
      expect(portes.has(neuf.uid)).toBe(false);
    } finally {
      hote.fermer();
    }
  });
});

describe('un scénario lancé garde le compteur que son groupe a consommé (#2907)', () => {
  it('`dome` : le prochain id dépasse tous ceux que l’état porte', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const rangs = [...idsDuMonde(JSON.stringify(etat))].map((id) => Number(/\d+$/.exec(id)![0]));
      expect(rangs.length).toBeGreaterThan(0);
      expect(etat.prochainId).toBeGreaterThan(Math.max(...rangs));
    } finally {
      partie.fermer();
    }
  });
});

/** Les porteurs de chaque uid du monde que porte `etat` : le combattant qui le porte (ses copies de groupe et de
 *  bataille comptent pour un), sinon la clé d'état qui le tient (possessions, navire, banque…). Un profil d'arme
 *  (`Weapon` : des dégâts, sans `kind`) porte l'uid de l'objet dont il dérive, où qu'il soit copié (une fenêtre
 *  d'attaque, une parade) : une référence, pas un porteur. */
function porteursDesUids(etat: object): Map<string, Set<string>> {
  const porteurs = new Map<string, Set<string>>();
  const parcourir = (v: unknown, porteur: string): void => {
    if (Array.isArray(v)) { for (const x of v) parcourir(x, porteur); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if ('damage' in o && !('kind' in o)) return;
    const p = typeof o.kind === 'string' && typeof o.id === 'string' && Array.isArray(o.items) ? `combattant:${o.id}` : porteur;
    for (const [k, x] of Object.entries(o)) {
      if (k === 'uid' && typeof x === 'string' && /^(?:it|hero|pos|favor)-\d+$/.test(x)) (porteurs.get(x) ?? porteurs.set(x, new Set()).get(x)!).add(p);
      else parcourir(x, p);
    }
  };
  for (const [k, v] of Object.entries(etat)) if (typeof v !== 'function') parcourir(v, `etat:${k}`);
  return porteurs;
}

/** Les uids que la désignation d'objet ou de poste lit plus d'une fois dans `etat`, nommés sous `lieu`. */
function lusPlusDUneFois(lieu: string, etat: Parameters<typeof DESIGNATIONS.IdDObjet.lire>[0]): string[] {
  return (['IdDObjet', 'IdDePoste'] as const).flatMap((nom) => {
    const lus = DESIGNATIONS[nom].lire(etat);
    return [...new Set(lus.filter((u, i) => lus.indexOf(u) !== i))].map((uid) => `${lieu} ${uid} : lu plus d’une fois par ${nom}`);
  });
}

describe('un uid du monde n’a qu’un porteur (#2907)', () => {
  it('sur chaque scénario lancé, chaque uid lu une fois par la désignation d’objet ou de poste', () => {
    const doublons: string[] = [];
    for (const sc of testScenarios) {
      const { partie } = ouvrirLaPartie(nouvelEntete(sc.id, { graine: 7 }), () => {});
      try {
        for (const [uid, porteurs] of porteursDesUids(partie.etat())) if (porteurs.size > 1) doublons.push(`${sc.id} ${uid} : ${[...porteurs].join(', ')}`);
        doublons.push(...lusPlusDUneFois(sc.id, partie.etat()));
      } finally {
        partie.fermer();
      }
    }
    expect(doublons).toEqual([]);
  }, 120_000);

  it('sur chaque partie committée de l’hôte texte rejouée jusqu’au bout, chaque uid lu une fois par la désignation d’objet ou de poste', () => {
    const dossier = new URL('../hoteTexte/', import.meta.url);
    const fichiers = listerDossier(fileURLToPath(dossier)).filter((f) => f.endsWith('.jsonl'));
    expect(fichiers.length).toBeGreaterThan(0);
    const doublons: string[] = [];
    for (const f of fichiers) {
      const { entete, gestes } = lireLeFichier(readFileSync(new URL(f, dossier), 'utf8'));
      const r = rejouer(entete, gestes);
      try {
        const etat = r.partie.etat();
        for (const [uid, porteurs] of porteursDesUids(etat)) if (porteurs.size > 1) doublons.push(`${f} ${uid} : ${[...porteurs].join(', ')}`);
        doublons.push(...lusPlusDUneFois(f, etat));
      } finally {
        r.partie.fermer();
      }
    }
    expect(doublons).toEqual([]);
  }, 240_000);
});

describe('un uid porté par deux combattants n’est pas masqué par la désignation (#2907)', () => {
  it('`IdDObjet` le lit chez chacun', () => {
    const memeUid = () => 'it-1';
    const porteur = (id: string): Combatant => ({ ...HEROS, id, items: [itemFromTrappingById('dague', memeUid)!] });
    const banc = ouvrirLeBanc({ etat: { party: [porteur('a'), porteur('b')] } });
    expect(DESIGNATIONS.IdDObjet.lire(banc.getState())).toEqual(['it-1', 'it-1']);
  });
});

describe('un geste refusé ne consomme aucun id (#2907)', () => {
  it('un recrutement refusé, groupe plein, laisse le compteur', () => {
    const banc = ouvrirLeBanc({ etat: { party: groupeVitrineDeScenario(fabriqueLocale('groupe')) } });
    const avant = banc.getState().prochainId;
    banc.getState().recruterLeHeros({ pretire: pregens[0].id });
    expect(banc.getState().party).toHaveLength(4);
    expect(banc.getState().prochainId).toBe(avant);
  });

  it('l’hôte texte juge sans effet un recrutement refusé en combat, et n’en écrit rien', () => {
    const { entete } = lireLeFichier(readFileSync(new URL('../hoteTexte/combat-dome.jsonl', import.meta.url), 'utf8'));
    const r = rejouer(entete, []);
    try {
      expect(r.partie.etat().battle).not.toBeNull();
      const avant = r.partie.etat().prochainId;
      expect(() => jouerUnGeste(r, { type: 'recruterLeHeros', args: [{ pretire: pregens[0].id }], siege: 0 } as never)).toThrow(/sans effet/);
      expect(r.gestes).toHaveLength(0);
      expect(r.partie.etat().prochainId).toBe(avant);
    } finally {
      r.partie.fermer();
    }
  });
});

describe('deux rejeux d’un même fichier forgent les mêmes ids (#2907, `combat-dome.jsonl`)', () => {
  it('même empreinte', () => {
    const { entete, gestes } = lireLeFichier(readFileSync(new URL('../hoteTexte/combat-dome.jsonl', import.meta.url), 'utf8'));
    const a = rejouer(entete, gestes);
    const ea = empreinte(a.partie.etat());
    a.partie.fermer();
    const b = rejouer(entete, gestes);
    const eb = empreinte(b.partie.etat());
    b.partie.fermer();
    expect(ea).toBe(eb);
  });
});
