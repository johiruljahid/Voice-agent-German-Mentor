import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState } from '../types';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

export const useLiveSession = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [volume, setVolume] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Contexts & Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  
  // State for playback scheduling
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // The active session promise/reference
  // We use a ref to the session object itself if available, or just the promise
  // However, the example uses `sessionPromise.then(session => ...)`. 
  // We'll keep a ref to the active session object to call `close()` on it.
  const sessionRef = useRef<any>(null); // Using 'any' as the Session type isn't fully exported in all alpha versions, but strictly it's `LiveSession`

  const disconnect = useCallback(async () => {
    // 1. Close session
    if (sessionRef.current) {
      try {
        await sessionRef.current.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
      sessionRef.current = null;
    }

    // 2. Stop all playing audio
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();

    // 3. Close Audio Contexts
    if (inputAudioContextRef.current) {
      await inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      await outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // 4. Reset State
    setConnectionState(ConnectionState.DISCONNECTED);
    setIsAiSpeaking(false);
    setVolume(0);
    nextStartTimeRef.current = 0;
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setConnectionState(ConnectionState.CONNECTING);

      // Initialize API
      if (!process.env.API_KEY) {
        throw new Error("API Key is missing.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Initialize Audio Contexts
      // Input: 16kHz for Gemini
      // Output: 24kHz usually from Gemini Live
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Resume contexts (needed for some browsers)
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      // Output Gain Node (Volume Control)
      const outputGain = outputCtx.createGain();
      outputGain.connect(outputCtx.destination);
      outputNodeRef.current = outputGain;

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // 'Kore' is a gentle female voice often
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: async () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Setup Input Processing
            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            // Using ScriptProcessor as per documentation examples (despite deprecation)
            // Buffer size 4096 provides a good balance for this use case
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume meter logic for visualization
              let sum = 0;
              for(let i=0; i<inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              // Update volume state only if not AI speaking (to show user mic activity)
              // We'll update volume generally, the UI can decide what to show
              setVolume(rms);

              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Interruption
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              console.log("Interrupted!");
              activeSourcesRef.current.forEach((src) => {
                try { src.stop(); } catch(e){}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAiSpeaking(false);
              return;
            }

            // Handle Audio Data
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setIsAiSpeaking(true);
              
              try {
                // Ensure context is running
                if (outputCtx.state === 'suspended') await outputCtx.resume();

                // Decode
                const audioBytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, outputCtx, 24000, 1);
                
                // Schedule
                // Ensure we don't schedule in the past
                const currentTime = outputCtx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
                }
                
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputGain);
                
                source.start(nextStartTimeRef.current);
                activeSourcesRef.current.add(source);

                const duration = audioBuffer.duration;
                nextStartTimeRef.current += duration;

                source.onended = () => {
                  activeSourcesRef.current.delete(source);
                  // Approximate check if this was the last source
                  if (activeSourcesRef.current.size === 0) {
                     // Add a small delay/buffer before saying AI stopped speaking to prevent flicker
                     setTimeout(() => {
                        if (activeSourcesRef.current.size === 0) {
                             setIsAiSpeaking(false);
                        }
                     }, 200);
                  }
                };
              } catch (err) {
                console.error("Error decoding audio", err);
              }
            }
          },
          onclose: (e) => {
            console.log("Session closed", e);
            disconnect();
          },
          onerror: (e) => {
            console.error("Session error", e);
            setError("Connection error occurred.");
            disconnect();
          }
        }
      });

      // Save session reference for cleanup
      sessionPromise.then(sess => {
        sessionRef.current = sess;
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
    }
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
    volume,
    isAiSpeaking,
    error
  };
};
