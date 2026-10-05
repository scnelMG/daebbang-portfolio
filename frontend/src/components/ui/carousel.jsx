// shadcn/ui Carousel composition, adapted to this project's CSS-token styling.
// https://ui.shadcn.com/docs/components/radix/carousel
import { createContext, useContext, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

const CarouselContext = createContext(null);

function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context) throw new Error('Carousel components must be inside Carousel.');
  return context;
}

export function Carousel({ opts, setApi, className, children, onKeyDown, ...props }) {
  const [carouselRef, api] = useEmblaCarousel(opts);
  useEffect(() => { if (api) setApi?.(api); }, [api, setApi]);
  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') api?.scrollPrev();
    else api?.scrollNext();
  };
  return <CarouselContext.Provider value={{ carouselRef, api }}>
    <div role="region" aria-roledescription="캐러셀" className={cn('ui-carousel', className)} onKeyDown={handleKeyDown} {...props}>{children}</div>
  </CarouselContext.Provider>;
}

export function CarouselContent({ className, children, ...props }) {
  const { carouselRef } = useCarousel();
  return <div ref={carouselRef} className="ui-carousel-viewport"><div className={cn('ui-carousel-content', className)} {...props}>{children}</div></div>;
}

export function CarouselItem({ className, ...props }) {
  return <div role="group" aria-roledescription="슬라이드" className={cn('ui-carousel-item', className)} {...props} />;
}

export function CarouselPrevious(props) {
  const { api } = useCarousel();
  return <Button variant="outline" size="round" aria-label="이전 빵집" onClick={() => api?.scrollPrev()} {...props}><ChevronLeft data-icon="inline-start" /></Button>;
}

export function CarouselNext(props) {
  const { api } = useCarousel();
  return <Button variant="outline" size="round" aria-label="다음 빵집" onClick={() => api?.scrollNext()} {...props}><ChevronRight data-icon="inline-start" /></Button>;
}
