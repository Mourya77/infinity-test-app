const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { init, store } = require('./store');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

app.use(cors());
app.use(express.json());

const sign = (u) => jwt.sign({ id: u.id, email: u.email, isAdmin: !!u.isAdmin }, JWT_SECRET, { expiresIn: '7d' });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Not logged in' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Session expired, please log in again' }); }
}
function adminOnly(req, res, next) { if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' }); next(); }

app.get('/api/health', (req, res) => res.json({ ok: true, dbMode: store.mode, time: new Date().toISOString() }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' });
    const user = await store.createUser({ name, email, passwordHash: await bcrypt.hash(password, 10), isAdmin: false });
    res.status(201).json({ token: sign(user), user: store.pub(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await store.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: sign(user), user: store.pub(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: store.pub(user) });
});

// Test: exactly 10 MCQs, no answers leaked
app.get('/api/test/questions', auth, async (req, res) => {
  const all = await store.listQuestions();
  const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 10);
  res.json({ durationSeconds: 600, questions: shuffled.map(q => ({ id: q.id, question: q.question, options: q.options, category: q.category })) });
});

app.post('/api/test/submit', auth, async (req, res) => {
  try {
    const { answers = {}, durationSeconds = 0 } = req.body || {};
    const all = await store.listQuestions();
    const byId = Object.fromEntries(all.map(q => [String(q.id), q]));
    const ids = Object.keys(answers).filter(k => byId[k]);
    if (ids.length === 0) return res.status(400).json({ error: 'No answers submitted' });
    const detail = ids.map(k => {
      const q = byId[k]; const selected = Number(answers[k]);
      return { questionId: k, question: q.question, options: q.options, selected, correctAnswer: q.correctAnswer, correct: selected === q.correctAnswer, explanation: q.explanation };
    });
    const score = detail.filter(d => d.correct).length;
    const attempt = await store.createAttempt({ userId: req.user.id, answers: detail.map(d => ({ questionId: d.questionId, selected: d.selected, correct: d.correct, correctAnswer: d.correctAnswer })), score, total: detail.length, durationSeconds });
    res.status(201).json({ attemptId: attempt.id, score, total: detail.length, review: detail });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not submit test' }); }
});

app.get('/api/attempts', auth, async (req, res) => {
  const attempts = await store.listAttempts(req.user.id);
  res.json({ attempts: attempts.map(a => ({ id: a.id, score: a.score, total: a.total, durationSeconds: a.durationSeconds, createdAt: a.createdAt, answers: a.answers })) });
});

// Admin: add question + list all with answers
app.get('/api/questions', auth, adminOnly, async (req, res) => {
  res.json({ questions: await store.listQuestions() });
});
app.post('/api/questions', auth, adminOnly, async (req, res) => {
  const { question, options, correctAnswer, explanation = '', category = 'General' } = req.body || {};
  if (!question || !Array.isArray(options) || options.length !== 4 || options.some(o => !String(o).trim()))
    return res.status(400).json({ error: 'A question and exactly 4 non-empty options are required' });
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3)
    return res.status(400).json({ error: 'correctAnswer must be an index 0–3' });
  const q = await store.createQuestion({ question, options, correctAnswer, explanation, category });
  res.status(201).json({ question: q });
});

// Serve built frontend in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(dist, 'index.html')));
}

init().then(() => app.listen(PORT, () => console.log(`[server] listening on ${PORT}`)))
  .catch(e => { console.error(e); app.listen(PORT, () => console.log(`[server] listening (degraded) on ${PORT}`)); });
