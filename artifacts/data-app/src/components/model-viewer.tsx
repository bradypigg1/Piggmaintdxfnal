import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

interface ModelViewerProps {
  url: string;
  selectedMeshName: string | null;
  taggedMeshNames: Set<string>;
  onMeshClick: (meshName: string) => void;
}

const HIGHLIGHT_COLOR = new THREE.Color("#ff6a00");
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
  taggedMeshNames,
  onMeshClick,
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

  // Apply highlight to the selected mesh and a softer tint to tagged meshes.
  useEffect(() => {
    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Walk up to find the "name" we'd attribute clicks to.
      const ancestorName = findNamedAncestor(mesh);
      const isSelected =
        !!selectedMeshName && ancestorName === selectedMeshName;
      const isTagged = !!ancestorName && taggedMeshNames.has(ancestorName);

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat, idx) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (!m || !("emissive" in m) || !m.emissive) return;
        const orig = originalsRef.current.get(`${mesh.uuid}:${idx}`);

        if (isSelected) {
          m.emissive.copy(HIGHLIGHT_COLOR);
          m.emissiveIntensity = 0.9;
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
  }, [clonedScene, selectedMeshName, taggedMeshNames]);

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
