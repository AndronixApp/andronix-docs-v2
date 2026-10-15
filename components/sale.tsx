// Halloween sale (#188) in the docs: sale prices only while public/season.js sets html[data-sale].
// SalePrice: the regular price, or the struck-through 30-day low and the sale price during the sale.
// SaleOnly: text shown only during the sale. SaleFootnote: the sale footnote (on every page with a sale price).
import { SALE, SALE_FOOTNOTE } from '@/lib/season.mjs';

export function SalePrice({ regular, sale, star = true }: { regular: string; sale: string; star?: boolean }) {
  if (!SALE.active) return <>{regular}{star && '*'}</>;
  return (
    <>
      <span className="sale-off">{regular}{star && '*'}</span>
      <span className="sale-on"><s className="sale-was">{regular}</s> {sale}*</span>
    </>
  );
}

export function SaleOnly({ children }: { children: React.ReactNode }) {
  if (!SALE.active) return null;
  return <span className="sale-on">{children}</span>;
}

export function SaleFootnote() {
  if (!SALE.active) return null;
  return <p className="sale-on sale-foot">{SALE_FOOTNOTE}</p>;
}
