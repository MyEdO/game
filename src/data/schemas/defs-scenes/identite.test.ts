/**
 * Porte de l'IDENTITÉ d'un état `heros` (EDO 02 l.112-127, #686) : chaque contrôle refuse SA faute, au
 * chemin de la valeur fautive, par la porte du narratif (`narratifSchema`).
 */
import { describe, it, expect } from 'vitest';
import { narratifSchema, type NarratifBlock } from './narratif';
import { emptyNarratif } from '../../../noyau/monde/campaignNarratif';

const P27 = { book: 'ennemi-dans-l-ombre', page: 27, note: 'EDO 02 l.114-125' };
const L127 = { book: 'ennemi-dans-l-ombre', page: 27, note: 'EDO 02 l.127' };

type Identite = Record<string, unknown>;
type Valeur = Record<string, unknown>;
/** Les valeurs de la ligne `j`. */
const valeurs = (id: Identite, j: number): Valeur[] => (id.lignes as { valeurs: Valeur[] }[])[j].valeurs;
const identite = (): Identite => ({
  ancres: ['Kastor', 'Lieberung'],
  reperes: [{ id: 'complet', fragment: 'Kastor Lieberung' }, { id: 'nom', fragment: 'Lieberung' }],
  lignes: [
    { espece: 'humain', sexe: 'M', valeurs: [{ repere: 'complet', valeur: 'Kastor Lieberung', source: P27 }, { repere: 'nom', valeur: 'Lieberung', source: P27 }] },
    { espece: 'nain', sexe: 'F', valeurs: [{ repere: 'complet', valeur: 'Kallar Linkassniz', source: P27 }, { repere: 'nom', valeur: 'Linkassniz', adapteDe: L127 }] },
  ],
});
const narratif = (id: Identite): NarratifBlock => ({
  ...emptyNarratif(),
  etats: [{ id: 'sosie', label: 'Le sosie', source: { book: 'ennemi-dans-l-ombre', page: 26, note: 'EDO 02 l.91' }, forme: { kind: 'heros', identite: id } }],
} as NarratifBlock);

/** Les fautes `chemin sous l'identité → message`. */
function fautes(id: Identite): string[] {
  const r = narratifSchema.safeParse(narratif(id));
  return r.success ? [] : r.error.issues.map((i) => `${i.path.slice(4).join('.')} → ${i.message}`);
}

describe('identité d’un état `heros` — la porte refuse chaque faute à sa place', () => {
  it('l’identité complète PARSE', () => {
    expect(fautes(identite())).toEqual([]);
  });

  it('un repère sans ancre est refusé', () => {
    const id = identite();
    (id.reperes as { fragment: string }[])[1].fragment = 'Herr Kuftsos';
    expect(fautes(id)).toEqual(['reperes.1.fragment → repère « Herr Kuftsos » sans ancre : il contient au moins l’une de « Kastor », « Lieberung ».']);
  });

  it('une ancre ne compte qu’en mot entier', () => {
    const id = identite();
    (id.reperes as { fragment: string }[])[1].fragment = 'Lieberungen';
    expect(fautes(id)).toEqual(['reperes.1.fragment → repère « Lieberungen » sans ancre : il contient au moins l’une de « Kastor », « Lieberung ».']);
  });

  it('une valeur sans provenance est refusée', () => {
    const id = identite();
    valeurs(id, 1)[1] = { repere: 'nom', valeur: 'Linkassniz' };
    expect(fautes(id)).toEqual(['lignes.1.valeurs.1.source → provenance manquante : la page copiée (source) ou le passage adapté (adapté de).']);
  });

  it('une valeur copiée ET adaptée est refusée', () => {
    const id = identite();
    valeurs(id, 1)[1] = { repere: 'nom', valeur: 'Linkassniz', source: P27, adapteDe: L127 };
    expect(fautes(id)).toEqual(['lignes.1.valeurs.1.adapteDe → texte à la fois copié et adapté d’un passage : garde l’un ou l’autre.']);
  });

  it('un métacaractère Markdown est refusé : ancre, repère, valeur', () => {
    const id = identite();
    (id.ancres as string[])[0] = '*Kastor*';
    (id.reperes as { fragment: string }[])[1].fragment = 'Lieberung_';
    valeurs(id, 1)[0].valeur = 'Kallar [Linkassniz]';
    const f = fautes(id);
    expect(f).toContain('ancres.0 → ancre : métacaractère Markdown refusé (\\ ` * _ [ ] < > # | ~).');
    expect(f).toContain('reperes.1.fragment → fragment du repère : métacaractère Markdown refusé (\\ ` * _ [ ] < > # | ~).');
    expect(f).toContain('lignes.1.valeurs.0.valeur → valeur : métacaractère Markdown refusé (\\ ` * _ [ ] < > # | ~).');
  });

  it('une ligne qui ne couvre pas tous les repères est refusée', () => {
    const id = identite();
    valeurs(id, 1).splice(1, 1);
    expect(fautes(id)).toEqual(['lignes.1.valeurs → repère « nom » sans valeur : une ligne couvre tous les repères.']);
  });

  it('une valeur d’un repère inconnu est refusée', () => {
    const id = identite();
    valeurs(id, 1).push({ repere: 'titre', valeur: 'Frau', adapteDe: L127 });
    expect(fautes(id)).toEqual(['lignes.1.valeurs.2.repere → repère inconnu « titre ».']);
  });

  it('deux valeurs d’un même repère dans une ligne sont refusées', () => {
    const id = identite();
    valeurs(id, 1).push({ repere: 'nom', valeur: 'Linkassniz', adapteDe: L127 });
    expect(fautes(id)).toEqual(['lignes.1.valeurs.2 → « nom » dupliqué : « repere » identifie l’élément dans sa liste, il y est unique.']);
  });

  it('un couple espèce × sexe en double est refusé', () => {
    const id = identite();
    (id.lignes as { espece: string }[])[1].espece = 'humain';
    (id.lignes as { sexe: string }[])[1].sexe = 'M';
    expect(fautes(id).some((f) => f.startsWith('lignes') && f.includes('humain M'))).toBe(true);
  });

  it('une identité sans ancre ni repère est refusée', () => {
    expect(fautes({ ancres: [], reperes: [], lignes: [] })).toEqual([
      'ancres → aucune ancre : une identité en déclare au moins une.',
      'reperes → aucun repère : une identité en déclare au moins un.',
    ]);
  });
});
