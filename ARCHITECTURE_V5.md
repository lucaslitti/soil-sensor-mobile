# 土壤传感器 App（React Native）技术架构 V5

> **版本**：V5.0  
> **日期**：2026-09-08  
> **定位**：生产级 React Native BLE 多设备架构  
> **架构关键词**：DDD + Application Runtime + Device Actor + MVVM  
> **基线**：V3 DDD + MVVM；V4.1 运行时并发、生命周期与设备 Actor 演进  
>
> **说明**：本文件区分“原方案事实”和“V5 架构决策”。原方案明确的协议事实以 `react-soil-sensor` Web 实测为准；V5 新增的 Runtime、Actor、Session、调度、公平性、可观测性等属于架构演进，不应视为原固件协议事实。

---

## 1. Executive Summary

V5 的目标不是增加更多分层，而是把系统最容易出错的几个问题固化为工程不变量：

1. **Domain 纯业务**：零 React Native、BLE、SQLite、Zustand 依赖。
2. **Application Runtime 管运行时**：设备连接实例、Session、Polling、Recovery、Lifecycle。
3. **Device Actor 管设备串行性**：同一设备同一时间最多一个 BLE operation。
4. **GlobalConcurrencyPool 管全局并发**：同时最多 2 个 BLE operation。
5. **ConnectionPool 管连接数量**：最多保持 4 台设备连接。
6. **Polling 不允许 overlap**：3 秒是调度周期，不是允许并发执行的 `setInterval`。
7. **SessionId / OperationId 防止旧异步结果污染新连接**。
8. **History 与 Polling 共用设备 Actor，并支持取消**。
9. **MVVM 只处理 Presentation State；View 不直接接触 BLE/Repository**。
10. **协议解码集中在 Protocol Adapter + Domain ReadingDecoder**。
11. **Lifecycle / Recovery 在 Application 层统一管理，不由 Screen 管理 BLE 生命周期**。
12. **测试重点从单纯覆盖率升级为并发、生命周期、取消、旧 Session 防污染。**

最终模型：

```text
                         React Native
                              │
                              ▼
                    ┌──────────────────┐
                    │   MVVM / View    │
                    │ Screen           │
                    │ ViewModel Hooks  │
                    │ Zustand          │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Application    │
                    │ UseCases         │
                    │ DeviceManager    │
                    │ Lifecycle       │
                    │ Recovery        │
                    └────────┬─────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │     Application Runtime     │
              │ DeviceRuntime               │
              │ Session                     │
              │ DeviceActor / CommandQueue  │
              │ PollingCoordinator          │
              └──────────────┬──────────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │ Global Pool ≤ 2    │
                  └─────────┬──────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        Device Actor A  Device Actor B  Device Actor C
             │              │              │
          serial         serial         serial
             │              │              │
             └──────────────┼──────────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ SensorGateway       │
                 │ Protocol Adapter    │
                 │ BleTransport        │
                 └──────────┬──────────┘
                            │
                            ▼
                           BLE
```

---

## 2. V3 基线与 V5 演进

### 2.1 原方案明确的基线

V3 将原 feature-first 结构重组为 DDD 四层 + MVVM，要求 Domain 零依赖；原方案同时明确了：

- 最大连接 4 台；
- 3 秒轮询；
- Polling 并发上限 2；
- Android Bond；
- Latest / L1 / L2 历史读取；
- SQLite / MMKV；
- Jest / Detox / React Native Testing Library / EAS；
- 协议事实以 `react-soil-sensor` Web 实测为准。

### 2.2 V5 架构演进

V5 不改变上述业务事实，而是补足运行时边界：

| V4.1 能力 | V5 固化方式 |
|---|---|
| DeviceRuntime | 作为 Application Runtime 的核心对象 |
| Device Actor | 每设备一个串行 Actor |
| GlobalConcurrencyPool | 全局 BLE operation semaphore |
| SessionId | 所有异步 operation 的上下文 |
| OperationId | 日志、取消、诊断与结果关联 |
| Polling no-overlap | Scheduler + Actor 双重保证 |
| History cancellation | CancellationToken + `finally` 恢复 |
| Lifecycle | LifecycleCoordinator |
| Recovery | RecoveryCoordinator + RetryPolicy |
| MVVM | Zustand 仅保存 Presentation State |
| Protocol | Transport / Adapter / Decoder 三段式 |

**V5 新增内容均属于架构决策/工程推导，不是原固件协议事实。**

---

# 3. 架构原则

## 3.1 依赖方向

唯一允许的方向：

```text
Presentation
      ↓
Application
      ↓
Domain
      ↑
Infrastructure
```

即：

```text
MVVM → Application → Domain ← Infrastructure
```

### Domain 禁止

```text
react-native
react-native-ble-plx
zustand
sqlite
mmkv
navigation
timer
native modules
```

### Presentation 禁止

```text
BleManager
BleTransport
SensorGateway
Repository
DeviceRuntime
DeviceActor
```

### Application 禁止

```text
React Component
Zustand store implementation
BLE vendor SDK
```

---

# 4. 四层职责

## 4.1 Domain

负责：

- `SensorDevice`
- Value Objects
- `Reading`
- `ReadingDecoder`
- `ConnectionPolicy`
- Domain Events
- 业务不变式

不负责：

- BLE
- Timer
- Retry
- Queue
- React Native
- Storage implementation

---

## 4.2 Application

负责：

- UseCase
- DeviceManager
- DeviceRuntime
- DeviceActor
- PollingCoordinator
- LifecycleCoordinator
- RecoveryCoordinator
- ErrorPolicy
- RetryPolicy

---

## 4.3 Infrastructure

负责：

- BLE Transport
- BLE Protocol Adapter
- Android Bond
- ConnectionPool
- GlobalConcurrencyPool
- PollingScheduler
- SQLite
- MMKV
- Logging Adapter

---

## 4.4 Presentation / MVVM

负责：

- Screen
- Component
- ViewModel Hook
- Zustand
- UI Error
- UI loading / refreshing / selected state

---

# 5. Domain Model

## 5.1 SensorDevice

`SensorDevice` 是 Domain Aggregate Root。

```ts
class SensorDevice {
  readonly id: DeviceId

  markConnected(): void
  markDisconnected(): void
  updateBondState(state: BondState): void
  applyReading(reading: LiveReading): void

  isIdleForEviction(now: number): boolean
}
```

Domain Entity 只保存业务事实：

```text
DeviceId
Name
BondState
ConnectionState
LatestReading
LastActiveAt
```

**V5 架构决策：DeviceRuntime 不进入 Domain。**

---

## 5.2 Value Objects

| Value Object | 语义 |
|---|---|
| `DeviceId` | 设备身份 |
| `SoilEc` | EC 物理值 |
| `TemperatureC` | 温度物理值 |
| `SoilMoisturePercent` | 土壤湿度 |
| `ReadingTimestamp` | 统一时间戳 |
| `BondState` | none / bonding / bonded / failed |

原方案明确：

- 实时 EC `/20`
- 记录 EC `/100`
- 温度包含 signed decode
- 实时湿度 0.5% 步进
- 记录湿度 0.01% 步进
- 时间戳为 epoch 秒转毫秒，基准仍需真机确认。

V5 不改变这些规则。

---

# 6. Application Runtime

## 6.1 为什么需要 Runtime

Domain 描述：

> “这个设备是什么状态？”

Runtime 描述：

> “这个设备当前连接实例正在做什么？”

二者不能混合。

```text
SensorDevice
    │
    │ business state
    ▼
DeviceRuntime
    │
    ├── Session
    ├── Connection
    ├── Operation
    ├── Actor
    └── Polling
```

---

## 6.2 DeviceRuntime

```ts
interface DeviceRuntime {
  readonly deviceId: DeviceId
  readonly sessionId: SessionId

  connection: RuntimeConnectionState
  operation: RuntimeOperationState

  actor: DeviceActor
  polling: PollingState
}
```

### Runtime Connection State

```ts
type RuntimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
```

### Runtime Operation State

```ts
type RuntimeOperationState =
  | 'idle'
  | 'polling'
  | 'history'
  | 'reconnecting'
  | 'suspended'
```

两个状态维度独立，避免状态组合爆炸。

---

# 7. Session / Operation Context

## 7.1 SessionId

每次新的连接生命周期创建新的 Session：

```text
Device A
Session-001
   ↓ disconnect
Session-002
   ↓ reconnect
```

所有异步 BLE operation 必须携带：

```ts
interface OperationContext {
  deviceId: DeviceId
  sessionId: SessionId
  operationId: OperationId
}
```

---

## 7.2 Stale Result Protection

异步结果返回后：

```ts
if (context.sessionId !== runtime.sessionId) {
  // stale result
  return
}
```

禁止旧连接：

```text
Session 001
    ↓
readLive()
    ↓
disconnect
    ↓
Session 002
    ↓
connect
    ↓
Session 001 read returns
```

把 Session 001 的数据写入 Session 002。

---

# 8. Device Actor

## 8.1 Actor 原则

每台设备一个 Actor：

```text
Device A → Actor A → Queue A
Device B → Actor B → Queue B
Device C → Actor C → Queue C
```

Actor 保证：

```text
同一设备：
最多 1 个 BLE operation
```

---

## 8.2 DeviceCommand

```ts
type DeviceCommand<T> =
  | ConnectCommand<T>
  | DisconnectCommand<T>
  | ReadLiveCommand<T>
  | ReadLatestCommand<T>
  | ReadRecordsCommand<T>
```

```ts
interface DeviceActor {
  enqueue<T>(
    command: DeviceCommand<T>
  ): Promise<T>

  cancel(operationId: OperationId): void

  stop(): Promise<void>
}
```

---

## 8.3 Queue 规则

默认优先级：

```text
Disconnect
  >
User Action
  >
History
  >
Polling
```

**V5 架构决策。**

原因：

- Disconnect 必须能及时释放资源；
- 用户主动操作应优先于后台 Polling；
- History 是用户明确触发的操作；
- Polling 是最低优先级后台任务。

Polling 不允许无限积压。

---

# 9. GlobalConcurrencyPool

## 9.1 双层并发控制

### 设备级

```text
DeviceActor
≤ 1 operation
```

### 全局级

```text
GlobalConcurrencyPool
≤ 2 operations
```

所以合法状态：

```text
4 devices connected
2 BLE operations running
```

---

## 9.2 Semaphore

```ts
interface ConcurrencyPool {
  acquire(context: OperationContext): Promise<Release>
}
```

使用：

```ts
const release = await pool.acquire(context)

try {
  return await operation()
} finally {
  release()
}
```

**必须使用 `finally` 释放 token。**

---

# 10. ConnectionPool

ConnectionPool 与 GlobalConcurrencyPool 不同。

| 组件 | 限制 |
|---|---:|
| ConnectionPool | ≤ 4 台连接 |
| GlobalConcurrencyPool | ≤ 2 个 operation |
| DeviceActor | ≤ 1 个 operation / device |

---

## 10.1 LRU

原方案明确 4 台上限采用 LRU 驱逐候选。

Domain：

```ts
ConnectionPolicy.selectEvictionCandidate(...)
```

只决定：

```text
“谁应该被驱逐？”
```

不执行：

```text
disconnect()
```

执行由 Application UseCase 完成。

---

# 11. Polling

## 11.1 基本规则

```text
interval = 3000ms
global concurrency ≤ 2
per-device concurrency ≤ 1
```

---

## 11.2 禁止 setInterval overlap

禁止：

```ts
setInterval(readLive, 3000)
```

推荐：

```text
schedule
  ↓
enqueue
  ↓
execute
  ↓
finish
  ↓
calculate next due time
  ↓
schedule
```

如果 BLE read 超过 3 秒：

```text
0s   read ───────── 4.5s
3s        不启动第二个 read
4.5s finish
next slot → schedule
```

---

## 11.3 Polling 状态

```ts
interface PollingState {
  enabled: boolean
  paused: boolean
  intervalMs: number
  nextDueAt?: number
}
```

---

## 11.4 Polling Pause

`pause()` 的语义：

> 不再产生新的 Polling Command。

不是：

> 强制取消当前 BLE operation。

当前 Actor operation 应自然完成，除非明确支持安全取消。

---

# 12. History

原方案：

```text
pause polling
→ Latest
→ L1 × 8
→ L2 × 24
→ resume polling
```

V5：

```text
ReadHistoryUseCase
       ↓
pause polling
       ↓
DeviceActor
       ↓
GlobalPool
       ↓
Latest
       ↓
L1 × 8
       ↓
L2 × 24
       ↓
persist
       ↓
resume polling
```

---

## 12.1 Cancellation

History 必须支持：

```ts
interface CancellationToken {
  readonly cancelled: boolean
  throwIfCancelled(): void
}
```

退出页面：

```text
cancel
 ↓
stop scheduling remaining history work
 ↓
finally
 ↓
resume polling
```

**DoD：任何 History 取消路径都必须恢复 Polling。**

---

# 13. DeviceManager

DeviceManager 是 Application Runtime 的唯一设备入口。

```ts
interface DeviceManager {
  get(deviceId: DeviceId): DeviceRuntime | undefined

  connect(deviceId: DeviceId): Promise<void>

  disconnect(deviceId: DeviceId): Promise<void>

  execute<T>(
    deviceId: DeviceId,
    command: DeviceCommand<T>
  ): Promise<T>
}
```

禁止业务用例自己维护：

```ts
Map<DeviceId, DeviceRuntime>
```

---

# 14. UseCases

建议：

```text
ScanDevicesUseCase
ConnectDeviceUseCase
DisconnectDeviceUseCase
StartPollingUseCase
StopPollingUseCase
ReadLiveUseCase
ReadHistoryUseCase
ReleaseDeviceUseCase
```

UseCase 负责：

> 业务流程编排。

Runtime 负责：

> 设备生命周期。

---

# 15. BLE Infrastructure

最终链路：

```text
DeviceActor
   ↓
SensorGateway
   ↓
Protocol Adapter
   ↓
BleTransport
   ↓
react-native-ble-plx
   ↓
Native BLE
```

---

## 15.1 SensorGateway

```ts
interface SensorGateway {
  connect(deviceId: DeviceId): Promise<void>
  disconnect(deviceId: DeviceId): Promise<void>

  readLive(deviceId: DeviceId): Promise<RawReading>
  readLatest(deviceId: DeviceId): Promise<RawReading>
  readRecords(
    deviceId: DeviceId,
    level: HistoryLevel
  ): Promise<RawReading[]>
}
```

Gateway 不向 Domain 泄露 BLE vendor 类型。

---

# 16. Protocol Adapter

```text
BLE bytes
   ↓
Protocol Adapter
   ↓
RawReading
   ↓
ReadingDecoder
   ↓
Domain Reading
```

协议事实继续以原方案实测为基准：

- GATT 实例读数服务；
- 3 秒轮询；
- 实时 EC `/20`；
- 记录 EC `/100`；
- Latest / L1 / L2；
- 读数开关；
- UUID 字节序变体。

**V5 架构决策：Protocol Adapter 负责“设备协议版本差异”，ReadingDecoder 负责“领域语义转换”。**

---

# 17. Android Bond

Infrastructure：

```text
AndroidBondService
```

状态：

```text
none
  ↓
bonding
  ↓
bonded
  ↓
service discovery
  ↓
ready
```

Domain 只认识：

```text
BondState
```

Android/iOS 平台差异不得进入 Domain。

---

# 18. Lifecycle

新增：

```text
LifecycleCoordinator
```

统一处理：

```text
App foreground
App background
Bluetooth ON
Bluetooth OFF
BLE disconnected
```

禁止 Screen 自己管理：

```text
connect()
disconnect()
reconnect()
```

---

## 18.1 Foreground

```text
App foreground
   ↓
restore runtime
   ↓
validate BLE state
   ↓
reconnect required devices
   ↓
resume polling
```

## 18.2 Background

具体后台 BLE 能力取决于平台能力和产品需求，不能仅依赖 JS Timer。

V5 架构要求：

> Background 状态必须显式建模，不能假设 `setInterval` 在后台可靠运行。

---

# 19. Recovery

```text
BLE disconnect
      ↓
DeviceDisconnected
      ↓
RecoveryCoordinator
      ↓
RetryPolicy
      ↓
DeviceManager.connect()
```

建议退避：

```text
1s
2s
4s
8s
15s
```

达到最大次数后停止自动重试。

---

# 20. Error Policy

统一三类：

```ts
type ErrorClass =
  | 'recoverable'
  | 'user_action_required'
  | 'fatal'
```

| 错误 | 分类 | 行为 |
|---|---|---|
| Timeout | Recoverable | Retry |
| Temporary Disconnect | Recoverable | Reconnect |
| Bluetooth OFF | User Action Required | 等待/提示 |
| Permission Missing | User Action Required | 引导 |
| Bond Failed | User Action Required | 引导 |
| Unsupported Service | Fatal | 停止 |
| Invalid Protocol | Fatal | 停止 |
| Malformed Payload | Fatal/Recoverable | 按协议策略处理 |

---

# 21. MVVM

## 21.1 View

只负责：

```text
render
user input
navigation
```

---

## 21.2 ViewModel

使用 React Hook：

```ts
function useDeviceDetailViewModel(deviceId: string) {
  const device = useDeviceStore(
    state => state.devices[deviceId]
  )

  const connect = useCallback(
    () => connectDeviceUseCase.execute(deviceId),
    [deviceId]
  )

  const readHistory = useCallback(
    () => readHistoryUseCase.execute(deviceId),
    [deviceId]
  )

  return {
    device,
    connect,
    readHistory,
  }
}
```

ViewModel 暴露：

```text
State + Commands
```

---

# 22. Zustand

Zustand 只保存 Presentation State。

例如：

```ts
interface DeviceVM {
  id: string
  name: string
  connection: ConnectionVMState
  latestReading?: ReadingVM
  loading: boolean
  error?: UIError
}
```

禁止保存：

```text
BleDevice
BleManager
DeviceRuntime
DeviceActor
CommandQueue
Repository
CancellationToken
```

---

# 23. Domain Events

保留：

```text
ReadingUpdated
DeviceStateChanged
BondStateChanged
DeviceDisconnected
HistorySynced
```

事件表达：

> 已经发生的事实。

Command 表达：

> 希望系统执行的动作。

State 表达：

> 当前状态。

不要把 EventBus 变成所有模块通信的总线。

---

# 24. Data Persistence

## 24.1 MMKV

适合：

```text
device metadata
user settings
last selected device
```

## 24.2 SQLite

适合：

```text
SensorRecord
history
deviceId
timestamp
EC
temperature
moisture
```

---

## 24.3 数据流

```text
BLE
 ↓
RawReading
 ↓
ReadingDecoder
 ↓
Domain Reading
 ↓
Application
 ├── Presentation State
 └── ReadingRepository
       ↓
     SQLite
```

---

# 25. 数据一致性

同一 Reading 建议关联：

```text
deviceId
sessionId
operationId
readingTimestamp
receivedAt
source
```

其中：

- `readingTimestamp`：设备数据时间；
- `receivedAt`：App 接收时间；
- `sessionId`：连接生命周期；
- `operationId`：操作追踪。

**V5 架构决策。**

如果设备时间戳基准尚未通过真机确认，不得把“设备时间”和“App 接收时间”混为一谈。

---

# 26. 最终目录

```text
src/
├── interface/
│   ├── screens/
│   │   ├── DeviceListScreen.tsx
│   │   └── DeviceDetailScreen.tsx
│   ├── components/
│   ├── viewmodels/
│   │   ├── useDeviceListViewModel.ts
│   │   ├── useDeviceDetailViewModel.ts
│   │   ├── useRealtimeViewModel.ts
│   │   └── useHistoryViewModel.ts
│   └── stores/
│       ├── deviceStore.ts
│       ├── readingStore.ts
│       └── uiStore.ts
│
├── application/
│   ├── usecases/
│   │   ├── scanDevices.ts
│   │   ├── connectDevice.ts
│   │   ├── disconnectDevice.ts
│   │   ├── startPolling.ts
│   │   ├── stopPolling.ts
│   │   ├── readLive.ts
│   │   ├── readHistory.ts
│   │   └── releaseDevice.ts
│   │
│   ├── runtime/
│   │   ├── deviceManager.ts
│   │   ├── deviceRuntime.ts
│   │   ├── deviceActor.ts
│   │   ├── deviceCommand.ts
│   │   ├── session.ts
│   │   └── operationContext.ts
│   │
│   ├── coordinators/
│   │   ├── pollingCoordinator.ts
│   │   ├── lifecycleCoordinator.ts
│   │   └── recoveryCoordinator.ts
│   │
│   ├── policies/
│   │   ├── retryPolicy.ts
│   │   └── errorPolicy.ts
│   │
│   └── ports/
│       ├── sensorGateway.ts
│       ├── scheduler.ts
│       ├── clock.ts
│       └── concurrencyPool.ts
│
├── domain/
│   ├── entities/
│   │   └── sensorDevice.ts
│   ├── value-objects/
│   │   ├── deviceId.ts
│   │   ├── soilEc.ts
│   │   ├── temperatureC.ts
│   │   ├── soilMoisturePercent.ts
│   │   ├── readingTimestamp.ts
│   │   └── bondState.ts
│   ├── readings/
│   │   ├── liveReading.ts
│   │   └── sensorRecord.ts
│   ├── services/
│   │   ├── readingDecoder.ts
│   │   └── connectionPolicy.ts
│   ├── repositories/
│   │   ├── deviceRepository.ts
│   │   └── readingRepository.ts
│   └── events/
│       └── domainEvents.ts
│
└── infrastructure/
    ├── ble/
    │   ├── bleTransport.ts
    │   ├── bleSensorGateway.ts
    │   ├── serviceDiscovery.ts
    │   ├── protocolDetector.ts
    │   ├── androidBondService.ts
    │   ├── uuidVariants.ts
    │   └── protocols/
    │       ├── protocolV1.ts
    │       └── protocolV2.ts
    ├── concurrency/
    │   ├── semaphore.ts
    │   └── mutex.ts
    ├── scheduler/
    │   └── pollingScheduler.ts
    ├── pool/
    │   └── connectionPool.ts
    ├── storage/
    │   ├── sqlite/
    │   │   └── sqliteReadingRepository.ts
    │   └── mmkv/
    │       └── mmkvDeviceRepository.ts
    └── observability/
        ├── logger.ts
        ├── metrics.ts
        └── tracing.ts
```

---

# 27. 核心时序

## 27.1 Connect

```text
User
 ↓
ViewModel.connect()
 ↓
ConnectDeviceUseCase
 ↓
DeviceManager
 ↓
ConnectionPolicy
 ↓
ConnectionPool
 ↓
create DeviceRuntime
 ↓
create SessionId
 ↓
DeviceActor.enqueue(connect)
 ↓
GlobalPool.acquire()
 ↓
SensorGateway.connect()
 ↓
Bond / Discover / Protocol Detect
 ↓
GlobalPool.release()
 ↓
SensorDevice.markConnected()
 ↓
StartPollingUseCase
```

---

## 27.2 Polling

```text
PollingScheduler
 ↓
PollingCoordinator
 ↓
DeviceManager
 ↓
DeviceActor.enqueue(ReadLive)
 ↓
GlobalPool.acquire()
 ↓
SensorGateway.readLive()
 ↓
Protocol Adapter
 ↓
ReadingDecoder
 ↓
LiveReading
 ↓
Session validation
 ↓
ReadingUpdated
 ├── Zustand
 └── SQLite（按策略）
 ↓
GlobalPool.release()
 ↓
schedule next slot
```

---

## 27.3 History

```text
User
 ↓
HistoryViewModel
 ↓
ReadHistoryUseCase
 ↓
pause polling
 ↓
DeviceActor
 ↓
Latest
 ↓
L1 × 8
 ↓
L2 × 24
 ↓
persist
 ↓
HistorySynced
 ↓
resume polling
```

---

# 28. 生命周期状态图

```text
                 ┌─────────────┐
                 │ Disconnected│
                 └──────┬──────┘
                        │ connect
                        ▼
                 ┌─────────────┐
                 │ Connecting  │
                 └──────┬──────┘
                        │ ready
                        ▼
                 ┌─────────────┐
                 │ Connected   │
                 └──────┬──────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
         Polling              History
              │                   │
              └─────────┬─────────┘
                        │
                    disconnect
                        ▼
                 ┌─────────────┐
                 │Disconnecting│
                 └──────┬──────┘
                        ▼
                 Disconnected
```

Runtime Operation State 与 Connection State 分离，因此不会产生大量组合状态。

---

# 29. 可观测性

V5 新增的工程能力。

每一次 BLE operation 至少记录：

```text
operationId
deviceId
sessionId
operationType
queueWaitMs
executionMs
result
errorCode
retryCount
timestamp
```

示例：

```text
operationId=op-1024
deviceId=device-A
sessionId=session-17
type=readLive
queueWait=12ms
execution=183ms
result=success
```

---

## 29.1 日志级别

```text
ERROR
WARN
INFO
DEBUG
TRACE
```

生产环境默认：

```text
INFO / WARN / ERROR
```

禁止日志输出：

- 用户隐私；
- 不必要的原始 BLE payload；
- 安全敏感数据。

DEBUG/TRACE 只在诊断构建中开启。

---

# 30. 性能规则

## 30.1 UI

禁止每个 BLE notification 都导致全局 Store 重建。

推荐：

```text
ReadingUpdated
 ↓
按 deviceId 精确更新
 ↓
selector 精确订阅
```

---

## 30.2 Queue

Polling 必须采用：

```text
coalescing
```

如果已有一个 polling command 在：

```text
queued / running
```

不允许继续无限追加同设备 polling command。

---

## 30.3 History

历史数据分批持久化，避免：

```text
L2 × 24
→
一次性构造巨大 UI state
```

---

# 31. 安全与权限

V5 工程要求：

### Android

- Bluetooth 权限；
- Bond 权限/系统流程；
- 根据目标 SDK 正确声明权限；
- 权限拒绝必须转换成 `UserActionRequired`。

### iOS

- Bluetooth Usage Description；
- 平台生命周期能力必须显式配置；
- 不假设后台 JS Timer 可持续运行。

---

# 32. 测试策略

## 32.1 Domain

目标：

```text
≥ 90%
```

测试：

- Value Objects；
- ReadingDecoder；
- ConnectionPolicy；
- SensorDevice 状态迁移。

---

## 32.2 Application

Jest：

```text
ConnectDevice
DisconnectDevice
ReadLive
ReadHistory
ReleaseDevice
Recovery
Polling
```

---

## 32.3 Device Actor

必须验证：

```text
command A
command B
command C
```

执行顺序：

```text
A → B → C
```

而不是并行。

---

## 32.4 Global Pool

压力测试：

```text
100 operations
maxConcurrency = 2
```

断言：

```text
maxObservedConcurrency <= 2
```

---

## 32.5 Session

测试：

```text
Session 1 starts operation
Session 1 disconnected
Session 2 created
Session 1 returns result
```

必须：

```text
Session 1 result ignored
```

---

## 32.6 Polling

模拟：

```text
operation duration > 3000ms
```

必须：

```text
no overlap
```

---

## 32.7 Cancellation

测试：

```text
History starts
 ↓
L2 starts
 ↓
cancel
 ↓
finally
 ↓
polling resumed
```

---

## 32.8 E2E

Detox / 真机矩阵：

```text
1 device
2 devices
3 devices
4 devices

Bluetooth OFF
Permission denied
Bond failed
Disconnect
Reconnect
Background
Foreground
History cancel
```

---

# 33. CI/CD

推荐流水线：

```text
TypeScript
 ↓
ESLint
 ↓
Architecture Import Rule
 ↓
Domain Jest
 ↓
Application Jest
 ↓
Actor / Concurrency Jest
 ↓
React Native Tests
 ↓
Detox
 ↓
EAS Build
```

Domain import rule：

```text
domain/**
```

禁止：

```text
react-native
ble-plx
zustand
sqlite
mmkv
```

---

# 34. Definition of Done

## Architecture

- [ ] Domain 无 RN/BLE/Storage 第三方依赖
- [ ] Runtime 不进入 Domain
- [ ] ViewModel 不直接访问 BLE
- [ ] ViewModel 不直接访问 Repository
- [ ] DeviceManager 是 Runtime 唯一入口

## BLE

- [ ] ≤4 台连接
- [ ] ≤2 个全局 operation
- [ ] 单设备 ≤1 operation
- [ ] Android Bond 正常
- [ ] iOS 正常
- [ ] disconnect/reconnect 正常

## Polling

- [ ] 3 秒周期
- [ ] 无 overlap
- [ ] 不无限积压
- [ ] History 能暂停/恢复
- [ ] Disconnect 能停止
- [ ] Reconnect 能恢复

## History

- [ ] Latest
- [ ] L1 × 8
- [ ] L2 × 24
- [ ] Cancellation
- [ ] Cancel 后 Polling 一定恢复

## Session

- [ ] 每次新连接创建新 SessionId
- [ ] Operation 带 SessionId
- [ ] stale result 自动丢弃

## Storage

- [ ] Reading 可持久化
- [ ] SQLite 查询可按 device/time range
- [ ] MMKV 保存设备元数据

## Testing

- [ ] Domain ≥90%
- [ ] Actor serial test
- [ ] Global pool concurrency test
- [ ] Session stale-result test
- [ ] Polling no-overlap test
- [ ] History cancellation test
- [ ] 真机 BLE E2E

---

# 35. 实施阶段

## M1 — Domain Foundation

交付：

```text
DeviceId
Value Objects
SensorDevice
ReadingDecoder
ConnectionPolicy
Domain Tests
```

---

## M2 — BLE Foundation

交付：

```text
BleTransport
SensorGateway
Protocol Adapter
Protocol Detector
AndroidBondService
```

完成：

```text
1 device
connect
read
disconnect
```

---

## M3 — Runtime / Actor

交付：

```text
DeviceRuntime
DeviceManager
DeviceActor
CommandQueue
SessionId
OperationId
GlobalConcurrencyPool
ConnectionPool
```

重点验证：

```text
4 devices
2 concurrent operations
```

---

## M4 — Polling / Recovery

交付：

```text
PollingScheduler
PollingCoordinator
LifecycleCoordinator
RecoveryCoordinator
RetryPolicy
```

---

## M5 — History / Storage

交付：

```text
Latest
L1
L2
Cancellation
SQLite
MMKV
```

---

## M6 — MVVM / UI

交付：

```text
DeviceList
DeviceDetail
Realtime
History
Charts
Zustand
ViewModels
```

---

## M7 — Release

交付：

```text
真机矩阵
Detox
性能验证
日志
EAS Build
Release Candidate
```

---

# 36. ADR 建议

V5 建议建立：

```text
docs/adr/
```

至少记录：

```text
ADR-001 DDD 四层
ADR-002 Domain 零依赖
ADR-003 DeviceRuntime 不进入 Domain
ADR-004 Device Actor 单设备串行
ADR-005 Global BLE concurrency ≤2
ADR-006 ConnectionPool ≤4
ADR-007 Polling no-overlap
ADR-008 SessionId stale-result protection
ADR-009 History cancellation
ADR-010 MVVM + Zustand
ADR-011 Protocol Adapter / ReadingDecoder
ADR-012 SQLite / MMKV
ADR-013 Lifecycle / Recovery
```

---

# 37. V5 最终架构不变量

整个系统最终必须始终满足：

```text
                    ┌─────────────────────────┐
                    │ Connection Count ≤ 4    │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ BLE Operations ≤ 2      │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ Device Operation ≤ 1    │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ Polling Never Overlaps  │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ Old Session = Ignored   │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ History Cancel → Resume │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ Domain = Pure TypeScript│
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │ UI ≠ BLE Lifecycle      │
                    └─────────────────────────┘
```

---

# 38. 最终架构定义

> **Domain 管业务事实。**
>
> **Application 管业务流程。**
>
> **Runtime 管设备生命周期。**
>
> **Actor 管设备串行。**
>
> **Global Pool 管全局并发。**
>
> **ConnectionPool 管连接数量。**
>
> **Scheduler 管时间节奏。**
>
> **Recovery 管异常恢复。**
>
> **Gateway 管 BLE。**
>
> **Protocol Adapter 管协议版本。**
>
> **ReadingDecoder 管协议到业务语义。**
>
> **Repository 管持久化。**
>
> **ViewModel 管 UI 状态与命令。**
>
> **Zustand 管 Presentation State。**

---

# 39. V5 与 V4.1 的核心差异

V4.1 已经解决：

```text
DDD
+
Application Runtime
+
Device Actor
+
MVVM
```

V5 进一步把它们工程化：

```text
V4.1
  ↓
V5
  ├── Actor Priority
  ├── Polling Coalescing
  ├── Session / Operation Context
  ├── Lifecycle Coordinator
  ├── Recovery Coordinator
  ├── Cancellation Contract
  ├── Observability
  ├── Architecture Import Rules
  ├── Concurrency Tests
  ├── ADR
  └── Release DoD
```

因此 V5 的定位不是“更多代码”，而是：

> **把 V4.1 的架构原则变成可以被代码、测试、CI 和运行时共同强制执行的工程约束。**

---

## 40. 架构签字结论

**推荐采用 V5 作为 React Native 项目的正式开发基线。**

在开始 UI 大规模开发之前，应优先完成：

```text
Domain
   ↓
BLE Foundation
   ↓
Device Actor
   ↓
Global Pool
   ↓
Session Protection
   ↓
Polling
   ↓
History
   ↓
Storage
   ↓
MVVM / UI
```

不要反过来从 Screen 开始构建 BLE 逻辑。

**第一条工程原则：**

```text
Screen 永远不能拥有 BLE。
```

**第二条工程原则：**

```text
一个设备永远只有一个 Actor。
```

**第三条工程原则：**

```text
任何 BLE operation 都必须经过 GlobalConcurrencyPool。
```

**第四条工程原则：**

```text
任何异步 BLE 结果都必须经过 SessionId 校验。
```

**第五条工程原则：**

```text
任何 History 退出路径都必须恢复 Polling。
```

---

## Appendix A — 原方案事实边界

以下内容来自原 V3 文档，V5 继续采用：

- DDD 四层 + MVVM；
- Domain 零依赖；
- `SensorDevice` 聚合根；
- Value Objects；
- `ReadingDecoder`；
- `ConnectionPolicy`；
- 4 台连接上限；
- 3 秒 Polling；
- 全局并发 2；
- Android Bond；
- Latest / L1 / L2；
- SQLite / MMKV；
- Jest / Detox / React Native Testing Library / EAS；
- 协议事实以实际 Web/GATT 实测为准。

以下内容属于 V5 架构新增或推导：

- `DeviceRuntime`；
- `DeviceActor`；
- `DeviceCommandQueue`；
- `SessionId / OperationId`；
- Actor priority；
- Polling coalescing；
- Global semaphore 实现；
- LifecycleCoordinator；
- RecoveryCoordinator；
- CancellationToken；
- Observability；
- ADR 体系；
- 架构 import rule；
- 并发/取消/旧 Session 专项测试。

---

**文档结束**
