'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase/client';

type Store = 'play' | 'app';

export default function Landing() {
  const [open, setOpen] = useState<Store | null>(null);
  const [contact, setContact] = useState('');
  const [kind, setKind] = useState<'whatsapp' | 'email'>('whatsapp');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // tilt do celular conforme o scroll
  const phoneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = phoneRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = window.scrollY;
      const r = Math.max(-8, Math.min(8, -6 + y / 90));
      el.style.transform = `perspective(1200px) rotateY(${-12 + r}deg) rotateX(${4 - r / 2}deg)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function submitWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    const value = contact.trim();
    if (!value) {
      setErrorMsg('Coloca um contato ali em cima 😅');
      return;
    }
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrorMsg('Esse e-mail tá meio torto, confere?');
      return;
    }
    if (kind === 'whatsapp') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        setErrorMsg('Manda o número com DDD (ex: 51 99999-9999).');
        return;
      }
    }
    setStatus('sending');
    try {
      if (!isFirebaseConfigured) throw new Error('firebase-off');
      await addDoc(collection(db, 'waitlist'), {
        kind,
        contact: value,
        store: open === 'play' ? 'Google Play' : 'App Store',
        createdAt: serverTimestamp(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        source: 'landing',
      });
      setStatus('ok');
      setContact('');
    } catch (err) {
      console.error(err);
      setStatus('err');
      setErrorMsg('Não rolou agora. Tenta de novo em alguns segundos.');
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a1f17] text-white selection:bg-primary-400 selection:text-[#0a1f17]">
      {/* Background geométrico */}
      <BackgroundDecor />

      {/* NAV */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">QuadraLivre</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a href="#sobre" className="transition hover:text-white">O que é</a>
          <a href="#mockup" className="transition hover:text-white">Como funciona</a>
          <a href="#numeros" className="transition hover:text-white">Números</a>
          <a href="#contato" className="transition hover:text-white">Contato</a>
        </nav>
        <Link
          href="/login"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:border-primary-400 hover:text-primary-300"
        >
          Entrar
        </Link>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-24 pt-10 md:grid-cols-12 md:pt-16">
        <div className="md:col-span-7">
          <h1 className="text-4xl font-black uppercase leading-[1.05] tracking-tight md:text-6xl">
            Faça sua reserva, eleve seu nível,{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary-300">desafie todos.</span>
              <svg
                className="absolute -bottom-2 left-0 h-3 w-full text-primary-400/70"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8 Q 50 1 100 6 T 198 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="[stroke-dasharray:240] [stroke-dashoffset:240] animate-[draw_1.6s_ease-out_0.4s_forwards]"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70">
            QuadraLivre nasceu pra resolver a bagunça das reservas de tênis na nossa região.
            Você abre o app, vê o que tá livre, marca seu horário e segue treinando.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <StoreButton store="play" onClick={() => setOpen('play')} />
            <StoreButton store="app" onClick={() => setOpen('app')} />
          </div>

          <div className="mt-6 flex items-center gap-4 text-sm text-white/60">
            <Avatars />
            <span>
              <strong className="text-white">+100 jogadores</strong> já reservando direto pelo app
            </span>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="md:col-span-5">
          <div className="relative mx-auto w-full max-w-[340px]">
            <div className="absolute -inset-10 -z-10 rounded-[60px] bg-gradient-to-br from-primary-500/40 via-emerald-300/10 to-transparent blur-3xl" />
            <div
              ref={phoneRef}
              className="relative will-change-transform"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <PhoneMockup variant="hero" />
            </div>
            {/* Bola de tênis flutuante */}
            <TennisBall className="absolute -right-6 -top-6 h-14 w-14 animate-[float_5s_ease-in-out_infinite]" />
            <TennisBall className="absolute -bottom-4 -left-2 h-9 w-9 animate-[float_6s_ease-in-out_-2s_infinite]" />
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="relative z-10 border-t border-white/5 bg-black/20 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
            <div>
              <SectionTag>Por que existe</SectionTag>
              <h2 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
                Marcar quadra na serra virou uma{' '}
                <span className="text-primary-300">rede social de tênis</span>.
              </h2>
              <p className="mt-5 text-white/70">
                Antes era um grupão no WhatsApp, mensagens se perdendo, dois caras marcando o mesmo
                horário e confusão na hora de jogar. A gente resolveu isso com um app simples,
                feito pra jogador, por gente que joga.
              </p>
              <ul className="mt-6 space-y-3 text-white/80">
                <Bullet>Reserva em tempo real, sem briga por horário</Bullet>
                <Bullet>Convide até 3 parceiros e organize a partida</Bullet>
                <Bullet>Veja seu nível, conquistas e patente</Bullet>
                <Bullet>Feed da galera e desafios entre jogadores</Bullet>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard value="+100" label="jogadores ativos" />
              <StatCard value="2" label="cidades cobertas" accent />
              <StatCard value="6" label="quadras parceiras" />
              <StatCard value="24/7" label="reservas no app" accent />
            </div>
          </div>
        </div>
      </section>

      {/* PARCEIROS / FORNECEDORES */}
      <section className="relative z-10 border-y border-white/5 bg-black/30 py-14">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <SectionTag center>Quem apoia o projeto</SectionTag>
          <h3 className="mx-auto mt-3 max-w-xl text-lg font-semibold text-white/80 md:text-xl">
            Parceiros e fornecedores que mantêm o tênis vivo na nossa região
          </h3>
        </div>

        <PartnersMarquee />
      </section>

      {/* MOCKUP DA TELA DE RESERVA */}
      <section id="mockup" className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <SectionTag center>Como funciona</SectionTag>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
              Da intenção ao saque em <span className="text-primary-300">menos de 30 segundos</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/65">
              Essa é a tela de reservas do QuadraLivre — desenhada pra parecer uma agenda mesmo, e
              não um formulário chato.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 items-start gap-8 md:grid-cols-3">
            <Step number="1" title="Abre e vê o que tá rolando">
              Em tempo real: quem tá jogando agora, quem reservou, e onde tem espaço livre no dia.
            </Step>
            <Step number="2" title="Toca e reserva">
              30 min, 1h, 2h — escolhe a duração que faz sentido pro teu treino. Sem regra de slot fixo.
            </Step>
            <Step number="3" title="Chama a galera e bora jogar">
              Marca os parceiros direto no app. Todo mundo recebe lembrete antes do horário.
            </Step>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7">
              <ReservationMockup />
            </div>
            <div className="md:col-span-5">
              <h3 className="text-2xl font-bold">A interface que faz a galera abrir todo dia</h3>
              <p className="mt-4 text-white/70">
                A tela de reservas é o coração do app. Uma agenda visual, com cores honestas:
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary-500/20 px-2 py-0.5 text-xs font-medium text-primary-300">
                  livre
                </span>
                ,
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
                  reservado
                </span>{' '}
                e
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                  você
                </span>
                . Sem firula, sem 50 cliques.
              </p>
              <ul className="mt-6 space-y-3 text-white/80">
                <Bullet>Troca de quadra num menu só</Bullet>
                <Bullet>Reserva em 2 toques</Bullet>
                <Bullet>Lembrete antes do horário</Bullet>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* NÚMEROS / CIDADES */}
      <section id="numeros" className="relative z-10 border-t border-white/5 bg-black/30 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <div>
              <SectionTag>Onde está rolando</SectionTag>
              <h2 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
                Feito na serra,{' '}
                <span className="text-primary-300">pra quem joga aqui</span>.
              </h2>
              <p className="mt-5 text-white/70">
                Começou com uma quadra em Igrejinha, virou referência, atravessou o Paranhana e hoje
                organiza a agenda de jogadores em duas cidades — com mais a caminho.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CityChip name="Igrejinha — RS" active />
                <CityChip name="Três Coroas — RS" active />
                <CityChip name="Sua cidade?" />
              </div>
            </div>
            <CourtIllustration />
          </div>
        </div>
      </section>

      {/* CTA / DOWNLOAD */}
      <section id="contato" className="relative z-10 py-24">
        <div className="mx-auto max-w-4xl px-5">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600/30 via-emerald-700/10 to-transparent p-10 md:p-14">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-400/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
            <CourtLines className="absolute inset-0 h-full w-full opacity-[0.07]" />

            <div className="relative">
              <h2 className="text-3xl font-black leading-tight md:text-5xl">
                Quase lá. <span className="text-primary-300">App nas lojas em breve.</span>
              </h2>
              <p className="mt-4 max-w-lg text-white/70">
                Deixa teu WhatsApp que a gente te chama no dia do lançamento — direto, sem spam,
                sem newsletter chata.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <StoreButton store="play" onClick={() => setOpen('play')} large />
                <StoreButton store="app" onClick={() => setOpen('app')} large />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-white/50 md:flex-row">
          <div className="flex items-center gap-2">
            <Logo small />
            <span>QuadraLivre · Igrejinha-RS</span>
          </div>
          <span>Feito por jogadores, pra jogadores. 🎾</span>
        </div>
      </footer>

      {/* MODAL WAITLIST */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => {
            if (status !== 'sending') {
              setOpen(null);
              setStatus('idle');
              setErrorMsg('');
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-[#0e2a1f] p-7 shadow-2xl animate-[slideup_.25s_ease-out] sm:rounded-3xl"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-400/20 blur-3xl" />
            <button
              onClick={() => {
                if (status !== 'sending') {
                  setOpen(null);
                  setStatus('idle');
                  setErrorMsg('');
                }
              }}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              ✕
            </button>

            {status === 'ok' ? (
              <div className="relative py-6 text-center">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary-500/20 text-3xl">
                  🎾
                </div>
                <h3 className="text-2xl font-bold">Tá na lista!</h3>
                <p className="mt-2 text-white/70">
                  Quando o app estiver no ar, te avisamos pessoalmente. Bom jogo!
                </p>
                <button
                  onClick={() => {
                    setOpen(null);
                    setStatus('idle');
                  }}
                  className="mt-6 rounded-full bg-primary-500 px-6 py-2.5 font-semibold text-[#0a1f17] transition hover:bg-primary-400"
                >
                  Beleza
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-400/10 px-3 py-1 text-xs font-medium text-primary-300">
                  Em breve · {open === 'play' ? 'Google Play' : 'App Store'}
                </div>
                <h3 className="text-2xl font-bold">Avisa quando lançar?</h3>
                <p className="mt-2 text-sm text-white/65">
                  Manda teu WhatsApp ou e-mail — a gente fala contigo direto, sem lista de
                  marketing.
                </p>

                <div className="mt-5 inline-flex rounded-full bg-white/5 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setKind('whatsapp')}
                    className={`rounded-full px-4 py-1.5 font-medium transition ${
                      kind === 'whatsapp' ? 'bg-primary-500 text-[#0a1f17]' : 'text-white/70'
                    }`}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('email')}
                    className={`rounded-full px-4 py-1.5 font-medium transition ${
                      kind === 'email' ? 'bg-primary-500 text-[#0a1f17]' : 'text-white/70'
                    }`}
                  >
                    E-mail
                  </button>
                </div>

                <form onSubmit={submitWaitlist} className="mt-4">
                  <input
                    type={kind === 'email' ? 'email' : 'tel'}
                    inputMode={kind === 'email' ? 'email' : 'tel'}
                    autoFocus
                    placeholder={
                      kind === 'whatsapp' ? '(51) 99999-9999' : 'voce@email.com'
                    }
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/35 outline-none transition focus:border-primary-400 focus:bg-white/10"
                  />
                  {errorMsg && (
                    <p className="mt-2 text-sm text-rose-300">{errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 font-semibold text-[#0a1f17] transition hover:bg-primary-400 disabled:opacity-60"
                  >
                    {status === 'sending' ? 'Enviando...' : 'Quero ser avisado'}
                  </button>
                  <p className="mt-3 text-center text-xs text-white/40">
                    Sem spam. Sem lista de e-mail. Só o aviso de lançamento.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* -------------------- Subcomponentes -------------------- */

function Logo({ small = false }: { small?: boolean }) {
  const size = small ? 30 : 36;
  return (
    <img
      src="/images/logo-white.svg"
      alt="QuadraLivre"
      width={size}
      height={size}
      className="object-contain [filter:brightness(0)_invert(1)]"
      style={{ width: size, height: size }}
    />
  );
}

function SectionTag({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-primary-400/25 bg-primary-400/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-300 ${
        center ? 'mx-auto' : ''
      }`}
    >
      <span className="h-1 w-1 rounded-full bg-primary-400" />
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-primary-500/20 text-primary-300">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
        accent
          ? 'border-primary-400/30 bg-gradient-to-br from-primary-500/15 to-transparent'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="text-3xl font-black tracking-tight md:text-4xl">{value}</div>
      <div className="mt-1 text-sm text-white/60">{label}</div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-primary-400/30 hover:bg-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-500 text-sm font-bold text-[#0a1f17]">
          {number}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-white/65">{children}</p>
    </div>
  );
}

function PartnersMarquee() {
  const partners = [
    { name: 'Auto Sandense', file: 'auto sandense.png' },
    { name: 'Climacar', file: 'climacar.png' },
    { name: 'Sanvitron', file: 'sanvitron.png' },
    { name: 'Rafitos', file: 'rafitos lettering.png' },
  ];
  // repete a lista o bastante pra garantir que UMA cópia seja larga o bastante
  // pra cobrir telas grandes — depois duplicamos esse bloco pra fazer o loop infinito.
  const repeatedOnce = Array.from({ length: 4 }, () => partners).flat();

  const Track = () => (
    <div className="flex shrink-0 items-center">
      {repeatedOnce.map((p, i) => (
        <div
          key={`${p.name}-${i}`}
          className="group flex h-20 flex-shrink-0 items-center justify-center px-10"
          title={p.name}
        >
          <img
            src={`/images/${encodeURIComponent(p.file)}`}
            alt={p.name}
            className="h-14 w-auto max-w-[160px] object-contain opacity-60 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative mt-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0a1f17] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0a1f17] to-transparent" />

      <div className="flex w-max animate-[marquee_40s_linear_infinite] items-center">
        <Track />
        <Track aria-hidden />
      </div>
    </div>
  );
}

function CityChip({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? 'border-primary-400/40 bg-primary-500/15 text-primary-200'
          : 'border-dashed border-white/15 text-white/40'
      }`}
    >
      {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400" />}
      {name}
    </span>
  );
}

function StoreButton({
  store,
  onClick,
  large = false,
}: {
  store: Store;
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-primary-400/40 hover:bg-white/[0.08] ${
        large ? 'px-6 py-4' : 'px-5 py-3'
      }`}
    >
      <span className="text-2xl">{store === 'play' ? <PlayIcon /> : <AppleIcon />}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-white/50">
          {store === 'play' ? 'Disponível na' : 'Baixe na'}
        </span>
        <span className="text-base font-semibold">
          {store === 'play' ? 'Google Play' : 'App Store'}
        </span>
      </span>
      <span className="ml-auto rounded-full bg-primary-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-300">
        Em breve
      </span>
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3.6 2.5c-.4.3-.6.8-.6 1.4v16.2c0 .6.2 1.1.6 1.4l9.3-9.5L3.6 2.5z"
        fill="#10b981"
      />
      <path d="M16.4 8.6L13 12l3.4 3.4 4-2.3c.9-.5.9-1.7 0-2.2l-4-2.3z" fill="#34d399" />
      <path d="M12.9 12L3.6 21.5c.3.2.7.2 1.2-.1l11.6-6.4L12.9 12z" fill="#a7f3d0" />
      <path d="M16.4 8.6L4.8 2.6c-.5-.3-.9-.3-1.2-.1L12.9 12l3.5-3.4z" fill="#6ee7b7" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M16.5 12.5c0-2.4 2-3.5 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.2.7 1.1 1.6 2.4 2.8 2.4 1.1 0 1.6-.7 2.9-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.9zM14.3 5.6c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.4-.6.6-1.1 1.7-1 2.6 1 .1 2.1-.5 2.7-1.3z" />
    </svg>
  );
}

function TennisBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <defs>
        <radialGradient id="tball" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#e8ff7a" />
          <stop offset="60%" stopColor="#bef264" />
          <stop offset="100%" stopColor="#65a30d" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#tball)" />
      <path
        d="M8 24 Q 32 14 56 24"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 40 Q 32 50 56 40"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Avatars() {
  const colors = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#a7f3d0'];
  return (
    <div className="flex -space-x-2">
      {colors.map((c, i) => (
        <div
          key={i}
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#0a1f17] text-[10px] font-bold text-[#0a1f17]"
          style={{ background: c }}
        >
          {String.fromCharCode(65 + i)}
        </div>
      ))}
    </div>
  );
}

/* ----------- Phone + Reservation Mockups ----------- */

function PhoneMockup({ variant = 'hero' }: { variant?: 'hero' }) {
  // versão compacta da timeline (mesma lógica do desktop)
  const PHONE_HOUR_PX = 30;
  const PHONE_START = 7;
  const PHONE_END = 22;
  const PHONE_NOW = 9 + 20 / 60;

  const phoneRes: Reservation[] = [
    { start: 7, end: 8.5, who: 'Felipe + Gus', avatars: ['F', 'G'], state: 'passado' },
    { start: 9, end: 10, who: 'Lucas + Mari', avatars: ['L', 'M'], state: 'agora' },
    { start: 10, end: 11.5, who: 'você + Pedro', avatars: ['V', 'P'], state: 'seu' },
    { start: 13, end: 14, who: 'Júlia + Kaio', avatars: ['J', 'K'], state: 'futuro' },
    { start: 15, end: 16.5, who: 'Bruno + Tati', avatars: ['B', 'T'], state: 'futuro' },
    { start: 18, end: 19, who: 'Aula · Prof. Léo', avatars: ['L'], state: 'futuro' },
    { start: 19.5, end: 21, who: 'Diego + Ana', avatars: ['D', 'A'], state: 'futuro' },
  ];

  return (
    <div className="relative aspect-[9/19] w-full rounded-[44px] border border-white/10 bg-[#06140e] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-b from-[#0c2419] to-[#08180f]">
        <div className="flex items-center justify-between px-5 pt-5 text-[10px] text-white/60">
          <span>9:41</span>
          <span>●●●● 5G</span>
        </div>
        <div className="flex-1 px-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-primary-300">Hoje</div>
              <div className="text-base font-bold text-white">Quadra Igrejinha</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-primary-500/15 px-2.5 py-1 text-[9px] text-primary-300">
            <span className="h-1 w-1 animate-pulse rounded-full bg-primary-400" />
            Lucas + Mari jogando agora
          </div>

          <div className="mt-3 flex gap-1">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
              <div
                key={i}
                className={`flex-1 rounded-lg py-1.5 text-center text-[9px] ${
                  i === 2 ? 'bg-primary-500 font-bold text-[#0a1f17]' : 'bg-white/5 text-white/60'
                }`}
              >
                <div>{d}</div>
                <div className="font-bold">{10 + i}</div>
              </div>
            ))}
          </div>

          {/* timeline compacta */}
          <div
            className="relative mt-3"
            style={{ height: (PHONE_END - PHONE_START) * PHONE_HOUR_PX }}
          >
            {Array.from({ length: PHONE_END - PHONE_START + 1 }).map((_, i) => {
              const hour = PHONE_START + i;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-center"
                  style={{ top: i * PHONE_HOUR_PX }}
                >
                  <div className="w-7 pr-1 text-right text-[8px] font-semibold text-white/30">
                    {String(hour).padStart(2, '0')}h
                  </div>
                  <div className="h-px flex-1 bg-white/[0.05]" />
                </div>
              );
            })}

            <div className="absolute left-7 right-0 top-0 bottom-0">
              {phoneRes.map((r, idx) => {
                const top = (r.start - PHONE_START) * PHONE_HOUR_PX;
                const height = (r.end - r.start) * PHONE_HOUR_PX - 2;
                const isPast = r.state === 'passado';
                const isAgora = r.state === 'agora';
                const isSeu = r.state === 'seu';

                const styles = isSeu
                  ? 'border-amber-400/40 bg-amber-400/15 text-amber-100'
                  : isAgora
                  ? 'border-primary-400/50 bg-primary-500/25 text-white'
                  : isPast
                  ? 'border-white/10 bg-white/[0.04] text-white/30 opacity-60'
                  : 'border-white/15 bg-white/[0.07] text-white/70';

                return (
                  <div
                    key={idx}
                    className={`absolute left-0.5 right-1 overflow-hidden rounded-md border px-1.5 py-0.5 ${styles}`}
                    style={{ top, height }}
                  >
                    <div
                      className={`absolute left-0 top-0 h-full w-0.5 ${
                        isSeu ? 'bg-amber-400' : isAgora ? 'bg-primary-400' : 'bg-white/30'
                      }`}
                    />
                    <div className="ml-1 flex h-full items-center justify-between gap-1">
                      <div className="min-w-0 truncate text-[9px] font-bold leading-tight">
                        {r.who}
                      </div>
                      {height > 28 && (
                        <div className="flex flex-shrink-0 -space-x-1">
                          {r.avatars.map((a, i) => (
                            <div
                              key={i}
                              className={`grid h-3.5 w-3.5 place-items-center rounded-full border border-[#0a1f17] text-[7px] font-bold ${
                                isSeu
                                  ? 'bg-amber-400 text-[#0a1f17]'
                                  : isAgora
                                  ? 'bg-primary-400 text-[#0a1f17]'
                                  : 'bg-primary-700 text-white'
                              }`}
                            >
                              {a}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* now line */}
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 flex items-center gap-1"
              style={{ top: (PHONE_NOW - PHONE_START) * PHONE_HOUR_PX }}
            >
              <div className="w-7 pr-1 text-right text-[8px] font-bold text-rose-400">9:20</div>
              <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400 shadow-[0_0_5px_1px_rgba(251,113,133,0.6)]" />
              <div className="h-px flex-1 bg-rose-400/70" />
            </div>
          </div>
        </div>

        {/* bottom nav */}
        <div className="relative mt-2 flex items-center justify-around border-t border-white/5 bg-[#06140e]/80 px-6 pb-5 pt-3 backdrop-blur">
          <NavIcon label="Home" active={false}>
            <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H10v7H6a2 2 0 0 1-2-2v-9z" />
          </NavIcon>

          {/* botão central destacado */}
          <div className="relative -mt-7">
            <div className="absolute -inset-1 animate-pulse rounded-full bg-primary-400/40 blur-md" />
            <div className="relative grid h-12 w-12 place-items-center rounded-full bg-primary-500 shadow-[0_8px_24px_-4px_rgba(16,185,129,0.6)] ring-4 ring-[#06140e]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1f17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
                <path d="M8 14h3M8 17h6" />
              </svg>
            </div>
            <div className="mt-1 text-center text-[8px] font-bold uppercase tracking-wider text-primary-300">
              Reservar
            </div>
          </div>

          <NavIcon label="Social" active={false}>
            <circle cx="9" cy="8" r="3.5" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M14 19c0-2 1.7-3 3.5-3s3.5 1 3.5 3" />
          </NavIcon>
        </div>
      </div>
    </div>
  );
}

function NavIcon({
  children,
  label,
  active,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <button className="flex flex-col items-center gap-1">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#34d399' : 'rgba(255,255,255,0.45)'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span
        className={`text-[8px] font-medium uppercase tracking-wider ${
          active ? 'text-primary-300' : 'text-white/40'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

// timeline: 07h às 15h. cada hora = 64px. "agora" simulado às 09:20.
const HOUR_PX = 64;
const START_HOUR = 7;
const END_HOUR = 15;
const NOW_HOUR = 9 + 20 / 60;

type Reservation = {
  start: number; // hora decimal (ex 8.5 = 08:30)
  end: number;
  who: string;
  avatars: string[];
  state: 'passado' | 'agora' | 'futuro' | 'seu';
};

const RESERVATIONS: Reservation[] = [
  { start: 7, end: 8.5, who: 'Felipe + Gus', avatars: ['F', 'G'], state: 'passado' },
  { start: 9, end: 10, who: 'Lucas + Mari', avatars: ['L', 'M'], state: 'agora' },
  { start: 10, end: 11.5, who: 'você + Pedro, Carla', avatars: ['V', 'P', 'C'], state: 'seu' },
  { start: 13, end: 14, who: 'Júlia + Kaio', avatars: ['J', 'K'], state: 'futuro' },
];

function fmt(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function ReservationMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary-500/20 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0a1f17] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]">
        {/* fake browser bar */}
        <div className="flex items-center gap-1.5 border-b border-white/5 bg-black/30 px-4 py-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          <div className="ml-3 rounded-md bg-white/5 px-3 py-0.5 text-[10px] text-white/40">
            quadralivre.app/reservar
          </div>
        </div>

        <div className="p-5 md:p-7">
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-primary-300">Quarta · 12 mar</div>
              <h4 className="mt-0.5 text-xl font-bold">Quadra Igrejinha · Saibro</h4>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 rounded-full bg-primary-500/15 px-3 py-1 text-[11px] text-primary-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400" />
                Na quadra agora: Lucas + Mari
              </div>
              <div className="text-[10px] text-white/40">09:20</div>
            </div>
          </div>

          {/* day strip */}
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {(['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'] as const).map((d, i) => (
              <button
                key={d}
                className={`rounded-xl py-1.5 text-center text-[11px] transition ${
                  i === 2
                    ? 'bg-primary-500 font-bold text-[#0a1f17]'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <div className="opacity-70">{d}</div>
                <div className="font-bold">{10 + i}</div>
              </button>
            ))}
          </div>

          {/* Calendar timeline — livre = vazio, reserva = bloco com altura proporcional */}
          <div
            className="relative mt-5"
            style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}
          >
            {/* linhas das horas + label */}
            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
              const hour = START_HOUR + i;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-center"
                  style={{ top: i * HOUR_PX }}
                >
                  <div className="w-12 flex-shrink-0 pr-2 text-right text-[10px] font-semibold text-white/35">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
              );
            })}

            {/* meias horas (mais sutis) */}
            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
              <div
                key={`half-${i}`}
                className="pointer-events-none absolute left-12 right-0 h-px bg-white/[0.025]"
                style={{ top: i * HOUR_PX + HOUR_PX / 2 }}
              />
            ))}

            {/* área de reservas */}
            <div className="absolute left-12 right-0 top-0 bottom-0">
              {RESERVATIONS.map((r, idx) => {
                const top = (r.start - START_HOUR) * HOUR_PX;
                const height = (r.end - r.start) * HOUR_PX - 4;
                const isPast = r.state === 'passado';
                const isAgora = r.state === 'agora';
                const isSeu = r.state === 'seu';

                const styles = isSeu
                  ? 'border-amber-400/40 bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-100'
                  : isAgora
                  ? 'border-primary-400/50 bg-gradient-to-br from-primary-500/30 to-primary-600/15 text-white'
                  : isPast
                  ? 'border-white/10 bg-white/[0.04] text-white/40 opacity-60'
                  : 'border-white/15 bg-white/[0.07] text-white/80';

                return (
                  <div
                    key={idx}
                    className={`absolute left-1 right-2 overflow-hidden rounded-lg border px-2.5 py-1.5 ${styles}`}
                    style={{ top, height }}
                  >
                    {/* faixa lateral */}
                    <div
                      className={`absolute left-0 top-0 h-full w-1 ${
                        isSeu
                          ? 'bg-amber-400'
                          : isAgora
                          ? 'bg-primary-400'
                          : isPast
                          ? 'bg-white/20'
                          : 'bg-white/30'
                      }`}
                    />
                    <div className="ml-1.5 flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold leading-tight">
                            {r.who}
                            {isAgora && (
                              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-primary-400/25 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-200">
                                <span className="h-1 w-1 animate-pulse rounded-full bg-primary-300" />
                                jogando
                              </span>
                            )}
                            {isSeu && (
                              <span className="ml-1.5 rounded-full bg-amber-400/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-100">
                                sua
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-white/50">
                            {fmt(r.start)} – {fmt(r.end)}
                          </div>
                        </div>
                        {height > 50 && (
                          <div className="flex flex-shrink-0 -space-x-1.5">
                            {r.avatars.map((a, i) => (
                              <div
                                key={i}
                                className={`grid h-5 w-5 place-items-center rounded-full border-2 border-[#0a1f17] text-[8px] font-bold ${
                                  isSeu
                                    ? 'bg-amber-400 text-[#0a1f17]'
                                    : isAgora
                                    ? 'bg-primary-400 text-[#0a1f17]'
                                    : 'bg-primary-700 text-white'
                                }`}
                              >
                                {a}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* linha "agora" */}
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 flex items-center gap-1.5"
              style={{ top: (NOW_HOUR - START_HOUR) * HOUR_PX }}
            >
              <div className="w-12 pr-1 text-right text-[10px] font-bold text-rose-400">
                {fmt(NOW_HOUR)}
              </div>
              <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-rose-400 shadow-[0_0_8px_2px_rgba(251,113,133,0.6)]" />
              <div className="h-px flex-1 bg-rose-400/70" />
            </div>
          </div>

          {/* footer */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-500/10 to-transparent p-3.5">
            <div>
              <div className="text-[10px] text-white/40">Próxima reserva</div>
              <div className="text-sm font-semibold">Hoje, 10:00 · com Pedro e Carla</div>
            </div>
            <button className="rounded-full bg-primary-500 px-4 py-2 text-[11px] font-bold text-[#0a1f17]">
              Ver detalhes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function CourtIllustration() {
  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-900/40 to-[#0a1f17]">
      <CourtLines className="absolute inset-0 h-full w-full" />
      {/* Pinos das cidades */}
      <CityPin top="30%" left="34%" name="Igrejinha" />
      <CityPin top="58%" left="62%" name="Três Coroas" />
      {/* trail */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M34 30 Q 50 10 62 58"
          stroke="#34d399"
          strokeWidth="0.4"
          strokeDasharray="1 1.5"
          fill="none"
        />
      </svg>
    </div>
  );
}

function CityPin({ top, left, name }: { top: string; left: string; name: string }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full" style={{ top, left }}>
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary-400/40" />
        <div className="relative grid h-5 w-5 place-items-center rounded-full bg-primary-400 ring-4 ring-primary-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0a1f17]" />
        </div>
      </div>
      <div className="mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
        {name}
      </div>
    </div>
  );
}

function CourtLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" preserveAspectRatio="none" className={className}>
      <rect x="20" y="20" width="160" height="120" fill="none" stroke="#a7f3d0" strokeWidth="1" />
      <line x1="100" y1="20" x2="100" y2="140" stroke="#a7f3d0" strokeWidth="1" />
      <line x1="20" y1="80" x2="180" y2="80" stroke="#a7f3d0" strokeWidth="0.5" strokeDasharray="2 2" />
      <rect x="40" y="55" width="120" height="50" fill="none" stroke="#a7f3d0" strokeWidth="0.6" />
      <line x1="40" y1="80" x2="160" y2="80" stroke="#a7f3d0" strokeWidth="0.6" />
    </svg>
  );
}

function BackgroundDecor() {
  return (
    <>
      {/* gradient ambiental */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary-600/30 blur-[120px]" />
        <div className="absolute right-[-200px] top-[40%] h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-[100px]" />
        {/* grid de quadra */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.06]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="court-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#court-grid)" />
        </svg>
        {/* bolas geométricas */}
        <div className="absolute left-[6%] top-[18%] h-2 w-2 rounded-full bg-primary-300/70 animate-[float_7s_ease-in-out_infinite]" />
        <div className="absolute right-[10%] top-[28%] h-1.5 w-1.5 rounded-full bg-emerald-300/60 animate-[float_9s_ease-in-out_-3s_infinite]" />
        <div className="absolute left-[20%] top-[60%] h-3 w-3 rounded-full bg-primary-400/40 animate-[float_8s_ease-in-out_-1s_infinite]" />
      </div>
    </>
  );
}
