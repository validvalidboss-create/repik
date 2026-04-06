import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  debug: process.env.NODE_ENV !== "production",
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const name = credentials?.name?.trim() || "";
        const rawRole = (credentials?.role as string | undefined) || "student";
        const role: "STUDENT" | "TUTOR" = rawRole === "tutor" ? "TUTOR" : "STUDENT";
        if (!email) return null;

        async function ensureAdminTutor() {
          const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
          let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
          if (!adminUser) {
            adminUser = await prisma.user.create({
              data: { email: adminEmail, name: "Адміністрація", role: "STUDENT", locale: "uk" },
            });
          } else if (adminUser.role !== "STUDENT") {
            adminUser = await prisma.user.update({ where: { id: adminUser.id }, data: { role: "STUDENT" } });
          }
          let adminTutor = await prisma.tutor.findUnique({ where: { userId: adminUser.id } });
          if (!adminTutor) {
            adminTutor = await prisma.tutor.create({
              data: {
                userId: adminUser.id,
                bio: "",
                headline: "",
                rateCents: 0,
                currency: "UAH",
                languages: [adminUser.locale || "uk"],
                subjects: ["support"],
                tracks: ["status:system"],
              },
            });
          } else {
            const currentTracks: string[] = Array.isArray((adminTutor as any).tracks)
              ? (((adminTutor as any).tracks as unknown) as string[])
              : [];
            const baseTracks = currentTracks.filter((t) => !String(t).startsWith("status:"));
            const nextTracks = [...baseTracks, "status:system"];
            const hasActive = currentTracks.some((t) => String(t).toLowerCase() === "status:active");
            const hasSystem = currentTracks.some((t) => String(t).toLowerCase() === "status:system");
            if (hasActive || !hasSystem) {
              adminTutor = await prisma.tutor.update({ where: { id: adminTutor.id }, data: { tracks: nextTracks } });
            }
          }
          return { adminUser, adminTutor };
        }

        async function ensureAdminChatBooking(targetUserId: string) {
          const { adminUser, adminTutor } = await ensureAdminTutor();
          const existing = await prisma.booking.findFirst({
            where: {
              tutorId: adminTutor.id,
              studentId: targetUserId,
              status: { in: ["PENDING", "CONFIRMED"] as any },
            },
            orderBy: { createdAt: "desc" },
          });
          if (existing) return { booking: existing, adminUser };
          const startsAt = new Date();
          const endsAt = new Date(startsAt);
          endsAt.setMinutes(endsAt.getMinutes() + 50);
          const booking = await prisma.booking.create({
            data: {
              studentId: targetUserId,
              tutorId: adminTutor.id,
              startsAt,
              endsAt,
              status: "PENDING" as any,
              priceCents: 0,
              currency: "UAH",
              commissionUSDCents: 0,
            },
          });
          return { booking, adminUser };
        }

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, name, role, locale: "uk" },
          });

          // Welcome message from administration in the system chat
          try {
            const { booking, adminUser } = await ensureAdminChatBooking(user.id);
            await prisma.message.create({
              data: {
                bookingId: booking.id,
                senderId: adminUser.id,
                content:
                  "Вітаємо у Repetitir! Якщо виникнуть питання — напишіть сюди, і ми допоможемо.",
                attachments: [],
              },
            });
          } catch {
            // ignore welcome chat failures
          }
        } else if (role === "TUTOR" && user.role !== "TUTOR") {
          user = await prisma.user.update({ where: { id: user.id }, data: { role: "TUTOR" } });
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role, locale: user.locale } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || token.role;
        token.locale = (user as any).locale || token.locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).locale = token.locale;
      }
      return session;
    },
  },
  pages: {
    signIn: "/uk/sign-in",
  },
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev-secret" : undefined),
};

// NextAuth v4 helper for App Router
export async function auth() {
  return getServerSession(authOptions);
}
