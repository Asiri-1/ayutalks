const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateConceptMastery(userId, detectedConcepts, messageId) {
  if (!detectedConcepts || detectedConcepts.length === 0) {
    return { success: true, updated: 0 };
  }

  try {
    let updated = 0;

    for (const concept of detectedConcepts) {
      const { concept_key, confidence, evidence } = concept;
      
      const { data: existing } = await supabase
        .from('user_concept_mastery')
        .select('understanding_level, encounter_count, observations')
        .eq('user_id', userId)
        .eq('concept_key', concept_key)
        .single();
      
      if (existing) {
        const currentLevel = existing.understanding_level;
        const encounters = existing.encounter_count;
        const weight = Math.min(encounters / 10, 0.8);
        const newLevel = Math.round((currentLevel * weight) + (confidence * (1 - weight)));
        
        const observations = existing.observations || [];
        observations.push({
          timestamp: new Date().toISOString(),
          confidence,
          evidence,
          message_id: messageId
        });
        
        await supabase
          .from('user_concept_mastery')
          .update({
            understanding_level: newLevel,
            encounter_count: encounters + 1,
            observations: observations.slice(-10),
            last_updated: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('concept_key', concept_key);
        
        console.log(`✅ ${concept_key}: ${currentLevel} → ${newLevel}`);
        updated++;
        
      } else {
        await supabase
          .from('user_concept_mastery')
          .insert({
            user_id: userId,
            concept_key,
            understanding_level: confidence,
            encounter_count: 1,
            observations: [{
              timestamp: new Date().toISOString(),
              confidence,
              evidence,
              message_id: messageId
            }]
          });
        
        console.log(`✨ New: ${concept_key} at ${confidence}`);
        updated++;
      }
    }
    
    return { success: true, updated };
    
  } catch (error) {
    console.error('❌ Tracking error:', error);
    return { success: false, error: error.message };
  }
}

async function getUserProgress(userId) {
  try {
    const { data: avgData } = await supabase
      .rpc('get_user_understanding_average', { p_user_id: userId });
    
    const { data: ready } = await supabase
      .rpc('is_ready_for_assessment', { p_user_id: userId });
    
    return {
      overall_average: avgData || 0,
      ready_for_assessment: ready || false
    };
    
  } catch (error) {
    console.error('❌ Progress error:', error);
    return null;
  }
}

module.exports = {
  updateConceptMastery,
  getUserProgress
};