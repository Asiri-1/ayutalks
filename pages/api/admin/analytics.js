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
  const avgInputTokens = 200;
  const avgOutputTokens = 150;
  
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

    // ========================================
    // EXISTING: Get all analytics data
    // ========================================
    const { data: allData, error: fetchError } = await supabase
      .from('chat_analytics')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    // ========================================
    // EXISTING: Calculate summary stats
    // ========================================
    const summary = {
      total_messages: allData.length,
      avg_response_time: allData.reduce((sum, d) => sum + (d.total_response_time || 0), 0) / allData.length || 0,
      rag_used_count: allData.filter(d => d.used_rag).length,
      casual_messages: allData.filter(d => d.query_type === 'casual').length,
      emotional_messages: allData.filter(d => d.query_type === 'emotional').length,
      substantive_messages: allData.filter(d => d.query_type === 'substantive').length,
      session_messages: allData.filter(d => d.query_type === 'session').length, // Added session type
      successful_mappings: allData.filter(d => d.concept_mapping_success).length,
    };

    // ========================================
    // EXISTING: Error tracking
    // ========================================
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentData = allData.filter(d => new Date(d.created_at) >= last24Hours);
    
    const errors = {
      concept_mapping_failures: recentData.filter(d => 
        d.concepts_mapped > 0 && !d.concept_mapping_success
      ).length,
      claude_api_errors: 0,
      rag_no_results: recentData.filter(d => 
        d.used_rag && d.rag_chunks_found === 0
      ).length,
      database_errors: 0,
      recent_errors: []
    };

    // ========================================
    // EXISTING: Cost tracking
    // ========================================
    const todayData = allData.filter(d => new Date(d.created_at) >= todayStart);
    const weekData = allData.filter(d => new Date(d.created_at) >= weekStart);
    const monthData = allData.filter(d => new Date(d.created_at) >= monthStart);

    const todayClaude = calculateCosts(todayData.length);
    const todayOpenAI = todayData.filter(d => d.used_rag).length * (50 / 1000 * OPENAI_EMBEDDING_COST_PER_1K);
    const todayDeepgram = 0;
    const todayTotal = todayClaude + todayOpenAI + todayDeepgram;

    const weekClaude = calculateCosts(weekData.length);
    const weekOpenAI = weekData.filter(d => d.used_rag).length * (50 / 1000 * OPENAI_EMBEDDING_COST_PER_1K);
    const weekDeepgram = 0;
    const weekTotal = weekClaude + weekOpenAI + weekDeepgram;

    const monthClaude = calculateCosts(monthData.length);
    const monthOpenAI = monthData.filter(d => d.used_rag).length * (50 / 1000 * OPENAI_EMBEDDING_COST_PER_1K);
    const monthDeepgram = 0;
    const monthTotal = monthClaude + monthOpenAI + monthDeepgram;

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

    // ========================================
    // EXISTING: Recent messages
    // ========================================
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

    // ============================================
    // NEW: USER JOURNEY TRACKING
    // ============================================
    
    // Get user message counts from messages table
    const { data: userMessages } = await supabase
      .from('messages')
      .select('user_id, timestamp')
      .eq('sender', 'user')
      .not('user_id', 'is', null);

    const userEngagement = {};
    const userFirstMessage = {};
    const userLastMessage = {};
    
    userMessages?.forEach(msg => {
      if (!userEngagement[msg.user_id]) {
        userEngagement[msg.user_id] = 0;
        userFirstMessage[msg.user_id] = msg.timestamp;
        userLastMessage[msg.user_id] = msg.timestamp;
      }
      userEngagement[msg.user_id]++;
      
      if (new Date(msg.timestamp) < new Date(userFirstMessage[msg.user_id])) {
        userFirstMessage[msg.user_id] = msg.timestamp;
      }
      if (new Date(msg.timestamp) > new Date(userLastMessage[msg.user_id])) {
        userLastMessage[msg.user_id] = msg.timestamp;
      }
    });

    // Calculate engagement levels
    const engagementLevels = {
      onboarding: 0,      // 1-5 messages
      building: 0,        // 6-20 messages
      engaged: 0,         // 21-50 messages
      deep: 0            // 50+ messages
    };

    const userLifecycle = {
      new_week: 0,
      new_month: 0,
      returning: 0,
      at_risk: 0
    };

    // Get active users breakdown
    const todayUsers = new Set();
    const weekUsers = new Set();
    const monthUsers = new Set();

    Object.keys(userEngagement).forEach(userId => {
      const count = userEngagement[userId];
      const firstMsg = new Date(userFirstMessage[userId]);
      const lastMsg = new Date(userLastMessage[userId]);
      
      // Engagement levels
      if (count <= 5) engagementLevels.onboarding++;
      else if (count <= 20) engagementLevels.building++;
      else if (count <= 50) engagementLevels.engaged++;
      else engagementLevels.deep++;

      // Lifecycle
      if (firstMsg > weekStart) userLifecycle.new_week++;
      else if (firstMsg > monthStart) userLifecycle.new_month++;
      else if (lastMsg > weekStart) userLifecycle.returning++;
      else userLifecycle.at_risk++;

      // Active users
      if (lastMsg >= todayStart) todayUsers.add(userId);
      if (lastMsg >= weekStart) weekUsers.add(userId);
      if (lastMsg >= monthStart) monthUsers.add(userId);
    });

    // ============================================
    // NEW: CONCEPT MASTERY ANALYTICS
    // ============================================
    
    const { data: conceptMastery } = await supabase
      .from('user_concept_mastery')
      .select('user_id, concept_key, understanding_level, encounter_count');

    const { data: concepts } = await supabase
      .from('knowledge_concepts')
      .select('concept_key, concept_name, difficulty_level');

    const conceptStats = {};
    concepts?.forEach(concept => {
      conceptStats[concept.concept_key] = {
        name: concept.concept_name,
        difficulty: concept.difficulty_level,
        userCount: 0,
        totalUnderstanding: 0,
        totalEncounters: 0
      };
    });

    conceptMastery?.forEach(cm => {
      if (conceptStats[cm.concept_key]) {
        conceptStats[cm.concept_key].userCount++;
        conceptStats[cm.concept_key].totalUnderstanding += cm.understanding_level || 0;
        conceptStats[cm.concept_key].totalEncounters += cm.encounter_count || 0;
      }
    });

    const conceptAnalytics = Object.values(conceptStats)
      .map(c => ({
        ...c,
        avgMastery: c.userCount > 0 ? ((c.totalUnderstanding / c.userCount) / 8 * 100).toFixed(0) : 0, // Convert 1-8 scale to percentage
        avgEncounters: c.userCount > 0 ? (c.totalEncounters / c.userCount).toFixed(1) : 0
      }))
      .sort((a, b) => b.userCount - a.userCount);

    // Users ready for MindValuation (3+ concepts at level 4+)
    const { data: userMasteryLevels } = await supabase
      .from('user_concept_mastery')
      .select('user_id, understanding_level')
      .gte('understanding_level', 4);

    const userReadiness = {};
    userMasteryLevels?.forEach(um => {
      userReadiness[um.user_id] = (userReadiness[um.user_id] || 0) + 1;
    });

    const readyUsers = Object.values(userReadiness).filter(count => count >= 3).length;
    const totalUsers = Object.keys(userEngagement).length;

    // ============================================
    // NEW: QUALITY MONITORING (Last 7 days)
    // ============================================
    
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: recentAyuMessages } = await supabase
      .from('messages')
      .select('content, timestamp')
      .eq('sender', 'assistant')
      .gte('timestamp', sevenDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(200);

    const qualityIssues = {
      aiReveals: 0,
      numberedLists: 0,
      religiousTerms: 0,
      totalReviewed: recentAyuMessages?.length || 0
    };

    const aiRevealPatterns = [
      /\bI'?m an AI\b/i,
      /\bI'?m artificial\b/i,
      /\bas an AI\b/i,
      /\bAI assistant\b/i,
      /\blanguage model\b/i
    ];

    const religiousTerms = [
      /\bdukkha\b/i,
      /\bnibbana\b/i,
      /\babhidhamma\b/i,
      /\bbuddhist\b/i,
      /\benlightenment\b/i,
      /\bkarma\b/i
    ];

    recentAyuMessages?.forEach(msg => {
      const content = msg.content || '';
      
      if (aiRevealPatterns.some(pattern => pattern.test(content))) {
        qualityIssues.aiReveals++;
      }
      
      if (/^\d+\.\s/m.test(content)) {
        qualityIssues.numberedLists++;
      }
      
      if (religiousTerms.some(pattern => pattern.test(content))) {
        qualityIssues.religiousTerms++;
      }
    });

    const qualityScore = (
      100 - 
      (qualityIssues.aiReveals * 10) - 
      (qualityIssues.numberedLists * 2) - 
      (qualityIssues.religiousTerms * 5)
    ).toFixed(1);

    // ============================================
    // RETURN COMPLETE ANALYTICS
    // ============================================

    return res.status(200).json({
      // EXISTING DATA
      summary,
      errors,
      costs,
      recentMessages,
      
      // NEW DATA
      userJourney: {
        activeUsers: {
          today: todayUsers.size,
          week: weekUsers.size,
          month: monthUsers.size,
          total: totalUsers
        },
        engagementLevels,
        lifecycle: userLifecycle,
        readiness: {
          readyForAssessment: readyUsers,
          totalUsers: totalUsers,
          readinessRate: totalUsers > 0 ? ((readyUsers / totalUsers) * 100).toFixed(1) : 0
        }
      },
      
      conceptAnalytics: {
        topEngaged: conceptAnalytics.slice(0, 5),
        allConcepts: conceptAnalytics,
        summary: {
          totalConcepts: concepts?.length || 0,
          conceptsEngaged: conceptAnalytics.filter(c => c.userCount > 0).length,
          avgMasteryAcrossAll: (
            (conceptAnalytics.reduce((sum, c) => sum + parseFloat(c.avgMastery), 0) / 
            (conceptAnalytics.filter(c => c.userCount > 0).length || 1))
          ).toFixed(2)
        }
      },
      
      quality: {
        issues: qualityIssues,
        qualityScore: qualityScore,
        status: qualityIssues.aiReveals > 0 ? 'NEEDS_REVIEW' : 'HEALTHY'
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}