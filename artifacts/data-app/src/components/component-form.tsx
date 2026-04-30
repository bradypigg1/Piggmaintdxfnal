import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateComponent, 
  useUpdateComponent,
  getListComponentsQueryKey,
  Component
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2 } from "lucide-react";

const formSchema = z.object({
  code: z.string().min(1, "Code is required"),
  description: z.string().min(1, "Description is required"),
  partNumber: z.string().min(1, "Part number is required"),
  meshName: z.string().optional(),
  manufacturer: z.string().optional(),
  weightKg: z.coerce.number().optional(),
  connectionType: z.string().optional(),
  wrenchSize: z.string().optional(),
  lengthMm: z.coerce.number().optional(),
  toolsRequired: z.string().optional(),
  toolSize: z.string().optional(),
  qtyRequired: z.coerce.number().min(0).optional(),
  onHand: z.coerce.number().min(0).optional(),
  reserved: z.coerce.number().min(0).optional(),
  onOrder: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ComponentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: number;
  componentToEdit?: Component;
  /** When opening from a 3D click, prefill the mesh link + suggested code/description. */
  prefilledMeshName?: string | null;
  onSuccess: (component: Component) => void;
}

function suggestCodeFromMesh(meshName: string): string {
  // Convert "Cylinder_001" / "engine-block.001" → "CYLINDER-001"
  return meshName
    .replace(/[._]+/g, "-")
    .replace(/[^a-zA-Z0-9\- ]/g, "")
    .toUpperCase()
    .slice(0, 24);
}

export function ComponentForm({ open, onOpenChange, modelId, componentToEdit, prefilledMeshName, onSuccess }: ComponentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createComponent = useCreateComponent();
  const updateComponent = useUpdateComponent();
  const isPending = createComponent.isPending || updateComponent.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      description: "",
      partNumber: "",
      meshName: "",
      manufacturer: "",
      weightKg: undefined,
      connectionType: "",
      wrenchSize: "",
      lengthMm: undefined,
      toolsRequired: "",
      toolSize: "",
      qtyRequired: 1,
      onHand: 0,
      reserved: 0,
      onOrder: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (componentToEdit && open) {
      form.reset({
        code: componentToEdit.code,
        description: componentToEdit.description,
        partNumber: componentToEdit.partNumber,
        meshName: componentToEdit.meshName || "",
        manufacturer: componentToEdit.manufacturer || "",
        weightKg: componentToEdit.weightKg || undefined,
        connectionType: componentToEdit.connectionType || "",
        wrenchSize: componentToEdit.wrenchSize || "",
        lengthMm: componentToEdit.lengthMm || undefined,
        toolsRequired: componentToEdit.toolsRequired || "",
        toolSize: componentToEdit.toolSize || "",
        qtyRequired: componentToEdit.qtyRequired ?? 1,
        onHand: componentToEdit.onHand || 0,
        reserved: componentToEdit.reserved || 0,
        onOrder: componentToEdit.onOrder || 0,
        notes: componentToEdit.notes || "",
      });
    } else if (open) {
      const suggested = prefilledMeshName ? suggestCodeFromMesh(prefilledMeshName) : "";
      form.reset({
        code: suggested,
        description: prefilledMeshName ?? "",
        partNumber: "",
        meshName: prefilledMeshName ?? "",
        manufacturer: "",
        weightKg: undefined,
        connectionType: "",
        wrenchSize: "",
        lengthMm: undefined,
        toolsRequired: "",
        toolSize: "",
        qtyRequired: 1,
        onHand: 0,
        reserved: 0,
        onOrder: 0,
        notes: "",
      });
    }
  }, [componentToEdit, open, prefilledMeshName, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      let result: Component;
      if (componentToEdit) {
        result = await updateComponent.mutateAsync({
          componentId: componentToEdit.id,
          data: values
        });
        toast({ title: "Component updated", description: "Component changes saved successfully." });
      } else {
        result = await createComponent.mutateAsync({
          id: modelId,
          data: values
        });
        toast({ title: "Component added", description: "New component added to model." });
      }
      
      queryClient.invalidateQueries({ queryKey: getListComponentsQueryKey(modelId) });
      onSuccess(result);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "There was an error saving the component.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] border-border bg-card rounded-none h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-mono text-primary tracking-widest">
            {componentToEdit ? "EDIT COMPONENT" : "ADD NEW COMPONENT"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {componentToEdit ? "Update component specifications and inventory levels." : "Catalog a new part for this model."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">

              <FormField control={form.control} name="meshName" render={({ field }) => (
                field.value ? (
                  <FormItem>
                    <div className="flex items-center gap-2 border border-primary/50 bg-primary/5 px-3 py-2 font-mono text-[11px]">
                      <Link2 className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-muted-foreground tracking-widest">LINKED MESH</span>
                      <span className="text-primary truncate flex-1" title={field.value}>{field.value}</span>
                    </div>
                  </FormItem>
                ) : <FormItem className="hidden" />
              )} />

              <div className="space-y-4">
                <h4 className="text-xs font-mono tracking-widest border-b border-border pb-1">BASIC INFO</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">CODE (e.g. CYL-01)</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="partNumber" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">PART NUMBER</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">DESCRIPTION</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="manufacturer" render={({ field }) => (
                  <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">MANUFACTURER</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-mono tracking-widest border-b border-border pb-1">SPECIFICATIONS</h4>
                <div className="grid grid-cols-4 gap-4">
                  <FormField control={form.control} name="qtyRequired" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">QTY REQ. / ASSY</FormLabel><FormControl><Input type="number" min="0" className="rounded-none font-mono text-xs bg-input" {...field} value={field.value === undefined ? 1 : field.value} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="connectionType" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">CONNECTION</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="lengthMm" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">LENGTH (mm)</FormLabel><FormControl><Input type="number" className="rounded-none font-mono text-xs bg-input" {...field} value={field.value === undefined ? '' : field.value} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="weightKg" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">WEIGHT (kg)</FormLabel><FormControl><Input type="number" step="0.1" className="rounded-none font-mono text-xs bg-input" {...field} value={field.value === undefined ? '' : field.value} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-mono tracking-widest border-b border-border pb-1">TOOLING</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="toolsRequired" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">REQUIRED TOOL</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="toolSize" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">TOOL SIZE</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="wrenchSize" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">WRENCH SIZE</FormLabel><FormControl><Input className="rounded-none font-mono text-xs bg-input" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-mono tracking-widest border-b border-border pb-1">INVENTORY</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="onHand" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">ON HAND</FormLabel><FormControl><Input type="number" className="rounded-none font-mono text-xs bg-input text-primary font-bold" {...field} value={field.value === undefined ? 0 : field.value} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="reserved" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">RESERVED</FormLabel><FormControl><Input type="number" className="rounded-none font-mono text-xs bg-input" {...field} value={field.value === undefined ? 0 : field.value} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="onOrder" render={({ field }) => (
                    <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">ON ORDER</FormLabel><FormControl><Input type="number" className="rounded-none font-mono text-xs bg-input" {...field} value={field.value === undefined ? 0 : field.value} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-mono tracking-widest border-b border-border pb-1">SERVICE NOTES</h4>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel className="font-mono text-[10px] text-muted-foreground">NOTES</FormLabel><FormControl><Textarea className="rounded-none font-mono text-xs bg-input min-h-[100px] resize-none" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

            </div>
            
            <DialogFooter className="mt-6 pt-4 border-t border-border shrink-0">
              <Button type="button" variant="outline" className="rounded-none font-mono text-xs border-border" onClick={() => onOpenChange(false)}>CANCEL</Button>
              <Button type="submit" disabled={isPending} className="rounded-none font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {componentToEdit ? "SAVE CHANGES" : "ADD COMPONENT"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
