import { useEffect, useRef, useState } from "react";
import Button from "./Button";

// One dialog for both "new folder" and "rename folder" — the two differ only in
// their heading, button label and starting value, and folder names are the only
// thing either one collects.
//
// Built on the native <dialog> rather than a div overlay: showModal() gives the
// focus trap, the Escape handler and the inert backdrop for free, which is a lot
// of accessibility to re-implement for a single text field. daisyUI's `modal`
// classes are designed to sit on exactly this element.
const FolderNameDialog = ({
  open,
  heading,
  submitLabel,
  initialName = "",
  onSubmit,
  onClose,
}) => {
  const dialogRef = useRef(null);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  // Drive the element's own open state from the prop. Calling showModal() on an
  // already-open dialog throws, hence the `dialog.open` guards.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setName(initialName);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      // The parent decides whether this closes the dialog: a duplicate name
      // comes back as a 409, and the field should stay open with the text still
      // in it so the name can be corrected instead of retyped.
      await onSubmit(trimmed);
    } finally {
      setSaving(false);
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
        if (!saving) onClose();
      }}
    >
      <div className="modal-box glass-panel-strong">
        <h3 className="text-lg font-bold">{heading}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-control py-4">
            <input
              type="text"
              className="input input-bordered input-glass"
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="modal-action">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!name.trim()}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
      {/* Clicking the backdrop closes, matching what a modal is expected to do.
          daisyUI's own pattern is a form with method="dialog" filling the space
          behind the box. */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" onClick={onClose} />
      </form>
    </dialog>
  );
};

export default FolderNameDialog;
