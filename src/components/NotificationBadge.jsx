import { FiShoppingBag } from 'react-icons/fi';

export default function NotificationBadge({ count, children }) {
  return (
    <div className="relative inline-flex">
      {children}
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );
}

export function FloatingCartButton({ itemCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary-dark hover:shadow-xl active:scale-95"
      aria-label="Open cart"
    >
      <NotificationBadge count={itemCount}>
        <FiShoppingBag size={24} />
      </NotificationBadge>
    </button>
  );
}
