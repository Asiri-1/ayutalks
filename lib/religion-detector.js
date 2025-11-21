// Detect user's religious context from conversation

export function detectReligion(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) {
    return null;
  }
  
  // Check recent messages (last 20)
  const recentText = conversationHistory
    .slice(-20)
    .map(m => m.content)
    .join(' ')
    .toLowerCase();
  
  // Islamic indicators
  const islamicTerms = ['allah', 'muslim', 'islam', 'quran', 'mosque', 'prayer', 'salah', 'ramadan', 'inshallah', 'mashallah'];
  if (islamicTerms.some(term => recentText.includes(term))) {
    return 'muslim';
  }
  
  // Christian indicators
  const christianTerms = ['jesus', 'christ', 'christian', 'church', 'bible', 'lord', 'god bless'];
  if (christianTerms.some(term => recentText.includes(term))) {
    return 'christian';
  }
  
  // Hindu indicators
  const hinduTerms = ['hindu', 'hinduism', 'temple', 'puja', 'krishna', 'shiva', 'ganesh', 'namaste'];
  if (hinduTerms.some(term => recentText.includes(term))) {
    return 'hindu';
  }
  
  // Buddhist indicators
  const buddhistTerms = ['buddhist', 'buddhism', 'dharma', 'sangha'];
  if (buddhistTerms.some(term => recentText.includes(term))) {
    return 'buddhist';
  }
  
  return null;
}