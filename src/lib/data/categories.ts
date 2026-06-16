import { demoCategories } from '@/lib/demoData';
import type { Category } from './types';

const normalize = (raw: unknown): Category[] => raw as Category[];

export async function getCategories(): Promise<Category[]> {
  return normalize(demoCategories);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const all = await getCategories();
  return all.find((category) => category.id === id) ?? null;
}
