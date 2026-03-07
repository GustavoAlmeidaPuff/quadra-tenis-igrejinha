import { GraduationCap } from 'lucide-react';

export default function AulasPage() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
        <GraduationCap className="w-10 h-10 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Aulas de Tenis</h1>
      <p className="text-gray-500 text-base">Esta pagina esta em construcao. Em breve você podera encontrar informacoes sobre aulas de tenis aqui.</p>
    </div>
  );
}
