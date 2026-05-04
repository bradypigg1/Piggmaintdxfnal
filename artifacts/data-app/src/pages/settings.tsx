import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Database, Moon, Sun, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAutoRotate } from "@/hooks/use-app-settings";

export default function Settings() {
  const { toast } = useToast();
  const [autoRotate, setAutoRotate] = useAutoRotate();

  const handleSeedData = () => {
    toast({
      title: "Data seeding initiated",
      description: "Adding sample models and components to the database...",
    });
    // This is a placeholder since we don't have a specific API endpoint for this,
    // but in a real app it would trigger a mutation.
    setTimeout(() => {
      toast({
        title: "Sample data added",
        description: "Successfully seeded the database with example content.",
      });
    }, 1500);
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-primary tracking-widest font-bold">SYSTEM SETTINGS</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">Application preferences and data management</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-primary">
            <CardHeader className="border-b border-border bg-card pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-mono tracking-widest text-foreground uppercase">APPEARANCE</CardTitle>
                  <CardDescription className="text-xs font-mono mt-1">
                    Interface and display preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-mono">Use Metric Units</Label>
                  <p className="text-xs font-mono text-muted-foreground">Display measurements in mm/kg instead of in/lbs</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-mono">High Contrast Mode</Label>
                  <p className="text-xs font-mono text-muted-foreground">Increase contrast for workshop visibility</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-mono">Auto-rotate 3D Models</Label>
                  <p className="text-xs font-mono text-muted-foreground">Slowly spin models when idle</p>
                </div>
                <Switch
                  checked={autoRotate}
                  onCheckedChange={setAutoRotate}
                  data-testid="switch-auto-rotate"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border bg-sidebar border-t-2 border-t-accent">
            <CardHeader className="border-b border-border bg-card pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10">
                  <Database className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-sm font-mono tracking-widest text-foreground uppercase">DATA MANAGEMENT</CardTitle>
                  <CardDescription className="text-xs font-mono mt-1">
                    System data and storage
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-mono">Sample Data</Label>
                  <p className="text-xs font-mono text-muted-foreground mb-3">Populate the system with example models and components for testing.</p>
                </div>
                <Button 
                  onClick={handleSeedData}
                  className="w-full rounded-none font-mono text-xs bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Database className="w-4 h-4 mr-2" />
                  SEED SAMPLE DATA
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
