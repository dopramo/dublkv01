const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'jpkcywwrszbypoivftea';
const ACCESS_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN || '';

async function runSQL(query) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL execution failed (${res.status}): ${text}`);
  }

  return await res.json();
}

async function main() {
  console.log('🔧 Creating coming_soon table in Supabase...\n');

  const statements = [
    `CREATE TABLE IF NOT EXISTS public.coming_soon (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT CHECK (type IN ('movie', 'tv')) DEFAULT 'movie',
      poster_url TEXT NOT NULL,
      backdrop_url TEXT,
      description TEXT,
      release_date TEXT,
      genres TEXT[] DEFAULT '{}',
      rating NUMERIC(3,1) DEFAULT 0,
      tmdb_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );`,
    `ALTER TABLE public.coming_soon ENABLE ROW LEVEL SECURITY;`,
    `DO $$ BEGIN
      CREATE POLICY "Public coming_soon items are viewable by everyone" ON public.coming_soon FOR SELECT USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,
    `DO $$ BEGIN
      CREATE POLICY "Admins can do everything with coming_soon" ON public.coming_soon FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[${i + 1}/${statements.length}] Running statement...`);
    try {
      await runSQL(stmt);
      console.log('  ✅ Success');
    } catch (err) {
      console.error('  ❌ Failed:', err.message);
    }
  }

  console.log('\n✨ coming_soon table creation complete!');
}

main().catch(console.error);
