export interface Product {
  id: number;
  name: string;
  titleUnaccent?: string | null;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryId: number;
}
