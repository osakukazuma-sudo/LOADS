# Portfolio Readiness

> この資料はcommit前の確認記録を保存したものです。その後の履歴整理・公開状況はGitのコミットログを参照してください。以下の「commit / pushしない」「未追跡」は各確認時点の状態です。

## Final publication preparation — 2026-10-06

以下の初回確認記録は履歴として保持。現在は公開候補を[Publication Manifest](publication-manifest.md)で分類し、実装・全テスト・Supabase・設定・匿名化docsをindex追加対象に揃えた。commit / push / resetは行わない。

実メール・ユーザーUUID・審査アカウント／project識別子・既存ユーザー表示名を公開用placeholderへ置換し、原本はignoredな.expo内に保存。運用画像3枚と生成デプロイSQLを除外。本番向けops SQLは置換必須の公開templateとした。

最終lint、app TypeScript、Edge Functions TypeScriptは成功。34ファイル／129テスト成功、失敗・skip0。現行公開候補とローカル到達可能履歴の秘密パターン再検査も検出なし。識別子の匿名化は現在の公開版に対する措置で、過去履歴を書換えていない。

確認日：2026-10-06。今回の変更は公開用説明・環境ファイル除外・Starter表示整理に限定。既存の未コミット変更を保持し、stage / commit / push / resetは行わない。

## Git baseline

- 作業ブランチmain、HEAD `11ad446`。ローカルに保存されたorigin/mainとのahead / behindは0 / 0。fetchしていないためサーバー上の最新状態を保証しない。
- 作業開始時のtracked変更21ファイル、差分6,508追加／3,716削除（未追跡ファイルを含まない）。多数の機能がGitHub上のHEADより先に実装されている。
- `tests/`（34ファイル）、`supabase/`全体、削除／通知／Cardio／Feed等の多数のsrc、EAS設定、検証docsが未追跡。READMEだけcommitするとリンクと実態が不一致になる。
- 既存READMEはローカル記録アプリとしての6機能のみ説明し、実装済みCardioを将来予定として記載していた。現行コードに合わせ全面更新。
- package.jsonには既にlint / typecheck / testがある。テスト公開用scriptの新設は不要。

## Quality evidence

- 既存依存を`npm ls --depth=0`で確認：終了コード0。再インストール・依存更新は不要。
- `npm run lint`、`npm run typecheck`：成功。
- `npm test`：129成功、失敗0、skip0、34ファイル。Node.js runner、TypeScript変換とモック、PGlite上のSQL／RLS／RPC検査を含む。
- 自動テストは実機E2Eや実サービスの到達性を証明しない。app用tsconfigはFunctionsをexcludeしており、別のtsconfigで検査する。
- 変更後もlint / app typecheck / testを再実行し成功。`npx tsc -p supabase/functions/tsconfig.json`も成功。READMEのローカルリンクは全て存在し、`git diff --check`も成功。

## Starter inventory

削除より保全を優先し、現時点の参照関係を記録した。

| 対象 | 判断／今回の対応 |
| --- | --- |
| READMEの古い説明・将来予定 | 現行機能へ置換 |
| `app-tabs.web.tsx`のExpo Starter表記 | LOADSへ変更。既存ユーザーのファイル変更を保持 |
| package.jsonのreset-project | 実装を移動／置換するStarter操作なのでnpmの入口だけ削除。scriptファイル自体は保持 |
| `app-tabs.tsx`のexplore trigger / tabIcons | 現行_layoutからのimportは見つからないが、native navigatorと画像は保持して次回整理対象にする |
| animated-icon、hint-row、web-badge、ui/collapsible | 現行画面からの利用は見つからない。相互参照やテーマ依存があるので今回は保持 |
| external-link、themed-text/view、theme hooks | 残存部品から参照あり。一括削除しない |
| react-logo各解像度、tutorial-web | ソース参照を確認できない。削除候補として記録、今回は保持 |
| expo-logo / logo-glow / expo-badge | 残存Starter componentから参照されるため保持 |
| splash-icon、favicon、Android adaptive icon | app.jsonから参照。変更・削除しない |
| LICENSE | Expoの著作権表記を含むMIT。法的な帰属を自己名義へ上書きしない |

公開用の適切な画面画像は見つからなかった。.expoの審査画面は運用情報で、README用プロダクト画面としては使わない。画像生成・撮影はしていない。

## Secret and privacy review

秘密値を出さないローカル検査を実施。trackedと未追跡の公開候補、全ローカルrefsから到達可能な履歴blobを検査した。初回：238テキスト版、履歴blob74件。秘密鍵ヘッダー、Supabase secret／service-role JWT、GitHub／Supabase access token、AWS key、資格情報付きURL、長いパスワード等のリテラルに該当する検出なし。

編集後の再検査：240テキスト版、履歴blob74件。検出なし。検査用の一時scriptはGit除外済みの.expo内に置き、秘密値は出力しない。

- `.env`はGit管理されずignore対象。変数はSupabase URL、公開key、削除UI flagのみ。値は出力しない。
- `.env.example`は置換値のみ。全ての`.env.*`を除外し、この例だけ例外として公開するよう.gitignoreを強化。
- URL／project IDは秘密鍵ではない。READMEには運用プロジェクトの値を埋め込まない。公開keyでもRLSが必要。
- Appleのp8 / p12 / key / mobileprovision / pem等は既存ignore対象。pfxも追加した。
- docsには実メールアドレス、ユーザーUUID、運用プロジェクト参照、審査アカウントの識別情報が存在する。認証秘密ではないが公開の可否を別途確認し、必要なら公開版へ匿名化する。今回は既存の運用記録を勝手に書換えない。
- 正規表現検査は未知形式の秘密を全て検出する保証ではない。未取得remote refs、reflog-only／到達不能objects、外部サービス設定は対象外。公開前にstaged差分とGitHub Secret Scanning等で補完する。

## Suggested commits — not executed

1. 既存実装：Auth／端末保存、投稿／Storage、削除、フォロー、Cardio／通知など依存順で実装・migration・テストを揃える。現行ファイルには複数の変更が混在するため、分割可能性を差分で確認する。
2. `docs: update README for portfolio`：READMEと新規Architecture Notes／この記録。
3. `chore: harden env ignores and remove starter branding`：.gitignore、package.jsonのreset入口削除、残存web tabsの表示。

push前にREADMEの参照先が同じcommitに含まれること、operational docsの公開範囲、実機画像、TestFlightの現在の承認状態、既存変更の採用範囲をユーザーが確認する。READMEの未追跡注意は実装公開が済んだ時点で更新する。
