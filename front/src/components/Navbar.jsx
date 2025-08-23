import { Link } from "react-router";
import { PlusIcon } from "lucide-react";

const Navbar = () => {
  return (
    <header className="bg-base-300 border-b border-base-content/10">
      <div className="mx-auto max-w-6xl p-4 ">
        <div className="flex items-center justify-between">
          <Link to={"/"} className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-primary font-mono tracking-wide">
              Vichar
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link to={"/create"} className="btn btn-primary">
              <PlusIcon className="size-4" />
              <span>new note</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
