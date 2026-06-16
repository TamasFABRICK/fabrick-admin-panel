import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { successResponse, validationErrorResponse, corsPreflightResponse } from "@/lib/api/response";
import { isValidEmail, isNonEmptyString } from "@/lib/db/schema";
import { resend } from "@/lib/resend";

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { email } = (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    return validationErrorResponse("Field 'email' must be a valid email address");
  }

  const normalizedEmail = (email as string).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (user) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires
      }
    });

    console.log(`\n================================`);
    console.log(`PASSWORD RESET REQUESTED`);
    console.log(`Email: ${user.email}`);
    console.log(`Token: ${token}`);
    console.log(`================================\n`);

    // Asynchrónne odoslanie reset emailu (fire-and-forget)
    (async () => {
      try {
        const resetLink = `http://localhost:3001/reset-password?token=${token}`;
        
        await resend.emails.send({
          from: 'Konfigurátor FABRICK <info@fabrick.sk>',
          to: user.email,
          subject: 'Obnovenie hesla do administrácie FABRICK',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Obnovenie hesla</h2>
              <p>Dobrý deň,</p>
              <p>obdržali sme žiadosť o obnovenie hesla pre Vaše konto v administrácii FABRICK.</p>
              <p>Pre zmenu hesla kliknite na tlačidlo nižšie. Odkaz je platný 1 hodinu.</p>
              <div style="margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Obnoviť heslo</a>
              </div>
              <p style="color: #666; font-size: 14px;">Ak ste o zmenu hesla nepožiadali, môžete tento e-mail ignorovať.</p>
            </div>
          `
        });
      } catch (err) {
        console.error("Failed to send reset email via Resend:", err);
      }
    })();
  }

  return successResponse({ success: true, message: "Inštrukcie na resetovanie boli odoslané." });
}
