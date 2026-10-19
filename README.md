# (SRKVM Kit Distribution)

Offline Android app (Expo SDK 54, React Native 0.81.5, JavaScript) for kit distribution at mandal level:
schools, item catalog, stock, receipts, reports, and 58 mm thermal printing (Bluetooth Classic, ESC/POS).
App name shown on the phone: **SRKVM**. Android package: `com.thermalprinterapp` (do not change it: the Google
sign-in client and installed data are tied to it).

## Build / run
- Development build only (not Expo Go): `npx expo run:android`
- `android/gradle.properties` must keep `newArchEnabled=false`.
  `react-native-bluetooth-classic` does not work on the New Architecture (NativeModule is null).
  Do not set it back to `true`, and do not upgrade Expo SDK / packages without testing Bluetooth.
- Metro only (JS changes): `npx expo start --dev-client`
- The `android/` folder is committed, so changes in `app.json` do NOT reach the native project by themselves.
  Native changes (app name, icons, permissions, new native packages) are made in `android/` and need a rebuild.
  After adding a native package: `npx expo install <package>`, then `cd android; .\gradlew clean; cd ..; npx expo run:android`.
- Release APK (EAS): `eas build --platform android --profile production` (profile `production` = internal APK;
  `eas.json` uses `cli.appVersionSource: "local"`, so raise `versionCode` in `android/app/build.gradle` for each release).
  Keep the keystore backed up. Check `git check-ignore android` first (the folder must be committed or EAS will not see it).

## Main features
| Area | Where | Notes |
|---|---|---|
| Receipt | Receipt tab | School -> Roll popup (Proceed / Update) -> items auto-filled (Required - Given, only if stock available) -> Thermal / PDF / System print. Negative count (e.g. `-3`) = Return. **Preview** button shows the receipt text before printing. |
| Size-wise items | Receipt tab | Items that have sizes (e.g. Shoes 15-32) open a size popup: how many of each size. Total stays in `count`, per-size counts are saved in `sizes`. Per-size stock is checked when stock entries have sizes. Printed / PDF lines show `Size: 20x3, 21x1`. |
| History | History tab | Receipts are a ledger (no cap). Cancel (new receipts) / Delete (legacy only). Reprint prints the same layout with "DUPLICATE COPY". |
| Schools | Settings -> Schools | Type label, Min-Max classes, Boys/Girls roll per class. Excel upload (template or UDISE+, see below) with preview. |
| Items | Settings -> Item Catalog | Code, Type (dynamic), SubType (Common/Boys/Girls), class range, semester, sizes, per-student norms. Excel upload with template + preview. |
| Stock & Balance | Home | Received (manual entries) - Given (from receipts) = Balance. Size-wise table for sized items. Printing is blocked when stock is short. |
| Requirement & Deficit | Home | Required (roll x norms) vs Received, including per-size shortages. |
| Reports | Home | Stock, Requirement, School-wise, Receipts list, **Selected School Report** (pick one school): A4 PDF / Excel. Sized items show size sub-rows. |
| Academic Year Close | Home | Backup (required) -> roll promotion preview -> type CLOSE. Clears the year's receipts + stock, promotes rolls, new invoice series. |
| Backup / Restore | Settings | JSON file with all app data (manual), plus Google Drive auto backup (below). |

## Printer
- Home shows the printer card (Connect / Disconnect). The last connected printer is saved in `last_printer`.
- `BluetoothService.ensureConnected()` = already connected, or one silent reconnect to the last printer (8 s, no permission
  prompt). Print and reprint call it first. A failed print is never re-sent automatically (avoids double prints).
- Home tries one automatic reconnect when the app starts. Disconnect forgets the saved printer.
- `ReceiptPrinter.buildReceiptBase64` is the only ESC/POS builder (print + reprint). `buildReceiptPreview` is a text mirror
  of it: change both together.

## UDISE+ roll upload (Schools -> Upload)
Upload the UDISE+ "Enrolment Details" Excel directly (the app detects it: title rows, then `UDISE Code`, `School Name`,
`Class N(Boys)` / `Class N(Girls)` / `Class N(Trans)` columns). A preview is shown first; nothing is saved until Confirm.
- Matching is by UDISE code only. Found = **Update**, not found = **New school** (added).
- Update changes only the roll of classes inside the school's Min-Max range. Name, address, type and items are kept.
  If the school has no class range yet, range (and type if empty) is taken from the classes that have students.
- Students in classes outside the school's range are reported (warning) and not added.
- Trans students are added to Boys. PP classes are ignored.
- New school: type is a guess from the class range (PS / UPS / HS / HS+). It is only a label and can be edited.
- Preview shows `Roll old -> new (+/-n)`; reductions are red. Schools whose roll already matches are only counted.
  A warning is shown if the file's academic year differs from the app's. On Confirm, if items already given exceed the
  new roll's requirement, the same "Roll reduced" warning as the Edit School screen is shown.
- Schools missing from the file are left untouched.

## Google Drive auto backup (Settings -> Backup & Restore)
- Switch on: Google account is chosen once (silent sign-in later). The backup is ONE file `srkvm-backup-latest.json`
  in the app's hidden Drive folder (`appDataFolder`, scope `drive.appdata`); every backup overwrites it.
- When: after 7 PM each day. The app checks on start, on returning to foreground and every 5 minutes while open;
  a backup runs if no backup was made since the last 7 PM. After a failure it retries after 30 minutes.
  It cannot upload while the app is closed.
- A daily 7 PM local notification reminds the user to open the app (`services/BackupReminder.js`, needs notification
  permission; a tap just opens the app, the backup is made by the check above).
- Switch-on asks Restore / Replace when Drive already holds a backup (protects a new phone). "Drive Restore" restores
  with the same checks as file restore. Empty data is never uploaded.
- Setup (Google Cloud, one project): enable Drive API; OAuth consent screen with scope `drive.appdata` and all users'
  Gmail addresses under Test users (or publish the app); an **Android** client per signing key (package
  `com.thermalprinterapp` + SHA-1 of the debug keystore, and of the EAS release keystore from `eas credentials`);
  one **Web application** client whose ID goes into `WEB_CLIENT_ID` in `services/DriveBackupService.js`
  (it must be the Web client, not the Android client: otherwise sign-in fails with `DEVELOPER_ERROR`).
- In Testing mode Google may ask for sign-in again after about 7 days: switch off and on in Settings.

## Academic year and invoice numbers
- Academic year = April-March, written `2026-27` (editable in Settings; saved once, never changes silently).
- Invoice: `2026-27/0001`. The number is used up only after something was really printed / produced, in one atomic write with the receipt.

## Code layout
- `screens/` UI only. `services/` storage and business logic. `components/`, `constants/` shared UI and theme.
- `services/*Model.js` are pure helpers (validation and maths), no storage.
- `services/ReceiptPrinter.js` builds the ESC/POS receipt bytes (new print and reprint share it).
- `services/MigrationService.js` runs once per install/restore (idempotent, flag based).
- `components/Hero.js`: the rounded fixed header used by all screens. A screen that uses it sets its outer
  `SafeAreaView` to `edges={['left','right','bottom']}` and places the Hero outside the ScrollView / FlatList.
- `components/WelcomeSplash.js`: welcome overlay at app start (shows `assets/srkvm.png`, tap to skip).
- `components/FloatingTabBar.js` and bottom sheets add the bottom safe-area inset so buttons stay above the Android
  navigation bar.

## UI notes (things that broke before)
- Add / Edit sheets use a plain `View`, not `KeyboardAvoidingView` (it made the sheet shake on Android).
  The Item Types sheet in Catalog still uses `KeyboardAvoidingView`.
- Never write `{/* comment */}` on the same line right after an opening tag: it becomes a text node and causes
  "Text strings must be rendered within a <Text> component".
- Do not define components inside another component (inputs lose focus on every keystroke).
- Long lists in sheets (e.g. upload preview) use `FlatList`; rendering many rows at once made the sheet stall.

## Icons and name
- Launcher icons: `android/app/src/main/res/mipmap-*` (`ic_launcher`, `ic_launcher_round`, `ic_launcher_foreground`,
  `ic_launcher_background`) and `mipmap-anydpi-v26/*.xml`. Notification icon: `drawable-*/notification_icon.png`.
  `assets/icon*.png` are the 1024 px sources. App name: `app_name` in `res/values/strings.xml` (and `name` in `app.json`).

## AsyncStorage keys
`shop_settings`, `schools_list`, `item_catalog`, `item_types`, `receipt_index`, `receipt:<id>`, `stock_entries`,
`invoice_serial_<academicYear>`, `receipt_history` (old format, kept untouched), `migration_2b_done`, `migration_3a_done`.
Backup includes all of these.
Not in Backup (device-specific): `last_printer` (`{name, address}`), `drive_backup_meta` (Drive auto backup switch,
account, last backup time / error).

## Known limitations
- ESC/POS text is Latin-1: Telugu text cannot be printed on the thermal printer (PDF supports it if the device font does).
- Reports cannot be printed on the thermal printer (PDF / Excel only).
- The template Excel upload (Schools / Items) does not show the "roll reduced below given" warning; the UDISE+ upload and
  the Schools edit screen do.
- Drive backup and its reminder do not run while the app is closed (Android background limits); the user must open the app.