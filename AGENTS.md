# AGENTS.md

React Native 0.87 (React 19) + TypeScript mobile app for the RYOBI soil sensor.
Bare RN CLI (not Expo). BLE protocol facts are ported from the Web app at
`react-soil-sensor/soil_sensor_app/src/ble_soil_sensor.jsx`.

## Commands

- `npm start` — Metro dev server
- `npm run android` / `npm run ios` — run in emulator/simulator
- `npm run lint` — ESLint (`eslint .`, extends `@react-native`)
- `npm test` — Jest (preset `@react-native/jest-preset`)
- `npx tsc --noEmit` — typecheck (there is **no** `typecheck` script)

## Android device run (real device)

- Port 8081 is occupied by the unrelated Java backend
  `opee/datal-ogger/data-logger-backend`. Start Metro on 8082 and reverse-map:
  `npx react-native start --port 8082` then
  `adb reverse tcp:8081 tcp:8082`.
- Install directly: `cd android && ./gradlew app:installDebug`. If it fails with
  `Unable to delete directory ... merged_native_libs`, run `./gradlew --stop`
  and delete `app/build/intermediates/merged_native_libs` first.
- BLE permissions: manifest declares `BLUETOOTH_SCAN/CONNECT` (API 31+) +
  location (API 30-); runtime request in
  `src/features/scanner/data/permissions.ts` (asked before each scan start).
- Build may download Gradle/deps from dl.google.com; a TLS handshake failure is
  transient — just retry.

## Architecture

Layered + feature-first. Protocol parsing is **pure TS** (`no react-native`
imports) so it runs in Jest:

```
src/core/        constants/protocol, errors, utils (format, uuid, base64)
src/features/
  scanner/       data/bleTransport, domain/scanState, hooks, ui/ScannerScreen
  sensor/        domain/codec.ts (pure), domain/historyUtil, data/gattRepository,
                 hooks/useGattReader + useHistory, ui/SensorDetail + HistoryChart
  settings/      SettingsScreen
src/app/         navigation/, theme/colors
src/shared/      components/MetricCard
```

## Protocol facts (from Web impl — don't "fix" per intuition)

- Live readings via GATT `00000000-0001-...` service, **3s polling**, not
  advertising. EC live = `uint8 / 20`; EC record = `byte / 100` (different!).
- Record service `00000000-0000-...`; characteristic UUID pattern
  `XXYY0000-0000-726f-736e-65536c696f53` (YY=family 00 L2 / 01 L1 / 02 Latest).
- UUIDs may be byte-swapped by different BLE stacks — always match via
  `buildUuidVariants` (`src/core/utils/uuid.ts`).
- Reading toggle char: write `0x01` on / `0x00` off.
- Constants + codec golden tests in `src/core/constants/protocol.ts` and
  `__tests__/codec.test.ts`.

## Testing gotchas

- `jest.setup.js` mocks `react-native-ble-plx` (native module won't load in
  Jest). `jest.config.js` adds `transformIgnorePatterns` for react-navigation/
  svg/screens.
- No real BLE in tests; keep codec/domain logic testable without the native
  layer.

## Environment

- Node >= 22.11.0. iOS needs `bundle install` + `bundle exec pod install`
  before first build; re-run `pod install` after adding native deps (e.g. new
  ble-plx/svg versions). Native dirs `ios/`, `android/`, `vendor/` are generated.
- ble-plx: lock version + regression test on device before upgrading (new
  architecture compat).

## Style

- Prettier 2.8.8: `singleQuote`, `arrowParens: avoid`, `trailingComma: all`.
- `no-bitwise` is disabled in codec/base64/protocol files — bit ops are
  essential for BLE parsing there.
- TypeScript for all source; `App.tsx` is the entrypoint.
