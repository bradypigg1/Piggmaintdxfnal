import { useState, useMemo } from "react";
import { useListModels, useListComponents, useUpdateComponent, Component } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusInfo } from "./workspace";
import { Search, Filter, Loader2, Save, X } from "lucide-react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { getListComponentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Local state for edits
  const [editValues, setEditValues] = useState<{ onHand: number; reserved: number; onOrder: number }>({
    onHand: 0, reserved: 0, onOrder: 0
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateComponent = useUpdateComponent();

  const { data: models = [], isLoading: isLoadingModels } = useListModels();

  const componentQueries = useQueries({
    queries: models.map(model => ({
      // Match the codegen default key so cross-page invalidations cascade.
      queryKey: getListComponentsQueryKey(model.id),
      queryFn: async () => {
        const res = await fetch(`/api/models/${model.id}/components`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        return data.map((c: Component) => ({ ...c, modelName: model.name }));
      },
      enabled: !!model.id,
    }))
  });

  const isLoadingComponents = componentQueries.some(q => q.isLoading);

  const allComponents = useMemo(() => {
    return componentQueries
      .map(q => q.data)
      .filter(Boolean)
      .flat() as (Component & { modelName: string })[];
  }, [componentQueries]);

  const filteredComponents = useMemo(() => {
    return allComponents.filter(c => {
      if (modelFilter !== "all" && c.modelId.toString() !== modelFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        if (!c.code.toLowerCase().includes(query) && 
            !c.partNumber.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (statusFilter !== "all") {
        const info = getStatusInfo(c.onHand, c.reserved);
        if (info.label.toLowerCase() !== statusFilter) return false;
      }
      return true;
    });
  }, [allComponents, search, modelFilter, statusFilter]);

  const startEditing = (comp: Component) => {
    setEditingId(comp.id);
    setEditValues({
      onHand: comp.onHand || 0,
      reserved: comp.reserved || 0,
      onOrder: comp.onOrder || 0
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEditing = async (comp: Component) => {
    try {
      await updateComponent.mutateAsync({
        componentId: comp.id,
        data: {
          onHand: editValues.onHand,
          reserved: editValues.reserved,
          onOrder: editValues.onOrder
        }
      });
      queryClient.invalidateQueries({ queryKey: getListComponentsQueryKey(comp.modelId) });
      toast({ title: "Inventory updated", description: `Updated stock levels for ${comp.code}` });
      setEditingId(null);
    } catch (e) {
      toast({ title: "Update failed", description: "Could not save inventory levels.", variant: "destructive" });
    }
  };

  if (isLoadingModels || isLoadingComponents) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center font-mono">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-xs text-muted-foreground tracking-widest">LOADING INVENTORY...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">INVENTORY MANAGEMENT</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">Live stock levels and quick adjustments</p>
          </div>
        </div>

        <Card className="rounded-none border-border bg-sidebar">
          <CardHeader className="border-b border-border bg-card pb-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 flex items-center bg-background border border-border px-3 h-10 w-full md:w-auto">
                <Search className="h-4 w-4 text-muted-foreground mr-2" />
                <input 
                  type="text" 
                  placeholder="SEARCH CODE OR PART NO..." 
                  className="bg-transparent border-none outline-none text-xs font-mono w-full placeholder:text-muted-foreground"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger className="w-[180px] bg-background border-border rounded-none h-10 font-mono text-xs">
                    <SelectValue placeholder="MODEL" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all" className="font-mono text-xs">ALL MODELS</SelectItem>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()} className="font-mono text-xs">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-background border-border rounded-none h-10 font-mono text-xs">
                    <SelectValue placeholder="STATUS" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all" className="font-mono text-xs">ALL STATUS</SelectItem>
                    <SelectItem value="available" className="font-mono text-xs text-[hsl(var(--status-available))]">AVAILABLE</SelectItem>
                    <SelectItem value="low" className="font-mono text-xs text-[hsl(var(--status-low))]">LOW</SelectItem>
                    <SelectItem value="out" className="font-mono text-xs text-destructive">OUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 pl-6">CODE</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">PART NO</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">MODEL</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">ON HAND</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">RESERVED</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">AVAILABLE</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">ON ORDER</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-center">STATUS</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right pr-6">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.map(comp => {
                  const isEditing = editingId === comp.id;
                  const available = isEditing 
                    ? editValues.onHand - editValues.reserved 
                    : (comp.onHand || 0) - (comp.reserved || 0);
                    
                  return (
                    <TableRow key={`${comp.modelId}-${comp.id}`} className="border-border hover:bg-muted/50 cursor-default">
                      <TableCell className="font-mono text-xs pl-6 font-bold text-accent">{comp.code}</TableCell>
                      <TableCell className="font-mono text-xs">{comp.partNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{comp.modelName}</TableCell>
                      
                      <TableCell className="font-mono text-xs text-right">
                        {isEditing ? (
                          <Input 
                            type="number" 
                            className="w-16 h-7 text-xs font-mono text-right p-1 rounded-none inline-block border-primary bg-background"
                            value={editValues.onHand}
                            onChange={e => setEditValues(v => ({...v, onHand: parseInt(e.target.value) || 0}))}
                          />
                        ) : (
                          comp.onHand || 0
                        )}
                      </TableCell>
                      
                      <TableCell className="font-mono text-xs text-right">
                        {isEditing ? (
                          <Input 
                            type="number" 
                            className="w-16 h-7 text-xs font-mono text-right p-1 rounded-none inline-block border-border bg-background"
                            value={editValues.reserved}
                            onChange={e => setEditValues(v => ({...v, reserved: parseInt(e.target.value) || 0}))}
                          />
                        ) : (
                          comp.reserved || 0
                        )}
                      </TableCell>
                      
                      <TableCell className="font-mono text-xs text-right font-bold text-primary">
                        {available}
                      </TableCell>
                      
                      <TableCell className="font-mono text-xs text-right">
                        {isEditing ? (
                          <Input 
                            type="number" 
                            className="w-16 h-7 text-xs font-mono text-right p-1 rounded-none inline-block border-border bg-background"
                            value={editValues.onOrder}
                            onChange={e => setEditValues(v => ({...v, onOrder: parseInt(e.target.value) || 0}))}
                          />
                        ) : (
                          comp.onOrder || 0
                        )}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <StatusBadge onHand={isEditing ? editValues.onHand : comp.onHand} reserved={isEditing ? editValues.reserved : comp.reserved} />
                      </TableCell>
                      
                      <TableCell className="text-right pr-6">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={cancelEditing}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10" onClick={() => saveEditing(comp)}>
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 rounded-none font-mono text-[10px] border-border" onClick={() => startEditing(comp)}>
                            ADJUST
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredComponents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center font-mono text-xs text-muted-foreground py-12 border-none">
                      NO INVENTORY RECORDS FOUND
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
