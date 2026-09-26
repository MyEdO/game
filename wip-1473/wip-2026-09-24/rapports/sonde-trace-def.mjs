import { z } from 'zod';
const TRACE = Symbol('trace');
const table = z.registry();
const poser = (n, genre, valeur) => {
  const def = { ...n._zod.def, [TRACE]: [...(n._zod.def[TRACE] ?? []), genre] };
  const c = n.clone(def, { parent: true });
  table.add(c, { ...(table.get(c) ?? {}), [genre]: valeur });
  return c;
};
const lire = (n, g) => table.get(n)?.[g];
const trace = (n) => n._zod.def[TRACE] ?? [];
const perdu = (n) => trace(n).filter((g) => lire(n, g) === undefined);
const rapport = (nom, n) => console.log(nom.padEnd(22), 'parent', !!n._zod.parent, '| trace', JSON.stringify(trace(n)), '| perdues', JSON.stringify(perdu(n)));
const e0 = z.enum(['a', 'b', 'c']);
const e = poser(e0, 'enumNomme', { valeurs: { a: 'A' } });
rapport('enum', e); rapport('enum original', e0);
rapport('.extract', e.extract(['a'])); rapport('.exclude', e.exclude(['a']));
rapport('.optional().unwrap', e.optional().unwrap()); rapport('.meta', e.meta({ x: 1 })); rapport('.describe', e.describe('d'));
const o0 = z.strictObject({ a: z.string(), b: z.number() });
const o = poser(o0, 'collection', { forme: 'record' });
rapport('object', o); rapport('object original', o0);
for (const [nom, f] of [['.extend', (x) => x.extend({ c: z.string() })], ['.safeExtend', (x) => x.safeExtend({ c: z.string() })], ['.pick', (x) => x.pick({ a: true })], ['.omit', (x) => x.omit({ a: true })], ['.partial', (x) => x.partial()], ['.required', (x) => x.required()], ['.strip', (x) => x.strip()], ['.catchall', (x) => x.catchall(z.string())], ['.refine', (x) => x.refine(() => true)], ['.meta', (x) => x.meta({ y: 1 })]]) {
  try { rapport(nom, f(o)); } catch (err) { console.log(nom.padEnd(22), 'LÈVE', err.message.slice(0, 80)); }
}
const o2 = poser(o, 'marqueur', { m: 1 });
rapport('deux genres', o2); console.log('lire collection sur o2', JSON.stringify(lire(o2, 'collection')));
const idLeaf = z.string().pipe(z.transform((v) => v));
const f = poser(idLeaf, 'feuilleDId', { type: 'talent' });
rapport('pipe (idDe)', f);
console.log('parse enum', e.parse('a'), '| parse objet', JSON.stringify(o.parse({ a: 'x', b: 1 })));
const shared = z.strictObject({ s: z.number() });
const m = poser(shared, 'collection', { forme: 'record' });
console.log('instance partagée marquée ?', lire(shared, 'collection') !== undefined, '| clone marqué ?', lire(m, 'collection') !== undefined);
