import { useState, useMemo } from "react";
import { useListModels, useListComponents, Component, Model } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, getStatusInfo } from "./workspace";
import { Search, Filter, Loader2 } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

export default function Parts() {
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: models = [], isLoading: isLoadingModels } = useListModels();

  // Fetch components for all models
  const componentQueries = useQueries({
    queries: models.map(model => ({
      queryKey: [`/api/models/${model.id}/components`],
      queryFn: async () => {
        const res = await fetch(`/api/models/${model.id}/components`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        // Add model context
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
            !c.description.toLowerCase().includes(query) && 
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

  if (isLoadingModels || isLoadingComponents) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center font-mono">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-xs text-muted-foreground tracking-widest">LOADING CATALOG...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">PARTS CATALOG</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">Global registry of all model components</p>
          </div>
        </div>

        <Card className="rounded-none border-border bg-sidebar">
          <CardHeader className="border-b border-border bg-card pb-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 flex items-center bg-background border border-border px-3 h-10 w-full md:w-auto">
                <Search className="h-4 w-4 text-muted-foreground mr-2" />
                <input 
                  type="text" 
                  placeholder="SEARCH CODE, DESC, OR PART NO..." 
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
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 pl-6 w-[120px]">CODE</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">DESCRIPTION</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">PART NUMBER</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">MODEL</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">MFG</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right pr-6">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.map(comp => (
                  <TableRow key={`${comp.modelId}-${comp.id}`} className="border-border hover:bg-muted/50 cursor-default">
                    <TableCell className="font-mono text-xs pl-6 font-bold text-accent">{comp.code}</TableCell>
                    <TableCell className="font-mono text-xs">{comp.description}</TableCell>
                    <TableCell className="font-mono text-xs">{comp.partNumber}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{comp.modelName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{comp.manufacturer || '-'}</TableCell>
                    <TableCell className="text-right pr-6">
                      <StatusBadge onHand={comp.onHand} reserved={comp.reserved} />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredComponents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center font-mono text-xs text-muted-foreground py-12 border-none">
                      NO COMPONENTS FOUND MATCHING FILTERS
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
