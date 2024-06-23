import type { MetaFunction } from '@remix-run/node';
import classNames from 'classnames';
import styles from './_index.module.scss';
import { HeroImage } from '~/components/hero-image/hero-image';
import { ROUTES } from '~/router/config';
import { ProductCard } from '~/components/product-card/product-card';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import { ecomApi } from '~/api/ecom-api';

export interface HomePageProps {
    className?: string;
}

export const meta: MetaFunction = () => {
    return [
        { title: 'Ecom Template' },
        { name: 'description', content: 'Welcome to the Ecom Template' },
    ];
};

export const loader = async () => {
    const products = await ecomApi.getPromotedProducts();
    return { products };
};

export default function HomePage({ className }: HomePageProps) {
    const navigate = useNavigate();

    const { products } = useLoaderData<typeof loader>();

    return (
        <div className={classNames(styles.root, className)}>
            <HeroImage
                title="Incredible Prices on All Your Favorite Items"
                topLabel="Best Prices"
                bottomLabel="Get more for less on selected brands"
                buttonLabel="Shop Now"
                topLabelClassName={styles['top-label-highlighted']}
                onButtonClick={() => navigate(ROUTES.products.to())}
            />
            <h1 className={styles['hero-title']}>Best Sellers</h1>
            <p className={styles.bestSeller}>Shop our best seller items</p>
            <div className={styles.cardsLayout}>
                {products?.map((product) =>
                    product.slug && product.name ? (
                        <Link to={ROUTES.product.to(product.slug)} key={product.slug}>
                            <ProductCard
                                imageUrl={product.media?.items?.at(0)?.image?.url}
                                name={product.name}
                                price={product.price ?? undefined}
                                className={styles.productCard}
                            />
                        </Link>
                    ) : null
                )}
            </div>
        </div>
    );
}
