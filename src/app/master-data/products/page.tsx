import { ProductsScreen } from "@/components/master/products-screen";

export default function ProductsPage({ searchParams }: { searchParams: { q?: string } }) {
  return <ProductsScreen key={searchParams.q ?? ""} initialSearch={searchParams.q} />;
}
