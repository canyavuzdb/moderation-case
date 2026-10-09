import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Yorum yönetimi",
  description: "Kural tabanlı yorum değerlendirme ve insan moderasyonu prototipi.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr"><body className="m-0 bg-white text-slate-900 antialiased">{children}</body></html>;
}
