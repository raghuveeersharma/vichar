import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import Button from "./Button";

// The app's replacement for `window.confirm`. That call is synchronous and blocks
// the whole tab, it cannot be styled, and on iOS standalone (the PWA case) it
// renders as a system sheet that looks nothing like the app it interrupts.
//
// Built on the native <dialog> for the same reason as FolderNameDialog:
// showModal() brings the focus trap, the Escape handler and the inert backdrop
// with it, and daisyUI's `modal` classes are written for this element.
//
// The confirm handler is awaited so a slow delete keeps its spinner inside the
// dialog rather than behind it, and the dialog closes itself once the handler
// settles — every caller here reports its own failures as a toast, so there is
// nothing left for an open dialog to say.
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmVariant = "outline-error",
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // Drive the element's own open state from the prop; showModal() on an
  // already-open dialog throws, hence the `dialog.open` guards.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismiss = () => {
    if (!busy) onClose();
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      // Escape fires `cancel`, not `close`-with-a-reason, so the parent's state
      // has to be told separately or it would think the dialog is still open.
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <div className="modal-box glass-panel-strong">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <AlertTriangleIcon className="size-5 shrink-0 text-error" />
          {title}
        </h3>
        <p className="py-4 text-base-content/80">{message}</p>
        <div className="modal-action">
          {/* Cancel takes the initial focus: this dialog only ever guards a
              destructive action, so Enter on an unread prompt must not confirm
              it. */}
          <Button variant="ghost" onClick={dismiss} disabled={busy} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} loading={busy} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
      {/* Clicking the backdrop cancels, matching what a modal is expected to do.
          daisyUI's own pattern is a form with method="dialog" filling the space
          behind the box. */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Cancel" onClick={dismiss} />
      </form>
    </dialog>
  );
};

export default ConfirmDialog;
