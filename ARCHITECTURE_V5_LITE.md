# 土壤传感器 App 架构 V5 Lite

> **版本**：V5 Lite
> **更新**：2026-09-09
> **定位**：面向当前 React Native BLE 应用的最小可维护架构
>
> 本文描述当前项目的实现基线，不是一次性建设完整平台的规划书。先保证设备通信可靠，再在真实复杂度出现时增加抽象。

## 1. 目标与边界

应用当前需要解决的问题只有四类：

1. BLE 协议适配，支持 soil sensor 和 SmartPot。
2. 设备连接、读取、写入和断开流程。
3. 多设备下的串行访问、并发限制和实时轮询。
4. 将数据转换为 UI 状态，并按需保存历史记录。

不提前建设：

- 通用插件系统；
- 完整事件溯源或 CQRS；
- 独立的 Actor 框架；
- 通用任务编排平台；
- Metrics、Tracing 和复杂日志平台；
- 为每个函数都建立一个 UseCase、Policy 或 Coordinator。

## 2. 一句话模型

```text
Screen / ViewModel
        ↓
UseCase / DeviceCoordinator
        ↓
DeviceManager + DeviceRuntime + DeviceActor queue
        ↓
SensorGateway / SmartPotGateway
        ↓
BLE Transport
```

持久化和事件通知从应用流程中按需调用，不建立额外的中间总线层。

## 3. 四个目录的职责

### `src/domain`

纯 TypeScript 业务模型和端口：

- `SensorDevice`、`SmartPot`、`DeviceSession`；
- `Reading`、`SensorRecord` 和值对象；
- `ReadingDecoder`、`ConnectionPolicy`；
- `SensorGateway`、`SmartPotGateway`、Repository 接口；
- 领域事件类型。

Domain 不导入 `react-native`、`react-native-ble-plx`、Zustand、SQLite 或导航代码。

### `src/application`

设备业务流程和运行时状态：

- `DeviceCoordinator`：设备流程的主要编排入口；
- `DeviceManager`：运行时 Map 的唯一所有者；
- `DeviceRuntime`、`Session`、`DeviceActor`（内部队列）；
- 连接、实时读取、历史读取、SmartPot 控制等 UseCase；
- `PollingCoordinator`、`LifecycleCoordinator`、`RecoveryCoordinator`；
- 应用端口：并发池、调度器、权限、生命周期和观察器。

Application 不依赖具体 BLE SDK，也不让 Screen 直接操作 Gateway。

### `src/infrastructure`

外部系统适配：

- `ble/`：Transport、Gateway、协议适配器、服务发现、权限和 Bond；
- `concurrency/`：设备队列和全局并发池；
- `scheduler/`：轮询调度器；
- `pool/`：连接池；
- `storage/`：SQLite、MMKV 和内存 Repository；
- `observability/`：最小诊断日志。

### `src/interface`

React Native 展示层：

- Screen 和可复用组件；
- ViewModel Hook；
- Zustand Presentation State；
- 将领域状态转换为 UI 状态。

UI 只发起命令、展示状态和处理导航，不保存 BLE 对象或连接生命周期。

## 4. 依赖方向

```text
interface → application → domain
infrastructure ───────────→ domain ports
infrastructure ───────────→ application ports
```

`compositionRoot.ts` 是唯一负责组装具体实现的位置。业务代码不自行创建全局 Gateway、Pool 或 Repository。

## 5. 当前核心组件

### `DeviceCoordinator`

它是当前设备流程的主要实现，不再额外引入 `DeviceService`、`DeviceRuntimeCoordinator` 等同义层。

负责：

- 维护当前已发现的领域设备和扫描设备；
- 连接前执行最多连接数检查和必要的 LRU 驱逐；
- 调用 Gateway 完成 connect、read、history、write、disconnect；
- 将 BLE 结果转为领域事件和 Repository 数据；
- 启停轮询，并在历史读取的 `finally` 中恢复轮询；
- 处理当前版本的恢复流程。

当此类变得难以测试时，优先拆出一个明确的纯函数或小模块，不要先创建新的分层体系。

### `DeviceManager`

只做运行时容器和统一入口：

```ts
get(deviceId): DeviceRuntime | undefined
create(deviceId): DeviceRuntime
execute(deviceId, command): Promise<unknown>
remove(deviceId): void
```

连接和业务流程仍由 `DeviceCoordinator` 实现。`DeviceManager` 不承载业务规则，也不重复维护另一份设备 Map。

### `DeviceRuntime` 与 `DeviceActor`

每台设备一个 Runtime 和一个队列：

```text
device-1 → runtime-1 → command queue-1
device-2 → runtime-2 → command queue-2
```

Actor 内部队列保证同一设备的 BLE 操作串行。当前命令类型使用简单字符串优先级（如 `connect`、`disconnect`、`poll`、`history`、`user-action`），不建立第二套队列或通用消息框架。

最低优先级规则：

```text
disconnect > user-action/history > poll
```

轮询命令必须合并，不能在已有同设备轮询等待或执行时无限追加。

### 全局并发和连接数

这两个限制分别由现有组件负责：

| 规则 | 当前实现 |
|---|---|
| 最多 4 台连接 | `ConnectionPolicy` + `ConnectionPool` |
| 最多 2 个 BLE operation | `GlobalConcurrencyPool` |
| 单设备最多 1 个 operation | `DeviceActor` 内部队列 |

所有 BLE operation 都要经过全局并发池，并使用 `try/finally` 释放 permit。

## 6. 连接与旧结果保护

每次创建 Runtime 时生成一个 `sessionId`。操作上下文至少包含：

```ts
type OperationContext = {
  deviceId: DeviceId
  sessionId: string
  operationId: string
}
```

异步结果回写前必须确认 Session 仍然有效：

```ts
if (!runtime.isCurrent(context.sessionId)) return
```

旧连接返回的数据不能写入新连接。断开并释放 Runtime 时，旧 Session 必须失效。

本项目不需要单独的 Session 服务、Operation 服务或分布式追踪 ID 体系；现有 Runtime 中的字段足够解决问题。

## 7. 轮询、历史和生命周期

### 实时轮询

- 默认周期为 3 秒；
- 使用 `PollingScheduler` 的完成后再调度模式；
- 禁止直接使用会 overlap 的 `setInterval(readLive, 3000)`；
- 轮询暂停只是不产生新命令，不强制中断正在执行的 BLE operation；
- 进入历史读取、后台或断开流程时暂停；
- 页面不拥有轮询 Timer。

### 历史读取

历史读取统一经过设备队列：

```text
pause polling
    ↓
read latest / l1 / l2
    ↓
save records when needed
    ↓
finally resume polling
```

取消使用现有 `CancellationToken`。取消只阻止后续工作和结果发布；无论成功、失败还是取消，轮询都必须在 `finally` 恢复。

### 生命周期和恢复

`LifecycleCoordinator` 负责把 App 前后台、蓝牙开关等外部状态转成暂停、恢复或销毁动作。Screen 不调用 `connect`、`disconnect` 或 `reconnect` 管理全局连接。

当前恢复逻辑由 `RecoveryCoordinator` 处理。只有当重试规则被多个场景共享或明显变复杂时，才单独扩展 Retry Policy；不要为了形式完整提前拆分。

## 8. BLE 数据流

```text
react-native-ble-plx
        ↓
BleTransport
        ↓
SoilSensorProtocolAdapter / SmartPotProtocolAdapter
        ↓
SensorGateway / SmartPotGateway
        ↓
DeviceCoordinator
        ↓
ReadingDecoder / Domain model
        ↓
event + Zustand + Repository
```

Gateway 不向 Domain 泄露 `BleDevice`、Characteristic 或 SDK 异常类型。

协议事实以 Web 实现和现有 codec 测试为准，不根据架构文档猜测协议：

- 实时读取使用 `00000000-0001-...` 服务，默认 3 秒轮询；
- 历史记录使用 `00000000-0000-...` 服务；
- L2、L1、Latest 的记录族 UUID 使用 `YY=00`、`YY=01`、`YY=02`；
- 实时 EC 为 `uint8 / 20`，记录 EC 为 `byte / 100`；
- UUID 匹配使用现有 UUID variant 工具；
- 实时读数开关写入 `0x01` / `0x00`。

Protocol Adapter 只处理设备协议和字节格式，`ReadingDecoder` 负责领域读数语义。只有确实存在第二种协议生命周期时，才增加协议版本对象。

## 9. 状态和数据保存

### Domain 状态

`SensorDevice` 保存业务事实，例如连接状态、最近读数、失败信息和设备身份。Runtime 状态（当前 operation、队列、Session、连接资源）不进入 Domain。

### Presentation State

Zustand 只保存 UI 需要的可序列化数据：

```text
deviceId
name
connection state
latest reading
loading / refreshing
error
```

禁止放入：

```text
BleDevice
BleManager
DeviceRuntime
DeviceActor
CommandQueue
Repository
CancellationToken
```

### 持久化

- SQLite：历史读数和需要按设备、时间查询的数据；
- MMKV：设备元数据、用户设置和轻量偏好；
- UI 临时状态：Zustand；
- 不为每个 Repository 再包一层 Service。

## 10. 事件使用规则

现有 `ApplicationEventBus` 用于将已发生的事实通知展示层或观察者，例如：

```text
ReadingUpdated
DeviceStateChanged
DeviceDisconnected
HistorySynced
SmartPotSnapshotUpdated
```

命令直接调用 `DeviceManager` 或 UseCase；不要用 EventBus 代替所有函数调用，也不要把它扩展成全局消息系统。

## 11. 目录基线

以下目录是当前实现的基线。新增文件应先证明已有文件无法承载职责：

```text
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── readings/
│   ├── services/
│   ├── ports/
│   ├── repositories/
│   └── events/
├── application/
│   ├── usecases/
│   ├── runtime/
│   ├── services/
│   ├── coordinators/
│   ├── policies/
│   └── ports/
├── infrastructure/
│   ├── ble/
│   ├── concurrency/
│   ├── pool/
│   ├── scheduler/
│   ├── storage/
│   └── observability/
└── interface/
    ├── screens/
    ├── components/
    ├── viewmodels/
    └── stores/
```

`src/application/compositionRoot.ts` 负责把这些实现连接起来。目录不是强制拆分指标；小功能可以留在现有文件中。

## 12. 什么时候才增加抽象

增加独立模块必须对应一个已经出现的问题：

| 现象 | 可以考虑 |
|---|---|
| 多个流程重复同一套恢复规则 | 提取共享恢复策略 |
| 多种设备协议有不同连接生命周期 | 提取协议生命周期接口 |
| 单个 Coordinator 难以独立测试 | 按真实职责拆小模块 |
| 事件订阅关系难以追踪 | 收紧事件类型或改为直接调用 |
| 日志无法定位生产问题 | 扩展结构化日志；不是直接引入 tracing 平台 |

以下情况不是拆分理由：

- 为了让每个文件少于某个行数；
- 为了预留尚未确认的设备类型；
- 为了让目录看起来更“完整”；
- 仅仅因为某个函数有两个调用者。

## 13. 必须保持的不变量

```text
最多 4 台设备连接
最多 2 个全局 BLE operation
同一设备最多 1 个 BLE operation
轮询不 overlap、不无限积压
旧 Session 结果不回写
历史读取任何退出路径都恢复轮询
Domain 不依赖 RN、BLE 或存储实现
Screen 不拥有 BLE 生命周期
```

这些不变量比类的数量、目录的数量和抽象层的数量更重要。

## 14. 最小验证集

### 单元测试

- `ReadingDecoder` 和协议 codec；
- `ConnectionPolicy` 的四连接限制；
- `DeviceActor` 的单设备串行；
- `GlobalConcurrencyPool` 的最大并发 2；
- Session 失效后的旧结果丢弃；
- 轮询耗时超过 3 秒时无 overlap；
- 历史取消后轮询恢复。

### 真机验证

- 单设备连接、实时读取、历史读取、断开；
- 两台及以上设备并发读取；
- 蓝牙关闭、权限拒绝、意外断开和重连；
- App 前后台切换；
- SmartPot 读写操作。

不以覆盖率数字作为架构完成标准。优先验证上述不变量和真实 BLE 行为。

## 15. 开发顺序

```text
协议/codec 测试
    ↓
单设备 Gateway
    ↓
DeviceManager + 队列 + 并发限制
    ↓
轮询、历史和恢复
    ↓
存储
    ↓
ViewModel / Screen
```

不要从 Screen 内嵌 BLE 逻辑开始，也不要在没有真实需求前继续扩展架构。

## 16. 最终原则

```text
Domain 保存业务事实。
DeviceCoordinator 编排设备流程。
DeviceManager 管运行时实例。
DeviceActor 内部队列保证单设备串行。
GlobalConcurrencyPool 限制全局 BLE 并发。
Gateway 适配 BLE。
PollingCoordinator 管轮询节奏。
Repository 管持久化。
ViewModel 管 UI 状态和命令。
```

**先用最少的代码保证并发、生命周期和协议正确；只有真实复杂度出现，才增加新的抽象。**
