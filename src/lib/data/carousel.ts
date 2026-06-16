import { demoCarouselItems } from '@/lib/demoData';
import type { CarouselItem } from './types';

const normalize = (raw: unknown): CarouselItem[] => raw as CarouselItem[];

export async function getCarouselItems(): Promise<CarouselItem[]> {
  const items = normalize(demoCarouselItems);
  return [...items].sort((a, b) => a.order_index - b.order_index);
}
