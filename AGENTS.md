# AGENTS.md

React Native 0.87.1 / React 19.2.3 TypeScript app for RYOBI soil sensors and
SmartPots. This is a bare React Native CLI app, not Expo; `App.tsx` is the
entrypoint and `src/application/compositionRoot.ts` wires the runtime.

## Commands

- `npm start` starts Metro.
- `npm run android` and `npm run ios` build and launch the app.
- `npm run lint` runs the repository ESLint configuration.
- `npm test` runs Jest; use `npm test -- --runInBand` for deterministic runs or
  `npm test -- __tests__/v4-domain.test.ts` for a focused test file.
- `npx tsc --noEmit` is the typecheck; there is no npm `typecheck` script.

Use Node `>=22.11.0`. After a fresh clone or native dependency change, run
`bundle install` and then `bundle exec pod install` before iOS builds.

## Native Development

- Android BLE permissions are declared in
  `android/app/src/main/AndroidManifest.xml` and requested at runtime by
  `src/infrastructure/ble/permissions.ts`: scan/connect on API 31+, location on
  API 30 and below.
- On the real Android-device workflow, port 8081 is occupied by the sibling
  backend. Start Metro with `npx react-native start --port 8082`, then run
  `adb reverse tcp:8081 tcp:8082`; install with
  `cd android && ./gradlew app:installDebug`.
- If Gradle cannot delete `merged_native_libs`, stop Gradle with
  `./gradlew --stop` and remove `android/app/build/intermediates/merged_native_libs`
  before retrying.
- BLE behavior requires a real-device regression check; Jest has no real BLE.
  Keep `react-native-ble-plx` locked unless native compatibility is deliberately
  tested.

## Structure

- `src/domain/` contains platform-independent entities, value objects, ports,
  policies, and `ReadingDecoder`.
- `src/application/` contains use cases, coordinators, runtime actors, and the
  composition root.
- `src/infrastructure/ble/` adapts `react-native-ble-plx`; repositories and
  scanner implementations still live under `src/features/*/data`.
- `src/interface/` contains screens, view models, and the device store; shared
  UI is under `src/shared/`. `src/core/` contains protocol constants and utils.
- Keep decoding and domain logic free of `react-native` imports so it remains
  runnable in Jest. BLE operations for one device must remain serialized by
  `DeviceCommandQueue`; global reads are limited by `GlobalConcurrencyPool`.

## BLE Protocol

Protocol constants are in `src/core/constants/protocol.ts`; codec golden tests
are in `__tests__/codec.test.ts`. These values come from the Web implementation
at `react-soil-sensor/soil_sensor_app/src/ble_soil_sensor.jsx` and must not be
changed based on intuition:

- Live readings use the `00000000-0001-...` GATT service and 3-second polling,
  not advertising. Live EC is `uint8 / 20`; record EC is `byte / 100`.
- Records use `00000000-0000-...`; record-family UUIDs use `YY=00` for L2,
  `YY=01` for L1, and `YY=02` for Latest.
- BLE stacks can byte-swap UUIDs; use `buildUuidVariants` from
  `src/core/utils/uuid.ts` when matching UUIDs.
- Enable/disable live readings by writing `0x01`/`0x00` to the toggle
  characteristic.

## Tests and Style

- `jest.setup.js` mocks `react-native-ble-plx`; do not make unit tests depend on
  the native BLE module.
- Jest uses `@react-native/jest-preset` and explicitly transforms navigation,
  SVG, and safe-area/screen packages through `jest.config.js`.
- Prettier 2.8.8 uses single quotes, trailing commas, and no parentheses for a
  single arrow parameter (`.prettierrc.js`). Bitwise parsing is intentional in
  protocol/codec code.
