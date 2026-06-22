const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertNurse() {
  console.log("Connecting to Supabase...");
  
  // First, check if 'Nurse' user already exists
  const { data: existing, error: fetchError } = await supabase
    .from('app_users')
    .select('*')
    .eq('username', 'Nurse');

  if (fetchError) {
    console.error("Error fetching existing users:", fetchError);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    // Update password and role
    console.log("User 'Nurse' already exists. Updating password and role...");
    const { error: updateError } = await supabase
      .from('app_users')
      .update({ password: 'N1234', role: 'nurse' })
      .eq('username', 'Nurse');
    
    if (updateError) {
      console.error("Error updating user:", updateError);
      process.exit(1);
    }
    console.log("Success! Updated user 'Nurse' with password 'N1234' and role 'nurse'.");
  } else {
    // Insert new
    console.log("User 'Nurse' does not exist. Inserting...");
    const { data, error: insertError } = await supabase
      .from('app_users')
      .insert([{ username: 'Nurse', password: 'N1234', role: 'nurse', department: null }])
      .select();

    if (insertError) {
      console.error("Error inserting user:", insertError);
      process.exit(1);
    }
    console.log("Success! Created user 'Nurse' with password 'N1234' and role 'nurse'.");
  }
}

insertNurse();
