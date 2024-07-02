import React, { useMemo } from 'react';
import {
    defineApp,
    type IReactAppManifest,
    type IResults,
    type RouteInfo,
} from '@wixc3/react-board';
import { Outlet } from '@remix-run/react';
import { createRemixStub } from '@remix-run/testing';
import { LoaderFunction } from '@remix-run/node';
import './app.global.css';
type RouteObject = Parameters<typeof createRemixStub>[0][0];

const createEl = React.createElement;
const manifestToRouter = (
    manifest: IReactAppManifest<RouteExtraInfo>,
    requireModule: (filePath: string) => {
        moduleResults: Promise<IResults<unknown>>;
        dispose: () => void;
    }
) => {
    const Router = createRemixStub(
        manifest.routes.map((route) => {
            const { Component, loader } = lazyCompAndLoader(
                route.pageModule,
                route.pageExportName || 'default',
                requireModule
            );

            const path =
                '/' +
                route.path
                    .map((part) => {
                        if (part.kind === 'static') {
                            return part.text;
                        }
                        return `:${part.name}`;
                    })
                    .join('/');

            let page: RouteObject = {
                path,
                Component,
                loader,
            };
            if (route.parentLayouts) {
                for (const layout of route.parentLayouts.reverse()) {
                    const { Component, loader } = lazyCompAndLoader(
                        layout.layoutModule,
                        layout.layoutExportName || 'default',
                        requireModule,
                        layout.layoutExportName === 'Layout'
                    );
                    page = {
                        Component,
                        loader,
                        path,
                        children: [page],
                    };
                }
            }
            return page;
        })
    );

    return Router;
};

function lazyCompAndLoader<ExportName extends string>(
    filePath: string,
    compExportName: ExportName,
    requireModule: (filePath: string) => {
        moduleResults: Promise<IResults<unknown>>;
        dispose: () => void;
    },
    wrapWithOutlet = false
) {
    const Component = React.lazy(async () => {
        const { moduleResults } = requireModule(filePath);
        const module = await moduleResults;
        const moduleWithComp = module.results as {
            [key in ExportName]: React.ComponentType<{ children?: React.ReactNode }>;
        };

        const Page = moduleWithComp[compExportName];
        if (!Page) {
            return {
                default: () => (
                    <div>
                        {compExportName} export not found at {filePath}{' '}
                    </div>
                ),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any;
        }
        if (wrapWithOutlet) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Layout = Page as any;
            return {
                default: () => createEl(Layout, {}, [createEl(Outlet)]),
            };
        }
        return {
            default: Page,
        };
    });

    const loader: LoaderFunction = async (...args) => {
        const { moduleResults } = requireModule(filePath);
        const { results } = await moduleResults;
        const moduleWithComp = results as {
            loader?: LoaderFunction;
        };
        const loader = moduleWithComp.loader;
        if (loader) {
            return await loader(...args);
        }
        return {};
    };

    return { Component, loader };
}

interface RouteExtraInfo {
    rendereredRoutes: string[];
}

export default defineApp<RouteExtraInfo>({
    App: ({ manifest, requireModule, uri }) => {
        const App = useMemo(
            () => manifestToRouter(manifest, requireModule),
            [manifest, requireModule]
        );

        return (
            <>
                <App
                    initialEntries={[
                        {
                            pathname: '/' + uri,
                            search: '',
                            hash: '',
                        },
                    ]}
                />
            </>
        );
    },
    getNewPageInfo({ fs, wantedPath }) {
        const routeDir = fs.join(__dirname, './example-app/routes');
        const varNames = new Set<string>();
        const pageFileName = wantedPath
            .map((part) => {
                if (part.kind === 'static') {
                    return part.text;
                }
                varNames.add(part.name);
                return `{${part.name}}`;
            })
            .join('.');
        const pageName = toCamelCase(pageFileName);
        const pagePath = fs.join(routeDir, pageFileName + '.tsx');
        const contents =
            varNames.size === 0
                ? `
import React from 'react';
export default function ${pageName}() {
    return <div>${pageFileName}</div>;
}
        `
                : `
import React from 'react';
import { useLoader } from '../router-example';

export const loader = async (params: { 
        ${[...varNames].map((name) => `${name}: string`).join(',\n')}
     }) => {
    return params;
};

const ${pageName} = () => {
    const params = useLoader<typeof loader>();
    return <div>
        ${[...varNames].map((name) => `<div>${name}: {params.${name}}</div>`).join('\n')}
    </div>;
};
export default ${pageName};
          
                
                `;

        return {
            contents,
            pagePath,
        };
    },
    async prepareApp({ fs, onAppUpdate }) {
        const rootPath = fs.join(__dirname, '../app/root.tsx');
        const routeDir = fs.join(__dirname, '../app/routes');
        const route = (
            path: RouteInfo['path'],
            pageModule: string,
            renderedRoutes: string[]
        ): RouteInfo<RouteExtraInfo> => ({
            path,
            pageModule,
            pageExportName: 'default',
            parentLayouts: [
                {
                    layoutModule: rootPath,
                    layoutExportName: 'Layout',
                },
            ],
            isPage: true,
            extraData: { rendereredRoutes: renderedRoutes },
        });
        const compute = () => {
            const routeDirChildren = fs.readdirSync(routeDir).map((name) => {
                const fullPath = fs.join(routeDir, name);
                const isFile = fs.statSync(fullPath).isFile();
                if (isFile && name.endsWith('.tsx')) {
                    if (name === '_index.tsx') {
                        return route([], fullPath, [rootPath, fullPath]);
                    }
                    const fileName = fs.basename(name, '.tsx');
                    const routeParts = fileName.split('.');

                    return route(
                        routeParts.map((p) => {
                            if (p.startsWith('*')) {
                                return {
                                    kind: 'dynamic' as const,
                                    name: p.slice(1, -1),
                                };
                            }
                            return {
                                kind: 'static' as const,
                                text: p,
                            };
                        }),
                        fullPath,
                        [rootPath, fullPath]
                    );
                }
                return null;
            });
            const routes = routeDirChildren.filter((r): r is RouteInfo<RouteExtraInfo> => !!r);
            return routes.sort(
                (a, b) => a.path.length - b.path.length
            ) as RouteInfo<RouteExtraInfo>[];
        };

        const watcher = fs.watch(routeDir, {
            recursive: false,
        });

        watcher.on('change', () => {
            onAppUpdate({
                routes: compute(),
            });
        });

        return {
            dispose() {
                watcher.close();
            },
            manifest: {
                routes: compute(),
            },
        };
    },
    bookmarks: ['/example-app', '/example-app/about', '/example-app/home', '/example-app/other'],
});
function capitalizeFirstLetter(val: string): string {
    return val.length === 0 ? val : val.charAt(0).toUpperCase() + val.slice(1);
}
function toCamelCase(str: string): string {
    const words = str
        .split('.')
        .map((word, index) =>
            index > 0 ? capitalizeFirstLetter(word.toLowerCase()) : word.toLowerCase()
        );
    return words.join('');
}
