// ================================================
// MIND STUDY SESSIONS - State Manager
// ================================================
// Purpose: Manage session lifecycle, state, and persistence
// Safe integration: Works alongside existing chat functionality

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ================================================
// SESSION PHASES
// ================================================
export const SESSION_PHASES = {
  GROUNDING: 'grounding',     // 0-5 min: Connect to present, identify state
  EXPLORATION: 'exploration',  // 5-15 min: Deep inquiry, reveal patterns
  INTEGRATION: 'integration'   // 15-20 min: Consolidate learning, takeaways
};

export const PHASE_DURATIONS = {
  [SESSION_PHASES.GROUNDING]: 300,      // 5 minutes
  [SESSION_PHASES.EXPLORATION]: 600,    // 10 minutes
  [SESSION_PHASES.INTEGRATION]: 300     // 5 minutes
};

// ================================================
// SESSION CONFIGURATION
// ================================================
export const SESSION_CONFIG = {
  TARGET_DURATION: 1200,           // 20 minutes
  MIN_DURATION_TO_COUNT: 300,      // 5 minutes minimum
  MIN_EXCHANGES_TO_COUNT: 3,       // At least 3 user responses
  TIMEOUT_THRESHOLD: 600,          // 10 minutes inactivity = timeout
  FREE_SESSION_LIMIT: 3,           // 3 free sessions for non-premium
};

// ================================================
// CHECK SESSION ELIGIBILITY
// ================================================
export async function checkSessionEligibility(userId) {
  try {
    const { data, error } = await supabase
      .rpc('check_session_eligibility', { p_user_id: userId });
    
    if (error) throw error;
    
    return {
      canStart: data[0].can_start_session,
      reason: data[0].reason,
      sessionsUsed: data[0].sessions_used,
      sessionsLimit: data[0].sessions_limit
    };
  } catch (error) {
    console.error('Error checking session eligibility:', error);
    return {
      canStart: false,
      reason: 'Error checking eligibility',
      sessionsUsed: 0,
      sessionsLimit: 3
    };
  }
}

// ================================================
// START SESSION
// ================================================
export async function startSession(userId, conversationId) {
  try {
    // Check eligibility first
    const eligibility = await checkSessionEligibility(userId);
    if (!eligibility.canStart) {
      return {
        success: false,
        reason: eligibility.reason,
        sessionsRemaining: eligibility.sessionsLimit - eligibility.sessionsUsed
      };
    }
    
    // Create new session
    const { data: session, error } = await supabase
      .from('active_sessions')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        started_at: new Date().toISOString(),
        is_active: true,
        current_phase: SESSION_PHASES.GROUNDING,
        time_elapsed_seconds: 0,
        questions_asked_by_ayu: 0,
        user_responses_count: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      sessionId: session.id,
      startedAt: session.started_at,
      phase: session.current_phase
    };
  } catch (error) {
    console.error('Error starting session:', error);
    return {
      success: false,
      reason: 'Failed to start session'
    };
  }
}

// ================================================
// GET ACTIVE SESSION
// ================================================
export async function getActiveSession(userId) {
  try {
    const { data: session, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    
    if (!session) return null;
    
    // Calculate current elapsed time
    const startedAt = new Date(session.started_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startedAt) / 1000);
    
    // Determine current phase based on elapsed time
    const phase = determinePhase(elapsedSeconds);
    
    return {
      sessionId: session.id,
      conversationId: session.conversation_id,
      startedAt: session.started_at,
      elapsedSeconds: elapsedSeconds,
      phase: phase,
      questionsAsked: session.questions_asked_by_ayu,
      userResponses: session.user_responses_count,
      isActive: session.is_active
    };
  } catch (error) {
    console.error('Error getting active session:', error);
    return null;
  }
}

// ================================================
// UPDATE SESSION ACTIVITY
// ================================================
export async function updateSessionActivity(sessionId, updates = {}) {
  try {
    const updateData = {
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates
    };
    
    const { error } = await supabase
      .from('active_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('is_active', true);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating session activity:', error);
    return { success: false };
  }
}

// ================================================
// INCREMENT COUNTERS
// ================================================
export async function incrementAyuQuestion(sessionId) {
  return updateSessionActivity(sessionId, {
    questions_asked_by_ayu: supabase.rpc('increment', { 
      table: 'active_sessions',
      column: 'questions_asked_by_ayu',
      id: sessionId 
    })
  });
}

export async function incrementUserResponse(sessionId) {
  return updateSessionActivity(sessionId, {
    user_responses_count: supabase.rpc('increment', { 
      table: 'active_sessions',
      column: 'user_responses_count',
      id: sessionId 
    })
  });
}

// ================================================
// END SESSION
// ================================================
export async function endSession(sessionId, reason = 'user_ended', rating = null, feedback = null) {
  try {
    // Get session details for final calculations
    const { data: session } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Calculate final elapsed time
    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const totalElapsedSeconds = Math.floor((endedAt - startedAt) / 1000);
    
    // Update session
    const { error } = await supabase
      .from('active_sessions')
      .update({
        is_active: false,
        ended_at: endedAt.toISOString(),
        end_reason: reason,
        time_elapsed_seconds: totalElapsedSeconds,
        user_rating: rating,
        user_feedback: feedback,
        updated_at: endedAt.toISOString()
      })
      .eq('id', sessionId);
    
    if (error) throw error;
    
    return {
      success: true,
      duration: totalElapsedSeconds,
      reason: reason
    };
  } catch (error) {
    console.error('Error ending session:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ================================================
// DETERMINE PHASE
// ================================================
export function determinePhase(elapsedSeconds) {
  if (elapsedSeconds < PHASE_DURATIONS[SESSION_PHASES.GROUNDING]) {
    return SESSION_PHASES.GROUNDING;
  } else if (elapsedSeconds < PHASE_DURATIONS[SESSION_PHASES.GROUNDING] + PHASE_DURATIONS[SESSION_PHASES.EXPLORATION]) {
    return SESSION_PHASES.EXPLORATION;
  } else {
    return SESSION_PHASES.INTEGRATION;
  }
}

// ================================================
// GET SESSION MESSAGES
// ================================================
export async function getSessionMessages(sessionId) {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_session_message', true)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return messages || [];
  } catch (error) {
    console.error('Error getting session messages:', error);
    return [];
  }
}

// ================================================
// RECORD SESSION INSIGHT
// ================================================
export async function recordInsight(sessionId, insightData) {
  try {
    const { data, error } = await supabase
      .from('session_insights')
      .insert({
        session_id: sessionId,
        insight_text: insightData.text,
        insight_type: insightData.type || 'realization',
        confidence_score: insightData.confidence || 0.8,
        occurred_at_minute: insightData.minute,
        triggered_by_question: insightData.triggeredBy,
        related_concepts: insightData.concepts || []
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, insightId: data.id };
  } catch (error) {
    console.error('Error recording insight:', error);
    return { success: false };
  }
}

// ================================================
// TRACK SESSION CONCEPT
// ================================================
export async function trackSessionConcept(sessionId, conceptData) {
  try {
    const { data, error } = await supabase
      .from('session_concepts')
      .insert({
        session_id: sessionId,
        concept_name: conceptData.name,
        introduced_by: conceptData.introducedBy,
        depth_explored: conceptData.depth,
        mastery_before: conceptData.masteryBefore,
        mastery_after: conceptData.masteryAfter,
        mastery_delta: (conceptData.masteryAfter || 0) - (conceptData.masteryBefore || 0),
        user_demonstrated_understanding: conceptData.understood || false,
        needs_revisiting: conceptData.needsRevisit || false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, recordId: data.id };
  } catch (error) {
    console.error('Error tracking session concept:', error);
    return { success: false };
  }
}

// ================================================
// RECORD SESSION ANALYTICS
// ================================================
export async function recordSessionAnalytics(sessionId, analyticsData) {
  try {
    const { data, error } = await supabase
      .from('session_analytics')
      .insert({
        session_id: sessionId,
        ayu_messages_count: analyticsData.ayuMessages || 0,
        user_messages_count: analyticsData.userMessages || 0,
        avg_user_response_length: analyticsData.avgUserLength || 0,
        avg_ayu_response_length: analyticsData.avgAyuLength || 0,
        engagement_level: analyticsData.engagement || 'medium',
        user_initiated_deeper_exploration: analyticsData.userInitiated || false,
        session_flow_quality: analyticsData.flowQuality || 'focused',
        rag_queries_count: analyticsData.ragQueries || 0,
        avg_rag_response_time_ms: analyticsData.avgRagTime || 0,
        concepts_mapped_count: analyticsData.conceptsMapped || 0,
        input_tokens: analyticsData.inputTokens || 0,
        output_tokens: analyticsData.outputTokens || 0,
        estimated_cost_usd: analyticsData.estimatedCost || 0
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, analyticsId: data.id };
  } catch (error) {
    console.error('Error recording session analytics:', error);
    return { success: false };
  }
}

// ================================================
// GET USER SESSION HISTORY
// ================================================
export async function getUserSessionHistory(userId, limit = 10) {
  try {
    const { data: sessions, error } = await supabase
      .from('session_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', false)
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return sessions || [];
  } catch (error) {
    console.error('Error getting session history:', error);
    return [];
  }
}

// ================================================
// GET SESSION STATS
// ================================================
export async function getSessionStats(userId) {
  try {
    // Get all completed sessions
    const { data: sessions, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', false);
    
    if (error) throw error;
    
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalMinutes: 0,
        averageRating: 0,
        currentStreak: 0,
        conceptsExplored: 0
      };
    }
    
    // Calculate stats
    const totalSessions = sessions.length;
    const totalSeconds = sessions.reduce((sum, s) => sum + (s.time_elapsed_seconds || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    
    const ratings = sessions.filter(s => s.user_rating).map(s => s.user_rating);
    const averageRating = ratings.length > 0 
      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
      : 0;
    
    // Calculate streak (consecutive days with sessions)
    const currentStreak = calculateStreak(sessions);
    
    // Get unique concepts explored
    const { data: concepts } = await supabase
      .from('session_concepts')
      .select('concept_name')
      .in('session_id', sessions.map(s => s.id));
    
    const uniqueConcepts = new Set(concepts?.map(c => c.concept_name) || []);
    
    return {
      totalSessions,
      totalMinutes,
      averageRating,
      currentStreak,
      conceptsExplored: uniqueConcepts.size
    };
  } catch (error) {
    console.error('Error getting session stats:', error);
    return {
      totalSessions: 0,
      totalMinutes: 0,
      averageRating: 0,
      currentStreak: 0,
      conceptsExplored: 0
    };
  }
}

// ================================================
// CALCULATE STREAK
// ================================================
function calculateStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;
  
  // Sort by date descending
  const sorted = sessions
    .map(s => new Date(s.started_at))
    .sort((a, b) => b - a);
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const sessionDate of sorted) {
    const sessionDay = new Date(sessionDate);
    sessionDay.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((currentDate - sessionDay) / (1000 * 60 * 60 * 24));
    
    if (diffDays === streak) {
      streak++;
    } else if (diffDays > streak) {
      break;
    }
  }
  
  return streak;
}

// ================================================
// CHECK FOR ABANDONED SESSIONS
// ================================================
export async function checkAbandonedSessions() {
  try {
    const { error } = await supabase.rpc('mark_abandoned_sessions');
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error checking abandoned sessions:', error);
    return { success: false };
  }
}

// ================================================
// FORMAT TIME DISPLAY
// ================================================
export function formatSessionTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function getTimeRemaining(elapsedSeconds) {
  const remaining = SESSION_CONFIG.TARGET_DURATION - elapsedSeconds;
  return Math.max(0, remaining);
}

export function getPhaseProgress(elapsedSeconds, phase) {
  const phaseDuration = PHASE_DURATIONS[phase];
  
  let phaseStart = 0;
  if (phase === SESSION_PHASES.EXPLORATION) {
    phaseStart = PHASE_DURATIONS[SESSION_PHASES.GROUNDING];
  } else if (phase === SESSION_PHASES.INTEGRATION) {
    phaseStart = PHASE_DURATIONS[SESSION_PHASES.GROUNDING] + PHASE_DURATIONS[SESSION_PHASES.EXPLORATION];
  }
  
  const phaseElapsed = elapsedSeconds - phaseStart;
  const progress = Math.min(100, (phaseElapsed / phaseDuration) * 100);
  
  return Math.max(0, progress);
}