'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone, Shield, Lock, Loader2, ChevronRight } from 'lucide-react';

type Step = 'phone' | 'code' | 'password';

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

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
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

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
      setError(err instanceof Error ? err.message : 'Authentication failed');
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
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '16px',
                borderRadius: '12px',
                background: loading ? 'rgba(108,99,255,0.5)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
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
