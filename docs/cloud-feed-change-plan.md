> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# LOADS クラウド投稿：変更範囲の調査

> この文書は実装前の計画です。実装とStorage/RLS適用は完了し、2026-09-28の再開作業で実DB設定と投稿認可を確認済みです。最新状況は [supabase-current-state.md](supabase-current-state.md)、残る実機／写真API確認は [cloud-feed-verification.md](cloud-feed-verification.md) を参照してください。

調査日: 2026-09-28。アプリコード・DBの変更は行っていません。

## ソースの確認状況

- origin: https://github.com/YOUR_GITHUB_ACCOUNT/LOADS.git
- ローカル main: `11ad446c912fe248426b5c61e65c201e99541e2b`（Add Supabase integration and app updates）。
- 保存済み origin/main も同じコミット。調査開始時の作業ツリーはクリーン。
- **GitHub mainとローカルHEADの一致を確認済み**。ログイン後のGitHub main画面の最新コミットリンクは `11ad446c912fe248426b5c61e65c201e99541e2b`。ローカルの `git rev-parse HEAD` と完全一致し、`git diff --stat HEAD` は空。したがって追跡対象ファイルの構成・内容は同じコミットのもの。Git fetchによる確認ではなく、認証済みGitHub画面とローカルGitによる照合。
- 照合時点で未追跡なのは、この調査用 `docs/cloud-feed-change-plan.md` のみ。アプリコードに差分はない。
- 以前の調査記録にある「remote未登録・未コミット変更あり」は現在の状態には当てはまらない。

## 現在の構成とデータ経路

| 領域 | ファイル | 現在の役割 |
| --- | --- | --- |
| 認証 | src/lib/supabase.ts、src/app/login.tsx、signup.tsx、_layout.tsx | Email/Password認証、AsyncStorageでセッション保持、認証画面への遷移 |
| Workout | src/app/workout.tsx、src/lib/workoutStorage.ts | 記録、途中保存・復元、前回コピー、PR判定、完了保存 |
| Template | src/lib/templateStorage.ts、src/app/workout.tsx | 種目名・focusのテンプレート保存／読込／削除 |
| History | src/app/history.tsx、history-detail.tsx | 保存済みWorkoutの一覧・ID指定詳細・PR表示 |
| 投稿 | src/app/post.tsx、src/lib/postStorage.ts | Workoutから集計スナップショットを生成し、写真URI・captionと端末保存 |
| HOME | src/app/index.tsx | getPosts()で端末投稿を取得。投稿者はKAZU／Kの固定表示 |
| Profile | src/app/profile.tsx | 端末Workoutから活動量とBIG3の最高重量を表示。名前はKAZU固定 |
| 共通UI | src/components、src/constants、src/hooks | スターター由来の部品を含む。実際のナビゲーションは_layout.tsx |

Workout完了 → saveWorkout → clearActiveWorkout → /postへWorkoutを渡す → 投稿用集計 → savePost → HOME。

投稿スキップ時にもWorkoutは保存済み。この境界は維持する。投稿側で計算済みの種目・PRスナップショットをクラウドへ保存し、HOMEで再計算しない。

## 変更予定ファイル

以下はGitHub mainと一致するローカル実装を確認したうえでの変更予定。新規ファイル名は実装時に確定する。

| ファイル | 変更内容 |
| --- | --- |
| src/lib/postStorage.ts | 既存WorkoutPost型・旧キーを保ち、新規投稿のユーザー別ローカル控えと送信状態、同一ID再保存を扱う。getPostsを突然クラウド取得へ置換しない |
| src/lib/cloudPosts.ts（新規） | 認証ユーザー取得、投稿INSERT、再送時の重複防止、profiles結合、時系列ページ取得、DB行から既存UI型への変換 |
| src/types/database.ts（新規） | 確認済みprofilesと新設postsのDB型。JSONB種目データは読込時に検証する |
| src/lib/supabase.ts | Database型を付けたクライアントと環境変数チェック。公開用キーのみ使用 |
| src/app/post.tsx | 既存PR・集計・写真選択を維持し、ローカル保存とクラウド送信を接続。送信失敗／再試行を表示し、再送でも投稿IDを変えない |
| src/app/index.tsx | クラウドフィード、profiles由来のdisplay_name／username、取得失敗・再試行・追加読込。既存カードの種目・PR表示を活用 |
| src/lib/postPhotos.ts（新規、写真対応） | 選択済み写真をStorageへアップロード。ローカルURIと共有用パスを分離。再送・アップロード失敗も扱う |
| supabase/migrations/（新規） | CLIで生成したmigrationにposts・索引・制約・RLS・GRANTを記録。写真を含む場合はbucket／Storageポリシーも追加 |
| src/components/app-tabs.web.tsx | 既存の存在しない/explore参照を最小修正し、型エラーを解消 |
| eslint.config.js、package.json、package-lock.json | 未整備のlint設定と必要な開発依存。既存Expo SDKに合う構成で導入 |
| tests/ または検証用SQL、docs/ | 変換・再送・認可の検証と適用手順。検証用データを本番に無断追加しない |

プロフィール画面の名前を実ユーザーにする場合だけ profile.tsx と profiles取得処理を追加対象にする。今回の必須要件「投稿者名をHOMEに表示」だけならprofile.tsxの変更は不要。

## 維持する実装

- workout.tsx、workoutStorage.ts、templateStorage.ts、history.tsx、history-detail.tsx の保存形式・計算を維持。
- ProfileのPRは既にBENCH PRESS／SQUAT／DEADLIFTに限定。現在は最高重量のサマリーで、時系列のPR履歴一覧は未実装。履歴一覧を追加する場合もBIG3のみ。
- 他種目のWorkout／投稿PR判定は残す。BIG3制限を全体のPR判定に広げない。
- followers／following数やreaction総数を追加しない。
- 認証全体の再構成やルーティング変更は今回の投稿実装に混ぜない。

## schemaと移行方針

posts: id(UUID)、user_id(profiles.idへの外部キー)、client_post_id(text)、workout_id(text)、created_at、caption、photo_pathまたはphoto_url、duration_seconds、total_sets、total_volume、pr_count、exercises(JSONB)。

- `(user_id, client_post_id)` の一意制約で同じ投稿の再送を重複させない。
- workout_idは端末の文字列IDなのでUUID化せず、未作成のworkoutsテーブルへの外部キーも置かない。
- 必須・非負数・caption長・JSON配列などの制約を設定する。
- `(created_at desc, id desc)` とuser_idの索引を用意する。
- RLSはログイン済みユーザーのフィード閲覧と本人のINSERTを許可。編集・削除を実装する場合だけ本人限定UPDATE／DELETEを追加し、UPDATEはUSINGとWITH CHECK両方を指定。
- profilesは既存の公開読込ポリシーで結合可能。投稿の取得に必要なid／username／display_nameのみ選択する。
- 旧 `@loads/posts` は所有者が記録されていないので自動公開・自動帰属させない。残したまま新規投稿から移行する。
- 新規ローカル投稿・未送信データはユーザー別に分離。別アカウントで再送しない。
- Workout／Templateも現在は端末共通キー。今回クラウドへ一括転送しない。複数アカウントでの端末データ分離は別途必要。
- 写真はfile:等の端末URIをそのままDBへ保存しても他端末で見えない。写真機能を保つにはStorage対応を含める。ログイン限定フィードに合わせ、private bucket＋本人upload・認証済みreadと署名URLを基本案とする。

## 検証結果と実装時の確認

- `npx --no-install tsc --noEmit`: 既存の app-tabs.web.tsx:27 の/explore参照で失敗（TS2322）。
- `CI=1 npx --no-install expo lint`: ESLint設定なし。自動設定処理が証明書検証エラーで停止。lint合格とは扱わない。
- 実装後: 未認証アクセス拒否、他人user_idでINSERT拒否、Aの投稿をBが閲覧、本人以外の変更拒否、再送重複なし、アカウント切替時の未送信分離、写真の別端末表示を確認。
- 回帰確認: Workout完了／途中復元／前回コピー、Template読込・削除、History詳細、投稿スキップ、BIG3サマリー、各種PRの従来表示。

Supabaseの詳細は [supabase-current-state.md](supabase-current-state.md) を参照。今回DBの再変更や認証設定変更はしていない。
