import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get summary from last 7 days
    const { data: summary } = await supabase
      .from('analytics_summary')
      .select('*')
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false });

    // Aggregate summary
    const aggregated = {
      total_messages: 0,
      avg_response_time: 0,
      avg_rag_time: 0,
      avg_claude_time: 0,
      rag_used_count: 0,
      successful_mappings: 0,
      casual_messages: 0,
      emotional_messages: 0,
      substantive_messages: 0,
      avg_concepts_per_message: 0
    };

    summary?.forEach(day => {
      aggregated.total_messages += day.total_messages || 0;
      aggregated.avg_response_time += (day.avg_response_time || 0) * (day.total_messages || 0);
      aggregated.avg_rag_time += (day.avg_rag_time || 0) * (day.total_messages || 0);
      aggregated.avg_claude_time += (day.avg_claude_time || 0) * (day.total_messages || 0);
      aggregated.rag_used_count += day.rag_used_count || 0;
      aggregated.successful_mappings += day.successful_mappings || 0;
      aggregated.casual_messages += day.casual_messages || 0;
      aggregated.emotional_messages += day.emotional_messages || 0;
      aggregated.substantive_messages += day.substantive_messages || 0;
    });

    if (aggregated.total_messages > 0) {
      aggregated.avg_response_time = Math.round(aggregated.avg_response_time / aggregated.total_messages);
      aggregated.avg_rag_time = Math.round(aggregated.avg_rag_time / aggregated.total_messages);
      aggregated.avg_claude_time = Math.round(aggregated.avg_claude_time / aggregated.total_messages);
      aggregated.mapping_success_rate = Math.round((aggregated.successful_mappings / aggregated.total_messages) * 100);
    }

    // Get concept distribution
    const { data: conceptData } = await supabase
      .from('chat_analytics')
      .select('concept_keys')
      .not('concept_keys', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const conceptDistribution = {};
    conceptData?.forEach(row => {
      row.concept_keys?.forEach(key => {
        conceptDistribution[key] = (conceptDistribution[key] || 0) + 1;
      });
    });

    // Generate insights
    const insights = generateInsights(aggregated, conceptDistribution);

    return res.status(200).json({
      summary: aggregated,
      daily: summary,
      concepts: conceptDistribution,
      insights
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}

function generateInsights(summary, concepts) {
  const insights = [];

  // Performance insights
  if (summary.avg_response_time > 5000) {
    insights.push('⚠️ Response times are slower than optimal (>5s). Consider optimizing RAG or caching.');
  } else if (summary.avg_response_time < 3000) {
    insights.push('✅ Excellent response times! System is performing well.');
  }

  // RAG usage insights
  const ragUsagePercent = (summary.rag_used_count / summary.total_messages) * 100;
  if (ragUsagePercent < 30) {
    insights.push(`📊 RAG used in only ${ragUsagePercent.toFixed(0)}% of messages. Most conversations are casual - this is normal.`);
  } else if (ragUsagePercent > 70) {
    insights.push(`🔍 High RAG usage (${ragUsagePercent.toFixed(0)}%). Users are seeking deep guidance.`);
  }

  // Concept insights
  const topConcept = Object.entries(concepts).sort((a, b) => b[1] - a[1])[0];
  if (topConcept) {
    insights.push(`🎯 Most explored concept: "${topConcept[0].replace(/_/g, ' ')}" (${topConcept[1]} times)`);
  }

  // Message type insights
  if (summary.emotional_messages > summary.substantive_messages) {
    insights.push('💙 More emotional support messages than substantive - users are seeking comfort.');
  }

  return insights.join('\n');
}