import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    isRouteErrorResponse,
    useRouteError,
} from '@remix-run/react';
import { EcomAPIContextProvider } from '~/api/wix-api-context-provider';
import { CartOpenContextProvider } from '~/components/cart/cart-open-context';
import { SiteWrapper } from '~/components/site-wrapper/site-wrapper';
import '~/styles/index.css';

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body>
                <EcomAPIContextProvider>
                    <CartOpenContextProvider>
                        <SiteWrapper>{children}</SiteWrapper>
                    </CartOpenContextProvider>
                </EcomAPIContextProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}

export function ErrorBoundary() {
    const error = useRouteError();

    if (isRouteErrorResponse(error)) {
        return (
            <>
                <h1>
                    {error.status} {error.statusText}
                </h1>
                <p>{error.data}</p>
            </>
        );
    }

    return (
        <>
            <h1>Error!</h1>
            <p>{JSON.stringify(error)}</p>
        </>
    );
}
