import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-lg font-semibold">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => router.history.go(-1)}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go back
        </button>
        <button
          onClick={() => router.navigate({ to: "/" })}
          className="mt-2 ml-2 inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90"
        >
          Home
        </button>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LT Grade Prep" },
      {
        name: "description",
        content:
          "UP LT Grade Mains Preparation for Computer with practice, submissions and evaluation.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Ensure cookies are sent with all SAME-ORIGIN fetch requests (critical for production)
    // But do NOT add credentials to cross-origin requests (like Cloudinary)
    if (typeof window !== "undefined") {
      const originalFetch = window.fetch;
      if (!(window.fetch as any).__wrapped) {
        window.fetch = function (...args: any[]) {
          const [resource, config = {}] = args;

          // Only add credentials for same-origin requests
          if (typeof resource === "string") {
            const isAbsolute = resource.startsWith("http://") || resource.startsWith("https://");
            const isRelative = resource.startsWith("/");
            
            if (isRelative) {
              // Relative URL - definitely same-origin
              config.credentials = "include";
            } else if (isAbsolute) {
              // Absolute URL - check if it's same-origin
              try {
                const url = new URL(resource);
                const currentOrigin = new URL(window.location.href).origin;
                if (url.origin === currentOrigin) {
                  config.credentials = "include";
                }
                // If cross-origin, don't add credentials (leave as default "omit")
              } catch {
                // If URL parsing fails, don't add credentials
              }
            }
          }

          return originalFetch.apply(window, [resource, config]);
        } as any;
        (window.fetch as any).__wrapped = true;
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
