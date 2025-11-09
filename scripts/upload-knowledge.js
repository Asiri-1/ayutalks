// Load environment variables FIRST
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const mammoth = require('mammoth');
const fs = require('fs').promises;

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chunk text into smaller pieces
function chunkText(text, maxChunkSize = 1000) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate embedding for text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Upload a chunk to Supabase
async function uploadChunk(source, title, content, chunkIndex, metadata = {}) {
  try {
    console.log(`Generating embedding for chunk ${chunkIndex}...`);
    const embedding = await generateEmbedding(content);
    
    console.log(`Uploading chunk ${chunkIndex} to database...`);
    const { error } = await supabase
      .from('knowledge_base')
      .insert({
        source,
        title,
        content,
        chunk_index: chunkIndex,
        embedding,
        metadata,
      });
    
    if (error) throw error;
    console.log(`✅ Chunk ${chunkIndex} uploaded successfully`);
  } catch (error) {
    console.error(`❌ Error uploading chunk ${chunkIndex}:`, error);
    throw error;
  }
}

// Process Word document
async function processWordDoc(filePath, source, title) {
  console.log(`\n📖 Processing document: ${title}`);
  
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    console.log(`Document length: ${text.length} characters`);
    
    const chunks = chunkText(text);
    console.log(`Split into ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      await uploadChunk(source, title, chunks[i], i, { 
        filePath,
        totalChunks: chunks.length 
      });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Completed uploading ${title}`);
    return chunks.length;
  } catch (error) {
    console.error(`❌ Error processing document:`, error);
    return 0;
  }
}

// Main upload function
async function uploadKnowledge() {
  console.log('🚀 Starting knowledge base upload...\n');
  
  let totalChunks = 0;
  
  try {
    // Skip main book (already uploaded)
    console.log('ℹ️  Skipping main book (already uploaded)\n');
    
    // Check for Abhidhamma Word docs
    const abhidhammaPath = './content/abhidhamma';
    try {
      const files = await fs.readdir(abhidhammaPath);
      const docFiles = files.filter(f => f.endsWith('.docx'));
      
      console.log(`Found ${docFiles.length} Word documents\n`);
      
      for (const file of docFiles) {
        const chunks = await processWordDoc(
          `${abhidhammaPath}/${file}`,
          'abhidhamma',
          file.replace('.docx', '')
        );
        totalChunks += chunks;
      }
    } catch (error) {
      console.log(`ℹ️  Abhidhamma folder error:`, error.message);
    }
    
    console.log(`\n✅ Upload complete!`);
    console.log(`📊 Total chunks uploaded: ${totalChunks}`);
    console.log(`💰 Estimated cost: $${(totalChunks * 0.00002).toFixed(4)}`);
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    process.exit(1);
  }
}

// Run the upload
uploadKnowledge();
