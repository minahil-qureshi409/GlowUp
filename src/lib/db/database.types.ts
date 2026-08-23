/**
 * Database types.
 *
 * Hand-maintained to match `supabase/migrations`, in the exact shape the
 * Supabase CLI emits — so `npm run db:types` can overwrite this file verbatim
 * once the project is linked, with no import changes anywhere else.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};


/*
 * Enum aliases are declared standalone, ahead of `Database`, rather than being
 * read back out of it. Referencing `Database['public']['Enums'][...]` from
 * inside the `Database` definition itself is circular, and TypeScript resolves
 * the whole schema to `never` when it hits that — which silently turns every
 * typed query into an untyped one.
 */
export type TimeFormat = '12h' | '24h';
export type ThemePref = 'light' | 'dark' | 'system';
export type DataSource = 'user' | 'seed';
export type HabitCategory = 'nutrition' | 'skincare' | 'workout' | 'recovery' | 'custom';
export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type CompletionStatus = 'completed' | 'skipped' | 'modified';
export type GoalType =
  | 'weight'
  | 'workout_frequency'
  | 'nutrition_consistency'
  | 'skincare_consistency'
  | 'strength'
  | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'archived';
export type MuscleGroup =
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'shoulders'
  | 'back'
  | 'chest'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full_body';
export type WorkoutLocation = 'office_gym' | 'home' | 'other';
export type WorkoutStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';
export type SkincarePeriod = 'am' | 'pm';
export type SkincareProductCategory =
  | 'cleanser'
  | 'toner'
  | 'serum'
  | 'treatment'
  | 'moisturizer'
  | 'spf'
  | 'other';
export type SkinCondition = 'good' | 'clear' | 'dry' | 'oily' | 'irritated' | 'breakout' | 'other';
export type PhotoCategory = 'full_body' | 'arms' | 'lower_body' | 'skin' | 'other';
export type WeekFeeling = 'great' | 'good' | 'okay' | 'difficult';
export type CalendarProvider = 'google' | 'apple' | 'outlook';
export type CalendarStatus = 'connected' | 'expired' | 'revoked' | 'error';
export type MilestoneKind = 'manual' | 'weight' | 'strength' | 'consistency' | 'skincare';


/*
 * Insert shapes are standalone aliases rather than being read back out of
 * `Database`. `Update: Partial<Database['public']['Tables'][X]['Insert']>` is
 * circular, and a circular schema fails the library's `GenericSchema`
 * constraint — which resolves `Schema` to `never` and silently unTypes every
 * query in the app. Keeping these acyclic is what makes the client typed.
 */
type ProfilesInsert = Partial<Timestamps> & {
    id: string;
    display_name?: string | null;
    height_cm?: number | null;
    birth_date?: string | null;
    timezone?: string;
    time_format?: TimeFormat;
    theme?: ThemePref;
    onboarding_completed_at?: string | null;
  };
type UserSettingsInsert = Partial<Timestamps> & {
    user_id: string;
    workouts_per_week?: number;
    preferred_workout_days?: number[];
    typical_work_start?: string | null;
    typical_work_end?: string | null;
    commute_minutes?: number | null;
    weekly_weigh_in_day?: number;
    notifications_enabled?: boolean;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
    max_daily_reminders?: number;
    suggestions_enabled?: boolean;
  };
type GymConfigsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    name: string;
    location?: string | null;
    access_start?: string | null;
    access_end?: string | null;
    available_days?: number[];
    equipment?: string[];
    is_default?: boolean;
    is_active?: boolean;
  };
type WeightEntriesInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    weight_kg: number;
    entry_date: string;
    note?: string | null;
    source?: DataSource;
  };
type GoalsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    type: GoalType;
    title: string;
    description?: string | null;
    start_value?: number | null;
    target_value?: number | null;
    unit?: string | null;
    status?: GoalStatus;
    is_primary?: boolean;
    achieved_at?: string | null;
  };
type GoalMilestonesInsert = {
    id?: string;
    user_id: string;
    goal_id: string;
    label: string;
    target_value: number;
    sort_order?: number;
    achieved_at?: string | null;
    created_at?: string;
  };
type ShakeRecipesInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    name: string;
    notes?: string | null;
    is_default?: boolean;
    source?: DataSource;
  };
type ShakeIngredientsInsert = {
    id?: string;
    user_id: string;
    recipe_id: string;
    name: string;
    quantity: number;
    unit?: string;
    calories_per_unit?: number;
    protein_g_per_unit?: number;
    sort_order?: number;
    created_at?: string;
  };
type HabitsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    name: string;
    category: HabitCategory;
    icon?: string | null;
    frequency?: HabitFrequency;
    target_per_week?: number | null;
    preferred_part?: DayPart;
    window_start?: string | null;
    window_end?: string | null;
    reminder_enabled?: boolean;
    is_optional?: boolean;
    is_active?: boolean;
    sort_order?: number;
    recipe_id?: string | null;
    source?: DataSource;
  };
type HabitCompletionsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    habit_id: string;
    log_date: string;
    status?: CompletionStatus;
    note?: string | null;
    modification?: string | null;
    completed_at?: string;
  };
type ExercisesInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    name: string;
    muscle_group: MuscleGroup;
    secondary_muscles?: MuscleGroup[];
    equipment?: string | null;
    is_bodyweight?: boolean;
    notes?: string | null;
    is_active?: boolean;
    source?: DataSource;
  };
type WorkoutTemplatesInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    name: string;
    focus?: string | null;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
    source?: DataSource;
  };
type WorkoutTemplateExercisesInsert = {
    id?: string;
    user_id: string;
    template_id: string;
    exercise_id: string;
    target_sets?: number;
    target_reps_min?: number;
    target_reps_max?: number;
    sort_order?: number;
    notes?: string | null;
    created_at?: string;
  };
type WorkoutsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    template_id?: string | null;
    name: string;
    workout_date: string;
    location?: WorkoutLocation;
    status?: WorkoutStatus;
    started_at?: string | null;
    completed_at?: string | null;
    duration_minutes?: number | null;
    notes?: string | null;
    source?: DataSource;
  };
type WorkoutExercisesInsert = {
    id?: string;
    user_id: string;
    workout_id: string;
    exercise_id: string;
    sort_order?: number;
    notes?: string | null;
    created_at?: string;
  };
type ExerciseSetsInsert = {
    id?: string;
    user_id: string;
    workout_exercise_id: string;
    set_index: number;
    reps?: number | null;
    weight_kg?: number | null;
    rpe?: number | null;
    is_warmup?: boolean;
    completed?: boolean;
    created_at?: string;
  };
type SkincareProductsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    name: string;
    brand?: string | null;
    category?: SkincareProductCategory;
    notes?: string | null;
    is_active?: boolean;
    source?: DataSource;
  };
type SkincareRoutinesInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    period: SkincarePeriod;
    name: string;
    is_active?: boolean;
  };
type SkincareRoutineStepsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    routine_id: string;
    product_id?: string | null;
    label?: string | null;
    sort_order?: number;
    is_optional?: boolean;
    is_active?: boolean;
  };
type SkincareEntriesInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    log_date: string;
    period: SkincarePeriod;
    status?: CompletionStatus;
    note?: string | null;
  };
type SkincareStepCompletionsInsert = {
    id?: string;
    user_id: string;
    entry_id: string;
    step_id: string;
    status?: CompletionStatus;
    note?: string | null;
    created_at?: string;
  };
type SkinLogsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    log_date: string;
    conditions?: SkinCondition[];
    note?: string | null;
  };
type ProgressPhotosInsert = {
    id?: string;
    user_id: string;
    storage_path: string;
    category?: PhotoCategory;
    taken_on: string;
    note?: string | null;
    created_at?: string;
  };
type WeeklyReviewsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    week_start: string;
    start_weight_kg?: number | null;
    end_weight_kg?: number | null;
    feeling?: WeekFeeling | null;
    notes?: string | null;
    stats?: Json;
  };
type TimelineMilestonesInsert = {
    id?: string;
    user_id: string;
    occurred_on: string;
    title: string;
    description?: string | null;
    kind?: MilestoneKind;
    created_at?: string;
  };
type CalendarConnectionsInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    provider: CalendarProvider;
    account_email?: string | null;
    scopes?: string[];
    status?: CalendarStatus;
    last_synced_at?: string | null;
    last_error?: string | null;
    connected_at?: string;
  };
type CalendarCredentialsInsert = Partial<Timestamps> & {
    connection_id: string;
    user_id: string;
    /** Legacy plaintext columns. Written null; dropped in a later migration. */
    access_token?: string | null;
    refresh_token?: string | null;
    encrypted_access_token?: string | null;
    encrypted_refresh_token?: string | null;
    token_expires_at?: string | null;
    token_version?: number;
  };
type CalendarEventMetadataInsert = {
    id?: string;
    user_id: string;
    connection_id: string;
    day: string;
    starts_at: string;
    ends_at: string;
    is_busy?: boolean;
    fetched_at?: string;
  };
type RemindersInsert = Partial<Timestamps> & {
    id?: string;
    user_id: string;
    habit_id?: string | null;
    kind?: string;
    enabled?: boolean;
    earliest_at?: string | null;
    last_sent_at?: string | null;
  };
type SuggestionDismissalsInsert = {
    id?: string;
    user_id: string;
    suggestion_key: string;
    dismissed_for: string;
    created_at?: string;
  };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Timestamps & {
          id: string;
          display_name: string | null;
          height_cm: number | null;
          birth_date: string | null;
          timezone: string;
          time_format: TimeFormat;
          theme: ThemePref;
          onboarding_completed_at: string | null;
        };
        Insert: ProfilesInsert;
        Update: Partial<ProfilesInsert>;
        Relationships: [];
      };
      user_settings: {
        Row: Timestamps & {
          user_id: string;
          workouts_per_week: number;
          preferred_workout_days: number[];
          typical_work_start: string | null;
          typical_work_end: string | null;
          commute_minutes: number | null;
          weekly_weigh_in_day: number;
          notifications_enabled: boolean;
          quiet_hours_start: string;
          quiet_hours_end: string;
          max_daily_reminders: number;
          suggestions_enabled: boolean;
        };
        Insert: UserSettingsInsert;
        Update: Partial<UserSettingsInsert>;
        Relationships: [];
      };
      gym_configs: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          location: string | null;
          access_start: string | null;
          access_end: string | null;
          available_days: number[];
          equipment: string[];
          is_default: boolean;
          is_active: boolean;
        };
        Insert: GymConfigsInsert;
        Update: Partial<GymConfigsInsert>;
        Relationships: [];
      };
      weight_entries: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          weight_kg: number;
          entry_date: string;
          note: string | null;
          source: DataSource;
        };
        Insert: WeightEntriesInsert;
        Update: Partial<WeightEntriesInsert>;
        Relationships: [];
      };
      goals: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          type: GoalType;
          title: string;
          description: string | null;
          start_value: number | null;
          target_value: number | null;
          unit: string | null;
          status: GoalStatus;
          is_primary: boolean;
          achieved_at: string | null;
        };
        Insert: GoalsInsert;
        Update: Partial<GoalsInsert>;
        Relationships: [];
      };
      goal_milestones: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          label: string;
          target_value: number;
          sort_order: number;
          achieved_at: string | null;
          created_at: string;
        };
        Insert: GoalMilestonesInsert;
        Update: Partial<GoalMilestonesInsert>;
        Relationships: [
          {
            foreignKeyName: 'goal_milestones_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'goals';
            referencedColumns: ['id'];
          },
        ];
      };
      shake_recipes: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          notes: string | null;
          is_default: boolean;
          source: DataSource;
        };
        Insert: ShakeRecipesInsert;
        Update: Partial<ShakeRecipesInsert>;
        Relationships: [];
      };
      shake_ingredients: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          name: string;
          quantity: number;
          unit: string;
          calories_per_unit: number;
          protein_g_per_unit: number;
          sort_order: number;
          created_at: string;
        };
        Insert: ShakeIngredientsInsert;
        Update: Partial<ShakeIngredientsInsert>;
        Relationships: [
          {
            foreignKeyName: 'shake_ingredients_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'shake_recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      habits: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          category: HabitCategory;
          icon: string | null;
          frequency: HabitFrequency;
          target_per_week: number | null;
          preferred_part: DayPart;
          window_start: string | null;
          window_end: string | null;
          reminder_enabled: boolean;
          is_optional: boolean;
          is_active: boolean;
          sort_order: number;
          recipe_id: string | null;
          source: DataSource;
        };
        Insert: HabitsInsert;
        Update: Partial<HabitsInsert>;
        Relationships: [
          {
            foreignKeyName: 'habits_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'shake_recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      habit_completions: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          habit_id: string;
          log_date: string;
          status: CompletionStatus;
          note: string | null;
          modification: string | null;
          completed_at: string;
        };
        Insert: HabitCompletionsInsert;
        Update: Partial<HabitCompletionsInsert>;
        Relationships: [
          {
            foreignKeyName: 'habit_completions_habit_id_fkey';
            columns: ['habit_id'];
            isOneToOne: false;
            referencedRelation: 'habits';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          muscle_group: MuscleGroup;
          secondary_muscles: MuscleGroup[];
          equipment: string | null;
          is_bodyweight: boolean;
          notes: string | null;
          is_active: boolean;
          source: DataSource;
        };
        Insert: ExercisesInsert;
        Update: Partial<ExercisesInsert>;
        Relationships: [];
      };
      workout_templates: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          focus: string | null;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          source: DataSource;
        };
        Insert: WorkoutTemplatesInsert;
        Update: Partial<WorkoutTemplatesInsert>;
        Relationships: [];
      };
      workout_template_exercises: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          exercise_id: string;
          target_sets: number;
          target_reps_min: number;
          target_reps_max: number;
          sort_order: number;
          notes: string | null;
          created_at: string;
        };
        Insert: WorkoutTemplateExercisesInsert;
        Update: Partial<WorkoutTemplateExercisesInsert>;
        Relationships: [
          {
            foreignKeyName: 'workout_template_exercises_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'workout_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_template_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      workouts: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          template_id: string | null;
          name: string;
          workout_date: string;
          location: WorkoutLocation;
          status: WorkoutStatus;
          started_at: string | null;
          completed_at: string | null;
          duration_minutes: number | null;
          notes: string | null;
          source: DataSource;
        };
        Insert: WorkoutsInsert;
        Update: Partial<WorkoutsInsert>;
        Relationships: [
          {
            foreignKeyName: 'workouts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'workout_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_exercises: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          sort_order: number;
          notes: string | null;
          created_at: string;
        };
        Insert: WorkoutExercisesInsert;
        Update: Partial<WorkoutExercisesInsert>;
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_sets: {
        Row: {
          id: string;
          user_id: string;
          workout_exercise_id: string;
          set_index: number;
          reps: number | null;
          weight_kg: number | null;
          rpe: number | null;
          is_warmup: boolean;
          completed: boolean;
          created_at: string;
        };
        Insert: ExerciseSetsInsert;
        Update: Partial<ExerciseSetsInsert>;
        Relationships: [
          {
            foreignKeyName: 'exercise_sets_workout_exercise_id_fkey';
            columns: ['workout_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      skincare_products: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          brand: string | null;
          category: SkincareProductCategory;
          notes: string | null;
          is_active: boolean;
          source: DataSource;
        };
        Insert: SkincareProductsInsert;
        Update: Partial<SkincareProductsInsert>;
        Relationships: [];
      };
      skincare_routines: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          period: SkincarePeriod;
          name: string;
          is_active: boolean;
        };
        Insert: SkincareRoutinesInsert;
        Update: Partial<SkincareRoutinesInsert>;
        Relationships: [];
      };
      skincare_routine_steps: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          routine_id: string;
          product_id: string | null;
          label: string | null;
          sort_order: number;
          is_optional: boolean;
          is_active: boolean;
        };
        Insert: SkincareRoutineStepsInsert;
        Update: Partial<SkincareRoutineStepsInsert>;
        Relationships: [
          {
            foreignKeyName: 'skincare_routine_steps_routine_id_fkey';
            columns: ['routine_id'];
            isOneToOne: false;
            referencedRelation: 'skincare_routines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'skincare_routine_steps_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'skincare_products';
            referencedColumns: ['id'];
          },
        ];
      };
      skincare_entries: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          log_date: string;
          period: SkincarePeriod;
          status: CompletionStatus;
          note: string | null;
        };
        Insert: SkincareEntriesInsert;
        Update: Partial<SkincareEntriesInsert>;
        Relationships: [];
      };
      skincare_step_completions: {
        Row: {
          id: string;
          user_id: string;
          entry_id: string;
          step_id: string;
          status: CompletionStatus;
          note: string | null;
          created_at: string;
        };
        Insert: SkincareStepCompletionsInsert;
        Update: Partial<SkincareStepCompletionsInsert>;
        Relationships: [
          {
            foreignKeyName: 'skincare_step_completions_entry_id_fkey';
            columns: ['entry_id'];
            isOneToOne: false;
            referencedRelation: 'skincare_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'skincare_step_completions_step_id_fkey';
            columns: ['step_id'];
            isOneToOne: false;
            referencedRelation: 'skincare_routine_steps';
            referencedColumns: ['id'];
          },
        ];
      };
      skin_logs: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          log_date: string;
          conditions: SkinCondition[];
          note: string | null;
        };
        Insert: SkinLogsInsert;
        Update: Partial<SkinLogsInsert>;
        Relationships: [];
      };
      progress_photos: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          category: PhotoCategory;
          taken_on: string;
          note: string | null;
          created_at: string;
        };
        Insert: ProgressPhotosInsert;
        Update: Partial<ProgressPhotosInsert>;
        Relationships: [];
      };
      weekly_reviews: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          week_start: string;
          start_weight_kg: number | null;
          end_weight_kg: number | null;
          feeling: WeekFeeling | null;
          notes: string | null;
          stats: Json;
        };
        Insert: WeeklyReviewsInsert;
        Update: Partial<WeeklyReviewsInsert>;
        Relationships: [];
      };
      timeline_milestones: {
        Row: {
          id: string;
          user_id: string;
          occurred_on: string;
          title: string;
          description: string | null;
          kind: MilestoneKind;
          created_at: string;
        };
        Insert: TimelineMilestonesInsert;
        Update: Partial<TimelineMilestonesInsert>;
        Relationships: [];
      };
      calendar_connections: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          provider: CalendarProvider;
          account_email: string | null;
          scopes: string[];
          status: CalendarStatus;
          last_synced_at: string | null;
          last_error: string | null;
          connected_at: string;
        };
        Insert: CalendarConnectionsInsert;
        Update: Partial<CalendarConnectionsInsert>;
        Relationships: [];
      };
      calendar_credentials: {
        Row: Timestamps & {
          connection_id: string;
          user_id: string;
          access_token: string | null;
          refresh_token: string | null;
          encrypted_access_token: string | null;
          encrypted_refresh_token: string | null;
          token_expires_at: string | null;
          token_version: number;
        };
        Insert: CalendarCredentialsInsert;
        Update: Partial<CalendarCredentialsInsert>;
        Relationships: [
          {
            foreignKeyName: 'calendar_credentials_connection_id_fkey';
            columns: ['connection_id'];
            isOneToOne: false;
            referencedRelation: 'calendar_connections';
            referencedColumns: ['id'];
          },
        ];
      };
      calendar_event_metadata: {
        Row: {
          id: string;
          user_id: string;
          connection_id: string;
          day: string;
          starts_at: string;
          ends_at: string;
          is_busy: boolean;
          fetched_at: string;
        };
        Insert: CalendarEventMetadataInsert;
        Update: Partial<CalendarEventMetadataInsert>;
        Relationships: [
          {
            foreignKeyName: 'calendar_event_metadata_connection_id_fkey';
            columns: ['connection_id'];
            isOneToOne: false;
            referencedRelation: 'calendar_connections';
            referencedColumns: ['id'];
          },
        ];
      };
      reminders: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          habit_id: string | null;
          kind: string;
          enabled: boolean;
          earliest_at: string | null;
          last_sent_at: string | null;
        };
        Insert: RemindersInsert;
        Update: Partial<RemindersInsert>;
        Relationships: [
          {
            foreignKeyName: 'reminders_habit_id_fkey';
            columns: ['habit_id'];
            isOneToOne: false;
            referencedRelation: 'habits';
            referencedColumns: ['id'];
          },
        ];
      };
      suggestion_dismissals: {
        Row: {
          id: string;
          user_id: string;
          suggestion_key: string;
          dismissed_for: string;
          created_at: string;
        };
        Insert: SuggestionDismissalsInsert;
        Update: Partial<SuggestionDismissalsInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      seed_user_defaults: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      time_format: TimeFormat;
      theme_pref: ThemePref;
      data_source: DataSource;
      habit_category: HabitCategory;
      habit_frequency: HabitFrequency;
      day_part: DayPart;
      completion_status: CompletionStatus;
      goal_type: GoalType;
      goal_status: GoalStatus;
      muscle_group: MuscleGroup;
      workout_location: WorkoutLocation;
      workout_status: WorkoutStatus;
      skincare_period: SkincarePeriod;
      skincare_product_category: SkincareProductCategory;
      skin_condition: SkinCondition;
      photo_category: PhotoCategory;
      week_feeling: WeekFeeling;
      calendar_provider: CalendarProvider;
      calendar_status: CalendarStatus;
      milestone_kind: MilestoneKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

/** `DayPart` reads better than the full index chain at call sites. */
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
