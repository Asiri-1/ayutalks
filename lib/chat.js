import { supabase } from './supabase'

// Save a message
export async function saveMessage(conversationId, sender, content) {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      sender: sender, // 'user' or 'ai'
      content: content,
      timestamp: new Date().toISOString()
    })
    .select()
  
  if (error) throw error
  return data[0]
}

// Get conversation history
export async function getConversationHistory(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true })
  
  if (error) throw error
  return data
}

// Create new conversation
export async function createConversation(title = 'New Chat') {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      title: title
    })
    .select()
  
  if (error) throw error
  return data[0]
}

// Get all user conversations
export async function getUserConversations() {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}