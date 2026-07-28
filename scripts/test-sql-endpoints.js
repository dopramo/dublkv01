require('dotenv').config({ path: '.env.local' });

async function testEndpoints() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Testing URL:', url);

  // Endpoint 1: SQL query on supabase project
  const res1 = await fetch(`${url}/rest/v1/`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('Rest v1 OpenAPI spec status:', res1.status);

  // Endpoint 2: Test pg connection or pg meta if available
  const res2 = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SELECT 1;' })
  });
  console.log('PG query status:', res2.status);
}

testEndpoints();
