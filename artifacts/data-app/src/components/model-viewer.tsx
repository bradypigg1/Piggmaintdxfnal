import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

interface ModelViewerProps {
  url: string;
  selectedMeshName: string | null;
  previewMeshName: string | null;
  taggedMeshNames: Set<string>;
  onMeshClick: (meshName: string) => void;
  /**
   * 0 = fully assembled, 1 = fully exploded. Each top-level part is pushed
   * outward from the model's bounding-box center along the vector to its own
   * center. Common CAD-viewer behavior.
   */
  explodeFactor?: number;
}

interface ExplodePart {
  obj: THREE.Object3D;
  originalPos: THREE.Vector3;
  offsetDir: THREE.Vector3; // direction * distance from scene center, in parent-local space
}

const HIGHLIGHT_COLOR = new THREE.Color("#ff6a00");
const PREVIEW_COLOR = new THREE.Color("#38bdf8");
const TAGGED_COLOR = new THREE.Color("#3b82f6");
const NEUTRAL = new THREE.Color("#000000");

interface OriginalMaterialState {
  emissive: THREE.Color;
  emissiveIntensity: number;
}

/**
 * Walk up the parent chain to find the closest named ancestor. GLTF often
 * has the meaningful name on a parent group rather than the leaf mesh.
 */
function findNamedAncestor(obj: THREE.Object3D | null): string | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current.name && current.name.length > 0) return current.name;
    current = current.parent;
  }
  return null;
}

export function ModelViewer({
  url,
  selectedMeshName,
  previewMeshName,
  taggedMeshNames,
  onMeshClick,
  explodeFactor = 0,
}: ModelViewerProps) {
  const { scene } = useGLTF(url);

  // Clone the scene + materials so per-instance highlight changes don't
  // leak across other consumers of the cached useGLTF result.
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
    return cloned;
  }, [scene]);

  // Dispose cloned materials when the cloned scene changes or on unmount, so
  // GPU memory does not accumulate when the user switches between models.
  useEffect(() => {
    const sceneToCleanup = clonedScene;
    return () => {
      sceneToCleanup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (mat && typeof mat.dispose === "function") mat.dispose();
        });
      });
      // Reset cursor in case the user unmounts mid-hover.
      if (typeof document !== "undefined") {
        document.body.style.cursor = "auto";
      }
    };
  }, [clonedScene]);

  // Capture original emissive values once per cloned scene so we can restore them.
  const originalsRef = useRef<Map<string, OriginalMaterialState>>(new Map());
  useEffect(() => {
    const map = new Map<string, OriginalMaterialState>();
    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat, idx) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (m && "emissive" in m && m.emissive) {
          map.set(`${mesh.uuid}:${idx}`, {
            emissive: m.emissive.clone(),
            emissiveIntensity: m.emissiveIntensity ?? 1,
          });
        }
      });
    });
    originalsRef.current = map;
  }, [clonedScene]);

  // Compute explode parts when the cloned scene changes. We pick the first
  // tree level that has multiple children (collapsing single-child chains)
  // so a model wrapped in one root group still explodes meaningfully.
  const explodePartsRef = useRef<ExplodePart[]>([]);
  useEffect(() => {
    const sceneBox = new THREE.Box3().setFromObject(clonedScene);
    const sceneCenter = sceneBox.getCenter(new THREE.Vector3());

    let level: THREE.Object3D = clonedScene;
    while (level.children.length === 1) {
      level = level.children[0];
    }

    const targets = level.children.filter((c) => {
      let hasMesh = false;
      c.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) hasMesh = true;
      });
      return hasMesh;
    });

    const parts: ExplodePart[] = targets.map((obj) => {
      const box = new THREE.Box3().setFromObject(obj);
      const childCenterWorld = box.getCenter(new THREE.Vector3());

      // obj.position is in parent-local space. Convert both centers to that
      // same space so the direction we add to obj.position has the correct
      // basis even when an ancestor has rotation or non-unit scale (common
      // in CAD GLTF exports). worldToLocal mutates its arg, so clone first.
      const parent = obj.parent ?? clonedScene;
      const childCenterLocal = parent.worldToLocal(childCenterWorld.clone());
      const sceneCenterLocal = parent.worldToLocal(sceneCenter.clone());
      const offsetDir = childCenterLocal.sub(sceneCenterLocal);

      // If a part sits exactly at the centroid, push it gently up so the
      // user can still see it separate from neighbors.
      if (offsetDir.length() < 0.001) {
        offsetDir.set(0, 1, 0).multiplyScalar(0.25);
      }
      return {
        obj,
        originalPos: obj.position.clone(),
        offsetDir,
      };
    });

    explodePartsRef.current = parts;

    return () => {
      // Restore positions on unmount or before recomputing for a new scene.
      parts.forEach((p) => p.obj.position.copy(p.originalPos));
    };
  }, [clonedScene]);

  // Re-apply explode translation whenever the factor changes. Multiplier
  // controls how aggressively parts spread; 1.0 already moves a part its
  // own bbox-distance away from center.
  useEffect(() => {
    explodePartsRef.current.forEach(({ obj, originalPos, offsetDir }) => {
      obj.position.copy(originalPos).addScaledVector(offsetDir, explodeFactor);
    });
  }, [explodeFactor, clonedScene]);

  // Apply highlight to the selected mesh and a softer tint to tagged meshes.
  useEffect(() => {
    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Walk up to find the "name" we'd attribute clicks to.
      const ancestorName = findNamedAncestor(mesh);
      const isSelected =
        !!selectedMeshName && ancestorName === selectedMeshName;
      const isPreview =
        !!previewMeshName && ancestorName === previewMeshName;
      const isTagged = !!ancestorName && taggedMeshNames.has(ancestorName);

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat, idx) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (!m || !("emissive" in m) || !m.emissive) return;
        const orig = originalsRef.current.get(`${mesh.uuid}:${idx}`);

        if (isSelected) {
          m.emissive.copy(HIGHLIGHT_COLOR);
          m.emissiveIntensity = 0.9;
        } else if (isPreview) {
          m.emissive.copy(PREVIEW_COLOR);
          m.emissiveIntensity = 0.75;
        } else if (isTagged) {
          m.emissive.copy(TAGGED_COLOR);
          m.emissiveIntensity = 0.35;
        } else if (orig) {
          m.emissive.copy(orig.emissive);
          m.emissiveIntensity = orig.emissiveIntensity;
        } else {
          m.emissive.copy(NEUTRAL);
          m.emissiveIntensity = 0;
        }
        m.needsUpdate = true;
      });
    });
  }, [clonedScene, selectedMeshName, previewMeshName, taggedMeshNames]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const name = findNamedAncestor(e.object);
    if (name) onMeshClick(name);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  return (
    <primitive
      object={clonedScene}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}
