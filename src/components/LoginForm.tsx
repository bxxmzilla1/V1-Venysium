'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone, Shield, Lock, Loader2, ChevronRight, Clock } from 'lucide-react';

type Step = 'phone' | 'code' | 'password';

// Parse "A wait of X seconds is required" → X
function parseFloodWait(msg: string): number | null {
  const m = msg.match(/wait of (\d+) seconds/i);
  return m ? parseInt(m[1]) : null;
}

function formatWait(secs: number): string {
  if (secs < 60) return `${secs} seconds`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && h === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [floodSecs, setFloodSecs] = useState<number | null>(null);

  // Countdown timer for flood wait
  useEffect(() => {
    if (!floodSecs || floodSecs <= 0) return;
    const id = setInterval(() => {
      setFloodSecs((s) => {
        if (s === null || s <= 1) { clearInterval(id); return null; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [floodSecs]);

  function handleError(msg: string) {
    const waitSecs = parseFloodWait(msg);
    if (waitSecs) {
      setFloodSecs(waitSecs);
      setError('');
    } else {
      setError(msg);
      setFloodSecs(null);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('code');
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFloodSecs(null);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password: step === 'password' ? password : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.needsPassword && step !== 'password') {
        setStep('password');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFloodSecs(null);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const stepConfig = {
    phone: {
      icon: <Phone size={22} />,
      title: 'Sign in with Telegram',
      subtitle: 'Enter your phone number to continue',
      form: handleSendCode,
    },
    code: {
      icon: <Shield size={22} />,
      title: 'Verification Code',
      subtitle: `Enter the code sent to ${phone}`,
      form: handleVerifyCode,
    },
    password: {
      icon: <Lock size={22} />,
      title: 'Two-Step Verification',
      subtitle: 'Enter your Telegram 2FA password',
      form: handlePasswordSubmit,
    },
  };

  const current = stepConfig[step];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'var(--accent)',
              marginBottom: '16px',
              boxShadow: '0 0 40px rgba(108,99,255,0.4)',
            }}
          >
            <MessageCircle size={32} color="white" />
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              margin: '0 0 4px',
            }}
          >
            Venysium CRM
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Telegram-powered CRM
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '32px',
            border: '1px solid var(--border)',
          }}
        >
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
            {(['phone', 'code', 'password'] as Step[]).map((s, i) => (
              <div
                key={s}
                style={{
                  flex: s === 'password' ? '0 0 auto' : 1,
                  height: '3px',
                  borderRadius: '2px',
                  background:
                    s === step
                      ? 'var(--accent)'
                      : ['phone', 'code', 'password'].indexOf(step) >
                          ['phone', 'code', 'password'].indexOf(s)
                        ? 'var(--accent)'
                        : 'var(--border)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px',
            }}
          >
            <div style={{ color: 'var(--accent)' }}>{current.icon}</div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {current.title}
            </h2>
          </div>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginBottom: '24px',
              marginTop: '4px',
            }}
          >
            {current.subtitle}
          </p>

          <form onSubmit={current.form}>
            {step === 'phone' && (
              <input
                type="tel"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            )}
            {step === 'code' && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                maxLength={6}
                style={{ ...inputStyle, fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
              />
            )}
            {step === 'password' && (
              <input
                type="password"
                placeholder="Your 2FA password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            )}

            {/* Flood wait banner */}
            {floodSecs && floodSecs > 0 && (
              <div
                style={{
                  background: 'rgba(255,163,92,0.1)',
                  border: '1px solid rgba(255,163,92,0.35)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginTop: '14px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <Clock size={18} style={{ color: '#ffa35c', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#ffa35c', marginBottom: '4px' }}>
                    Telegram Rate Limit
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,163,92,0.85)', lineHeight: '1.5' }}>
                    Too many login attempts on this number. Please wait{' '}
                    <span style={{ fontWeight: '700', color: '#ffa35c' }}>{formatWait(floodSecs)}</span>{' '}
                    before trying again.
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
                    This limit is set by Telegram — not the app.
                  </div>
                </div>
              </div>
            )}

            {/* Generic error */}
            {error && (
              <div
                style={{
                  background: 'rgba(255,80,80,0.1)',
                  border: '1px solid rgba(255,80,80,0.3)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#ff6b6b',
                  marginTop: '12px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!!floodSecs && floodSecs > 0)}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '16px',
                borderRadius: '12px',
                background: (loading || (floodSecs && floodSecs > 0)) ? 'rgba(108,99,255,0.35)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (loading || (floodSecs && floodSecs > 0)) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.2s',
              }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {step === 'phone' ? 'Send Code' : 'Continue'}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          {step !== 'phone' && (
            <button
              onClick={() => {
                setStep('phone');
                setCode('');
                setPassword('');
                setError('');
              }}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              ← Use a different number
            </button>
          )}
        </div>

        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            marginTop: '20px',
          }}
        >
          Your session is encrypted and stored securely.
          <br />
          We never store your password.
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  color: 'var(--text-primary)',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s',
};
