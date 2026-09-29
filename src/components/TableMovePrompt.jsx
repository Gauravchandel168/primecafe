import { useState } from 'react';
import { STATUS_LABELS, STATUS_COLORS } from '../firebase';

// Shown when the customer scans a different table's QR code while an
// earlier order of theirs is still open at another table. They can move
// that order to the table they're at now, cancel it (only before the
// kitchen has started), or say it's a separate order and carry on.
export default function TableMovePrompt({
  order,
  newTable,
  minutesAgo,
  busy,
  onMove,
  onCancelOrder,
  onKeep,
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const symbol = order.currencySymbol || '€';
  const items = order.items || [];
  const shown = items.slice(0, 3);
  const extra = items.length - shown.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5">
      <div className="animate-pop max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-dark">
          Did you order at Table {order.tableNumber}?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          You&apos;re now at Table {newTable}. Want to move that order here?
        </p>

        <div className="mt-4 rounded-2xl bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}
            >
              {STATUS_LABELS[order.status] || order.status}
            </span>
            <span className="text-xs text-gray-400">
              {minutesAgo < 1 ? 'Just now' : `${minutesAgo} min ago`}
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {shown.map((item, idx) => (
              <li key={idx}>
                {item.name} <span className="text-gray-400">× {item.quantity}</span>
              </li>
            ))}
            {extra > 0 && <li className="text-gray-400">+ {extra} more</li>}
          </ul>
          <p className="mt-3 text-sm font-bold text-dark">
            Total {symbol}
            {Number(order.totalAmount || 0).toFixed(2)}
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onMove}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Please wait...' : `Yes, move it to Table ${newTable}`}
          </button>

          {canCancel ? (
            confirmingCancel ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">
                  Cancel this order? This can&apos;t be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onCancelOrder}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Yes, cancel it
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingCancel(false)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-600 disabled:opacity-60"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingCancel(true)}
                className="w-full rounded-xl border border-red-300 py-3 font-semibold text-red-600 disabled:opacity-60"
              >
                Cancel that order
              </button>
            )
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This order is already being prepared, so it can&apos;t be cancelled
              here. Please ask a staff member if you need help.
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={onKeep}
            className="w-full py-2 text-sm text-gray-500 hover:underline disabled:opacity-60"
          >
            No, it&apos;s a different order
          </button>
        </div>
      </div>
    </div>
  );
}
