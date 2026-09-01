/**
 * Reflectly — Premium Wellness Landing Page
 * React + Tailwind CSS  |  Framer Motion ready
 *
 * Color System
 * --primary:     #1B4FD8  (Royal Blue)
 * --sky:         #4B9FE1  (Soft Sky Blue)
 * --ocean:       #0D2B7A  (Deep Ocean)
 * --cream:       #F5F3EE
 * --beige:       #EDE9E0
 * --surface:     #F8FBFF
 */

import { useState, useEffect } from 'react'

// ─── tiny helpers ────────────────────────────────────────────────────────────
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ─── Icons (inline SVG — no extra dep) ───────────────────────────────────────
const Icon = {
  Heart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  Leaf: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M17 8C8 10 5.9 16.17 3.82 19.98M9.5 4.75c3.79.99 8.03 4.47 7.97 11.12" />
      <path d="M3 3c3 4 5 7 5 11" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Waves: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  ),
  Brain: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.5-2.3 2.5 2.5 0 0 1-1-2 2.5 2.5 0 0 1 1-2 2.5 2.5 0 0 1 1.5-2.3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.5-2.3 2.5 2.5 0 0 0 1-2 2.5 2.5 0 0 0-1-2 2.5 2.5 0 0 0-1.5-2.3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  TrendingUp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Quote: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 opacity-20">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  ),
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(27,79,216,0.08)' : 'none',
        boxShadow: scrolled ? '0 4px 32px rgba(27,79,216,0.06)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)' }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
            </svg>
          </div>
          <span className="text-xl font-bold" style={{ color: '#0D2B7A', letterSpacing: '-0.02em' }}>
            Reflectly
          </span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {['Reflections', 'Programs', 'Resources', 'Community', 'About Us'].map(link => (
            <a
              key={link}
              href="#"
              className="text-sm font-medium transition-colors duration-200 hover:text-blue-600"
              style={{ color: '#4A5568' }}
            >
              {link}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <button
            className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:bg-blue-50"
            style={{ color: '#1B4FD8' }}
          >
            Log in
          </button>
          <button
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)',
              boxShadow: '0 4px 16px rgba(27,79,216,0.35)',
            }}
          >
            Get Started
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-9 h-9 flex flex-col justify-center items-center gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className={cn('w-5 h-0.5 bg-gray-700 transition-all duration-300', menuOpen && 'rotate-45 translate-y-2')} />
          <span className={cn('w-5 h-0.5 bg-gray-700 transition-all duration-300', menuOpen && 'opacity-0')} />
          <span className={cn('w-5 h-0.5 bg-gray-700 transition-all duration-300', menuOpen && '-rotate-45 -translate-y-2')} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4">
          {['Reflections', 'Programs', 'Resources', 'Community', 'About Us'].map(link => (
            <a key={link} href="#" className="text-sm font-medium text-gray-600">{link}</a>
          ))}
          <button className="text-sm font-semibold text-white py-3 rounded-xl" style={{ background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)' }}>
            Get Started
          </button>
        </div>
      )}
    </nav>
  )
}

// ─── Floating mood card ───────────────────────────────────────────────────────
function FloatingCard({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className={cn('absolute rounded-2xl p-4 shadow-xl', className)}
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.8)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #EEF4FF 0%, #F0F7FF 30%, #E8F4FD 60%, #F5F3EE 100%)',
      }}
    >
      {/* Background orbs */}
      <div
        className="absolute top-20 right-10 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(75,159,225,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute bottom-20 left-10 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(27,79,216,0.12) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(75,159,225,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Decorative wave shape at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: '100%', height: 80 }}>
          <path d="M0 60 C360 120 1080 0 1440 60 L1440 120 L0 120 Z" fill="white" fillOpacity="0.6" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-20 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left — Copy */}
        <div className="relative z-10">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-xs font-semibold"
            style={{
              background: 'rgba(27,79,216,0.08)',
              color: '#1B4FD8',
              border: '1px solid rgba(27,79,216,0.15)',
            }}
          >
            <Icon.Heart />
            A calm mind leads to a better you
          </div>

          {/* Headline */}
          <h1
            className="font-black leading-none mb-6"
            style={{ fontSize: 'clamp(3rem,6vw,5.5rem)', color: '#0D2B7A', letterSpacing: '-0.03em' }}
          >
            Take a breath.{' '}
            <span
              className="relative"
              style={{
                background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              You're safe here.
            </span>
          </h1>

          <p className="text-lg leading-relaxed mb-10 max-w-md" style={{ color: '#64748B' }}>
            Reflect on your emotions, build mindfulness habits, and gently grow into the calmer, happier version of yourself — one breath at a time.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-12">
            <button
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-white font-bold text-base transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              style={{
                background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)',
                boxShadow: '0 8px 32px rgba(27,79,216,0.4)',
              }}
            >
              Begin Your Journey
              <Icon.ArrowRight />
            </button>
            <button
              className="flex items-center gap-2.5 px-6 py-4 rounded-2xl font-semibold text-base transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.8)',
                border: '1.5px solid rgba(27,79,216,0.15)',
                color: '#1B4FD8',
                boxShadow: '0 4px 20px rgba(27,79,216,0.08)',
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(27,79,216,0.08)' }}
              >
                <Icon.Play />
              </div>
              Watch Demo
            </button>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['#C7D2FE','#BAE6FD','#A5F3FC','#DDD6FE'].map((bg, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg,${bg},#1B4FD8)`, zIndex: 4 - i }}
                >
                  {['S','A','R','M'][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ color: '#FBBF24' }}><Icon.Star /></span>
                ))}
                <span className="text-sm font-bold ml-1" style={{ color: '#0D2B7A' }}>4.9</span>
              </div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Loved by <span className="font-bold text-gray-700">20,000+</span> people on their wellness journey
              </p>
            </div>
          </div>
        </div>

        {/* Right — Visual */}
        <div className="relative hidden lg:flex justify-center items-center h-[580px]">
          {/* Central phone mockup */}
          <div
            className="relative w-64 h-[520px] rounded-[40px] overflow-hidden shadow-2xl z-20"
            style={{
              background: 'linear-gradient(160deg,#EEF4FF,#DBEAFE)',
              border: '6px solid rgba(255,255,255,0.9)',
              boxShadow: '0 40px 80px rgba(27,79,216,0.25)',
            }}
          >
            {/* App screen */}
            <div className="p-5 pt-10">
              <p className="text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>Good morning, Sarah ✨</p>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#0D2B7A' }}>How are you feeling today?</h3>
              {/* Mood grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { emoji: '😌', label: 'Calm', active: true },
                  { emoji: '😊', label: 'Happy', active: false },
                  { emoji: '😔', label: 'Low', active: false },
                  { emoji: '😤', label: 'Anxious', active: false },
                  { emoji: '🥰', label: 'Grateful', active: false },
                  { emoji: '😴', label: 'Tired', active: false },
                ].map(m => (
                  <div
                    key={m.label}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium"
                    style={{
                      background: m.active ? 'linear-gradient(135deg,#1B4FD8,#4B9FE1)' : 'rgba(255,255,255,0.7)',
                      color: m.active ? 'white' : '#64748B',
                    }}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Streak */}
              <div
                className="rounded-xl p-3 mb-3"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(27,79,216,0.1)' }}
              >
                <p className="text-[10px] font-medium mb-1" style={{ color: '#94A3B8' }}>🔥 Current streak</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black" style={{ color: '#1B4FD8' }}>14</span>
                  <span className="text-xs" style={{ color: '#64748B' }}>days in a row</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full"
                      style={{ background: i < 5 ? '#1B4FD8' : 'rgba(27,79,216,0.15)' }}
                    />
                  ))}
                </div>
              </div>
              {/* Today's session */}
              <div
                className="rounded-xl p-3"
                style={{ background: 'linear-gradient(135deg,rgba(27,79,216,0.08),rgba(75,159,225,0.08))' }}
              >
                <p className="text-[10px] font-semibold mb-1" style={{ color: '#1B4FD8' }}>TODAY'S SESSION</p>
                <p className="text-xs font-bold" style={{ color: '#0D2B7A' }}>5-min Morning Reflection</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Mindful breathing + journaling</p>
              </div>
            </div>
          </div>

          {/* Floating cards */}
          <FloatingCard
            className="left-0 top-16 w-48"
            style={{ animation: 'floatA 6s ease-in-out infinite' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                <Icon.TrendingUp />
              </div>
              <div>
                <p className="text-[10px] font-medium text-gray-400">Mood score</p>
                <p className="text-sm font-black" style={{ color: '#0D2B7A' }}>+34% this week</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard
            className="right-0 top-32 w-44"
            style={{ animation: 'floatB 7s ease-in-out infinite' }}
          >
            <p className="text-[10px] font-medium text-gray-400 mb-1.5">Daily Goal</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
              <div className="h-1.5 rounded-full" style={{ width: '72%', background: 'linear-gradient(90deg,#1B4FD8,#4B9FE1)' }} />
            </div>
            <p className="text-xs font-bold" style={{ color: '#0D2B7A' }}>72% complete 🎯</p>
          </FloatingCard>

          <FloatingCard
            className="left-2 bottom-24 w-52"
            style={{ animation: 'floatC 8s ease-in-out infinite' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧘</span>
              <div>
                <p className="text-xs font-bold" style={{ color: '#0D2B7A' }}>Breathing exercise</p>
                <p className="text-[10px] text-gray-400">4-7-8 technique</p>
              </div>
            </div>
            <div
              className="flex items-center justify-center w-full h-8 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)' }}
            >
              Start now →
            </div>
          </FloatingCard>

          <FloatingCard
            className="right-2 bottom-16 w-40"
            style={{ animation: 'floatA 9s ease-in-out infinite reverse' }}
          >
            <p className="text-[10px] text-gray-400 mb-1">Today's insight</p>
            <p className="text-xs font-semibold" style={{ color: '#0D2B7A' }}>
              "Small steps lead to lasting change 🌱"
            </p>
          </FloatingCard>
        </div>
      </div>

      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-12px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes floatC { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-16px)} }
      `}</style>
    </section>
  )
}

// ─── Social Proof Strip ───────────────────────────────────────────────────────
function SocialProof() {
  const stats = [
    { value: '20K+', label: 'Lives transformed' },
    { value: '4.9★', label: 'App store rating' },
    { value: '2M+', label: 'Reflections written' },
    { value: '94%', label: 'Feel calmer in 7 days' },
  ]
  const logos = ['Forbes', 'TechCrunch', 'Vogue', 'Inc.', 'Wired']

  return (
    <section className="py-16 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          {stats.map(s => (
            <div key={s.value} className="text-center">
              <div
                className="text-4xl font-black mb-1"
                style={{ color: '#1B4FD8', letterSpacing: '-0.03em' }}
              >
                {s.value}
              </div>
              <div className="text-sm text-gray-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Press logos */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px flex-1 bg-gray-100" />
          <p className="text-xs font-semibold text-gray-400 px-4 uppercase tracking-widest">As seen in</p>
          <div className="h-px flex-1 bg-gray-100" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-35">
          {logos.map(l => (
            <span key={l} className="text-xl font-black tracking-tighter" style={{ color: '#0D2B7A' }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: <Icon.Brain />,
      title: 'Self Awareness',
      desc: 'Understand your thoughts and emotions through guided reflection prompts, mood tracking, and personalised insights.',
      gradient: 'linear-gradient(135deg,#EEF4FF,#DBEAFE)',
      iconBg: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)',
      tag: 'Core feature',
    },
    {
      icon: <Icon.Waves />,
      title: 'Guided Practices',
      desc: 'From 2-minute breathing exercises to 20-minute deep meditations — curated by certified mindfulness coaches.',
      gradient: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)',
      iconBg: 'linear-gradient(135deg,#059669,#34D399)',
      tag: 'Most loved',
    },
    {
      icon: <Icon.TrendingUp />,
      title: 'Track Progress',
      desc: 'Beautiful charts and gentle celebrations help you see how far you have come — honouring every small win.',
      gradient: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
      iconBg: 'linear-gradient(135deg,#D97706,#FBBF24)',
      tag: 'Motivating',
    },
    {
      icon: <Icon.Users />,
      title: 'Supportive Community',
      desc: 'Connect with thousands of people on similar journeys. Share anonymously, encourage others, grow together.',
      gradient: 'linear-gradient(135deg,#FDF4FF,#FAE8FF)',
      iconBg: 'linear-gradient(135deg,#9333EA,#C084FC)',
      tag: 'Safe space',
    },
    {
      icon: <Icon.Shield />,
      title: 'Private & Secure',
      desc: 'Your reflections are yours alone. End-to-end encrypted, never sold to third parties. Privacy is our promise.',
      gradient: 'linear-gradient(135deg,#FFF1F2,#FFE4E6)',
      iconBg: 'linear-gradient(135deg,#E11D48,#FB7185)',
      tag: 'Trusted',
    },
    {
      icon: <Icon.Moon />,
      title: 'Sleep & Rest',
      desc: 'Wind-down routines, sleep meditations, and evening reflections designed to help you rest deeply every night.',
      gradient: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
      iconBg: 'linear-gradient(135deg,#0D2B7A,#1B4FD8)',
      tag: 'Sleep better',
    },
  ]

  return (
    <section className="py-28" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#F8FBFF 100%)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: 'rgba(27,79,216,0.08)', color: '#1B4FD8', border: '1px solid rgba(27,79,216,0.12)' }}
          >
            Everything you need
          </div>
          <h2
            className="text-5xl font-black mb-4"
            style={{ color: '#0D2B7A', letterSpacing: '-0.03em' }}
          >
            Your complete wellness toolkit
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Every feature is thoughtfully designed to reduce friction between you and inner peace.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => (
            <div
              key={f.title}
              className="group relative rounded-3xl p-7 transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl cursor-pointer"
              style={{
                background: f.gradient,
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 20px rgba(27,79,216,0.04)',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                  style={{ background: f.iconBg, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                  {f.icon}
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.7)', color: '#64748B' }}
                >
                  {f.tag}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#0D2B7A' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
              <div
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ color: '#1B4FD8' }}
              >
                Learn more <Icon.ArrowRight />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Check in daily',
      desc: 'Spend 2 minutes logging your mood and setting a gentle intention for the day.',
      icon: '🌅',
    },
    {
      num: '02',
      title: 'Reflect & release',
      desc: 'Follow a guided journaling prompt to process emotions without judgment or pressure.',
      icon: '📝',
    },
    {
      num: '03',
      title: 'Practice & grow',
      desc: 'Complete a short meditation or breathing exercise tailored to how you feel right now.',
      icon: '🧘',
    },
  ]

  return (
    <section className="py-28 relative overflow-hidden" style={{ background: '#0D2B7A' }}>
      {/* Background decoration */}
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle,rgba(75,159,225,0.15),transparent)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle,rgba(27,79,216,0.3),transparent)', filter: 'blur(60px)' }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#93C5FD', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Simple by design
          </div>
          <h2 className="text-5xl font-black text-white mb-4" style={{ letterSpacing: '-0.03em' }}>
            3 minutes a day.{' '}
            <span style={{ background: 'linear-gradient(135deg,#60A5FA,#93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Lifelong calm.
            </span>
          </h2>
          <p className="text-lg text-blue-200 max-w-xl mx-auto">
            No complex routines. No overwhelming schedules. Just one gentle habit at a time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connector line */}
          <div
            className="hidden md:block absolute top-14 left-1/4 right-1/4 h-px"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)' }}
          />

          {steps.map((step) => (
            <div
              key={step.num}
              className="relative rounded-3xl p-8 text-center transition-all duration-300 hover:-translate-y-2"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="text-5xl mb-4">{step.icon}</div>
              <div
                className="inline-block text-xs font-black px-3 py-1 rounded-full mb-3"
                style={{ background: 'rgba(27,79,216,0.4)', color: '#93C5FD' }}
              >
                Step {step.num}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm text-blue-200 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Programs ─────────────────────────────────────────────────────────────────
function Programs() {
  const programs = [
    {
      emoji: '🌿',
      title: '7-Day Calm Reset',
      desc: 'A gentle week-long programme to decompress, reset, and rebuild inner stillness.',
      duration: '7 days',
      level: 'Beginner',
      gradient: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)',
      accent: '#059669',
    },
    {
      emoji: '🌙',
      title: 'Deep Sleep Protocol',
      desc: 'Evening rituals, sleep meditations, and night-time reflections for restorative sleep.',
      duration: '14 days',
      level: 'All levels',
      gradient: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
      accent: '#1B4FD8',
    },
    {
      emoji: '⚡',
      title: 'Anxiety Relief',
      desc: 'Science-backed breathing, grounding, and cognitive tools to ease anxious moments.',
      duration: '21 days',
      level: 'All levels',
      gradient: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)',
      accent: '#EA580C',
    },
    {
      emoji: '🔑',
      title: 'Confidence Builder',
      desc: 'Daily affirmations, journaling prompts, and mindset shifts to help you step up.',
      duration: '30 days',
      level: 'Intermediate',
      gradient: 'linear-gradient(135deg,#FDF4FF,#FAE8FF)',
      accent: '#9333EA',
    },
  ]

  return (
    <section className="py-28" style={{ background: 'linear-gradient(180deg,#F8FBFF,#ffffff)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
              style={{ background: 'rgba(27,79,216,0.08)', color: '#1B4FD8', border: '1px solid rgba(27,79,216,0.12)' }}
            >
              Curated programmes
            </div>
            <h2 className="text-5xl font-black" style={{ color: '#0D2B7A', letterSpacing: '-0.03em' }}>
              Start where you are
            </h2>
          </div>
          <button
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
            style={{ color: '#1B4FD8', border: '1.5px solid rgba(27,79,216,0.2)', background: 'rgba(27,79,216,0.04)' }}
          >
            View all programmes <Icon.ArrowRight />
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {programs.map(p => (
            <div
              key={p.title}
              className="group relative rounded-3xl p-6 cursor-pointer transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl"
              style={{ background: p.gradient, border: '1px solid rgba(255,255,255,0.9)' }}
            >
              <div className="text-4xl mb-4">{p.emoji}</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: p.accent }}>
                  {p.duration}
                </span>
                <span className="text-[10px] font-medium text-gray-400">{p.level}</span>
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#0D2B7A' }}>{p.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{p.desc}</p>
              <div
                className="flex items-center gap-1.5 text-xs font-bold transition-all duration-200 group-hover:gap-2.5"
                style={{ color: p.accent }}
              >
                Start programme <Icon.ArrowRight />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const reviews = [
    {
      name: 'Priya M.',
      role: 'Marketing Manager',
      avatar: '🧕',
      text: 'Reflectly changed how I deal with stress. In just two weeks, I noticed I was reacting less and breathing more. It feels like having a therapist in my pocket.',
      stars: 5,
      metric: '2 weeks to feel calmer',
    },
    {
      name: 'Arjun K.',
      role: 'Software Engineer',
      avatar: '👨‍💻',
      text: 'I was sceptical about journaling apps. But the daily prompts are so thoughtful — they make you think without being overwhelming. My sleep improved dramatically.',
      stars: 5,
      metric: 'Sleep improved by 40%',
    },
    {
      name: 'Shreya R.',
      role: 'Graduate Student',
      avatar: '👩‍🎓',
      text: 'The anxiety relief programme was a game changer during exam season. The 4-7-8 breathing exercise alone is worth the subscription. I am genuinely calmer now.',
      stars: 5,
      metric: 'Anxiety reduced significantly',
    },
  ]

  return (
    <section
      className="py-28 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#EEF4FF 0%,#F8FBFF 50%,#F5F3EE 100%)' }}
    >
      <div
        className="absolute top-20 left-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle,rgba(27,79,216,0.06),transparent)', filter: 'blur(50px)' }}
      />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: 'rgba(27,79,216,0.08)', color: '#1B4FD8', border: '1px solid rgba(27,79,216,0.12)' }}
          >
            Real stories
          </div>
          <h2 className="text-5xl font-black mb-4" style={{ color: '#0D2B7A', letterSpacing: '-0.03em' }}>
            Stories that move us
          </h2>
          <p className="text-lg text-gray-500">Join thousands who chose peace over pressure.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <div
              key={r.name}
              className="relative rounded-3xl p-7 transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl"
              style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 30px rgba(27,79,216,0.06)',
              }}
            >
              <div className="mb-4">
                <Icon.Quote />
              </div>
              <p className="text-sm leading-relaxed text-gray-600 mb-6">"{r.text}"</p>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-5 w-fit"
                style={{ background: 'rgba(27,79,216,0.06)' }}
              >
                <Icon.Check />
                <span className="text-[11px] font-bold" style={{ color: '#1B4FD8' }}>{r.metric}</span>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'linear-gradient(135deg,#EEF4FF,#DBEAFE)' }}
                >
                  {r.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#0D2B7A' }}>{r.name}</p>
                  <p className="text-xs text-gray-400">{r.role}</p>
                </div>
                <div className="flex items-center gap-0.5 ml-auto">
                  {Array.from({ length: r.stars }).map((_, j) => (
                    <span key={j} style={{ color: '#FBBF24' }}><Icon.Star /></span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Stats Section ────────────────────────────────────────────────────────────
function WellnessStats() {
  const stats = [
    { value: '87%', detail: 'of users report reduced anxiety within 10 days' },
    { value: '3min', detail: 'average daily time to feel meaningfully better' },
    { value: '91%', detail: 'continue using Reflectly after their free trial' },
    { value: '14x', detail: 'more effective than passive social media scrolling' },
  ]

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-black mb-3" style={{ color: '#0D2B7A', letterSpacing: '-0.03em' }}>
            The science is clear
          </h2>
          <p className="text-gray-500">Backed by research, trusted by thousands.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map(s => (
            <div
              key={s.value}
              className="rounded-3xl p-6 text-center hover:-translate-y-1 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg,#EEF4FF,#F0F7FF)',
                border: '1px solid rgba(27,79,216,0.1)',
              }}
            >
              <div
                className="text-5xl font-black mb-2"
                style={{ color: '#1B4FD8', letterSpacing: '-0.03em' }}
              >
                {s.value}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  const faqs = [
    { q: 'How much time do I need each day?', a: 'As little as 2–3 minutes. Our shortest sessions are designed to fit into the busiest mornings. We believe consistency beats length every time.' },
    { q: 'Is my data private and secure?', a: 'Absolutely. All your reflections and journal entries are end-to-end encrypted. We never read, sell, or share your personal data — ever. Your thoughts are yours alone.' },
    { q: 'Can I use Reflectly if I have anxiety or depression?', a: 'Yes. Reflectly is a supportive wellness companion, not a replacement for professional mental health care. We encourage you to use it alongside therapy if needed. It is designed to be gentle and non-triggering.' },
    { q: 'What if I miss a few days?', a: 'Life happens. Reflectly never guilt-trips you. Simply pick up where you left off. We celebrate every session, not streaks alone.' },
    { q: 'Is there a free trial?', a: 'Yes — 7 days completely free, no credit card required. After that, plans start at just ₹299/month.' },
  ]

  return (
    <section className="py-28" style={{ background: 'linear-gradient(180deg,#F8FBFF,#EEF4FF)' }}>
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-5xl font-black mb-3" style={{ color: '#0D2B7A', letterSpacing: '-0.03em' }}>
            Questions? We have answers.
          </h2>
          <p className="text-gray-500">Everything you might be wondering about Reflectly.</p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
              style={{
                background: open === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)',
                border: open === i ? '1.5px solid rgba(27,79,216,0.2)' : '1.5px solid rgba(255,255,255,0.8)',
                boxShadow: open === i ? '0 4px 30px rgba(27,79,216,0.08)' : 'none',
              }}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <div className="flex items-center justify-between gap-4 p-5">
                <span className="font-semibold text-sm" style={{ color: '#0D2B7A' }}>{faq.q}</span>
                <span
                  className="shrink-0 transition-transform duration-300"
                  style={{ transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)', color: '#1B4FD8' }}
                >
                  <Icon.ChevronDown />
                </span>
              </div>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-28 relative overflow-hidden" style={{ background: '#0D2B7A' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%,rgba(75,159,225,0.2),transparent 70%)' }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#93C5FD', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          🌟 Start free — no credit card needed
        </div>
        <h2
          className="text-6xl font-black text-white mb-6"
          style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
        >
          Your calmer self{' '}
          <span style={{ background: 'linear-gradient(135deg,#60A5FA,#93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            is waiting.
          </span>
        </h2>
        <p className="text-xl text-blue-200 mb-12 max-w-2xl mx-auto leading-relaxed">
          Join 20,000+ people who chose to invest 3 minutes a day in themselves. The journey to inner peace begins with a single breath.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-10 py-5 rounded-2xl font-bold text-base transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            style={{
              background: 'linear-gradient(135deg,#ffffff,#F0F7FF)',
              color: '#1B4FD8',
              boxShadow: '0 8px 32px rgba(255,255,255,0.2)',
            }}
          >
            Begin for free — 7 days <Icon.ArrowRight />
          </button>
          <button
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-5 rounded-2xl font-semibold text-base transition-all duration-300 hover:bg-white/10"
            style={{ color: 'white', border: '1.5px solid rgba(255,255,255,0.25)' }}
          >
            <Icon.Play />
            See how it works
          </button>
        </div>
        <p className="text-xs text-blue-300 mt-6">No commitment. Cancel anytime. Your peace of mind is guaranteed.</p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const links = {
    Product: ['Features', 'Programs', 'Pricing', 'Download App'],
    Company: ['About Us', 'Blog', 'Careers', 'Press'],
    Support: ['Help Centre', 'Community', 'Privacy Policy', 'Terms'],
    Connect: ['Instagram', 'Twitter', 'YouTube', 'LinkedIn'],
  }

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#1B4FD8,#4B9FE1)' }}
              >
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                </svg>
              </div>
              <span className="font-bold text-lg" style={{ color: '#0D2B7A' }}>Reflectly</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Your daily companion for emotional wellness, mindful reflection, and peaceful living.
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: '#FBBF24' }}><Icon.Star /></span>
              ))}
              <span className="text-xs text-gray-400 ml-1">4.9 on App Store</span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([cat, items]) => (
            <div key={cat}>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#0D2B7A' }}>{cat}</h4>
              <ul className="flex flex-col gap-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-xs text-gray-400 hover:text-blue-600 transition-colors duration-200">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">© 2026 Reflectly. All rights reserved. Made with 💙 for calmer minds.</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function ReflectlyLanding() {
  return (
    <div className="font-sans antialiased" style={{ fontFamily: "'Inter','Hind',system-ui,sans-serif" }}>
      <Navbar />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Programs />
      <Testimonials />
      <WellnessStats />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
