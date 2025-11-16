import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Log chat analytics for performance tracking and optimization
 */
export async function logChatAnalytics(data) {
  try {
    await supabase.from('chat_analytics').insert({
      user_id: data.userId,
      conversation_id: data.conversationId,
      
      // Performance metrics (milliseconds)
      total_response_time: data.totalTime || 0,
      rag_retrieval_time: data.ragTime || null,
      claude_api_time: data.claudeTime || 0,
      db_save_time: data.dbSaveTime || null,
      concept_mapping_time: data.conceptMappingTime || null,
      
      // Query classification
      query_type: data.queryType || 'unknown', // 'casual', 'emotional', 'substantive'
      used_rag: data.usedRAG || false,
      rag_chunks_found: data.ragChunksFound || 0,
      skip_rag_reason: data.skipRagReason || null,
      
      // Message metadata
      user_message_length: data.userMessageLength || 0,
      assistant_message_length: data.assistantMessageLength || 0,
      
      // Concept tracking
      concepts_mapped: data.conceptsTracked || 0,
      concept_keys: data.conceptKeys || [],
      concept_mapping_success: data.conceptMappingSuccess || false,
      concept_mapping_error: data.conceptMappingError || null,
      
      // Timestamp (using created_at, which has default NOW())
      // No need to set it explicitly
    });
    
    console.log('✅ Analytics logged successfully');
  } catch (error) {
    // Don't fail the request if analytics fail
    console.error('⚠️ Analytics logging failed:', error.message);
  }
}