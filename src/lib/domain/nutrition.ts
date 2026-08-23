import type { Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';
import { consistencyRate, type Habit, type HabitCompletion } from '@/lib/domain/habits';

export type ShakeIngredient = Tables<'shake_ingredients'>;
export type ShakeRecipe = Tables<'shake_recipes'>;

export type RecipeNutrition = {
  calories: number;
  proteinG: number;
  /** Always true. Present so no call site can render these without the caveat. */
  isApproximate: true;
};

/**
 * Recipe macros.
 *
 * Stored per unit, multiplied by quantity — so editing "300 ml" to "400 ml"
 * recomputes without a lookup table. The numbers are rounded reference figures
 * for common foods, which is why every surface that shows them says
 * "approximate". The app deliberately does not chase precision it can't have.
 */
export function calculateRecipeNutrition(
  ingredients: Pick<ShakeIngredient, 'quantity' | 'calories_per_unit' | 'protein_g_per_unit'>[],
): RecipeNutrition {
  let calories = 0;
  let proteinG = 0;

  for (const ingredient of ingredients) {
    calories += ingredient.quantity * ingredient.calories_per_unit;
    proteinG += ingredient.quantity * ingredient.protein_g_per_unit;
  }

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG * 10) / 10,
    isApproximate: true,
  };
}

/**
 * Reference macros for the ingredient picker.
 *
 * Per *single unit* of the named measure. Sources are standard food-composition
 * averages; brands vary, so users can edit any value.
 */
export const INGREDIENT_REFERENCE: ReadonlyArray<{
  name: string;
  unit: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
}> = [
  { name: 'Milk (whole)', unit: 'ml', caloriesPerUnit: 0.64, proteinPerUnit: 0.033 },
  { name: 'Milk (semi-skimmed)', unit: 'ml', caloriesPerUnit: 0.5, proteinPerUnit: 0.035 },
  { name: 'Banana', unit: 'whole', caloriesPerUnit: 105, proteinPerUnit: 1.3 },
  { name: 'Dates (Medjool)', unit: 'whole', caloriesPerUnit: 66, proteinPerUnit: 0.4 },
  { name: 'Peanut butter', unit: 'tbsp', caloriesPerUnit: 94, proteinPerUnit: 3.6 },
  { name: 'Almond butter', unit: 'tbsp', caloriesPerUnit: 98, proteinPerUnit: 3.4 },
  { name: 'Rolled oats', unit: 'g', caloriesPerUnit: 3.79, proteinPerUnit: 0.13 },
  { name: 'Greek yoghurt', unit: 'g', caloriesPerUnit: 0.59, proteinPerUnit: 0.1 },
  { name: 'Whey protein', unit: 'scoop', caloriesPerUnit: 120, proteinPerUnit: 24 },
  { name: 'Honey', unit: 'tbsp', caloriesPerUnit: 64, proteinPerUnit: 0.1 },
  { name: 'Boiled egg', unit: 'whole', caloriesPerUnit: 78, proteinPerUnit: 6.3 },
  { name: 'Olive oil', unit: 'tbsp', caloriesPerUnit: 119, proteinPerUnit: 0 },
  { name: 'Chia seeds', unit: 'tbsp', caloriesPerUnit: 58, proteinPerUnit: 2 },
  { name: 'Avocado', unit: 'whole', caloriesPerUnit: 240, proteinPerUnit: 3 },
];

export const INGREDIENT_UNITS = ['g', 'ml', 'whole', 'tbsp', 'tsp', 'cup', 'scoop', 'slice'] as const;

export type NutritionInsight = {
  key: string;
  /** Factual, no grade attached. */
  text: string;
  tone: 'positive' | 'neutral';
};

/**
 * Weekly nutrition observations.
 *
 * Strictly descriptive: counts and comparisons, never targets or prescriptions.
 * The app does not tell anyone how many calories to eat.
 */
export function nutritionInsights(input: {
  habits: Habit[];
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[];
  thisWeek: { from: DateKey; to: DateKey };
  lastWeek: { from: DateKey; to: DateKey };
}): NutritionInsight[] {
  const nutritionHabits = input.habits.filter((h) => h.category === 'nutrition' && h.is_active);
  if (nutritionHabits.length === 0) return [];

  const insights: NutritionInsight[] = [];

  // Per-habit completion counts, best first.
  const perHabit = nutritionHabits
    .map((habit) => {
      const week = consistencyRate(
        input.completions,
        [habit.id],
        input.thisWeek.from,
        input.thisWeek.to,
      );
      return { habit, ...week };
    })
    .sort((a, b) => b.completed - a.completed);

  const best = perHabit[0];
  if (best && best.completed >= 4) {
    insights.push({
      key: `best-${best.habit.id}`,
      text: `You completed your ${best.habit.name.toLowerCase()} ${best.completed}/${best.opportunities} days this week.`,
      tone: 'positive',
    });
  }

  const weakest = perHabit[perHabit.length - 1];
  if (weakest && weakest.completed <= 2 && weakest.opportunities >= 5 && !weakest.habit.is_optional) {
    insights.push({
      key: `light-${weakest.habit.id}`,
      text: `Your ${weakest.habit.name.toLowerCase()} was logged ${weakest.completed}/${weakest.opportunities} days. Worth a look if it matters to you.`,
      tone: 'neutral',
    });
  }

  // Week-over-week, only when both weeks have enough data to compare.
  const ids = nutritionHabits.map((h) => h.id);
  const thisRate = consistencyRate(input.completions, ids, input.thisWeek.from, input.thisWeek.to);
  const lastRate = consistencyRate(input.completions, ids, input.lastWeek.from, input.lastWeek.to);

  if (lastRate.completed > 0 && thisRate.completed > 0) {
    const delta = thisRate.rate - lastRate.rate;
    if (delta >= 10) {
      insights.push({
        key: 'trend-up',
        text: 'Your nutrition habits were more consistent this week than last.',
        tone: 'positive',
      });
    } else if (delta <= -10) {
      insights.push({
        key: 'trend-down',
        text: 'Nutrition habits were lighter this week than last. Weeks vary.',
        tone: 'neutral',
      });
    } else {
      insights.push({
        key: 'trend-steady',
        text: `Nutrition consistency held steady at about ${thisRate.rate}%.`,
        tone: 'positive',
      });
    }
  }

  return insights.slice(0, 3);
}

/** Approximate daily intake from completed recipe-backed habits. */
export function approximateDailyFromRecipes(
  completions: Pick<HabitCompletion, 'habit_id' | 'status'>[],
  habits: Pick<Habit, 'id' | 'recipe_id'>[],
  recipeNutrition: Map<string, RecipeNutrition>,
): RecipeNutrition {
  const recipeByHabit = new Map(habits.map((h) => [h.id, h.recipe_id]));
  let calories = 0;
  let proteinG = 0;

  for (const completion of completions) {
    if (completion.status !== 'completed' && completion.status !== 'modified') continue;
    const recipeId = recipeByHabit.get(completion.habit_id);
    if (!recipeId) continue;
    const nutrition = recipeNutrition.get(recipeId);
    if (!nutrition) continue;
    calories += nutrition.calories;
    proteinG += nutrition.proteinG;
  }

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG * 10) / 10,
    isApproximate: true,
  };
}
