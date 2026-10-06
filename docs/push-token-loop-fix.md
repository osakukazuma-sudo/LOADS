# TestFlight Push token再発火とlogout修正

## 根本原因

TestFlightの拒否snapshotはoperationCount/trackedOperationCountとも34、signingOut=falseで、
全activeと直前の終了処理が `push-register` / `registerPush.push-token-change` だった。
この実機ログと、導入済みExpo SDK 57のJS・iOS実装を照合した。

循環は次の通り。

1. iOSの `onDevicePushToken` がLOADSのlistenerを呼ぶ。
2. listenerは渡された `DevicePushToken` を捨ててregisterPushを呼んでいた。
3. registerPushは `getExpoPushTokenAsync({ projectId })` を呼ぶ。
4. SDKはdevicePushTokenが指定されていないため `getDevicePushTokenAsync()` を呼ぶ。
5. native側が `registerForRemoteNotifications()` を実行し、`didRegister` が再び `onDevicePushToken` を送出する。
6. 別のregisterPushが開始され、Expo変換・Auth確認・登録RPCが大量に並列実行される。

SDKの `TokenEmitter.ts` と公式ドキュメントにも、listener内からnative tokenを再取得すると
無限ループになり得る旨が明記されている。
参考: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#pushtokenlistenertoken
オプション: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#expopushtokenoptions

SupabaseのRPCがnative tokenイベントを発火させているのではなく、RPCへ到達する前の
native token再取得が循環を作っていた。短時間で大量の開始・終了がある実機ログと一致する。

## listener監査

LOADSの `addPushTokenListener` はNotificationGateの1箇所のみ。
RootLayoutに1つのGateがあり、useEffectのdependencyは `[owner]`。
renderごとには登録せず、AppState callbackもlistenerを追加しない。
cleanupはPush listener、notification response listener、AppState listener、intervalを解除する。
owner切替・remount・StrictModeのeffect再実行でも旧listenerを解除する。
コードと再現テストでlistener多重登録は見つからず、主因は自己再発火と判定した。
実機のlistener数そのものをnative側で測定したという意味ではない。

## 修正

- callbackのnative tokenをregisterPushへ渡し、`getExpoPushTokenAsync({ projectId, devicePushToken })` でExpo tokenに変換する。SDKのnative再取得を避けて根本の循環を切る。
- cleanup済みのcallback、AppState callback、intervalはalive guardで処理しない。
- 同じowner・logout世代・permission要求・native tokenの連続要求は同じPromiseを共有する。準備中からsingle-flightする。
- 異なるtokenは同じowner/世代内で直列化し、古いRPCが新しい登録を後から上書きしない。処理中のA→B→Aも到着順を保つ。
- 成功済みの同一要求を抑止する。別経路からExpo tokenを取得してもowner・device・Expo token・世代が同じなら登録RPCを繰り返さない。
- tokenが変われば新しい変換を行う。Expo token自体が同じでも、native token変更をExpoへ反映する。A→B→Aで古いcacheが最後のAを無視しない。
- 失敗はcacheしない。finallyでin-flightとqueueを解除し、再試行可能にする。
- logout世代が変わると成功cacheを無効化し、旧世代の準備・queueを拒否する。同じアカウントの再ログインでも端末登録を再作成する。

debounce、setTimeout、Pushの無効化、カウンターの強制リセットは追加していない。
accountActivityには既存generationのread-only getterを追加しただけで、logout拒否条件・増減・解除・診断UIは維持した。

## logoutと登録RPCの排他

Push登録のnative/Expo token準備やqueue待機はロック外。実際のowner確認と登録RPCだけ従来通りロックする。
RPCは端末のowner/tokenを更新するため、logoutが先に端末登録を削除し、その後に古い登録RPCが完了すると
ログアウト済みの端末登録が復活する可能性がある。登録書込みと削除の排他は必要なため維持した。
単発のRPC進行中なら短時間の拒否はあり得るが、完了・失敗後に解除される。

## 変更ファイル（今回分）

- src/components/notification-gate.tsx: native token引渡し、cleanup後のcallback guard。
- src/lib/registerPush.ts: token指定、single-flight、成功cache、token更新直列化、旧世代拒否。
- src/lib/accountActivity.ts: generationのread-only getter。
- tests/push-registration-loop.test.cjs: 新規11件。
- tests/push-device.test.cjs: 同時refreshのRPCが2回ではなく1回になる意図した仕様変更を反映。device ID・platform・account不一致の検証は維持。
- tests/account-activity-diagnostics.test.cjs: token callbackに実際と同じDevicePushTokenを渡し、変換結果も変更tokenを反映するmockへ変更。変更tokenのRPC待機診断は引き続き検証。
- docs/logout-activity-diagnostics.md / docs/push-token-loop-fix.md: 原因確定の追記と最新手順。

最初の既存テスト実行では、旧仕様の「同時refreshで2RPC」と、token引数を渡さないmockが失敗した。
今回の意図したdedup仕様と実SDKのcallback契約に基づいて修正し、無関係な期待値は変更していない。

## 検証

- TypeScript: `npm run typecheck` 成功。
- lint: `npm run lint` 成功。
- 全テスト: `npm test` 164件成功、失敗・skipなし（既存153件＋新規11件）。
- git diff --check: 成功。

新規テストは、listenerの登録数、cleanup、remount/StrictMode、繰り返すAppState復帰、SDKの
自己再発火モデルと収束、40回の同一token通知、準備中・RPC中のsingle-flight、token変更とA/B/A順序、
失敗後再試行、logout後の遅延イベント・queue無効化・再ログイン、通知handlerと認証済みroutingを検証する。
既存の投稿upload/delete・pending保持・アカウント分離・logout回帰テストも成功した。
実ネットワークでのPush配信と修正版TestFlightはまだ確認していない。

## 次のiPhone TestFlight確認

1. 診断フラグtrueの修正版ビルドをインストールし、通知許可ありでログインする。起動直後の登録完了を待ってProfileからlogoutする。
2. 成功すれば再ログインし、バックグラウンド→復帰を複数回繰り返してlogoutする。同一tokenで大量のpush-registerがactiveにならないことを確認する。
3. 拒否された場合はCOPY DIAGNOSTICSで保存する。push-registerは同一owner/世代で並列化しないため、多数のactiveが再びある場合はビルド番号も添えて確認する。単発RPC待機なら完了後に再試行する。
4. 実際のPush通知を受信し、通知タップ時のroutingを確認する。logout後は旧アカウント通知がその端末へ配信されず、再ログイン後に通知登録が復元されることを確認する。
5. A→logout→B→logout→Aを確認する。投稿upload/delete中の一時的な拒否、完了／失敗後のlogout、未送信データ保持も再確認する。

migration・RLS・本番データは変更せず、mainへのpush、build/submit/updateは実施していない。
