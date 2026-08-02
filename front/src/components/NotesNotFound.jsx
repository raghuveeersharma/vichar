import { NotebookIcon } from "lucide-react";
import Button from "./Button";

const NotesNotFound = () => {
  return (
    <div className="glass-panel-strong mx-auto mt-8 flex max-w-md flex-col items-center justify-center space-y-6 px-6 py-12 text-center sm:px-10 sm:py-16">
      <div className="rounded-full bg-primary/10 p-8">
        <NotebookIcon className="size-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold">No notes yet</h3>
      <p className="text-base-content/80">
        Ready to organize your thoughts? Create your first note to get started
        on your journey.
      </p>
      <Button to="/create" variant="primary">
        Create Your First Note
      </Button>
    </div>
  );
};
export default NotesNotFound;
