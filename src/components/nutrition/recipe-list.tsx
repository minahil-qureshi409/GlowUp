'use client';

import * as React from 'react';
import { Copy, MoreHorizontal, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RecipeEditor } from '@/components/nutrition/recipe-editor';
import { deleteRecipe, duplicateRecipe, setDefaultRecipe } from '@/server/actions/nutrition';
import type { RecipeWithIngredients } from '@/services/nutrition';
import type { RecipeNutrition } from '@/lib/domain/nutrition';

type RecipeListProps = {
  recipes: (RecipeWithIngredients & { nutrition: RecipeNutrition })[];
};

export function RecipeList({ recipes }: RecipeListProps) {
  const [editing, setEditing] = React.useState<RecipeWithIngredients | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? 'That did not work.');
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{recipe.name}</h3>
                      {recipe.is_default ? <Badge variant="default">Default</Badge> : null}
                    </div>
                    <p className="tabular mt-1 text-sm text-muted-foreground">
                      ≈ {recipe.nutrition.calories} kcal · {recipe.nutrition.proteinG} g protein
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Options for ${recipe.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(recipe)}>
                        <Pencil aria-hidden="true" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => run(() => duplicateRecipe(recipe.id), 'Recipe duplicated.')}
                      >
                        <Copy aria-hidden="true" />
                        Duplicate
                      </DropdownMenuItem>
                      {!recipe.is_default ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            run(() => setDefaultRecipe(recipe.id), 'Set as your default shake.')
                          }
                        >
                          <Star aria-hidden="true" />
                          Set as default
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem destructive onSelect={() => setDeletingId(recipe.id)}>
                        <Trash2 aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <ul className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient.id} className="flex justify-between gap-3">
                      <span className="truncate text-muted-foreground">{ingredient.name}</span>
                      <span className="tabular shrink-0">
                        {ingredient.quantity} {ingredient.unit}
                      </span>
                    </li>
                  ))}
                </ul>

                {recipe.notes ? (
                  <p className="mt-3 text-xs text-muted-foreground">{recipe.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
        <Plus className="size-4" />
        New recipe
      </Button>

      <RecipeEditor
        open={creating || editing !== null}
        recipe={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
          <AlertDialogDescription>
            Habits that use it will stay, they just will not show an estimate any more.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) run(() => deleteRecipe(deletingId), 'Recipe deleted.');
                setDeletingId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
