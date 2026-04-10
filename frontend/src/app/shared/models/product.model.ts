export type ProductStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'DRAFT';

export interface Product {
  id: number;
  name: string;
  titleUnaccent?: string | null;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  status: ProductStatus;
  categoryId: number;
  category?: { id: number; name: string };
}
