import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export default function VoiceInput({ onTranscript, disabled, onModeChange }) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [status, setStatus] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [needsRestart, setNeedsRestart] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const deepgramRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const shouldContinueRef = useRef(false);

  // Check browser support
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      console.error('❌ MediaDevices API not supported');
    }
  }, []);

  // Monitor audio levels
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);
    
    setAudioLevel(normalizedLevel);
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  };

  const startDeepgram = async () => {
    try {
      console.log('🎤 Starting Deepgram...');
      setStatus('Connecting...');
      setNeedsRestart(false);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('✅ Microphone access granted');

      // Setup audio level monitoring
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      monitorAudioLevel();

      // Initialize Deepgram
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error('Deepgram API key not found');
      }

      console.log('🔑 Connecting to Deepgram...');
      const deepgram = createClient(apiKey);
      
      const connection = deepgram.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: false,
      });

      deepgramRef.current = connection;

      // Handle connection open
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection opened');
        setStatus('Listening...');
        setIsListening(true);

        // Create MediaRecorder to send audio to Deepgram
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send audio every 250ms
        console.log('🎙️ Recording started');
      });

      // Handle transcription results
      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives[0]?.transcript;
        
        if (transcript && transcript.trim()) {
          console.log('📝 Transcript:', transcript);
          onTranscript(transcript);
        }
      });

      // Handle errors
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Deepgram error:', error);
        setStatus('Error occurred');
        setNeedsRestart(true);
      });

      // Handle connection close
      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔌 Deepgram connection closed');
        setIsListening(false);
        setStatus('');
        
        // Auto-restart if still in voice mode
        if (shouldContinueRef.current) {
          console.log('♻️ Auto-restarting...');
          setTimeout(() => {
            if (shouldContinueRef.current) {
              startDeepgram();
            }
          }, 1000);
        }
      });

    } catch (error) {
      console.error('❌ Error starting Deepgram:', error);
      setStatus('Failed to start');
      setIsListening(false);
      setNeedsRestart(true);
    }
  };

  const stopDeepgram = () => {
    console.log('🛑 Stopping Deepgram...');
    shouldContinueRef.current = false;
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Close Deepgram connection
    if (deepgramRef.current) {
      deepgramRef.current.finish();
      deepgramRef.current = null;
    }

    // Stop audio monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsListening(false);
    setStatus('');
    setAudioLevel(0);
    setNeedsRestart(false);
  };

  const toggleVoiceMode = async () => {
    const newMode = !voiceMode;
    console.log('🎤 Toggle voice mode:', newMode);
    setVoiceMode(newMode);
    shouldContinueRef.current = newMode;
    
    if (onModeChange) {
      onModeChange(newMode);
    }

    if (newMode) {
      await startDeepgram();
    } else {
      stopDeepgram();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDeepgram();
    };
  }, []);

  if (!isSupported) {
    return (
      <div className="text-xs text-gray-500 italic p-2 bg-gray-100 rounded">
        ⚠️ Microphone access not supported in this browser
      </div>
    );
  }

  const getVolumeColor = () => {
    if (audioLevel < 20) return 'bg-red-500';
    if (audioLevel < 60) return 'bg-green-500';
    return 'bg-orange-500';
  };

  const getVolumeMessage = () => {
    if (audioLevel < 20) return '🔴 Speak louder';
    if (audioLevel < 60) return '✅ Good volume';
    return '⚠️ Very loud';
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Voice Mode Toggle Button */}
      <button
        onClick={toggleVoiceMode}
        disabled={disabled}
        className={`
          px-6 py-3 rounded-full font-semibold text-sm transition-all
          ${voiceMode 
            ? 'bg-green-500 text-white shadow-lg' 
            : 'bg-white text-gray-700 border-2 border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        `}
      >
        <div className="flex items-center gap-2">
          {voiceMode ? (
            <>
              <Mic className="w-5 h-5" />
              <span>Voice Mode ON</span>
            </>
          ) : (
            <>
              <MicOff className="w-5 h-5" />
              <span>Voice Mode OFF</span>
            </>
          )}
        </div>
      </button>

      {/* Audio Level Indicator */}
      {voiceMode && isListening && (
        <div className="w-full max-w-xs">
          {/* Volume Bars */}
          <div className="flex gap-1 h-8 items-end justify-center mb-2">
            {[...Array(10)].map((_, i) => {
              const barThreshold = (i + 1) * 10;
              const isActive = audioLevel >= barThreshold;

              return (
                <div
                  key={i}
                  className={`
                    w-2 rounded-t transition-all duration-100
                    ${isActive ? getVolumeColor() : 'bg-gray-300'}
                  `}
                  style={{
                    height: `${(i + 1) * 8}%`,
                    opacity: isActive ? 1 : 0.3
                  }}
                />
              );
            })}
          </div>

          {/* Status Message */}
          <div className={`
            flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            ${audioLevel < 20 ? 'bg-red-50 text-red-500' : 
              audioLevel < 60 ? 'bg-green-50 text-green-500' : 
              'bg-orange-50 text-orange-500'}
            text-xs font-medium
          `}>
            {audioLevel < 20 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{getVolumeMessage()}</span>
          </div>
        </div>
      )}

      {/* Restart Button */}
      {voiceMode && needsRestart && (
        <button
          onClick={startDeepgram}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Restart Voice
        </button>
      )}

      {/* Status Text */}
      {status && (
        <span className="text-xs text-white font-medium">
          {status}
        </span>
      )}

      {voiceMode && isListening && (
        <span className="text-xs text-white font-medium animate-pulse">
          🎤 Listening... Speak naturally
        </span>
      )}

      {!voiceMode && (
        <span className="text-xs text-white opacity-75">
          Tap to enable voice mode - like a phone call
        </span>
      )}
    </div>
  );
}

// Text-to-Speech function
export function speakText(text) {
  console.log('🔊 speakText called:', text.substring(0, 50));
  
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('❌ Speech synthesis not supported');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Wait for voices to load
  const speak = () => {
    const voices = window.speechSynthesis.getVoices();
    console.log('🎙️ Available voices:', voices.length);
    
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Female') || 
      voice.name.includes('Samantha') ||
      voice.name.includes('Karen') ||
      voice.name.includes('Google') ||
      voice.lang.includes('en-US') ||
      voice.lang.includes('en-GB')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log('✅ Using voice:', preferredVoice.name);
    } else {
      console.log('⚠️ Using default voice');
    }

    utterance.onstart = () => console.log('🔊 Speaking...');
    utterance.onend = () => console.log('✅ Speaking finished');
    utterance.onerror = (e) => console.error('❌ Speech error:', e);

    window.speechSynthesis.speak(utterance);
  };

  // Some browsers need time to load voices
  if (window.speechSynthesis.getVoices().length === 0) {
    console.log('⏳ Waiting for voices to load...');
    window.speechSynthesis.onvoiceschanged = () => {
      speak();
    };
  } else {
    speak();
  }
}