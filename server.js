const express = require('express');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '12mb' }));
const sessions = new Map();
const demoUsers = [
 {email:'student@resolva.demo',role:'student',name:'Diya Agarwal',id:'STU1025',password:'Student@123'},
 {email:'admin@resolva.demo',role:'admin',name:'Campus Administrator',id:'ADM001',password:'Admin@123'},
 {email:'staff@resolva.demo',role:'staff',name:'Rahul Sharma',id:'STF001',password:'Staff@123'}
];
const hash = (value, salt) => crypto.scryptSync(value, salt, 64).toString('hex');

const DB_FILE = path.join(__dirname, 'resolva.sqlite');
const seed = [
 {id:'INC-1042',title:'Wi-Fi not working in Lab 3',category:'Wi-Fi / Internet',location:'Lab 3',description:'No internet connection on multiple systems.',student:'Arzoo Rani',studentId:'STU1024',affected:4,duration:2,safety:15,locationImportance:75,frequency:65,status:'Assigned',assignedDepartment:'IT / Network Team',assignedStaff:'Rahul Sharma',evidence:[],created:'Today, 10:42 AM',reports:4,verification:null},
 {id:'INC-1041',title:'Water leakage – Room 204',category:'Water / Leakage',location:'Room 204',description:'Leakage near ceiling and wall.',student:'Diya Agarwal',studentId:'STU1025',affected:12,duration:5,safety:60,locationImportance:70,frequency:90,status:'In Progress',assignedDepartment:'Plumbing / Civil',assignedStaff:'Suresh Yadav',evidence:[],created:'Yesterday, 2:15 PM',reports:8,verification:null},
 {id:'INC-1040',title:'Electrical leakage near corridor',category:'Electricity',location:'Block A Corridor',description:'Sparking noticed near switchboard.',student:'Gauri Gupta',studentId:'STU1026',affected:30,duration:1,safety:100,locationImportance:90,frequency:70,status:'Resolved',assignedDepartment:'Electrical Maintenance',assignedStaff:'Amit Kumar',evidence:[],created:'Yesterday, 9:20 AM',reports:3,verification:null}
];
(async () => {
 const SQL = await initSqlJs({ locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file) });
 const db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
 db.run('CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
 db.run('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)');
 const userCount = db.exec('SELECT COUNT(*) AS count FROM users')[0].values[0][0];
 if (!userCount) demoUsers.forEach(u => { const salt=crypto.randomBytes(16).toString('hex'); db.run('INSERT INTO users (id,name,email,role,salt,password_hash,created_at) VALUES (?,?,?,?,?,?,?)',[u.id,u.name,u.email,u.role,salt,hash(u.password,salt),new Date().toISOString()]); });
 const count = db.exec('SELECT COUNT(*) AS count FROM incidents')[0].values[0][0];
 if (!count) seed.forEach(item => db.run('INSERT INTO incidents (id,data) VALUES (?,?)', [item.id, JSON.stringify(item)]));
 const save = () => fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
 save();
 const requireAuth = (req,res,next) => { const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,''); const session=sessions.get(token); if(!session)return res.status(401).json({error:'Please sign in to perform this action'}); req.sessionUser=session; next(); };
 const all = () => { const rows = db.exec('SELECT data FROM incidents ORDER BY rowid DESC'); return rows.length ? rows[0].values.map(r => JSON.parse(r[0])) : []; };
 app.get('/api/health', (_req,res) => res.json({ok:true,database:'SQLite',file:'resolva.sqlite'}));
 app.post('/api/register',(req,res)=>{
   const {name,email,password,role,adminCode}=req.body||{};
   const cleanName=String(name||'').trim(), cleanEmail=String(email||'').trim().toLowerCase(), pass=String(password||'');
   if(cleanName.length<2 || cleanName.length>70) return res.status(400).json({error:'Name must be 2–70 characters'});
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({error:'Enter a valid email address'});
   if(pass.length<8 || !/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) return res.status(400).json({error:'Password must be at least 8 characters and include a number'});
   if(!['student','staff','admin'].includes(role)) return res.status(400).json({error:'Choose a valid account role'});
   if(role==='admin' && adminCode !== (process.env.RESOLVA_ADMIN_INVITE || 'KIET-RESOLVA-ADMIN-2026')) return res.status(403).json({error:'Admin account requires the administrator invite code'});
   const exists=db.exec('SELECT id FROM users WHERE email = ?',[cleanEmail]); if(exists.length&&exists[0].values.length) return res.status(409).json({error:'An account with this email already exists'});
   const prefix=role==='student'?'STU':role==='staff'?'STF':'ADM';
   const rows=db.exec('SELECT id FROM users WHERE role = ?',[role]); const next=(rows.length?rows[0].values.length:0)+1;
   const id=prefix+String(1000+next).padStart(4,'0'); const salt=crypto.randomBytes(16).toString('hex');
   try { db.run('INSERT INTO users (id,name,email,role,salt,password_hash,created_at) VALUES (?,?,?,?,?,?,?)',[id,cleanName,cleanEmail,role,salt,hash(pass,salt),new Date().toISOString()]); save();
     const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{role,id}); res.status(201).json({token,user:{id,name:cleanName,email:cleanEmail,role}});
   } catch(e) { res.status(500).json({error:'Could not create account'}); }
 });
 app.post('/api/login',(req,res)=>{const {email,password,role}=req.body||{};const rows=db.exec('SELECT id,name,email,role,salt,password_hash FROM users WHERE email = ? AND role = ?',[String(email||'').trim().toLowerCase(),role]);const u=rows.length&&rows[0].values.length?rows[0].values[0]:null;if(!u)return res.status(401).json({error:'Invalid email, password or role'});const [id,name,userEmail,userRole,salt,passwordHash]=u;const supplied=Buffer.from(hash(String(password||''),salt),'hex');const stored=Buffer.from(passwordHash,'hex');if(supplied.length!==stored.length||!crypto.timingSafeEqual(supplied,stored))return res.status(401).json({error:'Invalid email, password or role'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{role:userRole,id});res.json({token,user:{role:userRole,id,name,email:userEmail}})});
 app.get('/api/notifications',(_req,res)=>res.json([]));
 app.get('/api/incidents', (_req,res) => res.json(all()));
 app.post('/api/incidents', requireAuth, (req,res) => {
   if(req.sessionUser.role!=='student')return res.status(403).json({error:'Only student accounts can submit a complaint'});
   const item = req.body;
   if (!item || !item.id || !item.title) return res.status(400).json({error:'Incident id and title are required'});
   try { db.run('INSERT INTO incidents (id,data) VALUES (?,?)', [item.id, JSON.stringify(item)]); save(); res.status(201).json(item); }
   catch { res.status(409).json({error:'Incident id already exists'}); }
 });
 app.patch('/api/incidents/:id', requireAuth, (req,res) => {
   const allowed = req.sessionUser.role==='student' ? Object.keys(req.body||{}).every(k=>['status','verification'].includes(k)) : ['admin','staff'].includes(req.sessionUser.role);
   if(!allowed)return res.status(403).json({error:'Your role cannot perform this update'});
   const found = db.exec('SELECT data FROM incidents WHERE id = ?', [req.params.id]);
   if (!found.length || !found[0].values.length) return res.status(404).json({error:'Incident not found'});
   const item = {...JSON.parse(found[0].values[0][0]), ...req.body};
   db.run('UPDATE incidents SET data = ? WHERE id = ?', [JSON.stringify(item), req.params.id]); save(); res.json(item);
 });
 const port = process.env.API_PORT || 4000;
 app.listen(port, () => console.log(`RESOLVA database API running at http://localhost:${port}`));
})();
