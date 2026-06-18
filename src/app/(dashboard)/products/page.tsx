"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";
import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";

type Attribute = { id: string; label: string; value: string; meta?: string };

type AttributesData = {
  colors: Attribute[];
  manufacturers: Attribute[];
  structures: Attribute[];
  formats: Attribute[];
  priceLevels: Attribute[];
};

// Base URL pre statické súbory tehiel (thumbnaily a textúry).
// Hodnota sa načíta z NEXT_PUBLIC_BRICKS_URL v .env.local.
// V DEV: http://localhost:3000 (Konfigurator servúsuje /bricks/...)
// V PROD: nastavž na CDN alebo externú URL
const BRICKS_URL = process.env.NEXT_PUBLIC_BRICKS_URL ?? '';

const typeMap: Record<string, string> = {
  BRICK: "Tehla",
  tehla: "Tehla",
  JOINT: "Škára",
  skara: "Škára",
  BOND: "Väzba",
  vazba: "Väzba",
  other: "Iné"
};

const getFormatString = (fmt: any) => {
  if (!fmt) return "-";
  if (typeof fmt === "string") return fmt;
  if (!fmt.width && !fmt.height && !fmt.depth) return "";
  return `${fmt.width || 0}x${fmt.height || 0}x${fmt.depth || 0}mm`;
};

const parseFormatString = (fmtStr: string) => {
  if (!fmtStr) return null;
  const cleanStr = fmtStr.toLowerCase().replace(/mm|cm/g, "").trim();
  const parts = cleanStr.split(/x|\*/i).map(p => parseInt(p.trim(), 10));
  if (parts.length >= 3 && parts.every(p => !isNaN(p))) {
    return JSON.stringify({ width: parts[0], height: parts[1], depth: parts[2] });
  }
  return null;
};

const ProductImage = ({ product }: { product: any }) => {
  const [error, setError] = useState(false);
  const imageUrl = (product.code || product.id) ? `${BRICKS_URL}/bricks/${product.code || product.id}/thumb.webp` : null;

  if (error || !imageUrl) {
    return (
      <div className="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
        {product.name ? product.name.substring(0, 2).toUpperCase() : "??"}
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={product.name} 
      className="w-12 h-12 object-cover rounded-md shadow-sm"
      onError={() => setError(true)}
    />
  );
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<AttributesData>({
    colors: [],
    manufacturers: [],
    structures: [],
    formats: [],
    priceLevels: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const canEdit = user?.role === "super_admin" || (user?.permissions && user.permissions.includes("products:write")); // RBAC check

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("tehla");
  const [color, setColor] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [structure, setStructure] = useState("");
  const [priceLevel, setPriceLevel] = useState<string>("");
  const [exactPrice, setExactPrice] = useState<number | "">("");
  const [isManualPriceOverride, setIsManualPriceOverride] = useState(false);
  const [format, setFormat] = useState("");
  const [isActive, setIsActive] = useState(true);
  
  // File State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Textures State
  const [textureFiles, setTextureFiles] = useState<File[]>([]);
  const [texturesDragActive, setTexturesDragActive] = useState(false);

  // Status State
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const texturesInputRef = useRef<HTMLInputElement>(null);

  // ─── Zóna B File Manager State ────────────────────────────
  const [brickFiles, setBrickFiles] = useState<any[]>([]);
  const [brickFilesLoading, setBrickFilesLoading] = useState(false);
  const [brickFilesError, setBrickFilesError] = useState("");
  const [showAllFiles, setShowAllFiles] = useState(false);

  const loadTextures = async (productId: string) => {
    setBrickFilesLoading(true);
    setBrickFilesError("");
    try {
      const res = await fetchApi<any>(`/api/products/${productId}/textures`);
      setBrickFiles(res.data?.files ?? []);
    } catch (err: any) {
      setBrickFilesError(err.message || "Nepodarilo sa načítať súbory");
    } finally {
      setBrickFilesLoading(false);
    }
  };

  // Pagination & Filtering States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [filterColor, setFilterColor] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [filterStructure, setFilterStructure] = useState("");
  const [filterFormat, setFilterFormat] = useState("");
  const [filterPriceLevel, setFilterPriceLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string | null, direction: 'asc' | 'desc' }>({ key: 'manufacturer', direction: 'asc' });

  const priceLevelMap = useMemo(() => {
    const map: Record<string, string> = {};
    attributes.priceLevels.forEach(p => map[p.value] = p.label);
    return map;
  }, [attributes.priceLevels]);

  // Extrahovanie unikátnych možností pre filtre (nové Prisma kľúče)
  const uniqueColors = Array.from(new Set(products.map(p => p.dominantnaFarba || p.color))).filter(Boolean) as string[];
  const uniqueManufacturers = Array.from(new Set(products.map(p => p.manufacturer))).filter(Boolean) as string[];
  const uniqueStructures = Array.from(new Set(products.map(p => p.structure))).filter(Boolean) as string[];
  const formatMap = useMemo(() => {
    const map: Record<string, string> = {};
    attributes.formats.forEach(f => map[f.value] = f.label);
    return map;
  }, [attributes.formats]);
  const uniqueFormats = Array.from(
    new Set(products.map(p => p.formatConfigId ? formatMap[p.formatConfigId] : null))
  ).filter(Boolean) as string[];
  const uniquePriceLevels = Array.from(
    new Set(products.map(p => p.priceLevelId ? priceLevelMap[p.priceLevelId] : null))
  ).filter(Boolean) as string[];

  const formatDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      if (p.formatLabel && !map[p.formatLabel]) {
        if (p.dimensions) {
          const dim = p.dimensions.trim().endsWith("mm") ? p.dimensions.trim() : `${p.dimensions.trim()} mm`;
          map[p.formatLabel] = `${p.formatLabel} - ${dim}`;
        } else {
          map[p.formatLabel] = p.formatLabel;
        }
      }
    });
    return map;
  }, [products]);

  const filteredProducts = products.filter(p => {
    const pColor = p.dominantnaFarba || p.color;
    const pPriceLabel = p.priceLevelId ? priceLevelMap[p.priceLevelId] : null;
    const pFormatLabel = p.formatConfigId ? formatMap[p.formatConfigId] : null;
    if (filterColor && pColor !== filterColor) return false;
    if (filterManufacturer && p.manufacturer !== filterManufacturer) return false;
    if (filterStructure && p.structure !== filterStructure) return false;
    if (filterFormat && pFormatLabel !== filterFormat) return false;
    if (filterPriceLevel && pPriceLabel !== filterPriceLevel) return false;
    
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      if (!p.name?.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const processedProducts = useMemo(() => {
    let sortableProducts = [...filteredProducts];
    if (sortConfig.key !== null) {
      sortableProducts.sort((a, b) => {
        let aValue: any = "";
        let bValue: any = "";

        if (sortConfig.key === 'name') {
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
        } else if (sortConfig.key === 'manufacturer') {
          aValue = (a.manufacturer || "").toLowerCase();
          bValue = (b.manufacturer || "").toLowerCase();
        } else if (sortConfig.key === 'color') {
          aValue = a.dominantnaFarba || a.color || "";
          bValue = b.dominantnaFarba || b.color || "";
        } else if (sortConfig.key === 'format') {
          aValue = a.formatConfigId ? formatMap[a.formatConfigId] : (a.formatLabel || getFormatString(a.format) || "");
          bValue = b.formatConfigId ? formatMap[b.formatConfigId] : (b.formatLabel || getFormatString(b.format) || "");
        } else if (sortConfig.key === 'isActive') {
          aValue = a.isActive !== false ? 1 : 0;
          bValue = b.isActive !== false ? 1 : 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        
        // Secondary sort: by name ASC
        if (sortConfig.key !== 'name') {
           const aName = (a.name || "").toLowerCase();
           const bName = (b.name || "").toLowerCase();
           if (aName < bName) return -1;
           if (aName > bName) return 1;
        }
        return 0;
      });
    }
    return sortableProducts;
  }, [filteredProducts, sortConfig, formatMap]);

  const totalPages = Math.max(1, Math.ceil(processedProducts.length / itemsPerPage));
  const paginatedProducts = processedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterColor, filterManufacturer, filterStructure, filterFormat, filterPriceLevel, searchQuery, sortConfig]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<any>(`/api/products?limit=2000`);
      let productsArray: any[] = [];
      if (res && res.data && Array.isArray(res.data)) {
        productsArray = res.data;
      } else if (Array.isArray(res)) {
        productsArray = res;
      }
      setProducts(productsArray);
      setError("");
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa načítať produkty");
    } finally {
      setLoading(false);
    }
  };

  const loadAttributes = async () => {
    try {
      const res = await fetchApi<AttributesData>("/api/attributes");
      if (res.data) {
        setAttributes(res.data);
      }
    } catch (err) {
      console.error("Nepodarilo sa načítať číselníky:", err);
    }
  };

  useEffect(() => {
    loadData();
    loadAttributes();
  }, []);

  const resetForm = () => {
    setEditProductId(null);
    setName("");
    setCode("");
    setCategory("tehla");
    setColor("");
    setManufacturer("");
    setStructure("");
    setPriceLevel("");
    setExactPrice("");
    setIsManualPriceOverride(false);
    setFormat("");
    setIsActive(true);
    setImageFile(null);
    setImagePreview(null);
    setPreviewError(false);
    setTextureFiles([]);
    setFormError("");
    setDragActive(false);
    setTexturesDragActive(false);
    setUploadProgress(null);
    // Reset File Manager
    setBrickFiles([]);
    setBrickFilesError("");
    setShowAllFiles(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEditModal = (product: any) => {
    resetForm();
    setEditProductId(product.id);
    setName(product.name || "");
    setCode(product.code || "");
    setCategory(product.productType || product.category || product.type || "tehla");
    // Farba: nový kľúč z Prisma je dominantnaFarba
    setColor(product.dominantnaFarba || product.color || "");
    setManufacturer(product.manufacturer || "");
    // Štruktúra: kľúč je rovnaký v starej aj novej schéme
    setStructure(product.structure || "");
    setPriceLevel(product.priceLevelId || "");
    setExactPrice(product.exactPrice !== null && product.exactPrice !== undefined ? product.exactPrice : "");
    setIsManualPriceOverride(product.isManualPriceOverride || false);
    // Formát: nový relačný stĺpec formatConfigId
    setFormat(product.formatConfigId || "");
    // isActive: nové pole z Prisma schémy (default true pre staré záznamy)
    setIsActive(product.isActive !== false);
    
    const imageUrl = (product.code || product.id) ? `${BRICKS_URL}/bricks/${product.code || product.id}/thumb.webp` : null;
    setImagePreview(imageUrl);
    setPreviewError(false);
    setModalOpen(true);
    // Načítať zóna B súbory z fyzického adresára
    loadTextures(product.id);
  };

  const handleToggleStatus = async (product: any) => {
    const isCurrentlyActive = product.isActive !== false;
    const newStatus = !isCurrentlyActive;
    const actionText = newStatus ? "aktivovať" : "deaktivovať";
    const infoText = newStatus ? "Produkt sa znova zobrazí v konfigurátore." : "Zmizne z konfigurátora, ale zostane v databáze.";
    
    if (!window.confirm(`Naozaj chcete ${actionText} tento produkt?\n\n${infoText}`)) return;
    
    try {
      await fetchApi(`/api/products/${product.id}`, { 
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus })
      });
      loadData();
    } catch (err: any) {
      alert(`Chyba pri zmene statusu: ${err.message || "Neznáma chyba"}`);
    }
  };


  // Thumbnail Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFormError("Prosím, nahrajte iba obrázok pre náhľad.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setPreviewError(false);
    setFormError("");
  };

  // Textures Drag & Drop
  const handleTexturesDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setTexturesDragActive(true);
    } else if (e.type === "dragleave") {
      setTexturesDragActive(false);
    }
  };

  const handleTexturesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTexturesDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addTextureFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleTexturesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addTextureFiles(Array.from(e.target.files));
    }
  };

  const addTextureFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith("image/"));
    if (validFiles.length !== files.length) {
      setFormError("Niektoré súbory neboli pridané, pretože nie sú obrázky.");
    }
    setTextureFiles(prev => [...prev, ...validFiles]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    setUploadProgress(null);

    try {
      // Step 1: Update/Create Product
      // PUT používa JSON body s novými Prisma kľúčmi.
      // POST (nový produkt) naďalej používa multipart/form-data.
      const url = editProductId ? `/api/products/${editProductId}` : "/api/products";
      const method = editProductId ? "PUT" : "POST";

      let step1Data: any;
      let step1Headers: Record<string, string> | undefined = undefined;

      if (editProductId) {
        // PUT: JSON payload s novými Prisma kľúčmi
        const payload = {
          name,
          code: code || null,
          dominantnaFarba: color,
          manufacturer,
          structure: structure || null,
          formatConfigId: format === "" ? null : format,
          priceLevelId: priceLevel === "" ? null : priceLevel,
          exactPrice: exactPrice === "" ? null : exactPrice,
          isManualPriceOverride,
          isActive,
        };
        step1Data = JSON.stringify(payload);
        step1Headers = { "Content-Type": "application/json" };
      } else {
        // POST: multipart/form-data pre nový produkt
        step1Data = new FormData();
        step1Data.append("name", name);
        if (code) step1Data.append("code", code);
        step1Data.append("category", category);
        if (color) step1Data.append("color", color);
        if (manufacturer) step1Data.append("manufacturer", manufacturer);
        if (structure) step1Data.append("structure", structure);
        if (priceLevel !== "") step1Data.append("priceLevelId", String(priceLevel));
        if (exactPrice !== "") step1Data.append("exactPrice", String(exactPrice));
        step1Data.append("isManualPriceOverride", String(isManualPriceOverride));
        if (format !== "") step1Data.append("formatConfigId", String(format));
        if (imageFile) step1Data.append("thumbnail", imageFile);
      }

      const res = await fetchApi<any>(url, {
        method,
        body: step1Data,
        headers: step1Headers,
      });

      const productId = res.data.id;

      // Step 2: Upload Textures
      if (textureFiles.length > 0) {
        setUploadProgress(0);
        
        const step2Data = new FormData();
        textureFiles.forEach(file => {
          step2Data.append("textureImages", file);
        });

        // Simulácia progressu pre fetchApi
        const interval = setInterval(() => {
          setUploadProgress(prev => (prev !== null && prev < 90) ? prev + 10 : prev);
        }, 300);

        await fetchApi(`/api/products/${productId}/textures`, {
          method: "POST",
          body: step2Data,
        });

        clearInterval(interval);
        setUploadProgress(100);
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error("Failed to save product:", err);
      let errorMsg = "Nepodarilo sa uložiť produkt";
      
      if (err.response && err.response.data && err.response.data.error) {
        errorMsg = err.response.data.error.message || err.response.data.error;
      } else if (typeof err === "string") {
        errorMsg = err;
      } else if (err?.error?.message) {
        errorMsg = err.error.message;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      setFormError(errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Category", "Manufacturer", "Color", "Structure", "Format", "Price", "Status"];
    
    const rows = products.map(p => {
      const pColor = p.dominantnaFarba || p.color || "";
      const pFormat = p.formatConfigId ? formatMap[p.formatConfigId] : (p.formatLabel || getFormatString(p.format) || "");
      const pPrice = p.priceLevelId ? priceLevelMap[p.priceLevelId] : (p.exactPrice ? p.exactPrice + " €" : "");
      const pStatus = p.isActive !== false ? "Aktívny" : "Neaktívny";
      
      return [
        p.name || "",
        typeMap[p.productType || p.category || p.type || "tehla"] || p.category || "",
        p.manufacturer || "",
        pColor,
        p.structure || "",
        pFormat,
        pPrice,
        pStatus
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";");
    });

    const csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "product_database_backup.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-6 text-neutral-500">Načítavam produkty...</div>;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-neutral-800">Katalóg produktov</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExportCSV} className="flex-1 sm:flex-none whitespace-nowrap">
            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Exportovať Katalóg (CSV)
          </Button>
          {canEdit && <Button onClick={handleOpenAddModal} className="flex-1 sm:flex-none whitespace-nowrap">Pridať produkt</Button>}
        </div>
      </div>

      {error && <div className="p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-neutral-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <input 
            type="text" 
            className="block w-full p-2 pl-10 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" 
            placeholder="Hľadať produkt podľa názvu..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <select 
          value={filterColor} onChange={e => setFilterColor(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
        >
          <option value="">Všetky farby</option>
          {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select 
          value={filterManufacturer} onChange={e => setFilterManufacturer(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
        >
          <option value="">Všetci výrobcovia</option>
          {uniqueManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select 
          value={filterStructure} onChange={e => setFilterStructure(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
        >
          <option value="">Všetky štruktúry</option>
          {uniqueStructures.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select 
          value={filterFormat} onChange={e => setFilterFormat(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
        >
          <option value="">Všetky formáty</option>
          {uniqueFormats.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select 
          value={filterPriceLevel} onChange={e => setFilterPriceLevel(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
        >
          <option value="">Všetky cenové úrovne</option>
          {uniquePriceLevels.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spravovať ponuku konfigurátora</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-neutral-600">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors" onClick={() => handleSort('name')}>Názov produktu{getSortIcon('name')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors" onClick={() => handleSort('manufacturer')}>Výrobca{getSortIcon('manufacturer')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors" onClick={() => handleSort('color')}>Farba{getSortIcon('color')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors" onClick={() => handleSort('format')}>Formát{getSortIcon('format')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:bg-neutral-100 transition-colors" onClick={() => handleSort('isActive')}>Status{getSortIcon('isActive')}</th>
                  {canEdit && <th className="px-6 py-4 font-medium text-center">Akcie</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="px-6 py-8 text-center text-neutral-500">
                      Zatiaľ neboli pridané žiadne produkty, alebo žiadny produkt nevyhovuje filtrom.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product, index) => (
                    <tr key={product.id || product.code || index} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">
                        <div className="flex items-center gap-3">
                          <ProductImage product={product} />
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700">
                          {product.manufacturer || "–"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">
                          {(product.dominantnaFarba || product.color)
                            ? (product.dominantnaFarba || product.color)
                            : <span className="text-neutral-400 italic">Čaká na spracovanie</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">{product.formatConfigId ? formatMap[product.formatConfigId] : (product.formatLabel || getFormatString(product.format) || "–")}</td>
                      <td className="px-6 py-4">
                        {product.isActive !== false ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Aktívny
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
                            <span className="w-2 h-2 rounded-full bg-neutral-400" />
                            Neaktívny
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 text-center space-x-2 flex justify-center">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(product)}>Upraviť</Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleToggleStatus(product)} 
                            className={`border-neutral-200 hover:bg-neutral-100 ${product.isActive !== false ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                          >
                            {product.isActive !== false ? "Deaktivovať" : "Aktivovať"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
              >
                Predchádzajúca
              </Button>
              
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  if (page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "primary" : "outline"}
                        size="sm"
                        className={`w-8 h-8 p-0 ${currentPage === page ? "bg-primary text-white hover:bg-primary/90" : "text-neutral-600"}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  }
                  if (page === currentPage - 3 || page === currentPage + 3) {
                    return <span key={page} className="text-neutral-400 px-1">...</span>;
                  }
                  return null;
                })}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
              >
                Ďalšia
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal / Slide-over Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-neutral-800">
                {editProductId ? "Upraviť produkt" : "Pridať nový produkt"}
              </h2>
              <button 
                onClick={() => setModalOpen(false)} 
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-1 rounded-md hover:bg-neutral-100"
                disabled={formLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col space-y-6 flex-1">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                  {formError}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Názov produktu *</label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Napr. Terca Rustica"
                      disabled={formLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Kód produktu (Názov priečinka)
                    </label>
                    <input 
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                      placeholder="napr. terca-rustica (presne zhodný s názvom priečinka na disku)"
                      disabled={formLoading}
                    />
                    <p className="mt-1 text-xs text-neutral-400">
                      ⚠️ Musí presne zodpovedať názvu fyzického priečinka na disku (case-sensitive). Používa sa na načítanie textúr a náhľadov.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Kategória *</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      disabled={formLoading}
                    >
                      <option value="tehla">Tehla</option>
                      <option value="skara">Škára</option>
                      <option value="vazba">Väzba</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Farba</label>
                    <select 
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      disabled={formLoading}
                    >
                      <option value="">-- Vyberte farbu --</option>
                      {attributes.colors.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Výrobca</label>
                    <select 
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      disabled={formLoading}
                    >
                      <option value="">-- Vyberte výrobcu --</option>
                      {attributes.manufacturers.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Štruktúra</label>
                      <select 
                        value={structure}
                        onChange={(e) => setStructure(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        disabled={formLoading}
                      >
                        <option value="">-- Výber --</option>
                        {attributes.structures.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Cenová úroveň</label>
                      <select 
                        value={priceLevel}
                        onChange={(e) => setPriceLevel(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        disabled={formLoading}
                      >
                        <option value="">-- Výber --</option>
                        {attributes.priceLevels.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Formát (voliteľné)</label>
                    <select 
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      disabled={formLoading}
                    >
                      <option value="">-- Vyberte formát --</option>
                      {attributes.formats.map(f => {
                        let metaObj: any = null;
                        try {
                          if (f.meta) metaObj = JSON.parse(f.meta);
                        } catch(e) {}
                        const dimText = metaObj ? `${metaObj.width}x${metaObj.height}${metaObj.thickness ? `x${metaObj.thickness}` : ''} mm` : '';
                        return (
                          <option key={f.value} value={f.value}>{f.label} {dimText ? `- ${dimText}` : ''}</option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Presná cena (za m²)</label>
                      <input 
                        type="number" step="0.01"
                        value={exactPrice}
                        onChange={(e) => setExactPrice(e.target.value ? parseFloat(e.target.value) : "")}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        placeholder="Napr. 45.50"
                        disabled={formLoading}
                      />
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="checkbox"
                        id="isManualPriceOverride"
                        checked={isManualPriceOverride}
                        onChange={(e) => setIsManualPriceOverride(e.target.checked)}
                        className="w-4 h-4 text-primary bg-neutral-100 border-neutral-300 rounded focus:ring-primary"
                        disabled={formLoading}
                      />
                      <label htmlFor="isManualPriceOverride" className="ml-2 text-sm font-medium text-neutral-700">
                        Manuálny override cenovej úrovne
                      </label>
                    </div>
                  </div>

                  {/* Status – zobrazuj len v Edit mode */}
                  {editProductId && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Status produktu</label>
                      <div className="flex items-center gap-3 px-3 py-2.5 border border-neutral-200 rounded-xl bg-white">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isActive}
                          onClick={() => setIsActive(v => !v)}
                          disabled={formLoading}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                            isActive ? "bg-green-500" : "bg-neutral-300"
                          } disabled:opacity-50`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                              isActive ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className={`text-sm font-medium ${ isActive ? "text-green-700" : "text-neutral-500" }`}>
                          {isActive ? "Aktívny – viditeľný v konfigurátore" : "Neaktívny – skrytý z konfigurátora"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Zóna A: Thumbnail */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Profilový obrázok (Zóna A)</label>
                    <div 
                      className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer flex flex-col items-center justify-center min-h-25
                        ${dragActive ? "border-primary bg-primary/5" : "border-neutral-300 hover:border-primary hover:bg-neutral-50"}
                        ${formLoading ? "opacity-50 pointer-events-none" : ""}
                      `}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      
                      {imagePreview ? (
                        <div className="relative group flex justify-center w-full h-full items-center">
                          {!previewError && imagePreview ? (
                            <img 
                              src={imagePreview} 
                              alt="Náhľad" 
                              className="h-20 w-auto object-contain rounded-md shadow-sm" 
                              onError={() => setPreviewError(true)}
                            />
                          ) : (
                            <div className="h-20 w-20 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl shadow-sm">
                              {name ? name.substring(0, 2).toUpperCase() : "??"}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                            <span className="text-white text-xs font-medium">Zmeniť</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-neutral-500">
                          <svg className={`w-6 h-6 mb-1 transition-colors ${dragActive ? "text-primary" : "text-neutral-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className={`text-xs font-medium ${dragActive ? "text-primary" : ""}`}>Profilová fotka</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Zóna B: Textures Bulk Upload */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Generátorové textúry (Zóna B)</label>
                    <div 
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer flex flex-col items-center justify-center min-h-40
                        ${texturesDragActive ? "border-primary bg-primary/5" : "border-neutral-300 hover:border-primary hover:bg-neutral-50"}
                        ${formLoading ? "opacity-50 pointer-events-none" : ""}
                      `}
                      onDragEnter={handleTexturesDrag}
                      onDragLeave={handleTexturesDrag}
                      onDragOver={handleTexturesDrag}
                      onDrop={handleTexturesDrop}
                      onClick={() => texturesInputRef.current?.click()}
                    >
                      <input 
                        type="file"
                        multiple
                        ref={texturesInputRef}
                        onChange={handleTexturesChange}
                        accept="image/*"
                        className="hidden"
                      />
                      
                      <svg className={`w-10 h-10 mb-3 transition-colors ${texturesDragActive ? "text-primary" : "text-neutral-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      
                      {textureFiles.length > 0 ? (
                        <div>
                          <p className="text-lg font-bold text-primary">Vybraných {textureFiles.length} fotografií</p>
                          <p className="text-xs text-neutral-500 mt-1">Kliknite pre pridanie ďalších</p>
                          <button 
                            type="button" 
                            className="text-xs text-red-500 mt-3 hover:underline"
                            onClick={(e) => { e.stopPropagation(); setTextureFiles([]); }}
                          >
                            Vymazať výber
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className={`text-sm font-medium ${texturesDragActive ? "text-primary" : "text-neutral-600"}`}>
                            Vložte hromadné textúry (120-200 ks)
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">Potiahnite myšou alebo kliknite pre výber</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ─── Zóna B: File Manager (iba pri editácii existujúceho produktu) ─── */}
                  {editProductId && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-neutral-700">
                          Existujúce textúry na serveri
                        </label>
                        {brickFiles.length > 0 && (
                          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                            {brickFiles.length} súborov
                          </span>
                        )}
                      </div>

                      {brickFilesLoading && (
                        <div className="text-xs text-neutral-400 py-3 text-center">
                          Načítavam súbory...
                        </div>
                      )}

                      {brickFilesError && (
                        <div className="text-xs text-red-500 py-2 bg-red-50 rounded-lg px-3">
                          {brickFilesError}
                        </div>
                      )}

                      {!brickFilesLoading && !brickFilesError && brickFiles.length === 0 && (
                        <div className="text-xs text-neutral-400 py-3 text-center italic border border-dashed border-neutral-200 rounded-lg">
                          Žiadne fyzické textúry nenájdené v adresári
                        </div>
                      )}

                      {!brickFilesLoading && brickFiles.length > 0 && (
                        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                          <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100">
                            {(showAllFiles ? brickFiles : brickFiles.slice(0, 10)).map((file: any) => (
                              <div key={file.name} className="flex items-center justify-between px-3 py-2 hover:bg-white transition-colors group">
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Typ badge */}
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                    file.type === 'webp' ? 'bg-blue-100 text-blue-700' :
                                    file.type === 'png'  ? 'bg-green-100 text-green-700' :
                                    'bg-neutral-200 text-neutral-600'
                                  }`}>
                                    {file.type}
                                  </span>
                                  {/* Thumb badge */}
                                  {file.isThumb && (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 bg-amber-100 text-amber-700">
                                      THUMB
                                    </span>
                                  )}
                                  <span className="text-xs text-neutral-700 truncate font-mono">{file.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-neutral-400">{file.sizeLabel}</span>
                                  {/* Mazanie – len admin/super_admin */}
                                  {user && (user.role === 'admin' || user.role === 'super_admin') && (
                                    <button
                                      type="button"
                                      title={`Vymazať ${file.name}`}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                                      onClick={async () => {
                                        // Prísnejší confirm pre thumb súbory (Q3 business decision)
                                        const confirmMsg = file.isThumb
                                          ? `⚠️ UPOZORNENIE: Súbor "${file.name}" je hlavná miniatúra produktu (thumb).\n\nJej zmazaním sa odstráni profilový obrázok produktu zo všetkých zoznamov a konfigurátora.\n\nNaozaj chcete pokračovať?`
                                          : `Vymazať súbor "${file.name}" (${file.sizeLabel})?\n\nTáto akcia je nevratná.`;
                                        if (!window.confirm(confirmMsg)) return;
                                        try {
                                          await fetchApi(`/api/products/${editProductId}/textures`, {
                                            method: 'DELETE',
                                            body: JSON.stringify({ filename: file.name }),
                                          });
                                          // Obnov zoznam
                                          loadTextures(editProductId);
                                        } catch (err: any) {
                                          alert(`Chyba pri mazaní: ${err.message || 'Neznáma chyba'}`);
                                        }
                                      }}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {brickFiles.length > 10 && (
                            <button
                              type="button"
                              className="w-full text-xs text-neutral-500 hover:text-primary py-2 border-t border-neutral-100 transition-colors text-center"
                              onClick={() => setShowAllFiles(v => !v)}
                            >
                              {showAllFiles ? 'Zobraziť menej ▲' : `Zobraziť všetkých ${brickFiles.length} súborov ▼`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              <div className="pt-4 flex flex-col gap-3 mt-auto shrink-0 border-t border-neutral-100">
                {formLoading && uploadProgress !== null && (
                  <div className="w-full">
                    <div className="flex justify-between text-xs font-medium text-primary mb-1">
                      <span>Nahrávanie textúr...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2.5">
                      <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={formLoading}>
                    Zrušiť
                  </Button>
                  <Button type="submit" disabled={formLoading || (uploadProgress !== null && uploadProgress < 100)} className="bg-primary hover:bg-primary-hover text-white">
                    {formLoading ? "Ukladám dáta..." : "Uložiť produkt"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Zmena pre vynútenie reštartu TS servera
