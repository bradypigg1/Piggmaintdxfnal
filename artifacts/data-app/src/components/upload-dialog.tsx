import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRequestUploadUrl,
  useCreateModel,
  getListModelsQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, FileBox, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  projectName: z.string().optional(),
  modelName: z.string().optional(),
  serialNumber: z.string().optional(),
  revision: z.string().optional(),
  notes: z.string().optional(),
});

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (modelId: number) => void;
}

const SAFE_FILENAME_RE = /^[\w.\- ]+$/;

function findMainFile(files: File[]): File | null {
  return (
    files.find((f) => /\.glb$/i.test(f.name)) ??
    files.find((f) => /\.gltf$/i.test(f.name)) ??
    null
  );
}

function contentTypeFor(name: string, fallback: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".bin")) return "application/octet-stream";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ktx2")) return "image/ktx2";
  return fallback || "application/octet-stream";
}

export function UploadDialog({ open, onOpenChange, onSuccess }: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<"select" | "details" | "uploading">("select");
  const [progress, setProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const requestUrl = useRequestUploadUrl();
  const createModel = useCreateModel();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      projectName: "",
      modelName: "",
      serialNumber: "",
      revision: "",
      notes: "",
    },
  });

  const reset = () => {
    setFiles([]);
    setStep("select");
    setProgress({ done: 0, total: 0, current: "" });
    form.reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const invalid = selected.find((f) => !SAFE_FILENAME_RE.test(f.name));
    if (invalid) {
      toast({
        title: "Invalid filename",
        description: `"${invalid.name}" contains characters that aren't allowed. Use letters, numbers, dot, dash, underscore, and spaces only.`,
        variant: "destructive",
      });
      return;
    }

    const main = findMainFile(selected);
    if (!main) {
      toast({
        title: "No model file",
        description: "Include exactly one .glb or .gltf file along with any textures and .bin files.",
        variant: "destructive",
      });
      return;
    }

    const mains = selected.filter((f) => /\.(glb|gltf)$/i.test(f.name));
    if (mains.length > 1) {
      toast({
        title: "Too many model files",
        description: "Select only one .glb or .gltf as the main model. Other files should be textures or .bin.",
        variant: "destructive",
      });
      return;
    }

    setFiles(selected);
    const baseName = main.name.replace(/\.(gltf|glb)$/i, "");
    form.setValue("name", baseName);
    form.setValue("modelName", baseName);
    setStep("details");
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const main = findMainFile(files);
    if (!main) return;

    try {
      setStep("uploading");
      setProgress({ done: 0, total: files.length, current: main.name });

      // Generate a bundle id client-side. All sibling files go into the same folder
      // so the GLTFLoader can resolve relative URLs.
      const bundleId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      let mainObjectPath: string | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ done: i, total: files.length, current: file.name });

        const ct = contentTypeFor(file.name, file.type);
        const { uploadURL, objectPath } = await requestUrl.mutateAsync({
          data: {
            name: file.name,
            size: file.size,
            contentType: ct,
            bundleId,
            filename: file.name,
          },
        });

        const res = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": ct },
          body: file,
        });
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);

        if (file === main) mainObjectPath = objectPath;
      }

      if (!mainObjectPath) throw new Error("Main model file path not captured");

      setProgress({ done: files.length, total: files.length, current: "Saving model..." });

      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const model = await createModel.mutateAsync({
        data: {
          ...values,
          objectPath: mainObjectPath,
          fileName: main.name,
          fileSize: totalSize,
        },
      });

      queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
      toast({
        title: "Upload complete",
        description: `${files.length} file${files.length === 1 ? "" : "s"} uploaded successfully.`,
      });
      onSuccess(model.id);
      reset();
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "There was an error uploading your model.",
        variant: "destructive",
      });
      setStep("details");
    }
  };

  const main = findMainFile(files);
  const siblings = files.filter((f) => f !== main);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-[560px] border-border bg-card rounded-none">
        <DialogHeader>
          <DialogTitle className="font-mono text-primary tracking-widest">UPLOAD MODEL</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Add a new 3D model to the workspace.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="border-2 border-dashed border-border p-10 flex flex-col items-center justify-center text-center">
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-mono text-sm mb-2 text-foreground">SELECT MODEL FILE(S)</h3>
            <p className="font-mono text-xs text-muted-foreground mb-1">
              Single <span className="text-primary">.glb</span> — or <span className="text-primary">.gltf</span> + its <span className="text-primary">.bin</span> + textures.
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/70 mb-6 max-w-sm">
              For .gltf, select the .gltf file together with all referenced files (textures, .bin) so they upload as a bundle and resolve correctly.
            </p>
            <div className="relative">
              <input
                type="file"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".glb,.gltf,.bin,image/png,image/jpeg,image/webp,.ktx2,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
              />
              <Button className="rounded-none font-mono text-xs">CHOOSE FILES</Button>
            </div>
          </div>
        )}

        {step === "details" && main && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="border border-border bg-background/50 p-3 space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <FileBox className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-primary truncate flex-1">{main.name}</span>
                  <span className="text-muted-foreground">{(main.size / 1024).toFixed(1)} KB</span>
                  <span className="text-[10px] text-primary tracking-widest">MAIN</span>
                </div>
                {siblings.map((f, idx) => {
                  const realIdx = files.indexOf(f);
                  return (
                    <div key={f.name + idx} className="flex items-center gap-2 font-mono text-xs">
                      <span className="h-4 w-4 shrink-0" />
                      <span className="text-foreground truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => removeFile(realIdx)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {/\.gltf$/i.test(main.name) && siblings.length === 0 && (
                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-border/50 text-[10px] font-mono text-amber-400/90">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>You selected a .gltf without any siblings. If it references external textures or .bin files, the model will fail to render. Go back and add them now, or re-export as .glb.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] tracking-widest text-muted-foreground">SYSTEM NAME</FormLabel>
                      <FormControl><Input className="rounded-none font-mono text-xs bg-input border-border" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] tracking-widest text-muted-foreground">PROJECT</FormLabel>
                      <FormControl><Input className="rounded-none font-mono text-xs bg-input border-border" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="modelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] tracking-widest text-muted-foreground">MODEL</FormLabel>
                      <FormControl><Input className="rounded-none font-mono text-xs bg-input border-border" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] tracking-widest text-muted-foreground">S/N</FormLabel>
                      <FormControl><Input className="rounded-none font-mono text-xs bg-input border-border" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="revision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] tracking-widest text-muted-foreground">REVISION</FormLabel>
                      <FormControl><Input className="rounded-none font-mono text-xs bg-input border-border" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-[10px] tracking-widest text-muted-foreground">NOTES</FormLabel>
                    <FormControl><Textarea className="rounded-none font-mono text-xs bg-input border-border resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" className="rounded-none font-mono text-xs border-border" onClick={() => setStep("select")}>BACK</Button>
                <Button type="submit" className="rounded-none font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                  START UPLOAD ({files.length} FILE{files.length === 1 ? "" : "S"})
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {step === "uploading" && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <h3 className="font-mono text-sm mb-2 text-foreground">UPLOADING BUNDLE</h3>
            <p className="font-mono text-xs text-muted-foreground mb-4 truncate max-w-xs">{progress.current}</p>
            <div className="w-64 h-1 bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-2">
              {progress.done} / {progress.total}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
