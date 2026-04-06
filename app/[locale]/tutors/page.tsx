export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import ClientRedirect from "./redirect-client";

export default async function TutorsIndex({ params, searchParams }: { params: Promise<{ locale: string }>, searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const p = await params;
  const sp = searchParams ? await searchParams : undefined;
  const uid = (sp?.uid as string) || "";
  if (uid) {
    return redirect(`/${p.locale}/tutors/${encodeURIComponent(uid)}`);
  }
  return (
    <main className="container mx-auto px-4 py-12">
      <ClientRedirect locale={p.locale} />
      <h1 className="text-2xl font-semibold mb-2">Сегмент tutors підключено</h1>
      <p className="text-neutral-600">Додайте параметр uid в URL, наприклад: /{p.locale}/tutors?uid=mock-олена-english</p>
    </main>
  );
}
