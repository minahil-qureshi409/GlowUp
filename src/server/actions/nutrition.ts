'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import { shakeRecipeSchema } from '@/lib/validation/schemas';

/**
 * Creates or replaces a recipe and its ingredients.
 *
 * Ingredients are rewritten wholesale rather than diffed: the list is short,
 * users reorder and rename freely, and a delete-then-insert inside one action
 * is far easier to reason about than a three-way merge.
 */
export async function saveRecipe(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = shakeRecipeSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { id, name, notes, is_default: isDefault, ingredients } = parsed.data;

  try {
    // Only one default at a time — the partial unique index enforces it, so
    // the old default is cleared first.
    if (isDefault) {
      await supabase
        .from('shake_recipes')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true);
    }

    let recipeId = id;

    if (recipeId) {
      const { error } = await supabase
        .from('shake_recipes')
        .update({ name, notes: notes ?? null, is_default: isDefault })
        .eq('id', recipeId)
        .eq('user_id', userId);
      if (error) throw error;

      const { error: deleteError } = await supabase
        .from('shake_ingredients')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('user_id', userId);
      if (deleteError) throw deleteError;
    } else {
      const { data, error } = await supabase
        .from('shake_recipes')
        .insert({ user_id: userId, name, notes: notes ?? null, is_default: isDefault, source: 'user' })
        .select('id')
        .single();
      if (error) throw error;
      recipeId = data.id;
    }

    const { error: insertError } = await supabase.from('shake_ingredients').insert(
      ingredients.map((ingredient, index) => ({
        user_id: userId,
        recipe_id: recipeId,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        calories_per_unit: ingredient.calories_per_unit,
        protein_g_per_unit: ingredient.protein_g_per_unit,
        sort_order: index,
      })),
    );
    if (insertError) throw insertError;

    revalidatePath('/nutrition');
    return ok({ id: recipeId });
  } catch (error) {
    return fromUnknownError(error, 'saveRecipe');
  }
}

export async function duplicateRecipe(recipeId: string): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();

  try {
    const { data: source, error } = await supabase
      .from('shake_recipes')
      .select('*, ingredients:shake_ingredients(*)')
      .eq('id', recipeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!source) return fail('That recipe no longer exists.');

    const { data: copy, error: insertError } = await supabase
      .from('shake_recipes')
      .insert({
        user_id: userId,
        name: `${source.name} (copy)`,
        notes: source.notes,
        is_default: false,
        source: 'user',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    const ingredients = source.ingredients ?? [];
    if (ingredients.length > 0) {
      const { error: ingredientError } = await supabase.from('shake_ingredients').insert(
        ingredients.map((ingredient) => ({
          user_id: userId,
          recipe_id: copy.id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          calories_per_unit: ingredient.calories_per_unit,
          protein_g_per_unit: ingredient.protein_g_per_unit,
          sort_order: ingredient.sort_order,
        })),
      );
      if (ingredientError) throw ingredientError;
    }

    revalidatePath('/nutrition');
    return ok({ id: copy.id });
  } catch (error) {
    return fromUnknownError(error, 'duplicateRecipe');
  }
}

export async function setDefaultRecipe(recipeId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    await supabase
      .from('shake_recipes')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    const { error } = await supabase
      .from('shake_recipes')
      .update({ is_default: true })
      .eq('id', recipeId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/nutrition');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'setDefaultRecipe');
  }
}

export async function deleteRecipe(recipeId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    // Habits pointing at this recipe keep working: the FK is ON DELETE SET NULL,
    // so the shake habit survives losing its recipe.
    const { error } = await supabase
      .from('shake_recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/nutrition');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'deleteRecipe');
  }
}
