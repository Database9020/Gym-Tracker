// ============================================================================
//  EXERCISE LIST  —  edit this file to add, remove or reorder exercises.
// ============================================================================
//
//  - Each body part maps to a list of exercise names, shown in this order.
//  - Your logged history is stored by exercise NAME, so:
//      * Adding or removing an exercise here never deletes any history.
//      * Removing one just hides it; add it back and its history reappears.
//      * Renaming one starts a fresh history under the new name (the old
//        entries stay in the database under the old name).
//  - SETS_PER_EXERCISE controls how many set rows each exercise shows.
//
// ============================================================================

export const SETS_PER_EXERCISE = 4;

export const EXERCISES = {
  Arms: [
    'Bicep Curl Machine',
    'Tricep Curl Machine',
    'Hammer Curl',
    'Overhead Rope Tricep Extension',
  ],
  Chest: [
    'Incline Bench Press Machine',
    'Flat Bench Press Machine',
    'Cable Fly',
    'Pec Deck',
  ],
  Back: [
    'Bent Over Barbell Row',
    'Deadlift',
    'Seated Cable Row',
    'Lat Pulldown',
  ],
  Shoulders: [
    'Shoulder Press Machine',
    'Lateral Raise Machine',
    'Reverse Pec Deck',
    'Shrugs',
  ],
  Legs: [
    'Leg Press Machine',
    'Leg Curl Machine',
    'Leg Extension Machine',
    'Calf Raises',
  ],
};

export const BODY_PARTS = Object.keys(EXERCISES);
