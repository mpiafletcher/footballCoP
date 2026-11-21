import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import { Pitch } from './Pitch';
import { PlaybackControls, usePlayback } from './Playback';
import { Studio } from './Studio';
import { type Diagram, type Exercise, type LibraryEntry, type SavedExercise, newExercise } from './model';
import './style.css';

type Account = { id: string; email: string };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.';

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><span /></span><span>Football<span>CoP</span></span></div>;
}

function SignIn({ onSignIn }: { onSignIn: (account: Account) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      onSignIn(await api<Account>('/auth/' + (register ? 'register' : 'login'), 'POST', Object.fromEntries(data)));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  return <main className="auth">
    <div className="auth-overview">
      <Brand />
      <h1>Make your next<br />session count.</h1>
      <p>Design football exercises on a pitch you can set up to match your training space.</p>
      <div className="auth-pitch"><Pitch diagram={newExercise().diagram} /></div>
    </div>
    <form className="auth-form" onSubmit={submit}>
      <h2>{register ? 'Create your account' : 'Sign in to Studio'}</h2>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required /></label>
      {register && <small>Use at least 12 characters.</small>}
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      <button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Back to sign in' : 'Create an account'}</button>
    </form>
  </main>;
}

function SharedPitch({ diagram }: { diagram: Diagram }) {
  const playback = usePlayback(diagram);
  return <>
    <div className="canvas"><Pitch diagram={{ ...diagram, elements: playback.elements ?? diagram.elements }} /></div>
    {playback.total > 0 && <div className="animation-controls"><PlaybackControls playback={playback} /></div>}
  </>;
}

function Shared({ id }: { id: string }) {
  const [exercise, setExercise] = useState<SavedExercise>();
  const [error, setError] = useState('');
  useEffect(() => { api<SavedExercise>('/shared/' + encodeURIComponent(id)).then(setExercise, caught => setError(errorMessage(caught))); }, [id]);
  return <><header className="topbar"><Brand /><a href="/">Go to Studio</a></header><main className="shared">
    {error ? <p role="alert">{error}</p> : exercise ? <>
      <h1>{exercise.title}</h1>
      <p>{exercise.description}</p>
      <SharedPitch key={exercise.id} diagram={exercise.diagram} />
    </> : <p role="status">Loading exercise…</p>}
  </main></>;
}

function Workspace({ account, onSignOut }: { account: Account; onSignOut: () => void }) {
  const [exercise, setExercise] = useState(newExercise);
  const [id, setId] = useState<string>();
  const [saved, setSaved] = useState<Exercise>(exercise);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const dirty = exercise !== saved;
  const request = async (name: string, run: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setAction(name);
    try { await run(); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { pending.current = false; setBusy(false); setAction(''); }
  };
  useEffect(() => {
    let active = true;
    api<LibraryEntry[]>('/exercises').then(
      entries => { if (active) setLibrary(current => [...current, ...entries.filter(entry => !current.some(item => item.id === entry.id))]); },
      caught => { if (active) setError(errorMessage(caught)); },
    ).finally(() => { if (active) setLibraryLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  function load(next: Exercise, nextId?: string) {
    setExercise(next); setSaved(next); setId(nextId); setRevision(value => value + 1);
  }
  const canLeave = () => !dirty || confirm('Discard unsaved changes?');
  function save() {
    const snapshot = exercise;
    void request('Saving…', async () => {
      const row = await api<SavedExercise>(id ? '/exercises/' + id : '/exercises', id ? 'PUT' : 'POST', snapshot);
      setId(row.id); setSaved(snapshot);
      setLibrary(current => [row, ...current.filter(entry => entry.id !== row.id)]);
    });
  }
  function duplicate() {
    if (!id) return;
    void request('Duplicating…', async () => {
      const row = await api<SavedExercise>('/exercises', 'POST', {
        ...exercise, title: (exercise.title || 'Untitled exercise').slice(0, 93) + ' (copy)', visibility: 'private',
      });
      setLibrary(current => [row, ...current]);
      load(row, row.id);
    });
  }
  const setMetadata = (patch: Partial<Exercise>) => setExercise(current => ({ ...current, ...patch }));
  return <>
    <header className="topbar">
      <Brand />
      <div className="top-account"><span>{account.email}</span><button disabled={busy} onClick={() => {
        if (canLeave()) void request('Signing out…', async () => { await api('/session/logout', 'POST'); onSignOut(); });
      }}>Sign out</button></div>
    </header>
    <main className="workspace">
      <aside className="library">
        <div className="library-title"><h2>My library</h2><button aria-label="New exercise" title="New exercise" disabled={busy} onClick={() => { if (canLeave()) load(newExercise()); }}>＋</button></div>
        {libraryLoading && <p>Loading exercises…</p>}
        {!libraryLoading && !library.length && <p>Saved exercises will appear here.</p>}
        <ul>{library.map(entry => <li key={entry.id}><button disabled={busy} aria-current={id === entry.id ? 'true' : undefined} onClick={() => {
          if (id !== entry.id && canLeave()) void request('Opening…', async () => load(await api<SavedExercise>('/exercises/' + entry.id), entry.id));
        }}><span>{entry.title}</span><small>{entry.visibility}</small></button></li>)}</ul>
      </aside>
      <div className="studio">
        <div className="exercise-header">
          <div><h1>Studio</h1><input className="exercise-title" aria-label="Exercise title" value={exercise.title} maxLength={100}
            onChange={event => setMetadata({ title: event.target.value })} /></div>
          <div className="save-area"><span role="status">{action || (dirty ? 'Unsaved changes' : id ? 'Saved' : 'New exercise')}</span><button className="primary" onClick={save} disabled={busy || !exercise.title.trim()}>Save exercise</button></div>
        </div>
        {error && <div role="alert" className="error">{error}</div>}
        <div inert={busy && action !== 'Saving…'}>
          <Studio key={revision} exercise={exercise} onChange={setExercise} onSave={save} />
          <details className="metadata">
            <summary>Exercise details</summary>
            <div className="metadata-grid">
              <label>Description<textarea maxLength={4000} value={exercise.description} onChange={e => setMetadata({ description: e.target.value })} /></label>
              <label>Objective<textarea maxLength={500} value={exercise.objective} onChange={e => setMetadata({ objective: e.target.value })} /></label>
              <label>Age category<input maxLength={60} value={exercise.age} onChange={e => setMetadata({ age: e.target.value })} /></label>
              <label>Player count<input type="number" min="0" max="500" value={exercise.playerCount} onChange={e => setMetadata({ playerCount: Math.max(0, Math.min(500, Math.trunc(e.target.valueAsNumber || 0))) })} /></label>
              <label>Tags (comma separated)<input key={revision} defaultValue={exercise.tags.join(', ')} maxLength={1230} onChange={e => setMetadata({ tags: e.target.value.split(',').map(item => item.trim().slice(0, 40)).filter(Boolean).slice(0, 30) })} /></label>
              <label>Visibility<select value={exercise.visibility} onChange={e => setMetadata({ visibility: e.target.value as Exercise['visibility'] })}>
                <option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
              </select></label>
              {id && saved.visibility !== 'private' && <a href={`/share/${id}`} target="_blank" rel="noreferrer">Open sharing link</a>}
              {id && <div className="button-row actions"><button disabled={busy} onClick={duplicate}>Duplicate exercise</button><button className="danger" disabled={busy} onClick={() => {
                if (confirm('Permanently delete this saved exercise?')) void request('Deleting…', async () => {
                  await api('/exercises/' + id, 'DELETE');
                  setLibrary(current => current.filter(entry => entry.id !== id)); load(newExercise());
                });
              }}>Delete exercise</button></div>}
            </div>
          </details>
        </div>
      </div>
    </main>
  </>;
}

function App() {
  const [account, setAccount] = useState<Account | null>();
  const [error, setError] = useState('');
  const shared = location.pathname.match(/^\/share\/([^/]+)\/?$/)?.[1];
  useEffect(() => {
    if (shared) return;
    api<Account | null>('/session').then(setAccount, caught => setError(errorMessage(caught)));
  }, [shared]);
  if (shared) return <Shared id={shared} />;
  if (error) return <main className="shared"><Brand /><p role="alert" className="error">{error}</p><button onClick={() => location.reload()}>Retry</button></main>;
  if (account === undefined) return <main className="shared"><Brand /><p role="status">Loading Studio…</p></main>;
  return account ? <Workspace account={account} onSignOut={() => setAccount(null)} /> : <SignIn onSignIn={setAccount} />;
}

createRoot(document.getElementById('root')!).render(<App />);
