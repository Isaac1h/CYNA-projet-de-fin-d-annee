import { supabase } from '@/lib/supabase';
import type { Category } from './types';

/**
 * The data layer exposes `id = slug` so the existing pages (which build
 * URLs like `/category/${cat.id}`) keep working unchanged after the
 * schema went from `text` ids to UUID + slug. The real UUID stays
 * internal to the DB.
 */

type CategoryRow = {
  id: string;
  slug: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
};

const CATEGORY_COLUMNS = 'id, slug, name, description, image_url, display_order, created_at';

const toCategory = (row: CategoryRow): Category => ({
  id: row.slug,
  name: row.name?.fr ?? '',
  description: row.description?.fr ?? '',
  image_url: row.image_url ?? '',
  created_at: row.created_at,
});

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .order('display_order', { ascending: true });
  if (error) {
    throw new Error(`Supabase getCategories failed: ${error.message}`);
  }
  return ((data ?? []) as CategoryRow[]).map(toCategory);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('slug', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase getCategoryById failed: ${error.message}`);
  }
  return data ? toCategory(data as CategoryRow) : null;
}
