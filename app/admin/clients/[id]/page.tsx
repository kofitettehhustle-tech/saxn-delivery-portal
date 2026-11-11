import { ClientDetails } from "@/components/admin/ClientDetails";
export const dynamic = "force-dynamic";
export default function ClientDetailsPage({ params }: { params: { id: string } }) { return <ClientDetails id={params.id} />; }
