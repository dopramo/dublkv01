/**
 * Setup TV Series & Episodes tables in Supabase
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const PROJECT_REF = 'jpkcywwrszbypoivftea';
const ACCESS_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  console.log('🔧 Setting up TV Series & Episodes database schema...\n');

  const statements = [
    // TV Series table
    `CREATE TABLE IF NOT EXISTS public.tv_series (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      tmdb_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      poster_url TEXT,
      backdrop_url TEXT,
      genres TEXT[] DEFAULT '{}',
      rating NUMERIC(3,1) DEFAULT 0,
      release_year INTEGER,
      status TEXT DEFAULT 'Completed',
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_tv_series_slug ON public.tv_series(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_tv_series_tmdb_id ON public.tv_series(tmdb_id);`,

    // Episodes table
    `CREATE TABLE IF NOT EXISTS public.episodes (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      series_id UUID REFERENCES public.tv_series(id) ON DELETE CASCADE NOT NULL,
      season_number INTEGER NOT NULL DEFAULT 1,
      episode_number INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      thumbnail_url TEXT,
      free_servers JSONB DEFAULT '[]'::jsonb,
      vip_servers JSONB DEFAULT '[]'::jsonb,
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_series_season_episode UNIQUE (series_id, season_number, episode_number)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_episodes_series_season ON public.episodes(series_id, season_number);`,

    // Enable RLS
    `ALTER TABLE public.tv_series ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;`,

    // Policies - tv_series
    `DO $$ BEGIN
      CREATE POLICY "Published tv_series are viewable by everyone" ON public.tv_series FOR SELECT USING (is_published = true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,

    `DO $$ BEGIN
      CREATE POLICY "Admins can do everything with tv_series" ON public.tv_series FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,

    // Policies - episodes
    `DO $$ BEGIN
      CREATE POLICY "Published episodes are viewable by everyone" ON public.episodes FOR SELECT USING (is_published = true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,

    `DO $$ BEGIN
      CREATE POLICY "Admins can do everything with episodes" ON public.episodes FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);
    
    try {
      await runSQL(stmt);
      console.log('✅');
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  console.log('\n✨ TV Series schema setup complete!');
}

main().catch(console.error);
