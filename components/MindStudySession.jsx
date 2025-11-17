// ================================================
// MindStudySession - TESTING MODE (No Limits)
// ================================================
// Session limits hidden - unlimited sessions for testing

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function MindStudySession({ 
  userId, 
  conversationId, 
  onSessionStateChange,
  isPremium = false 
}) {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    checkForActiveSession();
  }, [userId]);

  const checkForActiveSession = async () => {
    try {
      const { data: existingSession, error: checkError } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingSession) {
        console.log('✅ Resuming existing session:', existingSession.id);
        setSessionData(existingSession);
        setSessionActive(true);
        onSessionStateChange?.(true, existingSession);
      }
    } catch (err) {
      console.error('Failed to check for active session:', err);
    }
  };

  const startSession = async () => {
    try {
      setError(null);

      // Check if already has active session
      const { data: existingSession, error: checkError } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingSession) {
        console.log('✅ Resuming existing session:', existingSession.id);
        setSessionData(existingSession);
        setSessionActive(true);
        onSessionStateChange?.(true, existingSession);
        return;
      }

      // Create new session (NO LIMIT CHECKING - TESTING MODE)
      console.log('🧘 Creating new session (TESTING MODE - No limits)');
      
      const { data: newSession, error: createError } = await supabase
        .from('active_sessions')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          is_active: true,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          current_phase: 'grounding',
          target_duration_seconds: 1200, // 20 minutes
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;

      console.log('✅ Session started:', newSession.id);
      setSessionData(newSession);
      setSessionActive(true);
      onSessionStateChange?.(true, newSession);

    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Could not start session. Please try again.');
    }
  };

  const endSession = async () => {
    if (!sessionData) return;

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('active_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          end_reason: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionData.id)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      console.log('✅ Session ended:', sessionData.id);
      setSessionData(null);
      setSessionActive(false);
      onSessionStateChange?.(false, null);

    } catch (err) {
      console.error('Failed to end session:', err);
      setError('Could not end session');
    }
  };

  // Show error state
  if (error) {
    return (
      <div style={styles.container}>
        <button disabled style={styles.buttonDisabled}>
          {error}
        </button>
      </div>
    );
  }

  // Active session state
  if (sessionActive && sessionData) {
    return (
      <div style={styles.container}>
        <button onClick={endSession} style={styles.buttonActive}>
          🧘 Session Active - Tap to End
        </button>
        <div style={styles.info}>
          Phase: {sessionData.current_phase || 'grounding'}
        </div>
      </div>
    );
  }

  // Ready to start state (NO LIMIT INFO SHOWN)
  return (
    <div style={styles.container}>
      <button onClick={startSession} style={styles.button}>
        🧘 Start Mind Study Session (20 min)
      </button>
      {/* REMOVED: Session remaining info - testing mode */}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    color: '#667eea',
    border: 'none',
    padding: '1rem',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 'clamp(0.95rem, 3vw, 1rem)',
    transition: 'all 0.2s',
    width: '100%',
  },
  buttonActive: {
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    padding: '1rem',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 'clamp(0.95rem, 3vw, 1rem)',
    transition: 'all 0.2s',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    color: '#999',
    border: 'none',
    padding: '1rem',
    borderRadius: '25px',
    cursor: 'not-allowed',
    fontWeight: '600',
    fontSize: 'clamp(0.95rem, 3vw, 1rem)',
    width: '100%',
  },
  info: {
    textAlign: 'center',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.8)',
  },
};
