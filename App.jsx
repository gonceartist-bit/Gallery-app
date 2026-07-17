import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, ChevronRight, MoreVertical, FolderPlus, Upload, Settings as SettingsIcon,
  Sun, Moon, Check, X, Share2, Heart, Trash2, Home, Plus, Pencil,
  Droplet, PaintBucket, Paintbrush, Brush, Feather, Monitor, Landmark, Shapes,
  ArrowRight, Image as ImageIcon, FolderHeart, Loader2, Crop
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  توکن‌های طراحی — سه پوسته رنگی × دو حالت (روشن/شب)                */
/* ------------------------------------------------------------------ */
const PALETTES = {
  neutral: {
    label: "خنثی",
    swatch: ["#D8CFC0", "#A69582", "#6B5A47"],
    light: { bg: "#F5F2EC", surface: "#FFFFFF", surface2: "#EBE4D8", text: "#2A2318", sub: "#7A6E5C", accent: "#6B5A47", accentSoft: "#E3D6C1", border: "#DED2BE" },
    dark:  { bg: "#191510", surface: "#241E17", surface2: "#2E271D", text: "#F0E9DB", sub: "#B5A791", accent: "#D8BE9A", accentSoft: "#3D3123", border: "#3A2F22" },
  },
  cool: {
    label: "سرد",
    swatch: ["#CFE0E8", "#7FA6BC", "#2F5E78"],
    light: { bg: "#EFF5F8", surface: "#FFFFFF", surface2: "#E1EDF2", text: "#132430", sub: "#5D7A87", accent: "#2F6680", accentSoft: "#CFE3EC", border: "#D6E6EC" },
    dark:  { bg: "#0F1A20", surface: "#182530", surface2: "#1F2F3B", text: "#E7F1F6", sub: "#8DACBB", accent: "#68A7C4", accentSoft: "#28414F", border: "#25404D" },
  },
  warm: {
    label: "گرم",
    swatch: ["#F1D9BE", "#D9A26E", "#A85D34"],
    light: { bg: "#FBF2E6", surface: "#FFFFFF", surface2: "#F3E2CB", text: "#2E1F12", sub: "#8C6E51", accent: "#A85D34", accentSoft: "#EED4B4", border: "#EEDCC0" },
    dark:  { bg: "#1E140C", surface: "#291C11", surface2: "#332415", text: "#F6E7D3", sub: "#C4A280", accent: "#E28B54", accentSoft: "#40291A", border: "#3D2818" },
  },
};

const FONT_IMPORT = "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;900&display=swap";

/* ------------------------------------------------------------------ */
/*  دسته‌های پیش‌فرض                                                    */
/* ------------------------------------------------------------------ */
const DEFAULT_CATEGORIES = [
  { name: "رنگ روغن", icon: "Paintbrush", hue: "#A85D34" },
  { name: "آبرنگ", icon: "Droplet", hue: "#2F6680" },
  { name: "اکریلیک", icon: "PaintBucket", hue: "#3E7C5C" },
  { name: "طراحی", icon: "Pencil", hue: "#5C5347" },
  { name: "مداد رنگی", icon: "Pencil", hue: "#C1701F" },
  { name: "پاستل", icon: "Brush", hue: "#A85A80" },
  { name: "مرکب", icon: "Feather", hue: "#2B2823" },
  { name: "هنر دیجیتال", icon: "Monitor", hue: "#5E4B93" },
  { name: "سبک‌های کلاسیک", icon: "Landmark", hue: "#8A6423" },
  { name: "سبک‌های مدرن", icon: "Shapes", hue: "#286B6B" },
];

const ICONS = { Paintbrush, Droplet, PaintBucket, Pencil, Brush, Feather, Monitor, Landmark, Shapes };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

import { storageGet, storageSet, storageDelete, storageList } from "./storage.js";

/* فشرده‌سازی تصویر آپلودی روی canvas تا حجم storage معقول بماند */
function compressImage(file, maxDim = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("فایل تصویری معتبر نیست"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
        else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), ratio: +(width / height).toFixed(3) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* اندازه‌گیری نسبت ابعاد تصویر از روی URL — فقط عرض/ارتفاع لازم است، نه پیکسل، پس نیازی به CORS نیست */
function measureRatio(url) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const done = (v) => { clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => done(1), 5000);
    img.onload = () => done(+(img.naturalWidth / img.naturalHeight).toFixed(3) || 1);
    img.onerror = () => done(1);
    img.src = url;
  });
}

/* ================================================================== */
/*  اپلیکیشن اصلی                                                       */
/* ================================================================== */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ dark: false, palette: "neutral" });
  const [nodes, setNodes] = useState([]);        // دسته‌ها و پوشه‌ها (درخت اصلی)
  const [favNodes, setFavNodes] = useState([]);  // پوشه‌های علاقه‌مندی (درخت مستقل)
  const [images, setImages] = useState([]);      // { id, folderId, favFolderIds:[], src, ratio, favorite }

  const [tab, setTab] = useState("dashboard");   // dashboard | favorites | settings
  const [stack, setStack] = useState([]);        // مسیر ناوبری (آرایه‌ای از node id)
  const [favStack, setFavStack] = useState([]);
  const [selection, setSelection] = useState(new Set());
  const [selecting, setSelecting] = useState(false);
  const [modal, setModal] = useState(null);      // { type, ...payload }
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);

  const pal = PALETTES[settings.palette][settings.dark ? "dark" : "light"];

  /* ---------------- بارگذاری اولیه از storage ---------------- */
  useEffect(() => {
    (async () => {
      const meta = await storageGet("gallery-meta");
      if (meta) {
        try {
          const parsed = JSON.parse(meta);
          setSettings(parsed.settings || { dark: false, palette: "neutral" });
          setNodes(parsed.nodes || []);
          setFavNodes(parsed.favNodes || []);
        } catch { /* ignore corrupt data */ }
      } else {
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          id: uid(), name: c.name, icon: c.icon, hue: c.hue, parentId: null, type: "category",
        }));
        setNodes(seeded);
      }
      const imgKeys = await storageList("gallery-image:");
      const loadedImages = [];
      for (const k of imgKeys) {
        const v = await storageGet(k);
        if (v) { try { loadedImages.push(JSON.parse(v)); } catch {} }
      }
      setImages(loadedImages);
      setLoading(false);
    })();
  }, []);

  /* ---------------- ذخیره‌سازی متادیتا با هر تغییر ساختاری ---------------- */
  const persistMeta = useCallback((nextNodes, nextFavNodes, nextSettings) => {
    storageSet("gallery-meta", JSON.stringify({ nodes: nextNodes, favNodes: nextFavNodes, settings: nextSettings }));
  }, []);
  useEffect(() => { if (!loading) persistMeta(nodes, favNodes, settings); }, [nodes, favNodes, settings, loading, persistMeta]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  /* ================= عملیات پوشه‌ها (درخت اصلی) ================= */
  const currentNodeId = stack[stack.length - 1] || null;
  const currentNode = nodes.find(n => n.id === currentNodeId) || null;
  const children = nodes.filter(n => n.parentId === currentNodeId);
  const currentImages = currentNodeId ? images.filter(i => i.folderId === currentNodeId) : [];

  function addFolder(name, parentId, isFav = false) {
    const list = isFav ? favNodes : nodes;
    const setList = isFav ? setFavNodes : setNodes;
    const exists = list.some(n => n.parentId === parentId && n.name.trim() === name.trim());
    if (exists) { showToast("پوشه‌ای با این نام از قبل وجود دارد"); return; }
    setList([...list, { id: uid(), name: name.trim(), parentId, type: "folder", icon: null, hue: pal.accent }]);
  }
  function renameNode(id, name, isFav = false) {
    const setList = isFav ? setFavNodes : setNodes;
    const list = isFav ? favNodes : nodes;
    setList(list.map(n => n.id === id ? { ...n, name: name.trim() } : n));
  }
  function deleteNode(id, isFav = false) {
    const list = isFav ? favNodes : nodes;
    const setList = isFav ? setFavNodes : setNodes;
    const toRemove = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      list.forEach(n => { if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) { toRemove.add(n.id); grew = true; } });
    }
    setList(list.filter(n => !toRemove.has(n.id)));
    if (!isFav) {
      const remaining = images.filter(i => !toRemove.has(i.folderId));
      const removedImgs = images.filter(i => toRemove.has(i.folderId));
      removedImgs.forEach(i => storageDelete("gallery-image:" + i.id));
      setImages(remaining);
    }
  }

  /* ================= عملیات تصاویر ================= */
  async function handleUpload(fileList) {
    if (!currentNode) { showToast("ابتدا یک پوشه را باز کنید"); return; }
    const files = Array.from(fileList).slice(0, 12);
    showToast("در حال افزودن تصویر…");
    for (const f of files) {
      try {
        const { dataUrl, ratio } = await compressImage(f);
        const img = { id: uid(), folderId: currentNode.id, favFolderIds: [], src: dataUrl, ratio, favorite: false, createdAt: Date.now() };
        setImages(prev => [...prev, img]);
        storageSet("gallery-image:" + img.id, JSON.stringify(img));
      } catch (e) { showToast("خطا در پردازش یک تصویر"); }
    }
    showToast("تصاویر افزوده شد");
  }
  async function handleAddByUrl(text) {
    if (!currentNode) { showToast("ابتدا یک پوشه را باز کنید"); return; }
    const urls = text.split(/[\n,]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s)).slice(0, 12);
    if (!urls.length) { showToast("لینک معتبری پیدا نشد"); return; }
    showToast("در حال افزودن…");
    for (const url of urls) {
      const ratio = await measureRatio(url);
      const img = { id: uid(), folderId: currentNode.id, favFolderIds: [], src: url, ratio, favorite: false, createdAt: Date.now() };
      setImages(prev => [...prev, img]);
      storageSet("gallery-image:" + img.id, JSON.stringify(img));
    }
    showToast("تصاویر افزوده شد");
  }
  function toggleFavorite(imageId) {
    setImages(prev => prev.map(i => {
      if (i.id !== imageId) return i;
      const next = { ...i, favorite: !i.favorite };
      storageSet("gallery-image:" + i.id, JSON.stringify(next));
      return next;
    }));
  }
  function addSelectionToFavFolder(favFolderId) {
    setImages(prev => prev.map(i => {
      if (!selection.has(i.id)) return i;
      const next = { ...i, favorite: true, favFolderIds: Array.from(new Set([...(i.favFolderIds || []), favFolderId])) };
      storageSet("gallery-image:" + i.id, JSON.stringify(next));
      return next;
    }));
    showToast("به مجموعه افزوده شد");
    exitSelection();
  }
  function deleteSelection() {
    selection.forEach(id => storageDelete("gallery-image:" + id));
    setImages(prev => prev.filter(i => !selection.has(i.id)));
    exitSelection();
  }
  function deleteSingleImage(id) {
    storageDelete("gallery-image:" + id);
    setImages(prev => prev.filter(i => i.id !== id));
  }
  function updateImageEdit(id, newSrc, newRatio) {
    setImages(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = { ...i, src: newSrc, ratio: newRatio };
      storageSet("gallery-image:" + i.id, JSON.stringify(next));
      return next;
    }));
  }
  async function shareSingleImage(img) {
    try {
      if (!navigator.share) { showToast("اشتراک‌گذاری مستقیم روی این دستگاه پشتیبانی نمی‌شود"); return; }
      try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const file = new File([blob], "painting.jpg", { type: blob.type || "image/jpeg" });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "تصویر گالری نقاشی" });
            return;
          }
        }
      } catch { /* لینک خارجی ممکن است به‌خاطر CORS قابل تبدیل به فایل نباشد */ }
      await navigator.share({ title: "تصویر گالری نقاشی", url: /^https?:\/\//i.test(img.src) ? img.src : undefined });
    } catch { /* کاربر لغو کرد */ }
  }
  async function shareSelection() {
    const items = images.filter(i => selection.has(i.id));
    try {
      if (navigator.share) {
        const files = await Promise.all(items.map(async (it, idx) => {
          const res = await fetch(it.src);
          const blob = await res.blob();
          return new File([blob], `painting-${idx + 1}.jpg`, { type: "image/jpeg" });
        }));
        await navigator.share({ files, title: "تصاویر گالری نقاشی" });
      } else {
        showToast("اشتراک‌گذاری مستقیم روی این دستگاه پشتیبانی نمی‌شود");
      }
    } catch { /* کاربر لغو کرد یا خطا رخ داد */ }
    exitSelection();
  }
  function moveSelectionTo(folderId) {
    setImages(prev => prev.map(i => {
      if (!selection.has(i.id)) return i;
      const next = { ...i, folderId };
      storageSet("gallery-image:" + i.id, JSON.stringify(next));
      return next;
    }));
    showToast("جابه‌جا شد");
    exitSelection();
  }
  function exitSelection() { setSelection(new Set()); setSelecting(false); }
  function toggleSelect(id) {
    setSelection(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  /* ================= مسیر (breadcrumb) ================= */
  const breadcrumb = stack.map(id => nodes.find(n => n.id === id)).filter(Boolean);
  const viewingImage = modal?.type === "viewImage" ? images.find(i => i.id === modal.id) : null;
  const favBreadcrumb = favStack.map(id => favNodes.find(n => n.id === id)).filter(Boolean);

  const filteredCategories = nodes.filter(n => n.parentId === null && (!query || n.name.includes(query)));

  /* ================================================================ */
  /*  رندر                                                             */
  /* ================================================================ */
  if (loading) {
    return (
      <div style={{ background: pal.bg, color: pal.text }} className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ background: pal.bg, color: pal.text, fontFamily: "'Vazirmatn', sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('${FONT_IMPORT}');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        .press:active { transform: scale(0.97); }
        .fade-in { animation: fadeIn .25s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity:1; transform:none; } }
      `}</style>

      <div style={{ maxWidth: 430, margin: "0 auto", position: "relative", paddingBottom: 92 }}>

        {/* ---------------- بالای صفحه ---------------- */}
        <TopBar
          pal={pal}
          tab={tab}
          breadcrumb={tab === "dashboard" ? breadcrumb : favBreadcrumb}
          onBack={() => tab === "dashboard" ? setStack(s => s.slice(0, -1)) : setFavStack(s => s.slice(0, -1))}
          title={
            tab === "settings" ? "تنظیمات" :
            tab === "favorites" ? (favBreadcrumb.length ? favBreadcrumb[favBreadcrumb.length - 1].name : "علاقه‌مندی‌ها") :
            (breadcrumb.length ? breadcrumb[breadcrumb.length - 1].name : "گالری نقاشی")
          }
        />

        {/* ---------------- جستجو ---------------- */}
        {(tab === "dashboard" || tab === "favorites") && (
          <div style={{ padding: "0 18px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: pal.surface2, borderRadius: 14, padding: "10px 14px" }}>
              <Search size={16} color={pal.sub} />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="جستجوی تکنیک، سبک یا پوشه…"
                style={{ background: "transparent", border: "none", outline: "none", color: pal.text, fontFamily: "inherit", fontSize: 14, width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* ---------------- محتوای اصلی ---------------- */}
        <div className="fade-in" style={{ padding: "4px 18px 24px" }}>
          {tab === "dashboard" && !currentNode && (
            <CategoryGrid pal={pal} categories={filteredCategories}
              onOpen={(id) => setStack([id])}
              onRename={(n) => setModal({ type: "rename", id: n.id, name: n.name })}
              onDelete={(n) => setModal({ type: "confirmDelete", id: n.id, name: n.name })}
              onCreate={() => setModal({ type: "create", parentId: null })}
            />
          )}

          {tab === "dashboard" && currentNode && (
            <FolderView
              pal={pal}
              node={currentNode}
              children={children.filter(n => !query || n.name.includes(query))}
              images={currentImages}
              query={query}
              selecting={selecting} selection={selection}
              onOpenChild={(id) => setStack(s => [...s, id])}
              onRename={(n) => setModal({ type: "rename", id: n.id, name: n.name })}
              onDelete={(n) => setModal({ type: "confirmDelete", id: n.id, name: n.name })}
              onCreateSub={() => setModal({ type: "create", parentId: currentNode.id })}
              onToggleFav={toggleFavorite}
              onLongPressImage={(id) => { setSelecting(true); toggleSelect(id); }}
              onSelectImage={(id) => selecting ? toggleSelect(id) : setModal({ type: "viewImage", id })}
              onAddByUrl={() => setModal({ type: "addUrl" })}
            />
          )}

          {tab === "favorites" && !favBreadcrumb.length && (
            <FavoritesRoot
              pal={pal} favNodes={favNodes} images={images}
              onOpen={(id) => setFavStack([id])}
              onOpenAll={() => setModal({ type: "allFavorites" })}
              onCreate={() => setModal({ type: "createFav", parentId: null })}
              onRename={(n) => setModal({ type: "renameFav", id: n.id, name: n.name })}
              onDelete={(n) => setModal({ type: "confirmDeleteFav", id: n.id, name: n.name })}
            />
          )}

          {tab === "favorites" && favBreadcrumb.length > 0 && (
            <FavFolderView
              pal={pal}
              node={favBreadcrumb[favBreadcrumb.length - 1]}
              children={favNodes.filter(n => n.parentId === favBreadcrumb[favBreadcrumb.length - 1].id)}
              images={images.filter(i => (i.favFolderIds || []).includes(favBreadcrumb[favBreadcrumb.length - 1].id))}
              onOpenChild={(id) => setFavStack(s => [...s, id])}
              onCreateSub={() => setModal({ type: "createFav", parentId: favBreadcrumb[favBreadcrumb.length - 1].id })}
              onRename={(n) => setModal({ type: "renameFav", id: n.id, name: n.name })}
              onDelete={(n) => setModal({ type: "confirmDeleteFav", id: n.id, name: n.name })}
              selecting={selecting} selection={selection}
              onLongPressImage={(id) => { setSelecting(true); toggleSelect(id); }}
              onSelectImage={(id) => selecting ? toggleSelect(id) : setModal({ type: "viewImage", id })}
            />
          )}

          {tab === "settings" && (
            <SettingsView pal={pal} settings={settings} setSettings={setSettings}
              onReset={() => setModal({ type: "confirmReset" })}
            />
          )}
        </div>

        {/* ---------------- نوار پایین ---------------- */}
        {!selecting && (
          <BottomNav pal={pal} tab={tab} setTab={(t) => { setTab(t); setQuery(""); }}
            canUpload={!!currentNode}
            onSwitchToFolder={() => setTab("dashboard")}
            onBlockedUpload={() => showToast("ابتدا یک پوشه را باز کنید")}
          />
        )}

        {/* ---------------- نوار انتخاب چندگانه ---------------- */}
        {selecting && (
          <SelectionBar pal={pal} count={selection.size}
            onCancel={exitSelection}
            onShare={shareSelection}
            onFavorite={() => setModal({ type: "pickFavForSelection" })}
            onMove={() => setModal({ type: "pickFolderForSelection" })}
            onDelete={deleteSelection}
          />
        )}

        {/* input فایل مخفی — با label به آن وصل می‌شویم، نه با ref.click() برنامه‌نویسی‌شده */}
        <input id="gallery-file-input" type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />

        {/* ---------------- toast ---------------- */}
        {toast && (
          <div style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", background: pal.text, color: pal.bg, padding: "9px 18px", borderRadius: 20, fontSize: 13, zIndex: 60 }}>
            {toast}
          </div>
        )}

        {/* ---------------- نمای تمام‌صفحه تصویر ---------------- */}
        {modal && modal.type === "viewImage" && viewingImage && (
          <ImageViewer
            pal={pal}
            image={viewingImage}
            onClose={() => setModal(null)}
            onToggleFavorite={toggleFavorite}
            onDelete={deleteSingleImage}
            onShare={shareSingleImage}
            onSaveEdit={(newSrc, newRatio) => updateImageEdit(viewingImage.id, newSrc, newRatio)}
            showToast={showToast}
          />
        )}

        {/* ---------------- مودال‌ها ---------------- */}
        {modal && modal.type !== "viewImage" && (
          <ModalHost
            modal={modal} pal={pal} nodes={nodes} favNodes={favNodes} images={images}
            onClose={() => setModal(null)}
            onSubmitCreate={(name) => { addFolder(name, modal.parentId, false); setModal(null); }}
            onSubmitCreateFav={(name) => { addFolder(name, modal.parentId, true); setModal(null); }}
            onSubmitRename={(name) => { renameNode(modal.id, name, false); setModal(null); }}
            onSubmitRenameFav={(name) => { renameNode(modal.id, name, true); setModal(null); }}
            onConfirmDelete={() => { deleteNode(modal.id, false); setModal(null); if (currentNodeId === modal.id) setStack(s => s.slice(0, -1)); }}
            onConfirmDeleteFav={() => { deleteNode(modal.id, true); setModal(null); }}
            onConfirmReset={async () => {
              const keys = await storageList("gallery-image:");
              for (const k of keys) await storageDelete(k);
              await storageDelete("gallery-meta");
              const seeded = DEFAULT_CATEGORIES.map(c => ({ id: uid(), name: c.name, icon: c.icon, hue: c.hue, parentId: null, type: "category" }));
              setNodes(seeded); setFavNodes([]); setImages([]); setStack([]); setFavStack([]);
              setModal(null); showToast("داده‌ها بازنشانی شد");
            }}
            onPickFavForSelection={(favId) => addSelectionToFavFolder(favId)}
            onPickFolderForSelection={(folderId) => moveSelectionTo(folderId)}
            onSubmitAddUrl={(text) => { handleAddByUrl(text); setModal(null); }}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  بالای صفحه                                                          */
/* ================================================================== */
function TopBar({ pal, breadcrumb, onBack, title }) {
  const showBack = breadcrumb.length > 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 18px 12px" }}>
      {showBack && (
        <button onClick={onBack} className="press" style={{ background: pal.surface2, border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronRight size={18} color={pal.text} />
        </button>
      )}
      <h1 style={{ fontSize: showBack ? 19 : 23, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{title}</h1>
    </div>
  );
}

/* ================================================================== */
/*  گرید دسته‌های اصلی (Dashboard)                                      */
/* ================================================================== */
function CategoryGrid({ pal, categories, onOpen, onRename, onDelete, onCreate }) {
  const [menuFor, setMenuFor] = useState(null);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {categories.map(cat => {
          const Icon = ICONS[cat.icon] || Shapes;
          return (
            <div key={cat.id} style={{ position: "relative" }}>
              <button onClick={() => onOpen(cat.id)} className="press"
                style={{ width: "100%", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 16, padding: "18px 8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: (cat.hue || pal.accent) + "2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={19} color={cat.hue || pal.accent} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: "center", lineHeight: 1.3, color: pal.text }}>{cat.name}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === cat.id ? null : cat.id); }}
                style={{ position: "absolute", top: 4, left: 4, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                <MoreVertical size={13} color={pal.sub} />
              </button>
              {menuFor === cat.id && (
                <MiniMenu pal={pal} onClose={() => setMenuFor(null)}
                  items={[
                    { label: "تغییر نام", onClick: () => { onRename(cat); setMenuFor(null); } },
                    { label: "حذف", danger: true, onClick: () => { onDelete(cat); setMenuFor(null); } },
                  ]} />
              )}
            </div>
          );
        })}
      </div>
      <button onClick={onCreate} className="press"
        style={{ marginTop: 14, width: "100%", background: pal.surface2, border: "none", borderRadius: 14, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: pal.text, fontWeight: 600, fontSize: 13.5 }}>
        <FolderPlus size={16} /> ساخت دسته جدید
      </button>
    </>
  );
}

/* ================================================================== */
/*  نمای پوشه (لیست زیرپوشه‌ها + گالری تصاویر)                          */
/* ================================================================== */
function FolderView({ pal, node, children, images, selecting, selection, onOpenChild, onRename, onDelete, onCreateSub, onToggleFav, onLongPressImage, onSelectImage, onAddByUrl }) {
  const [menuFor, setMenuFor] = useState(null);
  const hasChildren = children.length > 0;
  const hasImages = images.length > 0;

  return (
    <div>
      {hasChildren && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: hasImages ? 20 : 0 }}>
          {children.map(child => (
            <div key={child.id} style={{ position: "relative", display: "flex", alignItems: "center", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 14, padding: "13px 14px" }}>
              <button onClick={() => onOpenChild(child.id)} className="press" style={{ flex: 1, background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "right" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: pal.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FolderPlusMini color={pal.accent} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: pal.text }}>{child.name}</span>
              </button>
              <ChevronRight size={16} color={pal.sub} style={{ transform: "rotate(180deg)" }} />
              <button onClick={() => setMenuFor(menuFor === child.id ? null : child.id)} style={{ background: "transparent", border: "none", cursor: "pointer", marginRight: 6, padding: 4 }}>
                <MoreVertical size={15} color={pal.sub} />
              </button>
              {menuFor === child.id && (
                <MiniMenu pal={pal} onClose={() => setMenuFor(null)} style={{ top: 40, left: 6 }}
                  items={[
                    { label: "تغییر نام", onClick: () => { onRename(child); setMenuFor(null); } },
                    { label: "حذف", danger: true, onClick: () => { onDelete(child); setMenuFor(null); } },
                  ]} />
              )}
            </div>
          ))}
        </div>
      )}

      {hasImages && (
        <MasonryGrid pal={pal} images={images} selecting={selecting} selection={selection}
          onLongPress={onLongPressImage} onSelect={onSelectImage} onToggleFav={onToggleFav} />
      )}

      {!hasChildren && !hasImages && (
        <EmptyState pal={pal} text="این پوشه هنوز خالی است" sub="یک زیرپوشه بساز یا تصویری اضافه کن" />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCreateSub} className="press"
          style={{ flex: 1, background: pal.surface2, border: "none", borderRadius: 14, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: pal.text, fontWeight: 600, fontSize: 13 }}>
          <FolderPlus size={15} /> زیرپوشه جدید
        </button>
        <label htmlFor="gallery-file-input" className="press"
          style={{ flex: 1, background: pal.accent, border: "none", borderRadius: 14, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#fff", fontWeight: 600, fontSize: 13 }}>
          <Upload size={15} /> افزودن تصویر
        </label>
      </div>
      <button onClick={onAddByUrl} className="press"
        style={{ marginTop: 8, width: "100%", background: "transparent", border: "none", padding: "6px", cursor: "pointer", color: pal.sub, fontWeight: 600, fontSize: 12, textDecoration: "underline" }}>
        اگر دکمه بالا فایل باز نکرد، افزودن با لینک تصویر
      </button>
    </div>
  );
}

function FolderPlusMini({ color }) { return <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />; }

/* ================================================================== */
/*  گرید ماسونری تصاویر                                                 */
/* ================================================================== */
/* توزیع تصاویر بین ستون‌ها: هر تصویر به کوتاه‌ترین ستون می‌رود تا فضای خالی نماند (دقیقاً منطق پینترست) */
function distributeMasonry(images, columnCount) {
  const colHeights = new Array(columnCount).fill(0);
  const columns = Array.from({ length: columnCount }, () => []);
  images.forEach(img => {
    const relHeight = 1 / (img.ratio || 1);
    let minIdx = 0;
    for (let i = 1; i < columnCount; i++) if (colHeights[i] < colHeights[minIdx]) minIdx = i;
    columns[minIdx].push(img);
    colHeights[minIdx] += relHeight;
  });
  return columns;
}

function MasonryGrid({ pal, images, selecting, selection, onLongPress, onSelect, onToggleFav, columnCount = 2 }) {
  const pressTimer = useRef(null);
  const columns = distributeMasonry(images, columnCount);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {columns.map((col, ci) => (
        <div key={ci} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {col.map(img => {
            const selected = selection.has(img.id);
            return (
              <div key={img.id} style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: `1px solid ${pal.border}` }}
                onMouseDown={() => { pressTimer.current = setTimeout(() => onLongPress(img.id), 420); }}
                onMouseUp={() => clearTimeout(pressTimer.current)}
                onMouseLeave={() => clearTimeout(pressTimer.current)}
                onTouchStart={() => { pressTimer.current = setTimeout(() => onLongPress(img.id), 420); }}
                onTouchEnd={() => clearTimeout(pressTimer.current)}
                onClick={() => onSelect(img.id)}
              >
                <img src={img.src} alt="" style={{ width: "100%", display: "block", aspectRatio: img.ratio || 1, objectFit: "cover", filter: selecting && !selected ? "brightness(0.7)" : "none" }} />
                {!selecting && (
                  <button onClick={(e) => { e.stopPropagation(); onToggleFav(img.id); }}
                    style={{ position: "absolute", top: 7, left: 7, background: "rgba(0,0,0,0.35)", border: "none", borderRadius: 999, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Heart size={13} fill={img.favorite ? "#e2685f" : "none"} color={img.favorite ? "#e2685f" : "#fff"} />
                  </button>
                )}
                {selecting && (
                  <div style={{ position: "absolute", top: 7, left: 7, width: 22, height: 22, borderRadius: 999, border: "2px solid #fff", background: selected ? pal.accent : "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {selected && <Check size={13} color="#fff" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  علاقه‌مندی‌ها                                                        */
/* ================================================================== */
function FavoritesRoot({ pal, favNodes, images, onOpen, onOpenAll, onCreate, onRename, onDelete }) {
  const [menuFor, setMenuFor] = useState(null);
  const roots = favNodes.filter(n => n.parentId === null);
  const allFavCount = images.filter(i => i.favorite).length;
  return (
    <div>
      <button onClick={onOpenAll} className="press"
        style={{ width: "100%", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}>
        <Heart size={16} color="#e2685f" fill="#e2685f" />
        <span style={{ fontSize: 14, fontWeight: 700, color: pal.text, flex: 1, textAlign: "right" }}>همه علاقه‌مندی‌ها</span>
        <span style={{ fontSize: 12, color: pal.sub }}>{allFavCount}</span>
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {roots.map(f => (
          <div key={f.id} style={{ position: "relative", display: "flex", alignItems: "center", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 14, padding: "13px 14px" }}>
            <button onClick={() => onOpen(f.id)} className="press" style={{ flex: 1, background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "right" }}>
              <FolderHeart size={17} color={pal.accent} />
              <span style={{ fontSize: 14, fontWeight: 600, color: pal.text }}>{f.name}</span>
            </button>
            <button onClick={() => setMenuFor(menuFor === f.id ? null : f.id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
              <MoreVertical size={15} color={pal.sub} />
            </button>
            {menuFor === f.id && (
              <MiniMenu pal={pal} onClose={() => setMenuFor(null)} style={{ top: 40, left: 6 }}
                items={[
                  { label: "تغییر نام", onClick: () => { onRename(f); setMenuFor(null); } },
                  { label: "حذف", danger: true, onClick: () => { onDelete(f); setMenuFor(null); } },
                ]} />
            )}
          </div>
        ))}
      </div>

      {roots.length === 0 && <EmptyState pal={pal} text="هنوز مجموعه‌ای نساخته‌ای" sub="برای دسته‌بندی الهام‌ها یک مجموعه بساز" />}

      <button onClick={onCreate} className="press"
        style={{ marginTop: 16, width: "100%", background: pal.surface2, border: "none", borderRadius: 14, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: pal.text, fontWeight: 600, fontSize: 13.5 }}>
        <Plus size={16} /> مجموعه علاقه‌مندی جدید
      </button>
    </div>
  );
}

function FavFolderView({ pal, node, children, images, onOpenChild, onCreateSub, onRename, onDelete, selecting, selection, onLongPressImage, onSelectImage }) {
  const [menuFor, setMenuFor] = useState(null);
  return (
    <div>
      {children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: images.length ? 20 : 0 }}>
          {children.map(child => (
            <div key={child.id} style={{ position: "relative", display: "flex", alignItems: "center", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 14, padding: "13px 14px" }}>
              <button onClick={() => onOpenChild(child.id)} className="press" style={{ flex: 1, background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "right" }}>
                <FolderHeart size={17} color={pal.accent} />
                <span style={{ fontSize: 14, fontWeight: 600, color: pal.text }}>{child.name}</span>
              </button>
              <button onClick={() => setMenuFor(menuFor === child.id ? null : child.id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                <MoreVertical size={15} color={pal.sub} />
              </button>
              {menuFor === child.id && (
                <MiniMenu pal={pal} onClose={() => setMenuFor(null)} style={{ top: 40, left: 6 }}
                  items={[
                    { label: "تغییر نام", onClick: () => { onRename(child); setMenuFor(null); } },
                    { label: "حذف", danger: true, onClick: () => { onDelete(child); setMenuFor(null); } },
                  ]} />
              )}
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <MasonryGrid pal={pal} images={images} selecting={selecting} selection={selection}
          onLongPress={onLongPressImage} onSelect={onSelectImage} onToggleFav={() => {}} />
      )}
      {children.length === 0 && images.length === 0 && (
        <EmptyState pal={pal} text="این مجموعه خالی است" sub="از گالری، تصاویر را انتخاب و به این مجموعه اضافه کن" />
      )}
      <button onClick={onCreateSub} className="press"
        style={{ marginTop: 16, width: "100%", background: pal.surface2, border: "none", borderRadius: 14, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: pal.text, fontWeight: 600, fontSize: 13 }}>
        <FolderPlus size={15} /> زیرمجموعه جدید
      </button>
    </div>
  );
}

/* ================================================================== */
/*  تنظیمات                                                             */
/* ================================================================== */
function SettingsView({ pal, settings, setSettings }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section>
        <SectionLabel pal={pal} text="حالت نمایش" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {settings.dark ? <Moon size={17} color={pal.accent} /> : <Sun size={17} color={pal.accent} />}
            <span style={{ fontSize: 14, fontWeight: 600 }}>حالت شب</span>
          </div>
          <ToggleSwitch pal={pal} checked={settings.dark} onChange={(v) => setSettings(s => ({ ...s, dark: v }))} />
        </div>
      </section>

      <section>
        <SectionLabel pal={pal} text="پوسته رنگی" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(PALETTES).map(([key, p]) => (
            <button key={key} onClick={() => setSettings(s => ({ ...s, palette: key }))} className="press"
              style={{ display: "flex", alignItems: "center", gap: 12, background: pal.surface, border: `1.5px solid ${settings.palette === key ? pal.accent : pal.border}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}>
              <div style={{ display: "flex" }}>
                {p.swatch.map((c, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: c, marginRight: i === 0 ? 0 : -7, border: "2px solid " + pal.surface }} />
                ))}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textAlign: "right", color: pal.text }}>رنگ‌های {p.label}</span>
              {settings.palette === key && <Check size={16} color={pal.accent} />}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: pal.sub, marginTop: 8, lineHeight: 1.7 }}>
          پوسته روی هر دو حالت روشن و شب اعمال می‌شود؛ رنگ‌ها کم‌رنگ و آرام طراحی شده‌اند تا تمرکز روی تصاویر بماند.
        </p>
      </section>
    </div>
  );
}

function ToggleSwitch({ pal, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className="press"
      style={{ width: 44, height: 26, borderRadius: 999, background: checked ? pal.accent : pal.border, border: "none", cursor: "pointer", position: "relative", transition: "background .2s" }}>
      <div style={{ position: "absolute", top: 3, right: checked ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "right .2s" }} />
    </button>
  );
}
function SectionLabel({ pal, text }) { return <div style={{ fontSize: 12, fontWeight: 700, color: pal.sub, marginBottom: 8 }}>{text}</div>; }

/* ================================================================== */
/*  نوار پایین و نوار انتخاب                                            */
/* ================================================================== */
function BottomNav({ pal, tab, setTab, canUpload, onSwitchToFolder, onBlockedUpload }) {
  const items = [
    { key: "dashboard", label: "داشبورد", icon: Home },
    { key: "favorites", label: "علاقه‌مندی", icon: Heart },
    { key: "upload", label: "افزودن", icon: Upload },
    { key: "settings", label: "تنظیمات", icon: SettingsIcon },
  ];
  const itemStyle = { flex: 1, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 };
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: pal.surface, borderTop: `1px solid ${pal.border}`, display: "flex", padding: "10px 6px 18px" }}>
      {items.map(it => {
        const Icon = it.icon;
        const active = tab === it.key;
        const color = active ? pal.accent : pal.sub;
        if (it.key === "upload") {
          return canUpload ? (
            <label key={it.key} htmlFor="gallery-file-input" onClick={onSwitchToFolder} className="press"
              style={{ ...itemStyle, color }}>
              <Icon size={19} />
              <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.label}</span>
            </label>
          ) : (
            <button key={it.key} onClick={onBlockedUpload} className="press" style={{ ...itemStyle, color }}>
              <Icon size={19} />
              <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.label}</span>
            </button>
          );
        }
        return (
          <button key={it.key} onClick={() => setTab(it.key)} className="press" style={{ ...itemStyle, color }}>
            <Icon size={19} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SelectionBar({ pal, count, onCancel, onShare, onFavorite, onMove, onDelete }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: pal.surface, borderTop: `1px solid ${pal.border}`, display: "flex", alignItems: "center", padding: "12px 14px 22px", gap: 6 }}>
      <button onClick={onCancel} style={{ background: "transparent", border: "none", cursor: "pointer", marginLeft: 4 }}>
        <X size={19} color={pal.text} />
      </button>
      <span style={{ fontSize: 12.5, color: pal.sub, marginleft: 6, whiteSpace: "nowrap" }}>{count} انتخاب</span>
      <div style={{ flex: 1 }} />
      <IconAction pal={pal} icon={Heart} label="علاقه" onClick={onFavorite} disabled={!count} />
      <IconAction pal={pal} icon={ArrowRight} label="جابه‌جا" onClick={onMove} disabled={!count} />
      <IconAction pal={pal} icon={Share2} label="اشتراک" onClick={onShare} disabled={!count} />
      <IconAction pal={pal} icon={Trash2} label="حذف" onClick={onDelete} disabled={!count} danger />
    </div>
  );
}
function IconAction({ pal, icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button onClick={onClick} disabled={disabled} className="press"
      style={{ background: "transparent", border: "none", cursor: disabled ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: disabled ? 0.35 : 1, padding: "0 8px" }}>
      <Icon size={18} color={danger ? "#c0554c" : pal.text} />
      <span style={{ fontSize: 9.5, color: pal.sub }}>{label}</span>
    </button>
  );
}

/* ================================================================== */
/*  اجزای عمومی: منو، حالت خالی                                         */
/* ================================================================== */
function MiniMenu({ pal, items, onClose, style }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div style={{ position: "absolute", zIndex: 50, background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 130, ...(style || { top: 26, left: 4 }) }}>
        {items.map((it, idx) => (
          <button key={idx} onClick={it.onClick} className="press"
            style={{ display: "block", width: "100%", textAlign: "right", background: "transparent", border: "none", padding: "10px 14px", fontSize: 13, cursor: "pointer", color: it.danger ? "#c0554c" : pal.text, fontFamily: "inherit" }}>
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}
function EmptyState({ pal, text, sub }) {
  return (
    <div style={{ padding: "40px 10px", textAlign: "center", color: pal.sub }}>
      <ImageIcon size={26} style={{ marginBottom: 10, opacity: 0.5 }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: pal.text }}>{text}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

/* ================================================================== */
/*  میزبان مودال‌ها                                                     */
/* ================================================================== */
function ModalHost({ modal, pal, nodes, favNodes, images, onClose, onSubmitCreate, onSubmitCreateFav, onSubmitRename, onSubmitRenameFav, onConfirmDelete, onConfirmDeleteFav, onConfirmReset, onPickFavForSelection, onPickFolderForSelection, onSubmitAddUrl }) {
  const [text, setText] = useState(modal.name || "");
  const isTextModal = ["create", "createFav", "rename", "renameFav"].includes(modal.type);

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 70 };
  const sheet = { width: "100%", maxWidth: 430, background: pal.surface, borderRadius: "20px 20px 0 0", padding: "20px 20px 30px" };

  if (isTextModal) {
    const titleMap = { create: "دسته/پوشه جدید", createFav: "مجموعه جدید", rename: "تغییر نام پوشه", renameFav: "تغییر نام مجموعه" };
    const submit = () => {
      if (!text.trim()) return;
      if (modal.type === "create") onSubmitCreate(text);
      if (modal.type === "createFav") onSubmitCreateFav(text);
      if (modal.type === "rename") onSubmitRename(text);
      if (modal.type === "renameFav") onSubmitRenameFav(text);
    };
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>{titleMap[modal.type]}</h3>
          <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="نام را وارد کن…"
            onKeyDown={e => e.key === "Enter" && submit()}
            style={{ width: "100%", background: pal.surface2, border: `1px solid ${pal.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: pal.text, fontFamily: "inherit", outline: "none" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ flex: 1, background: pal.surface2, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: pal.text }}>انصراف</button>
            <button onClick={submit} style={{ flex: 1, background: pal.accent, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: "#fff" }}>تایید</button>
          </div>
        </div>
      </div>
    );
  }

  if (modal.type === "addUrl") {
    const pasteFromClipboard = async () => {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip) setText(t => (t ? t + "\n" : "") + clip.trim());
      } catch {
        // دسترسی به کلیپ‌بورد رد شد یا در این محیط پشتیبانی نمی‌شود؛ کاربر می‌تواند دستی paste کند
      }
    };
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>افزودن با لینک تصویر</h3>
          <p style={{ fontSize: 12.5, color: pal.sub, margin: "0 0 6px", lineHeight: 1.8 }}>
            یک یا چند لینک تصویر بگذار (هر کدام در یک خط).
          </p>
          <p style={{ fontSize: 11.5, color: pal.sub, margin: "0 0 12px", lineHeight: 1.9, background: pal.surface2, padding: "10px 12px", borderRadius: 10 }}>
            از پینترست: روی تصویر نگه‌دار و «کپی آدرس تصویر» (Copy image address) را بزن — نه لینک صفحه‌ی Pin. لینک درست معمولاً با <b dir="ltr" style={{ fontWeight: 700 }}>pinimg.com</b> شروع می‌شود.
          </p>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="https://i.pinimg.com/....jpg"
            rows={4}
            style={{ width: "100%", background: pal.surface2, border: `1px solid ${pal.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: pal.text, fontFamily: "inherit", outline: "none", resize: "vertical", direction: "ltr", textAlign: "left" }} />
          <button onClick={pasteFromClipboard} className="press"
            style={{ marginTop: 8, background: "transparent", border: `1px dashed ${pal.border}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: pal.accent, fontWeight: 600, fontSize: 12, width: "100%" }}>
            چسباندن از کلیپ‌بورد
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={onClose} style={{ flex: 1, background: pal.surface2, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: pal.text }}>انصراف</button>
            <button onClick={() => onSubmitAddUrl(text)} style={{ flex: 1, background: pal.accent, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: "#fff" }}>افزودن</button>
          </div>
        </div>
      </div>
    );
  }

  if (modal.type === "confirmDelete" || modal.type === "confirmDeleteFav") {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>حذف «{modal.name}»؟</h3>
          <p style={{ fontSize: 13, color: pal.sub, margin: "0 0 16px" }}>تمام زیرپوشه‌ها و تصاویر داخل آن نیز حذف می‌شوند. این کار قابل بازگشت نیست.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, background: pal.surface2, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: pal.text }}>انصراف</button>
            <button onClick={modal.type === "confirmDelete" ? onConfirmDelete : onConfirmDeleteFav} style={{ flex: 1, background: "#c0554c", border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: "#fff" }}>حذف</button>
          </div>
        </div>
      </div>
    );
  }

  if (modal.type === "confirmReset") {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={sheet} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>بازنشانی کامل داده‌ها؟</h3>
          <p style={{ fontSize: 13, color: pal.sub, margin: "0 0 16px" }}>همه پوشه‌ها، مجموعه‌ها و تصاویر آپلودشده حذف می‌شوند.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, background: pal.surface2, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: pal.text }}>انصراف</button>
            <button onClick={onConfirmReset} style={{ flex: 1, background: "#c0554c", border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: "#fff" }}>بازنشانی</button>
          </div>
        </div>
      </div>
    );
  }

  if (modal.type === "allFavorites") {
    const favImgs = images.filter(i => i.favorite);
    return (
      <div style={overlay} onClick={onClose}>
        <div style={{ ...sheet, maxHeight: "75vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>همه علاقه‌مندی‌ها ({favImgs.length})</h3>
          {favImgs.length === 0 ? <EmptyState pal={pal} text="چیزی علاقه‌مند نشده‌ای" sub="روی آیکون قلب هر تصویر بزن" /> : (
            <div style={{ display: "flex", gap: 10 }}>
              {distributeMasonry(favImgs, 2).map((col, ci) => (
                <div key={ci} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.map(img => (
                    <div key={img.id} style={{ borderRadius: 12, overflow: "hidden" }}>
                      <img src={img.src} alt="" style={{ width: "100%", display: "block", aspectRatio: img.ratio || 1, objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <button onClick={onClose} style={{ marginTop: 16, width: "100%", background: pal.surface2, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: pal.text }}>بستن</button>
        </div>
      </div>
    );
  }

  if (modal.type === "pickFavForSelection") {
    const flat = flattenFav(favNodes);
    return (
      <div style={overlay} onClick={onClose}>
        <div style={{ ...sheet, maxHeight: "70vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>افزودن به کدام مجموعه؟</h3>
          {flat.length === 0 && <p style={{ fontSize: 13, color: pal.sub }}>ابتدا از تب علاقه‌مندی یک مجموعه بساز.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {flat.map(n => (
              <button key={n.id} onClick={() => onPickFavForSelection(n.id)} className="press"
                style={{ textAlign: "right", background: pal.surface2, border: "none", borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontSize: 13.5, color: pal.text, fontFamily: "inherit" }}>
                {n.pathLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (modal.type === "pickFolderForSelection") {
    const flat = flattenFolders(nodes);
    return (
      <div style={overlay} onClick={onClose}>
        <div style={{ ...sheet, maxHeight: "70vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>جابه‌جایی به کدام پوشه؟</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {flat.map(n => (
              <button key={n.id} onClick={() => onPickFolderForSelection(n.id)} className="press"
                style={{ textAlign: "right", background: pal.surface2, border: "none", borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontSize: 13.5, color: pal.text, fontFamily: "inherit" }}>
                {n.pathLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function flattenFolders(nodes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const pathOf = (n) => { const p = []; let cur = n; while (cur) { p.unshift(cur.name); cur = cur.parentId ? byId[cur.parentId] : null; } return p.join(" / "); };
  return nodes.map(n => ({ id: n.id, pathLabel: pathOf(n) }));
}
function flattenFav(nodes) { return flattenFolders(nodes); }

/* ================================================================== */
/*  نمای تمام‌صفحه تصویر: اشتراک‌گذاری، کراپ آزاد، حذف، علاقه‌مندی        */
/* ================================================================== */
function ImageViewer({ pal, image, onClose, onToggleFavorite, onDelete, onShare, onSaveEdit, showToast }) {
  const [editing, setEditing] = useState(false);
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState({ w: 300, h: 300 });
  const dragRef = useRef(null);

  useEffect(() => {
    function computeSize() {
      const maxW = Math.min(window.innerWidth, 430) - 32;
      const maxH = window.innerHeight * 0.6;
      const ratio = image.ratio || 1;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      setDims({ w, h });
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, [image.ratio, editing]);

  useEffect(() => {
    function point(e) { return e.touches ? e.touches[0] : e; }
    function onMove(e) {
      if (!dragRef.current) return;
      const p = point(e);
      const dxPct = ((p.clientX - dragRef.current.startX) / dims.w) * 100;
      const dyPct = ((p.clientY - dragRef.current.startY) / dims.h) * 100;
      setCrop(applyDrag(dragRef.current, dxPct, dyPct));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dims]);

  function applyDrag(drag, dxPct, dyPct) {
    const MIN = 8;
    const { x, y, w, h } = drag.startCrop;
    if (drag.type === "move") {
      return { x: clamp(x + dxPct, 0, 100 - w), y: clamp(y + dyPct, 0, 100 - h), w, h };
    }
    const c = drag.corner;
    let nx = x, ny = y, nw = w, nh = h;
    if (c.includes("l")) { nx = clamp(x + dxPct, 0, x + w - MIN); nw = x + w - nx; }
    if (c.includes("r")) { nw = clamp(w + dxPct, MIN, 100 - x); }
    if (c.includes("t")) { ny = clamp(y + dyPct, 0, y + h - MIN); nh = y + h - ny; }
    if (c.includes("b")) { nh = clamp(h + dyPct, MIN, 100 - y); }
    return { x: nx, y: ny, w: nw, h: nh };
  }

  function startDrag(type, corner, e) {
    e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    dragRef.current = { type, corner, startX: p.clientX, startY: p.clientY, startCrop: crop };
  }

  async function confirmCrop() {
    setSaving(true);
    try {
      const result = await cropImageToDataUrl(image.src, crop);
      onSaveEdit(result.dataUrl, result.ratio);
      setEditing(false);
      showToast("تصویر ویرایش شد");
    } catch {
      showToast("این تصویر (چون از یک لینک خارجی اضافه شده) قابل ویرایش نیست");
    }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 80, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px" }}>
        <button onClick={editing ? () => setEditing(false) : onClose} className="press"
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={18} color="#fff" />
        </button>
        {editing && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>کراپ آزاد</span>}
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {!editing ? (
          <img src={image.src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ position: "relative", width: dims.w, height: dims.h }}>
            <img src={image.src} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
              clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 ${crop.y}%,${crop.x}% ${crop.y}%,${crop.x}% ${crop.y + crop.h}%,${crop.x + crop.w}% ${crop.y + crop.h}%,${crop.x + crop.w}% ${crop.y}%,0 ${crop.y}%)`
            }} />
            <div
              onMouseDown={(e) => startDrag("move", null, e)}
              onTouchStart={(e) => startDrag("move", null, e)}
              style={{ position: "absolute", left: crop.x + "%", top: crop.y + "%", width: crop.w + "%", height: crop.h + "%", border: "2px solid #fff", cursor: "move" }}
            >
              {["tl", "tr", "bl", "br"].map(corner => (
                <div key={corner}
                  onMouseDown={(e) => { e.stopPropagation(); startDrag("corner", corner, e); }}
                  onTouchStart={(e) => { e.stopPropagation(); startDrag("corner", corner, e); }}
                  style={{
                    position: "absolute", width: 22, height: 22, background: "#fff", borderRadius: 5,
                    top: corner.includes("t") ? -11 : "auto", bottom: corner.includes("b") ? -11 : "auto",
                    left: corner.includes("l") ? -11 : "auto", right: corner.includes("r") ? -11 : "auto",
                    cursor: (corner === "tl" || corner === "br") ? "nwse-resize" : "nesw-resize",
                  }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px 26px" }}>
        {!editing ? (
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <ViewerAction icon={Heart} label="علاقه‌مندی" active={image.favorite} onClick={() => onToggleFavorite(image.id)} />
            <ViewerAction icon={Crop} label="ویرایش" onClick={() => setEditing(true)} />
            <ViewerAction icon={Share2} label="اشتراک" onClick={() => onShare(image)} />
            <ViewerAction icon={Trash2} label="حذف" danger onClick={() => setConfirmingDelete(true)} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setEditing(false)} className="press"
              style={{ flex: 1, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 600, cursor: "pointer" }}>انصراف</button>
            <button onClick={confirmCrop} disabled={saving} className="press"
              style={{ flex: 1, background: pal.accent, border: "none", borderRadius: 12, padding: 13, color: "#fff", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "در حال ذخیره…" : "اعمال کراپ"}
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={() => setConfirmingDelete(false)}>
          <div style={{ width: "100%", background: pal.surface, borderRadius: "20px 20px 0 0", padding: 20 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: pal.text }}>حذف این تصویر؟</h3>
            <p style={{ fontSize: 13, color: pal.sub, margin: "0 0 16px" }}>این کار قابل بازگشت نیست.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, background: pal.surface2, border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: pal.text }}>انصراف</button>
              <button onClick={() => { onDelete(image.id); onClose(); }} style={{ flex: 1, background: "#c0554c", border: "none", borderRadius: 12, padding: 12, cursor: "pointer", fontWeight: 600, color: "#fff" }}>حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function ViewerAction({ icon: Icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick} className="press"
      style={{ background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", color: "#fff" }}>
      <Icon size={20} fill={active ? "#e2685f" : "none"} color={danger ? "#e28c82" : (active ? "#e2685f" : "#fff")} />
      <span style={{ fontSize: 10.5 }}>{label}</span>
    </button>
  );
}

/* کراپ واقعی روی canvas — فقط برای تصاویر آپلودشده (base64) به‌طور تضمینی کار می‌کند؛
   تصاویر لینک‌شده از سایت‌های دیگر ممکن است به‌خاطر محدودیت CORS مرورگر قابل کراپ نباشند */
async function cropImageToDataUrl(src, cropPct) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const nw = img.naturalWidth, nh = img.naturalHeight;
        const sx = nw * (cropPct.x / 100), sy = nh * (cropPct.y / 100);
        const sw = nw * (cropPct.w / 100), sh = nh * (cropPct.h / 100);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sw));
        canvas.height = Math.max(1, Math.round(sh));
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ dataUrl, ratio: +(canvas.width / canvas.height).toFixed(3) || 1 });
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}
