/**
 * CONTRAT du REFINE DE COUVERTURE des catalogues de cargaisons (#1659 L-1659-2) — la fabrique
 * partagée `catalogueSaisonnier` (`schemas/grammaire/valeurs.ts`), vue depuis les DEUX defs qui la
 * composent.
 *
 * Ce que ce fichier tient : le refus MORD, et il NOMME. Un verrou de couverture n'a d'intérêt que si
 * une donnée fautive est refusée AVEC de quoi la corriger — la cargaison, la saison, et l'écart. Sans
 * ces cas, rien ne distingue un refine vivant d'un refine mort : la donnée committée est conforme, et
 * le chemin d'échec n'est jamais emprunté.
 *
 * Les fautes sont injectées dans une COPIE PROFONDE du document réel, jamais dans le fichier :
 * l'invariant se mesure sur le catalogue tel qu'il est authoré, pas sur une maquette qui ne
 * ressemblerait à rien.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema as seaSchema } from './schemas/defs/sea-cargo';
import { schema as landSchema } from './schemas/defs/land-cargo';

type Doc = { cargoes: { id: string; label: string; echangeable?: false; avail?: Record<string, unknown> }[] };

const charger = (fichier: string): Doc =>
  JSON.parse(readFileSync(fileURLToPath(new URL(fichier, import.meta.url)), 'utf8'));

/** Les deux catalogues, chacun avec SON schéma et le site que son refus doit citer. */
const CATALOGUES = [
  { nom: 'sea-cargo.json', fichier: './sea-cargo.json', schema: seaSchema, site: 'sea-cargo.json › cargoes' },
  { nom: 'land-cargo.json', fichier: './land-cargo.json', schema: landSchema, site: 'land-cargo.json › cargoes' },
] as const;

/** Parse une copie du document après y avoir injecté une faute ; rend les messages de refus. */
function refus(catalogue: (typeof CATALOGUES)[number], saboter: (doc: Doc) => void): string[] {
  const doc = charger(catalogue.fichier) as Doc & Record<string, unknown>;
  saboter(doc);
  const r = catalogue.schema.safeParse(doc);
  return r.success ? [] : r.error.issues.map((i) => `${i.code} @${i.path.join('.')} : ${i.message}`);
}

/** La première entrée MARCHANDE (celle qui ouvre la colonne : sa borne basse vaut 1 aux 4 saisons). */
const premiere = (doc: Doc) => doc.cargoes.find((c) => c.echangeable !== false)!;
/** La deuxième entrée marchande — celle dont la borne basse suit la borne haute de la première. */
const deuxieme = (doc: Doc) => doc.cargoes.filter((c) => c.echangeable !== false)[1];

describe('refine de couverture des catalogues de cargaisons — il MORD et il NOMME (#1659)', () => {
  it('le document COMMITTÉ passe : la sonde ne mesure pas un refus permanent', () => {
    for (const c of CATALOGUES) {
      expect(refus(c, () => {}), `${c.nom} refusé À VIDE : les cas ci-dessous ne prouveraient plus rien.`).toEqual([]);
    }
  });

  it('un TROU dans une colonne est refusé, en citant la cargaison et la saison', () => {
    for (const c of CATALOGUES) {
      const messages = refus(c, (doc) => {
        (premiere(doc).avail!.hiver as { min: number }).min = 3;
      });
      expect(messages.length, `${c.nom} : un trou ouvert dans la colonne hiver n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0]).toContain(`${c.site} : la colonne de disponibilité hiver ne couvre pas le d100 de 1 à 100 d'un seul tenant`);
      expect(messages[0], 'le refus ne NOMME pas la cargaison fautive ni son écart chiffré.').toMatch(/« .+ » \(3–\d+\) commence à 3 au lieu de 1/);
      // Les trois AUTRES colonnes restent muettes : le refus est par COLONNE, pas par document.
      expect(messages[0]).not.toContain('printemps');
    }
  });

  it('un CHEVAUCHEMENT est refusé — la rangée recouverte serait INATTEIGNABLE au tirage', () => {
    for (const c of CATALOGUES) {
      const messages = refus(c, (doc) => {
        const d = deuxieme(doc);
        (d.avail!.printemps as { min: number }).min -= 1;
      });
      expect(messages.length, `${c.nom} : un chevauchement au printemps n’a levé AUCUN refus.`).toBe(1);
      expect(messages[0]).toContain(`${c.site} : la colonne de disponibilité printemps ne couvre pas`);
      expect(messages[0], 'le refus ne dit pas OÙ la colonne se recoupe.').toMatch(/« .+ » \(\d+–\d+\) commence à \d+ au lieu de \d+/);
    }
  });

  it('une cellule réécrite en TUPLE est refusée par le SCHÉMA de sa variante, avant même la couverture', () => {
    for (const c of CATALOGUES) {
      const messages = refus(c, (doc) => {
        const e = premiere(doc);
        const f = e.avail!.printemps as { min: number; max: number };
        e.avail!.printemps = [f.min, f.max];
      });
      // Sans `echangeable: false`, l'entrée est MARCHANDE (`catalogueSaisonnier`, union discriminée) :
      // le refus tombe sur la cellule, dans le schéma marchand.
      expect(
        messages.some((m) => m.startsWith('invalid_type @cargoes.0.avail.printemps')),
        `${c.nom} : un tuple sous \`avail\` n’est pas refusé par le schéma — la forme positionnelle repasserait.`,
      ).toBe(true);
    }
  });

  it('le MARQUEUR de colonne Production/Produits ne compte pas dans la couverture', () => {
    // Un marqueur n'a ni `avail` ni prix : s'il entrait dans la mesure, la colonne serait jugée
    // trouée par une entrée qui n'est pas une marchandise. C'est le CHAMP d'exclusion qui le sort,
    // comme dans le moteur (`isEchangeable`) — jamais son id.
    for (const c of CATALOGUES) {
      const doc = charger(c.fichier);
      const marqueurs = doc.cargoes.filter((e) => e.echangeable === false);
      expect(marqueurs.length, `${c.nom} : plus aucun marqueur — le cas d’exclusion n’est plus exercé.`).toBeGreaterThan(0);
      expect(marqueurs.every((m) => m.avail === undefined), 'un marqueur porte une disponibilité : il serait une marchandise.').toBe(true);
      expect(refus(c, () => {}), `${c.nom} : le catalogue AVEC ses marqueurs est refusé.`).toEqual([]);
    }
  });
});
