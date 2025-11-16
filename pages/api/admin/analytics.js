import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_PASSWORD = 'ayutalks2024';

// Cost calculations (approximate)
const CLAUDE_HAIKU_COST_PER_1K_IN = 0.00025;
const CLAUDE_HAIKU_COST_PER_1K_OUT = 0.00125;
const OPENAI_EMBEDDING_COST_PER_1K = 0.00002;
const DEEPGRAM_COST_PER_MIN = 0.0043;

function calculateCosts(messages) {
  // Estimate costs based on message data
  const avgInputTokens = 200; // Avg user message + context
  const avgOutputTokens = 150; // Avg Ayu response
  const avgEmbeddingTokens = 50; // Avg for RAG query
  
  const claudeCost = messages * ((avgInputTokens / 1000 * CLAUDE_HAIKU_COST_PER_1K_IN) + 
                                 (avgOutputTokens / 1000 * CLAUDE_HAIKU_COST_PER_1K_OUT));
  
  return claudeCost;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all analytics data
    const { data: allData, error: fetchError } = await supabase
      .from('chat_analytics')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    // Calculate summary stats
    const summary = {
      total_messages: allData.length,
      avg_response_time: allData.reduce((sum, d) => sum + (d.total_response_time || 0), 0) / allData.length || 0,
      rag_used_count: allData.filter(d => d.used_rag).length,
      casual_messages: allData.filter(d => d.query_type === 'casual').length,
      emotional_messages: allData.filter(d => d.query_type === 'emotional').length,
      substantive_messages: allData.filter(d => d.query_type === 'substantive').length,
      successful_mappings: allData.filter(d => d.concept_mapping_success).length,
    };

    // ========== NEW: ERROR TRACKING ==========
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentData = allData.filter(d => new Date(d.created_at) >= last24Hours);
    
    const errors = {
      concept_mapping_failures: recentData.filter(d => 
        d.concepts_mapped > 0 && !d.concept_mapping_success
      ).length,
      claude_api_errors: 0, // Would need error logging in chat.js
      rag_no_results: recentData.filter(d => 
        d.used_rag && d.rag_chunks_found === 0
      ).length,
      database_errors: 0, // Would need error logging
      recent_errors: [] // Would need error log table
    };

    // ========== NEW: COST TRACKING ==========
    const todayData = allData.filter(d => new Date(d.created_at) >= todayStart);
    const weekData = allData.filter(d => new Date(d.created_at) >= weekStart);
    const monthData = allData.filter(d => new Date(d.created_at) >= monthStart);

    const todayClaude = calculateCosts(todayData.length);
    const todayOpenAI = todayData.filter(d => d.used_rag).length * (50 / 1000 * OPENAI_EMBEDDING_COST_PER_1K);
    const todayDeepgram = 0; // Would need voice usage tracking
    const todayTotal = todayClaude + todayOpenAI + todayDeepgram;

    const weekClaude = calculateCosts(weekData.length);
    const weekOpenAI = weekData.filter(d => d.used_rag).length * (50 / 1000 * OPENAI_EMBEDDING_COST_PER_1K);
    const weekDeepgram = 0;
    const weekTotal = weekClaude + weekOpenAI + weekDeepgram;

    const monthClaude = calculateCosts(monthData.length);
    const monthOpenAI = monthData.filter(d => d.used_rag).length * (50 / 1000 * OPENAI_EMBEDDING_COST_PER_1K);
    const monthDeepgram = 0;
    const monthTotal = monthClaude + monthOpenAI + monthDeepgram;

    // Get unique users (approximate - using conversation_id as proxy)
    const uniqueConversations = new Set(monthData.map(d => d.conversation_id)).size;
    const perUser = uniqueConversations > 0 ? monthTotal / uniqueConversations : 0;

    const costs = {
      today: todayTotal,
      week: weekTotal,
      month: monthTotal,
      per_user: perUser,
      claude: todayClaude,
      openai: todayOpenAI,
      deepgram: todayDeepgram,
      claude_pct: todayTotal > 0 ? Math.round((todayClaude / todayTotal) * 100) : 0,
      openai_pct: todayTotal > 0 ? Math.round((todayOpenAI / todayTotal) * 100) : 0,
      deepgram_pct: todayTotal > 0 ? Math.round((todayDeepgram / todayTotal) * 100) : 0,
    };

    // Get recent messages for table
    const recentMessages = allData.slice(0, 20).map(msg => ({
      timestamp: msg.created_at,
      message_type: msg.query_type,
      query_preview: msg.concept_keys && msg.concept_keys.length > 0 
        ? `Discussed: ${msg.concept_keys.join(', ')}` 
        : 'N/A',
      total_time: msg.total_response_time,
      used_rag: msg.used_rag,
      concepts_mapped: msg.concepts_mapped || 0
    }));

    return res.status(200).json({
      summary,
      errors,
      costs,
      recentMessages
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}