import Link from 'next/link';
import LoginForm from '@/components/forms/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-50">Welcome back</h1>
          <p className="mt-2 text-slate-400">Sign in to your Haul247 account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-200 bg-surface-100 p-8">
          <LoginForm />

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-brand-400 transition hover:text-brand-500"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
