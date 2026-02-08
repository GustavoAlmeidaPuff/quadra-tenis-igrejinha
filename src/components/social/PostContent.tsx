'use client';

import Link from 'next/link';
import { MENTION_REGEX } from './MentionTextarea';

interface PostContentProps {
  content: string;
  className?: string;
}

/** Renderiza o conteúdo do post com menções @[Nome](userId) como links azuis clicáveis */
export function PostContent({ content, className = '' }: PostContentProps) {
  const parts: Array<{ type: 'text' | 'mention'; text: string; userId?: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;

  while ((m = MENTION_REGEX.exec(content)) !== null) {
    if (m.index > lastIndex) {
      parts.push({
        type: 'text',
        text: content.slice(lastIndex, m.index),
      });
    }
    parts.push({
      type: 'mention',
      text: m[1],
      userId: m[2],
    });
    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  if (parts.length === 0) {
    return (
      <span className={`whitespace-pre-wrap ${className}`.trim()}>{content}</span>
    );
  }

  return (
    <span className={`whitespace-pre-wrap ${className}`.trim()}>
      {parts.map((part, i) =>
        part.type === 'mention' && part.userId ? (
          <Link
            key={i}
            href={`/perfil/${part.userId}`}
            className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            @{part.text}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}
