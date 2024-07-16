/* eslint-disable react-hooks/rules-of-hooks */
import React, { useMemo } from 'react';
import {
    defineApp,
    type IAppManifest,
    type IResults,
    type RouteInfo,
    type RequireModule,
    IReactAppProps,
    PageInfo,
} from '@wixc3/app-core';
import { Outlet } from '@remix-run/react';
import { createRemixStub } from '@remix-run/testing';
import { LoaderFunction } from '@remix-run/node';
type RouteObject = Parameters<typeof createRemixStub>[0][0];

const createEl = React.createElement;
const manifestToRouter = (manifest: IAppManifest<RouteExtraInfo>, requireModule: RequireModule) => {
    const Router = createRemixStub(
        manifest.routes.map((route) => {
            const { Component, loader } = getLazyCompAndLoader(
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
                    const { Component, loader } = getLazyCompAndLoader(
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

const loadedModules = new Map<string, ReturnType<typeof lazyCompAndLoader>>();
export const getLazyCompAndLoader = (
    filePath: string,
    compExportName: string,
    requireModule: RequireModule,
    wrapWithOutlet = false
) => {
    const key = `${filePath}:${compExportName}`;
    let module = loadedModules.get(key);
    if (!module) {
        module = lazyCompAndLoader(filePath, compExportName, requireModule, wrapWithOutlet);
        loadedModules.set(key, module);
    }
    return module;
};

function lazyCompAndLoader<ExportName extends string>(
    filePath: string,
    compExportName: ExportName,
    requireModule: RequireModule,
    wrapWithOutlet = false
) {
    const Component = React.lazy(async () => {
        let updateModule: ((newModule: IResults<unknown>) => void) | undefined;
        const { moduleResults } = requireModule(filePath, (newResults) => {
            updateModule?.(newResults);
        });
        const initialyLoadedModule = await moduleResults;

        const PageComp = () => {
            // const [updatedModule, setModule] =
            //     React.useState<IResults<unknown>>(initialyLoadedModule);
            // const isDisposed = React.useRef(false);
            // React.useEffect(() => {
            //     return () => {
            //         isDisposed.current = true;
            //     };
            // }, []);
            // const updateModuleIfNotDisposed = (newModule: IResults<unknown>) => {
            //     if (!isDisposed.current) {
            //         setModule(newModule);
            //     }
            // };
            // updateModule = updateModuleIfNotDisposed;
            const current = initialyLoadedModule || module;
            if (current.errorMessage) {
                return <div>{current.errorMessage}</div>;
            }
            const Page = (
                initialyLoadedModule.results as {
                    [key in ExportName]: React.ComponentType<{ children?: React.ReactNode }>;
                }
            )[compExportName];

            if (!Page) {
                return (
                    <div>
                        {compExportName} export not found at {filePath}{' '}
                    </div>
                );
            }
            if (wrapWithOutlet) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const Layout = Page as any;
                return createEl(Layout, {}, [createEl(Outlet)]);
            }
            return createEl(Page);
        };
        return {
            default: () => {
                return createEl(PageComp);
            },
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

const routePathId = (path: RouteInfo['path']) => {
    return path
        .map((part) => {
            if (part.kind === 'static') {
                return part.text;
            }
            return `$$$`;
        })
        .join('/');
};

export default defineApp<RouteExtraInfo>({
    App: ({ manifest, requireModule, uri }: IReactAppProps<RouteExtraInfo>) => {
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
    getNewPageInfo({ fs, wantedPath, manifest }) {
        const routeDir = fs.join(__dirname, '../app/routes');
        const varNames = new Set<string>();

        if (wantedPath.length === 0 && manifest.homeRoute) {
            return {
                isValid: false,
                errorMessage: 'Home route already exists at ' + manifest.homeRoute.pageModule,
                pageModule: manifest.homeRoute.pageModule,
                newPageSourceCode: '',
            };
        }
        const wantedPathId = routePathId(wantedPath);
        const existingRoute = manifest.routes.find(
            (route) => routePathId(route.path) === wantedPathId
        );
        if (existingRoute) {
            return {
                isValid: false,
                errorMessage: 'Route already exists at file path: ' + existingRoute.pageModule,
                pageModule: existingRoute.pageModule,
                newPageSourceCode: '',
            };
        }

        const pageFileName = wantedPath
            .map((part) => {
                if (part.kind === 'static') {
                    return part.text;
                }
                varNames.add(part.name);
                return `$${part.name}`;
            })
            .join('.');
        const pageName = toCamelCase(pageFileName);
        const pageModule = fs.join(routeDir, pageFileName + '.tsx');
        const newPageSourceCode =
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
            isValid: true,
            error: '',
            newPageSourceCode,
            pageModule,
        };
    },

    async prepareApp({ fs, onManifestUpdate }) {
        const rootPath = fs.join(__dirname, '../app/root.tsx');
        const routeDir = fs.join(__dirname, '../app/routes');

        const compute = () => {
            const filesInDir = fs.readdirSync(routeDir);
            const homeRouteModule = filesInDir.find((name) => name === '_index.tsx');
            const errorRouteModule = filesInDir.find((name) => name === 'errors.tsx');

            const routeDirChildren = fs.readdirSync(routeDir).map((name) => {
                const fullPath = fs.join(routeDir, name);
                const isFile = fs.statSync(fullPath).isFile();
                if (isFile && name.endsWith('.tsx')) {
                    if (name === '_index.tsx' || name === 'errors.tsx') {
                        return null;
                    }
                    const fileName = fs.basename(name, '.tsx');
                    const routeParts = fileName.split('.');

                    return aRoute(
                        rootPath,
                        routeParts
                            .map((p) => {
                                if (p.startsWith('$')) {
                                    return {
                                        kind: 'dynamic' as const,
                                        name: p.slice(1, p.length),
                                    };
                                }
                                if (p === '_index') {
                                    return null;
                                }
                                return {
                                    kind: 'static' as const,
                                    text: p,
                                };
                            })
                            .filter((p): p is RouteInfo['path'][0] => !!p),
                        fullPath,
                        [rootPath, fullPath]
                    );
                }
                return null;
            });
            const routes = routeDirChildren.filter((r): r is RouteInfo<RouteExtraInfo> => !!r);
            return {
                routes: routes.sort(
                    (a, b) => a.path.length - b.path.length
                ) as RouteInfo<RouteExtraInfo>[],
                homeRoute: homeRouteModule
                    ? aRoute(rootPath, [], fs.join(routeDir, homeRouteModule), [])
                    : undefined,
                errorRoute: errorRouteModule
                    ? aRoute(rootPath, [], fs.join(routeDir, errorRouteModule), [])
                    : undefined,
            };
        };

        const watcher = fs.watch(routeDir, {
            recursive: false,
        });

        watcher.on('change', () => {
            onManifestUpdate(compute());
        });

        return {
            dispose() {
                watcher.close();
            },
            manifest: compute(),
        };
    },
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

const aRoute = (
    rootPath: string,
    path: RouteInfo['path'],
    pageModule: string,
    renderedRoutes: string[]
): RouteInfo<RouteExtraInfo> => ({
    path,
    ...aPage(rootPath, pageModule, renderedRoutes),
});

const aPage = (
    rootPath: string,
    pageModule: string,
    renderedRoutes: string[]
): PageInfo<RouteExtraInfo> => ({
    pageModule,
    pageExportName: 'default',
    parentLayouts: [
        {
            layoutModule: rootPath,
            layoutExportName: 'Layout',
        },
    ],
    extraData: { rendereredRoutes: renderedRoutes },
});
