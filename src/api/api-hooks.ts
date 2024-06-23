import { useEffect } from 'react';
import useSwr, { Key } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useEcomAPI } from './wix-api-context-provider';
import { findItemIdInCart } from './cart-helpers';

export const useCart = () => {
    const ecomApi = useEcomAPI();
    return useSwr('cart', ecomApi.getCart);
};

export const useCartTotals = () => {
    const ecomApi = useEcomAPI();
    const { data } = useCart();

    const cartTotals = useSwr('cart-totals', ecomApi.getCartTotals);

    useEffect(() => {
        cartTotals.mutate();
    }, [data]);

    return cartTotals;
};

type Args = { id: string; quantity: number };

export const useAddToCart = () => {
    const ecomApi = useEcomAPI();
    const { data: cart } = useCart();
    return useSWRMutation(
        'cart',
        (_key: Key, { arg }: { arg: Args & { options?: Record<string, string> } }) => {
            if (!cart) {
                return ecomApi.addToCart(arg.id, arg.quantity, arg.options);
            }
            const itemInCart = findItemIdInCart(cart, arg.id, arg.options);
            return itemInCart
                ? ecomApi.updateCartItemQuantity(
                      itemInCart._id,
                      (itemInCart.quantity || 0) + arg.quantity
                  )
                : ecomApi.addToCart(arg.id, arg.quantity, arg.options);
        },
        {
            revalidate: false,
            populateCache: true,
        }
    );
};

export const useUpdateCartItemQuantity = () => {
    const ecomApi = useEcomAPI();
    return useSWRMutation(
        'cart',
        (_key: Key, { arg }: { arg: Args }) => ecomApi.updateCartItemQuantity(arg.id, arg.quantity),
        {
            revalidate: false,
            populateCache: true,
        }
    );
};

export const useRemoveItemFromCart = () => {
    const ecomApi = useEcomAPI();
    return useSWRMutation(
        'cart',
        (_key: Key, { arg }: { arg: string }) => ecomApi.removeItemFromCart(arg),
        {
            revalidate: false,
            populateCache: true,
        }
    );
};
