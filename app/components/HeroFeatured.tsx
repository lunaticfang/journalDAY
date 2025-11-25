// app/components/HeroFeatured.tsx
import Link from "next/link";

export default function HeroFeatured() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-[1fr_420px] gap-8 items-start">
      {/* Left — featured */}
      <div>
        <div className="text-sm font-semibold text-gray-600 uppercase">Featured</div>
        <h2 className="mt-4 text-2xl md:text-3xl font-extrabold text-gray-900 leading-snug">
          “JAPI aspires to be the go-to resource for cutting-edge medical research in India and beyond, shaping a healthier future for all.” - Dr. Mangesh Tiwaskar
        </h2>

        <div className="mt-6 flex gap-4">
          <Link href="/about" className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Read More →</Link>
          <Link href="/submit" className="inline-block px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">Submit an Article</Link>
        </div>
      </div>

      {/* Right — banner / ad */}
      <div className="w-full h-44 md:h-48 bg-gray-100 rounded overflow-hidden flex items-center justify-center border">
        <img src="/hero-banner.png" alt="banner" className="h-full w-full object-cover" />
      </div>
    </section>
  );
}
