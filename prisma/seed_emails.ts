import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.emailTemplate.upsert({
    where: { code: 'TEXTURE_DOWNLOAD_DEFAULT' },
    update: {},
    create: {
      code: 'TEXTURE_DOWNLOAD_DEFAULT',
      name: 'Potvrdenie zákazníkovi (Textúra)',
      subject: 'FABRICK SK - Vaša 4K textúra je pripravená',
      bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Dobrý deň, {{firstName}},</h2>
  <p>ďakujeme za Váš záujem o produkty FABRICK SK. Vaša 4K textúra bola úspešne vygenerovaná a nájdete ju v prílohe.</p>
  {{configHtml}}
  <p>Naše obchodné oddelenie sa Vám čoskoro ozve s ďalšími informáciami.</p>
  <br />
  <p>S pozdravom,<br/><strong>Tím FABRICK SK</strong></p>
</div>`
    }
  });

  await prisma.emailTemplate.upsert({
    where: { code: 'PDF_DOWNLOAD_DEFAULT' },
    update: {},
    create: {
      code: 'PDF_DOWNLOAD_DEFAULT',
      name: 'Potvrdenie zákazníkovi (PDF)',
      subject: 'FABRICK SK - Vaša PDF konfigurácia je pripravená',
      bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Dobrý deň, {{firstName}},</h2>
  <p>ďakujeme za Váš záujem o produkty FABRICK SK. Vaša PDF konfigurácia bola úspešne vygenerovaná.</p>
  {{configHtml}}
  <p>Naše obchodné oddelenie sa Vám čoskoro ozve s ďalšími informáciami.</p>
  <br />
  <p>S pozdravom,<br/><strong>Tím FABRICK SK</strong></p>
</div>`
    }
  });

  await prisma.emailTemplate.upsert({
    where: { code: 'ADMIN_NOTIFICATION' },
    update: {},
    create: {
      code: 'ADMIN_NOTIFICATION',
      name: 'Upozornenie pre administrátora',
      subject: '🚨 Nový dopyt: {{firstName}} {{lastName}}',
      bodyHtml: `<h2>Nový dopyt z konfigurátora</h2>
<table border="1" cellpadding="5" cellspacing="0">
  <tr><th>Meno</th><td>{{firstName}} {{lastName}}</td></tr>
  <tr><th>Email</th><td>{{email}}</td></tr>
  <tr><th>Telefón</th><td>{{phone}}</td></tr>
  <tr><th>Spoločnosť</th><td>{{company}}</td></tr>
  <tr><th>Mesto</th><td>{{city}}</td></tr>
  <tr><th>Poznámka</th><td>{{note}}</td></tr>
</table>
<br />
{{configHtml}}`
    }
  });
  console.log('Seed done!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
