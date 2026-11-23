// Data layer: Mongoose models when MongoDB is reachable (real MONGO_URI or an
// ephemeral mongodb-memory-server instance). If neither works (e.g. the memory
// server binary cannot be downloaded in a restricted sandbox), it falls back
// to a plain in-memory store exposing the exact same async API, so the demo
// still runs. Data in fallback modes is ephemeral and resets on restart.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Question, Attempt } = require('./models');
const seedQuestions = require('./seedData');

let mode = 'memory'; // 'mongo' | 'memory'
const mem = { users: [], questions: [], attempts: [], seq: 1 };
const id = () => String(mem.seq++).padStart(24, '0');

async function init() {
  const uri = process.env.MONGO_URI;
  try {
    if (uri) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      mode = 'mongo';
    } else {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const timeoutMs = Number(process.env.MEMORY_SERVER_TIMEOUT_MS || 30000);
        const started = await Promise.race([
          (async () => { const ms = await MongoMemoryServer.create(); await mongoose.connect(ms.getUri(), { serverSelectionTimeoutMS: 8000 }); return true; })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`memory-server start timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
        if (started) { mode = 'mongo'; console.log('[db] using ephemeral mongodb-memory-server'); }
      } catch (e) {
        console.warn('[db] mongodb-memory-server unavailable, using in-memory store:', e.message);
        mode = 'memory';
      }
    }
  } catch (e) {
    console.warn('[db] Mongo connection failed, using in-memory store:', e.message);
    mode = 'memory';
  }
  await seed();
  console.log('[db] mode =', mode);
}

async function seed() {
  const existing = await store.countQuestions();
  if (existing === 0) {
    for (const q of seedQuestions) await store.createQuestion(q);
  }
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@infinityclasses.test').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin@123';
  if (!(await store.findUserByEmail(adminEmail))) {
    await store.createUser({ name: 'Admin', email: adminEmail, passwordHash: await bcrypt.hash(adminPass, 10), isAdmin: true });
  }
  const demoEmail = 'demo@infinityclasses.test';
  if (!(await store.findUserByEmail(demoEmail))) {
    await store.createUser({ name: 'Demo Student', email: demoEmail, passwordHash: await bcrypt.hash('Demo@123', 10), isAdmin: false });
  }
}

const pub = (u) => u && ({ id: String(u._id || u.id), name: u.name, email: u.email, isAdmin: !!u.isAdmin });

const store = {
  get mode() { return mode; },
  async findUserByEmail(email) {
    email = String(email).toLowerCase();
    if (mode === 'mongo') { const u = await User.findOne({ email }).lean(); return u && { ...u, id: String(u._id) }; }
    const u = mem.users.find(x => x.email === email); return u ? { ...u } : null;
  },
  async findUserById(uid) {
    if (mode === 'mongo') { try { const u = await User.findById(uid).lean(); return u && { ...u, id: String(u._id) }; } catch { return null; } }
    const u = mem.users.find(x => x.id === uid); return u ? { ...u } : null;
  },
  async createUser({ name, email, passwordHash, isAdmin }) {
    email = String(email).toLowerCase();
    if (mode === 'mongo') { const u = await User.create({ name, email, passwordHash, isAdmin: !!isAdmin }); const o = u.toObject(); return { ...o, id: String(o._id) }; }
    const u = { id: id(), name, email, passwordHash, isAdmin: !!isAdmin, createdAt: new Date() };
    mem.users.push(u); return { ...u };
  },
  async countQuestions() {
    if (mode === 'mongo') return Question.countDocuments();
    return mem.questions.length;
  },
  async listQuestions() {
    if (mode === 'mongo') { const qs = await Question.find().lean(); return qs.map(q => ({ ...q, id: String(q._id) })); }
    return mem.questions.map(q => ({ ...q }));
  },
  async createQuestion(q) {
    if (mode === 'mongo') { const d = await Question.create(q); const o = d.toObject(); return { ...o, id: String(o._id) }; }
    const doc = { id: id(), ...q, createdAt: new Date() }; mem.questions.push(doc); return { ...doc };
  },
  async createAttempt(a) {
    if (mode === 'mongo') { const d = await Attempt.create({ user: a.userId, answers: a.answers, score: a.score, total: a.total, durationSeconds: a.durationSeconds }); const o = d.toObject(); return { ...o, id: String(o._id) }; }
    const doc = { id: id(), user: a.userId, ...a, createdAt: new Date() }; delete doc.userId; mem.attempts.push(doc); return { ...doc };
  },
  async listAttempts(userId) {
    if (mode === 'mongo') { const as = await Attempt.find({ user: userId }).sort({ createdAt: -1 }).lean(); return as.map(a => ({ ...a, id: String(a._id) })); }
    return mem.attempts.filter(a => a.user === userId).sort((x, y) => y.createdAt - x.createdAt).map(a => ({ ...a }));
  },
  pub,
};
module.exports = { init, store };
