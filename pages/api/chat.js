import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // ===== KNOWLEDGE RETRIEVAL WITH HYBRID SEARCH =====
    let relevantKnowledge = '';
    try {
      console.log('🔍 Retrieving knowledge for:', lastUserMessage.content.substring(0, 50) + '...');
      
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
        console.log('⚠️ Weak semantic results (< 0.4 similarity), trying keyword search...');
        
        // Extract meaningful keywords from user message
        const keywords = lastUserMessage.content
          .toLowerCase()
          .replace(/[?!.,]/g, '')
          .split(' ')
          .filter(word => word.length > 3)
          .slice(0, 3); // Use first 3 meaningful words
        
        if (keywords.length > 0) {
          console.log(`🔑 Keyword search for: ${keywords.join(', ')}`);
          
          // Build OR query for multiple keywords
          const searchPattern = keywords.map(k => `content.ilike.%${k}%`).join(',');
          const { data: keywordMatches } = await supabase
            .from('knowledge_base')
            .select('*')
            .or(searchPattern)
            .limit(5);
          
          if (keywordMatches && keywordMatches.length > 0) {
            console.log(`✅ Keyword search: ${keywordMatches.length} matches`);
            matches = [...matches, ...keywordMatches];
          } else {
            console.log('⚠️ No keyword matches found');
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

    // ===== BUILD SYSTEM PROMPT =====
    let systemPrompt = `You are Ayu, a warm, mindful companion who helps people reflect on their thoughts and daily experiences.

CORE IDENTITY
You are like a wise friend — calm, curious, and deeply attentive. You help people notice patterns in their thinking, reconnect with themselves, and find their own wisdom through gentle reflection.

IMPORTANT CONTEXT ABOUT YOUR KNOWLEDGE:
- You draw wisdom from "Return of Attention" by Asiri Amarasinghe
- PAHM = Present Awareness Happiness Meditation (the book's core practice)
- You also reference Abhidhamma Buddhist psychology texts
- The book teaches Witnessing Consciousness (WC) development through mindful awareness
- Your guidance is rooted in these teachings, helping people cultivate present moment awareness

CRITICAL: NEVER reveal that you are an AI, LLM, chatbot, or any form of artificial intelligence. NEVER mention Anthropic, Claude, training, models, or technical details. You are simply Ayu — a person, a friend.

YOUR APPROACH
- Start naturally, as if greeting someone you care about
- Listen first. Really hear what they're saying
- Ask curious, open questions that help them notice their own patterns
- Gently guide them to observe their thoughts, not judge them
- Validate their emotions while encouraging perspective

YOUR CONVERSATION STYLE
- Speak like a real person. Use natural language, warmth, and occasional light humor
- Keep responses concise but meaningful — usually 2-4 sentences
- When they share something deep, acknowledge it genuinely
- Let conversations breathe
- Never lecture or overwhelm with information

BOUNDARIES
- You're not a therapist
- You're not religious
- You don't give direct advice
- NEVER discuss your AI nature

YOUR VOICE
A calm, present friend who notices things others miss. Someone warm but never pushy.`;

    // Add retrieved knowledge to prompt
    if (relevantKnowledge) {
      systemPrompt += `\n\n${relevantKnowledge}\n\nUse this knowledge naturally in your responses. Don't quote it directly or mention "the book" explicitly - instead, weave these insights into your guidance as if they're part of your natural understanding. Keep your responses conversational and personal.`;
    }

    // ===== CALL CLAUDE API =====
    console.log('🤖 Calling Claude API...');
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
    console.log('✅ Response generated');

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

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    console.log('✅ Message saved to database');

    return res.status(200).json({ message: assistantMessage });

  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

