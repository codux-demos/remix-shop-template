import classNames from 'classnames';
import styles from './products.module.scss';
import { ROUTES } from '~/router/config';
import { ProductCard } from '~/components/product-card/product-card';
import { getImageHttpUrl } from '~/api/wix-image';
import { ecomApi } from '~/api/ecom-api';
import { Link, useLoaderData } from '@remix-run/react';

export interface ProductsPageProps {
    className?: string;
}

export const loader = async () => {
    const products = await ecomApi.getAllProducts();
    return { products };
};

export default function ProductsPage({ className }: ProductsPageProps) {
    const { products: myProducts } = useLoaderData<typeof loader>();

    return (
        <div className={classNames(styles.root, className)}>
            <h1 className={styles.title}>All Products</h1>
            <div className={styles.gallery}>
                {myProducts?.map(
                    (item) =>
                        item.slug &&
                        item.name && (
                            <Link to={ROUTES.product.to(item.slug)} key={item.slug}>
                                <ProductCard
                                    imageUrl={getImageHttpUrl(
                                        item.media?.items?.at(0)?.image?.url,
                                        240
                                    )}
                                    name={item.name}
                                    price={item.price ?? undefined}
                                    className={styles.productCard}
                                />
                            </Link>
                        )
                )}
            </div>
        </div>
    );
}
