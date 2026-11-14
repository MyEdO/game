# Coop v2 — relay WebSocket : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le transport coop WebRTC (codes copiés/collés, déconnexions à ~1 min) par un
relay WebSocket sur Worker Cloudflare : codes de room à 6 caractères, reconnexion automatique
avec reprise de siège, snapshots compressés, campagne hors snapshots.

**Architecture:** Un Worker + Durable Object « Room » relaie des enveloppes JSON entre l'hôte et
les sièges (aucune logique de jeu côté serveur). Côté client, l'interface `Transport` est
conservée : `RoomHost` démultiplexe l'unique WS hôte en un Transport virtuel par siège,
`RoomGuest` EST un Transport. `session.ts` (hôte-autoritaire/intents/snapshots) reste en place.
Spec : `docs/superpowers/specs/2026-06-12-coop-relay-websocket-design.md`.

**Tech Stack:** Cloudflare Workers + Durable Objects (WebSocket Hibernation API, SQLite-backed),
wrangler v4 ; client Vite/TS existant ; compression `CompressionStream('deflate-raw')` native ;
tests Vitest (FakeSocket/FakeTransport injectés, fake timers).

**Écart volontaire vs spec §5.1** : la compression vit dans la couche relay (`relay.ts`, champ
`z` de l'enveloppe), PAS dans `protocol.ts` — ça garde `serializeMessage`/`parseMessage`
synchrones et `session.ts` intact. Même effet : gros payloads compressés, enveloppe en clair.

**Conventions transverses** (valent pour toutes les tâches) :
- Pas de `window.setTimeout` dans `src/net/` (les tests tournent en env node) — `setTimeout`
  global + `ReturnType<typeof setTimeout>`.
- Messages texte WS uniquement. Liveness : frame littérale `ping` → auto-réponse `pong`
  (jamais du JSON).
- Tout code collé depuis le réseau est une entrée non fiable : parse → `null`/ignore, jamais
  d'exception.
- Commits : un par tâche, sur les seuls fichiers de la tâche (`git commit -- <chemins>`).

---

### Task 1 : logique pure de room (serveur) + inclusion vitest

**Files:**
- Modify: `vite.config.ts` (bloc `test.include`)
- Create: `server/src/roomLogic.ts`
- Test: `server/src/roomLogic.test.ts`

- [ ] **Step 1 : étendre l'include vitest**

Dans `vite.config.ts`, remplacer :

```ts
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
```

par :

```ts
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/src/**/*.test.ts'],
  },
```

- [ ] **Step 2 : écrire le test qui échoue** — `server/src/roomLogic.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, MAX_GUESTS, joinGuest, makeCode, makeToken, resumeGuest, type RoomData } from './roomLogic';

describe('roomLogic (serveur, logique pure)', () => {
  it('makeCode : 6 caractères de l’alphabet sans ambiguïté', () => {
    const code = makeCode(Math.random);
    expect(code).toHaveLength(6);
    for (const c of code) expect(CODE_ALPHABET).toContain(c);
  });

  it('makeToken : 20 caractères, deux tokens diffèrent', () => {
    expect(makeToken(Math.random)).toHaveLength(20);
    expect(makeToken(Math.random)).not.toBe(makeToken(Math.random));
  });

  it('joinGuest : sièges 1..3, nom par défaut, puis pleine', () => {
    const room: RoomData = { hostToken: 'T', seats: [] };
    expect(joinGuest(room, 'Anna', Math.random)?.seat).toBe(1);
    expect(joinGuest(room, 'Bob', Math.random)?.seat).toBe(2);
    expect(joinGuest(room, '  ', Math.random)?.name).toBe('Joueur 4'); // siège 3
    expect(joinGuest(room, 'Dora', Math.random)).toBeNull();
    expect(room.seats).toHaveLength(MAX_GUESTS);
  });

  it('resumeGuest : retrouve le siège par token, null sinon', () => {
    const room: RoomData = { hostToken: 'T', seats: [] };
    const a = joinGuest(room, 'Anna', Math.random)!;
    expect(resumeGuest(room, a.token)?.seat).toBe(1);
    expect(resumeGuest(room, 'inconnu')).toBeNull();
  });

  it('joinGuest : réutilise un siège libéré (départ volontaire)', () => {
    const room: RoomData = { hostToken: 'T', seats: [] };
    joinGuest(room, 'Anna', Math.random);
    joinGuest(room, 'Bob', Math.random);
    room.seats = room.seats.filter((s) => s.seat !== 1); // ctl bye → le DO retire le siège
    expect(joinGuest(room, 'Carl', Math.random)?.seat).toBe(1);
  });
});
```

- [ ] **Step 3 : vérifier l'échec**

Run : `npm test -- server/src/roomLogic.test.ts`
Attendu : FAIL (module `./roomLogic` introuvable).

- [ ] **Step 4 : implémentation** — `server/src/roomLogic.ts`

```ts
/**
 * Logique PURE de room coop (aucune API Cloudflare) : codes, tokens, sièges.
 * Le Durable Object (room.ts) n'est que de la glue WebSocket autour de ce module —
 * c'est CE fichier qui est testé (vitest racine, include server/).
 */
export const MAX_GUESTS = 3; // sièges 1..3 (0 = l'hôte)

/** Alphabet sans ambiguïté (pas de I/L/O/0/1) — 32^6 ≈ 1 milliard de codes. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface SeatInfo {
  seat: number;
  name: string;
  /** Secret de REPRISE : tant que la room vit, ce token ré-attache au même siège. */
  token: string;
}

export interface RoomData {
  hostToken: string;
  seats: SeatInfo[];
}

const pick = (rand: () => number) => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];

export function makeCode(rand: () => number): string {
  return Array.from({ length: 6 }, () => pick(rand)).join('');
}

export function makeToken(rand: () => number): string {
  return Array.from({ length: 20 }, () => pick(rand)).join('');
}

/** Nouvel invité : premier siège libre (1..MAX_GUESTS), ou null si la room est pleine. */
export function joinGuest(room: RoomData, name: string, rand: () => number): SeatInfo | null {
  const taken = new Set(room.seats.map((s) => s.seat));
  let seat = 0;
  for (let i = 1; i <= MAX_GUESTS; i++) {
    if (!taken.has(i)) { seat = i; break; }
  }
  if (!seat) return null;
  const info: SeatInfo = { seat, name: name.trim() || `Joueur ${seat + 1}`, token: makeToken(rand) };
  room.seats.push(info);
  return info;
}

/** Reprise : retrouve le siège par token (room vivante = token valable, cf. spec §6). */
export function resumeGuest(room: RoomData, token: string): SeatInfo | null {
  return room.seats.find((s) => s.token === token) ?? null;
}
```

- [ ] **Step 5 : vérifier le vert + la suite complète**

Run : `npm test -- server/src/roomLogic.test.ts` → PASS (5 tests).
Run : `npm test` → tout vert (l'include élargi ne casse rien).

- [ ] **Step 6 : commit**

```bash
git add vite.config.ts server/src/roomLogic.ts server/src/roomLogic.test.ts
git commit -m "feat(coop): logique pure de room du relay (codes 6 chars, sièges, tokens de reprise)" -- vite.config.ts server/src/roomLogic.ts server/src/roomLogic.test.ts
```

---

### Task 2 : Worker Cloudflare (Durable Object + routes)

**Files:**
- Create: `server/src/room.ts`, `server/src/index.ts`, `server/wrangler.jsonc`,
  `server/tsconfig.json`, `server/package.json`, `server/.gitignore`
- Modify: `package.json` (scripts racine)

Pas de TDD ici : le DO est de la glue fine sur `roomLogic` (testé en Task 1) ; recette manuelle
via `wrangler dev` en Task 10.

- [ ] **Step 1 : `server/package.json`**

```json
{
  "name": "w4-coop-relay",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260601.0",
    "typescript": "^5.6.3",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2 : `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3 : `server/wrangler.jsonc`**

```jsonc
{
  "name": "w4-coop-relay",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-01",
  "durable_objects": {
    "bindings": [{ "name": "ROOM", "class_name": "Room" }]
  },
  // SQLite-backed obligatoire sur le plan gratuit.
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]
}
```

- [ ] **Step 4 : `server/.gitignore`**

```
node_modules/
.wrangler/
```

- [ ] **Step 5 : le Durable Object** — `server/src/room.ts`

```ts
/**
 * Durable Object « Room » — UN par partie coop. Pur RELAIS : il route des enveloppes JSON
 * entre l'hôte et les sièges sans jamais lire le contenu de jeu (champs data/z opaques).
 * Hibernation API : ne consomme de la durée que pendant le routage. TTL par alarme.
 *
 * Enveloppes (spec §3) :
 *   invité → DO : { data?, z? } | { ctl: 'bye' }
 *   DO → hôte   : { from, data?, z? } | { evt: 'join'|'resume', seat, name } | { evt: 'gone', seat }
 *   hôte → DO   : { to: seat, data?, z? } | { ctl: 'bye' }
 *   DO → invité : { evt: 'seated', seat, token } | { evt: 'host-down'|'host-up' } | { data?, z? }
 * Liveness : frame texte littérale 'ping' → auto-réponse 'pong' (sans réveiller le DO).
 */
import { joinGuest, makeToken, resumeGuest, type RoomData } from './roomLogic';

const TTL_MS = 30 * 60_000;

type Attachment = { role: 'host' } | { role: 'guest'; seat: number };

export class Room {
  constructor(private readonly state: DurableObjectState) {}

  private async room(): Promise<RoomData | null> {
    return ((await this.state.storage.get('room')) as RoomData | undefined) ?? null;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/init') {
      if (await this.room()) return new Response('exists', { status: 409 });
      const hostToken = makeToken(Math.random);
      await this.state.storage.put('room', { hostToken, seats: [] } satisfies RoomData);
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return Response.json({ hostToken });
    }
    if (req.headers.get('Upgrade') === 'websocket') return this.upgrade(url);
    return new Response('not found', { status: 404 });
  }

  /** Refus PROPRE : accepter le WS puis fermer avec un code 4xxx lisible côté client
   *  (un refus HTTP serait un onclose 1006 indistinguable d'une panne réseau). */
  private refuse(code: number, reason: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.close(code, reason);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async upgrade(url: URL): Promise<Response> {
    const room = await this.room();
    if (!room) return this.refuse(4404, 'Partie inconnue ou expirée.');
    const role = url.searchParams.get('role');
    const token = url.searchParams.get('token') ?? '';
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (role === 'host') {
      if (token !== room.hostToken) return this.refuse(4403, 'Token hôte invalide.');
      for (const ws of this.state.getWebSockets('host')) ws.close(4001, 'remplacé');
      this.state.acceptWebSocket(server, ['host']);
      server.serializeAttachment({ role: 'host' } satisfies Attachment);
      this.broadcastGuests({ evt: 'host-up' });
      // Reprise d'hôte : lui re-signaler les sièges encore connectés.
      for (const s of room.seats) {
        if (this.guestSocket(s.seat)) server.send(JSON.stringify({ evt: 'resume', seat: s.seat, name: s.name }));
      }
    } else {
      let info = token ? resumeGuest(room, token) : null;
      const isResume = info != null;
      if (!info) {
        info = joinGuest(room, url.searchParams.get('name') ?? '', Math.random);
        if (!info) return this.refuse(4409, 'Partie pleine.');
        await this.state.storage.put('room', room);
      }
      for (const ws of this.state.getWebSockets(`seat-${info.seat}`)) ws.close(4001, 'remplacé');
      this.state.acceptWebSocket(server, [`seat-${info.seat}`]);
      server.serializeAttachment({ role: 'guest', seat: info.seat } satisfies Attachment);
      server.send(JSON.stringify({ evt: 'seated', seat: info.seat, token: info.token }));
      this.hostSocket()?.send(JSON.stringify({ evt: isResume ? 'resume' : 'join', seat: info.seat, name: info.name }));
      if (!this.hostSocket()) server.send(JSON.stringify({ evt: 'host-down' }));
    }
    await this.state.storage.setAlarm(Date.now() + TTL_MS); // activité → TTL repoussé
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (typeof message !== 'string') return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    let env: Record<string, unknown>;
    try { env = JSON.parse(message) as Record<string, unknown>; } catch { return; }

    if (att.role === 'host') {
      if (env.ctl === 'bye') { this.closeAll(4000, 'Partie fermée par l’hôte.'); await this.state.storage.deleteAll(); return; }
      if (typeof env.to !== 'number') return;
      this.guestSocket(env.to)?.send(JSON.stringify({ data: env.data, z: env.z }));
      return;
    }
    // invité
    if (env.ctl === 'bye') {
      const room = await this.room();
      if (room) {
        room.seats = room.seats.filter((s) => s.seat !== att.seat); // siège libéré pour de bon
        await this.state.storage.put('room', room);
      }
      ws.close(1000, 'bye');
      return;
    }
    this.hostSocket()?.send(JSON.stringify({ from: att.seat, data: env.data, z: env.z }));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    // Un WS « remplacé » (reprise) ferme APRÈS l'arrivée du nouveau : ne signaler l'absence
    // que s'il ne reste AUCUNE connexion pour ce rôle/siège (sinon faux `gone` → fausse grace).
    if (att?.role === 'host') {
      if (!this.hostSocket()) this.broadcastGuests({ evt: 'host-down' });
    } else if (att?.role === 'guest') {
      if (!this.guestSocket(att.seat)) this.hostSocket()?.send(JSON.stringify({ evt: 'gone', seat: att.seat }));
    }
  }

  async alarm(): Promise<void> {
    if (this.state.getWebSockets().length > 0) {
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return;
    }
    this.closeAll(4000, 'Partie expirée.');
    await this.state.storage.deleteAll();
  }

  private hostSocket(): WebSocket | null {
    return this.state.getWebSockets('host')[0] ?? null;
  }
  private guestSocket(seat: number): WebSocket | null {
    return this.state.getWebSockets(`seat-${seat}`)[0] ?? null;
  }
  private broadcastGuests(env: unknown): void {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.role === 'guest') ws.send(JSON.stringify(env));
    }
  }
  private closeAll(code: number, reason: string): void {
    for (const ws of this.state.getWebSockets()) ws.close(code, reason);
  }
}
```

- [ ] **Step 6 : le Worker** — `server/src/index.ts`

```ts
/**
 * Worker relay coop : POST /rooms crée une room (code 6 chars + token hôte),
 * GET /room/:code (upgrade WS) route vers le Durable Object de la room.
 */
import { makeCode } from './roomLogic';
export { Room } from './room';

interface Env {
  ROOM: DurableObjectNamespace;
}

// Le jeu est servi depuis cgauche.github.io → le POST cross-origin a besoin de CORS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (req.method === 'POST' && url.pathname === '/rooms') {
      for (let i = 0; i < 5; i++) {
        const code = makeCode(Math.random);
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const res = await stub.fetch('https://do/init', { method: 'POST' });
        if (res.ok) {
          const { hostToken } = (await res.json()) as { hostToken: string };
          return Response.json({ code, hostToken }, { headers: CORS });
        }
        // 409 = collision de code (room existante) → on retire
      }
      return new Response('service occupé, réessayez', { status: 503, headers: CORS });
    }

    const m = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/);
    if (m && req.headers.get('Upgrade') === 'websocket') {
      const stub = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return stub.fetch(req);
    }
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 7 : scripts racine** — dans `package.json` (racine), ajouter aux `scripts` :

```json
    "relay:dev": "npm --prefix server run dev",
    "relay:deploy": "npm --prefix server run deploy",
```

- [ ] **Step 8 : installer + typecheck serveur**

```bash
cd server && npm install && npm run typecheck
```
Attendu : 0 erreur TS. (Si `npm run lint` racine râle sur `server/`, ajouter `'server/**'`
aux `ignores` de `eslint.config.js` — le typecheck serveur couvre déjà ces fichiers.)

- [ ] **Step 9 : smoke test wrangler dev**

```bash
cd server && npx wrangler dev
# autre terminal :
curl -X POST http://localhost:8787/rooms
```
Attendu : `{"code":"XXXXXX","hostToken":"…"}`. Arrêter wrangler.

- [ ] **Step 10 : commit**

```bash
git add server package.json
git commit -m "feat(coop): Worker Cloudflare relay — DO Room (hibernation WS, TTL 30 min, refus 4xxx propres)" -- server package.json
```

---

### Task 3 : compression des payloads (`compress.ts`)

**Files:**
- Create: `src/net/compress.ts`
- Test: `src/net/compress.test.ts`

(La machinerie vient de `codes.ts` — qui reste en place jusqu'à la Task 9 ; duplication
temporaire assumée, `codes.ts` meurt avec le WebRTC.)

- [ ] **Step 1 : test qui échoue** — `src/net/compress.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { deflateB64, inflateB64 } from './compress';

describe('compress (deflate-raw + base64url)', () => {
  it('round-trip : texte → compressé → texte identique', async () => {
    const text = JSON.stringify({ party: Array.from({ length: 50 }, (_, i) => ({ id: `h${i}`, pv: 12 })) });
    expect(await inflateB64(await deflateB64(text))).toBe(text);
  });

  it('compresse réellement du JSON répétitif', async () => {
    const text = JSON.stringify(Array.from({ length: 200 }, () => ({ kind: 'snapshot', gameTime: 123456 })));
    expect((await deflateB64(text)).length).toBeLessThan(text.length / 5);
  });

  it('entrée corrompue → null, jamais d’exception', async () => {
    expect(await inflateB64('%%%pas-du-base64%%%')).toBeNull();
    expect(await inflateB64('AAAA')).toBeNull(); // base64 valide, deflate invalide
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test -- src/net/compress.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémentation** — `src/net/compress.ts`

```ts
/**
 * Compression des payloads coop v2 : deflate-raw natif (CompressionStream, zéro dépendance)
 * + base64url. Les snapshots/campagne (~10:1 sur du JSON d'état) voyagent en champ `z` des
 * enveloppes relay — l'enveloppe elle-même reste en clair pour le routage par le DO.
 */
async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function deflateB64(text: string): Promise<string> {
  const deflated = await pipeThrough(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  return toBase64Url(deflated);
}

/** Base64url collé du réseau → texte, ou null (entrée non fiable). */
export async function inflateB64(b64: string): Promise<string | null> {
  const bytes = fromBase64Url(b64);
  if (!bytes || !bytes.length) return null;
  try {
    const inflated = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(inflated);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4 : vérifier le vert**

Run : `npm test -- src/net/compress.test.ts` → PASS (3 tests).

- [ ] **Step 5 : commit**

```bash
git add src/net/compress.ts src/net/compress.test.ts
git commit -m "feat(coop): compression deflate-raw+base64url des payloads relay" -- src/net/compress.ts src/net/compress.test.ts
```

---

### Task 4 : message `campaign` dans le protocole

**Files:**
- Modify: `src/net/protocol.ts`
- Test: `src/net/protocol.test.ts`

- [ ] **Step 1 : test qui échoue** — ajouter à `src/net/protocol.test.ts` :

```ts
  it('campaign : projet de campagne transféré une fois au join (spec coop v2 §5)', () => {
    const m = parseMessage(serializeMessage({
      kind: 'campaign', name: 'Arène', scenes: [{ id: 's1' }], startSceneId: 's1', worldMap: null,
    }));
    expect(m).toEqual({ kind: 'campaign', name: 'Arène', scenes: [{ id: 's1' }], startSceneId: 's1', worldMap: null });
    expect(parseMessage('{"kind":"campaign","name":"X"}')).toBeNull(); // scenes/startSceneId manquants
  });
```

(Adapter les imports du fichier si `serializeMessage`/`parseMessage` n'y sont pas déjà importés.)

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test -- src/net/protocol.test.ts` → FAIL.

- [ ] **Step 3 : implémentation** — dans `src/net/protocol.ts` :

Ajouter au type `NetMessage` :

```ts
  | { kind: 'campaign'; name: string; scenes: unknown[]; startSceneId: string; worldMap: unknown }
```

Ajouter au `switch` de `parseMessage` (avant `default`) :

```ts
    case 'campaign':
      return typeof m.name === 'string' && Array.isArray(m.scenes) && typeof m.startSceneId === 'string'
        ? { kind: 'campaign', name: m.name, scenes: m.scenes, startSceneId: m.startSceneId, worldMap: m.worldMap ?? null }
        : null;
```

- [ ] **Step 4 : vérifier le vert**

Run : `npm test -- src/net/protocol.test.ts` → PASS.

- [ ] **Step 5 : commit**

```bash
git add src/net/protocol.ts src/net/protocol.test.ts
git commit -m "feat(coop): message campaign — le projet custom voyage une fois au join, hors snapshots" -- src/net/protocol.ts src/net/protocol.test.ts
```

---

### Task 5 : couche relay client (`relay.ts`)

**Files:**
- Create: `src/net/relay.ts`
- Test: `src/net/relay.test.ts`

- [ ] **Step 1 : tests qui échouent** — `src/net/relay.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayClient, RoomGuest, RoomHost, type SocketLike } from './relay';
import { inflateB64 } from './compress';

class FakeSocket implements SocketLike {
  static last: FakeSocket | null = null;
  sent: string[] = [];
  closedWith: { code?: number } | null = null;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(d: string): void {
    this.sent.push(d);
  }
  close(code?: number, reason?: string): void {
    this.closedWith = { code };
    this.onclose?.({ code: code ?? 1005, reason: reason ?? '' });
  }
  // helpers de test (côté « serveur ») :
  open(): void {
    this.onopen?.();
  }
  receive(d: string): void {
    this.onmessage?.({ data: d });
  }
  dropFromServer(code = 1006, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

const makeSocket = (url: string) => new FakeSocket(url);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RelayClient (heartbeat + reconnexion)', () => {
  it('ping toutes les 10 s ; silence > 25 s → fermeture puis reconnexion à backoff', () => {
    const states: string[] = [];
    new RelayClient({ url: () => 'ws://x/room/ABC234?role=host&token=T', makeSocket, onEnvelope: () => {}, onState: (s) => states.push(s) });
    const first = FakeSocket.last!;
    first.open();
    vi.advanceTimersByTime(10_000);
    expect(first.sent).toContain('ping');
    first.receive('pong'); // vivant
    vi.advanceTimersByTime(30_000); // plus aucun pong → le client coupe lui-même
    expect(first.closedWith).not.toBeNull();
    expect(states).toContain('reconnecting');
    vi.advanceTimersByTime(1_000); // 1er retry
    expect(FakeSocket.last).not.toBe(first);
  });

  it('fermeture 4xxx du DO → fatale (raison remontée, AUCUNE reconnexion)', () => {
    const fatal = vi.fn();
    new RelayClient({ url: () => 'ws://x', makeSocket, onEnvelope: () => {}, onFatal: fatal });
    const ws = FakeSocket.last!;
    ws.open();
    ws.dropFromServer(4404, 'Partie inconnue ou expirée.');
    expect(fatal).toHaveBeenCalledWith('Partie inconnue ou expirée.');
    const same = FakeSocket.last;
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.last).toBe(same); // pas de nouvelle socket
  });
});

describe('RoomHost (démultiplexage par siège)', () => {
  it('join/gone remontent ; les enveloppes {from} sont routées au bon Transport virtuel', async () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    const ws = FakeSocket.last!;
    const onJoin = vi.fn();
    rh.onJoin = onJoin;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
    expect(onJoin).toHaveBeenCalledWith(1, 'Anna');
    const t1 = rh.seatTransport(1);
    const got: string[] = [];
    t1.onMessage((d) => got.push(d));
    ws.receive(JSON.stringify({ from: 1, data: 'BONJOUR' }));
    await rh.idle();
    expect(got).toEqual(['BONJOUR']);
    t1.send('SALUT');
    await rh.idle();
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ to: 1, data: 'SALUT' });
  });

  it('gros payload → champ z compressé, restituable', async () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    const ws = FakeSocket.last!;
    ws.open();
    const t1 = rh.seatTransport(1);
    const big = JSON.stringify({ blob: 'x'.repeat(5000) });
    t1.send(big);
    await rh.idle();
    const env = JSON.parse(ws.sent.at(-1)!) as { to: number; z?: string; data?: string };
    expect(env.data).toBeUndefined();
    expect(await inflateB64(env.z!)).toBe(big);
  });

  it('closeSeat déclenche le onClose du transport virtuel (fin de grace)', () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    FakeSocket.last!.open();
    const t1 = rh.seatTransport(1);
    const closed = vi.fn();
    t1.onClose(closed);
    rh.closeSeat(1);
    expect(closed).toHaveBeenCalled();
  });
});

describe('RoomGuest (Transport + reprise)', () => {
  it('seated capture siège+token ; reconnexion → URL avec token + onReconnected', () => {
    const rg = new RoomGuest('ABC234', 'Anna', makeSocket);
    const first = FakeSocket.last!;
    expect(first.url).toContain('name=Anna');
    const reconnected = vi.fn();
    rg.onReconnected = reconnected;
    first.open();
    first.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK22' }));
    expect(rg.seat).toBe(2);
    first.dropFromServer(1006);
    vi.advanceTimersByTime(1_000);
    const second = FakeSocket.last!;
    expect(second).not.toBe(first);
    expect(second.url).toContain('token=TOK22'); // reprise, plus de name=
    second.open();
    expect(reconnected).toHaveBeenCalled();
  });

  it('délivre data, et close() envoie ctl bye', async () => {
    const rg = new RoomGuest('ABC234', 'Anna', makeSocket);
    const ws = FakeSocket.last!;
    ws.open();
    const got: string[] = [];
    rg.onMessage((d) => got.push(d));
    ws.receive(JSON.stringify({ data: 'COUCOU' }));
    await rg.idle();
    expect(got).toEqual(['COUCOU']);
    rg.close();
    expect(ws.sent).toContain(JSON.stringify({ ctl: 'bye' }));
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test -- src/net/relay.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémentation** — `src/net/relay.ts`

```ts
/**
 * Couche relay coop v2 (remplace le WebRTC) : connexion WebSocket au Worker Cloudflare
 * (`server/`), heartbeat + reconnexion à backoff avec reprise de siège par token, et
 * compression des gros payloads (champ `z` — l'enveloppe reste en clair pour le routage).
 *
 * - `RelayClient`  : une connexion WS robuste (ping/pong, retry, fermetures 4xxx fatales).
 * - `RoomHost`     : démultiplexe l'unique WS hôte en un Transport VIRTUEL par siège —
 *                    `session.ts::addGuest` les consomme sans rien savoir du relay.
 * - `RoomGuest`    : EST un Transport (côté invité).
 * L'ordre des messages est préservé malgré la compression async : chaînes send/recv.
 */
import type { Transport } from './transport';
import { deflateB64, inflateB64 } from './compress';

/** URL de PROD du Worker — à remplacer après le premier `npm run relay:deploy` (Task 11). */
export const RELAY_URL_PROD = 'https://w4-coop-relay.A-REMPLACER.workers.dev';

export function relayHttpUrl(): string {
  return (import.meta.env?.VITE_RELAY_URL as string | undefined) ?? RELAY_URL_PROD;
}

export function roomWsUrl(code: string, params: Record<string, string>): string {
  const base = relayHttpUrl().replace(/^http/, 'ws');
  return `${base}/room/${code}?${new URLSearchParams(params).toString()}`;
}

/** Seuil de compression ; en dessous, le JSON part en clair (champ data). */
const COMPRESS_MIN = 2048;
/** Limite Cloudflare par message WS (1 Mio) — refus explicite, jamais de fermeture muette. */
const WS_MAX = 1_000_000;
const PING_MS = 10_000;
const PONG_TIMEOUT_MS = 25_000;
const RETRY_MAX_MS = 120_000;

export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  bufferedAmount?: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number; reason: string }) => void) | null;
  onerror: (() => void) | null;
}
export type MakeSocket = (url: string) => SocketLike;
export type ConnState = 'connecting' | 'ok' | 'reconnecting' | 'lost';

export interface RelayOpts {
  /** URL recalculée à CHAQUE tentative — permet d'ajouter le token de reprise. */
  url: () => string;
  makeSocket?: MakeSocket;
  onEnvelope: (env: Record<string, unknown>) => void;
  onState?: (s: ConnState) => void;
  /** Fermetures DÉFINITIVES : code 4xxx du DO (room inconnue/pleine/fermée) ou retry épuisé. */
  onFatal?: (reason: string) => void;
}

export class RelayClient {
  state: ConnState = 'connecting';
  private ws: SocketLike | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPong = 0;
  private retryDelay = 1000;
  private retryStart = 0;
  private closed = false;

  constructor(private readonly opts: RelayOpts) {
    this.open();
  }

  private setState(s: ConnState): void {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState?.(s);
  }

  private stopPing(): void {
    if (this.pingTimer != null) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private open(): void {
    const make = this.opts.makeSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
    const ws = make(this.opts.url());
    this.ws = ws;
    ws.onopen = () => {
      this.lastPong = Date.now();
      this.retryDelay = 1000;
      this.retryStart = 0;
      this.setState('ok');
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastPong > PONG_TIMEOUT_MS) {
          ws.close(); // demi-mort (NAT, veille…) → on coupe franchement, le retry reprend
          return;
        }
        ws.send('ping');
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      if (typeof e.data !== 'string') return;
      let env: Record<string, unknown>;
      try {
        env = JSON.parse(e.data) as Record<string, unknown>;
      } catch {
        return;
      }
      this.opts.onEnvelope(env);
    };
    ws.onclose = (e) => {
      this.stopPing();
      this.ws = null;
      if (this.closed) return;
      if (e.code >= 4000) {
        this.setState('lost');
        this.opts.onFatal?.(e.reason || 'Connexion refusée.');
        return;
      }
      this.scheduleRetry();
    };
    ws.onerror = () => {
      /* onclose suit toujours */
    };
  }

  private scheduleRetry(): void {
    if (this.retryStart === 0) this.retryStart = Date.now();
    if (Date.now() - this.retryStart > RETRY_MAX_MS) {
      this.setState('lost');
      this.opts.onFatal?.('Connexion perdue.');
      return;
    }
    this.setState('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
  }

  sendRaw(text: string): void {
    if (this.state === 'ok') this.ws?.send(text);
  }

  buffered(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPing();
    if (this.retryTimer != null) clearTimeout(this.retryTimer);
    this.ws?.close(1000, 'bye');
  }
}

/** Enveloppe un payload : clair si petit, compressé (`z`) sinon ; null si > 1 Mio (refus loggé). */
async function packed(to: number | null, data: string): Promise<Record<string, unknown> | null> {
  const env: Record<string, unknown> = to == null ? {} : { to };
  if (data.length < COMPRESS_MIN) return { ...env, data };
  const z = await deflateB64(data);
  if (z.length > WS_MAX) {
    console.error(`[coop] message trop volumineux (${z.length} o compressés > 1 Mio) — non envoyé`);
    return null;
  }
  return { ...env, z };
}

/** Transport virtuel d'un siège côté hôte (recréé après la grace par netFlow). */
class VirtualSeat implements Transport {
  private msgCb: ((d: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  constructor(
    private readonly seat: number,
    private readonly out: (seat: number, data: string) => void,
  ) {}
  send(data: string): void {
    this.out(this.seat, data);
  }
  onMessage(cb: (d: string) => void): void {
    this.msgCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  close(): void {
    this.fireClose();
  }
  deliver(d: string): void {
    this.msgCb?.(d);
  }
  fireClose(): void {
    this.closeCb?.();
  }
}

export class RoomHost {
  readonly relay: RelayClient;
  onJoin: ((seat: number, name: string) => void) | null = null;
  onResume: ((seat: number, name: string) => void) | null = null;
  onGone: ((seat: number) => void) | null = null;
  onFatal: ((reason: string) => void) | null = null;
  onConnState: ((s: ConnState) => void) | null = null;
  private readonly transports = new Map<number, VirtualSeat>();
  private sendChain: Promise<void> = Promise.resolve();
  private recvChain: Promise<void> = Promise.resolve();

  constructor(code: string, hostToken: string, makeSocket?: MakeSocket) {
    this.relay = new RelayClient({
      url: () => roomWsUrl(code, { role: 'host', token: hostToken }),
      makeSocket,
      onEnvelope: (env) => this.handle(env),
      onState: (s) => this.onConnState?.(s),
      onFatal: (reason) => this.onFatal?.(reason),
    });
  }

  private handle(env: Record<string, unknown>): void {
    if (env.evt === 'join') { this.onJoin?.(Number(env.seat), String(env.name ?? '')); return; }
    if (env.evt === 'resume') { this.onResume?.(Number(env.seat), String(env.name ?? '')); return; }
    if (env.evt === 'gone') { this.onGone?.(Number(env.seat)); return; }
    if (typeof env.from !== 'number') return;
    // Décompression SÉQUENTIELLE : l'ordre des messages d'un siège doit être préservé.
    this.recvChain = this.recvChain.then(async () => {
      const text = typeof env.z === 'string' ? await inflateB64(env.z) : typeof env.data === 'string' ? env.data : null;
      if (text != null) this.transports.get(env.from as number)?.deliver(text);
    });
  }

  /** Transport virtuel d'un siège — donné à `session.addGuest(t, seat)`. */
  seatTransport(seat: number): Transport {
    const t = new VirtualSeat(seat, (s, data) => {
      // Compression + envoi SÉQUENTIELS : un petit message ne doit pas doubler un gros en cours.
      this.sendChain = this.sendChain.then(async () => {
        const env = await packed(s, data);
        if (env) this.relay.sendRaw(JSON.stringify(env));
      });
    });
    this.transports.set(seat, t);
    return t;
  }

  /** Fin de grace : ferme le transport virtuel → `onSeatClosed` côté session. */
  closeSeat(seat: number): void {
    this.transports.get(seat)?.fireClose();
    this.transports.delete(seat);
  }

  /** Tests : attendre la fin des chaînes async (compression). */
  async idle(): Promise<void> {
    await this.sendChain;
    await this.recvChain;
  }

  close(): void {
    this.relay.sendRaw(JSON.stringify({ ctl: 'bye' })); // le DO ferme la room pour tout le monde
    this.relay.close();
  }
}

export class RoomGuest implements Transport {
  readonly relay: RelayClient;
  seat = 0;
  token = '';
  onSeated: ((seat: number) => void) | null = null;
  onFatal: ((reason: string) => void) | null = null;
  onReconnected: (() => void) | null = null;
  onHostAway: ((away: boolean) => void) | null = null;
  onConnState: ((s: ConnState) => void) | null = null;
  private msgCb: ((d: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private sendChain: Promise<void> = Promise.resolve();
  private recvChain: Promise<void> = Promise.resolve();
  private wasReconnecting = false;

  constructor(code: string, name: string, makeSocket?: MakeSocket, resumeToken?: string) {
    if (resumeToken) this.token = resumeToken;
    this.relay = new RelayClient({
      // Token connu (reprise/reload) → resume ; sinon nouveau join nominatif.
      url: () => roomWsUrl(code, this.token ? { role: 'guest', token: this.token } : { role: 'guest', name }),
      makeSocket,
      onEnvelope: (env) => this.handle(env),
      onState: (s) => {
        this.onConnState?.(s);
        if (s === 'reconnecting') this.wasReconnecting = true;
        if (s === 'ok' && this.wasReconnecting) {
          this.wasReconnecting = false;
          this.onReconnected?.();
        }
        if (s === 'lost') this.closeCb?.();
      },
      onFatal: (reason) => this.onFatal?.(reason),
    });
  }

  private handle(env: Record<string, unknown>): void {
    if (env.evt === 'seated') {
      this.seat = Number(env.seat);
      this.token = String(env.token ?? '');
      this.onSeated?.(this.seat);
      return;
    }
    if (env.evt === 'host-down') { this.onHostAway?.(true); return; }
    if (env.evt === 'host-up') { this.onHostAway?.(false); return; }
    this.recvChain = this.recvChain.then(async () => {
      const text = typeof env.z === 'string' ? await inflateB64(env.z) : typeof env.data === 'string' ? env.data : null;
      if (text != null) this.msgCb?.(text);
    });
  }

  send(data: string): void {
    this.sendChain = this.sendChain.then(async () => {
      const env = await packed(null, data);
      if (env) this.relay.sendRaw(JSON.stringify(env));
    });
  }
  onMessage(cb: (d: string) => void): void {
    this.msgCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  /** Tests : attendre la fin des chaînes async (compression). */
  async idle(): Promise<void> {
    await this.sendChain;
    await this.recvChain;
  }
  close(): void {
    this.relay.sendRaw(JSON.stringify({ ctl: 'bye' })); // libère le siège côté DO
    this.relay.close();
  }
}
```

- [ ] **Step 4 : vérifier le vert**

Run : `npm test -- src/net/relay.test.ts` → PASS (7 tests). Si un test de compression reste
en attente, vérifier que l'assertion est bien APRÈS `await rh.idle()` / `await rg.idle()`.

- [ ] **Step 5 : commit**

```bash
git add src/net/relay.ts src/net/relay.test.ts
git commit -m "feat(coop): couche relay client — RelayClient (heartbeat/backoff), RoomHost (transports virtuels par siège), RoomGuest" -- src/net/relay.ts src/net/relay.test.ts
```

---

### Task 6 : adaptations de `session.ts` (siège injecté, extras au join, rejoin)

**Files:**
- Modify: `src/net/session.ts`, `src/state/netFlow.ts` (1 ligne), `src/net/session.test.ts`

- [ ] **Step 1 : tests qui échouent** — dans `src/net/session.test.ts` :

a) le helper `wire` et tous les appels `host.addGuest(a)` passent le siège explicitement :

```ts
const wire = (host: HostSession, name = 'Invité', seat = 1) => {
  const [a, b] = FakeTransport.pair();
  const guest = new GuestSession({ build: 'test', name, applySnapshot: vi.fn() });
  host.addGuest(a, seat);
  guest.connect(b);
  return { guest, seat };
};
```

— dans les tests existants : `const seat = host.addGuest(a)` devient `const seat = 1;
host.addGuest(a, seat);` ; le test « broadcastSnapshot » passe `host.addGuest(a1, 1)` et
`host.addGuest(a2, 2)`.

b) ajouter deux tests :

```ts
  it('extraJoinMessages : envoyés entre hello et snapshot (campagne avant le 1er état)', () => {
    const order: string[] = [];
    const host = new HostSession({
      build: 'test',
      allow: new Set(),
      applyIntent: vi.fn(),
      getSnapshot: () => ({ gameTime: 1 }),
      extraJoinMessages: () => [{ kind: 'campaign', name: 'P', scenes: [], startSceneId: 's', worldMap: null }],
    });
    const [a, b] = FakeTransport.pair();
    host.addGuest(a, 1);
    const guest = new GuestSession({
      build: 'test',
      name: 'A',
      applySnapshot: () => order.push('snapshot'),
      onCampaign: () => order.push('campaign'),
    });
    guest.connect(b);
    expect(order).toEqual(['campaign', 'snapshot']);
  });

  it('rejoin : re-handshake après reconnexion → l’hôte renvoie un snapshot complet', () => {
    const { host } = mkHost();
    const applySnapshot = vi.fn();
    const [a, b] = FakeTransport.pair();
    const guest = new GuestSession({ build: 'test', name: 'A', applySnapshot });
    host.addGuest(a, 1);
    guest.connect(b);
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    guest.rejoin();
    expect(applySnapshot).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npm test -- src/net/session.test.ts` → FAIL (signatures).

- [ ] **Step 3 : implémentation** — `src/net/session.ts` :

a) `HostSession` : supprimer `private nextSeat = 1;` ; ajouter aux opts :

```ts
      /** Envoyés au handshake ENTRE hello et snapshot (ex. la campagne custom — spec v2 §5). */
      extraJoinMessages?: () => NetMessage[];
```

b) `addGuest` prend le siège (attribué par le Durable Object) :

```ts
  /** Branche le transport d'un invité sur le siège attribué par la room (DO). */
  addGuest(transport: Transport, seat: number): void {
```

(supprimer `const seat = this.nextSeat++;` et le `return seat;` final ; type de retour `void`).
Dans le handler `hello`, entre l'envoi du hello et celui du snapshot, insérer :

```ts
        for (const extra of this.opts.extraJoinMessages?.() ?? []) transport.send(serializeMessage(extra));
```

c) factoriser la diffusion :

```ts
  /** Diffuse un message à tous les sièges connectés. */
  broadcast(m: NetMessage): void {
    const msg = serializeMessage(m);
    for (const s of Object.values(this.seats)) s.transport.send(msg);
  }

  /** Diffuse l'état autoritaire à tous les sièges connectés. */
  broadcastSnapshot(data: Record<string, unknown>): void {
    this.broadcast({ kind: 'snapshot', data });
  }
```

d) `GuestSession` : opts gagne `onCampaign?: (m: Extract<NetMessage, { kind: 'campaign' }>) => void;` ;
dans le handler de `connect`, ajouter (après le cas `snapshot`) :

```ts
      if (m.kind === 'campaign') {
        this.opts.onCampaign?.(m);
        return;
      }
```

e) extraire l'envoi du hello et exposer la reprise :

```ts
  private sayHello(): void {
    this.transport?.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: this.opts.build, name: this.opts.name }));
  }

  /** Reprise après reconnexion : re-handshake — l'hôte répond hello + extras + snapshot. */
  rejoin(): void {
    this.sayHello();
  }
```

(`connect` se termine par `this.sayHello();` au lieu du send inline.)

f) le point d'appel v1 dans `src/state/netFlow.ts` (sera réécrit en Task 7, mais le build doit
rester vert) : `host.addGuest(channelTransport(inv.channel) as Transport);` devient
`host.addGuest(channelTransport(inv.channel) as Transport, payload.seat);`.

- [ ] **Step 4 : vérifier le vert**

Run : `npm test -- src/net/session.test.ts` → PASS. Puis `npm run typecheck` → 0 erreur.

- [ ] **Step 5 : commit**

```bash
git add src/net/session.ts src/net/session.test.ts src/state/netFlow.ts
git commit -m "feat(coop): session — siège injecté par la room, extras au handshake (campagne), rejoin de reprise" -- src/net/session.ts src/net/session.test.ts src/state/netFlow.ts
```

---

### Task 7 : `netFlow` v2 + NetState + store (suppression invite/réponse)

**Files:**
- Modify: `src/state/netFlow.ts` (réécriture des sections réseau), `src/state/store.ts`
  (types + wiring + export `registerScene`), `src/ui/CoopPanels.tsx`, `src/ui/CoopLobby.tsx`
  (adaptation minimale pour rester vert — l'UX produit arrive en Task 8)

- [ ] **Step 1 : exporter `registerScene`** — `src/state/store.ts` ligne ~133 :
`function registerScene(s: Scene)` → `export function registerScene(s: Scene)`.

- [ ] **Step 2 : NetState v2** — dans `src/state/netFlow.ts`, remplacer l'interface et l'init :

```ts
/** État réseau SÉRIALISABLE (dans GameState). `ownership` : heroId → siège (0 = hôte).
 *  `slots` : siège attribué à chacun des 4 emplacements de l'écran d'équipe (0 = hôte). */
export interface NetState {
  mode: 'local' | 'host' | 'guest';
  mySeat: number;
  /** Code de room à 6 caractères (affiché/copiable par l'hôte, voyage dans les snapshots). */
  roomCode: string | null;
  seatNames: Record<number, string>;
  /** Vue HÔTE : sièges en cours de reconnexion (absent = connecté). */
  presence: Record<number, 'ok' | 'away'>;
  /** Vue INVITÉ : sa propre connexion (préservée à l'application des snapshots). */
  connection: 'connecte' | 'reconnecting';
  /** Vue INVITÉ : l'hôte est-il momentanément déconnecté ? */
  hostAway: boolean;
  ownership: Record<string, number>;
  slots: number[];
}
export const initialNet = (): NetState => ({
  mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {},
  connection: 'connecte', hostAway: false, ownership: {}, slots: [0, 0, 0, 0],
});
```

- [ ] **Step 3 : réécrire la plomberie réseau de `netFlow.ts`**

Remplacer les imports réseau et les singletons :

```ts
import { HostSession, GuestSession } from '../net/session';
import { GUEST_INTENTS, sanitizeIntentArgs } from '../net/intents';
import { intentAllowedFor } from './netOwnership';
import { RoomGuest, RoomHost, relayHttpUrl } from '../net/relay';
import type { Transport } from '../net/transport';
import type { NetMessage } from '../net/protocol';
import { registerScene } from './store';
import type { Scene } from './scene';
```

(supprimer les imports `encodeSignal/decodeSignal` et `hostCreateOffer/guestAcceptOffer/
hostAcceptAnswer/channelTransport`.)

```ts
// ── Singletons réseau (non sérialisables) ──────────────────────────────────────────────────────
let host: HostSession | null = null;
let guest: GuestSession | null = null;
let roomHost: RoomHost | null = null;
let roomGuest: RoomGuest | null = null;
let unsubscribe: (() => void) | null = null;
let originals: Record<string, (...args: unknown[]) => unknown> | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
const graceTimers = new Map<number, ReturnType<typeof setTimeout>>();
let lastCampaign: unknown = null;

/** Siège réservé pendant la reconnexion d'un invité (spec v2 §6). */
export const GRACE_MS = 120_000;
/** Backpressure : au-delà, on diffère le snapshot (seul le DERNIER état partira). */
const BUFFER_MAX = 256 * 1024;
/** Token de reprise persisté par room — un reload de l'onglet reprend le même siège. */
const tokenKey = (code: string) => `wfrp4.coop.token.${code}`;
```

`netSnapshot` exclut la campagne :

```ts
/** Snapshot d'état pour le réseau — mêmes clés que la sauvegarde, SANS le projet de campagne
 *  (313 Ko pour l'Arène : il voyage UNE fois au join via le message `campaign`, spec v2 §5). */
function netSnapshot(get: Get): Record<string, unknown> {
  const { data } = snapshotSave(
    get() as unknown as Record<string, unknown>,
    useGame.getInitialState() as unknown as Record<string, unknown>,
    'net',
  );
  delete (data as Record<string, unknown>).pendingCampaign;
  return data;
}
```

`scheduleBroadcast` : backpressure + campagne-au-changement :

```ts
function campaignMessage(pc: NonNullable<GameState['pendingCampaign']>): NetMessage {
  return { kind: 'campaign', name: pc.name, scenes: pc.scenes, startSceneId: pc.startSceneId, worldMap: pc.worldMap ?? null };
}

function campaignMessages(get: Get): NetMessage[] {
  const pc = get().pendingCampaign;
  if (pc) lastCampaign = pc;
  return pc ? [campaignMessage(pc)] : [];
}

/** Diffusion throttlée (trailing ~120 ms) : une rafale de mutations (tour d'IA) = un snapshot.
 *  Upload saturé (bufferedAmount) → on retente, seul le DERNIER état partira (coalescing). */
function scheduleBroadcast(get: Get): void {
  if (!host || broadcastTimer != null) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    if (!host) return;
    if ((roomHost?.relay.buffered() ?? 0) > BUFFER_MAX) {
      scheduleBroadcast(get);
      return;
    }
    const pc = get().pendingCampaign;
    if (pc && pc !== lastCampaign) {
      lastCampaign = pc;
      host.broadcast(campaignMessage(pc)); // chargée APRÈS le join → rattrapage
    }
    host.broadcastSnapshot(netSnapshot(get));
  }, 120);
}
```

`applyNetSnapshot` préserve aussi les champs locaux de connexion (remplacer la ligne `net:`) :

```ts
    net: {
      ...(incoming ?? mine.net),
      mode: 'guest',
      mySeat: mine.net.mySeat,
      connection: mine.net.connection,
      hostAway: mine.net.hostAway,
    },
```

- [ ] **Step 4 : actions hôte** — remplacer `netHostStart`, supprimer `netInvite` et
`netAcceptAnswer`, ajouter le helper presence :

```ts
function setPresence(get: Get, set: Set, seat: number, p: 'ok' | 'away'): void {
  set({ net: { ...get().net, presence: { ...get().net.presence, [seat]: p } } });
}

/** Devient HÔTE : crée la room sur le Worker → code court, attend les invités.
 *  false = service injoignable (l'UI affiche l'erreur). */
export async function netHostStart(get: Get, set: Set, name: string): Promise<boolean> {
  if (get().net.mode !== 'local') return false;
  let room: { code: string; hostToken: string };
  try {
    const res = await fetch(`${relayHttpUrl()}/rooms`, { method: 'POST' });
    if (!res.ok) return false;
    room = (await res.json()) as { code: string; hostToken: string };
  } catch {
    return false;
  }
  const rh = new RoomHost(room.code, room.hostToken);
  roomHost = rh;
  host = new HostSession({
    build: BUILD_ID,
    allow: GUEST_INTENTS,
    applyIntent: (action, args, seat) => {
      // Validation de POSSESSION (spec §4bis) : un invité ne pilote que SES combattants.
      if (!intentAllowedFor(useGame.getState(), seat, action, args)) {
        get().log(`Action réseau refusée (${action}) : pas le propriétaire.`);
        return;
      }
      // Composition d'équipe : le siège vient du transport, jamais des args de l'invité.
      if (action === 'partyAddHero') args = [args[0], args[1], seat];
      const fn = (useGame.getState() as unknown as Record<string, unknown>)[action];
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args);
    },
    getSnapshot: () => netSnapshot(get),
    extraJoinMessages: () => campaignMessages(get),
    onSeatClosed: (seat) => {
      const { seatNames, presence, ownership, slots } = get().net;
      const names = { ...seatNames };
      delete names[seat];
      const pres = { ...presence };
      delete pres[seat];
      // Ses héros ET ses emplacements reviennent à l'hôte (spec §6).
      const own = Object.fromEntries(Object.entries(ownership).map(([h, s]) => [h, s === seat ? 0 : s]));
      set({ net: { ...get().net, seatNames: names, presence: pres, ownership: own, slots: slots.map((s) => (s === seat ? 0 : s)) } });
      get().log(`Un joueur a quitté — ses héros reviennent à l'hôte.`);
    },
  });
  rh.onFatal = () => {
    get().log('Connexion au service coop perdue — session terminée.');
    netLeave(get, set);
  };
  rh.onJoin = (seat, gname) => {
    host?.addGuest(rh.seatTransport(seat), seat);
    set({ net: { ...get().net, seatNames: { ...get().net.seatNames, [seat]: gname }, presence: { ...get().net.presence, [seat]: 'ok' } } });
  };
  rh.onResume = (seat, gname) => {
    const t = graceTimers.get(seat);
    if (t != null) {
      clearTimeout(t);
      graceTimers.delete(seat);
    }
    // Revenu APRÈS la grace : son siège a été fermé → re-join sur le même siège.
    if (!host?.seats[seat]) host?.addGuest(rh.seatTransport(seat), seat);
    set({ net: { ...get().net, seatNames: { ...get().net.seatNames, [seat]: gname }, presence: { ...get().net.presence, [seat]: 'ok' } } });
  };
  rh.onGone = (seat) => {
    setPresence(get, set, seat, 'away');
    graceTimers.set(seat, setTimeout(() => {
      graceTimers.delete(seat);
      rh.closeSeat(seat); // → onClose du transport virtuel → onSeatClosed (héros à l'hôte)
    }, GRACE_MS));
  };
  set({ net: { ...initialNet(), mode: 'host', roomCode: room.code, seatNames: { 0: name } } });
  unsubscribe = useGame.subscribe(() => scheduleBroadcast(get));
  return true;
}
```

- [ ] **Step 5 : action invité** — remplacer `netJoin` :

```ts
/** INVITÉ : rejoint une room par son code. Résout null si connecté, sinon le message d'erreur.
 *  Un token en sessionStorage (reload d'onglet) reprend le MÊME siège tant que la room vit. */
export function netJoin(get: Get, set: Set, codeRaw: string, name: string): Promise<string | null> {
  if (get().net.mode !== 'local') return Promise.resolve('Déjà en session.');
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return Promise.resolve('Code invalide — 6 caractères.');
  const stored = sessionStorage.getItem(tokenKey(code)) ?? undefined;
  return new Promise((resolve) => {
    let settled = false;
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      netLeave(get, set);
      resolve(msg);
    };
    const timeout = setTimeout(() => fail('Connexion impossible — réessayez.'), 15_000);
    const rg = new RoomGuest(code, name, undefined, stored);
    roomGuest = rg;
    rg.onFatal = (reason) => {
      if (settled) {
        get().log(`Coop : ${reason}`);
        netLeave(get, set);
        return;
      }
      fail(reason);
    };
    rg.onHostAway = (away) => {
      if (get().net.mode === 'guest') set({ net: { ...get().net, hostAway: away } });
    };
    rg.onConnState = (s) => {
      if (get().net.mode === 'guest') set({ net: { ...get().net, connection: s === 'ok' ? 'ok' : 'reconnecting' } });
    };
    rg.onReconnected = () => guest?.rejoin();
    rg.onSeated = (seat) => {
      sessionStorage.setItem(tokenKey(code), rg.token);
      if (settled) return; // reprise en cours de partie : déjà câblé
      settled = true;
      clearTimeout(timeout);
      guest = new GuestSession({
        build: BUILD_ID,
        name,
        applySnapshot: (data) => applyNetSnapshot(set, data),
        onCampaign: (m) => {
          for (const s of m.scenes) registerScene(s as Scene);
        },
        onClosed: () => netLeave(get, set),
      });
      set({ net: { ...initialNet(), mode: 'guest', mySeat: seat, roomCode: code, seatNames: { [seat]: name } } });
      interceptGuestActions();
      guest.connect(rg);
      resolve(null);
    };
  });
}
```

- [ ] **Step 6 : `netLeave` v2** :

```ts
/** Quitte la session (les deux rôles) — retour au mode local, actions restaurées. */
export function netLeave(get: Get, set: Set): void {
  unsubscribe?.();
  unsubscribe = null;
  if (broadcastTimer != null) {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
  }
  for (const t of graceTimers.values()) clearTimeout(t);
  graceTimers.clear();
  lastCampaign = null;
  host?.close();
  host = null;
  guest?.close();
  guest = null;
  roomHost?.close();
  roomHost = null;
  roomGuest?.close();
  roomGuest = null;
  restoreGuestActions();
  set({ net: initialNet() });
}
```

(`netAssign`, `netAssignSlot`, `ownsLocally`, `interceptGuestActions`, `applyNetSnapshot`
— le reste du fichier — inchangés hors ce qui précède. Les fonctions `netInvite` et
`netAcceptAnswer` ainsi que `pendingInvites` sont SUPPRIMÉES.)

- [ ] **Step 7 : `src/state/store.ts`** — types (lignes ~343-350) :

```ts
  netHostStart: (name: string) => Promise<boolean>;
  netJoin: (code: string, name: string) => Promise<string | null>;
  netAssign: (heroId: string, seat: number) => void;
```

(supprimer les lignes `netInvite:` et `netAcceptAnswer:`). Wiring (lignes ~879-885) : supprimer
les deux lignes correspondantes ; `netHostStart`/`netJoin` gardent leur forme déléguée.

- [ ] **Step 8 : adaptation MINIMALE de l'UI pour rester vert**

`src/ui/CoopPanels.tsx` : remplacer `CoopInvitePanel` entier par :

```tsx
/** Code de room + lien d'invitation (l'échange de codes WebRTC v1 est mort). */
export function CoopRoomPanel() {
  const net = useGame((s) => s.net);
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});
  if (!net.roomCode) return null;
  const link = `${location.origin}${location.pathname}?join=${net.roomCode}`;
  return (
    <div className="coop-invite">
      <div className="coop-code" title="Copier le code" onClick={() => copy(net.roomCode!)}>{net.roomCode}</div>
      <div className="bar">
        <button className="btn small" onClick={() => copy(net.roomCode!)}>📋 Code</button>
        <button className="btn small" onClick={() => copy(link)}>🔗 Lien d'invitation</button>
      </div>
    </div>
  );
}
```

et dans `CoopMenuSection`, remplacer `<CoopInvitePanel />` par `<CoopRoomPanel />`.

`src/ui/CoopLobby.tsx` :
- import : `CoopRoomPanel` au lieu de `CoopInvitePanel` ; supprimer l'état `myAnswer` ;
- bouton Héberger :

```tsx
            <button
              className="btn btn-primary"
              disabled={!name.trim()}
              onClick={async () => {
                setError('');
                if (!(await hostStart(name.trim()))) setError('Service coop injoignable — réessayez.');
              }}
            >
              Héberger
            </button>
```

- panneau Rejoindre : le `<textarea>` devient un input court, le handler affiche l'erreur :

```tsx
            <input
              className="coop-code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code (6 caractères)"
              maxLength={6}
            />
            <button
              className="btn btn-primary"
              disabled={!name.trim() || joinCode.trim().length !== 6}
              onClick={async () => {
                setError('');
                const err = await join(joinCode, name.trim());
                if (err) setError(err);
              }}
            >
              Rejoindre
            </button>
```

- vue invité : supprimer le bloc `myAnswer` (il ne reste que l'attente) ;
- vue hôte : remplacer la section « Inviter un joueur » par :

```tsx
      <section className="panel coop-role">
        <div className="mini-title">Inviter — partagez le code</div>
        <CoopRoomPanel />
      </section>
```

- [ ] **Step 9 : suite + typecheck**

Run : `npm test` puis `npm run typecheck`.
Attendu : verts. Si des tests construisent un `NetState` littéral (chercher `seatNames:` dans
`src/state/*.test.ts`), les corriger en `{ ...initialNet(), …surcharges }`.

- [ ] **Step 10 : commit**

```bash
git add src/state/netFlow.ts src/state/store.ts src/ui/CoopPanels.tsx src/ui/CoopLobby.tsx
git commit -m "feat(coop): netFlow v2 sur le relay — room par code, grace 2 min + reprise de siège, campagne hors snapshots, backpressure" -- src/state/netFlow.ts src/state/store.ts src/ui/CoopPanels.tsx src/ui/CoopLobby.tsx
```

---

### Task 8 : UX produit — présence, bannière, deep link, styles

**Files:**
- Modify: `src/ui/CoopPanels.tsx`, `src/ui/CoopLobby.tsx`, `src/ui/App.tsx`,
  `src/ui/styles/base.css`

- [ ] **Step 1 : liste des sièges avec présence** — dans `src/ui/CoopPanels.tsx`, ajouter :

```tsx
/** Sièges + présence (🟢 connecté / 🟠 reconnexion) — partagé lobby et menu ☰. */
export function CoopSeatList() {
  const net = useGame((s) => s.net);
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <ul className="coop-seats">
      {seats.map(({ seat, name }) => (
        <li key={seat} className={net.presence[seat] === 'away' ? 'away' : undefined}>
          {seat === 0 ? '👑' : net.presence[seat] === 'away' ? '🟠' : '🟢'} {name}
          {seat === net.mySeat ? ' (vous)' : ''}
          {net.presence[seat] === 'away' ? ' — reconnexion…' : ''}
        </li>
      ))}
    </ul>
  );
}
```

Dans `CoopMenuSection`, remplacer le `<ul className="coop-seats">…</ul>` inline par
`<CoopSeatList />`.

- [ ] **Step 2 : lobby** — dans `src/ui/CoopLobby.tsx` :
- la section « Joueurs connectés » (vue hôte) utilise `<CoopSeatList />` (supprimer le map inline) ;
- vue invité : afficher aussi la situation :

```tsx
        <section className="panel coop-role">
          <div className="mini-title">Partie {net.roomCode}</div>
          <CoopSeatList />
        </section>
        <p className="hint coop-waiting">
          {net.hostAway ? '⏳ L’hôte est déconnecté — la partie reprendra à son retour.'
            : net.connection === 'reconnecting' ? '🔌 Reconnexion en cours…'
            : '⏳ En attente de l’hôte…'}
        </p>
```

- pré-remplissage par lien d'invitation :

```tsx
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('join')?.toUpperCase() ?? '');
```

- [ ] **Step 3 : deep link + bannière globale** — dans `src/ui/App.tsx` :

```tsx
import { lazy, Suspense, useEffect } from 'react';
```

```tsx
/** Bannière coop non bloquante : reconnexions en cours (invité comme hôte). */
function CoopBanner() {
  const net = useGame((s) => s.net);
  if (net.mode === 'guest' && net.connection === 'reconnecting')
    return <div className="coop-banner">🔌 Reconnexion en cours…</div>;
  if (net.mode === 'guest' && net.hostAway)
    return <div className="coop-banner">⏳ L'hôte est déconnecté — la partie reprendra à son retour.</div>;
  if (net.mode === 'host') {
    const away = Object.entries(net.presence)
      .filter(([, p]) => p === 'away')
      .map(([s]) => net.seatNames[Number(s)] ?? `Joueur ${Number(s) + 1}`);
    if (away.length) return <div className="coop-banner">🔌 {away.join(', ')} : reconnexion en cours…</div>;
  }
  return null;
}
```

et dans `App()` :

```tsx
export function App() {
  const screen = useGame((s) => s.screen);
  // Lien d'invitation ?join=CODE → arrivée directe sur l'écran coop (code pré-rempli).
  useEffect(() => {
    if (new URLSearchParams(location.search).get('join')) useGame.getState().setScreen('coop');
  }, []);
  return (
    <div className="app">
      <CoopBanner />
      <Suspense fallback={…inchangé…}>
```

- [ ] **Step 4 : styles** — à la fin de `src/ui/styles/base.css` (tokens existants uniquement) :

```css
/* ── Coop v2 : code de room, saisie, bannière de reconnexion ─────────────────────────── */
.coop-code {
  font-family: var(--font-display);
  font-size: 2.4rem;
  letter-spacing: 0.3em;
  text-indent: 0.3em; /* compense le letter-spacing du dernier caractère */
  text-align: center;
  color: var(--gold2);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.25em 0.4em;
  cursor: pointer;
  user-select: all;
}
.coop-code-input {
  text-transform: uppercase;
  letter-spacing: 0.25em;
  text-align: center;
  font-size: 1.2rem;
}
.coop-seats .away {
  color: var(--muted);
}
.coop-banner {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  background: var(--panel);
  border: 1px solid var(--danger-soft);
  color: var(--danger-soft);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 0.9rem;
  pointer-events: none;
  white-space: nowrap;
}
```

- [ ] **Step 5 : vérification navigateur (sans serveur : états visuels)**

Run : `npm run dev`, ouvrir `http://localhost:5173/?join=ABC234` → l'écran coop s'ouvre, le
champ code contient `ABC234`. Console : 0 erreur. (Le flux complet attend la Task 10.)

- [ ] **Step 6 : commit**

```bash
git add src/ui/CoopPanels.tsx src/ui/CoopLobby.tsx src/ui/App.tsx src/ui/styles/base.css
git commit -m "feat(coop): UX lobby v2 — code 6 chars + lien ?join=, présence par siège, bannière de reconnexion" -- src/ui/CoopPanels.tsx src/ui/CoopLobby.tsx src/ui/App.tsx src/ui/styles/base.css
```

---

### Task 9 : suppression franche du WebRTC

**Files:**
- Delete: `src/net/codes.ts`, `src/net/codes.test.ts`
- Modify: `src/net/transport.ts`, `ROADMAP.md`

- [ ] **Step 1 : purger `transport.ts`**

Supprimer : `STUN_URLS`, `gatheringComplete`, `hostCreateOffer`, `guestAcceptOffer`,
`hostAcceptAnswer`, `channelTransport`. Ne gardent leur place que l'interface `Transport` et
`FakeTransport`. Réécrire l'en-tête :

```ts
/**
 * Transport coop — interface minuscule consommée par `session.ts`, implémentations :
 * - `RoomHost`/`RoomGuest` (`relay.ts`) : WebSocket via le Worker relay (`server/`), prod.
 * - `FakeTransport.pair()` : paire en mémoire pour les tests (session/intents sans réseau).
 * (Le transport WebRTC v1 + codes W4C1 copiés/collés a été supprimé — spec coop v2.)
 */
```

- [ ] **Step 2 : supprimer les codes**

```bash
git rm src/net/codes.ts src/net/codes.test.ts
```

- [ ] **Step 3 : références restantes**

Run : `git grep -n "W4C1\|encodeSignal\|hostCreateOffer\|channelTransport\|STUN"` —
attendu : plus AUCUNE occurrence dans `src/` ni `server/`. Mettre à jour la ligne coop de
`ROADMAP.md` qui mentionne les codes W4C1 (décrire : « relay WebSocket Worker Cloudflare,
codes de room 6 caractères, reconnexion auto »).

- [ ] **Step 4 : suite + typecheck**

Run : `npm test` et `npm run typecheck` → verts.

- [ ] **Step 5 : commit**

```bash
git add -A -- src/net/transport.ts src/net/codes.ts src/net/codes.test.ts ROADMAP.md
git commit -m "chore(coop): suppression du transport WebRTC v1 et des codes W4C1" -- src/net/transport.ts src/net/codes.ts src/net/codes.test.ts ROADMAP.md
```

---

### Task 10 : recette manuelle bout-en-bout (wrangler dev + 2 navigateurs)

Aucun fichier — checklist de recette (Playwright MCP ou à la main, 2 contextes).

- [ ] **Step 1 : lancer la pile locale**

```powershell
# terminal 1 :
npm run relay:dev          # wrangler dev → http://localhost:8787
# terminal 2 :
$env:VITE_RELAY_URL = 'http://localhost:8787'; npm run dev
```

- [ ] **Step 2 : flux nominal**
1. Contexte A (hôte) : menu → Jouer en ligne → nom → Héberger → le code 6 chars s'affiche.
2. Contexte B (invité) : `http://localhost:5173/?join=<CODE>` → nom → Rejoindre →
   apparaît dans « Joueurs connectés » des DEUX côtés.
3. Hôte : Composer le groupe → attribuer un emplacement au siège 1 → l'invité crée/charge un
   perso → ✓ des deux côtés → lancer. Vérifier que l'invité voit la scène.

- [ ] **Step 3 : campagne custom hors snapshots**
1. Hôte : publier une campagne dans l'éditeur (ou utiliser une existante de `Mes campagnes`),
   la lancer en coop.
2. Invité : la scène s'affiche, les portes `reveal:'door'` montrent leurs intérieurs.
3. DevTools réseau (onglet WS) côté hôte : les frames snapshot restent < ~50 Ko (compressées),
   une seule frame `campaign` volumineuse au join.

- [ ] **Step 4 : reconnexion invité**
1. DevTools invité → Network → Offline ~15 s : bannière « Reconnexion… » côté invité,
   badge 🟠 côté hôte.
2. Online : tout revient SANS action manuelle (même siège, snapshot frais), badges 🟢.
3. Reload (F5) de l'onglet invité → re-Rejoindre avec le même code → reprend le MÊME siège
   (token sessionStorage).
4. Offline > 2 min : côté hôte, journal « Un joueur a quitté — ses héros reviennent à
   l'hôte » ; l'invité revenu ensuite rejoint sur son siège, l'hôte lui réattribue ses héros.

- [ ] **Step 5 : reconnexion hôte + fermeture**
1. Couper le réseau de l'hôte ~15 s : invités → bannière « L'hôte est déconnecté… » ; retour →
   reprise.
2. Hôte : Quitter → les invités sont éjectés proprement (retour lobby/menu, pas de console rouge).
3. Console : 0 erreur dans les deux contextes sur tout le parcours.

- [ ] **Step 6 : commit éventuel des correctifs de recette** (mêmes pathspecs que la tâche
concernée, message `fix(coop): …`).

---

### Task 11 : déploiement prod + documentation

**Files:**
- Modify: `src/net/relay.ts` (URL prod), `CLAUDE.md`

- [ ] **Step 1 : déployer le Worker** (nécessite le compte Cloudflare de l'utilisateur — lui
demander de lancer, ou `npx wrangler login` en session) :

```bash
cd server && npx wrangler login && npm run deploy
```

Attendu : `https://w4-coop-relay.<compte>.workers.dev`.

- [ ] **Step 2 : URL de prod** — dans `src/net/relay.ts`, remplacer la valeur de
`RELAY_URL_PROD` par l'URL réelle obtenue.

- [ ] **Step 3 : smoke test prod**

```powershell
curl -X POST https://w4-coop-relay.<compte>.workers.dev/rooms
```
Attendu : `{"code":…,"hostToken":…}`. Puis `npm run dev` SANS `VITE_RELAY_URL` : héberger une
partie → un code s'affiche (le client parle bien à la prod).

- [ ] **Step 4 : documenter** — dans `CLAUDE.md` (Game) :
- section Architecture, ajouter deux lignes :

```
src/net/                    Coop v2 : relay WebSocket (relay.ts RoomHost/RoomGuest, session.ts
                            hôte-autoritaire, protocol.ts, compress.ts) — codes de room 6 chars
server/                     Worker Cloudflare du relay coop (DO Room) — npm run relay:dev / relay:deploy
```

- section Commandes, ajouter :

```bash
npm run relay:dev      # Worker relay coop en local (wrangler dev, port 8787) — client : VITE_RELAY_URL
npm run relay:deploy   # déploie le Worker relay (compte Cloudflare requis)
```

- [ ] **Step 5 : commit + push**

```bash
git add src/net/relay.ts CLAUDE.md
git commit -m "feat(coop): URL relay de prod + doc deploiement Worker" -- src/net/relay.ts CLAUDE.md
git push
```

(Le déploiement du JEU sur GitHub Pages reste sur demande explicite de l'utilisateur.)

---

## Couverture spec → tâches

| Spec | Tâche |
| --- | --- |
| §3 Worker (rooms, codes, refus propres, TTL, hibernation) | 1, 2 |
| §4 Client transport (RelayClient, RoomHost/RoomGuest, suppressions) | 5, 7, 9 |
| §5 Snapshots (compression, campagne au join + au changement, coalescing, garde-fou 1 Mio) | 3, 4, 5, 6, 7 |
| §6 Heartbeat/reconnexion/grace/presence | 2, 5, 7 (+ recette 10) |
| §7 UI lobby (code, lien ?join=, présence, bannière) | 7, 8 |
| §8 Tests | 1, 3, 4, 5, 6 |
| §9 Déploiement/config | 2, 10, 11 |
