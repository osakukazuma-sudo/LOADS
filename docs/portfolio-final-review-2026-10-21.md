# GitHub公開前 最終レビュー — 2026-10-21

判定は**条件付き公開候補**です。実装・テストの依存ファイルは特定できましたが、既に公開側mainの過去版に残る本番project参照を許容するかの判断、最新TestFlightの配布実績の確認が残ります。秘密値・運用識別子の実値は本資料へ記載していません。

今回はこの文書と公開ファイル一覧を作成し、初回レビューへ訂正を追記しました。既存のアプリコード、運用資料の原本、Git index、履歴、remoteは変更していません。削除・コミット・Push・本番操作は行っていません。

## 1. Git状態と未Pushコミット

ブランチはmain、ローカルHEADは `e044163`。GitHub mainを `git ls-remote origin refs/heads/main` で再確認し、`c62c10c` と一致しました。ローカルは1コミット先行・遅れ0。indexにstage済みの差分はありません。

未Pushコミット `e044163`（Prepare LOADS v1.1 TestFlight release）は44パスの変更です。PR v2・懸垂分類・旧記録との互換性、分類付き投稿の停止、写真処理・ログアウトUI・視認性、配布設定・公開環境値の検査、設計資料と回帰テストを含みます。単なるREADME更新ではありません。

この既存コミットには診断UIと旧テストの削除が各1件含まれますが、今回削除を実行したものではありません。最新状態を再現するにはコミットを基礎として残し、後続の公開対象差分を重ねます。commit自体の秘密パターン検査で該当はなく、今回特定した本番識別子を含む新しいblobもこのコミットでは追加されていません。ただし祖先履歴には後述のproject参照があります。

44パスの内訳と全パスは末尾に記載しています。

## 2. 公開する範囲

公開候補は既存HEADの229ファイルを基礎とし、変更24ファイルと新規32ファイルを反映した**261ファイル**です。今回stageする候補は**56ファイル**。完全な明示一覧は [portfolio-public-files-2026-10-21.txt](portfolio-public-files-2026-10-21.txt) です。既存HEAD全体を再追加する必要はありません。

| 区分 | 必要性・判定 |
| --- | --- |
| 変更済みsrc 19件 | カスタム種目の保存・PR・snapshot、Feed/通知/UI・型の統合。まとめて公開する |
| 新規src 10件 | カスタムフォーム、リアクションUI/API/状態管理、通知設定、投稿詳細ルート・hook。省略するとimportまたは通知遷移先が欠ける |
| push.ts変更と新規migration | クライアントだけではリアクションのテーブル・RLS・設定列・通知処理を再現できないため、ソースとして同梱。DB適用・デプロイは別作業 |
| 新規ops SQL 2件 | 個別環境を埋め込まない読取検査テンプレート。既存DBテストが読むため同梱 |
| scripts/diagnose-workout-reactions.cjs | テストのrequire先。コードに本番識別子の固定値なし。直接実行すると設定先へGETし、hostnameを出力するため、実行ログは公開しない |
| 既存テスト変更3件・新規テスト14件・helper 1件 | 新機能・旧仕様との互換性・Compiler変換後のUI・SQL回帰を再現するため同梱 |
| README・初回レビュー・最終レビュー・公開一覧 | 機能説明、検証結果、公開範囲を明示 |
| 既存設定・lockfile・画像 | HEADに存在する版を継承。package.json/package-lock.json、app.config.js/app.json、eas.json、tsconfig、ESLint設定、src/global.css、紹介画像等を省略しない |

`src/app/workout-post.tsx`の追加と `_layout.tsx`、`notificationDestination.ts`、`notification-gate.tsx` は通知の遷移先を構成するため一緒に扱います。`tests/helpers/reaction-renderer.cjs` もフォルダー名だけでなく実ファイルを含めます。

全公開候補の相対importを静的に照合し、欠落0件でした。さらに公開候補のみをGit除外済み一時フォルダーへコピーして検査しました。

## 3. 再現性と品質確認

| 検査 | 結果・範囲 |
| --- | --- |
| 元のローカル作業ツリー | 前回のapp型・Lint・Edge型すべて成功、259成功・skip0。今回アプリコード変更なし |
| 公開候補コピーの相対import | 欠落0件 |
| 公開候補コピーのLint | 成功 |
| 公開候補コピーのnpm test | 259件中258成功、失敗0、skip1 |
| 公開候補コピーのapp型検査 | 初回は生成型宣言がなく2エラー。Expo標準のexpo-env.d.tsを検査コピーに補った後に成功 |
| 公開候補コピーのEdge型検査 | 未成立。コピー内node_modulesがなく、tsconfigの相対pathsが解決できず3エラー。元のローカル環境では成功済み |
| 独立したnpm ci・完全なfresh clone | 未実施。検査コピーは既存node_modulesの上位解決を利用 |
| 実Supabase統合・実Push・EAS Build | 未実施。本番への接続・変更なし |

skip1は非公開 `.expo/workout-reactions-stage2/apply-reviewed.sql` に依存する検査です。この生成SQLや本番snapshotを公開して件数を揃えません。公開環境の期待値は現時点で258成功・skip1です。

Expo生成の `expo-env.d.ts` はignore対象であり、秘密情報でも公開必須ソースでもありません。初回はREADME記載の `npm start` によるExpo初期化を行ってから型検査します。検査では既存の標準生成ファイルを一時コピーへ補い、起動・DB接続を行っていません。[Expo TypeScript公式資料](https://docs.expo.dev/guides/typescript/)

Edge型検査のエラーはこの一時コピーにnode_modulesを用意しなかったことによります。クリーン環境ではプロジェクト直下で `npm ci` を実行し、同じ場所に依存を置く必要があります。今回の検査だけで独立環境の再現を完了扱いにはしません。

空のSupabaseへの完全bootstrapは別の未解決点です。migration群は基礎profiles等が存在する前提で、PGlite fixtureはそれを合成しています。公開ファイルを揃えても、本番環境と同じサービスを無設定で立ち上げられるわけではありません。READMEにも制約を記載済みです。

## 4. 運用識別情報のあるファイル

前回の正規表現は「20文字のproject参照が単独で出現する場合」とscriptの固定project値を見落としていました。今回は既知の識別子をメモリ内で抽出し、全公開候補と各refから到達するblobに対して値を出さず完全一致検査しました。

| ファイル・行 | 公開可能な部分 | 除外・匿名化する部分 |
| --- | --- | --- |
| docs/workout-reactions-final-preflight.md:11,42 | migration依存・RLS/ACL・互換性の確認方法 | 本番project参照。過去時点の未適用判定を現況と誤認させないよう時系列も整理 |
| docs/workout-reactions-migration-final-check.md:5 | 変更範囲、検査項目、停止条件 | 固定project参照と環境固有の照合情報 |
| docs/workout-reactions-migration-result.md:3 | 適用結果の要約、検証範囲と未検証事項 | 本番project参照、詳細な稼働・運用観測。採用向けには一般化した結果のみ残す |
| docs/workout-reactions-production-runbook.md:9 | 一般化した段階的反映・停止・復旧の設計 | 固定project参照、実環境向け手順の具体値・内部証跡の所在 |
| docs/workout-reactions-stage1-preflight.md:3,7,17 | worker互換性と限定的な検査結果 | project、関数・デプロイ識別子 |
| scripts/prepare-reaction-migration.cjs:32 | 原SQLのenvelope検査、履歴INSERTの生成・hash算出の仕組み | 固定project値。加えて非公開の本番snapshotを必須とするため現状は公開保留 |

上記はファイル全体を今回は保留します。原本は保持し、後日公開するならproject入力を一般化し、合成fixtureに置き換えた版を別途レビューします。このscriptはアプリから呼ばれず、通常のnpm testにも不要です。

SQLの関数名・テーブル名・migration日時・コードfingerprintは設計を説明するソース情報であり、秘密鍵そのものではありません。EAS project IDやbundle identifier等も通常は公開アプリ設定ですが、所有者情報の露出方針として別途確認できます。設定値は今回報告に再掲していません。

## 5. 履歴に残る識別情報

| 到達範囲 | 結果 | リスクと方針 |
| --- | --- | --- |
| mainと取得済みorigin/mainの祖先blob | docs/supabase-current-state.mdの過去版1件に本番project参照 | 既に公開側mainと一致する履歴から取得可能。現行版の匿名化で過去版は消えない |
| Codex内部refsの到達可能blob | 上記5運用文書と準備scriptの版、計6件に識別情報 | 通常のmainのみのPush対象に含めない。内部refsを公開・mirrorしない |
| 未Pushコミットが新たに追加したblob | 今回特定した本番識別情報の追加なし | 既存の祖先履歴のリスクは引き継ぐ |

main側の該当過去版は `719210d` で入り、`dccc81a` で匿名化されています。remote mainが同じ祖先を含むことをローカルの到達性とremote先端照合で確認しました。GitHubの他ブランチ・PR refsやキャッシュの全件確認は行っていません。

project参照はパスワードやservice_roleキーではなく、それだけで管理権限を与えるものではありません。ただし運用先の特定や過去の構成・Auth設定との紐付けは可能です。今回、秘密鍵・認証token等のパターン一致はありませんが、識別子がないという評価には訂正が必要です。

**現方針:** 履歴を書き換えず、既知の公開済みproject参照の残存を許容するか所有者が判断します。許容できない場合、通常の追加コミットでは過去版を隠せないため公開作業を止め、別途承認された履歴整理・GitHub側の残存確認を計画します。現時点で識別子だけを理由に鍵の漏洩や強制ローテーションが必要とは判定していません。実秘密が別途見つかった場合は、削除に先立つ失効・再発行が必要です。

Pushは明示的なmainのrefspecに限定します。`--mirror` は全refsを対象とするため使用しません。今回、mirror設定・追加push refspecは見つかっていません。Push対象refと到達objectの説明は[Git push公式資料](https://git-scm.com/docs/git-push)、到達性確認は[git rev-list公式資料](https://git-scm.com/docs/git-rev-list)に基づきます。

## 6. READMEと公開予定コードの照合

| READMEの記載 | 公開予定の根拠・判定 |
| --- | --- |
| PR v2 / FIRST RECORD / 懸垂分類 | pr.ts、workoutStorage.ts、workout.tsx、pr-v2/pr-history-ui/post-first-record-uiテスト。初回はPR件数に含めず、v1を保持。整合 |
| カスタム種目作成・編集・アーカイブ・復元 | customExercises.ts、custom-exercise-form.tsx、workout.tsx、custom-exercises/custom-exercise-formテスト。記録方式固定・端末内保存。整合 |
| 4種類のリアクション・旧8種類の読取 | workoutReactions.ts、reactionApi.ts、workout-reactions.tsx、migration、client/UI/DB/compilerテスト。公開件数・一覧なし。整合 |
| Push設定・重複防止 | reactionNotifications.ts、notification-preference-control.tsx、push.ts、migration、通知/DBテスト。初期OFF・一回のevent marker・状態照合。整合 |
| 通知先遷移 | notificationDestination.ts、notification-gate.tsx、workout-post.tsx、use-visible-post.tsと関連テスト。実機Pushは未検証。整合 |
| UIの視認性・Compiler修正 | p0-readability.test.cjs、theme.ts、各画面、リアクションcomponent/helper/compilerテスト。実機タッチ全体は未検証。整合 |
| 分類付き投稿の停止 | post.tsx、postValidation.ts、cloud-postsテスト。loadType付きカスタム種目も停止対象と明記。整合 |
| 保存・outbox・RLS・削除receipt | 既存HEADの各lib・Functions・migration・テストを継承。整合 |
| TestFlight利用・フィードバック | 友人8名は既存READMEの実績。最新配布人数・ビルド/SHA・指摘と修正の個別対応は確認待ち。コードだけで立証しない |
| 259成功の記録 | 元の作業ツリーの実績として正確。公開候補コピーは258成功/skip1で、READMEも条件付き1件を説明。整合 |

READMEから参照されるローカルファイル・画像は公開予定集合内に存在します。保留script・保留文書へのREADME依存はありません。

## 7. 公開保留一覧

識別情報・非公開snapshot依存がある6件:

- docs/workout-reactions-final-preflight.md
- docs/workout-reactions-migration-final-check.md
- docs/workout-reactions-migration-result.md
- docs/workout-reactions-production-runbook.md
- docs/workout-reactions-stage1-preflight.md
- scripts/prepare-reaction-migration.cjs

識別情報の直接一致はないが、原本を歴史資料として保持し、時点・現在との差・公開範囲を編集してから採用する7件:

- docs/create-exercise.md（機能説明は公開可能。配布手順と他の保留文書への参照を整理）
- docs/workout-reactions-diagnosis.md（診断設計は公開可能。過去の未適用状況と最新状況を区別）
- docs/workout-reactions-four-options.md（旧レイアウト説明が現行の横一列UIと異なる）
- docs/workout-reactions-integration-validation.md（検証設計は公開可能。過去のNO-GOと後続の判断を整理）
- docs/workout-reactions-preproduction-review.md（過去時点のリスクレビューとして位置づける）
- docs/workout-reactions-tap-regression.md（技術説明・検証範囲は公開可能。今回の最小公開に必須ではなく、他の記録と合わせて採否を決める）
- docs/workout-reactions.md（設計は公開可能。旧8択UI・過去検証件数・反映手順の説明を現況と分離）

これら13件は未追跡のまま保持し、公開一覧から外します。今後の誤追加を防ぐignore設定は今回は変更していません。

常に除外するローカル情報: `.env` と個別環境設定、`.expo/`の本番snapshot・生成SQL・診断ログ、`supabase/.temp/`、署名鍵・credentials.json、配布バイナリ、node_modules、tmp/output。既存ignoreを維持します。

## 8. 安全に反映する具体的手順（未実行）

1. 本レビュー、56件の公開一覧、未Pushコミットの既存44パスを所有者が確認する。公開済み履歴のproject参照を許容するか、TestFlight利用実績の表現を確認する。許容しない場合はここで止める。
2. 作業前に `git status --short` と `git diff --cached --name-only` を確認し、新たな他作業の変更がないか確認する。公開一覧を更新する場合は再レビューする。
3. GitHub mainを再確認する。remoteが変わっていたらfetchして差分を確認し、既存変更を消すresetや無確認のpullはしない。
4. 公開一覧をLiteralPathで読み、各ファイルだけをstageする。今回stageは実行していない。PowerShellの例:

```powershell
$publicFiles = Get-Content -LiteralPath docs/portfolio-public-files-2026-10-21.txt
foreach ($publicFile in $publicFiles) {
  git --literal-pathspecs add -- $publicFile
  if ($LASTEXITCODE -ne 0) { throw 'Staging stopped; review the index.' }
}
git diff --cached --name-status
git diff --cached --check
```

5. stage一覧が56件の明示一覧と一致し、保留13件とignored情報を含まないことを機械照合する。値を出力しない方式でstage blobと送信予定の祖先履歴を再検査する。公開一覧からの参照漏れも再確認する。
6. 本番設定を持たない別フォルダーでstage内容をexportし、プロジェクト直下の `npm ci`、自身の公開環境設定、Expo初期化後の `npm run typecheck`、`npm run lint`、`npm test`、`npx --no-install tsc -p supabase/functions/tsconfig.json` を検証する。期待は258成功/skip1。独立環境のbootstrap・実機確認を未実施のまま成功とは報告しない。
7. 最終stage差分・検証結果・未Pushコミットを提示し、所有者の最終承認後にのみ新規コミットを作る。履歴編集は行わない。
8. 承認後も最初に `git push --dry-run origin HEAD:refs/heads/main` で宛先を確認し、問題がなければ `git push origin HEAD:refs/heads/main`。force・mirror・全refs送信はしない。remoteに変更があれば停止して再確認する。
9. GitHub上でREADMEの画像・リンク・ソース・テストの存在とコミットを確認する。Secret Scanning等が利用可能なら補助検査として確認する。DB適用・Functions更新・EAS Build・TestFlight配布はこの公開作業に含めない。

この手順はstage・コミット・Pushの実行許可を意味しません。

## 9. 未Pushコミットと今回の公開対象の全一覧

以下は自動生成したパス一覧です。秘密値・運用識別子の実値を含みません。

### 未Pushコミットの44パス

設定・検査script（3件）

- `.gitignore`（M）
- `app.json`（M）
- `scripts/validate-public-env.cjs`（M）

設計・検証資料（7件）

- `docs/logout-activity-diagnostics.md`（M）
- `docs/push-token-loop-fix.md`（M）
- `docs/v1.1-classified-feed-readiness.md`（A）
- `docs/v1.1-p1-implementation.md`（A）
- `docs/v1.1-pr-design-proposal.md`（A）
- `docs/v1.1-release-final-check.md`（A）
- `docs/v1.1-testflight-photo-readiness.md`（A）

実装（23件）

- `src/app/history-detail.tsx`（M）
- `src/app/history.tsx`（M）
- `src/app/index.tsx`（M）
- `src/app/post.tsx`（M）
- `src/app/profile.tsx`（M）
- `src/app/workout.tsx`（M）
- `src/components/account-activity-diagnostics.tsx`（D）
- `src/components/cardio-exercise-card.tsx`（M）
- `src/components/cardio-summary-card.tsx`（M）
- `src/components/feed-post-card.tsx`（M）
- `src/components/logout-control.tsx`（M）
- `src/lib/cloudPosts.ts`（M）
- `src/lib/postDisplay.ts`（A）
- `src/lib/postPhotoFiles.ts`（M）
- `src/lib/postPhotoFiles.web.ts`（M）
- `src/lib/postPhotos.ts`（M）
- `src/lib/postStorage.ts`（M）
- `src/lib/postValidation.ts`（M）
- `src/lib/pr.ts`（A）
- `src/lib/templateStorage.ts`（M）
- `src/lib/workoutPost.ts`（M）
- `src/lib/workoutStorage.ts`（M）
- `src/lib/workoutText.ts`（M）

テスト（11件）

- `tests/account-activity-diagnostics-ui.test.cjs`（D）
- `tests/cardio-display.test.cjs`（M）
- `tests/cardio-ui.test.cjs`（M）
- `tests/cloud-posts.test.cjs`（M）
- `tests/logout-control.test.cjs`（A）
- `tests/p0-readability.test.cjs`（A）
- `tests/post-photo-files.test.cjs`（A）
- `tests/pr-history-ui.test.cjs`（A）
- `tests/pr-v2.test.cjs`（A）
- `tests/release-config.test.cjs`（A）
- `tests/user-local-data.test.cjs`（M）

### stageする公開対象56ファイル

- `README.md`
- `docs/portfolio-final-review-2026-10-21.md`
- `docs/portfolio-public-files-2026-10-21.txt`
- `docs/portfolio-update-2026-10-21.md`
- `scripts/diagnose-workout-reactions.cjs`
- `src/app/_layout.tsx`
- `src/app/post.tsx`
- `src/app/profile.tsx`
- `src/app/settings.tsx`
- `src/app/workout-post.tsx`
- `src/app/workout.tsx`
- `src/components/custom-exercise-form.tsx`
- `src/components/feed-post-card.tsx`
- `src/components/notification-gate.tsx`
- `src/components/notification-preference-control.tsx`
- `src/components/workout-reactions.tsx`
- `src/constants/theme.ts`
- `src/hooks/use-profile.ts`
- `src/hooks/use-visible-post.ts`
- `src/lib/accountActivity.ts`
- `src/lib/cloudPosts.ts`
- `src/lib/customExercises.ts`
- `src/lib/notificationDestination.ts`
- `src/lib/postStorage.ts`
- `src/lib/postValidation.ts`
- `src/lib/pr.ts`
- `src/lib/reactionApi.ts`
- `src/lib/reactionNotifications.ts`
- `src/lib/templateStorage.ts`
- `src/lib/userLocalData.ts`
- `src/lib/workoutPost.ts`
- `src/lib/workoutReactions.ts`
- `src/lib/workoutStorage.ts`
- `src/types/database.ts`
- `supabase/functions/_shared/push.ts`
- `supabase/migrations/20261015061237_workout_reactions.sql`
- `supabase/ops/inspect-workout-reactions.sql`
- `supabase/ops/verify-workout-reactions-release.sql`
- `tests/cardio-display.test.cjs`
- `tests/cardio-ui.test.cjs`
- `tests/cloud-posts.test.cjs`
- `tests/custom-exercise-form.test.cjs`
- `tests/custom-exercises.test.cjs`
- `tests/helpers/reaction-renderer.cjs`
- `tests/notification-preference-ui.test.cjs`
- `tests/post-first-record-ui.test.cjs`
- `tests/profile-header.test.cjs`
- `tests/reaction-diagnostics.test.cjs`
- `tests/reaction-notifications.test.cjs`
- `tests/visible-post-hook.test.cjs`
- `tests/workout-reactions-client.test.cjs`
- `tests/workout-reactions-compiler.test.cjs`
- `tests/workout-reactions-db.test.cjs`
- `tests/workout-reactions-surface.test.cjs`
- `tests/workout-reactions-ui.test.cjs`
- `tests/workout-reactions.test.cjs`
