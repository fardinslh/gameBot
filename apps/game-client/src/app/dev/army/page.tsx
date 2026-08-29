import { notFound } from 'next/navigation';
import { ArmyLab } from '@/features/army-lab/army-lab';

export const dynamic = 'force-dynamic';

export default function DevelopmentArmyLabPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ArmyLab />;
}
