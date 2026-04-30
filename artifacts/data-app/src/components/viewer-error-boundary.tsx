import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  resetKey?: string | number | null;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ViewerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Unknown viewer error" };
  }

  componentDidCatch(error: Error) {
    console.error("3D viewer crashed:", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: "" });
    }
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      const isMissingAsset = /Failed to load|Couldn't load|404|Not Found/i.test(this.state.message);
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#1a0f0a_0%,#000_100%)] p-8">
          <div className="z-10 text-center font-mono border border-destructive/40 bg-card/80 p-8 max-w-lg">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg text-foreground mb-2 tracking-widest">VIEWER ERROR</h2>
            {isMissingAsset ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  This GLTF references external files (.bin / textures) that were not uploaded.
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Re-export your model as a single-file <span className="text-primary">.GLB</span> (binary GLTF) and upload it again. GLB packs geometry, materials, and textures into one file.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mb-6 break-words">{this.state.message}</p>
            )}
            <Button
              variant="outline"
              className="rounded-none border-border font-mono text-xs"
              onClick={this.reset}
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              RETRY
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
