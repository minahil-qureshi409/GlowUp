'use client';

import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApproximateNote } from '@/components/common/approximate';
import { saveRecipe } from '@/server/actions/nutrition';
import { shakeRecipeSchema, type ShakeRecipeInput } from '@/lib/validation/schemas';
import {
  INGREDIENT_REFERENCE,
  INGREDIENT_UNITS,
  calculateRecipeNutrition,
} from '@/lib/domain/nutrition';
import type { RecipeWithIngredients } from '@/services/nutrition';

type RecipeEditorProps = {
  open: boolean;
  recipe: RecipeWithIngredients | null;
  onOpenChange: (open: boolean) => void;
};

const BLANK_INGREDIENT = {
  name: '',
  quantity: 1,
  unit: 'g',
  calories_per_unit: 0,
  protein_g_per_unit: 0,
};

/**
 * Recipe editor.
 *
 * The estimate recalculates live from the per-unit reference values as
 * quantities change, and is labelled approximate everywhere it appears. Picking
 * a known ingredient fills the macros in; anything typed by hand keeps whatever
 * the user enters.
 */
export function RecipeEditor({ open, recipe, onOpenChange }: RecipeEditorProps) {
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<ShakeRecipeInput>({
    resolver: zodResolver(shakeRecipeSchema),
    defaultValues: {
      name: '',
      notes: '',
      is_default: false,
      ingredients: [BLANK_INGREDIENT],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  React.useEffect(() => {
    if (!open) return;
    if (recipe) {
      form.reset({
        id: recipe.id,
        name: recipe.name,
        notes: recipe.notes ?? '',
        is_default: recipe.is_default,
        ingredients: recipe.ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          calories_per_unit: ingredient.calories_per_unit,
          protein_g_per_unit: ingredient.protein_g_per_unit,
        })),
      });
    } else {
      form.reset({ name: '', notes: '', is_default: false, ingredients: [BLANK_INGREDIENT] });
    }
  }, [open, recipe, form]);

  const watched = form.watch('ingredients');
  const nutrition = React.useMemo(
    () =>
      calculateRecipeNutrition(
        (watched ?? []).map((ingredient) => ({
          quantity: Number(ingredient?.quantity) || 0,
          calories_per_unit: Number(ingredient?.calories_per_unit) || 0,
          protein_g_per_unit: Number(ingredient?.protein_g_per_unit) || 0,
        })),
      ),
    [watched],
  );

  function applyReference(index: number, referenceName: string) {
    const reference = INGREDIENT_REFERENCE.find((item) => item.name === referenceName);
    if (!reference) return;
    form.setValue(`ingredients.${index}.name`, reference.name);
    form.setValue(`ingredients.${index}.unit`, reference.unit);
    form.setValue(`ingredients.${index}.calories_per_unit`, reference.caloriesPerUnit);
    form.setValue(`ingredients.${index}.protein_g_per_unit`, reference.proteinPerUnit);
  }

  function onSubmit(values: ShakeRecipeInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await saveRecipe(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(recipe ? 'Recipe updated.' : 'Recipe saved.');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit recipe' : 'New recipe'}</DialogTitle>
          <DialogDescription>
            Quantities drive the estimate. Change one and the totals follow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-name">Name</Label>
            <Input id="recipe-name" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Ingredients</legend>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-xl border border-border p-3"
              >
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor={`ingredient-${index}-name`} className="text-xs">
                      Ingredient
                    </Label>
                    <Input
                      id={`ingredient-${index}-name`}
                      placeholder="e.g. Banana"
                      {...form.register(`ingredients.${index}.name`)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-${index}-qty`} className="text-xs">
                        Amount
                      </Label>
                      <Input
                        id={`ingredient-${index}-qty`}
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        {...form.register(`ingredients.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-${index}-unit`} className="text-xs">
                        Unit
                      </Label>
                      <Select
                        value={form.watch(`ingredients.${index}.unit`)}
                        onValueChange={(value) =>
                          form.setValue(`ingredients.${index}.unit`, value)
                        }
                      >
                        <SelectTrigger id={`ingredient-${index}-unit`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INGREDIENT_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-${index}-kcal`} className="text-xs">
                        kcal / unit
                      </Label>
                      <Input
                        id={`ingredient-${index}-kcal`}
                        type="number"
                        step="0.001"
                        inputMode="decimal"
                        {...form.register(`ingredients.${index}.calories_per_unit`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`ingredient-${index}-protein`} className="text-xs">
                        Protein / unit
                      </Label>
                      <Input
                        id={`ingredient-${index}-protein`}
                        type="number"
                        step="0.001"
                        inputMode="decimal"
                        {...form.register(`ingredients.${index}.protein_g_per_unit`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>

                  <Select onValueChange={(value) => applyReference(index, value)}>
                    <SelectTrigger className="h-9 text-sm" aria-label="Fill from a common ingredient">
                      <SelectValue placeholder="Fill from a common ingredient…" />
                    </SelectTrigger>
                    <SelectContent>
                      {INGREDIENT_REFERENCE.map((reference) => (
                        <SelectItem key={reference.name} value={reference.name}>
                          {reference.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  aria-label={`Remove ingredient ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(BLANK_INGREDIENT)}
            >
              <Plus className="size-4" />
              Add ingredient
            </Button>
          </fieldset>

          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Approximate total
            </p>
            <p className="tabular mt-1 font-display text-2xl">
              {nutrition.calories} kcal
              <span className="ml-2 text-base text-muted-foreground">
                {nutrition.proteinG} g protein
              </span>
            </p>
            <ApproximateNote className="mt-2" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipe-notes">Notes (optional)</Label>
            <Textarea id="recipe-notes" rows={2} {...form.register('notes')} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <Label htmlFor="is_default">Use as my default shake</Label>
              <p className="text-xs text-muted-foreground">
                Shown on shake habits across the app.
              </p>
            </div>
            <Switch
              id="is_default"
              checked={form.watch('is_default')}
              onCheckedChange={(checked) => form.setValue('is_default', checked)}
            />
          </div>

          {formError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save recipe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
