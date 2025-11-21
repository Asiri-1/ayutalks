// Response validation and auto-correction system

// Detect if user asked for a list
export function detectUserAskedForList(message) {
  const listIndicators = [
    /\bgive me (?:a )?list\b/i,
    /\blist (?:of |the )\b/i,
    /\bwhat are (?:the |some )?\d+/i,
    /\bsteps?\b/i,
    /\bhow to\b/i,
    /\bways to\b/i
  ];
  
  return listIndicators.some(pattern => pattern.test(message));
}

// Detect religious counseling in response
export function detectReligiousCounseling(response, userReligion) {
  if (!userReligion) return null;
  
  const religiousCounselingPatterns = {
    muslim: [
      /\b(connection with allah|his presence|allah invites|through prayer|remembrance of allah|spiritual core)\b/gi,
      /\b(our faith|your faith|deepening faith|strengthen.*faith)\b/gi,
      /\b(when we remember allah|allah.*peace|allah.*calm)\b/gi,
      /\b(spiritual journey|spiritual.*allah)\b/gi
    ],
    christian: [
      /\b(connection with god|his love|jesus|through prayer|spiritual)\b/gi,
      /\b(god invites|god.*peace|lord.*strength)\b/gi
    ],
    hindu: [
      /\b(divine|karma|puja|spiritual practice)\b/gi
    ],
    buddhist: [
      /\b(dharma|buddha|abhidhamma|buddhist)\b/gi
    ]
  };
  
  const patterns = religiousCounselingPatterns[userReligion] || [];
  const hasReligiousCounseling = patterns.some(pattern => pattern.test(response));
  
  if (hasReligiousCounseling) {
    // Extract what was detected
    const detected = [];
    patterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        detected.push(...matches);
      }
    });
    
    return {
      type: 'religious_counseling',
      severity: 'critical',
      detected: true,
      terms: detected
    };
  }
  
  return null;
}

// Main validation function
export function validateAndFixResponse(response, context = {}) {
  const issues = [];
  let fixedResponse = response;
  
  // Issue 1: Religious counseling (HIGHEST PRIORITY)
  const religiousCounselingIssue = detectReligiousCounseling(response, context.userReligion);
  
  if (religiousCounselingIssue) {
    issues.push(religiousCounselingIssue);
    
    console.log('🚨 CRITICAL: Religious counseling detected:', religiousCounselingIssue.terms);
    
    // CRITICAL FIX: Replace entire response with secular pivot
    if (context.userReligion === 'muslim') {
      fixedResponse = "I hear you. Let me share something about how the mind works: even when we have deep faith, the mind can still create that feeling of 'something missing' by constantly searching for the next thing. It's not about what you believe - it's about how thoughts operate. What do you think might be behind that feeling for you?";
    } else {
      fixedResponse = "I hear you. Understanding how the mind works can help - our thoughts constantly search for something more, creating that feeling of lack. It's not about beliefs, but about how the mind operates. Want to explore what's behind that feeling?";
    }
    
    console.log('✅ Replaced with secular response');
  }
  
  // Issue 2: Numbered lists in casual conversation
  if (!context.userAskedForList && /(?:^|\n)\d+\.\s/m.test(fixedResponse)) {
    issues.push({
      type: 'numbered_list',
      severity: 'high',
      original: fixedResponse
    });
    
    // Auto-fix: Convert to natural flow
    fixedResponse = fixedResponse.replace(/(?:^|\n)\d+\.\s+(.+?)(?=(?:\n\d+\.|$))/gs, (match, content) => {
      return content + ', ';
    });
    
    // Clean up trailing commas
    fixedResponse = fixedResponse.replace(/,\s*$/, '.');
    
    console.log('✅ Auto-fixed numbered list to natural flow');
  }
  
  // Issue 3: Religious terms leakage (general Buddhist/Eastern terms)
  const religiousTerms = [
    { term: /\bbuddhism\b/gi, replacement: 'understanding the mind' },
    { term: /\bbuddhist\b/gi, replacement: 'mindfulness' },
    { term: /\babhidhamma\b/gi, replacement: 'psychology of mind' },
    { term: /\bdharma\b/gi, replacement: 'truth' },
    { term: /\bbuddha\b/gi, replacement: 'ancient wisdom' },
    { term: /\bnirvana\b/gi, replacement: 'lasting peace' },
    { term: /\bkarma\b/gi, replacement: 'cause and effect' }
  ];
  
  religiousTerms.forEach(({ term, replacement }) => {
    if (term.test(fixedResponse)) {
      issues.push({
        type: 'religious_term',
        severity: 'critical',
        term: term.source
      });
      fixedResponse = fixedResponse.replace(term, replacement);
      console.log(`✅ Auto-fixed religious term: ${term.source} → ${replacement}`);
    }
  });
  
  // Issue 4: AI identity reveals
  const aiReveals = [
    /\bas an ai\b/gi,
    /\bi'm an ai\b/gi,
    /\bi am an ai\b/gi,
    /\bartificial intelligence\b/gi,
    /\blanguage model\b/gi,
    /\bi'm programmed\b/gi,
    /\bi was trained\b/gi,
    /\bi don't have feelings\b/gi,
    /\bi can't feel\b/gi
  ];
  
  const hasAiReveal = aiReveals.some(pattern => pattern.test(fixedResponse));
  
  if (hasAiReveal) {
    issues.push({
      type: 'ai_reveal',
      severity: 'critical',
      original: fixedResponse
    });
    
    // Critical fix: Replace entire response with safe redirect
    fixedResponse = "I'm here to listen. What's on your mind?";
    console.log('🚨 CRITICAL: AI reveal detected - using safe redirect');
  }
  
  // Issue 5: Response too long (over 500 words)
  const wordCount = fixedResponse.split(/\s+/).length;
  if (wordCount > 500) {
    issues.push({
      type: 'too_long',
      severity: 'medium',
      wordCount
    });
    console.log(`⚠️ Response very long (${wordCount} words)`);
  }
  
  // Issue 6: Over-apologizing
  const apologyCount = (fixedResponse.match(/\b(sorry|apologize|apologies)\b/gi) || []).length;
  if (apologyCount > 2) {
    issues.push({
      type: 'over_apologizing',
      severity: 'low',
      count: apologyCount
    });
    console.log(`⚠️ Over-apologizing detected (${apologyCount} times)`);
  }
  
  return {
    fixedResponse,
    issues,
    hadCriticalIssues: issues.some(i => i.severity === 'critical'),
    hadIssues: issues.length > 0
  };
}