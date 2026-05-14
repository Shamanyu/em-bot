'use client';

import { useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import type { OnboardingData } from '../page';

interface Props {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
}

export function BrandingConfig({ data, onChange, onNext, onBack, submitting }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      onChange({ logoFile: file, logoPreviewUrl: url });
    },
    [onChange],
  );

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const isDark = isColorDark(data.brandColor);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Branding</h2>
      <p className="text-gray-500 text-sm mb-8">
        Customise how your dashboard looks. Changes are reflected immediately after setup.
      </p>

      <div className="space-y-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organisation Name
          </label>
          <input
            type="text"
            value={data.orgName}
            onChange={(e) => onChange({ orgName: e.target.value })}
            placeholder="Acme Engineering"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">Used as the dashboard page title.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            {data.logoPreviewUrl ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.logoPreviewUrl} alt="Logo preview" className="h-14 object-contain" />
                <button
                  onClick={() => onChange({ logoFile: undefined, logoPreviewUrl: '' })}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-1">Drag & drop or</p>
                <label className="text-sm text-indigo-600 hover:underline cursor-pointer font-medium">
                  browse files
                  <input type="file" accept="image/*" onChange={onInputChange} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG — max 2 MB</p>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dashboard Background Colour
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm flex-shrink-0"
              style={{ backgroundColor: data.brandColor }}
            />
            <input
              type="text"
              value={data.brandColor}
              onChange={(e) => onChange({ brandColor: e.target.value })}
              className="input w-32 font-mono text-sm"
              maxLength={7}
            />
          </div>
          {showPicker && (
            <div className="mt-3">
              <HexColorPicker
                color={data.brandColor}
                onChange={(color) => onChange({ brandColor: color })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div
        className="mb-8 rounded-xl p-5 border border-gray-100"
        style={{ backgroundColor: data.brandColor }}
      >
        <div className="flex items-center gap-3 mb-3">
          {data.logoPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoPreviewUrl} alt="Logo" className="h-8 object-contain" />
          )}
          <span
            className="text-base font-bold"
            style={{ color: isDark ? '#f9fafb' : '#111827' }}
          >
            {data.orgName || 'Your Org'} Engineering Progress
          </span>
        </div>
        <div
          className="text-xs opacity-60"
          style={{ color: isDark ? '#f9fafb' : '#374151' }}
        >
          Preview of dashboard header
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} disabled={submitting} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!data.orgName || submitting}
          className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Launching…' : 'Launch my dashboard →'}
        </button>
      </div>
    </div>
  );
}

function isColorDark(hex: string): boolean {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return false;
  const r = parseInt(result[1]!, 16);
  const g = parseInt(result[2]!, 16);
  const b = parseInt(result[3]!, 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
