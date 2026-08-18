import CheckInFlow from '@/components/CheckInFlow';

// Force dynamic rendering so NEW_MEMBER_FORM_URL is read fresh on every
// request rather than baked in at build time.
export const dynamic = 'force-dynamic';

export default function CheckinPage() {
  return <CheckInFlow newMemberFormUrl={process.env.NEW_MEMBER_FORM_URL} />;
}
