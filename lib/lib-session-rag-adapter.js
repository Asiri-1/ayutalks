// ================================================
// MIND STUDY SESSIONS - RAG Adapter
// ================================================
// Purpose: Adapt RAG queries for session mode (Ayu leads)
// Problem: Regular RAG searches user's message, but in sessions Ayu asks first
// Solution: Build RAG queries from session context, not just user message

import { SESSION_PHASES } from './lib-session-manager';

// ================================================
// BUILD SESSION RAG QUERY
// ================================================
export function buildSessionRAGQuery({
  phase,
  userMessage,
  conceptsToExplore,
  recentConcepts,
  sessionMessages,
  userEmotionalState
}) {
  // In session mode, RAG query should be based on:
  // 1. User's actual message (if substantive)
  // 2. Current phase requirements
  // 3. Concepts being explored
  // 4. Context from previous exchanges
  
  const queryParts = [];
  
  // Always include user's message if it has content
  if (userMessage && userMessage.trim().length > 0) {
    queryParts.push(userMessage);
  }
  
  // Add phase-specific context
  const phaseContext = getPhaseRAGContext(phase);
  if (phaseContext) {
    queryParts.push(phaseContext);
  }
  
  // Add concepts to explore
  if (conceptsToExplore && conceptsToExplore.length > 0) {
    const conceptQuery = conceptsToExplore
      .map(c => c.replace(/_/g, ' '))
      .join(' OR ');
    queryParts.push(conceptQuery);
  }
  
  // Add emotional state keywords if present
  if (userEmotionalState) {
    queryParts.push(userEmotionalState);
  }
  
  // Build final query
  const finalQuery = queryParts.join(' ');
  
  return {
    query: finalQuery,
    searchType: 'hybrid', // Use both semantic and keyword
    conceptFilter: conceptsToExplore, // Prioritize these concepts
    maxResults: 5 // Fewer results for faster response
  };
}

// ================================================
// GET PHASE RAG CONTEXT
// ================================================
function getPhaseRAGContext(phase) {
  const contexts = {
    [SESSION_PHASES.GROUNDING]: 'present moment awareness body sensations emotions feelings now',
    [SESSION_PHASES.EXPLORATION]: 'patterns reactions automatic mind thoughts behavior cause effect',
    [SESSION_PHASES.INTEGRATION]: 'insight understanding awareness learning practice daily life'
  };
  
  return contexts[phase] || contexts[SESSION_PHASES.GROUNDING];
}

// ================================================
// EXTRACT CONCEPTS FROM USER MESSAGE
// ================================================
export function extractConceptsFromMessage(message) {
  const lowerMessage = message.toLowerCase();
  const detectedConcepts = [];
  
  // Concept detection patterns
  const conceptPatterns = {
    feeling_tone_drives_reaction: [
      /feel\w* (good|bad|pleasant|unpleasant)/i,
      /like\w* (it|that)/i,
      /don't like/i,
      /want\w* (to|it)/i,
      /desire|craving/i
    ],
    present_moment_awareness: [
      /right now|at this moment|present/i,
      /notice\w*|aware|conscious/i,
      /here and now/i
    ],
    witnessing_vs_being_caught: [
      /watching|observing|witnessing/i,
      /caught (in|up)|lost in/i,
      /step back|distance/i
    ],
    wanting_mechanism: [
      /want\w*|wish\w*|desire/i,
      /need to|have to|must/i,
      /should|supposed to/i
    ],
    not_wanting_mechanism: [
      /don't want|avoid\w*|resist/i,
      /push away|reject/i,
      /shouldn't|mustn't/i
    ],
    acceptance_vs_resistance: [
      /accept\w*|allow\w*/i,
      /resist\w*|fight\w*|struggle/i,
      /let it be|let go/i
    ],
    impermanence_constant_change: [
      /always|never|constant/i,
      /change\w*|shift\w*|pass\w*/i,
      /temporary|fleeting/i
    ],
    ego_mechanism: [
      /i am|my|mine|myself/i,
      /self|identity|who i am/i,
      /my fault|blame myself/i
    ],
    suffering_cessation: [
      /suffer\w*|pain\w*|hurt\w*/i,
      /stop|end|cease/i,
      /peace|relief|calm/i
    ],
    conditioning_patterns: [
      /always (do|react|feel)/i,
      /every time|whenever/i,
      /pattern|habit|automatic/i,
      /tend to|usually/i
    ]
  };
  
  // Check each pattern
  for (const [concept, patterns] of Object.entries(conceptPatterns)) {
    if (patterns.some(pattern => pattern.test(lowerMessage))) {
      detectedConcepts.push(concept);
    }
  }
  
  return detectedConcepts;
}

// ================================================
// PRIORITIZE RAG RESULTS BY RELEVANCE
// ================================================
export function prioritizeRAGResults(ragResults, conceptsToExplore, phase) {
  if (!ragResults || ragResults.length === 0) return [];
  
  // Score each result
  const scoredResults = ragResults.map(result => {
    let score = result.similarity_score || 0;
    
    // Boost if matches concepts to explore
    if (conceptsToExplore && conceptsToExplore.length > 0) {
      const matchesConcept = conceptsToExplore.some(concept => 
        result.metadata?.concepts?.includes(concept) ||
        result.content?.toLowerCase().includes(concept.replace(/_/g, ' '))
      );
      if (matchesConcept) {
        score += 0.2;
      }
    }
    
    // Boost if appropriate for phase
    const phaseKeywords = getPhaseKeywords(phase);
    const matchesPhase = phaseKeywords.some(keyword =>
      result.content?.toLowerCase().includes(keyword)
    );
    if (matchesPhase) {
      score += 0.1;
    }
    
    // Prefer shorter, more focused chunks
    const contentLength = result.content?.length || 0;
    if (contentLength > 0 && contentLength < 500) {
      score += 0.05;
    }
    
    return { ...result, priorityScore: score };
  });
  
  // Sort by priority score
  return scoredResults
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5); // Top 5 results
}

// ================================================
// GET PHASE KEYWORDS
// ================================================
function getPhaseKeywords(phase) {
  const keywords = {
    [SESSION_PHASES.GROUNDING]: [
      'present', 'moment', 'now', 'feeling', 'body', 'sensation', 'aware', 'notice'
    ],
    [SESSION_PHASES.EXPLORATION]: [
      'pattern', 'reaction', 'automatic', 'why', 'because', 'cause', 'effect', 'mind', 'thought'
    ],
    [SESSION_PHASES.INTEGRATION]: [
      'understand', 'learn', 'practice', 'daily', 'life', 'apply', 'remember', 'insight'
    ]
  };
  
  return keywords[phase] || keywords[SESSION_PHASES.GROUNDING];
}

// ================================================
// BUILD CONTEXT FOR CLAUDE
// ================================================
export function buildRAGContextForSession(ragResults, maxTokens = 2000) {
  if (!ragResults || ragResults.length === 0) {
    return '';
  }
  
  let context = '\nRELEVANT KNOWLEDGE FROM YOUR BOOKS:\n\n';
  let tokenCount = 0;
  
  for (const result of ragResults) {
    const chunk = result.content || '';
    const chunkTokens = estimateTokens(chunk);
    
    if (tokenCount + chunkTokens > maxTokens) {
      break;
    }
    
    // Add source if available
    const source = result.metadata?.source || 'Return of Attention';
    context += `[From ${source}]\n${chunk}\n\n`;
    
    tokenCount += chunkTokens;
  }
  
  context += '\nUse this knowledge naturally in your questions. Don\'t quote it directly - weave it into conversation.\n';
  
  return context;
}

// ================================================
// ESTIMATE TOKENS (Rough Approximation)
// ================================================
function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// ================================================
// DETERMINE IF RAG IS NEEDED
// ================================================
export function shouldUseRAG(userMessage, phase, conversationDepth) {
  // Always use RAG in first few exchanges
  if (conversationDepth < 3) {
    return true;
  }
  
  // Use RAG if user message is substantive
  if (userMessage) {
    const wordCount = userMessage.trim().split(/\s+/).length;
    if (wordCount >= 5) {
      return true;
    }
  }
  
  // Use RAG in exploration phase (needs concept knowledge)
  if (phase === SESSION_PHASES.EXPLORATION) {
    return true;
  }
  
  // May skip RAG for very short responses or grounding/integration
  return false;
}

// ================================================
// OPTIMIZE QUERY FOR SPEED
// ================================================
export function optimizeForSpeed(ragQuery) {
  // For sessions, we want fast responses
  // Optimize by:
  // 1. Limiting query length
  // 2. Using most relevant keywords only
  // 3. Reducing search scope
  
  const words = ragQuery.query.split(/\s+/);
  
  // Limit to 15 most important words
  const optimizedWords = words
    .filter(word => word.length > 3) // Skip short words
    .slice(0, 15);
  
  return {
    ...ragQuery,
    query: optimizedWords.join(' '),
    maxResults: 3, // Fewer results = faster
    useCache: true // Use cached results when possible
  };
}

// ================================================
// GET CACHED RAG RESULTS
// ================================================
// Simple in-memory cache for common queries
const ragCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedRAGResults(query) {
  const cached = ragCache.get(query);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }
  
  return null;
}

export function cacheRAGResults(query, results) {
  // Limit cache size
  if (ragCache.size > 100) {
    const firstKey = ragCache.keys().next().value;
    ragCache.delete(firstKey);
  }
  
  ragCache.set(query, {
    results,
    timestamp: Date.now()
  });
}

// ================================================
// BUILD COMBINED QUERY (User + Context)
// ================================================
export function buildCombinedQuery({
  userMessage,
  previousContext,
  conceptsDiscussed,
  phase
}) {
  const queryParts = [];
  
  // Start with user's actual words
  if (userMessage && userMessage.trim()) {
    queryParts.push(userMessage);
  }
  
  // Add recently discussed concepts for context
  if (conceptsDiscussed && conceptsDiscussed.length > 0) {
    const recentConcepts = conceptsDiscussed
      .slice(-2) // Last 2 concepts
      .map(c => c.replace(/_/g, ' '))
      .join(' ');
    queryParts.push(recentConcepts);
  }
  
  // Add phase-specific terms
  const phaseTerms = getPhaseRAGContext(phase);
  if (phaseTerms) {
    queryParts.push(phaseTerms);
  }
  
  return queryParts.join(' ');
}

// ================================================
// EXPORT ALL
// ================================================
export default {
  buildSessionRAGQuery,
  extractConceptsFromMessage,
  prioritizeRAGResults,
  buildRAGContextForSession,
  shouldUseRAG,
  optimizeForSpeed,
  getCachedRAGResults,
  cacheRAGResults,
  buildCombinedQuery
};