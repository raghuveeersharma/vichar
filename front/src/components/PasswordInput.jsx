import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

// Reusable password field with a show/hide toggle, styled to match the
// daisyUI form-control/input pattern used across the auth pages.
const PasswordInput = ({
  label,
  className = "",
  inputClassName = "",
  ...inputProps
}) => {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className={`form-control ${className}`}>
      {label && (
        <label className="label" htmlFor={id}>
          <span className="label-text">{label}</span>
        </label>
      )}
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          type={visible ? "text" : "password"}
          className={`input input-bordered w-full pr-10 ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-base-content/50 hover:text-base-content"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOffIcon className="size-4" />
          ) : (
            <EyeIcon className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
};

export default PasswordInput;
