import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cenová ponuka – FABRICK SK</title>
</head>
<body>
  <div class="page">

    <!-- HEADER -->
    <header class="header">
      <div class="header-logo">
        {{fabrickLogoImg}}
      </div>
      <div class="header-meta">
        <p class="header-title">Cenová ponuka</p>
        <p class="header-date">Dátum: {{date}}</p>
      </div>
    </header>

    <!-- HERO – náhľad tehly -->
    <section class="hero">
      <div class="hero-preview">
        {{brickPreviewImg}}
      </div>
      <div class="hero-info">
        <h1 class="product-name">{{brickName}}</h1>
        <p class="product-manufacturer">{{manufacturer}}</p>
        <p class="product-code">Kód: {{articleCode}}</p>
        <div class="price-badge">{{price}} € / m²</div>
      </div>
    </section>

    <!-- PARAMETRE -->
    <section class="section">
      <h2 class="section-title">Technické parametre</h2>
      <table class="params-table">
        <tbody>
          <tr>
            <td class="param-label">Formát tehly</td>
            <td class="param-value">{{brickFormat}}</td>
          </tr>
          <tr>
            <td class="param-label">Rozmery</td>
            <td class="param-value">{{dimensions}}</td>
          </tr>
          <tr>
            <td class="param-label">Výrobca</td>
            <td class="param-value">{{manufacturer}}</td>
          </tr>
          <tr>
            <td class="param-label">Väzba</td>
            <td class="param-value">{{patternName}}</td>
          </tr>
          <tr>
            <td class="param-label">Farba škáry</td>
            <td class="param-value">{{jointColor}}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- KONTAKTNÉ ÚDAJE -->
    <section class="section">
      <h2 class="section-title">Kontaktné údaje zákazníka</h2>
      <table class="params-table">
        <tbody>
          <tr>
            <td class="param-label">Meno a priezvisko</td>
            <td class="param-value">{{firstName}} {{lastName}}</td>
          </tr>
          <tr>
            <td class="param-label">E-mail</td>
            <td class="param-value">{{email}}</td>
          </tr>
          <tr>
            <td class="param-label">Telefón</td>
            <td class="param-value">{{phone}}</td>
          </tr>
          <tr>
            <td class="param-label">Spoločnosť</td>
            <td class="param-value">{{company}}</td>
          </tr>
          <tr>
            <td class="param-label">Mesto</td>
            <td class="param-value">{{city}}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <p>FABRICK SK s.r.o. | www.fabrick.sk | info@fabrick.sk</p>
      <p>Táto cenová ponuka bola vygenerovaná automaticky z konfigurátora FABRICK SK.</p>
    </footer>
  </div>
</body>
</html>`;

const DEFAULT_CSS = `/* ── Reset ─────────────────────────────────────────── */
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page ──────────────────────────────────────────── */
@page { size: A4; margin: 0; }
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  background: #ffffff;
}
.page {
  width: 210mm;
  min-height: 297mm;
  padding: 12mm 14mm;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Header ────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #8b1a1a;
  padding-bottom: 12px;
}
.header-logo img { max-height: 48px; width: auto; }
.header-meta { text-align: right; }
.header-title {
  font-size: 20px;
  font-weight: 700;
  color: #8b1a1a;
  letter-spacing: -0.5px;
}
.header-date { font-size: 11px; color: #666; margin-top: 2px; }

/* ── Hero ──────────────────────────────────────────── */
.hero {
  display: flex;
  gap: 20px;
  background: #fafafa;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px;
}
.hero-preview {
  flex-shrink: 0;
  width: 180px;
  height: 140px;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}
.hero-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-info { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.product-name { font-size: 22px; font-weight: 800; color: #1a1a1a; line-height: 1.2; }
.product-manufacturer { font-size: 13px; color: #666; }
.product-code { font-size: 11px; color: #999; font-family: monospace; }
.price-badge {
  display: inline-block;
  margin-top: 8px;
  background: #8b1a1a;
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 6px;
}

/* ── Sections ──────────────────────────────────────── */
.section { display: flex; flex-direction: column; gap: 10px; }
.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #8b1a1a;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 6px;
}

/* ── Params table ──────────────────────────────────── */
.params-table { width: 100%; border-collapse: collapse; }
.params-table tr:nth-child(even) { background: #f9f9f9; }
.param-label {
  width: 40%;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
}
.param-value {
  padding: 7px 10px;
  font-size: 13px;
  color: #1a1a1a;
}

/* ── Footer ────────────────────────────────────────── */
.footer {
  margin-top: auto;
  border-top: 1px solid #e5e5e5;
  padding-top: 10px;
  font-size: 10px;
  color: #aaa;
  text-align: center;
  line-height: 1.6;
}`;

async function main() {
  await prisma.pdfTemplate.upsert({
    where: { code: 'SALES_QUOTE_DEFAULT' },
    update: {},
    create: {
      code: 'SALES_QUOTE_DEFAULT',
      name: 'Predajná cenová ponuka (default)',
      bodyHtml: DEFAULT_HTML,
      cssStyles: DEFAULT_CSS,
    },
  });

  console.log('✅ PDF šablóna SALES_QUOTE_DEFAULT upserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
