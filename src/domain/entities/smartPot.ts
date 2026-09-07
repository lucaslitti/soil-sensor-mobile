export interface SmartPotHistoryPoint {
  timestamp: number;
  soil: number;
  temperature: number;
  lux: number;
}

export interface SmartPotSnapshot {
  light: string;
  lightSensor: string;
  rgb: string;
  pump: string;
  moisture: string;
  ec: string;
  temperature: string;
  config: string;
  history: SmartPotHistoryPoint[];
}
