'use client';

import { useRef, useState } from 'react';
import ComingSoonCard, { ComingSoonItem } from './ComingSoonCard';

interface ComingSoonRowProps {
  comingSoonItems: ComingSoonItem[];
  title?: string;
  icon?: string;
}

export default function ComingSoonRow({
  comingSoonItems,
  title = "Coming Soon",
  icon = "⏳",
}: ComingSoonRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 400);
    }
  };

  if (!comingSoonItems || comingSoonItems.length === 0) return null;

  return (
    <section className="relative group/row">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4 px-4 sm:px-6 lg:px-8">
        {icon && <span className="text-xl">{icon}</span>}
        <h2 className="text-lg sm:text-xl font-display font-bold text-white flex items-center gap-2">
          <span>{title}</span>
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Upcoming
          </span>
        </h2>
        <div className="h-[2px] flex-1 max-w-[100px] bg-gradient-to-r from-amber-500/50 to-transparent rounded-full" />
        <span className="text-xs text-dark-400 font-medium">{comingSoonItems.length} items</span>
      </div>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-12 z-10 w-12 bg-gradient-to-r from-dark-950 to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
            aria-label="Scroll left"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-12 z-10 w-12 bg-gradient-to-l from-dark-950 to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
            aria-label="Scroll right"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        )}

        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-start gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {comingSoonItems.map((item) => (
            <div key={item.id} className="snap-start" style={{ width: '160px', flexShrink: 0 }}>
              <ComingSoonCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
