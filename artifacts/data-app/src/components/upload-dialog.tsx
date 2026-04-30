import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useRequestUploadUrl, 
  useCreateModel, 
  getListModelsQueryKey 
} from "@workspace/api-client-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
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

export function UploadDialog({ open, onOpenChange, onSuccess }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"select" | "details" | "uploading">("select");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const lower = selected.name.toLowerCase();
      if (!lower.endsWith('.glb')) {
        toast({
          title: "GLB format required",
          description: ".gltf files reference external textures and meshes. Re-export as a single-file .glb (binary GLTF) to upload.",
          variant: "destructive",
        });
        return;
      }
      setFile(selected);
      form.setValue("name", selected.name.replace(/\.glb$/i, ''));
      form.setValue("modelName", selected.name.replace(/\.glb$/i, ''));
      setStep("details");
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!file) return;
    
    try {
      setStep("uploading");
      
      // 1. Request URL
      const { uploadURL, objectPath } = await requestUrl.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream"
        }
      });
      
      // 2. Upload to GCS
      const res = await fetch(uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file
      });
      
      if (!res.ok) throw new Error("Failed to upload to storage");
      
      // 3. Create Model Record
      const model = await createModel.mutateAsync({
        data: {
          ...values,
          objectPath,
          fileName: file.name,
          fileSize: file.size
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
      toast({ title: "Upload complete", description: "Model has been successfully uploaded." });
      onSuccess(model.id);
      
    } catch (error) {
      console.error(error);
      toast({ title: "Upload failed", description: "There was an error uploading your model.", variant: "destructive" });
      setStep("details");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border bg-card rounded-none">
        <DialogHeader>
          <DialogTitle className="font-mono text-primary tracking-widest">UPLOAD GLTF/GLB MODEL</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Add a new 3D model to the workspace.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="border-2 border-dashed border-border p-12 flex flex-col items-center justify-center text-center">
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-mono text-sm mb-2 text-foreground">SELECT OR DROP MODEL FILE</h3>
            <p className="font-mono text-xs text-muted-foreground mb-2">Single-file binary GLTF (<span className="text-primary">.glb</span>) up to 100MB.</p>
            <p className="font-mono text-[10px] text-muted-foreground/70 mb-6 max-w-xs">.gltf files reference external textures and meshes — re-export as .glb to bundle everything.</p>
            <div className="relative">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                accept=".glb,model/gltf-binary"
                onChange={handleFileChange}
              />
              <Button className="rounded-none font-mono text-xs">CHOOSE FILE</Button>
            </div>
          </div>
        )}

        {step === "details" && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Button type="submit" className="rounded-none font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">START UPLOAD</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {step === "uploading" && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <h3 className="font-mono text-sm mb-2 text-foreground">UPLOADING MODEL</h3>
            <p className="font-mono text-xs text-muted-foreground">Please wait while the file is processed...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
