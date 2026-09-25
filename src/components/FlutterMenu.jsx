import { useState } from 'react';
import { FaPhone, FaWhatsapp, FaLocationDot, FaInstagram, FaFacebook } from 'react-icons/fa6';
import { formatEuroPrice, fetchAvailableItems } from '../utils/restaurantPaths';

// Fallback copy shown until a cafe fills in its own details from the
// admin Settings tab — generic, not tied to any specific real business.
const DEFAULTS = {
  name: 'Your Cafe',
  heroImage: '/cafe_logo.png',
  openHours: '',
  tagline: 'Welcome — take a look at our menu',
  allergenNote: '',
};

export function MenuHero({ isMobile, restaurant }) {
  const heroHeight = isMobile ? 200 : 350;
  const heroImage = restaurant?.heroImage || DEFAULTS.heroImage;
  const name = restaurant?.name || DEFAULTS.name;
  const openHours = restaurant?.openHours || DEFAULTS.openHours;
  const phone = restaurant?.phone;
  const whatsapp = restaurant?.whatsapp || phone;
  const mapsUrl = restaurant?.mapsUrl;

  return (
    <div className="relative w-full bg-black" style={{ height: heroHeight }}>
      <img src={heroImage} alt={name} className="h-full w-full object-contain" />
      <div className="absolute inset-0 bg-black/50" />

      {(phone || whatsapp || mapsUrl) && (
        <div className="absolute left-2.5 top-2.5 flex gap-2.5 md:left-4 md:top-4">
          {phone && (
            <IconButton
              onClick={() => (window.location.href = `tel:${phone}`)}
              className="bg-black/60"
            >
              <FaPhone size={18} />
            </IconButton>
          )}
          {whatsapp && (
            <IconButton
              onClick={() =>
                window.open(
                  `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                    `Hello ${name}! I would like to know more.`
                  )}`,
                  '_blank'
                )
              }
              className="bg-green-600"
            >
              <FaWhatsapp size={18} />
            </IconButton>
          )}
          {mapsUrl && (
            <IconButton onClick={() => window.open(mapsUrl, '_blank')} className="bg-red-600">
              <FaLocationDot size={18} />
            </IconButton>
          )}
        </div>
      )}

      <div className="absolute bottom-2.5 left-0 right-0 text-center text-white">
        {openHours && (
          <p className="font-amatic text-[22px] font-bold tracking-[2px]">{openHours}</p>
        )}
        <p className="mt-2 font-amatic text-lg font-bold tracking-[2px]">{name}</p>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${className}`}
    >
      {children}
    </button>
  );
}

export function MenuTagline({ isMobile, restaurant }) {
  const tagline = restaurant?.tagline || DEFAULTS.tagline;
  const allergenNote = restaurant?.allergenNote;

  return (
    <>
      <p
        className={`mt-8 text-center font-poppins font-bold tracking-[1px] text-black ${
          isMobile ? 'text-lg' : 'text-2xl'
        }`}
      >
        {tagline}
      </p>
      {allergenNote && (
        <p
          className={`mx-auto mt-8 max-w-xl whitespace-pre-line text-center font-poppins font-bold tracking-[0.5px] text-black ${
            isMobile ? 'text-base' : 'text-xl'
          }`}
        >
          {allergenNote}
        </p>
      )}
    </>
  );
}

export function MenuFooter({ restaurant }) {
  const instagramUrl = restaurant?.instagramUrl;
  const facebookUrl = restaurant?.facebookUrl;
  const hasSocials = instagramUrl || facebookUrl;

  return (
    <footer className="mt-8 flex h-[250px] w-full flex-col items-center justify-center bg-[#1C1C1C] py-10 text-center">
      <p className="text-sm text-white/70">All prices are in euros</p>
      {hasSocials && (
        <>
          <p className="mt-5 text-base font-medium text-white">Follow us !</p>
          <div className="mt-5 flex gap-5">
            {instagramUrl && (
              <button type="button" onClick={() => window.open(instagramUrl, '_blank')}>
                <FaInstagram className="text-[28px] text-white" />
              </button>
            )}
            {facebookUrl && (
              <button type="button" onClick={() => window.open(facebookUrl, '_blank')}>
                <FaFacebook className="text-[28px] text-white" />
              </button>
            )}
          </div>
        </>
      )}
    </footer>
  );
}

export function FlutterMenuItemCard({
  item,
  cardWidth,
  cardHeight,
  onAdd,
}) {
  const [expanded, setExpanded] = useState(false);
  const description = item.description || '';
  const hasLongDesc = description.length > 20;
  const imageUrl = (item.image || '').trim();
  const contentHeight = expanded ? cardHeight * 0.5 + 140 : cardHeight * 0.5;
  const height = expanded ? cardHeight + 140 : cardHeight;

  return (
    <div
      className="mr-2.5 shrink-0 overflow-hidden rounded-2xl bg-[#D6D6D6] shadow-md transition-all duration-300"
      style={{ width: cardWidth, height }}
    >
      <div className="relative" style={{ height: cardHeight * 0.5 }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-gray-400">
            🍽️
          </div>
        )}
      </div>

      <div className="flex flex-col p-2" style={{ height: contentHeight }}>
        <p className="truncate font-poppins text-sm font-medium text-black">{item.name}</p>

        <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
          <p
            className={`font-poppins text-[10px] text-black ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            {description}
          </p>
          {hasLongDesc && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 font-poppins text-xs font-semibold text-[#1C1C1C]"
            >
              {expanded ? 'Read Less ▲' : 'Read More ▼'}
            </button>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="font-poppins text-xs text-[#101010]">
            {formatEuroPrice(item.price)}
          </span>
          {onAdd && (
            <button
              type="button"
              onClick={() => onAdd(item)}
              className="rounded-lg bg-[#1C1C1C] px-2.5 py-1 font-poppins text-[10px] font-semibold text-white"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MenuCategorySection({
  category,
  restaurantId,
  cardWidth,
  cardHeight,
  horizontalPadding,
  isMobile,
  onAdd,
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);

    if (next && !loaded) {
      setLoading(true);
      try {
        const data = await fetchAvailableItems(restaurantId, category.id);
        setItems(data);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <span
          className={`mx-auto font-poppins font-bold tracking-[1px] text-black ${
            isMobile ? 'text-base' : 'text-xl'
          }`}
        >
          {category.name}
        </span>
        <span className="text-base text-[#878787]">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div
          className="overflow-x-auto pb-5"
          style={{ paddingLeft: horizontalPadding, paddingRight: horizontalPadding }}
        >
          {loading ? (
            <div className="flex gap-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="shrink-0 animate-pulse rounded-2xl bg-gray-200"
                  style={{ width: cardWidth, height: cardHeight }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-4 text-center font-amatic text-lg text-black">No Items Found</p>
          ) : (
            <div className="flex" style={{ minHeight: cardHeight }}>
              {items.map((item) => (
                <FlutterMenuItemCard
                  key={item.id}
                  item={item}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  onAdd={onAdd}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
