export type SkillRefNode = { id: string; spec?: string; choix?: true | string[] };
export type BookLike = { id: string; dir?: string | null; extractionDir?: string | null };

export function norm(s: string): string;
export function isSentinel(s: string): boolean;
export function walkSkillRefs(entry: unknown, visit: (node: SkillRefNode) => void, arrName?: 'skills' | 'talents'): void;
export function skillArraysOf(entry: unknown): unknown[][];
export function extractedBooks(books: readonly BookLike[], root: string): { extraits: Set<string>; dirManquant: string[] };
export function frenchSourceDirs(root: string): string[];
