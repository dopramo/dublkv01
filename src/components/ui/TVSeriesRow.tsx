'use client';

import { useRef, useState } from 'react';
import TVSeriesCard, { TVSeriesItem } from './TVSeriesCard';

interface TVSeriesRowProps {
  title: string;
  seriesList: TVSeriesItem[];
  icon?: string;
}

export default function TVSeriesRow({ title, seriesList, icon }: TVSeriesRowProps) {
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

  if (seriesList.length === 0) return null;

  return (
    <section className="relative group/row">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4 px-4 sm:px-6 lg:px-8">
        {icon && <span className="text-xl">{icon}</span>}
        <h2 className="text-lg sm:text-xl font-display font-bold text-white">
          {title}
        </h2>
        <div className="h-[2px] flex-1 max-w-[100px] bg-gradient-to-r from-[#00ff73]/50 to-transparent rounded-full" />
        <span className="text-xs text-dark-500 font-medium">{seriesList.length} series</span>
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

        {/* TV Series Cards */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-start gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {seriesList.map((series) => (
            <div key={series.id} className="snap-start" style={{ width: '160px', flexShrink: 0 }}>
              <TVSeriesCard series={series} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
