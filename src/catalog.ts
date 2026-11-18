import {
  Shrink,
  Combine,
  Scissors,
  Files,
  RotateCw,
  FileImage,
  Images,
  LockKeyhole,
  LockKeyholeOpen,
  Stamp,
  Eraser,
  ScanEye,
  type LucideIcon,
} from 'lucide-react';
import type { ToolId } from './engine/types';
export interface Tool {
  id: ToolId;
  label: string;
  desc: string;
  action: string;
  group: string;
  icon: LucideIcon;
  color: string;
}
export const tools: Tool[] = [
  {
    id: 'compress',
    label: 'Compress PDF',
    desc: 'Reduce file size while keeping the details that matter.',
    action: 'Compress PDFs',
    group: 'Optimize',
    icon: Shrink,
    color: 'blue',
  },
  {
    id: 'merge',
    label: 'Merge PDFs',
    desc: 'Bring multiple documents together in your chosen order.',
    action: 'Merge PDFs',
    group: 'Organize',
    icon: Combine,
    color: 'violet',
  },
  {
    id: 'split',
    label: 'Split PDF',
    desc: 'Separate a document into smaller, page-based parts.',
    action: 'Split PDF',
    group: 'Organize',
    icon: Scissors,
    color: 'orange',
  },
  {
    id: 'extract',
    label: 'Extract pages',
    desc: 'Keep just the pages you need in a new document.',
    action: 'Extract pages',
    group: 'Organize',
    icon: Files,
    color: 'blue',
  },
  {
    id: 'organize',
    label: 'Organize pages',
    desc: 'Reorder, remove and rotate pages in one place.',
    action: 'Save arrangement',
    group: 'Organize',
    icon: RotateCw,
    color: 'violet',
  },
  {
    id: 'to-images',
    label: 'PDF to images',
    desc: 'Export pages as crisp PNG, JPEG or WebP images.',
    action: 'Export images',
    group: 'Convert',
    icon: FileImage,
    color: 'teal',
  },
  {
    id: 'from-images',
    label: 'Images to PDF',
    desc: 'Turn a collection of images into a single PDF.',
    action: 'Create PDF',
    group: 'Convert',
    icon: Images,
    color: 'teal',
  },
  {
    id: 'protect',
    label: 'Protect PDF',
    desc: 'Secure a copy of your document with AES-256 encryption.',
    action: 'Protect PDF',
    group: 'Security',
    icon: LockKeyhole,
    color: 'rose',
  },
  {
    id: 'unlock',
    label: 'Unlock PDF',
    desc: 'Remove protection using an authorized password.',
    action: 'Unlock PDF',
    group: 'Security',
    icon: LockKeyholeOpen,
    color: 'orange',
  },
  {
    id: 'watermark',
    label: 'Add watermark',
    desc: 'Place a translucent text watermark on every page.',
    action: 'Add watermark',
    group: 'Organize',
    icon: Stamp,
    color: 'violet',
  },
  {
    id: 'metadata',
    label: 'Remove metadata',
    desc: 'Remove document properties and embedded XMP metadata.',
    action: 'Clean metadata',
    group: 'Security',
    icon: Eraser,
    color: 'teal',
  },
  {
    id: 'preview',
    label: 'Preview PDF',
    desc: 'Read and inspect document pages without uploading.',
    action: 'Open preview',
    group: 'Organize',
    icon: ScanEye,
    color: 'blue',
  },
];
export const getTool = (id: ToolId) => tools.find((t) => t.id === id)!;
