import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, getUser, setSession, clearSession } from './api';
import './styles.css';

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr('');
    try { const d = await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body: JSON.stringify(form) }); setSession(d.token, d.user); onAuth(d.user); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); } };
  const fillDemo = (admin) => { setMode('login'); setForm({ name:'', email: admin ? 'admin@infinityclasses.test' : 'demo@infinityclasses.test', password: admin ? 'Admin@123' : 'Demo@123' }); };
  return (<div className="center"><div className="card auth">
    <div className="brand">∞ Infinity Classes</div><h1>Mini Online Test App</h1>
    <p className="muted">10 questions · 10 minutes · instant results with explanations</p>
    <div className="tabs"><button className={mode==='login'?'on':''} onClick={()=>setMode('login')}>Log in</button><button className={mode==='register'?'on':''} onClick={()=>setMode('register')}>Sign up</button></div>
    <form onSubmit={submit}>
      {mode==='register' && <input placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>}
      <input placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/>
      <input placeholder="Password (min 6 characters)" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/>
      {err && <div className="error">{err}</div>}
      <button className="primary" disabled={busy}>{busy?'Please wait…':(mode==='login'?'Log in':'Create account')}</button>
    </form>
    <div className="demo"><span>Quick demo:</span><button onClick={()=>fillDemo(false)}>Student demo</button><button onClick={()=>fillDemo(true)}>Admin demo</button></div>
  </div></div>);
}

function Test({ onDone, onCancel }) {
  const [qs, setQs] = useState(null); const [answers, setAnswers] = useState({}); const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(600); const [err, setErr] = useState(''); const started = React.useRef(Date.now());
  useEffect(() => { api('/api/test/questions').then(d => { setQs(d.questions); setLeft(d.durationSeconds); }).catch(e=>setErr(e.message)); }, []);
  const submit = React.useCallback(async () => {
    if (!qs) return;
    const payload = {}; qs.forEach(q => { if (answers[q.id] !== undefined) payload[q.id] = answers[q.id]; });
    if (Object.keys(payload).length === 0) qs.forEach(q => payload[q.id] = -1);
    try { const r = await api('/api/test/submit', { method:'POST', body: JSON.stringify({ answers: payload, durationSeconds: Math.round((Date.now()-started.current)/1000) }) }); onDone(r); }
    catch (e) { setErr(e.message); }
  }, [qs, answers]);
  useEffect(() => { if (!qs) return; if (left <= 0) { submit(); return; } const t = setTimeout(()=>setLeft(left-1), 1000); return ()=>clearTimeout(t); }, [left, qs, submit]);
  if (err) return <div className="card"><p className="error">{err}</p><button onClick={onCancel}>Back</button></div>;
  if (!qs) return <div className="card">Loading questions…</div>;
  const q = qs[idx]; const mm = String(Math.floor(left/60)).padStart(2,'0'); const ss = String(left%60).padStart(2,'0');
  return (<div className="card">
    <div className="row between"><strong>Question {idx+1} of {qs.length}</strong><span className={`timer ${left<60?'danger':''}`}>⏱ {mm}:{ss}</span></div>
    <div className="progress"><div style={{width:`${(Object.keys(answers).length/qs.length)*100}%`}}/></div>
    <span className="chip">{q.category}</span><h2 className="qtext">{q.question}</h2>
    <div className="options">{q.options.map((o,i)=>(<button key={i} className={`option ${answers[q.id]===i?'sel':''}`} onClick={()=>setAnswers({...answers,[q.id]:i})}><b>{'ABCD'[i]}</b> {o}</button>))}</div>
    <div className="palette">{qs.map((qq,i)=>(<button key={qq.id} className={`${i===idx?'cur':''} ${answers[qq.id]!==undefined?'done':''}`} onClick={()=>setIdx(i)}>{i+1}</button>))}</div>
    <div className="row between"><button disabled={idx===0} onClick={()=>setIdx(idx-1)}>← Previous</button>
      {idx<qs.length-1 ? <button className="primary small" onClick={()=>setIdx(idx+1)}>Next →</button> : <button className="primary small" onClick={submit}>Submit test</button>}</div>
    <p className="muted">Answered {Object.keys(answers).length}/{qs.length}. The test auto-submits when the timer reaches 00:00.</p>
  </div>);
}

function Result({ result, onHome }) {
  const pct = Math.round((result.score/result.total)*100);
  return (<div className="card"><h1>Your result</h1><div className="score">{result.score} / {result.total}</div><p className="muted">{pct}% — {pct>=70?'Excellent work!':pct>=40?'Good effort — review the explanations below.':'Keep practising — review the explanations below.'}</p>
    {result.review.map((r,i)=>(<div key={i} className={`review ${r.correct?'ok':'bad'}`}><strong>Q{i+1}. {r.question}</strong>
      <p>Your answer: <b>{r.selected>=0?r.options[r.selected]:'Not answered'}</b> {r.correct?'✓':'✗'}</p>
      {!r.correct && <p>Correct answer: <b>{r.options[r.correctAnswer]}</b></p>}<p className="muted">{r.explanation}</p></div>))}
    <button className="primary" onClick={onHome}>Back to dashboard</button></div>);
}

function History() {
  const [items, setItems] = useState(null);
  useEffect(()=>{ api('/api/attempts').then(d=>setItems(d.attempts)).catch(()=>setItems([])); },[]);
  if (!items) return <div className="card">Loading history…</div>;
  if (!items.length) return <div className="card"><h2>Attempt history</h2><p className="muted">No attempts yet. Take your first test!</p></div>;
  return (<div className="card"><h2>Attempt history</h2><table><thead><tr><th>Date</th><th>Score</th><th>Result</th><th>Time taken</th></tr></thead>
    <tbody>{items.map(a=>(<tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.score}/{a.total}</td><td>{Math.round(a.score/a.total*100)}%</td><td>{a.durationSeconds||0}s</td></tr>))}</tbody></table></div>);
}

function Admin() {
  const [form, setForm] = useState({ question:'', options:['','','',''], correctAnswer:0, explanation:'', category:'General' });
  const [msg, setMsg] = useState(''); const [count, setCount] = useState(null);
  useEffect(()=>{ api('/api/questions').then(d=>setCount(d.questions.length)).catch(()=>{}); },[msg]);
  const submit = async (e)=>{ e.preventDefault(); setMsg(''); try { await api('/api/questions',{method:'POST',body:JSON.stringify(form)}); setMsg('Question added successfully.'); setForm({ question:'', options:['','','',''], correctAnswer:0, explanation:'', category:'General' }); } catch(e2){ setMsg(e2.message); } };
  return (<div className="card"><h2>Admin — Add a question</h2>{count!==null && <p className="muted">{count} questions currently in the bank. Tests serve 10 at random.</p>}
    <form onSubmit={submit}><input placeholder="Question" value={form.question} onChange={e=>setForm({...form,question:e.target.value})} required/>
    {form.options.map((o,i)=>(<div key={i} className="row"><input placeholder={`Option ${'ABCD'[i]}`} value={o} onChange={e=>{const op=[...form.options];op[i]=e.target.value;setForm({...form,options:op});}} required/><label className="radio"><input type="radio" name="correct" checked={form.correctAnswer===i} onChange={()=>setForm({...form,correctAnswer:i})}/> Correct</label></div>))}
    <input placeholder="Explanation" value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})}/>
    <input placeholder="Category (e.g. Aptitude)" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
    {msg && <div className="notice">{msg}</div>}<button className="primary">Add question</button></form></div>);
}

function App() {
  const [user, setUser] = useState(getUser()); const [view, setView] = useState('home'); const [result, setResult] = useState(null);
  if (!user) return <Auth onAuth={(u)=>{setUser(u); setView('home');}}/>;
  return (<div className="wrap"><header><div className="brand">∞ Infinity Classes</div><nav>
    <button onClick={()=>setView('home')}>Dashboard</button><button onClick={()=>setView('history')}>History</button>
    {user.isAdmin && <button onClick={()=>setView('admin')}>Admin</button>}
    <span className="muted">{user.name}{user.isAdmin?' (admin)':''}</span>
    <button onClick={()=>{clearSession(); setUser(null);}}>Log out</button></nav></header>
    {view==='home' && !result && (<div className="card hero"><h1>Welcome, {user.name.split(' ')[0]} 👋</h1>
      <p className="muted">Take a timed mini test: <b>10 multiple-choice questions</b>, <b>10 minutes</b>, auto-submit when time runs out. You will see your score, the correct answers and explanations right after.</p>
      <button className="primary big" onClick={()=>setView('test')}>Start test →</button>
      <button onClick={()=>setView('history')}>View attempt history</button></div>)}
    {view==='test' && <Test onDone={(r)=>{setResult(r); setView('result');}} onCancel={()=>setView('home')}/>}
    {view==='result' && result && <Result result={result} onHome={()=>{setResult(null); setView('home');}}/>}
    {view==='history' && <History/>}{view==='admin' && user.isAdmin && <Admin/>}
    <footer className="muted">Built with the MERN stack — React, Express, MongoDB (Mongoose), JWT auth.</footer></div>);
}
createRoot(document.getElementById('root')).render(<App/>);
