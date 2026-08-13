'use client';

import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  Snowflake,
  LucideIcon,
} from 'lucide-react';
import { mapWeatherCode, WeatherHour, WeatherIcon } from '@/lib/weather';

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  partly: CloudSun,
  'partly-night': CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
  snow: Snowflake,
};

const ICON_COLORS: Record<WeatherIcon, string> = {
  sun: 'text-amber-500',
  moon: 'text-slate-400',
  partly: 'text-amber-500',
  'partly-night': 'text-slate-400',
  cloud: 'text-gray-400',
  fog: 'text-gray-400',
  drizzle: 'text-blue-400',
  rain: 'text-blue-500',
  storm: 'text-indigo-500',
  snow: 'text-blue-300',
};

/** Quanto maior a chance de chuva, mais a porcentagem chama atenção. */
function rainColor(chance: number): string {
  if (chance >= 70) return 'text-blue-600';
  if (chance >= 50) return 'text-amber-600';
  return 'text-gray-400';
}

/**
 * Ícone do tempo + chance de chuva de uma hora.
 * Sem previsão (fora da janela de 7 dias ou sem rede) não renderiza nada.
 */
export default function WeatherBadge({
  hour,
  iconSize = 14,
  showChance = true,
}: {
  hour: WeatherHour | undefined;
  iconSize?: number;
  showChance?: boolean;
}) {
  if (!hour) return null;
  const { icon, label } = mapWeatherCode(hour.code, hour.isDay);
  const Icon = ICONS[icon];

  return (
    <span className="flex items-center gap-1" title={`${label} · ${hour.rainChance}% de chuva`}>
      <Icon size={iconSize} className={`flex-shrink-0 ${ICON_COLORS[icon]}`} aria-hidden />
      {showChance && (
        <span className={`text-[10px] font-semibold tabular-nums ${rainColor(hour.rainChance)}`}>
          {hour.rainChance}%
        </span>
      )}
    </span>
  );
}
