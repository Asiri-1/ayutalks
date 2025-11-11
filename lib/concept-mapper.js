const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONCEPT_DEFINITIONS = {
  mind_as_process: "User understands mind is a process, not a thing that produces thoughts",
  you_are_not_thoughts: "User distinguishes between awareness and thought contents",
  feeling_tone_drives_reaction: "User notices pleasant feelings → wanting, unpleasant → resistance",
  six_sense_contact: "User recognizes experience comes through eyes, ears, nose, tongue, body, mind",
  auto_genesis: "User observes how thoughts create more thoughts automatically",
  impermanence: "User directly sees thoughts/emotions don't stay - everything changes",
  identity_as_thought: "User recognizes identity only exists in mental references to past/future",
  ego_mechanism: "User sees how ego creates attractions and resistance",
  poisonous_thoughts: "User understands thoughts outside present-neutral create disturbance",
  present_neutral_position: "User experiences being present without preference/judgment",
  thought_observation: "User notices thoughts arising without being pulled in",
  poison_recognition: "User identifies when thoughts create disturbance in the moment",
  functional_vs_compulsive: "User distinguishes practical thinking from rumination",
  equanimity: "User can be with pleasant/unpleasant without reactivity",
  present_awareness_is_happiness: "User recognizes present awareness IS happiness itself",
  freedom_from_seeking: "User no longer looks for happiness externally",
  stable_peace: "User experiences peace that doesn't depend on circumstances"
};

async function mapConceptsFromConversation(userMessage, conversationContext = '') {
  try {
    const prompt = `Analyze this conversation to identify psychological concepts the user demonstrates understanding of.

USER'S MESSAGE:
"${userMessage}"

${conversationContext ? `RECENT CONTEXT:\n${conversationContext}\n` : ''}

CONCEPTS:
${Object.entries(CONCEPT_DEFINITIONS).map(([key, def]) => `- ${key}: ${def}`).join('\n')}

For each detected concept, provide:
- concept_key
- confidence (0-10, only include if >= 4)
- evidence (brief quote)

Look for actual understanding, not just using similar words.

Respond ONLY with valid JSON:
{
  "concepts": [
    {"concept_key": "string", "confidence": number, "evidence": "string"}
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const result = JSON.parse(responseText);
    return result.concepts || [];

  } catch (error) {
    console.error('❌ Concept mapping error:', error);
    return [];
  }
}

function isSubstantiveMessage(message) {
  if (message.length < 15) return false;
  
  const casualPatterns = [
    /^(hi|hello|hey|good morning)/i,
    /^(just got to|arrived at)/i,
    /^(thanks|thank you|ok|okay)/i,
  ];
  
  return !casualPatterns.some(p => p.test(message.trim()));
}

module.exports = {
  mapConceptsFromConversation,
  isSubstantiveMessage
};