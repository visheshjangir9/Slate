'use client'

import { useRef, useState } from 'react'
import { uploadReference } from '@/lib/client/api'
import { Label } from './primitives'

/**
 * Reference image input.
 *
 * Not decoration: an uploaded image replaces the generated still as the source
 * frame the camera move runs over. It is persisted so a retry renders the same
 * thing rather than silently falling back to a generated still.
 */
export function MediaInput({
  value, onChange, disabled,
}: {
  value: string | null | undefined
  onChange: (url: string | null) => void
  disabled?: boolean
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

  if (value) {
    return (
      <div>
        <Label hint="source frame">Reference</Label>
        <div className="relative overflow-hidden rounded-card border border-line bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Reference frame" className="h-32 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between
            bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6">
            <span className="text-[11px] text-ink-2">Camera move runs over this frame</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="rounded border border-line-strong bg-ground/70 px-2 py-1 text-[11px]
                text-ink-2 transition-colors duration-150 hover:text-ink"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Label hint="optional">Reference</Label>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false)
          void accept(e.dataTransfer.files?.[0])
        }}
        className={[
          'flex w-full flex-col items-center justify-center gap-1.5 rounded-card border border-dashed',
          'px-3 py-5 transition-colors duration-150',
          dragging ? 'border-accent bg-surface-2' : 'border-line bg-surface hover:border-line-strong',
          (disabled || busy) && 'cursor-not-allowed opacity-50',
        ].filter(Boolean).join(' ')}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="text-ink-4">
          <rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <circle cx="7.5" cy="8.5" r="1.4" fill="currentColor" />
          <path d="M3.5 14 L8 10 L11 12.5 L14 10 L16.5 12.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs text-ink-2">
          {busy ? 'Uploading…' : 'Add an image to animate'}
        </span>
        <span className="text-[11px] text-ink-4">JPEG, PNG or WebP · up to 10MB</span>
      </button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
