import { notFound } from 'next/navigation';
import { BuildingEvolutionLab } from '@/features/building-lab/building-evolution-lab';

export const dynamic = 'force-dynamic';

export default function DevelopmentBuildingLabPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <BuildingEvolutionLab />;
}
