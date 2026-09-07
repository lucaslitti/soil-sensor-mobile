/**
 * 协议常量（与 react-soil-sensor Web 端实测实现一一对应）
 * 出处：soil_sensor_app/src/ble_soil_sensor.jsx
 */

/** 设备名称前缀 */
export const SENSOR_NAME_PREFIX = 'Soil Sensor-';
export const SMART_POT_NAME_PREFIX = 'SmartPot';

/** SmartPot 文本协议服务与特征。 */
export const SMART_POT_SERVICE = '6f3f0000-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_LIGHT = '6f3f0001-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_LIGHT_SENSOR = '6f3f0002-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_PUMP = '6f3f0003-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_SOIL_MOISTURE = '6f3f0004-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_SOIL_EC = '6f3f0005-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_SOIL_TEMPERATURE = '6f3f0006-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_LIGHT_RGB = '6f3f0007-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_PLANT_CONFIG = '6f3f0008-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_HISTORY = '6f3f0009-4f52-4f54-9a4f-000000000001';
export const SMART_POT_CHAR_TIME = '6f3f000a-4f52-4f54-9a4f-000000000001';

/** 实时读数服务 UUID */
export const SERVICE_INSTANCE_READING =
  '00000000-0001-726f-736e-65536c696f53';
/** 历史记录服务 UUID */
export const SERVICE_RECORD = '00000000-0000-726f-736e-65536c696f53';

/** 实时读数特征（实例读数服务） */
export const CHAR_READING_TOGGLE =
  '01000000-0001-726f-736e-65536c696f53';
export const CHAR_MOISTURE = '02000000-0001-726f-736e-65536c696f53';
export const CHAR_TEMPERATURE = '03000000-0001-726f-736e-65536c696f53';
export const CHAR_EC = '04000000-0001-726f-736e-65536c696f53';
export const CHAR_TIMESTAMP = '05000000-0001-726f-736e-65536c696f53';

/** 读数开关写入值 */
export const TOGGLE_ON = 0x01;
export const TOGGLE_OFF = 0x00;

/** 缩放系数（勿按直觉改） */
export const SCALE_MOISTURE = 0.5; // uint8 -> %
export const SCALE_TEMPERATURE = 0.5; // int8 -> ℃
export const SCALE_EC_LIVE = 1 / 20; // uint8 -> mS/cm（实时路径 /20）
export const SCALE_EC_RECORD = 1 / 100; // uint8 -> mS/cm（记录路径 /100）

/** 记录子记录位布局 */
export const RECORD_RECORD_INDEX_MASK = 0x1f; // b0 低 5 位
export const RECORD_SUB_INDEX_SHIFT = 5; // b0 高 3 位
export const RECORD_SUB_INDEX_MASK = 0x07;
export const RECORD_BYTES = 32;
export const SUB_RECORDS_PER_RECORD = 8;
export const SUB_RECORD_BYTES = 4;

/** 记录族：L2 / L1 / Latest（特征 UUID 模式 XXYY0000-0000-726f-...，YY=族码） */
export const RECORD_FAMILY_L2 = 0x00;
export const RECORD_FAMILY_L1 = 0x01;
export const RECORD_FAMILY_LATEST = 0x02;
export const RECORD_L2_COUNT = 24;
export const RECORD_L1_COUNT = 8;
export const RECORD_L1_SLOT_BASE = 24; // L1 chr[0] -> slot24

/** 扫描 / 连接 / 读取超时（毫秒） */
export const SCAN_TIMEOUT_MS = 30_000;
export const CONNECT_TIMEOUT_MS = 10_000;
export const READ_TIMEOUT_MS = 5_000;
export const IDLE_DISCONNECT_MS = 60_000;

/** 实时轮询间隔（毫秒） */
export const LIVE_POLL_INTERVAL_MS = 3_000;
