import { useListModels } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, Download, Box, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Documents() {
  const { data: models = [], isLoading } = useListModels();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center font-mono">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-xs text-muted-foreground tracking-widest">LOADING DOCUMENTS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">DOCUMENTATION</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">Uploaded 3D models and associated specification files</p>
          </div>
        </div>

        <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-primary">
          <CardHeader className="border-b border-border bg-card pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-mono tracking-widest text-foreground uppercase">3D MODEL REPOSITORY</CardTitle>
                <CardDescription className="text-xs font-mono mt-1">
                  All GLTF/GLB models uploaded to the system act as documentation assets.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 pl-6">FILE NAME</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10">SYSTEM NAME</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">SIZE</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right">UPLOADED</TableHead>
                  <TableHead className="font-mono text-[10px] text-muted-foreground h-10 text-right pr-6">DOWNLOAD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map(model => (
                  <TableRow key={model.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-mono text-xs pl-6">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold text-accent">{model.fileName || `${model.name}.gltf`}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{model.name}</TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {model.fileSize ? `${(model.fileSize / 1024 / 1024).toFixed(2)} MB` : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {format(new Date(model.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="outline" size="sm" className="h-8 rounded-none font-mono text-[10px] border-border" asChild>
                        <a href={`/api/storage${model.objectPath}`} download target="_blank" rel="noreferrer">
                          <Download className="h-3 w-3 mr-2" />
                          DOWNLOAD
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {models.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center font-mono text-xs text-muted-foreground py-12 border-none">
                      NO DOCUMENTS AVAILABLE. UPLOAD A MODEL TO BEGIN.
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
