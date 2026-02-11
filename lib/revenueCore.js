const { supabase } = require('./supabase')

/**
 * Create or fetch a conversation by (platform, thread_id)
 */
async function upsertConversation({
  platform,
  threadId,
  userPsid,
  isHot = true
}) {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      {
        platform,
        thread_id: threadId,
        user_psid: userPsid,
        is_hot: isHot,
        last_message_at: new Date().toISOString()
      },
      {
        onConflict: 'platform,thread_id'
      }
    )
    .select()
    .single()

  if (error) {
    console.error('upsertConversation error:', error)
    throw error
  }

  return data
}

/**
 * Insert message and update conversation timestamps
 */
async function insertMessage({
  conversationId,
  platform,
  direction, // 'INBOUND' | 'OUTBOUND'
  text,
  metaMessageId,
  metaTimestamp,
  rawPayload
}) {
  // 1) Insert message
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      platform,
      direction,
      text,
      meta_message_id: metaMessageId || null,
      meta_timestamp: metaTimestamp || null,
      payload: rawPayload || {}
    })

  if (messageError) {
    console.error('insertMessage error:', messageError)
    throw messageError
  }

  // 2) Update conversation timestamps
  const now = new Date().toISOString()
  const updateFields = {
    last_message_at: now
  }

  if (direction === 'INBOUND') {
    updateFields.last_inbound_at = now
    updateFields.stage = 'NEW'
  }

  if (direction === 'OUTBOUND') {
    updateFields.last_outbound_at = now
  }

  const { error: convoError } = await supabase
    .from('conversations')
    .update(updateFields)
    .eq('id', conversationId)

  if (convoError) {
    console.error('conversation update error:', convoError)
    throw convoError
  }
}

module.exports = {
  upsertConversation,
  insertMessage
}

