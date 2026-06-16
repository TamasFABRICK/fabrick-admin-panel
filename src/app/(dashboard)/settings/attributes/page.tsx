"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Attribute = { id: string; label: string; value?: string; meta?: string | null; active?: boolean };

type AttributesData = {
  colors: Attribute[];
  manufacturers: Attribute[];
  structures: Attribute[];
  formats: Attribute[];
  priceLevels: Attribute[];
  patterns: Attribute[];
};

const TAB_TYPES = [
  { key: "colors", type: "color", title: "Farby" },
  { key: "manufacturers", type: "manufacturer", title: "Výrobcovia" },
  { key: "structures", type: "structure", title: "Štruktúry" },
  { key: "formats", type: "format", title: "Formáty" },
  { key: "priceLevels", type: "priceLevel", title: "Cenové úrovne" },
  { key: "patterns", type: "pattern", title: "Väzby" },
];

export default function AttributesSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("colors");
  const [data, setData] = useState<AttributesData>({
    colors: [],
    manufacturers: [],
    structures: [],
    formats: [],
    priceLevels: [],
    patterns: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Add new state
  const [editingItem, setEditingItem] = useState<Attribute | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemMinPrice, setNewItemMinPrice] = useState("");
  const [newItemMaxPrice, setNewItemMaxPrice] = useState("");
  const [newItemCurrency, setNewItemCurrency] = useState("EUR");
  const [newItemWidth, setNewItemWidth] = useState("");
  const [newItemHeight, setNewItemHeight] = useState("");
  const [newItemThickness, setNewItemThickness] = useState("");
  const [newItemAllowedPatterns, setNewItemAllowedPatterns] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const resetForm = useCallback(() => {
    setEditingItem(null);
    setNewItemLabel("");
    setNewItemMinPrice("");
    setNewItemMaxPrice("");
    setNewItemCurrency("EUR");
    setNewItemWidth("");
    setNewItemHeight("");
    setNewItemThickness("");
    setNewItemAllowedPatterns([]);
  }, []);

  const { token } = useAuth();

  const loadAttributes = useCallback(async () => {
    try {
      const res = await fetchApi<AttributesData>("/api/attributes");
      setData(res.data);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa načítať číselníky.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auth Guard - only admin/super_admin
    // Token guard: wait for AuthContext hydration before calling API
    if (!token) return;
    if (user && user.role === "viewer") {
      router.push("/");
    } else if (user) {
      // Bypassing false positive in React Compiler
      void (async () => {
        await loadAttributes();
      })();
    }
  }, [token, user, router, loadAttributes]);

  const handleTogglePattern = async (item: Attribute) => {
    try {
      await fetchApi(`/api/attributes/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      await loadAttributes();
    } catch (err: unknown) {
      alert(`Chyba: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleEditClick = (item: Attribute) => {
    setEditingItem(item);
    setNewItemLabel(item.label);
    let metaObj: any = {};
    if (item.meta) {
      try {
        metaObj = JSON.parse(item.meta);
      } catch (e) {}
    }
    if (activeTab === "priceLevels") {
      setNewItemMinPrice(metaObj.minPrice?.toString() || "");
      setNewItemMaxPrice(metaObj.maxPrice?.toString() || "");
      setNewItemCurrency(metaObj.currency || "EUR");
    } else if (activeTab === "formats") {
      setNewItemWidth(metaObj.width?.toString() || "");
      setNewItemHeight(metaObj.height?.toString() || "");
      setNewItemThickness(metaObj.thickness?.toString() || "");
      try {
        if (typeof metaObj.allowedPatterns === 'string') {
          setNewItemAllowedPatterns(JSON.parse(metaObj.allowedPatterns) || []);
        } else if (Array.isArray(metaObj.allowedPatterns)) {
          setNewItemAllowedPatterns(metaObj.allowedPatterns);
        } else {
          setNewItemAllowedPatterns([]);
        }
      } catch (e) {
        setNewItemAllowedPatterns([]);
      }
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemLabel.trim()) return;
    
    const backendType = TAB_TYPES.find(t => t.key === activeTab)?.type;
    
    const payload: any = { type: backendType, label: newItemLabel.trim() };
    if (activeTab === "priceLevels") {
      payload.minPrice = parseFloat(newItemMinPrice);
      payload.maxPrice = parseFloat(newItemMaxPrice);
      payload.currency = newItemCurrency.trim() || "EUR";
    } else if (activeTab === "formats") {
      payload.width = parseFloat(newItemWidth);
      payload.height = parseFloat(newItemHeight);
      payload.allowedPatterns = newItemAllowedPatterns;
      if (newItemThickness.trim() !== "") {
        payload.thickness = parseFloat(newItemThickness);
      } else {
        payload.thickness = null;
      }
    }

    setAdding(true);
    try {
      if (editingItem) {
        await fetchApi(`/api/attributes/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi("/api/attributes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await loadAttributes();
    } catch (err: unknown) {
      alert(`Chyba pri ${editingItem ? "upravovaní" : "pridávaní"}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Naozaj chcete vymazať túto položku?")) return;
    try {
      await fetchApi(`/api/attributes/${id}`, { method: "DELETE" });
      await loadAttributes();
    } catch (err: unknown) {
      alert(`Chyba pri mazaní: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading) return <div className="p-6 text-neutral-500">Načítavam nastavenia...</div>;
  if (user?.role === "viewer") return null;

  const activeItems = data[activeTab as keyof AttributesData] || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">Nastavenia vlastností</h1>
      </div>

      {error && <div className="p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>}

      <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-neutral-200">
        {TAB_TYPES.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { 
              setActiveTab(tab.key); 
              resetForm();
            }}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? "bg-primary text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Zoznam položiek</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left text-neutral-600">
                <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    {activeTab === "priceLevels" ? (
                      <>
                        <th className="px-6 py-4 font-medium">Názov</th>
                        <th className="px-6 py-4 font-medium text-center">Min (Cena)</th>
                        <th className="px-6 py-4 font-medium text-center">Max (Cena)</th>
                        <th className="px-6 py-4 font-medium text-center">Mena</th>
                      </>
                    ) : activeTab === "formats" ? (
                      <>
                        <th className="px-6 py-4 font-medium">Názov</th>
                        <th className="px-6 py-4 font-medium text-center">Šírka</th>
                        <th className="px-6 py-4 font-medium text-center">Výška</th>
                        <th className="px-6 py-4 font-medium text-center">Hrúbka</th>
                      </>
                    ) : (
                      <th className="px-6 py-4 font-medium">Názov hodnoty</th>
                    )}
                    {activeTab === "patterns" ? (
                      <th className="px-6 py-4 font-medium text-center">Aktívna</th>
                    ) : (
                      <th className="px-6 py-4 font-medium text-center">Akcie</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeItems.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === "priceLevels" || activeTab === "formats" ? 5 : 2} className="px-6 py-8 text-center text-neutral-500">
                        Zatiaľ neboli pridané žiadne hodnoty.
                      </td>
                    </tr>
                  ) : (
                    activeItems.map((item) => {
                      let metaObj: any = null;
                      if (item.meta) {
                        try {
                          metaObj = JSON.parse(item.meta);
                        } catch (e) {}
                      }

                      return (
                        <tr key={item.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-neutral-900">
                            {item.label}
                          </td>
                          {activeTab === "priceLevels" && (
                            <>
                              <td className="px-6 py-4 text-center text-neutral-500">{metaObj?.minPrice ?? "—"}</td>
                              <td className="px-6 py-4 text-center text-neutral-500">{metaObj?.maxPrice ?? "—"}</td>
                              <td className="px-6 py-4 text-center text-neutral-500">{metaObj?.currency ?? "—"}</td>
                            </>
                          )}
                          {activeTab === "formats" && (
                            <>
                              <td className="px-6 py-4 text-center text-neutral-500">{metaObj?.width ? `${metaObj.width} mm` : "—"}</td>
                              <td className="px-6 py-4 text-center text-neutral-500">{metaObj?.height ? `${metaObj.height} mm` : "—"}</td>
                              <td className="px-6 py-4 text-center text-neutral-500">{metaObj?.thickness ? `${metaObj.thickness} mm` : "—"}</td>
                            </>
                          )}
                          {activeTab === "patterns" ? (
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <Button 
                                  variant={item.active ? "primary" : "secondary"} 
                                  size="sm" 
                                  onClick={() => handleTogglePattern(item)}
                                >
                                  {item.active ? "Zapnutá" : "Vypnutá"}
                                </Button>
                              </div>
                            </td>
                          ) : (
                            <td className="px-6 py-4">
                              <div className="flex justify-center space-x-2">
                                <Button variant="secondary" size="sm" onClick={() => handleEditClick(item)}>
                                  Upraviť
                                </Button>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)}>
                                  Zmazať
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {activeTab !== "patterns" && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle>{editingItem ? "Upraviť položku" : "Pridať novú položku"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Názov ({TAB_TYPES.find(t => t.key === activeTab)?.title})
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Napr. Nová hodnota..."
                    disabled={adding}
                  />
                </div>
                {activeTab === "priceLevels" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Minimálna cena
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={newItemMinPrice}
                        onChange={(e) => setNewItemMinPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Napr. 0"
                        disabled={adding}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Maximálna cena
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={newItemMaxPrice}
                        onChange={(e) => setNewItemMaxPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Napr. 15"
                        disabled={adding}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Mena
                      </label>
                      <input
                        type="text"
                        required
                        value={newItemCurrency}
                        onChange={(e) => setNewItemCurrency(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Napr. EUR"
                        disabled={adding}
                      />
                    </div>
                  </>
                )}
                {activeTab === "formats" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Šírka (mm)
                      </label>
                      <input
                        type="number"
                        required
                        step="0.1"
                        value={newItemWidth}
                        onChange={(e) => setNewItemWidth(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Napr. 240"
                        disabled={adding}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Výška (mm)
                      </label>
                      <input
                        type="number"
                        required
                        step="0.1"
                        value={newItemHeight}
                        onChange={(e) => setNewItemHeight(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Napr. 52"
                        disabled={adding}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Hrúbka (mm) - voliteľné
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newItemThickness}
                        onChange={(e) => setNewItemThickness(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Napr. 65"
                        disabled={adding}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Povolené väzby
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto p-3 border border-neutral-200 rounded-xl">
                        {data.patterns?.map((pattern) => (
                          <label key={pattern.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newItemAllowedPatterns.includes(pattern.value || pattern.label.toLowerCase())}
                              onChange={(e) => {
                                const val = pattern.value || pattern.label.toLowerCase();
                                if (e.target.checked) {
                                  setNewItemAllowedPatterns([...newItemAllowedPatterns, val]);
                                } else {
                                  setNewItemAllowedPatterns(newItemAllowedPatterns.filter(p => p !== val));
                                }
                              }}
                              className="rounded border-neutral-300 text-primary focus:ring-primary"
                              disabled={adding}
                            />
                            <span className="text-sm text-neutral-700">{pattern.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex space-x-3">
                  <Button  
                    type="submit" 
                    disabled={
                      adding || 
                      !newItemLabel.trim() || 
                      (activeTab === "priceLevels" && (!newItemMinPrice || !newItemMaxPrice || !newItemCurrency.trim())) ||
                      (activeTab === "formats" && (!newItemWidth || !newItemHeight))
                    } 
                    className="flex-1 bg-primary hover:bg-primary-hover text-white"
                  >
                    {adding ? "Ukladám..." : (editingItem ? "Uložiť zmeny" : "Pridať")}
                  </Button>
                  {editingItem && (
                    <Button type="button" variant="secondary" onClick={resetForm} disabled={adding}>
                      Zrušiť
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
