'use client'

import { useRef, useState } from 'react'
import { uploadReference } from '@/lib/client/api'
import { IconUpload } from '@/components/ui/icons'
import { FieldLabel } from '@/components/ui/primitives'

/**
 * Reference image input.
 *
 * Not decoration: an uploaded image replaces the generated still as the source
 * frame the camera move (or LTX) runs over. It is persisted so a retry renders
 * the same thing rather than silently falling back to a generated still.
 */
export function MediaInput({
  value, onChange, disabled, label = 'Source image', hint = 'optional', size = 'compact', emptyTitle,
}: {
  value: string | null | undefined
  onChange: (url: string | null) => void
  disabled?: boolean
  label?: string
  hint?: string
  size?: 'compact' | 'hero'
  emptyTitle?: string
}) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { url } = await uploadReference(file)
      onChange(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const picker = (
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
      aria-label="Choose an image"
      onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = '' }} />
  )

  if (value) {
    return (
      <div>
        <FieldLabel hint="used as the first frame">{label}</FieldLabel>
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Your source image" className={`${size === 'hero' ? 'h-20 w-28' : 'h-14 w-20'} shrink-0 rounded-[4px] object-cover`} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink">Your image</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-3">Replaces the generated frame</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy}
              className="rounded px-2 py-1 text-[11px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {busy ? 'Uploading…' : 'Replace'}
            </button>
            <button type="button" onClick={() => onChange(null)} disabled={disabled || busy}
              className="rounded px-2 py-1 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-danger">
              Remove
            </button>
          </div>
        </div>
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        {picker}
      </div>
    )
  }

  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void accept(e.dataTransfer.files?.[0]) }}
        className={[
          'flex w-full items-center gap-3 rounded-card border border-dashed text-left transition-colors duration-150',
          size === 'hero' ? 'flex-col justify-center px-4 py-8 text-center' : 'px-3 py-3',
          dragging ? 'border-signal bg-signal/[0.06]' : 'border-line-strong bg-surface hover:border-ink-4',
          (disabled || busy) && 'cursor-not-allowed opacity-50',
        ].filter(Boolean).join(' ')}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-surface-3 text-ink-2">
          <IconUpload />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] text-ink">{busy ? 'Uploading…' : emptyTitle ?? 'Add an image'}</span>
          <span className="mt-0.5 block text-[11px] text-ink-3">Drop or browse · JPEG, PNG, WebP · 10MB</span>
        </span>
      </button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {picker}
    </div>
  )
}
