import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { mapConceptsFromConversation, isSubstantiveMessage } from '../../lib/concept-mapper'
import { updateConceptMastery } from '../../lib/concept-tracking'
import { logChatAnalytics } from '../../lib/analytics'

// NEW: Improved architecture imports
import { shouldBatchMessage } from '../../lib/message-batcher'
import { buildSystemPrompt } from '../../lib/prompt-layers'
import { validateAndFixResponse, detectUserAskedForList } from '../../lib/response-validator'
import { detectReligion } from '../../lib/religion-detector'

// Session management imports (existing)
import { 
  getActiveSession, 
  updateSessionActivity, 
  incrementUserResponse,
  recordInsight,
  trackSessionConcept
} from '../../lib/lib-session-manager'
import { 
  generateSessionPrompt, 
  detectInsightInMessage,
  determineEngagementLevel 
} from '../../lib/lib-session-prompts'
import { 
  buildSessionRAGQuery, 
  shouldUseRAG as shouldUseSessionRAG,
  buildRAGContextForSession,
  extractConceptsFromMessage
} from '../../lib/lib-session-rag-adapter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function getStartOfToday() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return startOfDay.toISOString();
}

const getTimeContext = () => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      period: "morning",
      tone: "Gently energizing and setting calm intentions for the day ahead"
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      period: "afternoon", 
      tone: "Balanced and reflectively present in the middle of the day"
    };
  } else if (hour >= 17 && hour < 22) {
    return {
      period: "evening",
      tone: "Helping them wind down and reflect on the day with slower pacing"
    };
  } else {
    return {
      period: "late night",
      tone: "Extra gentle, honoring their quiet hours of reflection"
    };
  }
};

const isOffTopic = (message) => {
  const lowerMessage = message.toLowerCase();
  
  const offTopicIndicators = [
    /\b(accounting|bookkeeping|balance sheet|profit|loss|revenue|invoice|tax|audit)\b/i,
    /\b(marketing|seo|advertising|campaign|conversion rate|roi|kpi)\b/i,
    /\b(sales|pipeline|crm|lead generation|cold call)\b/i,
    /\b(stock market|trading|investment|portfolio|dividends)\b/i,
    /\b(javascript|python|java|code|programming|bug|syntax|algorithm|database|api|sql)\b/i,
    /\b(deploy|server|hosting|docker|kubernetes|git|github)\b/i,
    /\b(html|css|react|node|framework|library)\b/i,
    /\b(lawsuit|lawyer|legal advice|contract|attorney|sue|litigation)\b/i,
    /\b(diagnose|diagnosis|prescription|medication|dosage|treatment plan)\b/i,
    /\b(calculus|algebra|physics|chemistry|biology|trigonometry|geometry)\b/i,
    /\b(solve.*equation|formula.*calculate)\b/i,
    /\b(which phone|which laptop|best car|recommend.*product|buy.*laptop|buy.*phone)\b/i,
    /\b(price.*compare|cheaper.*alternative|best deal)\b/i,
    /\b(movie.*plot|spoiler|who wins|game.*walkthrough|cheat code)\b/i,
    /\b(recipe for|how to cook|baking temperature)\b/i,
  ];
  
  return offTopicIndicators.some(pattern => pattern.test(lowerMessage));
};

const isCasualUpdate = (message) => {
  const lowerMessage = message.toLowerCase().trim();
  const length = message.trim().length;
  
  const distressWords = /\b(anxious|worried|stressed|sad|upset|angry|frustrated|scared|afraid|depressed|lonely|hurt|terrible|awful|miserable|overwhelmed|exhausted|drained|struggling|nervous|tense|panicked|hopeless|helpless)\b/i;
  if (distressWords.test(lowerMessage)) {
    return false;
  }
  
  if (length < 25) {
    return true;
  }
  
  const casualPatterns = [
    /\b(just|i'm|im|i am)\s+(at|in|on|going to|headed to|heading to|arrived at|got to|got into|getting to|starting|beginning)/i,
    /\b(made it|got here|arrived|heading out|on my way|leaving|about to)\b/i,
    /\b(start(ing)?|begin(ning)?)\s+(work|my day|the day|my morning|today)/i,
    /\b(plan(ning)? to|going to|about to)\s+(start|begin|work|leave|head out)/i,
    /^(good|nice|great|cool|awesome|sweet|fine|ok|okay|alright|sure|yeah|yep|nope|no worries|all good|sounds good)$/i,
    /^(hi|hello|hey)[,.]?\s+.*(starting|heading|going|plan|at|in|got)/i,
    /\b(i'm|im|i am)\s+(here|there|home|back|out|at the|in the|at my)/i,
  ];
  
  return casualPatterns.some(pattern => pattern.test(lowerMessage));
};

const shouldUseRAG = (message) => {
  const lowerMessage = message.toLowerCase().trim();
  const length = message.trim().length;
  
  if (isCasualUpdate(message)) {
    console.log('📍 Casual status update detected - skipping RAG');
    return false;
  }
  
  const pureGreetings = [
    'hi', 'hello', 'hey', 'hi there', 'hello there',
    'thanks', 'thank you', 'ok', 'okay', 'got it', 'sure',
    'yes', 'no', 'yeah', 'yep', 'nope'
  ];
  
  if (pureGreetings.includes(lowerMessage)) return false;
  
  if (/\b(what|why|how|when|who|where|which|can|could|would|should|is|are|do|does)\b.*\?/i.test(message)) {
    return true;
  }
  
  if (/\b(pahm|meditation|meditate|mindfulness|mindful|awareness|aware|practice|consciousness)\b/i.test(lowerMessage)) {
    return true;
  }
  
  const emotionalIndicators = [
    /\b(feel|feeling|felt|emotion|mood)\b/i,
    /\b(stress|stressed|anxious|anxiety|worry|worried|fear|afraid)\b/i,
    /\b(sad|sadness|depressed|depression|lonely|loneliness)\b/i,
    /\b(angry|anger|frustrated|frustration|upset)\b/i,
    /\b(happy|happiness|joy|joyful|content|peaceful|peace)\b/i,
    /\b(thought|thoughts|thinking|mind|mental)\b/i,
    /\b(problem|issue|struggle|struggling|difficult|difficulty|challenge)\b/i,
    /\b(can't|cannot|don't know|confused|confusion|lost)\b/i,
    /\b(overwhelm|overwhelming|exhausted|tired|drained)\b/i,
    /\b(hurt|hurting|pain|painful|suffering)\b/i,
  ];
  
  if (emotionalIndicators.some(pattern => pattern.test(lowerMessage))) {
    return true;
  }
  
  if (/\b(help|advice|guide|teach|show|tell me|explain|understand|learn)\b/i.test(lowerMessage)) {
    return true;
  }
  
  if (/\b(lately|recently|relationship|family)\b/i.test(lowerMessage)) {
    return true;
  }
  
  if (length > 50) return true;
  
  return false;
};

const getQueryType = (message, needsRAG, isOffTopicQuery) => {
  if (isOffTopicQuery) return 'off_topic';
  if (isCasualUpdate(message)) return 'casual';
  if (needsRAG) {
    const emotionalWords = ['anxious', 'worried', 'stressed', 'sad', 'upset', 'angry', 'frustrated', 'scared', 'afraid'];
    if (emotionalWords.some(word => message.toLowerCase().includes(word))) {
      return 'emotional';
    }
    return 'substantive';
  }
  return 'casual';
};

// ================================================
// MAIN HANDLER
// ================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, conversationId, userId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  if (!conversationId || !userId) {
    return res.status(400).json({ error: 'Missing conversationId or userId' });
  }

  const startTime = Date.now();
  const timings = {
    ragTime: null,
    ragChunksFound: 0,
    claudeTime: null,
    dbSaveTime: null,
    conceptMappingTime: null,
    validationTime: null
  };
  let analyticsData = {
    userId,
    conversationId,
    conceptsMapped: 0,
    conceptKeys: [],
    conceptMappingSuccess: false,
    conceptMappingError: null,
    qualityIssuesFound: 0,
    qualityIssueTypes: []
  };

  try {
    // ================================================
    // MESSAGE BATCHING (NEW - Prevents duplicate responses)
    // ================================================
    const lastUserMessage = messages[messages.length - 1];
    const batchResult = shouldBatchMessage(userId, lastUserMessage.content);
    
    if (batchResult.shouldBatch) {
      console.log('📦 Batched multiple messages:', batchResult.batchedMessage.substring(0, 100));
      lastUserMessage.content = batchResult.batchedMessage;
    }

    // ================================================
    // CHECK FOR ACTIVE SESSION
    // ================================================
    const activeSession = await getActiveSession(userId);
    const isSessionMode = !!activeSession;
    
    if (isSessionMode) {
      console.log('🧘 SESSION MODE ACTIVE:', {
        sessionId: activeSession.sessionId,
        phase: activeSession.phase,
        elapsed: `${Math.floor(activeSession.elapsedSeconds / 60)}m ${activeSession.elapsedSeconds % 60}s`
      });
    }

    // Save user message
    const { data: userMsgData } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        sender: 'user',
        content: lastUserMessage.content,
        timestamp: new Date().toISOString(),
        session_id: isSessionMode ? activeSession.sessionId : null,
        is_session_message: isSessionMode,
        session_phase: isSessionMode ? activeSession.phase : null
      })
      .select()
      .single();
    
    console.log(`✅ User message saved${isSessionMode ? ' (SESSION)' : ''}`);

    // Update session activity if in session mode
    if (isSessionMode) {
      await updateSessionActivity(activeSession.sessionId);
      await incrementUserResponse(activeSession.sessionId);
    }

    const isQueryOffTopic = isOffTopic(lastUserMessage.content);
    
    // ================================================
    // OFF-TOPIC HANDLING
    // ================================================
    if (isQueryOffTopic) {
      console.log('⚠️ Off-topic query detected - providing gentle redirect');
      
      const redirectSystemPrompt = `You are Ayu, a warm mindful companion focused on helping people with their inner experiences, emotions, and personal growth through mindfulness.

Someone just asked you about something outside your area - it appears to be a technical, business, academic, or product-related question.

CRITICAL: You are Ayu, a warm friend - NOT an AI or assistant. Never acknowledge being an AI.

Respond warmly and honestly:
- Acknowledge their question kindly without judgment
- Gently explain that you focus on helping with thoughts, feelings, and mindfulness practice
- Don't apologize excessively or sound robotic
- Optionally, if there's an emotional/mental aspect you could help with, mention it naturally
- Keep it brief (2-3 sentences)
- Stay warm and human

Example: "That's not really my area - I focus more on helping with what's going on in your mind and heart. But if there's something about how this situation is affecting you emotionally, I'm here to listen."`;

      const claudeStartTime = Date.now();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 512,
          system: redirectSystemPrompt,
          messages: [
            { role: 'user', content: lastUserMessage.content }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const redirectMessage = data.content[0].text;
      timings.claudeTime = Date.now() - claudeStartTime;

      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          sender: 'assistant',
          content: redirectMessage,
          timestamp: new Date().toISOString(),
          session_id: isSessionMode ? activeSession.sessionId : null,
          is_session_message: isSessionMode,
          session_phase: isSessionMode ? activeSession.phase : null
        });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ TOTAL (off-topic): ${totalTime}ms`);

      logChatAnalytics({
        ...analyticsData,
        totalTime,
        claudeTime: timings.claudeTime,
        queryType: 'off_topic',
        usedRAG: false,
        userMessageLength: lastUserMessage.content.length,
        assistantMessageLength: redirectMessage.length
      }).catch(err => console.error('⚠️ Analytics failed:', err));

      return res.status(200).json({ message: redirectMessage });
    }

    // ================================================
    // RAG RETRIEVAL
    // ================================================
    let relevantKnowledge = '';
    let needsRAG;
    let skipRAGForShortEmotional = false;
    
    needsRAG = shouldUseRAG(lastUserMessage.content);
    skipRAGForShortEmotional = needsRAG && lastUserMessage.content.length < 30;
    
    if (needsRAG && !skipRAGForShortEmotional) {
      console.log('🔍 Substantive query detected - retrieving knowledge');
      const ragStartTime = Date.now();
      
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: lastUserMessage.content,
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        const { data: semanticMatches, error: searchError } = await supabase.rpc('search_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: 0.35,
          match_count: 5
        });

        if (searchError) {
          console.error('❌ Semantic search error:', searchError);
          throw searchError;
        }

        let matches = semanticMatches || [];
        console.log(`📊 Semantic search: ${matches.length} matches`);

        if (matches.length === 0 || (matches[0] && matches[0].similarity < 0.4)) {
          console.log('⚠️ Weak semantic results, trying keyword search...');
          
          const keywords = lastUserMessage.content
            .toLowerCase()
            .replace(/[?!.,]/g, '')
            .split(' ')
            .filter(word => word.length > 3)
            .slice(0, 3);
          
          if (keywords.length > 0) {
            console.log(`🔑 Keyword search for: ${keywords.join(', ')}`);
            
            const searchPattern = keywords.map(k => `content.ilike.%${k}%`).join(',');
            const { data: keywordMatches } = await supabase
              .from('knowledge_base')
              .select('*')
              .or(searchPattern)
              .limit(5);
            
            if (keywordMatches && keywordMatches.length > 0) {
              console.log(`✅ Keyword search: ${keywordMatches.length} matches`);
              matches = [...matches, ...keywordMatches];
            }
          }
        }

        const uniqueMatches = Array.from(
          new Map(matches.map(m => [m.id, m])).values()
        ).slice(0, 5);

        if (uniqueMatches.length > 0) {
          console.log(`✅ Using ${uniqueMatches.length} knowledge chunks`);
          relevantKnowledge = '';
          uniqueMatches.forEach((match) => {
            relevantKnowledge += `${match.content}\n\n`;
          });
          timings.ragChunksFound = uniqueMatches.length;
        } else {
          console.log('⚠️ No relevant knowledge found');
        }
        
        timings.ragTime = Date.now() - ragStartTime;
        console.log(`⏱️ RAG retrieval: ${timings.ragTime}ms`);
      } catch (error) {
        console.error('❌ Knowledge retrieval failed:', error.message);
      }
    } else if (skipRAGForShortEmotional) {
      console.log('💬 Short emotional message - Ayu can respond directly without RAG');
    } else {
      console.log('💬 Casual message - skipping knowledge retrieval');
    }

    // ================================================
    // GET CONVERSATION HISTORY
    // ================================================
    const startOfToday = getStartOfToday();
    
    const { data: todaysMessages, error: fetchTodayError } = await supabase
      .from('messages')
      .select('sender, content, timestamp')
      .eq('conversation_id', conversationId)
      .gte('timestamp', startOfToday)
      .order('timestamp', { ascending: true });

    if (fetchTodayError) {
      console.error('⚠️ Failed to fetch today messages, using provided messages:', fetchTodayError);
    }

    // Build conversation history with proper alternation
    let rawHistory = (todaysMessages || messages).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content || ''
    }));

    // Filter out empty messages and ensure alternation
    const conversationHistory = [];
    let lastRole = null;
    let foundFirstUser = false;
    
    for (const msg of rawHistory) {
      if (!msg.content || msg.content.trim() === '') continue;
      
      if (!foundFirstUser) {
        if (msg.role === 'assistant') {
          continue;
        }
        foundFirstUser = true;
      }
      
      if (msg.role === lastRole) {
        continue;
      }
      
      conversationHistory.push(msg);
      lastRole = msg.role;
    }

    // Ensure conversation ends with user message
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role !== 'user') {
      conversationHistory.pop();
    }

    if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length - 1].role !== 'user') {
      conversationHistory.push({
        role: 'user',
        content: lastUserMessage.content
      });
    }

    console.log(`📅 Using ${conversationHistory.length} messages from today for context`);

    // ================================================
    // BUILD SYSTEM PROMPT (NEW MODULAR SYSTEM)
    // ================================================
    const timeContext = getTimeContext();
    const detectedReligion = detectReligion(conversationHistory);
    
    const systemPrompt = buildSystemPrompt({
      timeContext,
      userReligion: detectedReligion,
      isSession: isSessionMode,
      sessionPhase: isSessionMode ? activeSession.phase : null,
      conversationLength: conversationHistory.length,
      ragKnowledge: relevantKnowledge
    });

    console.log(`📝 System prompt built: ${systemPrompt.length} chars${detectedReligion ? ` (🔒 ${detectedReligion} PROTECTION ACTIVE)` : ''}`);

    // ================================================
    // CALL CLAUDE API
    // ================================================
    const claudeStartTime = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationHistory
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ CLAUDE API ERROR:', response.status, errorBody);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    let assistantMessage = data.content[0].text;
    
    timings.claudeTime = Date.now() - claudeStartTime;
    console.log(`⏱️ Claude API response: ${timings.claudeTime}ms`);

    // ================================================
    // RESPONSE VALIDATION (NEW - Auto-fix quality issues)
    // ================================================
    const validationStartTime = Date.now();
    const userAskedForList = detectUserAskedForList(lastUserMessage.content);
    
    const validationResult = validateAndFixResponse(assistantMessage, {
      userAskedForList,
      userReligion: detectedReligion  // CRITICAL: Pass religion context
    });
    
    if (validationResult.hadIssues) {
      console.log('⚠️ Quality issues detected:', validationResult.issues.map(i => i.type).join(', '));
      assistantMessage = validationResult.fixedResponse;
      
      analyticsData.qualityIssuesFound = validationResult.issues.length;
      analyticsData.qualityIssueTypes = validationResult.issues.map(i => i.type);
      
      // FIXED: Log quality issues for analytics (proper Supabase syntax)
      const { error: qualityLogError } = await supabase
        .from('quality_issues')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          message_content: validationResult.issues[0]?.original || assistantMessage,
          issues: validationResult.issues.map(i => ({ 
            type: i.type, 
            severity: i.severity,
            terms: i.terms || null
          })),
          was_auto_fixed: true,
          timestamp: new Date().toISOString()
        });
      
      if (qualityLogError) {
        console.error('⚠️ Quality issue logging failed:', qualityLogError);
      }
    }
    
    timings.validationTime = Date.now() - validationStartTime;
    console.log(`⏱️ Response validation: ${timings.validationTime}ms`);

    // ================================================
    // SAVE ASSISTANT MESSAGE
    // ================================================
    const saveStartTime = Date.now();
    const { data: savedMessage } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        sender: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        session_id: isSessionMode ? activeSession.sessionId : null,
        is_session_message: isSessionMode,
        session_phase: isSessionMode ? activeSession.phase : null
      })
      .select()
      .single();
      
    timings.dbSaveTime = Date.now() - saveStartTime;
    console.log(`⏱️ Message saved to DB: ${timings.dbSaveTime}ms`);

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ TOTAL: ${totalTime}ms`);

    const queryType = isSessionMode ? 'session' : getQueryType(lastUserMessage.content, needsRAG, false);
    
    // ================================================
    // ANALYTICS LOGGING
    // ================================================
    logChatAnalytics({
      ...analyticsData,
      totalTime,
      ragTime: timings.ragTime,
      claudeTime: timings.claudeTime,
      dbSaveTime: timings.dbSaveTime,
      validationTime: timings.validationTime,
      queryType,
      usedRAG: needsRAG && !skipRAGForShortEmotional,
      ragChunksFound: timings.ragChunksFound,
      skipRagReason: skipRAGForShortEmotional ? 'short_emotional' : 
                     !needsRAG ? 'casual' : null,
      userMessageLength: lastUserMessage.content.length,
      assistantMessageLength: assistantMessage.length,
      sessionMode: isSessionMode,
      sessionId: isSessionMode ? activeSession.sessionId : null,
      detectedReligion: detectedReligion
    }).catch(err => console.error('⚠️ Analytics logging failed:', err));

    // ================================================
    // CONCEPT MAPPING (Regular chat only, async)
    // ================================================
    if (!isSessionMode && isSubstantiveMessage(lastUserMessage.content) && savedMessage) {
      (async () => {
        try {
          const conceptStartTime = Date.now();
          console.log('🧠 Analyzing for concepts (async)...');
          
          const { data: recentMessages } = await supabase
            .from('messages')
            .select('content, sender')
            .eq('conversation_id', conversationId)
            .gte('timestamp', startOfToday)
            .order('timestamp', { ascending: false })
            .limit(4);
          
          const context = recentMessages
            ?.reverse()
            .map(m => `${m.sender}: ${m.content}`)
            .join('\n') || '';
          
          const concepts = await mapConceptsFromConversation(lastUserMessage.content, context);
          
          if (concepts.length > 0) {
            console.log('📊 Found:', concepts.map(c => `${c.concept_key}(${c.confidence})`).join(', '));
            
            await updateConceptMastery(userId, concepts, savedMessage.id);
            
            const conceptTime = Date.now() - conceptStartTime;
            console.log(`✅ Concepts tracked (async): ${conceptTime}ms`);
            
            await supabase
              .from('chat_analytics')
              .update({
                concepts_mapped: concepts.length,
                concept_keys: concepts.map(c => c.concept_key),
                concept_mapping_success: true,
                concept_mapping_time: conceptTime
              })
              .eq('conversation_id', conversationId)
              .gte('created_at', new Date(startTime).toISOString())
              .order('created_at', { ascending: false })
              .limit(1);
          } else {
            console.log('⏭️ No concepts detected');
          }
        } catch (error) {
          console.error('⚠️ Concept mapping failed (non-critical):', error);
        }
      })();
    }

    return res.status(200).json({ 
      message: assistantMessage,
      sessionActive: isSessionMode,
      sessionPhase: isSessionMode ? activeSession.phase : null
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}