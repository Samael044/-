const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('app_users').select('*');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users found in DB:', data);
  }
}
main();
