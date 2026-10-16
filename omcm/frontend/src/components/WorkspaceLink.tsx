import { createContext, useContext, type ComponentProps } from "react";
import { Link } from "react-router-dom";
export const WorkspaceNavigation = createContext<(path: string) => void>(
  () => {},
);
export function WorkspaceLink({
  to,
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  const navigate = useContext(WorkspaceNavigation);
  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (
          typeof to === "string" &&
          to !== "/public" &&
          !event.defaultPrevented
        ) {
          event.preventDefault();
          navigate(to);
        }
      }}
    />
  );
}
