import Link from 'next/link';
import RegisterForm from '@/components/forms/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-50">Create an account</h1>
          <p className="mt-2 text-slate-400">
            Join Haul247 and start booking freight today
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-200 bg-surface-100 p-8">
          <RegisterForm />

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-brand-400 transition hover:text-brand-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
