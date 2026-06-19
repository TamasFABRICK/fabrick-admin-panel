import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Konfigurácia – FABRICK SK</title>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <header class="header">
      <div class="header-logo">
        {{fabrickLogoImg}}
      </div>
      <div class="header-meta">
        <p class="header-title">Konfigurácia</p>
        <p class="header-date">Dátum: {{date}}</p>
      </div>
    </header>

    <!-- CONTENT -->
    <div class="content-wrapper">
      <div class="left-col">
        <div class="hero-preview">
          {{brickThumbImg}}
        </div>
      </div>
      <div class="right-col">
        <section class="section">
          <h2 class="section-title">Údaje o tehle</h2>
          <table class="params-table">
            <tbody>
              <tr><td class="param-label">Výrobca</td><td class="param-value">{{manufacturer}}</td></tr>
              <tr><td class="param-label">Názov</td><td class="param-value">{{brickName}}</td></tr>
              <tr><td class="param-label">Formát</td><td class="param-value">{{brickFormat}}</td></tr>
              <tr><td class="param-label">Rozmery</td><td class="param-value">{{dimensions}}</td></tr>
              <tr><td class="param-label">Kód produktu</td><td class="param-value">{{articleCode}}</td></tr>
            </tbody>
          </table>
        </section>
        
        <section class="section" style="margin-top: 30px;">
          <h2 class="section-title">Údaje o konfigurácii</h2>
          <table class="params-table">
            <tbody>
              <tr><td class="param-label">Väzba</td><td class="param-value">{{patternName}}</td></tr>
              <tr><td class="param-label">Farba škáry</td><td class="param-value">{{jointColor}}</td></tr>
              <tr><td class="param-label">Profil škáry</td><td class="param-value">{{jointProfile}}</td></tr>
              <tr><td class="param-label">Hrúbka škáry</td><td class="param-value">{{jointThickness}}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>

    <!-- FOOTER -->
    <footer class="footer">
      <p class="footer-tagline">FABRICK SK – Už 30 rokov váš partner pre dokonalé tehlové fasády.</p>
      <p>Sídlo: Okočská 1677/5, 93201 Veľký Meder, Slovensko | Showroom: Studená 4/B, 821 04 Bratislava, Slovensko</p>
      <p>tamas@fabrick.sk | www.fabrick.sk</p>
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
  padding: 15mm 15mm;
  display: flex;
  flex-direction: column;
}

/* ── Header ────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #8b1a1a;
  padding-bottom: 15px;
  margin-bottom: 30px;
}
.header-logo img { max-height: 50px; width: auto; }
.header-meta { text-align: right; }
.header-title {
  font-size: 24px;
  font-weight: 800;
  color: #8b1a1a;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.header-date { font-size: 12px; color: #666; margin-top: 4px; }

/* ── Layout ────────────────────────────────────────── */
.content-wrapper {
  display: flex;
  gap: 30px;
  flex: 1;
}
.left-col {
  width: 50%;
}
.right-col {
  width: 50%;
  display: flex;
  flex-direction: column;
}

/* ── Hero ──────────────────────────────────────────── */
.hero-preview {
  width: 100%;
  height: auto;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}
.hero-preview img {
  width: 100%;
  display: block;
}

/* ── Sections ──────────────────────────────────────── */
.section { display: flex; flex-direction: column; gap: 12px; }
.section-title {
  font-size: 15px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #8b1a1a;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 8px;
}

/* ── Params table ──────────────────────────────────── */
.params-table { width: 100%; border-collapse: collapse; }
.params-table tr:nth-child(even) { background: #fafafa; }
.param-label {
  width: 45%;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #555;
  border-bottom: 1px solid #eee;
}
.param-value {
  padding: 10px 12px;
  font-size: 14px;
  color: #1a1a1a;
  border-bottom: 1px solid #eee;
  font-weight: 500;
}

/* ── Footer ────────────────────────────────────────── */
.footer {
  margin-top: auto;
  border-top: 2px solid #8b1a1a;
  padding-top: 15px;
  font-size: 11px;
  color: #666;
  text-align: center;
  line-height: 1.8;
}
.footer-tagline {
  font-weight: 800;
  color: #8b1a1a;
  font-size: 12px;
  margin-bottom: 5px;
} `;

async function main() {
  await prisma.pdfTemplate.upsert({
    where: { code: 'CONFIGURATION_OVERVIEW' },
    update: {},
    create: {
      code: 'CONFIGURATION_OVERVIEW',
      name: 'Prehľad konfigurácie',
      bodyHtml: DEFAULT_HTML,
      cssStyles: DEFAULT_CSS,
    },
  });

  console.log('✅ PDF šablóna CONFIGURATION_OVERVIEW upserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
