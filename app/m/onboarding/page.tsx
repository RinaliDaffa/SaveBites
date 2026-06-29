/**
 * SaveBites V3 — Merchant Onboarding Page
 * For consumers who want to become merchants: create a store record.
 * Checks if user already has a merchant profile before allowing access.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createMerchantAction } from '@/lib/actions/merchants';

export default async function MerchantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  const justRegistered = params.registered === 'true';

  if (!user) {
    redirect('/auth/login?next=/m/onboarding');
  }

  // Check if user already has a merchant profile
  const { data: existing } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (existing) {
    redirect('/m/dashboard');
  }

  // Check if profile role is already merchant
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'merchant') {
    redirect('/m/onboarding'); // Allow them to create the merchant record
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-stone-900">Daftarkan Toko Anda</h1>
        <p className="text-stone-500 mt-2">
          Jadikan sisa makananmu peluang bagi yang butuh. Buka toko SaveBites sekarang.
        </p>
      </div>

      {justRegistered && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm text-center">
          Pendaftaran berhasil. Silakan lengkapi data toko Anda.
        </div>
      )}

      <form action={createMerchantAction} className="space-y-6 bg-white rounded-lg border border-stone-200 p-6 shadow-sm">
        {/* Store name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
            Nama Toko <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={200}
            placeholder="Misal: Warung Mama Sari"
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-stone-700 mb-1">
            Alamat Digital (Slug) <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={100}
            placeholder="misal-warung-mama-sari"
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            title="Hanya huruf kecil, angka, dan tanda hubung"
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="text-xs text-stone-400 mt-1">
            Contoh: warung-mama-sari
          </p>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-stone-700 mb-1">
            Kategori Toko <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            defaultValue="restaurant"
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="restaurant">Restoran</option>
            <option value="cafe">Kafe</option>
            <option value="bakery">Toko Roti</option>
            <option value="food_truck">Food Truck</option>
            <option value="snack">Camilan</option>
            <option value="beverage">Minuman</option>
            <option value="other">Lainnya</option>
          </select>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-stone-700 mb-1">
            Alamat Lengkap <span className="text-red-500">*</span>
          </label>
          <textarea
            id="address"
            name="address"
            required
            maxLength={500}
            rows={3}
            placeholder="Jl. Mangkubumi No. XX, RT/RW, Kelurahan, Kecamatan"
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {/* City */}
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-stone-700 mb-1">
            Kota
          </label>
          <input
            id="city"
            name="city"
            type="text"
            defaultValue="Yogyakarta"
            maxLength={100}
            className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* GPS coordinates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-stone-700 mb-1">
              Garis Lintang
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              required
              min={-90}
              max={90}
              placeholder="-7.797"
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-stone-700 mb-1">
              Garis Bujur
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              required
              min={-180}
              max={180}
              placeholder="110.3688"
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Auto-detect GPS button */}
        <button
          type="button"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const latInput = document.getElementById('latitude') as HTMLInputElement;
                  const lngInput = document.getElementById('longitude') as HTMLInputElement;
                  if (latInput && lngInput) {
                    latInput.value = pos.coords.latitude.toFixed(6);
                    lngInput.value = pos.coords.longitude.toFixed(6);
                  }
                },
                () => {
                  alert('Gagal mendeteksi lokasi. Masukkan secara manual.');
                }
              );
            }
          }}
          className="text-sm text-orange-600 hover:text-orange-700 underline"
        >
          Deteksi lokasi saya
        </button>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-md transition-colors"
        >
          Buat Toko Sekarang
        </button>
      </form>
    </div>
  );
}
