import React from 'react';
import AudioVisualizer from './components/AudioVisualizer';
import ControlPanel from './components/ControlPanel';
import { useLiveSession } from './hooks/useLiveSession';
import { ConnectionState } from './types';

const App: React.FC = () => {
  const { 
    connectionState, 
    connect, 
    disconnect, 
    volume, 
    isAiSpeaking, 
    error 
  } = useLiveSession();

  const isSessionActive = connectionState === ConnectionState.CONNECTED;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-slate-50 p-6">
      
      {/* Header */}
      <header className="w-full max-w-2xl flex flex-col items-center mt-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 text-center">
          Deutsch mit Lisa
        </h1>
        <p className="text-slate-500 text-center max-w-md">
          Your friendly AI German mentor. Learn A1 topics: Greetings, Numbers, and Introductions in Bangla.
        </p>
      </header>

      {/* Main Content Area (Visualizer) */}
      <main className="flex-grow flex flex-col items-center justify-center w-full">
        
        {/* Status Indicator Text */}
        <div className="mb-8 h-8 flex items-center justify-center">
          {connectionState === ConnectionState.CONNECTING && (
            <span className="text-teal-600 font-medium animate-pulse">Establishing connection...</span>
          )}
          {connectionState === ConnectionState.CONNECTED && (
            <span className={`font-medium px-4 py-1 rounded-full text-sm transition-colors duration-300
              ${isAiSpeaking ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}
            `}>
              {isAiSpeaking ? "Lisa is speaking..." : "Lisa is listening..."}
            </span>
          )}
          {error && (
            <span className="text-red-500 font-medium bg-red-50 px-4 py-1 rounded-full border border-red-100">
              {error}
            </span>
          )}
        </div>

        {/* Visualizer */}
        <AudioVisualizer 
          isSpeaking={isAiSpeaking} 
          volume={volume} 
          isActive={isSessionActive} 
        />
        
        {/* Helper Tips */}
        {!isSessionActive && !error && (
          <div className="mt-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 max-w-md w-full">
            <h3 className="font-semibold text-slate-700 mb-3">Today's Lesson (A1):</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">•</span>
                <span><strong>Greetings:</strong> Hallo, Guten Morgen, Tschüss.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">•</span>
                <span><strong>Numbers:</strong> Counting 1 to 10.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">•</span>
                <span><strong>Introductions:</strong> "Ich heiße..."</span>
              </li>
            </ul>
          </div>
        )}
      </main>

      {/* Footer Controls */}
      <footer className="w-full flex justify-center pb-8 pt-4">
        <ControlPanel 
          connectionState={connectionState}
          onConnect={connect}
          onDisconnect={disconnect}
          isMicMuted={false}
          onToggleMic={() => {}}
        />
      </footer>
    </div>
  );
};

export default App;