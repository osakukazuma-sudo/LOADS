# iOS logout investigation (2026-10-06)

追記: この初回調査の修正だけではTestFlight実機の症状は解消しなかった。
以下のPush待機はコード上で再現した一経路であり、実機原因を確定したものではない。
最新の診断と実機確認手順は [logout-activity-diagnostics.md](logout-activity-diagnostics.md) を参照。

## 原因と修正

`LogoutControl` → `logoutAccount` → `beginSignOut` の順で判定する。
エラーの具体的条件は `accountActivity.ts` の `operations !== 0 || signingOut`。
投稿件数や AsyncStorage の pending 状態はこの判定に使われていない。

`NotificationGate` はログイン後・フォアグラウンド復帰時・Pushトークン更新時に
`registerPush(owner, false)` を自動実行する。修正前は権限確認から
`getExpoPushTokenAsync`、端末ID取得、登録RPCまで共通ロックを保持していた。
実機のトークン取得が未解決のまま待機すると `finally` に到達せず、ユーザーが
投稿・削除を操作していなくてもログアウトを禁止する。Webと非実機は早期returnする。
これはモックで再現したコード上の原因であり、報告されたiPhoneの実行ログによる
待機箇所の確定は未実施。

修正は権限・トークン・端末ID取得をロック外へ移動し、所有者確認と登録RPCのみ
ロックで保護する。ログアウト／アカウント削除開始時に世代を進め、古い準備結果の
利用を拒否する。同じアカウントへ再ログインしても古い結果は登録されない。
登録RPCと端末登録解除の競合防止は維持する。

## 状態管理の監査

| 対象 | ログアウトへの影響・解除 |
| --- | --- |
| 投稿写真準備・snapshot保存 | `prepareLocalPost` がロックを取得、`finally` で解除 |
| 投稿アップロード・再送 | `publishing` Mapで同一投稿を重複実行させず、Promiseの `finally` でMap削除と解除。例外時も解除 |
| 再送UI | `retryBusy` / `retrying` は `finally` で解除。ログアウト判定が直接参照する状態ではない |
| 投稿削除 | `deleteOwnPost` がロックを取得、認証失敗・通信例外・応答エラー・完了のすべてで `finally` に到達して解除 |
| アカウント削除要求 | `beginSignOut` の排他フラグを使用し `finally` で解除。receiptは独立した永続的な復旧情報 |
| アカウント削除status照会 | メモリー内busyを `finally` で解除。logout判定とは独立。fetchには20秒のabort設定あり |
| 通常ログアウト | `finally` で排他フラグ解除。保存失敗・Push登録解除失敗・Auth失敗ではエラーを返しデータを保持 |
| Push登録 | 今回ロック範囲を縮小。RPC処理の成功・例外時は `finally` で解除 |
| workout完了通知同期・Follow書込み | 同じカウンターを使用、`finally` で解除。既存のアカウント変更との競合防止を維持 |

共通ロック、publishing Map、再送UI、syncing Mapはメモリーのみで、完全なアプリ再起動で
リセットされる。AsyncStorageに保存した投稿のpending/failed、通知同期pending、
削除receiptから共通ロックを復元する処理はない。ただし再起動後にはPush登録等が
自動で再実行されるため、修正前は同じ待機状態が再発し得る。

投稿・削除の確認済み経路に `try/finally` 不足は見つからなかった。既存の投稿・削除には
ユーザーキャンセルAPIがなく、返されたPromiseのrejectはfinallyで扱われる。
未解決Promiseに対してロックを時間だけで解除すると処理中のアカウント切替を許してしまうため、
実際の変更処理についてはそのような解除を追加していない。

## データ保持

投稿は `@loads/cloud-posts/v1/<userId>/<postId>`、workout・active workout・template等は
`@loads/local/v1/<userId>/<collection>` に分離される。
通常ログアウトはローカル書込みをflushし、端末のPush登録を解除してlocal scopeでAuthを
signOutするだけで、投稿・workout・templateを消さない。アカウント削除専用のcleanupは変更していない。
UIはアカウントのcontext/keyを切り替え、feedのAuth変更時にも表示と旧リクエストを無効化する。

## 検証

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test`: 139件成功、失敗・skipなし
- `node --test tests/logout-regression.test.cjs tests/push-device.test.cjs`: 14件成功
- `git diff --check`: 成功

追加した10件のテストは実際の投稿・削除・ログアウト・ローカル保存・ロック実装をロードし、
外部通信・native APIをモックする。upload/retryとdeleteの進行中・成功・失敗、停止中のpending/failed、
ログアウト後の保持、再起動を含むA/B/Aの復元・分離、Push待機・遅延結果・RPC例外・Webスキップを検証。
既存Pushテスト4件はロックのモックを外して実装で検証し、期待値は変更していない。
全既存テストのDB検証はローカルPGliteで行われ、本番DBへ変更を加えていない。

## iPhone確認手順

1. 修正を含む開発ビルドでテストアカウントAへログイン。通知許可ありで起動・復帰直後にProfileのCONFIRM LOGOUTを押す。Pushトークン準備だけで従来のエラーが出ないことを確認する。
2. Aでworkout・template・未送信投稿を保存する。投稿送信時に通信を切り、送信失敗が確定した後に通信を戻してログアウトできることを確認する。通常ログアウトにはPush登録解除の通信が必要なので、完全オフラインのままの確認とは分ける。
3. Aへ再ログインし、未送信投稿・写真・workout・templateが復元されることを確認する。再送でき、完了後にログアウトできることも確認する。
4. テスト環境でアップロード中／投稿削除中にログアウトを試し、一時的に止まることを確認する。成功または通信エラーが確定した後はログアウトできることを確認する。
5. 別アカウントBでAのデータが表示されないことを確認し、Aへ戻して復元を確認する。未送信投稿がある状態で完全終了・再起動しても同様に確認する。
6. Push取得が遅延する通信環境でログアウトし、AまたはBへ再ログインする。古い登録結果が新しいセッションへ適用されないことをテスト環境の登録状況で確認する。

本番データ・migration・RLSは変更していない。commit/push/build/deployも実施していない。
