import { File, Folder } from "lucide-react";
import type { FileNode } from "@/lib/types";

function formatSize(bytes?: number) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function Row({ node, depth }: { node: FileNode; depth: number }) {
  return (
    <>
      <li>
        <div
          className="flex items-center gap-2 border-b border-rule px-3 py-1.5 text-[13px] last:border-b-0"
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          {node.type === "dir" ? (
            <Folder className="size-3.5 shrink-0 text-accent" />
          ) : (
            <File className="size-3.5 shrink-0 text-ink-faint" />
          )}
          <span className="font-mono text-ink">{node.name}</span>
          <span className="ml-auto font-mono text-[12px] text-ink-faint">
            {formatSize(node.size)}
          </span>
        </div>
      </li>
      {node.children?.map((child) => (
        <Row key={`${node.name}/${child.name}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function FileTree({ nodes }: { nodes: FileNode[] }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule bg-card">
      {nodes.map((n) => (
        <Row key={n.name} node={n} depth={0} />
      ))}
    </ul>
  );
}
