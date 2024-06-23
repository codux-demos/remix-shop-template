import React, { FC } from 'react';
import { SWRConfig } from 'swr';
import { ecomApi } from './ecom-api';

export type EcomAPI = typeof ecomApi;
export type Cart = Awaited<ReturnType<EcomAPI['getCart']>>;

const EcomAPIContext = React.createContext<EcomAPI | null>(null);

export const useEcomAPI = (): EcomAPI => {
    const context = React.useContext(EcomAPIContext);
    if (!context) {
        throw new Error('useEcomAPI must be used within a EcomAPIContextProvider');
    }
    return context;
};

export const EcomAPIContextProvider: FC<{ children: React.ReactElement }> = ({ children }) => {
    return (
        <SWRConfig
            value={{
                revalidateIfStale: false,
                revalidateOnFocus: false,
                revalidateOnReconnect: true,
                refreshInterval: 5 * 60_000, // 5 minutes
                keepPreviousData: true,
            }}
        >
            <EcomAPIContext.Provider value={ecomApi}>{children}</EcomAPIContext.Provider>
        </SWRConfig>
    );
};
