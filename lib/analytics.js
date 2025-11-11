import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function logChatAnalytics(data) {
  try {
    const { error } = await supabase.from('chat_analytics').insert({
      user_id: data.userId,
      conversation_id: data.conversationId,
      total_response_time: data.totalTime,
      rag_retrieval_time: data.ragTime || null,
      claude_api_time: data.claudeTime,
      db_save_time: data.dbSaveTime,
      concept_mapping_time: data.conceptMappingTime || null,
      query_type: data.queryType,
      used_rag: data.usedRAG,
      rag_chunks_found: data.ragChunksFound || 0,
      skip_rag_reason: data.skipRagReason || null,
      concepts_mapped: data.conceptsMapped || 0,
      concept_keys: data.conceptKeys || [],
      concept_mapping_success: data.conceptMappingSuccess || false,
      concept_mapping_error: data.conceptMappingError || null,
      user_message_length: data.userMessageLength,
      assistant_message_length: data.assistantMessageLength
    });

    if (error) throw error;
    console.log('✅ Analytics logged successfully');
  } catch (error) {
    console.error('⚠️ Analytics logging failed:', error.message);
  }
}
