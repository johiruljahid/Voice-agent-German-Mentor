import React from 'react';
import { AudioVisualizerProps } from '../types';

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isSpeaking, volume, isActive }) => {
  // Map volume (0-1) to a scale factor (1-2)
  const scale = 1 + Math.min(volume * 5, 1.5);
  
  // Color state: Teal for listening (user), Rose for speaking (AI), Gray for inactive
  let colorClass = "bg-slate-300";
  let pulseColorClass = "bg-slate-200";
  
  if (isActive) {
    if (isSpeaking) {
      // AI Speaking -> Rose/Pink
      colorClass = "bg-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.6)]";
      pulseColorClass = "bg-rose-300";
    } else {
      // User Speaking/Listening -> Teal/Cyan
      colorClass = "bg-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.6)]";
      pulseColorClass = "bg-teal-300";
    }
  }

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer pulsing rings */}
      {isActive && (
        <>
           <div 
            className={`absolute rounded-full opacity-30 animate-ping ${pulseColorClass}`} 
            style={{ width: '100%', height: '100%', animationDuration: '2s' }}
           />
           <div 
            className={`absolute rounded-full opacity-20 animate-ping ${pulseColorClass}`} 
            style={{ width: '80%', height: '80%', animationDuration: '1.5s', animationDelay: '0.2s' }}
           />
        </>
      )}

      {/* Main Circle */}
      <div 
        className={`relative z-10 rounded-full transition-all duration-100 ease-out ${colorClass}`}
        style={{
          width: isActive ? `${120 * scale}px` : '120px',
          height: isActive ? `${120 * scale}px` : '120px',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
            {isActive ? (
                isSpeaking ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 2.485.586 4.821 1.633 6.871.192.366 1.053.629 1.453.629h2.852l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                    </svg>
                )
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-slate-500">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9zM10.5 6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm1.5 6a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM7.5 15a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9-6a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" clipRule="evenodd" />
                </svg>
            )}
        </div>
      </div>
    </div>
  );
};

export default AudioVisualizer;
