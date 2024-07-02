import { createBoard } from '@wixc3/react-board';
import { createRemixStub } from '@remix-run/testing';
import { Outlet } from '@remix-run/react';

import { Layout } from '../../../app/root';

import HomePage, { loader } from '../../../app/routes/_index';

const Router = createRemixStub([
    {
        Component: () => {
            return (
                <Layout>
                    <Outlet />
                </Layout>
            );
        },
        children: [
            {
                path: '/',
                Component: HomePage,
                loader,
            },
        ],
    },
]);

export default createBoard({
    name: 'SiteWrapper',
    Board: () => <Router />,
    isSnippet: true,
    environmentProps: {
        canvasWidth: 840,
        windowWidth: 1135,
    },
});
