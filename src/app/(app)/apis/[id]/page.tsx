import { ApiDetail } from "@/components/apis/detail/api-detail";

export default async function ApiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApiDetail id={id} />;
}
