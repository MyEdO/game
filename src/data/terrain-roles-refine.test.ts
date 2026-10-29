/**
 * CONTRAT des REFINES DE COLLECTION de `terrains.json` (#1789) — `schemas/defs/terrains.ts` : les
 * deux RÔLES adressés par le moteur, et le GLYPHE d'authoring qui écrit un terrain dans une carte
 * ASCII (unique dans la collection, hors grammaire du plan — `grammaire/carte-ascii.ts`).
 *
 * Le glyphe est de la même classe que les rôles : une propriété dont la VALIDITÉ se mesure sur la
 * collection entière (deux entrées au même glyphe rendraient la lecture d'un plan dépendante de
 * l'ordre d'écriture), donc un refine de dataset, jamais d'entrée.
 *
 * Deux rôles que le moteur ADRESSE au lieu de réciter un id : `absence` (la non-tuile — ce qu'une
 * couche porte là où rien n'est bâti) et `bordDuMonde` (ce que la grille rend au-delà de ses bornes).
 * Le seam (`noyau/monde/terrain`) en DÉRIVE `terrainAbsent()` / `terrainHorsGrille()` : un dataset à zéro
 * porteur laisserait ces fonctions sans réponse, un dataset à deux porteurs les rendrait dépendantes
 * de l'ORDRE d'écriture. Ce que ce fichier tient : le refus MORD au PARSE, et il NOMME le rôle, le
 * compte mesuré et les porteurs.
 *
 * Les fautes sont injectées dans une COPIE du dataset réel, jamais dans le fichier.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema } from './schemas/defs/terrains';
import { GLYPHES_RESERVES } from './schemas/grammaire/carte-ascii';

type Entree = { id: string; absence?: boolean; bordDuMonde?: boolean; ascii?: string };
type Role = 'absence' | 'bordDuMonde';

const charger = (): Entree[] => JSON.parse(readFileSync(fileURLToPath(new URL('./terrains.json', import.meta.url)), 'utf8'));

/** Parse une copie du dataset après y avoir injecté une faute ; rend les messages de refus. */
function refus(saboter: (dataset: Entree[]) => void): string[] {
  const dataset = charger();
  saboter(dataset);
  const r = schema.safeParse(dataset);
  return r.success ? [] : r.error.issues.map((i) => `${i.code} @${i.path.join('.')} : ${i.message}`);
}

/** Une entrée EXIGÉE du dataset : son absence est un dataset ROMPU, que la sonde NOMME au lieu de
 *  crasher en `TypeError` — la garde doit dire ce qui manque, pas où elle a trébuché. */
function exige(entree: Entree | undefined, quoi: string): Entree {
  expect(entree, `dataset rompu : ${quoi} — la sonde ne mesure plus rien.`).toBeDefined();
  if (!entree) throw new Error(`dataset rompu : ${quoi}`);
  return entree;
}

const porteurDe = (role: Role): Entree =>
  exige(charger().find((t) => t[role] === true), `aucune entrée ne porte le rôle « ${role} »`);

describe('terrains — rôles à porteur UNIQUE et glyphe d’authoring UNIQUE, refusés au parse sinon (#1789)', () => {
  it('le dataset COMMITTÉ passe : la sonde ne mesure pas un refus permanent', () => {
    expect(refus(() => {}), 'terrains.json refusé À VIDE : les cas ci-dessous ne prouveraient plus rien.').toEqual([]);
  });

  for (const role of ['absence', 'bordDuMonde'] as const) {
    it(`« ${role} » : le dataset committé en désigne UN, et un seul`, () => {
      const porteurs = charger().filter((t) => t[role] === true).map((t) => t.id);
      expect(porteurs, `le rôle « ${role} » n’est plus porté par une entrée unique.`).toHaveLength(1);
    });

    it(`« ${role} » : ZÉRO porteur est refusé, en nommant le rôle et le compte`, () => {
      const porteur = porteurDe(role);
      const messages = refus((dataset) => {
        delete exige(dataset.find((t) => t.id === porteur.id), `« ${porteur.id} » a disparu de la copie`)[role];
      });
      expect(messages.length, `le rôle « ${role} » orphelin n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0], 'le refus d’une propriété de la COLLECTION vise le document entier.').toMatch(/^custom @ : /);
      expect(messages[0], 'le refus ne NOMME pas le rôle.').toContain(`rôle « ${role} »`);
      expect(messages[0], 'le refus ne dit pas le COMPTE mesuré.').toContain('0 mesurée(s)');
    });

    it(`« ${role} » : DEUX porteurs sont refusés, en nommant les deux entrées`, () => {
      const porteur = porteurDe(role);
      const autreId = exige(charger().find((t) => t.id !== porteur.id), 'le dataset ne porte qu’UNE entrée').id;
      const messages = refus((dataset) => {
        exige(dataset.find((t) => t.id === autreId), `« ${autreId} » a disparu de la copie`)[role] = true;
      });
      expect(messages.length, `deux porteurs de « ${role} » n’ont levé AUCUN refus.`).toBe(1);
      expect(messages[0], 'le refus ne dit pas le COMPTE mesuré.').toContain('2 mesurée(s)');
      expect(messages[0], 'le refus ne NOMME pas les porteurs mesurés.').toContain(autreId);
      expect(messages[0]).toContain(porteur.id);
    });
  }

  it('un glyphe d’authoring DOUBLÉ est refusé, en nommant le glyphe et les deux entrées', () => {
    const porteur = exige(charger().find((t) => typeof t.ascii === 'string'), 'aucune entrée ne déclare de glyphe `ascii`');
    const autreId = exige(charger().find((t) => t.ascii === undefined), 'toutes les entrées déclarent un glyphe').id;
    const messages = refus((dataset) => {
      exige(dataset.find((t) => t.id === autreId), `« ${autreId} » a disparu de la copie`).ascii = porteur.ascii;
    });
    expect(messages.length, 'un glyphe doublé n’a levé AUCUN refus.').toBe(1);
    expect(messages[0], 'le refus d’une propriété de la COLLECTION vise le document entier.').toMatch(/^custom @ : /);
    expect(messages[0], 'le refus ne NOMME pas le glyphe fautif.').toContain(`glyphe « ${porteur.ascii} »`);
    expect(messages[0], 'le refus ne NOMME pas les entrées en collision.').toContain(porteur.id);
    expect(messages[0]).toContain(autreId);
  });

  it('un glyphe de la GRAMMAIRE du plan est refusé, en nommant le glyphe, le terrain et le vocabulaire réservé', () => {
    const reserve = [...GLYPHES_RESERVES][0];
    const cible = exige(charger().find((t) => t.ascii === undefined), 'toutes les entrées déclarent un glyphe');
    const messages = refus((dataset) => {
      exige(dataset.find((t) => t.id === cible.id), `« ${cible.id} » a disparu de la copie`).ascii = reserve;
    });
    expect(messages.length, 'un glyphe RÉSERVÉ n’a levé AUCUN refus.').toBe(1);
    expect(messages[0], 'le refus ne vise pas le champ `ascii` de l’entrée fautive.').toContain(`@${charger().findIndex((t) => t.id === cible.id)}.ascii :`);
    expect(messages[0], 'le refus ne NOMME pas le glyphe fautif.').toContain(`glyphe « ${reserve} »`);
    expect(messages[0], 'le refus ne NOMME pas le terrain fautif.').toContain(cible.id);
    expect(messages[0], 'le refus ne dit pas que le glyphe est réservé par la grammaire.').toContain('RÉSERVÉ');
  });

  it('un glyphe de PLUS D’UN caractère est refusé au champ, en FRANÇAIS et en citant la valeur lue', () => {
    const cible = exige(charger().find((t) => t.ascii === undefined), 'toutes les entrées déclarent un glyphe');
    const messages = refus((dataset) => {
      exige(dataset.find((t) => t.id === cible.id), `« ${cible.id} » a disparu de la copie`).ascii = '##';
    });
    expect(messages.length, 'un glyphe de deux chars n’a levé AUCUN refus.').toBeGreaterThan(0);
    const dit = messages.join('\n');
    // Refus de CHAMP (`@<index>.ascii`), non de collection (`@ascii`) : la longueur se mesure sur
    // l'entrée, le chemin dit donc l'entrée fautive puis le champ.
    expect(dit, 'le refus ne cite pas `ascii` en chemin.').toMatch(/@\d+\.ascii/);
    expect(dit, 'le refus ne CITE pas la valeur refusée.').toContain('« ## »');
    expect(dit, 'le refus ne dit pas la règle en français (UN SEUL caractère).').toContain('UN SEUL caractère');
    // POSITIF de bout en bout : le message MAISON (`defs/terrains.ts`) occupe TOUTE la ligne de refus,
    // donc aucun défaut de la dépendance ne s'y substitue. Une assertion négative sur la phrase de zod
    // passerait à vide dès que zod la reformule.
    expect(dit, 'le refus n’est pas le message maison de bout en bout.')
      .toMatch(/@\d+\.ascii : glyphe d’authoring « ## » : UN SEUL caractère — /);
  });

  it('les deux rôles sont portés par des entrées DISTINCTES — le bord du monde n’est pas une absence', () => {
    expect(porteurDe('bordDuMonde').id, 'le bord du monde et la non-tuile ont fusionné : la Ligne de Vue au bord change.')
      .not.toBe(porteurDe('absence').id);
  });
});
