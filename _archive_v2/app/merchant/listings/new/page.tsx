import { NewListingForm } from '@/components/merchant/NewListingForm';

export const dynamic = 'force-dynamic';

export default function NewListingPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-ink">
      <div className="max-w-screen-md mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="font-serif text-2xl font-bold text-ink">Add new listing</h1>
          <p className="text-stone-500 text-sm">Post a surplus meal for nearby consumers.</p>
        </header>
        <NewListingForm />
      </div>
    </main>
  );
}
