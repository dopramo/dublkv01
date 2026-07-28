const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInsert() {
  const dummyTV = {
    tmdb_id: 9999999,
    title: 'Test TV Series',
    slug: 'test-tv-series-9999999',
    description: 'This is a test TV series',
    poster_url: 'https://image.tmdb.org/t/p/w500/test.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/test.jpg',
    genres: ['Animation', 'Action'],
    rating: 8.5,
    release_year: 2024,
    is_published: false,
    free_servers: {
      is_tv: true,
      status: 'Completed', // 'Completed' or 'Ongoing'
      seasons: [
        {
          season_number: 1,
          episodes: [
            {
              episode_number: 1,
              title: 'Episode 1',
              servers: [
                { id: 'srv-1', name: 'SERVER 1', input_type: 'url', url: 'https://vidsrc.me/embed/tv/9999999/1/1', enabled: true },
                { id: 'srv-2', name: 'SERVER 2', input_type: 'url', url: 'https://embed.su/embed/tv/9999999/1/1', enabled: true }
              ]
            }
          ]
        }
      ]
    }
  };

  const { data, error } = await supabase.from('movies').insert(dummyTV).select();
  console.log('Insert test result:', { data, error });

  if (data && data[0]) {
    // Delete test record
    await supabase.from('movies').delete().eq('id', data[0].id);
    console.log('Cleaned up test record successfully!');
  }
}

testInsert();
