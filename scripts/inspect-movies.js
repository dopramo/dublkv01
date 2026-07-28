const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase.from('movies').select('*').limit(1);
  if (error) {
    console.error('Error fetching movies:', error);
  } else {
    console.log('Movies columns:', Object.keys(data[0] || {}));
    console.log('Sample movie:', data[0]);
  }
}

test();
