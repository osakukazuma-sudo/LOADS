# ログアウト拒否時のaccountActivity診断

## 現時点の結論

更新: TestFlightから取得した34件すべてが `registerPush.push-token-change` というログにより、
native token再取得による自己再発火を特定・修正した。最新の原因・検証・実機手順は
[push-token-loop-fix.md](push-token-loop-fix.md) を参照。以下の未確定という記述は診断追加時点の調査記録。

TestFlight実機でロックを保持する処理は、まだ実機ログがないため未確定。
前回のPush準備範囲の修正に追加して、今回は全ロック取得箇所の診断を実装した。
推測による別処理の解除、カウンターのリセット、判定の削除、timeoutによる強制解除は行っていない。
DB・migration・RLS・本番データは変更せず、build/submit/update/pushも実施していない。

## 全取得箇所

`operations++` / `operations--` は `src/lib/accountActivity.ts` のみに存在する。
独立した `endAccountOperation` / `beginOperation` / `endOperation` APIはなく、返されたrelease関数が終了API。
ログアウト拒否条件の定義も `beginSignOut` の `operations || signingOut` の1箇所のみ。

| operation名 | 開始元 | 保持する処理 | 終了経路 |
| --- | --- | --- | --- |
| prepare-post | cloudPosts.prepareLocalPost | 認証確認、写真加工・保存、snapshot保存 | try/finally |
| upload-post / retry-post | cloudPosts.post-composer / cloudPosts.feed-retry | 認証確認、tombstone・既存投稿検索、写真upload、insert、成功／失敗のローカル保存 | publish Promise.finally。publishing Mapの削除も同時 |
| delete-post | postDeletion.deleteOwnPost | 認証確認、delete-post Function、ローカル投稿のretire | try/finally |
| push-register | registerPush.app-start / app-resume / push-token-change / registerPush | トークン準備後の認証確認、register_push_device RPC | try/finally |
| workout-completion-sync | notifications.app-start / app-resume / foreground-interval / workout-finish | baseline・workout読出し、認証確認、record_workout_completion RPC、ack保存 | try/finally。syncing Map削除は外側Promise.finally |
| follow-write | follows.setFollowing | 認証確認、Follow/Unfollow書込み、変更通知 | try/finally |

`retry-post` は送信と同じロック。feedのRETRYボタン、またはfailed snapshotの送信を分類する。
`prepare-photo` / `photo-upload` は親operation内のphaseであり、カウンターを二重に増やしていない。
feed読出し、getPendingPosts、写真選択、notification preference、削除status照会はこのカウンターを増やさない。

以下の2処理は `operations` を増やさず、`beginSignOut` で `signingOut` を保持する。
診断では `exclusiveOperation` として別に記録する。

- logout: accountSession.logoutAccount。flush → Push登録解除 → auth.signOut。finallyで終了。
- delete-account: accountDeletion.requestAccountDeletion。flush → getUser → receipt保存 → 削除要求。finallyで終了。

アカウント削除status照会・再要求・cleanupは独立した復旧経路で、この共通ロックを取得しない。
削除receiptの存在だけでoperationを生成する処理はない。

## 前回後にも残る待機経路の監査

- 起動後とAppState復帰でPush登録とworkout完了同期が自動実行される。完了同期はforeground中に毎分、workout終了時にも実行される。Push token更新でも登録を実行する。
- Pushの権限・token取得は前回修正によりロック外。今回テストでも待機中のoperationCountが0であることを確認した。一方、**getSessionや登録RPCの待機**は引き続きロック内。
- 完了同期は未同期workoutがなくても、baseline・状態・workoutの読出し中はロック内。過去のローカル書込みqueueを `readLocal` が待つ可能性もある。workoutがあればgetSession、RPC、ack書込みも待つ。
- 投稿upload失敗後、catch内のtombstone検索や失敗状態保存が未解決になると、元のuploadが失敗済みでも最終finallyにはまだ到達しない。phaseにこの待機箇所が表示される。
- 投稿準備の画像処理、写真のarrayBuffer読出し、Storage upload、PostgREST要求、投稿削除FunctionにもPromise待機がある。今回timeoutや通信設定は変更していない。
- アカウント削除Functionには既存20秒timeoutがあるが、flush/getUser/AsyncStorage等の前後には別の待機がある。operationsが0でもsigningOutがtrueならログアウト拒否になる。
- _layoutのAuth callbackはsetStateのみ。feedのAuth callback内ではAPI呼出しをsetTimeoutへ遅延している。直接callback内でロックを保持するAuth APIをawaitする経路は見つからなかった。getSession内部のrefresh/ロック待機については、今回phaseがauth-get-sessionなら次に確認する。
- 全取得箇所にfinallyがあり、正常なreject／例外／early returnは解除に到達する。未解決Promiseはfinallyを実行しない。unmountもPromiseを自動終了しないため、安全性のために処理の終了まではロックを保持する。
- publishing/syncingのMapは同じ実行中Promiseを返す重複防止であり、停止中のpending投稿からロックを復元しない。完全再起動でメモリー上のロックはリセットされるが、自動同期は再実行される。

以上は候補の一覧であり、どれかを実機原因と断定していない。

## 追加診断

拒否時にはrelease/TestFlightでも `console.warn` を呼ぶ（__DEV__条件なし）。
接頭辞は `[LOADS accountActivity]`、eventは `signout-blocked`、識別子は `account-activity-v1`。

- operationCount: 元のカウンター。trackedOperationCount: 診断Mapの件数。両者が一致するか確認できる。
- activeOperations: ID、name、source、startedAt（UTC ISO）、elapsedMs、phase、phaseStartedAt、endCalled、endedAt。
- signingOut / exclusiveOperation: 通常operationとは別の排他フラグと保持元。
- recentEndedOperations: 直近40件の終了記録。IDごとにendCalled=trueとendedAtを照合する。
- capturedAt: ログ取得時刻。全てメモリー内で管理し、診断のために保存データを書き換えない。

たとえば次の組合せで待機先を絞れる（説明用であり実機の取得結果ではない）。

```json
{
  "event": "signout-blocked",
  "diagnosticVersion": "account-activity-v1",
  "operationCount": 1,
  "signingOut": false,
  "activeOperations": [{
    "name": "workout-completion-sync",
    "source": "notifications.app-resume",
    "phase": "record-workout-completion-rpc",
    "endCalled": false
  }]
}
```

通常は拒否時だけconsole出力する。診断ビルドのJS bundle生成時に
`EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS=true` を渡すと、begin/phase/endも出力する。
既存eas.jsonや環境設定は変更していない。エラーメッセージとログアウト判定は変更していない。
token、account ID、メール、写真URI、投稿内容、パスワード、receipt、任意エラー文字列やstackは記録しない。
consoleが例外を投げてもロック解除や既存の拒否を妨げない。

## Windows環境からのTestFlight診断UI

`EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS=true` のビルドだけ、Profileのログアウト欄に
`ACCOUNT ACTIVITY DIAGNOSTICS` を表示する。通常のproductionビルドでは、この値を未設定またはfalseにする。
この環境変数はJS bundle生成時に渡すもので、既存のTestFlightアプリを起動した後に値を切り替えても
表示は変わらない。診断用ビルドに変更とフラグの両方を含める必要がある。今回ビルド・配布は実行していない。

拒否前は `Run CONFIRM LOGOUT to capture a blocked attempt.` を表示する。
拒否直後にはそのErrorだけに紐付けたsnapshotを表示する。active operation名・ID・開始時刻・経過時間・
開始元・待機段階・件数とsigningOut保持元を表示し、`COPY DIAGNOSTICS` でJSON全体をplain textとしてコピーする。
コピー成功時に `Diagnostics copied.`、失敗時には固定のエラーメッセージを表示し再試行できる。
token・メール・ユーザーID・個人情報・任意の例外内容は診断JSONに含めない。

表示は拒否時点の情報で固定する。後からoperationが終了しても書き換えない。
再度CONFIRM LOGOUTすると新しい試行のsnapshotへ更新し、ブロック以外の失敗なら古いsnapshotは消す。
アプリ再起動やProfileのunmountをまたぐ永続保存は行わない。
カウンター、取得／解除条件、世代管理、通信処理、ローカルデータ保存は変更していない。

1. 診断フラグがtrueの変更済みTestFlightビルドをiPhoneにインストールし、アプリを起動する。
2. Profileの下部へ移動し、診断パネルが表示されることを確認する。LOGOUT → CONFIRM LOGOUTを押す。
3. ブロックされたら、その直下のパネルで `signout-blocked` とactive operation／signingOut保持元を確認する。
4. `COPY DIAGNOSTICS` を押し、`Diagnostics copied.` を確認する。メモなどに貼り付け、TestFlightビルド番号とともに調査用に保存する。Macは不要。

追加テスト `tests/account-activity-diagnostics-ui.test.cjs` は、実際の拒否snapshot・UI表示・コピーを検証する。
フラグ無効時の非表示、過去snapshotの混同防止、個人情報フィールドが含まれないこと、exclusive保持元、
Clipboardのfalse/reject、重複copy防止、unmount後の完了も検証した。

## Console取得を併用する場合（Macがある環境向け）

1. この変更を含むビルドを用意する。より詳しい時系列が必要なら、その診断ビルドのbundle生成時だけ上記のverboseフラグを有効にする。今回こちらからビルド・配布は行っていない。
2. MacにiPhoneを接続してロックを解除し、Console.appでDevicesのiPhoneを選んでStart streaming。LOADSのプロセスと `[LOADS accountActivity]` で絞り込む。ログ取得方法の参考: https://docs.expo.dev/debugging/runtime-issues/#ios-console-app
3. 起動直後にProfile → CONFIRM LOGOUT。拒否ログのdiagnosticVersion、operationCount、activeOperations、exclusiveOperationを保存する。
4. 投稿・削除を操作せず、一度バックグラウンドへ移動して復帰し、再度logout。app-startかapp-resumeか、phaseとelapsedMsがどう変わるか確認する。
5. 時間を置いて再度logout。**同じID・同じphaseのままelapsedMsだけ増える**なら、そのawaitが未解決。IDが変わるなら別の自動再実行。begin/endログまたはrecentEndedOperationsで終了を照合する。
6. 実際の投稿upload・削除中の拒否は維持され、終了／失敗確定後にはIDがactiveから消えることを確認する。
7. TestFlightのバージョン／ビルド番号、操作時刻、該当JSONをまとめる。実機ログが得られてから保持元の根本原因を修正する。

JS consoleが端末ログへ表示されるかはreleaseランタイム／ログ取得環境にも依存し、TestFlight実機での出力確認は未実施。
Mac Consoleに表示されなければ、この診断を含む開発ビルドで同じ操作を再現してログを取得する。
TestFlightのスクリーンショットやクラッシュ報告だけで、このJS診断ログが自動回収されるとは扱わない。
新しい外部ログ送信サービスや本番DBへの診断保存は追加していない。

## テスト結果

`npm run typecheck` / `npm run lint` / `npm test` は成功。診断instrumentationの8件とUIの6件を追加し、元の139件を維持して合計153件成功（失敗・skipなし）。
追加ファイル: `tests/account-activity-diagnostics.test.cjs`、`tests/account-activity-diagnostics-ui.test.cjs`。

開始→終了、例外／early returnのfinally、同時operationと拒否ログ、exclusive削除、
完了同期の無処理／RPC例外、Push token待機／RPC待機／所有者不一致、実際のNotificationGateの
起動・復帰・interval・token更新callback、unmount後の未完了ロック保持、履歴上限、logger例外を検証した。
外部通信・native APIをモックし、accountActivityや同期の実装をロードして検証している。
TestFlight実機の保持元を既に取得したことを意味するテストではない。
