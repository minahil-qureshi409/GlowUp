import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';

export type ShakeRecipe = Tables<'shake_recipes'>;
export type ShakeIngredient = Tables<'shake_ingredients'>;

export type RecipeWithIngredients = ShakeRecipe & {
  ingredients: ShakeIngredient[];
};

/**
 * Recipes with their ingredients.
 *
 * One nested select rather than N+1: PostgREST resolves the embed through the
 * foreign key, and RLS applies to the embedded rows too.
 */
export async function getRecipes(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<RecipeWithIngredients[]> {
  const { data, error } = await supabase
    .from('shake_recipes')
    .select('*, ingredients:shake_ingredients(*)')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at');

  if (error) throw error;

  return (data ?? []).map((recipe) => ({
    ...recipe,
    ingredients: [...(recipe.ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getRecipe(
  supabase: SupabaseServerClient,
  userId: string,
  recipeId: string,
): Promise<RecipeWithIngredients | null> {
  const { data, error } = await supabase
    .from('shake_recipes')
    .select('*, ingredients:shake_ingredients(*)')
    .eq('user_id', userId)
    .eq('id', recipeId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    ingredients: [...(data.ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function getDefaultRecipe(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<RecipeWithIngredients | null> {
  const { data, error } = await supabase
    .from('shake_recipes')
    .select('*, ingredients:shake_ingredients(*)')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    ingredients: [...(data.ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}
