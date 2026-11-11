import { DeliveryDetails } from "@/components/admin/DeliveryDetails";
export const dynamic = "force-dynamic";
export default function DeliveryDetailPage({ params }: { params: { id: string } }) { return <DeliveryDetails id={params.id} />; }
