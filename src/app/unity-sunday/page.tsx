import UnityRegisterFlow from '@/components/UnityRegisterFlow';

// Force dynamic rendering so UNITY_SUNDAY_FORM_URL is read fresh on every
// request rather than baked in at build time.
export const dynamic = 'force-dynamic';

export default function UnitySundayPage() {
  return <UnityRegisterFlow formUrl={process.env.UNITY_SUNDAY_FORM_URL} />;
}
