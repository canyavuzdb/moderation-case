"use client";
import { Button } from "@base-ui/react/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg p-10"><h1 className="text-balance text-2xl font-semibold">Çalışma alanı yüklenemedi</h1>
    <p className="my-4 text-pretty text-slate-600">Yerel veritabanına erişim sağlanamadı. Tekrar deneyin.</p>
    <Button onClick={reset} className="rounded-lg bg-slate-900 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2">Tekrar dene</Button></main>;
}
