// ================================================
// FIXED: MindStudySession Component (RLS Compatible)
// ================================================
// This version works with Row Level Security enabled

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function MindStudySession({ 
  userId, 
  conversationId, 
  onSessionStateChange,
  isPremium = false 
}) {
  const [eligibilityData, setEligibilityData] = useState(null);
  const [isEligible, setIsEligible] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);

  // Check eligibility on mount
  useEffect(() => {
    checkEligibility();
  }, [userId]);

  const checkEligibility = async () => {
    try {
      setCheckingEligibility(true);
      setError(null);

      // Call RPC function to check eligibility
      const { data, error } = await supabase.rpc('check_session_eligibility', {
        p_user_id: userId
      });

      if (error) {
        console.error('Eligibility check error:', error);
        throw error;
      }

      // RPC returns array, get first result
      const result = Array.isArray(data) ? data[0] : data;
      
      console.log('✅ Eligibility:', result);

      setEligibilityData(result);
      setIsEligible(result?.is_eligible || false);

    } catch (err) {
      console.error('Failed to check eligibility:', err);
      setError('Could not check session eligibility');
      // Default to eligible on error (graceful degradation)
      setIsEligible(true);
      setEligibilityData({
        is_eligible: true,
        sessions_used: 0,
        sessions_remaining: 3,
        is_premium: false,
        reason: 'error_defaulting_to_eligible'
      });
    } finally {
      setCheckingEligibility(false);
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
        .maybeSingle(); // Use maybeSingle instead of single to handle no results

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

      // Create new session
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
        .eq('user_id', userId); // RLS check

      if (updateError) throw updateError;

      console.log('✅ Session ended:', sessionData.id);
      setSessionData(null);
      setSessionActive(false);
      onSessionStateChange?.(false, null);
      
      // Refresh eligibility
      checkEligibility();

    } catch (err) {
      console.error('Failed to end session:', err);
      setError('Could not end session');
    }
  };

  // Show loading state
  if (checkingEligibility) {
    return (
      <div style={styles.container}>
        <button disabled style={styles.buttonDisabled}>
          Checking eligibility...
        </button>
      </div>
    );
  }

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

  // Not eligible state
  if (!isEligible) {
    return (
      <div style={styles.container}>
        <button disabled style={styles.buttonDisabled}>
          🔒 Session Limit Reached
        </button>
        <div style={styles.info}>
          {isPremium 
            ? 'Contact support for assistance' 
            : 'Upgrade to Premium for unlimited sessions'}
        </div>
      </div>
    );
  }

  // Ready to start state
  return (
    <div style={styles.container}>
      <button onClick={startSession} style={styles.button}>
        🧘 Start Mind Study Session (20 min)
      </button>
      <div style={styles.info}>
        {eligibilityData?.sessions_remaining} sessions remaining
      </div>
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
