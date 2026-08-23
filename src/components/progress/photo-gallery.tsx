'use client';

import * as React from 'react';
import Image from 'next/image';
import { Download, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/common/empty-state';
import {
  createPhotoDownloadUrl,
  deleteProgressPhoto,
  uploadProgressPhoto,
} from '@/server/actions/progress';
import type { Enums } from '@/lib/db/database.types';
import type { ProgressPhotoWithUrl } from '@/services/progress';
import { EMPTY_STATES } from '@/lib/domain/copy';
import { formatDateKey } from '@/lib/date';

const CATEGORIES: { value: Enums<'photo_category'>; label: string }[] = [
  { value: 'full_body', label: 'Full body' },
  { value: 'arms', label: 'Arms' },
  { value: 'lower_body', label: 'Lower body' },
  { value: 'skin', label: 'Skin' },
  { value: 'other', label: 'Other' },
];

type PhotoGalleryProps = {
  photos: ProgressPhotoWithUrl[];
  today: string;
};

/**
 * Progress photos.
 *
 * Stored in a private bucket and served through short-lived signed URLs — there
 * is no public link to any of these. Nothing analyses or describes them; the app
 * stores what the user adds and shows it back, and that is the entire feature.
 */
export function PhotoGallery({ photos, today }: PhotoGalleryProps) {
  const [filter, setFilter] = React.useState<'all' | Enums<'photo_category'>>('all');
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ProgressPhotoWithUrl | null>(null);
  const [pending, startTransition] = React.useTransition();

  const visible = filter === 'all' ? photos : photos.filter((photo) => photo.category === filter);

  function remove(photo: ProgressPhotoWithUrl) {
    startTransition(async () => {
      const result = await deleteProgressPhoto(photo.id);
      if (result.ok) toast.success('Photo deleted.');
      else toast.error(result.error);
    });
  }

  function download(photo: ProgressPhotoWithUrl) {
    startTransition(async () => {
      const result = await createPhotoDownloadUrl(photo.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" />
        Photos are private to your account and stored in a private bucket. Only you can open them.
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 overflow-x-auto scrollbar-none">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => value && setFilter(value as typeof filter)}
            aria-label="Filter by category"
          >
            <ToggleGroupItem value="all" className="px-3 text-xs">
              All
            </ToggleGroupItem>
            {CATEGORIES.map((category) => (
              <ToggleGroupItem key={category.value} value={category.value} className="px-3 text-xs">
                {category.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Button variant="outline" size="sm" onClick={() => setUploading(true)} className="shrink-0">
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={EMPTY_STATES.photos.title} body={EMPTY_STATES.photos.body} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((photo) => (
            <li key={photo.id}>
              <Card className="overflow-hidden">
                <div className="relative aspect-[3/4] bg-muted">
                  {photo.signedUrl ? (
                    <Image
                      src={photo.signedUrl}
                      alt={photo.note ?? `Progress photo from ${formatDateKey(photo.taken_on, 'd MMMM yyyy')}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      Unavailable
                    </div>
                  )}
                </div>
                <CardContent className="space-y-1 p-3">
                  <p className="text-xs font-medium">
                    {formatDateKey(photo.taken_on, 'd MMM yyyy')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {CATEGORIES.find((c) => c.value === photo.category)?.label}
                  </p>
                  {photo.note ? (
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{photo.note}</p>
                  ) : null}
                  <div className="flex gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => download(photo)}
                      disabled={pending}
                      aria-label="Download this photo"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      onClick={() => setDeleting(photo)}
                      aria-label="Delete this photo"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <UploadDialog open={uploading} onOpenChange={setUploading} today={today} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from storage permanently. This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) remove(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<Enums<'photo_category'>>('full_body');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set('category', category);

    startTransition(async () => {
      const result = await uploadProgressPhoto(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Photo added.');
      formRef.current?.reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a photo</DialogTitle>
          <DialogDescription>
            Up to 10 MB. Stored privately — nothing is analysed or shared.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="photo-file">Photo</Label>
            <Input
              id="photo-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              required
              className="h-auto py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="photo-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as Enums<'photo_category'>)}>
              <SelectTrigger id="photo-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="photo-date">Date taken</Label>
            <Input id="photo-date" name="taken_on" type="date" defaultValue={today} max={today} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="photo-note">Note (optional)</Label>
            <Input id="photo-note" name="note" maxLength={280} />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
