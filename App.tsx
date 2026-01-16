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
          Your friendly AI German mentor. Speak naturally to practice.
        </p>
      </header>

      {/* Main Content Area (Visualizer) */}
      <main className="flex-grow flex flex-col items-center justify-center w-full">
        
        {/* Status Indicator Text */}
        <div className="mb-8 h-8 flex items-center justify-center w-full">
          {connectionState === ConnectionState.CONNECTING && (
            <div className="flex items-center gap-2 text-teal-600 font-medium animate-pulse bg-teal-50 px-4 py-2 rounded-full">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Establishing secure connection...
            </div>
          )}
          {connectionState === ConnectionState.CONNECTED && (
            <span className={`font-medium px-4 py-1 rounded-full text-sm transition-colors duration-300 shadow-sm
              ${isAiSpeaking ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-teal-100 text-teal-700 border border-teal-200'}
            `}>
              {isAiSpeaking ? "Lisa is speaking..." : "Lisa is listening..."}
            </span>
          )}
          {error && (
            <div className="text-red-600 font-medium bg-red-50 px-6 py-2 rounded-full border border-red-200 shadow-sm flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
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
          <div className="mt-12 p-6 bg-white rounded-xl shadow-md border border-slate-100 max-w-md w-full">
            <h3 className="font-bold text-slate-800 mb-3 text-lg">Getting Started</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></div>
                <span>Start with a polite <strong>"Nomoshkar"</strong> or <strong>"Hallo"</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></div>
                <span>Lisa will switch between <strong>Bangla</strong> and <strong>German</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></div>
                <span>Say <strong>"I am ready"</strong> to begin level A1.</span>
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