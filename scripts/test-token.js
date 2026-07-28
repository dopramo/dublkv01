require('dotenv').config({ path: '.env.local' });

async function checkToken() {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  console.log('Token starts with:', token ? token.substring(0, 10) : 'none');

  const res = await fetch('https://api.supabase.com/v1/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });

  console.log('Projects endpoint status:', res.status);
  const text = await res.text();
  console.log('Projects response:', text);
}

checkToken();
