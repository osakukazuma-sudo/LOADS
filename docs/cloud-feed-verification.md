> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# クラウド投稿・写真の最終確認

## 実機確認の進捗（2026-09-29）

- iPhone / Expo Go: ユーザー操作でベンチプレス20 kg × 10回を記録し、写真付き投稿後にHOMEへ表示されたとの報告あり。キャプションは「実機テストA-01」を案内。これはユーザーによる表示確認で、DB件数の再照合は未実施。
- 別アカウントのPC確認: CREATE ACCOUNTが無反応に見える不具合を修正。使用中のreact-native-webのAlert.alertは空実装のため、signup/loginを画面内メッセージ表示へ変更。ユーザーがCHECK YOUR EMAIL表示、確認メール受信・リンク操作、別アカウントでのログイン成功を確認した。途中のInvalid login credentialsは再入力後に解消し、原因は断定していない。
- PCの別アカウントから、iPhoneの投稿の写真・キャプション・投稿者名がすべて見えるとの報告あり。
- iPhoneで写真と「再送テストA-02」を準備し、機内モード＋Wi-Fiオフで投稿。ユーザーが「Could not reach the cloud. Your saved post can be retried.」表示を確認。通信復旧後の再送が成功し、PCの別アカウントでも写真付きA-02が1件、その下に既存A-01が表示されることを確認した。今回の失敗→再送で表示上の重複はない。DB件数・オブジェクト数の直接照合や、サーバー保存成功直後の応答喪失は実機では未検証。
- PCのFINISH WORKOUT: 原因はreact-native-webのAlert.alertが空実装で、確認ボタンの保存コールバックが呼ばれないこと。完了フロー内の確認・未完了セット警告・保存失敗通知だけをworkoutFinishAlertへ置換した。Webではwindow.confirm/alert、iOSでは従来のAlert.alertへ同じ引数を渡す。ユーザーのPC操作で確認ダイアログの表示、キャンセル後の20 kg・10回セット維持、OK後の投稿画面遷移を確認済み。
- 追加自動検証: Webのキャンセル／実行／エラー通知、iOSへの委譲、保存済み失敗投稿を新しいモジュール実行環境から読み直して同じID・写真参照で再送するテストを追加。既存7件を含め11件成功。再起動テストは永続ストアと写真I/Oをモックしたロジック検証であり、実機確認は下記A-03で実施済み。
- 再起動後の実機再送（A-03）: iPhoneで写真付き「再起動テストA-03」をオフライン投稿して失敗表示を確認後、通信を切ったままExpo Goをアプリ切り替え画面から完全終了。通信復旧後にExpo Go／LOADSを開き直し、HOMEの未送信欄に投稿と再送ボタンが残っていることをユーザーが確認。再送後、写真付き投稿がHOMEに表示され、未送信欄から消えた。PCの別アカウントでHOMEを再読み込みし、写真付きA-03が1件だけ表示されることもユーザーが確認した。DB行数の直接照合はしていない。
- 最終状態: 依頼された3つの基本経路はユーザー操作・画面報告に基づき成功。PC版Workout完了の修正とiPhone再起動後の再送も確認済み。Android（依頼により後回し）、アカウント切替時の未送信分離、Storage拒否系APIの実環境テストは未確認。Workout完了修正後の型チェック成功、lintはエラー0・既存警告3件。

更新: 2026-09-28 / Supabase `YOUR_PROJECT_REF` / Expo SDK 57。

## 確認済み

写真用SQLは前回すでに適用済み。今回、実DBから非公開 `post-photos` バケット（JPEG・6 MiB）、StorageとpostsのRLS、2件ずつのポリシー、投稿権限、写真パス制約と索引を確認した。再適用はしていない。

実DBでロールを切り替えるトランザクション検証が成功。本人投稿、共有フィード読込、重複拒否、所有者偽装拒否、他人の写真パス拒否、更新・削除拒否、匿名読込拒否を確認し、すべてロールバックした。投稿数は0件。これはDB認可の検証であり、AuthログインやStorage HTTP経由の画像転送の検証ではない。

実Data APIへの未ログイン読込は401/42501。未ログインStorage一覧は0件。型チェック成功、lintはエラー0・既存警告3。前回の7テストと3プラットフォームのバンドル成功は再実行していない。

## 実機確認手順（実施状況は上記を参照）

1. プロジェクトで `npx expo start` を実行し、SDK 57対応のExpo Goまたは対応する開発ビルドから開く。PCとスマホを同一ネットワークへ接続し、端末でQRを開く。SDK不一致なら古いビルドで検証を続けず、対応ビルドを用意する。Web確認はターミナルで `w`。参照: [Expo起動手順](https://docs.expo.dev/get-started/start-developing/)、[SDK 57](https://docs.expo.dev/versions/v57.0.0/)。
2. メール確認済みのアプリ用アカウントAでログイン。短いWorkoutを記録・完了し、個人情報のないテスト写真を選び、識別できるcaptionで投稿する。HOMEに名前・写真・集計が表示されることを確認する。この操作は実環境に投稿を保存する。
3. 別端末／別ブラウザーのアカウントBでログインし、HOMEを更新。Aの投稿・写真・投稿者名が見えることを確認する。端末内URIだけで表示できていないことを検証する重要な手順。
4. Aで写真を選んでから通信を切り、投稿を試す。失敗後もWorkoutがHistoryに残り、HOMEの未送信欄に控えがあることを確認。通信を戻し、再送して投稿が1件だけ作成されることを確認する。
5. 未送信データを作った状態でアプリを終了・再起動し、Aで再送できることを確認。別アカウントBではAの未送信分が表示・送信されないことも確認する。ログアウトUIがない場合は、認証を切り替えられる検証環境を用意するまでこの項目を未確認として残す。
6. 写真なし投稿、投稿スキップ、History、Template、BIG3表示を軽く確認する。カメラ／写真権限の拒否・許可も端末側で確認する。

写真の署名URLは実装上3600秒で期限切れになる。再取得はHOMEの更新で行う。署名URLは有効期限内に知っている人が使えるため、共有しない。アプリに投稿削除は未実装なので、テスト投稿を削除する場合は対象を特定して別途対応する。

## Storage API確認項目（アプリ経由の成功とAPI単独検証を区別）

通常アップロードと別アカウントによる写真表示は上記実機操作で確認済み。以下の詳細なAPI単独検証は未実施。

- Aによる自分のパスへのJPEG upload成功。
- 同じパスへの再送で既存オブジェクトを確認し、投稿重複が生じないこと。
- 投稿前のオブジェクトはAのみ読め、投稿後はBも署名URLを発行・ダウンロードできること。
- BによるAのパスへのupload／上書き／削除が拒否されること。
- MIME制限、6 MiB超過拒否。アプリはJPEG変換後にサイズを検証するため、サーバー拒否の確認はAPIテストとして実施する。

参照: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)、[bucket restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets)。

## 再開時の注意

`supabase/verify-cloud-feed.sql` は実DBのSQL Editor（postgres）用。既存profileを1件使用し、検証の書き込みはROLLBACKする。既存マイグレーションのCREATE文を再実行しない。アプリ利用者のパスワード、アクセストークン、service-roleキーをチャットやリポジトリへ貼り付けない。
