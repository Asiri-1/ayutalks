require('dotenv').config({ path: '.env.local' });
const { fetchThoughtLog } = require('./lib/google-drive');

async function test() {
  console.log('🔍 Testing Google Drive integration...\n');
  
  // Check environment variable
  console.log('GOOGLE_DOC_ID:', process.env.GOOGLE_DOC_ID || '❌ NOT SET');
  
  // Try to fetch
  console.log('\n📥 Fetching thought log...');
  const content = await fetchThoughtLog();
  
  if (content) {
    console.log('✅ SUCCESS!');
    console.log('Content length:', content.length, 'characters');
    console.log('\nFirst 500 characters:');
    console.log(content.substring(0, 500));
  } else {
    console.log('❌ FAILED to fetch content');
  }
}

test();
