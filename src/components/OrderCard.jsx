import { useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  ORDER_STATUSES,
} from '../firebase';
import { getNextStatus } from './BillModal';

export default function OrderCard({
  order,
  onStatusChange,
  onGenerateBill,
}) {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await onStatusChange(order.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  const nextStatus = getNextStatus(order.status);
  const timestamp = order.timestamp?.toDate
    ? order.timestamp.toDate()
    : order.timestamp
      ? new Date(order.timestamp)
      : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-dark">
              Table {order.tableNumber}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}
            >
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          {timestamp && (
            <p className="mt-1 text-sm text-gray-500">
              {timestamp.toLocaleString()}
            </p>
          )}
        </div>
        <span className="text-xl font-bold text-primary">
          €{order.totalAmount?.toFixed(2)}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-gray-50 pt-4">
        {order.items?.map((item, idx) => (
          <li key={idx} className="flex justify-between text-sm">
            <span>
              {item.name}{' '}
              <span className="text-gray-400">× {item.quantity}</span>
            </span>
            <span>€{(item.price * item.quantity).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={order.status}
          disabled={updating || order.status === 'paid'}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm capitalize disabled:opacity-50"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {nextStatus && order.status !== 'paid' && (
          <button
            type="button"
            disabled={updating}
            onClick={() => handleStatusChange(nextStatus)}
            className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            → {STATUS_LABELS[nextStatus]}
          </button>
        )}

        <button
          type="button"
          onClick={() => onGenerateBill(order)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <FiFileText />
          Generate Bill
        </button>
      </div>
    </div>
  );
}
