import { Toaster } from "sonner";
import { useTheme } from "./theme-provider";

/** Single toast surface for the whole app, kept in sync with the theme. */
export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-popover text-popover-foreground border border-border shadow-md",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
