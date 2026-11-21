import { isAbsolute, join } from 'node:path'
import { z } from 'zod'

export const PRODUCTEUR = 'ops:session'
export const dossierSessions = (gitCommun) => join(gitCommun, 'sessions')

const Empreinte = z.string().regex(/^[a-f0-9]{64}$/)
export const Contexte = z.object({ sessionId: z.uuid(), nonce: Empreinte, worktree: z.string().min(1), surface: z.enum(['claude', 'codex']), empreinteCanon: Empreinte, empreinteCredo: Empreinte.optional(), debut: z.iso.datetime(), chemin: z.string().min(1) }).strict()
export const Recu = Contexte.omit({ chemin: true }).extend({ version: z.literal(1), date: z.iso.datetime(), nativeSessionId: z.string().min(1).optional() }).strict()
const PreuveSessionStart = Recu.omit({ nonce: true })

export const EXTENSION_CARTE = '.json'
/** Le nom de fichier de la carte `id` dans le registre. PURE. */
export const nomDeCarte = (id) => `${id}${EXTENSION_CARTE}`
export const Identite = z.object({ pid: z.number().int().positive(), creation: z.string().min(1) }).passthrough()
export const CarteSession = z.object({
  sessionId: z.uuid(), producteur: z.literal(PRODUCTEUR), ticket: z.number().int().positive(), nom: z.string().min(1),
  agent: z.enum(['claude', 'codex']), consigne: z.string().refine(isAbsolute), worktree: z.string().refine(isAbsolute), racine: z.string().refine(isAbsolute),
  branche: z.string().min(1), head: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/), date: z.iso.datetime(), reserveJusqua: z.number(),
  lanceur: Identite, empreinteJeton: z.string().regex(/^[0-9a-f]{64}$/), empreinteNonce: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  empreinteNonceHook: z.string().regex(/^[0-9a-f]{64}$/), demarrageJusqua: z.number(),
  hooks: z.object({ empreinteCanon: z.string().regex(/^[0-9a-f]{64}$/), empreinteCredo: z.string().regex(/^[0-9a-f]{64}$/).optional(), delaiMs: z.number().positive() }).strict(),
  recuSessionStart: PreuveSessionStart.optional(),
  etat: z.enum(['reservee', 'vivante', 'arret-demande', 'nettoyage', 'fermee', 'echec-reservation', 'echec-controle']),
  controleur: Identite.optional(), jobHost: Identite.optional(), agentProcessus: Identite.optional(),
  evenements: z.array(z.object({ ticket: z.number().int().positive(), nom: z.string(), sessionId: z.uuid(), date: z.iso.datetime(), type: z.enum(['lancement', 'clôture', 'échec']) })),
}).passthrough().superRefine((c, ctx) => {
  if (c.etat === 'reservee' && !c.empreinteNonce) ctx.addIssue({ code: 'custom', message: 'nonce requis' })
  if (['vivante', 'arret-demande'].includes(c.etat) && (!c.controleur || !c.jobHost)) ctx.addIssue({ code: 'custom', message: 'identités de contrôle requises' })
  if (['nettoyage', 'fermee'].includes(c.etat) && !['sortie', 'echec'].includes(c.issueSortie)) ctx.addIssue({ code: 'custom', message: 'issue de sortie requise' })
  if (c.etat === 'echec-controle' && c.codeEnveloppe !== undefined) ctx.addIssue({ code: 'custom', message: 'sortie enveloppe inconnue' })
})
