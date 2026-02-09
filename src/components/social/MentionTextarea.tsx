'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { getRandomColor } from '@/lib/utils';

export interface MentionUser {
  id: string;
  name: string;
  initials: string;
  pictureUrl?: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  users: MentionUser[];
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Formato armazenado: @[Nome](userId) - parseado na exibição */
export const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

function serializeContent(container: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.mention === 'true' && el.dataset.userid != null && el.dataset.name != null) {
        out += `@[${el.dataset.name}](${el.dataset.userid})`;
      } else {
        node.childNodes.forEach(walk);
      }
    } else {
      node.childNodes.forEach(walk);
    }
  };
  container.childNodes.forEach(walk);
  return out;
}

function valueToHtml(value: string): string {
  if (!value) return '';
  let html = '';
  let lastIndex = 0;
  const re = new RegExp(MENTION_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    html += escapeHtml(value.slice(lastIndex, m.index));
    const name = m[1];
    const userId = m[2];
    html += `<span data-mention="true" data-userid="${escapeHtml(userId)}" data-name="${escapeHtml(name)}" contenteditable="false" class="text-blue-600 font-medium">@${escapeHtml(name)}</span>\u200B`;
    lastIndex = m.index + m[0].length;
  }
  html += escapeHtml(value.slice(lastIndex));
  return html.replace(/\n/g, '<br>');
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function getTextBeforeCursor(container: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(container);
  range.setEnd(sel.anchorNode ?? container, sel.anchorOffset);
  return range.toString();
}

function parseMentionTrigger(text: string): { query: string; toReplace: string } | null {
  const lastAt = text.lastIndexOf('@');
  if (lastAt === -1) return null;
  const afterAt = text.slice(lastAt + 1);
  if (/\s/.test(afterAt) || afterAt.includes('\n')) return null;
  // No mobile, texto após uma menção já fechada (ex: "](") pode ser lido como novo trigger
  if (afterAt.includes(']') || afterAt.includes('(')) return null;
  return { query: afterAt.toLowerCase(), toReplace: '@' + afterAt };
}

export function MentionTextarea({
  value,
  onChange,
  placeholder = 'O que está acontecendo na quadra?',
  rows = 2,
  users,
  className = '',
  disabled = false,
  autoFocus = false,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionTrigger, setMentionTrigger] = useState<{ query: string; toReplace: string } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const editableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastEmittedValueRef = useRef<string>(value);
  const isComposingRef = useRef(false);

  const filteredUsers = mentionTrigger
    ? users.filter((u) => u.name.toLowerCase().includes(mentionTrigger.query))
    : [];
  const hasResults = filteredUsers.length > 0;

  const insertMention = useCallback(
    (user: MentionUser) => {
      const el = editableRef.current;
      if (!el || !mentionTrigger) return;

      const currentSerialized = serializeContent(el);
      const replacement = `@[${user.name}](${user.id}) `;
      const lastIdx = currentSerialized.lastIndexOf(mentionTrigger.toReplace);
      const newValue =
        lastIdx >= 0
          ? currentSerialized.slice(0, lastIdx) + replacement + currentSerialized.slice(lastIdx + mentionTrigger.toReplace.length)
          : currentSerialized + replacement;

      el.innerHTML = valueToHtml(newValue);
      lastEmittedValueRef.current = newValue;
      onChange(newValue);

      setShowDropdown(false);
      setMentionTrigger(null);
      setHighlightedIndex(0);

      requestAnimationFrame(() => {
        el.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    },
    [mentionTrigger, onChange]
  );

  const handleInput = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;

    const serialized = serializeContent(el);
    lastEmittedValueRef.current = serialized;
    onChange(serialized);

    // Durante IME/composição no mobile, não abrir dropdown
    if (isComposingRef.current) {
      setShowDropdown(false);
      setMentionTrigger(null);
      return;
    }

    // Evita abrir dropdown ao digitar depois de menção: ex. @[Maicon Berwian](id) + "o"
    // faz getTextBeforeCursor retornar "@Maicon Berwiano", acionando trigger por engano
    if (serialized.match(/@\[[^\]]+\]\([^)]+\)[^@]+$/)) {
      setShowDropdown(false);
      setMentionTrigger(null);
      return;
    }

    const textBefore = getTextBeforeCursor(el);
    const trigger = parseMentionTrigger(textBefore);
    if (trigger) {
      setMentionTrigger(trigger);
      setShowDropdown(true);
      setHighlightedIndex(0);
    } else {
      setShowDropdown(false);
      setMentionTrigger(null);
    }
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!showDropdown || !hasResults) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i < filteredUsers.length - 1 ? i + 1 : i));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : 0));
        return;
      }
      if (e.key === 'Enter' && filteredUsers[highlightedIndex]) {
        e.preventDefault();
        insertMention(filteredUsers[highlightedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        setMentionTrigger(null);
      }
    },
    [showDropdown, hasResults, filteredUsers, highlightedIndex, insertMention]
  );

  useEffect(() => {
    if (!showDropdown) return;
    const el = dropdownRef.current;
    if (!el) return;
    el.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, showDropdown]);

  useEffect(() => {
    if (!mentionTrigger) setShowDropdown(false);
  }, [mentionTrigger]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const currentSerialized = serializeContent(el);
    if (value !== currentSerialized) {
      lastEmittedValueRef.current = value;
      el.innerHTML = valueToHtml(value) || '<br>';
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && editableRef.current) {
      editableRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative flex-1 min-w-0">
      <div
        ref={editableRef}
        contentEditable={!disabled}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; }}
        onInput={handleInput}
        onBlur={() => {
          setTimeout(() => {
            setShowDropdown(false);
            setMentionTrigger(null);
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={`outline-none min-h-0 [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 ${className}`}
        style={{ minHeight: `${rows * 1.5}rem` }}
        suppressContentEditableWarning
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px]"
        >
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-gray-500">Nenhum usuário encontrado</p>
          ) : (
            <ul>
              {filteredUsers.map((u, i) => (
                <li key={u.id}>
                  <button
                    type="button"
                    data-index={i}
                    onClick={() => insertMention(u)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === highlightedIndex ? 'bg-emerald-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {u.pictureUrl ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <Image
                          src={u.pictureUrl}
                          alt={u.name}
                          width={32}
                          height={32}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 ${getRandomColor(u.id)}`}
                      >
                        {u.initials}
                      </div>
                    )}
                    <span className="font-medium text-gray-900 truncate text-sm">{u.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
