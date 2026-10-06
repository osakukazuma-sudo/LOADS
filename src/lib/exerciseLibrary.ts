import type { ExerciseType } from './workoutStorage';
export type ExerciseCategory = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'cardio';
export type ExerciseDefinition = { name: string; type: ExerciseType; category: ExerciseCategory; bodyPart: ExerciseCategory; equipment: string; variation: string; aliases: string[] };
export const EXERCISE_CATEGORIES: ExerciseCategory[] = ['chest','back','legs','shoulders','arms','cardio'];
export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  {
    "name": "BENCH PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "ベンチ",
      "ベンチプレス",
      "胸",
      "Barbell Bench Press"
    ]
  },
  {
    "name": "INCLINE BENCH PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "barbell",
    "variation": "incline",
    "aliases": [
      "インクライン",
      "インクラインベンチ",
      "胸",
      "Incline Barbell Bench Press"
    ]
  },
  {
    "name": "DUMBBELL BENCH PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "dumbbell",
    "variation": "standard",
    "aliases": [
      "ダンベルベンチ",
      "胸"
    ]
  },
  {
    "name": "INCLINE DUMBBELL PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "dumbbell",
    "variation": "incline",
    "aliases": [
      "インクラインダンベル",
      "ダンベルインクライン",
      "胸",
      "Dumbbell Incline Bench Press"
    ]
  },
  {
    "name": "CHEST PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "チェストプレス",
      "胸"
    ]
  },
  {
    "name": "PEC FLY",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ペックフライ",
      "胸"
    ]
  },
  {
    "name": "CABLE FLY",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "cable",
    "variation": "standard",
    "aliases": [
      "ケーブルフライ",
      "胸"
    ]
  },
  {
    "name": "DIPS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "bodyweight",
    "variation": "standard",
    "aliases": [
      "ディップス",
      "胸"
    ]
  },
  {
    "name": "DEADLIFT",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "デッドリフト",
      "背中"
    ]
  },
  {
    "name": "LAT PULLDOWN",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ラットプル",
      "ラットプルダウン",
      "背中"
    ]
  },
  {
    "name": "PULL UP",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "bodyweight",
    "variation": "standard",
    "aliases": [
      "懸垂",
      "プルアップ",
      "背中"
    ]
  },
  {
    "name": "CHIN UP",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "bodyweight",
    "variation": "standard",
    "aliases": [
      "チンアップ",
      "背中"
    ]
  },
  {
    "name": "BARBELL ROW",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "バーベルロウ",
      "背中"
    ]
  },
  {
    "name": "DUMBBELL ROW",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "dumbbell",
    "variation": "standard",
    "aliases": [
      "ダンベルロウ",
      "背中"
    ]
  },
  {
    "name": "SEATED CABLE ROW",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "cable",
    "variation": "standard",
    "aliases": [
      "シーテッドロウ",
      "ケーブルロウ",
      "背中"
    ]
  },
  {
    "name": "T-BAR ROW",
    "type": "strength",
    "category": "back",
    "bodyPart": "back",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ティーバーロウ",
      "背中"
    ]
  },
  {
    "name": "OVERHEAD PRESS",
    "type": "strength",
    "category": "shoulders",
    "bodyPart": "shoulders",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "オーバーヘッドプレス",
      "肩"
    ]
  },
  {
    "name": "DUMBBELL SHOULDER PRESS",
    "type": "strength",
    "category": "shoulders",
    "bodyPart": "shoulders",
    "equipment": "dumbbell",
    "variation": "standard",
    "aliases": [
      "ダンベルショルダープレス",
      "肩"
    ]
  },
  {
    "name": "LATERAL RAISE",
    "type": "strength",
    "category": "shoulders",
    "bodyPart": "shoulders",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "サイドレイズ",
      "ラテラルレイズ",
      "肩"
    ]
  },
  {
    "name": "CABLE LATERAL RAISE",
    "type": "strength",
    "category": "shoulders",
    "bodyPart": "shoulders",
    "equipment": "cable",
    "variation": "standard",
    "aliases": [
      "ケーブルサイドレイズ",
      "肩"
    ]
  },
  {
    "name": "REAR DELT FLY",
    "type": "strength",
    "category": "shoulders",
    "bodyPart": "shoulders",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "リアデルトフライ",
      "肩"
    ]
  },
  {
    "name": "FACE PULL",
    "type": "strength",
    "category": "shoulders",
    "bodyPart": "shoulders",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "フェイスプル",
      "肩"
    ]
  },
  {
    "name": "SQUAT",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "スクワット",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "FRONT SQUAT",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "フロントスクワット",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "LEG PRESS",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "レッグプレス",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "HACK SQUAT",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ハックスクワット",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "ROMANIAN DEADLIFT",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "ルーマニアンデッドリフト",
      "RDL",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "LEG EXTENSION",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "レッグエクステンション",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "LEG CURL",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "レッグカール",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "CALF RAISE",
    "type": "strength",
    "category": "legs",
    "bodyPart": "legs",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "カーフレイズ",
      "脚",
      "下半身"
    ]
  },
  {
    "name": "BARBELL CURL",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "バーベルカール",
      "腕"
    ]
  },
  {
    "name": "DUMBBELL CURL",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "dumbbell",
    "variation": "standard",
    "aliases": [
      "ダンベルカール",
      "腕"
    ]
  },
  {
    "name": "HAMMER CURL",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ハンマーカール",
      "腕"
    ]
  },
  {
    "name": "CABLE CURL",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "cable",
    "variation": "standard",
    "aliases": [
      "ケーブルカール",
      "腕"
    ]
  },
  {
    "name": "TRICEPS PUSHDOWN",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "トライセプスプッシュダウン",
      "腕"
    ]
  },
  {
    "name": "TRICEPS EXTENSION",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "トライセプスエクステンション",
      "腕"
    ]
  },
  {
    "name": "SKULL CRUSHER",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "スカルクラッシャー",
      "腕"
    ]
  },
  {
    "name": "CLOSE GRIP BENCH PRESS",
    "type": "strength",
    "category": "arms",
    "bodyPart": "arms",
    "equipment": "barbell",
    "variation": "standard",
    "aliases": [
      "クローズグリップベンチ",
      "ナローベンチ",
      "腕",
      "Close-Grip Bench Press",
      "胸"
    ]
  },
  {
    "name": "RUNNING",
    "type": "cardio",
    "category": "cardio",
    "bodyPart": "cardio",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ランニング",
      "Treadmill",
      "トレッドミル",
      "ラン",
      "走る",
      "有酸素",
      "カーディオ"
    ]
  },
  {
    "name": "WALKING",
    "type": "cardio",
    "category": "cardio",
    "bodyPart": "cardio",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ウォーキング",
      "Incline Walk",
      "インクラインウォーク",
      "散歩",
      "歩く",
      "有酸素",
      "カーディオ"
    ]
  },
  {
    "name": "CYCLING",
    "type": "cardio",
    "category": "cardio",
    "bodyPart": "cardio",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "サイクリング",
      "Bike",
      "自転車",
      "バイク",
      "有酸素",
      "カーディオ"
    ]
  },
  {
    "name": "STAIR CLIMBER",
    "type": "cardio",
    "category": "cardio",
    "bodyPart": "cardio",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ステアクライマー",
      "階段",
      "有酸素",
      "カーディオ"
    ]
  },
  {
    "name": "ROWING",
    "type": "cardio",
    "category": "cardio",
    "bodyPart": "cardio",
    "equipment": "machine",
    "variation": "standard",
    "aliases": [
      "ローイング",
      "有酸素",
      "カーディオ"
    ]
  },
  {
    "name": "SMITH MACHINE BENCH PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "smith",
    "variation": "standard",
    "aliases": [
      "スミスベンチ",
      "スミスマシンベンチ",
      "胸"
    ]
  },
  {
    "name": "SMITH MACHINE INCLINE BENCH PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "smith",
    "variation": "incline",
    "aliases": [
      "スミスインクライン",
      "スミスマシンインクラインベンチ",
      "胸"
    ]
  },
  {
    "name": "PAUSED BENCH PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "barbell",
    "variation": "paused",
    "aliases": [
      "ポーズベンチ",
      "ポーズドベンチ",
      "胸"
    ]
  },
  {
    "name": "LARSEN PRESS",
    "type": "strength",
    "category": "chest",
    "bodyPart": "chest",
    "equipment": "barbell",
    "variation": "larsen",
    "aliases": [
      "ラーセンプレス",
      "ラーセン",
      "胸"
    ]
  }
];
export function normalizeExerciseSearch(value: string) { return value.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, ''); }
export function searchExercises(query: string, category: ExerciseCategory | null = null) {
 const terms = query.normalize('NFKC').trim().split(/\s+/).map(normalizeExerciseSearch).filter(Boolean);
 return EXERCISE_LIBRARY.filter(e => terms.length ? terms.every(term => [e.name,...e.aliases].some(value => normalizeExerciseSearch(value).includes(term))) : category !== null && (e.category === category || (category === 'chest' && e.name === 'CLOSE GRIP BENCH PRESS')));
}
