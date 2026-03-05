export type Severity = 'Minor' | 'Moderate' | 'Critical';

export interface SensorData {
  accel: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
  };
  gyro: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  speed: number;
  distance: number;
  motion: boolean;
  timestamp: number;
}

export interface BlackBoxEntry extends SensorData {}

export interface SystemState {
  isOnline: boolean;
  gps: {
    lat: number;
    lng: number;
  };
  accidentDetected: boolean;
  alertStatus: 'idle' | 'countdown' | 'triggered' | 'cancelled';
  countdown: number;
  batteryLevel: number;
  isOnBackupPower: boolean;
  lastAccident?: {
    timestamp: string;
    location: { lat: number; lng: number };
    severity: Severity;
    severityIndex: number;
    type: 'Impact' | 'Rollover';
    blackBoxData: BlackBoxEntry[];
  };
  contactEscalation: {
    current: number;
    total: number;
    status: string;
  };
}
