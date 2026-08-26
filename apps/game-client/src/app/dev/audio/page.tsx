import { notFound } from 'next/navigation';
import { AudioAuditionLab } from '@/features/audio-lab/audio-audition-lab';

export const dynamic = 'force-dynamic';

export default function DevelopmentAudioLabPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AudioAuditionLab />;
}
