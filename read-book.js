const mammoth = require('mammoth');
const fs = require('fs');

async function readBook() {
  const buffer = fs.readFileSync('./the_return_of_the_attention_final_complete_fixed.docx');
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  
  // Search for PAHM
  const lines = text.split('\n');
  let foundPAHM = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('PAHM')) {
      console.log('\n=== FOUND PAHM at line', i, '===');
      // Print 10 lines before and after
      const start = Math.max(0, i - 10);
      const end = Math.min(lines.length, i + 10);
      
      for (let j = start; j < end; j++) {
        if (j === i) console.log('>>> ', lines[j]);
        else console.log('    ', lines[j]);
      }
      
      foundPAHM = true;
      console.log('\n');
    }
  }
  
  if (!foundPAHM) {
    console.log('PAHM not found in the book!');
    console.log('First 2000 characters:');
    console.log(text.substring(0, 2000));
  }
}

readBook();
