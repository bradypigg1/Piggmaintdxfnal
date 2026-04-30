import { useMemo } from "react";
import { useListModels, Component } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Loader2 } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

export default function Tools() {
  const { data: models = [], isLoading: isLoadingModels } = useListModels();

  const componentQueries = useQueries({
    queries: models.map(model => ({
      queryKey: [`/api/models/${model.id}/components`],
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

  const toolsList = useMemo(() => {
    const allComponents = componentQueries
      .map(q => q.data)
      .filter(Boolean)
      .flat() as (Component & { modelName: string })[];

    const grouped = allComponents.reduce((acc, comp) => {
      const toolReq = comp.toolsRequired || "Unspecified";
      const toolSize = comp.toolSize || "N/A";
      const key = `${toolReq}:::${toolSize}`;

      if (!acc[key]) {
        acc[key] = {
          tool: toolReq,
          size: toolSize,
          components: []
        };
      }
      acc[key].components.push(comp);
      return acc;
    }, {} as Record<string, { tool: string; size: string; components: (Component & { modelName: string })[] }>);

    return Object.values(grouped).sort((a, b) => a.tool.localeCompare(b.tool));
  }, [componentQueries]);

  if (isLoadingModels || isLoadingComponents) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center font-mono">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-xs text-muted-foreground tracking-widest">LOADING TOOLING DATA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">REQUIRED TOOLING</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">Tools required for field maintenance, derived from component specifications</p>
          </div>
        </div>

        {toolsList.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border text-muted-foreground font-mono text-sm">
            NO TOOLING DATA AVAILABLE
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {toolsList.map((group, idx) => (
              <Card key={idx} className="rounded-none border-border bg-sidebar">
                <CardHeader className="border-b border-border bg-card pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-mono tracking-widest text-foreground uppercase">{group.tool}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-1">SIZE: {group.size}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-[10px] text-muted-foreground h-8 pl-6">USED ON COMPONENT</TableHead>
                        <TableHead className="font-mono text-[10px] text-muted-foreground h-8">PART NO</TableHead>
                        <TableHead className="font-mono text-[10px] text-muted-foreground h-8">MODEL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.components.map(comp => (
                        <TableRow key={comp.id} className="border-border hover:bg-muted/50 cursor-default">
                          <TableCell className="font-mono text-xs pl-6">
                            <span className="font-bold text-accent mr-2">{comp.code}</span>
                            {comp.description}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{comp.partNumber}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{comp.modelName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
