import { useEffect, useMemo, useState } from 'react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

// Turns an ISO country code like "IN" into its flag emoji (🇮🇳) —
// no image assets needed, this works from the two letters directly.
function flagEmoji(iso2) {
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const regionNames =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

function countryName(iso2) {
  try {
    return regionNames?.of(iso2) || iso2;
  } catch {
    return iso2;
  }
}

const COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: countryName(code),
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Best-effort guess at the customer's country so the right code is
// pre-selected — from their IP (no permission prompt needed), falling
// back to the browser's own locale if that lookup fails.
async function detectCountry() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data?.success !== false && data?.country_code) {
      return data.country_code;
    }
  } catch {
    // fall through to locale-based guess
  }
  try {
    const locale = navigator.language || '';
    const region = locale.split('-')[1];
    if (region && COUNTRIES.some((c) => c.code === region.toUpperCase())) {
      return region.toUpperCase();
    }
  } catch {
    // ignore
  }
  return 'US';
}

export default function CustomerDetailsModal({ onSubmit, onClose, savedName, savedPhone }) {
  const savedParsed = useMemo(() => {
    if (!savedPhone) return null;
    try {
      return parsePhoneNumberFromString(savedPhone);
    } catch {
      return null;
    }
  }, [savedPhone]);

  const [name, setName] = useState(savedName || '');
  const [country, setCountry] = useState(savedParsed?.country || 'US');
  const [number, setNumber] = useState(
    savedParsed ? savedParsed.nationalNumber : ''
  );
  const [touched, setTouched] = useState(false);
  // Already know their country from a saved order? No need to wait on
  // the IP lookup at all — only detect for a first-time customer.
  const [detecting, setDetecting] = useState(!savedParsed);

  useEffect(() => {
    if (savedParsed) return;
    let active = true;
    detectCountry().then((code) => {
      if (active) {
        setCountry(code);
        setDetecting(false);
      }
    });
    return () => {
      active = false;
    };
  }, [savedParsed]);

  const parsed = useMemo(() => {
    if (!number.trim()) return null;
    try {
      return parsePhoneNumberFromString(number, country);
    } catch {
      return null;
    }
  }, [number, country]);

  const phoneValid = parsed?.isValid() ?? false;
  const nameValid = name.trim().length >= 2;
  const canSubmit = nameValid && phoneValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      phone: parsed.number, // E.164 format, e.g. +919876543210
      phoneDisplay: parsed.formatInternational(),
    });
  };

  const selected = COUNTRIES.find((c) => c.code === country);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <h2 className="text-lg font-bold text-dark">Your details</h2>
        <p className="mt-1 text-sm text-gray-500">
          So the cafe can reach you about your order.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            {touched && !nameValid && (
              <p className="mt-1 text-xs text-red-500">Please enter your name</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Mobile number
            </label>
            <div className="flex gap-2">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={detecting}
                className="w-[7.5rem] shrink-0 rounded-xl border border-gray-200 px-2 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {flagEmoji(c.code)} +{c.callingCode}
                  </option>
                ))}
              </select>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Phone number"
                inputMode="tel"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {selected && (
              <p className="mt-1 text-xs text-gray-400">
                {countryName(selected.code)} selected — change it above if that's not you.
              </p>
            )}
            {touched && !phoneValid && (
              <p className="mt-1 text-xs text-red-500">Please enter a valid mobile number</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit && touched}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark"
          >
            Continue to order
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-sm text-gray-500 hover:underline"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
