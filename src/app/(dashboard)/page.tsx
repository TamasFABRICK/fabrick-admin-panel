"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";
import React, { useEffect, useState } from "react";

const PopularList = ({ title, type, popular, handleShowAll }: { title: string, type: "bricks" | "joints" | "bonds", popular: { bricks: unknown[]; joints: unknown[]; bonds: unknown[] }, handleShowAll: (type: "bricks" | "joints" | "bonds") => void }) => {
  const items = popular[type] || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedItems = [...items].sort((a: { totalScore: number } | any, b: { totalScore: number } | any) => (b?.totalScore || 0) - (a?.totalScore || 0));
  const previewItems = sortedItems.slice(0, 3);
  
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <ul className="space-y-4 mb-6">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {previewItems.length > 0 ? previewItems.map((item: any, i) => (
            <li key={i} className="flex justify-between items-center">
              <span className="text-neutral-700">{item?.name || 'Neznáme'}</span>
              <span className="font-medium text-neutral-900">{item?.sessionViews || 0} zobrazení</span>
            </li>
          )) : (
            <li className="text-neutral-500 text-sm">Zatiaľ žiadne dáta.</li>
          )}
        </ul>
        <div className="mt-auto pt-4 border-t border-neutral-100">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-sm font-medium text-neutral-600 hover:text-primary hover:bg-primary/5 border-neutral-200 transition-colors" 
            onClick={() => handleShowAll(type)}
          >
            Zobraziť všetky
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<unknown>(null);
  const [popular, setPopular] = useState<{ bricks: unknown[]; joints: unknown[]; bonds: unknown[] }>({ bricks: [], joints: [], bonds: [] });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"bricks" | "joints" | "bonds" | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return; // čakaj na hydratáciu AuthContext
    async function loadData() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await fetchApi<any>("/api/analytics/dashboard");
        if (res.data?.summary) {
          setSummary(res.data.summary);
        }
        if (res.data?.popular) {
          setPopular(res.data.popular);
        }
      } catch (err: unknown) {
        setSummary(null);
      }
      
      setLoading(false);
    }
    loadData();
  }, [token]);

  const summaryData = summary as { totalSessions?: number; averageSessionSeconds?: number; averageTimeSeconds?: number; abandonmentRate?: number; totalDownloads?: number; conversionRate?: string; } | null;
  const stats = summaryData ? [
    { label: "Celkový počet relácií", value: summaryData.totalSessions || 0 },
    { label: "Priemerný čas", value: `${Math.floor((summaryData.averageSessionSeconds || 0) / 60)}m ${(summaryData.averageSessionSeconds || 0) % 60}s` },
    { label: "Miera opustenia", value: `${summaryData.abandonmentRate || 0}%` },
    { label: "Stiahnuté textúry", value: summaryData.totalDownloads || 0 },
    { label: "Konverzný pomer", value: `${summaryData.conversionRate || "0"}%` },
  ] : [
    { label: "Celkový počet relácií", value: "-" },
    { label: "Priemerný čas", value: "-" },
    { label: "Miera opustenia", value: "-" },
    { label: "Stiahnuté textúry", value: "-" },
    { label: "Konverzný pomer", value: "-" },
  ];

  const handleShowAll = (type: "bricks" | "joints" | "bonds") => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleReset = async () => {
    if (window.confirm("Naozaj chcete vymazať analytické dáta? CRM kontakty ostanú zachované.")) {
      try {
        await fetchApi("/api/analytics/reset", { method: "POST" });
        window.location.reload();
      } catch (err) {
        console.error("Reset failed", err);
        alert("Nepodarilo sa resetovať analytiku.");
      }
    }
  };


  return (
    <>
      <div className="space-y-6 relative">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-neutral-800">Analytický Dashboard</h1>
          <Button variant="danger" onClick={handleReset}>
            Resetovať štatistiky
          </Button>
        </div>

        {loading ? (
          <div className="text-neutral-500">Načítavam štatistiky z reálneho API...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {stats.map((stat, i) => (
                <Card key={i} className="flex flex-col items-center justify-center text-center">
                  <CardHeader className="pb-2">
                    <div className="text-sm font-medium text-neutral-500">{stat.label}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <PopularList title="Najpopulárnejšie tehly" type="bricks" popular={popular} handleShowAll={handleShowAll} />
              <PopularList title="Najpopulárnejšie škáry" type="joints" popular={popular} handleShowAll={handleShowAll} />
              <PopularList title="Najpopulárnejšie väzby" type="bonds" popular={popular} handleShowAll={handleShowAll} />
            </div>
          </>
        )}

        {/* Modal / Slide-over Overlay */}
        {modalOpen && modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-neutral-800">
                  Úplný zoznam: {
                    modalType === 'bricks' ? "Tehly" :
                    modalType === 'joints' ? "Škáry" : "Väzby"
                  }
                </h2>
                <button 
                  onClick={() => setModalOpen(false)} 
                  className="text-neutral-400 hover:text-neutral-600 transition-colors p-1 rounded-md hover:bg-neutral-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-neutral-50/30">
                <ul className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {[...(popular[modalType] || [])].sort((a: { totalScore: number } | any, b: { totalScore: number } | any) => (b?.totalScore || 0) - (a?.totalScore || 0)).map((item: { sessionViews: number; name: string; combinationSaves: number; totalScore: number } | any, i: number) => (
                    <li 
                      key={i} 
                      className={`flex justify-between items-center p-4 rounded-xl border transition-all ${
                        item.sessionViews === 0 
                          ? "border-neutral-200 bg-neutral-50 opacity-70" 
                          : "border-primary/10 bg-white shadow-sm hover:border-primary/30 hover:shadow-md"
                      }`}
                    >
                      <div>
                        <span className={`font-medium ${item.sessionViews === 0 ? "text-neutral-500" : "text-neutral-800"}`}>
                          {item.name}
                        </span>
                        {item.combinationSaves > 0 && (
                          <span className="ml-2 text-xs text-neutral-400">({item.combinationSaves} uložených textúr)</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-sm ${item.sessionViews === 0 ? "text-neutral-400 font-medium" : "text-primary font-bold"}`}>
                          {item.sessionViews} zobrazení
                        </div>
                        <div className="text-xs text-neutral-400">Skóre: {item.totalScore}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="p-6 border-t border-neutral-100 bg-white rounded-b-xl flex justify-end">
                <Button onClick={() => setModalOpen(false)}>Zatvoriť</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
