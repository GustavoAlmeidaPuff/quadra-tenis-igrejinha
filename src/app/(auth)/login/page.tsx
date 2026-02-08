'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthErrorCodes,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import CourtStatus from '@/components/layout/CourtStatus';
import ErrorWithSupportLink from '@/components/ui/ErrorWithSupportLink';
import Image from 'next/image';

type AuthMode = 'login' | 'signup';

async function ensureUserDocAndRedirect(
  uid: string,
  email: string | null,
  pictureUrl: string | null,
  router: ReturnType<typeof useRouter>
) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', uid), {
      email: email ?? undefined,
      pictureUrl: pictureUrl ?? undefined,
      isAnonymous: false,
      isPrivate: false,
      createdAt: serverTimestamp(),
    });
    router.push('/onboarding');
  } else if (!userDoc.data().firstName) {
    router.push('/onboarding');
  } else {
    router.push('/home');
  }
}

function getAuthErrorMessage(code: string): string {
  switch (code) {
    case AuthErrorCodes.INVALID_EMAIL:
      return 'Email inválido.';
    case AuthErrorCodes.USER_DISABLED:
      return 'Esta conta foi desativada.';
    case AuthErrorCodes.USER_DELETED:
      return 'Conta não encontrada.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email ou senha incorretos.';
    case AuthErrorCodes.EMAIL_EXISTS:
      return 'Este email já está em uso. Tente entrar ou use outro email.';
    case AuthErrorCodes.WEAK_PASSWORD:
      return 'Senha muito fraca. Use pelo menos 6 caracteres.';
    case AuthErrorCodes.INVALID_PASSWORD:
      return 'Senha inválida.';
    case 'auth/account-exists-with-different-credential':
      return 'Este email já está cadastrado com Google. Use "Entrar com Google" para acessar. No perfil você pode definir uma senha para entrar também com email e senha na mesma conta.';
    default:
      return 'Ocorreu um erro. Tente novamente.';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists() && userDoc.data().firstName) {
          router.push('/home');
        } else {
          router.push('/onboarding');
        }
      } else {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await ensureUserDocAndRedirect(
        user.uid,
        user.email ?? null,
        user.photoURL ?? null,
        router
      );
    } catch (error: unknown) {
      console.error('Erro ao fazer login:', error);
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : '';
      setErrorMessage(getAuthErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim()) {
      setErrorMessage('Digite seu email.');
      return;
    }
    if (!password) {
      setErrorMessage('Digite sua senha.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const trimmedEmail = email.trim();

      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await ensureUserDocAndRedirect(
          credential.user.uid,
          credential.user.email ?? null,
          credential.user.photoURL ?? null,
          router
        );
      } else {
        const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        await ensureUserDocAndRedirect(
          credential.user.uid,
          credential.user.email ?? null,
          credential.user.photoURL ?? null,
          router
        );
      }
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : '';
      setErrorMessage(getAuthErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50 to-white">
      {/* Hero Image */}
      <div className="relative w-full h-64 overflow-hidden">
        <Image
          src="/images/quadra.png"
          alt="Quadra de Tênis"
          fill
          className="object-cover object-center"
          priority
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Fade out na parte de baixo para transição suave com o conteúdo */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 45%, rgb(236 253 245) 100%)',
          }}
          aria-hidden
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-16 relative z-20 py-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Quadra de Tênis</h1>
            <p className="text-sm text-gray-600">Igrejinha, RS</p>
          </div>

          {/* Court Status */}
          <div className="flex justify-center py-2">
            <CourtStatus showLabel={true} />
          </div>

          {/* Google Sign In Button - logo abaixo de Quadra livre */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-xl px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-500">ou</span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email / Senha */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">Email e senha</p>
          </div>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:opacity-50"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
              )}
            </div>
            {errorMessage && (
              <div className="text-sm text-red-600">
                <ErrorWithSupportLink message={errorMessage} roleAlert />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mx-auto" />
              ) : mode === 'login' ? (
                'Entrar'
              ) : (
                'Criar conta'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setErrorMessage('');
              }}
              disabled={loading}
              className="w-full text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
            >
              {mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
