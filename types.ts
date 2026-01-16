export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioVisualizerProps {
  isSpeaking: boolean;
  volume: number; // 0 to 1
  isActive: boolean;
}

export interface ControlPanelProps {
  connectionState: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  isMicMuted: boolean;
  onToggleMic: () => void;
}
