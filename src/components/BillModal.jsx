import { useState } from 'react';
import { STATUS_COLORS, STATUS_LABELS, ORDER_STATUSES, TAX_RATE } from '../firebase';

export default function BillModal({ order, cafe, open, onClose, onMarkPaid, currency = '€' }) {
  const [marking, setMarking] = useState(false);

  if (!open || !order) return null;

  const subtotal = order.totalAmount;
  const tax = (subtotal * TAX_RATE) / 100;
  const total = subtotal + tax;

  const handleMarkPaid = async () => {
    setMarking(true);
    try {
      await onMarkPaid(order.id);
      onClose();
    } finally {
      setMarking(false);
    }
  };

  return (
    <>
      <div
        className="no-print fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="no-print fixed inset-4 z-50 mx-auto flex max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="print-area flex-1 overflow-y-auto p-6">
          <div className="text-center">
            {cafe?.logo && (
              <img
                src={cafe.logo}
                alt={cafe.name}
                className="mx-auto mb-3 h-16 w-16 rounded-full object-cover"
              />
            )}
            <h2 className="text-2xl font-bold text-dark">{cafe?.name || 'PrimeCafe'}</h2>
            <p className="mt-1 text-gray-500">Table {order.tableNumber}</p>
            <p className="text-sm text-gray-400">
              {order.timestamp?.toDate
                ? order.timestamp.toDate().toLocaleString()
                : new Date().toLocaleString()}
            </p>
          </div>

          <div className="my-6 border-t border-dashed border-gray-200" />

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">
                    {currency}{(item.price * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{currency}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Tax ({TAX_RATE}%)</span>
              <span>{currency}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{currency}{total.toFixed(2)}</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Thank you for dining with us!
          </p>
        </div>

        <div className="no-print flex gap-3 border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 font-medium hover:bg-gray-50"
          >
            Print Bill
          </button>
          {order.status !== 'paid' && (
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={marking}
              className="flex-1 rounded-xl bg-primary py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {marking ? 'Saving...' : 'Mark as Paid'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-gray-500 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export function getNextStatus(current) {
  const flow = ORDER_STATUSES.filter((s) => s !== 'paid');
  const idx = flow.indexOf(current);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
}

export { STATUS_COLORS, STATUS_LABELS };
