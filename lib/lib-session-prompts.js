// ================================================
// MIND STUDY SESSIONS - Adaptive Prompts
// ================================================
// Purpose: Generate intelligent, context-aware session prompts
// Adapts based on: phase, user mastery, previous insights, current state

import { SESSION_PHASES, PHASE_DURATIONS } from './lib-session-manager';

// ================================================
// CORE CONCEPTS (17 Buddhist Psychology Concepts)
// ================================================
export const CONCEPTS = {
  // Foundational
  FEELING_TONE: 'feeling_tone_drives_reaction',
  IMPERMANENCE: 'impermanence_constant_change',
  PRESENT_MOMENT: 'present_moment_awareness',
  
  // Intermediate
  WANTING_MECHANISM: 'wanting_mechanism',
  NOT_WANTING_MECHANISM: 'not_wanting_mechanism',
  WITNESSING: 'witnessing_vs_being_caught',
  ACCEPTANCE: 'acceptance_vs_resistance',
  
  // Advanced
  EGO_MECHANISM: 'ego_mechanism',
  NON_SELF: 'non_self_anatta',
  LETTING_GO: 'letting_go_release',
  EQUANIMITY: 'equanimity_balance',
  
  // Subtle
  CONDITIONING: 'conditioning_patterns',
  INTENTIONALITY: 'intentionality_choice',
  DEPENDENT_ORIGINATION: 'dependent_origination',
  EMPTINESS: 'emptiness_sunyata',
  CONSCIOUSNESS: 'consciousness_awareness',
  SUFFERING_CESSATION: 'suffering_cessation'
};

// ================================================
// CONCEPT DIFFICULTY LEVELS
// ================================================
const CONCEPT_LEVELS = {
  beginner: [
    CONCEPTS.PRESENT_MOMENT,
    CONCEPTS.FEELING_TONE,
    CONCEPTS.IMPERMANENCE
  ],
  intermediate: [
    CONCEPTS.WANTING_MECHANISM,
    CONCEPTS.NOT_WANTING_MECHANISM,
    CONCEPTS.WITNESSING,
    CONCEPTS.ACCEPTANCE,
    CONCEPTS.CONDITIONING
  ],
  advanced: [
    CONCEPTS.EGO_MECHANISM,
    CONCEPTS.NON_SELF,
    CONCEPTS.LETTING_GO,
    CONCEPTS.EQUANIMITY,
    CONCEPTS.INTENTIONALITY
  ],
  subtle: [
    CONCEPTS.DEPENDENT_ORIGINATION,
    CONCEPTS.EMPTINESS,
    CONCEPTS.CONSCIOUSNESS,
    CONCEPTS.SUFFERING_CESSATION
  ]
};

// ================================================
// GENERATE SESSION PROMPT
// ================================================
export function generateSessionPrompt({
  phase,
  elapsedSeconds,
  userConceptMastery,
  recentInsights,
  lastSessionConcepts,
  currentEmotionalState,
  sessionMessages
}) {
  // Identify unexplored or low-mastery concepts
  const conceptsToExplore = identifyConceptsToExplore(userConceptMastery);
  
  // Get phase-specific guidance
  const phaseGuidance = getPhaseGuidance(phase, elapsedSeconds);
  
  // Build context about user's journey
  const userContext = buildUserContext(userConceptMastery, recentInsights, lastSessionConcepts);
  
  // Generate the prompt
  const prompt = `You are Ayu, leading a 20-minute Mind Study Session.

${phaseGuidance}

${userContext}

CONCEPTS TO GUIDE TOWARD:
Primary focus: ${conceptsToExplore.primary.join(', ')}
Ready for deeper: ${conceptsToExplore.ready.join(', ') || 'None yet'}

IMPORTANT RULES:

1. **Ask Questions, Don't Lecture**
   - Use Socratic method
   - One question at a time
   - Build on their last answer
   - Let them discover, don't tell

2. **Use Their Life, Not Abstractions**
   - Reference their actual experiences
   - Use their own words and examples
   - Make it personal and immediate
   - Avoid Buddhist jargon (use: "pattern" not "samskara")

3. **Follow Natural Flow**
   - Start with what THEY bring up
   - Don't force concepts artificially
   - Guide toward unexplored concepts when natural bridges appear
   - If they have a breakthrough, slow down and explore it

4. **Detect Insight Moments**
   - Watch for: "Oh!", "I never noticed that", "Wow, that's...", "Huh, I see..."
   - When you detect insight, pause and deepen:
     * "What just clicked for you?"
     * "Can you say more about that?"
     * "Where else might this show up?"

5. **Casual Language Only**
   - Talk like a wise friend, not a teacher
   - Short sentences
   - No jargon: Use "noticing" not "vipassana", "patterns" not "karma"
   - Be warm and natural

6. **Progressive Depth**
   - Start surface (how they feel)
   - Go to patterns (when this happens...)
   - Reach essence (who's watching this happen?)
   - Match their readiness

EXAMPLES OF GOOD QUESTIONS:

Grounding:
- "How are you feeling right now?"
- "Where do you notice that in your body?"
- "What's been on your mind today?"

Exploration:
- "When did you first notice that feeling?"
- "What happened right before that?"
- "Can you feel how your mind jumped from X to Y?"
- "What would happen if you just... let it be there?"

Integration:
- "What did you notice about your mind today?"
- "Does this pattern show up elsewhere in your life?"
- "What shifts if you see it this way?"

BAD EXAMPLES (Never do this):
- "Let me explain the concept of..." ❌ (Don't lecture)
- "This is called dependent origination..." ❌ (No jargon)
- "1. First... 2. Second... 3. Third..." ❌ (No numbered lists)
- Giving advice on what to do ❌ (Guide inquiry, don't solve)

YOUR GOAL: 
Help them SEE how their own mind works through questions and natural exploration.
They already have the answers - you're helping them notice what's already there.

CURRENT SESSION STATE:
- Time: ${Math.floor(elapsedSeconds / 60)} minutes in
- Phase: ${phase}
- Messages exchanged: ${sessionMessages?.length || 0}

Begin your next question or response now.`;

  return prompt;
}

// ================================================
// IDENTIFY CONCEPTS TO EXPLORE
// ================================================
function identifyConceptsToExplore(userConceptMastery = {}) {
  const concepts = {
    primary: [], // Should focus on (low mastery)
    ready: [],   // Ready for (medium mastery, can go deeper)
    mastered: [] // Already understood well
  };
  
  // Calculate mastery levels
  const masteryEntries = Object.entries(userConceptMastery)
    .map(([concept, level]) => ({ concept, level: level || 0 }))
    .sort((a, b) => a.level - b.level);
  
  for (const { concept, level } of masteryEntries) {
    if (level < 0.3) {
      concepts.primary.push(concept);
    } else if (level >= 0.3 && level < 0.7) {
      concepts.ready.push(concept);
    } else {
      concepts.mastered.push(concept);
    }
  }
  
  // If no primary concepts, suggest beginner concepts
  if (concepts.primary.length === 0) {
    concepts.primary = CONCEPT_LEVELS.beginner.filter(
      c => !concepts.mastered.includes(c)
    );
  }
  
  // Limit to top 3-5 concepts
  concepts.primary = concepts.primary.slice(0, 3);
  concepts.ready = concepts.ready.slice(0, 2);
  
  return concepts;
}

// ================================================
// GET PHASE GUIDANCE
// ================================================
function getPhaseGuidance(phase, elapsedSeconds) {
  const minutesElapsed = Math.floor(elapsedSeconds / 60);
  const minutesRemaining = Math.floor((1200 - elapsedSeconds) / 60);
  
  const guidance = {
    [SESSION_PHASES.GROUNDING]: `
CURRENT PHASE: GROUNDING (Minutes 0-5) - ${minutesElapsed} min in

Your goal: Connect them to the present moment, identify current mental state.

Approach:
- Start with "How are you feeling right now?"
- Listen deeply to their answer
- Ask about body sensations ("Where do you feel that?")
- Ground them in concrete, immediate experience
- Build safety and trust
- Identify entry point for exploration

This is setup for the whole session - be present and warm.`,

    [SESSION_PHASES.EXPLORATION]: `
CURRENT PHASE: EXPLORATION (Minutes 5-15) - ${minutesElapsed} min in

Your goal: Guide deep inquiry to reveal patterns.

Approach:
- Build on what they shared in grounding
- Ask probing questions about their experience
- Look for patterns: "When else does this happen?"
- Help them see cause-effect in their mind
- Point to automatic reactions they don't usually notice
- Introduce relevant concepts naturally through their examples
- When insight emerges, pause and deepen it

This is the heart of the session - stay curious and attentive.`,

    [SESSION_PHASES.INTEGRATION]: `
CURRENT PHASE: INTEGRATION (Final 5 minutes) - ${minutesRemaining} min remaining

Your goal: Consolidate learning and prepare them to take it into life.

Approach:
- "What did you notice about your mind today?"
- Help them articulate their own understanding
- Connect today's exploration to broader patterns
- Ask how this might show up in their daily life
- Leave them with something to watch for
- Keep it simple and practical

Wrap up with clarity - they should leave with an insight they can use.`
  };
  
  return guidance[phase] || guidance[SESSION_PHASES.GROUNDING];
}

// ================================================
// BUILD USER CONTEXT
// ================================================
function buildUserContext(conceptMastery, recentInsights, lastSessionConcepts) {
  let context = 'USER CONTEXT:\n';
  
  // Mastery summary
  const masteryLevels = Object.entries(conceptMastery || {})
    .filter(([_, level]) => level > 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (masteryLevels.length > 0) {
    context += '\nConcepts they understand:\n';
    masteryLevels.forEach(([concept, level]) => {
      context += `- ${concept}: ${Math.round(level * 100)}%\n`;
    });
  } else {
    context += '\nThis appears to be a beginner - start with basics.\n';
  }
  
  // Recent insights
  if (recentInsights && recentInsights.length > 0) {
    context += '\nRecent insights from past sessions:\n';
    recentInsights.slice(0, 2).forEach(insight => {
      context += `- "${insight.text}"\n`;
    });
    context += '\nYou can reference or build on these if relevant.\n';
  }
  
  // Last session concepts
  if (lastSessionConcepts && lastSessionConcepts.length > 0) {
    context += `\nLast session explored: ${lastSessionConcepts.join(', ')}\n`;
    context += 'Consider: Continue deepening or explore something new?\n';
  }
  
  return context;
}

// ================================================
// GENERATE SESSION START MESSAGE
// ================================================
export function getSessionStartMessage(userName = null) {
  const greeting = userName ? `Hey ${userName}!` : 'Hey!';
  
  return `${greeting} Ready for 20 minutes together? I'll ask you some questions to help you see how your mind works. Sound good?`;
}

// ================================================
// GENERATE SESSION END MESSAGE
// ================================================
export function getSessionEndMessage(sessionDuration, conceptsExplored) {
  const minutes = Math.floor(sessionDuration / 60);
  
  let message = `That was a meaningful ${minutes} minutes. `;
  
  if (conceptsExplored && conceptsExplored.length > 0) {
    const conceptNames = conceptsExplored
      .map(c => c.replace(/_/g, ' '))
      .join(', ');
    message += `We explored ${conceptNames} together. `;
  }
  
  message += `What stood out most to you from our exploration today?`;
  
  return message;
}

// ================================================
// DETECT INSIGHT IN USER MESSAGE
// ================================================
export function detectInsightInMessage(message) {
  const insightMarkers = [
    /\b(oh|wow|huh|ah)\b.*\b(i see|i get|i understand|makes sense|i never|i didn't realize)\b/i,
    /\b(that's|thats)\b.*\b(interesting|fascinating|true|real|exactly)\b/i,
    /\bi never (noticed|thought|realized|saw)/i,
    /\bthat makes (sense|total sense)\b/i,
    /\bi can see (how|why|that)/i,
    /\bnow i (understand|see|get)/i,
    /\b(clicked|clicked for me|light bulb|revelation|realization)\b/i,
    /\b(pattern|always do|keep doing|tend to)\b/i
  ];
  
  const hasInsightMarker = insightMarkers.some(pattern => pattern.test(message));
  
  // Also check message length - real insights tend to be substantive
  const wordCount = message.trim().split(/\s+/).length;
  const isSubstantive = wordCount >= 10;
  
  return {
    detected: hasInsightMarker && isSubstantive,
    confidence: hasInsightMarker && isSubstantive ? 0.8 : hasInsightMarker ? 0.5 : 0.2,
    type: determineInsightType(message)
  };
}

// ================================================
// DETERMINE INSIGHT TYPE
// ================================================
function determineInsightType(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('always') || lowerMessage.includes('pattern') || lowerMessage.includes('every time')) {
    return 'pattern_recognition';
  }
  
  if (lowerMessage.includes('never noticed') || lowerMessage.includes('first time')) {
    return 'new_awareness';
  }
  
  if (lowerMessage.includes('connected') || lowerMessage.includes('related') || lowerMessage.includes('because')) {
    return 'connection';
  }
  
  if (lowerMessage.includes('oh') || lowerMessage.includes('wow') || lowerMessage.includes('clicked')) {
    return 'breakthrough';
  }
  
  return 'realization';
}

// ================================================
// DETERMINE ENGAGEMENT LEVEL
// ================================================
export function determineEngagementLevel(messages) {
  if (!messages || messages.length === 0) return 'low';
  
  const userMessages = messages.filter(m => m.role === 'user');
  
  // Calculate average response length
  const totalWords = userMessages.reduce((sum, m) => {
    return sum + (m.content?.trim().split(/\s+/).length || 0);
  }, 0);
  const avgWords = totalWords / Math.max(userMessages.length, 1);
  
  // Check for substantive responses
  const substantiveResponses = userMessages.filter(m => 
    m.content?.trim().split(/\s+/).length >= 10
  ).length;
  const substantiveRatio = substantiveResponses / Math.max(userMessages.length, 1);
  
  // Determine level
  if (avgWords >= 20 && substantiveRatio >= 0.6) {
    return 'high';
  } else if (avgWords >= 10 && substantiveRatio >= 0.4) {
    return 'medium';
  } else {
    return 'low';
  }
}

// ================================================
// GENERATE FOLLOW-UP QUESTION FOR INSIGHT
// ================================================
export function generateInsightFollowUp(insightType) {
  const followUps = {
    pattern_recognition: [
      "What else follows this same pattern?",
      "When else do you notice this happening?",
      "Can you feel how automatic that pattern is?"
    ],
    new_awareness: [
      "What just shifted for you?",
      "What does it feel like to see that for the first time?",
      "How does noticing this change anything?"
    ],
    connection: [
      "Say more about that connection.",
      "What else is connected to this?",
      "Can you trace back further - what comes before that?"
    ],
    breakthrough: [
      "Take a moment - what just clicked?",
      "That's significant. What does that mean for you?",
      "Can you put into words what you're seeing?"
    ],
    realization: [
      "Tell me more about that.",
      "What led you to see that?",
      "How might this understanding be useful?"
    ]
  };
  
  const options = followUps[insightType] || followUps.realization;
  return options[Math.floor(Math.random() * options.length)];
}

// ================================================
// CHECK IF SHOULD ASK FOR RATING
// ================================================
export function shouldAskForRating(lastMessage, sessionEnded) {
  if (!sessionEnded) return false;
  
  // After session ends and user responds to end message, ask for rating
  const endPhrases = [
    /stood out/i,
    /what did you notice/i,
    /what insight/i,
    /exploration today/i
  ];
  
  return endPhrases.some(phrase => phrase.test(lastMessage));
}

// ================================================
// GENERATE RATING REQUEST
// ================================================
export function generateRatingRequest() {
  return "Before we finish - how would you rate today's Mind Study Session? (1-5 stars, where 5 is excellent)";
}

// ================================================
// EXPORT ALL
// ================================================
export default {
  generateSessionPrompt,
  getSessionStartMessage,
  getSessionEndMessage,
  detectInsightInMessage,
  determineEngagementLevel,
  generateInsightFollowUp,
  shouldAskForRating,
  generateRatingRequest,
  CONCEPTS,
  CONCEPT_LEVELS
};