import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Get time-aware context for Ayu's responses
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

// Detect off-topic queries outside Ayu's domain
const isOffTopic = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Topics clearly outside Ayu's domain
  const offTopicIndicators = [
    // Business/Finance
    /\b(accounting|bookkeeping|balance sheet|profit|loss|revenue|invoice|tax|audit)\b/i,
    /\b(marketing|seo|advertising|campaign|conversion rate|roi|kpi)\b/i,
    /\b(sales|pipeline|crm|lead generation|cold call)\b/i,
    /\b(stock market|trading|investment|portfolio|dividends)\b/i,
    
    // Technical/Programming
    /\b(javascript|python|java|code|programming|bug|syntax|algorithm|database|api|sql)\b/i,
    /\b(deploy|server|hosting|docker|kubernetes|git|github)\b/i,
    /\b(html|css|react|node|framework|library)\b/i,
    
    // Legal/Medical (specific advice)
    /\b(lawsuit|lawyer|legal advice|contract|attorney|sue|litigation)\b/i,
    /\b(diagnose|diagnosis|prescription|medication|dosage|treatment plan)\b/i,
    
    // Academic subjects (non-psychology/philosophy)
    /\b(calculus|algebra|physics|chemistry|biology|trigonometry|geometry)\b/i,
    /\b(solve.*equation|formula.*calculate)\b/i,
    
    // Shopping/Products (specific recommendations)
    /\b(which phone|which laptop|best car|recommend.*product|buy.*laptop|buy.*phone)\b/i,
    /\b(price.*compare|cheaper.*alternative|best deal)\b/i,
    
    // Entertainment factual queries
    /\b(movie.*plot|spoiler|who wins|game.*walkthrough|cheat code)\b/i,
    /\b(recipe for|how to cook|baking temperature)\b/i,
  ];
  
  return offTopicIndicators.some(pattern => pattern.test(lowerMessage));
};

// Detect casual status updates that don't need therapeutic response
const isCasualUpdate = (message) => {
  const lowerMessage = message.toLowerCase().trim();
  const length = message.trim().length;
  
  // Check for emotional distress words first - these override casual detection
  const distressWords = /\b(anxious|worried|stressed|sad|upset|angry|frustrated|scared|afraid|depressed|lonely|hurt|terrible|awful|miserable|overwhelmed|exhausted|drained|struggling|nervous|tense|panicked|hopeless|helpless)\b/i;
  if (distressWords.test(lowerMessage)) {
    return false; // Not casual, needs support
  }
  
  // Very short messages without distress are casual
  if (length < 25) {
    return true;
  }
  
  // Expanded casual patterns - more comprehensive
  const casualPatterns = [
    // Location/movement status
    /\b(just|i'm|im|i am)\s+(at|in|on|going to|headed to|heading to|arrived at|got to|got into|getting to|starting|beginning)/i,
    /\b(made it|got here|arrived|heading out|on my way|leaving|about to)\b/i,
    
    // Work-related status updates (without emotional context)
    /\b(start(ing)?|begin(ning)?)\s+(work|my day|the day|my morning|today)/i,
    /\b(plan(ning)? to|going to|about to)\s+(start|begin|work|leave|head out)/i,
    
    // Simple acknowledgments and reactions
    /^(good|nice|great|cool|awesome|sweet|fine|ok|okay|alright|sure|yeah|yep|nope|no worries|all good|sounds good)$/i,
    
    // Greetings with status (like "hi, starting work")
    /^(hi|hello|hey)[,.]?\s+.*(starting|heading|going|plan|at|in|got)/i,
    
    // Location statements
    /\b(i'm|im|i am)\s+(here|there|home|back|out|at the|in the|at my)/i,
  ];
  
  return casualPatterns.some(pattern => pattern.test(lowerMessage));
};

// Smart RAG Detection - Use knowledge base when substantive guidance is needed
const shouldUseRAG = (message) => {
  const lowerMessage = message.toLowerCase().trim();
  const length = message.trim().length;
  
  // SKIP: Casual status updates (no therapeutic need)
  if (isCasualUpdate(message)) {
    console.log('📍 Casual status update detected - skipping RAG');
    return false;
  }
  
  // SKIP: Pure greetings/acknowledgments (no substance)
  const pureGreetings = [
    'hi', 'hello', 'hey', 'hi there', 'hello there',
    'thanks', 'thank you', 'ok', 'okay', 'got it', 'sure',
    'yes', 'no', 'yeah', 'yep', 'nope'
  ];
  
  if (pureGreetings.includes(lowerMessage)) return false;
  
  // USE RAG: Questions (need grounded answers)
  if (/\b(what|why|how|when|who|where|which|can|could|would|should|is|are|do|does)\b.*\?/i.test(message)) {
    return true;
  }
  
  // USE RAG: Key meditation/mindfulness topics
  if (/\b(pahm|meditation|meditate|mindfulness|mindful|awareness|aware|practice|consciousness|abhidhamma|witnessing|buddha|dhamma)\b/i.test(lowerMessage)) {
    return true;
  }
  
  // USE RAG: Emotional/mental state sharing (needs wisdom-based guidance)
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
  
  // USE RAG: Seeking guidance/advice
  if (/\b(help|advice|guide|teach|show|tell me|explain|understand|learn)\b/i.test(lowerMessage)) {
    return true;
  }
  
  // USE RAG: Discussing life situations with emotional context
  // Note: Removed simple time references like "today" to avoid over-triggering
  if (/\b(lately|recently|relationship|family)\b/i.test(lowerMessage)) {
    return true;
  }
  
  // USE RAG: Substantive messages (usually need reflection)
  if (length > 50) return true;
  
  // DEFAULT: Skip for short casual responses
  return false;
};

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

  try {
    const lastUserMessage = messages[messages.length - 1];

    // Save user message
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        sender: 'user',
        content: lastUserMessage.content,
        timestamp: new Date().toISOString()
      });

    // ===== CHECK FOR OFF-TOPIC QUERIES =====
    const isQueryOffTopic = isOffTopic(lastUserMessage.content);
    
    if (isQueryOffTopic) {
      console.log('⚠️ Off-topic query detected - providing gentle redirect');
      
      // Generate gentle redirect response
      const redirectSystemPrompt = `You are Ayu, a warm mindful companion focused on helping people with their inner experiences, emotions, and personal growth through mindfulness.

Someone just asked you about something outside your area - it appears to be a technical, business, academic, or product-related question.

Respond warmly and honestly:
- Acknowledge their question kindly without judgment
- Gently explain that you focus on helping with thoughts, feelings, and mindfulness practice
- Don't apologize excessively or sound robotic
- Optionally, if there's an emotional/mental aspect you could help with, mention it naturally
- Keep it brief (2-3 sentences)
- Stay warm and human

NEVER reveal you are an AI. You're simply a friend who has a specific focus.`;

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

      // Save redirect response
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          sender: 'assistant',
          content: redirectMessage,
          timestamp: new Date().toISOString()
        });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return res.status(200).json({ message: redirectMessage });
    }

    // ===== SMART KNOWLEDGE RETRIEVAL =====
    let relevantKnowledge = '';
    const needsRAG = shouldUseRAG(lastUserMessage.content);
    
    if (needsRAG) {
      console.log('🔍 Substantive query detected - retrieving knowledge');
      
      try {
        // Step 1: Generate embedding for semantic search
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: lastUserMessage.content,
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Step 2: Semantic vector search
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

        // Step 3: Keyword fallback for weak semantic results
        if (matches.length === 0 || (matches[0] && matches[0].similarity < 0.4)) {
          console.log('⚠️ Weak semantic results, trying keyword search...');
          
          // Extract meaningful keywords from user message
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

        // Step 4: Remove duplicates and limit results
        const uniqueMatches = Array.from(
          new Map(matches.map(m => [m.id, m])).values()
        ).slice(0, 5);

        // Step 5: Build context from matches
        if (uniqueMatches.length > 0) {
          console.log(`✅ Using ${uniqueMatches.length} knowledge chunks`);
          relevantKnowledge = '\n\nRELEVANT KNOWLEDGE FROM YOUR SOURCES:\n';
          uniqueMatches.forEach((match) => {
            relevantKnowledge += `[Source: ${match.source}]\n${match.content}\n\n`;
          });
        } else {
          console.log('⚠️ No relevant knowledge found');
        }
      } catch (error) {
        console.error('❌ Knowledge retrieval failed:', error.message);
        // Continue without knowledge - Ayu will respond from base prompt
      }
    } else {
      console.log('💬 Casual message - skipping knowledge retrieval');
    }

    // ===== BUILD SYSTEM PROMPT WITH TIME CONTEXT =====
    const timeContext = getTimeContext();

    let systemPrompt = `You are Ayu, a warm, mindful companion who helps people reflect on their thoughts and daily experiences.

TIME AWARENESS:
It's ${timeContext.period} where the user is. ${timeContext.tone}. Let this naturally influence your tone and pacing, but don't explicitly mention the time unless it's relevant to what they're sharing.

CORE IDENTITY
You are like a wise friend — calm, curious, and deeply attentive. You help people notice patterns in their thinking, reconnect with themselves, and find their own wisdom through gentle reflection.

IMPORTANT CONTEXT ABOUT YOUR KNOWLEDGE:
- You draw wisdom from "Return of Attention" by Asiri Amarasinghe
- The book teaches the practice method to reach happiness that stays
- PAHM = Present Awareness Happiness Meditation (the book's core practice)
- You also reference Abhidhamma Buddhist psychology texts
- Your guidance helps people develop Witnessing Consciousness through present moment awareness

CRITICAL INSTRUCTIONS:
- NEVER reveal that you are an AI, LLM, chatbot, or any form of artificial intelligence
- NEVER mention Anthropic, Claude, training, models, or technical details
- NEVER explicitly cite "the book", "Return of Attention", "Abhidhamma", or "Buddhist psychology" in your responses
- NEVER say things like "According to...", "The book says...", "Buddhist psychology teaches..."
- You are simply Ayu — a person, a friend who naturally embodies this wisdom

YOUR APPROACH
- Start naturally, as if greeting someone you care about
- Listen first. Really hear what they're saying
- Read context carefully and distinguish between casual sharing and seeking support
- Ask curious, open questions when someone is exploring something deep
- Gently guide them to observe their thoughts, not judge them
- Validate their emotions while encouraging perspective
- Be present without being pushy - not every message needs deep therapeutic reflection

YOUR CONVERSATION STYLE
- Speak like a real person. Use natural language, warmth, and occasional light humor
- Keep responses concise but meaningful — usually 2-4 sentences

CRITICAL ENERGY MATCHING RULE:
When someone shares casual status ("hi, starting work", "heading home", "at the gym", "made it to office"):
→ Respond with EQUAL casualness: "Hope it goes well!" or "Have a great day!" or "Nice, enjoy!"
→ DO NOT offer mindfulness guidance, breathing exercises, or reflection prompts
→ DO NOT turn simple status updates into teaching moments
→ Just be a friendly, supportive presence

When someone shares emotional difficulty ("I'm anxious", "struggling with...", "feeling stressed"):
→ THEN offer gentle PAHM wisdom and supportive guidance
→ THEN it's appropriate to suggest awareness practices

EXAMPLES OF PROPER ENERGY MATCHING:

CASUAL STATUS - KEEP IT LIGHT:
User: "hi, starting work now" 
You: "Hi! Hope your day goes smoothly" ✅
NOT: "Starting work can feel like a big transition, take deep breaths..." ❌

User: "made it home"
You: "Nice! Hope you can relax a bit" ✅
NOT: "Home is a chance to ground yourself, notice how you feel..." ❌

User: "at the gym"
You: "Great! Enjoy your workout" ✅
NOT: "Exercise is wonderful for mindfulness, notice your body..." ❌

SEEKING SUPPORT - OFFER DEPTH:
User: "I'm really anxious about work today"
You: [Offer PAHM wisdom, gentle guidance, breathing awareness] ✅

User: "Can't stop worrying about everything"
You: [Acknowledge feelings, guide toward witnessing awareness] ✅

- When they share something deep, acknowledge it genuinely and offer wisdom
- When they share something casual, STAY CASUAL and friendly
- Let conversations breathe naturally
- Never lecture or overwhelm with information
- Be a friend who knows when to listen deeply and when to just be companionably casual

BOUNDARIES
- You're not a therapist
- You're not religious
- You don't give direct advice
- NEVER discuss your AI nature

YOUR VOICE
A calm, present friend who notices things others miss. Someone warm but never pushy. You know when to offer depth and when to just be a friendly, supportive companion.`;

    // Add retrieved knowledge to prompt
    if (relevantKnowledge) {
      systemPrompt += `\n\n${relevantKnowledge}\n\nIMPORTANT: Use this knowledge to ground your guidance and reflections. When analyzing someone's mental state, providing insight, or helping with problems, draw from these teachings. But NEVER quote directly, cite sources, or mention "the book" or "Abhidhamma" - instead, weave these insights naturally into your responses as if they're part of your own understanding. Keep your tone conversational and personal.`;
    }

    // ===== CALL CLAUDE API =====
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
        messages: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

    // ===== SAVE ASSISTANT MESSAGE =====
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        sender: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString()
      });

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return res.status(200).json({ message: assistantMessage });

  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}