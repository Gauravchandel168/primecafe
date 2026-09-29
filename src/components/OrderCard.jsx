import { useState } from 'react';
import { FiFileText, FiEdit2, FiXCircle } from 'react-icons/fi';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  ORDER_STATUSES,
} from '../firebase';
import { getNextStatus } from './BillModal';

// Statuses where staff can still move the order to another table or cancel it.
const EDITABLE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

export default function OrderCard({
  order,
  onStatusChange,
  onGenerateBill,
  onEditTable,
  onCancelOrder,
}) {
  const [updating, setUpdating] = useState(false);
  const [editingTable, setEditingTable] = useState(false);
  const [tableDraft, setTableDraft] = useState('');

  const isCancelled = order.status === 'cancelled';
  const canEdit = EDITABLE_STATUSES.includes(order.status);

  const run = async (fn) => {
    setUpdating(true);
    try {
      await fn();
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (newStatus) =>
    run(() => onStatusChange(order.id, newStatus));

  const startEditTable = () => {
    setTableDraft(String(order.tableNumber ?? ''));
    setEditingTable(true);
  };

  const saveTable = async () => {
    const value = tableDraft.trim();
    if (!value) return;
    if (value === String(order.tableNumber ?? '').trim()) {
      setEditingTable(false);
      return;
    }
    await run(() => onEditTable(order.id, value));
    setEditingTable(false);
  };

  const nextStatus = getNextStatus(order.status);
  const timestamp = order.timestamp?.toDate
    ? order.timestamp.toDate()
    : order.timestamp
      ? new Date(order.timestamp)
      : null;

  const tableChanged = order.previousTableNumber && order.tableChangedBy;
  const changedByCustomer = order.tableChangedBy === 'customer';

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        isCancelled ? 'border-red-100 opacity-75' : 'border-gray-100'
      }`}
    >
      {isCancelled && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-600">
          ORDER CANCELLED BY {order.cancelledBy === 'customer' ? 'CUSTOMER' : 'STAFF'}
        </div>
      )}
      {!isCancelled && order.isUpdated && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-600">
          UPDATED MENU — customer added items
        </div>
      )}
      {!isCancelled && tableChanged && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-center text-sm font-bold ${
            changedByCustomer
              ? 'bg-violet-50 text-violet-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          TABLE CHANGED BY {changedByCustomer ? 'CUSTOMER' : 'STAFF'}: Table{' '}
          {order.previousTableNumber} → Table {order.tableNumber}
        </div>
      )}

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
          {order.customerName && (
            <p className="mt-1 text-sm text-gray-600">
              {order.customerName}
              {order.customerPhone && (
                <>
                  {' · '}
                  <a href={`tel:${order.customerPhone}`} className="text-primary hover:underline">
                    {order.customerPhone}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <span
          className={`text-xl font-bold text-primary ${isCancelled ? 'line-through' : ''}`}
        >
          {order.currencySymbol || '€'}{order.totalAmount?.toFixed(2)}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-gray-50 pt-4">
        {order.items?.map((item, idx) => (
          <li key={idx} className="flex justify-between text-sm">
            <span>
              {item.name}{' '}
              <span className="text-gray-400">× {item.quantity}</span>
            </span>
            <span>
              {order.currencySymbol || '€'}
              {(item.price * item.quantity).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {!isCancelled && (
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
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-50 pt-3">
          {editingTable ? (
            <>
              <span className="text-sm text-gray-500">Move to table</span>
              <input
                value={tableDraft}
                onChange={(e) => setTableDraft(e.target.value)}
                maxLength={20}
                autoFocus
                className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={updating || !tableDraft.trim()}
                onClick={saveTable}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => setEditingTable(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={updating}
                onClick={startEditTable}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <FiEdit2 size={14} />
                Edit table
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => run(() => onCancelOrder(order.id))}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <FiXCircle size={14} />
                Cancel order
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
