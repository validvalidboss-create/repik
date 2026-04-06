import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminEmail(sessionUser: any) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  return !!sessionUser?.email && String(sessionUser.email).toLowerCase() === String(adminEmail).toLowerCase();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user as any;
  if (!isAdminEmail(viewer)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const tutorId = String(body?.tutorId || "").trim();
  if (!tutorId) return NextResponse.json({ ok: false, error: "tutorId required" }, { status: 400 });

  const receiverName = body?.receiverName != null ? String(body.receiverName).trim().slice(0, 200) : "";
  const iban = body?.iban != null ? String(body.iban).trim().slice(0, 80) : "";
  const bankName = body?.bankName != null ? String(body.bankName).trim().slice(0, 120) : "";
  const cardLast4 = body?.cardLast4 != null ? String(body.cardLast4).trim().slice(0, 4) : "";

  // Prefer Prisma update (after migration). If Prisma Client/DB isn't migrated yet, fallback to raw SQL.
  try {
    const updated = await (prisma as any).tutor.update({
      where: { id: tutorId },
      data: {
        payoutReceiverName: receiverName || null,
        payoutIban: iban || null,
        payoutBankName: bankName || null,
        payoutCardLast4: cardLast4 || null,
      },
      include: { user: true },
    });
    return NextResponse.json({ ok: true, tutor: updated });
  } catch (e: any) {
    const msg = String(e?.message || "");
    // Unknown argument (Prisma client not generated) or missing column (DB not migrated)
    if (msg.includes("Unknown argument") || msg.toLowerCase().includes("column") || msg.toLowerCase().includes("does not exist")) {
      await prisma.$executeRaw`
        UPDATE "Tutor"
        SET
          "payoutReceiverName" = ${receiverName || null},
          "payoutIban" = ${iban || null},
          "payoutBankName" = ${bankName || null},
          "payoutCardLast4" = ${cardLast4 || null}
        WHERE "id" = ${tutorId}
      `;
      const updated = await prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
      return NextResponse.json({ ok: true, tutor: updated });
    }
    return NextResponse.json({ ok: false, error: msg || "Failed to update" }, { status: 500 });
  }
}
