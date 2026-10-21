# 公開準備レビュー — 2026-10-21

> 最終レビューによる訂正: 識別情報の前回検査には漏れがありました。公開保留は運用資料5件と `scripts/prepare-reaction-migration.cjs` に拡大します。同じ本番project参照は既存mainの過去版にも残っています。「内部refの1件のみ」という以下の初回評価は採用しません。確定した公開一覧・保留理由・履歴の到達性は [最終レビュー](portfolio-final-review-2026-10-21.md) を参照してください。

本資料はローカル調査結果と、最終確認用の公開範囲を整理したものです。コミット・stage・Push、本番DB・Functions・Cronの変更、EAS Build・配布は実施していません。

## Gitと既存変更

- ブランチ: `main`。HEAD: `e044163`（2026-10-14）。
- GitHub mainは読み取り専用の `git ls-remote` で `c62c10c` と確認。ローカルは1コミット先行、遅れ0。既存のorigin/mainとも一致。fetch・Pushは行っていません。
- 未Pushの既存コミット: `Prepare LOADS v1.1 TestFlight release`。後のPushにはこのコミットも含まれるため、README差分だけでなく内容を確認する必要があります。
- 開始時はtracked変更23件、未追跡42件。既存の変更を破棄・stage・上書きしていません。
- 今回作成・編集した公開候補は `README.md` と本資料のみ。アプリコード・設定・依存・SQLは変更していません。

## READMEの更新

指定の10項目へ再構成。PR v2とFIRST RECORD、懸垂分類、カスタム種目管理、リアクション4種類と旧8種類の互換性、Push設定と重複抑制、視認性・Compiler表示更新の改善を追加しました。既存のoutbox、RLS、ユーザー別保存、削除receiptの説明は設計判断を保って整理しています。

分類付き種目を含む新規投稿は停止中です。履歴・テンプレート・カスタム種目の端末間同期はありません。リアクションPushの実機確認を完了扱いにはしていません。TestFlight友人8名の実績は既存READMEに基づき、2026-10-21の最新配布人数として独立に確認していません。指摘と修正の個別対応も根拠不足のため断定していません。

紹介画像3枚を目視確認しました。テスト用表示名と記録があり、認証情報や実名・個人写真は見当たりません。公開済みの既存画像を保持し、最新UI全体を反映しないことを明記しました。

## 品質確認

| 対象 | 結果 |
| --- | --- |
| npm run typecheck | 成功 |
| npm run lint | 成功 |
| npm test | 成功: 57ファイル、259件、失敗0・skip0 |
| npx --no-install tsc -p supabase/functions/tsconfig.json | 成功 |
| git diff --check | 成功 |
| 実機E2E・Push配送・TestFlight現況・実Supabase統合 | 未実施 |

テストソースの接続・環境参照を確認し、DBはPGlite、API/Pushはモックを利用する既存suiteを実行しました。本番データは変更していません。ログはGit除外済みの `.expo/portfolio-*.log` に保持。1件は `.expo/workout-reactions-stage2/apply-reviewed.sql` の存在に依存し、クリーンcheckoutではskipになります。259件は今回のローカル結果であり、GitHub上で同件数を再現できる保証ではありません。

## 秘密情報・プライバシー確認

- 公開候補271ファイル（今回の文書作成前）と、ローカル全refsから到達できる379個の履歴blobを走査。秘密鍵ヘッダー、Supabase secret/service_role JWT、ユーザーJWT、GitHub/Supabaseアクセストークン、AWSキー、認証情報付きURL、長いパスワード等のリテラルパターンを検査し、該当なし。
- `.env` はignore対象でGit管理外。値を出力せずキー種別を確認し、フロント用公開キーと判定。`.env.example` は置換値のみ。秘密鍵・credentials.json・配布バイナリは管理対象に見つかりませんでした。
- 公開可能なpublishable / legacy anonキーと、RLSを迂回するservice_role / secretキーを区別しました。後者をクライアントや公開履歴へ入れてはいけません。[Supabase公式のキー分類](https://supabase.com/docs/guides/api/api-keys)
- 既存tracked文書に検出されたUUIDは匿名化済みplaceholderと確認。審査用メールもexampleドメインです。テストsuiteには合成の認証値を含みますが、実テストアカウントのパスワードは検出していません。
- **公開保留:** `docs/workout-reactions-migration-result.md` 冒頭の本番project参照、`docs/workout-reactions-stage1-preflight.md` 7・17行の関数・デプロイ識別情報。秘密鍵そのものではありませんが、今回の公開に不要な運用情報です。原本は変更せず保持し、公開する場合は匿名化した版をレビューしてください。
- 全refsの履歴blobにも後者の運用識別情報を含む版が1件ありました（blob `a206342d3b4c`）。通常のmainコミット履歴には当該パスがなく、Codex内部refの到達可能objectです。GitHubで公開済みとは判断していません。履歴書換え・ref削除は行っていません。
- 他の未追跡の運用メモも一括追加せず、下記の保留一覧として扱います。稼働状況・内部手順は機密キーとは別の観点で公開可否を確認してください。

これは形式ベースの検査であり、未知形式の秘密、画像・バイナリ内の全情報、未取得remote refs、reflog-only/到達不能object、GitHub設定・外部サービスの秘密設定を網羅しません。過去の全画像版の目視確認も未実施です。最終的にstageする差分の再確認が必要です。

## 最終確認事項

1. README本文、友人8名の利用実績、最新配布ビルドとソースSHAの対応を確認する。
2. 未Pushの既存コミットと、以下の既存実装候補を採用する範囲を確認する。READMEだけの公開では新しい実装へのリンクが不足するため、採用したコード・テスト・SQLを同時に含める。
3. 保留した運用メモは除外するか匿名化版を用意する。`git add .` は使用しない。
4. SQLのGit公開とDB適用は別操作。今回SQLを公開候補に含めても、Migration・worker更新・Buildは実行しない。
5. 対象をstageした後、差分・機密情報・参照先を再確認し、所有者の最終承認後にコミット・Pushする。

## ポートフォリオとしての改善

「何を使ったか」に加えて、記録の意味・互換性・応答喪失・データ分離・通知失敗への判断と、対応するコードへの入口を示しました。ローカルテストと実機実績の区別も明示しています。次の改善として、最新画面、指摘→修正→再確認の具体例、CIで再現できるテスト、配布ビルドとSHAの対応を揃えると、採用担当者が開発成果を確認しやすくなります。

## 公開ファイル候補

今回の文書変更:

- `README.md`
- `docs/portfolio-update-2026-10-21.md`

以下は作業開始時に存在した変更の一覧です。今回の作業で変更したものではなく、所有者の最終確認待ちです。

### 既存実装・テスト・SQL（公開候補）

- `src/app/_layout.tsx`（変更済み）
- `src/app/post.tsx`（変更済み）
- `src/app/profile.tsx`（変更済み）
- `src/app/settings.tsx`（変更済み）
- `src/app/workout.tsx`（変更済み）
- `src/components/feed-post-card.tsx`（変更済み）
- `src/components/notification-gate.tsx`（変更済み）
- `src/constants/theme.ts`（変更済み）
- `src/hooks/use-profile.ts`（変更済み）
- `src/lib/accountActivity.ts`（変更済み）
- `src/lib/cloudPosts.ts`（変更済み）
- `src/lib/postStorage.ts`（変更済み）
- `src/lib/postValidation.ts`（変更済み）
- `src/lib/pr.ts`（変更済み）
- `src/lib/templateStorage.ts`（変更済み）
- `src/lib/userLocalData.ts`（変更済み）
- `src/lib/workoutPost.ts`（変更済み）
- `src/lib/workoutStorage.ts`（変更済み）
- `src/types/database.ts`（変更済み）
- `supabase/functions/_shared/push.ts`（変更済み）
- `tests/cardio-display.test.cjs`（変更済み）
- `tests/cardio-ui.test.cjs`（変更済み）
- `tests/cloud-posts.test.cjs`（変更済み）
- `scripts/diagnose-workout-reactions.cjs`（未追跡）
- `src/app/workout-post.tsx`（未追跡）
- `src/components/custom-exercise-form.tsx`（未追跡）
- `src/components/notification-preference-control.tsx`（未追跡）
- `src/components/workout-reactions.tsx`（未追跡）
- `src/hooks/use-visible-post.ts`（未追跡）
- `src/lib/customExercises.ts`（未追跡）
- `src/lib/notificationDestination.ts`（未追跡）
- `src/lib/reactionApi.ts`（未追跡）
- `src/lib/reactionNotifications.ts`（未追跡）
- `src/lib/workoutReactions.ts`（未追跡）
- `supabase/migrations/20261015061237_workout_reactions.sql`（未追跡）
- `supabase/ops/inspect-workout-reactions.sql`（未追跡）
- `supabase/ops/verify-workout-reactions-release.sql`（未追跡）
- `tests/custom-exercise-form.test.cjs`（未追跡）
- `tests/custom-exercises.test.cjs`（未追跡）
- `tests/helpers/`（未追跡）
- `tests/notification-preference-ui.test.cjs`（未追跡）
- `tests/post-first-record-ui.test.cjs`（未追跡）
- `tests/profile-header.test.cjs`（未追跡）
- `tests/reaction-diagnostics.test.cjs`（未追跡）
- `tests/reaction-notifications.test.cjs`（未追跡）
- `tests/visible-post-hook.test.cjs`（未追跡）
- `tests/workout-reactions-client.test.cjs`（未追跡）
- `tests/workout-reactions-compiler.test.cjs`（未追跡）
- `tests/workout-reactions-db.test.cjs`（未追跡）
- `tests/workout-reactions-surface.test.cjs`（未追跡）
- `tests/workout-reactions-ui.test.cjs`（未追跡）
- `tests/workout-reactions.test.cjs`（未追跡）

### 既存の未追跡運用・設計メモ（今回は公開保留）

- `scripts/prepare-reaction-migration.cjs`（本番識別子と非公開snapshot依存があるため公開保留）

- `docs/create-exercise.md`
- `docs/workout-reactions-diagnosis.md`
- `docs/workout-reactions-final-preflight.md`
- `docs/workout-reactions-four-options.md`
- `docs/workout-reactions-integration-validation.md`
- `docs/workout-reactions-migration-final-check.md`
- `docs/workout-reactions-migration-result.md`
- `docs/workout-reactions-preproduction-review.md`
- `docs/workout-reactions-production-runbook.md`
- `docs/workout-reactions-stage1-preflight.md`
- `docs/workout-reactions-tap-regression.md`
- `docs/workout-reactions.md`
