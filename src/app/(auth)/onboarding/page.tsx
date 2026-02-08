'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import ErrorWithSupportLink from '@/components/ui/ErrorWithSupportLink';

export default function OnboardingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) return;
    
    setError('');
    try {
      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        router.push('/login');
        return;
      }

      await setDoc(
        doc(db, 'users', user.uid),
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: user.email ?? undefined,
          pictureUrl: user.photoURL ?? undefined,
          isAnonymous: false,
          isPrivate: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setShowWelcome(true);
      setTimeout(() => {
        router.push('/home');
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar dados. Tente novamente.';
      setError(message);
      setLoading(false);
    }
  };

  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-md text-center space-y-6 animate-fade-in">
          <div className="text-6xl mb-4">👋</div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bem-vindo, {firstName}!
          </h1>
          <div className="space-y-4 text-left bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="font-semibold text-lg text-gray-900">Regras da quadra:</h2>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Cada partida tem duração de <strong>1h30</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Máximo de <strong>1 reserva por dia</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Máximo de <strong>4 reservas por semana</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>Reservas disponíveis para os <strong>próximos 7 dias</strong></span>
              </li>
            </ul>
          </div>
          <p className="text-sm text-gray-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Seu nome</h1>
          <p className="text-gray-600">Como você quer ser chamado nas partidas?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              Primeiro nome
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="João"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Último nome
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="Silva"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
              <ErrorWithSupportLink message={error} roleAlert />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !firstName.trim() || !lastName.trim()}
            className="w-full bg-emerald-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
