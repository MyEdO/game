/**
 * CONTRAT du REFINE DE COUVERTURE du catalogue des cargaisons (#1659 L-1659-2, #1684) — la fabrique
 * `catalogueSaisonnier` (`schemas/grammaire/valeurs.ts`), vue depuis le def qui la compose
 * (`schemas/defs/cargoes.ts`), sur CHACUNE de ses tables (une par voie).
 *
 * Ce que ce fichier tient : le refus MORD, et il NOMME. Un verrou de couverture n'a d'intérêt que si
 * une donnée fautive est refusée AVEC de quoi la corriger — la table, la cargaison, la saison, et
 * l'écart. Sans ces cas, rien ne distingue un refine vivant d'un refine mort : la donnée committée est
 * conforme, et le chemin d'échec n'est jamais emprunté.
 *
 * Les fautes sont injectées dans une COPIE PROFONDE du document réel, jamais dans le fichier :
 * l'invariant se mesure sur le catalogue tel qu'il est authoré, pas sur une maquette qui ne
 * ressemblerait à rien.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema } from './schemas/defs/cargoes';

type Entree = { id: string; label: string; voie: string; echangeable?: false; avail?: Record<string, unknown> };

const charger = (): Entree[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL('./cargoes.json', import.meta.url)), 'utf8'));

/** Les deux tables du catalogue, chacune avec le site que son refus doit citer. */
const CATALOGUES = [
  { nom: 'voie mer', voie: 'mer', site: 'cargoes.json › voie « mer »' },
  { nom: 'voie terre', voie: 'terre', site: 'cargoes.json › voie « terre »' },
] as const;

/** Parse une copie du document après y avoir injecté une faute ; rend les messages de refus. */
function refus(saboter: (doc: Entree[]) => void): string[] {
  const doc = charger();
  saboter(doc);
  const r = schema.safeParse(doc);
  return r.success ? [] : r.error.issues.map((i) => `${i.code} @${i.path.join('.')} : ${i.message}`);
}

/** Les entrées MARCHANDES d'une table, dans l'ordre du document. */
const marchandes = (doc: Entree[], voie: string) => doc.filter((c) => c.voie === voie && c.echangeable !== false);
/** La première entrée MARCHANDE (celle qui ouvre la colonne : sa borne basse vaut 1 aux 4 saisons). */
const premiere = (doc: Entree[], voie: string) => marchandes(doc, voie)[0];
/** La deuxième entrée marchande — celle dont la borne basse suit la borne haute de la première. */
const deuxieme = (doc: Entree[], voie: string) => marchandes(doc, voie)[1];

describe('refine de couverture des catalogues de cargaisons — il MORD et il NOMME (#1659)', () => {
  it('le document COMMITTÉ passe : la sonde ne mesure pas un refus permanent', () => {
    expect(refus(() => {}), 'cargoes.json refusé À VIDE : les cas ci-dessous ne prouveraient plus rien.').toEqual([]);
  });

  it('un TROU dans une colonne est refusé, en citant la cargaison et la saison', () => {
    for (const c of CATALOGUES) {
      const messages = refus((doc) => {
        (premiere(doc, c.voie).avail!.hiver as { min: number }).min = 3;
      });
      expect(messages.length, `${c.nom} : un trou ouvert dans la colonne hiver n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0]).toContain(`${c.site} : la colonne de disponibilité hiver ne couvre pas le d100 de 1 à 100 d'un seul tenant`);
      expect(messages[0], 'le refus ne NOMME pas la cargaison fautive ni son écart chiffré.').toMatch(/« .+ » \(3–\d+\) commence à 3 au lieu de 1/);
      // Les trois AUTRES colonnes et l'autre table restent muettes : le refus est par COLONNE de TABLE.
      expect(messages[0]).not.toContain('printemps');
    }
  });

  it('un CHEVAUCHEMENT est refusé — la rangée recouverte serait INATTEIGNABLE au tirage', () => {
    for (const c of CATALOGUES) {
      const messages = refus((doc) => {
        const d = deuxieme(doc, c.voie);
        (d.avail!.printemps as { min: number }).min -= 1;
      });
      expect(messages.length, `${c.nom} : un chevauchement au printemps n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0]).toContain(`${c.site} : la colonne de disponibilité printemps ne couvre pas`);
      expect(messages[0], 'le refus ne dit pas OÙ la colonne se recoupe.').toMatch(/« .+ » \(\d+–\d+\) commence à \d+ au lieu de \d+/);
    }
  });

  it('une cellule réécrite en TUPLE est refusée par le SCHÉMA de sa variante, avant même la couverture', () => {
    for (const c of CATALOGUES) {
      const doc = charger();
      const rang = doc.indexOf(premiere(doc, c.voie));
      const messages = refus((d) => {
        const e = d[rang];
        const f = e.avail!.printemps as { min: number; max: number };
        e.avail!.printemps = [f.min, f.max];
      });
      // La cellule est un nœud de `parSaison(plageSchema)` : le refus tombe sur elle, au schéma.
      expect(
        messages.some((m) => m.startsWith(`invalid_type @${rang}.avail.printemps`)),
        `${c.nom} : un tuple sous \`avail\` n’est pas refusé par le schéma — la forme positionnelle repasserait.`,
      ).toBe(true);
    }
  });

  it('le MARQUEUR de colonne Production/Produits ne compte pas dans la couverture', () => {
    // Un marqueur n'a ni `avail` ni prix : s'il entrait dans la mesure, la colonne serait jugée
    // trouée par une entrée qui n'est pas une marchandise. C'est le CHAMP d'exclusion qui le sort,
    // comme dans le moteur (`isEchangeable`) — jamais son id.
    for (const c of CATALOGUES) {
      const marqueurs = charger().filter((e) => e.voie === c.voie && e.echangeable === false);
      expect(marqueurs.length, `${c.nom} : plus aucun marqueur — le cas d’exclusion n’est plus exercé.`).toBeGreaterThan(0);
      expect(marqueurs.every((m) => m.avail === undefined), 'un marqueur porte une disponibilité : il serait une marchandise.').toBe(true);
    }
    expect(refus(() => {}), 'le catalogue AVEC ses marqueurs est refusé.').toEqual([]);
  });
});
