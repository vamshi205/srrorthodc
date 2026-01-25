import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CheckCircle2, Circle, Images, List, LogOut, Menu, Plus, Trash2, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Progress } from "@/components/ui/progress";

import { InstrumentImageModal } from "@/components/ortho/InstrumentImageModal";
import { ProcedureSelector } from "@/components/ortho/ProcedureSelector";
import { useProcedures } from "@/hooks/useProcedures";
import { auth } from "@/firebase";
import type { Location, Procedure } from "@/types/procedure";
import { clearPackedForProcedure, loadImageDbPacked, setPackedForItem, type ImageDbPackedState } from "@/lib/imageDbStorage";

type FallbackUrls = {
  thumbnail: string;
  preview: string;
  uc: string;
  original: string;
};

type GalleryItem = {
  category: "item" | "fixed" | "instrument";
  name: string;
  url: string;
  fallbackUrls: FallbackUrls | null;
  location?: Location | null;
  qty?: string;
};

const toDisplayLocation = (loc?: Location | null) => {
  if (!loc) return null;
  const parts = [loc.room, loc.rack, loc.box].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

// Copied (intentionally) from ProcedureCard.tsx to avoid touching existing functionality.
const convertGoogleDriveUrl = (url: string | null): FallbackUrls | null => {
  if (!url) return null;

  let fileId: string | null = null;

  const ucMatch = url.match(/[?&]id=([^&]+)/);
  if (ucMatch) fileId = ucMatch[1];

  const fileMatch = url.match(/\/file\/d\/([^\/\?]+)/);
  if (fileMatch) fileId = fileMatch[1];

  const openMatch = url.match(/open[?&]id=([^&]+)/);
  if (openMatch) fileId = openMatch[1];

  const thumbnailMatch = url.match(/thumbnail[?&]id=([^&]+)/);
  if (thumbnailMatch) fileId = thumbnailMatch[1];

  if (url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
    return { thumbnail: url, preview: url, uc: url, original: url };
  }

  if (!fileId) {
    return { thumbnail: url, preview: url, uc: url, original: url };
  }

  return {
    thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    preview: `https://drive.google.com/file/d/${fileId}/preview`,
    uc: `https://drive.google.com/uc?export=view&id=${fileId}`,
    original: url,
  };
};

const extractBaseItemName = (raw: string) => raw.match(/^(.+?)\s*\{/)?.[1]?.trim() || raw.trim();

export default function ImageDatabase() {
  const navigate = useNavigate();
  const { procedures, procedureTypes, loading, error, searchProcedures } = useProcedures();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [showProcedurePicker, setShowProcedurePicker] = useState(true);
  const [tab, setTab] = useState<"all" | "items" | "instruments">("all");
  const [showPackedSection, setShowPackedSection] = useState(false);
  const [packedMap, setPackedMap] = useState<Record<string, Record<string, ImageDbPackedState>>>(
    () => loadImageDbPacked(),
  );

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [allImages, setAllImages] = useState<GalleryItem[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // If user typed and there is exactly one match, keep selection stable by name.
    if (selectedName && !procedures.some((p) => p.name === selectedName)) {
      setSelectedName(null);
      setShowProcedurePicker(true);
    }
  }, [procedures, selectedName]);

  const selectedProcedure: Procedure | null = useMemo(() => {
    if (!selectedName) return null;
    return procedures.find((p) => p.name === selectedName) ?? null;
  }, [procedures, selectedName]);

  const gallery = useMemo(() => {
    if (!selectedProcedure) return { all: [] as GalleryItem[], items: [] as GalleryItem[], instruments: [] as GalleryItem[] };

    const instrumentImageMapping = selectedProcedure.instrumentImageMapping ?? {};
    const fixedItemImageMapping = selectedProcedure.fixedItemImageMapping ?? {};
    const itemImageMapping = selectedProcedure.itemImageMapping ?? {};

    const instruments: GalleryItem[] = selectedProcedure.instruments
      .map((name) => {
        const raw = instrumentImageMapping[name] ?? null;
        if (!raw) return null;
        const fb = convertGoogleDriveUrl(raw);
        return {
          category: "instrument",
          name,
          url: fb?.thumbnail ?? raw,
          fallbackUrls: fb,
          location: selectedProcedure.instrumentLocationMapping?.[name] ?? null,
        } satisfies GalleryItem;
      })
      .filter(Boolean) as GalleryItem[];

    const fixed: GalleryItem[] = selectedProcedure.fixedItems
      .map((fi) => {
        const raw = fixedItemImageMapping[fi.name] ?? null;
        if (!raw) return null;
        const fb = convertGoogleDriveUrl(raw);
        return {
          category: "fixed",
          name: fi.name,
          url: fb?.thumbnail ?? raw,
          fallbackUrls: fb,
          qty: fi.qty,
          location: selectedProcedure.fixedItemLocationMapping?.[fi.name] ?? null,
        } satisfies GalleryItem;
      })
      .filter(Boolean) as GalleryItem[];

    const selectableItemNames = Array.from(new Set(selectedProcedure.items.map(extractBaseItemName))).filter(Boolean);
    const items: GalleryItem[] = selectableItemNames
      .map((name) => {
        const raw = itemImageMapping[name] ?? null;
        if (!raw) return null;
        const fb = convertGoogleDriveUrl(raw);
        return {
          category: "item",
          name,
          url: fb?.thumbnail ?? raw,
          fallbackUrls: fb,
          location: selectedProcedure.itemLocationMapping?.[name] ?? null,
        } satisfies GalleryItem;
      })
      .filter(Boolean) as GalleryItem[];

    const all = [...fixed, ...items, ...instruments];
    return { all, items: [...fixed, ...items], instruments };
  }, [selectedProcedure]);

  const visibleImages = useMemo(() => {
    if (tab === "items") return gallery.items;
    if (tab === "instruments") return gallery.instruments;
    return gallery.all;
  }, [gallery, tab]);

  const selectedProcedurePacked = useMemo(() => {
    if (!selectedProcedure) return {};
    return packedMap[selectedProcedure.name] ?? {};
  }, [packedMap, selectedProcedure]);

  const isPacked = (img: GalleryItem) => {
    if (!selectedProcedure) return false;
    const key = `${img.category}:${img.name}`;
    return selectedProcedurePacked[key]?.packed === true;
  };

  const unpackedVisibleImages = useMemo(
    () => visibleImages.filter((img) => !isPacked(img)),
    [visibleImages, selectedProcedurePacked], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const packedVisibleImages = useMemo(
    () => visibleImages.filter((img) => isPacked(img)),
    [visibleImages, selectedProcedurePacked], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const packedStats = useMemo(() => {
    const total = visibleImages.length;
    const packed = visibleImages.reduce((count, img) => (isPacked(img) ? count + 1 : count), 0);
    return { total, packed };
  }, [visibleImages, selectedProcedurePacked]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressPct = useMemo(() => {
    if (packedStats.total <= 0) return 0;
    return Math.round((packedStats.packed / packedStats.total) * 100);
  }, [packedStats.packed, packedStats.total]);

  const openImage = (img: GalleryItem, list: GalleryItem[]) => {
    setAllImages(list);
    const idx = list.findIndex((x) => x.category === img.category && x.name === img.name);
    const safeIndex = idx >= 0 ? idx : 0;
    setCurrentImageIndex(safeIndex);
    setSelectedImage(list[safeIndex] ?? img);
    setShowImageModal(true);
  };

  const handleNavigateImage = (index: number) => {
    if (index < 0 || index >= allImages.length) return;
    setCurrentImageIndex(index);
    setSelectedImage(allImages[index] ?? null);
  };

  const togglePacked = (img: GalleryItem, packed: boolean) => {
    if (!selectedProcedure) return;
    const key = `${img.category}:${img.name}`;
    const next = setPackedForItem(selectedProcedure.name, key, packed);
    setPackedMap(next);
  };

  const handleResetPacked = () => {
    if (!selectedProcedure) return;
    const ok = window.confirm(`Clear all Packed checks for "${selectedProcedure.name}"?`);
    if (!ok) return;
    const next = clearPackedForProcedure(selectedProcedure.name);
    setPackedMap(next);
    setShowPackedSection(false);
  };

  const handleLogout = async () => {
    localStorage.removeItem("srrortho:auth");
    localStorage.removeItem('srrortho:procedures_cache');
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      <div className="flex min-h-screen">
        {/* Left Menu (desktop) */}
        <aside className="hidden md:flex w-80 border-r border-border bg-card/70 backdrop-blur-md">
          <div className="flex flex-col w-full p-4 gap-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold truncate">SRR Ortho Implant</div>
                <div className="text-xs text-muted-foreground">Image Database</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Navigation</div>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/?mode=procedure")}>
                <Plus className="w-4 h-4" /> Procedure List
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/?mode=manual")}>
                <Plus className="w-4 h-4" /> Manual DC
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/saved")}>
                <List className="w-4 h-4" /> DC Tracker
              </Button>
              <Button variant="default" className="w-full justify-start gap-2">
                <Images className="w-4 h-4" /> Image Database
              </Button>
            </div>

            <div className="mt-auto space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => navigate("/admin")}
              >
                <Wrench className="w-4 h-4" /> Admin Panel
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> Logout
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
          {/* Top toolbar */}
          <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4">
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="md:hidden w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">Image Database</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedProcedure ? selectedProcedure.name : "Search a procedure to view images"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Mobile menu */}
                <div className="md:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-4">
                      <SheetHeader className="pr-10">
                        <SheetTitle>Menu</SheetTitle>
                      </SheetHeader>

                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">Navigation</div>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/?mode=procedure")}>
                              <Plus className="w-4 h-4" /> Procedure List
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/?mode=manual")}>
                              <Plus className="w-4 h-4" /> Manual DC
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/saved")}>
                              <List className="w-4 h-4" /> DC Tracker
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="default" className="w-full justify-start gap-2">
                              <Images className="w-4 h-4" /> Image Database
                            </Button>
                          </SheetClose>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">Actions</div>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin")}>
                              <Wrench className="w-4 h-4" /> Admin Panel
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="outline" className="w-full justify-start gap-2 text-red-600" onClick={handleLogout}>
                              <LogOut className="w-4 h-4" /> Logout
                            </Button>
                          </SheetClose>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="glass-card rounded-xl border-2 border-border/60 shadow-md">
              <CardHeader className="p-4">
                <CardTitle className="text-base flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                      1
                    </span>
                    Select Procedure
                  </span>
                  {selectedProcedure ? (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="outline">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      Required
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Search and pick a procedure. Then follow the packing checklist (Unpacked → Packed).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {error && (
                  <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md p-3">
                    Failed to load procedures: {error}
                  </div>
                )}

                {selectedProcedure && !showProcedurePicker ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{selectedProcedure.name}</div>
                      <div className="text-xs text-slate-600 truncate">
                        {selectedProcedure.type || "General"} · {gallery.all.length} images
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setShowProcedurePicker(true)}
                      >
                        Change
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSelectedName(null);
                          setShowProcedurePicker(true);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ProcedureSelector
                    procedures={procedures}
                    procedureTypes={procedureTypes}
                    activeProcedureNames={selectedName ? [selectedName] : []}
                    initialFilterType="All"
                    searchProcedures={searchProcedures}
                    onSelectProcedure={(p) => {
                      setShowPackedSection(false);
                      setSelectedName((prev) => {
                        const next = prev === p.name ? null : p.name;
                        // Hide picker once a procedure is chosen (default behavior like Procedure List)
                        if (next) setShowProcedurePicker(false);
                        else setShowProcedurePicker(true);
                        return next;
                      });
                    }}
                  />
                )}
              </CardContent>
            </Card>

            {selectedProcedure && (
              <Card className="glass-card rounded-xl border-2 border-border/60 shadow-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                        2
                      </span>
                      Packing Checklist
                    </span>
                    <Badge
                      variant="outline"
                      className={`border ${packedStats.total > 0 && packedStats.packed === packedStats.total
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-slate-300 text-slate-700"
                        }`}
                    >
                      {packedStats.packed}/{packedStats.total} packed · {progressPct}%
                    </Badge>
                  </CardTitle>
                  <div className="pt-3 space-y-2">
                    <Progress
                      value={progressPct}
                      className={`h-2 ${progressPct === 100 ? "bg-green-100" : "bg-slate-200"}`}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardDescription className="m-0">
                        Start with <span className="font-medium text-red-700">Unpacked</span>. When verified, click{" "}
                        <span className="font-medium text-green-700">Mark Packed</span>.
                      </CardDescription>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={handleResetPacked}
                        >
                          <Trash2 className="h-4 w-4" /> Reset checks
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                    <TabsList className="w-full justify-start bg-slate-50 border border-slate-200">
                      <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="items" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Items
                      </TabsTrigger>
                      <TabsTrigger
                        value="instruments"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        Instruments
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="mt-4">
                      <PackedSplitGrid
                        unpackedItems={unpackedVisibleImages}
                        packedItems={packedVisibleImages}
                        showPacked={showPackedSection}
                        onToggleShowPacked={() => setShowPackedSection((s) => !s)}
                        onOpen={openImage}
                        isPacked={isPacked}
                        onTogglePacked={togglePacked}
                      />
                    </TabsContent>
                    <TabsContent value="items" className="mt-4">
                      <PackedSplitGrid
                        unpackedItems={unpackedVisibleImages}
                        packedItems={packedVisibleImages}
                        showPacked={showPackedSection}
                        onToggleShowPacked={() => setShowPackedSection((s) => !s)}
                        onOpen={openImage}
                        isPacked={isPacked}
                        onTogglePacked={togglePacked}
                      />
                    </TabsContent>
                    <TabsContent value="instruments" className="mt-4">
                      <PackedSplitGrid
                        unpackedItems={unpackedVisibleImages}
                        packedItems={packedVisibleImages}
                        showPacked={showPackedSection}
                        onToggleShowPacked={() => setShowPackedSection((s) => !s)}
                        onOpen={openImage}
                        isPacked={isPacked}
                        onTogglePacked={togglePacked}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <InstrumentImageModal
          isOpen={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setSelectedImage(null);
            setAllImages([]);
            setCurrentImageIndex(0);
          }}
          instrumentName={selectedImage.name}
          imageUrl={selectedImage.url}
          fallbackUrls={selectedImage.fallbackUrls}
          allInstruments={allImages.map((x) => ({ name: x.name, url: x.url, fallbackUrls: x.fallbackUrls }))}
          currentIndex={currentImageIndex}
          onNavigate={handleNavigateImage}
          headerActions={
            selectedProcedure && selectedImage ? (
              <div className="flex items-center gap-3 pr-8">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 border-r pr-3 border-slate-200">
                  {isPacked(selectedImage) ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-700" />
                      <span className="font-medium text-green-700 hidden sm:inline">Packed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4 text-slate-300" />
                      <span className="font-medium text-slate-400 hidden sm:inline">Unpacked</span>
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isPacked(selectedImage) ? "outline" : "default"}
                  className={`h-8 px-3 ${isPacked(selectedImage)
                    ? "border-slate-300"
                    : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  onClick={() => togglePacked(selectedImage, !isPacked(selectedImage))}
                >
                  {isPacked(selectedImage) ? "Uncheck" : "Pack"}
                </Button>
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}

function PackedSplitGrid({
  unpackedItems,
  packedItems,
  showPacked,
  onToggleShowPacked,
  onOpen,
  isPacked,
  onTogglePacked,
}: {
  unpackedItems: GalleryItem[];
  packedItems: GalleryItem[];
  showPacked: boolean;
  onToggleShowPacked: () => void;
  onOpen: (img: GalleryItem, list: GalleryItem[]) => void;
  isPacked: (img: GalleryItem) => boolean;
  onTogglePacked: (img: GalleryItem, packed: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Circle className="h-3.5 w-3.5 text-slate-300" />
            <div className="text-xs font-semibold text-slate-800">Unpacked</div>
          </div>
          <Badge className="bg-red-50 text-red-800 border-red-200" variant="outline">
            {unpackedItems.length} pending
          </Badge>
        </div>
        <GalleryGrid items={unpackedItems} onOpen={(img) => onOpen(img, unpackedItems)} isPacked={isPacked} onTogglePacked={onTogglePacked} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={onToggleShowPacked}
          className="w-full px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <div className="text-xs font-semibold text-slate-800">Packed</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-50 text-green-800 border-green-200" variant="outline">
              {packedItems.length}
            </Badge>
            <span className="text-xs text-slate-600">{showPacked ? "Hide" : "Show"}</span>
          </div>
        </button>
        {showPacked && (
          <div className="p-3">
            <GalleryGrid items={packedItems} onOpen={(img) => onOpen(img, packedItems)} isPacked={isPacked} onTogglePacked={onTogglePacked} />
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryGrid({
  items,
  onOpen,
  isPacked,
  onTogglePacked,
}: {
  items: GalleryItem[];
  onOpen: (img: GalleryItem) => void;
  isPacked: (img: GalleryItem) => boolean;
  onTogglePacked: (img: GalleryItem, packed: boolean) => void;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-slate-600">No images.</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((img) => {
        const location = toDisplayLocation(img.location);
        const packed = isPacked(img);
        return (
          <button
            key={`${img.category}:${img.name}`}
            onClick={() => onOpen(img)}
            className={`text-left rounded-lg border bg-white hover:shadow-sm transition-all overflow-hidden ${packed ? "border-green-200 hover:border-green-300" : "border-red-200 hover:border-red-300"
              }`}
            title={img.name}
          >
            <div className={`border-b ${packed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <AspectRatio ratio={4 / 3}>
                <img
                  src={img.url}
                  alt={img.name}
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                />
              </AspectRatio>
            </div>
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-900 truncate">{img.name}</div>
                <Badge
                  variant="outline"
                  className={`text-[10px] border-slate-300 ${img.category === "instrument"
                    ? "text-indigo-700"
                    : img.category === "fixed"
                      ? "text-slate-700"
                      : "text-blue-700"
                    }`}
                >
                  {img.category === "instrument" ? "Instrument" : img.category === "fixed" ? "Fixed" : "Item"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-600">
                  {packed ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
                      <span className="font-medium text-green-700">Packed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-3 w-3 text-slate-300" />
                      <span className="font-medium text-slate-400">Unpacked</span>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={packed ? "outline" : "default"}
                  className={`h-7 px-2 text-[11px] ${packed
                    ? "border-red-200 text-red-700 hover:bg-red-50"
                    : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTogglePacked(img, !packed);
                  }}
                >
                  {packed ? "Uncheck" : "Pack"}
                </Button>
              </div>
              {img.qty && (
                <div className="text-[11px] text-slate-600">
                  Qty: <span className="font-medium text-slate-800">{img.qty}</span>
                </div>
              )}
              {location && <div className="text-[11px] text-slate-600 truncate">{location}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}


