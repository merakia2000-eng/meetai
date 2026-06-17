import {
    defaultShouldDehydrateQuery,
    QueryClient,
} from '@tanstack/react-query';
// import superjson from 'superjson';

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false, // 👈 全局关闭重试，这样每个页面都不用单独写了
                throwOnError: true, // 确保错误会抛给 ErrorBoundary/error.tsx
                staleTime: 30 * 1000,
            },
            dehydrate: {
                // serializeData: superjson.serialize,
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) ||
                    query.state.status === 'pending',
            },
            hydrate: {
                // deserializeData: superjson.deserialize,
            },
        },
    });
}