'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signInWithEmail, registerWithEmail } from '@/lib/firebase';
import { FirebaseError } from 'firebase/app';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      router.replace('/');
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(friendlyError(err.code));
      } else {
        setError('Er ging iets mis. Probeer het opnieuw.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(friendlyError(err.code));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">🏁 Sportkalender</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">
          Jouw persoonlijke live sportkalender
        </p>

        {/* Google Sign-in */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-3 rounded-xl mb-4 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          Doorgaan met Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-slate-600 text-xs">or</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* Email / Password */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Wachtwoord"
            required
            minLength={6}
            className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white font-semibold py-3 rounded-xl hover:bg-sky-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Bezig…' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
          </button>
        </form>

        <p className="text-slate-500 text-sm text-center mt-5">
          {mode === 'login' ? 'Nog geen account? ' : 'Al een account? '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="text-sky-400 hover:text-sky-300"
          >
            {mode === 'login' ? 'Registreren' : 'Inloggen'}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Ongeldig e-mailadres.',
    'auth/user-not-found': 'Geen account gevonden met dit e-mailadres.',
    'auth/wrong-password': 'Onjuist wachtwoord.',
    'auth/email-already-in-use': 'Er bestaat al een account met dit e-mailadres.',
    'auth/weak-password': 'Wachtwoord moet minimaal 6 tekens bevatten.',
    'auth/too-many-requests': 'Te veel pogingen. Probeer het later opnieuw.',
    'auth/popup-closed-by-user': 'Inlogvenster gesloten.',
  };
  return messages[code] ?? 'Inloggen mislukt. Probeer het opnieuw.';
}
