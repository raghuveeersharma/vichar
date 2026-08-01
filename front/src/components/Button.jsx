import { Loader2Icon } from "lucide-react";
import { Link } from "react-router";

const VARIANT_CLASSES = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  "ghost-error": "btn-ghost text-error",
  "outline-primary": "btn-outline btn-primary",
  "outline-error": "btn-outline btn-error",
};

const SIZE_CLASSES = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "",
};

// Shared button styled with daisyUI's `btn` classes. Renders a react-router
// `Link` when `to` is given, otherwise a native `button`, so the same
// variant/size/responsive props work for both real actions and nav links.
const Button = ({
  to,
  variant = "primary",
  size = "md",
  square = false,
  active = false,
  fullWidth = false,
  responsiveFullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon,
  iconClassName = "",
  hideLabelOnMobile = false,
  className = "",
  children,
  type = "button",
  ...props
}) => {
  const classes = [
    "btn",
    active ? "btn-primary" : VARIANT_CLASSES[variant] ?? "",
    SIZE_CLASSES[size] ?? "",
    square ? "btn-square" : "",
    fullWidth ? "w-full" : responsiveFullWidth ? "w-full sm:w-auto" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        Icon && <Icon className={`size-4 ${iconClassName}`} />
      )}
      {children && (
        <span className={hideLabelOnMobile ? "hidden sm:inline" : undefined}>
          {children}
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
};

export default Button;
