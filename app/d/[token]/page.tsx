import { PublicDelivery } from "@/components/delivery/PublicDelivery";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function DeliveryPage({ params }: { params: { token: string } }) { return <PublicDelivery token={params.token} />; }
