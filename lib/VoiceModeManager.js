// ================================================
// VOICE MODE - Wake Lock & Background Audio Manager
// ================================================
// Purpose: Keep voice mode active when screen locks (like WhatsApp call)
// Problem: Screen lock suspends web apps, stopping voice recording and playback
// Solution: Wake Lock API + Audio Session + Background Audio Context

// ================================================
// WAKE LOCK MANAGER
// ================================================
class WakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.isSupported = 'wakeLock' in navigator;
  }

  // Request wake lock to prevent screen from sleeping
  async requestWakeLock() {
    if (!this.isSupported) {
      console.warn('Wake Lock API not supported');
      return false;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      
      console.log('Wake Lock acquired');
      
      // Re-acquire wake lock if it's released (e.g., screen lock)
      this.wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
      
      return true;
    } catch (err) {
      console.error('Wake Lock request failed:', err);
      return false;
    }
  }

  // Release wake lock
  async releaseWakeLock() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      console.log('Wake Lock manually released');
    }
  }

  // Re-acquire wake lock after visibility change
  async reacquireWakeLock() {
    if (document.visibilityState === 'visible') {
      await this.requestWakeLock();
    }
  }
}

// ================================================
// BACKGROUND AUDIO MANAGER
// ================================================
class BackgroundAudioManager {
  constructor() {
    this.audioContext = null;
    this.silenceNode = null;
    this.isPlaying = false;
  }

  // Initialize audio context with silent audio to keep session active
  async initialize() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create silent audio buffer (keeps audio session alive)
      const silenceBuffer = this.audioContext.createBuffer(
        1, // mono
        this.audioContext.sampleRate * 0.5, // 0.5 seconds
        this.audioContext.sampleRate
      );
      
      // Create buffer source
      this.silenceNode = this.audioContext.createBufferSource();
      this.silenceNode.buffer = silenceBuffer;
      this.silenceNode.loop = true;
      this.silenceNode.connect(this.audioContext.destination);
      
      console.log('Background audio initialized');
      return true;
    } catch (err) {
      console.error('Background audio initialization failed:', err);
      return false;
    }
  }

  // Start playing silent audio (keeps audio session active)
  start() {
    if (!this.silenceNode || this.isPlaying) return;
    
    try {
      this.silenceNode.start();
      this.isPlaying = true;
      console.log('Background audio started');
    } catch (err) {
      console.error('Failed to start background audio:', err);
    }
  }

  // Stop silent audio
  stop() {
    if (!this.silenceNode || !this.isPlaying) return;
    
    try {
      this.silenceNode.stop();
      this.isPlaying = false;
      console.log('Background audio stopped');
    } catch (err) {
      console.error('Failed to stop background audio:', err);
    }
  }

  // Resume audio context if suspended
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('Audio context resumed');
    }
  }

  // Clean up
  cleanup() {
    if (this.silenceNode && this.isPlaying) {
      this.stop();
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// ================================================
// MEDIA SESSION API (For Lock Screen Controls)
// ================================================
class MediaSessionManager {
  constructor() {
    this.isSupported = 'mediaSession' in navigator;
  }

  // Setup media session metadata (shows on lock screen)
  setupMediaSession(options = {}) {
    if (!this.isSupported) {
      console.warn('Media Session API not supported');
      return;
    }

    const {
      title = 'AyuTalks Voice Mode',
      artist = 'Ayu',
      artwork = [{ src: '/ayu-icon.png', sizes: '512x512', type: 'image/png' }]
    } = options;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      artwork
    });

    console.log('Media session metadata set');
  }

  // Setup action handlers for lock screen controls
  setupActionHandlers(handlers = {}) {
    if (!this.isSupported) return;

    const {
      play = () => console.log('Play'),
      pause = () => console.log('Pause'),
      stop = () => console.log('Stop')
    } = handlers;

    try {
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('stop', stop);
      
      console.log('Media session action handlers set');
    } catch (err) {
      console.error('Failed to set action handlers:', err);
    }
  }

  // Update playback state
  updatePlaybackState(state = 'playing') {
    if (!this.isSupported) return;
    
    // State can be: 'none', 'paused', 'playing'
    navigator.mediaSession.playbackState = state;
  }

  // Clear media session
  clear() {
    if (!this.isSupported) return;
    
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('stop', null);
  }
}

// ================================================
// UNIFIED VOICE MODE MANAGER (Combines All)
// ================================================
export class VoiceModeManager {
  constructor() {
    this.wakeLock = new WakeLockManager();
    this.backgroundAudio = new BackgroundAudioManager();
    this.mediaSession = new MediaSessionManager();
    this.isActive = false;
    this.visibilityChangeHandler = null;
  }

  // Start voice mode with all protections
  async start(options = {}) {
    console.log('Starting voice mode with screen lock protection...');

    try {
      // 1. Initialize background audio
      await this.backgroundAudio.initialize();
      this.backgroundAudio.start();

      // 2. Request wake lock
      await this.wakeLock.requestWakeLock();

      // 3. Setup media session
      this.mediaSession.setupMediaSession(options);
      this.mediaSession.setupActionHandlers({
        play: () => this.resume(),
        pause: () => this.pause(),
        stop: () => this.stop()
      });
      this.mediaSession.updatePlaybackState('playing');

      // 4. Handle visibility changes
      this.setupVisibilityHandlers();

      this.isActive = true;
      console.log('Voice mode started with screen lock protection');
      
      return true;
    } catch (err) {
      console.error('Failed to start voice mode:', err);
      return false;
    }
  }

  // Stop voice mode and release all locks
  async stop() {
    console.log('Stopping voice mode...');

    // Stop background audio
    this.backgroundAudio.stop();
    this.backgroundAudio.cleanup();

    // Release wake lock
    await this.wakeLock.releaseWakeLock();

    // Clear media session
    this.mediaSession.clear();

    // Remove visibility handlers
    this.removeVisibilityHandlers();

    this.isActive = false;
    console.log('Voice mode stopped');
  }

  // Pause voice mode (but keep locks)
  pause() {
    console.log('Voice mode paused');
    this.mediaSession.updatePlaybackState('paused');
  }

  // Resume voice mode
  async resume() {
    console.log('Voice mode resumed');
    
    // Resume audio context if needed
    await this.backgroundAudio.resume();
    
    // Re-acquire wake lock if needed
    if (!this.wakeLock.wakeLock) {
      await this.wakeLock.requestWakeLock();
    }
    
    this.mediaSession.updatePlaybackState('playing');
  }

  // Handle visibility changes (screen lock/unlock)
  setupVisibilityHandlers() {
    this.visibilityChangeHandler = async () => {
      console.log('Visibility changed:', document.visibilityState);
      
      if (document.visibilityState === 'visible') {
        // Screen unlocked - re-acquire wake lock
        await this.wakeLock.reacquireWakeLock();
        await this.backgroundAudio.resume();
      } else {
        // Screen locked - ensure background audio continues
        await this.backgroundAudio.resume();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  // Remove visibility handlers
  removeVisibilityHandlers() {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  }

  // Check if voice mode is protected
  isProtected() {
    return {
      wakeLockSupported: this.wakeLock.isSupported,
      wakeLockActive: !!this.wakeLock.wakeLock,
      audioContextActive: this.backgroundAudio.isPlaying,
      mediaSessionSupported: this.mediaSession.isSupported
    };
  }
}

// ================================================
// REACT HOOK (for easy integration)
// ================================================
export function useVoiceModeProtection() {
  const [manager] = React.useState(() => new VoiceModeManager());
  const [isProtected, setIsProtected] = React.useState(false);

  const startProtection = React.useCallback(async (options) => {
    const success = await manager.start(options);
    setIsProtected(success);
    return success;
  }, [manager]);

  const stopProtection = React.useCallback(async () => {
    await manager.stop();
    setIsProtected(false);
  }, [manager]);

  const pauseProtection = React.useCallback(() => {
    manager.pause();
  }, [manager]);

  const resumeProtection = React.useCallback(async () => {
    await manager.resume();
  }, [manager]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (manager.isActive) {
        manager.stop();
      }
    };
  }, [manager]);

  return {
    startProtection,
    stopProtection,
    pauseProtection,
    resumeProtection,
    isProtected,
    protectionStatus: manager.isProtected()
  };
}

// ================================================
// SINGLETON INSTANCE (for non-React usage)
// ================================================
export const voiceModeManager = new VoiceModeManager();

// ================================================
// MOBILE-SPECIFIC FIXES
// ================================================

// Fix for iOS Safari audio context restriction
export function enableIOSAudio() {
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (iOS) {
    // iOS requires user interaction before audio can play
    // This should be called on user's first tap/click
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Play silent sound to unlock audio
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    console.log('iOS audio unlocked');
  }
}

// Fix for Android Chrome audio restriction
export function enableAndroidAudio() {
  const Android = /Android/.test(navigator.userAgent);
  
  if (Android) {
    // Similar to iOS, but Android has different requirements
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('Android audio resumed');
      });
    }
  }
}

// ================================================
// BATTERY OPTIMIZATION WARNING
// ================================================
export function checkBatteryOptimization() {
  // Some Android devices have aggressive battery optimization
  // that can kill background audio
  
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      if (battery.level < 0.2) {
        console.warn('Low battery - background audio may be affected');
        return {
          warning: true,
          message: 'Low battery detected. Voice mode may stop when screen locks. Consider charging your device.'
        };
      }
    });
  }
  
  return { warning: false };
}

// ================================================
// USAGE EXAMPLE
// ================================================
/*
// In your voice mode component:

import { useVoiceModeProtection, enableIOSAudio, enableAndroidAudio } from './VoiceModeManager';

function VoiceMode() {
  const { 
    startProtection, 
    stopProtection, 
    isProtected, 
    protectionStatus 
  } = useVoiceModeProtection();

  const handleStartVoice = async () => {
    // Enable mobile audio first
    enableIOSAudio();
    enableAndroidAudio();

    // Start protection
    const success = await startProtection({
      title: 'AyuTalks Voice Mode',
      artist: 'Ayu',
      artwork: [{ src: '/ayu-icon.png', sizes: '512x512', type: 'image/png' }]
    });

    if (success) {
      console.log('Voice mode protected from screen lock');
      console.log('Status:', protectionStatus);
      // Now start your actual voice recording/playback
    } else {
      console.error('Failed to protect voice mode');
      // Show user warning that it might stop on screen lock
    }
  };

  const handleStopVoice = async () => {
    await stopProtection();
    // Stop your voice recording/playback
  };

  return (
    <div>
      <button onClick={handleStartVoice}>
        Start Voice Mode {isProtected && '🔒'}
      </button>
      <button onClick={handleStopVoice}>
        Stop Voice Mode
      </button>
    </div>
  );
}
*/