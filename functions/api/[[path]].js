import { createClient } from '@supabase/supabase-js';

// Helper to create CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const pathSegments = params.path || [];
  const method = request.method;

  // Handle CORS preflight options request
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase URL or Anon Key is not configured in Cloudflare Pages settings.' }), {
      status: 500,
      headers: corsHeaders()
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // --- STAFF ENDPOINTS ---
    // GET /api/staff
    if (method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'staff') {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: corsHeaders() });
    }

    // POST /api/staff
    if (method === 'POST' && pathSegments.length === 1 && pathSegments[0] === 'staff') {
      const body = await request.json();
      const { name, department, rate_per_shift, notes } = body;
      if (!name || !department) {
        return new Response(JSON.stringify({ error: 'Name and department are required' }), { status: 400, headers: corsHeaders() });
      }
      const rate = Number(rate_per_shift) || 0;
      const { data, error } = await supabase
        .from('staff')
        .insert([{ name, department, rate_per_shift: rate, notes: notes || '' }])
        .select();
      if (error) throw error;
      return new Response(JSON.stringify(data[0]), { status: 201, headers: corsHeaders() });
    }

    // PUT /api/staff/:id
    if (method === 'PUT' && pathSegments.length === 2 && pathSegments[0] === 'staff') {
      const id = pathSegments[1];
      const body = await request.json();
      const { name, department, rate_per_shift, notes } = body;
      const { data, error } = await supabase
        .from('staff')
        .update({ name, department, rate_per_shift: Number(rate_per_shift) || 0, notes })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (data.length === 0) {
        return new Response(JSON.stringify({ error: 'Staff member not found' }), { status: 404, headers: corsHeaders() });
      }
      return new Response(JSON.stringify(data[0]), { headers: corsHeaders() });
    }

    // DELETE /api/staff/:id
    if (method === 'DELETE' && pathSegments.length === 2 && pathSegments[0] === 'staff') {
      const id = pathSegments[1];
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'Staff member deleted' }), { headers: corsHeaders() });
    }

    // --- SHIFT ENDPOINTS ---
    // GET /api/shifts
    if (method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'shifts') {
      const start_date = url.searchParams.get('start_date');
      const end_date = url.searchParams.get('end_date');
      let query = supabase.from('shifts').select('*');
      if (start_date && end_date) {
        query = query.gte('shift_date', start_date).lte('shift_date', end_date);
      }
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: corsHeaders() });
    }

    // POST /api/shifts/toggle
    if (method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'shifts' && pathSegments[1] === 'toggle') {
      const body = await request.json();
      const { staff_id, shift_date, shift_count } = body;
      if (!staff_id || !shift_date) {
        return new Response(JSON.stringify({ error: 'staff_id and shift_date are required' }), { status: 400, headers: corsHeaders() });
      }
      const count = parseFloat(shift_count) || 1.0;

      // Check if shift already exists
      const { data: existing, error: fetchErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('staff_id', staff_id)
        .eq('shift_date', shift_date);

      if (fetchErr) throw fetchErr;

      if (existing && existing.length > 0) {
        // Delete
        const { error: delErr } = await supabase
          .from('shifts')
          .delete()
          .eq('staff_id', staff_id)
          .eq('shift_date', shift_date);
        if (delErr) throw delErr;
        return new Response(JSON.stringify({ status: 'removed', staff_id, shift_date }), { headers: corsHeaders() });
      } else {
        // Insert
        const { data: inserted, error: insErr } = await supabase
          .from('shifts')
          .insert([{ staff_id, shift_date, shift_count: count }])
          .select();
        if (insErr) throw insErr;
        return new Response(JSON.stringify({ status: 'added', shift: inserted[0] }), { status: 201, headers: corsHeaders() });
      }
    }

    // --- AUTH ENDPOINTS ---
    // POST /api/auth/login
    if (method === 'POST' && pathSegments.length === 2 && pathSegments[0] === 'auth' && pathSegments[1] === 'login') {
      const body = await request.json();
      const { username, password } = body;
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password are required' }), { status: 400, headers: corsHeaders() });
      }

      const USERNAME_PREFIX_MAP = {
        'ການຢາ': 'Pharmacy',
        'ພະຍາບານ': 'Nurse',
        'ພາຍໃນ': 'Internal medicine',
        'ເດັກນ້ອຍ': 'Pediatric Department',
        'ວິເຄาະ': 'Laboratory Department',
        'ໂຊເຟີ': 'Chauffeur',
        'ຜູ້ດູແລ': 'Admin'
      };

      let resolvedUsername = username.trim();
      for (const [laoKey, engValue] of Object.entries(USERNAME_PREFIX_MAP)) {
        if (resolvedUsername.startsWith(laoKey)) {
          resolvedUsername = engValue + resolvedUsername.substring(laoKey.length);
          break;
        }
      }

      const normalizedInput = resolvedUsername.toLowerCase();

      const { data, error } = await supabase
        .from('app_users')
        .select('*');
      if (error) throw error;

      const user = data.find(u => 
        u.username.toLowerCase() === normalizedInput || 
        (u.email && u.email.toLowerCase() === normalizedInput)
      );

      if (!user || user.password !== password) {
        return new Response(JSON.stringify({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ (Incorrect Username or Password)' }), { status: 401, headers: corsHeaders() });
      }

      return new Response(JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email || `${user.username.toLowerCase().replace(/\s+/g, '_')}@hospital.com`,
          role: user.role,
          department: user.department
        }
      }), { headers: corsHeaders() });
    }

    // --- USER MANAGEMENT ENDPOINTS ---
    // GET /api/users
    if (method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'users') {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('username', { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: corsHeaders() });
    }

    // POST /api/users
    if (method === 'POST' && pathSegments.length === 1 && pathSegments[0] === 'users') {
      const body = await request.json();
      const { username, password, role, department } = body;
      if (!username || !password || !role) {
        return new Response(JSON.stringify({ error: 'Username, password, and role are required' }), { status: 400, headers: corsHeaders() });
      }

      const { data: existingUsers, error: checkErr } = await supabase
        .from('app_users')
        .select('username');
      if (checkErr) throw checkErr;
      if (existingUsers.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return new Response(JSON.stringify({ error: 'Username already exists' }), { status: 400, headers: corsHeaders() });
      }

      const { data, error } = await supabase
        .from('app_users')
        .insert([{ username, password, role, department: department || null }])
        .select();
      if (error) throw error;
      return new Response(JSON.stringify(data[0]), { status: 201, headers: corsHeaders() });
    }

    // PUT /api/users/:id
    if (method === 'PUT' && pathSegments.length === 2 && pathSegments[0] === 'users') {
      const id = pathSegments[1];
      const body = await request.json();
      const { username, password, role, department } = body;
      const { data, error } = await supabase
        .from('app_users')
        .update({ username, password, role, department: department || null })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (data.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders() });
      }
      return new Response(JSON.stringify(data[0]), { headers: corsHeaders() });
    }

    // DELETE /api/users/:id
    if (method === 'DELETE' && pathSegments.length === 2 && pathSegments[0] === 'users') {
      const id = pathSegments[1];
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'User deleted' }), { headers: corsHeaders() });
    }

    // --- CONFIG ENDPOINT ---
    // GET /api/config
    if (method === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'config') {
      return new Response(JSON.stringify({
        supabaseUrl: supabaseUrl || '',
        supabaseAnonKey: supabaseKey || '',
        isSupabaseConfigured: true
      }), { headers: corsHeaders() });
    }

    // Route not found
    return new Response(JSON.stringify({ error: `Not found: ${method} ${url.pathname}` }), { status: 404, headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), { status: 500, headers: corsHeaders() });
  }
}
