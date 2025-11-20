// lib-concept-mastery.js
// 5-Stage Progressive Mastery System
// Tracks real understanding through: Glimpse → Articulation → Recognition → Application → Embodiment

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// MASTERY STAGES & SCORING
// ============================================

export const MASTERY_STAGES = {
  NONE: 0,           // 0% - No understanding
  GLIMPSE: 1,        // 20% - Saw it once in session
  ARTICULATION: 2,   // 40% - Can explain from experience
  RECOGNITION: 3,    // 70% - Notices without prompting
  APPLICATION: 4,    // 90% - Works with it skillfully
  EMBODIMENT: 5      // 100% - Fully integrated
};

export const STAGE_PERCENTAGES = {
  0: 0,
  1: 20,
  2: 40,
  3: 70,
  4: 90,
  5: 100
};

export const STAGE_NAMES = {
  0: 'No Understanding',
  1: 'Glimpse',
  2: 'Articulation',
  3: 'Recognition',
  4: 'Application',
  5: 'Embodiment'
};

// ============================================
// CONCEPT DEFINITIONS
// ============================================

export const CONCEPTS = {
  emotional_awareness: {
    name: 'Emotional Awareness',
    description: 'Recognizing emotions as they arise without being consumed by them',
    difficulty: 1
  },
  present_moment: {
    name: 'Present Moment Awareness',
    description: 'Being fully here now, not lost in past or future',
    difficulty: 1
  },
  witnessing_thoughts: {
    name: 'Witnessing Thoughts',
    description: 'Observing thoughts without identifying with them',
    difficulty: 2
  },
  body_awareness: {
    name: 'Body Awareness',
    description: 'Sensing physical sensations and body states directly',
    difficulty: 1
  },
  feeling_tone: {
    name: 'Feeling Tone Drives Reaction',
    description: 'Understanding how pleasant/unpleasant sensations trigger reactions',
    difficulty: 3
  },
  attachment: {
    name: 'Attachment Patterns',
    description: 'Seeing how we cling to people, outcomes, identities',
    difficulty: 3
  },
  craving: {
    name: 'Craving & Wanting',
    description: 'Noticing the pull toward pleasant experiences',
    difficulty: 2
  },
  aversion: {
    name: 'Aversion & Pushing Away',
    description: 'Seeing how we resist unpleasant experiences',
    difficulty: 2
  },
  delusion: {
    name: 'Delusion & Mental Constructs',
    description: 'Recognizing how mind creates stories that seem real',
    difficulty: 4
  },
  acceptance: {
    name: 'Acceptance vs Resignation',
    description: 'True acceptance that allows change, not passive giving up',
    difficulty: 3
  },
  letting_go: {
    name: 'Letting Go',
    description: 'Releasing grip on outcomes, identities, control',
    difficulty: 4
  },
  impermanence: {
    name: 'Impermanence',
    description: 'Everything changes - nothing stays the same',
    difficulty: 2
  },
  non_self: {
    name: 'Non-Self',
    description: 'The sense of fixed "me" is a construct',
    difficulty: 5
  },
  suffering_teacher: {
    name: 'Suffering as Teacher',
    description: 'Discomfort shows where we\'re clinging or resisting',
    difficulty: 3
  },
  ego_mechanism: {
    name: 'Ego Mechanism',
    description: 'How the mind maintains a sense of separate self',
    difficulty: 5
  },
  liberation: {
    name: 'Liberation Through Understanding',
    description: 'Freedom comes from seeing how mind creates suffering',
    difficulty: 5
  },
  unconditional_happiness: {
    name: 'Unconditional Happiness',
    description: 'Wellbeing not dependent on external conditions',
    difficulty: 5
  }
};

// ============================================
// VALIDATION QUESTIONS BY STAGE
// ============================================

export const VALIDATION_QUESTIONS = {
  // Stage 1: GLIMPSE - Did they see it once?
  GLIMPSE: {
    emotional_awareness: [
      "What are you feeling right now as we talk about this?",
      "Can you sense any emotion in your body at this moment?",
      "What's happening emotionally for you right now?"
    ],
    craving: [
      "Can you feel that pull or wanting as we discuss it?",
      "Is there any sense of wanting something different right now?",
      "What does the craving feel like in your body?"
    ],
    impermanence: [
      "Did that emotion stay the same intensity, or did it shift?",
      "Notice how your thoughts are changing even as we talk?",
      "Is your mood exactly the same as when we started?"
    ]
  },
  
  // Stage 2: ARTICULATION - Can they explain it?
  ARTICULATION: {
    emotional_awareness: [
      "What did you discover about how emotions work?",
      "Can you describe what you noticed in your own words?",
      "How would you explain what you just experienced?"
    ],
    craving: [
      "What did you notice about how craving arises?",
      "Can you describe the pattern you saw?",
      "What happens right before the wanting starts?"
    ],
    attachment: [
      "How does attachment show up in your experience?",
      "What did you notice about the feeling of holding on?",
      "Can you describe what attachment feels like for you?"
    ]
  },
  
  // Stage 3: RECOGNITION - Do they notice it without prompting?
  RECOGNITION: {
    emotional_awareness: [
      "Have you been catching emotions as they arise lately?",
      "Did you notice any emotional patterns since we last talked?",
      "Have you caught yourself becoming aware of feelings?"
    ],
    craving: [
      "Have you noticed craving showing up in your daily life?",
      "Did you catch yourself wanting something different?",
      "Have you seen that pull toward pleasant experiences?"
    ],
    impermanence: [
      "Have you been noticing how things change?",
      "Did you catch impermanence in action this week?",
      "Have you seen things shifting and passing?"
    ]
  },
  
  // Stage 4: APPLICATION - Are they working with it?
  APPLICATION: {
    emotional_awareness: [
      "How do you work with emotions when they come up now?",
      "What's different about how you relate to feelings?",
      "How are you applying this awareness in daily life?"
    ],
    craving: [
      "What happens when you notice craving now?",
      "How do you work with that pull when it arises?",
      "What's changed about your relationship with wanting?"
    ],
    letting_go: [
      "How do you practice letting go in daily situations?",
      "What happens when you release the grip?",
      "How has this shifted your experience?"
    ]
  },
  
  // Stage 5: EMBODIMENT - Is it fully integrated?
  EMBODIMENT: {
    emotional_awareness: [
      "How would you describe emotional awareness to someone new?",
      "What's fundamentally different about your relationship with emotions now?",
      "How has this understanding transformed your experience?"
    ],
    impermanence: [
      "How does seeing impermanence everywhere change things?",
      "What's it like to live with this understanding?",
      "How would you help someone see impermanence?"
    ],
    non_self: [
      "What's it like to see through the illusion of a fixed self?",
      "How has this understanding transformed your experience?",
      "How would you guide someone to this realization?"
    ]
  }
};

// ============================================
// AI VALIDATION FUNCTIONS
// ============================================

/**
 * Analyze if user demonstrated a GLIMPSE of understanding
 */
export async function validateGlimpse(userMessage, conceptKey, conversationContext) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `You are analyzing if a user just had a GLIMPSE of understanding for the concept: "${CONCEPTS[conceptKey].name}"

Concept: ${CONCEPTS[conceptKey].description}

User's message: "${userMessage}"

Recent conversation context:
${conversationContext}

A GLIMPSE means:
- They saw the pattern for the FIRST time
- Direct experience, not intellectual understanding
- Might be tentative: "Oh... I think I see..."
- They noticed something in their actual experience

Does this message show they had a glimpse of understanding?

Respond ONLY with a JSON object:
{
  "hasGlimpse": true/false,
  "confidence": 1-10,
  "evidence": "quote from their message that shows understanding",
  "reasoning": "why this shows (or doesn't show) a glimpse"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    return result.hasGlimpse && result.confidence >= 6 ? result : null;
  } catch (error) {
    console.error('Error validating glimpse:', error);
    return null;
  }
}

/**
 * Analyze if user can ARTICULATE their understanding
 */
export async function validateArticulation(userMessage, conceptKey, conversationContext) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `You are analyzing if a user can ARTICULATE their understanding of: "${CONCEPTS[conceptKey].name}"

Concept: ${CONCEPTS[conceptKey].description}

User's message: "${userMessage}"

Recent conversation context:
${conversationContext}

ARTICULATION means:
- They can EXPLAIN the concept from their own experience
- Uses their own words, not just repeating what they were told
- Describes the mechanism: "When X happens, then Y"
- Shows understanding of HOW it works

Can they articulate clear understanding?

Respond ONLY with a JSON object:
{
  "canArticulate": true/false,
  "confidence": 1-10,
  "evidence": "quote showing they explained it",
  "reasoning": "why this shows clear understanding"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    return result.canArticulate && result.confidence >= 7 ? result : null;
  } catch (error) {
    console.error('Error validating articulation:', error);
    return null;
  }
}

/**
 * Analyze if user shows RECOGNITION without prompting
 */
export async function validateRecognition(userMessage, conceptKey) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `You are analyzing if a user spontaneously demonstrated RECOGNITION of: "${CONCEPTS[conceptKey].name}"

Concept: ${CONCEPTS[conceptKey].description}

User's message: "${userMessage}"

RECOGNITION means:
- They noticed the pattern WITHOUT being asked about it
- Spontaneous: "Hey, I caught that attachment pattern!"
- Shows it stuck from previous sessions
- They're actively noticing it in daily life

Did they spontaneously recognize this concept?

Respond ONLY with a JSON object:
{
  "spontaneousRecognition": true/false,
  "confidence": 1-10,
  "evidence": "quote showing spontaneous recognition",
  "reasoning": "why this shows the understanding stuck"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    return result.spontaneousRecognition && result.confidence >= 7 ? result : null;
  } catch (error) {
    console.error('Error validating recognition:', error);
    return null;
  }
}

/**
 * Analyze if user shows skillful APPLICATION
 */
export async function validateApplication(userMessage, conceptKey) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `You are analyzing if a user demonstrates skillful APPLICATION of: "${CONCEPTS[conceptKey].name}"

Concept: ${CONCEPTS[conceptKey].description}

User's message: "${userMessage}"

APPLICATION means:
- They're WORKING with the concept in real situations
- Not just noticing, but responding skillfully
- "When I feel attachment, I just watch it and let it be"
- Changed behavior or relationship to experience

Are they applying this understanding skillfully?

Respond ONLY with a JSON object:
{
  "skillfulApplication": true/false,
  "confidence": 1-10,
  "evidence": "quote showing they're working with it",
  "reasoning": "how they're applying it skillfully"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    return result.skillfulApplication && result.confidence >= 7 ? result : null;
  } catch (error) {
    console.error('Error validating application:', error);
    return null;
  }
}

/**
 * Analyze if user has achieved EMBODIMENT
 */
export async function validateEmbodiment(userMessage, conceptKey) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `You are analyzing if a user has achieved EMBODIMENT of: "${CONCEPTS[conceptKey].name}"

Concept: ${CONCEPTS[conceptKey].description}

User's message: "${userMessage}"

EMBODIMENT means:
- They can TEACH it naturally to others
- It's become part of how they see reality
- Fundamental shift in perspective, not just a technique
- "Everything is impermanent - I see it everywhere now"
- Stable understanding, won't fade

Has this become fully integrated?

Respond ONLY with a JSON object:
{
  "fullyEmbodied": true/false,
  "confidence": 1-10,
  "evidence": "quote showing integrated understanding",
  "reasoning": "why this shows complete embodiment"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    return result.fullyEmbodied && result.confidence >= 8 ? result : null;
  } catch (error) {
    console.error('Error validating embodiment:', error);
    return null;
  }
}

// ============================================
// CROSS-SESSION VALIDATION
// ============================================

/**
 * Check if user's understanding has DECAYED (forgotten)
 */
export async function checkMasteryDecay(userMessage, conceptKey, lastDemonstratedStage) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `The user previously demonstrated understanding of "${CONCEPTS[conceptKey].name}" at stage: ${STAGE_NAMES[lastDemonstratedStage]}

Current message: "${userMessage}"

The question asked was: "Have you been noticing ${CONCEPTS[conceptKey].name.toLowerCase()} in your daily life?"

SIGNS OF DECAY:
- "Uh... what do you mean?"
- Can't remember the concept
- Shows no evidence it's still active
- Vague or confused response

SIGNS OF RETENTION:
- Specific examples from recent experience
- Clear memory of what it is
- Still actively noticing it

Has the understanding DECAYED or is it RETAINED?

Respond ONLY with JSON:
{
  "decayed": true/false,
  "confidence": 1-10,
  "evidence": "quote from message",
  "reasoning": "why you believe it decayed or retained"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    return result.decayed && result.confidence >= 7 ? result : null;
  } catch (error) {
    console.error('Error checking mastery decay:', error);
    return null;
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Update user's mastery stage for a concept
 */
export async function updateMasteryStage(supabase, userId, conceptKey, newStage, evidence) {
  const { data, error } = await supabase
    .from('user_concept_mastery')
    .upsert({
      user_id: userId,
      concept_key: conceptKey,
      mastery_stage: newStage,
      mastery_percentage: STAGE_PERCENTAGES[newStage],
      last_demonstrated: new Date().toISOString(),
      evidence: evidence,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,concept_key'
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating mastery stage:', error);
    return null;
  }

  return data;
}

/**
 * Get user's current mastery for a concept
 */
export async function getUserMastery(supabase, userId, conceptKey) {
  const { data, error } = await supabase
    .from('user_concept_mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('concept_key', conceptKey)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching mastery:', error);
    return null;
  }

  return data || {
    mastery_stage: 0,
    mastery_percentage: 0,
    last_demonstrated: null
  };
}

/**
 * Get all user's mastery levels
 */
export async function getAllUserMastery(supabase, userId) {
  const { data, error } = await supabase
    .from('user_concept_mastery')
    .select('*')
    .eq('user_id', userId)
    .order('mastery_percentage', { ascending: false });

  if (error) {
    console.error('Error fetching all mastery:', error);
    return [];
  }

  return data || [];
}

/**
 * Calculate overall transformation progress
 */
export async function calculateOverallProgress(supabase, userId) {
  const allMastery = await getAllUserMastery(supabase, userId);
  
  if (allMastery.length === 0) return 0;
  
  const totalPossible = Object.keys(CONCEPTS).length * 100;
  const totalAchieved = allMastery.reduce((sum, m) => sum + m.mastery_percentage, 0);
  
  return Math.round((totalAchieved / totalPossible) * 100);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get appropriate validation question for concept and stage
 */
export function getValidationQuestion(conceptKey, stage) {
  const stageName = Object.keys(MASTERY_STAGES).find(
    key => MASTERY_STAGES[key] === stage
  );
  
  const questions = VALIDATION_QUESTIONS[stageName]?.[conceptKey];
  
  if (!questions || questions.length === 0) {
    return null;
  }
  
  // Return random question from available ones
  return questions[Math.floor(Math.random() * questions.length)];
}

/**
 * Check how long since last demonstration
 */
export function daysSinceLastDemonstration(lastDemonstrated) {
  if (!lastDemonstrated) return Infinity;
  
  const then = new Date(lastDemonstrated);
  const now = new Date();
  const diffTime = Math.abs(now - then);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Should we check for mastery decay?
 */
export function shouldCheckDecay(lastDemonstrated, currentStage) {
  const days = daysSinceLastDemonstration(lastDemonstrated);
  
  // Check decay if:
  // - Stage 1-2 (fragile): 7+ days
  // - Stage 3 (recognition): 14+ days  
  // - Stage 4 (application): 21+ days
  // - Stage 5 (embodiment): Don't check (stable)
  
  if (currentStage >= 5) return false;
  if (currentStage <= 2 && days >= 7) return true;
  if (currentStage === 3 && days >= 14) return true;
  if (currentStage === 4 && days >= 21) return true;
  
  return false;
}

export default {
  MASTERY_STAGES,
  STAGE_PERCENTAGES,
  STAGE_NAMES,
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
  calculateOverallProgress,
  getValidationQuestion,
  daysSinceLastDemonstration,
  shouldCheckDecay
};