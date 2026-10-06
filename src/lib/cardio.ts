import type { CardioInput, WorkoutExercise } from './workoutStorage';
import type { CardioRecord } from './postStorage';

export const emptyCardioInput = (): CardioInput => ({ durationMinutes: '', distanceKm: '', speedKmh: '', inclinePercent: '', resistanceLevel: '', paceSeconds: '', floors: '' });

export const cardioOptionalFields = ['distanceKm', 'speedKmh', 'inclinePercent', 'resistanceLevel', 'paceSeconds', 'floors'] as const;
type CardioField = Exclude<keyof CardioInput, 'caloriesKcal'>;
export function cardioFields(name: string): CardioField[] {
  const kind = name.toUpperCase();
  if (/STAIR/.test(kind)) return ['durationMinutes', 'resistanceLevel', 'floors'];
  if (/ROW/.test(kind)) return ['durationMinutes', 'distanceKm', 'paceSeconds'];
  if (/BIKE|CYCL/.test(kind)) return ['durationMinutes', 'distanceKm', 'speedKmh', 'resistanceLevel'];
  return ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent'];
}

function metric(value: string | undefined, label: string, required = false): number | null {
  const text = (value ?? '').trim().replace(',', '.');
  if (!text && !required) return null;
  const numeric = Number(text);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(numeric) || numeric >= 1e15 ||
      numeric < 0) {
    throw new Error(`${label}: enter a non-negative number.`);
  }
  return numeric;
}

export function cardioTime(value: string | undefined, pace = false): number | null {
  const text = value?.trim() ?? '';
  if (pace && !text) return null;
  if (/^\d+:[0-5]\d$/.test(text)) {
    const [minutes, seconds] = text.split(':').map(Number);
    const total = minutes * 60 + seconds;
    if (total < 1e15) return pace ? total : total / 60;
  } else if (!pace && !text.includes(':')) return metric(text, 'Duration (min or m:ss)', true);
  throw new Error(`${pace ? 'Pace' : 'Duration'}: enter m:ss with seconds from 00 to 59.`);
}

export function formatCardioTime(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function cardioRecord(exercise: Pick<WorkoutExercise, 'cardio' | 'note'>): CardioRecord {
  const input = exercise.cardio ?? emptyCardioInput();
  if (exercise.note.length > 10000) throw new Error('Memo must be 10,000 characters or fewer.');
  return {
    durationMinutes: cardioTime(input.durationMinutes)!,
    distanceKm: metric(input.distanceKm, 'Distance (km)'),
    speedKmh: metric(input.speedKmh, 'Speed (km/h)'),
    inclinePercent: metric(input.inclinePercent, 'Incline (%)'),
    resistanceLevel: metric(input.resistanceLevel, 'Resistance level'),
    paceSeconds: cardioTime(input.paceSeconds, true),
    floors: metric(input.floors, 'Floors'),
  };
}

export function completedWorkoutExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises.map(exercise => {
    if (exercise.type === 'cardio') {
      try { cardioRecord(exercise); }
      catch (error) { throw new Error(`${exercise.name}: ${(error as Error).message}`); }
      const { caloriesKcal: _legacyCalories, ...cardio } = exercise.cardio ?? emptyCardioInput();
      return { ...exercise, cardio, sets: [] };
    }
    return { ...exercise, sets: exercise.sets.filter(set => set.completed) };
  }).filter(exercise => exercise.type === 'cardio' || exercise.sets.length > 0);
}

export function cardioSummary(record: CardioRecord) {
  return [ formatCardioTime(record.durationMinutes * 60),
    record.distanceKm != null ? `${record.distanceKm} km` : null,
    record.speedKmh != null ? `${record.speedKmh} km/h` : null,
    record.inclinePercent != null ? `Incline ${record.inclinePercent}%` : null,
    record.resistanceLevel != null ? `Level ${record.resistanceLevel}` : null,
    record.paceSeconds != null ? `${formatCardioTime(record.paceSeconds)} / 500m` : null,
    record.floors != null ? `${record.floors} floors` : null,
  ].filter(Boolean).join(' · ');
}

export function cardioTotals(exercises: { type?: string; cardio?: CardioInput | CardioRecord }[]) {
  const cardio = exercises.filter(exercise => exercise.type === 'cardio');
  const total = (field: 'durationMinutes' | 'distanceKm') => cardio.reduce((sum, exercise) => {
    const raw = exercise.cardio?.[field];
    let value: number;
    try { value = field === 'durationMinutes' && typeof raw === 'string' ? cardioTime(raw) ?? 0 : Number(typeof raw === 'string' ? raw.replace(',', '.') : raw); }
    catch { value = 0; }
    return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);
  const distanceKm = Number(total('distanceKm').toFixed(2));
  return {
    onlyCardio: exercises.length > 0 && cardio.length === exercises.length,
    durationMinutes: Number(total('durationMinutes').toFixed(2)),
    distanceKm,
    distanceLabel: cardio.some(exercise => exercise.cardio?.distanceKm != null && exercise.cardio.distanceKm !== '') ? `${distanceKm} km` : '—',
  };
}
