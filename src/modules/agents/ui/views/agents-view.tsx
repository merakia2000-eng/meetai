"use client"

import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";

import { useTRPC } from "@/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"

export const AgentsView = () => {
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.agents.getMany.queryOptions());

    // if (isLoading) {
    //     return (
    //         <LoadingState
    //             title="Loading Agents"
    //             description="This may take a few seconds.."
    //         />
    //     )
    // }

    // if (isError) {
    //     return (
    //         <ErrorState
    //             title="Faield to load agents"
    //             description="Something went wrong"
    //         />
    //     )
    // }

    return (
        <div>
            {JSON.stringify(data, null, 2)}
        </div>
    )
}

export const AgentsViewLoading = () => {
    return (
        <LoadingState title="Loading Agents"
            description="This make a fews seconds" />
    )
}

export const AgentsViewError = () => {
    return (
        <ErrorState
            title="Error Loading Agents"
            description="Something went wrong88"
        />
    )
}
