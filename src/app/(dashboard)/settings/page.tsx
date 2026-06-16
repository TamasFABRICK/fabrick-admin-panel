/**
 * /settings – redirect na predvolený sub-route.
 * Táto stránka existuje len ako fallback pre prípad, že by používateľ
 * navigoval priamo na /settings bez subroutu (napr. záložka v prehliadači).
 *
 * Sidebar odkazuje priamo na /settings/attributes a /settings/marketing,
 * takže tento redirect je len bezpečnostná sieť.
 */
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/attributes");
}
