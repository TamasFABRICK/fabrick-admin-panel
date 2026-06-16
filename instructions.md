# FABRICK Admin Panel - Core Architecture Instructions

## Hlavné moduly systému
1. **Autentifikácia (Auth):** Bezpečné prihlasovacie okno pre admina firmy (Email / Heslo).
2. **Katalóg produktov (CRUD):** Zoznam tehál, väzieb a škár. Možnosť pridať nový produkt (názov, foto, formát), upraviť existujúci, skryť alebo vymazať ho.
3. **Analytický Dashboard:** Vizualizácia štatistík (najpopulárnejšie tehly, škáry, celkový počet relácií, priemerný čas, abandonment rate).
4. **CRM Modul (Kontakty):** Prehľadná tabuľka s kontaktmi na architektov/klientov, ktorí si stiahli textúru (Meno, Email, Telefón, vygenerovaná kombinácia).

## Technické obmedzenia
- Frontend: Čistý React / Next.js s Tailwind CSS, optimalizovaný pre Nano Banana.
- Backend & Databáza: Modulárne API riešenie s pripraveným napojením na N8N workflow pre spracovanie dát a webhooky.
