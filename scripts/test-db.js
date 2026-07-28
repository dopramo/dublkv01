const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const res1 = await supabase.from('tv_series').select('*').limit(5);
  console.log('tv_series select:', res1);

  const res2 = await supabase.from('episodes').select('*').limit(5);
  console.log('episodes select:', res2);
}

test();
