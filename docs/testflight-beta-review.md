> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# LOADS Beta App Review preparation

Updated: 2026-10-05 (JST). **Beta App Review submitted successfully.** App Store Connect app `YOUR_ASC_APP_ID`, external group `LOADS Beta`, iOS 1.0.0 (7), visible status **審査待ち / Waiting for Review**. Group has one build and zero external testers. Public link has not been created; owner requested issuance after approval.

## Executed result — supersedes preparation notes below

- Owner created and confirmed dedicated account `reviewer@example.com`, actual username/display name `review_account`, UUID `00000000-0000-4000-8000-000000000001`. Auth dashboard shows confirmed and signed in at 2026-10-05 19:04 JST. Original four Auth users remain listed; total five.
- Owner entered the review-only password directly in the local app and App Store Connect. Password was not read, printed or saved in repository files.
- Real local web app at `http://localhost:8082` signed in successfully. Verified initial empty HOME/workout/template state; profile resolved to review_account, zero follows/followers.
- Created one synthetic workout owned by this account: BENCH PRESS 20kg x 5, one completed set, 100kg volume; WALKING 5 minutes, 0.4km; clearly marked synthetic notes. Finished and saved; HISTORY and detail show both exercises, strength PRs and cardio summary.
- Saved `Apple Review Demo` template and verified its two exercises in the template picker. Starting/reusing it as a second workout was not exercised.
- Published one text-only synthetic post with caption `Apple Review Demo — synthetic workout for testing LOADS.` Own post is visible in HOME with correct author, strength/cardio summary and owner deletion control.
- Profile shows one workout, 100kg volume, 20kg bench PR; reload retains authenticated identity and local workout statistics. Exact-username search resolves review_account and opens own profile. No follow/tag action targeting existing users was performed.
- Saved English beta description, feedback/contact email, supplied contact name/phone, sign-in-required flag, dedicated account credentials and English review steps. App Store Connect displayed 保存済み. Submitted bilingual What to Test text for build 7; automatic tester notification remains enabled.
- Added build 7 to LOADS Beta and clicked 審査へ提出. Verified resulting group/build status 審査待ち. No contracts/identity prompts required additional action after owner login.
- Public-link setup supports open entry or device/platform criteria and an optional tester limit. Opened for read-only inspection then cancelled; no link issued before approval.
- Lint and typecheck passed again on 2026-10-05. Application source, schema, RLS, global Auth settings and existing-user data were not changed by this work. New review account/synthetic data only; no deletion executed.
- Verification limitation: this is a real browser UI test against production Supabase, not an installed iOS build-7 device test. Camera/photo upload, native notification/APNs delivery, follow/unfollow with a second account, template execution and account/post deletion were not tested in this task. Native local history does not receive the web-created history/template; the cloud post is available to the same signed-in account.

Next: await Apple approval; then LOADS Beta > テスター > パブリックリンクを作成, choose tester limit, confirm and copy link. Verify build is available for external testing before sharing with friends. No approval monitor/automation was created.

## Test information — draft ready to paste

### Beta App Description (Japanese)

LOADSは、筋力トレーニングと有酸素運動を記録し、トレーニングの成果を共有できるアプリです。種目・重量・回数・セット、有酸素運動の記録、履歴、テンプレート、自己ベストを管理できます。ワークアウトを写真やコメント付きで投稿し、ユーザー検索とフォローを通じて仲間の記録を確認できます。

### Beta App Description (English)

LOADS helps you log strength and cardio workouts and share your training. Record exercises, sets, weights and reps; review workout history and personal records; and save workout templates. Share workout posts with an optional photo and caption, find athletes, and follow their training.

### What to Test — 1.0.0 (7)

ログイン、筋トレ・有酸素運動の記録、ワークアウト終了と履歴表示、テンプレート保存・再利用、写真付き投稿、ユーザー検索・フォロー、フォローしたユーザーの投稿表示を確認してください。問題があれば、発生した画面、操作手順、iPhone機種、iOSバージョンをTestFlightのフィードバックでお知らせください。ワークアウト履歴・テンプレートは端末内に保存されます。写真と通知の許可は任意です。

### Beta App Review Notes — draft, finalize after account/device verification

LOADS is a workout logging and sharing app. Use the dedicated review account provided in the Sign-in Information fields. Sign-in uses email and password. Internet access is required for sign-in and social features.

Suggested review flow:
1. Sign in, then open WORKOUT. Add a strength exercise, enter a weight and repetition count, mark a set complete, and finish the workout.
2. Open HISTORY to review the saved workout. Workout history and templates are stored locally on the device, so a fresh installation starts with an empty local history.
3. Create a workout post with a caption. Attaching a photo is optional. Camera and photo access are requested only for the corresponding action.
4. Open PROFILE to view the review account and its workout statistics. Use athlete search to inspect profiles and follow an athlete. HOME displays the account's own posts and posts from followed athletes; an empty feed before posting or following is expected.
5. Notification permission is optional. Core workout logging works without notification permission.

Do not claim preloaded history, sample posts, verified push delivery, or absence of additional authentication steps until the actual review account and build have been checked. Record the exact account-deletion location and build behavior after installation verification, before finalizing these notes.

## Outstanding fields

- Feedback email: `reviewer@example.com` (owner supplied).
- Review contact name and phone: supplied privately by owner; enter directly in App Store Connect, do not commit to Git.
- Marketing URL / privacy policy URL: use only real, accessible owner-provided URLs if requested by the form; do not invent URLs.
- Sign-in required: yes. Dedicated email/password: not yet created; enter directly in App Store Connect, never in this document or Git.

## Safety and verification record

- Production project `YOUR_PROJECT_REF` is Healthy in authenticated dashboard. Auth currently lists four existing users. No production mutation performed.
- `reviewer@example.com` already belongs to EXISTING_USER_A. Do not reuse/reset it for Apple review.
- Owner approved separate email: `reviewer@example.com`. Username `review_account` was available through the real profiles API on 2026-10-05. Local app signup form is prefilled with this username/email and display name `LOADS Apple Review`; awaiting owner password entry, submission and email confirmation. Account is not yet created.
- Signup supplies `username` and `display_name` metadata required by the profile trigger. Use the app signup flow and confirm the email, preserving global email-confirmation settings.
- Use a unique strong review-only password. No admin/service-role access, existing-user follows/tags, push recipients, schema edits, or global Auth changes are needed to create the review account.
- Existing app stores workouts/templates by user UUID. Shared posts use owner checks/RLS; following_feed is an invoker view. Existing metadata verification documents are historical evidence, not a fresh full production security audit.
- Local lint and typecheck passed on 2026-10-05. These checks do not verify uploaded build 7 or real iPhone behavior.

## Remaining execution

1. Owner confirms unused dedicated email, enters new password in signup UI, and completes email confirmation. Credential entry is an owner handoff.
2. Verify actual login, profile, empty initial account state, strength/cardio save, history, template, own post and social screens. Use only clearly marked synthetic review data; do not modify other users or send them tags/notifications.
3. Verify the same account in installed TestFlight build 7. A local web test cannot establish native build parity, camera access, APNs delivery or device-local persistence.
4. Owner completes Apple Account login/2FA and any required agreements. Inspect LOADS TestFlight, build processing/export compliance and `LOADS Beta`.
5. Save test information and review credentials, add 1.0.0 (7) to the external group, then submit Beta App Review. Verify the visible submitted status.
6. After approval and a build available for external testing, enable the public link in `LOADS Beta`, set a suitable tester limit, and copy the resulting URL. No public link issued yet.

References: https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/ and https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/
