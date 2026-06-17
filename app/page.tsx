import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700">
      <div className="text-center text-white px-6">
        <h1 className="text-4xl font-bold mb-4">SaveBites</h1>
        <p className="text-lg mb-8">Eat well, waste less. Half-off meals near you.</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register?role=consumer"
            className="px-6 py-3 bg-white text-emerald-700 font-semibold rounded-lg hover:bg-emerald-50 transition"
          >
            I'm a Consumer
          </Link>
          <Link
            href="/register?role=merchant"
            className="px-6 py-3 bg-emerald-800 text-white font-semibold rounded-lg hover:bg-emerald-900 transition"
          >
            I'm a Merchant
          </Link>
        </div>
      </div>
    </main>
  );
}
