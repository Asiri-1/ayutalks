import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';

export default function VoiceInput({ onTranscript, disabled, onModeChange }) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [volumeStatus, setVolumeStatus] = useState('');
  const [needsRestart, setNeedsRestart] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const shouldContinueRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const lastRestartRef = useRef(0);

  // Monitor audio levels
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);
    
    setAudioLevel(normalizedLevel);

    if (normalizedLevel < 15) {
      setVolumeStatus('low');
    } else if (normalizedLevel < 50) {
      setVolumeStatus('good');
    } else {
      setVolumeStatus('high');
    }

    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  };

  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      monitorAudioLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setAudioLevel(0);
    setVolumeStatus('');
  };

  const startRecognition = () => {
    if (!recognitionRef.current || !shouldContinueRef.current) return;

    // Prevent rapid restarts (debounce)
    const now = Date.now();
    if (now - lastRestartRef.current < 1000) {
      console.log('Debouncing restart...');
      return;
    }
    lastRestartRef.current = now;

    try {
      setNeedsRestart(false);
      recognitionRef.current.start();
      console.log('🎤 Recognition started');
    } catch (error) {
      if (error.message.includes('already started')) {
        console.log('Recognition already running');
      } else {
        console.error('Error starting recognition:', error);
        setNeedsRestart(true);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setIsSupported(false);
        console.warn('Speech recognition not supported in this browser');
        return;
      }

      const recognition = new SpeechRecognition();
      
      // IMPORTANT: Keep continuous true for longer sessions
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Listening started');
        setIsListening(true);
        setNeedsRestart(false);
        startAudioMonitoring();
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        console.log('📝 Transcribed:', transcript);
        if (transcript.trim()) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        
        // Don't treat 'no-speech' as a fatal error
        if (event.error === 'no-speech') {
          console.log('No speech detected, continuing...');
          return;
        }

        // For other errors, mark as needing restart
        if (event.error === 'network' || event.error === 'aborted') {
          setNeedsRestart(true);
          setIsListening(false);
          stopAudioMonitoring();
        }
      };

      recognition.onend = () => {
        console.log('🎤 Recognition ended');
        setIsListening(false);
        stopAudioMonitoring();
        
        // Auto-restart if still in voice mode
        if (shouldContinueRef.current && voiceMode) {
          console.log('Auto-restarting recognition...');
          
          // Clear any existing restart timeout
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          // Restart after a short delay
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldContinueRef.current) {
              startRecognition();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Recognition already stopped');
        }
      }
      stopAudioMonitoring();
    };
  }, [onTranscript, voiceMode]);

  // Toggle Voice Mode
  const toggleVoiceMode = () => {
    const newMode = !voiceMode;
    setVoiceMode(newMode);
    shouldContinueRef.current = newMode;
    
    if (onModeChange) {
      onModeChange(newMode);
    }

    if (newMode) {
      // Entering voice mode - start listening
      startRecognition();
    } else {
      // Exiting voice mode - stop listening
      shouldContinueRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Recognition already stopped');
        }
      }
      stopAudioMonitoring();
      setNeedsRestart(false);
    }
  };

  // Manual restart function
  const manualRestart = () => {
    console.log('Manual restart triggered');
    shouldContinueRef.current = true;
    startRecognition();
  };

  if (!isSupported) {
    return (
      <div className="text-xs text-gray-500 italic p-2 bg-gray-100 rounded">
        ⚠️ Voice not supported in this browser. Try Chrome on Android.
      </div>
    );
  }

  const getStatusDisplay = () => {
    if (!isListening && !needsRestart) return null;

    if (needsRestart) {
      return {
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        message: '⚠️ Voice stopped. Tap to restart',
        icon: <RefreshCw className="w-4 h-4" />,
        action: true
      };
    }

    switch (volumeStatus) {
      case 'low':
        return {
          color: 'text-red-500',
          bg: 'bg-red-50',
          message: '🔴 Speak louder or come closer',
          icon: <VolumeX className="w-4 h-4" />
        };
      case 'good':
        return {
          color: 'text-green-500',
          bg: 'bg-green-50',
          message: '✅ Good volume',
          icon: <Volume2 className="w-4 h-4" />
        };
      case 'high':
        return {
          color: 'text-orange-500',
          bg: 'bg-orange-50',
          message: '⚠️ Very loud (but okay)',
          icon: <Volume2 className="w-4 h-4" />
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

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
        title={voiceMode ? 'Exit Voice Mode' : 'Enter Voice Mode'}
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

      {/* Audio Level Indicator - Only show when in voice mode and listening */}
      {voiceMode && isListening && (
        <div className="w-full max-w-xs">
          {/* Volume Bars */}
          <div className="flex gap-1 h-8 items-end justify-center mb-2">
            {[...Array(10)].map((_, i) => {
              const barThreshold = (i + 1) * 10;
              const isActive = audioLevel >= barThreshold;
              
              let barColor = 'bg-gray-300';
              if (isActive) {
                if (i < 3) barColor = 'bg-red-500';
                else if (i < 7) barColor = 'bg-green-500';
                else barColor = 'bg-orange-500';
              }

              return (
                <div
                  key={i}
                  className={`
                    w-2 rounded-t transition-all duration-100
                    ${barColor}
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
          {statusDisplay && (
            <div 
              className={`
                flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                ${statusDisplay.bg} ${statusDisplay.color}
                text-xs font-medium
                ${statusDisplay.action ? 'cursor-pointer hover:opacity-80' : ''}
              `}
              onClick={statusDisplay.action ? manualRestart : undefined}
            >
              {statusDisplay.icon}
              <span>{statusDisplay.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Restart Button - Show if needs restart */}
      {voiceMode && needsRestart && (
        <button
          onClick={manualRestart}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Restart Voice
        </button>
      )}

      {/* Status Text */}
      {voiceMode ? (
        <span className="text-xs text-white font-medium animate-pulse">
          🎤 Listening... Speak naturally
        </span>
      ) : (
        <span className="text-xs text-white opacity-75">
          Tap to enable hands-free voice mode
        </span>
      )}
    </div>
  );
}

// Text-to-Speech function (unchanged)
export function speakText(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Text-to-speech not supported');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(voice => 
    voice.name.includes('Female') || 
    voice.name.includes('Samantha') ||
    voice.name.includes('Karen') ||
    voice.lang.includes('en-US')
  );
  
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onstart = () => console.log('🔊 Speaking...');
  utterance.onend = () => console.log('✅ Finished speaking');
  utterance.onerror = (e) => console.error('❌ Speech error:', e);

  window.speechSynthesis.speak(utterance);
}