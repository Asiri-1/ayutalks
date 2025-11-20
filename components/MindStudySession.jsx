import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function MindStudySession({ userId, conversationId, autoStart, onSessionStateChange }) {
  const [showDurationModal, setShowDurationModal] = useState(autoStart || false);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    checkActiveSession();
  }, [userId, conversationId]);

  useEffect(() => {
    if (activeSession && !activeSession.is_completed) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
        setSessionTime(elapsed);
        
        if (elapsed >= activeSession.duration_minutes * 60) {
          handleCompleteSession();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const checkActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .eq('is_completed', false)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setActiveSession(data);
        if (onSessionStateChange) {
          onSessionStateChange(true, data);
        }
      }
    } catch (error) {
      console.log('No active session found');
    }
  };

  const handleStartSession = () => {
    setShowDurationModal(true);
  };

  const handleSelectDuration = async (minutes) => {
    setLoading(true);
    try {
      console.log(`Starting ${minutes}-minute Mechanics session...`);
      
      const { data: newSession, error } = await supabase
        .from('active_sessions')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          duration_minutes: minutes,
          phase: 'grounding',
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          is_completed: false,
          user_responses_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSession(newSession);
      setShowDurationModal(false);
      
      if (onSessionStateChange) {
        onSessionStateChange(true, newSession);
      }
      
      console.log('✅ Session started:', newSession.id);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;

    try {
      // Update active session
      const { error: updateError } = await supabase
        .from('active_sessions')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', activeSession.id);

      if (updateError) throw updateError;

      // Copy to history
      const { error: historyError } = await supabase
        .from('session_history')
        .insert({
          user_id: activeSession.user_id,
          conversation_id: activeSession.conversation_id,
          duration_minutes: activeSession.duration_minutes,
          started_at: activeSession.started_at,
          completed_at: new Date().toISOString(),
          is_completed: true,
          user_responses_count: activeSession.user_responses_count,
          insights_recorded: 0
        });

      if (historyError) throw historyError;

      console.log('✅ Session completed');
      setActiveSession(null);
      setSessionTime(0);
      
      if (onSessionStateChange) {
        onSessionStateChange(false, null);
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (!activeSession) return 0;
    const totalSeconds = activeSession.duration_minutes * 60;
    return Math.min((sessionTime / totalSeconds) * 100, 100);
  };

  const getPhaseLabel = () => {
    if (!activeSession) return '';
    const progress = getProgress();
    if (progress < 25) return 'Grounding';
    if (progress < 75) return 'Exploration';
    return 'Integration';
  };

  if (activeSession && !activeSession.is_completed) {
    return (
      <div style={styles.activeSessionContainer}>
        <div style={styles.sessionHeader}>
          <div style={styles.sessionInfo}>
            <span style={styles.sessionIcon}>🧠</span>
            <div style={styles.sessionDetails}>
              <div style={styles.sessionTitle}>Mechanics Session Active</div>
              <div style={styles.sessionPhase}>{getPhaseLabel()} Phase</div>
            </div>
          </div>
          <div style={styles.sessionTimer}>
            {formatTime(sessionTime)} / {activeSession.duration_minutes}:00
          </div>
        </div>
        
        <div style={styles.progressBarContainer}>
          <div style={{...styles.progressBar, width: `${getProgress()}%`}} />
        </div>
        
        <button
          onClick={handleCompleteSession}
          style={styles.endSessionButton}
        >
          Complete Session
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleStartSession}
        style={styles.sessionButton}
        disabled={loading}
      >
        🧠 Start Mechanics Session
      </button>

      {showDurationModal && (
        <div style={styles.modalOverlay} onClick={() => setShowDurationModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Choose Session Duration</h3>
            <p style={styles.modalSubtitle}>Mechanics of Mind</p>
            
            <div style={styles.durationGrid}>
              {[
                { minutes: 20, label: 'Quick' },
                { minutes: 30, label: 'Standard' },
                { minutes: 45, label: 'Deep' },
                { minutes: 60, label: 'Complete' }
              ].map(({ minutes, label }) => (
                <button
                  key={minutes}
                  onClick={() => handleSelectDuration(minutes)}
                  style={styles.durationButton}
                  disabled={loading}
                >
                  <div style={styles.durationTime}>{minutes} min</div>
                  <div style={styles.durationLabel}>{label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowDurationModal(false)}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  sessionButton: {
    width: '100%',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: 'clamp(0.95rem, 2.5vw, 1rem)',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  activeSessionContainer: {
    width: '100%',
    padding: '1rem',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: '15px',
    border: '2px solid rgba(102, 126, 234, 0.3)',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  sessionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  sessionIcon: {
    fontSize: '1.5rem',
  },
  sessionDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  sessionTitle: {
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: '600',
  },
  sessionPhase: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.85rem',
  },
  sessionTimer: {
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s ease',
  },
  endSessionButton: {
    width: '100%',
    padding: '0.5rem',
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#667eea',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '2rem',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  modalTitle: {
    fontSize: 'clamp(1.3rem, 4vw, 1.6rem)',
    color: '#333',
    marginBottom: '0.5rem',
    textAlign: 'center',
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
    color: '#667eea',
    marginBottom: '1.5rem',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  durationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  durationButton: {
    padding: '1.5rem 1rem',
    backgroundColor: '#f8f9fa',
    border: '2px solid #e0e0e0',
    borderRadius: '15px',
    cursor: 'pointer',
    textAlign: 'center',
  },
  durationTime: {
    fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: '0.5rem',
  },
  durationLabel: {
    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
    color: '#666',
    fontWeight: '500',
  },
  cancelButton: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'transparent',
    color: '#666',
    border: '2px solid #ddd',
    borderRadius: '15px',
    fontSize: 'clamp(0.95rem, 2.5vw, 1rem)',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
