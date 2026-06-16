"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/lib/AuthContext";
import { fetchApi } from "@/lib/apiClient";
import React, { useState, useEffect } from "react";

const PERMISSION_MODULES = [
  { id: "products", label: "Produkty" },
  { id: "crm", label: "CRM Kontakty" },
  { id: "marketing", label: "Marketing a SEO" },
  { id: "settings", label: "Nastavenia (Atribúty)" },
  { id: "password", label: "Zmena hesla" },
  { id: "users", label: "Prístupové práva" },
  { id: "email", label: "E-mailové šablóny" },
];

export default function UsersPage() {
  const { user } = useAuth();
  const role = user?.role;
  
  // Modals and form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("admin");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Data state
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<any[]>("/api/users");
      setUsers(res.data || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa načítať používateľov");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === "super_admin") {
      loadUsers();
    }
  }, [role]);

  if (role !== "super_admin") {
    return (
      <div className="p-6 text-red-600 flex flex-col items-center justify-center min-h-[50vh]">
        <svg className="w-16 h-16 mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-xl font-bold">Prístup zamietnutý</h2>
        <p className="text-neutral-500 mt-2">Nemáte oprávnenie na zobrazenie tejto sekcie. Iba Super Admin môže spravovať používateľov.</p>
      </div>
    );
  }

  const openAddModal = () => {
    setEditingUserId(null);
    setName("");
    setEmail("");
    setPassword("");
    setSelectedRole("admin");
    setPermissions([]);
    setFormError("");
    setModalOpen(true);
  };

  const handleEdit = (u: any) => {
    setEditingUserId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword(""); // Keep empty so we don't accidentally override
    setSelectedRole(u.role);
    setPermissions(u.permissions || []);
    setFormError("");
    setModalOpen(true);
  };

  const togglePermission = (moduleId: string, type: "read" | "write", checked: boolean) => {
    setPermissions((prev) => {
      const newPerms = new Set(prev);
      const perm = `${moduleId}:${type}`;
      if (checked) {
        newPerms.add(perm);
        if (type === "write") newPerms.add(`${moduleId}:read`);
      } else {
        newPerms.delete(perm);
        if (type === "read") newPerms.delete(`${moduleId}:write`);
      }
      return Array.from(newPerms);
    });
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    const payload: any = { name, email, role: selectedRole, permissions };
    if (password) {
      payload.password = password;
    }

    try {
      if (editingUserId) {
        await fetchApi(`/api/users/${editingUserId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        if (!password) throw new Error("Heslo je povinné pre nového používateľa");
        await fetchApi("/api/users", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      
      setModalOpen(false);
      loadUsers();
    } catch (err: any) {
      console.error("User save failed:", err);
      let errorMsg = "Nastala neznáma chyba";
      if (typeof err === "string") errorMsg = err;
      else if (err?.error?.message) errorMsg = err.error.message;
      else if (err?.message) errorMsg = err.message;
      else if (err?.error && typeof err.error === "string") errorMsg = err.error;
      
      setFormError(errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Naozaj chcete zmazať tohto používateľa?")) return;
    
    try {
      await fetchApi(`/api/users/${id}`, { method: "DELETE" });
      loadUsers();
    } catch (err: any) {
      alert(`Chyba pri mazaní: ${err.message}`);
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    viewer: "Viewer",
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">Prístupové práva</h1>
        <Button onClick={openAddModal}>Pridať používateľa</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Správa používateľov systému</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && <div className="p-4 text-red-600 bg-red-50">{error}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-neutral-600">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Rola</th>
                  <th className="px-6 py-4 font-medium">Dátum vytvorenia</th>
                  <th className="px-6 py-4 font-medium text-right">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">Načítavam dáta...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">Nenašli sa žiadni používatelia.</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                          u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {roleLabels[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(u)}
                        >
                          Upraviť
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm" 
                          disabled={u.role === 'super_admin' || u.id === user?.id}
                          title={u.id === user?.id ? "Nemôžete zmazať vlastný účet" : ""}
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          Zmazať
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-neutral-800">
                {editingUserId ? "Upraviť používateľa" : "Pridať nového používateľa"}
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
            
            <form onSubmit={handleSubmitUser} className="p-6 flex-1 flex flex-col space-y-4">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Meno</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Ján Novák"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="meno@firma.sk"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {editingUserId ? "Nové heslo (voliteľné)" : "Heslo"}
                  </label>
                  <input 
                    type="password" 
                    required={!editingUserId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Min. 8 znakov"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Rola</label>
                  <select 
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  >
                    <option value="super_admin">Super Admin (plný prístup)</option>
                    <option value="admin">Admin (právo zápisu a úprav)</option>
                    <option value="viewer">Viewer (iba na čítanie)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Prístupové práva (Permission Matrix)</label>
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>
                        <th className="px-4 py-2 font-medium text-neutral-600">Modul</th>
                        <th className="px-4 py-2 font-medium text-neutral-600 text-center">Čítanie</th>
                        <th className="px-4 py-2 font-medium text-neutral-600 text-center">Zápis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {PERMISSION_MODULES.map((mod) => (
                        <tr key={mod.id} className="hover:bg-neutral-50/50">
                          <td className="px-4 py-2 text-neutral-800">{mod.label}</td>
                          <td className="px-4 py-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={permissions.includes(`${mod.id}:read`) || selectedRole === "super_admin"}
                              disabled={selectedRole === "super_admin"}
                              onChange={(e) => togglePermission(mod.id, "read", e.target.checked)}
                              className="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={permissions.includes(`${mod.id}:write`) || selectedRole === "super_admin"}
                              disabled={selectedRole === "super_admin"}
                              onChange={(e) => togglePermission(mod.id, "write", e.target.checked)}
                              className="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedRole === "super_admin" && (
                  <p className="text-xs text-neutral-500 mt-2">Super Admin má automaticky plný prístup ku všetkým modulom.</p>
                )}
              </div>
              
              <div className="pt-4 flex justify-end gap-3 mt-2 border-t border-neutral-100">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Zrušiť</Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Ukladám..." : "Uložiť používateľa"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
