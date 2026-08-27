import { notFound } from 'next/navigation';
import { RtlAuditLab } from '@/features/rtl-lab/rtl-audit-lab';

export const dynamic = 'force-dynamic';

export default function DevelopmentRtlAuditPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <RtlAuditLab />;
}
