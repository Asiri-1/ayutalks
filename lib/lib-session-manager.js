// ================================================
// MIND MECHANICS SESSIONS - Complete Session Manager
// Integrates: Existing session logic + 5-Stage Mastery System
// ================================================

import { createClient } from '@supabase/supabase-js';
import {
  MASTERY_STAGES,
  STAGE_PERCENTAGES,
  CONCEPTS,
  validateGlimpse,
  validateArticulation,
  validateRecognition,
  validateApplication,
  validateEmbodiment,
  checkMasteryDecay,
  updateMasteryStage,
  getUserMastery,
  getAllUserMastery,
  getValidationQuestion,
  shouldCheckDecay
} from './lib-concept-mastery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ================================================
// SESSION PHASES (PRESERVED FROM ORIGINAL)
// ================================================
export const SESSION_PHASES = {
  GROUNDING: 'grounding',
  EXPLORATION: 'exploration',
  INTEGRATION: 'integration'
};

// ================================================
// SESSION DURATIONS (UPGRADED: Now flexible!)
// ================================================
export const SESSION_DURATIONS = [
  { minutes: 20, label: '20 min', subtitle: 'Quick insight' },
  { minutes: 30, label: '30 min', subtitle: 'Deeper exploration' },
  { minutes: 45, label: '45 min', subtitle: 'Thorough session' },
  { minutes: 60, label: '60 min', subtitle: 'Complete journey' }
];

// Phase duration percentages (apply to any total duration)
const PHASE_PERCENTAGES = {
  [SESSION_PHASES.GROUNDING]: 0.25,    // 25%
  [SESSION_PHASES.EXPLORATION]: 0.50,  // 50%
  [SESSION_PHASES.INTEGRATION]: 0.25   // 25%
};

// ================================================
// SESSION CONFIGURATION (PRESERVED)
// ================================================
export const SESSION_CONFIG = {
  MIN_DURATION_TO_COUNT: 300,      // 5 minutes minimum
  MIN_EXCHANGES_TO_COUNT: 3,       // At least 3 user responses
  TIMEOUT_THRESHOLD: 600,          // 10 minutes inactivity = timeout
  FREE_SESSION_LIMIT: 3,           // 3 free sessions for non-premium
};

// ================================================
// CHECK SESSION ELIGIBILITY (PRESERVED)
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
// START SESSION (UPGRADED with Mastery)
// ================================================
export async function startSession(userId, conversationId, durationMinutes = 20) {
  try {
    // Check eligibility first (PRESERVED)
    const eligibility = await checkSessionEligibility(userId);
    if (!eligibility.canStart) {
      return {
        success: false,
        reason: eligibility.reason,
        sessionsRemaining: eligibility.sessionsLimit - eligibility.sessionsUsed
      };
    }
    
    // NEW: Get user's current mastery levels
    const userMastery = await getAllUserMastery(supabase, userId);
    
    // NEW: Select concepts to focus on based on mastery
    const focusConcepts = selectConceptsForSession(userMastery);
    
    // NEW: Calculate phase durations based on selected duration
    const phaseDurations = calculatePhaseDurations(durationMinutes);
    
    // Create new session with mastery tracking
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
        user_responses_count: 0,
        duration_minutes: durationMinutes,           // NEW
        focus_concepts: focusConcepts,               // NEW
        phase_durations: phaseDurations,             // NEW
        mastery_progress: {}                          // NEW
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      sessionId: session.id,
      startedAt: session.started_at,
      phase: session.current_phase,
      durationMinutes: durationMinutes,              // NEW
      focusConcepts: focusConcepts                   // NEW
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
// GET ACTIVE SESSION (UPGRADED)
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
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!session) return null;
    
    // Calculate current elapsed time
    const startedAt = new Date(session.started_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startedAt) / 1000);
    
    // Determine current phase based on elapsed time and duration
    const phase = determinePhase(elapsedSeconds, session.duration_minutes || 20);
    
    return {
      sessionId: session.id,
      conversationId: session.conversation_id,
      startedAt: session.started_at,
      elapsedSeconds: elapsedSeconds,
      phase: phase,
      questionsAsked: session.questions_asked_by_ayu,
      userResponses: session.user_responses_count,
      isActive: session.is_active,
      durationMinutes: session.duration_minutes || 20,     // NEW
      focusConcepts: session.focus_concepts || [],         // NEW
      phaseDurations: session.phase_durations || null,     // NEW
      masteryProgress: session.mastery_progress || {}      // NEW
    };
  } catch (error) {
    console.error('Error getting active session:', error);
    return null;
  }
}

// ================================================
// UPDATE SESSION ACTIVITY (PRESERVED)
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
// INCREMENT COUNTERS (PRESERVED)
// ================================================
export async function incrementAyuQuestion(sessionId) {
  try {
    const { data: session } = await supabase
      .from('active_sessions')
      .select('questions_asked_by_ayu')
      .eq('id', sessionId)
      .single();
    
    if (!session) throw new Error('Session not found');
    
    const { error } = await supabase
      .from('active_sessions')
      .update({ 
        questions_asked_by_ayu: (session.questions_asked_by_ayu || 0) + 1,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error incrementing Ayu question:', error);
    return { success: false };
  }
}

export async function incrementUserResponse(sessionId) {
  try {
    const { data: session } = await supabase
      .from('active_sessions')
      .select('user_responses_count')
      .eq('id', sessionId)
      .single();
    
    if (!session) throw new Error('Session not found');
    
    const { error } = await supabase
      .from('active_sessions')
      .update({ 
        user_responses_count: (session.user_responses_count || 0) + 1,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error incrementing user response:', error);
    return { success: false };
  }
}

// ================================================
// END SESSION (PRESERVED)
// ================================================
export async function endSession(sessionId, reason = 'user_ended', rating = null, feedback = null) {
  try {
    const { data: session } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    const startedAt = new Date(session.started_at);
    const endedAt = new Date();
    const totalElapsedSeconds = Math.floor((endedAt - startedAt) / 1000);
    
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
// DETERMINE PHASE (UPGRADED for flexible durations)
// ================================================
export function determinePhase(elapsedSeconds, durationMinutes = 20) {
  const totalSeconds = durationMinutes * 60;
  const groundingEnd = totalSeconds * PHASE_PERCENTAGES[SESSION_PHASES.GROUNDING];
  const explorationEnd = groundingEnd + (totalSeconds * PHASE_PERCENTAGES[SESSION_PHASES.EXPLORATION]);
  
  if (elapsedSeconds < groundingEnd) {
    return SESSION_PHASES.GROUNDING;
  } else if (elapsedSeconds < explorationEnd) {
    return SESSION_PHASES.EXPLORATION;
  } else {
    return SESSION_PHASES.INTEGRATION;
  }
}

// ================================================
// NEW: CALCULATE PHASE DURATIONS
// ================================================
function calculatePhaseDurations(totalMinutes) {
  const totalSeconds = totalMinutes * 60;
  return {
    grounding: Math.round(totalSeconds * PHASE_PERCENTAGES[SESSION_PHASES.GROUNDING]),
    exploration: Math.round(totalSeconds * PHASE_PERCENTAGES[SESSION_PHASES.EXPLORATION]),
    integration: Math.round(totalSeconds * PHASE_PERCENTAGES[SESSION_PHASES.INTEGRATION])
  };
}

// ================================================
// GET SESSION MESSAGES (PRESERVED)
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
// RECORD SESSION INSIGHT (PRESERVED)
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
// TRACK SESSION CONCEPT (PRESERVED - works with mastery)
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
// RECORD SESSION ANALYTICS (PRESERVED)
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
// GET USER SESSION HISTORY (PRESERVED)
// ================================================
export async function getUserSessionHistory(userId, limit = 10) {
  try {
    const { data: sessions, error } = await supabase
      .from('active_sessions')
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
// GET SESSION STATS (PRESERVED)
// ================================================
export async function getSessionStats(userId) {
  try {
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
    
    const totalSessions = sessions.length;
    const totalSeconds = sessions.reduce((sum, s) => sum + (s.time_elapsed_seconds || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    
    const ratings = sessions.filter(s => s.user_rating).map(s => s.user_rating);
    const averageRating = ratings.length > 0 
      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
      : 0;
    
    const currentStreak = calculateStreak(sessions);
    
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
// CALCULATE STREAK (PRESERVED)
// ================================================
function calculateStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;
  
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
// CHECK FOR ABANDONED SESSIONS (PRESERVED)
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
// FORMAT TIME DISPLAY (PRESERVED)
// ================================================
export function formatSessionTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function getTimeRemaining(elapsedSeconds, durationMinutes = 20) {
  const totalSeconds = durationMinutes * 60;
  const remaining = totalSeconds - elapsedSeconds;
  return Math.max(0, remaining);
}

export function getPhaseProgress(elapsedSeconds, phase, durationMinutes = 20) {
  const totalSeconds = durationMinutes * 60;
  const phaseDuration = totalSeconds * PHASE_PERCENTAGES[phase];
  
  let phaseStart = 0;
  if (phase === SESSION_PHASES.EXPLORATION) {
    phaseStart = totalSeconds * PHASE_PERCENTAGES[SESSION_PHASES.GROUNDING];
  } else if (phase === SESSION_PHASES.INTEGRATION) {
    phaseStart = totalSeconds * (
      PHASE_PERCENTAGES[SESSION_PHASES.GROUNDING] + 
      PHASE_PERCENTAGES[SESSION_PHASES.EXPLORATION]
    );
  }
  
  const phaseElapsed = elapsedSeconds - phaseStart;
  const progress = Math.min(100, (phaseElapsed / phaseDuration) * 100);
  
  return Math.max(0, progress);
}

// ================================================
// NEW: 5-STAGE MASTERY TRACKING
// ================================================

/**
 * Process user message and check for mastery progression
 */
export async function processMessageForMastery(userId, userMessage, focusConcepts, conversationContext) {
  const masteryUpdates = [];

  for (const conceptKey of focusConcepts) {
    const currentMastery = await getUserMastery(supabase, userId, conceptKey);
    const currentStage = currentMastery?.mastery_stage || 0;

    // Check for progression based on current stage
    let progressionResult = null;

    if (currentStage === 0 || currentStage === 1) {
      progressionResult = await validateGlimpse(userMessage, conceptKey, conversationContext);
      if (progressionResult) {
        await updateMasteryStage(supabase, userId, conceptKey, MASTERY_STAGES.GLIMPSE, progressionResult.evidence);
        masteryUpdates.push({
          concept: conceptKey,
          newStage: MASTERY_STAGES.GLIMPSE,
          stageName: 'Glimpse',
          percentage: 20,
          evidence: progressionResult.evidence
        });
      }
    }

    if (currentStage === 1 || currentStage === 2) {
      progressionResult = await validateArticulation(userMessage, conceptKey, conversationContext);
      if (progressionResult) {
        await updateMasteryStage(supabase, userId, conceptKey, MASTERY_STAGES.ARTICULATION, progressionResult.evidence);
        masteryUpdates.push({
          concept: conceptKey,
          newStage: MASTERY_STAGES.ARTICULATION,
          stageName: 'Articulation',
          percentage: 40,
          evidence: progressionResult.evidence
        });
      }
    }
  }

  return masteryUpdates;
}

/**
 * Check for cross-session mastery progression
 */
export async function checkCrossSessionMastery(userId, userMessage, allTrackedConcepts) {
  const masteryUpdates = [];

  for (const conceptKey of allTrackedConcepts) {
    const currentMastery = await getUserMastery(supabase, userId, conceptKey);
    const currentStage = currentMastery?.mastery_stage || 0;

    if (currentStage === 0 || currentStage === 5) continue;

    if (shouldCheckDecay(currentMastery.last_demonstrated, currentStage)) {
      const decayResult = await checkMasteryDecay(userMessage, conceptKey, currentStage);
      if (decayResult) {
        const newStage = Math.max(0, currentStage - 1);
        await updateMasteryStage(supabase, userId, conceptKey, newStage, 'Understanding decayed');
        masteryUpdates.push({
          concept: conceptKey,
          newStage: newStage,
          percentage: STAGE_PERCENTAGES[newStage],
          type: 'decay'
        });
        continue;
      }
    }

    if (currentStage >= 2) {
      const recognitionResult = await validateRecognition(userMessage, conceptKey);
      if (recognitionResult && currentStage < MASTERY_STAGES.RECOGNITION) {
        await updateMasteryStage(supabase, userId, conceptKey, MASTERY_STAGES.RECOGNITION, recognitionResult.evidence);
        masteryUpdates.push({
          concept: conceptKey,
          newStage: MASTERY_STAGES.RECOGNITION,
          percentage: 70,
          type: 'progression'
        });
      }
    }

    if (currentStage >= 3) {
      const applicationResult = await validateApplication(userMessage, conceptKey);
      if (applicationResult && currentStage < MASTERY_STAGES.APPLICATION) {
        await updateMasteryStage(supabase, userId, conceptKey, MASTERY_STAGES.APPLICATION, applicationResult.evidence);
        masteryUpdates.push({
          concept: conceptKey,
          newStage: MASTERY_STAGES.APPLICATION,
          percentage: 90,
          type: 'progression'
        });
      }
    }

    if (currentStage >= 4) {
      const embodimentResult = await validateEmbodiment(userMessage, conceptKey);
      if (embodimentResult && currentStage < MASTERY_STAGES.EMBODIMENT) {
        await updateMasteryStage(supabase, userId, conceptKey, MASTERY_STAGES.EMBODIMENT, embodimentResult.evidence);
        masteryUpdates.push({
          concept: conceptKey,
          newStage: MASTERY_STAGES.EMBODIMENT,
          percentage: 100,
          type: 'progression'
        });
      }
    }
  }

  return masteryUpdates;
}

/**
 * Should inject validation question?
 */
export function shouldInjectValidationQuestion(activeSession, conceptKey, currentMasteryStage) {
  const lastQuestion = activeSession.last_validation_question;
  if (lastQuestion) {
    const minutesSinceLastQuestion = (Date.now() - new Date(lastQuestion).getTime()) / 60000;
    if (minutesSinceLastQuestion < 3) return false;
  }

  if (currentMasteryStage <= 2) {
    return Math.random() < 0.3;
  }

  return false;
}

// ================================================
// NEW: CONCEPT SELECTION FOR SESSION
// ================================================
function selectConceptsForSession(userMastery) {
  const easyLowMastery = [];
  const mediumLowMastery = [];
  const hardLowMastery = [];

  Object.entries(CONCEPTS).forEach(([key, concept]) => {
    const mastery = userMastery.find(m => m.concept_key === key);
    const stage = mastery?.mastery_stage || 0;

    if (stage < 5) {
      if (concept.difficulty <= 2) {
        easyLowMastery.push({ key, stage, difficulty: concept.difficulty });
      } else if (concept.difficulty <= 3) {
        mediumLowMastery.push({ key, stage, difficulty: concept.difficulty });
      } else {
        hardLowMastery.push({ key, stage, difficulty: concept.difficulty });
      }
    }
  });

  [easyLowMastery, mediumLowMastery, hardLowMastery].forEach(group => {
    group.sort((a, b) => a.stage - b.stage);
  });

  const selected = [];

  if (easyLowMastery.length > 0) {
    selected.push(easyLowMastery[0].key);
  }

  if (mediumLowMastery.length > 0) {
    selected.push(mediumLowMastery[0].key);
  }

  if (hardLowMastery.length > 0 && selected.length < 3) {
    const userHasSomeProgress = userMastery.some(m => m.mastery_stage >= 3);
    if (userHasSomeProgress) {
      selected.push(hardLowMastery[0].key);
    }
  }

  while (selected.length < 2) {
    if (easyLowMastery.length > selected.filter(s => 
      CONCEPTS[s].difficulty <= 2).length) {
      const next = easyLowMastery[selected.filter(s => 
        CONCEPTS[s].difficulty <= 2).length];
      if (next) selected.push(next.key);
    } else if (mediumLowMastery.length > selected.filter(s => 
      CONCEPTS[s].difficulty === 3).length) {
      const next = mediumLowMastery[selected.filter(s => 
        CONCEPTS[s].difficulty === 3).length];
      if (next) selected.push(next.key);
    } else {
      break;
    }
  }

  return selected.slice(0, 3);
}

export default {
  SESSION_PHASES,
  SESSION_DURATIONS,
  SESSION_CONFIG,
  checkSessionEligibility,
  startSession,
  getActiveSession,
  updateSessionActivity,
  incrementAyuQuestion,
  incrementUserResponse,
  endSession,
  determinePhase,
  getSessionMessages,
  recordInsight,
  trackSessionConcept,
  recordSessionAnalytics,
  getUserSessionHistory,
  getSessionStats,
  checkAbandonedSessions,
  formatSessionTime,
  getTimeRemaining,
  getPhaseProgress,
  processMessageForMastery,
  checkCrossSessionMastery,
  shouldInjectValidationQuestion
};