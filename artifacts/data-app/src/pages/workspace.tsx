import { useMemo, useRef, useState, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  useListComponents, 
  useListModels,
  useGetModel,
  getGetModelQueryKey
} from "@workspace/api-client-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { 
  Upload, Home, Maximize, RefreshCw, 
  Box, Ruler, Plus, Search, Edit, MousePointer2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UploadDialog } from "@/components/upload-dialog";
import { ComponentForm } from "@/components/component-form";
import { ViewerErrorBoundary } from "@/components/viewer-error-boundary";
import { ModelViewer } from "@/components/model-viewer";
import { useSelectedModel } from "@/hooks/use-selected-model";

// Helper for status colors
export function getStatusInfo(onHand = 0, reserved = 0) {
  const available = onHand - reserved;
  if (available <= 0) return { label: "OUT", color: "bg-destructive text-destructive-foreground", value: available };
  if (available <= 2) return { label: "LOW", color: "bg-[hsl(var(--status-low))] text-[hsl(var(--status-low-fg))]", value: available };
  return { label: "AVAILABLE", color: "bg-[hsl(var(--status-available))] text-[hsl(var(--status-available-fg))]", value: available };
}

export function StatusBadge({ onHand = 0, reserved = 0 }: { onHand?: number, reserved?: number }) {
  const info = getStatusInfo(onHand, reserved);
  return (
    <Badge variant="outline" className={`${info.color} border-none font-bold tracking-wider rounded-none px-2 py-0.5`}>
      {info.label}
    </Badge>
  );
}

export default function Workspace() {
  const { modelId, componentId, setSelection } = useSelectedModel();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [componentFormOpen, setComponentFormOpen] = useState(false);
  const [pendingMeshName, setPendingMeshName] = useState<string | null>(null);
  // The mesh that was just clicked but not yet linked to a component.
  // Highlighted in yellow with a confirm prompt so the user can verify
  // what they selected before opening the form.
  const [previewMeshName, setPreviewMeshName] = useState<string | null>(null);

  const { data: models = [] } = useListModels();
  const { data: model } = useGetModel(modelId!, { query: { enabled: !!modelId, queryKey: getGetModelQueryKey(modelId!) } });
  const { data: components = [] } = useListComponents(modelId!, { query: { enabled: !!modelId, queryKey: ["components", modelId] } });

  const selectedComponent = components.find(c => c.id === componentId);

  const { toast } = useToast();

  // Lookup table: mesh name -> components linked to it. We keep all matches
  // because GLTF exports often have duplicate node names, and we want to warn
  // the user instead of silently picking the wrong one.
  const meshToComponents = useMemo(() => {
    const map = new Map<string, typeof components[number][]>();
    components.forEach(c => {
      if (c.meshName) {
        const arr = map.get(c.meshName);
        if (arr) arr.push(c);
        else map.set(c.meshName, [c]);
      }
    });
    return map;
  }, [components]);

  const taggedMeshNames = useMemo(
    () => new Set(meshToComponents.keys()),
    [meshToComponents],
  );

  // Mesh name of the currently selected component (for highlight).
  const selectedMeshName = selectedComponent?.meshName ?? null;

  const warnedDuplicatesRef = useRef<Set<string>>(new Set());

  const handleMeshClick = (meshName: string) => {
    const matches = meshToComponents.get(meshName);
    if (matches && matches.length > 0) {
      if (matches.length > 1 && !warnedDuplicatesRef.current.has(meshName)) {
        warnedDuplicatesRef.current.add(meshName);
        toast({
          title: "Duplicate mesh name",
          description: `${matches.length} components share the mesh "${meshName}". Selecting the first one. Consider renaming nodes in your CAD source for unambiguous tagging.`,
        });
      }
      // Selecting an existing component clears any in-flight preview.
      setPreviewMeshName(null);
      setSelection(modelId, matches[0].id);
      return;
    }
    // Untagged mesh: highlight it and show a confirm prompt instead of
    // jumping straight into the form. Lets the user verify they picked
    // the right piece before entering component info.
    setPreviewMeshName(meshName);
  };

  const confirmTagPreview = () => {
    if (!previewMeshName) return;
    setPendingMeshName(previewMeshName);
    setComponentFormOpen(true);
  };

  const cancelPreview = () => {
    setPreviewMeshName(null);
  };

  const updateUrl = (mId: number | null, cId: number | null) => {
    if (mId !== modelId) setPreviewMeshName(null);
    setSelection(mId, cId);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Select 
            value={modelId?.toString() || ""} 
            onValueChange={(val) => updateUrl(parseInt(val), null)}
          >
            <SelectTrigger className="w-[280px] bg-background border-border rounded-none h-8 font-mono text-xs">
              <SelectValue placeholder="SELECT MODEL..." />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {models.map(m => (
                <SelectItem key={m.id} value={m.id.toString()} className="font-mono text-xs">
                  {m.projectName} / {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="h-6 w-px bg-border mx-2" />
          
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-none border-border bg-background hover:bg-accent hover:text-accent-foreground" title="Home View">
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-none border-border bg-background hover:bg-accent hover:text-accent-foreground" title="Zoom Fit">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-none border-border bg-background hover:bg-accent hover:text-accent-foreground" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-none border-border bg-background hover:bg-accent hover:text-accent-foreground" title="Measure">
              <Ruler className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="h-6 w-px bg-border mx-2" />
          
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground font-mono text-xs"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-3 w-3 mr-2" />
            UPLOAD GLTF
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono tracking-widest">RENDER MODE</span>
            <Select defaultValue="default">
              <SelectTrigger className="w-[140px] bg-background border-border rounded-none h-8 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="default" className="font-mono text-xs">DEFAULT</SelectItem>
                <SelectItem value="wireframe" className="font-mono text-xs">WIREFRAME</SelectItem>
                <SelectItem value="exploded" className="font-mono text-xs">EXPLODED</SelectItem>
                <SelectItem value="isolation" className="font-mono text-xs">ISOLATION</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex flex-1 min-h-0">
        
        {/* Left Panel - Model Info */}
        <div className="w-[300px] border-r border-border bg-sidebar flex flex-col shrink-0 overflow-y-auto">
          {model ? (
            <>
              <div className="p-4 border-b border-border">
                <h3 className="text-[10px] text-primary font-mono tracking-widest mb-3">MODEL SPECIFICATION</h3>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">PROJECT</span><span>{model.projectName || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">MODEL</span><span>{model.modelName || model.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">S/N</span><span>{model.serialNumber || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">REV</span><span>{model.revision || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FILE</span><span className="truncate max-w-[120px]">{model.fileName || '-'}</span></div>
                </div>
              </div>
              
              <div className="p-4 border-b border-border">
                <h3 className="text-[10px] text-primary font-mono tracking-widest mb-3">SELECTED COMPONENT</h3>
                {selectedComponent ? (
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">CODE</span><span className="text-accent">{selectedComponent.code}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">DESC</span><span className="truncate max-w-[140px] text-right">{selectedComponent.description}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PART NO</span><span>{selectedComponent.partNumber}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">MESH</span><span className="truncate max-w-[140px] text-right text-primary" title={selectedComponent.meshName || '-'}>{selectedComponent.meshName || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">MFG</span><span>{selectedComponent.manufacturer || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">WEIGHT</span><span>{selectedComponent.weightKg ? `${selectedComponent.weightKg} kg` : '-'}</span></div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs font-mono text-center py-4 border border-dashed border-border">
                    NO COMPONENT SELECTED
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-[10px] text-primary font-mono tracking-widest mb-3">INVENTORY SUMMARY</h3>
                {selectedComponent ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">ON HAND</span><span className="text-lg">{selectedComponent.onHand || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">RESERVED</span><span className="text-lg">{selectedComponent.reserved || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">ON ORDER</span><span className="text-lg">{selectedComponent.onOrder || 0}</span></div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">AVAILABLE</span>
                      <span className={`text-lg font-bold ${getStatusInfo(selectedComponent.onHand, selectedComponent.reserved).value <= 0 ? 'text-destructive' : 'text-[hsl(var(--status-available))]'}`}>
                        {getStatusInfo(selectedComponent.onHand, selectedComponent.reserved).value}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs font-mono text-center py-4 border border-dashed border-border">
                    SELECT COMPONENT
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center font-mono">
                <Box className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">NO MODEL LOADED</p>
              </div>
            </div>
          )}
        </div>

        {/* Center - 3D Viewport */}
        <div className="flex-1 flex flex-col min-w-0 bg-black relative">
          {model ? (
            <ViewerErrorBoundary resetKey={model.id}>
              <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                <color attach="background" args={['#0a0a0a']} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 10]} intensity={1} />
                <Suspense fallback={null}>
                  <Stage environment="warehouse" intensity={0.5}>
                    {model.objectPath && (
                      <ModelViewer
                        url={`/api/storage${model.objectPath}`}
                        selectedMeshName={selectedMeshName}
                        previewMeshName={previewMeshName}
                        taggedMeshNames={taggedMeshNames}
                        onMeshClick={handleMeshClick}
                      />
                    )}
                  </Stage>
                </Suspense>
                <OrbitControls makeDefault />
              </Canvas>
            </ViewerErrorBoundary>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#111_0%,#000_100%)]">
              <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
              <div className="z-10 text-center font-mono border border-border bg-card/80 p-8 max-w-md">
                <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-lg text-foreground mb-2">NO MODEL LOADED</h2>
                <p className="text-sm text-muted-foreground mb-6">Upload a single .glb file, or a .gltf together with its .bin and texture files, to begin cataloging components and managing inventory.</p>
                <Button 
                  className="rounded-none border-primary bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-widest"
                  onClick={() => setUploadOpen(true)}
                >
                  UPLOAD FIRST MODEL
                </Button>
              </div>
            </div>
          )}
          
          {/* Overlay Stats/UI */}
          {model && (
            <>
              <div className="absolute top-4 left-4 pointer-events-none">
                <div className="font-mono text-xs bg-black/60 border border-border p-2 backdrop-blur-sm">
                  <div className="text-primary font-bold">{model.name}</div>
                  <div className="text-muted-foreground">COMPONENTS: {components.length}</div>
                </div>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="flex items-center gap-2 font-mono text-[10px] bg-black/70 border border-border px-3 py-1.5 backdrop-blur-sm">
                  <MousePointer2 className="h-3 w-3 text-primary" />
                  <span className="text-muted-foreground tracking-widest">CLICK ANY PART TO TAG IT</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-block w-2 h-2 bg-[#3b82f6]" />
                  <span className="text-muted-foreground">TAGGED</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-block w-2 h-2 bg-[#facc15]" />
                  <span className="text-muted-foreground">PREVIEW</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-block w-2 h-2 bg-primary" />
                  <span className="text-muted-foreground">SELECTED</span>
                </div>
              </div>

              {previewMeshName && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="font-mono text-xs bg-black/85 border border-[#facc15] backdrop-blur-sm shadow-lg">
                    <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-[#facc15]" />
                      <span className="text-[10px] text-[#facc15] tracking-widest">PART HIGHLIGHTED</span>
                    </div>
                    <div className="px-3 py-2 max-w-[420px]">
                      <div className="text-[10px] text-muted-foreground tracking-widest mb-1">MESH</div>
                      <div className="text-foreground truncate" title={previewMeshName}>{previewMeshName}</div>
                    </div>
                    <div className="flex border-t border-border">
                      <button
                        type="button"
                        onClick={cancelPreview}
                        className="flex-1 px-3 py-2 text-[10px] tracking-widest text-muted-foreground hover:bg-muted/30 hover:text-foreground border-r border-border flex items-center justify-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        CANCEL
                      </button>
                      <button
                        type="button"
                        onClick={confirmTagPreview}
                        className="flex-1 px-3 py-2 text-[10px] tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        TAG THIS PART
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Panel - Service Info */}
        <div className="w-[320px] border-l border-border bg-sidebar flex flex-col shrink-0">
          <div className="h-10 border-b border-border bg-card flex items-center px-4 shrink-0">
            <h2 className="text-[10px] font-bold tracking-widest font-mono">SERVICE & REPLACEMENT</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {components.map(comp => {
              const isSelected = comp.id === componentId;
              return (
                <div 
                  key={comp.id}
                  className={`border p-3 cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/30'}`}
                  onClick={() => updateUrl(modelId, comp.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-mono text-sm font-bold ${isSelected ? 'text-primary' : ''}`}>{comp.code}</span>
                    <StatusBadge onHand={comp.onHand} reserved={comp.reserved} />
                  </div>
                  
                  <div className="font-mono text-xs text-muted-foreground truncate mb-3">
                    {comp.description}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px]">
                    <div className="text-muted-foreground">TYPE</div><div className="text-right truncate">{comp.connectionType || '-'}</div>
                    <div className="text-muted-foreground">WRENCH</div><div className="text-right truncate">{comp.wrenchSize || '-'}</div>
                    <div className="text-muted-foreground">LENGTH</div><div className="text-right">{comp.lengthMm ? `${comp.lengthMm}mm` : '-'}</div>
                    <div className="text-muted-foreground">PART</div><div className="text-right truncate text-foreground">{comp.partNumber}</div>
                  </div>
                </div>
              );
            })}
            
            {model && components.length === 0 && (
              <div className="text-center font-mono py-8 border border-dashed border-border text-muted-foreground text-xs">
                NO COMPONENTS ADDED
              </div>
            )}
          </div>
          
          {selectedComponent && (
            <div className="h-[200px] border-t border-border bg-card flex flex-col shrink-0">
              <div className="h-8 border-b border-border flex items-center px-3 justify-between">
                <span className="text-[10px] font-bold tracking-widest font-mono text-primary">COMPONENT NOTES</span>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
              <div className="p-3 font-mono text-xs text-muted-foreground overflow-y-auto whitespace-pre-wrap">
                {selectedComponent.notes || "No service notes for this component."}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel - Components Table */}
      <div className="h-[250px] border-t border-border bg-card flex flex-col shrink-0">
        <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-sidebar">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-bold tracking-widest font-mono">SELECTED COMPONENTS LIST</h2>
            <div className="flex items-center bg-background border border-border px-2 h-6">
              <Search className="h-3 w-3 text-muted-foreground mr-2" />
              <input 
                type="text" 
                placeholder="FILTER..." 
                className="bg-transparent border-none outline-none text-xs font-mono w-32 placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 rounded-none border-border font-mono text-[10px] hover:text-accent hover:border-accent"
              onClick={() => {
                if (!modelId) return;
                setComponentFormOpen(true);
              }}
              disabled={!modelId}
            >
              <Plus className="h-3 w-3 mr-1" /> ADD PART
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-card sticky top-0 z-10 border-b border-border shadow-sm">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[40px] font-mono text-[10px] text-muted-foreground h-8"></TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8">ID</TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8">DESCRIPTION</TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8">PART NUMBER</TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8">TOOLS REQ</TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8">SIZE</TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8 text-right">INV</TableHead>
                <TableHead className="font-mono text-[10px] text-muted-foreground h-8 text-center">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.map(comp => (
                <TableRow 
                  key={comp.id} 
                  className={`border-b border-border cursor-pointer transition-colors ${componentId === comp.id ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'}`}
                  onClick={() => updateUrl(modelId, comp.id)}
                >
                  <TableCell className="py-2"><input type="checkbox" className="accent-primary" /></TableCell>
                  <TableCell className="py-2 font-mono text-xs text-accent">{comp.code}</TableCell>
                  <TableCell className="py-2 font-mono text-xs">{comp.description}</TableCell>
                  <TableCell className="py-2 font-mono text-xs">{comp.partNumber}</TableCell>
                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">{comp.toolsRequired || '-'}</TableCell>
                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">{comp.toolSize || '-'}</TableCell>
                  <TableCell className="py-2 font-mono text-xs text-right font-bold">{comp.onHand || 0}</TableCell>
                  <TableCell className="py-2 text-center">
                    <StatusBadge onHand={comp.onHand} reserved={comp.reserved} />
                  </TableCell>
                </TableRow>
              ))}
              {components.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center font-mono text-xs text-muted-foreground">
                    {modelId ? "No components found for this model." : "Select a model to view components."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {uploadOpen && (
        <UploadDialog 
          open={uploadOpen} 
          onOpenChange={setUploadOpen} 
          onSuccess={(id) => {
            setUploadOpen(false);
            updateUrl(id, null);
          }}
        />
      )}

      {componentFormOpen && modelId && (
        <ComponentForm 
          open={componentFormOpen} 
          onOpenChange={(o) => {
            setComponentFormOpen(o);
            if (!o) {
              setPendingMeshName(null);
              setPreviewMeshName(null);
            }
          }}
          modelId={modelId}
          prefilledMeshName={pendingMeshName}
          onSuccess={(comp) => {
            setComponentFormOpen(false);
            setPendingMeshName(null);
            setPreviewMeshName(null);
            updateUrl(modelId, comp.id);
          }}
        />
      )}
    </div>
  );
}
