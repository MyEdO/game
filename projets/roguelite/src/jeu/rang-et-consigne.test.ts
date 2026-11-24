import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { poserLesReglesDuRoguelite } from '../noyau';
import {
  avancer,
  charger,
  consigneDe,
  consigner,
  CONSIGNES,
  herosDuGroupe,
  nouvellePartie,
  ordreDEntree,
  partir,
  placer,
  rangDe,
  RANG_DU_ROLE,
  roleDe,
  sauver,
} from './index';

beforeAll(poserLesReglesDuRoguelite);
afterEach(() => { vi.unstubAllGlobals(); });

/** Une sauvegarde en mémoire à la place du stockage du navigateur. */
function memoire() {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } });
}

describe('le rang et la consigne de combat d’un héros (#4959)', () => {
  it('un héros que le joueur n’a pas placé entre au rang du rôle de sa carrière ; ceux qui vont devant entrent en tête', () => {
    const e = nouvellePartie(11);
    for (const h of e.roster) expect(rangDe(h), h.carriere).toBe(RANG_DU_ROLE[roleDe(h.carriere)!]);
    const ordre = ordreDEntree(e.roster).map(rangDe);
    expect(ordre).toEqual([...ordre].sort((a, b) => (a === b ? 0 : a === 'devant' ? -1 : 1)));
  });

  it('le rang et la consigne choisis survivent à la sauvegarde et entrent au combat suivant : la file du noyau suit le rang, le combattant porte la doctrine', () => {
    memoire();
    const e = nouvellePartie(11);
    const [front, ...autres] = ordreDEntree(e.roster);
    const arriere = autres.find((h) => rangDe(h) === 'derriere')!;
    placer(e, front.c.id, 'derriere');
    placer(e, arriere.c.id, 'devant');
    consigner(e, front.c.id, 'tirailleurs');
    sauver(e);
    const lu = charger()!;
    expect(rangDe(lu.roster.find((h) => h.c.id === front.c.id)!)).toBe('derriere');
    expect(consigneDe(lu.roster.find((h) => h.c.id === front.c.id)!)).toBe(CONSIGNES.find((c) => c.doctrine === 'tirailleurs'));

    expect(partir(lu, 'reikwald', lu.roster.map((h) => h.c.id))).toBeNull();
    lu.expedition!.salles[0] = { type: 'combat', ennemis: ['gobelin'], faite: false };
    const recit = avancer(lu)!;
    const pions = recit.combat!.pas[0].pions;
    const y = (id: string) => pions.find((p) => p.id === id)!.y;
    expect(y(arriere.c.id)).toBeLessThan(y(front.c.id));
    const file = ordreDEntree(herosDuGroupe(lu));
    expect(file.map((h) => y(h.c.id))).toEqual(file.map((_, i) => y(file[0].c.id) + i));
    expect(recit.combat!.groupe.find((c) => c.id === front.c.id)!.aiDoctrine).toBe('tirailleurs');
  });

  it('« À son idée » rend la doctrine au noyau, qui la déduit du héros', () => {
    const e = nouvellePartie(11);
    const h = e.roster[0];
    consigner(e, h.c.id, 'soldats');
    consigner(e, h.c.id, null);
    expect(h.c.aiDoctrine).toBeUndefined();
    expect(consigneDe(h)).toBe(CONSIGNES[0]);
  });
});
