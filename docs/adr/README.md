# V5 ADR Index

The implementation follows `ARCHITECTURE_V5.md`:

- Domain has no platform, storage, timer, or presentation imports.
- `DeviceManager` owns runtime instances and is the Application entry point.
- Each `DeviceActor` serializes one device; `GlobalConcurrencyPool` limits BLE work to two.
- `ConnectionPool` limits connected devices to four.
- Polling is scheduled without overlap and History pauses/resumes it in `finally`.
- Every connection lifecycle has a SessionId and every operation has an OperationId.
- BLE vendor types stop at Infrastructure protocol adapters.
- Presentation uses ViewModels and Zustand state only.
