import { redirect } from "next/navigation";

export default async function TutorOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${encodeURIComponent(locale)}/teacher/onboarding`);
}
