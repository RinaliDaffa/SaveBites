export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 max-w-md w-full text-center">
        <h1 className="font-serif text-2xl font-bold text-ink mb-2">Sign in</h1>
        <p className="text-stone-500 text-sm mb-6">
          Auth flow is not implemented yet. Please complete sign-in via the
          dedicated auth route (separate task).
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Go home
        </a>
      </div>
    </main>
  );
}
