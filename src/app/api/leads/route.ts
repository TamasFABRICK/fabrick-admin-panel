import { type NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import {
  createdResponse,
  validationErrorResponse,
  errorResponse,
  successResponse,
} from "@/lib/api/response";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/resend";

// ─── CORS helpers ─────────────────────────────────────────────

const CONFIGURATOR_ORIGIN =
  process.env.CONFIGURATOR_ORIGIN ?? "http://localhost:3000";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": CONFIGURATOR_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ─── OPTIONS – preflight ───────────────────────────────────────

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ─── GET /api/leads ───────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const archivedParam = searchParams.get('archived');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (archivedParam !== null) {
      where.isArchived = archivedParam === 'true';
    }

    if (fromParam || toParam) {
      where.createdAt = {};
      if (fromParam) {
        where.createdAt.gte = new Date(fromParam);
      }
      if (toParam) {
        // Set to end of day for 'to' date
        const toDate = new Date(toParam);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return addCors(successResponse(leads));
  } catch (err) {
    console.error("[leads] Failed to fetch leads:", err);
    return addCors(errorResponse("DB_ERROR", "Failed to fetch leads", 500));
  }
}

// ─── POST /api/leads ──────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
    console.log('Received payload:', body);
  } catch {
    return addCors(validationErrorResponse("Request body must be valid JSON"));
  }

  const raw = (body ?? {}) as Record<string, unknown>;

  const firstName    = raw.firstName as string | undefined;
  const lastName     = raw.lastName as string | undefined;
  const email        = raw.email as string | undefined;
  const company      = raw.company as string | undefined;
  const phone        = raw.phone as string | undefined;
  const city         = raw.city as string | undefined;
  const note         = raw.note as string | undefined;
  const captchaToken = raw.captchaToken as string | undefined;
  const configData   = raw.configData as string | undefined;
  const utmData      = raw.utmData as string | undefined;
  const brickImageUrl = raw.brickImageUrl as string | undefined;

  // ── Validation ───────────────────────────────────────────────
  if (!firstName || !firstName.trim()) {
    return addCors(validationErrorResponse("Field 'firstName' is required"));
  }
  if (!lastName || !lastName.trim()) {
    return addCors(validationErrorResponse("Field 'lastName' is required"));
  }
  if (!email || !email.trim()) {
    return addCors(validationErrorResponse("Field 'email' is required"));
  }

  // ── Cloudflare Turnstile Verification ────────────────────────
  const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
  
  if (!TURNSTILE_SECRET) {
    console.warn("[leads] Missing TURNSTILE_SECRET_KEY in environment. Turnstile validation will be SKIPPED.");
  } else if (!captchaToken) {
    return addCors(errorResponse("CAPTCHA_MISSING", "Turnstile token is missing", 400));
  } else {
    try {
      const formData = new FormData();
      formData.append('secret', TURNSTILE_SECRET);
      formData.append('response', captchaToken);

      const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData
      });
      const cfData = await cfRes.json();
      console.log('Turnstile check:', cfData);
      
      if (!cfData.success) {
        return addCors(errorResponse("CAPTCHA_FAILED", `Turnstile verification failed: ${JSON.stringify(cfData['error-codes'])}`, 400));
      }
    } catch (err) {
      console.error("[leads] Cloudflare Turnstile error:", err);
      return addCors(errorResponse("CAPTCHA_ERROR", "Could not verify captcha", 500));
    }
  }

  // ── Build Lead record ─────────────────────────────────────
  try {
    const lead = await prisma.lead.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        city: city?.trim() || null,
        zipCode: null, // Note: form doesn't separate city and zipCode, handled in city
        note: note?.trim() || null,
        configData: configData || "{}",
        utmData: utmData || null,
        gdprConsent: true,
        leadType: "TEXTURE_DOWNLOAD",
      }
    });

    // Fire-and-forget email notifications (nezdržuje odpoveď API)
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let config: any = {};
        try {
          config = typeof lead.configData === 'string' ? JSON.parse(lead.configData) : (lead.configData || {});
        } catch (error) {
          console.error('[leads] Chyba pri parsovaní configData:', error);
        }
        
        const bondMapping: Record<string, string> = {
          'stretcher': 'Behúňová',
          'wild': 'Divoká',
          'quarter': 'Štvrtinová',
          'block': 'Väzbová',
          'military': 'Vojenská',
          'stack': 'Stojatá',
          'soldier': 'Stojatá',
          'flemish': 'Flámska',
          'cross': 'Krížová',
          'basketweave': 'Basketweave Modular',
          'basketweave_modular': 'Basketweave Modular'
        };
        const rawBondName = config.bond?.name || config.bond || 'Nezvolená';
        const mappedBondName = bondMapping[rawBondName.toLowerCase()] || rawBondName;
        
        const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

        const format = config.format || config.brick?.format || 'Nezadaný';

        const configHtml = `
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 500px; font-family: sans-serif; font-size: 14px; text-align: left;">
            <tr><th style="background-color: #f8f9fa; width: 40%;">Model</th><td>${config.brick?.name || config.brick || 'Nezvolená'}</td></tr>
            <tr><th style="background-color: #f8f9fa;">Formát</th><td>${format}</td></tr>
            <tr><th style="background-color: #f8f9fa;">Väzba</th><td>${mappedBondName}</td></tr>
            <tr><th style="background-color: #f8f9fa;">Farba škáry</th><td>${config.joint?.name || config.joint || config.jointColor || 'Nezvolená'}</td></tr>
            <tr><th style="background-color: #f8f9fa;">Hrúbka škáry</th><td>${config.jointThickness || '10'} mm</td></tr>
            <tr><th style="background-color: #f8f9fa;">Profil škáry</th><td>${capitalize(config.jointProfile || 'Zarovno')}</td></tr>
          </table>
        `;

        // Najdi vsetkych opravnenych pouzivatelov
        const users = await prisma.user.findMany();
        const eligibleUsers = users.filter(u => {
          if (u.role === "super_admin") return true;
          
          let perms: string[] = [];
          if (Array.isArray(u.permissions)) {
            perms = u.permissions as string[];
          } else if (typeof u.permissions === "string") {
            try {
              const parsed = JSON.parse(u.permissions);
              if (Array.isArray(parsed)) perms = parsed;
            } catch (error) {}
          }
          
          return perms.includes("crm:read");
        });

        const adminEmails = eligibleUsers.map(u => u.email).filter(Boolean);
        const toEmails = adminEmails.length > 0 ? adminEmails : (process.env.ADMIN_EMAIL || 'admin@fabrick.sk');

        // Fetch templates
        const templates = await prisma.emailTemplate.findMany({
          where: { code: { in: ['CUSTOMER_CONFIRMATION', 'ADMIN_NOTIFICATION'] } }
        });
        const customerTpl = templates.find(t => t.code === 'CUSTOMER_CONFIRMATION');
        const adminTpl = templates.find(t => t.code === 'ADMIN_NOTIFICATION');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attachments: any[] = [];
        let previewImageTagHtml = '';
        if (brickImageUrl) {
          try {
            const cleanPath = brickImageUrl.replace(/^\//, ''); 
            const filePath = path.join(process.cwd(), '..', 'brick-generator', 'public', cleanPath);
            if (fs.existsSync(filePath)) {
              const imageBuffer = fs.readFileSync(filePath);
              attachments.push({
                filename: 'texture-thumbnail.webp',
                content: imageBuffer,
                content_id: 'preview-image'
              });
              previewImageTagHtml = `
                <p style="font-size: 13px; color: #666; font-style: italic; margin: 5px 0 20px 0;">
                  📎 Náhľad vybranej tehly nájdete v prílohe tohto e-mailu.
                </p>
              `;
            } else {
              console.log("Miniatúra sa nenašla na ceste: " + filePath);
            }
          } catch (error) {
            console.error("Failed to attach thumbnail:", error);
          }
        }

        const tplData = {
          firstName: lead.firstName || '',
          lastName: lead.lastName || '',
          email: lead.email || '',
          phone: lead.phone || '-',
          company: lead.company || '-',
          city: lead.city || '-',
          note: lead.note || '-',
          configHtml: configHtml,
          previewImageTag: previewImageTagHtml
        };
        
        const parseTpl = (tpl?: string, defaultTpl: string = "") => {
          const templateStr = tpl || defaultTpl;
          return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
            return tplData[key as keyof typeof tplData] !== undefined ? String(tplData[key as keyof typeof tplData]) : match;
          });
        };

        const adminSubject = parseTpl(adminTpl?.subject, `🚨 Nový dopyt: {{firstName}} {{lastName}}`);
        const adminHtml = parseTpl(adminTpl?.bodyHtml, `
            <h2>Nový dopyt z konfigurátora</h2>
            <table border="1" cellpadding="5" cellspacing="0">
              <tr><th>Meno</th><td>{{firstName}} {{lastName}}</td></tr>
              <tr><th>Email</th><td>{{email}}</td></tr>
              <tr><th>Telefón</th><td>{{phone}}</td></tr>
              <tr><th>Spoločnosť</th><td>{{company}}</td></tr>
              <tr><th>Mesto</th><td>{{city}}</td></tr>
              <tr><th>Poznámka</th><td>{{note}}</td></tr>
            </table>
            <br />
            {{configHtml}}
        `);

        // 1. Email pre Admina
        await resend.emails.send({
          from: 'Konfigurátor FABRICK <info@fabrick.sk>',
          to: toEmails,
          subject: adminSubject,
          html: adminHtml,
          attachments: attachments.length > 0 ? attachments : undefined
        });

        const customerSubject = parseTpl(customerTpl?.subject, 'FABRICK SK - Vaša 4K textúra je pripravená');
        const customerHtml = parseTpl(customerTpl?.bodyHtml, `
       <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
         <p style="font-size: 14px; margin: 0;"><strong>Dobrý deň {{firstName}},</strong></p>
         <br/>
         <p>dokonalý projekt začína správnym výberom. Ďakujeme Vám za stiahnutie 4K textúry našich lícových tehál. Vaša textúra bola úspešne vygenerovaná a nájdete ju v prílohe.</p>
         <p><strong>Zhrnutie Vašej konfigurácie:</strong></p>
         {{configHtml}}
         <p style="font-size: 13px; color: #666; font-style: italic; margin: 5px 0 20px 0;">📎 Náhľad vybranej tehly nájdete v prílohe tohto e-mailu.</p>
         <p>Digitálna vizualizácia je len prvý krok. Zastavte sa u nás a pozrite si vybranú tehlu naživo - radi Vám poradíme pri káve v našom showroome.</p>
         <br/>
         <p>S pozdravom,<br/><strong>Tím FABRICK SK</strong></p>
       </div>
        `);

        // 2. Email pre Zákazníka
        await resend.emails.send({
          from: 'Konfigurátor FABRICK <info@fabrick.sk>',
          to: lead.email,
          subject: customerSubject,
          html: customerHtml + '<div style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ID: ' + Date.now() + '</div>',
          attachments: attachments.length > 0 ? attachments : undefined
        });
      } catch (emailErr) {
        console.error("[leads] Nepodarilo sa odoslať notifikačné emaily:", emailErr);
      }
    })();

    return addCors(createdResponse(lead));
  } catch (err) {
    console.error("[leads] Failed to save lead:", err);
    return addCors(
      errorResponse("DB_ERROR", "Failed to save lead to database", 500)
    );
  }
}
