const crypto = require('crypto');
const { Pool } = require('pg');

let pool;
function db() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Missing POSTGRES_URL. Add a Vercel Postgres/Neon database and set POSTGRES_URL.');
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}
const hash = (value, salt) => crypto.scryptSync(value, salt, 64).toString('hex');
const demoUsers = [
  { email: 'student@resolva.demo', role: 'student', name: 'Diya Agarwal', id: 'STU1025', password: 'Student@123' },
  { email: 'admin@resolva.demo', role: 'admin', name: 'Campus Administrator', id: 'ADM001', password: 'Admin@123' },
  { email: 'staff@resolva.demo', role: 'staff', name: 'Rahul Sharma', id: 'STF001', password: 'Staff@123' }
];
const seed = [
 {id:'INC-1042',title:'Wi-Fi not working in Lab 3',category:'Wi-Fi / Internet',location:'Lab 3',description:'No internet connection on multiple systems.',student:'Arzoo Rani',studentId:'STU1024',affected:4,duration:2,safety:15,locationImportance:75,frequency:65,status:'Assigned',assignedDepartment:'IT / Network Team',assignedStaff:'Rahul Sharma',evidence:[],created:'Today, 10:42 AM',reports:4,verification:null},
 {id:'INC-1041',title:'Water leakage – Room 204',category:'Water / Leakage',location:'Room 204',description:'Leakage near ceiling and wall.',student:'Diya Agarwal',studentId:'STU1025',affected:12,duration:5,safety:60,locationImportance:70,frequency:90,status:'In Progress',assignedDepartment:'Plumbing / Civil',assignedStaff:'Suresh Yadav',evidence:[],created:'Yesterday, 2:15 PM',reports:8,verification:null},
 {id:'INC-1040',title:'Electrical leakage near corridor',category:'Electricity',location:'Block A Corridor',description:'Sparking noticed near switchboard.',student:'Gauri Gupta',studentId:'STU1026',affected:30,duration:1,safety:100,locationImportance:90,frequency:70,status:'Resolved',assignedDepartment:'Electrical Maintenance',assignedStaff:'Amit Kumar',evidence:[],created:'Yesterday, 9:20 AM',reports:3,verification:null}
];

let initialized;

async function init() {
  if (!initialized) {
    initialized = (async () => {
      const client = await db().connect();

      try {
        await client.query('BEGIN');

        // Prevent simultaneous database initialization
        await client.query(
          'SELECT pg_advisory_xact_lock(731942, 1)'
        );

        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id)
              ON DELETE CASCADE,
            role TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
          )
        `);

        for (const u of demoUsers) {
          const salt = crypto.randomBytes(16).toString('hex');

          await client.query(
            `INSERT INTO users
            (id,name,email,role,salt,password_hash)
            VALUES($1,$2,$3,$4,$5,$6)
            ON CONFLICT(email) DO NOTHING`,
            [
              u.id,
              u.name,
              u.email,
              u.role,
              salt,
              hash(u.password, salt)
            ]
          );
        }

        for (const item of seed) {
          await client.query(
            `INSERT INTO incidents(id,data)
             VALUES($1,$2::jsonb)
             ON CONFLICT(id) DO NOTHING`,
            [item.id, JSON.stringify(item)]
          );
        }

        await client.query('COMMIT');

      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  try {
    await initialized;
  } catch (error) {
    initialized = null;
    throw error;
  }
}

function send(res, status, body) { return res.status(status).json(body); }
async function createSession(p, user) {
  const token = crypto.randomBytes(32).toString('hex');
  await p.query(`INSERT INTO sessions(token,user_id,role,expires_at)
    VALUES($1,$2,$3,NOW()+INTERVAL '7 days')`, [token,user.id,user.role]);
  return token;
}
async function auth(req, p) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (!token) return null;
  const result = await p.query(`SELECT user_id,role FROM sessions WHERE token=$1 AND expires_at>NOW()`,[token]);
  return result.rows[0] || null;
}

module.exports = async (req, res) => {
  try {
    await init();
    const p = db();
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
const route = url.pathname
  .replace(/^\/api(?=\/|$)/, '')
  .replace(/\/$/, '') || '/';
   if (req.method === 'GET' && route === '/health') {
      await p.query('SELECT 1');
      return send(res,200,{ok:true,database:'PostgreSQL',provider:'Vercel Postgres / Neon'});
    }
    if (req.method === 'POST' && route === '/register') {
      const {name,email,password,role,adminCode} = req.body || {};
      const cleanName=String(name||'').trim(), cleanEmail=String(email||'').trim().toLowerCase(), pass=String(password||'');
      if(cleanName.length<2 || cleanName.length>70) return send(res,400,{error:'Name must be 2–70 characters'});
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return send(res,400,{error:'Enter a valid email address'});
      if(pass.length<8 || !/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) return send(res,400,{error:'Password must be at least 8 characters and include a number'});
      if(!['student','staff','admin'].includes(role)) return send(res,400,{error:'Choose a valid account role'});
      if(role==='admin' && (!process.env.RESOLVA_ADMIN_INVITE || adminCode !== process.env.RESOLVA_ADMIN_INVITE))
        return send(res,403,{error:'Admin registration is disabled or the invite code is incorrect. Configure RESOLVA_ADMIN_INVITE in Vercel.'});
      const exists=await p.query('SELECT id FROM users WHERE email=$1',[cleanEmail]);
      if(exists.rowCount) return send(res,409,{error:'An account with this email already exists'});
      const prefix=role==='student'?'STU':role==='staff'?'STF':'ADM';
      const count=await p.query('SELECT COUNT(*)::int AS count FROM users WHERE role=$1',[role]);
      const id=prefix+String(1000+count.rows[0].count+1).padStart(4,'0');
      const salt=crypto.randomBytes(16).toString('hex');
      try {
        await p.query('INSERT INTO users(id,name,email,role,salt,password_hash) VALUES($1,$2,$3,$4,$5,$6)',
          [id,cleanName,cleanEmail,role,salt,hash(pass,salt)]);
      } catch(e) {
        if(e.code==='23505') return send(res,409,{error:'An account with this email already exists'});
        throw e;
      }
      const user={id,name:cleanName,email:cleanEmail,role};
      return send(res,201,{token:await createSession(p,user),user});
    }
    if (req.method === 'POST' && route === '/login') {
      const {email,password,role}=req.body||{};
      const result=await p.query('SELECT id,name,email,role,salt,password_hash FROM users WHERE email=$1 AND role=$2',
        [String(email||'').trim().toLowerCase(),role]);
      const u=result.rows[0];
      if(!u) return send(res,401,{error:'Invalid email, password or role'});
      const supplied=Buffer.from(hash(String(password||''),u.salt),'hex');
      const stored=Buffer.from(u.password_hash,'hex');
      if(supplied.length!==stored.length || !crypto.timingSafeEqual(supplied,stored))
        return send(res,401,{error:'Invalid email, password or role'});
      const user={id:u.id,name:u.name,email:u.email,role:u.role};
      return send(res,200,{token:await createSession(p,user),user});
    }
    if (req.method === 'GET' && route === '/notifications') return send(res,200,[]);
    if (req.method === 'GET' && route === '/incidents') {
      const result=await p.query('SELECT data FROM incidents ORDER BY created_at DESC');
      return send(res,200,result.rows.map(r=>r.data));
    }
    if (req.method === 'POST' && route === '/incidents') {
      const user=await auth(req,p);
      if(!user) return send(res,401,{error:'Please sign in to perform this action'});
      if(user.role!=='student') return send(res,403,{error:'Only student accounts can submit a complaint'});
      const item=req.body;
      if(!item || !item.id || !item.title) return send(res,400,{error:'Incident id and title are required'});
      try {
        await p.query('INSERT INTO incidents(id,data) VALUES($1,$2::jsonb)',[item.id,JSON.stringify(item)]);
        return send(res,201,item);
      } catch(e) {
        if(e.code==='23505') return send(res,409,{error:'Incident id already exists'});
        throw e;
      }
    }
    const patchMatch=route.match(/^\/incidents\/([^/]+)$/);
    if(req.method==='PATCH' && patchMatch) {
      const user=await auth(req,p);
      if(!user) return send(res,401,{error:'Please sign in to perform this action'});
      const allowed=user.role==='student'
        ? Object.keys(req.body||{}).every(k=>['status','verification'].includes(k))
        : ['admin','staff'].includes(user.role);
      if(!allowed) return send(res,403,{error:'Your role cannot perform this update'});
      const id=decodeURIComponent(patchMatch[1]);
      const found=await p.query('SELECT data FROM incidents WHERE id=$1',[id]);
      if(!found.rowCount) return send(res,404,{error:'Incident not found'});
      const item={...found.rows[0].data,...(req.body||{})};
      await p.query('UPDATE incidents SET data=$1::jsonb WHERE id=$2',[JSON.stringify(item),id]);
      return send(res,200,item);
    }
    return send(res,404,{error:'API route not found'});
  } catch (error) {
    console.error('RESOLVA API error:',error);
    return send(res,500,{error: error.message && error.message.includes('POSTGRES_URL')
      ? error.message : 'Server error. Check Vercel function logs and database configuration.'});
  }
};
