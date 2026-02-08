import { User } from '@/lib/types';
import { getInitials, getRandomColor } from '@/lib/utils';
import Image from 'next/image';

interface AvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-20 h-20 text-2xl',
  };

  const initials = getInitials(user.firstName ?? '', user.lastName ?? '');
  const bgColor = getRandomColor(user.email ?? user.id);

  if (user.pictureUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden ${className}`}>
        <Image 
          src={user.pictureUrl} 
          alt={`${user.firstName} ${user.lastName}`}
          width={size === 'lg' ? 80 : size === 'md' ? 40 : 32}
          height={size === 'lg' ? 80 : size === 'md' ? 40 : 32}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold ${className}`}
    >
      {initials}
    </div>
  );
}
