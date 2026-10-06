import { setResult, setResultLabel } from './setResult';
import type { WorkoutSession } from './workoutStorage';
import { cardioTime, formatCardioTime } from './cardio';

// Blank/invalid input must not turn into an invented zero in a shared workout.
function metric(value: string | undefined, positive = false): string | null {
  const text = value?.trim().replace(',', '.');
  if (!text || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || (positive && number <= 0)) return null;
  return String(number);
}

export function workoutToText(workout: Pick<WorkoutSession, 'exercises'>): string {
  return workout.exercises.map(exercise => {
    const name = exercise.name.trim();
    if (exercise.type === 'cardio') {
      let duration: number | null = null;
      let pace: number | null = null;
      try { duration = cardioTime(exercise.cardio?.durationMinutes); } catch { /* Ignore invalid draft values. */ }
      try { pace = cardioTime(exercise.cardio?.paceSeconds, true); } catch { /* Ignore invalid draft values. */ }
      const distance = metric(exercise.cardio?.distanceKm);
      const speed = metric(exercise.cardio?.speedKmh);
      const incline = metric(exercise.cardio?.inclinePercent);
      const resistance = metric(exercise.cardio?.resistanceLevel);
      const floors = metric(exercise.cardio?.floors);
      const memo = exercise.note?.trim();
      return [
        name,
        `Duration: ${duration !== null ? `${duration} min` : '—'}`,
        distance !== null ? `Distance: ${distance} km` : null,
        speed !== null ? `Speed: ${speed} km/h` : null,
        incline !== null ? `Incline: ${incline}%` : null,
        resistance !== null ? `Level: ${resistance}` : null,
        pace !== null ? `Pace: ${formatCardioTime(pace)} / 500m` : null,
        floors !== null ? `Floors: ${floors}` : null,
        memo ? `Memo: ${memo}` : null,
      ].filter(Boolean).join('\n');
    }

    // Legacy records without type remain Strength; never infer type from the name.
    const sets = exercise.sets.filter(set => set.completed).flatMap(set => {
      const weight = metric(set.weight);
      const reps = metric(set.reps, setResult(set) === 'completed');
      const suffix = setResultLabel(set) ? ` / ${setResultLabel(set)}` : '';
      if (weight !== null && reps !== null) return [`${weight}kg x ${reps}${setResultLabel(set) ? ` / ${setResultLabel(set)}` : ''}`];
      if (weight !== null) return [`${weight}kg${suffix}`];
      if (reps !== null) return [`${reps} reps${suffix}`];
      return [];
    });
    return sets.length ? [name, ...sets].filter(Boolean).join('\n') : '';
  }).filter(Boolean).join('\n\n');
}
