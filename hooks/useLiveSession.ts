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
  
  // Playback state
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session management
  const currentSessionRef = useRef<any>(null);

  const disconnect = useCallback(async () => {
    console.log("Disconnecting...");
    // 1. Close API Session
    if (currentSessionRef.current) {
      try {
        await currentSessionRef.current.close();
        console.log("Session closed");
      } catch (e) {
        console.warn("Error closing session:", e);
      }
      currentSessionRef.current = null;
    }

    // 2. Stop Audio Sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();

    // 3. Cleanup Input
    if (inputSourceRef.current) {
      inputSourceRef.current.mediaStream.getTracks().forEach(track => track.stop());
      inputSourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      try { await inputAudioContextRef.current.close(); } catch(e){}
      inputAudioContextRef.current = null;
    }

    // 4. Cleanup Output
    if (outputAudioContextRef.current) {
      try { await outputAudioContextRef.current.close(); } catch(e){}
      outputAudioContextRef.current = null;
    }

    // 5. Reset State
    setConnectionState(ConnectionState.DISCONNECTED);
    setIsAiSpeaking(false);
    setVolume(0);
    nextStartTimeRef.current = 0;
  }, []);

  const connect = useCallback(async () => {
    console.log("Starting connection...");
    try {
      setError(null);
      setConnectionState(ConnectionState.CONNECTING);

      if (!process.env.API_KEY) {
        throw new Error("API Key is missing.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Setup Audio Contexts
      // Input: 16kHz required by Gemini
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Output: 24kHz required for Gemini response
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Force resume contexts immediately (browser autoplay policy)
      await Promise.all([
        inputCtx.resume(),
        outputCtx.resume()
      ]);

      // Output Gain
      const outputGain = outputCtx.createGain();
      outputGain.connect(outputCtx.destination);
      outputNodeRef.current = outputGain;

      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted");

      // 3. Connect to Gemini Live
      let sessionPromise: Promise<any>;

      const config = {
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: async () => {
            console.log("WebSocket connection opened");
            setConnectionState(ConnectionState.CONNECTED);
            
            // Setup Input Pipeline
            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            // Use 4096 buffer size for balance between latency and performance
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Volume Meter
              let sum = 0;
              for(let i=0; i<inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(rms);

              // Create Blob and Send
              const pcmBlob = createBlob(inputData);
              
              // Use the promise to ensure session is ready
              sessionPromise.then(session => {
                try {
                  session.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                  console.error("Error sending input:", err);
                }
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);

            // Trigger initial greeting by sending a hidden text prompt
            sessionPromise.then(session => {
              session.sendRealtimeInput([{ text: "Hello Lisa, I am ready to start. Please greet me in Bangla." }]);
            });
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Interruption
             if (message.serverContent?.interrupted) {
              console.log("Interrupted");
              activeSourcesRef.current.forEach(src => {
                try { src.stop(); } catch(e){}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAiSpeaking(false);
              return;
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setIsAiSpeaking(true);
              try {
                // Ensure context is running
                if (outputCtx.state === 'suspended') await outputCtx.resume();

                const audioBytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, outputCtx, 24000, 1);
                
                // Scheduling
                const currentTime = outputCtx.currentTime;
                // If next start time is in the past, reset it to now
                if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
                }
                
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputGain);
                
                source.start(nextStartTimeRef.current);
                activeSourcesRef.current.add(source);

                nextStartTimeRef.current += audioBuffer.duration;

                source.onended = () => {
                  activeSourcesRef.current.delete(source);
                  if (activeSourcesRef.current.size === 0) {
                     setTimeout(() => {
                        if (activeSourcesRef.current.size === 0) {
                             setIsAiSpeaking(false);
                        }
                     }, 250);
                  }
                };
              } catch (err) {
                console.error("Audio decoding error:", err);
              }
            }
          },
          onclose: (e: any) => {
            console.log("Session closed:", e);
            disconnect();
          },
          onerror: (e: any) => {
            console.error("Session error:", e);
            setError("Connection failed. Please refresh and try again.");
            disconnect();
          }
        }
      };

      sessionPromise = ai.live.connect(config);
      const session = await sessionPromise;
      currentSessionRef.current = session;

    } catch (err: any) {
      console.error("Connection setup failed:", err);
      setError(err.message || "Failed to connect.");
      setConnectionState(ConnectionState.ERROR);
      disconnect();
    }
  }, [disconnect]);

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