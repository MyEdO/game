/**
 * LA FORME ENTIÈRE D'UN ARGUMENT DE VERBE (#3538), jouée par l'hôte texte (`hote.testkit.ts`) : la frontière lit chaque
 * champ d'un argument à sa forme (`lireALaForme`, src/hote/formes.ts), à toute profondeur, celui que le geste crée
 * (`HorsDesignation`) compris. Un brouillon malformé se refuse en `validation`, au chemin de son champ fautif, et rien
 * ne s'écrit ; le noyau ne le reçoit pas.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { fermerLaTable, table, verbe } from './hote.testkit';
import { brouillonComplet } from '../noyau/creation/engagement.testkit';
import type { GesteDeLAgent } from './serveur';

afterEach(fermerLaTable);

/** Le brouillon complet du banc, tel qu'un hôte l'écrit en JSON. */
const complet = (): Record<string, unknown> => JSON.parse(JSON.stringify(brouillonComplet('Témoin')));

/** Le geste joué aux écuries est refusé en `validation`, au message `message`, le fichier intact. */
function refuseALaFrontiere(geste: GesteDeLAgent, message: RegExp): void {
  const t = table();
  expect(t.nouvelle('fenetre-ecuries', { graine: 7 }).erreur).toBeNull();
  const avant = t.fichier();
  const r = t.jouer(geste);
  const texte = r.texte.split('\n  ').join(' ');
  expect(r.erreur, texte).toBe('validation');
  expect(texte).not.toMatch(/a levé/);
  expect(texte).toMatch(message);
  expect(t.fichier(), 'un geste refusé a été écrit au fichier').toBe(avant);
}

describe('un brouillon malformé se refuse à la frontière, au chemin de son champ', () => {
  it('brouillon vide : le champ requis qui manque', { timeout: 120_000 }, () => {
    refuseALaFrontiere(verbe('recruterLeHeros', { brouillon: {} }), /recruterLeHeros : heros\.brouillon\.speciesId manque/);
  });
  it('le membre de l’union que la valeur vise rend son écart : `brouillon` qui n’est pas un objet', { timeout: 120_000 }, () => {
    refuseALaFrontiere(verbe('recruterLeHeros', { brouillon: 3 }), /recruterLeHeros : heros\.brouillon : un objet JSON /);
  });
  it('un id en nombre sous le brouillon : `careerRolls[0].ids[0]`', { timeout: 120_000 }, () => {
    const brouillon = { ...complet(), careerRolls: [{ roll: 3, ids: [1] }] };
    refuseALaFrontiere(verbe('recruterLeHeros', { brouillon }), /heros\.brouillon\.careerRolls\[0\]\.ids\[0\] : une chaîne attendue/);
  });
  it('le brouillon complet passe la frontière', { timeout: 120_000 }, () => {
    const t = table();
    t.nouvelle('fenetre-ecuries', { graine: 7 });
    const r = t.jouer(verbe('recruterLeHeros', { brouillon: complet() }));
    expect(r.erreur, r.texte).not.toBe('validation');
  });
});
