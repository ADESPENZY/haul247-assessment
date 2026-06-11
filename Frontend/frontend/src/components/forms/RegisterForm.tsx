'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { Loader2, UserPlus, User, Mail, Lock } from 'lucide-react';
import authService from '@/services/authService';

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName]                             = useState('');
  const [email, setEmail]                           = useState('');
  const [password, setPassword]                     = useState('');
  const [passwordConfirmation, setPasswordConfirm]  = useState('');
  const [loading, setLoading]                       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.register({
        name, email, password,
        password_confirmation: passwordConfirmation,
        role: 'operator',
      });
      Cookies.set('token', '1', { expires: 1 });
      localStorage.setItem('userRole', data.user.role);
      toast.success('Account created! Welcome aboard.');
      router.push('/dashboard');
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Registration failed. Please try again.')
        : 'An unexpected error occurred.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-4 text-slate-50 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-slate-300">Full name</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input id="name" type="text" required autoComplete="name"
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Jane Doe" className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-300">Email address</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input id="password" type="password" required autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" minLength={8} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="passwordConfirmation" className="text-sm font-medium text-slate-300">
          Confirm password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input id="passwordConfirmation" type="password" required autoComplete="new-password"
            value={passwordConfirmation} onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="••••••••" minLength={8} className={inputClass} />
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
}
