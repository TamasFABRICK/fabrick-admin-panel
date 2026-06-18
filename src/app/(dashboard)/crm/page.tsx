"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";
import React, { useEffect, useState } from "react";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  city: string | null;
  zipCode: string | null;
  note: string | null;
  configData: string;
  utmData: string | null;
  gdprConsent: boolean;
  isRead: boolean;
  isArchived: boolean;
  leadType: string;
  createdAt: string;
  updatedAt: string;
};

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'archived'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const { token, user } = useAuth();
  const canEdit = user?.role === "super_admin" || (user?.permissions && user.permissions.includes("crm:write"));

  useEffect(() => {
    if (!token) return;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('archived', activeTab === 'archived' ? 'true' : 'false');
        if (dateFrom) params.append('from', dateFrom);
        if (dateTo) params.append('to', dateTo);

        const resLeads = await fetchApi<Lead[]>(`/api/leads?${params.toString()}`).catch(() => ({ data: [] }));
        setLeads(resLeads.data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, activeTab, dateFrom, dateTo]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Neznámy dátum";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Neznámy dátum";
      return d.toLocaleDateString();
    } catch {
      return "Neznámy dátum";
    }
  };

  const renderCombination = (configDataStr: string | null | undefined) => {
    if (!configDataStr) return "-";
    try {
      const parsed = JSON.parse(configDataStr);
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
      const mappedBond = parsed.bond ? (bondMapping[parsed.bond.toLowerCase()] || parsed.bond) : null;
      const parts = [
        parsed.brick,
        parsed.format,
        parsed.jointColor,
        mappedBond
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" + ") : configDataStr;
    } catch {
      return configDataStr;
    }
  };

  const handleToggleArchive = async (lead: Lead) => {
    const newArchivedState = !lead.isArchived;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, isArchived: newArchivedState } : l));
    
    try {
      await fetchApi(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: newArchivedState })
      });
    } catch (e) {
      console.error(e);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, isArchived: !newArchivedState } : l));
    }
  };

  const handleViewDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    
    if (!lead.isRead) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, isRead: true } : l));
      try {
        await fetchApi(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isRead: true })
        });
      } catch (e) {
        console.error("Failed to mark as read", e);
      }
    }
  };

  const displayedLeads = leads.filter(l => activeTab === 'archived' ? l.isArchived : !l.isArchived);

  const handleExportCSV = () => {
    const escapeCSV = (val: string | null | undefined) => {
      if (!val) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const header = ["Meno", "Firma", "Email", "Telefon", "Kombinacia", "Datum"];
    const rows = displayedLeads.map(lead => {
      const meno = escapeCSV(`${lead.firstName} ${lead.lastName}`);
      const firma = escapeCSV(lead.company);
      const email = escapeCSV(lead.email);
      const telefon = escapeCSV(lead.phone);
      const kombinacia = escapeCSV(renderCombination(lead.configData));
      const datum = escapeCSV(formatDate(lead.createdAt));
      return [meno, firma, email, telefon, kombinacia, datum].join(";");
    });
    
    const csvContent = [header.join(";"), ...rows].join("\n");
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "export_leadov.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-neutral-800">CRM Kontakty & Leady</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 font-medium">Od:</span>
            <input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-md bg-white text-neutral-800 focus:outline-none focus:border-neutral-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500 font-medium">Do:</span>
            <input 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-md bg-white text-neutral-800 focus:outline-none focus:border-neutral-400"
            />
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            Exportovať do CSV
          </Button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all' 
              ? 'border-neutral-900 text-neutral-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Všetky kontakty
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'archived' 
              ? 'border-neutral-900 text-neutral-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Archivované kontakty
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zoznam stiahnutých textúr</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-neutral-600">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Meno / Firma</th>
                  <th className="px-6 py-4 font-medium">Kontakt</th>
                  <th className="px-6 py-4 font-medium">Vygenerovaná kombinácia</th>
                  <th className="px-6 py-4 font-medium text-center">Dátum</th>
                  <th className="px-6 py-4 font-medium text-center">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">Načítavam dáta...</td>
                  </tr>
                ) : displayedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">Zatiaľ žiadne záznamy v tejto sekcii.</td>
                  </tr>
                ) : (
                  displayedLeads.map((lead) => (
                    <tr key={lead.id} className={`border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${!lead.isRead ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-6 py-4 font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          {!lead.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Neprečítané" />}
                          <span className={!lead.isRead ? 'font-bold' : ''}>
                            {lead.firstName} {lead.lastName}
                          </span>
                        </div>
                        {lead.company && <div className={`text-xs mt-0.5 ${!lead.isRead ? 'font-semibold text-neutral-600' : 'text-neutral-500'}`}>{lead.company}</div>}
                      </td>
                      <td className={`px-6 py-4 ${!lead.isRead ? 'font-bold' : ''}`}>
                        <div>{lead.email}</div>
                        <div className={`text-xs ${!lead.isRead ? 'font-medium text-neutral-500' : 'text-neutral-400'}`}>{lead.phone || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 whitespace-normal wrap-break-word max-w-50">
                          {renderCombination(lead.configData)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex flex-col items-center justify-center gap-2">
                          {canEdit && (
                            <Button variant="outline" size="sm" className="w-full max-w-[100px]" onClick={() => handleToggleArchive(lead)}>
                              {lead.isArchived ? 'Obnoviť' : 'Archivovať'}
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" className="w-full max-w-[100px]" onClick={() => handleViewDetail(lead)}>
                            Detail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal - Detail kontaktu */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-neutral-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-neutral-800">Detail Leadu</h2>
              <button 
                onClick={() => setSelectedLead(null)} 
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-1 rounded-md hover:bg-neutral-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0 flex flex-col space-y-6">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Dátum</p>
                  <p className="font-medium text-neutral-900">{formatDate(selectedLead.createdAt)}</p>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Typ Leadu</p>
                  <p className="font-medium text-neutral-900 capitalize">{selectedLead.leadType}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Meno / Spoločnosť</p>
                  <p className="font-medium text-neutral-900 text-base">{selectedLead.firstName} {selectedLead.lastName}</p>
                  {selectedLead.company && <p className="text-neutral-600">{selectedLead.company}</p>}
                </div>
                <div>
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Email</p>
                  <a href={`mailto:${selectedLead.email}`} className="font-medium text-primary hover:underline">
                    {selectedLead.email}
                  </a>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Telefón</p>
                  <p className="font-medium text-neutral-900">{selectedLead.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Mesto</p>
                  <p className="font-medium text-neutral-900">{selectedLead.city || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">Poznámka</p>
                  <p className="font-medium text-neutral-900 whitespace-pre-wrap">{selectedLead.note || "-"}</p>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-6">
                <h3 className="font-bold text-neutral-800 mb-3">Vygenerovaná konfigurácia fasády</h3>
                <div className="bg-neutral-50 rounded-xl p-4 space-y-3 overflow-visible wrap-break-word whitespace-normal">
                  {(() => {
                    if (!selectedLead.configData) return <p className="text-sm text-neutral-500">Žiadna konfigurácia nebola uložená.</p>;
                    
                    try {
                      const parsed = JSON.parse(selectedLead.configData);
                      return (
                        <>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-neutral-500 font-medium">Tehla</span>
                            <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">{parsed.brick || <span className="text-neutral-400 italic">Nezadaná</span>}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-neutral-500 font-medium">Formát</span>
                            <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">{parsed.format || <span className="text-neutral-400 italic">Nezadaný</span>}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-neutral-500 font-medium">Väzba</span>
                            <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">
                              {(() => {
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
                                return parsed.bond ? (bondMapping[parsed.bond.toLowerCase()] || parsed.bond) : <span className="text-neutral-400 italic">Nezadaná</span>;
                              })()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-neutral-500 font-medium">Farba škáry</span>
                            <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">{parsed.jointColor || <span className="text-neutral-400 italic">Nezadaná</span>}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-neutral-500 font-medium">Hrúbka škáry / Profil</span>
                            <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">
                              {parsed.jointThickness ? `${parsed.jointThickness} mm` : <span className="text-neutral-400 italic">Nezadaná</span>}
                              {parsed.jointProfile ? ` (${parsed.jointProfile.charAt(0).toUpperCase() + parsed.jointProfile.slice(1)})` : ''}
                            </span>
                          </div>
                        </>
                      );
                    } catch {
                       return <p className="text-sm font-medium text-neutral-900 whitespace-normal wrap-break-word">{selectedLead.configData}</p>;
                    }
                  })()}
                </div>
              </div>

              {selectedLead.utmData && (
                 <div className="border-t border-neutral-100 pt-6">
                 <h3 className="font-bold text-neutral-800 mb-3">Marketing / UTM Tagy</h3>
                 <div className="bg-neutral-50 rounded-xl p-4 space-y-3 overflow-visible wrap-break-word whitespace-normal">
                   {(() => {
                     try {
                       const parsed = JSON.parse(selectedLead.utmData);
                       return (
                         <>
                           {parsed.utm_source && (
                           <div className="flex flex-col gap-0.5">
                             <span className="text-xs text-neutral-500 font-medium">Source</span>
                             <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">{parsed.utm_source}</span>
                           </div>
                           )}
                           {parsed.utm_medium && (
                           <div className="flex flex-col gap-0.5">
                             <span className="text-xs text-neutral-500 font-medium">Medium</span>
                             <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">{parsed.utm_medium}</span>
                           </div>
                           )}
                           {parsed.utm_campaign && (
                           <div className="flex flex-col gap-0.5">
                             <span className="text-xs text-neutral-500 font-medium">Campaign</span>
                             <span className="text-sm font-semibold text-neutral-900 whitespace-normal wrap-break-word">{parsed.utm_campaign}</span>
                           </div>
                           )}
                         </>
                       );
                     } catch {
                        return <p className="text-sm font-medium text-neutral-900 whitespace-normal wrap-break-word">{selectedLead.utmData}</p>;
                     }
                   })()}
                 </div>
               </div>
              )}

            </div>
            
            <div className="p-6 border-t border-neutral-100 flex justify-end shrink-0">
              <Button variant="outline" onClick={() => setSelectedLead(null)}>
                Zavrieť
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
