import type { Metadata } from 'next';
import { Sparkles, UtensilsCrossed } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, SectionHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ApproximateNote, ApproximateTag } from '@/components/common/approximate';
import { HabitChecklist } from '@/components/habits/habit-checklist';
import { RecipeList } from '@/components/nutrition/recipe-list';
import { ConsistencyChart } from '@/components/charts/consistency-chart';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits, getCompletionsForDate, getCompletionsInRange } from '@/services/habits';
import { getRecipes } from '@/services/nutrition';

import { attachStatus, consistencyRate } from '@/lib/domain/habits';
import { calculateRecipeNutrition, nutritionInsights } from '@/lib/domain/nutrition';
import { EMPTY_STATES } from '@/lib/domain/copy';
import { subDaysKey, todayIn, weekStartKey, weekDayKeys } from '@/lib/date';

export const metadata: Metadata = { title: 'Nutrition' };
export const dynamic = 'force-dynamic';

export default async function NutritionPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const weekAgo = subDaysKey(today, 6);
  const twoWeeksAgo = subDaysKey(today, 13);
  const twelveWeeksAgo = subDaysKey(today, 83);

  const [habits, todayCompletions, recentCompletions, recipes] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsForDate(supabase, userId, today),
    getCompletionsInRange(supabase, userId, twelveWeeksAgo, today),
    getRecipes(supabase, userId),
  ]);

  const nutritionHabits = habits.filter((habit) => habit.category === 'nutrition');
  const withStatus = attachStatus(nutritionHabits, todayCompletions);

  const nutritionIds = nutritionHabits.filter((h) => !h.is_optional).map((h) => h.id);
  const thisWeek = consistencyRate(recentCompletions, nutritionIds, weekAgo, today);

  const insights = nutritionInsights({
    habits: nutritionHabits,
    completions: recentCompletions,
    thisWeek: { from: weekAgo, to: today },
    lastWeek: { from: twoWeeksAgo, to: subDaysKey(today, 7) },
  });

  // Twelve weeks of weekly consistency, oldest first.
  const weeklyPoints = Array.from({ length: 12 }, (_, index) => {
    const weekStart = weekStartKey(subDaysKey(today, (11 - index) * 7));
    const days = weekDayKeys(weekStart);
    const from = days[0] ?? weekStart;
    const to = days[days.length - 1] ?? weekStart;
    // Don't project into the future: cap the window at today.
    const cappedTo = to > today ? today : to;
    return {
      weekStart,
      value: consistencyRate(recentCompletions, nutritionIds, from, cappedTo).rate,
    };
  }).filter((point) => point.weekStart >= weekStartKey(twelveWeeksAgo));

  const hasHistory = recentCompletions.length >= 5;

  const recipesWithNutrition = recipes.map((recipe) => ({
    ...recipe,
    nutrition: calculateRecipeNutrition(recipe.ingredients),
  }));
  const habitDetails = Object.fromEntries(
    withStatus.flatMap((habit) => {
      const recipe = recipesWithNutrition.find((item) => item.id === habit.recipe_id);
      return recipe
        ? [[habit.id, `${recipe.name} · ≈ ${recipe.nutrition.calories} kcal, ${recipe.nutrition.proteinG} g protein`]]
        : [];
    }),
  );

  return (
    <div className="animate-fade-up space-y-6 py-3">
      <PageHeader
        title="Nutrition"
        description="Habits, not calorie counting. Tick things off whenever they happen."
      />

      <Card>
        <CardContent className="p-4">
          <SectionHeader
            title="Today"
            description={`${thisWeek.rate}% consistency over the last 7 days`}
            className="mb-2 px-1"
          />
          {withStatus.length > 0 ? (
            <HabitChecklist
              habits={withStatus}
              date={today}
              grouped
              detailByHabitId={habitDetails}
            />
          ) : (
            <EmptyState
              variant="inline"
              icon={UtensilsCrossed}
              title="No food habits yet"
              body="Add a few in Settings and they will show up here each day."
            />
          )}
        </CardContent>
      </Card>

      {insights.length > 0 ? (
        <section className="space-y-2">
          <SectionHeader title="This week" />
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li
                key={insight.key}
                className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 text-domain-nutrition"
                  aria-hidden="true"
                />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card>
        <CardContent className="p-4">
          {hasHistory ? (
            <ConsistencyChart
              title="Nutrition consistency"
              description="Share of food habits logged each week."
              points={weeklyPoints}
              seriesSlot={2}
            />
          ) : (
            <EmptyState
              variant="inline"
              title={EMPTY_STATES.insights.title}
              body={EMPTY_STATES.insights.body}
            />
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeader
          title="Shakes & recipes"
          description="Edit quantities and the estimate updates."
          action={<ApproximateTag />}
        />
        <RecipeList recipes={recipesWithNutrition} />
        <ApproximateNote />
      </section>
    </div>
  );
}
