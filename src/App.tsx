import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Compass, 
  MapPin, 
  Navigation, 
  Phone, 
  Radio, 
  ShieldAlert, 
  Signal, 
  Zap,
  RotateCcw,
  Gauge,
  Database,
  UserPlus,
  Volume2,
  Battery,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

import { SensorData, SystemState, BlackBoxEntry, Severity } from './types';
import { 
  ACCEL_THRESHOLD, 
  TILT_THRESHOLD, 
  SPEED_LIMIT, 
  HARSH_BRAKING_THRESHOLD, 
  DEFAULT_LOCATION, 
  COUNTDOWN_DURATION,
  BLACK_BOX_SIZE
} from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // --- State ---
  const [sensorData, setSensorData] = useState<SensorData>({
    accel: { x: 0, y: 0, z: 1, magnitude: 1 },
    gyro: { roll: 0, pitch: 0, yaw: 0 },
    speed: 45,
    distance: 150,
    motion: true,
    timestamp: Date.now()
  });

  const [history, setHistory] = useState<SensorData[]>([]);
  const [blackBoxBuffer, setBlackBoxBuffer] = useState<BlackBoxEntry[]>([]);
  
  const [systemState, setSystemState] = useState<SystemState>({
    isOnline: true,
    gps: DEFAULT_LOCATION,
    accidentDetected: false,
    alertStatus: 'idle',
    countdown: COUNTDOWN_DURATION,
    batteryLevel: 85,
    isOnBackupPower: false,
    contactEscalation: { current: 0, total: 3, status: 'Ready' }
  });

  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const escalationTimer = useRef<NodeJS.Timeout | null>(null);

  // --- Voice Alerts ---
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Simulation Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorData(prev => {
        // Normal driving noise
        const noise = (scale = 0.4) => (Math.random() - 0.5) * scale;
        const nx = noise();
        const ny = noise();
        const nz = 1 + noise();
        const mag = Math.sqrt(nx*nx + ny*ny + nz*nz);
        
        const newData: SensorData = {
          accel: { x: nx, y: ny, z: nz, magnitude: mag },
          gyro: { 
            roll: prev.gyro.roll + noise(2), 
            pitch: prev.gyro.pitch + noise(2), 
            yaw: prev.gyro.yaw + noise(5) 
          },
          speed: Math.max(0, Math.min(160, prev.speed + noise(5))),
          distance: Math.max(20, Math.min(400, prev.distance + noise(10))),
          motion: Math.random() > 0.05,
          timestamp: Date.now()
        };

        setHistory(h => [...h.slice(-20), newData]);
        setBlackBoxBuffer(b => [...b.slice(-(BLACK_BOX_SIZE - 1)), newData]);
        return newData;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // --- Accident Detection Logic ---
  useEffect(() => {
    // 1. Impact Detection
    if (sensorData.accel.magnitude > ACCEL_THRESHOLD && systemState.alertStatus === 'idle') {
      // AI Filtering Simulation: Check if it's a pothole (short duration, motion continues)
      const isLikelyPothole = sensorData.accel.magnitude < 3.5 && sensorData.motion;
      if (!isLikelyPothole) {
        triggerAccident('Impact');
      }
    }

    // 2. Rollover Detection
    const isRollover = Math.abs(sensorData.gyro.roll) > TILT_THRESHOLD || Math.abs(sensorData.gyro.pitch) > TILT_THRESHOLD;
    if (isRollover && systemState.alertStatus === 'idle') {
      triggerAccident('Rollover');
    }
  }, [sensorData.accel.magnitude, sensorData.gyro.roll, sensorData.gyro.pitch]);

  const calculateSeverity = (accel: number, speed: number): { index: number, label: Severity } => {
    // Severity Index = Resultant Accel + (Speed / 20)
    const index = accel + (speed / 20);
    let label: Severity = 'Minor';
    if (index > 8) label = 'Critical';
    else if (index > 5) label = 'Moderate';
    return { index, label };
  };

  const triggerAccident = (type: 'Impact' | 'Rollover') => {
    const severity = calculateSeverity(sensorData.accel.magnitude, sensorData.speed);
    
    setSystemState(prev => ({
      ...prev,
      accidentDetected: true,
      alertStatus: 'countdown',
      countdown: COUNTDOWN_DURATION,
      lastAccident: {
        timestamp: new Date().toISOString(),
        location: prev.gps,
        severity: severity.label,
        severityIndex: severity.index,
        type: type,
        blackBoxData: [...blackBoxBuffer]
      }
    }));

    speak(`${type} detected. Severity is ${severity.label}. Sending emergency alert in 10 seconds.`);

    countdownTimer.current = setInterval(() => {
      setSystemState(prev => {
        if (prev.countdown <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          initiateEscalation();
          return { ...prev, countdown: 0, alertStatus: 'triggered' };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  const initiateEscalation = () => {
    setSystemState(prev => ({
      ...prev,
      contactEscalation: { ...prev.contactEscalation, current: 1, status: 'Calling Contact 1...' }
    }));

    escalationTimer.current = setInterval(() => {
      setSystemState(prev => {
        if (prev.contactEscalation.current >= prev.contactEscalation.total) {
          if (escalationTimer.current) clearInterval(escalationTimer.current);
          return { 
            ...prev, 
            contactEscalation: { ...prev.contactEscalation, status: 'Emergency Services Notified' } 
          };
        }
        const next = prev.contactEscalation.current + 1;
        const status = next === 3 ? 'Notifying Emergency Services...' : `Calling Contact ${next}...`;
        return { 
          ...prev, 
          contactEscalation: { ...prev.contactEscalation, current: next, status } 
        };
      });
    }, 5000);
  };

  const cancelAlert = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (escalationTimer.current) clearInterval(escalationTimer.current);
    
    setSystemState(prev => ({
      ...prev,
      alertStatus: 'cancelled',
      accidentDetected: false,
      contactEscalation: { ...prev.contactEscalation, current: 0, status: 'Ready' }
    }));
    
    speak("Emergency alert cancelled.");

    setTimeout(() => {
      setSystemState(prev => ({ ...prev, alertStatus: 'idle' }));
    }, 3000);
  };

  const simulateImpact = () => {
    setSensorData(prev => {
      const impact = 4.5 + Math.random() * 2;
      return {
        ...prev,
        accel: { x: 2, y: 2, z: impact, magnitude: impact },
        speed: 80,
        timestamp: Date.now()
      };
    });
  };

  const simulateRollover = () => {
    setSensorData(prev => ({
      ...prev,
      gyro: { roll: 75, pitch: 10, yaw: 0 },
      timestamp: Date.now()
    }));
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${systemState.gps.lat},${systemState.gps.lng}`;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0D0D0E]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">GuardianDrive <span className="text-emerald-400">Pro</span></h1>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", systemState.isOnline ? "bg-emerald-500" : "bg-red-500")} />
                  {systemState.isOnline ? "System Online" : "System Offline"}
                </span>
                <span className="opacity-30">|</span>
                <span className="flex items-center gap-1">
                  <Battery className={cn("w-3 h-3", systemState.batteryLevel < 20 ? "text-red-500" : "text-emerald-500")} />
                  {systemState.batteryLevel}% {systemState.isOnBackupPower ? "(Backup)" : ""}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-mono text-slate-400">{format(new Date(), 'HH:mm:ss')}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Advanced Telemetry</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={simulateImpact}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-[10px] font-bold text-red-400 flex items-center gap-2"
              >
                <Zap className="w-3 h-3" /> IMPACT
              </button>
              <button 
                onClick={simulateRollover}
                className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition-all text-[10px] font-bold text-orange-400 flex items-center gap-2"
              >
                <RotateCcw className="w-3 h-3" /> ROLL
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Emergency Alert Banner */}
        <AnimatePresence>
          {systemState.alertStatus !== 'idle' && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                "p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6",
                systemState.alertStatus === 'countdown' ? "bg-red-500/10 border-red-500/30" : 
                systemState.alertStatus === 'triggered' ? "bg-red-600 border-red-400 shadow-[0_0_40px_rgba(220,38,38,0.3)]" :
                "bg-emerald-500/10 border-emerald-500/30"
              )}>
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center shrink-0",
                    systemState.alertStatus === 'countdown' ? "bg-red-500 animate-pulse" : 
                    systemState.alertStatus === 'triggered' ? "bg-white" : "bg-emerald-500"
                  )}>
                    {systemState.alertStatus === 'countdown' ? (
                      <span className="text-2xl font-bold text-white">{systemState.countdown}</span>
                    ) : systemState.alertStatus === 'triggered' ? (
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className={cn(
                        "text-xl font-bold",
                        systemState.alertStatus === 'triggered' ? "text-white" : "text-slate-100"
                      )}>
                        {systemState.alertStatus === 'countdown' ? `${systemState.lastAccident?.type} Detected!` : 
                         systemState.alertStatus === 'triggered' ? "EMERGENCY ESCALATION ACTIVE" : "Alert Cancelled"}
                      </h2>
                      {systemState.lastAccident && (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          systemState.lastAccident.severity === 'Critical' ? "bg-black text-red-500" :
                          systemState.lastAccident.severity === 'Moderate' ? "bg-black text-orange-500" :
                          "bg-black text-yellow-500"
                        )}>
                          {systemState.lastAccident.severity}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm mt-1",
                      systemState.alertStatus === 'triggered' ? "text-red-100" : "text-slate-400"
                    )}>
                      {systemState.alertStatus === 'countdown' ? "Emergency services will be notified in 10 seconds." : 
                       systemState.alertStatus === 'triggered' ? systemState.contactEscalation.status : 
                       "The alert was manually cancelled by the user."}
                    </p>
                  </div>
                </div>
                
                {systemState.alertStatus === 'countdown' && (
                  <button 
                    onClick={cancelAlert}
                    className="w-full md:w-auto px-8 py-3 bg-white text-red-600 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Volume2 className="w-5 h-5" /> I'M OK - CANCEL
                  </button>
                )}

                {systemState.alertStatus === 'triggered' && (
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <div className="flex items-center justify-between gap-4 text-xs font-bold text-red-100 bg-red-700/50 px-4 py-2 rounded-xl">
                      <div className="flex items-center gap-2"><UserPlus className="w-3 h-3" /> Escalation:</div>
                      <div>{systemState.contactEscalation.current}/{systemState.contactEscalation.total}</div>
                    </div>
                    <div className="w-full h-1 bg-red-900 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white"
                        initial={{ width: 0 }}
                        animate={{ width: `${(systemState.contactEscalation.current / systemState.contactEscalation.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Telemetry */}
          <div className="lg:col-span-2 space-y-6">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Vehicle Speed</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className={cn(
                    "text-3xl font-mono font-bold",
                    sensorData.speed > SPEED_LIMIT ? "text-red-500" : "text-white"
                  )}>
                    {Math.round(sensorData.speed)}
                    <span className="text-xs ml-1 opacity-50">km/h</span>
                  </span>
                  {sensorData.speed > SPEED_LIMIT && (
                    <span className="text-[10px] font-black text-red-500 animate-pulse">OVER SPEED</span>
                  )}
                </div>
              </div>

              <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <RotateCcw className="w-4 h-4 text-orange-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Roll Angle</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className={cn(
                    "text-3xl font-mono font-bold",
                    Math.abs(sensorData.gyro.roll) > TILT_THRESHOLD ? "text-orange-500" : "text-white"
                  )}>
                    {Math.round(sensorData.gyro.roll)}°
                  </span>
                  <div className="w-12 h-12 relative flex items-center justify-center">
                    <motion.div 
                      className="w-8 h-1 bg-orange-500 rounded-full"
                      animate={{ rotate: sensorData.gyro.roll }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">AI Filter</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400">ACTIVE</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-blue-500/20 rounded-full overflow-hidden">
                      <motion.div className="w-full bg-blue-500" animate={{ height: [0, 16, 4, 12, 0] }} transition={{ repeat: Infinity, duration: 1 }} />
                    </div>
                    <div className="w-1 h-4 bg-blue-500/20 rounded-full overflow-hidden">
                      <motion.div className="w-full bg-blue-500" animate={{ height: [4, 12, 0, 16, 4] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Accelerometer Panel */}
            <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white">Impact Telemetry</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Severity Index</p>
                  <p className="text-xl font-mono font-bold text-white">
                    {calculateSeverity(sensorData.accel.magnitude, sensorData.speed).index.toFixed(1)}
                  </p>
                </div>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorMag" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis domain={[0, 6]} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161617', border: '1px solid #ffffff10', borderRadius: '8px' }}
                      itemStyle={{ color: '#10b981' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="accel.magnitude" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorMag)" 
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Black Box / Analytics */}
            <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white">Black Box Recorder</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">BUFFER: {blackBoxBuffer.length}/{BLACK_BOX_SIZE}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Driver Behavior</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-xs text-slate-400">Harsh Braking</span>
                      <span className="text-xs font-bold text-emerald-400">0 DETECTED</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-xs text-slate-400">Aggressive Turns</span>
                      <span className="text-xs font-bold text-emerald-400">NORMAL</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-xs text-slate-400">Idle Time</span>
                      <span className="text-xs font-bold text-blue-400">12m 4s</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={blackBoxBuffer.slice(-10)}>
                      <Bar dataKey="speed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <XAxis hide />
                      <YAxis hide />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-center text-[10px] text-slate-500 mt-2 font-bold uppercase">Recent Speed Profile</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Map & Status */}
          <div className="space-y-6">
            {/* Map Panel */}
            <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-400" />
                  <h3 className="font-bold text-sm text-white">Live Location</h3>
                </div>
                <a 
                  href={googleMapsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                >
                  OPEN IN MAPS
                </a>
              </div>
              <div className="aspect-square bg-slate-800 relative">
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  scrolling="no" 
                  marginHeight={0} 
                  marginWidth={0} 
                  src={`https://maps.google.com/maps?q=${systemState.gps.lat},${systemState.gps.lng}&z=15&output=embed`}
                  className="grayscale invert contrast-125 opacity-80"
                />
                <div className="absolute inset-0 pointer-events-none border-[12px] border-[#0D0D0E]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-red-500/20 rounded-full animate-ping" />
                    <div className="w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-lg relative z-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                Emergency Contacts
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'John Doe (Primary)', phone: '+1 234 567 890', active: systemState.contactEscalation.current === 1 },
                  { name: 'Jane Smith', phone: '+1 987 654 321', active: systemState.contactEscalation.current === 2 },
                  { name: 'Emergency Services', phone: '911', active: systemState.contactEscalation.current === 3 }
                ].map((contact, idx) => (
                  <div key={idx} className={cn(
                    "p-3 rounded-xl border transition-all",
                    contact.active ? "bg-red-500/10 border-red-500/30 scale-[1.02]" : "bg-white/5 border-white/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{contact.name}</span>
                      {contact.active && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{contact.phone}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Compass className="w-4 h-4 text-slate-400" />
                System Health
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'GSM Module', status: 'Connected', icon: Signal, color: 'text-emerald-400' },
                  { label: 'GPS Fix', status: '3D Lock', icon: Navigation, color: 'text-emerald-400' },
                  { label: 'Battery', status: '12.4V', icon: Zap, color: 'text-yellow-400' },
                  { label: 'Backup Power', status: 'Standby', icon: ShieldAlert, color: 'text-blue-400' }
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-medium text-slate-300">{item.label}</span>
                    </div>
                    <span className={cn("text-xs font-bold", item.color)}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="mt-12 border-t border-white/5 bg-[#0D0D0E] p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">© 2026 GuardianDrive Pro. Advanced IoT Safety Platform.</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Cloud Sync Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Firmware v4.0.0-PRO</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
