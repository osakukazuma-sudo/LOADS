# Publication Manifest

> 公開前の分類・匿名化記録です。以下の未追跡・stage・commit前という記述は準備時点の状態であり、その後のGit管理・公開状態はコミットログが正です。

2026-10-06。stage候補の分類。commit / pushはしない。値は記載しない。

| 未追跡ファイル | 分類 |
| --- | --- |
| .env.example | 設定・公開asset |
| app.config.js | 設定・公開asset |
| assets/images/loads-rose-plate-icon.png | 設定・公開asset |
| docs/account-deletion-recovery-design.md | 公開可能docs |
| docs/account-release-verification.md | 匿名化したdocs |
| docs/architecture-notes.md | 公開可能docs |
| docs/auth-redirect-testflight.md | 匿名化したdocs |
| docs/cardio-verification.md | 公開可能docs |
| docs/cloud-feed-change-plan.md | 匿名化したdocs |
| docs/cloud-feed-verification.md | 匿名化したdocs |
| docs/following-feed-verification.md | 匿名化したdocs |
| docs/gym-improvements.md | 匿名化したdocs |
| docs/portfolio-readiness.md | 公開可能docs |
| docs/testflight-beta-review.md | 匿名化したdocs |
| docs/testflight-preflight.md | 匿名化したdocs |
| docs/verification/account-deletion-post-deploy.sql | 公開可能docs |
| docs/verification/audit-browser-local-deletion.js | 公開可能docs |
| docs/verification/expo-push-security-result.md | 匿名化したdocs |
| docs/verification/feed-relationship-fix.md | 公開可能docs |
| docs/verification/gym-production-result.md | 匿名化したdocs |
| docs/verification/push-production-result.md | 匿名化したdocs |
| eas.json | 設定・公開asset |
| eslint.config.js | 設定・公開asset |
| scripts/check-expo-push-security.cjs | 開発・検証script |
| scripts/diagnose-feed-query.cjs | 開発・検証script |
| scripts/prepare-edge-dashboard.cjs | 開発・検証script |
| scripts/prepare-gym-production-migration.cjs | 開発・検証script |
| scripts/validate-public-env.cjs | 開発・検証script |
| scripts/verify-deletion-endpoints.cjs | 開発・検証script |
| src/app/athlete.tsx | 実装コード |
| src/app/auth/callback.tsx | 実装コード |
| src/app/connections.tsx | 実装コード |
| src/app/people.tsx | 実装コード |
| src/app/settings.tsx | 実装コード |
| src/app/tagged.tsx | 実装コード |
| src/components/account-deletion-control.tsx | 実装コード |
| src/components/account-deletion-gate.tsx | 実装コード |
| src/components/cardio-exercise-card.tsx | 実装コード |
| src/components/cardio-summary-card.tsx | 実装コード |
| src/components/copy-workout-button.tsx | 実装コード |
| src/components/delete-post-control.tsx | 実装コード |
| src/components/feed-post-card.tsx | 実装コード |
| src/components/logout-control.tsx | 実装コード |
| src/components/my-connections.tsx | 実装コード |
| src/components/notification-gate.tsx | 実装コード |
| src/components/set-options.tsx | 実装コード |
| src/components/social-layout.tsx | 実装コード |
| src/components/training-partner-picker.tsx | 実装コード |
| src/components/user-data-gate.tsx | 実装コード |
| src/hooks/use-account-owner.ts | 実装コード |
| src/hooks/use-cloud-feed.ts | 実装コード |
| src/hooks/use-profile.ts | 実装コード |
| src/lib/accountActivity.ts | 実装コード |
| src/lib/accountDeletion.ts | 実装コード |
| src/lib/accountDeletionLocalData.ts | 実装コード |
| src/lib/accountLocalWrites.ts | 実装コード |
| src/lib/accountSession.ts | 実装コード |
| src/lib/authRedirect.ts | 実装コード |
| src/lib/cardio.ts | 実装コード |
| src/lib/cloudPosts.ts | 実装コード |
| src/lib/deletionDiagnostics.ts | 実装コード |
| src/lib/exerciseLibrary.ts | 実装コード |
| src/lib/follows.ts | 実装コード |
| src/lib/notifications.ts | 実装コード |
| src/lib/postDeletion.ts | 実装コード |
| src/lib/postOutbox.ts | 実装コード |
| src/lib/postPhotoFiles.ts | 実装コード |
| src/lib/postPhotoFiles.web.ts | 実装コード |
| src/lib/postPhotos.ts | 実装コード |
| src/lib/postValidation.ts | 実装コード |
| src/lib/profiles.ts | 実装コード |
| src/lib/pushDevice.ts | 実装コード |
| src/lib/registerPush.ts | 実装コード |
| src/lib/setResult.ts | 実装コード |
| src/lib/signup.ts | 実装コード |
| src/lib/userLocalData.ts | 実装コード |
| src/lib/workoutFinishAlert.ts | 実装コード |
| src/lib/workoutPost.ts | 実装コード |
| src/lib/workoutText.ts | 実装コード |
| src/types/database.ts | 実装コード |
| supabase/config.toml | Supabaseコード・migration・Functions |
| supabase/functions/_shared/account-cleanup.ts | Supabaseコード・migration・Functions |
| supabase/functions/_shared/account-receipt.ts | Supabaseコード・migration・Functions |
| supabase/functions/_shared/photo-cleanup.ts | Supabaseコード・migration・Functions |
| supabase/functions/_shared/push.ts | Supabaseコード・migration・Functions |
| supabase/functions/_shared/runtime.ts | Supabaseコード・migration・Functions |
| supabase/functions/account-deletion-status/index.ts | Supabaseコード・migration・Functions |
| supabase/functions/delete-account/index.ts | Supabaseコード・migration・Functions |
| supabase/functions/delete-post/index.ts | Supabaseコード・migration・Functions |
| supabase/functions/deletion-worker/index.ts | Supabaseコード・migration・Functions |
| supabase/functions/push-worker/index.ts | Supabaseコード・migration・Functions |
| supabase/functions/runtime.d.ts | Supabaseコード・migration・Functions |
| supabase/functions/tsconfig.json | Supabaseコード・migration・Functions |
| supabase/migrations/20260927171421_create_cloud_posts.sql | Supabaseコード・migration・Functions |
| supabase/migrations/20260927171552_create_post_photos.sql | Supabaseコード・migration・Functions |
| supabase/migrations/20260929054223_add_post_deletion.sql | Supabaseコード・migration・Functions |
| supabase/migrations/20260929064132_tighten_deletion_tombstone_conflict.sql | Supabaseコード・migration・Functions |
| supabase/migrations/20260929191218_account_deletion_recovery.sql | Supabaseコード・migration・Functions |
| supabase/migrations/20261001091938_following_feed.sql | Supabaseコード・migration・Functions |
| supabase/migrations/20261003074946_gym_social_improvements.sql | Supabaseコード・migration・Functions |
| supabase/ops/probe-expo-receipts.sql | Supabaseコード・migration・Functions |
| supabase/ops/schedule-deletion-cleanup.sql | Supabaseコード・migration・Functions |
| supabase/ops/schedule-push.sql | Supabaseコード・migration・Functions |
| supabase/ops/verify-feed-read-only.sql | Supabaseコード・migration・Functions |
| supabase/ops/verify-push-production.sql | Supabaseコード・migration・Functions |
| supabase/verify-cloud-feed.sql | Supabaseコード・migration・Functions |
| supabase/verify-post-deletion.sql | Supabaseコード・migration・Functions |
| tests/account-deletion-client.test.cjs | テスト |
| tests/account-deletion-db.test.cjs | テスト |
| tests/account-deletion-endpoints.test.cjs | テスト |
| tests/account-deletion-worker.test.cjs | テスト |
| tests/account-session.test.cjs | テスト |
| tests/auth-redirect.test.cjs | テスト |
| tests/cardio-display.test.cjs | テスト |
| tests/cardio-ui.test.cjs | テスト |
| tests/cardio.test.cjs | テスト |
| tests/cloud-posts.test.cjs | テスト |
| tests/completion-sync.test.cjs | テスト |
| tests/copy-workout.test.cjs | テスト |
| tests/delete-post-function.test.cjs | テスト |
| tests/following-client.test.cjs | テスト |
| tests/following-db.test.cjs | テスト |
| tests/following-feed-hook.test.cjs | テスト |
| tests/following-interactions.test.cjs | テスト |
| tests/following-profile-ui.test.cjs | テスト |
| tests/gym-features.test.cjs | テスト |
| tests/gym-migration-review.test.cjs | テスト |
| tests/gym-social-db.test.cjs | テスト |
| tests/gym-ui.test.cjs | テスト |
| tests/local-deletion-audit.test.cjs | テスト |
| tests/photo-cleanup.test.cjs | テスト |
| tests/post-deletion-client.test.cjs | テスト |
| tests/profiles.test.cjs | テスト |
| tests/push-device.test.cjs | テスト |
| tests/push-worker.test.cjs | テスト |
| tests/push.test.cjs | テスト |
| tests/signup-db.test.cjs | テスト |
| tests/signup.test.cjs | テスト |
| tests/user-local-data.test.cjs | テスト |
| tests/workout-finish-alert.test.cjs | テスト |
| tests/workout-text.test.cjs | テスト |

## 除外対象

- `.env` / `.env.*`（`.env.example`以外）：端末環境・認証情報。
- `.expo/`：開発cache、審査画像、匿名化前原本、監査用script。
- `supabase/.temp/`：CLIの内部状態。
- `docs/verification/delete-post-confirmation.png`、`post-deletion-db.png`、`pc-delete-repeat-confirmation.png`：個人情報・内部運用情報を含む可能性がある画像。未編集でローカル保持。
- `docs/verification/gym-production-apply.sql`：生成物。元migrationとgeneratorを公開し、この実環境用bundleは除外。
- private key、Apple signing credentials、logs、node_modules、native生成ディレクトリ：既存ignore対象。

## 識別情報への対応

- `docs/account-deletion-recovery-design.md`：既存ユーザーの表示名を公開不要のplaceholderへ置換。

- docs/account-release-verification.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/auth-redirect-testflight.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/cloud-feed-change-plan.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/cloud-feed-verification.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/following-feed-verification.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/gym-improvements.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/testflight-beta-review.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/testflight-preflight.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/verification/expo-push-security-result.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/verification/gym-production-result.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/verification/push-production-result.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- docs/supabase-current-state.md：メール・UUID・アカウント／project識別子を置換（該当する項目のみ）。
- `supabase/ops/schedule-push.sql`、`schedule-deletion-cleanup.sql`、`verify-push-production.sql`：本番URL／request識別子を自身の環境用placeholderに変更。
- `app.json`：配布済みアプリのbundle ID・EAS project ID・ownerは公開メタデータとして保持。秘密鍵ではなく、既存buildとの対応を壊さないため。
- `scripts/check-expo-push-security.cjs`：公開用に対象project IDを環境変数から受け取る。
- `tests/`：固定UUIDとexample-domainのメールは合成fixture。実ユーザーの識別情報として扱わない。

## READMEと実装の対応（公開候補）

| README機能 | 実装 | テスト例 |
| --- | --- |
| Workout・PR・前回参照 | src/app/workout.tsx、src/lib/workoutStorage.ts、setResult.ts | tests/gym-features.test.cjs、gym-ui.test.cjs |
| 履歴・コピー | src/app/history.tsx、history-detail.tsx、src/lib/workoutText.ts | tests/workout-text.test.cjs、copy-workout.test.cjs |
| テンプレート | src/lib/templateStorage.ts、src/app/workout.tsx | tests/user-local-data.test.cjs |
| Cardio | src/lib/cardio.ts、src/components/cardio-exercise-card.tsx、cardio-summary-card.tsx | tests/cardio.test.cjs、cardio-ui.test.cjs、cardio-display.test.cjs |
| 投稿・Feed・再送 | src/lib/cloudPosts.ts、postOutbox.ts、src/hooks/use-cloud-feed.ts | tests/cloud-posts.test.cjs、following-feed-hook.test.cjs |
| 写真・Storage | src/lib/postPhotos.ts、postPhotoFiles.ts、Supabase photo migration | tests/photo-cleanup.test.cjs、cloud-posts.test.cjs |
| Auth・セッション | src/lib/supabase.ts、signup.ts、authRedirect.ts、accountSession.ts | tests/signup.test.cjs、auth-redirect.test.cjs、account-session.test.cjs |
| 検索・フォロー | src/app/people.tsx、athlete.tsx、connections.tsx、src/lib/follows.ts | tests/following-client.test.cjs、following-db.test.cjs |
| RLS・重複防止 | supabase/migrations/、src/lib/cloudPosts.ts | tests/cloud-posts.test.cjs、following-db.test.cjs、gym-social-db.test.cjs |
| 投稿削除 | src/lib/postDeletion.ts、supabase/functions/delete-post/ | tests/post-deletion-client.test.cjs、delete-post-function.test.cjs |
| アカウント削除 | src/lib/accountDeletion.ts、accountDeletionLocalData.ts、supabase/functions/delete-account/、deletion-worker/ | tests/account-deletion-db.test.cjs、account-deletion-worker.test.cjs |
| 通知・タグ | src/lib/notifications.ts、registerPush.ts、supabase/functions/push-worker/ | tests/push.test.cjs、push-worker.test.cjs、gym-social-db.test.cjs |
| EAS・strict・品質script | eas.json、app.config.js、tsconfig.json、package.json、eslint.config.js | lint、app/Functions typecheck、npm test |

追加前はCardio／投稿／削除／フォロー／通知等の補助実装と全テスト・Supabaseコードが未追跡だった。公開候補をindexへ追加し、READMEリンクをindexのファイル集合に照合する。公開済みGitHubにはcommit/pushするまで反映されない。

## 公開前の制約

- Auth/profileの初期bootstrapは未検証。migrationの無条件再適用を案内しない。
- 実機カメラ・APNs・画像uploadの今回の検証は未実施。テスト件数を実機保証として扱わない。
- 実URLを含む過去コミットは匿名化だけでは消えない。公開metadataが残る点は承認対象。秘密パターン検査は別に実施する。
- stage候補をまとめたもので、細分化したcommitは将来の差分レビューで決める。
