import { FiMinus, FiPlus, FiX } from 'react-icons/fi';
import { useCart } from '../context/CartContext';

export default function CartDrawer({ open, onClose, onPlaceOrder, placing, currency = '€' }) {
  const { items, updateQuantity, removeItem, subtotal, itemCount } = useCart();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="animate-slide-up fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-dark">Your Cart ({itemCount})</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close cart"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
          {items.length === 0 ? (
            <p className="py-8 text-center text-gray-500">Your cart is empty</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl bg-gray-50 p-3"
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-sm text-primary">{currency}{item.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-gray-200"
                    >
                      <FiMinus size={14} />
                    </button>
                    <span className="w-6 text-center font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-gray-200"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500"
                    aria-label="Remove item"
                  >
                    <FiX size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <div className="mb-4 flex justify-between text-lg font-bold">
            <span>Subtotal</span>
            <span className="text-primary">{currency}{subtotal.toFixed(2)}</span>
          </div>
          <button
            type="button"
            disabled={items.length === 0 || placing}
            onClick={onPlaceOrder}
            className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placing ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </>
  );
}
