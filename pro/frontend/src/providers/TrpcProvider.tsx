"use client";

import superjson from "superjson";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { getAuthToken } from "src/utils/auth/getAuthToken";
import { isTRPCError } from "src/ui/errors/utils";
import { useTRPCErrorModal } from "src/ui/errors/api";
import { tClient } from "src/lib/trpc/client";
import { getBaseUrl } from "src/lib/trpc/getBaseUrl";
import { isUnauthorizedError } from "src/ui/errors/utils/isUnauthorizedError";
import { isLoginPage } from "src/utils/auth/isLoginPage";
import { toPage } from "src/utils/next/toPage";

export const TrpcProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showErrorModal } = useTRPCErrorModal();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isTRPCError(error)) {
              if (isUnauthorizedError(error) && !isLoginPage()) {
                window.location.href = toPage("login");
                return;
              }

              showErrorModal(error);
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isTRPCError(error)) {
              showErrorModal(error);
            }
          },
        }),
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    tClient.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          async headers() {
            const password = getAuthToken();

            if (password) {
              return {
                Authorization: password,
              };
            }

            return {};
          },
        }),
      ],
    }),
  );

  return (
    <tClient.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </tClient.Provider>
  );
};
