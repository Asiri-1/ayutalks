// Message batching system to prevent duplicate responses
// Handles rapid voice input by combining messages

const messageQueues = new Map();

export function shouldBatchMessage(userId, message) {
  const now = Date.now();
  
  // Initialize queue for new users
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, {
      messages: [],
      lastMessageTime: now,
      processingTimeout: null
    });
  }
  
  const queue = messageQueues.get(userId);
  
  // If more than 3 seconds since last message, don't batch (user finished speaking)
  if (now - queue.lastMessageTime > 3000) {
    queue.messages = [message];
    queue.lastMessageTime = now;
    return { shouldBatch: false, batchedMessage: message };
  }
  
  // Add to batch
  queue.messages.push(message);
  queue.lastMessageTime = now;
  
  // If we have multiple messages within 3 seconds, batch them
  if (queue.messages.length > 1) {
    const batchedMessage = queue.messages.join(' ').trim();
    queue.messages = []; // Clear queue
    return { shouldBatch: true, batchedMessage };
  }
  
  return { shouldBatch: false, batchedMessage: message };
}

export function clearUserQueue(userId) {
  messageQueues.delete(userId);
}